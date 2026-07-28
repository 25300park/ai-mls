import type { PublicationTransportResponse } from "./publication-transport-contracts.js";
import { PublicationTransportDispatcher } from "./publication-transport-dispatcher.js";
import { PublicationRuntimeTransportAdapter } from "./publication-transport-runtime-adapter.js";
import type { PublicationRuntime } from "./publication-runtime.js";

export interface InProcessPublicationTransport {
  execute(request: unknown): PublicationTransportResponse;
}

export class InProcessPublicationTransportAdapter implements InProcessPublicationTransport {
  public constructor(private readonly dispatcher: PublicationTransportDispatcher) {}

  public execute(request: unknown): PublicationTransportResponse {
    return this.dispatcher.dispatch(request);
  }
}

export function createInProcessPublicationTransport(runtime: PublicationRuntime): InProcessPublicationTransport {
  return Object.freeze(new InProcessPublicationTransportAdapter(
    new PublicationTransportDispatcher(new PublicationRuntimeTransportAdapter(runtime)),
  ));
}
