import type { AdministrationHttpRequestHandler } from "../../api/src/administration-http-adapter.js";
import { immutableConsole, type ConsoleReadRequest, type ConsoleReadResult } from "./console-read-adapter.js";

interface RoleAssignmentRow {
  readonly roleAssignmentId: string;
  readonly subjectPrincipalReference: string;
  readonly roleId: string;
  readonly scopeType: string;
  readonly scopeId: string;
  readonly status: string;
  readonly version: number;
}

export class AdministrationConsoleReadAdapter {
  public constructor(private readonly api015: AdministrationHttpRequestHandler) {}

  public async read(request: ConsoleReadRequest): Promise<ConsoleReadResult> {
    try {
      const response = await this.api015.handle({
        method: "GET",
        path: "/administration/queries",
        headers: { "x-session-id": request.sessionId },
        query: {
          tenantId: request.tenantId,
          correlationId: request.correlationId,
          operation: "LIST_ROLE_ASSIGNMENTS",
          scopeType: "TENANT",
          scopeId: request.tenantId,
          limit: "100",
        },
        pathParameters: {},
        body: null,
        requestId: `console-${request.correlationId}`,
      });
      if (response.statusCode === 401 || response.statusCode === 403 || response.statusCode === 404) {
        return immutableConsole({
          page: "ADMINISTRATION" as const,
          state: "NOT_AUTHORIZED" as const,
          message: "Not authorized.",
        });
      }
      const collection = successfulCollection(response.statusCode, response.body);
      if (collection === undefined) return safeError(request.correlationId);
      const roleAssignments = collection.items.map(roleAssignmentRow);
      if (roleAssignments.some((item) => item === undefined)) return safeError(request.correlationId);
      const rows = roleAssignments as readonly RoleAssignmentRow[];
      return immutableConsole({
        page: "ADMINISTRATION" as const,
        state: "READY" as const,
        data: {
          visibleActiveRoleAssignmentCount: rows.filter(({ status }) => status === "ACTIVE").length,
          visibleRoleAssignmentCount: rows.length,
          roleAssignmentsTruncated: collection.truncated,
          roleAssignments: { state: rows.length === 0 ? "EMPTY" : "READY", items: rows, truncated: collection.truncated },
          pendingProposals: unavailableSection(),
          recentDecisions: unavailableSection(),
          policyGovernance: unavailableSection(),
          sourceGovernance: unavailableSection(),
          targetGovernance: unavailableSection(),
          authorityStatus: "AUTHORIZED",
          administrationApiStatus: "AVAILABLE",
        },
      });
    } catch {
      return safeError(request.correlationId);
    }
  }
}

function successfulCollection(statusCode: number, body: unknown): Readonly<{ items: readonly unknown[]; truncated: boolean }> | undefined {
  if (statusCode !== 200 || !isRecord(body) || body["success"] !== true || !isRecord(body["data"])) return undefined;
  const items = body["data"]["items"];
  const nextCursor = body["data"]["nextCursor"];
  if (!Array.isArray(items) || (nextCursor !== undefined && safeText(nextCursor) === undefined)) return undefined;
  return Object.freeze({ items, truncated: nextCursor !== undefined });
}

function roleAssignmentRow(value: unknown): RoleAssignmentRow | undefined {
  if (!isRecord(value) || value["viewType"] !== "ROLE_ASSIGNMENT" || !isRecord(value["scope"])) return undefined;
  const roleAssignmentId = safeText(value["roleAssignmentId"]);
  const subjectPrincipalReference = safeText(value["subjectPrincipalReference"]);
  const roleId = safeText(value["roleId"]);
  const scopeType = safeText(value["scope"]["scopeType"]);
  const scopeId = safeText(value["scope"]["scopeId"]);
  const status = safeText(value["status"]);
  const version = value["version"];
  if (roleAssignmentId === undefined || subjectPrincipalReference === undefined || roleId === undefined
    || scopeType === undefined || scopeId === undefined || status === undefined
    || !Number.isSafeInteger(version) || (version as number) < 1) return undefined;
  return Object.freeze({
    roleAssignmentId, subjectPrincipalReference, roleId, scopeType, scopeId, status, version: version as number,
  });
}

function unavailableSection(): Readonly<{ state: "UNAVAILABLE" }> {
  return Object.freeze({ state: "UNAVAILABLE" as const });
}

function safeError(correlationId: string): ConsoleReadResult {
  return immutableConsole({
    page: "ADMINISTRATION" as const,
    state: "ERROR" as const,
    error: {
      code: "CONSOLE_READ_UNAVAILABLE" as const,
      message: "The requested Console view is unavailable.",
      correlationId: /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(correlationId)
        ? correlationId
        : "console-correlation-unavailable",
    },
  });
}

function safeText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
