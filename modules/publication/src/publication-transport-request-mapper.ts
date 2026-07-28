import {
  createPublicationInterfaceRequest,
  type PublicationInterfaceRequest,
} from "./publication-interface-models.js";
import { StructuralPublicationInterfaceValidator } from "./publication-interface-validation.js";
import {
  PublicationTransportError,
  type PublicationTransportRequestEnvelope,
} from "./publication-transport-contracts.js";

export interface PublicationTransportRequestMapper {
  map(request: PublicationTransportRequestEnvelope): PublicationInterfaceRequest;
}

export class DefaultPublicationTransportRequestMapper implements PublicationTransportRequestMapper {
  private readonly interfaceValidator = new StructuralPublicationInterfaceValidator();

  public map(request: PublicationTransportRequestEnvelope): PublicationInterfaceRequest {
    if (!isRecord(request.payload)) {
      throw new PublicationTransportError("TRANSPORT_REQUEST_INVALID", "Transport request payload is invalid.");
    }
    const mapped = { ...request.payload, operation: request.operation } as unknown as PublicationInterfaceRequest;
    if (!this.interfaceValidator.validate(mapped).valid) {
      throw new PublicationTransportError("TRANSPORT_REQUEST_INVALID", "Transport request payload is invalid.");
    }
    return createPublicationInterfaceRequest(mapped);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
