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
  "CONTACT_NOT_FOUND", "CONTACT_ACCESS_DENIED", "PURPOSE_REQUIRED", "CHANNEL_UNAVAILABLE",
  "DO_NOT_CONTACT", "CONSENT_SCOPE_DENIED", "SENSITIVE_FIELD_RESTRICTED",
  "CLIENT_NOT_FOUND", "CLIENT_SCOPE_DENIED", "REQUIREMENT_INVALID", "CRITERIA_CONFLICT",
  "REQUIREMENT_NOT_ACTIVE", "AI_INPUT_NOT_ALLOWED",
  "MATCH_REQUEST_DENIED", "MATCH_COHORT_LIMIT_EXCEEDED", "MATCH_RUN_NOT_FOUND",
  "MATCH_RESULT_NOT_FOUND", "MATCH_INPUT_STALE", "MATCH_REVIEW_REQUIRED",
  "VERIFICATION_NOT_FOUND", "VERIFICATION_EVIDENCE_REQUIRED", "VERIFIER_ASSIGNMENT_INVALID",
  "VERIFIER_ASSIGNMENT_DENIED", "MANAGER_OVERRIDE_DENIED", "REVERIFICATION_NOT_REQUIRED",
  "SERVICE_AUTHORITY_REQUIRED",
  "PERMISSION_NOT_FOUND", "PERMISSION_AUDIENCE_INVALID", "PERMISSION_PURPOSE_INVALID",
  "PERMISSION_PURPOSE_DENIED", "PERMISSION_SUCCESSOR_INVALID",
  "PERMISSION_VALIDITY_INVALID", "PERMISSION_DECISION_DENIED", "PERMISSION_SCOPE_INVALID",
  "CONTACT_DISCLOSURE_SCOPE_INVALID", "VERIFICATION_NOT_EFFECTIVE", "VERIFICATION_SCOPE_INVALID",
  "TEAM_SCOPE_REQUIRED", "IDEMPOTENCY_KEY_REQUIRED",
  "PROPOSAL_NOT_FOUND", "VERIFICATION_REQUIRED", "VERIFICATION_STALE",
  "PERMISSION_REQUIRED", "PERMISSION_EXPIRED", "PERMISSION_SCOPE_MISMATCH",
  "APPROVAL_REQUIRED", "APPROVAL_EXPIRED", "APPROVAL_REVOKED", "APPROVAL_NOT_EFFECTIVE",
  "APPROVAL_ASSIGNMENT_REQUIRED", "APPROVAL_CONFLICT", "APPROVER_NOT_ELIGIBLE",
  "REPRESENTATION_CHANGED", "REPRESENTATION_CHECKSUM_MISMATCH", "SUBJECT_REVISION_CHANGED",
  "TARGET_NOT_ALLOWED", "CHANNEL_NOT_ALLOWED", "TARGET_POLICY_CHANGED", "CHANNEL_POLICY_CHANGED",
  "PUBLICATION_NOT_ELIGIBLE", "MFA_REQUIRED", "EXPECTED_VERSION_MISMATCH", "FORBIDDEN", "NOT_FOUND",
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
