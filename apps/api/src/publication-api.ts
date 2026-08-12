import type { AuthorizationDecision } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type {
  PublicationApplicationErrorResult,
  PublicationApplicationResult,
  PublicationCoordinationResult,
  PublicationExecutionContext,
  PublicationLifecycleCoordinationRequest,
  PublicationReconciliationResult,
} from "../../../modules/publication/src/publication-application-contracts.js";
import type { PublicationLiveAuthorizationContext } from "../../../modules/publication/src/publication-authorization.js";
import type { DomainCommandContext, PublicationBinding, PublicationIdentity, PublicationSnapshot } from "../../../modules/publication/src/publication-contracts.js";
import type { PublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import type { ListingProjectionView } from "../../../modules/publication/src/listing-projection-contracts.js";
import {
  PUBLICATION_API_COMMAND_OPERATIONS,
  PUBLICATION_API_QUERY_OPERATIONS,
  immutableApiValue,
  type PublicationApiCommandOperation,
  type PublicationApiCommandResult,
  type PublicationApiQueryOperation,
  type PublicationCommandRequest,
  type PublicationCommandResponse,
  type PublicationQueryRequest,
  type PublicationQueryResponse,
} from "./publication-api-contracts.js";
import {
  PublicationApiError,
  mapPublicationApiError,
  mapPublicationApplicationFailure,
  safePublicationApiMessage,
} from "./publication-api-error-mapper.js";
import {
  createCanonicalPublicationView,
  createPublicationAuditHistoryView,
  createPublicationOperationsView,
  createPublicationRecoveryView,
  createPublicationRevalidationView,
  type PublicationViewContract,
  type PublicationViewDependencies,
} from "./publication-view-contracts.js";

type PlainRecord = Readonly<Record<string, unknown>>;

const commandRootKeys = Object.freeze([
  "requestId", "sessionId", "operation", "tenantId", "teamId", "purpose", "correlationId",
  "publicationId", "idempotencyKey", "intentFingerprint", "documentedReason", "actorId", "payload",
]);
const queryRootKeys = Object.freeze([
  "requestId", "sessionId", "operation", "tenantId", "teamId", "purpose", "correlationId", "publicationId", "maxEntries",
]);
const bindingKeys = Object.freeze([
  "subjectId", "subjectRevision", "representationId", "representationVersion", "representationChecksum",
  "approvalId", "approvalVersion", "targetId", "targetVersion", "channelId", "channelPolicyVersion",
]);
const attemptKeys = Object.freeze(["id", "commandId", "operation", "occurredAt", "evidenceRefs"]);
const inputKeys: Readonly<Record<PublicationApiCommandOperation, readonly string[]>> = Object.freeze({
  CREATE_PUBLICATION: ["binding", "prerequisites", "classification", "occurredAt", "predecessorPublicationId"],
  PUBLISH_PUBLICATION: ["expectedAggregateVersion", "attempt", "occurredAt"],
  CORRECT_PUBLICATION: ["input", "occurredAt"],
  SUSPEND_PUBLICATION: ["input", "occurredAt"],
  RESUME_PUBLICATION: ["input", "occurredAt"],
  REQUEST_WITHDRAWAL: ["input", "occurredAt"],
  RESOLVE_WITHDRAWAL: ["input", "occurredAt"],
  REPUBLISH_PUBLICATION: ["input", "occurredAt"],
  RESOLVE_RECONCILIATION: ["input", "occurredAt"],
  RECOVER_PUBLICATION: ["input", "occurredAt"],
  SUPERSEDE_PUBLICATION: ["input", "occurredAt"],
  TERMINATE_PUBLICATION: ["input", "occurredAt"],
});

export class PublicationApiCommandService {
  public constructor(private readonly infrastructure: PublicationInfrastructure) {}

  public execute(input: unknown): PublicationCommandResponse {
    const metadata = safeMetadata(input);
    try {
      const request = validateCommandRequest(input);
      const result = this.dispatch(request);
      if (!result.ok) return commandFailure(request, mapPublicationApplicationFailure(result));
      const snapshot = this.infrastructure.repository.find(identityOf(request));
      if (snapshot === undefined) return commandFailure(request, "INTERNAL_API_ERROR");
      return immutableApiValue({
        requestId: request.requestId,
        success: true as const,
        operation: request.operation,
        result: commandResult(result, snapshot),
        metadata: { correlationId: request.correlationId },
      });
    } catch (error) {
      return commandException(metadata, mapPublicationApiError(error));
    }
  }

  private dispatch(request: PublicationCommandRequest): PublicationApplicationResult | PublicationCoordinationResult | PublicationReconciliationResult {
    const context = executionContext(request);
    const identity = identityOf(request);
    const payload = request.payload;
    const command = domainContext(request, requireString(payload["occurredAt"]));
    switch (request.operation) {
      case "CREATE_PUBLICATION":
        return this.infrastructure.coordination.create({
          context,
          command: {
            kind: "CREATE_PUBLICATION",
            input: {
              identity,
              binding: payload["binding"] as PublicationBinding,
              prerequisites: payload["prerequisites"] as never,
              classification: payload["classification"] as never,
              command,
              ...(payload["predecessorPublicationId"] === undefined ? {} : { predecessorPublicationId: requireString(payload["predecessorPublicationId"]) }),
            },
          },
        });
      case "PUBLISH_PUBLICATION":
        return this.infrastructure.coordination.publish({
          context,
          identity,
          command,
          attempt: payload["attempt"] as never,
          expectedAggregateVersion: requirePositiveVersion(payload["expectedAggregateVersion"]),
        });
      case "CORRECT_PUBLICATION": return this.infrastructure.lifecycle.correctPublication(lifecycleRequest(request, "CORRECT", context, command) as never);
      case "SUSPEND_PUBLICATION": return this.infrastructure.lifecycle.suspendPublication(lifecycleRequest(request, "SUSPEND", context, command) as never);
      case "RESUME_PUBLICATION": return this.infrastructure.lifecycle.resumePublication(lifecycleRequest(request, "RESUME", context, command) as never);
      case "REQUEST_WITHDRAWAL": return this.infrastructure.lifecycle.requestWithdrawal(lifecycleRequest(request, "REQUEST_WITHDRAWAL", context, command) as never);
      case "RESOLVE_WITHDRAWAL": return this.infrastructure.lifecycle.resolveWithdrawal(lifecycleRequest(request, "RESOLVE_WITHDRAWAL", context, command) as never);
      case "REPUBLISH_PUBLICATION": return this.infrastructure.lifecycle.republishPublication(lifecycleRequest(request, "REPUBLISH", context, command) as never);
      case "SUPERSEDE_PUBLICATION": return this.infrastructure.lifecycle.supersedePublication(lifecycleRequest(request, "SUPERSEDE", context, command) as never);
      case "TERMINATE_PUBLICATION": return this.infrastructure.lifecycle.terminatePublication(lifecycleRequest(request, "TERMINATE", context, command) as never);
      case "RESOLVE_RECONCILIATION":
      case "RECOVER_PUBLICATION": {
        const reconciliationRequest = {
          context,
          identity,
          input: { ...(payload["input"] as PlainRecord), command },
        } as never;
        return request.operation === "RESOLVE_RECONCILIATION"
          ? this.infrastructure.reconciliation.reconcile(reconciliationRequest)
          : this.infrastructure.reconciliation.recover(reconciliationRequest);
      }
    }
  }
}

export class PublicationApiQueryService {
  public constructor(private readonly infrastructure: PublicationInfrastructure) {}

  public execute(input: unknown): PublicationQueryResponse {
    const metadata = safeMetadata(input);
    try {
      const request = validateQueryRequest(input);
      const session = this.resolveSession(request);
      const identity = identityOf(request);
      this.authorizeRead(request, session, undefined);
      if (request.operation === "GET_LISTING_PROJECTION") {
        const view = this.infrastructure.listingProjectionRead.getServing({
          tenantId: request.tenantId,
          publicationId: request.publicationId,
        });
        if (view === undefined) throw new PublicationApiError("NOT_FOUND");
        this.authorizeRead(request, session, undefined, view.sourceAggregateVersion, view);
        return immutableApiValue({
          requestId: request.requestId,
          success: true as const,
          operation: request.operation,
          result: {
            view,
            sourceVersion: view.sourceAggregateVersion,
            generatedAt: this.infrastructure.clock.now(),
            stale: view.stale,
            provenance: { source: "LISTING_PROJECTION" as const },
          },
          metadata: { correlationId: request.correlationId },
        });
      }
      const snapshot = this.infrastructure.repository.find(identity);
      if (snapshot === undefined) throw new PublicationApiError("NOT_FOUND");
      this.authorizeRead(request, session, snapshot);
      const live = this.resolveLive(snapshot, request);
      const maxEntries = request.maxEntries ?? 50;
      const dependencies: PublicationViewDependencies = {
        snapshot,
        session,
        live,
        audit: this.infrastructure.audit.list(identity),
        authorizationDecisions: this.infrastructure.authorizationEvidence.list(snapshot.publicationId),
        authorizeAction: (action) => this.evaluate(session, request, snapshot, action),
        maxEntries,
        expectedPolicyVersion: this.infrastructure.configuration.publicationPolicyVersion ?? "UNAVAILABLE",
        canViewAuditActor: request.operation === "GET_PUBLICATION_AUDIT_VIEW",
      };
      const view = this.view(request.operation, dependencies);
      const stale = "stale" in view ? view.stale : live === undefined;
      return immutableApiValue({
        requestId: request.requestId,
        success: true as const,
        operation: request.operation,
        result: {
          view,
          sourceVersion: snapshot.aggregateVersion,
          generatedAt: this.infrastructure.clock.now(),
          stale,
          provenance: {
            source: "CANONICAL_PUBLICATION" as const,
            ...(request.operation === "GET_PUBLICATION_AUDIT_VIEW" ? { historyKind: "PUBLICATION_AUDIT_HISTORY" as const } : {}),
          },
        },
        metadata: { correlationId: request.correlationId },
      });
    } catch (error) {
      const mapped = mapPublicationApiError(error);
      return queryException(metadata, concealReadError(mapped));
    }
  }

  private resolveSession(request: PublicationQueryRequest): SessionContext {
    const resolver = this.infrastructure.configuration.sessionResolver;
    if (request.sessionId === undefined || request.sessionId.trim().length === 0 || resolver === undefined) {
      throw new PublicationApiError("AUTHENTICATION_REQUIRED");
    }
    let session: SessionContext | undefined;
    try { session = resolver.resolve(request.sessionId); } catch { session = undefined; }
    if (session === undefined || !activeSession(session, request.sessionId, this.infrastructure.clock.now())) {
      throw new PublicationApiError("AUTHENTICATION_REQUIRED");
    }
    return session;
  }

  private authorizeRead(
    request: PublicationQueryRequest,
    session: SessionContext,
    snapshot: PublicationSnapshot | undefined,
    resourceVersion?: number,
    projection?: ListingProjectionView,
  ): void {
    if (request.purpose !== "PUBLICATION_EXECUTION" || session.teamId === undefined
      || request.teamId !== session.teamId || request.tenantId !== session.teamId) {
      throw new PublicationApiError("NOT_FOUND");
    }
    const decision = this.evaluate(session, request, snapshot, readAction(request.operation), resourceVersion, projection);
    if (decision.effect !== "ALLOW") throw new PublicationApiError("NOT_FOUND");
  }

  private evaluate(
    session: SessionContext,
    request: PublicationQueryRequest,
    snapshot: PublicationSnapshot | undefined,
    action: string,
    resourceVersion?: number,
    projection?: ListingProjectionView,
  ): AuthorizationDecision {
    const evaluator = this.infrastructure.configuration.authorizationEvaluator;
    if (evaluator === undefined) throw new PublicationApiError("NOT_FOUND");
    const version = resourceVersion ?? snapshot?.aggregateVersion;
    try {
      return evaluator.evaluate({
        session,
        action,
        resource: {
          type: projection === undefined ? "Publication" : "ListingProjection",
          id: request.publicationId,
          ...(version === undefined ? {} : { version }),
          teamId: request.teamId,
          ...(projection === undefined ? {} : {
            classification: projection.sourceClassification,
            privacyScope: projection.privacyScope,
            purpose: projection.purpose,
            consentOrLegalBasis: projection.consentOrLegalBasis,
            audienceRestriction: projection.audienceRestriction,
          }),
        },
        purpose: request.purpose,
        reason: "API-014 bounded view eligibility evaluation",
        requestId: request.requestId,
        correlationId: request.correlationId,
      });
    } catch {
      throw new PublicationApiError("NOT_FOUND");
    }
  }

  private resolveLive(snapshot: PublicationSnapshot, request: PublicationQueryRequest): PublicationLiveAuthorizationContext | undefined {
    try {
      return this.infrastructure.configuration.liveContextResolver?.resolve(snapshot.binding, {
        tenantId: request.tenantId,
        teamId: request.teamId,
      });
    } catch {
      return undefined;
    }
  }

  private view(operation: PublicationApiQueryOperation, dependencies: PublicationViewDependencies): PublicationViewContract {
    switch (operation) {
      case "GET_PUBLICATION": return createCanonicalPublicationView(dependencies);
      case "GET_PUBLICATION_OPERATIONS_VIEW": return createPublicationOperationsView(dependencies);
      case "GET_PUBLICATION_REVALIDATION_VIEW": return createPublicationRevalidationView(dependencies);
      case "GET_PUBLICATION_RECOVERY_VIEW": return createPublicationRecoveryView(dependencies);
      case "GET_PUBLICATION_AUDIT_VIEW": return createPublicationAuditHistoryView(dependencies);
      case "GET_LISTING_PROJECTION": throw new PublicationApiError("INTERNAL_API_ERROR");
    }
  }
}

export class PublicationApi {
  public readonly commands: PublicationApiCommandService;
  public readonly queries: PublicationApiQueryService;

  public constructor(infrastructure: PublicationInfrastructure) {
    assertInfrastructure(infrastructure);
    this.commands = new PublicationApiCommandService(infrastructure);
    this.queries = new PublicationApiQueryService(infrastructure);
    Object.freeze(this);
  }

  public executeCommand(input: unknown): PublicationCommandResponse {
    return this.commands.execute(input);
  }

  public executeQuery(input: unknown): PublicationQueryResponse {
    return this.queries.execute(input);
  }
}

function assertInfrastructure(infrastructure: PublicationInfrastructure): void {
  const required = [
    infrastructure.configuration,
    infrastructure.authorization,
    infrastructure.coordination,
    infrastructure.lifecycle,
    infrastructure.reconciliation,
    infrastructure.repository,
    infrastructure.audit,
    infrastructure.idempotency,
    infrastructure.listingProjectionRead,
  ];
  if (required.some((dependency) => dependency === undefined)) throw new TypeError("Publication API dependencies are incomplete.");
}

function validateCommandRequest(input: unknown): PublicationCommandRequest {
  assertSafeJson(input);
  const request = requireRecord(immutableApiValue(input));
  assertExactKeys(request, commandRootKeys);
  const operation = request["operation"];
  if (typeof operation !== "string" || !PUBLICATION_API_COMMAND_OPERATIONS.includes(operation as PublicationApiCommandOperation)) {
    throw new PublicationApiError("VALIDATION_ERROR");
  }
  requireCommon(request);
  requireString(request["idempotencyKey"]);
  requireString(request["intentFingerprint"]);
  if (typeof request["documentedReason"] !== "string" || request["documentedReason"].trim().length === 0) {
    throw new PublicationApiError("REASON_REQUIRED");
  }
  const payload = requireRecord(request["payload"]);
  assertExactKeys(payload, inputKeys[operation as PublicationApiCommandOperation]);
  validatePayload(operation as PublicationApiCommandOperation, payload);
  return request as unknown as PublicationCommandRequest;
}

function validateQueryRequest(input: unknown): PublicationQueryRequest {
  assertSafeJson(input);
  const request = requireRecord(immutableApiValue(input));
  if (["classification", "privacyScope", "consentOrLegalBasis", "audienceRestriction"].some((key) => Object.hasOwn(request, key))) {
    throw new PublicationApiError("NOT_FOUND");
  }
  assertExactKeys(request, queryRootKeys);
  const operation = request["operation"];
  if (typeof operation !== "string" || !PUBLICATION_API_QUERY_OPERATIONS.includes(operation as PublicationApiQueryOperation)) {
    throw new PublicationApiError("VALIDATION_ERROR");
  }
  requireCommon(request);
  if (request["maxEntries"] !== undefined && (!Number.isSafeInteger(request["maxEntries"]) || (request["maxEntries"] as number) < 1 || (request["maxEntries"] as number) > 100)) {
    throw new PublicationApiError("VALIDATION_ERROR");
  }
  return request as unknown as PublicationQueryRequest;
}

function requireCommon(request: PlainRecord): void {
  for (const key of ["requestId", "tenantId", "teamId", "purpose", "correlationId", "publicationId"] as const) requireString(request[key]);
  if (request["purpose"] !== "PUBLICATION_EXECUTION") {
    // Wrong-purpose queries are concealed later; commands are safely denied by the guard.
  }
  if (request["sessionId"] !== undefined && typeof request["sessionId"] !== "string") throw new PublicationApiError("VALIDATION_ERROR");
}

function validatePayload(operation: PublicationApiCommandOperation, payload: PlainRecord): void {
  requireString(payload["occurredAt"]);
  if (operation === "CREATE_PUBLICATION") {
    assertExactKeys(requireRecord(payload["binding"]), bindingKeys);
    assertExactKeys(requireRecord(payload["prerequisites"]), ["immutableSnapshot", "exactTargetChannel", "provenancePresent"]);
    requireString(payload["classification"]);
    return;
  }
  if (operation === "PUBLISH_PUBLICATION") {
    requirePositiveVersion(payload["expectedAggregateVersion"]);
    validateAttempt(requireRecord(payload["attempt"]));
    return;
  }
  const commandInput = requireRecord(payload["input"]);
  if (
    (operation === "RESOLVE_RECONCILIATION" || operation === "RECOVER_PUBLICATION")
    && commandInput["resolution"] !== undefined
  ) {
    // Reconciliation outcomes are authoritative facts. API callers may not
    // manufacture the outcome or its evidence; trusted internal coordination
    // must resolve those values from durable evidence.
    throw new PublicationApiError("VALIDATION_ERROR");
  }
  const commandType = operation === "RESOLVE_RECONCILIATION" || operation === "RECOVER_PUBLICATION"
    ? "RECONCILIATION_INPUT"
    : requireString(commandInput["type"]);
  assertOperationCommandMatch(operation, commandType, commandInput);
  const allowed = operationInputKeys(operation, commandType);
  assertExactKeys(commandInput, allowed);
  requirePositiveVersion(commandInput["expectedAggregateVersion"]);
  if (commandInput["attempt"] !== undefined) validateAttempt(requireRecord(commandInput["attempt"]));
  if (commandInput["nextBinding"] !== undefined) assertExactKeys(requireRecord(commandInput["nextBinding"]), bindingKeys);
}

function assertOperationCommandMatch(operation: PublicationApiCommandOperation, commandType: string, input: PlainRecord): void {
  const matches = operation === "CORRECT_PUBLICATION"
    ? commandType === "BEGIN_ACTIVE_OPERATION" && input["operation"] === "CORRECTION"
    : operation === "SUSPEND_PUBLICATION"
      ? commandType === "SET_SUSPENSION" && input["suspensionStatus"] !== "NOT_SUSPENDED"
      : operation === "RESUME_PUBLICATION"
        ? commandType === "SET_SUSPENSION" && input["suspensionStatus"] === "NOT_SUSPENDED"
        : operation === "REQUEST_WITHDRAWAL"
          ? commandType === "REQUEST_WITHDRAWAL"
          : operation === "RESOLVE_WITHDRAWAL"
            ? commandType === "RESOLVE_WITHDRAWAL"
            : operation === "REPUBLISH_PUBLICATION"
              ? (commandType === "BEGIN_WITHDRAWN_REPUBLISH" || (commandType === "BEGIN_ACTIVE_OPERATION" && input["operation"] === "REPUBLISH"))
              : operation === "SUPERSEDE_PUBLICATION"
                ? commandType === "SUPERSEDE"
                : operation === "TERMINATE_PUBLICATION"
                  ? commandType === "TERMINATE"
                  : operation === "RESOLVE_RECONCILIATION" || operation === "RECOVER_PUBLICATION"
                    ? commandType === "RECONCILIATION_INPUT"
                    : true;
  if (!matches) throw new PublicationApiError("VALIDATION_ERROR");
}

function operationInputKeys(operation: PublicationApiCommandOperation, type: string): readonly string[] {
  if (operation === "CORRECT_PUBLICATION") return ["type", "expectedAggregateVersion", "operation", "materiality", "nextBinding", "attempt"];
  if (operation === "SUSPEND_PUBLICATION" || operation === "RESUME_PUBLICATION") return ["type", "expectedAggregateVersion", "suspensionStatus"];
  if (operation === "REQUEST_WITHDRAWAL") return ["type", "expectedAggregateVersion", "attempt"];
  if (operation === "RESOLVE_WITHDRAWAL") return ["type", "expectedAggregateVersion", "outcome", "evidenceRefs", "reconciliationCaseId"];
  if (operation === "REPUBLISH_PUBLICATION") return type === "BEGIN_ACTIVE_OPERATION"
    ? ["type", "expectedAggregateVersion", "operation", "materiality", "nextBinding", "attempt"]
    : ["type", "expectedAggregateVersion", "nextBinding", "attempt"];
  if (operation === "SUPERSEDE_PUBLICATION") return ["type", "expectedAggregateVersion", "successorPublicationId", "evidenceRefs"];
  if (operation === "TERMINATE_PUBLICATION") return ["type", "expectedAggregateVersion"];
  if (operation === "RESOLVE_RECONCILIATION" || operation === "RECOVER_PUBLICATION") {
    return ["expectedAggregateVersion", "caseId", "category", "resolution", "evidenceRefs", "externalObjectReference"];
  }
  throw new PublicationApiError("VALIDATION_ERROR");
}

function validateAttempt(attempt: PlainRecord): void {
  assertExactKeys(attempt, attemptKeys);
  for (const key of ["id", "commandId", "operation", "occurredAt"] as const) requireString(attempt[key]);
  if (!Array.isArray(attempt["evidenceRefs"])) throw new PublicationApiError("VALIDATION_ERROR");
}

function lifecycleRequest(
  request: PublicationCommandRequest,
  action: PublicationLifecycleCoordinationRequest["action"],
  context: PublicationExecutionContext,
  command: ReturnType<typeof domainContext>,
): PublicationLifecycleCoordinationRequest {
  return {
    operation: "COORDINATE_PUBLICATION_LIFECYCLE",
    action,
    context,
    identity: identityOf(request),
    input: { ...(request.payload["input"] as PlainRecord), command },
  } as unknown as PublicationLifecycleCoordinationRequest;
}

function executionContext(request: PublicationCommandRequest): PublicationExecutionContext {
  return immutableApiValue({
    actorId: "NON_AUTHORITATIVE_REQUEST_ACTOR_IGNORED",
    ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    intentFingerprint: request.intentFingerprint,
  });
}

function domainContext(request: PublicationCommandRequest, occurredAt: string): DomainCommandContext {
  return immutableApiValue({
    actorId: "NON_AUTHORITATIVE_REQUEST_ACTOR_IGNORED",
    authorityContext: "PUBLICATION_EXECUTION",
    reason: request.documentedReason,
    correlationId: request.correlationId,
    occurredAt,
  });
}

function identityOf(request: Pick<PublicationCommandRequest | PublicationQueryRequest, "publicationId" | "tenantId">): PublicationIdentity {
  return Object.freeze({ publicationId: request.publicationId, tenantScopeId: request.tenantId });
}

function commandResult(result: Exclude<PublicationApplicationResult | PublicationCoordinationResult | PublicationReconciliationResult, PublicationApplicationErrorResult>, snapshot: PublicationSnapshot): PublicationApiCommandResult {
  return immutableApiValue({
    publicationId: result.publicationId,
    lifecycle: snapshot.lifecycleState,
    suspensionStatus: snapshot.suspensionStatus,
    aggregateVersion: result.aggregateVersion,
    ...(snapshot.effectiveVersion === undefined ? {} : { effectiveVersion: snapshot.effectiveVersion }),
    ...(snapshot.attempts.at(-1) === undefined ? {} : { attemptId: snapshot.attempts.at(-1)!.id }),
    ...(result !== undefined && "decision" in result ? { reconciliationStatus: result.decision } : {}),
    replayed: result.replayed,
  });
}

function commandFailure(request: PublicationCommandRequest, code: Parameters<typeof safePublicationApiMessage>[0]): PublicationCommandResponse {
  return immutableApiValue({
    requestId: request.requestId,
    success: false as const,
    operation: request.operation,
    error: { code, message: safePublicationApiMessage(code) },
    metadata: { correlationId: request.correlationId },
  });
}

function commandException(
  metadata: Readonly<{ readonly requestId?: string; readonly correlationId: string }>,
  code: Parameters<typeof safePublicationApiMessage>[0],
): PublicationCommandResponse {
  return immutableApiValue({
    ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
    success: false as const,
    error: { code, message: safePublicationApiMessage(code) },
    metadata: { correlationId: metadata.correlationId },
  });
}

function queryException(
  metadata: Readonly<{ readonly requestId?: string; readonly correlationId: string }>,
  code: Parameters<typeof safePublicationApiMessage>[0],
): PublicationQueryResponse {
  return immutableApiValue({
    ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
    success: false as const,
    error: { code, message: safePublicationApiMessage(code) },
    metadata: { correlationId: metadata.correlationId },
  });
}

function safeMetadata(input: unknown): Readonly<{ readonly requestId?: string; readonly correlationId: string }> {
  if (input === null || typeof input !== "object") return { correlationId: "UNAVAILABLE" };
  const requestId = safeOwnString(input, "requestId");
  const correlationId = safeOwnString(input, "correlationId") ?? "UNAVAILABLE";
  return { ...(requestId === undefined ? {} : { requestId }), correlationId };
}

function safeOwnString(value: object, key: string): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : undefined;
}

