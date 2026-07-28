import type { InProcessPublicationTransport } from "./publication-in-process-transport.js";
import type { PublicationPresentationAdapter } from "./publication-presentation-adapter.js";
import type { PublicationPresentationViewModel } from "./publication-presentation-contracts.js";
import type { PublicationRuntimeStatus } from "./publication-runtime-contracts.js";
import type { PublicationRuntime } from "./publication-runtime.js";

export const publicationCompositionServiceNames = Object.freeze([
  "runtime",
  "transport",
  "presentation",
  "application",
] as const);

export type PublicationCompositionServiceName = typeof publicationCompositionServiceNames[number];

export interface PublicationComposedApplication {
  execute(request: unknown): PublicationPresentationViewModel;
  isBoundTo(
    runtime: PublicationRuntime,
    transport: InProcessPublicationTransport,
    presentation: PublicationPresentationAdapter,
  ): boolean;
}

export interface PublicationCompositionServiceMap {
  readonly runtime: PublicationRuntime;
  readonly transport: InProcessPublicationTransport;
  readonly presentation: PublicationPresentationAdapter;
  readonly application: PublicationComposedApplication;
}

export type PublicationCompositionRegistration = {
  [Name in PublicationCompositionServiceName]: Readonly<{
    name: Name;
    service: PublicationCompositionServiceMap[Name];
  }>;
}[PublicationCompositionServiceName];

export interface PublicationCompositionDependencyEdge {
  readonly consumer: PublicationCompositionServiceName;
  readonly dependency: PublicationCompositionServiceName;
}

export const publicationCompositionDependencyEdges: readonly PublicationCompositionDependencyEdge[] = Object.freeze([
  Object.freeze({ consumer: "transport", dependency: "runtime" }),
  Object.freeze({ consumer: "application", dependency: "transport" }),
  Object.freeze({ consumer: "application", dependency: "presentation" }),
]);

export interface PublicationCompositionDiagnostics {
  readonly registeredServices: readonly PublicationCompositionServiceName[];
  readonly dependencyGraph: readonly PublicationCompositionDependencyEdge[];
  readonly validationStatus: "VALID";
  readonly runtimeStatus: PublicationRuntimeStatus;
}

export interface PublicationCompositionGraph extends PublicationCompositionServiceMap {
  readonly serviceNames: readonly PublicationCompositionServiceName[];
  readonly diagnostics: PublicationCompositionDiagnostics;
}

export type PublicationCompositionErrorCode =
  | "COMPOSITION_DUPLICATE_REGISTRATION"
  | "COMPOSITION_DEPENDENCY_MISSING"
  | "COMPOSITION_GRAPH_INVALID"
  | "COMPOSITION_RUNTIME_UNAVAILABLE";

export class PublicationCompositionError extends Error {
  public constructor(
    public readonly code: PublicationCompositionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationCompositionError";
  }
}
