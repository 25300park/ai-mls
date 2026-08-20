export {
  AdministrationService,
  type GovernedRoleAssignment,
  type ProposeAssignmentRequest,
} from "./administration-service.js";

export {
  AdministrationPersistenceError,
  InMemoryAdministrationUnitOfWork,
  type AdministrationDecisionReadRepository,
  type AdministrationDecisionRecord,
  type AdministrationIdempotencyReadRepository,
  type AdministrationIdempotencyRecord,
  type AdministrationPersistenceScope,
  type AdministrationProposalReadRepository,
  type AdministrationProposalRecord,
  type AdministrationTransaction,
  type AdministrationTransactionIdentity,
  type AdministrationUnitOfWork,
  type PolicyPersistenceRecord,
  type PolicyReadRepository,
  type PublicationTargetGovernancePersistenceRecord,
  type PublicationTargetReadRepository,
  type RoleAssignmentPersistenceRecord,
  type RoleAssignmentReadRepository,
  type RolePersistenceRecord,
  type RoleReadRepository,
  type SourceGovernancePersistenceRecord,
  type SourceGovernanceReadRepository,
  type TeamScopePersistenceRecord,
  type TeamScopeReadRepository,
} from "./administration-persistence.js";

export {
  AdministrationLiveAssignmentAdapter,
  createAdministrationBackedAuthorizationService,
  type LiveAdministrationAuthorizationService,
} from "./live-assignment-adapter.js";
