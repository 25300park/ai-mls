import { createProductionAdvisoryRuntime, type ProductionAdvisoryRuntimeOptions } from "../../../modules/ai/src/advisory-production-composition.js";
import { composeProductionAdministrationApi015NodeHttpServer, type ProductionAdministrationCompositionOptions } from "./administration-production-composition.js";
import { composeProductionPublicationApi014NodeHttpServer, type ProductionPublicationApi014NodeHttpCompositionOptions } from "./composition.js";
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
  readonly api015: ProductionAdministrationCompositionOptions;
  readonly api018: ProductionConnectorApi018CompositionOptions;
  readonly api019: ProductionExternalIntegrationOptions;
  readonly feat022: ProductionAdvisoryRuntimeOptions;
}

/**
 * Phase 2D-0C migrates the Identity boundary only. Existing child roots still
 * accept SQLite databasePath configuration and therefore cannot truthfully be
 * composed into the canonical Production PostgreSQL runtime yet.
 */
export function assertCanonicalProductionChildRootsPostgreSqlReady(
  options: CanonicalProductionChildRootOptions,
): void {
  for (const child of Object.values(options)) {
    if (Object.prototype.hasOwnProperty.call(child, "databasePath")) {
      throw new Error("Production child-root persistence is unavailable.");
    }
  }
}

export function createCanonicalProductionChildRootFactories(
  options: CanonicalProductionChildRootOptions,
): ProductionChildRootFactories {
  return Object.freeze({
    "API-014": (context, configuration, identities) => {
      assertRootIdentity("API-014", context, configuration, identities);
      const root = composeProductionPublicationApi014NodeHttpServer({ ...options.api014, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING", deferRuntimeActivation: true });
      return Object.freeze({ componentId: "API-014" as const, listener: root.server, activateRuntime: () => root.activateRuntime(), close: () => root.close() });
    },
    "API-015": (context, configuration, identities) => {
      assertRootIdentity("API-015", context, configuration, identities);
      const root = composeProductionAdministrationApi015NodeHttpServer({ ...options.api015, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING" });
      return Object.freeze({ componentId: "API-015" as const, listener: root.server, activateRuntime: () => { /* no process-local host */ }, close: () => root.close() });
    },
    "API-018": (context, configuration, identities) => {
      assertRootIdentity("API-018", context, configuration, identities);
      const root = createProductionConnectorApi018Composition({ ...options.api018, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING", deferRuntimeActivation: true });
      return Object.freeze({ componentId: "API-018" as const, activateRuntime: () => root.activateRuntime(), close: () => root.close() });
    },
    "API-019": (context, configuration, identities) => {
      assertRootIdentity("API-019", context, configuration, identities);
      const root = createProductionExternalIntegrationComposition({ ...options.api019, runtimeEnvironment: "PRODUCTION", bootstrapContext: context, schemaMode: "REQUIRE_EXISTING", deferRuntimeActivation: true });
      return Object.freeze({ componentId: "API-019" as const, activateRuntime: () => root.activateRuntime(), close: () => root.close() });
    },
    "FEAT-022": (context, configuration, identities) => {
      assertRootIdentity("FEAT-022", context, configuration, identities);
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
