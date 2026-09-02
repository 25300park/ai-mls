import { createPublicationHttpRequest, createPublicationHttpResponse, type PublicationHttpResponse } from "../../../modules/publication/src/publication-http-contracts.js";
import { parseConnectorApiRequest, type ConnectorApiRequestKind } from "../../../modules/source/src/connector-api-contracts.js";
import type { ConnectorApplicationResult } from "../../../modules/source/src/connector-runtime-application.js";

export interface ConnectorApi018Host { execute(kind: ConnectorApiRequestKind, request: unknown): ConnectorApplicationResult; }
export interface ConnectorApi018HttpRequestHandler { handle(input: unknown): Promise<PublicationHttpResponse>; }

const COMMAND_PATH = "/api/connectors/commands";
const QUERY_PATH = "/api/connectors/queries";
const MAX_BODY_BYTES = 65_536;

class InProcessConnectorApi018HttpAdapter implements ConnectorApi018HttpRequestHandler {
  public constructor(private readonly host: ConnectorApi018Host) {}
  public handle(input: unknown): Promise<PublicationHttpResponse> {
    return Promise.resolve(this.handleSynchronous(input));
  }
  private handleSynchronous(input: unknown): PublicationHttpResponse {
    let requestId = "unavailable";
    try {
      const request = createPublicationHttpRequest(input); requestId = request.requestId;
      if (request.path !== COMMAND_PATH && request.path !== QUERY_PATH) return response(requestId, 404, { success: false, error: { code: "NOT_FOUND", message: "Resource not found." } });
      if (request.method !== "POST") return response(requestId, 405, { success: false, error: { code: "VALIDATION_FAILED", message: "Request validation failed." } });
      if (Object.keys(request.query).length !== 0 || Object.keys(request.pathParameters).length !== 0 || !isRecord(request.body)) return response(requestId, 400, { success: false, error: { code: "VALIDATION_FAILED", message: "Request validation failed." } });
      if (Buffer.byteLength(JSON.stringify(request.body), "utf8") > MAX_BODY_BYTES) return response(requestId, 413, { success: false, error: { code: "VALIDATION_FAILED", message: "Request body is too large." } });
      const sessionId = request.headers["x-session-id"];
      if (sessionId === undefined || sessionId.trim().length === 0) return response(requestId, 401, { success: false, error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
      const body = Object.fromEntries(Object.entries(request.body).filter(([field]) => field !== "sessionId"));
      const kind = request.path === COMMAND_PATH ? "HTTP_COMMAND" as const : "HTTP_QUERY" as const;
      const canonical = parseConnectorApiRequest(kind, Object.freeze({ ...body, sessionId }));
      const applicationKind = request.path === COMMAND_PATH ? "COMMAND" as const : "QUERY" as const;
      let result: ConnectorApplicationResult;
      try { result = this.host.execute(applicationKind, canonical); }
      catch { return response(requestId, 500, { success: false, error: { code: "INTERNAL_ERROR", message: "Connector operation could not be completed." } }); }
      if (result.ok) return response(requestId, 200, { success: true, operation: result.operation, data: result.data });
      return response(requestId, statusFor(result.error.code), { success: false, error: { code: result.error.code, message: safeMessage(result.error.code) } });
    } catch {
      return response(requestId, 400, { success: false, error: { code: "VALIDATION_FAILED", message: "Request validation failed." } });
    }
  }
}

export function createConnectorApi018HttpRequestHandler(host: ConnectorApi018Host): ConnectorApi018HttpRequestHandler { return new InProcessConnectorApi018HttpAdapter(host); }

function statusFor(code: string): number {
  if (code === "UNAUTHENTICATED") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "NOT_FOUND") return 404;
  if (code === "VERSION_CONFLICT" || code === "IDEMPOTENCY_CONFLICT" || code === "CONFLICT" || code === "LEASE_CONFLICT" || code === "CHECKPOINT_CONFLICT" || code === "AMBIGUOUS_EXECUTION") return 409;
  if (code === "CONNECTOR_UNAVAILABLE") return 503;
  if (code === "INTERNAL_ERROR") return 500;
  return 400;
}
function safeMessage(code: string): string {
  if (code === "UNAUTHENTICATED") return "Authentication is required.";
  if (code === "FORBIDDEN") return "Connector operation is not permitted.";
  if (code === "NOT_FOUND") return "Connector resource is unavailable.";
  if (code === "CONNECTOR_UNAVAILABLE") return "Connector execution is unavailable.";
  if (code === "VALIDATION_FAILED") return "Request validation failed.";
  return "Connector operation could not be completed.";
}
function response(requestId: string, statusCode: number, body: unknown): PublicationHttpResponse { return createPublicationHttpResponse({ statusCode, headers: { "content-type": "application/json" }, body, requestId }); }
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
