import type { PublicationTransportResponse } from "./publication-transport-contracts.js";
import {
  createPublicationPresentationViewModel,
  type PublicationPresentationViewModel,
} from "./publication-presentation-contracts.js";
import { DeterministicPublicationPresentationErrorMapper } from "./publication-presentation-error-mapper.js";
import { DeterministicPublicationPresentationFormatter } from "./publication-presentation-formatter.js";
import {
  PublicationPresentationMetadataBuilder,
  type PublicationPresentationTimeSource,
} from "./publication-presentation-metadata.js";
import {
  DefaultPublicationPresentationResultMapper,
  type PublicationPresentationResultMapper,
} from "./publication-presentation-result-mapper.js";
import { StructuralPublicationPresentationValidator } from "./publication-presentation-validation.js";

export class PublicationPresentationAdapter {
  public constructor(
    private readonly resultMapper: PublicationPresentationResultMapper,
    private readonly validator: StructuralPublicationPresentationValidator,
    private readonly errorMapper: DeterministicPublicationPresentationErrorMapper,
  ) {}

  public present(response: PublicationTransportResponse): PublicationPresentationViewModel {
    const requestId = safeRequestId(response);
    try {
      const model = this.resultMapper.map(response);
      return this.validator.validate(model).valid
        ? createPublicationPresentationViewModel(model)
        : this.errorMapper.mapInternal(requestId);
    } catch {
      return this.errorMapper.mapInternal(requestId);
    }
  }
}

export function createPublicationPresentationAdapter(
  timeSource: PublicationPresentationTimeSource,
): PublicationPresentationAdapter {
  const formatter = new DeterministicPublicationPresentationFormatter();
  const metadataBuilder = new PublicationPresentationMetadataBuilder(timeSource);
  const errorMapper = new DeterministicPublicationPresentationErrorMapper(formatter, metadataBuilder);
  return new PublicationPresentationAdapter(
    new DefaultPublicationPresentationResultMapper(formatter, metadataBuilder, errorMapper),
    new StructuralPublicationPresentationValidator(),
    errorMapper,
  );
}

function safeRequestId(response: PublicationTransportResponse): string {
  return typeof response.requestId === "string" && response.requestId.trim().length > 0
    ? response.requestId
    : "unknown-request";
}
