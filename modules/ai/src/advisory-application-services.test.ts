import { adaptSynchronousAdvisoryPersistence } from "./advisory-async-persistence.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  Ai001ListingParseApplicationService,
  Ai004RequirementParseApplicationService,
  Ai005MatchingApplicationService,
  type AdvisoryApplicationExecutionInput,
} from "./advisory-application-services.js";
import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import { DeterministicNoNetworkAdvisoryAdapter } from "./advisory-test-adapter.js";
import type { AdvisoryPromptRecord, TrustedAdvisorySnapshot } from "./advisory-runtime-contracts.js";

const confidence = Object.freeze({ band: "MEDIUM" as const, reasonCodes: ["REVIEW_REQUIRED"], policyVersion: "ai-policy-v1" });
const subjects = Object.freeze({
  "AI-001": Object.freeze({ entityType: "RawSource", entityId: "raw-a", version: "1" }),
  "AI-004": Object.freeze({ entityType: "ClientInput", entityId: "client-input-a", version: "2" }),
  "AI-005": Object.freeze({ entityType: "MatchCohort", entityId: "cohort-a", version: "3" }),
});
const schemas = Object.freeze({
  "AI-001": "urn:ai-mls:schema:listing-parser-output:v0.1" as const,
  "AI-004": "urn:ai-mls:schema:requirement-parser-output:v0.1" as const,
  "AI-005": "urn:ai-mls:schema:matching-result:v0.1" as const,
});

function envelope(capability: keyof typeof schemas): unknown {
  const subject = subjects[capability];
  const requirementRef = Object.freeze({ entityType: "Requirement", entityId: "requirement-a", version: "1" });
  const candidateRef = Object.freeze({ entityType: "Listing", entityId: "listing-a", version: "1" });
  const output = capability === "AI-001"
    ? { capabilityId: "AI-001", inputRef: subject, fields: [], warnings: [], overallConfidence: confidence }
    : capability === "AI-004"
      ? { capabilityId: "AI-004", inputRef: subject, intent: "UNKNOWN", budget: { valueState: "MISSING", confidence }, locations: [], propertyTypes: [], preferences: [], clarificationNeeds: [], overallConfidence: confidence }
      : { capabilityId: "AI-005", requirementRef, candidateRef, cohortRef: "cohort-a", factors: [], hardConstraintOutcome: "UNKNOWN", score: 0, rank: 1, explanation: "Insufficient evidence", confidence };
  const provenance = capability === "AI-005" ? [subject, requirementRef, candidateRef] : [subject];
  return Object.freeze({ schemaVersion: "1.0", schemaId: schemas[capability], capabilityId: capability, subjectRef: subject, provenance, classification: "CONFIDENTIAL_BUSINESS", output });
}

async function runService(capability: keyof typeof schemas, run: (context: { service: { execute(input: AdvisoryApplicationExecutionInput): unknown }; store: DurableAdvisoryStore }) => void | Promise<void>, result: unknown = envelope(capability)): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase4c-service-"));
  const store = new DurableAdvisoryStore({ databasePath: join(directory, "advisory.sqlite") });
  const prompt = Object.freeze<AdvisoryPromptRecord>({ promptId: `PRM-${capability}-001`, promptVersion: "v1.0", capabilityId: capability, schemaId: schemas[capability], contentFingerprint: `sha256:prompt-${capability}`, status: "ACTIVE", createdAt: "2026-09-15T02:00:00.000Z" });
  store.registerPrompt(prompt);
  const snapshot = Object.freeze<TrustedAdvisorySnapshot>({ tenantId: "tenant-a", scopeRef: "team:team-a", subjectRef: subjects[capability], provenance: [subjects[capability]], inputClassifications: ["CONFIDENTIAL_BUSINESS"], inputFingerprint: `sha256:input-${capability}`, evidenceFingerprint: `sha256:evidence-${capability}` });
  const adapter = new DeterministicNoNetworkAdvisoryAdapter({ result });
  const runtime = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => snapshot }, adapter, clock: () => new Date("2026-09-15T02:01:00.000Z") });
  const binding = { capabilityVersion: "v1.0", promptId: prompt.promptId, promptVersion: prompt.promptVersion };
  const service = capability === "AI-001" ? new Ai001ListingParseApplicationService({ runtime, binding }) : capability === "AI-004" ? new Ai004RequirementParseApplicationService({ runtime, binding }) : new Ai005MatchingApplicationService({ runtime, binding });
  try { await run({ service, store }); } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
}

