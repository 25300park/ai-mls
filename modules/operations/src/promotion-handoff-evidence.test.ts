import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { materializeRel001StagingCandidate, type Rel001StagingCandidate } from "./release-candidate-artifact.js";
import {
  createReleaseAcceptanceManifest,
  type ReleaseAcceptanceManifest,
  type ReleaseReadinessRef,
} from "./release-evidence-manifest.js";
import {
  PromotionHandoffEvidenceService,
  type PromotionHandoffSourceSnapshot,
} from "./promotion-handoff-evidence.js";

const RELEASE_CANDIDATE_ID = "1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1";
const CANDIDATE_FINGERPRINT = "001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d";
const ARTIFACT_FINGERPRINT = "a5de42d389b2aec27b4dd2a6362f442afced8414a7050c170f980fa4727547cd";
const SOURCE_SHA = "ddc1604cae78ca3493c27a7add23446970e485ae";
const MANIFEST_FINGERPRINT = "79bb906bbdd231511fd99bae7b7b763442770701908686d86fb9c7e3952f8dee";
const ACCEPTANCE_MANIFEST_ID = "9072987bd0c4454780c3689a6165fcc09ea780fbff6718ac0f94f9351563e751";
const EXPECTED_HANDOFF_FINGERPRINT = "77aabc741cd844170e3e18bb7ff25077301e8ffab3163908daf46437ff082755";
const SUCCESSOR_MANIFEST_FINGERPRINT = "f0b89b4cb90d6ae85d814ad16a02250fac92a90a37b586f20889dccf2758e8ee";
const SUCCESSOR_MANIFEST_ID = "5ec3de64cd5915abdd8c1e90a6205b68efae5d6bd0b0fc014cdeac828f1e56e5";
const POST_INCOMPLETE_MANIFEST_FINGERPRINT = "b3527d2644f5f26b9597461e0472953a8638be292f9592ceecaf11ec81215d92";
const POST_INCOMPLETE_MANIFEST_ID = "4a8406d1d39298f5a7cae28e938f34d357c96d21e27b409dab1fac2fe3dfe1cd";

function canonicalCandidate(): Rel001StagingCandidate {
  return JSON.parse(readFileSync(
    "docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json",
    "utf8",
  )) as Rel001StagingCandidate;
}

function eligibleTestCandidate(): Rel001StagingCandidate {
  const current = canonicalCandidate();
  return Object.freeze({
    ...current,
    releaseScopeCoverage: Object.freeze(current.releaseScopeCoverage.map((row) => Object.freeze({
      ...row,
      executableRuntimeAvailable: true,
      artifactIncluded: true,
      gapDisposition: "INCLUDED" as const,
    }))),
  });
}

function readiness(
  readinessType: ReleaseReadinessRef["readinessType"],
  value: ReleaseReadinessRef["readiness"] = "READY",
): ReleaseReadinessRef {
  const name = readinessType.toLowerCase();
  return Object.freeze({
    readinessType,
    readinessRef: `readiness:${name}`,
    releaseCandidateId: RELEASE_CANDIDATE_ID,
    candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
    targetEnvironment: "Staging",
    readiness: value,
    freshness: "FRESH",
    evaluatedAt: "2026-09-12T00:10:00.000Z",
    safeReasonCodes: Object.freeze(["READY"]),
    evidenceRefs: Object.freeze([`evidence:${name}`]),
  });
}

