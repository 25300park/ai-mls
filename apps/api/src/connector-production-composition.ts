import { ConnectorApplicationHost } from "../../../modules/source/src/connector-application-host.js";
import { DurableConnectorExecutionUnitOfWork } from "../../../modules/source/src/connector-durable-persistence.js";
import { ConnectorExecutionCoordinator, type ConnectorAmbiguityCaseWriter } from "../../../modules/source/src/connector-execution-coordinator.js";
import type { ConnectorInvocationPort } from "../../../modules/source/src/connector-invocation-port.js";
import { ConnectorRuntimeApplication, type ConnectorRuntimeAuthorizer, type ConnectorRuntimeContextResolver } from "../../../modules/source/src/connector-runtime-application.js";
import { ConnectorRuntime } from "../../../modules/source/src/connector-runtime.js";
import type { SourceIngestionAdmissionGate } from "../../../modules/source/src/source-ingestion-admission.js";
import type { ExternalIntegrationApplicationResult } from "../../../modules/source/src/external-integration-application.js";
import { createConnectorApi018HttpRequestHandler, type ConnectorApi018HttpRequestHandler } from "./connector-api-http-adapter.js";
import { assertProductionRootBootstrapContext, type ProductionBootstrapContextView } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";

export interface ProductionConnectorApi018CompositionOptions {
  readonly databasePath: string;
  readonly runtimeEnvironment: "TEST" | "STAGING" | "PRODUCTION";
  readonly bootstrapContext?: ProductionBootstrapContextView;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
  readonly deferRuntimeActivation?: true;
  readonly contextResolver: ConnectorRuntimeContextResolver;
  readonly authorizer: ConnectorRuntimeAuthorizer;
  readonly admission: Pick<SourceIngestionAdmissionGate, "evaluate">;
  readonly clock: () => string;
  readonly externalObservationSink: Readonly<{ submit(input: unknown, sessionId: string): ExternalIntegrationApplicationResult }>;
  readonly ambiguityCaseWriter?: ConnectorAmbiguityCaseWriter;
}

export interface ProductionConnectorApi018Composition {
  readonly host: ConnectorApplicationHost;
  readonly http: ConnectorApi018HttpRequestHandler;
  readonly persistence: DurableConnectorExecutionUnitOfWork;
  activateRuntime(): void;
  close(): void;
}

const unavailableConnector: ConnectorInvocationPort = Object.freeze({ invoke(): never { throw new Error("Connector unavailable."); } });

export function createProductionConnectorApi018Composition(options: ProductionConnectorApi018CompositionOptions): ProductionConnectorApi018Composition {
  if (!isRuntimeEnvironment(options.runtimeEnvironment)) throw new TypeError("Runtime environment is required.");
  if (options.runtimeEnvironment === "PRODUCTION") assertProductionRootBootstrapContext(options.bootstrapContext);
  else if (options.bootstrapContext !== undefined) throw new TypeError("Bootstrap context is Production-only.");
  if (Object.hasOwn(options, "connector")) throw new TypeError("Production Connector injection is not approved.");
  if (options.ambiguityCaseWriter === undefined || typeof options.ambiguityCaseWriter.linkAmbiguousInvocation !== "function") throw new TypeError("F19 ambiguity case writer is required.");
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath: options.databasePath, ...(options.schemaMode === undefined ? {} : { schemaMode: options.schemaMode }) });
  try {
    const coordinator = new ConnectorExecutionCoordinator({ persistence, connector: unavailableConnector, admission: options.admission, ambiguityCaseWriter: options.ambiguityCaseWriter });
    const application = new ConnectorRuntimeApplication({ persistence, contextResolver: options.contextResolver, authorizer: options.authorizer, coordinator, clock: options.clock, executionAvailable: false, externalObservationSink: options.externalObservationSink });
    const host = new ConnectorApplicationHost(() => new ConnectorRuntime(application));
    if (options.deferRuntimeActivation !== true) host.start();
    return Object.freeze({ host, http: createConnectorApi018HttpRequestHandler(host), persistence, activateRuntime(): void { if (host.status.status !== "READY") host.start(); }, close(): void { if (host.status.status === "READY") host.stop(); persistence.close(); } });
  } catch (error) { persistence.close(); throw error; }
}

function isRuntimeEnvironment(value: unknown): value is "TEST" | "STAGING" | "PRODUCTION" {
  return value === "TEST" || value === "STAGING" || value === "PRODUCTION";
}
