import type { PublicationInterfaceResponse } from "./publication-interface-models.js";
import {
  immutablePublicationTransportValue,
  type PublicationTransportFailureResponse,
  type PublicationTransportRequestEnvelope,
  type PublicationTransportResponse,
} from "./publication-transport-contracts.js";

export class DeterministicPublicationTransportResponseMapper {
  public map(
    request: PublicationTransportRequestEnvelope,
    response: PublicationInterfaceResponse,
  ): PublicationTransportResponse {
    if (!isValidInterfaceResponse(response)) return internalFailure(request);
    if (response.operationResult === "SUCCEEDED") {
      return immutablePublicationTransportValue({
        requestId: request.requestId,
        success: true as const,
        status: "SUCCESS" as const,
        data: {
          publicationId: response.publicationId,
          version: response.version,
          replayed: response.replayed,
        },
        metadata: request.metadata,
      });
    }
    return mapInterfaceFailure(request, response.failureCode);
  }
}

function mapInterfaceFailure(
  request: PublicationTransportRequestEnvelope,
  code: string,
): PublicationTransportFailureResponse {
  if (validationCodes.has(code)) return failure(request, "VALIDATION_ERROR", code, "Transport request is invalid.");
  if (code === "PUBLICATION_NOT_FOUND") return failure(request, "NOT_FOUND", code, "Requested publication was not found.");
  if (conflictCodes.has(code)) return failure(request, "CONFLICT", code, "Publication operation conflicts with current state.");
  if (internalCodes.has(code)) return failure(request, "INTERNAL_ERROR", "TRANSPORT_INTERNAL_ERROR", "Transport request could not be completed.");
  if (applicationRejectionCodes.has(code)) return failure(request, "APPLICATION_REJECTED", code, "Publication operation was rejected.");
  return internalFailure(request);
}

function internalFailure(request: PublicationTransportRequestEnvelope): PublicationTransportFailureResponse {
  return failure(request, "INTERNAL_ERROR", "TRANSPORT_INTERNAL_ERROR", "Transport request could not be completed.");
}

function failure(
  request: PublicationTransportRequestEnvelope,
  status: PublicationTransportFailureResponse["status"],
  code: string,
  message: string,
): PublicationTransportFailureResponse {
  return immutablePublicationTransportValue({
    requestId: request.requestId,
    success: false as const,
    status,
    error: { code, message },
    metadata: request.metadata,
  });
}

const validationCodes = new Set([
  "INTERFACE_REQUEST_INVALID",
  "APPLICATION_CONTEXT_INVALID",
  "APPLICATION_RESULT_REFERENCE_INVALID",
  "PUBLICATION_INPUT_INVALID",
  "PUBLICATION_IDENTITY_INVALID",
  "PUBLICATION_BINDING_INVALID",
]);

const conflictCodes = new Set([
  "PUBLICATION_VERSION_CONFLICT",
  "PUBLICATION_ALREADY_EXISTS",
  "PUBLICATION_DUPLICATE_ENTITY",
  "IDEMPOTENCY_CONFLICT",
]);

const internalCodes = new Set([
  "INTERFACE_EXECUTION_FAILED",
  "APPLICATION_COMMIT_FAILED",
  "APPLICATION_EXECUTION_FAILED",
]);

const applicationRejectionCodes = new Set([
  "PUBLICATION_STATE_INVALID",
  "PUBLICATION_TRANSITION_INVALID",
  "PUBLICATION_INVARIANT_VIOLATION",
  "PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR",
]);

function isValidInterfaceResponse(value: unknown): value is PublicationInterfaceResponse {
  if (!isRecord(value) || typeof value["operationResult"] !== "string") return false;
  if (value["operationResult"] === "SUCCEEDED") {
    return hasExactKeys(value, ["operationResult", "publicationId", "version", "replayed"])
      && validIdentifier(value["publicationId"])
      && Number.isSafeInteger(value["version"])
      && (value["version"] as number) > 0
      && typeof value["replayed"] === "boolean";
  }
  return value["operationResult"] === "FAILED"
    && hasExactKeys(value, ["operationResult", "failureCode"])
    && validIdentifier(value["failureCode"]);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^\S+$/.test(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
