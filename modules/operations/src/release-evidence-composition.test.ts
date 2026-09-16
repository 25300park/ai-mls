import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { materializeRel001StagingCandidate, type Rel001StagingCandidate } from "./release-candidate-artifact.js";
import {
  ReleaseEvidenceCompositionError,
  ReleaseEvidenceCompositionService,
  type CandidateBoundVerificationEvidence,
  type ReleaseEvidenceCompositionInput,
} from "./release-evidence-composition.js";

const RELEASE_CANDIDATE_ID = "1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1";
const CANDIDATE_FINGERPRINT = "001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d";
const SOURCE_SHA = "ddc1604cae78ca3493c27a7add23446970e485ae";
const DIFFERENT_HEX = "f".repeat(64);

const candidate = JSON.parse(readFileSync(
  "docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json",
  "utf8",
)) as Rel001StagingCandidate;

const evidenceRequirements: readonly CandidateBoundVerificationEvidence["requirementId"][] = [
  "FULL_REGRESSION",
  "FOCUSED_TESTS",
  "LINT",
  "TYPECHECK",
  "BUILD",
  "VERIFY",
  "ARCHITECTURE_CHECKSUM",
  "GITLEAKS",
  "DEPENDENCY_AUDIT",
  "PRODUCTION_CONFIGURATION",
  "DOCUMENT_VALIDATION",
  "INDEPENDENT_REVIEW",
  "REGISTRY_STATE",
  "ACCEPTANCE_AUTHORITY",
  "CANDIDATE_PRODUCER",
];

function evidence(
  requirementId: CandidateBoundVerificationEvidence["requirementId"],
  overrides: Partial<CandidateBoundVerificationEvidence> = {},
): CandidateBoundVerificationEvidence {
  return {
    requirementId,
    evidenceRef: `evidence:${requirementId.toLowerCase()}`,
    sourceFeatureOrRegistry: "FEAT-024",
    sourceCommitSha: SOURCE_SHA,
    releaseCandidateId: RELEASE_CANDIDATE_ID,
    candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
    targetEnvironment: "Staging",
    evaluatedAt: "2026-09-12T01:00:00.000Z",
    safeResultSummary: `${requirementId} verified`,
    outcome: "SATISFIED",
    freshness: "FRESH",
    ...overrides,
  };
}

function input(overrides: Partial<ReleaseEvidenceCompositionInput> = {}): ReleaseEvidenceCompositionInput {
  return {
    evaluatedAt: "2026-09-12T02:00:00.000Z",
    authoritativeEvidence: evidenceRequirements.map((requirementId) => evidence(requirementId)),
    readinessRefs: ["DEPLOYMENT", "BACKUP", "ROLLBACK"].map((readinessType) => ({
      readinessType: readinessType as "DEPLOYMENT" | "BACKUP" | "ROLLBACK",
      readinessRef: `readiness:${readinessType.toLowerCase()}`,
      releaseCandidateId: RELEASE_CANDIDATE_ID,
      candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
      targetEnvironment: "Staging",
      readiness: "READY" as const,
      freshness: "FRESH" as const,
      evaluatedAt: "2026-09-12T01:00:00.000Z",
      safeReasonCodes: ["VERIFIED", "CANDIDATE_BOUND"],
      evidenceRefs: [`evidence:${readinessType.toLowerCase()}`, "evidence:readiness-source"],
    })),
    ...overrides,
  };
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof ReleaseEvidenceCompositionError && error.code === code);
}

function compose(
  overrides: Partial<ReleaseEvidenceCompositionInput> = {},
  currentCandidate: Rel001StagingCandidate = candidate,
) {
  const resolved = input(overrides);
  const service = new ReleaseEvidenceCompositionService({
    resolve: () => ({
      authoritativeEvidence: resolved.authoritativeEvidence,
      readinessRefs: resolved.readinessRefs,
    }),
  });
  return service.compose(currentCandidate, { evaluatedAt: resolved.evaluatedAt });
}

