import {
  immutablePublicationTransportValue,
  isTransportJsonValue,
  type PublicationTransportMetadata,
  type PublicationTransportRequestEnvelope,
} from "./publication-transport-contracts.js";

export interface ValidPublicationTransportRequest {
  readonly valid: true;
}

export interface InvalidPublicationTransportRequest {
  readonly valid: false;
  readonly failureCode: "TRANSPORT_REQUEST_INVALID";
}

export type PublicationTransportValidationResult =
  | ValidPublicationTransportRequest
  | InvalidPublicationTransportRequest;

export interface PublicationTransportResponseContext {
  readonly requestId: string;
  readonly metadata: PublicationTransportMetadata;
}

export class StructuralPublicationTransportValidator {
  public validate(value: unknown): PublicationTransportValidationResult {
    const valid = isRecord(value)
      && hasOnlyKeys(value, ["requestId", "operation", "payload", "metadata"])
      && validIdentifier(value["requestId"])
      && nonBlankString(value["operation"])
      && "payload" in value
      && isRecord(value["payload"])
      && isTransportJsonValue(value["payload"])
      && validMetadata(value["metadata"]);
    return immutablePublicationTransportValue(valid
      ? { valid: true as const }
      : { valid: false as const, failureCode: "TRANSPORT_REQUEST_INVALID" as const });
  }
}

export function transportResponseContext(value: unknown): PublicationTransportResponseContext {
  try {
    if (!isRecord(value)) return immutablePublicationTransportValue({ requestId: "UNKNOWN_REQUEST", metadata: {} });
    const requestId = validIdentifier(value["requestId"]) ? value["requestId"] : "UNKNOWN_REQUEST";
    const metadata = validMetadata(value["metadata"]) ? value["metadata"] : {};
    return immutablePublicationTransportValue({ requestId, metadata });
  } catch {
    return immutablePublicationTransportValue({ requestId: "UNKNOWN_REQUEST", metadata: {} });
  }
}

export function isPublicationTransportRequestEnvelope(value: unknown): value is PublicationTransportRequestEnvelope {
  return new StructuralPublicationTransportValidator().validate(value).valid;
}

function validMetadata(value: unknown): value is PublicationTransportMetadata {
  return isRecord(value)
    && Object.values(value).every((item) => item === null
      || typeof item === "string"
      || typeof item === "boolean"
      || (typeof item === "number" && Number.isFinite(item)));
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^\S+$/.test(value);
}

function nonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
