import type { PublicationInterfaceRequest, PublicationInterfaceResponse } from "./publication-interface-models.js";
import type { PublicationRuntime } from "./publication-runtime.js";

export interface PublicationTransportExecutionPort {
  execute(request: PublicationInterfaceRequest): PublicationInterfaceResponse;
}

export class PublicationRuntimeTransportAdapter implements PublicationTransportExecutionPort {
  public constructor(private readonly runtime: PublicationRuntime) {}

  public execute(request: PublicationInterfaceRequest): PublicationInterfaceResponse {
    return this.runtime.execute(request);
  }
}
