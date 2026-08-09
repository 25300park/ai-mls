import type {
  PublicationLifecycleState,
  PublicationSuspensionStatus,
} from "../../../modules/publication/src/publication-contracts.js";
import type { PublicationViewContract } from "./publication-view-contracts.js";
import type { ListingProjectionView } from "../../../modules/publication/src/listing-projection-contracts.js";

export const PUBLICATION_API_COMMAND_OPERATIONS = Object.freeze([
  "CREATE_PUBLICATION",
  "PUBLISH_PUBLICATION",
  "CORRECT_PUBLICATION",
  "SUSPEND_PUBLICATION",
  "RESUME_PUBLICATION",
  "REQUEST_WITHDRAWAL",
  "RESOLVE_WITHDRAWAL",
  "REPUBLISH_PUBLICATION",
  "RESOLVE_RECONCILIATION",
  "RECOVER_PUBLICATION",
  "SUPERSEDE_PUBLICATION",
  "TERMINATE_PUBLICATION",
] as const);

export const PUBLICATION_API_QUERY_OPERATIONS = Object.freeze([
  "GET_PUBLICATION",
  "GET_PUBLICATION_OPERATIONS_VIEW",
  "GET_PUBLICATION_REVALIDATION_VIEW",
  "GET_PUBLICATION_RECOVERY_VIEW",
  "GET_PUBLICATION_AUDIT_VIEW",
  "GET_LISTING_PROJECTION",
] as const);

export type PublicationApiCommandOperation = typeof PUBLICATION_API_COMMAND_OPERATIONS[number];
export type PublicationApiQueryOperation = typeof PUBLICATION_API_QUERY_OPERATIONS[number];

interface PublicationApiRequestContext {
  readonly requestId: string;
  readonly sessionId?: string;
  readonly tenantId: string;
  readonly teamId: string;
  readonly purpose: "PUBLICATION_EXECUTION";
  readonly correlationId: string;
  readonly publicationId: string;
}

export interface PublicationCommandRequest extends PublicationApiRequestContext {
  readonly operation: PublicationApiCommandOperation;
  readonly idempotencyKey: string;
  readonly intentFingerprint: string;
  readonly documentedReason: string;
  /** Compatibility-only request claim. The canonical command path ignores this value. */
  readonly actorId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface PublicationQueryRequest extends PublicationApiRequestContext {
  readonly operation: PublicationApiQueryOperation;
  readonly maxEntries?: number;
}

export interface PublicationApiCommandResult {
  readonly publicationId: string;
  readonly lifecycle: PublicationLifecycleState;
  readonly suspensionStatus: PublicationSuspensionStatus;
  readonly aggregateVersion: number;
  readonly effectiveVersion?: number;
  readonly attemptId?: string;
  readonly reconciliationStatus?: string;
  readonly replayed: boolean;
}

export interface PublicationApiQueryResult {
  readonly view: PublicationViewContract | ListingProjectionView;
  readonly sourceVersion: number;
  readonly generatedAt: string;
  readonly stale: boolean;
  readonly provenance: Readonly<{
    readonly source: "CANONICAL_PUBLICATION" | "LISTING_PROJECTION";
    readonly historyKind?: "PUBLICATION_AUDIT_HISTORY";
  }>;
}

export type PublicationApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "AUTHORIZATION_DENIED"
  | "SEPARATION_OF_DUTIES_DENIED"
  | "MFA_REQUIRED"
  | "REASON_REQUIRED"
  | "APPROVAL_NOT_EFFECTIVE"
  | "VERIFICATION_NOT_EFFECTIVE"
  | "PERMISSION_NOT_EFFECTIVE"
  | "BINDING_MISMATCH"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_PUBLICATION_STATE"
  | "RECONCILIATION_REQUIRED"
  | "INTERNAL_API_ERROR";

export interface PublicationApiMetadata {
  readonly correlationId: string;
}

export type PublicationApiResponse<Result, Operation extends string> =
  | Readonly<{
      readonly requestId: string;
      readonly success: true;
      readonly operation: Operation;
      readonly result: Result;
      readonly metadata: PublicationApiMetadata;
    }>
  | Readonly<{
      readonly requestId?: string;
      readonly success: false;
      readonly operation?: Operation;
      readonly error: Readonly<{ readonly code: PublicationApiErrorCode; readonly message: string }>;
      readonly metadata: PublicationApiMetadata;
    }>;

export type PublicationCommandResponse = PublicationApiResponse<PublicationApiCommandResult, PublicationApiCommandOperation>;
export type PublicationQueryResponse = PublicationApiResponse<PublicationApiQueryResult, PublicationApiQueryOperation>;

export function immutableApiValue<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
