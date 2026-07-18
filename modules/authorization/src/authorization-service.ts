import type {
  AuditSink,
  Clock,
  RoleCode,
} from "../../../packages/security-contracts/src/index.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export interface RoleAssignment {
  readonly id: string;
  readonly principalId: string;
  readonly role: RoleCode;
  readonly teamIds: readonly string[];
  readonly resourceTypes: readonly string[];
  readonly purposes: readonly string[];
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
  readonly status: "ACTIVE" | "REVOKED" | "EXPIRED";
}

export interface AuthorizationResource {
  readonly type: string;
  readonly id: string;
  readonly version?: number;
  readonly teamId?: string;
  readonly createdBy?: string;
}

export interface AuthorizationRequest {
  readonly session: SessionContext;
  readonly action: string;
  readonly resource: AuthorizationResource;
  readonly purpose: string;
  readonly reason?: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

export interface AuthorizationDecision {
  readonly effect: "ALLOW" | "DENY";
  readonly reasonCode: string;
  readonly policyVersion: string;
  readonly obligations: readonly ("AUDIT" | "MFA" | "REASON")[];
  readonly assignmentIds: readonly string[];
  readonly expiresAt?: string;
}

interface AuthorizationServiceDependencies {
  readonly assignments: readonly RoleAssignment[];
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly policyVersion: string;
}

const capabilities: Readonly<Record<RoleCode, readonly string[]>> = {
  COL: [
    "resource.view",
    "resource.create",
    "resource.edit",
    "source.read",
    "source.propose",
    "intake.create",
    "intake.read",
    "intake.validate",
    "intake.request-ai",
    "job.submit",
    "job.read",
  ],
  AGT: ["resource.view", "resource.create", "resource.edit"],
  SAG: [
    "resource.view",
    "resource.create",
    "resource.edit",
    "proposal.approve",
    "source.read",
    "intake.create",
    "intake.read",
    "intake.validate",
    "intake.request-ai",
    "intake.review",
    "job.submit",
    "job.read",
  ],
  REV: ["resource.view"],
  AIR: ["resource.view", "ai.review", "intake.read"],
  DUR: ["resource.view", "duplicate.dispose"],
  VER: ["resource.view", "verification.perform"],
  PMR: ["resource.view", "permission.approve"],
  PUA: ["resource.view", "publication.approve"],
  MGR: ["resource.view", "audit.query"],
  DST: [
    "resource.view",
    "resource.create",
    "resource.edit",
    "source.read",
    "source.propose",
    "intake.create",
    "intake.read",
    "intake.validate",
    "intake.request-ai",
    "intake.review",
    "job.submit",
    "job.read",
  ],
  OPS: [
    "resource.view",
    "publication.deliver",
    "resource.export",
    "job.submit",
    "job.read",
    "job.execute",
    "job.cancel",
    "job.retry",
  ],
  SEC: ["audit.query", "audit.export", "security.admin", "resource.view", "source.read"],
  ADM: [
    "admin.role.propose",
    "admin.role.approve",
    "admin.role.revoke",
    "audit.query",
    "audit.export",
    "resource.view",
    "source.read",
    "source.propose",
    "job.submit",
    "job.read",
    "job.execute",
    "job.cancel",
    "job.retry",
  ],
  SVC: [
    "service.execute",
    "publication.deliver",
    "source.read",
    "source.propose",
    "intake.create",
    "intake.read",
    "intake.validate",
    "intake.request-ai",
    "job.submit",
    "job.read",
    "job.execute",
  ],
  EXT: [],
};

const privilegedActions = new Set([
  "admin.role.propose",
  "admin.role.approve",
  "admin.role.revoke",
  "audit.export",
  "publication.approve",
  "restricted.reveal",
  "security.admin",
]);

const humanAuthorityActions = new Set([
  "ai.review",
  "duplicate.dispose",
  "intake.review",
  "permission.approve",
  "proposal.approve",
  "publication.approve",
  "verification.perform",
]);

function immutableDecision(decision: AuthorizationDecision): AuthorizationDecision {
  const snapshot = structuredClone(decision);
  Object.freeze(snapshot.obligations);
  Object.freeze(snapshot.assignmentIds);
  return Object.freeze(snapshot);
}

export class AuthorizationService {
  readonly #assignments: readonly RoleAssignment[];
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #policyVersion: string;

  public constructor(dependencies: AuthorizationServiceDependencies) {
    this.#assignments = dependencies.assignments.map((item) =>
      Object.freeze(structuredClone(item)),
    );
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#policyVersion = dependencies.policyVersion;
  }

