import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import { DurableReleaseAcceptanceManifestStore } from "./durable-release-acceptance-manifest-store.js";
import { createReleaseAcceptanceManifest, type ReleaseAcceptanceManifest } from "./release-evidence-manifest.js";
import { ReleaseEvidenceCompositionService, type ReleaseEvidenceComposition } from "./release-evidence-composition.js";
import { PromotionHandoffEvidenceService } from "./promotion-handoff-evidence.js";
import { ReleaseTraceReadProjectionService } from "./release-trace-read-projection.js";

const fixtureDirectories: string[] = [];

afterEach(() => {
  while (fixtureDirectories.length > 0) rmSync(fixtureDirectories.pop()!, { recursive: true, force: true });
});

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

test("FEAT-024-H selects the canonical terminal manifest after restart instead of trusting storage timestamp order", () => {
  const directory = mkdtempSync(join(tmpdir(), "feat024-h-"));
  fixtureDirectories.push(directory);
  const databasePath = join(directory, "release-evidence.sqlite");
  const canonicalCandidate = JSON.parse(readFileSync(
    "docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json",
    "utf8",
  )) as Rel001StagingCandidate;
  const readinessRefs = Object.freeze([{
    readinessType: "DEPLOYMENT" as const,
    readinessRef: "readiness-projection:rel001-staging",
    releaseCandidateId: canonicalCandidate.releaseCandidateId,
    candidateBindingFingerprint: canonicalCandidate.candidateFingerprint,
    targetEnvironment: canonicalCandidate.targetEnvironment,
    readiness: "UNKNOWN" as const,
    freshness: "UNKNOWN" as const,
    evaluatedAt: "2026-09-12T00:00:00.000Z",
    safeReasonCodes: Object.freeze(["MISSING_RUNTIME_SURFACES"]),
    evidenceRefs: Object.freeze(["evidence:feat024-a-candidate"]),
  }]);
  const first = createReleaseAcceptanceManifest(canonicalCandidate, {
    evidenceRefs: [{
      evidenceType: "TEST_RESULT", evidenceRef: "evidence:feat024-h-first", sourceFeatureOrRegistry: "FEAT-024",
      sourceCommitSha: canonicalCandidate.sourceCommitSha, candidateBindingFingerprint: canonicalCandidate.candidateFingerprint,
      evaluatedAt: "2026-09-12T00:00:00.000Z", safeResultSummary: "Initial integrated evidence",
    }],
    readinessRefs,
    acceptanceResult: "INCOMPLETE", acceptedBy: null, acceptedAt: null,
    evaluatedAt: "2026-09-12T00:00:00.000Z", decisionEvidenceRef: "evidence:feat024-h-first-decision",
    previousManifestId: null,
  });
  const successor = createReleaseAcceptanceManifest(canonicalCandidate, {
    evidenceRefs: [{
      evidenceType: "TEST_RESULT", evidenceRef: "evidence:feat024-h-successor", sourceFeatureOrRegistry: "FEAT-024",
      sourceCommitSha: canonicalCandidate.sourceCommitSha, candidateBindingFingerprint: canonicalCandidate.candidateFingerprint,
      evaluatedAt: "2026-09-12T01:00:00.000Z", safeResultSummary: "Successor integrated evidence",
    }],
    readinessRefs,
    acceptanceResult: "INCOMPLETE", acceptedBy: null, acceptedAt: null,
    evaluatedAt: "2026-09-12T01:00:00.000Z", decisionEvidenceRef: "evidence:feat024-h-successor-decision",
    previousManifestId: first.acceptanceManifestId,
  });

  let store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  store.append(canonicalCandidate, first, "2026-09-12T03:00:00.000Z");
  store.append(canonicalCandidate, successor, "2026-09-12T02:00:00.000Z");
  store.close();
  store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const evidenceComposition = new ReleaseEvidenceCompositionService({
    resolve: () => ({ authoritativeEvidence: Object.freeze([]), readinessRefs: Object.freeze([]) }),
  });
  const promotionHandoff = new PromotionHandoffEvidenceService({
    sourceResolver: {
      resolve: (candidateId, manifestId) => {
        const resolvedCandidate = store.findCandidate(candidateId);
        const resolvedManifest = store.findManifest(manifestId);
        if (resolvedCandidate === undefined || resolvedManifest === undefined) return undefined;
        return {
          candidate: resolvedCandidate,
          acceptanceManifest: resolvedManifest,
          manifestHistory: store.listManifestHistory(candidateId),
          currentReadinessRefs: resolvedManifest.readinessRefs,
        };
      },
    },
  });
  const service = new ReleaseTraceReadProjectionService({
    releaseCandidateId: canonicalCandidate.releaseCandidateId,
    tenantId: "team-a",
    scopeRef: "team-a",
    manifestRead: store,
    evidenceComposition,
    promotionHandoff,
  });

  const result = service.readReleaseTrace({ session, tenantId: "team-a", scopeRef: "team-a", correlationId: "release-trace-restart" }) as Readonly<Record<string, unknown>>;
  const projectedManifest = result["acceptanceManifest"] as Readonly<Record<string, unknown>>;
  assert.equal(projectedManifest["acceptanceManifestId"], successor.acceptanceManifestId);
  assert.equal(projectedManifest["acceptanceResult"], "INCOMPLETE");
  assert.deepEqual((result["candidate"] as Readonly<Record<string, unknown>>)["runtimeGapComponentIds"], [
    "ADMIN_CONSOLE", "AI_ADVISORY_FEAT_022", "AUDIT_API_016", "CORE_APIS_FEAT_001_011", "JOBS_API_017",
  ]);
  assert.deepEqual(result["promotionHandoff"], { state: "UNAVAILABLE" });
  assert.equal(store.listManifestHistory(canonicalCandidate.releaseCandidateId).length, 2);
  store.close();
});

