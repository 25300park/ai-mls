import {
  SystemPublicationClock,
  type PublicationClock,
} from "./publication-clock.js";

export interface PublicationInfrastructureConfiguration {
  readonly clock: PublicationClock;
}

export interface PublicationInfrastructureConfigurationInput {
  readonly clock?: PublicationClock;
}

export function createPublicationInfrastructureConfiguration(
  input: PublicationInfrastructureConfigurationInput = {},
): PublicationInfrastructureConfiguration {
  return Object.freeze({
    clock: input.clock ?? new SystemPublicationClock(),
  });
}