function acceptedManifest(overrides: Partial<ReleaseAcceptanceManifest> = {}): ReleaseAcceptanceManifest {
  return Object.freeze({
    acceptanceManifestId: ACCEPTANCE_MANIFEST_ID,
    releaseCandidateId: RELEASE_CANDIDATE_ID,
    logicalReleaseId: "REL-001",
    sourceCommitSha: SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "codex/feat-024-a-release-candidate",
    artifactFingerprint: ARTIFACT_FINGERPRINT,
    targetEnvironment: "Staging",
    evidenceRefs: Object.freeze([
      Object.freeze({
        evidenceType: "RELEASE_AUTHORITY",
        evidenceRef: "authority:release-owner-assignment",
        sourceFeatureOrRegistry: "FEAT-024",
        sourceCommitSha: SOURCE_SHA,
        candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
        evaluatedAt: "2026-09-12T00:20:00.000Z",
        safeResultSummary: "Live release acceptance authority verified",
      }),
      Object.freeze({
        evidenceType: "DEPLOYMENT_SOD_HANDOFF",
        evidenceRef: "deployment-sod:acceptance-decision",
        sourceFeatureOrRegistry: "FEAT-024",
        sourceCommitSha: SOURCE_SHA,
        candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
        evaluatedAt: "2026-09-12T00:20:00.000Z",
        safeResultSummary: "Acceptance actor retained for later deployment SoD",
      }),
    ]),
    readinessRefs: Object.freeze([readiness("DEPLOYMENT"), readiness("ROLLBACK"), readiness("BACKUP")]),
    acceptanceResult: "ACCEPTED",
    acceptedBy: "actor:release-owner-1",
    evaluatedAt: "2026-09-12T00:10:00.000Z",
    acceptedAt: "2026-09-12T00:20:00.000Z",
    decisionEvidenceRef: "evidence:release-decision",
    previousManifestId: null,
    manifestFingerprint: MANIFEST_FINGERPRINT,
    ...overrides,
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function manifestWithCanonicalIdentity(
  candidate: Rel001StagingCandidate,
  overrides: Partial<ReleaseAcceptanceManifest>,
): ReleaseAcceptanceManifest {
  const manifest = acceptedManifest({
    releaseCandidateId: candidate.releaseCandidateId,
    sourceCommitSha: candidate.sourceCommitSha,
    repositoryIdentity: candidate.repositoryIdentity,
    sourceBranch: candidate.sourceBranch,
    artifactFingerprint: candidate.artifactFingerprint,
    targetEnvironment: candidate.targetEnvironment,
    ...overrides,
  });
  const evidence = manifest.evidenceRefs.map((value) => [
    value.evidenceType, value.evidenceRef, value.sourceFeatureOrRegistry, value.sourceCommitSha,
    value.candidateBindingFingerprint, value.safeResultSummary,
  ]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
  const readinessRefs = manifest.readinessRefs.map((value) => [
    value.readinessType, value.readinessRef, value.releaseCandidateId, value.candidateBindingFingerprint,
    value.targetEnvironment, value.readiness, value.freshness, [...value.safeReasonCodes].sort(),
    [...value.evidenceRefs].sort(),
  ]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
  const manifestFingerprint = sha256(JSON.stringify([
    candidate.releaseCandidateId, candidate.logicalReleaseId, candidate.sourceCommitSha,
    candidate.repositoryIdentity, candidate.sourceBranch, candidate.artifactFingerprint,
    candidate.candidateFingerprint, candidate.targetEnvironment, evidence, readinessRefs,
    manifest.acceptanceResult, manifest.acceptedBy, manifest.decisionEvidenceRef, manifest.previousManifestId,
  ]));
  return Object.freeze({
    ...manifest,
    manifestFingerprint,
    acceptanceManifestId: sha256(`release-acceptance-manifest\0${manifestFingerprint}`),
  });
}

function currentIncompleteManifest(): ReleaseAcceptanceManifest {
  const candidate = canonicalCandidate();
  return createReleaseAcceptanceManifest(candidate, {
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
  });
}

function snapshot(overrides: Partial<PromotionHandoffSourceSnapshot> = {}): PromotionHandoffSourceSnapshot {
  const manifest = acceptedManifest();
  return Object.freeze({
    candidate: eligibleTestCandidate(),
    acceptanceManifest: manifest,
    manifestHistory: Object.freeze([manifest]),
    currentReadinessRefs: Object.freeze([readiness("ROLLBACK"), readiness("BACKUP"), readiness("DEPLOYMENT")]),
    ...overrides,
  });
}

function service(value: PromotionHandoffSourceSnapshot | undefined = snapshot()): PromotionHandoffEvidenceService {
  return new PromotionHandoffEvidenceService({
    sourceResolver: {
      resolve: (releaseCandidateId, acceptanceManifestId) =>
        releaseCandidateId === RELEASE_CANDIDATE_ID && acceptanceManifestId === ACCEPTANCE_MANIFEST_ID ? value : undefined,
    },
  });
}

function request(): { readonly releaseCandidateId: string; readonly acceptanceManifestId: string } {
  return { releaseCandidateId: RELEASE_CANDIDATE_ID, acceptanceManifestId: ACCEPTANCE_MANIFEST_ID };
}

test("FEAT-024-F eligible accepted fixture produces one exact immutable handoff", () => {
  const result = service().materialize(request());

  assert.ok(result);
  assert.equal(result.releaseCandidateId, RELEASE_CANDIDATE_ID);
  assert.equal(result.acceptanceManifestId, ACCEPTANCE_MANIFEST_ID);
  assert.equal(result.manifestFingerprint, MANIFEST_FINGERPRINT);
  assert.equal(result.logicalReleaseId, "REL-001");
  assert.equal(result.sourceCommitSha, SOURCE_SHA);
  assert.equal(result.artifactFingerprint, ARTIFACT_FINGERPRINT);
  assert.equal(result.targetEnvironment, "Staging");
  assert.equal(result.acceptanceResult, "ACCEPTED");
  assert.equal(result.acceptedAt, "2026-09-12T00:20:00.000Z");
  assert.equal(result.acceptanceActorId, "actor:release-owner-1");
  assert.deepEqual(result.acceptanceAuthorityEvidenceRefs, ["authority:release-owner-assignment"]);
  assert.deepEqual(result.deploymentSodEvidenceRefs, ["deployment-sod:acceptance-decision"]);
  assert.deepEqual(result.readinessRefs.map((item) => item.readinessType), ["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
  assert.equal(result.handoffEvidenceFingerprint, EXPECTED_HANDOFF_FINGERPRINT);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.readinessRefs), true);
});

test("FEAT-024-F current REL-001 INCOMPLETE produces no promotion handoff", () => {
  const candidate = canonicalCandidate();
  const manifest = acceptedManifest({ acceptanceResult: "INCOMPLETE", acceptedBy: null, acceptedAt: null });
  assert.equal(service(snapshot({ candidate, acceptanceManifest: manifest, manifestHistory: [manifest] })).materialize(request()), null);
});

async function assertExactIncompleteCandidateProducesNoPromotionHandoff(
  sourceCommitSha: string,
  evidenceLabel: "blocker1c" | "blocker2c",
): Promise<void> {
  const candidate = await materializeRel001StagingCandidate({
    distRoot: "dist",
    sourceCommitSha,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt: "2026-09-16T12:00:00.000Z",
  });
  const manifest = createReleaseAcceptanceManifest(candidate, {
    evidenceRefs: [{
      evidenceType: "TEST_RESULT",
      evidenceRef: `staging-reevaluation:${evidenceLabel}:focused-tests`,
      sourceFeatureOrRegistry: "REL-001",
      sourceCommitSha: candidate.sourceCommitSha,
      candidateBindingFingerprint: candidate.candidateFingerprint,
      evaluatedAt: "2026-09-16T13:00:00.000Z",
      safeResultSummary: `${evidenceLabel === "blocker1c" ? "Blocker 1C" : "Blocker 2C"} focused verification passed`,
    }],
    readinessRefs: [{
      readinessType: "DEPLOYMENT",
      readinessRef: `staging-reevaluation:${evidenceLabel}:deployment-not-ready`,
      releaseCandidateId: candidate.releaseCandidateId,
      candidateBindingFingerprint: candidate.candidateFingerprint,
      targetEnvironment: "Staging",
      readiness: "NOT_READY",
      freshness: "FRESH",
      evaluatedAt: "2026-09-16T13:00:00.000Z",
      safeReasonCodes: ["MISSING_RUNTIME_SURFACES"],
      evidenceRefs: [`staging-reevaluation:${evidenceLabel}:focused-tests`],
    }],
    acceptanceResult: "INCOMPLETE",
    acceptedBy: null,
    evaluatedAt: "2026-09-16T13:00:00.000Z",
    acceptedAt: null,
    decisionEvidenceRef: `staging-reevaluation:${evidenceLabel}:decision:incomplete`,
    previousManifestId: null,
  });
  const boundary = new PromotionHandoffEvidenceService({
    sourceResolver: {
      resolve: (releaseCandidateId, acceptanceManifestId) =>
        releaseCandidateId === candidate.releaseCandidateId && acceptanceManifestId === manifest.acceptanceManifestId
          ? Object.freeze({
            candidate,
            acceptanceManifest: manifest,
            manifestHistory: Object.freeze([manifest]),
            currentReadinessRefs: Object.freeze([]),
          })
          : undefined,
    },
  });

  assert.equal(boundary.materialize({
    releaseCandidateId: candidate.releaseCandidateId,
    acceptanceManifestId: manifest.acceptanceManifestId,
  }), null);
}

test("REL-001 Blocker 1C exact INCOMPLETE candidate produces no promotion handoff", async () => {
  await assertExactIncompleteCandidateProducesNoPromotionHandoff(
    "97a3522fb301fea197d3fa2defc7bc2826c2d719",
    "blocker1c",
  );
});

test("REL-001 Blocker 2C exact INCOMPLETE candidate produces no promotion handoff", async () => {
  await assertExactIncompleteCandidateProducesNoPromotionHandoff(
    "b7d2a864b8dbed9c6b1f0c7874481035159af886",
    "blocker2c",
  );
});

test("FEAT-024-F REJECTED manifest produces no promotion handoff", () => {
  const manifest = acceptedManifest({ acceptanceResult: "REJECTED", acceptedBy: null, acceptedAt: null });
  assert.equal(service(snapshot({ acceptanceManifest: manifest, manifestHistory: [manifest] })).materialize(request()), null);
});

test("FEAT-024-F artifact mismatch fails closed", () => {
  const manifest = acceptedManifest({ artifactFingerprint: "c".repeat(64) });
  assert.equal(service(snapshot({ acceptanceManifest: manifest })).materialize(request()), null);
});

test("FEAT-024-F Staging candidate cannot be rebound to Production", () => {
  const manifest = acceptedManifest({ targetEnvironment: "Production" });
  assert.equal(service(snapshot({ acceptanceManifest: manifest })).materialize(request()), null);
});

test("FEAT-024-F UNKNOWN readiness cannot satisfy handoff", () => {
  const current = [readiness("BACKUP"), readiness("DEPLOYMENT", "UNKNOWN"), readiness("ROLLBACK")];
  assert.equal(service(snapshot({ currentReadinessRefs: current })).materialize(request()), null);
});

test("FEAT-024-F NOT_READY readiness cannot satisfy handoff", () => {
  const current = [readiness("BACKUP"), readiness("DEPLOYMENT", "NOT_READY"), readiness("ROLLBACK")];
  assert.equal(service(snapshot({ currentReadinessRefs: current })).materialize(request()), null);
});

test("FEAT-024-F readiness and authority evidence cannot rebind candidate or environment", () => {
  const reboundReadiness = acceptedManifest().readinessRefs.map((item) => ({ ...item, targetEnvironment: "Production" }));
  const reboundManifest = acceptedManifest({ readinessRefs: reboundReadiness });
  assert.equal(service(snapshot({
    acceptanceManifest: reboundManifest,
    manifestHistory: [reboundManifest],
    currentReadinessRefs: reboundReadiness,
  })).materialize(request()), null);

  const reboundEvidence = acceptedManifest().evidenceRefs.map((item) => ({ ...item, candidateBindingFingerprint: "c".repeat(64) }));
  const evidenceManifest = acceptedManifest({ evidenceRefs: reboundEvidence });
  assert.equal(service(snapshot({ acceptanceManifest: evidenceManifest, manifestHistory: [evidenceManifest] })).materialize(request()), null);
});

test("FEAT-024-F manifest mismatch fails closed rather than trusting the selected object", () => {
  const selected = acceptedManifest({ manifestFingerprint: "c".repeat(64) });
  assert.equal(service(snapshot({ acceptanceManifest: selected })).materialize(request()), null);
});

test("FEAT-024-F canonical manifest identity is recomputed from logical content", () => {
  const evidenceRefs = acceptedManifest().evidenceRefs.map((item, index) => index === 0
    ? { ...item, safeResultSummary: "Tampered but syntactically safe authority evidence" }
    : item);
  const tampered = acceptedManifest({ evidenceRefs });
  assert.equal(service(snapshot({ acceptanceManifest: tampered, manifestHistory: [tampered] })).materialize(request()), null);
});

test("FEAT-024-F an authoritative ACCEPTED successor may follow the canonical INCOMPLETE manifest", () => {
  const incomplete = currentIncompleteManifest();
  const accepted = acceptedManifest({
    acceptanceManifestId: POST_INCOMPLETE_MANIFEST_ID,
    manifestFingerprint: POST_INCOMPLETE_MANIFEST_FINGERPRINT,
    previousManifestId: incomplete.acceptanceManifestId,
  });
  const source = snapshot({ acceptanceManifest: accepted, manifestHistory: [incomplete, accepted] });
  const boundary = new PromotionHandoffEvidenceService({ sourceResolver: { resolve: () => source } });
  assert.ok(boundary.materialize({
    releaseCandidateId: RELEASE_CANDIDATE_ID,
    acceptanceManifestId: POST_INCOMPLETE_MANIFEST_ID,
  }));
});

test("FEAT-024-F same logical handoff is deterministic across readiness order", () => {
  const first = service().materialize(request());
  const reordered = snapshot({ currentReadinessRefs: [readiness("DEPLOYMENT"), readiness("ROLLBACK"), readiness("BACKUP")] });
  const second = service(reordered).materialize(request());
  assert.ok(first && second);
  assert.equal(second.handoffEvidenceFingerprint, first.handoffEvidenceFingerprint);
  assert.deepEqual(second, first);
});

test("FEAT-024-F provenance timestamps do not change the deterministic handoff fingerprint", () => {
  const first = service().materialize(request());
  const shiftedReadiness = acceptedManifest().readinessRefs.map((item) => ({
    ...item,
    evaluatedAt: "2026-09-12T01:10:00.000Z",
  }));
  const shiftedEvidence = acceptedManifest().evidenceRefs.map((item) => ({
    ...item,
    evaluatedAt: "2026-09-12T01:20:00.000Z",
  }));
  const shifted = acceptedManifest({
    acceptedAt: "2026-09-12T01:20:00.000Z",
    evaluatedAt: "2026-09-12T01:10:00.000Z",
    evidenceRefs: shiftedEvidence,
    readinessRefs: shiftedReadiness,
  });
  const second = service(snapshot({
    acceptanceManifest: shifted,
    manifestHistory: [shifted],
    currentReadinessRefs: shiftedReadiness,
  })).materialize(request());
  assert.ok(first && second);
  assert.equal(second.handoffEvidenceFingerprint, first.handoffEvidenceFingerprint);
});

test("FEAT-024-F missing acceptance actor or deployment SoD evidence fails closed", () => {
  const actorless = acceptedManifest({ acceptedBy: null });
  assert.equal(service(snapshot({ acceptanceManifest: actorless, manifestHistory: [actorless] })).materialize(request()), null);
  const evidence = acceptedManifest().evidenceRefs.filter((item) => item.evidenceType !== "DEPLOYMENT_SOD_HANDOFF");
  const sodless = acceptedManifest({ evidenceRefs: evidence });
  assert.equal(service(snapshot({ acceptanceManifest: sodless, manifestHistory: [sodless] })).materialize(request()), null);
});

test("FEAT-024-F request cannot supply deployment execution or persistence callbacks", () => {
  let deploymentCalls = 0;
  let persistenceCalls = 0;
  const forged = {
    ...request(),
    deploy: () => { deploymentCalls += 1; },
    persist: () => { persistenceCalls += 1; },
  };
  assert.equal(service().materialize(forged as never), null);
  assert.equal(deploymentCalls, 0);
  assert.equal(persistenceCalls, 0);
});

test("FEAT-024-F newer authoritative manifest invalidates the selected handoff", () => {
  const selected = acceptedManifest();
  const newer = acceptedManifest({
    acceptanceManifestId: SUCCESSOR_MANIFEST_ID,
    manifestFingerprint: SUCCESSOR_MANIFEST_FINGERPRINT,
    previousManifestId: selected.acceptanceManifestId,
  });
  assert.equal(service(snapshot({ manifestHistory: [selected, newer] })).materialize(request()), null);
  assert.equal(service(snapshot({ manifestHistory: [newer, selected] })).materialize(request()), null);
});

test("FEAT-024-F raw secret log or unexpected evidence payload cannot enter handoff", () => {
  const unsafe = {
    ...acceptedManifest(),
    evidenceRefs: acceptedManifest().evidenceRefs.map((item, index) => index === 0
      ? { ...item, rawLog: "Authorization: Bearer example-not-a-secret" }
      : item),
  } as unknown as ReleaseAcceptanceManifest;
  assert.equal(service(snapshot({ acceptanceManifest: unsafe, manifestHistory: [unsafe] })).materialize(request()), null);
});

test("FEAT-024-F conflicting candidate identity and missing authoritative source disclose no handoff", () => {
  const conflict = { ...eligibleTestCandidate(), artifactFingerprint: "c".repeat(64) } as Rel001StagingCandidate;
  assert.equal(service(snapshot({ candidate: conflict })).materialize(request()), null);
  const missing = new PromotionHandoffEvidenceService({ sourceResolver: { resolve: () => undefined } });
  assert.equal(missing.materialize(request()), null);
});

test("FEAT-024-F coherently forged artifact and rebuilt identities cannot replace the canonical candidate", () => {
  const original = eligibleTestCandidate();
  const component = original.artifactManifest.runtimeComponents[0]!;
  const files = component.includedFiles.map((file, index) => index === 0
    ? { ...file, fileSha256: "c".repeat(64) }
    : file);
  const componentFingerprint = sha256(files.map((file) => `${file.path}\0${file.fileSha256}\0${file.fileSize}`).join("\n"));
  const artifactFingerprint = sha256(["REL-001", "Staging", SOURCE_SHA, `API-015_ADMINISTRATION_HTTP:${componentFingerprint}`].join("\0"));
  const releaseCandidateId = sha256(["REL-001", SOURCE_SHA, original.repositoryIdentity, original.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const candidateFingerprint = sha256([releaseCandidateId, "REL-001", SOURCE_SHA, original.repositoryIdentity, original.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const candidate = {
    ...original,
    releaseCandidateId,
    artifactFingerprint,
    candidateFingerprint,
    artifactManifest: {
      ...original.artifactManifest,
      artifactFingerprint,
      runtimeComponents: [{ ...component, componentFingerprint, includedFiles: files }],
    },
  } as Rel001StagingCandidate;
  const readinessRefs = acceptedManifest().readinessRefs.map((item) => ({
    ...item,
    releaseCandidateId,
    candidateBindingFingerprint: candidateFingerprint,
  }));
  const evidenceRefs = acceptedManifest().evidenceRefs.map((item) => ({
    ...item,
    candidateBindingFingerprint: candidateFingerprint,
  }));
  const manifest = manifestWithCanonicalIdentity(candidate, { evidenceRefs, readinessRefs });
  const source = snapshot({ candidate, acceptanceManifest: manifest, manifestHistory: [manifest], currentReadinessRefs: readinessRefs });
  const boundary = new PromotionHandoffEvidenceService({ sourceResolver: { resolve: () => source } });
  assert.equal(boundary.materialize({ releaseCandidateId, acceptanceManifestId: manifest.acceptanceManifestId }), null);
});