function assertSafeJson(value: unknown, ancestors: WeakSet<object> = new WeakSet<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || ancestors.has(value)) throw new PublicationApiError("VALIDATION_ERROR");
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new PublicationApiError("VALIDATION_ERROR");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) throw new PublicationApiError("VALIDATION_ERROR");
  if (Array.isArray(value) && Object.keys(value).length !== value.length) throw new PublicationApiError("VALIDATION_ERROR");
  if (Object.hasOwn(value, "__proto__") || Object.hasOwn(value, "prototype") || Object.hasOwn(value, "constructor")) throw new PublicationApiError("VALIDATION_ERROR");
  ancestors.add(value);
  for (const descriptor of Object.values(descriptors)) if ("value" in descriptor) assertSafeJson(descriptor.value, ancestors);
  ancestors.delete(value);
}

function assertExactKeys(record: PlainRecord, allowedKeys: readonly string[]): void {
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) throw new PublicationApiError("VALIDATION_ERROR");
}

function requireRecord(value: unknown): PlainRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new PublicationApiError("VALIDATION_ERROR");
  return value as PlainRecord;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new PublicationApiError("VALIDATION_ERROR");
  return value;
}

function requirePositiveVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new PublicationApiError("VALIDATION_ERROR");
  return value as number;
}

function activeSession(session: SessionContext, requestedSessionId: string, checkedAt: string): boolean {
  const now = Date.parse(checkedAt);
  return session.id === requestedSessionId
    && session.state === "ACTIVE"
    && Number.isFinite(now)
    && now < Date.parse(session.expiresAt)
    && now < Date.parse(session.absoluteExpiresAt);
}

function readAction(operation: PublicationApiQueryOperation): string {
  return operation === "GET_PUBLICATION_AUDIT_VIEW" ? "audit.query" : "resource.view";
}

function concealReadError(code: Parameters<typeof safePublicationApiMessage>[0]): Parameters<typeof safePublicationApiMessage>[0] {
  return code === "AUTHENTICATION_REQUIRED" || code === "VALIDATION_ERROR" || code === "INTERNAL_API_ERROR" ? code : "NOT_FOUND";
}

export type { PublicationCommandRequest, PublicationQueryRequest } from "./publication-api-contracts.js";
