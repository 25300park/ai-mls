import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import type { ReleaseAcceptanceManifest } from "./release-evidence-manifest.js";
import type { ReleaseEvidenceComposition } from "./release-evidence-composition.js";
import { ReleaseTraceReadProjectionService } from "./release-trace-read-projection.js";

const releaseCandidateId = "1".repeat(64);
const artifactFingerprint = "2".repeat(64);
const candidateFingerprint = "3".repeat(64);
const acceptanceManifestId = "4".repeat(64);
const sourceCommitSha = "d".repeat(40);
const now = "2026-09-12T00:00:00.000Z";

const candidate = Object.freeze({
  releaseCandidateId, logicalReleaseId: "REL-001", sourceCommitSha, repositoryIdentity: "repository:ai-mls",
  sourceBranch: "codex/feat-024-a-release-candidate", artifactFingerprint, candidateFingerprint,
  targetEnvironment: "Staging", generatedAt: now, acceptanceResult: "INCOMPLETE", artifactManifest: {}, releaseScopeCoverage: [],
}) as unknown as Rel001StagingCandidate;
const manifest = Object.freeze({
  acceptanceManifestId, manifestFingerprint: "5".repeat(64), releaseCandidateId, logicalReleaseId: "REL-001",
  sourceCommitSha, repositoryIdentity: "repository:ai-mls", sourceBranch: "codex/feat-024-a-release-candidate",
  artifactFingerprint, targetEnvironment: "Staging", acceptanceResult: "INCOMPLETE", acceptedBy: null, acceptedAt: null,
  evaluatedAt: now, decisionEvidenceRef: "evidence:release:decision:001", previousManifestId: null,
  evidenceRefs: Object.freeze([{ evidenceType: "FULL_REGRESSION", evidenceRef: "evidence:release:verification:001" }]),
  readinessRefs: Object.freeze([{ readinessRef: "readiness:deployment:001" }]),
}) as unknown as ReleaseAcceptanceManifest;
const composition = Object.freeze({
  releaseCandidateId, logicalReleaseId: "REL-001", sourceCommitSha, artifactFingerprint,
  candidateBindingFingerprint: candidateFingerprint, targetEnvironment: "Staging", evaluatedAt: now,
  acceptanceResult: "INCOMPLETE", authoritativeEvidence: Object.freeze([{ evidenceRef: "evidence:release:verification:001" }]),
  readinessRefs: Object.freeze([{ readinessRef: "readiness:deployment:001" }]), requirementResults: Object.freeze([]),
  runtimeGapComponentIds: Object.freeze(["ADMIN_CONSOLE", "AI_ADVISORY_FEAT_022", "AUDIT_API_016", "CORE_APIS_FEAT_001_011", "JOBS_API_017"]),
  compositionFingerprint: "6".repeat(64),
}) as unknown as ReleaseEvidenceComposition;
const session = Object.freeze({
  id: "console-session", principalId: "console-operator", tenantId: "team-a", teamId: "team-a", teamIds: Object.freeze(["team-a"]),
  state: "ACTIVE", expiresAt: "2099-01-01T00:00:00.000Z", absoluteExpiresAt: "2099-01-01T00:00:00.000Z",
}) as unknown as SessionContext;

test("FEAT-024-G composes the existing candidate manifest composition and handoff boundaries behind one read port", () => {
  let candidateReads = 0;
  const service = new ReleaseTraceReadProjectionService({
    releaseCandidateId, tenantId: "team-a", scopeRef: "team-a",
    manifestRead: {
      findCandidate: () => { candidateReads += 1; return candidate; },
      listManifestHistory: () => Object.freeze([manifest]),
    },
    evidenceComposition: { compose: () => composition },
    promotionHandoff: { materialize: () => null },
  });

  const projected = service.readReleaseTrace({ session, tenantId: "team-a", scopeRef: "team-a", correlationId: "release-trace-1" }) as Readonly<Record<string, unknown>>;
  assert.equal(candidateReads, 1);
  assert.equal((projected["candidate"] as Readonly<Record<string, unknown>>)["acceptanceResult"], "INCOMPLETE");
  assert.deepEqual((projected["candidate"] as Readonly<Record<string, unknown>>)["runtimeGapComponentIds"], composition.runtimeGapComponentIds);
  assert.deepEqual(projected["promotionHandoff"], { state: "UNAVAILABLE" });
  assert.equal(Object.isFrozen(projected), true);

  const concealed = service.readReleaseTrace({ session: Object.freeze({ ...session, tenantId: "team-b", teamId: "team-b" }), tenantId: "team-b", scopeRef: "team-b", correlationId: "release-trace-2" });
  assert.equal(concealed, undefined);
  assert.equal(candidateReads, 1);
});
