import {
  PublicationCompositionError,
  publicationCompositionServiceNames,
  type PublicationCompositionRegistration,
  type PublicationCompositionServiceMap,
  type PublicationCompositionServiceName,
} from "./publication-composition-contracts.js";
import { PublicationRuntimeCompositionAdapter } from "./publication-composition-runtime-adapter.js";
import { InProcessPublicationTransportAdapter } from "./publication-in-process-transport.js";
import { PublicationPresentationAdapter } from "./publication-presentation-adapter.js";
import { PublicationRuntime } from "./publication-runtime.js";

export function validatePublicationCompositionRegistrations(
  registrations: readonly PublicationCompositionRegistration[],
): PublicationCompositionServiceMap {
  if (!Array.isArray(registrations) || Object.keys(registrations).length !== registrations.length) {
    throw new PublicationCompositionError("COMPOSITION_GRAPH_INVALID", "Composition registrations are invalid.");
  }
  const registered: Partial<Record<PublicationCompositionServiceName, unknown>> = {};
  for (const registration of registrations as readonly unknown[]) {
    if (!isRecord(registration) || !isServiceName(registration["name"])) {
      throw new PublicationCompositionError("COMPOSITION_GRAPH_INVALID", "Composition registration is invalid.");
    }
    const name = registration["name"];
    if (Object.hasOwn(registered, name)) {
      throw new PublicationCompositionError(
        "COMPOSITION_DUPLICATE_REGISTRATION",
        "Composition dependency is registered more than once.",
      );
    }
    registered[name] = registration["service"];
  }
  if (publicationCompositionServiceNames.some((name) => registered[name] === undefined || registered[name] === null)) {
    throw new PublicationCompositionError("COMPOSITION_DEPENDENCY_MISSING", "Composition dependency is missing.");
  }
  const runtime = registered.runtime;
  const transport = registered.transport;
  const presentation = registered.presentation;
  const application = registered.application;
  if (!hasExactPrototype(runtime, PublicationRuntime.prototype)
    || !hasExactPrototype(transport, InProcessPublicationTransportAdapter.prototype)
    || !hasExactPrototype(presentation, PublicationPresentationAdapter.prototype)
    || !hasExactPrototype(application, PublicationRuntimeCompositionAdapter.prototype)) {
    throw new PublicationCompositionError("COMPOSITION_GRAPH_INVALID", "Composition implementation is not approved.");
  }
  if (!hasMethods(runtime, ["execute"])
    || !isRecord(runtime["context"])
    || !hasMethods(transport, ["execute"])
    || !hasMethods(presentation, ["present"])
    || !hasMethods(application, ["execute", "isBoundTo"])) {
    throw new PublicationCompositionError("COMPOSITION_DEPENDENCY_MISSING", "Composition dependency is unavailable.");
  }
  const services = {
    runtime,
    transport,
    presentation,
    application,
  } as unknown as PublicationCompositionServiceMap;
  if (!services.application.isBoundTo(services.runtime, services.transport, services.presentation)) {
    throw new PublicationCompositionError("COMPOSITION_GRAPH_INVALID", "Composition dependency graph is inconsistent.");
  }
  return Object.freeze(services);
}

function isServiceName(value: unknown): value is PublicationCompositionServiceName {
  return typeof value === "string"
    && (publicationCompositionServiceNames as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object";
}

function hasMethods(value: unknown, methods: readonly string[]): value is Readonly<Record<string, unknown>> {
  return isRecord(value) && methods.every((method) => typeof value[method] === "function");
}

function hasExactPrototype(value: unknown, prototype: object): boolean {
  return isRecord(value) && Object.getPrototypeOf(value) === prototype;
}
