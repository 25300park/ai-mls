import assert from "node:assert/strict";
import test from "node:test";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import {
  ReleaseAcceptanceManifestError,
  classifyReleaseAcceptanceManifestReplay,
  createReleaseAcceptanceManifest,
  validateReleaseAcceptanceManifest,
  type ReleaseAcceptanceManifestInput,
} from "./release-evidence-manifest.js";

const RELEASE_CANDIDATE_ID = "1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1";
const ARTIFACT_FINGERPRINT = "a5de42d389b2aec27b4dd2a6362f442afced8414a7050c170f980fa4727547cd";
const CANDIDATE_FINGERPRINT = "001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d";
const DIFFERENT_HEX = "f".repeat(64);
const SOURCE_SHA = "ddc1604cae78ca3493c27a7add23446970e485ae";

const candidate: Rel001StagingCandidate = {
  releaseCandidateId: RELEASE_CANDIDATE_ID,
  logicalReleaseId: "REL-001",
  sourceCommitSha: SOURCE_SHA,
  repositoryIdentity: "https://github.com/25300park/ai-mls.git",
  sourceBranch: "codex/feat-024-a-release-candidate",
  artifactFingerprint: ARTIFACT_FINGERPRINT,
  targetEnvironment: "Staging",
  generatedAt: "2026-09-11T00:00:00.000Z",
  candidateFingerprint: CANDIDATE_FINGERPRINT,
  acceptanceResult: "INCOMPLETE",
  releaseScopeCoverage: [{
    artifactComponentId: "ADMIN_CONSOLE",
    requiredByReleaseScope: true,
    executableRuntimeAvailable: false,
    artifactIncluded: false,
    implementationRuntimeEvidenceRef: "apps/admin-console/src/main.ts#composeDevelopmentAdminConsole",
    gapDisposition: "INCOMPLETE_RUNTIME_SURFACE",
  }],
  artifactManifest: {
    artifactManifestVersion: "1",
    logicalReleaseId: "REL-001",
    targetEnvironment: "Staging",
    sourceCommitSha: SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    runtimeComponents: [],
    includedFilePaths: [],
    excludedClassPolicy: [],
    artifactFingerprint: ARTIFACT_FINGERPRINT,
    generatedAt: "2026-09-11T00:00:00.000Z",
  },
};

function input(overrides: Partial<ReleaseAcceptanceManifestInput> = {}): ReleaseAcceptanceManifestInput {
  return {
    evidenceRefs: [{
      evidenceType: "TEST_RESULT",
      evidenceRef: "evidence:feat024-b-tests",
      sourceFeatureOrRegistry: "FEAT-024",
      sourceCommitSha: SOURCE_SHA,
      candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
      evaluatedAt: "2026-09-11T01:00:00.000Z",
      safeResultSummary: "Focused validation passed",
    }],
    readinessRefs: [{
      readinessType: "DEPLOYMENT",
      readinessRef: "readiness-projection:rel001-staging",
      releaseCandidateId: RELEASE_CANDIDATE_ID,
      candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
      targetEnvironment: "Staging",
      readiness: "UNKNOWN",
      freshness: "UNKNOWN",
      evaluatedAt: "2026-09-11T01:00:00.000Z",
      safeReasonCodes: ["MISSING_RUNTIME_SURFACES"],
      evidenceRefs: ["evidence:feat024-a-candidate"],
    }],
    acceptanceResult: "INCOMPLETE",
    acceptedBy: null,
    evaluatedAt: "2026-09-11T02:00:00.000Z",
    acceptedAt: null,
    decisionEvidenceRef: "evidence:rel001-incomplete-evaluation",
    previousManifestId: null,
    ...overrides,
  };
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof ReleaseAcceptanceManifestError && error.code === code);
}

test("FEAT-024-B binds every evidence and readiness reference to the exact candidate", () => {
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    evidenceRefs: [{ ...input().evidenceRefs[0]!, candidateBindingFingerprint: DIFFERENT_HEX }],
  })), "CANDIDATE_CONFLICT");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    readinessRefs: [{ ...input().readinessRefs[0]!, releaseCandidateId: DIFFERENT_HEX }],
  })), "CANDIDATE_CONFLICT");
});

test("FEAT-024-B preserves UNKNOWN readiness and the current REL-001 INCOMPLETE result", () => {
  const manifest = createReleaseAcceptanceManifest(candidate, input());

  assert.equal(manifest.acceptanceResult, "INCOMPLETE");
  assert.equal(manifest.readinessRefs[0]?.readiness, "UNKNOWN");
  assert.equal(manifest.acceptedBy, null);
  assert.equal(manifest.acceptedAt, null);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.evidenceRefs), true);
});

