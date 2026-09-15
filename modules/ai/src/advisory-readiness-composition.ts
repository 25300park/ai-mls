import { ConfiguredAdvisoryProviderAdapter, type ExecutableAdvisoryCapabilityId } from "./advisory-provider-boundary.js";
import { Ai001ListingParseApplicationService, Ai004RequirementParseApplicationService, Ai005MatchingApplicationService } from "./advisory-application-services.js";
import { AdvisoryJobFailureMapper } from "../../jobs/src/advisory-job-handlers.js";

const capabilities = Object.freeze(["AI-001", "AI-004", "AI-005"] as const);
type AdvisoryApplicationService = Ai001ListingParseApplicationService | Ai004RequirementParseApplicationService | Ai005MatchingApplicationService;
export interface AdvisoryProviderReadinessCompositionInput {
  readonly adapters: Readonly<Partial<Record<ExecutableAdvisoryCapabilityId, ConfiguredAdvisoryProviderAdapter>>>;
  readonly applicationPorts: Readonly<Partial<Record<ExecutableAdvisoryCapabilityId, AdvisoryApplicationService>>>;
  readonly failureMapper: AdvisoryJobFailureMapper;
}

export interface AdvisoryCapabilityReadiness {
  readonly capabilityId: ExecutableAdvisoryCapabilityId;
  readonly providerIndependent: "READY" | "NOT_READY";
  readonly stagingExecution: "READY" | "NOT_READY";
}

export interface AdvisoryProviderReadinessComposition {
  readonly capabilities: readonly AdvisoryCapabilityReadiness[];
  readonly providerIndependentReady: number;
  readonly stagingExecutionReady: number;
}

export function composeAdvisoryProviderReadiness(input: AdvisoryProviderReadinessCompositionInput): AdvisoryProviderReadinessComposition {
  const items = capabilities.map((capabilityId): AdvisoryCapabilityReadiness => {
    const adapter = input.adapters[capabilityId];
    const port = input.applicationPorts[capabilityId];
    const structurallyComposed = adapter instanceof ConfiguredAdvisoryProviderAdapter
      && adapter.capabilityId === capabilityId
      && matchesApplicationPort(capabilityId, port)
      && port.isProviderIndependentReady(adapter)
      && input.failureMapper instanceof AdvisoryJobFailureMapper;
    const decision = structurallyComposed ? adapter.readiness() : { providerIndependent: "NOT_READY" as const, stagingExecution: "NOT_READY" as const };
    return immutable({ capabilityId, ...decision });
  });
  return immutable({
    capabilities: items,
    providerIndependentReady: items.filter((item) => item.providerIndependent === "READY").length,
    stagingExecutionReady: items.filter((item) => item.stagingExecution === "READY").length,
  });
}

function matchesApplicationPort(capabilityId: ExecutableAdvisoryCapabilityId, port: unknown): port is AdvisoryApplicationService {
  return capabilityId === "AI-001" ? port instanceof Ai001ListingParseApplicationService
    : capabilityId === "AI-004" ? port instanceof Ai004RequirementParseApplicationService
      : port instanceof Ai005MatchingApplicationService;
}

function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
