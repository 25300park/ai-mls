export type PublicationOperationsErrorCode =
  | "OPERATIONS_UNAUTHORIZED"
  | "OPERATIONS_FORBIDDEN"
  | "OPERATIONS_COMPONENT_UNAVAILABLE"
  | "OPERATIONS_RETRY_NOT_ALLOWED"
  | "OPERATIONS_RETRY_EXHAUSTED"
  | "OPERATIONS_RECOVERY_NOT_ALLOWED"
  | "OPERATIONS_RECOVERY_CONFLICT"
  | "OPERATIONS_DEPENDENCY_FAILURE"
  | "OPERATIONS_INTEGRITY_FAILURE"
  | "OPERATIONS_DEGRADED"
  | "OPERATIONS_PROJECTION_REBUILD_FAILED"
  | "OPERATIONS_STALE_AUTHORITY"
  | "INTERNAL_OPERATIONS_ERROR";

export class PublicationOperationsError extends Error {
  public constructor(public readonly code: PublicationOperationsErrorCode, message: string) {
    super(message);
    this.name = "PublicationOperationsError";
  }
}

export function operationsError(code: PublicationOperationsErrorCode, message: string): PublicationOperationsError {
  return new PublicationOperationsError(code, message);
}
