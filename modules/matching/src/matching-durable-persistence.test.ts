import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableMatchingStore, MatchingPersistenceError, type MatchingAuditIntent } from "./matching-durable-persistence.js";
import type { MatchResult, MatchRun } from "./matching-service.js";

const now = "2026-09-13T06:00:00.000Z";
const result: MatchResult = { id: "result-a", version: 1, runId: "run-a", teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", classification: "RESTRICTED_PERSONAL", requirementRef: { id: "requirement-a", version: 1 }, candidateRef: { id: "candidate-a", version: 1 }, offerRef: { id: "offer-a", version: 1 }, hardEligibility: "PASS", hardMatchCount: 1, score: 80, budgetFit: 75, rank: 1, components: [], explanation: { kind: "DETERMINISTIC", reasonCodes: [], limitations: [] }, matcherVersion: "deterministic-matching-v1", policyVersion: "policy-v1", calculatedAt: now, reviewHistory: [] };
const run: MatchRun = { id: "run-a", version: 1, teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", requirementRef: { id: "requirement-a", version: 1 }, cohortSize: 1, results: [result], reviewResults: [result], requestedBy: "actor-a", calculatedAt: now, policyVersion: "policy-v1" };
function intent(id: string, aggregateId: string, tenantId = "tenant-a"): MatchingAuditIntent { return { intentId: id, domainOwner: "MATCHING", aggregateId, mutationIdentity: id, actorId: "actor-a", tenantId, scopeRef: "team:team-a", classificationRef: "MATCHING_MUTATION", committedAt: now, evidenceRefs: [`evidence:${aggregateId}`] }; }
function fixture() { const directory = mkdtempSync(join(tmpdir(), "rel001-matching-store-")); return { directory, databasePath: join(directory, "matching.sqlite") }; }
function resolver(overrides: Partial<{ requirementTenant: string; candidateTenant: string }> = {}) { return { resolveRequirementBinding(id: string) { return id === "requirement-a" ? { tenantId: overrides.requirementTenant ?? "tenant-a", teamId: "team-a" } : undefined; }, resolveCandidateBinding(id: string) { return id === "candidate-a" ? { tenantId: overrides.candidateTenant ?? "tenant-a", teamId: "team-a" } : undefined; } }; }

test("Matching persists Run, Results and idempotency across restart", () => {
  const f = fixture();
  try {
    let store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    assert.equal(store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) }).status, "STORED");
    store.close();
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    assert.deepEqual(store.readRun({ tenantId: "tenant-a", runId: run.id }), run);
    assert.equal(store.readRun({ tenantId: "tenant-b", runId: run.id }), undefined);
    assert.deepEqual(store.readResult({ tenantId: "tenant-a", resultId: result.id }), result);
    assert.equal(store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) }).status, "REPLAYED");
    assert.throws(() => store.createRun({ tenantId: "tenant-a", record: { ...run, requestedBy: "actor-b" }, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching rejects cross-tenant Requirement/Candidate binding and caller tenant override", () => {
  const f = fixture();
  try {
    let store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver({ candidateTenant: "tenant-b" }) });
    assert.throws(() => store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    store.close();
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    assert.throws(() => store.createRun({ tenantId: "tenant-b", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id, "tenant-b") }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching review/stale mutations are VERSION_ONLY and append immutable history", () => {
  const f = fixture();
  try {
    const store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) });
    assert.throws(() => store.updateResult({ tenantId: "tenant-a", expectedVersion: 0, record: { ...result, status: "REVIEWED" }, auditIntent: intent("result-update", result.id) }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "VERSION_CONFLICT");
    const reviewed: MatchResult = { ...result, version: 2, status: "REVIEWED", reviewHistory: [{ actorId: "actor-a", status: "REVIEWED", reason: "reviewed", occurredAt: now }] };
    assert.deepEqual(store.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: reviewed, auditIntent: intent("result-update", result.id) }), reviewed);
    assert.equal(store.listResultHistory({ tenantId: "tenant-a", resultId: result.id }).length, 2);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching revalidates current Requirement and Candidate bindings before update", () => {
  const f = fixture();
  let candidateTenant = "tenant-a";
  try {
    const store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: { resolveRequirementBinding: () => ({ tenantId: "tenant-a", teamId: "team-a" }), resolveCandidateBinding: () => ({ tenantId: candidateTenant, teamId: "team-a" }) } });
    store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) });
    candidateTenant = "tenant-b";
    assert.throws(() => store.updateResult({ tenantId: "tenant-a", expectedVersion: 1, record: { ...result, version: 2, status: "ACCEPTED" }, auditIntent: intent("result-update", result.id) }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    assert.equal(store.readResult({ tenantId: "tenant-a", resultId: result.id })?.version, 1);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching audit-intent failure atomically rolls back Run, Results and command identity", () => {
  const f = fixture();
  try {
    let store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver(), beforeAuditIntentWrite: () => { throw new Error("fail"); } });
    assert.throws(() => store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: resolver() });
    assert.equal(store.readRun({ tenantId: "tenant-a", runId: run.id }), undefined);
    assert.equal(store.readResult({ tenantId: "tenant-a", resultId: result.id }), undefined);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 0);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Matching conceals authoritative binding resolver diagnostics", () => {
  const f = fixture();
  try {
    const store = new DurableMatchingStore({ databasePath: f.databasePath, bindingResolver: { resolveRequirementBinding() { throw new Error("C:\\internal\\matching.sqlite bearer raw-token"); }, resolveCandidateBinding() { return undefined; } } });
    assert.throws(() => store.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:run", auditIntent: intent("run-command", run.id) }), (error: unknown) => error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
