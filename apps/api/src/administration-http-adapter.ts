import {
  createPublicationHttpRequest,
  createPublicationHttpResponse,
  type PublicationHttpRequest,
  type PublicationHttpResponse,
} from "../../../modules/publication/src/publication-http-contracts.js";

import {
  ADMINISTRATION_API_COMMAND_OPERATIONS,
  ADMINISTRATION_API_QUERY_OPERATIONS,
  AdministrationApiError,
  safeAdministrationApiError,
  type AdministrationApiCommandResult,
  type AdministrationCollectionView,
  type AdministrationReadView,
} from "./administration-api-contracts.js";

export interface AdministrationGovernanceApplicationPort {
  execute(input: unknown): AdministrationApiCommandResult;
  read(input: unknown): AdministrationReadView;
  list(input: unknown): AdministrationCollectionView<AdministrationReadView>;
}

export interface AdministrationHttpRequestHandler {
  handle(input: unknown): Promise<PublicationHttpResponse>;
}

const runtimeCommandOperations = new Set<string>([
  "PROPOSE_ROLE_ASSIGNMENT", "APPROVE_ROLE_ASSIGNMENT", "REJECT_ROLE_ASSIGNMENT", "REVOKE_ROLE_ASSIGNMENT",
  "PROPOSE_POLICY_CHANGE", "APPROVE_POLICY_CHANGE", "REJECT_POLICY_CHANGE",
  "PROPOSE_SOURCE_GOVERNANCE", "APPROVE_SOURCE_GOVERNANCE", "REJECT_SOURCE_GOVERNANCE", "TRANSITION_SOURCE_GOVERNANCE",
  "PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "APPROVE_PUBLICATION_TARGET_GOVERNANCE",
  "REJECT_PUBLICATION_TARGET_GOVERNANCE", "TRANSITION_PUBLICATION_TARGET_GOVERNANCE",
]);

const runtimeListOperations = new Set<string>([
  "LIST_ROLE_ASSIGNMENTS", "LIST_ROLES", "LIST_TEAM_SCOPES", "LIST_POLICIES",
  "LIST_SOURCE_GOVERNANCE", "LIST_PUBLICATION_TARGET_GOVERNANCE",
]);

const runtimeQueryOperations = new Set<string>([
  "READ_ROLE_ASSIGNMENT", "LIST_ROLE_ASSIGNMENTS", "READ_POLICY",
  "READ_SOURCE_GOVERNANCE", "READ_PUBLICATION_TARGET_GOVERNANCE",
  ...runtimeListOperations,
]);

export class InProcessAdministrationHttpAdapter implements AdministrationHttpRequestHandler {
  public constructor(private readonly application: AdministrationGovernanceApplicationPort) {}

  public handle(input: unknown): Promise<PublicationHttpResponse> {
    return Promise.resolve(this.handleSynchronous(input));
  }

  private handleSynchronous(input: unknown): PublicationHttpResponse {
    let requestId = safeRequestId(input);
    try {
      const request = createPublicationHttpRequest(input);
      requestId = request.requestId;
      const route = resolveRoute(request);
      if (route === "METHOD_NOT_ALLOWED") return httpFailure(requestId, 405, "VALIDATION_FAILED", "Request validation failed.");
      if (route === "NOT_FOUND") return httpFailure(requestId, 404, "NOT_FOUND", "Resource not found.");
      const sessionId = request.headers["x-session-id"];
      if (sessionId === undefined || sessionId.trim().length === 0) {
        return httpFailure(requestId, 401, "AUTHENTICATION_REQUIRED", "Authentication required.");
      }
      const body = route === "COMMAND" ? parseBody(request.body) : parseQuery(request.query);
      if (route === "COMMAND" && (!ADMINISTRATION_API_COMMAND_OPERATIONS.includes(body.operation as never)
        || !runtimeCommandOperations.has(body.operation))) {
        return httpFailure(requestId, 400, "VALIDATION_FAILED", "Request validation failed.");
      }
      if (route === "QUERY" && (!ADMINISTRATION_API_QUERY_OPERATIONS.includes(body.operation as never)
        || !runtimeQueryOperations.has(body.operation))) {
        return httpFailure(requestId, 400, "VALIDATION_FAILED", "Request validation failed.");
      }
      const applicationRequest = {
        requestId, sessionId, tenantId: body.tenantId, correlationId: body.correlationId,
        operation: body.operation, payload: body.payload,
      };
      const data = route === "COMMAND"
        ? this.application.execute(applicationRequest)
        : runtimeListOperations.has(body.operation)
          ? this.application.list(applicationRequest)
          : this.application.read(applicationRequest);
      return createPublicationHttpResponse({
        statusCode: 200, headers: { "content-type": "application/json" },
        body: { success: true, data }, requestId,
      });
    } catch (error: unknown) {
      const safe = safeAdministrationApiError(error);
      return httpFailure(requestId, statusFor(safe.code), safe.code, safe.message);
    }
  }
}

export class AdministrationHttpRequestMultiplexer implements AdministrationHttpRequestHandler {
  public constructor(
    private readonly administration: AdministrationHttpRequestHandler,
    private readonly fallback: AdministrationHttpRequestHandler,
  ) {}

