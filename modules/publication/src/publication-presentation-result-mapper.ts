import type { PublicationTransportResponse } from "./publication-transport-contracts.js";
import {
  createPublicationPresentationViewModel,
  type PublicationPresentationViewModel,
} from "./publication-presentation-contracts.js";
import type { DeterministicPublicationPresentationErrorMapper } from "./publication-presentation-error-mapper.js";
import type { DeterministicPublicationPresentationFormatter } from "./publication-presentation-formatter.js";
import type { PublicationPresentationMetadataBuilder } from "./publication-presentation-metadata.js";

export interface PublicationPresentationResultMapper {
  map(response: PublicationTransportResponse): PublicationPresentationViewModel;
}

export class DefaultPublicationPresentationResultMapper implements PublicationPresentationResultMapper {
  public constructor(
    private readonly formatter: DeterministicPublicationPresentationFormatter,
    private readonly metadataBuilder: PublicationPresentationMetadataBuilder,
    private readonly errorMapper: DeterministicPublicationPresentationErrorMapper,
  ) {}

  public map(response: PublicationTransportResponse): PublicationPresentationViewModel {
    if (!response.success) return this.errorMapper.map(response);
    return createPublicationPresentationViewModel({
      presentationResult: "SUCCESS",
      category: "SUCCESS",
      message: "Publication operation completed.",
      fields: this.formatter.formatSuccess(response.data),
      metadata: this.metadataBuilder.build(response.requestId, "SUCCESS"),
    });
  }
}
