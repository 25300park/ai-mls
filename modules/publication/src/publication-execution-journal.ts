import { immutableDomain, type PublicationIdentity } from "./publication-contracts.js";
import { InMemoryPersistenceState } from "./in-memory-persistence-state.js";
import { persistenceError } from "./publication-persistence-error.js";

export interface PublicationExecutionIntent extends PublicationIdentity {
  readonly commandId: string;
  readonly attemptId: string;
  readonly dispatchFingerprint: string;
  readonly providerIdempotencyKey: string;
  readonly preparedAt: string;
}

export interface PublicationExecutionReceipt extends PublicationIdentity {
  readonly receiptId: string;
  readonly commandId: string;
  readonly attemptId: string;
  readonly outcome: "CONFIRMED" | "NO_EFFECT" | "UNKNOWN";
  readonly evidenceRefs: readonly string[];
  readonly recordedAt: string;
  readonly externalObjectReference?: string;
}

export interface PublicationDispatchEvent extends PublicationIdentity {
  readonly commandId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly state: "DISPATCH_STARTED";
  readonly recordedAt: string;
}

export type PublicationExecutionRecoveryDisposition = Readonly<{
  readonly condition: "PRE_DISPATCH" | "RECONCILIATION_REQUIRED" | "AUTHORITATIVE_RECEIPT";
  readonly providerInvocationPermitted: boolean;
  readonly attemptId: string;
}>;

export interface PublicationExecutionJournal {
  prepare(intent: PublicationExecutionIntent): Promise<PublicationExecutionIntent>;
  markDispatchStarted(identity: PublicationIdentity, commandId: string, recordedAt: string): Promise<"STARTED" | "ALREADY_STARTED">;
  appendReceipt(receipt: PublicationExecutionReceipt): Promise<PublicationExecutionReceipt>;
  findIntent(identity: PublicationIdentity, commandId: string): Promise<PublicationExecutionIntent | undefined>;
  findReceipt(identity: PublicationIdentity, commandId: string): Promise<PublicationExecutionReceipt | undefined>;
  recoveryDisposition(identity: PublicationIdentity, commandId: string): Promise<PublicationExecutionRecoveryDisposition>;
}

export class InMemoryPublicationExecutionJournal implements PublicationExecutionJournal {
  public constructor(
    private readonly state: InMemoryPersistenceState = new InMemoryPersistenceState(),
    private readonly scope?: PublicationIdentity,
    private readonly assertUsable: () => void = () => undefined,
  ) {}

