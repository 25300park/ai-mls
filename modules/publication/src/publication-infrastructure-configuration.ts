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
import type { PublicationApprovedRetryPolicyResolver } from "./publication-durable-retry.js";
import type { PublicationGovernanceContextStore } from "./publication-governance-context.js";
import type { ListingProjectionRebuildAuthority } from "./listing-projection-rebuild.js";
import type { PublicationOperationsRebuildAuthority, PublicationOperationsRetryAuthority, PublicationOperationsRetryStateResolver } from "./publication-operations-contracts.js";
import type { PublicationRecoveryAuthorizationReader, PublicationRecoveryCaseWriter, PublicationRecoveryExecutionStore } from "./publication-reconciliation-service.js";

export interface PublicationInfrastructureConfiguration {
  readonly approvedRetryPolicy?: PublicationApprovedRetryPolicyResolver;
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
  readonly recoveryAuthorizationReader?: PublicationRecoveryAuthorizationReader;
  readonly recoveryCaseWriter?: PublicationRecoveryCaseWriter;
  readonly recoveryExecutionStore?: PublicationRecoveryExecutionStore;
}

export interface PublicationInfrastructureConfigurationInput {
  readonly approvedRetryPolicy?: PublicationApprovedRetryPolicyResolver;
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
  readonly recoveryAuthorizationReader?: PublicationRecoveryAuthorizationReader;
  readonly recoveryCaseWriter?: PublicationRecoveryCaseWriter;
  readonly recoveryExecutionStore?: PublicationRecoveryExecutionStore;
}

export function createPublicationInfrastructureConfiguration(
  input: PublicationInfrastructureConfigurationInput = {},
): PublicationInfrastructureConfiguration {
  return Object.freeze({
    ...(input.approvedRetryPolicy === undefined ? {} : { approvedRetryPolicy: input.approvedRetryPolicy }),
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
    ...(input.recoveryAuthorizationReader === undefined ? {} : { recoveryAuthorizationReader: input.recoveryAuthorizationReader }),
    ...(input.recoveryCaseWriter === undefined ? {} : { recoveryCaseWriter: input.recoveryCaseWriter }),
    ...(input.recoveryExecutionStore === undefined ? {} : { recoveryExecutionStore: input.recoveryExecutionStore }),
  });
}
