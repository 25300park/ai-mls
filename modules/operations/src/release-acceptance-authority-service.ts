import type { Clock } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationDecision, AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import type {
  ReleaseAcceptanceEvidenceRef,
  ReleaseAcceptanceManifest,
  ReleaseAcceptanceManifestInput,
  ReleaseAcceptanceResult,
  ReleaseReadinessRef,
} from "./release-evidence-manifest.js";

export type ReleaseAcceptanceAuthorityErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "REAUTHENTICATION_REQUIRED"
  | "SEPARATION_OF_DUTIES_DENIED"
  | "CANDIDATE_NOT_FOUND"
  | "ACCEPTANCE_EVIDENCE_INVALID"
  | "STALE_ACCEPTANCE_DECISION"
  | "PERSISTENCE_FAILED";

export class ReleaseAcceptanceAuthorityError extends Error {
  public constructor(public readonly code: ReleaseAcceptanceAuthorityErrorCode) {
    super(code);
    this.name = "ReleaseAcceptanceAuthorityError";
  }
}

export interface ReleaseAcceptanceDecisionMaterial {
  readonly candidate: Rel001StagingCandidate;
  readonly tenantId: string;
  readonly teamId: string;
  readonly producerActorId: string;
  readonly producerProvenanceRef: string;
  readonly implementationAuthorActorId: string | null;
  readonly implementationAuthorProvenanceRef: string | null;
  readonly acceptanceResult: ReleaseAcceptanceResult;
  readonly evaluatedAt: string;
  readonly decisionEvidenceRef: string;
  readonly previousManifestId: string | null;
  readonly evidenceRefs: readonly ReleaseAcceptanceEvidenceRef[];
  readonly readinessRefs: readonly ReleaseReadinessRef[];
}

export interface ReleaseAcceptanceDecisionMaterialResolver {
  resolve(releaseCandidateId: string): ReleaseAcceptanceDecisionMaterial | undefined;
}

export interface ReleaseAcceptanceSessionResolver {
  resolve(sessionId: string): SessionContext | undefined;
}

export interface ReleaseAcceptanceManifestFactory {
  create(candidate: Rel001StagingCandidate, input: ReleaseAcceptanceManifestInput): ReleaseAcceptanceManifest;
}

export interface ReleaseAcceptanceManifestStore {
  append(candidate: Rel001StagingCandidate, manifest: ReleaseAcceptanceManifest, createdAt: string): ReleaseAcceptanceManifest;
}

export interface ReleaseAcceptanceAuthorityRequest {
  readonly releaseCandidateId: string;
  readonly sessionId: string;
  readonly reason: string;
  readonly correlationId: string;
  /** Compatibility-only caller claims. They are deliberately non-authoritative. */
  readonly session?: SessionContext;
  readonly acceptedBy?: string;
  readonly producerActorId?: string;
  readonly claimedRole?: string;
  readonly claimedCapability?: string;
}

export interface ReleaseAcceptanceAuthorityServiceDependencies {
  readonly authorizationService: Pick<AuthorizationService, "evaluate">;
  readonly sessionResolver: ReleaseAcceptanceSessionResolver;
  readonly candidateResolver: ReleaseAcceptanceDecisionMaterialResolver;
  readonly manifestFactory: ReleaseAcceptanceManifestFactory;
  readonly manifestStore: ReleaseAcceptanceManifestStore;
  readonly clock: Clock;
}

export class ReleaseAcceptanceAuthorityService {
  readonly #authorizationService: Pick<AuthorizationService, "evaluate">;
  readonly #sessionResolver: ReleaseAcceptanceSessionResolver;
  readonly #candidateResolver: ReleaseAcceptanceDecisionMaterialResolver;
  readonly #manifestFactory: ReleaseAcceptanceManifestFactory;
  readonly #manifestStore: ReleaseAcceptanceManifestStore;
  readonly #clock: Clock;

  public constructor(dependencies: ReleaseAcceptanceAuthorityServiceDependencies) {
    this.#authorizationService = dependencies.authorizationService;
    this.#sessionResolver = dependencies.sessionResolver;
    this.#candidateResolver = dependencies.candidateResolver;
    this.#manifestFactory = dependencies.manifestFactory;
    this.#manifestStore = dependencies.manifestStore;
    this.#clock = dependencies.clock;
  }

