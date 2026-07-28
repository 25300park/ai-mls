import {
  publicationCompositionDependencyEdges,
  publicationCompositionServiceNames,
  type PublicationCompositionDiagnostics,
  type PublicationCompositionServiceMap,
} from "./publication-composition-contracts.js";

export function createPublicationCompositionDiagnostics(
  services: PublicationCompositionServiceMap,
): PublicationCompositionDiagnostics {
  return Object.freeze({
    registeredServices: publicationCompositionServiceNames,
    dependencyGraph: publicationCompositionDependencyEdges,
    validationStatus: "VALID",
    runtimeStatus: services.runtime.context.status,
  });
}
