import type {
  PublicationCompositionRegistration,
  PublicationCompositionServiceMap,
} from "./publication-composition-contracts.js";

export function createPublicationCompositionRegistrations(
  services: PublicationCompositionServiceMap,
): readonly PublicationCompositionRegistration[] {
  return Object.freeze([
    Object.freeze({ name: "runtime" as const, service: services.runtime }),
    Object.freeze({ name: "transport" as const, service: services.transport }),
    Object.freeze({ name: "presentation" as const, service: services.presentation }),
    Object.freeze({ name: "application" as const, service: services.application }),
  ]);
}
