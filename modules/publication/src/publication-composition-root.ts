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
