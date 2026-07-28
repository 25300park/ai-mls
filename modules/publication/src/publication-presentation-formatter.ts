import {
  createPublicationPresentationViewModel,
  type PublicationPresentationField,
} from "./publication-presentation-contracts.js";

export interface PublicationPresentationSuccessValue {
  readonly publicationId: string;
  readonly version: number;
  readonly replayed: boolean;
}

export class DeterministicPublicationPresentationFormatter {
  public formatSuccess(value: PublicationPresentationSuccessValue): readonly PublicationPresentationField[] {
    return immutableFields([
      { key: "publicationId", label: "Publication ID", value: value.publicationId },
      { key: "version", label: "Version", value: String(value.version) },
      { key: "replayed", label: "Replayed", value: value.replayed ? "Yes" : "No" },
    ]);
  }

  public formatError(code: string): readonly PublicationPresentationField[] {
    return immutableFields([{ key: "errorCode", label: "Error Code", value: code }]);
  }
}

function immutableFields(fields: readonly PublicationPresentationField[]): readonly PublicationPresentationField[] {
  return createPublicationPresentationViewModel({
    presentationResult: "SUCCESS",
    category: "SUCCESS",
    message: "Immutable field copy.",
    fields,
    metadata: {
      generatedAt: "1970-01-01T00:00:00.000Z",
      version: "1",
      requestId: "field-copy",
      resultType: "SUCCESS",
    },
  }).fields;
}
