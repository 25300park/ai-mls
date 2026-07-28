import {
  createPublicationPresentationViewModel,
  type PublicationPresentationMetadata,
  type PublicationPresentationResult,
} from "./publication-presentation-contracts.js";

export interface PublicationPresentationTimeSource {
  now(): string;
}

export class PublicationPresentationMetadataBuilder {
  public constructor(private readonly timeSource: PublicationPresentationTimeSource) {}

  public build(requestId: string, resultType: PublicationPresentationResult): PublicationPresentationMetadata {
    return createPublicationPresentationViewModel({
      presentationResult: resultType,
      category: resultType === "SUCCESS" ? "SUCCESS" : "INTERNAL_ERROR",
      message: "Immutable metadata copy.",
      fields: [],
      metadata: {
        generatedAt: this.timeSource.now(),
        version: "1",
        requestId,
        resultType,
      },
    }).metadata;
  }
}
