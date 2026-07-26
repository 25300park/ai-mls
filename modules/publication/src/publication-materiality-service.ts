import { immutableDomain, type CorrectionMateriality, type PublicationBinding } from "./publication-contracts.js";
import { domainError } from "./publication-domain-error.js";

export interface CorrectionMaterialityAssessment {
  readonly disposition: "IN_PLACE_CORRECTION_ALLOWED" | "SUCCESSOR_REQUIRED";
  readonly reasonCodes: readonly string[];
}

export function assessCorrectionMateriality(current: PublicationBinding, proposed: PublicationBinding, decision: CorrectionMateriality): CorrectionMaterialityAssessment {
  const reasons: string[] = [];
  if (current.subjectId !== proposed.subjectId || current.subjectRevision !== proposed.subjectRevision) reasons.push("SUBJECT_CHANGED");
  if (current.targetId !== proposed.targetId || current.targetVersion !== proposed.targetVersion) reasons.push("TARGET_CHANGED");
  if (current.channelId !== proposed.channelId || current.channelPolicyVersion !== proposed.channelPolicyVersion) reasons.push("CHANNEL_CHANGED");
  if (decision === "MATERIAL") reasons.push("MATERIAL_CHANGE");
  if (reasons.length > 0) return immutableDomain({ disposition: "SUCCESSOR_REQUIRED" as const, reasonCodes: reasons });

  const representationChanged = current.representationId !== proposed.representationId || current.representationVersion !== proposed.representationVersion || current.representationChecksum !== proposed.representationChecksum;
  const approvalChanged = current.approvalId !== proposed.approvalId || current.approvalVersion !== proposed.approvalVersion;
  if (!representationChanged || !approvalChanged) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Non-material correction requires a new exact representation and approval binding.");
  return immutableDomain({ disposition: "IN_PLACE_CORRECTION_ALLOWED" as const, reasonCodes: ["NON_MATERIAL_REPRESENTATION_CHANGE"] });
}

export function assertSameIntentRepublish(current: PublicationBinding, proposed: PublicationBinding): void {
  const stable = current.subjectId === proposed.subjectId && current.subjectRevision === proposed.subjectRevision && current.representationId === proposed.representationId && current.representationVersion === proposed.representationVersion && current.representationChecksum === proposed.representationChecksum && current.targetId === proposed.targetId && current.targetVersion === proposed.targetVersion && current.channelId === proposed.channelId && current.channelPolicyVersion === proposed.channelPolicyVersion;
  const newApproval = current.approvalId !== proposed.approvalId || current.approvalVersion !== proposed.approvalVersion;
  if (!stable || !newApproval) throw domainError("PUBLICATION_INVARIANT_VIOLATION", "INVARIANT", "Republish requires the same intent and a new exact approval binding.");
}
