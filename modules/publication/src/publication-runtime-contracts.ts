export type PublicationRuntimeStatus =
  | "CREATED"
  | "INITIALIZED"
  | "STARTED"
  | "READY"
  | "STOPPED"
  | "DISPOSED";

export type PublicationRuntimeServiceName =
  | "inputPort"
  | "unitOfWork"
  | "repository"
  | "idempotency"
  | "audit"
  | "clock"
  | "authorization"
  | "authorizationEvidence"
  | "coordination"
  | "lifecycle"
  | "connectorDispatcher";

export type PublicationRuntimeFailureCode =
  | "RUNTIME_STARTUP_FAILED"
  | "RUNTIME_DEPENDENCY_MISSING"
  | "RUNTIME_CONFIGURATION_INCONSISTENT"
  | "RUNTIME_LIFECYCLE_INVALID"
  | "RUNTIME_NOT_READY"
  | "RUNTIME_ALREADY_STOPPED"
  | "RUNTIME_ALREADY_DISPOSED";

export interface PublicationRuntimeContext {
  readonly startupTime?: string;
  readonly status: PublicationRuntimeStatus;
  readonly registeredServices: readonly PublicationRuntimeServiceName[];
}

export interface PublicationRuntimeHealth {
  readonly healthy: boolean;
  readonly compositionCompleted: boolean;
  readonly requiredServicesRegistered: boolean;
  readonly applicationEntryPointAvailable: boolean;
  readonly runtimeStatus: PublicationRuntimeStatus;
}

export class PublicationRuntimeError extends Error {
  public constructor(
    public readonly code: PublicationRuntimeFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationRuntimeError";
  }
}

export function immutableRuntimeContext(
  value: PublicationRuntimeContext,
): PublicationRuntimeContext {
  const registeredServices = Object.freeze([...value.registeredServices]);
  return Object.freeze({ ...value, registeredServices });
}

export function immutableRuntimeHealth(
  value: PublicationRuntimeHealth,
): PublicationRuntimeHealth {
  return Object.freeze({ ...value });
}