  public decide(request: ReleaseAcceptanceAuthorityRequest): ReleaseAcceptanceManifest {
    const initialSession = this.#resolveSession(request.sessionId);
    const initialSessionIdentity = canonicalSessionIdentity(initialSession);
    const initial = this.#resolve(request.releaseCandidateId);
    const initialMaterial = canonicalMaterial(initial);
    this.#assertMaterial(initial, request.releaseCandidateId);
    const initialAuthorization = this.#authorize(request, initial, initialSession);
    this.#assertSeparationOfDuties(initialSession, initial);
    this.#assertAcceptanceEligibility(initial);

    const decisionTime = this.#clock().toISOString();
    const proposed = this.#createManifest(initial, request, initialSession, initialAuthorization, decisionTime);

    const currentSession = this.#resolveSession(request.sessionId);
    const current = this.#resolve(request.releaseCandidateId);
    this.#assertMaterial(current, request.releaseCandidateId);
    if (initialMaterial !== canonicalMaterial(current)) {
      throw failure("STALE_ACCEPTANCE_DECISION");
    }
    const currentAuthorization = this.#authorize(request, current, currentSession);
    this.#assertSameSession(initialSessionIdentity, currentSession);
    this.#assertSameAuthority(initialAuthorization, currentAuthorization);
    this.#assertSeparationOfDuties(currentSession, current);
    this.#assertAcceptanceEligibility(current);
    const revalidated = this.#createManifest(current, request, currentSession, currentAuthorization, decisionTime);
    if (
      revalidated.acceptanceManifestId !== proposed.acceptanceManifestId
      || revalidated.manifestFingerprint !== proposed.manifestFingerprint
    ) {
      throw failure("STALE_ACCEPTANCE_DECISION");
    }

    try {
      return this.#manifestStore.append(current.candidate, revalidated, decisionTime);
    } catch (error) {
      if (error instanceof ReleaseAcceptanceAuthorityError) throw error;
      throw failure("PERSISTENCE_FAILED");
    }
  }

  #resolveSession(sessionId: string): SessionContext {
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) throw failure("AUTHENTICATION_REQUIRED");
    try {
      const session = this.#sessionResolver.resolve(sessionId);
      if (session?.id !== sessionId) throw failure("AUTHENTICATION_REQUIRED");
      return session;
    } catch (error) {
      if (error instanceof ReleaseAcceptanceAuthorityError) throw error;
      throw failure("AUTHENTICATION_REQUIRED");
    }
  }

  #resolve(releaseCandidateId: string): ReleaseAcceptanceDecisionMaterial {
    let material: ReleaseAcceptanceDecisionMaterial | undefined;
    try {
      material = this.#candidateResolver.resolve(releaseCandidateId);
    } catch {
      throw failure("CANDIDATE_NOT_FOUND");
    }
    if (material === undefined) throw failure("CANDIDATE_NOT_FOUND");
    return material;
  }

  #authorize(
    request: ReleaseAcceptanceAuthorityRequest,
    material: ReleaseAcceptanceDecisionMaterial,
    session: SessionContext,
  ): AuthorizationDecision {
    let decision: AuthorizationDecision;
    try {
      decision = this.#authorizationService.evaluate({
        session,
        action: "release.accept",
        resource: {
          type: "ReleaseCandidate",
          id: material.candidate.releaseCandidateId,
          tenantId: material.tenantId,
          teamId: material.teamId,
          createdBy: material.producerActorId,
        },
        purpose: "RELEASE_ACCEPTANCE",
        reason: request.reason,
        requestId: request.correlationId,
        correlationId: request.correlationId,
      });
    } catch {
      throw failure("AUTHORIZATION_DENIED");
    }
    if (decision.effect === "ALLOW") return decision;
    if (decision.reasonCode === "AUTHENTICATION_REQUIRED") throw failure("AUTHENTICATION_REQUIRED");
    if (decision.reasonCode === "REAUTHENTICATION_REQUIRED") throw failure("REAUTHENTICATION_REQUIRED");
    if (decision.reasonCode === "SEPARATION_OF_DUTIES_DENIED") throw failure("SEPARATION_OF_DUTIES_DENIED");
    throw failure("AUTHORIZATION_DENIED");
  }

  #assertMaterial(material: ReleaseAcceptanceDecisionMaterial, requestedId: string): void {
    if (
      material.candidate.releaseCandidateId !== requestedId
      || material.tenantId.trim().length === 0
      || material.teamId.trim().length === 0
      || material.producerActorId.trim().length === 0
      || material.producerProvenanceRef.trim().length === 0
      || (material.implementationAuthorActorId === null) !== (material.implementationAuthorProvenanceRef === null)
    ) {
      throw failure("ACCEPTANCE_EVIDENCE_INVALID");
    }
  }

  #assertSeparationOfDuties(session: SessionContext, material: ReleaseAcceptanceDecisionMaterial): void {
    if (
      session.principalId === material.producerActorId
      || (material.implementationAuthorActorId !== null && session.principalId === material.implementationAuthorActorId)
    ) {
      throw failure("SEPARATION_OF_DUTIES_DENIED");
    }
  }

  #assertAcceptanceEligibility(material: ReleaseAcceptanceDecisionMaterial): void {
    if (material.acceptanceResult !== "ACCEPTED") return;
    const completeScope = material.candidate.releaseScopeCoverage.every((row) =>
      !row.requiredByReleaseScope || (row.executableRuntimeAvailable && row.artifactIncluded && row.gapDisposition === "INCLUDED"));
    const ready = material.readinessRefs.length > 0
      && material.readinessRefs.every((item) => item.readiness === "READY" && item.freshness === "FRESH");
    const independentlyReviewed = material.evidenceRefs.some((item) => item.evidenceType === "INDEPENDENT_REVIEW");
    if (!completeScope || !ready || !independentlyReviewed) throw failure("ACCEPTANCE_EVIDENCE_INVALID");
  }

  #createManifest(
    material: ReleaseAcceptanceDecisionMaterial,
    request: ReleaseAcceptanceAuthorityRequest,
    session: SessionContext,
    authorization: AuthorizationDecision,
    decisionTime: string,
  ): ReleaseAcceptanceManifest {
    const accepted = material.acceptanceResult === "ACCEPTED";
    try {
      return this.#manifestFactory.create(material.candidate, {
        evidenceRefs: appendAuthorityEvidence(material, request, authorization, decisionTime),
        readinessRefs: material.readinessRefs,
        acceptanceResult: material.acceptanceResult,
        acceptedBy: accepted ? session.principalId : null,
        evaluatedAt: material.evaluatedAt,
        acceptedAt: accepted ? decisionTime : null,
        decisionEvidenceRef: material.decisionEvidenceRef,
        previousManifestId: material.previousManifestId,
      });
    } catch {
      throw failure("ACCEPTANCE_EVIDENCE_INVALID");
    }
  }

  #assertSameAuthority(initial: AuthorizationDecision, current: AuthorizationDecision): void {
    if (
      initial.policyVersion !== current.policyVersion
      || canonicalStrings(initial.assignmentIds) !== canonicalStrings(current.assignmentIds)
    ) {
      throw failure("STALE_ACCEPTANCE_DECISION");
    }
  }

  #assertSameSession(initialIdentity: string, current: SessionContext): void {
    if (initialIdentity !== canonicalSessionIdentity(current)) {
      throw failure("STALE_ACCEPTANCE_DECISION");
    }
  }
}

