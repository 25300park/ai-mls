import { immutablePublicationTransportValue } from "./publication-transport-contracts.js";

export type PublicationPresentationResult = "SUCCESS" | "ERROR";

export type PublicationPresentationCategory =
  | "SUCCESS"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "APPLICATION_REJECTION"
  | "INTERNAL_ERROR";

export interface PublicationPresentationField {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface PublicationPresentationMetadata {
  readonly generatedAt: string;
  readonly version: "1";
  readonly requestId: string;
  readonly resultType: PublicationPresentationResult;
}

export interface PublicationPresentationViewModel {
  readonly presentationResult: PublicationPresentationResult;
  readonly category: PublicationPresentationCategory;
  readonly message: string;
  readonly fields: readonly PublicationPresentationField[];
  readonly metadata: PublicationPresentationMetadata;
}

export function createPublicationPresentationViewModel(
  value: PublicationPresentationViewModel,
): PublicationPresentationViewModel {
  return immutablePublicationTransportValue(value);
}
