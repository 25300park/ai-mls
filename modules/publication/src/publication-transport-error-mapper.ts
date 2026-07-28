import { PublicationRuntimeError } from "./publication-runtime-contracts.js";
import {
  immutablePublicationTransportValue,
  PublicationTransportError,
  type PublicationTransportFailureResponse,
} from "./publication-transport-contracts.js";
import {
  transportResponseContext,
  type PublicationTransportResponseContext,
} from "./publication-transport-validation.js";

export class DeterministicPublicationTransportErrorMapper {
  public map(
    request: unknown,
    error: unknown,
  ): PublicationTransportFailureResponse {
    const context = transportResponseContext(request);
    if (error instanceof PublicationTransportError) return this.mapBoundaryError(context, error);
    if (error instanceof PublicationRuntimeError && error.code === "RUNTIME_NOT_READY") {
      return failure(
        context,
        "APPLICATION_REJECTED",
        "TRANSPORT_RUNTIME_NOT_READY",
        "Runtime is not ready for transport execution.",
      );
    }
    return failure(context, "INTERNAL_ERROR", "TRANSPORT_INTERNAL_ERROR", "Transport request could not be completed.");
  }

  private mapBoundaryError(
    context: PublicationTransportResponseContext,
    error: PublicationTransportError,
  ): PublicationTransportFailureResponse {
    switch (error.code) {
      case "TRANSPORT_REQUEST_INVALID":
        return failure(context, "VALIDATION_ERROR", error.code, "Transport request is invalid.");
      case "TRANSPORT_OPERATION_NOT_FOUND":
        return failure(context, "OPERATION_NOT_FOUND", error.code, "Transport operation is not supported.");
      case "TRANSPORT_RUNTIME_NOT_READY":
        return failure(context, "APPLICATION_REJECTED", error.code, "Runtime is not ready for transport execution.");
      case "TRANSPORT_INTERNAL_ERROR":
        return failure(context, "INTERNAL_ERROR", error.code, "Transport request could not be completed.");
    }
  }
}

function failure(
  context: PublicationTransportResponseContext,
  status: PublicationTransportFailureResponse["status"],
  code: string,
  message: string,
): PublicationTransportFailureResponse {
  return immutablePublicationTransportValue({
    requestId: context.requestId,
    success: false as const,
    status,
    error: { code, message },
    metadata: context.metadata,
  });
}