test("FEAT-024-H fails closed when the manifest read port returns an orphaned lineage", () => {
  let compositionCalls = 0;
  const orphan = Object.freeze({ ...manifest, previousManifestId: "7".repeat(64) });
  const service = new ReleaseTraceReadProjectionService({
    releaseCandidateId, tenantId: "team-a", scopeRef: "team-a",
    manifestRead: {
      findCandidate: () => candidate,
      listManifestHistory: () => Object.freeze([orphan]),
    },
    evidenceComposition: {
      compose: () => { compositionCalls += 1; return composition; },
    },
    promotionHandoff: { materialize: () => null },
  });

  const result = service.readReleaseTrace({ session, tenantId: "team-a", scopeRef: "team-a", correlationId: "release-trace-orphan" });
  assert.equal(result, undefined);
  assert.equal(compositionCalls, 0);
});

test("FEAT-024-H rejects a terminal lineage whose predecessor belongs to another candidate", () => {
  let compositionCalls = 0;
  const foreignPredecessor = Object.freeze({
    ...manifest,
    acceptanceManifestId: "8".repeat(64),
    releaseCandidateId: "9".repeat(64),
    previousManifestId: null,
  });
  const reboundTerminal = Object.freeze({ ...manifest, previousManifestId: foreignPredecessor.acceptanceManifestId });
  const service = new ReleaseTraceReadProjectionService({
    releaseCandidateId, tenantId: "team-a", scopeRef: "team-a",
    manifestRead: {
      findCandidate: () => candidate,
      listManifestHistory: () => Object.freeze([reboundTerminal, foreignPredecessor]),
    },
    evidenceComposition: {
      compose: () => { compositionCalls += 1; return composition; },
    },
    promotionHandoff: { materialize: () => null },
  });

  const result = service.readReleaseTrace({ session, tenantId: "team-a", scopeRef: "team-a", correlationId: "release-trace-cross-candidate" });
  assert.equal(result, undefined);
  assert.equal(compositionCalls, 0);
});
