import {
  createCommandContext,
  createPublicationBinding,
  createPublicationIdentity,
  DELIVERY_OPERATIONS,
  immutableDomain,
  PUBLICATION_CLASSIFICATIONS,
  PUBLICATION_SUSPENSION_STATUSES,
  RECONCILIATION_RESOLUTIONS,
  requireClosedValue,
  requirePositiveInteger,
  requireText,
  samePublicationBinding,
  type DeliveryAttempt,
  type DeliveryOutcome,
  type DomainCommandContext,
  type OperationOrigin,
  type PublicationLifecycleState,
  type PublicationSnapshot,
  type PublicationTransitionId,
  type PublicationVersionRecord,
  type ReconciliationCase,
  type ReconciliationResolution,
} from "./publication-contracts.js";
import type {
  BeginActiveOperationCommand,
  BeginInitialExecutionCommand,
  BeginWithdrawnRepublishCommand,
  CreatePublicationCommand,
  RequestWithdrawalCommand,
  ResolveExecutionCommand,
  ResolveReconciliationCommand,
  ResolveWithdrawalCommand,
  SetSuspensionCommand,
  SupersedePublicationCommand,
  TerminatePublicationCommand,
} from "./publication-commands.js";
import { domainError } from "./publication-domain-error.js";
import { createDeliveryAttempt, createPublicationVersionRecord, createReconciliationCase, createTransitionRecord } from "./publication-entities.js";
import { assessCorrectionMateriality, assertSameIntentRepublish } from "./publication-materiality-service.js";

export class PublicationAggregate {
  readonly #snapshot: PublicationSnapshot;

  private constructor(snapshot: PublicationSnapshot) {
    validateSnapshot(snapshot);
    this.#snapshot = immutableDomain(snapshot);
    Object.freeze(this);
  }

  public static create(input: CreatePublicationCommand): PublicationAggregate {
    const command = createCommandContext(input.command);
    if (!input.prerequisites.immutableSnapshot || !input.prerequisites.effectiveApproval || !input.prerequisites.exactTargetChannel || !input.prerequisites.provenancePresent) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Publication creation prerequisites are not effective.");
    const identity = createPublicationIdentity(input.identity);
    const binding = createPublicationBinding(input.binding);
    requireClosedValue(input.classification, PUBLICATION_CLASSIFICATIONS, "classification");
    const predecessorPublicationId = input.predecessorPublicationId === undefined ? undefined : requireText(input.predecessorPublicationId, "predecessorPublicationId");
    if (predecessorPublicationId === identity.publicationId) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Predecessor must have a distinct Publication identity.");
    const transition = createTransitionRecord({ id: `${identity.publicationId}:transition:1`, publicationId: identity.publicationId, sequence: 1, transitionId: "PUB-TR-001", toState: "READY", actorId: command.actorId, reason: command.reason, correlationId: command.correlationId, occurredAt: command.occurredAt });
    const versionRecord = createPublicationVersionRecord({ id: `${identity.publicationId}:version:0`, publicationId: identity.publicationId, publicationVersion: 0, binding, actorId: command.actorId, reason: command.reason, occurredAt: command.occurredAt });
    return new PublicationAggregate({
      publicationId: identity.publicationId, aggregateId: identity.publicationId, tenantScopeId: identity.tenantScopeId,
      binding, aggregateVersion: 1, publicationVersion: 0, lifecycleState: "READY", suspensionStatus: "NOT_SUSPENDED", authorizationState: "REVALIDATION_REQUIRED",
      withdrawalStatus: "NOT_REQUESTED", republishStatus: "NOT_REQUESTED", currentFlag: true, classification: input.classification,
      attempts: [], reconciliationCases: [], transitionHistory: [transition], bindingHistory: [versionRecord], ...(predecessorPublicationId === undefined ? {} : { predecessorPublicationId }),
      createdAt: command.occurredAt, updatedAt: command.occurredAt, auditCorrelationId: command.correlationId,
    });
  }