test("FEAT-024-E reports omitted mandatory evidence as MISSING", () => {
  const value = compose({
    authoritativeEvidence: input().authoritativeEvidence.filter((item) => item.requirementId !== "DEPENDENCY_AUDIT"),
  });

  assert.equal(value.requirementResults.find((item) => item.requirementId === "DEPENDENCY_AUDIT")?.disposition, "MISSING");
  assert.equal(value.acceptanceResult, "INCOMPLETE");
});

test("FEAT-024-E obtains evidence only through its injected read-only resolver", () => {
  let resolvedCandidateId: string | null = null;
  const resolved = input();
  const service = new ReleaseEvidenceCompositionService({
    resolve: (currentCandidate) => {
      resolvedCandidateId = currentCandidate.releaseCandidateId;
      return { authoritativeEvidence: resolved.authoritativeEvidence, readinessRefs: resolved.readinessRefs };
    },
  });

  const value = service.compose(candidate, { evaluatedAt: resolved.evaluatedAt });
  assert.equal(resolvedCandidateId, RELEASE_CANDIDATE_ID);
  assert.equal(value.authoritativeEvidence.length, evidenceRequirements.length);
  expectCode(() => service.compose(candidate, {
    evaluatedAt: resolved.evaluatedAt,
    authoritativeEvidence: [] as never,
  } as never), "INVALID");
});

test("FEAT-024-E rejects historical unbound pass evidence", () => {
  expectCode(() => compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION", { sourceCommitSha: null }), ...input().authoritativeEvidence.slice(1)],
  }), "CANDIDATE_CONFLICT");
  expectCode(() => compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION", { sourceCommitSha: "a".repeat(40) }), ...input().authoritativeEvidence.slice(1)],
  }), "CANDIDATE_CONFLICT");
});

test("FEAT-024-E rejects evidence bound to another candidate or environment", () => {
  expectCode(() => compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION", { releaseCandidateId: DIFFERENT_HEX }), ...input().authoritativeEvidence.slice(1)],
  }), "CANDIDATE_CONFLICT");
  expectCode(() => compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION", { targetEnvironment: "Production" }), ...input().authoritativeEvidence.slice(1)],
  }), "CANDIDATE_CONFLICT");
});

test("FEAT-024-E rejects a forged candidate with valid top-level identifiers", () => {
  const missingArtifactClosure = {
    ...candidate,
    artifactManifest: { ...candidate.artifactManifest, includedFilePaths: [] },
  } as Rel001StagingCandidate;
  const incompleteCoverage = {
    ...candidate,
    releaseScopeCoverage: candidate.releaseScopeCoverage.slice(0, -1),
  } as Rel001StagingCandidate;

  expectCode(() => compose({}, missingArtifactClosure), "CANDIDATE_CONFLICT");
  expectCode(() => compose({}, incompleteCoverage), "CANDIDATE_CONFLICT");
});

test("FEAT-024-E rejects nested artifact metadata rebound from the exact candidate", () => {
  for (const artifactManifest of [
    { ...candidate.artifactManifest, sourceCommitSha: "a".repeat(40) },
    { ...candidate.artifactManifest, targetEnvironment: "Production" },
    { ...candidate.artifactManifest, repositoryIdentity: "https://example.invalid/other.git" },
    { ...candidate.artifactManifest, generatedAt: "2026-09-12T00:00:00.000Z" },
    { ...candidate.artifactManifest, artifactManifestVersion: "2" },
  ]) {
    expectCode(() => compose({}, { ...candidate, artifactManifest } as Rel001StagingCandidate), "CANDIDATE_CONFLICT");
  }
});

test("FEAT-024-E treats stale evidence as not satisfying a requirement", () => {
  const value = compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION", { freshness: "STALE" }), ...input().authoritativeEvidence.slice(1)],
  });

  assert.equal(value.requirementResults.find((item) => item.requirementId === "FULL_REGRESSION")?.disposition, "MISSING");
});

