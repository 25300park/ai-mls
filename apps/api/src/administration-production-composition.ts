import { AsyncDurableAdministrationUnitOfWork } from "../../../modules/administration/src/administration-async-persistence.js";
import { PostgreSqlAdministrationUnitOfWork } from "../../../modules/administration/src/administration-postgresql-persistence.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { createAsyncAdministrationBackedAuthorizationService } from "../../../modules/administration/src/live-assignment-adapter.js";
import {
  createPublicationNodeHttpServer,
  type PublicationNodeHttpServer,
} from "../../../modules/publication/src/publication-node-http-server.js";
import type { PublicationNodeHttpServerRequestIdFactory } from "../../../modules/publication/src/publication-node-http-contracts.js";
import type { AuditSink } from "../../../packages/security-contracts/src/index.js";
import {
  createAdministrationHttpRequestHandler,
  type AdministrationGovernanceApplicationPort,
  type AdministrationHttpRequestHandler,
} from "./administration-http-adapter.js";
import {
  AdministrationGovernanceApplication,
  type AdministrationGovernanceApplicationDependencies,
} from "./administration-governance-api.js";
import { assertProductionRootBootstrapContext, type ProductionBootstrapContextView } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";

export interface AdministrationApi015NodeHttpCompositionOptions {
  readonly application: AdministrationGovernanceApplicationPort;
  readonly configuration?: unknown;
  readonly existingHttpHandler?: AdministrationHttpRequestHandler;
  readonly requestIdFactory?: PublicationNodeHttpServerRequestIdFactory;
}

export function composeAdministrationApi015NodeHttpServer(
  options: AdministrationApi015NodeHttpCompositionOptions,
): PublicationNodeHttpServer {
  return createPublicationNodeHttpServer({
    configuration: options.configuration,
    httpAdapter: createAdministrationHttpRequestHandler(options.application, options.existingHttpHandler),
    ...(options.requestIdFactory === undefined ? {} : { requestIdFactory: options.requestIdFactory }),
  });
}

export interface ProductionAdministrationCompositionOptions
  extends Omit<AdministrationGovernanceApplicationDependencies,
    "authorizationService" | "unitOfWork" | "roleAssignments" | "roles" | "policies" |
    "teamScopes" | "sourceGovernance" | "publicationTargets" |
    "proposals" | "decisions" | "idempotency" | "sessionResolver"> {
  readonly databasePath?: string;
  readonly postgreSqlPool?: PostgreSqlPoolPort;
  readonly runtimeEnvironment: "TEST" | "STAGING" | "PRODUCTION";
  readonly bootstrapContext?: ProductionBootstrapContextView;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
  readonly auditSink: AuditSink;
  readonly policyVersion: string;
  readonly sessionResolver: AdministrationGovernanceApplicationDependencies["sessionResolver"];
  readonly configuration?: unknown;
}

export interface ProductionAdministrationComposition {
  readonly server: PublicationNodeHttpServer;
  close(): Promise<void>;
}

export interface ProductionAdministrationHttpHandlerComposition {
  readonly httpHandler: AdministrationHttpRequestHandler;
  close(): Promise<void>;
}

export function composeProductionAdministrationApi015HttpHandler(
  options: ProductionAdministrationCompositionOptions,
): ProductionAdministrationHttpHandlerComposition {
  if (!isRuntimeEnvironment(options.runtimeEnvironment)) throw new TypeError("Runtime environment is required.");
  if (options.runtimeEnvironment === "PRODUCTION") assertProductionRootBootstrapContext(options.bootstrapContext);
  else if (options.bootstrapContext !== undefined) throw new TypeError("Bootstrap context is Production-only.");
  const unitOfWork = options.runtimeEnvironment === "PRODUCTION"
    ? options.postgreSqlPool === undefined || options.databasePath !== undefined
      ? ((): never => { throw new TypeError("Production Administration PostgreSQL persistence is required."); })()
      : new PostgreSqlAdministrationUnitOfWork(options.postgreSqlPool)
    : options.databasePath === undefined || options.postgreSqlPool !== undefined
      ? ((): never => { throw new TypeError("Local/Test Administration SQLite persistence is required."); })()
      : new AsyncDurableAdministrationUnitOfWork({ databasePath: options.databasePath, ...(options.schemaMode === undefined ? {} : { schemaMode: options.schemaMode }) });
  try {
    const authorizationService = createAsyncAdministrationBackedAuthorizationService({
      roleAssignments: unitOfWork.roleAssignments, roles: unitOfWork.roles,
      proposals: unitOfWork.proposals, decisions: unitOfWork.decisions,
      auditSink: options.auditSink, clock: options.clock, policyVersion: options.policyVersion,
    });
    const application = new AdministrationGovernanceApplication({
      authorizationService, sessionResolver: options.sessionResolver, clock: options.clock, idFactory: options.idFactory,
      unitOfWork, roleAssignments: unitOfWork.roleAssignments, roles: unitOfWork.roles, policies: unitOfWork.policies,
      teamScopes: unitOfWork.teamScopes, sourceGovernance: unitOfWork.sourceGovernance,
      publicationTargets: unitOfWork.publicationTargets, proposals: unitOfWork.proposals,
      decisions: unitOfWork.decisions, idempotency: unitOfWork.idempotency,
    });
    return Object.freeze({
      httpHandler: createAdministrationHttpRequestHandler(application),
      close: (): Promise<void> => unitOfWork.close(),
    });
  } catch (error) {
    void unitOfWork.close();
    throw error;
  }
}

export function composeProductionAdministrationApi015NodeHttpServer(
  options: ProductionAdministrationCompositionOptions,
): ProductionAdministrationComposition {
  if (options.runtimeEnvironment === "PRODUCTION") throw new TypeError("Independent Production listener is unavailable.");
  const root = composeProductionAdministrationApi015HttpHandler(options);
  let server: PublicationNodeHttpServer | undefined;
  try {
    server = createPublicationNodeHttpServer({
      configuration: options.configuration,
      httpAdapter: root.httpHandler,
    });
    return Object.freeze({
      server,
      close: async (): Promise<void> => {
        try { if (server?.diagnostics.listening) await server.stop(); }
        finally { await root.close(); }
      },
    });
  } catch (error) {
    void root.close();
    throw error;
  }
}

function isRuntimeEnvironment(value: unknown): value is "TEST" | "STAGING" | "PRODUCTION" {
  return value === "TEST" || value === "STAGING" || value === "PRODUCTION";
}
