import { AuthenticationError } from "../../../modules/identity/src/session-service.js";

const publicDomainErrorCodes = new Set([
  "SOURCE_NOT_ALLOWED", "SOURCE_POLICY_STALE", "SOURCE_NOT_FOUND", "PROVENANCE_REQUIRED",
  "EVIDENCE_INVALID", "CONTENT_QUARANTINED", "STATE_TRANSITION_INVALID", "VERSION_CONFLICT",
  "AI_REQUEST_NOT_ELIGIBLE", "JOB_TYPE_NOT_ALLOWED", "JOB_INPUT_STALE", "JOB_NOT_FOUND",
  "JOB_ALREADY_TERMINAL", "JOB_CANCEL_CONFLICT", "IDEMPOTENCY_CONFLICT", "RETRY_NOT_SAFE",
  "RETRY_LIMIT_REACHED", "DEPENDENCY_UNAVAILABLE", "JOB_RESULT_INVALID",
  "PROPERTY_INPUT_INVALID", "PROPERTY_ALIAS_INVALID", "PROPERTY_NOT_FOUND",
  "CANDIDATE_NOT_FOUND", "DUPLICATE_GROUP_NOT_FOUND", "DUPLICATE_EVIDENCE_REQUIRED",
  "OFFER_NOT_FOUND", "SENIOR_REVIEW_REQUIRED", "CLASSIFICATION_REQUIRED",
  "AI_RESULT_NOT_FOUND", "AI_RESULT_SCHEMA_INVALID", "EVIDENCE_MISMATCH",
  "CLASSIFICATION_DOWNGRADE_DENIED", "PROHIBITED_AUTHORITY_FIELD", "REASON_REQUIRED",
]);

export interface RequestContext {
  readonly requestId?: string;
  readonly correlationId: string;
  readonly sessionId?: string;
}

export interface ResponseMeta {
  readonly requestId?: string;
  readonly correlationId: string;
}

export type ApiResponse<T> =
  | Readonly<{ readonly ok: true; readonly data: T; readonly meta: ResponseMeta }>
  | Readonly<{
      readonly ok: false;
      readonly error: Readonly<{ readonly code: string; readonly message: string }>;
      readonly meta: ResponseMeta;
    }>;

function meta(context: RequestContext): ResponseMeta {
  return Object.freeze({
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
    correlationId: context.correlationId,
  });
}

export function executeBoundary<T>(
  context: RequestContext,
  operation: () => T,
): ApiResponse<T> {
  try {
    return Object.freeze({ ok: true, data: operation(), meta: meta(context) });
  } catch (error: unknown) {
    const publicError = error instanceof AuthenticationError
      ? { code: error.code, message: error.publicMessage }
      : error instanceof Error && publicDomainErrorCodes.has(error.message)
        ? { code: error.message, message: "Request could not be completed." }
        : { code: "REQUEST_REJECTED", message: "Request could not be completed." };
    return Object.freeze({
      ok: false,
      error: Object.freeze(publicError),
      meta: meta(context),
    });
  }
}

export function requireSessionId(context: RequestContext): string {
  if (context.sessionId === undefined || context.sessionId.trim().length === 0) {
    throw new AuthenticationError("AUTHENTICATION_REQUIRED", "Authentication required.");
  }
  return context.sessionId;
}
