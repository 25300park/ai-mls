import type {
  AuditPrincipal,
  AuditSink,
  Clock,
  IdFactory,
  PrincipalType,
  RoleCode,
} from "../../../packages/security-contracts/src/index.js";
import {
  InMemorySessionUnitOfWork,
  sessionEvidenceReference,
  type DurableSessionRecord,
  type SessionUnitOfWork,
} from "./session-persistence.js";
import type { FirstPartyCredentialEvidenceV1 } from "./first-party-credential-contracts.js";
import type { PostgreSqlClientPort } from "./postgresql-pool.js";
import type { AsyncSessionUnitOfWork } from "./session-postgresql-persistence.js";

export interface ReferenceAuthenticationEvidence {
  readonly credentialReference: string;
  readonly requestedScope: string;
}
export type AuthenticationEvidence = ReferenceAuthenticationEvidence | FirstPartyCredentialEvidenceV1;

export interface AuthenticatedIdentity {
  readonly principalId: string;
  readonly principalType: PrincipalType;
  readonly roles: readonly RoleCode[];
  readonly teamId?: string;
  readonly assurance: "SINGLE_FACTOR" | "MFA" | "WORKLOAD";
  readonly isMfaVerified: boolean;
  readonly status: "ACTIVE" | "SUSPENDED" | "REVOKED";
}

export interface AuthenticationAdapter {
  verify(evidence: AuthenticationEvidence): Promise<AuthenticationResult>;
  revalidate?(identity: AuthenticatedIdentity, client: PostgreSqlClientPort): Promise<void>;
}
export type AuthenticationResult = AuthenticatedIdentity | null;

export interface SessionContext {
  readonly id: string;
  readonly principalId: string;
  readonly principalType: PrincipalType;
  readonly roles: readonly RoleCode[];
  readonly teamId?: string;
  readonly tenantId?: string;
  readonly teamBindingOrigin?: string;
  readonly state: "ACTIVE" | "REVOKED" | "EXPIRED";
  readonly assurance: AuthenticatedIdentity["assurance"];
  readonly isMfaVerified: boolean;
  readonly authenticatedAt: string;
  readonly expiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly familyId: string;
  readonly refreshReference: string;
  readonly sessionVersion?: number;
  readonly tenantBindingOrigin?: string;
  readonly issuedAt?: string;
  readonly revokedAt?: string;
  readonly revocationEvidenceRef?: string;
  readonly auditEvidenceRef?: string;
  readonly lastAccessedAt?: string;
  readonly lastMfaVerifiedAt?: string;
}

type AuthenticationAssurance = Pick<SessionContext, "assurance" | "isMfaVerified">;

export function isAuthenticationAssuranceConsistent(context: AuthenticationAssurance): boolean {
  return context.isMfaVerified !== true || context.assurance === "MFA";
}

export function hasVerifiedMfaAssurance(context: AuthenticationAssurance): boolean {
  return isAuthenticationAssuranceConsistent(context)
    && context.assurance === "MFA"
    && context.isMfaVerified === true;
}

interface SessionServiceDependencies {
  readonly authenticationAdapter: AuthenticationAdapter;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly accessLifetimeMs: number;
  readonly absoluteLifetimeMs: number;
  readonly unitOfWork?: SessionUnitOfWork;
  readonly asyncCreationUnitOfWork?: AsyncSessionUnitOfWork;
  readonly tenantBindingOrigin?: string;
  readonly postAuthenticationBinding?: PostAuthenticationBindingResolver;
}
export interface SessionIssuanceBinding {
  readonly tenantId: string;
  readonly teamId: string;
  readonly tenantBindingOrigin: "AUTHENTICATED_PRINCIPAL_TENANT";
  readonly teamBindingOrigin: "EXPLICIT_TEAM_SELECTION_VALIDATED";
}
export interface PostAuthenticationBindingResolver {
  resolve(identity: AuthenticatedIdentity, requestedTeamId: string | undefined, client: PostgreSqlClientPort): Promise<SessionIssuanceBinding>;
}

interface CreateSessionRequest {
  readonly evidence: AuthenticationEvidence;
  readonly requestId?: string;
  readonly correlationId: string;
  readonly requestedTeamId?: string;
}

