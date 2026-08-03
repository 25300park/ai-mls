import {
  SystemPublicationClock,
  type PublicationClock,
} from "./publication-clock.js";
import type {
  PublicationAuthorizationEvaluator,
  PublicationLiveAuthorizationContextResolver,
  PublicationSessionResolver,
} from "./publication-authorization.js";

export interface PublicationInfrastructureConfiguration {
  readonly clock: PublicationClock;
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly publicationPolicyVersion?: string;
}

export interface PublicationInfrastructureConfigurationInput {
  readonly clock?: PublicationClock;
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly publicationPolicyVersion?: string;
}

export function createPublicationInfrastructureConfiguration(
  input: PublicationInfrastructureConfigurationInput = {},
): PublicationInfrastructureConfiguration {
  return Object.freeze({
    clock: input.clock ?? new SystemPublicationClock(),
    ...(input.sessionResolver === undefined ? {} : { sessionResolver: input.sessionResolver }),
    ...(input.authorizationEvaluator === undefined ? {} : { authorizationEvaluator: input.authorizationEvaluator }),
    ...(input.liveContextResolver === undefined ? {} : { liveContextResolver: input.liveContextResolver }),
    ...(input.publicationPolicyVersion === undefined ? {} : { publicationPolicyVersion: input.publicationPolicyVersion }),
  });
}
