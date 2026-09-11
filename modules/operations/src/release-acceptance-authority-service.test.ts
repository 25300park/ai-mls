import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RoleCode } from "../../../packages/security-contracts/src/index.js";
import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type LiveRoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import { DurableReleaseAcceptanceManifestStore } from "./durable-release-acceptance-manifest-store.js";
import {
  ReleaseAcceptanceAuthorityError,
  ReleaseAcceptanceAuthorityService,
  type ReleaseAcceptanceDecisionMaterial,
  type ReleaseAcceptanceManifestFactory,
  type ReleaseAcceptanceManifestStore,
} from "./release-acceptance-authority-service.js";
import {
  createReleaseAcceptanceManifest,
  type ReleaseAcceptanceManifest,
} from "./release-evidence-manifest.js";

const RELEASE_CANDIDATE_ID = "1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1";
const ARTIFACT_FINGERPRINT = "a5de42d389b2aec27b4dd2a6362f442afced8414a7050c170f980fa4727547cd";
const CANDIDATE_FINGERPRINT = "001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d";
const SOURCE_SHA = "ddc1604cae78ca3493c27a7add23446970e485ae";

function candidate(complete = true): Rel001StagingCandidate {
  return Object.freeze({
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
    releaseScopeCoverage: [Object.freeze({
      artifactComponentId: "ADMIN_CONSOLE",
      requiredByReleaseScope: true,
      executableRuntimeAvailable: complete,
      artifactIncluded: complete,
      implementationRuntimeEvidenceRef: "apps/admin-console/src/main.ts#composeDevelopmentAdminConsole",
      gapDisposition: complete ? "INCLUDED" : "INCOMPLETE_RUNTIME_SURFACE",
    })],
    artifactManifest: Object.freeze({
      artifactManifestVersion: "1",
      logicalReleaseId: "REL-001",
      targetEnvironment: "Staging",
      sourceCommitSha: SOURCE_SHA,
      repositoryIdentity: "https://github.com/25300park/ai-mls.git",
      runtimeComponents: [], includedFilePaths: [], excludedClassPolicy: [],
      artifactFingerprint: ARTIFACT_FINGERPRINT,
      generatedAt: "2026-09-11T00:00:00.000Z",
    }),
  } as Rel001StagingCandidate);
}

function session(role: RoleCode = "RELEASE_OWNER", overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({
    id: "session-release-owner-1",
    principalId: "actor:release-owner-1",
    principalType: "HUMAN",
    roles: [role],
    teamId: "team-release",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-09-12T00:00:00.000Z",
    expiresAt: "2026-09-12T01:00:00.000Z",
    absoluteExpiresAt: "2026-09-12T02:00:00.000Z",
    familyId: "family-release-owner-1",
    refreshReference: "refresh-release-owner-1",
    ...overrides,
  });
}

function material(overrides: Partial<ReleaseAcceptanceDecisionMaterial> = {}): ReleaseAcceptanceDecisionMaterial {
  return Object.freeze({
    candidate: candidate(true),
    tenantId: "tenant-release",
    teamId: "team-release",
    producerActorId: "actor:candidate-producer-1",
    producerProvenanceRef: "provenance:candidate-producer-1",
    implementationAuthorActorId: "actor:implementation-author-1",
    implementationAuthorProvenanceRef: "provenance:implementation-author-1",
    acceptanceResult: "ACCEPTED",
    evaluatedAt: "2026-09-12T00:10:00.000Z",
    decisionEvidenceRef: "evidence:release-decision-1",
    previousManifestId: null,
    evidenceRefs: [Object.freeze({
      evidenceType: "INDEPENDENT_REVIEW",
      evidenceRef: "evidence:independent-review-1",
      sourceFeatureOrRegistry: "FEAT-024",
      sourceCommitSha: SOURCE_SHA,
      candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
      evaluatedAt: "2026-09-12T00:05:00.000Z",
      safeResultSummary: "Independent review ready",
    })],
    readinessRefs: [Object.freeze({
      readinessType: "DEPLOYMENT",
      readinessRef: "readiness:rel001-staging",
      releaseCandidateId: RELEASE_CANDIDATE_ID,
      candidateBindingFingerprint: CANDIDATE_FINGERPRINT,
      targetEnvironment: "Staging",
      readiness: "READY",
      freshness: "FRESH",
      evaluatedAt: "2026-09-12T00:05:00.000Z",
      safeReasonCodes: ["CANDIDATE_READY"],
      evidenceRefs: ["evidence:readiness-1"],
    })],
    ...overrides,
  });
}

