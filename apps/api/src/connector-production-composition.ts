import { ConnectorApplicationHost } from "../../../modules/source/src/connector-application-host.js";
import { DurableConnectorExecutionUnitOfWork } from "../../../modules/source/src/connector-durable-persistence.js";
import { ConnectorExecutionCoordinator, type ConnectorAmbiguityCaseWriter } from "../../../modules/source/src/connector-execution-coordinator.js";
import type { ConnectorInvocationPort } from "../../../modules/source/src/connector-invocation-port.js";
import { ConnectorRuntimeApplication, type ConnectorRuntimeAuthorizer, type ConnectorRuntimeContextResolver } from "../../../modules/source/src/connector-runtime-application.js";
import { ConnectorRuntime } from "../../../modules/source/src/connector-runtime.js";
import type { SourceIngestionAdmissionGate } from "../../../modules/source/src/source-ingestion-admission.js";
import type { ExternalIntegrationApplicationResult } from "../../../modules/source/src/external-integration-application.js";
import { createConnectorApi018HttpRequestHandler, type ConnectorApi018HttpRequestHandler } from "./connector-api-http-adapter.js";

export interface ProductionConnectorApi018CompositionOptions {
  readonly databasePath: string;
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
  close(): void;
}

const unavailableConnector: ConnectorInvocationPort = Object.freeze({ invoke(): never { throw new Error("Connector unavailable."); } });

export function createProductionConnectorApi018Composition(options: ProductionConnectorApi018CompositionOptions): ProductionConnectorApi018Composition {
  if (Object.hasOwn(options, "connector")) throw new TypeError("Production Connector injection is not approved.");
  if (options.ambiguityCaseWriter === undefined || typeof options.ambiguityCaseWriter.linkAmbiguousInvocation !== "function") throw new TypeError("F19 ambiguity case writer is required.");
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath: options.databasePath });
  try {
    const coordinator = new ConnectorExecutionCoordinator({ persistence, connector: unavailableConnector, admission: options.admission, ambiguityCaseWriter: options.ambiguityCaseWriter });
    const application = new ConnectorRuntimeApplication({ persistence, contextResolver: options.contextResolver, authorizer: options.authorizer, coordinator, clock: options.clock, executionAvailable: false, externalObservationSink: options.externalObservationSink });
    const host = new ConnectorApplicationHost(() => new ConnectorRuntime(application));
    host.start();
    return Object.freeze({ host, http: createConnectorApi018HttpRequestHandler(host), persistence, close(): void { if (host.status.status === "READY") host.stop(); persistence.close(); } });
  } catch (error) { persistence.close(); throw error; }
}
