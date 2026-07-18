import type {
  AuditPrincipal,
  AuditSink,
  Clock,
  IdFactory,
  PrincipalType,
  RoleCode,
} from "../../../packages/security-contracts/src/index.js";

export interface AuthenticationEvidence {
  readonly credentialReference: string;
  readonly requestedScope: string;
}

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
  verify(evidence: AuthenticationEvidence): AuthenticatedIdentity | null;
}

export interface SessionContext {
  readonly id: string;
  readonly principalId: string;
  readonly principalType: PrincipalType;
  readonly roles: readonly RoleCode[];
  readonly teamId?: string;
  readonly state: "ACTIVE" | "REVOKED" | "EXPIRED";
  readonly assurance: AuthenticatedIdentity["assurance"];
  readonly isMfaVerified: boolean;
  readonly authenticatedAt: string;
  readonly expiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly familyId: string;
  readonly refreshReference: string;
}

interface SessionServiceDependencies {
  readonly authenticationAdapter: AuthenticationAdapter;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly accessLifetimeMs: number;
  readonly absoluteLifetimeMs: number;
}

interface CreateSessionRequest {
  readonly evidence: AuthenticationEvidence;
  readonly requestId?: string;
  readonly correlationId: string;
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

function sessionPrincipal(session: SessionContext): AuditPrincipal {
  return {
    id: session.principalId,
    type: session.principalType,
    roles: session.roles,
    ...(session.teamId === undefined ? {} : { teamId: session.teamId }),
    sessionId: session.id,
  };
}

export class SessionService {
  readonly #authenticationAdapter: AuthenticationAdapter;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #accessLifetimeMs: number;
  readonly #absoluteLifetimeMs: number;
  readonly #sessions = new Map<string, SessionContext>();
  readonly #familySessions = new Map<string, Set<string>>();
  readonly #consumedRefreshReferences = new Set<string>();

  public constructor(dependencies: SessionServiceDependencies) {
    this.#authenticationAdapter = dependencies.authenticationAdapter;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#accessLifetimeMs = dependencies.accessLifetimeMs;
    this.#absoluteLifetimeMs = dependencies.absoluteLifetimeMs;
  }

  public createSession(request: CreateSessionRequest): SessionContext {
    const identity = this.#authenticationAdapter.verify(request.evidence);
    if (identity?.status !== "ACTIVE") {
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
    const session = this.#createSessionSnapshot(identity, familyId, now, undefined);
    this.#storeSession(session);
    this.#auditSink.append({
      eventType: "LOGIN",
      principal: sessionPrincipal(session),
      action: "session.create",
      target: { type: "Session", id: session.id },
      purpose: "AUTHENTICATION",
      policyVersion: "identity-v1",
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "COMPLETED",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: {
        assurance: session.assurance,
        isMfaVerified: session.isMfaVerified,
        requestedScope: request.evidence.requestedScope,
      },
    });
    return session;
  }

  public readSession(sessionId: string): SessionContext {
    const session = this.#requireSession(sessionId);
    if (session.state === "REVOKED") {
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    if (
      session.state === "EXPIRED" ||
      this.#clock().getTime() >= new Date(session.expiresAt).getTime() ||
      this.#clock().getTime() >= new Date(session.absoluteExpiresAt).getTime()
    ) {
      this.#sessions.set(session.id, immutableSession({ ...session, state: "EXPIRED" }));
      throw new AuthenticationError("SESSION_EXPIRED", "Session is not active.");
    }
    return session;
  }

  public refreshSession(request: RefreshSessionRequest): SessionContext {
    const current = this.#requireSession(request.sessionId);
    if (this.#consumedRefreshReferences.has(request.refreshReference)) {
      this.#revokeFamily(current.familyId);
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    if (current.state !== "ACTIVE" || current.refreshReference !== request.refreshReference) {
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    this.readSession(current.id);

    this.#consumedRefreshReferences.add(current.refreshReference);
    this.#sessions.set(current.id, immutableSession({ ...current, state: "REVOKED" }));
    const identity: AuthenticatedIdentity = {
      principalId: current.principalId,
      principalType: current.principalType,
      roles: current.roles,
      ...(current.teamId === undefined ? {} : { teamId: current.teamId }),
      assurance: current.assurance,
      isMfaVerified: current.isMfaVerified,
      status: "ACTIVE",
    };
    const successor = this.#createSessionSnapshot(
      identity,
      current.familyId,
      this.#clock(),
      current.absoluteExpiresAt,
    );
    this.#storeSession(successor);
    this.#auditSink.append({
      eventType: "SESSION_REFRESH",
      principal: sessionPrincipal(successor),
      action: "session.refresh",
      target: { type: "Session", id: successor.id },
      purpose: "AUTHENTICATION",
      policyVersion: "identity-v1",
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "COMPLETED",
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: { predecessorSessionId: current.id },
    });
    return successor;
  }

  public revokeSession(request: RevokeSessionRequest): SessionContext {
    if (request.reason.trim().length === 0) {
      throw new Error("REVOCATION_REASON_REQUIRED");
    }
    const session = this.#requireSession(request.sessionId);
    const revoked = immutableSession({ ...session, state: "REVOKED" });
    this.#sessions.set(revoked.id, revoked);
    this.#auditSink.append({
      eventType: "SESSION_REVOKE",
      principal: request.actor,
      action: "session.revoke",
      target: { type: "Session", id: revoked.id },
      purpose: "ACCESS_GOVERNANCE",
      policyVersion: "identity-v1",
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "COMPLETED",
      reason: request.reason,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    return revoked;
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

  #createSessionSnapshot(
    identity: AuthenticatedIdentity,
    familyId: string,
    now: Date,
    inheritedAbsoluteExpiry: string | undefined,
  ): SessionContext {
    const absoluteExpiry =
      inheritedAbsoluteExpiry ??
      new Date(now.getTime() + this.#absoluteLifetimeMs).toISOString();
    const accessExpiry = new Date(
      Math.min(
        now.getTime() + this.#accessLifetimeMs,
        new Date(absoluteExpiry).getTime(),
      ),
    ).toISOString();
    return immutableSession({
      id: this.#idFactory(),
      principalId: identity.principalId,
      principalType: identity.principalType,
      roles: identity.roles,
      ...(identity.teamId === undefined ? {} : { teamId: identity.teamId }),
      state: "ACTIVE",
      assurance: identity.assurance,
      isMfaVerified: identity.isMfaVerified,
      authenticatedAt: now.toISOString(),
      expiresAt: accessExpiry,
      absoluteExpiresAt: absoluteExpiry,
      familyId,
      refreshReference: this.#idFactory(),
    });
  }

  #storeSession(session: SessionContext): void {
    this.#sessions.set(session.id, session);
    const family = this.#familySessions.get(session.familyId) ?? new Set<string>();
    family.add(session.id);
    this.#familySessions.set(session.familyId, family);
  }

  #requireSession(sessionId: string): SessionContext {
    const session = this.#sessions.get(sessionId);
    if (session === undefined) {
      throw new AuthenticationError("SESSION_REVOKED", "Session is not active.");
    }
    return session;
  }

  #revokeFamily(familyId: string): void {
    for (const sessionId of this.#familySessions.get(familyId) ?? []) {
      const session = this.#sessions.get(sessionId);
      if (session !== undefined) {
        this.#sessions.set(sessionId, immutableSession({ ...session, state: "REVOKED" }));
      }
    }
  }
}
