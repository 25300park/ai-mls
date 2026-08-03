import type {
  DomainCommandContext,
  PublicationBinding,
  PublicationIdentity,
  PublicationLifecycleState,
  ReconciliationResolution,
} from "./publication-contracts.js";
import type {
  BeginActiveOperationCommand,
  BeginInitialExecutionCommand,
  BeginWithdrawnRepublishCommand,
  AttemptInput,
  CreatePublicationCommand,
  RequestWithdrawalCommand,
  ResolveExecutionCommand,
  ResolveReconciliationCommand,
  ResolveWithdrawalCommand,
  SetSuspensionCommand,
  SupersedePublicationCommand,
  TerminatePublicationCommand,
} from "./publication-commands.js";

export interface PublicationExecutionContext {
  readonly actorId: string;
  /** Compatibility-only caller claim. Publication authorization never treats it as authoritative. */
  readonly sessionId?: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly intentFingerprint: string;
}

export type PublicationModificationCommand =
  | BeginInitialExecutionCommand
  | ResolveExecutionCommand
  | RequestWithdrawalCommand
  | ResolveWithdrawalCommand
  | BeginActiveOperationCommand
  | BeginWithdrawnRepublishCommand
  | ResolveReconciliationCommand
  | SupersedePublicationCommand
  | TerminatePublicationCommand
  | SetSuspensionCommand;

export interface CreatePublicationApplicationCommand {
  readonly kind: "CREATE_PUBLICATION";
  readonly input: CreatePublicationCommand;
}

export interface CreatePublicationCoordinationRequest {
  readonly context: PublicationExecutionContext;
  readonly command: {
    readonly kind: "CREATE_PUBLICATION";
    readonly input: Omit<CreatePublicationApplicationCommand["input"], "prerequisites"> & {
      readonly prerequisites: Omit<CreatePublicationApplicationCommand["input"]["prerequisites"], "effectiveApproval">;
    };
  };
}

export interface PublishPublicationCoordinationRequest {
  readonly context: PublicationExecutionContext;
  readonly identity: PublicationIdentity;
  readonly command: CreatePublicationApplicationCommand["input"]["command"];
  readonly attempt: AttemptInput;
  readonly expectedAggregateVersion: number;
}

export interface PublicationCoordinationSuccessResult {
  readonly ok: true;
  readonly publicationId: string;
  readonly aggregateVersion: number;
  readonly lifecycleState: PublicationLifecycleState;
  readonly connectorOutcome: "CONFIRMED";
  readonly replayed: boolean;
}

export type PublicationCoordinationResult = PublicationCoordinationSuccessResult | PublicationApplicationErrorResult;

export interface PublicationCoordinationPort {
  create(request: CreatePublicationCoordinationRequest): PublicationApplicationResult;
  publish(request: PublishPublicationCoordinationRequest): PublicationCoordinationResult;
}

export interface PublicationLifecycleRequest<Input extends PublicationModificationCommand> {
  readonly context: PublicationExecutionContext;
  readonly identity: PublicationIdentity;
  readonly input: Input;
}

export type CorrectPublicationRequest = PublicationLifecycleRequest<BeginActiveOperationCommand & { readonly operation: "CORRECTION" }>;
export type RepublishPublicationRequest = PublicationLifecycleRequest<
  | (BeginActiveOperationCommand & { readonly operation: "REPUBLISH" })
  | BeginWithdrawnRepublishCommand
>;
export type RequestWithdrawalLifecycleRequest = PublicationLifecycleRequest<RequestWithdrawalCommand>;
export type ResolveWithdrawalLifecycleRequest = PublicationLifecycleRequest<ResolveWithdrawalCommand>;
export type SuspendPublicationRequest = PublicationLifecycleRequest<SetSuspensionCommand & { readonly suspensionStatus: Exclude<SetSuspensionCommand["suspensionStatus"], "NOT_SUSPENDED"> }>;
export type ResumePublicationRequest = PublicationLifecycleRequest<SetSuspensionCommand & { readonly suspensionStatus: "NOT_SUSPENDED" }>;
export type SupersedePublicationRequest = PublicationLifecycleRequest<SupersedePublicationCommand>;
export type TerminatePublicationRequest = PublicationLifecycleRequest<TerminatePublicationCommand>;

export type PublicationLifecycleCoordinationRequest =
  | ({ readonly action: "CORRECT" } & CorrectPublicationRequest)
  | ({ readonly action: "REPUBLISH" } & RepublishPublicationRequest)
  | ({ readonly action: "REQUEST_WITHDRAWAL" } & RequestWithdrawalLifecycleRequest)
  | ({ readonly action: "RESOLVE_WITHDRAWAL" } & ResolveWithdrawalLifecycleRequest)
  | ({ readonly action: "SUSPEND" } & SuspendPublicationRequest)
  | ({ readonly action: "RESUME" } & ResumePublicationRequest)
  | ({ readonly action: "SUPERSEDE" } & SupersedePublicationRequest)
  | ({ readonly action: "TERMINATE" } & TerminatePublicationRequest);

