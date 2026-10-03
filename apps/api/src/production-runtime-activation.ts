import type { ProductionClosableResource } from "./production-bootstrap.js";

export interface RequiredWorkersManifestV1 {
  readonly schemaVersion: 1;
  readonly workers: readonly [];
}

/** Explicit AO-approved root input; absence never supplies this value. */
export const CURRENT_PRODUCTION_REQUIRED_WORKERS_MANIFEST: RequiredWorkersManifestV1 = Object.freeze({
  schemaVersion: 1, workers: Object.freeze<[]>([]),
});

export type ProductionActivationReason = "WORKER_MANIFEST_INVALID" | "LISTENER_START_FAILED" | "WORKER_START_FAILED"
  | "DUPLICATE_ACTIVATION" | "SHUTDOWN_FAILED" | "PRE_LISTENER_NOT_READY" | "ACTIVATION_CLEANUP_FAILED";

export class ProductionRuntimeActivationError extends Error {
  public constructor(public readonly reason: ProductionActivationReason) {
    super("Production runtime activation is unavailable.");
    this.name = "ProductionRuntimeActivationError";
  }
}

/** Non-empty manifests require a future approved composition, never discovery. */
export function validateRequiredWorkersManifest(manifest: unknown): Readonly<{ status: "READY_EMPTY_MANIFEST" }> {
  try {
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) throw invalid();
    const prototype: unknown = Object.getPrototypeOf(manifest);
    if (prototype !== Object.prototype && prototype !== null) throw invalid();
    const fields = Reflect.ownKeys(manifest);
    if (fields.length !== 2 || !["schemaVersion", "workers"].every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(manifest, key);
      return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
    })) throw invalid();
    const value = manifest as Record<string, unknown>;
    if (value["schemaVersion"] !== 1 || !Array.isArray(value["workers"]) || value["workers"].length !== 0) throw invalid();
    return Object.freeze({ status: "READY_EMPTY_MANIFEST" });
  } catch { throw invalid(); }
}

export interface ProductionActivationListener extends ProductionClosableResource {
  stopAccepting?(): void | Promise<void>;
}

/** One cleanup deadline reserves a share for each remaining owner, including final pool closure. */
export class ProductionCleanupBudget {
  private readonly deadline: number;
  public constructor(milliseconds = 25_000) {
    if (!Number.isInteger(milliseconds) || milliseconds < 1 || milliseconds > 25_000) throw invalid();
    this.deadline = performance.now() + milliseconds;
  }
  public async run(operation: () => void | Promise<void>, remainingHandles = 1): Promise<void> {
    const milliseconds = Math.max(1, Math.floor((this.deadline - performance.now()) / Math.max(1, remainingHandles)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([Promise.resolve().then(operation), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ProductionRuntimeActivationError("SHUTDOWN_FAILED")), milliseconds);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
}

/** Top-level activation lifecycle. Components borrow resources and never receive pool ownership.
 * Worker starters are a lifecycle seam for approved compositions/fixtures, not a Production registry.
 * The current Production bootstrap validates its empty manifest and supplies exactly zero starters.
 */
export class ProductionRuntimeActivation {
  private state: "CREATED" | "STARTING" | "READY" | "STOPPING" | "STOPPED" = "CREATED";
  private listener: ProductionActivationListener | undefined;
  private readonly workers: ProductionClosableResource[] = [];
  private starting: Promise<void> | undefined;
  private closing: Promise<void> | undefined;

  public constructor(private readonly cleanupTimeoutMilliseconds = 25_000) {
    if (!Number.isInteger(cleanupTimeoutMilliseconds) || cleanupTimeoutMilliseconds < 1 || cleanupTimeoutMilliseconds > 25_000) throw invalid();
  }

  public readiness(): "READY" | "NOT_READY" { return this.state === "READY" ? "READY" : "NOT_READY"; }

  public start(
    startListener: () => Promise<ProductionActivationListener>,
    workerStarters: readonly (() => Promise<ProductionClosableResource>)[],
    afterListener: () => void = () => undefined,
  ): Promise<void> {
    if (this.state !== "CREATED") return Promise.reject(new ProductionRuntimeActivationError("DUPLICATE_ACTIVATION"));
    this.state = "STARTING";
    this.starting = this.activate(startListener, workerStarters, afterListener);
    return this.starting;
  }

  public close(budget = new ProductionCleanupBudget(this.cleanupTimeoutMilliseconds), reservedHandles = 0): Promise<void> {
    if (this.closing !== undefined) return this.closing;
    this.state = "STOPPING";
    this.closing = (async (): Promise<void> => {
      try { await this.starting; } catch { /* activation already rolled back */ }
      const failed = await this.cleanup(false, budget, reservedHandles);
      this.state = "STOPPED";
      if (failed) throw new ProductionRuntimeActivationError("SHUTDOWN_FAILED");
    })();
    return this.closing;
  }

  private async activate(startListener: () => Promise<ProductionActivationListener>,
    workerStarters: readonly (() => Promise<ProductionClosableResource>)[], afterListener: () => void): Promise<void> {
    let reason: ProductionActivationReason = "LISTENER_START_FAILED";
    try {
      this.listener = await startListener();
      if (typeof this.listener?.close !== "function") throw invalid();
      if (workerStarters.length !== 0 && typeof this.listener.stopAccepting !== "function") throw invalid();
      afterListener();
      reason = "WORKER_START_FAILED";
      for (const start of workerStarters) {
        const worker = await start();
        if (typeof worker?.close !== "function") throw invalid();
        this.workers.push(worker);
      }
      if (this.state === "STARTING") this.state = "READY";
    } catch (error) {
      const cleanupFailed = await this.cleanup(true, new ProductionCleanupBudget(this.cleanupTimeoutMilliseconds));
      if (this.state !== "STOPPING") this.state = "STOPPED";
      const cleanupUnavailable = cleanupFailed || (error instanceof ProductionRuntimeActivationError && error.reason === "ACTIVATION_CLEANUP_FAILED");
      throw Object.assign(new ProductionRuntimeActivationError(cleanupUnavailable ? "ACTIVATION_CLEANUP_FAILED" : reason), { startupReason: reason });
    }
  }

  private async cleanup(rollback: boolean, budget: ProductionCleanupBudget, reservedHandles = 0): Promise<boolean> {
    let failed = false;
    const listener = this.listener;
    this.listener = undefined;
    if (!rollback && listener?.stopAccepting !== undefined) {
      try { await budget.run(() => listener.stopAccepting!(), this.workers.length + 2 + reservedHandles); } catch { failed = true; }
    }
    while (this.workers.length !== 0) {
      const worker = this.workers.pop()!;
      try { await budget.run(() => worker.close(), this.workers.length + 2 + reservedHandles); } catch { failed = true; }
    }
    if (listener !== undefined) {
      try { await budget.run(() => listener.close(), 1 + reservedHandles); } catch { failed = true; }
    }
    return failed;
  }

}

function invalid(): ProductionRuntimeActivationError { return new ProductionRuntimeActivationError("WORKER_MANIFEST_INVALID"); }
