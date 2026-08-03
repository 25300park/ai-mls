import { PublicationAggregate } from "./publication-aggregate.js";
import { PublicationApplicationError, mapPublicationApplicationError } from "./publication-application-error.js";
import type {
  CreatePublicationApplicationCommand,
  ModifyPublicationApplicationCommand,
  PublicationApplicationCommand,
  PublicationApplicationAuditDetails,
  PublicationApplicationResult,
  PublicationApplicationSuccessResult,
  PublicationAuthorizedPreflight,
  PublicationCommandHandler,
  PublicationExecutionContext,
  PublicationModificationCommand,
} from "./publication-application-contracts.js";
import type { PublicationAuditStore } from "./publication-audit-store.js";
import {
  type PublicationAuthorizationCommandType,
  type PublicationAuthorizationGuard,
} from "./publication-authorization.js";
import type { PublicationClock } from "./publication-clock.js";
import { immutableDomain, type PublicationBinding, type PublicationIdentity, type PublicationSnapshot } from "./publication-contracts.js";
import type { PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { persistenceError } from "./publication-persistence-error.js";
import type { PublicationRepository } from "./publication-repository.js";
import type { PublicationTransaction, PublicationUnitOfWork } from "./publication-unit-of-work.js";

export interface PublicationApplicationDependencies {
  readonly unitOfWork: PublicationUnitOfWork;
  readonly repository: PublicationRepository;
  readonly idempotency: PublicationIdempotencyStore;
  readonly audit: PublicationAuditStore;
  readonly clock: PublicationClock;
  readonly authorization: PublicationAuthorizationGuard;
}

export class CreatePublicationHandler implements PublicationCommandHandler<CreatePublicationApplicationCommand> {
  public constructor(private readonly dependencies: PublicationApplicationDependencies) {}

  public execute(command: CreatePublicationApplicationCommand, context: PublicationExecutionContext): PublicationApplicationResult {
    return this.executeAuthorized(command, context);
  }

  public executeAuthorized(command: CreatePublicationApplicationCommand, context: PublicationExecutionContext, preflight?: PublicationAuthorizedPreflight): PublicationApplicationResult {
    const identity = command.input.identity;
    return executeModificationBoundary(this.dependencies, command, identity, context, (transaction, authorizedCommand) => {
      if (authorizedCommand.kind !== "CREATE_PUBLICATION") throw new Error("APPLICATION_COMMAND_INVALID");
      const aggregate = PublicationAggregate.create(authorizedCommand.input);
      transaction.repository.save(aggregate.snapshot);
      return aggregate.snapshot;
    }, preflight);
  }
}

export class ModifyPublicationHandler implements PublicationCommandHandler<ModifyPublicationApplicationCommand> {
  public constructor(private readonly dependencies: PublicationApplicationDependencies) {}

  public execute(command: ModifyPublicationApplicationCommand, context: PublicationExecutionContext): PublicationApplicationResult {
    return this.executeAuthorized(command, context);
  }

  public executeAuthorized(command: ModifyPublicationApplicationCommand, context: PublicationExecutionContext, preflight?: PublicationAuthorizedPreflight, auditDetails?: PublicationApplicationAuditDetails): PublicationApplicationResult {
    return executeModificationBoundary(this.dependencies, command, command.identity, context, (transaction, authorizedCommand) => {
      if (authorizedCommand.kind !== "MODIFY_PUBLICATION") throw new Error("APPLICATION_COMMAND_INVALID");
      const snapshot = transaction.repository.find(authorizedCommand.identity);
      if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
      const aggregate = PublicationAggregate.rehydrate(snapshot);
      const updated = executeDomainBehaviour(aggregate, authorizedCommand.input).snapshot;
      transaction.repository.update(snapshot.aggregateVersion, updated);
      return updated;
    }, preflight, auditDetails);
  }
}

function executeModificationBoundary(
  dependencies: PublicationApplicationDependencies,
  applicationCommand: PublicationApplicationCommand,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
  executeDomain: (transaction: PublicationTransaction, authorizedCommand: PublicationApplicationCommand) => PublicationSnapshot,
  preflight?: PublicationAuthorizedPreflight,
  auditDetails?: PublicationApplicationAuditDetails,
): PublicationApplicationResult {
  let transaction: PublicationTransaction | undefined;
  let currentVersion = applicationCommand.kind === "MODIFY_PUBLICATION" ? applicationCommand.input.expectedAggregateVersion : 0;
  let committing = false;
  let guardPassed = false;
  let sessionActorResolved = false;
  let auditContext = context;
  let current: PublicationSnapshot | undefined;
  try {
    validateApplicationContext(applicationCommand, context);
    const commandType = authorizationCommandType(applicationCommand);
    const replayKeyExists = applicationCommand.kind === "MODIFY_PUBLICATION"
      && hasRecordedIdempotencyKey(dependencies, identity, context);
    if (replayKeyExists) {
      current = dependencies.repository.find(identity);
      if (current !== undefined) currentVersion = current.aggregateVersion;
    }
    const expectedAggregateVersion = applicationCommand.kind === "CREATE_PUBLICATION"
      ? 0
      : replayKeyExists ? currentVersion : applicationCommand.input.expectedAggregateVersion;
    const authorization = dependencies.authorization.authorize({
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
      commandType,
      actorIdClaim: context.actorId,
      tenantId: identity.tenantScopeId,
      teamId: identity.tenantScopeId,
      purpose: applicationCommand.input.command.authorityContext,
      aggregateId: identity.publicationId,
      expectedAggregateVersion,
      reason: applicationCommand.input.command.reason,
      correlationId: context.correlationId,
      resolveResource: (actor) => {
        auditContext = immutableDomain({ ...context, actorId: actor.principalId });
        sessionActorResolved = true;
        if (applicationCommand.kind === "CREATE_PUBLICATION") {
          return Object.freeze({ binding: applicationCommand.input.binding, currentAggregateVersion: 0 });
        }
        current ??= dependencies.repository.find(identity);
        if (current === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
        currentVersion = current.aggregateVersion;
        return Object.freeze({
          binding: authorizationBinding(applicationCommand, current),
          currentAggregateVersion: current.aggregateVersion,
        });
      },
    });
    guardPassed = true;
    const authorizedContext = immutableDomain({ ...context, actorId: authorization.actor.principalId });
    auditContext = authorizedContext;
    const authorizedCommand = withAuthoritativeActor(applicationCommand, authorization.actor.principalId);
    preflight?.(immutableDomain({
      actorId: authorization.actor.principalId,
      binding: authorizationBinding(authorizedCommand, current),
      currentAggregateVersion: current?.aggregateVersion ?? 0,
    }));
    const replay = findReplay(dependencies, authorizedCommand, identity, authorizedContext);
    if (replay !== undefined) return replay;

    transaction = dependencies.unitOfWork.begin(identity);
    const snapshot = executeDomain(transaction, authorizedCommand);
    currentVersion = snapshot.aggregateVersion;
    const auditTimestamp = dependencies.clock.now();
    transaction.audit.append({
      id: auditId(identity, authorizedContext, commandName(authorizedCommand), authorizedContext.intentFingerprint, "completed"),
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      command: commandName(applicationCommand),
      actorId: authorizedContext.actorId,
      timestamp: auditTimestamp,
      version: snapshot.aggregateVersion,
      result: "COMPLETED",
      ...(auditDetails === undefined ? {} : {
        decision: auditDetails.decision,
        reason: auditDetails.reason,
        correlationId: auditDetails.correlationId,
        checkedAt: auditTimestamp,
        evidenceRefs: auditDetails.evidenceRefs,
      }),
    });
    committing = true;
    transaction.commit();
    committing = false;
    const result = success(identity.publicationId, snapshot.aggregateVersion, false);
    try {
      dependencies.idempotency.record({
        tenantScopeId: identity.tenantScopeId,
        aggregateId: identity.publicationId,
        commandKey: authorizedContext.idempotencyKey,
        fingerprint: authorizedContext.intentFingerprint,
        resultReference: result.resultReference,
        recordedAt: dependencies.clock.now(),
      });
    } catch {
      // The committed audit record is the deterministic replay fallback when the post-commit store is unavailable.
    }
    return result;
  } catch (error) {
    if (transaction !== undefined) {
      try { transaction.rollback(); } catch { /* Commit conflict may already have closed the logical transaction. */ }
      appendFailureAudit(dependencies, applicationCommand, identity, auditContext, currentVersion, error, committing);
    } else if (guardPassed || mapPublicationApplicationError(error, false).error.code === "PUBLICATION_NOT_FOUND") {
      let persistedVersion = currentVersion;
      try { persistedVersion = dependencies.repository.find(identity)?.aggregateVersion ?? currentVersion; } catch { /* Auxiliary evidence lookup cannot replace the original safe error. */ }
      appendFailureAudit(
        dependencies,
        applicationCommand,
        identity,
        guardPassed || sessionActorResolved ? auditContext : immutableDomain({ ...context, actorId: "anonymous" }),
        persistedVersion,
        error,
        false,
      );
    }
    return mapPublicationApplicationError(error, committing);
  }
}

function hasRecordedIdempotencyKey(
  dependencies: PublicationApplicationDependencies,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
): boolean {
  const auditMatch = dependencies.audit.list(identity).some((record) => {
    const evidence = decodeAuditId(record.id);
    return evidence?.tenantScopeId === identity.tenantScopeId
      && evidence.publicationId === identity.publicationId
      && evidence.idempotencyKey === context.idempotencyKey
      && evidence.outcome === "completed";
  });
  if (auditMatch) return true;
  try {
    return dependencies.idempotency.find({
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      commandKey: context.idempotencyKey,
    }) !== undefined;
  } catch {
    return false;
  }
}

function validateApplicationContext(command: PublicationApplicationCommand, context: PublicationExecutionContext): void {
  const values = [context.actorId, context.correlationId, context.idempotencyKey, context.intentFingerprint];
  if (values.some((value) => value.trim().length === 0)) {
    throw new PublicationApplicationError("APPLICATION_CONTEXT_INVALID", "VALIDATION", "Application execution context is invalid.");
  }
  if (command.input.command.correlationId !== context.correlationId) {
    throw new PublicationApplicationError("APPLICATION_CONTEXT_INVALID", "VALIDATION", "Application execution context is invalid.");
  }
}

function authorizationCommandType(command: PublicationApplicationCommand): PublicationAuthorizationCommandType {
  return command.kind === "CREATE_PUBLICATION" ? "CREATE_PUBLICATION" : command.input.type;
}

function authorizationBinding(command: PublicationApplicationCommand, current: PublicationSnapshot | undefined): PublicationBinding {
  if (command.kind === "CREATE_PUBLICATION") return command.input.binding;
  if (command.input.type === "BEGIN_ACTIVE_OPERATION" || command.input.type === "BEGIN_WITHDRAWN_REPUBLISH") {
    return command.input.nextBinding;
  }
  if (current === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
  return current.binding;
}

function withAuthoritativeActor(command: PublicationApplicationCommand, actorId: string): PublicationApplicationCommand {
  return immutableDomain({
    ...command,
    input: {
      ...command.input,
      command: { ...command.input.command, actorId },
    },
  }) as PublicationApplicationCommand;
}

function findReplay(
  dependencies: PublicationApplicationDependencies,
  command: PublicationApplicationCommand,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
): PublicationApplicationSuccessResult | undefined {
  const committedReplay = findAuditReplay(dependencies, command, identity, context);
  if (committedReplay !== undefined) return committedReplay;
  const record = dependencies.idempotency.find({
    tenantScopeId: identity.tenantScopeId,
    aggregateId: identity.publicationId,
    commandKey: context.idempotencyKey,
  });
  if (record === undefined) return undefined;
  if (record.fingerprint !== context.intentFingerprint) {
    throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different intent.");
  }
  const [publicationId, aggregateVersion] = decodeResultReference(record.resultReference);
  return immutableDomain({ ok: true as const, publicationId, aggregateVersion, resultReference: record.resultReference, replayed: true });
}

function findAuditReplay(
  dependencies: PublicationApplicationDependencies,
  command: PublicationApplicationCommand,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
): PublicationApplicationSuccessResult | undefined {
  const matching = dependencies.audit.list(identity).find((record) => {
    const evidence = decodeAuditId(record.id);
    return evidence?.tenantScopeId === identity.tenantScopeId
      && evidence.publicationId === identity.publicationId
      && evidence.idempotencyKey === context.idempotencyKey
      && evidence.outcome === "completed";
  });
  if (matching === undefined) return undefined;
  const evidence = decodeAuditId(matching.id);
  if (evidence === undefined) return undefined;
  if (evidence.command !== commandName(command) || evidence.fingerprint !== context.intentFingerprint) {
    throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different intent.");
  }
  return success(identity.publicationId, matching.version, true);
}

interface ApplicationAuditIdentity {
  readonly tenantScopeId: string;
  readonly publicationId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly command: string;
  readonly fingerprint: string;
  readonly outcome: "completed" | "failed";
}

function decodeAuditId(id: string): ApplicationAuditIdentity | undefined {
  try {
    const value: unknown = JSON.parse(id);
    if (!Array.isArray(value) || value.length !== 7 || value.some((entry) => typeof entry !== "string")) return undefined;
    const [tenantScopeId, publicationId, correlationId, idempotencyKey, command, fingerprint, outcome] = value as [string, string, string, string, string, string, string];
    if (outcome !== "completed" && outcome !== "failed") return undefined;
    return { tenantScopeId, publicationId, correlationId, idempotencyKey, command, fingerprint, outcome };
  } catch {
    return undefined;
  }
}

function decodeResultReference(reference: string): readonly [string, number] {
  try {
    const value: unknown = JSON.parse(reference);
    if (Array.isArray(value) && typeof value[0] === "string" && Number.isSafeInteger(value[1]) && (value[1] as number) > 0) {
      return [value[0], value[1] as number];
    }
  } catch { /* Invalid internal evidence is mapped to a safe application error. */ }
  throw new PublicationApplicationError("APPLICATION_RESULT_REFERENCE_INVALID", "INFRASTRUCTURE", "Stored application result is invalid.");
}

function success(publicationId: string, aggregateVersion: number, replayed: boolean): PublicationApplicationSuccessResult {
  return immutableDomain({
    ok: true as const,
    publicationId,
    aggregateVersion,
    resultReference: JSON.stringify([publicationId, aggregateVersion]),
    replayed,
  });
}

function appendFailureAudit(
  dependencies: PublicationApplicationDependencies,
  command: PublicationApplicationCommand,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
  version: number,
  error: unknown,
  commitFailed: boolean,
): void {
  const mapped = mapPublicationApplicationError(error, commitFailed);
  try {
    dependencies.audit.append({
      id: auditId(identity, context, commandName(command), context.intentFingerprint, "failed"),
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      command: commandName(command),
      actorId: context.actorId,
      timestamp: dependencies.clock.now(),
      version,
      result: "FAILED",
      failureReason: mapped.error.code,
    });
  } catch { /* The original deterministic result remains authoritative if failure evidence cannot be appended. */ }
}

function auditId(identity: PublicationIdentity, context: PublicationExecutionContext, command: string, fingerprint: string, outcome: "completed" | "failed"): string {
  return JSON.stringify([identity.tenantScopeId, identity.publicationId, context.correlationId, context.idempotencyKey, command, fingerprint, outcome]);
}

function commandName(command: PublicationApplicationCommand): string {
  return command.kind === "CREATE_PUBLICATION" ? command.kind : command.input.type;
}

function executeDomainBehaviour(aggregate: PublicationAggregate, command: PublicationModificationCommand): PublicationAggregate {
  switch (command.type) {
    case "BEGIN_INITIAL_EXECUTION": return aggregate.beginInitialExecution(command);
    case "RESOLVE_EXECUTION": return aggregate.resolveExecution(command);
    case "REQUEST_WITHDRAWAL": return aggregate.requestWithdrawal(command);
    case "RESOLVE_WITHDRAWAL": return aggregate.resolveWithdrawal(command);
    case "BEGIN_ACTIVE_OPERATION": return aggregate.beginActiveOperation(command);
    case "BEGIN_WITHDRAWN_REPUBLISH": return aggregate.beginWithdrawnRepublish(command);
    case "RESOLVE_RECONCILIATION": return aggregate.resolveReconciliation(command);
    case "SUPERSEDE": return aggregate.supersede(command);
    case "TERMINATE": return aggregate.terminate(command);
    case "SET_SUSPENSION": return aggregate.setSuspension(command);
  }
}
