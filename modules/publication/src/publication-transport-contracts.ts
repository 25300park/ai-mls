export type PublicationTransportOperation = "CREATE_PUBLICATION" | "MODIFY_PUBLICATION";

export type PublicationTransportMetadataValue = string | number | boolean | null;
export type PublicationTransportMetadata = Readonly<Record<string, PublicationTransportMetadataValue>>;

export interface PublicationTransportRequestEnvelope {
  readonly requestId: string;
  readonly operation: string;
  readonly payload: unknown;
  readonly metadata: PublicationTransportMetadata;
}

export type PublicationTransportResponseStatus =
  | "SUCCESS"
  | "VALIDATION_ERROR"
  | "OPERATION_NOT_FOUND"
  | "NOT_FOUND"
  | "CONFLICT"
  | "APPLICATION_REJECTED"
  | "INTERNAL_ERROR";

export interface PublicationTransportSuccessData {
  readonly publicationId: string;
  readonly version: number;
  readonly replayed: boolean;
}

export interface PublicationTransportSuccessResponse {
  readonly requestId: string;
  readonly success: true;
  readonly status: "SUCCESS";
  readonly data: PublicationTransportSuccessData;
  readonly metadata: PublicationTransportMetadata;
}

export interface PublicationTransportFailureResponse {
  readonly requestId: string;
  readonly success: false;
  readonly status: Exclude<PublicationTransportResponseStatus, "SUCCESS">;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, PublicationTransportMetadataValue>>;
  };
  readonly metadata: PublicationTransportMetadata;
}

export type PublicationTransportResponse =
  | PublicationTransportSuccessResponse
  | PublicationTransportFailureResponse;

export type PublicationTransportBoundaryErrorCode =
  | "TRANSPORT_REQUEST_INVALID"
  | "TRANSPORT_OPERATION_NOT_FOUND"
  | "TRANSPORT_RUNTIME_NOT_READY"
  | "TRANSPORT_INTERNAL_ERROR";

export class PublicationTransportError extends Error {
  public constructor(
    public readonly code: PublicationTransportBoundaryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationTransportError";
  }
}

export function createPublicationTransportRequestEnvelope(
  value: PublicationTransportRequestEnvelope,
): PublicationTransportRequestEnvelope {
  return immutablePublicationTransportValue(value);
}

export function immutablePublicationTransportValue<Value>(value: Value): Value {
  if (!isTransportJsonValue(value)) throw new TypeError("Transport values must be serialisable data.");
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

export function isTransportJsonValue(value: unknown, ancestors: WeakSet<object> = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  if (Array.isArray(value) && Object.keys(value).length !== value.length) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isTransportJsonValue(item, ancestors))
    : Object.values(value).every((item) => isTransportJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
