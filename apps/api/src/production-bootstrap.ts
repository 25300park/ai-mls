import type { ChildRootSchemaReadinessEvidence } from "./child-root-postgresql-readiness.js";
import type {
  AsyncRegisteredServiceWorkloadAuthorityLease,
  PostgreSqlPoolPort,
  PostgreSqlIdentitySchemaReadinessProvenance,
} from "../../../modules/identity/src/index.js";
import {
  type ProductionBootstrapContextView,
} from "../../../packages/security-contracts/src/production-bootstrap-proof.js";
import {
  assertCanonicalProductionChildRootsPostgreSqlReady,
  createCanonicalProductionChildRootFactories,
  type CanonicalProductionChildRootOptions,
} from "./production-child-root-registry.js";
import { executeProductionBootstrap } from "./production-bootstrap-engine.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";
import type { PublicationHttpRequestHandler } from "../../../modules/publication/src/publication-node-http-contracts.js";
import type { ProductionActivationListener } from "./production-runtime-activation.js";
import type { ProductionRuntimeObservability, ProductionStartupEvidenceSnapshot } from "./production-runtime-observability.js";

const startedCompositions = new WeakSet<ProductionBootstrapDependencies>();

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
  readonly identityPersistenceEngine: "POSTGRESQL";
}

export interface ProductionClosableResource {
  close(): void | Promise<void>;
}

export interface ProductionAsyncClosableResource {
  close(): Promise<void>;
}

export interface ProductionChildRoot extends ProductionClosableResource {
  readonly componentId: "API-014" | "API-015" | "API-018" | "API-019" | "FEAT-022";
  activateRuntime(): void;
  readonly httpHandler?: PublicationHttpRequestHandler;
}

export type ProductionChildComponentId = ProductionChildRoot["componentId"];
export type ProductionChildRootFactories = Readonly<Record<ProductionChildComponentId, (
  context: ProductionBootstrapContextView,
  configuration: ProductionRuntimeConfiguration,
  identities: readonly ProductionServiceIdentityBinding[],
  pool: PostgreSqlPoolPort,
) => ProductionChildRoot>>;

export interface ProductionBootstrapDependencies {
  readonly observability?: ProductionRuntimeObservability;
  readonly requiredWorkersManifest?: unknown;
  readonly parseConfiguration: (raw: unknown) => ProductionRuntimeConfiguration;
  readonly validateConfiguration: (configuration: ProductionRuntimeConfiguration) => void;
  readonly validateMandatorySecretReferences: (configuration: ProductionRuntimeConfiguration) => void;
  readonly openPostgreSqlPool: (configuration: ProductionRuntimeConfiguration) => Promise<PostgreSqlPoolPort>;
  readonly openIdentityAuthorityReadOnly: (pool: PostgreSqlPoolPort) => Promise<AsyncRegisteredServiceWorkloadAuthorityLease>;
  readonly validateHumanIdentityAuthority: (configuration: ProductionRuntimeConfiguration) => void | Promise<void>;
  readonly resolveRequiredServiceIdentities: (
    authority: AsyncRegisteredServiceWorkloadAuthorityLease,
    configuration: ProductionRuntimeConfiguration,
  ) => Promise<readonly ProductionServiceIdentityBinding[]>;
  readonly resolveRequiredSecrets: (configuration: ProductionRuntimeConfiguration) => Promise<void>;
  readonly validateStartupGate: (
    configuration: ProductionRuntimeConfiguration,
    identities: readonly ProductionServiceIdentityBinding[],
  ) => string;
  readonly createSessionUnitOfWork: (pool: PostgreSqlPoolPort) => Promise<ProductionAsyncClosableResource>;
  readonly assertComponentSchemasReady: (configuration: ProductionRuntimeConfiguration, pool: PostgreSqlPoolPort) => Promise<void>;
  readonly childRootOptions: CanonicalProductionChildRootOptions | null;
  readonly startListeners: (
    context: ProductionBootstrapContextView,
    roots: readonly ProductionChildRoot[],
  ) => ProductionActivationListener | Promise<ProductionActivationListener>;
  /** Legacy seam retained fail-closed; current explicit empty manifest never calls it. */
  readonly startWorkers: (
    context: ProductionBootstrapContextView,
    roots: readonly ProductionChildRoot[],
  ) => ProductionClosableResource;
}

export interface ProductionRuntimeHandle {
  readonly startupEvidence?: () => ProductionStartupEvidenceSnapshot;
  readonly validationFingerprint: string;
  readonly identitySchemaReadinessProvenance: PostgreSqlIdentitySchemaReadinessProvenance;
  readiness(): "READY" | "NOT_READY";
  close(): Promise<void>;
}

export type ProductionBootstrapErrorCode = "PRODUCTION_STARTUP_UNAVAILABLE";

export class ProductionBootstrapError extends Error {
  public constructor(public readonly code: ProductionBootstrapErrorCode, public readonly schemaReadiness?: ChildRootSchemaReadinessEvidence) {
    super("Production runtime startup is unavailable.");
    this.name = "ProductionBootstrapError";
  }
}

export async function startProductionRuntime(rawConfiguration: unknown, dependencies: ProductionBootstrapDependencies): Promise<ProductionRuntimeHandle> {
  if (startedCompositions.has(dependencies)) throw Object.assign(new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE"), { reason: "DUPLICATE_ACTIVATION" });
  startedCompositions.add(dependencies);
  if (dependencies.childRootOptions === null) throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
  assertCanonicalProductionChildRootsPostgreSqlReady(dependencies.childRootOptions);
  return await executeProductionBootstrap(rawConfiguration, {
    ...dependencies,
    childRootFactories: createCanonicalProductionChildRootFactories(dependencies.childRootOptions),
  });
}
