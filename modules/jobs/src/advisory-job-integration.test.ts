import { adaptSynchronousAdvisoryPersistence } from "../../ai/src/advisory-async-persistence.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { Ai001ListingParseApplicationService, Ai004RequirementParseApplicationService, Ai005MatchingApplicationService } from "../../ai/src/advisory-application-services.js";
import { DurableAdvisoryStore } from "../../ai/src/advisory-durable-persistence.js";
import { ConfiguredAdvisoryProviderAdapter, type AdvisoryCapabilityConfiguration, type ExecutableAdvisoryCapabilityId } from "../../ai/src/advisory-provider-boundary.js";
import { AdvisoryRuntime } from "../../ai/src/advisory-runtime.js";
import type { AdvisoryPromptRecord, TrustedAdvisorySnapshot } from "../../ai/src/advisory-runtime-contracts.js";
import { Ai001ListingParseJobHandler, Ai004RequirementParseJobHandler, Ai005MatchingJobHandler } from "./advisory-job-handlers.js";
import type { BoundedJobHandler, JobExecutionContext } from "./job-execution-runtime.js";

const confidence = Object.freeze({ band: "MEDIUM" as const, reasonCodes: ["REVIEW_REQUIRED"], policyVersion: "ai-policy-v1" });
const specs = Object.freeze({
  "AI-001": Object.freeze({ jobType: "AI_LISTING_PARSE" as const, schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1" as const, subject: Object.freeze({ entityType: "RawSource", entityId: "raw-a", version: "1" }) }),
  "AI-004": Object.freeze({ jobType: "AI_REQUIREMENT_PARSE" as const, schemaId: "urn:ai-mls:schema:requirement-parser-output:v0.1" as const, subject: Object.freeze({ entityType: "ClientInput", entityId: "client-a", version: "1" }) }),
  "AI-005": Object.freeze({ jobType: "AI_MATCHING" as const, schemaId: "urn:ai-mls:schema:matching-result:v0.1" as const, subject: Object.freeze({ entityType: "MatchCohort", entityId: "cohort-a", version: "1" }) }),
});

test("Phase 4C provider-independent handler to canonical validator path is executable for AI-001, AI-004, and AI-005", async () => {
  for (const capabilityId of Object.keys(specs) as ExecutableAdvisoryCapabilityId[]) await verifyPath(capabilityId);
});

async function verifyPath(capabilityId: ExecutableAdvisoryCapabilityId): Promise<void> {
  const spec = specs[capabilityId];
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase4c-path-"));
  const store = new DurableAdvisoryStore({ databasePath: join(directory, "advisory.sqlite") });
  let providerCalls = 0;
  try {
    const prompt = Object.freeze<AdvisoryPromptRecord>({ promptId: `PRM-${capabilityId}-001`, promptVersion: "v1.0", capabilityId, schemaId: spec.schemaId, contentFingerprint: `sha256:prompt-${capabilityId}`, status: "ACTIVE", createdAt: "2026-09-15T03:00:00.000Z" });
    store.registerPrompt(prompt);
    const snapshot = Object.freeze<TrustedAdvisorySnapshot>({ tenantId: "tenant-a", scopeRef: "team:team-a", subjectRef: spec.subject, provenance: provenance(capabilityId, spec.subject), inputClassifications: ["CONFIDENTIAL_BUSINESS"], inputFingerprint: `sha256:input-${capabilityId}`, evidenceFingerprint: `sha256:evidence-${capabilityId}` });
    const configuration: AdvisoryCapabilityConfiguration = Object.freeze({ environment: "Staging", capabilityId, capabilityVersion: "v1.0", providerRef: `provider:test-${capabilityId}`, modelRef: `model:test-${capabilityId}`, timeoutMs: 1000, credentialRef: `vault-ref:${capabilityId}`, promptId: prompt.promptId, promptVersion: prompt.promptVersion });
    const adapter = new ConfiguredAdvisoryProviderAdapter({ configuration, networkAuthorized: false, credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" }, executor: { testOnly: true, execute: () => { providerCalls += 1; return envelope(capabilityId, spec.subject); } }, telemetrySink: { append: () => undefined }, clock: () => new Date("2026-09-15T03:01:00.000Z") });
    const runtime = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => snapshot }, adapter, clock: () => new Date("2026-09-15T03:02:00.000Z") });
    const binding = Object.freeze({ capabilityVersion: "v1.0", promptId: prompt.promptId, promptVersion: prompt.promptVersion });
    const handler: BoundedJobHandler = capabilityId === "AI-001"
      ? new Ai001ListingParseJobHandler(new Ai001ListingParseApplicationService({ runtime, binding }))
      : capabilityId === "AI-004"
        ? new Ai004RequirementParseJobHandler(new Ai004RequirementParseApplicationService({ runtime, binding }))
        : new Ai005MatchingJobHandler(new Ai005MatchingApplicationService({ runtime, binding }));
    const context = jobContext(spec.jobType, spec.subject.entityType, spec.subject.entityId);
    const first = (await handler.execute(context));
    const replay = (await handler.execute(context));
    assert.equal(first.resultReference, replay.resultReference);
    assert.equal(first.evidenceRefs.some((reference) => reference.includes("review-required")), true);
    assert.equal(providerCalls, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function jobContext(jobType: JobExecutionContext["jobType"], type: string, id: string): JobExecutionContext {
  return Object.freeze({ jobId: `job-${jobType}`, attempt: 1, jobType, tenantId: "tenant-a", scopeRef: "team:team-a", purpose: "ADVISORY_GENERATION", inputReferences: [Object.freeze({ type, id, version: 1, checksum: "sha256:input" })], policyVersion: "policy-v1", admissionEvidenceRefs: ["authority:execution"], originatingAuthorityEvidenceRefs: ["principal-evidence:submission"], initiatingPrincipalProvenance: Object.freeze({ kind: "TRUSTED_SNAPSHOT", principal: Object.freeze({ id: "user-a", type: "HUMAN", roles: ["OPS"] as const, teamId: "team-a", sessionId: "session-a" }) }), correlationId: `correlation-${jobType}` });
}

function provenance(capabilityId: ExecutableAdvisoryCapabilityId, subject: Readonly<{ entityType: string; entityId: string; version: string }>): readonly Readonly<{ entityType: string; entityId: string; version: string }>[] {
  return capabilityId === "AI-005" ? [subject, { entityType: "Requirement", entityId: "requirement-a", version: "1" }, { entityType: "Listing", entityId: "listing-a", version: "1" }] : [subject];
}

function envelope(capabilityId: ExecutableAdvisoryCapabilityId, subject: Readonly<{ entityType: string; entityId: string; version: string }>): unknown {
  const output = capabilityId === "AI-001"
    ? { capabilityId, inputRef: subject, fields: [], warnings: [], overallConfidence: confidence }
    : capabilityId === "AI-004"
      ? { capabilityId, inputRef: subject, intent: "UNKNOWN", budget: { valueState: "MISSING", confidence }, locations: [], propertyTypes: [], preferences: [], clarificationNeeds: [], overallConfidence: confidence }
      : { capabilityId, requirementRef: { entityType: "Requirement", entityId: "requirement-a", version: "1" }, candidateRef: { entityType: "Listing", entityId: "listing-a", version: "1" }, cohortRef: "cohort-a", factors: [], hardConstraintOutcome: "UNKNOWN", score: 0, rank: 1, explanation: "Insufficient evidence", confidence };
  return Object.freeze({ schemaVersion: "1.0", schemaId: specs[capabilityId].schemaId, capabilityId, subjectRef: subject, provenance: provenance(capabilityId, subject), classification: "CONFIDENTIAL_BUSINESS", output });
}
