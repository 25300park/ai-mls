import { AsyncDurableExternalIntegrationStore, type AsyncExternalIntegrationPersistence } from "../../../modules/source/src/external-integration-async-persistence.js";
import { PostgreSqlExternalIntegrationStore } from "../../../modules/source/src/external-integration-postgresql-persistence.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { ExternalIntegrationEvidenceApplication, type ExternalIntegrationContextResolver, type ExternalIntegrationAuthorizer, type GovernedIntegrationBindingResolver, type ExternalIntegrationUnresolvedConflictCaseWriter } from "../../../modules/source/src/external-integration-application.js";
import { ExternalIntegrationApplicationHost } from "../../../modules/source/src/external-integration-application-host.js";
import { ExternalIntegrationRuntime } from "../../../modules/source/src/external-integration-runtime.js";
import { createExternalIntegrationHttpHandler, type ExternalIntegrationHttpHandler } from "./external-integration-http-adapter.js";
import { assertProductionRootBootstrapContext, type ProductionBootstrapContextView } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";
export interface ProductionExternalIntegrationOptions {
 readonly databasePath?: string;
 readonly postgreSqlPool?: PostgreSqlPoolPort;
 readonly runtimeEnvironment: "TEST" | "STAGING" | "PRODUCTION";
 readonly bootstrapContext?: ProductionBootstrapContextView;
 readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
 readonly deferRuntimeActivation?: true;
 readonly contextResolver: ExternalIntegrationContextResolver;
 readonly authorizer: ExternalIntegrationAuthorizer;
 readonly bindingResolver: GovernedIntegrationBindingResolver;
 readonly clock: () => string;
 readonly unresolvedConflictCaseWriter: ExternalIntegrationUnresolvedConflictCaseWriter;
}
export interface ProductionExternalIntegrationComposition {
 readonly store: AsyncExternalIntegrationPersistence;
 readonly application: ExternalIntegrationEvidenceApplication;
 readonly host: ExternalIntegrationApplicationHost;
 readonly http: ExternalIntegrationHttpHandler;
 activateRuntime(): void;
 close(): Promise<void>;
}
export function createProductionExternalIntegrationComposition(options: ProductionExternalIntegrationOptions): ProductionExternalIntegrationComposition {
 if (!["TEST", "STAGING", "PRODUCTION"].includes(options.runtimeEnvironment)) throw new TypeError("Runtime environment is required.");
 if (options.runtimeEnvironment === "PRODUCTION") assertProductionRootBootstrapContext(options.bootstrapContext);
 else if (options.bootstrapContext !== undefined) throw new TypeError("Bootstrap context is Production-only.");
 if (options.unresolvedConflictCaseWriter === undefined || typeof options.unresolvedConflictCaseWriter.linkUnresolvedConflict !== "function") throw new TypeError("F19 unresolved conflict case writer is required.");
 const store = options.runtimeEnvironment === "PRODUCTION" || options.runtimeEnvironment === "STAGING"
  ? options.postgreSqlPool === undefined || options.databasePath !== undefined
   ? ((): never => { throw new TypeError("Production/Staging External PostgreSQL persistence is required."); })()
   : new PostgreSqlExternalIntegrationStore(options.postgreSqlPool)
  : options.databasePath === undefined || options.postgreSqlPool !== undefined
   ? ((): never => { throw new TypeError("Local/Test External SQLite persistence is required."); })()
   : new AsyncDurableExternalIntegrationStore({ databasePath: options.databasePath, ...(options.schemaMode === undefined ? {} : { schemaMode: options.schemaMode }) });
 try {
  const application = new ExternalIntegrationEvidenceApplication({ store, contextResolver: options.contextResolver, authorizer: options.authorizer, bindingResolver: options.bindingResolver, clock: options.clock, unresolvedConflictCaseWriter: options.unresolvedConflictCaseWriter });
  const host = new ExternalIntegrationApplicationHost(() => new ExternalIntegrationRuntime(application));
  if (options.deferRuntimeActivation !== true) host.start();
  return Object.freeze({ store, application, host, http: createExternalIntegrationHttpHandler(host), activateRuntime(): void { if (host.status.status !== "READY") host.start(); }, close: async (): Promise<void> => { if (host.status.status === "READY") host.stop(); await store.close(); } });
 } catch (error) { void store.close(); throw error; }
}
