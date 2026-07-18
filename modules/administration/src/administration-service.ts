import type {
  AuditSink,
  Clock,
  IdFactory,
  PrincipalType,
  RoleCode,
} from "../../../packages/security-contracts/src/index.js";
import type {
  AuthorizationService,
} from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export interface GovernedRoleAssignment {
  readonly id: string;
  readonly subjectPrincipalId: string;
  readonly subjectPrincipalType: PrincipalType;
  readonly role: RoleCode;
  readonly teamIds: readonly string[];
  readonly resourceTypes: readonly string[];
  readonly purposes: readonly string[];
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
  readonly status: "PROPOSED" | "ACTIVE" | "REVOKED";
  readonly version: number;
  readonly proposedBy: string;
  readonly approvedBy?: string;
  readonly revokedBy?: string;
  readonly reason: string;
}

export interface ProposeAssignmentRequest {
  readonly actor: SessionContext;
  readonly subjectPrincipalId: string;
  readonly subjectPrincipalType: PrincipalType;
  readonly role: RoleCode;
  readonly teamIds: readonly string[];
  readonly resourceTypes: readonly string[];
  readonly purposes: readonly string[];
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
  readonly reason: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface AssignmentDecisionRequest {
  readonly actor: SessionContext;
  readonly assignmentId: string;
  readonly expectedVersion: number;
  readonly reason: string;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface AdministrationServiceDependencies {
  readonly authorizationService: AuthorizationService;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly policyVersion: string;
}

function immutableAssignment(
  assignment: GovernedRoleAssignment,
): GovernedRoleAssignment {
  const snapshot = structuredClone(assignment);
  Object.freeze(snapshot.teamIds);
  Object.freeze(snapshot.resourceTypes);
  Object.freeze(snapshot.purposes);
  return Object.freeze(snapshot);
}

export class AdministrationService {
  readonly #authorizationService: AuthorizationService;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #policyVersion: string;
  readonly #assignments = new Map<string, GovernedRoleAssignment>();

  public constructor(dependencies: AdministrationServiceDependencies) {
    this.#authorizationService = dependencies.authorizationService;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#policyVersion = dependencies.policyVersion;
  }

  public proposeAssignment(
    request: ProposeAssignmentRequest,
  ): GovernedRoleAssignment {
    this.#validateProposal(request);
    const assignmentId = this.#idFactory();
    this.#authorize(
      request.actor,
      "admin.role.propose",
      assignmentId,
      request.reason,
      request.correlationId,
      request.requestId,
      request.actor.principalId,
    );

    const assignment = immutableAssignment({
      id: assignmentId,
      subjectPrincipalId: request.subjectPrincipalId,
      subjectPrincipalType: request.subjectPrincipalType,
      role: request.role,
      teamIds: request.teamIds,
      resourceTypes: request.resourceTypes,
      purposes: request.purposes,
      effectiveFrom: request.effectiveFrom,
      effectiveUntil: request.effectiveUntil,
      status: "PROPOSED",
      version: 1,
      proposedBy: request.actor.principalId,
      reason: request.reason,
    });
    this.#assignments.set(assignment.id, assignment);
    this.#recordTransition(
      "ROLE_ASSIGNMENT_PROPOSED",
      "role-assignment.propose",
      assignment,
      request.actor,
      request.reason,
      request.correlationId,
      request.requestId,
    );
    return assignment;
  }

  public approveAssignment(
    request: AssignmentDecisionRequest,
  ): GovernedRoleAssignment {
    const current = this.#requireAssignment(request.assignmentId);
    this.#assertExpectedVersion(current, request.expectedVersion);
    if (current.status !== "PROPOSED") {
      throw new Error("ASSIGNMENT_STATE_INVALID");
    }
    if (current.proposedBy === request.actor.principalId) {
      throw new Error("SEPARATION_OF_DUTIES_DENIED");
    }
    this.#authorize(
      request.actor,
      "admin.role.approve",
      current.id,
      request.reason,
      request.correlationId,
      request.requestId,
      current.proposedBy,
    );

