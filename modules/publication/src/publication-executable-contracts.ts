export type PublicationExecutableState =
  | "CREATED"
  | "STARTING"
  | "READY"
  | "EXECUTING"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export type PublicationExecutableLastExecutionStatus =
  | "NOT_EXECUTED"
  | "SUCCESS"
  | "FAILURE";

export type PublicationExecutableErrorCode =
  | "INVALID_CONFIGURATION"
  | "EXECUTABLE_NOT_READY"
  | "EXECUTABLE_STOPPED"
  | "HOST_START_FAILURE"
  | "HOST_EXECUTION_FAILURE"
  | "HOST_STOP_FAILURE"
  | "INTERNAL_EXECUTABLE_ERROR";

export const publicationExecutableCapabilities = Object.freeze([
  "START",
  "EXECUTE",
  "STOP",
  "STATUS",
  "DIAGNOSTICS",
] as const);

export type PublicationExecutableCapability = typeof publicationExecutableCapabilities[number];
export type PublicationExecutableScalar = null | boolean | number | string;
export type PublicationExecutableValue =
  | PublicationExecutableScalar
  | readonly PublicationExecutableValue[]
  | { readonly [key: string]: PublicationExecutableValue };

export interface PublicationExecutableStateSnapshot {
  readonly state: PublicationExecutableState;
  readonly sequence: number;
}

export interface PublicationExecutableDiagnostics {
  readonly executableState: PublicationExecutableState;
  readonly hostState: string | null;
  readonly started: boolean;
  readonly stopped: boolean;
  readonly executionCount: number;
  readonly lastExecutionStatus: PublicationExecutableLastExecutionStatus;
  readonly capabilities: readonly PublicationExecutableCapability[];
}

export interface PublicationExecutableFailure {
  readonly code: PublicationExecutableErrorCode;
  readonly message: string;
}

export interface PublicationExecutableRequest {
  readonly executionId: string;
  readonly request: unknown;
}

export interface PublicationExecutableResult {
  readonly executionId: string;
  readonly success: boolean;
  readonly state: PublicationExecutableState;
  readonly result: PublicationExecutableValue;
  readonly error: PublicationExecutableFailure | null;
  readonly diagnostics: PublicationExecutableDiagnostics;
}

export class PublicationExecutableError extends Error {
  public constructor(
    public readonly code: PublicationExecutableErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationExecutableError";
  }
}

export function immutablePublicationExecutableStateSnapshot(
  state: PublicationExecutableState,
  sequence: number,
): PublicationExecutableStateSnapshot {
  return Object.freeze({ state, sequence });
}

export function immutablePublicationExecutableDiagnostics(
  value: Omit<PublicationExecutableDiagnostics, "capabilities">,
): PublicationExecutableDiagnostics {
  return Object.freeze({
    ...value,
    capabilities: Object.freeze([...publicationExecutableCapabilities]),
  });
}

export function immutablePublicationExecutableResult(
  value: Omit<PublicationExecutableResult, "result" | "error" | "diagnostics"> & {
    readonly result: unknown;
    readonly error: PublicationExecutableFailure | null;
    readonly diagnostics: PublicationExecutableDiagnostics;
  },
): PublicationExecutableResult {
  return Object.freeze({
    ...value,
    result: immutablePublicationExecutableValue(value.result),
    error: value.error === null ? null : Object.freeze({ ...value.error }),
    diagnostics: immutablePublicationExecutableDiagnostics({
      executableState: value.diagnostics.executableState,
      hostState: value.diagnostics.hostState,
      started: value.diagnostics.started,
      stopped: value.diagnostics.stopped,
      executionCount: value.diagnostics.executionCount,
      lastExecutionStatus: value.diagnostics.lastExecutionStatus,
    }),
  });
}

export function immutablePublicationExecutableValue(value: unknown): PublicationExecutableValue {
  return copyExecutableValue(value, new Set<object>());
}

function copyExecutableValue(
  value: unknown,
  ancestors: Set<object>,
): PublicationExecutableValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") {
    throw new PublicationExecutableError(
      "INTERNAL_EXECUTABLE_ERROR",
      "Executable value is not serialisable.",
    );
  }
  if (ancestors.has(value)) {
    throw new PublicationExecutableError(
      "INTERNAL_EXECUTABLE_ERROR",
      "Executable value is not serialisable.",
    );
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => copyExecutableValue(item, ancestors)));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new PublicationExecutableError(
        "INTERNAL_EXECUTABLE_ERROR",
        "Executable value is not serialisable.",
      );
    }
    const output: Record<string, PublicationExecutableValue> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = copyExecutableValue(item, ancestors);
    }
    return Object.freeze(output);
  } finally {
    ancestors.delete(value);
  }
}
