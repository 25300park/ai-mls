import type {
  AuditSink,
  Clock,
  DataClassification,
  RoleCode,
} from "../../../packages/security-contracts/src/index.js";
import { hasVerifiedMfaAssurance, type SessionContext } from "../../identity/src/session-service.js";

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
  readonly version?: number;
  readonly tenantId?: string;
  readonly subjectPrincipalType?: SessionContext["principalType"];
}

export interface LiveRoleAssignment extends RoleAssignment {
  readonly version: number;
  readonly tenantId: string;
  readonly subjectPrincipalType: SessionContext["principalType"];
}

export interface LiveAssignmentResolutionContext {
  readonly subjectPrincipalId: string;
  readonly subjectPrincipalType: SessionContext["principalType"];
  readonly tenantId: string;
  readonly resourceType: string;
  readonly teamId?: string;
  readonly purpose: string;
}

export interface LiveAssignmentResolver {
  resolveCurrentAssignments(context: LiveAssignmentResolutionContext): readonly LiveRoleAssignment[];
}

export interface AuthorizationResource {
  readonly type: string;
  readonly id: string;
  readonly tenantId?: string;
  readonly version?: number;
  readonly teamId?: string;
  readonly createdBy?: string;
  readonly classification?: DataClassification;
  readonly privacyScope?: string;
  readonly purpose?: string;
  readonly consentOrLegalBasis?: string;
  readonly audienceRestriction?: string;
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

interface AuthorizationServiceBaseDependencies {
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly policyVersion: string;
}

type AuthorizationServiceDependencies = AuthorizationServiceBaseDependencies & (
  | {
      readonly liveAssignmentResolver: LiveAssignmentResolver;
      readonly assignments?: never;
      readonly authoritySource?: never;
    }
  | {
      readonly assignments: readonly RoleAssignment[];
      readonly authoritySource: "STATIC_TEST_COMPATIBILITY";
      readonly liveAssignmentResolver?: never;
    }
);

interface AssignmentResolver {
  resolveCurrentAssignments(context: LiveAssignmentResolutionContext): readonly RoleAssignment[];
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
  AGT: [
    "resource.view", "resource.create", "resource.edit",
    "property.read", "property.propose",
    "candidate.read", "candidate.create", "candidate.revise",
    "offer.create", "offer.revise", "duplicate.suggest",
    "contact.create", "contact.read", "contact.edit", "contact.reveal",
    "contact.attempt", "contact.dnc",
    "client.create", "client.read", "client.edit",
    "requirement.create", "requirement.read", "requirement.revise",
    "requirement.activate", "requirement.transition", "requirement.request-ai",
    "matching.request", "matching.read", "matching.review", "matching.stale",
    "proposal.create", "proposal.read", "proposal.submit", "proposal.share", "proposal.feedback",
    "publication.representation.create", "publication.approval.request", "publication.approval.read",
    "verification.request", "verification.read",
    "permission.read",
  ],
  SAG: [
    "resource.view",
    "resource.create",
    "resource.edit",
    "proposal.approve",
    "proposal.create",
    "proposal.read",
    "proposal.submit",
    "proposal.review",
    "proposal.share",
    "proposal.feedback",
    "publication.representation.create",
    "publication.approval.request",
    "publication.approval.read",
    "source.read",
    "intake.create",
    "intake.read",
    "intake.validate",
    "intake.request-ai",
    "intake.review",
    "job.submit",
    "job.read",
    "contact.create",
    "contact.read",
    "contact.edit",
    "contact.reveal",
    "contact.attempt",
    "contact.dnc",
    "client.create",
    "client.read",
    "client.edit",
    "requirement.create",
    "requirement.read",
    "requirement.revise",
    "requirement.activate",
    "requirement.transition",
    "requirement.request-ai",
    "matching.request",
    "matching.read",
    "matching.review",
    "matching.stale",
    "permission.read",
  ],
  REV: ["resource.view", "matching.read", "matching.review", "verification.read", "verification.review", "permission.read", "permission.support", "proposal.read"],
  AIR: ["resource.view", "ai.result.read", "ai.review", "intake.read", "requirement.read", "matching.read"],
  DUR: ["resource.view", "candidate.read", "duplicate.read", "duplicate.dispose"],
  VER: ["resource.view", "verification.request", "verification.read", "verification.perform", "permission.read", "contact.read", "contact.reveal", "contact.attempt"],
  PMR: ["resource.view", "permission.approve", "permission.request", "permission.read", "permission.review", "permission.decide", "permission.revoke", "contact.read", "proposal.read", "publication.approval.read"],
  PUA: ["resource.view", "publication.approve", "permission.read", "proposal.read", "publication.approval.read", "publication.approval.claim", "publication.approval.assign", "publication.approval.decide", "publication.approval.revoke"],
  MGR: ["resource.view", "audit.query", "client.read", "matching.read", "permission.read", "permission.override", "verification.request", "verification.read", "verification.assign", "verification.perform", "verification.override", "proposal.read", "publication.approval.read"],
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
    "property.read",
    "property.propose",
    "property.decide",
    "candidate.read",
    "candidate.create",
    "candidate.revise",
    "offer.create",
    "offer.revise",
    "duplicate.suggest",
  ],
  OPS: [
    "resource.view",
    "publication.deliver",
    "publication.approval.check-effective",
    "publication.create",
    "publication.execution.begin",
    "publication.execution.resolve",
    "publication.withdraw.request",
    "publication.withdraw.resolve",
    "publication.active-operation.begin",
    "publication.republish.begin",
    "publication.reconciliation.resolve",
    "publication.supersede",
    "publication.terminate",
    "publication.suspension.set",
    "resource.export",
    "job.submit",
    "job.read",
    "job.execute",
    "job.cancel",
    "job.retry",
  ],
  SEC: ["audit.query", "audit.export", "security.admin", "resource.view", "source.read", "permission.read", "contact.read", "contact.reveal", "client.read", "proposal.read", "publication.approval.read"],
  ADM: [
    "admin.role.propose",
    "admin.role.approve",
    "admin.role.revoke",
    "audit.query",
    "audit.export",
    "resource.view",
    "permission.read",
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
    "requirement.read",
    "permission.expire",
    "verification.expire",
    "publication.approval.expire",
    "publication.approval.check-effective",
  ],
  EXT: [],
};

