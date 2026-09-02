import { CONNECTOR_API_OPERATIONS, type ConnectorApiRequestKind } from "./connector-api-contracts.js";
import type { ConnectorApplicationResult, ConnectorRuntimeApplication } from "./connector-runtime-application.js";

export type ConnectorRuntimeStatus = "CREATED" | "READY" | "STOPPED";

export class ConnectorRuntimeError extends Error {
  public constructor(public readonly code: "RUNTIME_DEPENDENCY_MISSING" | "RUNTIME_NOT_READY" | "RUNTIME_LIFECYCLE_INVALID", message: string) {
    super(message); this.name = "ConnectorRuntimeError";
  }
}

export class ConnectorRuntime {
  #status: ConnectorRuntimeStatus = "CREATED";
  readonly #application: Pick<ConnectorRuntimeApplication, "execute">;

  public constructor(application: Pick<ConnectorRuntimeApplication, "execute">) {
    if (application === undefined || typeof application.execute !== "function") throw new ConnectorRuntimeError("RUNTIME_DEPENDENCY_MISSING", "Connector application is unavailable.");
    this.#application = application;
  }

  public get status(): Readonly<{ readonly status: ConnectorRuntimeStatus }> { return Object.freeze({ status: this.#status }); }
  public get operations(): readonly string[] { return CONNECTOR_API_OPERATIONS; }
  public start(): Readonly<{ readonly status: ConnectorRuntimeStatus }> { if (this.#status !== "CREATED") throw new ConnectorRuntimeError("RUNTIME_LIFECYCLE_INVALID", "Connector Runtime lifecycle is invalid."); this.#status = "READY"; return this.status; }
  public execute(kind: ConnectorApiRequestKind, request: unknown): ConnectorApplicationResult { if (this.#status !== "READY") throw new ConnectorRuntimeError("RUNTIME_NOT_READY", "Connector Runtime is not ready."); return this.#application.execute(kind, request); }
  public stop(): Readonly<{ readonly status: ConnectorRuntimeStatus }> { if (this.#status !== "READY") throw new ConnectorRuntimeError("RUNTIME_LIFECYCLE_INVALID", "Connector Runtime lifecycle is invalid."); this.#status = "STOPPED"; return this.status; }
}
