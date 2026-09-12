import type { SessionContext } from "../../identity/src/session-service.js";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import type { ReleaseAcceptanceManifest } from "./release-evidence-manifest.js";
import type { ReleaseEvidenceComposition, ReleaseEvidenceCompositionService } from "./release-evidence-composition.js";
import type { PromotionHandoffEvidence, PromotionHandoffEvidenceService } from "./promotion-handoff-evidence.js";

export interface ReleaseTraceManifestReadPort {
  findCandidate(releaseCandidateId: string): Rel001StagingCandidate | undefined;
  listManifestHistory(releaseCandidateId: string): readonly ReleaseAcceptanceManifest[];
}

export interface ReleaseTraceReadProjectionDependencies {
  readonly releaseCandidateId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly manifestRead: ReleaseTraceManifestReadPort;
  readonly evidenceComposition: Pick<ReleaseEvidenceCompositionService, "compose">;
  readonly promotionHandoff: Pick<PromotionHandoffEvidenceService, "materialize">;
}

export interface ReleaseTraceReadProjectionRequest {
  readonly session: SessionContext;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly correlationId: string;
}

/** Operations-owned, read-only composition of existing FEAT-024 A-F evidence. */
export class ReleaseTraceReadProjectionService {
  public constructor(private readonly dependencies: ReleaseTraceReadProjectionDependencies) {}

  public readReleaseTrace(request: ReleaseTraceReadProjectionRequest): unknown {
    if (!this.isVisible(request)) return undefined;
    try {
      const candidate = this.dependencies.manifestRead.findCandidate(this.dependencies.releaseCandidateId);
      if (candidate === undefined) return undefined;
      const history = this.dependencies.manifestRead.listManifestHistory(candidate.releaseCandidateId);
      const manifest = history.at(-1);
      if (manifest === undefined) return undefined;
      const composition = this.dependencies.evidenceComposition.compose(candidate, { evaluatedAt: manifest.evaluatedAt });
      if (!sameBinding(candidate, manifest, composition)) return undefined;
      const handoff = this.dependencies.promotionHandoff.materialize({
        releaseCandidateId: candidate.releaseCandidateId,
        acceptanceManifestId: manifest.acceptanceManifestId,
      });
      return project(candidate, manifest, composition, handoff);
    } catch {
      return undefined;
    }
  }

  private isVisible(request: ReleaseTraceReadProjectionRequest): boolean {
    return request.tenantId === this.dependencies.tenantId
      && request.scopeRef === this.dependencies.scopeRef
      && request.session.teamId === this.dependencies.scopeRef
      && request.session.state === "ACTIVE";
  }
}

function project(
  candidate: Rel001StagingCandidate,
  manifest: ReleaseAcceptanceManifest,
  composition: ReleaseEvidenceComposition,
  handoff: PromotionHandoffEvidence | null,
): unknown {
  const evidenceRefs = manifest.evidenceRefs.map((item) => item.evidenceRef);
  const readinessRefs = manifest.readinessRefs.map((item) => item.readinessRef);
  const compositionEvidenceRefs = composition.authoritativeEvidence.map((item) => item.evidenceRef);
  const compositionReadinessRefs = composition.readinessRefs.map((item) => item.readinessRef);
  const acceptanceAuthorityEvidenceRefs = manifest.evidenceRefs.filter((item) => item.evidenceType === "RELEASE_AUTHORITY").map((item) => item.evidenceRef);
  const deploymentSodEvidenceRefs = manifest.evidenceRefs.filter((item) => item.evidenceType === "DEPLOYMENT_SOD_HANDOFF").map((item) => item.evidenceRef);
  return deepFreeze({
    candidate: {
      releaseCandidateId: candidate.releaseCandidateId,
      logicalReleaseId: candidate.logicalReleaseId,
      sourceCommitSha: candidate.sourceCommitSha,
      artifactFingerprint: candidate.artifactFingerprint,
      candidateFingerprint: candidate.candidateFingerprint,
      targetEnvironment: candidate.targetEnvironment,
      acceptanceResult: candidate.acceptanceResult,
      runtimeGapComponentIds: composition.runtimeGapComponentIds,
    },
    acceptanceManifest: {
      acceptanceManifestId: manifest.acceptanceManifestId,
      manifestFingerprint: manifest.manifestFingerprint,
      releaseCandidateId: manifest.releaseCandidateId,
      logicalReleaseId: manifest.logicalReleaseId,
      sourceCommitSha: manifest.sourceCommitSha,
      artifactFingerprint: manifest.artifactFingerprint,
      targetEnvironment: manifest.targetEnvironment,
      acceptanceResult: manifest.acceptanceResult,
      acceptedBy: manifest.acceptedBy,
      acceptedAt: manifest.acceptedAt,
      evaluatedAt: manifest.evaluatedAt,
      decisionEvidenceRef: manifest.decisionEvidenceRef,
      evidenceRefs,
      readinessRefs,
    },
    evidenceComposition: {
      releaseCandidateId: composition.releaseCandidateId,
      logicalReleaseId: composition.logicalReleaseId,
      sourceCommitSha: composition.sourceCommitSha,
      artifactFingerprint: composition.artifactFingerprint,
      candidateBindingFingerprint: composition.candidateBindingFingerprint,
      targetEnvironment: composition.targetEnvironment,
      acceptanceResult: composition.acceptanceResult,
      compositionFingerprint: composition.compositionFingerprint,
      runtimeGapComponentIds: composition.runtimeGapComponentIds,
      evidenceRefs: compositionEvidenceRefs,
      readinessRefs: compositionReadinessRefs,
    },
    promotionHandoff: handoff === null ? { state: "UNAVAILABLE" as const } : { state: "AVAILABLE" as const, ...handoff },
    authorityProvenance: { acceptedBy: manifest.acceptedBy, acceptanceAuthorityEvidenceRefs, deploymentSodEvidenceRefs },
  });
}

function sameBinding(candidate: Rel001StagingCandidate, manifest: ReleaseAcceptanceManifest, composition: ReleaseEvidenceComposition): boolean {
  return manifest.releaseCandidateId === candidate.releaseCandidateId
    && manifest.logicalReleaseId === candidate.logicalReleaseId
    && manifest.sourceCommitSha === candidate.sourceCommitSha
    && manifest.artifactFingerprint === candidate.artifactFingerprint
    && manifest.targetEnvironment === candidate.targetEnvironment
    && composition.releaseCandidateId === candidate.releaseCandidateId
    && composition.logicalReleaseId === candidate.logicalReleaseId
    && composition.sourceCommitSha === candidate.sourceCommitSha
    && composition.artifactFingerprint === candidate.artifactFingerprint
    && composition.candidateBindingFingerprint === candidate.candidateFingerprint
    && composition.targetEnvironment === candidate.targetEnvironment
    && composition.acceptanceResult === manifest.acceptanceResult;
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
