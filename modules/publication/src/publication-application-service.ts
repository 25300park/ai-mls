import type {
  CreatePublicationApplicationCommand,
  ModifyPublicationApplicationCommand,
  PublicationApplicationCommand,
  PublicationApplicationResult,
  PublicationCommandHandler,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";

export class PublicationApplicationService implements PublicationCommandHandler {
  public constructor(
    private readonly createHandler: PublicationCommandHandler<CreatePublicationApplicationCommand>,
    private readonly modifyHandler: PublicationCommandHandler<ModifyPublicationApplicationCommand>,
  ) {}

  public execute(command: PublicationApplicationCommand, context: PublicationExecutionContext): PublicationApplicationResult {
    return command.kind === "CREATE_PUBLICATION"
      ? this.createHandler.execute(command, context)
      : this.modifyHandler.execute(command, context);
  }
}