function manifestFactory(): ReleaseAcceptanceManifestFactory {
  return {
    create(value, input): ReleaseAcceptanceManifest {
      const accepted = input.acceptanceResult === "ACCEPTED";
      if (accepted && value.releaseScopeCoverage.some((row) => row.requiredByReleaseScope && row.gapDisposition !== "INCLUDED")) {
        throw new Error("candidate incomplete");
      }
      return Object.freeze({
        acceptanceManifestId: accepted ? "a".repeat(64) : "b".repeat(64),
        releaseCandidateId: value.releaseCandidateId,
        logicalReleaseId: value.logicalReleaseId,
        sourceCommitSha: value.sourceCommitSha,
        repositoryIdentity: value.repositoryIdentity,
        sourceBranch: value.sourceBranch,
        artifactFingerprint: value.artifactFingerprint,
        targetEnvironment: value.targetEnvironment,
        manifestFingerprint: accepted ? "c".repeat(64) : "d".repeat(64),
        ...input,
      });
    },
  };
}

function fixture(options: {
  readonly role?: RoleCode;
  readonly material?: ReleaseAcceptanceDecisionMaterial;
  readonly session?: SessionContext;
  readonly revokeBeforeRevalidation?: boolean;
} = {}): {
  readonly service: ReleaseAcceptanceAuthorityService;
  readonly store: ReleaseAcceptanceManifestStore & { readonly writes: ReleaseAcceptanceManifest[] };
  readonly authorization: AuthorizationService;
} {
  const role = options.role ?? "RELEASE_OWNER";
  let assignments: readonly LiveRoleAssignment[] = [Object.freeze({
    id: "assignment-release-owner-1",
    principalId: "actor:release-owner-1",
    role,
    tenantId: "tenant-release",
    subjectPrincipalType: "HUMAN",
    teamIds: ["team-release"],
    resourceTypes: ["ReleaseCandidate"],
    purposes: ["RELEASE_ACCEPTANCE"],
    effectiveFrom: "2026-09-11T00:00:00.000Z",
    effectiveUntil: "2026-09-13T00:00:00.000Z",
    status: "ACTIVE",
    version: 1,
  })];
  let auditSequence = 0;
  const auditSink = new AuditLog({
    clock: () => new Date("2026-09-12T00:15:00.000Z"),
    idFactory: () => `audit-feat024-d-${String(++auditSequence)}`,
  });
  const authorization = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => assignments },
    auditSink,
    clock: () => new Date("2026-09-12T00:15:00.000Z"),
    policyVersion: "release-acceptance-v1",
  });
  const writes: ReleaseAcceptanceManifest[] = [];
  const store: ReleaseAcceptanceManifestStore & { readonly writes: ReleaseAcceptanceManifest[] } = {
    writes,
    append(_candidate, manifest): ReleaseAcceptanceManifest {
      const replay = writes.find((item) => item.acceptanceManifestId === manifest.acceptanceManifestId);
      if (replay !== undefined) return replay;
      writes.push(manifest);
      return manifest;
    },
  };
  let resolves = 0;
  const trustedMaterial = options.material ?? material();
  const trustedSession = options.session ?? session(role);
  const service = new ReleaseAcceptanceAuthorityService({
    authorizationService: authorization,
    sessionResolver: { resolve: (sessionId) => sessionId === trustedSession.id ? trustedSession : undefined },
    candidateResolver: {
      resolve(releaseCandidateId): ReleaseAcceptanceDecisionMaterial | undefined {
        assert.equal(releaseCandidateId, RELEASE_CANDIDATE_ID);
        resolves += 1;
        if (options.revokeBeforeRevalidation && resolves === 2) assignments = [];
        return trustedMaterial;
      },
    },
    manifestFactory: manifestFactory(),
    manifestStore: store,
    clock: () => new Date("2026-09-12T00:20:00.000Z"),
  });
  return { service, store, authorization };
}

function request(sessionId = "session-release-owner-1"): Parameters<ReleaseAcceptanceAuthorityService["decide"]>[0] {
  return {
    releaseCandidateId: RELEASE_CANDIDATE_ID,
    sessionId,
    reason: "Review exact immutable release candidate",
    correlationId: "correlation-feat024-d-1",
    acceptedBy: "actor:body-forgery",
    producerActorId: "actor:release-owner-1",
    claimedRole: "ADM",
    claimedCapability: "release.accept",
    session: session("ADM", { principalId: "actor:body-session-forgery" }),
  };
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof ReleaseAcceptanceAuthorityError && error.code === code);
}

test("FEAT-024-D uses the trusted RELEASE_OWNER Session actor and persists bounded SoD evidence", () => {
  const { service, store } = fixture();

  const result = service.decide(request());

  assert.equal(result.acceptanceResult, "ACCEPTED");
  assert.equal(result.acceptedBy, "actor:release-owner-1");
  assert.equal(result.acceptedAt, "2026-09-12T00:20:00.000Z");
  assert.equal(store.writes.length, 1);
  assert.equal(result.evidenceRefs.some((item) => item.evidenceType === "RELEASE_AUTHORITY"), true);
  assert.equal(result.evidenceRefs.some((item) => item.evidenceType === "MFA_VERIFICATION"), true);
  assert.equal(result.evidenceRefs.some((item) => item.evidenceRef === "provenance:implementation-author-1"), true);
  assert.equal(result.evidenceRefs.some((item) => item.evidenceType === "RELEASE_SOD"), true);
});

