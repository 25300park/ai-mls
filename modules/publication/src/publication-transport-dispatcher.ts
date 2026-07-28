import type { PublicationInterfaceRequest, PublicationInterfaceResponse } from "./publication-interface-models.js";
import {
  createPublicationTransportRequestEnvelope,
  PublicationTransportError,
  type PublicationTransportOperation,
  type PublicationTransportRequestEnvelope,
  type PublicationTransportResponse,
} from "./publication-transport-contracts.js";
import { DeterministicPublicationTransportErrorMapper } from "./publication-transport-error-mapper.js";
import { DefaultPublicationTransportRequestMapper } from "./publication-transport-request-mapper.js";
import { DeterministicPublicationTransportResponseMapper } from "./publication-transport-response-mapper.js";
import type { PublicationTransportExecutionPort } from "./publication-transport-runtime-adapter.js";
import { StructuralPublicationTransportValidator } from "./publication-transport-validation.js";

type PublicationTransportOperationHandler = (request: PublicationInterfaceRequest) => PublicationInterfaceResponse;

export const publicationTransportOperations: readonly PublicationTransportOperation[] = Object.freeze([
  "CREATE_PUBLICATION",
  "MODIFY_PUBLICATION",
]);

export class PublicationTransportDispatcher {
  private readonly operations: Readonly<Record<PublicationTransportOperation, PublicationTransportOperationHandler>>;

  public constructor(
    executionPort: PublicationTransportExecutionPort,
    private readonly validator = new StructuralPublicationTransportValidator(),
    private readonly requestMapper = new DefaultPublicationTransportRequestMapper(),
    private readonly responseMapper = new DeterministicPublicationTransportResponseMapper(),
    private readonly errorMapper = new DeterministicPublicationTransportErrorMapper(),
  ) {
    this.operations = Object.freeze({
      CREATE_PUBLICATION: (request) => executionPort.execute(request),
      MODIFY_PUBLICATION: (request) => executionPort.execute(request),
    });
  }

  public dispatch(input: unknown): PublicationTransportResponse {
    let responseContext: unknown = input;
    try {
      const validation = this.validator.validate(input);
      if (!validation.valid) {
        return this.errorMapper.map(input, new PublicationTransportError(validation.failureCode, "Invalid request."));
      }
      const request = createPublicationTransportRequestEnvelope(input as PublicationTransportRequestEnvelope);
      responseContext = request;
      const handler = this.operationHandler(request.operation);
      if (handler === undefined) {
        throw new PublicationTransportError("TRANSPORT_OPERATION_NOT_FOUND", "Unknown operation.");
      }
      const interfaceRequest = this.requestMapper.map(request);
      return this.responseMapper.map(request, handler(interfaceRequest));
    } catch (error) {
      return this.errorMapper.map(responseContext, error);
    }
  }

  private operationHandler(operation: string): PublicationTransportOperationHandler | undefined {
    return publicationTransportOperations.includes(operation as PublicationTransportOperation)
      ? this.operations[operation as PublicationTransportOperation]
      : undefined;
  }
}
