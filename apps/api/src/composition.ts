import type { AdministrationService } from "../../../modules/administration/src/administration-service.js";
import { DurableAdministrationUnitOfWork } from "../../../modules/administration/src/administration-durable-persistence.js";
import { createAdministrationBackedAuthorizationService } from "../../../modules/administration/src/live-assignment-adapter.js";
import type { AuditLog } from "../../../modules/audit/src/audit-log.js";
import type { AuthorizationService } from "../../../modules/authorization/src/authorization-service.js";
import type { ClientRequirementService } from "../../../modules/client/src/client-requirement-service.js";
import type { ContactService } from "../../../modules/contact/src/contact-service.js";
import type { SessionService } from "../../../modules/identity/src/session-service.js";
import type { IntakeService } from "../../../modules/intake/src/intake-service.js";
import type { JobService } from "../../../modules/jobs/src/job-service.js";
import type { ListingService } from "../../../modules/listing/src/listing-service.js";
import type { MatchingService } from "../../../modules/matching/src/matching-service.js";
import type { PermissionService } from "../../../modules/permission/src/permission-service.js";
import type { PublicationApprovalService } from "../../../modules/publication-approval/src/publication-approval-service.js";
import type { ProposalService } from "../../../modules/proposal/src/proposal-service.js";
import type { PropertyService } from "../../../modules/property/src/property-service.js";
import type { SourceRegistryService } from "../../../modules/source/src/source-registry-service.js";
import type { VerificationService } from "../../../modules/verification/src/verification-service.js";
import type { PublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import type { AuditSink } from "../../../packages/security-contracts/src/index.js";
import {
  createPublicationNodeHttpServer,
  type PublicationNodeHttpServer,
} from "../../../modules/publication/src/publication-node-http-server.js";
import type {
  PublicationNodeHttpServerRequestIdFactory,
} from "../../../modules/publication/src/publication-node-http-contracts.js";
import { AdminAuditApi } from "./admin-audit-api.js";
import {
  createAdministrationHttpRequestHandler,
  type AdministrationGovernanceApplicationPort,
  type AdministrationHttpRequestHandler,
} from "./administration-http-adapter.js";
import {
  AdministrationGovernanceApplication,
  type AdministrationGovernanceApplicationDependencies,
} from "./administration-governance-api.js";
import { ContactClientApi } from "./contact-client-api.js";
import { IdentityApi } from "./identity-api.js";
import { JobApi } from "./job-api.js";
import { MatchingApi, type MatchingInputResolver } from "./matching-api.js";
import { PermissionApi } from "./permission-api.js";
import { ProposalApprovalApi } from "./proposal-approval-api.js";
import { PropertyListingApi } from "./property-listing-api.js";
import { SourceIntakeApi } from "./source-intake-api.js";
import { VerificationApi } from "./verification-api.js";
import { PublicationApi } from "./publication-api.js";

export function composePublicationApiModule(infrastructure: PublicationInfrastructure): PublicationApi {
  return new PublicationApi(infrastructure);
}

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

export interface ApiModuleDependencies {
  readonly publicationInfrastructure: PublicationInfrastructure;
  readonly sessionService: SessionService;
  readonly authorizationService: AuthorizationService;
  readonly administrationService: AdministrationService;
  readonly auditLog: AuditLog;
  readonly sourceRegistryService: SourceRegistryService;
  readonly intakeService: IntakeService;
  readonly jobService: JobService;
  readonly propertyService: PropertyService;
  readonly listingService: ListingService;
  readonly contactService: ContactService;
  readonly clientRequirementService: ClientRequirementService;
  readonly matchingService: MatchingService;
  readonly matchingInputResolver: MatchingInputResolver;
  readonly verificationService: VerificationService;
  readonly permissionService: PermissionService;
  readonly proposalService: ProposalService;
  readonly publicationApprovalService: PublicationApprovalService;
}

export interface ApiModulesBeforePublication {
  readonly identity: IdentityApi;
  readonly administrationAndAudit: AdminAuditApi;
  readonly sourceAndIntake: SourceIntakeApi;
  readonly jobs: JobApi;
  readonly propertyAndListing: PropertyListingApi;
  readonly contactClient: ContactClientApi;
  readonly matching: MatchingApi;
  readonly verification: VerificationApi;
  readonly permission: PermissionApi;
  readonly proposalAndApproval: ProposalApprovalApi;
}

export function composeApiModules(dependencies: ApiModuleDependencies): Readonly<ApiModulesBeforePublication & { readonly publication: PublicationApi }> {
  if (dependencies.publicationInfrastructure === undefined) {
    throw new TypeError("PublicationInfrastructure is required to compose API-014.");
  }
  return Object.freeze({
    ...composeApiModulesBeforePublication(dependencies),
    publication: composePublicationApiModule(dependencies.publicationInfrastructure),
  });
}

export function composeApiModulesBeforePublication(dependencies: Omit<ApiModuleDependencies, "publicationInfrastructure">): Readonly<ApiModulesBeforePublication> {
  return Object.freeze({
    identity: new IdentityApi({
      sessionService: dependencies.sessionService,
      authorizationService: dependencies.authorizationService,
    }),
    administrationAndAudit: new AdminAuditApi({
      administrationService: dependencies.administrationService,
      authorizationService: dependencies.authorizationService,
      auditLog: dependencies.auditLog,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    sourceAndIntake: new SourceIntakeApi({
      sourceRegistryService: dependencies.sourceRegistryService,
      intakeService: dependencies.intakeService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    jobs: new JobApi({
      jobService: dependencies.jobService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    propertyAndListing: new PropertyListingApi({
      propertyService: dependencies.propertyService,
      listingService: dependencies.listingService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    contactClient: new ContactClientApi({
      contactService: dependencies.contactService,
      clientRequirementService: dependencies.clientRequirementService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    matching: new MatchingApi({
      matchingService: dependencies.matchingService,
      matchingInputResolver: dependencies.matchingInputResolver,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    verification: new VerificationApi({
      verificationService: dependencies.verificationService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    permission: new PermissionApi({
      permissionService: dependencies.permissionService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
    proposalAndApproval: new ProposalApprovalApi({
      proposalService: dependencies.proposalService,
      publicationApprovalService: dependencies.publicationApprovalService,
      sessionReader: (sessionId) => dependencies.sessionService.readSession(sessionId),
    }),
  });
}
