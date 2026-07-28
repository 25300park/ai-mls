import {
  PublicationCompositionError,
  publicationCompositionServiceNames,
  type PublicationCompositionGraph,
  type PublicationCompositionServiceMap,
} from "./publication-composition-contracts.js";
import { createPublicationCompositionDiagnostics } from "./publication-composition-diagnostics.js";
import { createPublicationCompositionRegistrations } from "./publication-composition-registry.js";
import { PublicationRuntimeCompositionAdapter } from "./publication-composition-runtime-adapter.js";
import { validatePublicationCompositionRegistrations } from "./publication-composition-validation.js";
import {
  createInProcessPublicationTransport,
} from "./publication-in-process-transport.js";
import {
  createPublicationPresentationAdapter,
} from "./publication-presentation-adapter.js";
import {
  bootstrapPublicationRuntime,
  type PublicationRuntimeBootstrapOptions,
} from "./publication-runtime.js";

export interface PublicationCompositionOptions {
  readonly runtimeOptions?: PublicationRuntimeBootstrapOptions;
}

export type PublicationHostCompositionFactory = (
  options?: PublicationCompositionOptions,
) => PublicationHostCompositionFacade;

export class PublicationHostCompositionFacade {
  readonly #graph: PublicationCompositionGraph;

  public static compose(
    options: PublicationCompositionOptions = {},
  ): PublicationHostCompositionFacade {
    return new PublicationHostCompositionFacade(composePublicationApplication(options));
  }

  public static isApproved(value: unknown): value is PublicationHostCompositionFacade {
    return typeof value === "object"
      && value !== null
      && Object.getPrototypeOf(value) === PublicationHostCompositionFacade.prototype
      && #graph in value;
  }

  private constructor(graph: PublicationCompositionGraph) {
    this.#graph = graph;
    Object.freeze(this);
  }

  public get runtimeStatus(): PublicationCompositionGraph["diagnostics"]["runtimeStatus"] {
    return this.#graph.runtime.context.status;
  }

  public get validationStatus(): PublicationCompositionGraph["diagnostics"]["validationStatus"] {
    return this.#graph.diagnostics.validationStatus;
  }

  public execute(
    request: unknown,
  ): ReturnType<PublicationCompositionGraph["application"]["execute"]> {
    if (this.#graph.runtime.context.status !== "READY") {
      throw new PublicationCompositionError(
        "COMPOSITION_RUNTIME_UNAVAILABLE",
        "Composition Runtime is unavailable for execution.",
      );
    }
    return this.#graph.application.execute(request);
  }

  public shutdown(): void {
    if (this.#graph.runtime.context.status === "DISPOSED") return;
    if (this.#graph.runtime.context.status === "READY"
      || this.#graph.runtime.context.status === "STARTED") {
      this.#graph.runtime.stop();
    }
    if (this.#graph.runtime.context.status !== "STOPPED") {
      throw new PublicationCompositionError(
        "COMPOSITION_RUNTIME_UNAVAILABLE",
        "Composition Runtime cannot shut down from its current state.",
      );
    }
    this.#graph.runtime.dispose();
  }
}

export function composePublicationHostApplication(
  options: PublicationCompositionOptions = {},
): PublicationHostCompositionFacade {
  return PublicationHostCompositionFacade.compose(options);
}

export function isApprovedPublicationHostComposition(
  value: unknown,
): value is PublicationHostCompositionFacade {
  return PublicationHostCompositionFacade.isApproved(value);
}

export function isPublicationCompositionRuntimeFailure(error: unknown): boolean {
  return error instanceof PublicationCompositionError
    && error.code === "COMPOSITION_RUNTIME_UNAVAILABLE";
}

export function composePublicationApplication(
  options: PublicationCompositionOptions = {},
): PublicationCompositionGraph {
  const runtimeResult = bootstrapPublicationRuntime(options.runtimeOptions);
  if (!runtimeResult.ok) {
    throw new PublicationCompositionError(
      "COMPOSITION_RUNTIME_UNAVAILABLE",
      "Composition runtime is unavailable.",
    );
  }
  const runtime = runtimeResult.runtime;
  const transport = createInProcessPublicationTransport(runtime);
  const presentation = createPublicationPresentationAdapter(runtime.services.clock);
  const application = new PublicationRuntimeCompositionAdapter(runtime, transport, presentation);
  const services: PublicationCompositionServiceMap = { runtime, transport, presentation, application };
  const validated = validatePublicationCompositionRegistrations(
    createPublicationCompositionRegistrations(services),
  );
  if (validated.runtime !== runtime
    || validated.transport !== transport
    || validated.presentation !== presentation
    || validated.application !== application) {
    throw new PublicationCompositionError(
      "COMPOSITION_GRAPH_INVALID",
      "Composition dependency graph is inconsistent.",
    );
  }
  return Object.freeze({
    serviceNames: publicationCompositionServiceNames,
    runtime: validated.runtime,
    transport: validated.transport,
    presentation: validated.presentation,
    application: validated.application,
    diagnostics: createPublicationCompositionDiagnostics(validated),
  });
}
