import { DurableAdministrationUnitOfWork } from "../../../modules/administration/src/administration-durable-persistence.js";
import { createAdministrationBackedAuthorizationService } from "../../../modules/administration/src/live-assignment-adapter.js";
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
    "proposals" | "decisions" | "idempotency"> {
  readonly databasePath: string;
  readonly auditSink: AuditSink;
  readonly policyVersion: string;
  readonly configuration?: unknown;
}

export interface ProductionAdministrationComposition {
  readonly server: PublicationNodeHttpServer;
  close(): Promise<void>;
}

export function composeProductionAdministrationApi015NodeHttpServer(
  options: ProductionAdministrationCompositionOptions,
): ProductionAdministrationComposition {
  const unitOfWork = new DurableAdministrationUnitOfWork({ databasePath: options.databasePath });
  try {
    const authorizationService = createAdministrationBackedAuthorizationService({
      roleAssignments: unitOfWork.roleAssignments,
      roles: unitOfWork.roles,
      proposals: unitOfWork.proposals,
      decisions: unitOfWork.decisions,
      auditSink: options.auditSink,
      clock: options.clock,
      policyVersion: options.policyVersion,
    });
    const application = new AdministrationGovernanceApplication({
      authorizationService,
      sessionResolver: options.sessionResolver,
      clock: options.clock,
      idFactory: options.idFactory,
      unitOfWork,
      roleAssignments: unitOfWork.roleAssignments,
      roles: unitOfWork.roles,
      policies: unitOfWork.policies,
      teamScopes: unitOfWork.teamScopes,
      sourceGovernance: unitOfWork.sourceGovernance,
      publicationTargets: unitOfWork.publicationTargets,
      proposals: unitOfWork.proposals,
      decisions: unitOfWork.decisions,
      idempotency: unitOfWork.idempotency,
    });
    const server = composeAdministrationApi015NodeHttpServer({
      application,
      configuration: options.configuration,
    });
    return Object.freeze({
      server,
      close: async (): Promise<void> => {
        try {
          if (server.diagnostics.listening) await server.stop();
        } finally {
          unitOfWork.close();
        }
      },
    });
  } catch (error) {
    unitOfWork.close();
    throw error;
  }
}
