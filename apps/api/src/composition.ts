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

export interface ApiModuleDependencies {
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

export function composeApiModules(dependencies: ApiModuleDependencies): Readonly<{
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
}> {
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
