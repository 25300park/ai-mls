import type { PublicationIdentity } from "./publication-contracts.js";
import type {
  BeginActiveOperationCommand,
  BeginInitialExecutionCommand,
  BeginWithdrawnRepublishCommand,
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