  public async prepare(input: PublicationExecutionIntent): Promise<PublicationExecutionIntent> {
    await Promise.resolve();
    this.assertUsable();
    this.assertScope(input);
    requireExactKeys(input, ["tenantScopeId", "publicationId", "commandId", "attemptId", "dispatchFingerprint", "providerIdempotencyKey", "preparedAt"]);
    const key = executionKey(input, input.commandId);
    const existing = this.state.executionIntents.get(key);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(input)) throw persistenceError("IDEMPOTENCY_CONFLICT", "Execution intent conflicts with durable evidence.");
      return immutableDomain(existing);
    }
    requireTextValues([input.commandId, input.attemptId, input.dispatchFingerprint, input.providerIdempotencyKey, input.preparedAt]);
    const stored = immutableDomain(input);
    this.state.executionIntents.set(key, stored);
    this.state.markScopeChanged(input.tenantScopeId, input.publicationId);
    return stored;
  }

  public async markDispatchStarted(identity: PublicationIdentity, commandId: string, recordedAt: string): Promise<"STARTED" | "ALREADY_STARTED"> {
    this.assertUsable();
    this.assertScope(identity);
    const intent = await this.findIntent(identity, commandId);
    if (intent === undefined) throw persistenceError("EXECUTION_INTENT_NOT_FOUND", "Execution intent was not found.");
    const key = executionKey(identity, commandId);
    const events = this.state.dispatchEvents.get(key) ?? [];
    if (events.some((event) => event.state === "DISPATCH_STARTED")) return "ALREADY_STARTED";
    if (this.state.executionReceipts.has(key)) return "ALREADY_STARTED";
    requireTextValues([recordedAt]);
    const event = immutableDomain({ ...identity, commandId, attemptId: intent.attemptId, sequence: events.length + 1, state: "DISPATCH_STARTED" as const, recordedAt });
    this.state.dispatchEvents.set(key, immutableDomain([...events, event]));
    this.state.markScopeChanged(identity.tenantScopeId, identity.publicationId);
    return "STARTED";
  }

  public async appendReceipt(input: PublicationExecutionReceipt): Promise<PublicationExecutionReceipt> {
    await Promise.resolve();
    this.assertUsable();
    this.assertScope(input);
    requireExactKeys(input, ["tenantScopeId", "publicationId", "receiptId", "commandId", "attemptId", "outcome", "evidenceRefs", "recordedAt", "externalObjectReference"]);
    const key = executionKey(input, input.commandId);
    const intent = this.state.executionIntents.get(key);
    if (intent?.attemptId !== input.attemptId) throw persistenceError("EXECUTION_INTENT_NOT_FOUND", "Execution intent was not found.");
    if (!this.state.dispatchEvents.get(key)?.some((event) => event.state === "DISPATCH_STARTED")) throw persistenceError("EXECUTION_DISPATCH_NOT_STARTED", "Execution dispatch has not started.");
    const existing = this.state.executionReceipts.get(key);
    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(input)) throw persistenceError("EXECUTION_RECEIPT_CONFLICT", "Execution receipt conflicts with durable evidence.");
      return immutableDomain(existing);
    }
    requireTextValues([input.receiptId, input.commandId, input.attemptId, input.recordedAt, ...input.evidenceRefs]);
    if (input.evidenceRefs.length === 0) throw persistenceError("EXECUTION_RECEIPT_INVALID", "Execution receipt evidence is required.");
    const stored = immutableDomain(input);
    this.state.executionReceipts.set(key, stored);
    this.state.markScopeChanged(input.tenantScopeId, input.publicationId);
    return stored;
  }

  public async findIntent(identity: PublicationIdentity, commandId: string): Promise<PublicationExecutionIntent | undefined> {
    await Promise.resolve();
    this.assertUsable();
    this.assertScope(identity);
    const found = this.state.executionIntents.get(executionKey(identity, commandId));
    return found === undefined ? undefined : immutableDomain(found);
  }

  public async findReceipt(identity: PublicationIdentity, commandId: string): Promise<PublicationExecutionReceipt | undefined> {
    await Promise.resolve();
    this.assertUsable();
    this.assertScope(identity);
    const found = this.state.executionReceipts.get(executionKey(identity, commandId));
    return found === undefined ? undefined : immutableDomain(found);
  }

  public async recoveryDisposition(identity: PublicationIdentity, commandId: string): Promise<PublicationExecutionRecoveryDisposition> {
    const intent = await this.findIntent(identity, commandId);
    if (intent === undefined) throw persistenceError("EXECUTION_INTENT_NOT_FOUND", "Execution intent was not found.");
    if (await this.findReceipt(identity, commandId) !== undefined) return immutableDomain({ condition: "AUTHORITATIVE_RECEIPT" as const, providerInvocationPermitted: false, attemptId: intent.attemptId });
    const started = (this.state.dispatchEvents.get(executionKey(identity, commandId)) ?? []).some((event) => event.state === "DISPATCH_STARTED");
    return started
      ? immutableDomain({ condition: "RECONCILIATION_REQUIRED" as const, providerInvocationPermitted: false, attemptId: intent.attemptId })
      : immutableDomain({ condition: "PRE_DISPATCH" as const, providerInvocationPermitted: true, attemptId: intent.attemptId });
  }

  private assertScope(identity: PublicationIdentity): void {
    if (this.scope !== undefined && (identity.publicationId !== this.scope.publicationId || identity.tenantScopeId !== this.scope.tenantScopeId)) {
      throw persistenceError("PERSISTENCE_SCOPE_VIOLATION", "Execution evidence is outside the transaction scope.");
    }
  }
}

function requireTextValues(values: readonly string[]): void {
  if (values.some((value) => value.trim().length === 0)) throw persistenceError("EXECUTION_EVIDENCE_INVALID", "Execution evidence is incomplete.");
}

function requireExactKeys(value: object, allowed: readonly string[]): void {
  const accepted = new Set(allowed);
  if (Object.keys(value).some((key) => !accepted.has(key))) throw persistenceError("EXECUTION_EVIDENCE_INVALID", "Execution evidence contains unsupported fields.");
}

export function executionKey(identity: PublicationIdentity, commandId: string): string {
  return JSON.stringify([identity.tenantScopeId, identity.publicationId, commandId]);
}
