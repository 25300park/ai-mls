import {
  DurableConnectorExecutionUnitOfWork,
  type ConnectorCheckpoint,
  type ConnectorExecutionEvidence,
  type ConnectorExecutionScope,
  type ConnectorIdempotencyRecord,
  type ConnectorInvocation,
  type ConnectorInvocationCompletionInput,
  type ConnectorInvocationIntentInput,
  type ConnectorLease,
  type ConnectorLeaseInput,
  type ConnectorTechnicalEvidence,
  type ConnectorTechnicalRecordType,
  type ConnectorTechnicalState,
  type ConnectorTechnicalStateInput,
  type DurableConnectorExecutionUnitOfWorkOptions,
} from "./connector-durable-persistence.js";

export interface AsyncConnectorExecutionPersistence {
  acquireLease(input: ConnectorLeaseInput): Promise<ConnectorLease>;
  releaseLease(scope: ConnectorExecutionScope, leaseId: string, expectedVersion: number, releasedAt: string): Promise<ConnectorLease>;
  expireLeases(now: string): Promise<number>;
  findLease(scope: ConnectorExecutionScope): Promise<ConnectorLease | undefined>;
  prepareInvocation(input: ConnectorInvocationIntentInput): Promise<ConnectorInvocation>;
  markExecutionStarted(scope: ConnectorExecutionScope, invocationId: string, startedAt: string): Promise<Readonly<{ readonly claimed: boolean; readonly invocation: ConnectorInvocation }>>;
  completeInvocation(input: ConnectorInvocationCompletionInput): Promise<ConnectorInvocation>;
  findInvocation(scope: ConnectorExecutionScope, invocationId: string): Promise<ConnectorInvocation | undefined>;
  findCheckpoint(scope: ConnectorExecutionScope): Promise<ConnectorCheckpoint | undefined>;
  findIdempotency(scope: ConnectorExecutionScope, idempotencyKey: string): Promise<ConnectorIdempotencyRecord | undefined>;
  listEvidence(scope: ConnectorExecutionScope): Promise<readonly ConnectorExecutionEvidence[]>;
  recordTechnicalState(input: ConnectorTechnicalStateInput): Promise<ConnectorTechnicalState>;
  findTechnicalState(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): Promise<ConnectorTechnicalState | undefined>;
  listTechnicalEvidence(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): Promise<readonly ConnectorTechnicalEvidence[]>;
  close(): Promise<void>;
}

export function adaptSynchronousConnectorPersistence(delegate: DurableConnectorExecutionUnitOfWork): AsyncConnectorExecutionPersistence {
  const adapter: AsyncConnectorExecutionPersistence = {
    acquireLease: (input) => Promise.resolve(delegate.acquireLease(input)),
    releaseLease: (scope, leaseId, expectedVersion, releasedAt) => Promise.resolve(delegate.releaseLease(scope, leaseId, expectedVersion, releasedAt)),
    expireLeases: (now) => Promise.resolve(delegate.expireLeases(now)),
    findLease: (scope) => Promise.resolve(delegate.findLease(scope)),
    prepareInvocation: (input) => Promise.resolve(delegate.prepareInvocation(input)),
    markExecutionStarted: (scope, invocationId, startedAt) => Promise.resolve(delegate.markExecutionStarted(scope, invocationId, startedAt)),
    completeInvocation: (input) => Promise.resolve(delegate.completeInvocation(input)),
    findInvocation: (scope, invocationId) => Promise.resolve(delegate.findInvocation(scope, invocationId)),
    findCheckpoint: (scope) => Promise.resolve(delegate.findCheckpoint(scope)),
    findIdempotency: (scope, idempotencyKey) => Promise.resolve(delegate.findIdempotency(scope, idempotencyKey)),
    listEvidence: (scope) => Promise.resolve(delegate.listEvidence(scope)),
    recordTechnicalState: (input) => Promise.resolve(delegate.recordTechnicalState(input)),
    findTechnicalState: (scope, recordType, recordId) => Promise.resolve(delegate.findTechnicalState(scope, recordType, recordId)),
    listTechnicalEvidence: (scope, recordType, recordId) => Promise.resolve(delegate.listTechnicalEvidence(scope, recordType, recordId)),
    close: () => { delegate.close(); return Promise.resolve(); },
  };
  return Object.freeze(adapter);
}

export class AsyncDurableConnectorExecutionUnitOfWork implements AsyncConnectorExecutionPersistence {
  readonly #delegate: DurableConnectorExecutionUnitOfWork;

  public constructor(options: DurableConnectorExecutionUnitOfWorkOptions) {
    this.#delegate = new DurableConnectorExecutionUnitOfWork(options);
  }

  public acquireLease(input: ConnectorLeaseInput): Promise<ConnectorLease> { return Promise.resolve(this.#delegate.acquireLease(input)); }
  public releaseLease(scope: ConnectorExecutionScope, leaseId: string, expectedVersion: number, releasedAt: string): Promise<ConnectorLease> { return Promise.resolve(this.#delegate.releaseLease(scope, leaseId, expectedVersion, releasedAt)); }
  public expireLeases(now: string): Promise<number> { return Promise.resolve(this.#delegate.expireLeases(now)); }
  public findLease(scope: ConnectorExecutionScope): Promise<ConnectorLease | undefined> { return Promise.resolve(this.#delegate.findLease(scope)); }
  public prepareInvocation(input: ConnectorInvocationIntentInput): Promise<ConnectorInvocation> { return Promise.resolve(this.#delegate.prepareInvocation(input)); }
  public markExecutionStarted(scope: ConnectorExecutionScope, invocationId: string, startedAt: string): Promise<Readonly<{ readonly claimed: boolean; readonly invocation: ConnectorInvocation }>> { return Promise.resolve(this.#delegate.markExecutionStarted(scope, invocationId, startedAt)); }
  public completeInvocation(input: ConnectorInvocationCompletionInput): Promise<ConnectorInvocation> { return Promise.resolve(this.#delegate.completeInvocation(input)); }
  public findInvocation(scope: ConnectorExecutionScope, invocationId: string): Promise<ConnectorInvocation | undefined> { return Promise.resolve(this.#delegate.findInvocation(scope, invocationId)); }
  public findCheckpoint(scope: ConnectorExecutionScope): Promise<ConnectorCheckpoint | undefined> { return Promise.resolve(this.#delegate.findCheckpoint(scope)); }
  public findIdempotency(scope: ConnectorExecutionScope, idempotencyKey: string): Promise<ConnectorIdempotencyRecord | undefined> { return Promise.resolve(this.#delegate.findIdempotency(scope, idempotencyKey)); }
  public listEvidence(scope: ConnectorExecutionScope): Promise<readonly ConnectorExecutionEvidence[]> { return Promise.resolve(this.#delegate.listEvidence(scope)); }
  public recordTechnicalState(input: ConnectorTechnicalStateInput): Promise<ConnectorTechnicalState> { return Promise.resolve(this.#delegate.recordTechnicalState(input)); }
  public findTechnicalState(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): Promise<ConnectorTechnicalState | undefined> { return Promise.resolve(this.#delegate.findTechnicalState(scope, recordType, recordId)); }
  public listTechnicalEvidence(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): Promise<readonly ConnectorTechnicalEvidence[]> { return Promise.resolve(this.#delegate.listTechnicalEvidence(scope, recordType, recordId)); }
  public close(): Promise<void> { this.#delegate.close(); return Promise.resolve(); }
}