function appendAuthorityEvidence(
  material: ReleaseAcceptanceDecisionMaterial,
  request: ReleaseAcceptanceAuthorityRequest,
  authorization: AuthorizationDecision,
  evaluatedAt: string,
): readonly ReleaseAcceptanceEvidenceRef[] {
  const common = {
    sourceFeatureOrRegistry: "FEAT-024",
    sourceCommitSha: material.candidate.sourceCommitSha,
    candidateBindingFingerprint: material.candidate.candidateFingerprint,
    evaluatedAt,
  } as const;
  const authority = authorization.assignmentIds.map((assignmentId) => ({
    ...common,
    evidenceType: "RELEASE_AUTHORITY",
    evidenceRef: `authority:${assignmentId}`,
    safeResultSummary: "Live release acceptance authority verified",
  }));
  const implementationAuthor = material.implementationAuthorProvenanceRef === null ? [] : [{
    ...common,
    evidenceType: "IMPLEMENTATION_AUTHOR",
    evidenceRef: material.implementationAuthorProvenanceRef,
    safeResultSummary: "Trusted implementation author provenance bound",
  }];
  return Object.freeze([
    ...material.evidenceRefs,
    ...authority,
    ...implementationAuthor,
    {
      ...common,
      evidenceType: "MFA_VERIFICATION",
      evidenceRef: `mfa:${request.correlationId}`,
      safeResultSummary: "MFA assurance verified",
    },
    {
      ...common,
      evidenceType: "CANDIDATE_PRODUCER",
      evidenceRef: material.producerProvenanceRef,
      safeResultSummary: "Trusted candidate producer provenance bound",
    },
    {
      ...common,
      evidenceType: "RELEASE_SOD",
      evidenceRef: `sod:${request.correlationId}`,
      safeResultSummary: material.implementationAuthorActorId === null
        ? "Implementation author SoD NOT_EVALUABLE"
        : "Producer and implementation author SoD passed",
    },
    {
      ...common,
      evidenceType: "DEPLOYMENT_SOD_HANDOFF",
      evidenceRef: `deployment-sod:${request.correlationId}`,
      safeResultSummary: "Acceptance actor retained for later deployment SoD",
    },
  ]);
}

function canonicalMaterial(material: ReleaseAcceptanceDecisionMaterial): string {
  return JSON.stringify(sortValue(material));
}

function canonicalSessionIdentity(session: SessionContext): string {
  return JSON.stringify(sortValue({
    id: session.id,
    principalId: session.principalId,
    principalType: session.principalType,
    roles: session.roles,
    teamId: session.teamId,
    state: session.state,
    assurance: session.assurance,
    isMfaVerified: session.isMfaVerified,
    authenticatedAt: session.authenticatedAt,
    expiresAt: session.expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    familyId: session.familyId,
  }));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}

function canonicalStrings(values: readonly string[]): string {
  return JSON.stringify([...values].sort((left, right) => left.localeCompare(right, "en")));
}

function failure(code: ReleaseAcceptanceAuthorityErrorCode): ReleaseAcceptanceAuthorityError {
  return new ReleaseAcceptanceAuthorityError(code);
}
