import type { PublicationInfrastructureConfigurationInput } from "./publication-infrastructure-configuration.js";
import {
  createPublicationInfrastructure,
  type PublicationInfrastructure,
} from "./publication-infrastructure.js";
import {
  immutableRuntimeContext,
  immutableRuntimeHealth,
  PublicationRuntimeError,
  type PublicationRuntimeContext,
  type PublicationRuntimeFailureCode,
  type PublicationRuntimeHealth,
} from "./publication-runtime-contracts.js";
import {
  createPublicationRuntimeServiceRegistry,
  type PublicationRuntimeServiceRegistry,
} from "./publication-runtime-registry.js";

export class PublicationRuntime {
  private currentContext: PublicationRuntimeContext;

  public constructor(public readonly services: PublicationRuntimeServiceRegistry) {
    this.currentContext = immutableRuntimeContext({
      status: "CREATED",
      registeredServices: services.serviceNames,
    });
  }

  public get context(): PublicationRuntimeContext {
    return this.currentContext;
  }

  public get entryPoint(): PublicationRuntimeServiceRegistry["inputPort"] {
    return this.services.inputPort;
  }

  public get health(): PublicationRuntimeHealth {
    return immutableRuntimeHealth({
      healthy: this.currentContext.status === "READY",
      compositionCompleted: true,
      requiredServicesRegistered: true,
      applicationEntryPointAvailable: true,
      runtimeStatus: this.currentContext.status,
    });
  }

  public initialize(): PublicationRuntimeContext {
    this.requireStatus("CREATED");
    return this.transition("INITIALIZED", this.services.clock.now());
  }

  public start(): PublicationRuntimeContext {
    this.requireStatus("INITIALIZED");
    return this.transition("STARTED");
  }

  public ready(): PublicationRuntimeContext {
    this.requireStatus("STARTED");
    return this.transition("READY");
  }

  public execute(
    request: Parameters<PublicationRuntimeServiceRegistry["inputPort"]["execute"]>[0],
  ): ReturnType<PublicationRuntimeServiceRegistry["inputPort"]["execute"]> {
    if (this.currentContext.status !== "READY") {
      throw new PublicationRuntimeError("RUNTIME_NOT_READY", "Runtime is not ready for execution.");
    }
    return this.entryPoint.execute(request);
  }

  public stop(): PublicationRuntimeContext {
    if (this.currentContext.status === "STOPPED" || this.currentContext.status === "DISPOSED") {
      throw new PublicationRuntimeError("RUNTIME_ALREADY_STOPPED", "Runtime shutdown has already completed.");
    }
    if (this.currentContext.status !== "READY" && this.currentContext.status !== "STARTED") {
      throw new PublicationRuntimeError("RUNTIME_LIFECYCLE_INVALID", "Runtime cannot stop from its current state.");
    }
    return this.transition("STOPPED");
  }

  public dispose(): PublicationRuntimeContext {
    if (this.currentContext.status === "DISPOSED") {
      throw new PublicationRuntimeError("RUNTIME_ALREADY_DISPOSED", "Runtime has already been disposed.");
    }
    this.requireStatus("STOPPED");
    return this.transition("DISPOSED");
  }

  private requireStatus(expected: PublicationRuntimeContext["status"]): void {
    if (this.currentContext.status !== expected) {
      throw new PublicationRuntimeError("RUNTIME_LIFECYCLE_INVALID", "Runtime lifecycle transition is invalid.");
    }
  }

  private transition(status: PublicationRuntimeContext["status"], startupTime = this.currentContext.startupTime): PublicationRuntimeContext {
    this.currentContext = immutableRuntimeContext({
      ...(startupTime === undefined ? {} : { startupTime }),
      status,
      registeredServices: this.services.serviceNames,
    });
    return this.currentContext;
  }
}

export type PublicationInfrastructureFactory = (
  configuration: PublicationInfrastructureConfigurationInput,
) => PublicationInfrastructure;

export interface PublicationRuntimeBootstrapOptions {
  readonly infrastructureConfiguration?: PublicationInfrastructureConfigurationInput;
  readonly infrastructureFactory?: PublicationInfrastructureFactory;
}

export interface PublicationRuntimeBootstrapSuccess {
  readonly ok: true;
  readonly runtime: PublicationRuntime;
}

export interface PublicationRuntimeBootstrapFailure {
  readonly ok: false;
  readonly error: Readonly<{ readonly code: PublicationRuntimeFailureCode }>;
}

export type PublicationRuntimeBootstrapResult =
  | PublicationRuntimeBootstrapSuccess
  | PublicationRuntimeBootstrapFailure;

export function bootstrapPublicationRuntime(
  options: PublicationRuntimeBootstrapOptions = {},
): PublicationRuntimeBootstrapResult {
  try {
    const factory = options.infrastructureFactory ?? createPublicationInfrastructure;
    const infrastructure = factory(options.infrastructureConfiguration ?? {});
    const runtime = new PublicationRuntime(createPublicationRuntimeServiceRegistry(infrastructure));
    runtime.initialize();
    runtime.start();
    runtime.ready();
    return Object.freeze({ ok: true as const, runtime });
  } catch (error) {
    const code = error instanceof PublicationRuntimeError
      ? error.code
      : "RUNTIME_STARTUP_FAILED";
    return Object.freeze({
      ok: false as const,
      error: Object.freeze({ code }),
    });
  }
}
