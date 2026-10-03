import type { TrustedSessionBindingResolver } from "../../../modules/identity/src/session-persistence.js";
import type { AsyncLiveAdministrationAuthorizationService } from "../../../modules/administration/src/live-assignment-adapter.js";

// Dependency contract only. It neither selects a resolver nor proves its Production availability.
export interface ProductionHumanRequestDependencies {
  readonly trustedBinding?: Readonly<{
    environment: "PRODUCTION" | "STAGING";
    resolver: TrustedSessionBindingResolver;
  }>;
  readonly authorization?: AsyncLiveAdministrationAuthorizationService;
}

export function composeProductionHumanRequestDependencies(dependencies: ProductionHumanRequestDependencies): Readonly<{
  bindingResolver: TrustedSessionBindingResolver;
  authorization: AsyncLiveAdministrationAuthorizationService;
}> {
  if (dependencies.trustedBinding?.environment !== "PRODUCTION"
    || typeof dependencies.trustedBinding.resolver?.resolve !== "function") throw new Error("TRUSTED_BINDING_UNCONFIGURED");
  if (typeof dependencies.authorization?.evaluate !== "function"
    || typeof dependencies.authorization.evaluateWorkload !== "function") throw new Error("LIVE_AUTHORIZATION_UNCONFIGURED");
  return Object.freeze({ bindingResolver: dependencies.trustedBinding.resolver, authorization: dependencies.authorization });
}

// Current canonical state, not a readiness receipt. B2/B3 and final gate integration remain separate.
export function currentProductionHumanBindingState(): Readonly<{
  authenticationBinding: "BLOCKED_PENDING_R3C3B2";
  trustedBindingComposition: "BLOCKED_PENDING_R3C3B3";
  humanIdentityAuthorityGate: "BLOCKED";
  fullProductionStartup: "BLOCKED";
}> {
  return Object.freeze({
    authenticationBinding: "BLOCKED_PENDING_R3C3B2" as const,
    trustedBindingComposition: "BLOCKED_PENDING_R3C3B3" as const,
    humanIdentityAuthorityGate: "BLOCKED" as const,
    fullProductionStartup: "BLOCKED" as const,
  });
}
