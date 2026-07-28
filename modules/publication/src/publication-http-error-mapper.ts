import {
  createPublicationHttpResponse,
  type PublicationHttpAdapterErrorCode,
  type PublicationHttpResponse,
} from "./publication-http-contracts.js";

const errorPolicy = Object.freeze({
  INVALID_HTTP_REQUEST: Object.freeze({ statusCode: 400, message: "HTTP request is invalid." }),
  METHOD_NOT_ALLOWED: Object.freeze({ statusCode: 405, message: "HTTP method is not allowed." }),
  ROUTE_NOT_FOUND: Object.freeze({ statusCode: 404, message: "HTTP route was not found." }),
  INVALID_REQUEST_BODY: Object.freeze({ statusCode: 400, message: "HTTP request body is invalid." }),
  EXECUTABLE_UNAVAILABLE: Object.freeze({ statusCode: 503, message: "Executable is unavailable." }),
  REQUEST_EXECUTION_FAILED: Object.freeze({ statusCode: 500, message: "HTTP request execution failed." }),
  INTERNAL_HTTP_ADAPTER_ERROR: Object.freeze({
    statusCode: 500,
    message: "HTTP request could not be processed.",
  }),
} satisfies Readonly<Record<PublicationHttpAdapterErrorCode, {
  readonly statusCode: number;
  readonly message: string;
}>>);

export class PublicationHttpErrorMapper {
  public map(requestId: string, code: PublicationHttpAdapterErrorCode): PublicationHttpResponse {
    const policy = errorPolicy[code];
    return createPublicationHttpResponse({
      statusCode: policy.statusCode,
      headers: { "content-type": "application/json" },
      body: { success: false, error: { code, message: policy.message } },
      requestId,
    });
  }

  public mapUnknown(requestId: string): PublicationHttpResponse {
    return this.map(requestId, "INTERNAL_HTTP_ADAPTER_ERROR");
  }
}
