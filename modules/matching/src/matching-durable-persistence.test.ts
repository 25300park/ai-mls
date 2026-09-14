import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "../../audit/src/audit-intent-materializer.js";
import { DurableMatchingStore, MatchingPersistenceError, type MatchingAuditIntent, type MatchingBindingResolver } from "./matching-durable-persistence.js";
import type { MatchResult, MatchRun } from "./matching-service.js";

const now = "2026-09-13T06:00:00.000Z";
const result: MatchResult = { id: "result-a", version: 1, runId: "run-a", teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", classification: "RESTRICTED_PERSONAL", requirementRef: { id: "requirement-a", version: 1 }, candidateRef: { id: "candidate-a", version: 1 }, offerRef: { id: "offer-a", version: 1 }, hardEligibility: "PASS", hardMatchCount: 1, score: 80, budgetFit: 75, rank: 1, components: [], explanation: { kind: "DETERMINISTIC", reasonCodes: [], limitations: [] }, matcherVersion: "deterministic-matching-v1", policyVersion: "policy-v1", calculatedAt: now, reviewHistory: [] };
const run: MatchRun = { id: "run-a", version: 1, teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", requirementRef: { id: "requirement-a", version: 1 }, cohortSize: 1, results: [result], reviewResults: [result], requestedBy: "actor-a", calculatedAt: now, policyVersion: "policy-v1" };
const reviewed: MatchResult = { ...result, version: 2, status: "REVIEWED", reviewHistory: [{ actorId: "actor-a", status: "REVIEWED", reason: "reviewed", occurredAt: now }] };
const stale: MatchResult = { ...reviewed, version: 3, status: "STALE", staleReason: "source changed", reviewHistory: [...reviewed.reviewHistory, { actorId: "actor-a", status: "STALE", reason: "source changed", occurredAt: now }] };

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): MatchingAuditIntent {
  return {
    auditIntentContractVersion: "v2", intentId: "01-run-create", sourceDomain: "MATCHING", aggregateId: run.id, mutationIdentity: "run-command",
    eventType: "MATCH_RUN_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "matching.request", target: { type: "MatchRun", id: run.id, version: run.version },
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-a", sessionId: "session-a" } },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" }, purpose: "CLIENT_MATCHING", policyVersion: "policy-v1",
    classification: "RESTRICTED_PERSONAL", decision: "ALLOW", outcome: "COMPLETED", committedAt: now, correlationId: "correlation-a", evidenceRefs: ["evidence:run-a"], ...overrides,
  } as unknown as MatchingAuditIntent;
}

function resultIntent(record: MatchResult, identity: string, eventType: "MATCH_RESULT_REVIEWED" | "MATCH_RESULT_STALE"): MatchingAuditIntent {
  return intent({ intentId: identity, aggregateId: record.id, mutationIdentity: identity, eventType, eventCategory: "STATE_CHANGED",
    action: eventType === "MATCH_RESULT_STALE" ? "matching.stale" : "matching.review", target: { type: "MatchResult", id: record.id, version: record.version },
    outcome: "COMPLETED", evidenceRefs: [`evidence:${record.id}`] });
}

function fixture(): Readonly<{ directory: string; databasePath: string }> { const directory = mkdtempSync(join(tmpdir(), "rel001-matching-store-")); return { directory, databasePath: join(directory, "matching.sqlite") }; }
function resolver(overrides: Partial<{ requirementTenant: string; requirementTeam: string; candidateTenant: string; candidateTeam: string }> = {}) { return { resolveRequirementBinding(id: string) { return id === "requirement-a" ? { tenantId: overrides.requirementTenant ?? "tenant-a", teamId: overrides.requirementTeam ?? "team-a" } : undefined; }, resolveCandidateBinding(id: string) { return id === "candidate-a" ? { tenantId: overrides.candidateTenant ?? "tenant-a", teamId: overrides.candidateTeam ?? "team-a" } : undefined; } }; }
function createRun(store: DurableMatchingStore, record: MatchRun = run, auditIntent: MatchingAuditIntent = intent()) { return store.createRun({ tenantId: "tenant-a", record, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent }); }
function reverseObjectKeyOrder<T>(value: T): T { if (Array.isArray(value)) return value.map(reverseObjectKeyOrder) as T; if (value === null || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)])) as T; }
function count(database: DatabaseSync, table: string): number { return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.["count"]); }