test("FEAT-024-B enforces approved acceptance provenance nullability", () => {
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ acceptedBy: "actor:release-owner" })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ acceptedAt: "2026-09-11T02:01:00.000Z" })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ acceptanceResult: "REJECTED", acceptedBy: "actor:release-owner", acceptedAt: "2026-09-11T02:01:00.000Z" })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ decisionEvidenceRef: "" })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ acceptanceResult: "ACCEPTED", acceptedBy: null, acceptedAt: null })), "INVALID");
});

test("FEAT-024-B does not allow incomplete candidate evidence to be elevated to ACCEPTED", () => {
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    acceptanceResult: "ACCEPTED",
    acceptedBy: "actor:release-owner",
    acceptedAt: "2026-09-11T02:01:00.000Z",
  })), "INVALID");
});

test("FEAT-024-B rejects a forged or internally inconsistent FEAT-024-A candidate", () => {
  expectCode(() => createReleaseAcceptanceManifest({ ...candidate, sourceBranch: "main" }, input()), "CANDIDATE_CONFLICT");

  const forgedCompleteCandidate = {
    ...candidate,
    acceptanceResult: "ACCEPTED",
    releaseScopeCoverage: candidate.releaseScopeCoverage.map((row) => ({
      ...row,
      executableRuntimeAvailable: true,
      artifactIncluded: true,
      gapDisposition: "INCLUDED",
    })),
  } as unknown as Rel001StagingCandidate;
  expectCode(() => createReleaseAcceptanceManifest(forgedCompleteCandidate, input({
    acceptanceResult: "ACCEPTED",
    acceptedBy: "actor:release-owner",
    acceptedAt: "2026-09-11T02:01:00.000Z",
    readinessRefs: input().readinessRefs.map((ref) => ({ ...ref, readiness: "READY", freshness: "FRESH" })),
  })), "CANDIDATE_CONFLICT");
});

test("FEAT-024-B rejects unknown fields, raw evidence, secret-like values, and unsafe paths", () => {
  const valid = createReleaseAcceptanceManifest(candidate, input());
  expectCode(() => validateReleaseAcceptanceManifest(candidate, { ...valid, rawScannerPayload: { findings: [] } }), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    evidenceRefs: [{ ...input().evidenceRefs[0]!, rawPayload: "not allowed" } as never],
  })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    evidenceRefs: [{ ...input().evidenceRefs[0]!, safeResultSummary: "Authorization: Bearer not-a-real-secret" }],
  })), "UNSAFE");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    evidenceRefs: [{ ...input().evidenceRefs[0]!, evidenceRef: "C:\\internal\\scanner\\raw.json" }],
  })), "UNSAFE");
});

test("FEAT-024-B rejects missing bindings, invalid enums, malformed references, and malformed timestamps", () => {
  const evidenceWithoutBinding = { ...input().evidenceRefs[0] } as Record<string, unknown>;
  delete evidenceWithoutBinding["candidateBindingFingerprint"];
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ evidenceRefs: [evidenceWithoutBinding as never] })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ acceptanceResult: "READY" as never })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({
    readinessRefs: [{ ...input().readinessRefs[0]!, readiness: "HEALTHY" as never }],
  })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ decisionEvidenceRef: "not a bounded ref?" })), "UNSAFE");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ evaluatedAt: "yesterday" })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ evaluatedAt: "2026-02-30T00:00:00.000Z" })), "INVALID");
});

test("FEAT-024-B canonical ordering makes caller order irrelevant", () => {
  const evidence = input().evidenceRefs[0]!;
  const secondEvidence = { ...evidence, evidenceType: "ARCHITECTURE", evidenceRef: "evidence:architecture-checksum", safeResultSummary: "Architecture verification passed" };
  const first = createReleaseAcceptanceManifest(candidate, input({ evidenceRefs: [evidence, secondEvidence] }));
  const second = createReleaseAcceptanceManifest(candidate, input({ evidenceRefs: [secondEvidence, evidence] }));

  assert.equal(first.manifestFingerprint, second.manifestFingerprint);
  assert.equal(first.acceptanceManifestId, second.acceptanceManifestId);
  assert.deepEqual(first.evidenceRefs, second.evidenceRefs);
});

