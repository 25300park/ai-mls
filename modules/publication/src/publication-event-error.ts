export type PublicationEventErrorCode =
  | "EVENT_TYPE_UNSUPPORTED"
  | "EVENT_SCHEMA_VERSION_UNSUPPORTED"
  | "EVENT_CONTRACT_VERSION_UNSUPPORTED"
  | "EVENT_IDENTITY_CONFLICT"
  | "EVENT_SEQUENCE_GAP"
  | "EVENT_OUT_OF_ORDER"
  | "EVENT_AGGREGATE_VERSION_MISMATCH"
  | "EVENT_TENANT_MISMATCH"
  | "EVENT_CLASSIFICATION_VIOLATION"
  | "EVENT_PRIVACY_VIOLATION"
  | "EVENT_AUDIENCE_VIOLATION"
  | "EVENT_PURPOSE_VIOLATION"
  | "EVENT_SOURCE_CONTEXT_UNAVAILABLE"
  | "EVENT_SOURCE_CONTEXT_INVALID"
  | "EVENT_SOURCE_VERSION_STALE"
  | "EVENT_INTEGRITY_FAILURE"
  | "EVENT_PAYLOAD_INVALID"
  | "EVENT_APPEND_FAILED"
  | "EVENT_REPLAY_UNAUTHORIZED"
  | "EVENT_REPLAY_FORBIDDEN_EFFECT"
  | "INTERNAL_EVENT_JOURNAL_ERROR";

export const SAFE_PUBLICATION_EVENT_ERROR_CODES = Object.freeze([
  "EVENT_TYPE_UNSUPPORTED",
  "EVENT_SCHEMA_VERSION_UNSUPPORTED",
  "EVENT_CONTRACT_VERSION_UNSUPPORTED",
  "EVENT_IDENTITY_CONFLICT",
  "EVENT_SEQUENCE_GAP",
  "EVENT_OUT_OF_ORDER",
  "EVENT_AGGREGATE_VERSION_MISMATCH",
  "EVENT_TENANT_MISMATCH",
  "EVENT_CLASSIFICATION_VIOLATION",
  "EVENT_PRIVACY_VIOLATION",
  "EVENT_AUDIENCE_VIOLATION",
  "EVENT_PURPOSE_VIOLATION",
  "EVENT_SOURCE_CONTEXT_UNAVAILABLE",
  "EVENT_SOURCE_CONTEXT_INVALID",
  "EVENT_SOURCE_VERSION_STALE",
  "EVENT_INTEGRITY_FAILURE",
  "EVENT_PAYLOAD_INVALID",
  "EVENT_APPEND_FAILED",
  "EVENT_REPLAY_UNAUTHORIZED",
  "EVENT_REPLAY_FORBIDDEN_EFFECT",
  "INTERNAL_EVENT_JOURNAL_ERROR",
] as const satisfies readonly PublicationEventErrorCode[]);

const safeCodes = new Set<string>(SAFE_PUBLICATION_EVENT_ERROR_CODES);
export interface PublicationEventErrorEvidence { readonly eventId: string; readonly eventType: string; readonly eventSequence: number; readonly correlationId: string }

export class PublicationEventError extends Error {
  public readonly code: PublicationEventErrorCode;
  public readonly evidence?: Readonly<PublicationEventErrorEvidence>;

  public constructor(code: PublicationEventErrorCode, message: string, evidence?: Readonly<PublicationEventErrorEvidence>) {
    const safe = safeCodes.has(code) ? code : "INTERNAL_EVENT_JOURNAL_ERROR";
    super(safe === "INTERNAL_EVENT_JOURNAL_ERROR" ? "Canonical Event operation failed." : message);
    this.code = safe;
    const bounded = boundedEvidence(evidence);
    if (bounded !== undefined) this.evidence = bounded;
    this.name = "PublicationEventError";
  }
}

export function eventError(code: PublicationEventErrorCode, message: string, evidence?: Readonly<{ eventId: string; eventType: string; eventSequence: number; correlationId: string }>): PublicationEventError {
  return new PublicationEventError(code, message, evidence);
}

export function safePublicationEventErrorCode(error: unknown): PublicationEventErrorCode {
  return error instanceof PublicationEventError && safeCodes.has(error.code) ? error.code : "INTERNAL_EVENT_JOURNAL_ERROR";
}

function boundedEvidence(evidence: Readonly<PublicationEventErrorEvidence> | undefined): Readonly<PublicationEventErrorEvidence> | undefined {
  if (evidence === undefined
    || !/^evt_[A-Za-z0-9_-]{1,128}$/u.test(evidence.eventId)
    || !/^EVT-\d{3}$/u.test(evidence.eventType)
    || !Number.isSafeInteger(evidence.eventSequence) || evidence.eventSequence < 1
    || typeof evidence.correlationId !== "string" || evidence.correlationId.trim().length === 0 || evidence.correlationId.length > 256) return undefined;
  return Object.freeze({ ...evidence });
}
