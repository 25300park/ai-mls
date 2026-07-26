import type {
  ActiveOperationMateriality,
  DeliveryOperation,
  DomainCommandContext,
  PublicationBinding,
  PublicationCreationPrerequisites,
  PublicationIdentity,
  PublicationSuspensionStatus,
  ReconciliationResolution,
} from "./publication-contracts.js";
import type { DataClassification } from "../../../packages/security-contracts/src/index.js";

export interface AttemptInput {
  readonly id: string;
  readonly commandId: string;
  readonly operation: DeliveryOperation;
  readonly occurredAt: string;
  readonly evidenceRefs: readonly string[];
}

interface VersionedCommand {
  readonly expectedAggregateVersion: number;
  readonly command: DomainCommandContext;
}

export interface CreatePublicationCommand {
  readonly identity: PublicationIdentity;
  readonly binding: PublicationBinding;
  readonly prerequisites: PublicationCreationPrerequisites;
  readonly classification: DataClassification;
  readonly command: DomainCommandContext;
  readonly predecessorPublicationId?: string;
}

export interface BeginInitialExecutionCommand extends VersionedCommand { readonly type: "BEGIN_INITIAL_EXECUTION"; readonly attempt: AttemptInput }
export interface ResolveExecutionCommand extends VersionedCommand { readonly type: "RESOLVE_EXECUTION"; readonly outcome: "EFFECT_CONFIRMED" | "NO_EFFECT_CONFIRMED" | "UNKNOWN"; readonly evidenceRefs: readonly string[]; readonly externalObjectReference?: string; readonly reconciliationCaseId?: string }
export interface RequestWithdrawalCommand extends VersionedCommand { readonly type: "REQUEST_WITHDRAWAL"; readonly attempt: AttemptInput }
export interface ResolveWithdrawalCommand extends VersionedCommand { readonly type: "RESOLVE_WITHDRAWAL"; readonly outcome: "CONFIRMED" | "UNKNOWN"; readonly evidenceRefs: readonly string[]; readonly reconciliationCaseId?: string }
export interface BeginActiveOperationCommand extends VersionedCommand { readonly type: "BEGIN_ACTIVE_OPERATION"; readonly operation: "CORRECTION" | "REPUBLISH"; readonly materiality: ActiveOperationMateriality; readonly nextBinding: PublicationBinding; readonly attempt: AttemptInput }
export interface BeginWithdrawnRepublishCommand extends VersionedCommand { readonly type: "BEGIN_WITHDRAWN_REPUBLISH"; readonly nextBinding: PublicationBinding; readonly attempt: AttemptInput }
export interface ResolveReconciliationCommand extends VersionedCommand { readonly type: "RESOLVE_RECONCILIATION"; readonly caseId: string; readonly resolution: ReconciliationResolution; readonly evidenceRefs: readonly string[]; readonly externalObjectReference?: string }
export interface SupersedePublicationCommand extends VersionedCommand { readonly type: "SUPERSEDE"; readonly successorPublicationId: string; readonly evidenceRefs: readonly string[] }
export interface TerminatePublicationCommand extends VersionedCommand { readonly type: "TERMINATE" }
export interface SetSuspensionCommand extends VersionedCommand { readonly type: "SET_SUSPENSION"; readonly suspensionStatus: PublicationSuspensionStatus }