    const active = immutableAssignment({
      ...current,
      status: "ACTIVE",
      version: current.version + 1,
      approvedBy: request.actor.principalId,
      reason: request.reason,
    });
    this.#assignments.set(active.id, active);
    this.#recordTransition(
      "ROLE_ASSIGNMENT_ACTIVATED",
      "role-assignment.activate",
      active,
      request.actor,
      request.reason,
      request.correlationId,
      request.requestId,
    );
    return active;
  }

  public revokeAssignment(
    request: AssignmentDecisionRequest,
  ): GovernedRoleAssignment {
    const current = this.#requireAssignment(request.assignmentId);
    this.#assertExpectedVersion(current, request.expectedVersion);
    if (current.status !== "ACTIVE") {
      throw new Error("ASSIGNMENT_STATE_INVALID");
    }
    this.#authorize(
      request.actor,
      "admin.role.revoke",
      current.id,
      request.reason,
      request.correlationId,
      request.requestId,
      current.proposedBy,
    );

    const revoked = immutableAssignment({
      ...current,
      status: "REVOKED",
      version: current.version + 1,
      revokedBy: request.actor.principalId,
      reason: request.reason,
    });
    this.#assignments.set(revoked.id, revoked);
    this.#recordTransition(
      "ROLE_ASSIGNMENT_REVOKED",
      "role-assignment.revoke",
      revoked,
      request.actor,
      request.reason,
      request.correlationId,
      request.requestId,
    );
    return revoked;
  }

  public readAssignment(assignmentId: string): GovernedRoleAssignment {
    return this.#requireAssignment(assignmentId);
  }

  #validateProposal(request: ProposeAssignmentRequest): void {
    if (request.reason.trim().length === 0) {
      throw new Error("ADMIN_REASON_REQUIRED");
    }
    if (request.subjectPrincipalId === request.actor.principalId) {
      throw new Error("SELF_ASSIGNMENT_PROHIBITED");
    }
    if (
      new Date(request.effectiveFrom).getTime() >=
      new Date(request.effectiveUntil).getTime()
    ) {
      throw new Error("ASSIGNMENT_PERIOD_INVALID");
    }
    if (
      request.teamIds.length === 0 ||
      request.resourceTypes.length === 0 ||
      request.purposes.length === 0
    ) {
      throw new Error("ASSIGNMENT_SCOPE_REQUIRED");
    }
    if (request.subjectPrincipalType === "SERVICE" && request.role !== "SVC") {
      throw new Error("SERVICE_ROLE_PROHIBITED");
    }
    if (request.subjectPrincipalType === "HUMAN" && request.role === "SVC") {
      throw new Error("HUMAN_SERVICE_ROLE_PROHIBITED");
    }
  }

  #authorize(
    actor: SessionContext,
    action: string,
    assignmentId: string,
    reason: string,
    correlationId: string,
    requestId: string | undefined,
    createdBy: string,
  ): void {
    const decision = this.#authorizationService.evaluate({
      session: actor,
      action,
      resource: {
        type: "RoleAssignment",
        id: assignmentId,
        ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
        createdBy,
      },
      purpose: "ACCESS_GOVERNANCE",
      reason,
      ...(requestId === undefined ? {} : { requestId }),
      correlationId,
    });
    if (decision.effect === "DENY") {
      throw new Error(decision.reasonCode);
    }
  }

  #recordTransition(
    eventType: string,
    action: string,
    assignment: GovernedRoleAssignment,
    actor: SessionContext,
    reason: string,
    correlationId: string,
    requestId: string | undefined,
  ): void {
    this.#auditSink.append({
      eventType,
      principal: {
        id: actor.principalId,
        type: actor.principalType,
        roles: actor.roles,
        ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
        sessionId: actor.id,
      },
      action,
      target: {
        type: "RoleAssignment",
        id: assignment.id,
        version: assignment.version,
      },
      purpose: "ACCESS_GOVERNANCE",
      policyVersion: this.#policyVersion,
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "COMPLETED",
      reason,
      ...(requestId === undefined ? {} : { requestId }),
      correlationId,
      details: {
        role: assignment.role,
        status: assignment.status,
        effectiveAt: this.#clock().toISOString(),
      },
    });
  }

  #requireAssignment(assignmentId: string): GovernedRoleAssignment {
    const assignment = this.#assignments.get(assignmentId);
    if (assignment === undefined) {
      throw new Error("ROLE_ASSIGNMENT_NOT_FOUND");
    }
    return assignment;
  }

  #assertExpectedVersion(
    assignment: GovernedRoleAssignment,
    expectedVersion: number,
  ): void {
    if (assignment.version !== expectedVersion) {
      throw new Error("VERSION_CONFLICT");
    }
  }
}