test("FEAT-024-D denies existing roles, reviewer-only evidence, and missing MFA with zero persistence", () => {
  for (const role of ["ADM", "SEC", "OPS", "REV"] as const) {
    const current = fixture({ role });
    expectCode(() => current.service.decide(request()), "AUTHORIZATION_DENIED");
    assert.equal(current.store.writes.length, 0);
  }
  const noMfa = fixture({ session: session("RELEASE_OWNER", { assurance: "SINGLE_FACTOR", isMfaVerified: false }) });
  expectCode(() => noMfa.service.decide(request()), "REAUTHENTICATION_REQUIRED");
  assert.equal(noMfa.store.writes.length, 0);
});

test("FEAT-024-D fails closed when no trusted Session resolves and ignores a body Session", () => {
  const current = fixture();
  expectCode(() => current.service.decide(request("session-unknown")), "AUTHENTICATION_REQUIRED");
  assert.equal(current.store.writes.length, 0);
});

test("FEAT-024-D enforces producer and authoritative implementation-author SoD", () => {
  for (const changed of [
    material({ producerActorId: "actor:release-owner-1" }),
    material({ implementationAuthorActorId: "actor:release-owner-1" }),
  ]) {
    const current = fixture({ material: changed });
    expectCode(() => current.service.decide(request()), "SEPARATION_OF_DUTIES_DENIED");
    assert.equal(current.store.writes.length, 0);
  }
});

test("FEAT-024-D treats absent implementation-author provenance as NOT_EVALUABLE without fabricating PASS", () => {
  const current = fixture({ material: material({ implementationAuthorActorId: null, implementationAuthorProvenanceRef: null }) });
  const result = current.service.decide(request());

  assert.equal(result.acceptanceResult, "ACCEPTED");
  assert.equal(result.evidenceRefs.some((item) => item.safeResultSummary === "Implementation author SoD NOT_EVALUABLE"), true);
});

test("FEAT-024-D revalidates live authority immediately before append", () => {
  const current = fixture({ revokeBeforeRevalidation: true });
  expectCode(() => current.service.decide(request()), "AUTHORIZATION_DENIED");
  assert.equal(current.store.writes.length, 0);
});

test("FEAT-024-D re-resolves the trusted Session immediately before append", () => {
  let resolutions = 0;
  const current = fixture();
  const active = session();
  const service = new ReleaseAcceptanceAuthorityService({
    authorizationService: current.authorization,
    sessionResolver: { resolve: () => ++resolutions === 1 ? active : session("RELEASE_OWNER", { state: "REVOKED" }) },
    candidateResolver: { resolve: () => material() },
    manifestFactory: manifestFactory(),
    manifestStore: current.store,
    clock: () => new Date("2026-09-12T00:20:00.000Z"),
  });
  expectCode(() => service.decide(request()), "AUTHENTICATION_REQUIRED");
  assert.equal(current.store.writes.length, 0);
});

test("FEAT-024-D rejects stale trusted candidate or provenance rebinding", () => {
  let count = 0;
  const current = fixture();
  const base = material();
  const service = new ReleaseAcceptanceAuthorityService({
    authorizationService: current.authorization,
    sessionResolver: { resolve: () => session() },
    candidateResolver: { resolve: () => (++count === 1 ? base : material({ producerActorId: "actor:different-producer" })) },
    manifestFactory: manifestFactory(),
    manifestStore: current.store,
    clock: () => new Date("2026-09-12T00:20:00.000Z"),
  });
  expectCode(() => service.decide(request()), "STALE_ACCEPTANCE_DECISION");
  assert.equal(current.store.writes.length, 0);
});

test("FEAT-024-D detects in-place resolver rebinding against the initial trusted snapshot", () => {
  const current = fixture();
  const mutableMaterial = { ...material() } as ReleaseAcceptanceDecisionMaterial & { producerActorId: string };
  const mutableSession = { ...session() } as SessionContext & { familyId: string };
  let materialResolutions = 0;
  let sessionResolutions = 0;
  const service = new ReleaseAcceptanceAuthorityService({
    authorizationService: current.authorization,
    sessionResolver: {
      resolve: () => {
        sessionResolutions += 1;
        if (sessionResolutions === 2) mutableSession.familyId = "family-rebound";
        return mutableSession;
      },
    },
    candidateResolver: {
      resolve: () => {
        materialResolutions += 1;
        if (materialResolutions === 2) mutableMaterial.producerActorId = "actor:rebound-producer";
        return mutableMaterial;
      },
    },
    manifestFactory: manifestFactory(),
    manifestStore: current.store,
    clock: () => new Date("2026-09-12T00:20:00.000Z"),
  });

  expectCode(() => service.decide(request()), "STALE_ACCEPTANCE_DECISION");
  assert.equal(current.store.writes.length, 0);
});

