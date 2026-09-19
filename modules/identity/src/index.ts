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
export {
  DurableRegisteredServiceWorkloadStore,
  RegisteredServiceWorkloadError,
  type DurableRegisteredServiceWorkloadStoreOptions,
  type RegisteredServiceWorkloadAuthorityLease,
  type RegisteredServiceWorkloadEvidenceVerifier,
  type RegisteredServiceWorkloadErrorCode,
  type RegisteredServiceWorkloadRecord,
  type RegisteredServiceWorkloadStatus,
} from "./registered-service-workload.js";
export {
  RegisteredServiceWorkloadEvidenceAuthorityAdapter,
  type ReadOnlyAuditEvidenceQueryPort,
  type RegisteredServiceWorkloadAuditEvidence,
  type RegisteredServiceWorkloadIdentityEvidence,
  type RegisteredServiceWorkloadIdentityEvidenceQueryPort,
} from "./registered-service-workload-evidence-authority.js";
export {
  REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT,
  REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT,
  REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID,
  REGISTERED_SERVICE_WORKLOAD_MIGRATION_ARTIFACT_SHA256,
  inspectRegisteredServiceWorkloadSchema,
  assertRegisteredServiceWorkloadSchemaCompatible,
} from "./registered-service-workload-schema.js";
export type { RegisteredServiceWorkloadSchemaReadiness } from "./registered-service-workload-schema.js";
export {
  PgConnectionPoolAdapter,
  PostgreSqlPersistenceError,
  type PgConnectionPoolOptions,
  type PostgreSqlClientPort,
  type PostgreSqlPoolPort,
  type PostgreSqlQueryResult,
} from "./postgresql-pool.js";
export {
  PostgreSqlSessionUnitOfWork,
  type AsyncSessionRepository,
  type AsyncSessionUnitOfWork,
} from "./session-postgresql-persistence.js";
export {
  PostgreSqlRegisteredServiceWorkloadStore,
  type AsyncRegisteredServiceWorkloadAuthorityLease,
} from "./registered-service-workload-postgresql.js";
export {
  assertPostgreSqlRegisteredServiceWorkloadSchemaCompatible,
  inspectPostgreSqlRegisteredServiceWorkloadSchema,
  POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID,
  POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_VERSION,
  POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT,
  POSTGRESQL_IDENTITY_MIGRATION_ARTIFACT_SHA256,
} from "./registered-service-workload-postgresql-schema.js";
