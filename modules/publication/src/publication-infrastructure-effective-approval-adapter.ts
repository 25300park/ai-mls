import type { SessionContext } from "../../identity/src/session-service.js";
import type { PermissionAudience } from "../../permission/src/permission-service.js";
import type { EffectiveApprovalDecision, PublicationApprovalService } from "../../publication-approval/src/publication-approval-service.js";
import type { VerificationField, VersionedEntityReference } from "../../verification/src/verification-service.js";
import type { PublicationBinding } from "./publication-contracts.js";
import type {
  PublicationEffectiveApprovalCheckInput,
  PublicationEffectiveApprovalDecision,
  PublicationEffectiveApprovalPort,
} from "./publication-service.js";

export interface Api013ApprovalExecutionContext {
  readonly subjectRef: VersionedEntityReference;
  readonly fieldScope: readonly VerificationField[];
  readonly mediaScope: readonly string[];
  readonly audience: PermissionAudience;
  readonly language: string;
  readonly verificationId: string;
  readonly verificationVersion: number;
  readonly permissionId: string;
  readonly permissionVersion: number;
  readonly targetPolicyVersion: string;
}

export interface Api013ApprovalExecutionContextResolver {
  resolve(binding: PublicationBinding, tenantScopeId: string): Api013ApprovalExecutionContext | undefined;
}

export interface Api013SessionResolver {
  resolve(sessionId: string): SessionContext | undefined;
}

export interface Api013EffectiveApprovalService {
  checkEffectiveApproval(request: Parameters<PublicationApprovalService["checkEffectiveApproval"]>[0]): EffectiveApprovalDecision;
}

export class Api013EffectiveApprovalAdapter implements PublicationEffectiveApprovalPort {
  public constructor(
    private readonly approvalService: Api013EffectiveApprovalService,
    private readonly sessionResolver: Api013SessionResolver,
    private readonly contextResolver: Api013ApprovalExecutionContextResolver,
  ) {}

  public check(input: PublicationEffectiveApprovalCheckInput): PublicationEffectiveApprovalDecision {
    const actor = this.sessionResolver.resolve(input.sessionId);
    const execution = this.contextResolver.resolve(input, input.tenantScopeId);
    if (actor?.principalId !== input.actorId || actor.teamId !== input.tenantScopeId || execution === undefined) {
      return Object.freeze({ effective: false, reasonCodes: Object.freeze(["APPROVAL_NOT_EFFECTIVE"]) });
    }
    try {
      const decision = this.approvalService.checkEffectiveApproval({
        actor,
        purpose: "PURPOSE_PUBLICATION_APPROVAL",
        correlationId: input.correlationId,
        approvalId: input.approvalId,
        approvalVersion: input.approvalVersion,
        representationId: input.representationId,
        representationVersion: input.representationVersion,
        representationChecksum: input.representationChecksum,
        subjectRef: execution.subjectRef,
        targetId: input.targetId,
        channelId: input.channelId,
        fieldScope: execution.fieldScope,
        mediaScope: execution.mediaScope,
        audience: execution.audience,
        language: execution.language,
        verificationId: execution.verificationId,
        verificationVersion: execution.verificationVersion,
        permissionId: execution.permissionId,
        permissionVersion: execution.permissionVersion,
        targetPolicyVersion: execution.targetPolicyVersion,
        channelPolicyVersion: input.channelPolicyVersion,
        consumerDuty: input.consumerDuty,
      });
      if (!decision.effective) return Object.freeze({ effective: false, reasonCodes: Object.freeze([...decision.reasonCodes]) });
      return Object.freeze({
        effective: true,
        decisionReference: `API-013:${decision.approvalId}@${String(decision.approvalVersion)}`,
        approvalId: decision.approvalId,
        approvalVersion: decision.approvalVersion,
        checkedAt: decision.checkedAt,
        effectiveScope: Object.freeze({ targetId: decision.effectiveScope.targetId, channelId: decision.effectiveScope.channelId }),
        reasonCodes: Object.freeze([...decision.reasonCodes]),
      });
    } catch {
      return Object.freeze({ effective: false, reasonCodes: Object.freeze(["APPROVAL_NOT_EFFECTIVE"]) });
    }
  }
}
