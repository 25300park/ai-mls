import type { InProcessPublicationTransport } from "./publication-in-process-transport.js";
import type { PublicationPresentationAdapter } from "./publication-presentation-adapter.js";
import type { PublicationPresentationViewModel } from "./publication-presentation-contracts.js";
import type { PublicationRuntime } from "./publication-runtime.js";
import type { PublicationComposedApplication } from "./publication-composition-contracts.js";

export class PublicationRuntimeCompositionAdapter implements PublicationComposedApplication {
  public constructor(
    private readonly runtime: PublicationRuntime,
    private readonly transport: InProcessPublicationTransport,
    private readonly presentation: PublicationPresentationAdapter,
  ) {
    Object.freeze(this);
  }

  public execute(request: unknown): PublicationPresentationViewModel {
    return this.presentation.present(this.transport.execute(request));
  }

  public isBoundTo(
    runtime: PublicationRuntime,
    transport: InProcessPublicationTransport,
    presentation: PublicationPresentationAdapter,
  ): boolean {
    return this.runtime === runtime
      && this.transport === transport
      && this.presentation === presentation;
  }
}
