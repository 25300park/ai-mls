import type { PublicationTransportFailureResponse } from "./publication-transport-contracts.js";
import {
  createPublicationPresentationViewModel,
  type PublicationPresentationCategory,
  type PublicationPresentationViewModel,
} from "./publication-presentation-contracts.js";
import type { DeterministicPublicationPresentationFormatter } from "./publication-presentation-formatter.js";
import type { PublicationPresentationMetadataBuilder } from "./publication-presentation-metadata.js";

const categoryByStatus = {
  VALIDATION_ERROR: "VALIDATION",
  OPERATION_NOT_FOUND: "NOT_FOUND",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  APPLICATION_REJECTED: "APPLICATION_REJECTION",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const satisfies Readonly<Record<PublicationTransportFailureResponse["status"], PublicationPresentationCategory>>;

export class DeterministicPublicationPresentationErrorMapper {
  public constructor(
    private readonly formatter: DeterministicPublicationPresentationFormatter,
    private readonly metadataBuilder: PublicationPresentationMetadataBuilder,
  ) {}

  public map(response: PublicationTransportFailureResponse): PublicationPresentationViewModel {
    return createPublicationPresentationViewModel({
      presentationResult: "ERROR",
      category: categoryByStatus[response.status],
      message: response.error.message,
      fields: this.formatter.formatError(response.error.code),
      metadata: this.metadataBuilder.build(response.requestId, "ERROR"),
    });
  }

  public mapInternal(requestId: string): PublicationPresentationViewModel {
    return createPublicationPresentationViewModel({
      presentationResult: "ERROR",
      category: "INTERNAL_ERROR",
      message: "Presentation could not be generated.",
      fields: this.formatter.formatError("PRESENTATION_INTERNAL_ERROR"),
      metadata: this.metadataBuilder.build(requestId, "ERROR"),
    });
  }
}
