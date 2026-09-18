import type { RegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/index.js";
import {
  type ProductionBootstrapContextView,
} from "../../../packages/security-contracts/src/production-bootstrap-proof.js";
import { createCanonicalProductionChildRootFactories, type CanonicalProductionChildRootOptions } from "./production-child-root-registry.js";
import { executeProductionBootstrap } from "./production-bootstrap-engine.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";

export {
  assertProductionBootstrapContext,
  assertProductionRootBootstrapContext,
  type ProductionBootstrapContextView,
} from "../../../packages/security-contracts/src/production-bootstrap-proof.js";

export interface ProductionRuntimeConfiguration {
  readonly runtimeEnvironment: "PRODUCTION";
  readonly configurationReference: string;
  readonly requiredServiceRegistrations: readonly string[];
  readonly providerExecutionAuthorized: false;
}

export interface ProductionClosableResource {
  close(): void;
}

export interface ProductionChildRoot extends ProductionClosableResource {
  readonly componentId: "API-014" | "API-015" | "API-018" | "API-019" | "FEAT-022";
  activateRuntime(): void;
  readonly listener?: Readonly<{ start(): Promise<unknown>; stop(): Promise<unknown> }>;
}

export type ProductionChildComponentId = ProductionChildRoot["componentId"];
export type ProductionChildRootFactories = Readonly<Record<ProductionChildComponentId, (
  context: ProductionBootstrapContextView,
  configuration: ProductionRuntimeConfiguration,
  identities: readonly ProductionServiceIdentityBinding[],
) => ProductionChildRoot>>;

export interface ProductionBootstrapDependencies {
  readonly parseConfiguration: (raw: unknown) => ProductionRuntimeConfiguration;
  readonly validateConfiguration: (configuration: ProductionRuntimeConfiguration) => void;
  readonly validateMandatorySecretReferences: (configuration: ProductionRuntimeConfiguration) => void;
  readonly openIdentityAuthorityReadOnly: () => RegisteredServiceWorkloadAuthorityLease;
  readonly validateHumanIdentityAuthority: (configuration: ProductionRuntimeConfiguration) => void;
  readonly resolveRequiredServiceIdentities: (
    authority: RegisteredServiceWorkloadAuthorityLease,
    configuration: ProductionRuntimeConfiguration,
  ) => readonly ProductionServiceIdentityBinding[];
  readonly resolveRequiredSecrets: (configuration: ProductionRuntimeConfiguration) => void;
  readonly validateStartupGate: (
    configuration: ProductionRuntimeConfiguration,
    identities: readonly ProductionServiceIdentityBinding[],
  ) => string;
  readonly createSessionUnitOfWork: () => ProductionClosableResource;
  readonly assertComponentSchemasReady: (configuration: ProductionRuntimeConfiguration) => void;
  readonly childRootOptions: CanonicalProductionChildRootOptions;
  readonly startListeners: (
    context: ProductionBootstrapContextView,
    roots: readonly ProductionChildRoot[],
  ) => ProductionClosableResource;
  readonly startWorkers: (
    context: ProductionBootstrapContextView,
    roots: readonly ProductionChildRoot[],
  ) => ProductionClosableResource;
}

export interface ProductionRuntimeHandle {
  readonly validationFingerprint: string;
  readiness(): "READY" | "NOT_READY";
  close(): void;
}

export type ProductionBootstrapErrorCode = "PRODUCTION_STARTUP_UNAVAILABLE";

export class ProductionBootstrapError extends Error {
  public constructor(public readonly code: ProductionBootstrapErrorCode) {
    super("Production runtime startup is unavailable.");
    this.name = "ProductionBootstrapError";
  }
}

export function startProductionRuntime(rawConfiguration: unknown, dependencies: ProductionBootstrapDependencies): ProductionRuntimeHandle {
  return executeProductionBootstrap(rawConfiguration, {
    ...dependencies,
    childRootFactories: createCanonicalProductionChildRootFactories(dependencies.childRootOptions),
  });
}