function input(capability: keyof typeof schemas): AdvisoryApplicationExecutionInput {
  return Object.freeze({ tenantId: "tenant-a", scopeRef: "team:team-a", inputReference: subjects[capability], correlationId: `correlation-${capability}`, idempotencyKey: `job:job-${capability}:attempt:1`, initiatingPrincipalEvidenceRef: "principal-evidence:job-a", initiatingPrincipalProvenance: Object.freeze({ kind: "TRUSTED_SNAPSHOT" as const, principal: Object.freeze({ id: "user-a", type: "HUMAN" as const, roles: ["OPS" as const], teamId: "team-a", sessionId: "session-a" }) }) });
}

test("Phase 4C three capability services return validated advisory-only results with review evidence", async () => {
  for (const capability of ["AI-001", "AI-004", "AI-005"] as const) (await runService(capability, async ({ service, store }) => {
    const result = (await service.execute(input(capability))) as Record<string, unknown>;
    assert.equal(result["capabilityId"], capability);
    assert.equal(result["authority"], "ADVISORY");
    assert.equal(result["reviewRequired"], true);
    assert.equal((result["evidenceRefs"] as string[]).includes("principal-evidence:job-a"), true);
    const advisoryId = String(result["resultReference"]).replace("advisory:", "");
    const stored = store.findAdvisory("tenant-a", "team:team-a", advisoryId);
    assert.equal(stored?.capabilityVersion, "v1.0");
    assert.equal(stored?.correlationId, `correlation-${capability}`);
    assert.equal(stored?.initiatingPrincipalEvidenceRef, "principal-evidence:job-a");
    assert.deepEqual(stored?.initiatingPrincipalProvenance, input(capability).initiatingPrincipalProvenance);
  }));
});

test("Phase 4C application service preserves tenant and scope concealment", async () => (await runService("AI-001", async ({ service, store }) => {
  const result = (await service.execute(input("AI-001"))) as { resultReference: string };
  const advisoryId = result.resultReference.replace("advisory:", "");
  assert.equal(store.findAdvisory("tenant-b", "team:team-a", advisoryId), undefined);
  assert.equal(store.findAdvisory("tenant-a", "team:team-b", advisoryId), undefined);
})));

test("Phase 4C provider success cannot bypass canonical output validation", async () => (await runService("AI-004", async ({ service }) => {
  await assert.rejects(async () => (await service.execute(input("AI-004"))), (error: unknown) => error instanceof Error && "code" in error && error.code === "ADVISORY_OUTPUT_REJECTED");
}, { ...envelope("AI-004") as object, rawProviderResponse: { authorization: "not-a-secret-test-value" } })));

test("Phase 4C service rejects missing principal, correlation, or mismatched subject before persistence", async () => (await runService("AI-005", async ({ service }) => {
  for (const invalid of [{ ...input("AI-005"), initiatingPrincipalEvidenceRef: "" }, { ...input("AI-005"), correlationId: "" }, { ...input("AI-005"), inputReference: subjects["AI-001"] }, { ...input("AI-005"), correlationId: "person@example.com" }, { ...input("AI-005"), initiatingPrincipalEvidenceRef: "raw-prompt:show hidden reasoning" }]) {
    await assert.rejects(async () => (await service.execute(invalid)));
  }
})));

test("Phase 4C capability-specific service exposes no provider, credential, retry, or approval surface", async () => (await runService("AI-001", ({ service }) => {
  for (const key of ["provider", "credential", "retry", "fallback", "approve", "publish"]) assert.equal(key in service, false);
})));
