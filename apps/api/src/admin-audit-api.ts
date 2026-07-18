import type {
  AdministrationService,
  ProposeAssignmentRequest,
} from "../../../modules/administration/src/administration-service.js";
import type { AuditLog } from "../../../modules/audit/src/audit-log.js";
import type { AuthorizationService } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import {
  executeBoundary,
  requireSessionId,
  type ApiResponse,
  type RequestContext,
} from "./contracts.js";

interface AdminAuditApiDependencies {
  readonly administrationService: AdministrationService;
  readonly authorizationService: AuthorizationService;
  readonly auditLog: AuditLog;
  readonly sessionReader: (sessionId: string) => SessionContext;
}

type ProposeAssignmentInput = Omit<ProposeAssignmentRequest, "actor" | "requestId" | "correlationId"> & {
  readonly context: RequestContext;
};

interface AssignmentDecisionInput {
  readonly context: RequestContext;
  readonly assignmentId: string;
  readonly expectedVersion: number;
  readonly reason: string;
}

interface QueryAuditInput {
  readonly context: RequestContext;
  readonly purpose: string;
  readonly eventType?: string;
  readonly targetId?: string;
  readonly correlationId?: string;
}

export class AdminAuditApi {
  public constructor(private readonly dependencies: AdminAuditApiDependencies) {}

  public proposeAssignment(
    input: ProposeAssignmentInput,
  ): ApiResponse<ReturnType<AdministrationService["proposeAssignment"]>> {
    return executeBoundary(input.context, () => {
      const actor = this.#readActor(input.context);
      return this.dependencies.administrationService.proposeAssignment({
        actor,
        subjectPrincipalId: input.subjectPrincipalId,
        subjectPrincipalType: input.subjectPrincipalType,
        role: input.role,
        teamIds: input.teamIds,
        resourceTypes: input.resourceTypes,
        purposes: input.purposes,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
        reason: input.reason,
        ...(input.context.requestId === undefined
          ? {}
          : { requestId: input.context.requestId }),
        correlationId: input.context.correlationId,
      });
    });
  }

  public approveAssignment(
    input: AssignmentDecisionInput,
  ): ApiResponse<ReturnType<AdministrationService["approveAssignment"]>> {
    return executeBoundary(input.context, () =>
      this.dependencies.administrationService.approveAssignment({
        actor: this.#readActor(input.context),
        assignmentId: input.assignmentId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        ...(input.context.requestId === undefined
          ? {}
          : { requestId: input.context.requestId }),
        correlationId: input.context.correlationId,
      }),
    );
  }

  public revokeAssignment(
    input: AssignmentDecisionInput,
  ): ApiResponse<ReturnType<AdministrationService["revokeAssignment"]>> {
    return executeBoundary(input.context, () =>
      this.dependencies.administrationService.revokeAssignment({
        actor: this.#readActor(input.context),
        assignmentId: input.assignmentId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        ...(input.context.requestId === undefined
          ? {}
          : { requestId: input.context.requestId }),
        correlationId: input.context.correlationId,
      }),
    );
  }

  public queryAudit(
    input: QueryAuditInput,
  ): ApiResponse<ReturnType<AuditLog["query"]>> {
    return executeBoundary(input.context, () => {
      const actor = this.#readActor(input.context);
      const decision = this.dependencies.authorizationService.evaluate({
        session: actor,
        action: "audit.query",
        resource: { type: "AuditEvent", id: "collection" },
        purpose: input.purpose,
        ...(input.context.requestId === undefined
          ? {}
          : { requestId: input.context.requestId }),
        correlationId: input.context.correlationId,
      });
      if (decision.effect === "DENY") {
        throw new Error(decision.reasonCode);
      }
      return this.dependencies.auditLog.query({
        requesterId: actor.principalId,
        purpose: input.purpose,
        ...(input.eventType === undefined ? {} : { eventType: input.eventType }),
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
        ...(input.correlationId === undefined
          ? {}
          : { correlationId: input.correlationId }),
      });
    });
  }

  #readActor(context: RequestContext): SessionContext {
    return this.dependencies.sessionReader(requireSessionId(context));
  }
}
