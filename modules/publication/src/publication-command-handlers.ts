import { PublicationAggregate } from "./publication-aggregate.js";
import { PublicationApplicationError, mapPublicationApplicationError } from "./publication-application-error.js";
import type {
  CreatePublicationApplicationCommand,
  ModifyPublicationApplicationCommand,
  PublicationApplicationCommand,
  PublicationApplicationResult,
  PublicationApplicationSuccessResult,
  PublicationCommandHandler,
  PublicationExecutionContext,
  PublicationModificationCommand,
} from "./publication-application-contracts.js";
import type { PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationClock } from "./publication-clock.js";
import { immutableDomain, type PublicationIdentity, type PublicationSnapshot } from "./publication-contracts.js";
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
}

export class CreatePublicationHandler implements PublicationCommandHandler<CreatePublicationApplicationCommand> {
  public constructor(private readonly dependencies: PublicationApplicationDependencies) {}

  public execute(command: CreatePublicationApplicationCommand, context: PublicationExecutionContext): PublicationApplicationResult {
    const identity = command.input.identity;
    return executeModificationBoundary(this.dependencies, command, identity, context, (transaction) => {
      const aggregate = PublicationAggregate.create(command.input);
      transaction.repository.save(aggregate.snapshot);
      return aggregate.snapshot;
    });
  }
}

export class ModifyPublicationHandler implements PublicationCommandHandler<ModifyPublicationApplicationCommand> {
  public constructor(private readonly dependencies: PublicationApplicationDependencies) {}

  public execute(command: ModifyPublicationApplicationCommand, context: PublicationExecutionContext): PublicationApplicationResult {
    return executeModificationBoundary(this.dependencies, command, command.identity, context, (transaction) => {
      const snapshot = transaction.repository.find(command.identity);
      if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
      const aggregate = PublicationAggregate.rehydrate(snapshot);
      const updated = executeDomainBehaviour(aggregate, command.input).snapshot;
      transaction.repository.update(snapshot.aggregateVersion, updated);
      return updated;
    });
  }
}

function executeModificationBoundary(
  dependencies: PublicationApplicationDependencies,
  applicationCommand: PublicationApplicationCommand,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
  executeDomain: (transaction: PublicationTransaction) => PublicationSnapshot,
): PublicationApplicationResult {
  let transaction: PublicationTransaction | undefined;
  let currentVersion = applicationCommand.kind === "MODIFY_PUBLICATION" ? applicationCommand.input.expectedAggregateVersion : 0;
  let committing = false;
  let contextValidated = false;
  try {
    validateApplicationContext(applicationCommand, context);
    contextValidated = true;
    const replay = findReplay(dependencies, applicationCommand, identity, context);
    if (replay !== undefined) return replay;

    transaction = dependencies.unitOfWork.begin(identity);
    const snapshot = executeDomain(transaction);
    currentVersion = snapshot.aggregateVersion;
    transaction.audit.append({
      id: auditId(identity, context, commandName(applicationCommand), context.intentFingerprint, "completed"),
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      command: commandName(applicationCommand),
      actorId: context.actorId,
      timestamp: dependencies.clock.now(),
      version: snapshot.aggregateVersion,
      result: "COMPLETED",
    });
    committing = true;
    transaction.commit();
    committing = false;
    const result = success(identity.publicationId, snapshot.aggregateVersion, false);
    try {
      dependencies.idempotency.record({
        tenantScopeId: identity.tenantScopeId,
        aggregateId: identity.publicationId,
        commandKey: context.idempotencyKey,
        fingerprint: context.intentFingerprint,
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
      appendFailureAudit(dependencies, applicationCommand, identity, context, currentVersion, error, committing);
    } else if (contextValidated) {
      let persistedVersion = currentVersion;
      try { persistedVersion = dependencies.repository.find(identity)?.aggregateVersion ?? currentVersion; } catch { /* Auxiliary evidence lookup cannot replace the original safe error. */ }
      appendFailureAudit(dependencies, applicationCommand, identity, context, persistedVersion, error, false);
    }
    return mapPublicationApplicationError(error, committing);
  }
}

function validateApplicationContext(command: PublicationApplicationCommand, context: PublicationExecutionContext): void {
  const values = [context.actorId, context.correlationId, context.idempotencyKey, context.intentFingerprint];
  if (values.some((value) => value.trim().length === 0)) {
    throw new PublicationApplicationError("APPLICATION_CONTEXT_INVALID", "VALIDATION", "Application execution context is invalid.");
  }
  if (command.input.command.actorId !== context.actorId || command.input.command.correlationId !== context.correlationId) {
    throw new PublicationApplicationError("APPLICATION_CONTEXT_INVALID", "VALIDATION", "Application execution context is invalid.");
  }
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