const privilegedActions = new Set([
  "admin.role.propose",
  "admin.role.approve",
  "admin.role.revoke",
  "audit.export",
  "publication.approve",
  "publication.approval.decide",
  "publication.approval.revoke",
  "permission.decide",
  "permission.revoke",
  "permission.override",
  "contact.reveal",
  "restricted.reveal",
  "security.admin",
  "verification.assign",
  "verification.perform",
  "verification.override",
  "publication.create",
  "publication.execution.begin",
  "publication.execution.resolve",
  "publication.withdraw.request",
  "publication.withdraw.resolve",
  "publication.active-operation.begin",
  "publication.republish.begin",
  "publication.reconciliation.resolve",
  "publication.supersede",
  "publication.terminate",
  "publication.suspension.set",
]);

const humanAuthorityActions = new Set([
  "admin.role.approve",
  "admin.role.revoke",
  "ai.review",
  "duplicate.dispose",
  "intake.review",
  "matching.review",
  "permission.approve",
  "permission.decide",
  "permission.revoke",
  "permission.override",
  "proposal.approve",
  "proposal.review",
  "proposal.share",
  "publication.approve",
  "publication.approval.decide",
  "publication.approval.revoke",
  "property.decide",
  "requirement.activate",
  "requirement.transition",
  "verification.perform",
  "verification.override",
  "publication.create",
  "publication.execution.begin",
  "publication.execution.resolve",
  "publication.withdraw.request",
  "publication.withdraw.resolve",
  "publication.active-operation.begin",
  "publication.republish.begin",
  "publication.reconciliation.resolve",
  "publication.supersede",
  "publication.terminate",
  "publication.suspension.set",
]);

const humanRequiredActions = new Set([
  ...humanAuthorityActions,
  "admin.role.propose",
]);

const publicationApprovalAuthorityActions = new Set([
  "publication.approve",
  "publication.approval.claim",
  "publication.approval.assign",
  "publication.approval.decide",
  "publication.approval.revoke",
]);

