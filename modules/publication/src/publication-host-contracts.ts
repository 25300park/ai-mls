export type PublicationHostState =
  | "CREATED"
  | "INITIALISING"
  | "READY"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export type PublicationHostShutdownStatus =
  | "NOT_STARTED"
  | "NOT_REQUESTED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "FAILED";

export const publicationHostCapabilities = Object.freeze([
  "EXECUTE",
  "STATUS",
  "DIAGNOSTICS",
  "SHUTDOWN",
] as const);

export type PublicationHostCapability = typeof publicationHostCapabilities[number];

export interface PublicationHostStateSnapshot {
  readonly state: PublicationHostState;
  readonly sequence: number;
}

export interface PublicationHostDiagnostics {
  readonly lifecycleState: PublicationHostState;
  readonly startupDurationMs: number | null;
  readonly shutdownStatus: PublicationHostShutdownStatus;
  readonly registeredCapabilities: readonly PublicationHostCapability[];
}

export type PublicationHostErrorCode =
  | "HOST_ALREADY_STARTED"
  | "HOST_NOT_READY"
  | "HOST_TRANSITION_INVALID"
  | "HOST_BOOTSTRAP_FAILED"
  | "HOST_RUNTIME_FAILURE"
  | "HOST_SHUTDOWN_FAILED";

export class PublicationHostError extends Error {
  public constructor(
    public readonly code: PublicationHostErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationHostError";
  }
}

export function immutablePublicationHostStateSnapshot(
  state: PublicationHostState,
  sequence: number,
): PublicationHostStateSnapshot {
  return Object.freeze({ state, sequence });
}

export function immutablePublicationHostDiagnostics(
  diagnostics: Omit<PublicationHostDiagnostics, "registeredCapabilities"> & {
    readonly registeredCapabilities?: readonly PublicationHostCapability[];
  },
): PublicationHostDiagnostics {
  return Object.freeze({
    ...diagnostics,
    registeredCapabilities: Object.freeze([
      ...(diagnostics.registeredCapabilities ?? publicationHostCapabilities),
    ]),
  });
}
