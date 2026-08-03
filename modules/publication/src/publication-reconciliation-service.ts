import { PublicationApplicationError, mapPublicationApplicationError } from "./publication-application-error.js";
import type {
  PublicationExecutionContext,
  PublicationReconciliationPort,
  PublicationReconciliationRequest,
  PublicationReconciliationResult,
  PublicationRecoveryDecision,
} from "./publication-application-contracts.js";
import { PUBLICATION_RECOVERY_CATEGORIES } from "./publication-application-contracts.js";
import type { PublicationApplicationService } from "./publication-application-service.js";
import type { PublicationAuditRecord, PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationAuthorizationGuard } from "./publication-authorization.js";
import type { PublicationClock } from "./publication-clock.js";
import {
  immutableDomain,
  RECONCILIATION_RESOLUTIONS,
  type PublicationIdentity,
  type PublicationSnapshot,
  type ReconciliationResolution,
} from "./publication-contracts.js";
import type { PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { persistenceError } from "./publication-persistence-error.js";
import type { PublicationRepository } from "./publication-repository.js";
import { requireEffectivePublicationApproval, type PublicationEffectiveApprovalPort } from "./publication-service.js";
import type { PublicationUnitOfWork } from "./publication-unit-of-work.js";

export interface PublicationReconciliationDependencies {
  readonly application: PublicationApplicationService;
  readonly repository: PublicationRepository;
  readonly authorization: PublicationAuthorizationGuard;
  readonly effectiveApproval: PublicationEffectiveApprovalPort;
  readonly unitOfWork: PublicationUnitOfWork;
  readonly idempotency: PublicationIdempotencyStore;
  readonly audit: PublicationAuditStore;
  readonly clock: PublicationClock;
}

interface AuthorizedRecovery {
  readonly actorId: string;
  readonly snapshot: PublicationSnapshot;
}

export class PublicationReconciliationService implements PublicationReconciliationPort {
  public constructor(private readonly dependencies: PublicationReconciliationDependencies) {}

  public reconcile(request: PublicationReconciliationRequest): PublicationReconciliationResult {
    return this.coordinate(request);
  }

  public recover(request: PublicationReconciliationRequest): PublicationReconciliationResult {
    return this.coordinate(request);
  }

  public execute(request: PublicationReconciliationRequest): PublicationReconciliationResult {
    return this.coordinate(request);
  }

  private coordinate(request: PublicationReconciliationRequest): PublicationReconciliationResult {
    try {
      validateRequest(request);
      const replayCandidate = findRecoveryRecord(this.dependencies, request.identity, request.context);
      const authorized = this.authorizeAndLoad(request, replayCandidate !== undefined);
      const replay = replayResult(this.dependencies, request, authorized.snapshot, replayCandidate);
      if (replay !== undefined) return replay;

      const reconciliation = authorized.snapshot.reconciliationCases.find(({ id }) => id === request.input.caseId);
      if (reconciliation === undefined) throw invalidRecoveryRequest();
      if (reconciliation.status === "RESOLVED") {
        return this.recordDecision(request, authorized, "NO_ACTION_REQUIRED");
      }

      const decision = requestedDecision(request.input.category, request.input.resolution);
      if (decision === "MANUAL_REVIEW_REQUIRED") {
        return this.recordDecision(request, authorized, decision);
      }

      const resolution = request.input.resolution;
      if (resolution === undefined) throw invalidRecoveryRequest();
      const applicationResult = this.dependencies.application.executeAuthorized({
        kind: "MODIFY_PUBLICATION",
        identity: request.identity,
        input: {
          type: "RESOLVE_RECONCILIATION",
          expectedAggregateVersion: request.input.expectedAggregateVersion,
          caseId: request.input.caseId,
          resolution,
          evidenceRefs: request.input.evidenceRefs,
          ...(request.input.externalObjectReference === undefined ? {} : { externalObjectReference: request.input.externalObjectReference }),
          command: request.input.command,
        },
      }, request.context, (execution) => {
        requireEffectivePublicationApproval(
          this.dependencies.effectiveApproval,
          request.identity,
          request.context,
          execution.actorId,
          execution.binding,
        );
      }, {
        decision,
        reason: request.input.command.reason,
        correlationId: request.context.correlationId,
        evidenceRefs: request.input.evidenceRefs,
      });
      if (!applicationResult.ok) return applicationResult;
      return immutableDomain({
        ok: true as const,
        publicationId: applicationResult.publicationId,
        aggregateVersion: applicationResult.aggregateVersion,
        decision,
        resultReference: applicationResult.resultReference,
        replayed: applicationResult.replayed,
      });
    } catch (error) {
      return mapPublicationApplicationError(error, false);
    }
  }

  private authorizeAndLoad(request: PublicationReconciliationRequest, replayCandidate: boolean): AuthorizedRecovery {
    let snapshot = replayCandidate ? this.dependencies.repository.find(request.identity) : undefined;
    const expectedAggregateVersion = snapshot?.aggregateVersion ?? request.input.expectedAggregateVersion;
    const authorization = this.dependencies.authorization.authorize({
      ...(request.context.sessionId === undefined ? {} : { sessionId: request.context.sessionId }),
      commandType: "RESOLVE_RECONCILIATION",
      actorIdClaim: request.context.actorId,
      tenantId: request.identity.tenantScopeId,
      teamId: request.identity.tenantScopeId,
      purpose: request.input.command.authorityContext,
      aggregateId: request.identity.publicationId,
      expectedAggregateVersion,
      reason: request.input.command.reason,
      correlationId: request.context.correlationId,
      resolveResource: () => {
        snapshot ??= this.dependencies.repository.find(request.identity);
        if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
        return Object.freeze({ binding: snapshot.binding, currentAggregateVersion: snapshot.aggregateVersion });
      },
    });
    if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
    requireEffectivePublicationApproval(
      this.dependencies.effectiveApproval,
      request.identity,
      request.context,
      authorization.actor.principalId,
      snapshot.binding,
    );
    return immutableDomain({ actorId: authorization.actor.principalId, snapshot });
  }

  private recordDecision(
    request: PublicationReconciliationRequest,
    authorized: AuthorizedRecovery,
    decision: Extract<PublicationRecoveryDecision, "MANUAL_REVIEW_REQUIRED" | "NO_ACTION_REQUIRED">,
  ): PublicationReconciliationResult {
    const transaction = this.dependencies.unitOfWork.begin(request.identity);
    const checkedAt = this.dependencies.clock.now();
    try {
      const current = transaction.repository.find(request.identity);
      if (current === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
      if (current.aggregateVersion !== authorized.snapshot.aggregateVersion) {
        throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed during recovery coordination.");
      }
      transaction.audit.append(recoveryAudit(request, authorized.actorId, current.aggregateVersion, decision, checkedAt));
      transaction.commit();
      const resultReference = JSON.stringify([request.identity.publicationId, current.aggregateVersion]);
      try {
        this.dependencies.idempotency.record({
          tenantScopeId: request.identity.tenantScopeId,
          aggregateId: request.identity.publicationId,
          commandKey: request.context.idempotencyKey,
          fingerprint: request.context.intentFingerprint,
          resultReference,
          recordedAt: checkedAt,
        });
      } catch {
        // The committed recovery audit is the deterministic replay fallback.
      }
      return immutableDomain({
        ok: true as const,
        publicationId: request.identity.publicationId,
        aggregateVersion: current.aggregateVersion,
        decision,
        resultReference,
        replayed: false,
      });
    } catch (error) {
      try { transaction.rollback(); } catch { /* Commit conflict may already have closed the transaction. */ }
      throw error;
    }
  }
}

function validateRequest(request: PublicationReconciliationRequest): void {
  const { context, input } = request;
  const required = [
    request.identity.publicationId,
    request.identity.tenantScopeId,
    context.actorId,
    context.correlationId,
    context.idempotencyKey,
    context.intentFingerprint,
    input.caseId,
    input.command.authorityContext,
    input.command.reason,
    input.command.correlationId,
    input.command.occurredAt,
  ];
  if (required.some((value) => value.trim().length === 0)
    || !Number.isSafeInteger(input.expectedAggregateVersion)
    || input.expectedAggregateVersion <= 0
    || input.command.correlationId !== context.correlationId
    || !PUBLICATION_RECOVERY_CATEGORIES.includes(input.category)
    || (input.resolution !== undefined && !RECONCILIATION_RESOLUTIONS.includes(input.resolution))
    || input.evidenceRefs.length === 0
    || input.evidenceRefs.some((reference) => reference.trim().length === 0)) {
    throw invalidRecoveryRequest();
  }
  const success = input.resolution === "EFFECT_CONFIRMED" || input.resolution === "WITHDRAWAL_CONFIRMED";
  const noEffect = input.resolution !== undefined && !success;
  if ((input.category === "CONFIRMED_SUCCESS" && !success)
    || (input.category === "CONFIRMED_FAILURE" && !noEffect)
    || ((input.category === "UNKNOWN" || input.category === "EXTERNAL_TIMEOUT" || input.category === "MANUAL_REVIEW_REQUIRED")
      && input.resolution !== undefined)
    || (input.resolution === "EFFECT_CONFIRMED" && (input.externalObjectReference === undefined || input.externalObjectReference.trim().length === 0))) {
    throw invalidRecoveryRequest();
  }
}

function requestedDecision(category: PublicationReconciliationRequest["input"]["category"], resolution: ReconciliationResolution | undefined): PublicationRecoveryDecision {
  if (resolution === undefined) return "MANUAL_REVIEW_REQUIRED";
  if (resolution === "EFFECT_CONFIRMED" || resolution === "WITHDRAWAL_CONFIRMED") return "CONFIRMED";
  if (resolution === "INITIAL_NO_EFFECT") return "REJECTED";
  if (category === "CONFIRMED_FAILURE" || category === "PARTIAL_COMPLETION") return "RECOVERED";
  throw invalidRecoveryRequest();
}

function invalidRecoveryRequest(): PublicationApplicationError {
  return new PublicationApplicationError("RECOVERY_REQUEST_INVALID", "VALIDATION", "Recovery request is invalid.");
}

function recoveryAudit(
  request: PublicationReconciliationRequest,
  actorId: string,
  version: number,
  decision: PublicationRecoveryDecision,
  checkedAt: string,
): PublicationAuditRecord {
  return immutableDomain({
    id: recoveryAuditId(request.identity, request.context, request.context.intentFingerprint, "completed"),
    tenantScopeId: request.identity.tenantScopeId,
    aggregateId: request.identity.publicationId,
    command: "RESOLVE_RECONCILIATION",
    actorId,
    timestamp: checkedAt,
    version,
    result: "COMPLETED" as const,
    decision,
    reason: request.input.command.reason,
    correlationId: request.context.correlationId,
    checkedAt,
    evidenceRefs: request.input.evidenceRefs,
  });
}

function recoveryAuditId(
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
  fingerprint: string,
  outcome: "completed" | "failed",
): string {
  return JSON.stringify([
    identity.tenantScopeId,
    identity.publicationId,
    context.correlationId,
    context.idempotencyKey,
    "RESOLVE_RECONCILIATION",
    fingerprint,
    outcome,
  ]);
}

function findRecoveryRecord(
  dependencies: Pick<PublicationReconciliationDependencies, "audit" | "idempotency">,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
): PublicationAuditRecord | undefined {
  const audit = dependencies.audit.list(identity).find((record) => {
    const decoded = decodeAuditIdentity(record.id);
    return decoded?.idempotencyKey === context.idempotencyKey && decoded.outcome === "completed";
  });
  if (audit !== undefined) return audit;
  try {
    return dependencies.idempotency.find({
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      commandKey: context.idempotencyKey,
    }) === undefined ? undefined : immutableDomain({
      id: "IDEMPOTENCY_RECORD",
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      command: "RESOLVE_RECONCILIATION",
      actorId: "UNAVAILABLE",
      timestamp: "UNAVAILABLE",
      version: 1,
      result: "COMPLETED" as const,
    });
  } catch {
    return undefined;
  }
}

function replayResult(
  dependencies: Pick<PublicationReconciliationDependencies, "audit" | "idempotency">,
  request: PublicationReconciliationRequest,
  snapshot: PublicationSnapshot,
  candidate: PublicationAuditRecord | undefined,
): PublicationReconciliationResult | undefined {
  if (candidate === undefined) return undefined;
  const decoded = candidate.id === "IDEMPOTENCY_RECORD" ? undefined : decodeAuditIdentity(candidate.id);
  if (decoded !== undefined && decoded.command !== "RESOLVE_RECONCILIATION") {
    throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to a different command.");
  }
  let storedFingerprint = decoded?.fingerprint;
  let aggregateVersion = candidate.version;
  if (storedFingerprint === undefined) {
    const record = dependencies.idempotency.find({
      tenantScopeId: request.identity.tenantScopeId,
      aggregateId: request.identity.publicationId,
      commandKey: request.context.idempotencyKey,
    });
    storedFingerprint = record?.fingerprint;
    if (record !== undefined) aggregateVersion = decodeResultReference(record.resultReference)[1];
  }
  if (storedFingerprint !== request.context.intentFingerprint) {
    throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different recovery intent.");
  }
  const decision = candidate.decision === undefined
    ? requestedDecision(request.input.category, request.input.resolution)
    : candidate.decision as PublicationRecoveryDecision;
  return immutableDomain({
    ok: true as const,
    publicationId: request.identity.publicationId,
    aggregateVersion,
    decision,
    resultReference: JSON.stringify([request.identity.publicationId, aggregateVersion]),
    replayed: true,
  });
}

function decodeResultReference(reference: string): readonly [string, number] {
  try {
    const value: unknown = JSON.parse(reference);
    if (Array.isArray(value) && typeof value[0] === "string" && Number.isSafeInteger(value[1]) && (value[1] as number) > 0) {
      return [value[0], value[1] as number];
    }
  } catch { /* Invalid internal evidence is mapped to a safe application error. */ }
  throw new PublicationApplicationError("APPLICATION_RESULT_REFERENCE_INVALID", "INFRASTRUCTURE", "Stored recovery result is invalid.");
}

interface DecodedAuditIdentity {
  readonly idempotencyKey: string;
  readonly command: string;
  readonly fingerprint: string;
  readonly outcome: "completed" | "failed";
}

function decodeAuditIdentity(id: string): DecodedAuditIdentity | undefined {
  try {
    const value: unknown = JSON.parse(id);
    if (!Array.isArray(value) || value.length !== 7 || value.some((entry) => typeof entry !== "string")) return undefined;
    const [, , , idempotencyKey, command, fingerprint, outcome] = value as readonly string[];
    if (outcome !== "completed" && outcome !== "failed") return undefined;
    return { idempotencyKey: idempotencyKey!, command: command!, fingerprint: fingerprint!, outcome };
  } catch {
    return undefined;
  }
}
