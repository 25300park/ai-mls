import { DurableAdvisoryStore, type DurableAdvisoryStoreOptions } from "./advisory-durable-persistence.js";
import type { AdvisoryPersistence } from "./advisory-runtime-contracts.js";

export interface AsyncAdvisoryPersistence {
 registerPrompt(...args: Parameters<AdvisoryPersistence["registerPrompt"]>): Promise<ReturnType<AdvisoryPersistence["registerPrompt"]>>;
 findPrompt(...args: Parameters<AdvisoryPersistence["findPrompt"]>): Promise<ReturnType<AdvisoryPersistence["findPrompt"]>>;
 findReplay(...args: Parameters<AdvisoryPersistence["findReplay"]>): Promise<ReturnType<AdvisoryPersistence["findReplay"]>>;
 findAdvisory(...args: Parameters<AdvisoryPersistence["findAdvisory"]>): Promise<ReturnType<AdvisoryPersistence["findAdvisory"]>>;
 recordAccepted(...args: Parameters<AdvisoryPersistence["recordAccepted"]>): Promise<ReturnType<AdvisoryPersistence["recordAccepted"]>>;
 close(): Promise<void>;
}

export function adaptSynchronousAdvisoryPersistence(delegate: AdvisoryPersistence): AsyncAdvisoryPersistence {
 return Object.freeze({
  registerPrompt: async (...args: Parameters<AdvisoryPersistence["registerPrompt"]>) => await Promise.resolve(delegate.registerPrompt(...args)),
  findPrompt: async (...args: Parameters<AdvisoryPersistence["findPrompt"]>) => await Promise.resolve(delegate.findPrompt(...args)),
  findReplay: async (...args: Parameters<AdvisoryPersistence["findReplay"]>) => await Promise.resolve(delegate.findReplay(...args)),
  findAdvisory: async (...args: Parameters<AdvisoryPersistence["findAdvisory"]>) => await Promise.resolve(delegate.findAdvisory(...args)),
  recordAccepted: async (...args: Parameters<AdvisoryPersistence["recordAccepted"]>) => await Promise.resolve(delegate.recordAccepted(...args)),
  close: async () => { await Promise.resolve(delegate.close()); },
 });
}

export class AsyncDurableAdvisoryStore implements AsyncAdvisoryPersistence {
 readonly #delegate: AsyncAdvisoryPersistence;
 public constructor(options: DurableAdvisoryStoreOptions) { this.#delegate=adaptSynchronousAdvisoryPersistence(new DurableAdvisoryStore(options)); }
 public registerPrompt(...args: Parameters<AdvisoryPersistence["registerPrompt"]>): Promise<ReturnType<AdvisoryPersistence["registerPrompt"]>> { return this.#delegate.registerPrompt(...args); }
 public findPrompt(...args: Parameters<AdvisoryPersistence["findPrompt"]>): Promise<ReturnType<AdvisoryPersistence["findPrompt"]>> { return this.#delegate.findPrompt(...args); }
 public findReplay(...args: Parameters<AdvisoryPersistence["findReplay"]>): Promise<ReturnType<AdvisoryPersistence["findReplay"]>> { return this.#delegate.findReplay(...args); }
 public findAdvisory(...args: Parameters<AdvisoryPersistence["findAdvisory"]>): Promise<ReturnType<AdvisoryPersistence["findAdvisory"]>> { return this.#delegate.findAdvisory(...args); }
 public recordAccepted(...args: Parameters<AdvisoryPersistence["recordAccepted"]>): Promise<ReturnType<AdvisoryPersistence["recordAccepted"]>> { return this.#delegate.recordAccepted(...args); }
 public close(): Promise<void> { return this.#delegate.close(); }
}