interface RefreshSessionRequest {
  readonly sessionId: string;
  readonly refreshReference: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface RevokeSessionRequest {
  readonly sessionId: string;
  readonly actor: AuditPrincipal;
  readonly reason: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

export class AuthenticationError extends Error {
  public constructor(
    public readonly code: string,
    public readonly publicMessage: string,
  ) {
    super(code);
    this.name = "AuthenticationError";
  }
}

function immutableSession(session: SessionContext): SessionContext {
  const snapshot = structuredClone(session);
  Object.freeze(snapshot.roles);
  return Object.freeze(snapshot);
}

export class SessionService {
  readonly #authenticationAdapter: AuthenticationAdapter;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #accessLifetimeMs: number;
  readonly #absoluteLifetimeMs: number;
  readonly #unitOfWork: SessionUnitOfWork | undefined;
  readonly #tenantBindingOrigin: string;
  readonly #asyncCreationUnitOfWork: AsyncSessionUnitOfWork | undefined;
  readonly #postAuthenticationBinding: PostAuthenticationBindingResolver | undefined;

  public constructor(dependencies: SessionServiceDependencies) {
    this.#authenticationAdapter = dependencies.authenticationAdapter;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#accessLifetimeMs = dependencies.accessLifetimeMs;
    this.#absoluteLifetimeMs = dependencies.absoluteLifetimeMs;
    this.#asyncCreationUnitOfWork = dependencies.asyncCreationUnitOfWork;
    this.#postAuthenticationBinding = dependencies.postAuthenticationBinding;
    if (this.#postAuthenticationBinding !== undefined && this.#asyncCreationUnitOfWork === undefined) throw new AuthenticationError("AUTHENTICATION_UNAVAILABLE", "Authentication unavailable.");
    if (dependencies.authenticationAdapter.revalidate !== undefined && this.#asyncCreationUnitOfWork === undefined) {
      throw new AuthenticationError("AUTHENTICATION_UNAVAILABLE", "Authentication unavailable.");
    }
    if (this.#asyncCreationUnitOfWork !== undefined && dependencies.authenticationAdapter.revalidate === undefined) {
      throw new AuthenticationError("AUTHENTICATION_UNAVAILABLE", "Authentication unavailable.");
    }
    this.#unitOfWork = dependencies.unitOfWork ?? (this.#asyncCreationUnitOfWork === undefined ? new InMemorySessionUnitOfWork() : undefined);
    this.#tenantBindingOrigin = dependencies.tenantBindingOrigin
      ?? "authentication-adapter:test-development-compatibility";
  }

  public async createSession(request: CreateSessionRequest): Promise<SessionContext> {
    const identity = await this.#authenticationAdapter.verify(request.evidence);
    if (identity?.status !== "ACTIVE" || !isAuthenticationAssuranceConsistent(identity)) {
      this.#auditSink.append({
        eventType: "LOGIN",
        principal: { id: "anonymous", type: "HUMAN", roles: [] },
        action: "session.create",
        target: { type: "User", id: "unknown" },
        purpose: "AUTHENTICATION",
        policyVersion: "identity-v1",
        classification: "RESTRICTED_SECURITY",
        decision: "DENY",
        outcome: "FAILED",
        reason: "INVALID_CREDENTIAL",
        ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
        correlationId: request.correlationId,
      });
      throw new AuthenticationError("INVALID_CREDENTIAL", "Authentication failed.");
    }

    this.#assertPrincipalRoles(identity);
    const now = this.#clock();
    const familyId = this.#idFactory();
    const sessionId = this.#idFactory();
    const refreshReference = this.#idFactory();
    const auditEvent = this.#auditSink.append({
      eventType: "LOGIN",
      principal: identityPrincipal(identity),
      action: "session.create",
      target: { type: "Session", id: sessionEvidenceReference(sessionId) },
      purpose: "AUTHENTICATION",
      policyVersion: "identity-v1",
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "ACCEPTED",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: {
        assurance: identity.assurance,
        isMfaVerified: identity.isMfaVerified,
        ...("requestedScope" in request.evidence ? { requestedScope: request.evidence.requestedScope } : {}),
      },
    });
    let record = this.#createSessionSnapshot({
      identity,
      familyId,
      sessionId,
      refreshReference,
      issuedAt: now,
      lastAccessedAt: now,
      auditEvidenceRef: auditEvent.id,
    });
    if (this.#asyncCreationUnitOfWork === undefined) this.#storeSession(record);
    else await this.#asyncCreationUnitOfWork.transaction(
      { sessionId: record.id, expectedVersion: 0 },
      (sessions) => sessions.create(record),
      async (client) => {
        await this.#authenticationAdapter.revalidate!(identity, client);
        if (this.#postAuthenticationBinding !== undefined) {
          const binding = await this.#postAuthenticationBinding.resolve(identity, request.requestedTeamId, client);
          record = { ...record, ...binding };
        }
      },
    );
    return this.#toSessionContext(record);
  }

  get #syncUnitOfWork(): SessionUnitOfWork {
    if (this.#unitOfWork === undefined) throw new AuthenticationError("AUTHENTICATION_UNAVAILABLE", "Authentication unavailable.");
    return this.#unitOfWork;
  }

  public readSession(sessionId: string): SessionContext {
    const session = this.#requireSession(sessionId);
    const projected = this.#toSessionContext(session);
    if (session.state === "REVOKED") {
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    if (
      session.state === "EXPIRED" ||
      this.#clock().getTime() >= new Date(projected.expiresAt).getTime() ||
      this.#clock().getTime() >= new Date(projected.absoluteExpiresAt).getTime()
    ) {
      this.#syncUnitOfWork.transaction(
        { sessionId: session.id, expectedVersion: session.sessionVersion },
        () => this.#syncUnitOfWork.sessions.update(session.sessionVersion, {
          ...session,
          state: "EXPIRED",
          sessionVersion: session.sessionVersion + 1,
        }),
      );
      throw new AuthenticationError("SESSION_EXPIRED", "Session is not active.");
    }
    return projected;
  }

  public refreshSession(request: RefreshSessionRequest): SessionContext {
    const current = this.#requireSession(request.sessionId);
    if (current.state === "REVOKED" && current.refreshReference === request.refreshReference) {
      this.#revokeFamily(
        current.familyId,
        current.revokedAt ?? this.#clock().toISOString(),
        current.revocationEvidenceRef ?? current.auditEvidenceRef,
      );
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    if (current.state !== "ACTIVE" || current.refreshReference !== request.refreshReference) {
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    this.readSession(current.id);

    const identity: AuthenticatedIdentity = {
      principalId: current.principalId,
      principalType: current.principalType,
      roles: current.roles,
      ...(current.teamId === undefined ? {} : { teamId: current.teamId }),
      assurance: current.assurance,
      isMfaVerified: current.isMfaVerified,
      status: "ACTIVE",
    };
    const now = this.#clock();
    const successorId = this.#idFactory();
    const successorRefreshReference = this.#idFactory();
    const auditEvent = this.#auditSink.append({
      eventType: "SESSION_REFRESH",
      principal: identityPrincipal(identity),
      action: "session.refresh",
      target: { type: "Session", id: sessionEvidenceReference(successorId) },
      purpose: "AUTHENTICATION",
      policyVersion: "identity-v1",
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "ACCEPTED",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: { predecessorSessionRef: sessionEvidenceReference(current.id) },
    });
    this.#syncUnitOfWork.transaction(
      { sessionId: current.id, expectedVersion: current.sessionVersion },
      () => this.#syncUnitOfWork.sessions.appendRevocation(current.sessionVersion, {
        sessionId: current.id,
        revokedAt: now.toISOString(),
        revocationEvidenceRef: auditEvent.id,
        auditEvidenceRef: auditEvent.id,
      }),
    );
    const successor = this.#createSessionSnapshot({
      identity,
      familyId: current.familyId,
      sessionId: successorId,
      refreshReference: successorRefreshReference,
      issuedAt: new Date(current.issuedAt),
      lastAccessedAt: now,
      auditEvidenceRef: auditEvent.id,
      ...(current.tenantId === undefined || current.teamId === undefined || current.teamBindingOrigin !== "EXPLICIT_TEAM_SELECTION_VALIDATED" ? {} : { binding: {
        tenantId: current.tenantId, teamId: current.teamId, tenantBindingOrigin: "AUTHENTICATED_PRINCIPAL_TENANT" as const, teamBindingOrigin: "EXPLICIT_TEAM_SELECTION_VALIDATED" as const,
      } }),
      ...(current.lastMfaVerifiedAt === undefined
        ? {}
        : { lastMfaVerifiedAt: new Date(current.lastMfaVerifiedAt) }),
    });
    this.#storeSession(successor);
    return this.#toSessionContext(successor);
  }

  public revokeSession(request: RevokeSessionRequest): SessionContext {
    if (request.reason.trim().length === 0) {
      throw new Error("REVOCATION_REASON_REQUIRED");
    }
    const session = this.#requireSession(request.sessionId);
    const revokedAt = this.#clock().toISOString();
    const auditEvent = this.#auditSink.append({
      eventType: "SESSION_REVOKE",
      principal: request.actor,
      action: "session.revoke",
      target: { type: "Session", id: sessionEvidenceReference(session.id) },
      purpose: "ACCESS_GOVERNANCE",
      policyVersion: "identity-v1",
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "ACCEPTED",
      reason: request.reason,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    this.#syncUnitOfWork.transaction(
      { sessionId: session.id, expectedVersion: session.sessionVersion },
      () => this.#syncUnitOfWork.sessions.appendRevocation(session.sessionVersion, {
        sessionId: session.id,
        revokedAt,
        revocationEvidenceRef: auditEvent.id,
        auditEvidenceRef: auditEvent.id,
      }),
    );
    return this.#toSessionContext(this.#requireSession(session.id));
  }

  #assertPrincipalRoles(identity: AuthenticatedIdentity): void {
    if (
      identity.principalType === "SERVICE" &&
      identity.roles.some((role) => role !== "SVC")
    ) {
      throw new AuthenticationError(
        "SERVICE_ROLE_PROHIBITED",
        "Authentication failed.",
      );
    }
    if (identity.principalType === "HUMAN" && identity.roles.includes("SVC")) {
      throw new AuthenticationError(
        "HUMAN_SERVICE_ROLE_PROHIBITED",
        "Authentication failed.",
      );
    }
  }

  #createSessionSnapshot(input: {
    readonly identity: AuthenticatedIdentity;
    readonly familyId: string;
    readonly sessionId: string;
    readonly refreshReference: string;
    readonly issuedAt: Date;
    readonly lastAccessedAt: Date;
    readonly lastMfaVerifiedAt?: Date;
    readonly auditEvidenceRef: string;
    readonly binding?: SessionIssuanceBinding;
  }): DurableSessionRecord {
    const lastMfaVerifiedAt = input.lastMfaVerifiedAt
      ?? (input.identity.isMfaVerified ? input.lastAccessedAt : undefined);
    return {
      id: input.sessionId,
      principalId: input.identity.principalId,
      principalType: input.identity.principalType,
      roles: input.identity.roles,
      ...(input.identity.teamId === undefined ? {} : { teamId: input.identity.teamId }),
      state: "ACTIVE",
      assurance: input.identity.assurance,
      isMfaVerified: input.identity.isMfaVerified,
      familyId: input.familyId,
      refreshReference: input.refreshReference,
      sessionVersion: 1,
      tenantBindingOrigin: this.#tenantBindingOrigin,
      ...input.binding,
      issuedAt: input.issuedAt.toISOString(),
      auditEvidenceRef: input.auditEvidenceRef,
      lastAccessedAt: input.lastAccessedAt.toISOString(),
      ...(lastMfaVerifiedAt === undefined
        ? {}
        : { lastMfaVerifiedAt: lastMfaVerifiedAt.toISOString() }),
    };
  }

  #toSessionContext(record: DurableSessionRecord): SessionContext {
    const absoluteExpiry = new Date(
      new Date(record.issuedAt).getTime() + this.#absoluteLifetimeMs,
    ).toISOString();
    const accessExpiry = new Date(
      Math.min(
        new Date(record.issuedAt).getTime() + this.#accessLifetimeMs,
        new Date(absoluteExpiry).getTime(),
      ),
    ).toISOString();
    return immutableSession({
      ...record,
      authenticatedAt: record.issuedAt,
      expiresAt: accessExpiry,
      absoluteExpiresAt: absoluteExpiry,
    });
  }

  #storeSession(session: DurableSessionRecord): void {
    this.#syncUnitOfWork.transaction(
      { sessionId: session.id, expectedVersion: 0 },
      () => this.#syncUnitOfWork.sessions.create(session),
    );
  }

  #requireSession(sessionId: string): DurableSessionRecord {
    const session = this.#syncUnitOfWork.sessions.find(sessionId);
    if (session === undefined) {
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    return session;
  }

  #revokeFamily(familyId: string, revokedAt: string, evidenceRef: string): void {
    for (const session of this.#syncUnitOfWork.sessions.listByFamily(familyId)) {
      if (session.state !== "ACTIVE") continue;
      this.#syncUnitOfWork.transaction(
        { sessionId: session.id, expectedVersion: session.sessionVersion },
        () => this.#syncUnitOfWork.sessions.appendRevocation(session.sessionVersion, {
          sessionId: session.id,
          revokedAt,
          revocationEvidenceRef: evidenceRef,
          auditEvidenceRef: evidenceRef,
        }),
      );
    }
  }
}

function identityPrincipal(identity: AuthenticatedIdentity): AuditPrincipal {
  return {
    id: identity.principalId,
    type: identity.principalType,
    roles: identity.roles,
    ...(identity.teamId === undefined ? {} : { teamId: identity.teamId }),
  };
}