  public evaluate(request: AuthorizationRequest): AuthorizationDecision {
    const now = this.#clock();
    const obligations = privilegedActions.has(request.action)
      ? (["MFA", "REASON", "AUDIT"] as const)
      : (["AUDIT"] as const);

    if (
      request.session.state !== "ACTIVE" ||
      now.getTime() >= new Date(request.session.expiresAt).getTime() ||
      now.getTime() >= new Date(request.session.absoluteExpiresAt).getTime()
    ) {
      return this.#complete(request, "DENY", "AUTHENTICATION_REQUIRED", obligations, []);
    }

    if (
      request.session.principalType === "SERVICE" &&
      humanAuthorityActions.has(request.action)
    ) {
      return this.#complete(request, "DENY", "HUMAN_AUTHORITY_REQUIRED", obligations, []);
    }

    const activeAssignments = this.#assignments.filter(
      (item) =>
        item.principalId === request.session.principalId &&
        item.status === "ACTIVE" &&
        request.session.roles.includes(item.role) &&
        now.getTime() >= new Date(item.effectiveFrom).getTime() &&
        now.getTime() < new Date(item.effectiveUntil).getTime(),
    );
    if (activeAssignments.length === 0) {
      return this.#complete(request, "DENY", "NO_ACTIVE_ASSIGNMENT", obligations, []);
    }

    const scopedAssignments = activeAssignments.filter(
      (item) =>
        item.resourceTypes.includes(request.resource.type) &&
        item.purposes.includes(request.purpose) &&
        (request.resource.teamId === undefined ||
          item.teamIds.includes(request.resource.teamId)),
    );
    if (scopedAssignments.length === 0) {
      return this.#complete(
        request,
        "DENY",
        "SCOPE_DENIED",
        obligations,
        activeAssignments,
      );
    }

    const capableAssignments = scopedAssignments.filter((item) =>
      capabilities[item.role].includes(request.action),
    );
    if (capableAssignments.length === 0) {
      return this.#complete(
        request,
        "DENY",
        "CAPABILITY_DENIED",
        obligations,
        scopedAssignments,
      );
    }

    if (privilegedActions.has(request.action) && !request.session.isMfaVerified) {
      return this.#complete(
        request,
        "DENY",
        "REAUTHENTICATION_REQUIRED",
        obligations,
        capableAssignments,
      );
    }
    if (
      privilegedActions.has(request.action) &&
      (request.reason === undefined || request.reason.trim().length === 0)
    ) {
      return this.#complete(
        request,
        "DENY",
        "REASON_REQUIRED",
        obligations,
        capableAssignments,
      );
    }
    if (
      humanAuthorityActions.has(request.action) &&
      request.resource.createdBy === request.session.principalId
    ) {
      return this.#complete(
        request,
        "DENY",
        "SEPARATION_OF_DUTIES_DENIED",
        obligations,
        capableAssignments,
      );
    }

    return this.#complete(request, "ALLOW", "POLICY_ALLOWED", obligations, capableAssignments);
  }

  #complete(
    request: AuthorizationRequest,
    effect: AuthorizationDecision["effect"],
    reasonCode: string,
    obligations: AuthorizationDecision["obligations"],
    assignments: readonly RoleAssignment[],
  ): AuthorizationDecision {
    const expiry = assignments
      .map((item) => item.effectiveUntil)
      .sort()[0];
    const decision = immutableDecision({
      effect,
      reasonCode,
      policyVersion: this.#policyVersion,
      obligations,
      assignmentIds: assignments.map((item) => item.id),
      ...(expiry === undefined ? {} : { expiresAt: expiry }),
    });
    this.#auditSink.append({
      eventType: "AUTHORIZATION_DECISION",
      principal: {
        id: request.session.principalId,
        type: request.session.principalType,
        roles: request.session.roles,
        ...(request.session.teamId === undefined ? {} : { teamId: request.session.teamId }),
        sessionId: request.session.id,
      },
      action: "authorization.evaluate",
      target: {
        type: request.resource.type,
        id: request.resource.id,
        ...(request.resource.version === undefined
          ? {}
          : { version: request.resource.version }),
      },
      purpose: request.purpose,
      policyVersion: this.#policyVersion,
      classification: "RESTRICTED_SECURITY",
      decision: effect,
      outcome: "COMPLETED",
      reason: reasonCode,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
      details: {
        requestedAction: request.action,
        resourceType: request.resource.type,
        obligations,
      },
    });
    return decision;
  }
}
