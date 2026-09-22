import type { AdministrationService } from "../../../modules/administration/src/administration-service.js";
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
import {
  createProductionPublicationInfrastructure,
  type PublicationInfrastructure,
} from "../../../modules/publication/src/publication-infrastructure.js";
import type { PublicationInfrastructureConfigurationInput } from "../../../modules/publication/src/publication-infrastructure-configuration.js";
import { PublicationApplicationHost } from "../../../modules/publication/src/publication-application-host.js";
import { composePublicationHostApplication } from "../../../modules/publication/src/publication-composition-root.js";
import { SystemPublicationHostClock } from "../../../modules/publication/src/publication-host-clock.js";
import {
  createPublicationNodeHttpServer,
  type PublicationNodeHttpServer,
} from "../../../modules/publication/src/publication-node-http-server.js";
import type {
  PublicationNodeHttpServerRequestIdFactory,
} from "../../../modules/publication/src/publication-node-http-contracts.js";
import { AdminAuditApi } from "./admin-audit-api.js";
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
import {
  createPublicationApi014HttpRequestHandler,
  type PublicationApi014HttpRequestHandler,
} from "./publication-api-http-adapter.js";
import { PublicationApiRuntimeAdapter } from "./publication-api-runtime-adapter.js";
import { assertProductionRootBootstrapContext, type ProductionBootstrapContextView } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";

export function composePublicationApiModule(infrastructure: PublicationInfrastructure): PublicationApi {
  return new PublicationApi(infrastructure);
}

export {
  composeAdministrationApi015NodeHttpServer,
  composeProductionAdministrationApi015NodeHttpServer,
  type AdministrationApi015NodeHttpCompositionOptions,
  type ProductionAdministrationComposition,
  type ProductionAdministrationCompositionOptions,
} from "./administration-production-composition.js";

export interface ProductionPublicationApi014NodeHttpCompositionOptions {
  readonly databasePath: string;
  readonly runtimeEnvironment: "TEST" | "STAGING" | "PRODUCTION";
  readonly bootstrapContext?: ProductionBootstrapContextView;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
  readonly deferRuntimeActivation?: true;
  readonly infrastructureConfiguration?: PublicationInfrastructureConfigurationInput;
  readonly configuration?: unknown;
  readonly existingHttpHandler?: PublicationApi014HttpRequestHandler;
  readonly requestIdFactory?: PublicationNodeHttpServerRequestIdFactory;
}

export interface ProductionPublicationApi014NodeHttpComposition {
  readonly server: PublicationNodeHttpServer;
  activateRuntime(): void;
  close(): Promise<void>;
}

export interface ProductionPublicationApi014HttpHandlerComposition {
  readonly httpHandler: PublicationApi014HttpRequestHandler;
  activateRuntime(): void;
  close(): Promise<void>;
}

export function composeProductionPublicationApi014HttpHandler(
  options: ProductionPublicationApi014NodeHttpCompositionOptions,
): ProductionPublicationApi014HttpHandlerComposition {
  if (!isRuntimeEnvironment(options.runtimeEnvironment)) throw new TypeError("Runtime environment is required.");
  if (options.runtimeEnvironment === "PRODUCTION") assertProductionRootBootstrapContext(options.bootstrapContext);
  else if (options.bootstrapContext !== undefined) throw new TypeError("Bootstrap context is Production-only.");
  const infrastructure = createProductionPublicationInfrastructure({
    databasePath: options.databasePath,
    ...(options.schemaMode === undefined ? {} : { schemaMode: options.schemaMode }),
    ...(options.infrastructureConfiguration === undefined ? {} : { configuration: options.infrastructureConfiguration }),
  });
  let host: PublicationApplicationHost | undefined;
  try {
    const api = new PublicationApi(infrastructure);
    const canonicalApiPort = new PublicationApiRuntimeAdapter(api);
    host = new PublicationApplicationHost(
      composePublicationHostApplication,
      new SystemPublicationHostClock(),
      { runtimeOptions: { infrastructureFactory: (): PublicationInfrastructure => infrastructure, canonicalApiPort } },
    );
    if (options.deferRuntimeActivation !== true) host.start();
    const httpHandler = createPublicationApi014HttpRequestHandler(host, options.existingHttpHandler);
    return Object.freeze({
      httpHandler,
      activateRuntime: (): void => { if (host?.status.state !== "READY") host?.start(); },
      close: (): Promise<void> => {
        try { if (host?.status.state === "READY") host.stop(); }
        finally { infrastructure.unitOfWork.close(); }
        return Promise.resolve();
      },
    });
  } catch (error) {
    try { if (host?.status.state === "READY") host.stop(); }
    finally { infrastructure.unitOfWork.close(); }
    throw error;
  }
}

export function composeProductionPublicationApi014NodeHttpServer(
  options: ProductionPublicationApi014NodeHttpCompositionOptions,
): ProductionPublicationApi014NodeHttpComposition {
  if (options.runtimeEnvironment === "PRODUCTION") throw new TypeError("Independent Production listener is unavailable.");
  const root = composeProductionPublicationApi014HttpHandler(options);
  let server: PublicationNodeHttpServer | undefined;
  try {
    server = createPublicationNodeHttpServer({
      configuration: options.configuration,
      httpAdapter: root.httpHandler,
      ...(options.requestIdFactory === undefined ? {} : { requestIdFactory: options.requestIdFactory }),
    });
    return Object.freeze({
      server,
      activateRuntime: () => root.activateRuntime(),
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