  public handle(input: unknown): Promise<PublicationHttpResponse> {
    try {
      const request = createPublicationHttpRequest(input);
      return request.path.startsWith("/administration/")
        ? this.administration.handle(request)
        : this.fallback.handle(request);
    } catch {
      return this.administration.handle(input);
    }
  }
}

export function createAdministrationHttpRequestHandler(
  application: AdministrationGovernanceApplicationPort,
  fallback?: AdministrationHttpRequestHandler,
): AdministrationHttpRequestHandler {
  const administration = new InProcessAdministrationHttpAdapter(application);
  return fallback === undefined ? administration : new AdministrationHttpRequestMultiplexer(administration, fallback);
}

function resolveRoute(request: PublicationHttpRequest): "COMMAND" | "QUERY" | "METHOD_NOT_ALLOWED" | "NOT_FOUND" {
  if (request.path === "/administration/commands") return request.method === "POST" ? "COMMAND" : "METHOD_NOT_ALLOWED";
  if (request.path === "/administration/queries") return request.method === "GET" ? "QUERY" : "METHOD_NOT_ALLOWED";
  return "NOT_FOUND";
}

function parseBody(value: unknown): Readonly<{
  tenantId: string;
  correlationId: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
}> {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["tenantId", "correlationId", "operation", "payload"])
    || typeof value["tenantId"] !== "string" || typeof value["correlationId"] !== "string"
    || typeof value["operation"] !== "string" || !isPlainRecord(value["payload"])) {
    throw new AdministrationApiError("VALIDATION_FAILED");
  }
  return Object.freeze({
    tenantId: value["tenantId"], correlationId: value["correlationId"], operation: value["operation"],
    payload: value["payload"],
  });
}

function parseQuery(query: PublicationHttpRequest["query"]): Readonly<{
  tenantId: string;
  correlationId: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
}> {
  const operation = queryString(query, "operation");
  const tenantId = queryString(query, "tenantId");
  const correlationId = queryString(query, "correlationId");
  const scopeType = queryString(query, "scopeType");
  const scopeId = queryString(query, "scopeId");
  const identityKey = operation === "READ_ROLE_ASSIGNMENT" ? "roleAssignmentId"
    : operation === "READ_POLICY" ? "policyId"
      : operation === "READ_SOURCE_GOVERNANCE" ? "sourceRegistryEntryId"
        : operation === "READ_PUBLICATION_TARGET_GOVERNANCE" ? "publicationTargetId"
          : undefined;
  const isList = runtimeListOperations.has(operation);
  const optionalKeys = isList ? ["status", "limit", "cursor"] : [];
  if (identityKey === undefined && !isList) throw new AdministrationApiError("VALIDATION_FAILED");
  const expectedKeys = ["tenantId", "correlationId", "operation", "scopeType", "scopeId",
    ...(identityKey === undefined ? [] : [identityKey]), ...optionalKeys.filter((key) => query[key] !== undefined)];
  if (!hasExactKeys(query, expectedKeys)) throw new AdministrationApiError("VALIDATION_FAILED");
  const payload: Record<string, unknown> = {
    scope: Object.freeze({ tenantId, scopeType, scopeId }),
  };
  if (identityKey !== undefined) payload[identityKey] = queryString(query, identityKey);
  if (isList) {
    if (query["status"] !== undefined) payload["status"] = queryString(query, "status");

    const limit = query["limit"] === undefined ? undefined : queryString(query, "limit");
    const cursor = query["cursor"] === undefined ? undefined : queryString(query, "cursor");
    if (limit !== undefined || cursor !== undefined) {
      if (limit === undefined || !/^[1-9][0-9]{0,2}$/.test(limit)) throw new AdministrationApiError("VALIDATION_FAILED");
      payload["pagination"] = Object.freeze({ limit: Number(limit), ...(cursor === undefined ? {} : { cursor }) });
    }
  }
  return Object.freeze({ tenantId, correlationId, operation, payload: Object.freeze(payload) });
}

function httpFailure(requestId: string, statusCode: number, code: string, message: string): PublicationHttpResponse {
  return createPublicationHttpResponse({
    statusCode, headers: { "content-type": "application/json" },
    body: { success: false, error: { code, message } }, requestId,
  });
}

function statusFor(code: string): number {
  if (code === "AUTHENTICATION_REQUIRED") return 401;
  if (code === "NOT_FOUND" || code === "AUTHORIZATION_DENIED") return 404;
  if (code === "SELF_APPROVAL_FORBIDDEN" || code === "MFA_REQUIRED" || code === "POLICY_DENIED") return 403;
  if (code === "VERSION_CONFLICT" || code === "IDEMPOTENCY_CONFLICT") return 409;
  if (code === "INVALID_STATE") return 422;
  if (code === "INTERNAL_ERROR") return 500;
  return 400;
}

function safeRequestId(input: unknown): string {
  if (isPlainRecord(input) && typeof input["requestId"] === "string" && input["requestId"].length > 0) {
    return input["requestId"];
  }
  return "unavailable";
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length && actual.every((key, index) => key === required[index]);
}

function queryString(query: PublicationHttpRequest["query"], key: string): string {
  const value = query[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new AdministrationApiError("VALIDATION_FAILED");
  return value;
}
