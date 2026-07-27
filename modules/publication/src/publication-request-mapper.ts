import type {
  PublicationApplicationCommand,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";
import {
  immutableInterfaceValue,
  type PublicationInterfaceRequest,
} from "./publication-interface-models.js";

export interface MappedPublicationRequest {
  readonly command: PublicationApplicationCommand;
  readonly context: PublicationExecutionContext;
}

export interface PublicationRequestMapper {
  map(request: PublicationInterfaceRequest): MappedPublicationRequest;
}

export class DefaultPublicationRequestMapper implements PublicationRequestMapper {
  public map(request: PublicationInterfaceRequest): MappedPublicationRequest {
    return request.operation === "CREATE_PUBLICATION"
      ? immutableInterfaceValue({ command: { kind: "CREATE_PUBLICATION" as const, input: request.input }, context: request.context })
      : immutableInterfaceValue({ command: { kind: "MODIFY_PUBLICATION" as const, identity: request.identity, input: request.input }, context: request.context });
  }
}