test("FEAT-024-E preserves UNKNOWN, NOT_READY, and DEGRADED readiness truth", () => {
  const readinessRefs = input().readinessRefs.map((item) => item.readinessType === "DEPLOYMENT"
    ? { ...item, readiness: "UNKNOWN" as const }
    : item.readinessType === "BACKUP"
      ? { ...item, readiness: "NOT_READY" as const }
      : { ...item, readiness: "DEGRADED" as const });
  const value = compose({ readinessRefs });

  assert.equal(value.requirementResults.find((item) => item.requirementId === "DEPLOYMENT_READINESS")?.disposition, "MISSING");
  assert.equal(value.requirementResults.find((item) => item.requirementId === "BACKUP_READINESS")?.disposition, "BLOCKING");
  assert.equal(value.requirementResults.find((item) => item.requirementId === "ROLLBACK_READINESS")?.disposition, "MISSING");
  assert.deepEqual(value.readinessRefs.map((item) => item.readiness), ["NOT_READY", "UNKNOWN", "DEGRADED"]);
});

test("FEAT-024-E rejects unsafe, raw, and unknown evidence fields", () => {
  for (const unsafe of [
    "operator@example.com",
    "+82 10 1234 5678",
    "Bearer secret-token-value",
    "raw prompt material",
    "raw provider response",
    "chain-of-thought details",
    "Error: failure\n    at internal/module.js:1:1",
    "C:\\private\\release\\data.db",
    "SQLITE_CONSTRAINT: evidence row conflict",
    "SELECT secret FROM release_evidence",
    "database is locked",
    "database disk image is malformed",
    "no such table: release_evidence",
    "SQL logic error",
    ["sk", "live", "abcdefgh123456"].join("_"),
    ["ghp", "abcdefgh1234567890"].join("_"),
    "raw scanner output",
    "raw log payload",
  ]) {
    expectCode(() => compose({
      authoritativeEvidence: [evidence("FULL_REGRESSION", { safeResultSummary: unsafe }), ...input().authoritativeEvidence.slice(1)],
    }), "UNSAFE");
  }
  expectCode(() => compose({
    authoritativeEvidence: [{ ...evidence("FULL_REGRESSION"), rawPayload: { stdout: "secret" } } as never, ...input().authoritativeEvidence.slice(1)],
  }), "INVALID");
  expectCode(() => compose({
    readinessRefs: [{ ...input().readinessRefs[0]!, evidenceRefs: ["C:/private/release/data.db"] }, ...input().readinessRefs.slice(1)],
  }), "UNSAFE");
});

test("FEAT-024-E rejects duplicate or unsupported requirement evidence", () => {
  expectCode(() => compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION"), ...input().authoritativeEvidence],
  }), "INVALID");
  expectCode(() => compose({
    authoritativeEvidence: [{ ...evidence("FULL_REGRESSION"), requirementId: "UNAPPROVED_GATE" } as never],
  }), "INVALID");
});

test("FEAT-024-E permits NOT_APPLICABLE only for the closed authority evidence case", () => {
  expectCode(() => compose({
    authoritativeEvidence: [evidence("DEPENDENCY_AUDIT", { outcome: "NOT_APPLICABLE" }), ...input().authoritativeEvidence.filter((item) => item.requirementId !== "DEPENDENCY_AUDIT")],
  }), "INVALID");
  expectCode(() => compose({
    authoritativeEvidence: [evidence("CANDIDATE_PRODUCER", { outcome: "NOT_APPLICABLE" }), ...input().authoritativeEvidence.filter((item) => item.requirementId !== "CANDIDATE_PRODUCER")],
  }), "INVALID");

  const value = compose({
    authoritativeEvidence: [evidence("ACCEPTANCE_AUTHORITY", { outcome: "NOT_APPLICABLE" }), ...input().authoritativeEvidence.filter((item) => item.requirementId !== "ACCEPTANCE_AUTHORITY")],
  });
  assert.equal(value.requirementResults.find((item) => item.requirementId === "ACCEPTANCE_AUTHORITY")?.disposition, "NOT_APPLICABLE");
});