export interface PublicationLifecyclePort {
  correctPublication(request: CorrectPublicationRequest): PublicationApplicationResult;
  republishPublication(request: RepublishPublicationRequest): PublicationApplicationResult;
  requestWithdrawal(request: RequestWithdrawalLifecycleRequest): PublicationApplicationResult;
  resolveWithdrawal(request: ResolveWithdrawalLifecycleRequest): PublicationApplicationResult;
  suspendPublication(request: SuspendPublicationRequest): PublicationApplicationResult;
  resumePublication(request: ResumePublicationRequest): PublicationApplicationResult;
  supersedePublication(request: SupersedePublicationRequest): PublicationApplicationResult;
  terminatePublication(request: TerminatePublicationRequest): PublicationApplicationResult;
  execute(request: PublicationLifecycleCoordinationRequest): PublicationApplicationResult;
}

export const PUBLICATION_RECOVERY_CATEGORIES = Object.freeze([
  "CONFIRMED_SUCCESS",
  "CONFIRMED_FAILURE",
  "UNKNOWN",
  "PARTIAL_COMPLETION",
  "EXTERNAL_TIMEOUT",
  "MANUAL_REVIEW_REQUIRED",
] as const);

export type PublicationRecoveryCategory = typeof PUBLICATION_RECOVERY_CATEGORIES[number];
export type PublicationRecoveryDecision = "CONFIRMED" | "RECOVERED" | "REJECTED" | "MANUAL_REVIEW_REQUIRED" | "NO_ACTION_REQUIRED";

export interface PublicationReconciliationInput {
  readonly expectedAggregateVersion: number;
  readonly caseId: string;
  readonly category: PublicationRecoveryCategory;
  readonly resolution?: ReconciliationResolution;
  readonly evidenceRefs: readonly string[];
  readonly externalObjectReference?: string;
  readonly command: DomainCommandContext;
}

export interface PublicationReconciliationRequest {
  readonly context: PublicationExecutionContext;
  readonly identity: PublicationIdentity;
  readonly input: PublicationReconciliationInput;
}

export interface PublicationReconciliationSuccessResult {
  readonly ok: true;
  readonly publicationId: string;
  readonly aggregateVersion: number;
  readonly decision: PublicationRecoveryDecision;
  readonly resultReference: string;
  readonly replayed: boolean;
}

export type PublicationReconciliationResult = PublicationReconciliationSuccessResult | PublicationApplicationErrorResult;

export interface PublicationReconciliationPort {
  reconcile(request: PublicationReconciliationRequest): PublicationReconciliationResult;
  recover(request: PublicationReconciliationRequest): PublicationReconciliationResult;
  execute(request: PublicationReconciliationRequest): PublicationReconciliationResult;
}

export interface ModifyPublicationApplicationCommand {
  readonly kind: "MODIFY_PUBLICATION";
  readonly identity: PublicationIdentity;
  readonly input: PublicationModificationCommand;
}

export type PublicationApplicationCommand = CreatePublicationApplicationCommand | ModifyPublicationApplicationCommand;

export type PublicationApplicationErrorCategory = "VALIDATION" | "NOT_FOUND" | "DOMAIN_REJECTION" | "CONFLICT" | "INFRASTRUCTURE";

export interface PublicationApplicationErrorResult {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly category: PublicationApplicationErrorCategory;
    readonly message: string;
  };
}

export interface PublicationApplicationSuccessResult {
  readonly ok: true;
  readonly publicationId: string;
  readonly aggregateVersion: number;
  readonly resultReference: string;
  readonly replayed: boolean;
}

export type PublicationApplicationResult = PublicationApplicationSuccessResult | PublicationApplicationErrorResult;

export interface PublicationCommandHandler<Command extends PublicationApplicationCommand = PublicationApplicationCommand> {
  execute(command: Command, context: PublicationExecutionContext): PublicationApplicationResult;
}

export interface PublicationAuthorizedExecution {
  readonly actorId: string;
  readonly binding: PublicationBinding;
  readonly currentAggregateVersion: number;
}

export type PublicationAuthorizedPreflight = (execution: PublicationAuthorizedExecution) => void;

export interface PublicationApplicationAuditDetails {
  readonly decision: PublicationRecoveryDecision;
  readonly reason: string;
  readonly correlationId: string;
  readonly evidenceRefs: readonly string[];
}