test("FEAT-024-D preserves current REL-001 INCOMPLETE and never attaches acceptance provenance", () => {
  const current = fixture({ material: material({
    candidate: candidate(false),
    acceptanceResult: "INCOMPLETE",
    readinessRefs: material().readinessRefs.map((item) => ({ ...item, readiness: "UNKNOWN", freshness: "UNKNOWN" })),
  }) });
  const result = current.service.decide(request());

  assert.equal(result.acceptanceResult, "INCOMPLETE");
  assert.equal(result.acceptedBy, null);
  assert.equal(result.acceptedAt, null);
  assert.equal(current.store.writes.length, 1);
});

test("FEAT-024-D preserves REJECTED provenance nullability", () => {
  const current = fixture({ material: material({ acceptanceResult: "REJECTED" }) });
  const result = current.service.decide(request());

  assert.equal(result.acceptanceResult, "REJECTED");
  assert.equal(result.acceptedBy, null);
  assert.equal(result.acceptedAt, null);
});

test("FEAT-024-D rejects ACCEPTED when mandatory review, readiness, or runtime evidence is incomplete", () => {
  for (const changed of [
    material({ evidenceRefs: [] }),
    material({ readinessRefs: material().readinessRefs.map((item) => ({ ...item, readiness: "UNKNOWN" })) }),
    material({ candidate: candidate(false) }),
  ]) {
    const current = fixture({ material: changed });
    expectCode(() => current.service.decide(request()), "ACCEPTANCE_EVIDENCE_INVALID");
    assert.equal(current.store.writes.length, 0);
  }
});

test("FEAT-024-D exact replay returns the existing manifest without duplicate release authority", () => {
  const current = fixture();
  const first = current.service.decide(request());
  const second = current.service.decide(request());

  assert.equal(second.acceptanceManifestId, first.acceptanceManifestId);
  assert.equal(current.store.writes.length, 1);
});

test("FEAT-024-D preserves the real REL-001 INCOMPLETE result through the durable Phase C store", () => {
  const directory = mkdtempSync(join(tmpdir(), "feat024-d-"));
  const databasePath = join(directory, "release-acceptance.sqlite");
  const canonicalCandidate = JSON.parse(readFileSync(
    "docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json",
    "utf8",
  )) as Rel001StagingCandidate;
  const currentMaterial = material({
    candidate: canonicalCandidate,
    acceptanceResult: "INCOMPLETE",
    evidenceRefs: [Object.freeze({
      evidenceType: "INDEPENDENT_REVIEW",
      evidenceRef: "evidence:independent-review-rel001",
      sourceFeatureOrRegistry: "FEAT-024",
      sourceCommitSha: canonicalCandidate.sourceCommitSha,
      candidateBindingFingerprint: canonicalCandidate.candidateFingerprint,
      evaluatedAt: "2026-09-12T00:05:00.000Z",
      safeResultSummary: "Independent review ready",
    })],
    readinessRefs: [Object.freeze({
      readinessType: "DEPLOYMENT",
      readinessRef: "readiness:rel001-staging",
      releaseCandidateId: canonicalCandidate.releaseCandidateId,
      candidateBindingFingerprint: canonicalCandidate.candidateFingerprint,
      targetEnvironment: canonicalCandidate.targetEnvironment,
      readiness: "UNKNOWN",
      freshness: "UNKNOWN",
      evaluatedAt: "2026-09-12T00:05:00.000Z",
      safeReasonCodes: ["INCOMPLETE_RUNTIME_SURFACE"],
      evidenceRefs: ["evidence:readiness-rel001"],
    })],
  });
  const current = fixture({ material: currentMaterial });
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const service = new ReleaseAcceptanceAuthorityService({
    authorizationService: current.authorization,
    sessionResolver: { resolve: () => session() },
    candidateResolver: { resolve: () => currentMaterial },
    manifestFactory: { create: createReleaseAcceptanceManifest },
    manifestStore: store,
    clock: () => new Date("2026-09-12T00:20:00.000Z"),
  });
  try {
    const stored = service.decide(request());
    assert.equal(stored.acceptanceResult, "INCOMPLETE");
    assert.equal(stored.acceptedBy, null);
    assert.equal(stored.acceptedAt, null);
    assert.deepEqual(store.findManifest(stored.acceptanceManifestId), stored);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
