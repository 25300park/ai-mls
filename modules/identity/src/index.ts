export {
  AuthenticationError,
  hasVerifiedMfaAssurance,
  isAuthenticationAssuranceConsistent,
  SessionService,
  type AuthenticatedIdentity,
  type AuthenticationAdapter,
  type AuthenticationEvidence,
  type SessionContext,
} from "./session-service.js";
export {
  InMemorySessionUnitOfWork,
  SessionPersistenceError,
  type DurableSessionRecord,
  type SessionMutationIdentity,
  type SessionPersistenceErrorCode,
  type SessionRepository,
  type SessionRevocationRecord,
  type SessionUnitOfWork,
  type TrustedSessionBinding,
  type TrustedSessionBindingRequest,
  type TrustedSessionBindingResolver,
} from "./session-persistence.js";
export {
  DurableSessionUnitOfWork,
  type DurableSessionUnitOfWorkOptions,
} from "./session-durable-persistence.js";
export {
  SessionAccessCoordinator,
  type AuthorizedSessionResolution,
  type ResolveAuthorizedSessionRequest,
  type SessionAccessCoordinatorDependencies,
} from "./session-access-coordinator.js";
