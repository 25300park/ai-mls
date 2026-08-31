/** Internal diagnostic categories only: never a Publication state or retry permission. */
export type PublicationExecutionFailure =
  | "VALIDATION_FAILURE" | "AUTHORIZATION_FAILURE" | "APPROVAL_STALE_OR_INVALID"
  | "TARGET_UNAVAILABLE" | "IDEMPOTENCY_CONFLICT" | "PROVIDER_REJECTED"
  | "PROVIDER_TIMEOUT" | "PROVIDER_CONNECTION_FAILURE" | "PROVIDER_MALFORMED_RESPONSE"
  | "PROVIDER_UNAVAILABLE" | "INTERNAL_PERSISTENCE_FAILURE" | "AMBIGUOUS_EXTERNAL_OUTCOME";

export interface PublicationExecutionFailureInput {
  readonly code?: string;
  readonly outcome?: "CONFIRMED" | "REJECTED" | "UNKNOWN";
  readonly dispatchStarted?: boolean;
  readonly authoritativeReceipt?: boolean;
}

const failureCodes: Readonly<Record<string, PublicationExecutionFailure>> = Object.freeze({
  PUBLICATION_INPUT_INVALID: "VALIDATION_FAILURE",
  AUTHENTICATION_REQUIRED: "AUTHORIZATION_FAILURE", AUTHORIZATION_DENIED: "AUTHORIZATION_FAILURE",
  PURPOSE_SCOPE_DENIED: "AUTHORIZATION_FAILURE", MFA_REQUIRED: "AUTHORIZATION_FAILURE",
  SEPARATION_OF_DUTIES_DENIED: "AUTHORIZATION_FAILURE", PERMISSION_NOT_EFFECTIVE: "AUTHORIZATION_FAILURE",
  VERIFICATION_NOT_EFFECTIVE: "APPROVAL_STALE_OR_INVALID", APPROVAL_NOT_EFFECTIVE: "APPROVAL_STALE_OR_INVALID",
  PUBLICATION_TARGET_INACTIVE: "TARGET_UNAVAILABLE", IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  CONNECTOR_REJECTED: "PROVIDER_REJECTED", ETIMEDOUT: "PROVIDER_TIMEOUT",
  ECONNRESET: "PROVIDER_CONNECTION_FAILURE", ECONNREFUSED: "PROVIDER_CONNECTION_FAILURE",
  CONNECTOR_RESULT_INVALID: "PROVIDER_MALFORMED_RESPONSE", CONNECTOR_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PERSISTENCE_WRITE_FAILED: "INTERNAL_PERSISTENCE_FAILURE",
});

export function classifyPublicationExecutionFailure(input: PublicationExecutionFailureInput): PublicationExecutionFailure | undefined {
  if (input.outcome === "UNKNOWN" || (input.dispatchStarted === true && input.authoritativeReceipt !== true)) return "AMBIGUOUS_EXTERNAL_OUTCOME";
  if (input.outcome === "CONFIRMED" && input.authoritativeReceipt === true) return undefined;
  if (input.outcome === "REJECTED") return "PROVIDER_REJECTED";
  return input.code !== undefined && Object.hasOwn(failureCodes, input.code)
    ? failureCodes[input.code] : "AMBIGUOUS_EXTERNAL_OUTCOME";
}
