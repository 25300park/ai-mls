import type {
  PublicationApplicationCommand,
  PublicationApplicationAuditDetails,
  PublicationApplicationResult,
  PublicationAuthorizedPreflight,
  PublicationCommandHandler,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";
import type { CreatePublicationHandler, ModifyPublicationHandler } from "./publication-command-handlers.js";

export class PublicationApplicationService implements PublicationCommandHandler {
  public constructor(
    private readonly createHandler: CreatePublicationHandler,
    private readonly modifyHandler: ModifyPublicationHandler,
  ) {}

  public execute(command: PublicationApplicationCommand, context: PublicationExecutionContext): PublicationApplicationResult {
    return command.kind === "CREATE_PUBLICATION"
      ? this.createHandler.execute(command, context)
      : this.modifyHandler.execute(command, context);
  }

  public executeAuthorized(command: PublicationApplicationCommand, context: PublicationExecutionContext, preflight: PublicationAuthorizedPreflight, auditDetails?: PublicationApplicationAuditDetails): PublicationApplicationResult {
    return command.kind === "CREATE_PUBLICATION"
      ? this.createHandler.executeAuthorized(command, context, preflight)
      : this.modifyHandler.executeAuthorized(command, context, preflight, auditDetails);
  }
}
