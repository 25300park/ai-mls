import type { ConnectorApiRequestKind } from "./connector-api-contracts.js";
import type { ConnectorApplicationResult } from "./connector-runtime-application.js";
import type { ConnectorRuntime } from "./connector-runtime.js";

export class ConnectorHostError extends Error {
  public constructor(public readonly code: "HOST_NOT_READY" | "HOST_STARTUP_FAILED" | "HOST_LIFECYCLE_INVALID", message: string) { super(message); this.name = "ConnectorHostError"; }
}

export class ConnectorApplicationHost {
  #runtime: ConnectorRuntime | undefined;
  #status: "CREATED" | "READY" | "STOPPED" = "CREATED";
  public constructor(private readonly runtimeFactory: () => ConnectorRuntime) {}
  public get status(): Readonly<{ readonly status: "CREATED" | "READY" | "STOPPED" }> { return Object.freeze({ status: this.#status }); }
  public start(): Readonly<{ readonly status: "CREATED" | "READY" | "STOPPED" }> {
    if (this.#status !== "CREATED") throw new ConnectorHostError("HOST_LIFECYCLE_INVALID", "Connector Host lifecycle is invalid.");
    try { this.#runtime = this.runtimeFactory(); this.#runtime.start(); this.#status = "READY"; return this.status; }
    catch { this.#runtime = undefined; throw new ConnectorHostError("HOST_STARTUP_FAILED", "Connector Host startup failed."); }
  }
  public execute(kind: ConnectorApiRequestKind, request: unknown): ConnectorApplicationResult { if (this.#status !== "READY" || this.#runtime === undefined) throw new ConnectorHostError("HOST_NOT_READY", "Connector Host is not ready."); return this.#runtime.execute(kind, request); }
  public stop(): Readonly<{ readonly status: "CREATED" | "READY" | "STOPPED" }> { if (this.#status !== "READY" || this.#runtime === undefined) throw new ConnectorHostError("HOST_LIFECYCLE_INVALID", "Connector Host lifecycle is invalid."); this.#runtime.stop(); this.#status = "STOPPED"; return this.status; }
}
