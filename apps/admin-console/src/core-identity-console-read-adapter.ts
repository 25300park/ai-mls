import type { CoreIdentityAuthorizationHttpHandler } from "../../api/src/core-identity-authorization-http.js";
import type { ConsoleCoreIdentityReadPort, ConsoleCurrentPrincipalView } from "./console-composition.js";

const MAX_ROLES = 64;
const MAX_SCOPES = 128;

export class CoreIdentityConsoleReadAdapter implements ConsoleCoreIdentityReadPort {
  public constructor(private readonly api001: CoreIdentityAuthorizationHttpHandler) {
    if (typeof api001?.handle !== "function") throw new Error("CORE_IDENTITY_CONSOLE_UNAVAILABLE");
  }

  public async readCurrentPrincipal(request: Readonly<{
    sessionId: string;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): Promise<ConsoleCurrentPrincipalView> {
    if (![request.sessionId, request.tenantId, request.scopeRef, request.correlationId].every(safeIdentifier)) {
      throw new Error("CORE_IDENTITY_CONSOLE_UNAVAILABLE");
    }
    try {
      const response = await this.api001.handle({
        method: "GET",
        path: "/v1/me",
        headers: {
          "x-session-id": request.sessionId,
          "x-correlation-id": request.correlationId,
        },
        query: {},
        pathParameters: {},
        body: null,
        requestId: `console-core-${request.correlationId}`,
      });
      const data = response.statusCode === 200 && record(response.body) && response.body["success"] === true
        ? response.body["data"]
        : undefined;
      if (!validTransportPrincipal(data, request.tenantId, request.scopeRef)) {
        throw new Error("CORE_IDENTITY_CONSOLE_UNAVAILABLE");
      }
      return immutablePrincipal({
        principalId: data.principalId,
        tenantId: request.tenantId,
        roles: data.roles,
        scopes: data.scopes,
      });
    } catch {
      throw new Error("CORE_IDENTITY_CONSOLE_UNAVAILABLE");
    }
  }
}

function validTransportPrincipal(value: unknown, tenantId: string, scopeRef: string): value is Readonly<{
  principalId: string;
  principalType: "HUMAN" | "SERVICE";
  roles: readonly string[];
  scopes: readonly Readonly<{ tenantId: string; teamId?: string }>[];
  expiresAt: string;
}> {
  if (!record(value) || !exactKeys(value, ["principalId", "principalType", "roles", "scopes", "expiresAt"])) return false;
  if (!safeIdentifier(value["principalId"])
    || (value["principalType"] !== "HUMAN" && value["principalType"] !== "SERVICE")
    || !canonicalTimestamp(value["expiresAt"])
    || !Array.isArray(value["roles"]) || value["roles"].length > MAX_ROLES || !value["roles"].every(safeIdentifier)
    || !Array.isArray(value["scopes"]) || value["scopes"].length > MAX_SCOPES) return false;
  const scopes = value["scopes"];
  return scopes.every((scope) => record(scope)
    && exactKeys(scope, scope["teamId"] === undefined ? ["tenantId"] : ["tenantId", "teamId"])
    && scope["tenantId"] === tenantId
    && (scope["teamId"] === undefined || safeIdentifier(scope["teamId"])))
    && scopes.some((scope) => record(scope) && scope["tenantId"] === tenantId && scope["teamId"] === scopeRef);
}

function immutablePrincipal(value: ConsoleCurrentPrincipalView): ConsoleCurrentPrincipalView {
  const snapshot = structuredClone(value);
  Object.freeze(snapshot.roles);
  for (const scope of snapshot.scopes) Object.freeze(scope);
  Object.freeze(snapshot.scopes);
  return Object.freeze(snapshot);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
