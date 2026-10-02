import assert from "node:assert/strict";
import test from "node:test";
import {
  AdvisoryJobFailureMapper,
  Ai001ListingParseJobHandler,
  Ai004RequirementParseJobHandler,
  Ai005MatchingJobHandler,
} from "./advisory-job-handlers.js";
import type { JobExecutionContext } from "./job-execution-runtime.js";

function context(jobType: JobExecutionContext["jobType"]): JobExecutionContext {
  return Object.freeze({
    jobId: `job-${jobType}`,
    attempt: 1,
    jobType,
    tenantId: "tenant-a",
    scopeRef: "team:team-a",
    purpose: "ADVISORY_GENERATION",
    inputReferences: [Object.freeze({ type: "CanonicalInput", id: `input-${jobType}`, version: 2, checksum: "sha256:input" })],
    policyVersion: "policy-v1",
    admissionEvidenceRefs: ["authority:live-check"],
    originatingAuthorityEvidenceRefs: ["principal-evidence:submission"],
    initiatingPrincipalProvenance: Object.freeze({ kind: "TRUSTED_SNAPSHOT", principal: Object.freeze({ id: "user-a", type: "HUMAN", roles: ["OPS"] as const, teamId: "team-a", sessionId: "session-a" }) }),
    correlationId: `correlation-${jobType}`,
  });
}

test("Phase 4C handlers map exactly three canonical Job types to capability-specific application ports", async () => {
  const calls: unknown[] = [];
  const port = (capabilityId: "AI-001" | "AI-004" | "AI-005") => ({ execute: (input: unknown) => { calls.push(input); return Promise.resolve(Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: ["advisory:result-a:review-required"], capabilityId, authority: "ADVISORY" as const, reviewRequired: true as const })); } });
  const cases = [
    [new Ai001ListingParseJobHandler(port("AI-001")), "AI_LISTING_PARSE", "AI-001"],
    [new Ai004RequirementParseJobHandler(port("AI-004")), "AI_REQUIREMENT_PARSE", "AI-004"],
    [new Ai005MatchingJobHandler(port("AI-005")), "AI_MATCHING", "AI-005"],
  ] as const;
  for (const [handler, jobType, handlerId] of cases) {
    const result = await handler.execute(context(jobType));
    assert.equal(handler.handlerId, handlerId);
    assert.deepEqual(Object.keys(result).sort(), ["evidenceRefs", "resultChecksum", "resultReference"]);
  }
  assert.equal(calls.length, 3);
  const mapped = calls as Readonly<Record<string, unknown>>[];
  assert.equal(mapped.every((call) => call["initiatingPrincipalEvidenceRef"] === "principal-evidence:submission"), true);
  assert.equal(mapped.every((call) => JSON.stringify(call["initiatingPrincipalProvenance"]) === JSON.stringify(context("AI_LISTING_PARSE").initiatingPrincipalProvenance)), true);
  assert.equal(mapped.every((call) => String(call["idempotencyKey"]).includes(":attempt:1:")), true);
});

test("Phase 4C handler rejects type mismatch, multiple inputs, and missing principal evidence before advisory execution", async () => {
  let calls = 0;
  const handler = new Ai001ListingParseJobHandler({ execute: () => { calls += 1; throw new Error("must not run"); } });
  await assert.rejects(async () => await handler.execute(context("AI_MATCHING")));
  await assert.rejects(async () => await handler.execute({ ...context("AI_LISTING_PARSE"), inputReferences: [...context("AI_LISTING_PARSE").inputReferences, ...context("AI_LISTING_PARSE").inputReferences] }));
  await assert.rejects(async () => await handler.execute({ ...context("AI_LISTING_PARSE"), originatingAuthorityEvidenceRefs: [] }));
  assert.equal(calls, 0);
});

test("Phase 4C application failures normalize without raw provider diagnostics", () => {
  const mapper = new AdvisoryJobFailureMapper();
  const dependency = mapper.map(Object.assign(new Error("unsafe provider diagnostic"), { code: "ADVISORY_UNAVAILABLE" }), context("AI_LISTING_PARSE"));
  const invalid = mapper.map(Object.assign(new Error("unsafe response"), { code: "ADVISORY_OUTPUT_REJECTED" }), context("AI_LISTING_PARSE"));
  assert.deepEqual(dependency, { code: "DEPENDENCY_UNAVAILABLE", evidenceRef: "job-failure:advisory-unavailable" });
  assert.deepEqual(invalid, { code: "JOB_RESULT_INVALID", evidenceRef: "job-failure:advisory-result-invalid" });
  assert.doesNotMatch(JSON.stringify([dependency, invalid]), /unsafe|provider diagnostic|response/iu);
});

test("Phase 4C thin handlers expose no provider, credential, retry, fallback, or domain mutation surface", () => {
  const handler = new Ai004RequirementParseJobHandler({ execute: () => Promise.resolve({ resultReference: "advisory:a", resultChecksum: "sha256:a", evidenceRefs: ["advisory:a:review-required"], capabilityId: "AI-004", authority: "ADVISORY", reviewRequired: true }) });
  for (const key of ["provider", "credential", "retry", "fallback", "approve", "publish", "repository"]) assert.equal(key in handler, false);
});
