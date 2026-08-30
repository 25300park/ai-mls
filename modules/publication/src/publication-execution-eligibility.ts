import type {
  PublicationAuthorizedExecution,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";
import type { PublicationIdentity } from "./publication-contracts.js";
import type {
  PublicationEffectiveApprovalDecision,
  PublicationEffectiveApprovalPort,
} from "./publication-service.js";

export interface PublicationExecutionEligibilityInput {
  readonly identity: PublicationIdentity;
  readonly context: PublicationExecutionContext;
  readonly authorization: PublicationAuthorizedExecution;
}

export type PublicationExecutionEligibilityDecision = Readonly<{
  readonly status: "ELIGIBLE";
  readonly actorId: string;
  readonly currentAggregateVersion: number;
  readonly approvalDecisionReference: string;
  readonly checkedAt: string;
}> | Readonly<{
  readonly status: "BLOCKED";
  readonly reasonCode: "APPROVAL_NOT_EFFECTIVE";
}>;

export interface PublicationExecutionEligibilityPort {
  evaluate(input: PublicationExecutionEligibilityInput): PublicationExecutionEligibilityDecision;
}

export class PublicationExecutionEligibilityGate implements PublicationExecutionEligibilityPort {
  public constructor(private readonly dependencies: Readonly<{
    readonly effectiveApproval: PublicationEffectiveApprovalPort;
  }>) {}

  public evaluate(input: PublicationExecutionEligibilityInput): PublicationExecutionEligibilityDecision {
    let decision: PublicationEffectiveApprovalDecision;
    try {
      decision = this.dependencies.effectiveApproval.check({
        ...input.authorization.binding,
        actorId: input.authorization.actorId,
        sessionId: input.context.sessionId ?? "",
        correlationId: input.context.correlationId,
        tenantScopeId: input.identity.tenantScopeId,
        purpose: "PUBLICATION_EXECUTION",
        consumerDuty: "EXECUTION",
      });
    } catch {
      return blocked();
    }

    const binding = input.authorization.binding;
    if (decision.effective !== true
      || decision.decisionReference.trim().length === 0
      || decision.checkedAt.trim().length === 0
      || decision.reasonCodes.length === 0
      || decision.approvalId !== binding.approvalId
      || decision.approvalVersion !== binding.approvalVersion
      || decision.effectiveScope.targetId !== binding.targetId
      || decision.effectiveScope.channelId !== binding.channelId) {
      return blocked();
    }

    return Object.freeze({
      status: "ELIGIBLE" as const,
      actorId: input.authorization.actorId,
      currentAggregateVersion: input.authorization.currentAggregateVersion,
      approvalDecisionReference: decision.decisionReference,
      checkedAt: decision.checkedAt,
    });
  }
}

function blocked(): Extract<PublicationExecutionEligibilityDecision, { readonly status: "BLOCKED" }> {
  return Object.freeze({ status: "BLOCKED" as const, reasonCode: "APPROVAL_NOT_EFFECTIVE" as const });
}
