import type {
  AuthorizationDecision,
  AuthorizationResource,
  AuthorizationService,
} from "../../authorization/src/authorization-service.js";
import {
  SessionPersistenceError,
  sessionEvidenceReference,
  type DurableSessionRecord,
  type SessionUnitOfWork,
  type TrustedSessionBinding,
  type TrustedSessionBindingResolver,
} from "./session-persistence.js";
import {
  AuthenticationError,
  type SessionContext,
} from "./session-service.js";

const IDLE_TIMEOUT_MILLISECONDS = 30 * 60 * 1000;
const ABSOLUTE_LIFETIME_MILLISECONDS = 12 * 60 * 60 * 1000;
const MFA_FRESHNESS_MILLISECONDS = 15 * 60 * 1000;

export interface ResolveAuthorizedSessionRequest {
  readonly sessionId: string;
  readonly action: string;
  readonly resource: AuthorizationResource;
  readonly purpose: string;
  readonly reason?: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

export interface SessionAccessCoordinatorDependencies {
  readonly unitOfWork: SessionUnitOfWork;
  readonly bindingResolver: TrustedSessionBindingResolver;
  readonly authorization: Pick<AuthorizationService, "evaluate">;
  readonly clock: () => Date;
}

export interface AuthorizedSessionResolution {
  readonly session: SessionContext;
  readonly decision: AuthorizationDecision;
}

export class SessionAccessCoordinator {
  readonly #unitOfWork: SessionUnitOfWork;
  readonly #bindingResolver: TrustedSessionBindingResolver;
  readonly #authorization: Pick<AuthorizationService, "evaluate">;
  readonly #clock: () => Date;

  public constructor(dependencies: SessionAccessCoordinatorDependencies) {
    this.#unitOfWork = dependencies.unitOfWork;
    this.#bindingResolver = dependencies.bindingResolver;
    this.#authorization = dependencies.authorization;
    this.#clock = dependencies.clock;
  }

  public resolveAuthorized(request: ResolveAuthorizedSessionRequest): SessionContext {
    return this.resolveAuthorizedWithDecision(request).session;
  }

  public resolveAuthorizedWithDecision(
    request: ResolveAuthorizedSessionRequest,
  ): AuthorizedSessionResolution {
    if (!validLocator(request.sessionId)) throw authenticationRequired();
    const record = this.#unitOfWork.sessions.find(request.sessionId);
    if (record?.state !== "ACTIVE") throw authenticationRequired();

    const now = this.#clock();
    if (!isFresh(record, now)) throw authenticationRequired();
    const tenantId = request.resource.tenantId;
    if (tenantId === undefined || tenantId.trim().length === 0) throw forbidden();

    const binding = this.#resolveBinding(record, request, tenantId);
    const session = projectSession(record, binding);
    let decision: AuthorizationDecision;
    try {
      decision = this.#authorization.evaluate({
        session,
        action: request.action,
        resource: request.resource,
        purpose: request.purpose,
        ...(request.reason === undefined ? {} : { reason: request.reason }),
        ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
        correlationId: request.correlationId,
      });
    } catch {
      throw authenticationRequired();
    }
    assertAllowed(decision);
    if (decision.obligations.includes("MFA") && !hasFreshMfa(record, now)) {
      throw new AuthenticationError(
        "REAUTHENTICATION_REQUIRED",
        "Reauthentication is required.",
      );
    }

    const updated: DurableSessionRecord = {
      ...record,
      sessionVersion: record.sessionVersion + 1,
      lastAccessedAt: now.toISOString(),
    };
    try {
      this.#unitOfWork.transaction(
        { sessionId: record.id, expectedVersion: record.sessionVersion },
        () => this.#unitOfWork.sessions.update(record.sessionVersion, updated),
      );
    } catch (error) {
      if (error instanceof SessionPersistenceError
        && error.code === "SESSION_VERSION_CONFLICT") {
        throw authenticationRequired();
      }
      throw error;
    }
    return Object.freeze({
      session: projectSession(updated, binding),
      decision: immutableDecision(decision),
    });
  }

  #resolveBinding(
    record: DurableSessionRecord,
    request: ResolveAuthorizedSessionRequest,
    tenantId: string,
  ): TrustedSessionBinding {
    let binding: TrustedSessionBinding | null;
    try {
      binding = this.#bindingResolver.resolve({
        session: record,
        tenantId,
        resourceType: request.resource.type,
        purpose: request.purpose,
        ...(request.resource.teamId === undefined ? {} : { teamId: request.resource.teamId }),
      });
    } catch {
      throw authenticationRequired();
    }
    if (binding?.actor.id !== record.principalId
      || binding.actor.type !== record.principalType
      || binding.tenantId !== tenantId
      || binding.tenantBindingOrigin !== record.tenantBindingOrigin) {
      throw forbidden();
    }
    return binding;
  }
}

