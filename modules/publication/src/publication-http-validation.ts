import {
  createPublicationHttpRequest,
  createPublicationHttpResponse,
  type PublicationHttpRequest,
  type PublicationHttpResponse,
} from "./publication-http-contracts.js";

export class PublicationHttpBoundaryValidator {
  public validateRequest(value: unknown): PublicationHttpRequest {
    return createPublicationHttpRequest(value);
  }

  public validateResponse(value: unknown): PublicationHttpResponse {
    return createPublicationHttpResponse(value);
  }

  public safeRequestId(value: unknown): string {
    try {
      if (typeof value !== "object" || value === null) return "unavailable";
      const requestId = (value as Readonly<Record<string, unknown>>)["requestId"];
      return typeof requestId === "string" && requestId.trim().length > 0
        ? requestId
        : "unavailable";
    } catch {
      return "unavailable";
    }
  }
}
