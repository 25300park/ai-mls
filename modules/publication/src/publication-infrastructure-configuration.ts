import {
  SystemPublicationClock,
  type PublicationClock,
} from "./publication-clock.js";
import type {
  PublicationAuthorizationEvaluator,
  PublicationLiveAuthorizationContextResolver,
  PublicationSessionResolver,
} from "./publication-authorization.js";
import type { PublicationConnectorDispatcher, PublicationEffectiveApprovalPort } from "./publication-service.js";

export interface PublicationInfrastructureConfiguration {
  readonly clock: PublicationClock;
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly publicationPolicyVersion?: string;
  readonly effectiveApprovalPort?: PublicationEffectiveApprovalPort;
  readonly connectorDispatcher?: PublicationConnectorDispatcher;
}

export interface PublicationInfrastructureConfigurationInput {
  readonly clock?: PublicationClock;
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly publicationPolicyVersion?: string;
  readonly effectiveApprovalPort?: PublicationEffectiveApprovalPort;
  readonly connectorDispatcher?: PublicationConnectorDispatcher;
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
    ...(input.effectiveApprovalPort === undefined ? {} : { effectiveApprovalPort: input.effectiveApprovalPort }),
    ...(input.connectorDispatcher === undefined ? {} : { connectorDispatcher: input.connectorDispatcher }),
  });
}