test("Matching stores all three enriched v2 mapping families across restart", () => {
  const f = fixture(); let store: DurableMatchingStore | undefined;
  try {
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    assert.equal(createRun(store).status, "STORED");
    assert.deepEqual(store.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: reviewed, auditIntent: resultIntent(reviewed, "02-result-review", "MATCH_RESULT_REVIEWED") }), reviewed);
    assert.deepEqual(store.updateResult({ tenantId: "tenant-a", expectedVersion: 2, record: stale, auditIntent: resultIntent(stale, "03-result-stale", "MATCH_RESULT_STALE") }), stale);
    store.close(); store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    assert.deepEqual(store.readRun({ tenantId: "tenant-a", runId: run.id }), run); assert.deepEqual(store.readResult({ tenantId: "tenant-a", resultId: result.id }), stale);
    assert.equal(store.readRun({ tenantId: "tenant-b", runId: run.id }), undefined); assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [intent(), resultIntent(reviewed, "02-result-review", "MATCH_RESULT_REVIEWED"), resultIntent(stale, "03-result-stale", "MATCH_RESULT_STALE")]);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching rejects v1, missing provenance, and wrong run tuple or security context before mutation", () => {
  const legacy = { intentId: "01-run-create", domainOwner: "MATCHING", aggregateId: run.id, mutationIdentity: "run-command", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "MATCHING_MUTATION", committedAt: now, evidenceRefs: ["evidence:run-a"] } as unknown as MatchingAuditIntent;
  const missingProvenance = { ...intent() } as unknown as Record<string, unknown>; delete missingProvenance["principalProvenance"];
  const invalid: readonly MatchingAuditIntent[] = [legacy, missingProvenance as unknown as MatchingAuditIntent,
    intent({ eventType: "MATCH_RESULT_REVIEWED", eventCategory: "STATE_CHANGED", action: "matching.review", target: { type: "MatchResult", id: run.id, version: 1 }, outcome: "COMPLETED" }),
    intent({ action: "matching.review" }), intent({ eventCategory: "STATE_CHANGED" }), intent({ target: { type: "MatchResult", id: run.id, version: 1 } }),
    intent({ purpose: "OTHER_PURPOSE" }), intent({ decision: "DENY" }), intent({ outcome: "ACCEPTED" }), intent({ classification: "INTERNAL" }), intent({ policyVersion: "policy-v2" }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "team:team-a" } }), intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-b" } }),
    intent({ principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-b", type: "HUMAN", roles: ["AGT"], teamId: "team-a" } } }),
    intent({ principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-b" } } }),
    intent({ aggregateId: "run-b" }), intent({ mutationIdentity: "other-command" }), intent({ target: { type: "MatchRun", id: "run-b", version: 1 } }), intent({ target: { type: "MatchRun", id: run.id, version: 2 } }),
  ];
  for (const [index, auditIntent] of invalid.entries()) {
    const f = fixture(); let store: DurableMatchingStore | undefined;
    try {
      store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
      assert.throws(() => createRun(store!, run, auditIntent), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID", `invalid intent case ${String(index)}`);
      assert.equal(store.readRun({ tenantId: "tenant-a", runId: run.id }), undefined); assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), []);
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Matching accepts both closed provenance alternatives against authoritative domain bindings", () => {
  const provenance: readonly EnrichedAuditIntentV2["principalProvenance"][] = [
    { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"] } },
    { kind: "IMMUTABLE_REFERENCE", principalId: "actor-a", evidenceRef: "evidence:principal-a" },
  ];
  for (const [index, principalProvenance] of provenance.entries()) {
    const f = fixture(); let store: DurableMatchingStore | undefined;
    try {
      store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
      assert.equal(createRun(store, run, intent({ principalProvenance })).status, "STORED", `provenance case ${String(index)}`);
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Matching binds Requirement, Candidate, Run, Result, tenant and team identities", () => {
  for (const bindingResolver of [resolver({ requirementTenant: "tenant-b" }), resolver({ requirementTeam: "team-b" }), resolver({ candidateTenant: "tenant-b" }), resolver({ candidateTeam: "team-b" })]) {
    const f = fixture(); let store: DurableMatchingStore | undefined;
    try { store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver }); assert.throws(() => createRun(store!), (error: unknown) => error instanceof MatchingPersistenceError && ["TENANT_BINDING_INVALID", "SCOPE_BINDING_INVALID"].includes(error.code)); store.close(); store = undefined; }
    finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
  const malformedRuns: readonly MatchRun[] = [
    { ...run, results: [{ ...result, runId: "run-b" }], reviewResults: [{ ...result, runId: "run-b" }] },
    { ...run, results: [{ ...result, teamId: "team-b" }], reviewResults: [{ ...result, teamId: "team-b" }] },
    { ...run, results: [{ ...result, requirementRef: { id: "requirement-b", version: 1 } }], reviewResults: [{ ...result, requirementRef: { id: "requirement-b", version: 1 } }] },
    { ...run, results: [{ ...result, candidateRef: { id: "candidate-b", version: 1 } }], reviewResults: [{ ...result, candidateRef: { id: "candidate-b", version: 1 } }] },
  ];
  for (const record of malformedRuns) {
    const f = fixture(); let store: DurableMatchingStore | undefined;
    try { store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() }); assert.throws(() => createRun(store!, record, intent()), (error: unknown) => error instanceof MatchingPersistenceError && ["PERSISTENCE_INPUT_INVALID", "TENANT_BINDING_INVALID"].includes(error.code)); store.close(); store = undefined; }
    finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

const resolverWith = (extraRequirement: Readonly<{ tenantId: string; teamId: string }> | undefined, extraCandidate: Readonly<{ tenantId: string; teamId: string }> | undefined): MatchingBindingResolver => ({
    resolveRequirementBinding(id: string) { if (id === "requirement-a") return { tenantId: "tenant-a", teamId: "team-a" }; return id === "requirement-b" ? extraRequirement : undefined; },
    resolveCandidateBinding(id: string) { if (id === "candidate-a") return { tenantId: "tenant-a", teamId: "team-a" }; return id === "candidate-b" ? extraCandidate : undefined; },
});
const invalidReviewResultCases: readonly Readonly<{ name: string; reviewResult: unknown; bindingResolver: MatchingBindingResolver }>[] = [
  { name: "malformed", reviewResult: { ...result, candidateRef: null }, bindingResolver: resolver() },
  { name: "cross-run", reviewResult: { ...result, runId: "run-b" }, bindingResolver: resolver() },
  { name: "cross-team", reviewResult: { ...result, teamId: "team-b" }, bindingResolver: resolver() },
  { name: "cross-requirement", reviewResult: { ...result, requirementRef: { id: "requirement-b", version: 1 } }, bindingResolver: resolverWith({ tenantId: "tenant-a", teamId: "team-a" }, undefined) },
  { name: "cross-tenant Candidate", reviewResult: { ...result, candidateRef: { id: "candidate-b", version: 1 } }, bindingResolver: resolverWith(undefined, { tenantId: "tenant-b", teamId: "team-a" }) },
  { name: "cross-team Candidate", reviewResult: { ...result, candidateRef: { id: "candidate-b", version: 1 } }, bindingResolver: resolverWith(undefined, { tenantId: "tenant-a", teamId: "team-b" }) },
  { name: "non-persisted Result", reviewResult: { ...result, id: "result-b" }, bindingResolver: resolver() },
];
for (const item of invalidReviewResultCases) {
  test(`Matching rejects ${item.name} reviewResult before persistence`, () => {
    const f = fixture(); let store: DurableMatchingStore | undefined;
    try {
      store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: item.bindingResolver });
      const record = { ...run, reviewResults: [item.reviewResult] } as unknown as MatchRun;
      assert.throws(() => createRun(store!, record, intent()), (error: unknown) => error instanceof MatchingPersistenceError && ["PERSISTENCE_INPUT_INVALID", "TENANT_BINDING_INVALID", "SCOPE_BINDING_INVALID"].includes(error.code));
      const sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); for (const table of ["matching_runs", "matching_results", "matching_result_history", "matching_commands", "matching_audit_intents"]) assert.equal(count(sqlite, table), 0); sqlite.close();
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  });
}

test("Matching rejects wrong review and stale mapping, target and provenance bindings", () => {
  const f = fixture(); let store: DurableMatchingStore | undefined;
  try {
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() }); createRun(store);
    const reviewBase = resultIntent(reviewed, "02-result-review", "MATCH_RESULT_REVIEWED") as unknown as EnrichedAuditIntentV2;
    const invalidReview = [intent({ ...reviewBase, eventType: "MATCH_RESULT_STALE", action: "matching.stale" }), intent({ ...reviewBase, target: { type: "MatchRun", id: result.id, version: 2 } }), intent({ ...reviewBase, target: { type: "MatchResult", id: "result-b", version: 2 } }), intent({ ...reviewBase, target: { type: "MatchResult", id: result.id, version: 1 } }), intent({ ...reviewBase, aggregateId: "result-b" }), intent({ ...reviewBase, outcome: "ACCEPTED" }), intent({ ...reviewBase, purpose: "OTHER_PURPOSE" }), intent({ ...reviewBase, principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-b", type: "HUMAN", roles: ["AGT"], teamId: "team-a" } } })];
    for (const auditIntent of invalidReview) assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: reviewed, auditIntent }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    const staleVersion = { ...result, status: "REVIEWED" as const, reviewHistory: [{ actorId: "actor-a", status: "REVIEWED" as const, reason: "stale version", occurredAt: now }] };
    assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 0, record: staleVersion, auditIntent: resultIntent(staleVersion, "stale-version", "MATCH_RESULT_REVIEWED") }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "VERSION_CONFLICT");
    for (const wrongRecord of [{ ...reviewed, runId: "run-b" }, { ...reviewed, requirementRef: { id: "requirement-b", version: 1 } }, { ...reviewed, candidateRef: { id: "candidate-b", version: 1 } }]) {
      assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: wrongRecord, auditIntent: resultIntent(wrongRecord, "wrong-binding", "MATCH_RESULT_REVIEWED") }), (error: unknown) => error instanceof MatchingPersistenceError && ["PERSISTENCE_INPUT_INVALID", "TENANT_BINDING_INVALID"].includes(error.code));
    }
    assert.deepEqual(store.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: reviewed, auditIntent: resultIntent(reviewed, "02-result-review", "MATCH_RESULT_REVIEWED") }), reviewed);
    assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 2, record: stale, auditIntent: resultIntent(stale, "03-result-stale", "MATCH_RESULT_REVIEWED") }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.equal(store.readResult({ tenantId: "tenant-a", resultId: result.id })?.version, 2); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching exact structural replay adds zero duplicates and conflicting intent replay fails", () => {
  const f = fixture(); let store: DurableMatchingStore | undefined;
  try {
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() }); const firstIntent = intent(); assert.equal(createRun(store, run, firstIntent).status, "STORED");
    const replayRecord = reverseObjectKeyOrder(run); const replayIntent = reverseObjectKeyOrder({ ...firstIntent as unknown as EnrichedAuditIntentV2, requestId: undefined, reason: undefined }) as unknown as MatchingAuditIntent;
    assert.equal(createRun(store, replayRecord, replayIntent).status, "REPLAYED");
    for (const auditIntent of [intent({ correlationId: "correlation-b" }), intent({ evidenceRefs: ["evidence:run-a", "evidence:other"] })]) assert.throws(() => createRun(store!, run, auditIntent), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    const sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(count(sqlite, "matching_runs"), 1); assert.equal(count(sqlite, "matching_results"), 1); assert.equal(count(sqlite, "matching_result_history"), 1); assert.equal(count(sqlite, "matching_commands"), 1); assert.equal(count(sqlite, "matching_audit_intents"), 1); sqlite.close();
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching audit failure rolls back create and both result mutation paths", () => {
  const f = fixture(); let store: DurableMatchingStore | undefined;
  try {
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver(), beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => createRun(store!), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
    let sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); for (const table of ["matching_runs", "matching_results", "matching_result_history", "matching_commands", "matching_audit_intents"]) assert.equal(count(sqlite, table), 0); sqlite.close();
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() }); createRun(store); store.close();
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver(), beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: reviewed, auditIntent: resultIntent(reviewed, "02-result-review", "MATCH_RESULT_REVIEWED") }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    const staleFromInitial = { ...result, version: 2, status: "STALE" as const, staleReason: "source changed", reviewHistory: [{ actorId: "actor-a", status: "STALE" as const, reason: "source changed", occurredAt: now }] };
    assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: staleFromInitial, auditIntent: resultIntent(staleFromInitial, "03-result-stale", "MATCH_RESULT_STALE") }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
    sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(sqlite.prepare("SELECT version FROM matching_results WHERE result_id = ?").get(result.id)?.["version"], 1); assert.equal(count(sqlite, "matching_result_history"), 1); assert.equal(count(sqlite, "matching_audit_intents"), 1); sqlite.close();
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching preserves a pre-existing v1 intent byte-for-byte and keeps it non-materializable", () => {
  const f = fixture(); const legacy = { intentId: "legacy-matching-intent", domainOwner: "MATCHING", aggregateId: run.id, mutationIdentity: "legacy-command", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "MATCHING_MUTATION", committedAt: now, evidenceRefs: ["evidence:run-a"] } as const; const legacyJson = JSON.stringify(legacy);
  try {
    let store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() }); store.close();
    const sqlite = new DatabaseSync(f.databasePath); sqlite.prepare("INSERT INTO matching_audit_intents (intent_id, aggregate_id, tenant_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)").run(legacy.intentId, legacy.aggregateId, legacy.tenantId, legacy.mutationIdentity, legacyJson); sqlite.close();
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() }); const rows = store.listAuditIntents({ tenantId: "tenant-a" }); assert.deepEqual(rows, [legacy]);
    const port = createAuditIntentSourcePort({ sourceDomain: "MATCHING", read: () => rows }); assert.deepEqual(port.listEligible({}), { intents: [] }); store.close();
    const verify = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(verify.prepare("SELECT payload_json FROM matching_audit_intents WHERE intent_id = ?").get(legacy.intentId)?.["payload_json"], legacyJson); verify.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching revalidates authoritative Requirement and Candidate binding before update", () => {
  const f = fixture(); let candidateTenant = "tenant-a"; let store: DurableMatchingStore | undefined;
  try {
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: { resolveRequirementBinding: () => ({ tenantId: "tenant-a", teamId: "team-a" }), resolveCandidateBinding: () => ({ tenantId: candidateTenant, teamId: "team-a" }) } }); createRun(store); candidateTenant = "tenant-b";
    assert.throws(() => store!.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: reviewed, auditIntent: resultIntent(reviewed, "02-result-review", "MATCH_RESULT_REVIEWED") }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    assert.equal(store.readResult({ tenantId: "tenant-a", resultId: result.id })?.version, 1); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching conceals authoritative binding resolver diagnostics", () => {
  const f = fixture(); let store: DurableMatchingStore | undefined;
  try {
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: { resolveRequirementBinding() { throw new Error("C:\\internal\\matching.sqlite bearer raw-token"); }, resolveCandidateBinding() { return undefined; } } });
    assert.throws(() => createRun(store!), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});
