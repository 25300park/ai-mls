import type { PublicationApplicationErrorResult } from "../../../modules/publication/src/publication-application-contracts.js";
import { PublicationAuthorizationError } from "../../../modules/publication/src/publication-authorization.js";
import type { PublicationApiErrorCode } from "./publication-api-contracts.js";

export class PublicationApiError extends Error {
  public constructor(public readonly code: PublicationApiErrorCode) {
    super(code);
    this.name = "PublicationApiError";
  }
}

const safeCodeMap: Readonly<Record<string, PublicationApiErrorCode>> = Object.freeze({
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  PURPOSE_SCOPE_DENIED: "AUTHORIZATION_DENIED",
  SEPARATION_OF_DUTIES_DENIED: "SEPARATION_OF_DUTIES_DENIED",
  MFA_REQUIRED: "MFA_REQUIRED",
  REASON_REQUIRED: "REASON_REQUIRED",
  APPROVAL_NOT_EFFECTIVE: "APPROVAL_NOT_EFFECTIVE",
  VERIFICATION_NOT_EFFECTIVE: "VERIFICATION_NOT_EFFECTIVE",
  PERMISSION_NOT_EFFECTIVE: "PERMISSION_NOT_EFFECTIVE",
  BINDING_MISMATCH: "BINDING_MISMATCH",
  POLICY_VERSION_STALE: "BINDING_MISMATCH",
  PUBLICATION_VERSION_CONFLICT: "VERSION_CONFLICT",
  EXPECTED_VERSION_MISMATCH: "VERSION_CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  PUBLICATION_NOT_FOUND: "NOT_FOUND",
  RECOVERY_REQUEST_INVALID: "VALIDATION_ERROR",
  APPLICATION_CONTEXT_INVALID: "VALIDATION_ERROR",
  INTERFACE_REQUEST_INVALID: "VALIDATION_ERROR",
  PUBLICATION_TRANSITION_INVALID: "INVALID_PUBLICATION_STATE",
  PUBLICATION_STATE_INVALID: "INVALID_PUBLICATION_STATE",
  INVALID_PUBLICATION_STATE: "INVALID_PUBLICATION_STATE",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
});

export function mapPublicationApiError(error: unknown): PublicationApiErrorCode {
  if (error instanceof PublicationApiError) return error.code;
  if (error instanceof PublicationAuthorizationError) return safeCodeMap[error.code] ?? "AUTHORIZATION_DENIED";
  return "INTERNAL_API_ERROR";
}

export function mapPublicationApplicationFailure(result: PublicationApplicationErrorResult): PublicationApiErrorCode {
  return safeCodeMap[result.error.code]
    ?? (result.error.category === "VALIDATION" ? "VALIDATION_ERROR"
      : result.error.category === "NOT_FOUND" ? "NOT_FOUND"
        : result.error.category === "CONFLICT" ? "VERSION_CONFLICT"
          : result.error.category === "DOMAIN_REJECTION" ? "INVALID_PUBLICATION_STATE"
            : "INTERNAL_API_ERROR");
}

export function safePublicationApiMessage(code: PublicationApiErrorCode): string {
  if (code === "AUTHENTICATION_REQUIRED") return "Authentication required.";
  if (code === "NOT_FOUND") return "Resource not found.";
  if (code === "VALIDATION_ERROR") return "Request validation failed.";
  return "Request could not be completed.";
}
