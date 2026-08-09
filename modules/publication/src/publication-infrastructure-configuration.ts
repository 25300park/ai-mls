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
import type { PublicationGovernanceContextStore } from "./publication-governance-context.js";
import type { ListingProjectionRebuildAuthority } from "./listing-projection-rebuild.js";
import type { PublicationOperationsRebuildAuthority, PublicationOperationsRetryAuthority, PublicationOperationsRetryStateResolver } from "./publication-operations-contracts.js";

export interface PublicationInfrastructureConfiguration {
  readonly clock: PublicationClock;
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly publicationPolicyVersion?: string;
  readonly effectiveApprovalPort?: PublicationEffectiveApprovalPort;
  readonly connectorDispatcher?: PublicationConnectorDispatcher;
  readonly eventGovernanceContextStore?: PublicationGovernanceContextStore;
  readonly listingProjectionRebuildAuthority?: ListingProjectionRebuildAuthority;
  readonly operationsRetryAuthority?: PublicationOperationsRetryAuthority;
  readonly operationsRetryStateResolver?: PublicationOperationsRetryStateResolver;
  readonly operationsRebuildAuthority?: PublicationOperationsRebuildAuthority;
}

export interface PublicationInfrastructureConfigurationInput {
  readonly clock?: PublicationClock;
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly publicationPolicyVersion?: string;
  readonly effectiveApprovalPort?: PublicationEffectiveApprovalPort;
  readonly connectorDispatcher?: PublicationConnectorDispatcher;
  readonly eventGovernanceContextStore?: PublicationGovernanceContextStore;
  readonly listingProjectionRebuildAuthority?: ListingProjectionRebuildAuthority;
  readonly operationsRetryAuthority?: PublicationOperationsRetryAuthority;
  readonly operationsRetryStateResolver?: PublicationOperationsRetryStateResolver;
  readonly operationsRebuildAuthority?: PublicationOperationsRebuildAuthority;
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
    ...(input.eventGovernanceContextStore === undefined ? {} : { eventGovernanceContextStore: input.eventGovernanceContextStore }),
    ...(input.listingProjectionRebuildAuthority === undefined ? {} : { listingProjectionRebuildAuthority: input.listingProjectionRebuildAuthority }),
    ...(input.operationsRetryAuthority === undefined ? {} : { operationsRetryAuthority: input.operationsRetryAuthority }),
    ...(input.operationsRetryStateResolver === undefined ? {} : { operationsRetryStateResolver: input.operationsRetryStateResolver }),
    ...(input.operationsRebuildAuthority === undefined ? {} : { operationsRebuildAuthority: input.operationsRebuildAuthority }),
  });
}