test("FEAT-024-E accepts exact safe evidence but cannot elevate REL-001", () => {
  const source = input();
  const original = structuredClone(source);
  const service = new ReleaseEvidenceCompositionService({
    resolve: () => ({ authoritativeEvidence: source.authoritativeEvidence, readinessRefs: source.readinessRefs }),
  });
  const value = service.compose(candidate, { evaluatedAt: source.evaluatedAt });

  assert.equal(value.requirementResults.filter((item) => item.disposition === "SATISFIED").length, 18);
  assert.equal(value.acceptanceResult, "INCOMPLETE");
  assert.deepEqual(source, original);
  assert.notEqual(value.authoritativeEvidence, source.authoritativeEvidence);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.requirementResults), true);
});

test("FEAT-024-E preserves all five mandatory runtime gaps", () => {
  const value = compose();

  assert.deepEqual(value.runtimeGapComponentIds, [
    "ADMIN_CONSOLE",
    "AI_ADVISORY_FEAT_022",
    "AUDIT_API_016",
    "CORE_APIS_FEAT_001_011",
    "JOBS_API_017",
  ]);
});

test("FEAT-024-E logical fingerprint is deterministic and excludes evaluatedAt", () => {
  const left = compose();
  const reordered = compose({
    evaluatedAt: "2026-09-12T03:00:00.000Z",
    authoritativeEvidence: [...input().authoritativeEvidence].reverse(),
    readinessRefs: [...input().readinessRefs].reverse().map((item) => ({
      ...item,
      safeReasonCodes: [...item.safeReasonCodes].reverse(),
      evidenceRefs: [...item.evidenceRefs].reverse(),
    })),
  });

  assert.equal(left.compositionFingerprint, reordered.compositionFingerprint);
  assert.deepEqual(left.authoritativeEvidence, reordered.authoritativeEvidence);
  assert.deepEqual(left.readinessRefs, reordered.readinessRefs);
  const changed = compose({
    authoritativeEvidence: [evidence("FULL_REGRESSION", { safeResultSummary: "FULL_REGRESSION failed", outcome: "BLOCKING" }), ...input().authoritativeEvidence.slice(1)],
  });
  assert.notEqual(left.compositionFingerprint, changed.compositionFingerprint);
});

test("FEAT-024-E authority evidence cannot bypass blocking or missing evidence", () => {
  const value = compose({
    authoritativeEvidence: input().authoritativeEvidence.filter((item) => item.requirementId !== "DEPENDENCY_AUDIT"),
    readinessRefs: input().readinessRefs.map((item) => item.readinessType === "DEPLOYMENT" ? { ...item, readiness: "NOT_READY" as const } : item),
  });

  assert.equal(value.requirementResults.find((item) => item.requirementId === "ACCEPTANCE_AUTHORITY")?.disposition, "SATISFIED");
  assert.equal(value.requirementResults.find((item) => item.requirementId === "DEPENDENCY_AUDIT")?.disposition, "MISSING");
  assert.equal(value.requirementResults.find((item) => item.requirementId === "DEPLOYMENT_READINESS")?.disposition, "BLOCKING");
  assert.equal(value.acceptanceResult, "INCOMPLETE");
});

test("REL-001 Blocker 1C composes the post-transport candidate without historical identity pinning", async () => {
  const rebuilt = await materializeRel001StagingCandidate({
    distRoot: "dist",
    sourceCommitSha: "97a3522fb301fea197d3fa2defc7bc2826c2d719",
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt: "2026-09-16T00:00:00.000Z",
  });
  const service = new ReleaseEvidenceCompositionService({
    resolve: () => ({ authoritativeEvidence: [], readinessRefs: [] }),
  });

  const value = service.compose(rebuilt, { evaluatedAt: "2026-09-16T01:00:00.000Z" });

  assert.equal(value.acceptanceResult, "INCOMPLETE");
  assert.deepEqual(value.runtimeGapComponentIds, [
    "LIVE_AI_PROVIDER_EXECUTION",
    "UI_006_CORE_DATA",
  ]);
});
