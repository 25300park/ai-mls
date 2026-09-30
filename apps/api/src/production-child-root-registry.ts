import { createProductionAdvisoryRuntime, type ProductionAdvisoryRuntimeOptions } from "../../../modules/ai/src/advisory-production-composition.js";
import { composeProductionAdministrationApi015HttpHandler, type ProductionAdministrationCompositionOptions } from "./administration-production-composition.js";
import { composeProductionPublicationApi014HttpHandler, type ProductionPublicationApi014NodeHttpCompositionOptions } from "./composition.js";
import { createProductionConnectorApi018Composition, type ProductionConnectorApi018CompositionOptions } from "./connector-production-composition.js";
import { createProductionExternalIntegrationComposition, type ProductionExternalIntegrationOptions } from "./external-integration-production-composition.js";
import {
  type ProductionChildRootFactories,
  type ProductionRuntimeConfiguration,
} from "./production-bootstrap.js";
import { assertProductionBootstrapContext } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";

export interface CanonicalProductionChildRootOptions {
  readonly api014: ProductionPublicationApi014NodeHttpCompositionOptions;
  readonly api015: ProductionAdministrationCompositionOptions | null;
  readonly api018: ProductionConnectorApi018CompositionOptions | null;
  readonly api019: ProductionExternalIntegrationOptions | null;
  readonly feat022: ProductionAdvisoryRuntimeOptions | null;
}

/** R3-B2 permits only API-014 to receive the bootstrap-owned PostgreSQL pool. */
export function assertCanonicalProductionChildRootsPostgreSqlReady(
  options: CanonicalProductionChildRootOptions,
): void {
  if (options.api014.databasePath !== undefined || options.api014.postgreSqlPool !== undefined) {
    throw new Error("Production child-root persistence is unavailable.");
  }
  for (const child of [options.api015, options.api018, options.api019, options.feat022]) {
    if (child !== null && Object.prototype.hasOwnProperty.call(child, "databasePath")) throw new Error("Production child-root persistence is unavailable.");
  }
}

export function createCanonicalProductionChildRootFactories(
  options: CanonicalProductionChildRootOptions,
): ProductionChildRootFactories {
  return Object.freeze({
    "API-014": (context, configuration, identities, pool) => {
      assertRootIdentity("API-014", context, configuration, identities);
      const root = composeProductionPublicationApi014HttpHandler({ ...options.api014, postgreSqlPool: pool, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, deferRuntimeActivation: true });
      return Object.freeze({ componentId: "API-014" as const, httpHandler: root.httpHandler, activateRuntime: () => root.activateRuntime(), close: () => root.close() });
    },
    "API-015": (context, configuration, identities) => {
      assertRootIdentity("API-015", context, configuration, identities);
      if (options.api015 === null) throw new Error("Production child root is unavailable.");
      const root = composeProductionAdministrationApi015HttpHandler({ ...options.api015, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING" });
      return Object.freeze({ componentId: "API-015" as const, httpHandler: root.httpHandler, activateRuntime: () => { /* no process-local host */ }, close: () => root.close() });
    },
    "API-018": (context, configuration, identities) => {
      assertRootIdentity("API-018", context, configuration, identities);
      if (options.api018 === null) throw new Error("Production child root is unavailable.");
      const root = createProductionConnectorApi018Composition({ ...options.api018, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING", deferRuntimeActivation: true });
      return Object.freeze({ componentId: "API-018" as const, activateRuntime: () => root.activateRuntime(), close: () => root.close() });
    },
    "API-019": (context, configuration, identities) => {
      assertRootIdentity("API-019", context, configuration, identities);
      if (options.api019 === null) throw new Error("Production child root is unavailable.");
      const root = createProductionExternalIntegrationComposition({ ...options.api019, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING", deferRuntimeActivation: true });
      return Object.freeze({ componentId: "API-019" as const, activateRuntime: () => root.activateRuntime(), close: () => root.close() });
    },
    "FEAT-022": (context, configuration, identities) => {
      assertRootIdentity("FEAT-022", context, configuration, identities);
      if (options.feat022 === null) throw new Error("Production child root is unavailable.");
      const root = createProductionAdvisoryRuntime({ ...options.feat022, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING" });
      return Object.freeze({ componentId: "FEAT-022" as const, activateRuntime: () => { /* provider remains held */ }, close: () => root.close() });
    },
  });
}

function assertRootIdentity(
  componentId: keyof ProductionChildRootFactories,
  context: unknown,
  configuration: ProductionRuntimeConfiguration,
  identities: readonly ProductionServiceIdentityBinding[],
): void {
  assertProductionBootstrapContext(context);
  if (configuration.runtimeEnvironment !== "PRODUCTION" || configuration.providerExecutionAuthorized !== false
    || !identities.some((identity) => identity.environment === "PRODUCTION" && identity.audience === componentId)) {
    throw new Error("Production child root is unavailable.");
  }
}
