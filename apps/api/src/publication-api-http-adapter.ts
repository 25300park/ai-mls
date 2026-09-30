import {
  createPublicationHttpRequest,
  createPublicationHttpResponse,
  type PublicationHttpRequest,
  type PublicationHttpResponse,
} from "../../../modules/publication/src/publication-http-contracts.js";
import {
  PUBLICATION_API_COMMAND_OPERATIONS,
  PUBLICATION_API_QUERY_OPERATIONS,
  type PublicationApiErrorCode,
} from "./publication-api-contracts.js";

export interface PublicationApiCanonicalHost {
  executeCanonicalApi(request: unknown): Promise<unknown>;
}

export interface PublicationApi014HttpRequestHandler {
  handle(input: unknown): Promise<PublicationHttpResponse>;
}

const commandPath = "/api/publication/commands";
const queryPath = "/api/publication/queries";
const errorCodes: readonly PublicationApiErrorCode[] = Object.freeze([
  "AUTHENTICATION_REQUIRED", "NOT_FOUND", "VALIDATION_ERROR", "AUTHORIZATION_DENIED",
  "SEPARATION_OF_DUTIES_DENIED", "MFA_REQUIRED", "REASON_REQUIRED", "APPROVAL_NOT_EFFECTIVE",
  "VERIFICATION_NOT_EFFECTIVE", "PERMISSION_NOT_EFFECTIVE", "BINDING_MISMATCH", "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT", "INVALID_PUBLICATION_STATE", "RECONCILIATION_REQUIRED", "INTERNAL_API_ERROR",
]);

class InProcessPublicationApi014HttpAdapter implements PublicationApi014HttpRequestHandler {
  public constructor(
    private readonly host: PublicationApiCanonicalHost,
    private readonly fallback?: PublicationApi014HttpRequestHandler,
  ) {}

  public async handle(input: unknown): Promise<PublicationHttpResponse> {
    let request: PublicationHttpRequest;
    try {
      request = createPublicationHttpRequest(input);
    } catch {
      return failure("unavailable", 400, "VALIDATION_ERROR", "The request is invalid.");
    }
    if (request.path !== commandPath && request.path !== queryPath) {
      return this.fallback?.handle(request)
        ?? failure(request.requestId, 404, "NOT_FOUND", "The resource was not found.");
    }
    if (request.method !== "POST") {
      return failure(request.requestId, 405, "VALIDATION_ERROR", "The request is invalid.");
    }
    if (Object.keys(request.query).length !== 0 || Object.keys(request.pathParameters).length !== 0
      || !isRecord(request.body)) {
      return failure(request.requestId, 400, "VALIDATION_ERROR", "The request is invalid.");
    }
    const operation = request.body["operation"];
    const kind = request.path === commandPath ? "COMMAND" : "QUERY";
    const allowed = kind === "COMMAND"
      ? PUBLICATION_API_COMMAND_OPERATIONS.includes(operation as never)
      : PUBLICATION_API_QUERY_OPERATIONS.includes(operation as never);
    if (!allowed) return failure(request.requestId, 400, "VALIDATION_ERROR", "The request is invalid.");

    const withoutBodySession = Object.fromEntries(
      Object.entries(request.body).filter(([key]) => key !== "sessionId"),
    );
    const sessionId = request.headers["x-session-id"];
    const canonicalRequest = Object.freeze({
      ...withoutBodySession,
      ...(sessionId === undefined || sessionId.trim().length === 0 ? {} : { sessionId }),
    });
    try {
      const response = await this.host.executeCanonicalApi(Object.freeze({ kind, request: canonicalRequest }));
      if (!isRecord(response)) throw new Error("Invalid API response.");
      if (response["success"] === false) {
        const code = errorCode(response);
        if (code === undefined) return failure(request.requestId, 500, "INTERNAL_API_ERROR", safeMessage("INTERNAL_API_ERROR"));
        return failure(request.requestId, statusFor(code), code, safeMessage(code));
      }
      if (response["success"] !== true) throw new Error("Invalid API response.");
      return createPublicationHttpResponse({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: response,
        requestId: request.requestId,
      });
    } catch {
      return failure(request.requestId, 500, "INTERNAL_API_ERROR", "The request could not be completed.");
    }
  }
}

export function createPublicationApi014HttpRequestHandler(
  host: PublicationApiCanonicalHost,
  fallback?: PublicationApi014HttpRequestHandler,
): PublicationApi014HttpRequestHandler {
  return new InProcessPublicationApi014HttpAdapter(host, fallback);
}

function errorCode(response: Readonly<Record<string, unknown>>): PublicationApiErrorCode | undefined {
  const error = response["error"];
  if (!isRecord(error) || typeof error["code"] !== "string"
    || !errorCodes.includes(error["code"] as PublicationApiErrorCode)) return undefined;
  return error["code"] as PublicationApiErrorCode;
}

function statusFor(code: PublicationApiErrorCode): number {
  if (code === "AUTHENTICATION_REQUIRED") return 401;
  if (code === "NOT_FOUND") return 404;
  if (code === "AUTHORIZATION_DENIED" || code === "SEPARATION_OF_DUTIES_DENIED" || code === "MFA_REQUIRED") return 403;
  if (code === "VERSION_CONFLICT" || code === "IDEMPOTENCY_CONFLICT" || code === "RECONCILIATION_REQUIRED") return 409;
  if (code === "INVALID_PUBLICATION_STATE" || code === "APPROVAL_NOT_EFFECTIVE"
    || code === "VERIFICATION_NOT_EFFECTIVE" || code === "PERMISSION_NOT_EFFECTIVE"
    || code === "BINDING_MISMATCH") return 422;
  if (code === "INTERNAL_API_ERROR") return 500;
  return 400;
}

function safeMessage(code: PublicationApiErrorCode): string {
  if (code === "AUTHENTICATION_REQUIRED") return "Authentication required.";
  if (code === "NOT_FOUND") return "Resource not found.";
  if (code === "VALIDATION_ERROR") return "Request validation failed.";
  return "The request could not be completed.";
}

function failure(
  requestId: string,
  statusCode: number,
  code: PublicationApiErrorCode,
  message: string,
): PublicationHttpResponse {
  return createPublicationHttpResponse({
    statusCode,
    headers: { "content-type": "application/json" },
    body: { success: false, error: { code, message } },
    requestId,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