  public get snapshot(): PublicationSnapshot { return this.#snapshot; }

  public beginInitialExecution(input: BeginInitialExecutionCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "READY", input.command, true);
    const attempt = this.#newAttempt(input.attempt, "INITIAL_PUBLISH");
    return this.#transition("PUB-TR-002", "EXECUTION_PENDING", input.command, { attempts: [...this.#snapshot.attempts, attempt], publicationVersion: this.#snapshot.publicationVersion + 1, bindingHistory: [...this.#snapshot.bindingHistory, this.#nextVersionRecord(this.#snapshot.binding, input.command)], authorizationState: "AUTHORIZED_FOR_COMMAND", pendingOperation: { origin: "INITIAL", operation: "INITIAL_PUBLISH", attemptId: attempt.id } });
  }

  public resolveExecution(input: ResolveExecutionCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "EXECUTION_PENDING", input.command);
    requireClosedValue(input.outcome, ["EFFECT_CONFIRMED", "NO_EFFECT_CONFIRMED", "UNKNOWN"], "outcome");
    const pending = this.#requiredPendingOperation();
    requireEvidence(input.evidenceRefs);
    if (input.outcome === "EFFECT_CONFIRMED") {
      const externalObjectReference = requireText(input.externalObjectReference ?? "", "externalObjectReference");
      return this.#transition("PUB-TR-003", "ACTIVE", input.command, { attempts: this.#resolveAttempt(pending.attemptId, "CONFIRMED", input.evidenceRefs), effectiveVersion: this.#snapshot.publicationVersion, effectiveAt: input.command.occurredAt, externalObjectReference, authorizationState: "REVALIDATION_REQUIRED", republishStatus: pending.operation === "REPUBLISH" ? "CONFIRMED" : this.#snapshot.republishStatus, pendingOperation: undefined });
    }
    if (input.outcome === "UNKNOWN") {
      const caseId = requireText(input.reconciliationCaseId ?? "", "reconciliationCaseId");
      const reconciliation = this.#newReconciliation(caseId, pending, input.evidenceRefs, input.command.occurredAt);
      return this.#transition("PUB-TR-007", "RECONCILIATION_REQUIRED", input.command, { attempts: this.#resolveAttempt(pending.attemptId, "UNKNOWN", input.evidenceRefs), reconciliationCases: [...this.#snapshot.reconciliationCases, reconciliation], authorizationState: "BLOCKED", withdrawalStatus: pending.operation === "WITHDRAWAL" ? "RECONCILIATION_REQUIRED" : this.#snapshot.withdrawalStatus, republishStatus: pending.operation === "REPUBLISH" ? "RECONCILIATION_REQUIRED" : this.#snapshot.republishStatus });
    }
    const resolution = noEffectResolution(pending.origin);
    return this.#completeNoEffect(resolution.transitionId, resolution.state, pending, input.evidenceRefs, input.command);
  }

  public requestWithdrawal(input: RequestWithdrawalCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "ACTIVE", input.command);
    const attempt = this.#newAttempt(input.attempt, "WITHDRAWAL");
    return this.#transition("PUB-TR-012", "WITHDRAWAL_PENDING", input.command, { attempts: [...this.#snapshot.attempts, attempt], publicationVersion: this.#snapshot.publicationVersion + 1, bindingHistory: [...this.#snapshot.bindingHistory, this.#nextVersionRecord(this.#snapshot.binding, input.command)], withdrawalStatus: "EXECUTION_PENDING", authorizationState: "AUTHORIZED_FOR_COMMAND", pendingOperation: { origin: "WITHDRAWAL", operation: "WITHDRAWAL", attemptId: attempt.id } });
  }

  public resolveWithdrawal(input: ResolveWithdrawalCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "WITHDRAWAL_PENDING", input.command);
    requireClosedValue(input.outcome, ["CONFIRMED", "UNKNOWN"], "outcome");
    const pending = this.#requiredPendingOperation();
    if (pending.origin !== "WITHDRAWAL") throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Withdrawal pending operation is invalid.");
    requireEvidence(input.evidenceRefs);
    if (input.outcome === "CONFIRMED") return this.#transition("PUB-TR-013", "WITHDRAWN", input.command, { attempts: this.#resolveAttempt(pending.attemptId, "CONFIRMED", input.evidenceRefs), effectiveVersion: this.#snapshot.publicationVersion, effectiveAt: input.command.occurredAt, withdrawalStatus: "CONFIRMED", authorizationState: "REVALIDATION_REQUIRED", pendingOperation: undefined });
    const caseId = requireText(input.reconciliationCaseId ?? "", "reconciliationCaseId");
    const reconciliation = this.#newReconciliation(caseId, pending, input.evidenceRefs, input.command.occurredAt);
    return this.#transition("PUB-TR-014", "RECONCILIATION_REQUIRED", input.command, { attempts: this.#resolveAttempt(pending.attemptId, "UNKNOWN", input.evidenceRefs), reconciliationCases: [...this.#snapshot.reconciliationCases, reconciliation], withdrawalStatus: "RECONCILIATION_REQUIRED", authorizationState: "BLOCKED" });
  }

  public beginActiveOperation(input: BeginActiveOperationCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "ACTIVE", input.command, true);
    requireClosedValue(input.operation, DELIVERY_OPERATIONS.filter((operation): operation is "CORRECTION" | "REPUBLISH" => operation === "CORRECTION" || operation === "REPUBLISH"), "operation");
    requireClosedValue(input.materiality, ["MATERIAL", "NON_MATERIAL", "SAME_INTENT"], "materiality");
    const nextBinding = createPublicationBinding(input.nextBinding);
    if (input.operation === "CORRECTION") {
      if (input.materiality === "SAME_INTENT") throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "Correction requires a materiality decision.");
      const assessment = assessCorrectionMateriality(this.#snapshot.binding, nextBinding, input.materiality === "MATERIAL" ? "MATERIAL" : "NON_MATERIAL");
      if (assessment.disposition === "SUCCESSOR_REQUIRED") throw domainError("PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR", "INVARIANT", "Material correction requires a successor Publication.");
    } else {
      if (input.materiality !== "SAME_INTENT") throw domainError("PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR", "INVARIANT", "Republish must preserve Publication intent.");
      assertSameIntentRepublish(this.#snapshot.binding, nextBinding);
    }
    const attempt = this.#newAttempt(input.attempt, input.operation);
    return this.#transition("PUB-TR-017", "EXECUTION_PENDING", input.command, { binding: nextBinding, attempts: [...this.#snapshot.attempts, attempt], publicationVersion: this.#snapshot.publicationVersion + 1, bindingHistory: [...this.#snapshot.bindingHistory, this.#nextVersionRecord(nextBinding, input.command)], authorizationState: "AUTHORIZED_FOR_COMMAND", republishStatus: input.operation === "REPUBLISH" ? "EXECUTION_PENDING" : this.#snapshot.republishStatus, pendingOperation: { origin: "ACTIVE_CORRECTION_OR_REPUBLISH", operation: input.operation, attemptId: attempt.id } });
  }

  public beginWithdrawnRepublish(input: BeginWithdrawnRepublishCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "WITHDRAWN", input.command, true);
    const nextBinding = createPublicationBinding(input.nextBinding);
    assertSameIntentRepublish(this.#snapshot.binding, nextBinding);
    const attempt = this.#newAttempt(input.attempt, "REPUBLISH");
    return this.#transition("PUB-TR-018", "EXECUTION_PENDING", input.command, { binding: nextBinding, attempts: [...this.#snapshot.attempts, attempt], publicationVersion: this.#snapshot.publicationVersion + 1, bindingHistory: [...this.#snapshot.bindingHistory, this.#nextVersionRecord(nextBinding, input.command)], authorizationState: "AUTHORIZED_FOR_COMMAND", republishStatus: "EXECUTION_PENDING", pendingOperation: { origin: "WITHDRAWN_REPUBLISH", operation: "REPUBLISH", attemptId: attempt.id } });
  }

  public resolveReconciliation(input: ResolveReconciliationCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "RECONCILIATION_REQUIRED", input.command);
    requireClosedValue(input.resolution, RECONCILIATION_RESOLUTIONS, "resolution");
    requireEvidence(input.evidenceRefs);
    const reconciliation = this.#snapshot.reconciliationCases.find((item) => item.id === input.caseId && item.status === "OPEN");
    if (reconciliation === undefined) throw domainError("PUBLICATION_STATE_INVALID", "CONFLICT", "Open reconciliation case was not found.");
    assertResolutionMatchesOrigin(reconciliation.origin, input.resolution);
    const target = reconciliationTarget(input.resolution);
    const resolved = createReconciliationCase({ ...reconciliation, status: "RESOLVED", evidenceRefs: [...reconciliation.evidenceRefs, ...input.evidenceRefs], resolution: input.resolution, resolvedAt: input.command.occurredAt });
    const cases = this.#snapshot.reconciliationCases.map((item) => item.id === resolved.id ? resolved : item);
    const transitionId = reconciliationTransition(input.resolution);
    let patch: PublicationTransitionPatch = { reconciliationCases: cases, authorizationState: "REVALIDATION_REQUIRED", pendingOperation: undefined };
    if (input.resolution === "EFFECT_CONFIRMED") {
      patch = {
        ...patch,
        effectiveVersion: this.#snapshot.publicationVersion,
        effectiveAt: input.command.occurredAt,
        externalObjectReference: requireText(input.externalObjectReference ?? "", "externalObjectReference"),
        ...(reconciliation.origin === "WITHDRAWAL" ? { withdrawalStatus: "CONFIRMED_NO_EFFECT" as const } : {}),
        ...(reconciliation.origin === "ACTIVE_CORRECTION_OR_REPUBLISH" || reconciliation.origin === "WITHDRAWN_REPUBLISH" ? { republishStatus: "CONFIRMED" as const } : {}),
      };
    } else if (input.resolution === "WITHDRAWAL_CONFIRMED") {
      patch = { ...patch, withdrawalStatus: "CONFIRMED", effectiveVersion: this.#snapshot.publicationVersion, effectiveAt: input.command.occurredAt };
    } else if (input.resolution === "WITHDRAWAL_NO_EFFECT") {
      patch = { ...patch, withdrawalStatus: "CONFIRMED_NO_EFFECT" };
    } else if (reconciliation.origin === "ACTIVE_CORRECTION_OR_REPUBLISH" || reconciliation.origin === "WITHDRAWN_REPUBLISH") {
      patch = { ...patch, republishStatus: "CONFIRMED_NO_EFFECT" };
    }
    return this.#transition(transitionId, target, input.command, patch);
  }

  public supersede(input: SupersedePublicationCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "ACTIVE", input.command);
    requireEvidence(input.evidenceRefs);
    const successorPublicationId = requireText(input.successorPublicationId, "successorPublicationId");
    if (successorPublicationId === this.#snapshot.publicationId) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Successor must have a distinct Publication identity.");
    return this.#transition("PUB-TR-019", "SUPERSEDED", input.command, { successorPublicationId, currentFlag: false, authorizationState: "BLOCKED", pendingOperation: undefined });
  }

  public terminate(input: TerminatePublicationCommand): PublicationAggregate {
    this.#guard(input.expectedAggregateVersion, "READY", input.command);
    if (this.#snapshot.externalObjectReference !== undefined || this.#snapshot.effectiveVersion !== undefined) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Publication with external effect cannot terminate as no-effect.");
    return this.#transition("PUB-TR-020", "TERMINATED", input.command, { currentFlag: false, authorizationState: "BLOCKED" });
  }

  public setSuspension(input: SetSuspensionCommand): PublicationAggregate {
    this.#checkVersion(input.expectedAggregateVersion);
    const command = createCommandContext(input.command);
    requireClosedValue(input.suspensionStatus, PUBLICATION_SUSPENSION_STATUSES, "suspensionStatus");
    if (this.#snapshot.lifecycleState === "SUPERSEDED" || this.#snapshot.lifecycleState === "TERMINATED") throw domainError("PUBLICATION_TRANSITION_INVALID", "CONFLICT", "Terminal Publication cannot change suspension.");
    return new PublicationAggregate({ ...this.#snapshot, aggregateVersion: this.#snapshot.aggregateVersion + 1, suspensionStatus: input.suspensionStatus, updatedAt: command.occurredAt, auditCorrelationId: command.correlationId });
  }

  #guard(expectedVersion: number, expectedState: PublicationLifecycleState, context: DomainCommandContext, requiresUnsuspended = false): void {
    this.#checkVersion(expectedVersion);
    createCommandContext(context);
    if (this.#snapshot.lifecycleState !== expectedState) throw domainError("PUBLICATION_TRANSITION_INVALID", "CONFLICT", `Expected ${expectedState} state.`, { actualState: this.#snapshot.lifecycleState });
    if (requiresUnsuspended && this.#snapshot.suspensionStatus !== "NOT_SUSPENDED") throw domainError("PUBLICATION_STATE_INVALID", "CONFLICT", "Suspended Publication cannot begin an external-effect operation.");
  }

  #checkVersion(expectedVersion: number): void {
    requirePositiveInteger(expectedVersion, "expectedAggregateVersion");
    if (this.#snapshot.aggregateVersion !== expectedVersion) throw domainError("PUBLICATION_VERSION_CONFLICT", "CONFLICT", "Publication aggregate version does not match.", { expectedVersion, actualVersion: this.#snapshot.aggregateVersion });
  }

  #transition(transitionId: PublicationTransitionId, state: PublicationLifecycleState, contextInput: DomainCommandContext, patch: PublicationTransitionPatch): PublicationAggregate {
    const context = createCommandContext(contextInput);
    const sequence = this.#snapshot.transitionHistory.length + 1;
    const record = createTransitionRecord({ id: `${this.#snapshot.publicationId}:transition:${String(sequence)}`, publicationId: this.#snapshot.publicationId, sequence, transitionId, fromState: this.#snapshot.lifecycleState, toState: state, actorId: context.actorId, reason: context.reason, correlationId: context.correlationId, occurredAt: context.occurredAt });
    const clearsPendingOperation = Object.prototype.hasOwnProperty.call(patch, "pendingOperation") && patch.pendingOperation === undefined;
    const baseSnapshot = { ...this.#snapshot } as { -readonly [Key in keyof PublicationSnapshot]: PublicationSnapshot[Key] };
    if (clearsPendingOperation) delete baseSnapshot.pendingOperation;
    const { pendingOperation: nextPendingOperation, ...patchWithoutPendingOperation } = patch;
    return new PublicationAggregate({
      ...baseSnapshot,
      ...patchWithoutPendingOperation,
      ...(nextPendingOperation === undefined ? {} : { pendingOperation: nextPendingOperation }),
      lifecycleState: state,
      aggregateVersion: this.#snapshot.aggregateVersion + 1,
      transitionHistory: [...this.#snapshot.transitionHistory, record],
      updatedAt: context.occurredAt,
      auditCorrelationId: context.correlationId,
    });
  }

  #newAttempt(input: BeginInitialExecutionCommand["attempt"], expectedOperation: DeliveryAttempt["operation"]): DeliveryAttempt {
    if (input.operation !== expectedOperation) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "Delivery Attempt operation does not match command.");
    if (this.#snapshot.attempts.some((item) => item.id === input.id || item.commandId === input.commandId)) throw domainError("PUBLICATION_DUPLICATE_ENTITY", "CONFLICT", "Delivery Attempt identity is duplicated.");
    return createDeliveryAttempt({ ...input, publicationId: this.#snapshot.publicationId, outcome: "PENDING", sequence: this.#snapshot.attempts.length + 1 });
  }

  #nextVersionRecord(binding: PublicationSnapshot["binding"], contextInput: DomainCommandContext): PublicationVersionRecord {
    const context = createCommandContext(contextInput);
    const publicationVersion = this.#snapshot.publicationVersion + 1;
    return createPublicationVersionRecord({ id: `${this.#snapshot.publicationId}:version:${String(publicationVersion)}`, publicationId: this.#snapshot.publicationId, publicationVersion, binding, actorId: context.actorId, reason: context.reason, occurredAt: context.occurredAt });
  }

  #resolveAttempt(attemptId: string, outcome: DeliveryOutcome, evidenceRefs: readonly string[]): readonly DeliveryAttempt[] {
    let found = false;
    const attempts = this.#snapshot.attempts.map((item) => {
      if (item.id !== attemptId) return item;
      found = true;
      if (item.outcome !== "PENDING") throw domainError("PUBLICATION_STATE_INVALID", "CONFLICT", "Delivery Attempt is already terminal.");
      return createDeliveryAttempt({ ...item, outcome, evidenceRefs: [...item.evidenceRefs, ...evidenceRefs] });
    });
    if (!found) throw domainError("PUBLICATION_STATE_INVALID", "CONFLICT", "Pending Delivery Attempt was not found.");
    return immutableDomain(attempts);
  }

  #requiredPendingOperation(): NonNullable<PublicationSnapshot["pendingOperation"]> {
    const pending = this.#snapshot.pendingOperation;
    if (pending === undefined) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Pending lifecycle state requires an owned operation.");
    return pending;
  }

  #newReconciliation(caseId: string, pending: { readonly origin: OperationOrigin; readonly attemptId: string }, evidenceRefs: readonly string[], openedAt: string): ReconciliationCase {
    if (this.#snapshot.reconciliationCases.some((item) => item.id === caseId)) throw domainError("PUBLICATION_DUPLICATE_ENTITY", "CONFLICT", "Reconciliation Case identity is duplicated.");
    return createReconciliationCase({ id: caseId, publicationId: this.#snapshot.publicationId, attemptId: pending.attemptId, origin: pending.origin, status: "OPEN", evidenceRefs, openedAt });
  }

  #completeNoEffect(transitionId: "PUB-TR-004" | "PUB-TR-005" | "PUB-TR-006", state: "READY" | "ACTIVE" | "WITHDRAWN", pending: NonNullable<PublicationSnapshot["pendingOperation"]>, evidenceRefs: readonly string[], context: DomainCommandContext): PublicationAggregate {
    return this.#transition(transitionId, state, context, { attempts: this.#resolveAttempt(pending.attemptId, "NO_EFFECT", evidenceRefs), authorizationState: "REVALIDATION_REQUIRED", republishStatus: pending.operation === "REPUBLISH" ? "CONFIRMED_NO_EFFECT" : this.#snapshot.republishStatus, pendingOperation: undefined });
  }
}

type PublicationTransitionPatch = Partial<Omit<PublicationSnapshot, "pendingOperation">> & {
  readonly pendingOperation?: PublicationSnapshot["pendingOperation"] | undefined;
};

function validateSnapshot(snapshot: PublicationSnapshot): void {
  if (snapshot.aggregateId !== snapshot.publicationId) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Aggregate identity must equal Publication identity.");
  requirePositiveInteger(snapshot.aggregateVersion, "aggregateVersion");
  if (!Number.isSafeInteger(snapshot.publicationVersion) || snapshot.publicationVersion < 0) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Publication version is invalid.");
  if (snapshot.effectiveVersion !== undefined && snapshot.effectiveVersion > snapshot.publicationVersion) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Effective version cannot exceed Publication version.");
  const currentVersion = snapshot.bindingHistory.find((entry) => entry.publicationVersion === snapshot.publicationVersion);
  if (currentVersion === undefined || !samePublicationBinding(currentVersion.binding, snapshot.binding)) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Current Publication binding must have immutable version evidence.");
  if (snapshot.effectiveVersion !== undefined && !snapshot.bindingHistory.some((entry) => entry.publicationVersion === snapshot.effectiveVersion)) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Effective Publication binding version is missing.");
  if ((snapshot.lifecycleState === "EXECUTION_PENDING" || snapshot.lifecycleState === "WITHDRAWAL_PENDING") && snapshot.pendingOperation === undefined) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Pending state requires an operation.");
  if ((snapshot.lifecycleState === "SUPERSEDED" || snapshot.lifecycleState === "TERMINATED") && snapshot.currentFlag) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Terminal lineage state cannot be current.");
}

function requireEvidence(evidenceRefs: readonly string[]): void {
  if (evidenceRefs.length === 0) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "Evidence is required.");
  for (const ref of evidenceRefs) requireText(ref, "evidenceRef");
}

function noEffectResolution(origin: OperationOrigin): Readonly<{ transitionId: "PUB-TR-004" | "PUB-TR-005" | "PUB-TR-006"; state: "READY" | "ACTIVE" | "WITHDRAWN" }> {
  if (origin === "INITIAL") return { transitionId: "PUB-TR-004", state: "READY" };
  if (origin === "ACTIVE_CORRECTION_OR_REPUBLISH") return { transitionId: "PUB-TR-005", state: "ACTIVE" };
  if (origin === "WITHDRAWN_REPUBLISH") return { transitionId: "PUB-TR-006", state: "WITHDRAWN" };
  throw domainError("PUBLICATION_TRANSITION_INVALID", "CONFLICT", "Withdrawal outcome must use the withdrawal resolution command.");
}

function assertResolutionMatchesOrigin(origin: OperationOrigin, resolution: ReconciliationResolution): void {
  const allowed: Readonly<Record<OperationOrigin, readonly ReconciliationResolution[]>> = {
    INITIAL: ["EFFECT_CONFIRMED", "INITIAL_NO_EFFECT"],
    ACTIVE_CORRECTION_OR_REPUBLISH: ["EFFECT_CONFIRMED", "ACTIVE_ORIGIN_NO_EFFECT"],
    WITHDRAWN_REPUBLISH: ["EFFECT_CONFIRMED", "WITHDRAWN_ORIGIN_NO_EFFECT"],
    WITHDRAWAL: ["WITHDRAWAL_CONFIRMED", "WITHDRAWAL_NO_EFFECT"],
  };
  if (!allowed[origin].includes(resolution)) throw domainError("PUBLICATION_TRANSITION_INVALID", "CONFLICT", "Reconciliation resolution does not match operation origin.");
}

function reconciliationTarget(resolution: ReconciliationResolution): "ACTIVE" | "READY" | "WITHDRAWN" {
  if (resolution === "INITIAL_NO_EFFECT") return "READY";
  if (resolution === "WITHDRAWN_ORIGIN_NO_EFFECT" || resolution === "WITHDRAWAL_CONFIRMED") return "WITHDRAWN";
  return "ACTIVE";
}

function reconciliationTransition(resolution: ReconciliationResolution): "PUB-TR-008" | "PUB-TR-009" | "PUB-TR-010" | "PUB-TR-011" | "PUB-TR-015" | "PUB-TR-016" {
  const map = {
    EFFECT_CONFIRMED: "PUB-TR-008",
    INITIAL_NO_EFFECT: "PUB-TR-009",
    ACTIVE_ORIGIN_NO_EFFECT: "PUB-TR-010",
    WITHDRAWN_ORIGIN_NO_EFFECT: "PUB-TR-011",
    WITHDRAWAL_CONFIRMED: "PUB-TR-015",
    WITHDRAWAL_NO_EFFECT: "PUB-TR-016",
  } as const;
  return map[resolution];
}
