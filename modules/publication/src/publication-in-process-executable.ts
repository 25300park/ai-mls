import { PublicationApplicationHost } from "./publication-application-host.js";
import {
  createPublicationExecutableConfiguration,
  type PublicationExecutableConfiguration,
} from "./publication-executable-configuration.js";
import {
  immutablePublicationExecutableDiagnostics,
  immutablePublicationExecutableResult,
  PublicationExecutableError,
  type PublicationExecutableDiagnostics,
  type PublicationExecutableLastExecutionStatus,
  type PublicationExecutableRequest,
  type PublicationExecutableResult,
  type PublicationExecutableStateSnapshot,
} from "./publication-executable-contracts.js";
import { PublicationExecutableLifecycleController } from "./publication-executable-lifecycle.js";
import { PublicationHostInvocationAdapter } from "./publication-host-invocation-adapter.js";

export type PublicationExecutableHostFactory = () => PublicationApplicationHost;

export class PublicationInProcessExecutable {
  public readonly configuration: PublicationExecutableConfiguration;
  private readonly lifecycle = new PublicationExecutableLifecycleController();
  private host: PublicationApplicationHost | undefined;
  private invocation: PublicationHostInvocationAdapter | undefined;
  private executionCount = 0;
  private lastExecutionStatus: PublicationExecutableLastExecutionStatus = "NOT_EXECUTED";
  private started = false;
  private stoppedSnapshot: PublicationExecutableStateSnapshot | undefined;

  public constructor(
    configuration: unknown,
    private readonly hostFactory: PublicationExecutableHostFactory,
  ) {
    this.configuration = createPublicationExecutableConfiguration(configuration);
  }

  public get status(): PublicationExecutableStateSnapshot {
    return this.lifecycle.snapshot;
  }

  public get diagnostics(): PublicationExecutableDiagnostics {
    return immutablePublicationExecutableDiagnostics({
      executableState: this.lifecycle.snapshot.state,
      hostState: this.host?.status.state ?? null,
      started: this.started,
      stopped: this.lifecycle.snapshot.state === "STOPPED",
      executionCount: this.executionCount,
      lastExecutionStatus: this.lastExecutionStatus,
    });
  }

  public start(): PublicationExecutableStateSnapshot {
    if (this.lifecycle.snapshot.state === "STOPPED") {
      throw new PublicationExecutableError("EXECUTABLE_STOPPED", "Executable has stopped.");
    }
    if (this.lifecycle.snapshot.state !== "CREATED") {
      throw new PublicationExecutableError("EXECUTABLE_NOT_READY", "Executable cannot start.");
    }
    this.lifecycle.transition("STARTING");
    try {
      const host = this.hostFactory();
      if (Object.getPrototypeOf(host) !== PublicationApplicationHost.prototype) {
        throw new PublicationExecutableError("HOST_START_FAILURE", "Application Host startup failed.");
      }
      this.host = host;
      host.start();
      if (host.status.state !== "READY") {
        throw new PublicationExecutableError("HOST_START_FAILURE", "Application Host startup failed.");
      }
      this.invocation = new PublicationHostInvocationAdapter(host);
      this.started = true;
      return this.lifecycle.transition("READY");
    } catch {
      this.lifecycle.transition("FAILED");
      throw new PublicationExecutableError("HOST_START_FAILURE", "Application Host startup failed.");
    }
  }

  public execute(input: PublicationExecutableRequest): PublicationExecutableResult {
    const inspected = inspectExecutableRequest(input);
    if (inspected === null) {
      return this.failureResult(
        "unavailable",
        "INTERNAL_EXECUTABLE_ERROR",
        "Executable request is invalid.",
      );
    }
    const { executionId, request } = inspected;
    if (this.lifecycle.snapshot.state === "STOPPED") {
      return this.failureResult(executionId, "EXECUTABLE_STOPPED", "Executable has stopped.");
    }
    if (this.lifecycle.snapshot.state !== "READY" || this.invocation === undefined) {
      return this.failureResult(executionId, "EXECUTABLE_NOT_READY", "Executable is not ready.");
    }
    this.lifecycle.transition("EXECUTING");
    try {
      const outcome = this.invocation.invoke(request);
      this.executionCount += 1;
      this.lastExecutionStatus = outcome.success ? "SUCCESS" : "FAILURE";
      this.lifecycle.transition("READY");
      return immutablePublicationExecutableResult({
        executionId,
        success: outcome.success,
        state: this.lifecycle.snapshot.state,
        result: outcome.result,
        error: null,
        diagnostics: this.diagnostics,
      });
    } catch {
      this.executionCount += 1;
      this.lastExecutionStatus = "FAILURE";
      this.lifecycle.transition("FAILED");
      return this.failureResult(
        executionId,
        "HOST_EXECUTION_FAILURE",
        "Application Host execution failed.",
      );
    }
  }

  public stop(): PublicationExecutableStateSnapshot {
    if (this.lifecycle.snapshot.state === "STOPPED" && this.stoppedSnapshot !== undefined) {
      return this.stoppedSnapshot;
    }
    if (this.lifecycle.snapshot.state !== "READY" || this.host === undefined) {
      throw new PublicationExecutableError("EXECUTABLE_NOT_READY", "Executable cannot stop.");
    }
    this.lifecycle.transition("STOPPING");
    try {
      this.host.stop();
      if (this.host.status.state !== "STOPPED") {
        throw new PublicationExecutableError("HOST_STOP_FAILURE", "Application Host shutdown failed.");
      }
      this.stoppedSnapshot = this.lifecycle.transition("STOPPED");
      return this.stoppedSnapshot;
    } catch {
      this.lifecycle.transition("FAILED");
      throw new PublicationExecutableError("HOST_STOP_FAILURE", "Application Host shutdown failed.");
    }
  }

  private failureResult(
    executionId: string,
    code: "EXECUTABLE_NOT_READY" | "EXECUTABLE_STOPPED" | "HOST_EXECUTION_FAILURE" | "INTERNAL_EXECUTABLE_ERROR",
    message: string,
  ): PublicationExecutableResult {
    return immutablePublicationExecutableResult({
      executionId,
      success: false,
      state: this.lifecycle.snapshot.state,
      result: null,
      error: { code, message },
      diagnostics: this.diagnostics,
    });
  }
}

function inspectExecutableRequest(
  input: PublicationExecutableRequest,
): Readonly<{ readonly executionId: string; readonly request: unknown }> | null {
  try {
    if (typeof input !== "object" || input === null || !("request" in input)) return null;
    const { executionId, request } = input;
    if (typeof executionId !== "string" || executionId.trim().length === 0) return null;
    return Object.freeze({ executionId, request });
  } catch {
    return null;
  }
}
