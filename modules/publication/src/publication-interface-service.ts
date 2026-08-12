import type {
  PublicationCoordinationPort,
  PublicationCommandHandler,
  PublicationLifecyclePort,
} from "./publication-application-contracts.js";
import type {
  PublicationInterfaceRequest,
  CoordinatePublicationReconciliationInterfaceRequest,
  PublicationOuterRequest,
  PublicationInterfaceResponse,
} from "./publication-interface-models.js";
import { isJsonInterfaceValue } from "./publication-interface-models.js";
import type { PublicationOutputPort } from "./publication-interface-presenter.js";
import type { PublicationRequestMapper } from "./publication-request-mapper.js";
import type { PublicationInterfaceValidator } from "./publication-interface-validation.js";

export interface PublicationInputPort {
  execute(request: PublicationOuterRequest): PublicationInterfaceResponse;
}

export class PublicationInterfaceService implements PublicationInputPort {
  public constructor(
    private readonly application: PublicationCommandHandler,
    private readonly mapper: PublicationRequestMapper,
    private readonly presenter: PublicationOutputPort,
    private readonly validator: PublicationInterfaceValidator,
    private readonly coordination?: PublicationCoordinationPort,
    private readonly lifecycle?: PublicationLifecyclePort,
  ) {}

  public execute(request: PublicationOuterRequest): PublicationInterfaceResponse {
    if (!isJsonInterfaceValue(request) || request === null || Array.isArray(request)) {
      return this.presenter.presentInterfaceFailure("INTERFACE_VALIDATION_FAILED");
    }
    // Reconciliation outcomes and their evidence are authoritative facts. The
    // public Interface must never accept them from a caller; trusted recovery
    // coordination invokes the injected internal port directly.
    if (request.operation === "COORDINATE_PUBLICATION_RECONCILIATION") {
      return this.presenter.presentInterfaceFailure("INTERFACE_REQUEST_INVALID");
    }
    const validation = this.validator.validate(request);
    if (!validation.valid) return this.presenter.presentInterfaceFailure(validation.failureCode);
    if (request.operation === "COORDINATE_CREATE_PUBLICATION" || request.operation === "COORDINATE_PUBLISH_PUBLICATION"
      || request.operation === "COORDINATE_PUBLICATION_LIFECYCLE") {
      return this.executeCoordination(request);
    }
    return this.executeApplication(request);
  }

  private executeApplication(request: PublicationInterfaceRequest): PublicationInterfaceResponse {
    try {
      const mapped = this.mapper.map(request);
      return this.presenter.present(this.application.execute(mapped.command, mapped.context));
    } catch {
      return this.presenter.presentInterfaceFailure("INTERFACE_EXECUTION_FAILED");
    }
  }

  private executeCoordination(
    request: Exclude<PublicationOuterRequest, PublicationInterfaceRequest | CoordinatePublicationReconciliationInterfaceRequest>,
  ): PublicationInterfaceResponse {
    if (request.operation === "COORDINATE_PUBLICATION_LIFECYCLE") {
      if (this.lifecycle === undefined) return this.presenter.presentInterfaceFailure("INTERFACE_EXECUTION_FAILED");
      try {
        return this.presenter.present(this.lifecycle.execute({
          action: request.action,
          context: request.context,
          identity: request.identity,
          input: request.input,
        } as Parameters<PublicationLifecyclePort["execute"]>[0]));
      } catch {
        return this.presenter.presentInterfaceFailure("INTERFACE_EXECUTION_FAILED");
      }
    }
    if (this.coordination === undefined) return this.presenter.presentInterfaceFailure("INTERFACE_EXECUTION_FAILED");
    try {
      const result = request.operation === "COORDINATE_CREATE_PUBLICATION"
        ? this.coordination.create({ context: request.context, command: request.command })
        : this.coordination.publish({
          context: request.context,
          identity: request.identity,
          command: request.command,
          attempt: request.attempt,
          expectedAggregateVersion: request.expectedAggregateVersion,
        });
      return result.ok
        ? Object.freeze({ operationResult: "SUCCEEDED" as const, publicationId: result.publicationId, version: result.aggregateVersion, replayed: result.replayed })
        : this.presenter.present(result);
    } catch {
      return this.presenter.presentInterfaceFailure("INTERFACE_EXECUTION_FAILED");
    }
  }
}
