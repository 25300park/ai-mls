import { DurableExternalIntegrationStore } from "./external-integration-durable-persistence.js";

export interface AsyncExternalIntegrationPersistence {
  provisionContract(...args: Parameters<DurableExternalIntegrationStore["provisionContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["provisionContract"]>>;
  readContract(...args: Parameters<DurableExternalIntegrationStore["readContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["readContract"]>>;
  suspendContract(...args: Parameters<DurableExternalIntegrationStore["suspendContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["suspendContract"]>>;
  registerMapping(...args: Parameters<DurableExternalIntegrationStore["registerMapping"]>): Promise<ReturnType<DurableExternalIntegrationStore["registerMapping"]>>;
  readMappingById(...args: Parameters<DurableExternalIntegrationStore["readMappingById"]>): Promise<ReturnType<DurableExternalIntegrationStore["readMappingById"]>>;
  readMappingByExternal(...args: Parameters<DurableExternalIntegrationStore["readMappingByExternal"]>): Promise<ReturnType<DurableExternalIntegrationStore["readMappingByExternal"]>>;
  submitObservation(...args: Parameters<DurableExternalIntegrationStore["submitObservation"]>): Promise<ReturnType<DurableExternalIntegrationStore["submitObservation"]>>;
  reconcileEvidence(...args: Parameters<DurableExternalIntegrationStore["reconcileEvidence"]>): Promise<ReturnType<DurableExternalIntegrationStore["reconcileEvidence"]>>;
  listObservations(...args: Parameters<DurableExternalIntegrationStore["listObservations"]>): Promise<ReturnType<DurableExternalIntegrationStore["listObservations"]>>;
  listEvidence(...args: Parameters<DurableExternalIntegrationStore["listEvidence"]>): Promise<ReturnType<DurableExternalIntegrationStore["listEvidence"]>>;
  close(): Promise<void>;
}

export function adaptSynchronousExternalIntegrationPersistence(delegate: DurableExternalIntegrationStore): AsyncExternalIntegrationPersistence {
 return Object.freeze({
  provisionContract: async (...args: Parameters<DurableExternalIntegrationStore["provisionContract"]>) => await Promise.resolve(delegate.provisionContract(...args)),
  readContract: async (...args: Parameters<DurableExternalIntegrationStore["readContract"]>) => await Promise.resolve(delegate.readContract(...args)),
  suspendContract: async (...args: Parameters<DurableExternalIntegrationStore["suspendContract"]>) => await Promise.resolve(delegate.suspendContract(...args)),
  registerMapping: async (...args: Parameters<DurableExternalIntegrationStore["registerMapping"]>) => await Promise.resolve(delegate.registerMapping(...args)),
  readMappingById: async (...args: Parameters<DurableExternalIntegrationStore["readMappingById"]>) => await Promise.resolve(delegate.readMappingById(...args)),
  readMappingByExternal: async (...args: Parameters<DurableExternalIntegrationStore["readMappingByExternal"]>) => await Promise.resolve(delegate.readMappingByExternal(...args)),
  submitObservation: async (...args: Parameters<DurableExternalIntegrationStore["submitObservation"]>) => await Promise.resolve(delegate.submitObservation(...args)),
  reconcileEvidence: async (...args: Parameters<DurableExternalIntegrationStore["reconcileEvidence"]>) => await Promise.resolve(delegate.reconcileEvidence(...args)),
  listObservations: async (...args: Parameters<DurableExternalIntegrationStore["listObservations"]>) => await Promise.resolve(delegate.listObservations(...args)),
  listEvidence: async (...args: Parameters<DurableExternalIntegrationStore["listEvidence"]>) => await Promise.resolve(delegate.listEvidence(...args)),
  close: async () => { await Promise.resolve(delegate.close()); },
 });
}

export class AsyncDurableExternalIntegrationStore implements AsyncExternalIntegrationPersistence {
 readonly #delegate: AsyncExternalIntegrationPersistence;
 public constructor(options: ConstructorParameters<typeof DurableExternalIntegrationStore>[0]) { this.#delegate=adaptSynchronousExternalIntegrationPersistence(new DurableExternalIntegrationStore(options)); }
 public provisionContract(...args: Parameters<DurableExternalIntegrationStore["provisionContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["provisionContract"]>> { return this.#delegate.provisionContract(...args); }
 public readContract(...args: Parameters<DurableExternalIntegrationStore["readContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["readContract"]>> { return this.#delegate.readContract(...args); }
 public suspendContract(...args: Parameters<DurableExternalIntegrationStore["suspendContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["suspendContract"]>> { return this.#delegate.suspendContract(...args); }
 public registerMapping(...args: Parameters<DurableExternalIntegrationStore["registerMapping"]>): Promise<ReturnType<DurableExternalIntegrationStore["registerMapping"]>> { return this.#delegate.registerMapping(...args); }
 public readMappingById(...args: Parameters<DurableExternalIntegrationStore["readMappingById"]>): Promise<ReturnType<DurableExternalIntegrationStore["readMappingById"]>> { return this.#delegate.readMappingById(...args); }
 public readMappingByExternal(...args: Parameters<DurableExternalIntegrationStore["readMappingByExternal"]>): Promise<ReturnType<DurableExternalIntegrationStore["readMappingByExternal"]>> { return this.#delegate.readMappingByExternal(...args); }
 public submitObservation(...args: Parameters<DurableExternalIntegrationStore["submitObservation"]>): Promise<ReturnType<DurableExternalIntegrationStore["submitObservation"]>> { return this.#delegate.submitObservation(...args); }
 public reconcileEvidence(...args: Parameters<DurableExternalIntegrationStore["reconcileEvidence"]>): Promise<ReturnType<DurableExternalIntegrationStore["reconcileEvidence"]>> { return this.#delegate.reconcileEvidence(...args); }
 public listObservations(...args: Parameters<DurableExternalIntegrationStore["listObservations"]>): Promise<ReturnType<DurableExternalIntegrationStore["listObservations"]>> { return this.#delegate.listObservations(...args); }
 public listEvidence(...args: Parameters<DurableExternalIntegrationStore["listEvidence"]>): Promise<ReturnType<DurableExternalIntegrationStore["listEvidence"]>> { return this.#delegate.listEvidence(...args); }
 public close(): Promise<void> { return this.#delegate.close(); }
}