function immutableDecision(decision: AuthorizationDecision): AuthorizationDecision {
  const snapshot = structuredClone(decision);
  Object.freeze(snapshot.obligations);
  Object.freeze(snapshot.assignmentIds);
  return Object.freeze(snapshot);
}

function projectSession(
  record: DurableSessionRecord,
  binding: TrustedSessionBinding,
): SessionContext {
  const absoluteExpiresAt = new Date(
    Date.parse(record.issuedAt) + ABSOLUTE_LIFETIME_MILLISECONDS,
  ).toISOString();
  const snapshot: SessionContext = {
    id: sessionEvidenceReference(record.id),
    principalId: binding.actor.id,
    principalType: binding.actor.type,
    roles: binding.actor.roles,
    ...(binding.actor.teamId === undefined ? {} : { teamId: binding.actor.teamId }),
    state: record.state,
    assurance: record.assurance,
    isMfaVerified: record.isMfaVerified,
    authenticatedAt: record.issuedAt,
    expiresAt: absoluteExpiresAt,
    absoluteExpiresAt,
    familyId: sessionEvidenceReference(record.familyId),
    refreshReference: "[PROTECTED]",
    sessionVersion: record.sessionVersion,
    tenantBindingOrigin: record.tenantBindingOrigin,
    issuedAt: record.issuedAt,
    ...(record.revokedAt === undefined ? {} : { revokedAt: record.revokedAt }),
    ...(record.revocationEvidenceRef === undefined
      ? {}
      : { revocationEvidenceRef: record.revocationEvidenceRef }),
    auditEvidenceRef: record.auditEvidenceRef,
    lastAccessedAt: record.lastAccessedAt,
    ...(record.lastMfaVerifiedAt === undefined
      ? {}
      : { lastMfaVerifiedAt: record.lastMfaVerifiedAt }),
  };
  const immutable = structuredClone(snapshot);
  Object.freeze(immutable.roles);
  return Object.freeze(immutable);
}

function isFresh(record: DurableSessionRecord, now: Date): boolean {
  const current = now.getTime();
  const issued = Date.parse(record.issuedAt);
  const lastAccess = Date.parse(record.lastAccessedAt);
  return Number.isFinite(issued)
    && Number.isFinite(lastAccess)
    && current >= issued
    && current >= lastAccess
    && current - issued < ABSOLUTE_LIFETIME_MILLISECONDS
    && current - lastAccess < IDLE_TIMEOUT_MILLISECONDS;
}

function hasFreshMfa(record: DurableSessionRecord, now: Date): boolean {
  if (record.assurance !== "MFA"
    || record.isMfaVerified !== true
    || record.lastMfaVerifiedAt === undefined) {
    return false;
  }
  const verified = Date.parse(record.lastMfaVerifiedAt);
  const elapsed = now.getTime() - verified;
  return Number.isFinite(verified)
    && elapsed >= 0
    && elapsed <= MFA_FRESHNESS_MILLISECONDS;
}

function assertAllowed(decision: AuthorizationDecision): void {
  if (decision.effect === "ALLOW") return;
  throw new AuthenticationError(decision.reasonCode, "Authorization failed.");
}

function validLocator(value: string): boolean {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 512
    && value.trim() === value
    && /^[A-Za-z0-9._:-]+$/u.test(value);
}

function authenticationRequired(): AuthenticationError {
  return new AuthenticationError("AUTHENTICATION_REQUIRED", "Authentication is required.");
}

function forbidden(): AuthenticationError {
  return new AuthenticationError("FORBIDDEN", "Access is denied.");
}