test("FEAT-024-B canonical readiness ordering makes caller order irrelevant", () => {
  const deployment = input().readinessRefs[0]!;
  const backup = { ...deployment, readinessType: "BACKUP" as const, readinessRef: "readiness-projection:rel001-backup" };
  const first = createReleaseAcceptanceManifest(candidate, input({ readinessRefs: [deployment, backup] }));
  const second = createReleaseAcceptanceManifest(candidate, input({ readinessRefs: [backup, deployment] }));

  assert.equal(first.manifestFingerprint, second.manifestFingerprint);
  assert.deepEqual(first.readinessRefs, second.readinessRefs);
});

test("FEAT-024-B excludes evaluatedAt from logical replay identity", () => {
  const first = createReleaseAcceptanceManifest(candidate, input());
  const later = createReleaseAcceptanceManifest(candidate, input({ evaluatedAt: "2026-09-12T02:00:00.000Z" }));

  assert.equal(first.manifestFingerprint, later.manifestFingerprint);
  assert.equal(first.acceptanceManifestId, later.acceptanceManifestId);
  assert.equal(classifyReleaseAcceptanceManifestReplay(first, later), "REPLAY");
});

test("FEAT-024-B replay identity excludes acceptedAt but includes acceptedBy", () => {
  const incomplete = createReleaseAcceptanceManifest(candidate, input());
  const accepted = {
    ...incomplete,
    acceptanceResult: "ACCEPTED" as const,
    acceptedBy: "actor:release-owner",
    acceptedAt: "2026-09-11T03:00:00.000Z",
    acceptanceManifestId: DIFFERENT_HEX,
    manifestFingerprint: "e".repeat(64),
  };
  assert.equal(classifyReleaseAcceptanceManifestReplay(accepted, {
    ...accepted,
    acceptedAt: "2026-09-12T03:00:00.000Z",
  }), "REPLAY");
  assert.equal(classifyReleaseAcceptanceManifestReplay(accepted, {
    ...accepted,
    acceptedBy: "actor:another-release-owner",
  }), "CONFLICT");
});

test("FEAT-024-B classifies exact replay, changed evidence, and identity conflicts deterministically", () => {
  const existing = createReleaseAcceptanceManifest(candidate, input());
  const replay = createReleaseAcceptanceManifest(candidate, input());
  const changed = createReleaseAcceptanceManifest(candidate, input({
    evidenceRefs: [{ ...input().evidenceRefs[0]!, safeResultSummary: "Focused and affected validation passed" }],
    previousManifestId: existing.acceptanceManifestId,
  }));

  assert.equal(classifyReleaseAcceptanceManifestReplay(existing, replay), "REPLAY");
  assert.equal(classifyReleaseAcceptanceManifestReplay(existing, changed), "NEW");
  assert.equal(classifyReleaseAcceptanceManifestReplay(existing, { ...changed, acceptanceManifestId: existing.acceptanceManifestId }), "CONFLICT");
  assert.equal(classifyReleaseAcceptanceManifestReplay(existing, {
    ...existing,
    evidenceRefs: [{ ...existing.evidenceRefs[0]!, safeResultSummary: "Tampered result" }],
  }), "CONFLICT");
  assert.equal(classifyReleaseAcceptanceManifestReplay(existing, {
    ...changed,
    evidenceRefs: [{ ...changed.evidenceRefs[0]!, candidateBindingFingerprint: DIFFERENT_HEX }],
  }), "CONFLICT");
  const mixedExisting = {
    ...existing,
    evidenceRefs: [existing.evidenceRefs[0]!, { ...existing.evidenceRefs[0]!, evidenceRef: "evidence:mixed-binding", candidateBindingFingerprint: DIFFERENT_HEX }],
  };
  const mixedProposed = {
    ...changed,
    readinessRefs: [changed.readinessRefs[0]!, { ...changed.readinessRefs[0]!, readinessRef: "readiness-projection:mixed-binding", candidateBindingFingerprint: DIFFERENT_HEX }],
  };
  assert.equal(classifyReleaseAcceptanceManifestReplay(mixedExisting, mixedProposed), "CONFLICT");
});

test("FEAT-024-B rejects duplicate evidence and readiness identities", () => {
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ evidenceRefs: [input().evidenceRefs[0]!, input().evidenceRefs[0]!] })), "INVALID");
  expectCode(() => createReleaseAcceptanceManifest(candidate, input({ readinessRefs: [input().readinessRefs[0]!, input().readinessRefs[0]!] })), "INVALID");
});

test("FEAT-024-B rejects a manifest rebound to different candidate content", () => {
  const valid = createReleaseAcceptanceManifest(candidate, input());
  expectCode(() => validateReleaseAcceptanceManifest(candidate, { ...valid, artifactFingerprint: DIFFERENT_HEX }), "CANDIDATE_CONFLICT");
});
