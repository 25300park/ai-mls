import type {
  PublicationCommandHandler,
} from "./publication-application-contracts.js";
import type {
  PublicationInterfaceRequest,
  PublicationInterfaceResponse,
} from "./publication-interface-models.js";
import type { PublicationOutputPort } from "./publication-interface-presenter.js";
import type { PublicationRequestMapper } from "./publication-request-mapper.js";
import type { PublicationInterfaceValidator } from "./publication-interface-validation.js";

export interface PublicationInputPort {
  execute(request: PublicationInterfaceRequest): PublicationInterfaceResponse;
}

export class PublicationInterfaceService implements PublicationInputPort {
  public constructor(
    private readonly application: PublicationCommandHandler,
    private readonly mapper: PublicationRequestMapper,
    private readonly presenter: PublicationOutputPort,
    private readonly validator: PublicationInterfaceValidator,
  ) {}

  public execute(request: PublicationInterfaceRequest): PublicationInterfaceResponse {
    const validation = this.validator.validate(request);
    if (!validation.valid) return this.presenter.presentInterfaceFailure(validation.failureCode);
    try {
      const mapped = this.mapper.map(request);
      return this.presenter.present(this.application.execute(mapped.command, mapped.context));
    } catch {
      return this.presenter.presentInterfaceFailure("INTERFACE_EXECUTION_FAILED");
    }
  }
}