const publicationExecutionAuthorityActions = new Set([
  "publication.deliver",
  "publication.create",
  "publication.execution.begin",
  "publication.execution.resolve",
  "publication.withdraw.request",
  "publication.withdraw.resolve",
  "publication.active-operation.begin",
  "publication.republish.begin",
  "publication.reconciliation.resolve",
  "publication.supersede",
  "publication.terminate",
  "publication.suspension.set",
]);

function immutableDecision(decision: AuthorizationDecision): AuthorizationDecision {
  const snapshot = structuredClone(decision);
  Object.freeze(snapshot.obligations);
  Object.freeze(snapshot.assignmentIds);
  return Object.freeze(snapshot);
}

export class AuthorizationService {
  readonly #assignmentResolver: AssignmentResolver;
  readonly #usesLiveAuthority: boolean;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #policyVersion: string;

  public constructor(dependencies: AuthorizationServiceDependencies) {
    this.#usesLiveAuthority = "liveAssignmentResolver" in dependencies;
    if ("liveAssignmentResolver" in dependencies) {
      this.#assignmentResolver = dependencies.liveAssignmentResolver;
    } else {
      const compatibilityAssignments = dependencies.assignments.map((item) =>
        Object.freeze(structuredClone(item)),
      );
      this.#assignmentResolver = {
        resolveCurrentAssignments: (): readonly RoleAssignment[] => compatibilityAssignments,
      };
    }
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
      humanRequiredActions.has(request.action)
    ) {
      return this.#complete(request, "DENY", "HUMAN_AUTHORITY_REQUIRED", obligations, []);
    }

    let resolvedAssignments: readonly RoleAssignment[];
    try {
      const tenantId = request.resource.tenantId;
      if (this.#usesLiveAuthority && (tenantId === undefined || tenantId.trim().length === 0)) {
        throw new Error("trusted tenant context is required");
      }
      resolvedAssignments = this.#assignmentResolver.resolveCurrentAssignments({
        subjectPrincipalId: request.session.principalId,
        subjectPrincipalType: request.session.principalType,
        tenantId: tenantId ?? "STATIC_TEST_COMPATIBILITY",
        resourceType: request.resource.type,
        ...(request.resource.teamId === undefined ? {} : { teamId: request.resource.teamId }),
        purpose: request.purpose,
      });
      assertResolvedAssignments(resolvedAssignments, this.#usesLiveAuthority);
      if (this.#usesLiveAuthority && resolvedAssignments.some((assignment) =>
        assignment.tenantId !== tenantId
        || assignment.subjectPrincipalType !== request.session.principalType
        || assignment.principalId !== request.session.principalId)) {
        throw new Error("resolved assignment scope is inconsistent");
      }
    } catch {
      return this.#complete(request, "DENY", "AUTHORITY_RESOLUTION_FAILED", obligations, []);
    }

    const activeAssignments = resolvedAssignments.filter(
      (item) =>
        item.principalId === request.session.principalId &&
        item.status === "ACTIVE" &&
        (!this.#usesLiveAuthority || item.principalId === request.session.principalId) &&
        (this.#usesLiveAuthority || request.session.roles.includes(item.role)) &&
        now.getTime() >= new Date(item.effectiveFrom).getTime() &&
        now.getTime() < new Date(item.effectiveUntil).getTime(),
    );
    if (activeAssignments.length === 0) {
      return this.#complete(request, "DENY", "NO_ACTIVE_ASSIGNMENT", obligations, []);
    }

    const restrictionScope = projectionRestrictionScope(request);
    if (restrictionScope === undefined) {
      return this.#complete(request, "DENY", "SCOPE_DENIED", obligations, activeAssignments);
    }
    const scopedAssignments = activeAssignments.filter(
      (item) =>
        item.resourceTypes.includes(restrictionScope.resourceType) &&
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

    if (this.#usesLiveAuthority && hasPublicationRoleStackingConflict(scopedAssignments, request.action)) {
      return this.#complete(
        request,
        "DENY",
        "SEPARATION_OF_DUTIES_DENIED",
        obligations,
        scopedAssignments,
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

    if (privilegedActions.has(request.action) && !hasVerifiedMfaAssurance(request.session)) {
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

function hasPublicationRoleStackingConflict(assignments: readonly RoleAssignment[], action: string): boolean {
  const roles = new Set(assignments.map(({ role }) => role));
  if (!roles.has("PUA")) return false;
  if (publicationExecutionAuthorityActions.has(action)) return roles.has("OPS");
  if (publicationApprovalAuthorityActions.has(action)) {
    return (["OPS", "VER", "PMR"] as const).some((role) => roles.has(role));
  }
  return false;
}

export function isCanonicalRoleCode(value: string): value is RoleCode {
  return Object.hasOwn(capabilities, value);
}

function assertResolvedAssignments(assignments: readonly RoleAssignment[], requiresVersion: boolean): void {
  if (!Array.isArray(assignments)) throw new Error("invalid assignment result");
  for (const assignment of assignments as readonly RoleAssignment[]) {
    const effectiveFrom = Date.parse(assignment.effectiveFrom);
    const effectiveUntil = Date.parse(assignment.effectiveUntil);
    if (
      assignment.id.trim().length === 0 || assignment.principalId.trim().length === 0
      || (requiresVersion && (!Number.isSafeInteger(assignment.version) || (assignment.version ?? 0) < 1))
      || (requiresVersion && (assignment.tenantId?.trim().length ?? 0) === 0)
      || (requiresVersion && !["HUMAN", "SERVICE", "AI", "CONNECTOR"].includes(assignment.subjectPrincipalType ?? ""))
      || !isCanonicalRoleCode(assignment.role)
      || !["ACTIVE", "REVOKED", "EXPIRED"].includes(assignment.status)
      || !Number.isFinite(effectiveFrom) || !Number.isFinite(effectiveUntil) || effectiveFrom >= effectiveUntil
      || !Array.isArray(assignment.teamIds) || !Array.isArray(assignment.resourceTypes) || !Array.isArray(assignment.purposes)
      || assignment.resourceTypes.some((item: string) => item.trim().length === 0)
      || assignment.purposes.some((item: string) => item.trim().length === 0)
    ) throw new Error("invalid assignment result");
  }
}

function projectionRestrictionScope(
  request: AuthorizationRequest,
): Readonly<{ resourceType: string }> | undefined {
  const resource = request.resource;
  const restrictionValues = [
    resource.classification,
    resource.privacyScope,
    resource.purpose,
    resource.consentOrLegalBasis,
    resource.audienceRestriction,
  ];
  if (restrictionValues.every((value) => value === undefined)) {
    return Object.freeze({ resourceType: resource.type });
  }
  if (
    resource.classification === undefined
    || !nonBlank(resource.privacyScope)
    || !nonBlank(resource.purpose)
    || resource.purpose !== request.purpose
    || !nonBlank(resource.consentOrLegalBasis)
    || !nonBlank(resource.audienceRestriction)
  ) {
    return undefined;
  }
  return Object.freeze({ resourceType: projectionRestrictionResourceType(resource) });
}

/**
 * Produces the exact assignment scope for a restricted Projection read.
 * Every inherited restriction participates in the identity so that a broad
 * classification grant cannot silently authorize a different privacy,
 * purpose, legal-basis, or audience boundary.
 */
export function projectionRestrictionResourceType(
  resource: Pick<AuthorizationResource, "type" | "classification" | "privacyScope" | "purpose" | "consentOrLegalBasis" | "audienceRestriction">,
): string {
  if (
    resource.classification === undefined
    || !nonBlank(resource.privacyScope)
    || !nonBlank(resource.purpose)
    || !nonBlank(resource.consentOrLegalBasis)
    || !nonBlank(resource.audienceRestriction)
  ) {
    throw new TypeError("A complete Projection restriction scope is required.");
  }
  const dimensions = [
    resource.classification,
    resource.privacyScope,
    resource.purpose,
    resource.consentOrLegalBasis,
    resource.audienceRestriction,
  ].map((value) => encodeURIComponent(value));
  return `${resource.type}:RESTRICTION:${dimensions.join(":")}`;
}

function nonBlank(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}
