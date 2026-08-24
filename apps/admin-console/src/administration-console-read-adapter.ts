import type {
  AdministrationApiCommandOperation,
  AdministrationScopeReference,
} from "../../api/src/administration-api-contracts.js";
import type { AdministrationHttpRequestHandler } from "../../api/src/administration-http-adapter.js";
import { immutableConsole, type ConsoleReadRequest, type ConsoleReadResult } from "./console-read-adapter.js";

export const CONSOLE_ADMINISTRATION_COMMAND_OPERATIONS = Object.freeze([
  "PROPOSE_ROLE_ASSIGNMENT", "APPROVE_ROLE_ASSIGNMENT", "REJECT_ROLE_ASSIGNMENT", "REVOKE_ROLE_ASSIGNMENT",
  "PROPOSE_POLICY_CHANGE", "APPROVE_POLICY_CHANGE", "REJECT_POLICY_CHANGE",
  "PROPOSE_SOURCE_GOVERNANCE", "APPROVE_SOURCE_GOVERNANCE", "REJECT_SOURCE_GOVERNANCE", "TRANSITION_SOURCE_GOVERNANCE",
  "PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "APPROVE_PUBLICATION_TARGET_GOVERNANCE", "REJECT_PUBLICATION_TARGET_GOVERNANCE", "TRANSITION_PUBLICATION_TARGET_GOVERNANCE",
] as const satisfies readonly AdministrationApiCommandOperation[]);

export type AdministrationConsoleCommandOperation = typeof CONSOLE_ADMINISTRATION_COMMAND_OPERATIONS[number];
export interface AdministrationConsoleCommandRequest {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly operation: AdministrationConsoleCommandOperation;
  readonly payload: Readonly<Record<string, unknown>>;
}
export type AdministrationConsoleCommandResult = Readonly<{
  state: "CONFIRMED";
  operation: AdministrationConsoleCommandOperation;
  proposalId: string;
  resourceType: string;
  resourceId: string;
  status: string;
  version: number;
  decisionReferences: readonly string[];
}> | Readonly<{
  state: "REJECTED";
  errorCode: string;
  message: string;
  correlationId: string;
}>;
export interface AdministrationConsoleCommandPort {
  execute(request: AdministrationConsoleCommandRequest): Promise<AdministrationConsoleCommandResult>;
}

export interface AdministrationSelectorReadRequest extends ConsoleReadRequest {
  readonly selectorScopes: Readonly<{
    roles: AdministrationScopeReference;
    teamScopes: AdministrationScopeReference;
    policies: AdministrationScopeReference;
    sourceGovernance: AdministrationScopeReference;
    publicationTargets: AdministrationScopeReference;
  }>;
}

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

  public async read(request: ConsoleReadRequest | AdministrationSelectorReadRequest): Promise<ConsoleReadResult> {
    if ("selectorScopes" in request) return this.readSelectorOptions(request);
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

  public async execute(request: AdministrationConsoleCommandRequest): Promise<AdministrationConsoleCommandResult> {
    if (!CONSOLE_ADMINISTRATION_COMMAND_OPERATIONS.includes(request.operation) || containsBrowserAuthority(request.payload)) {
      return rejectedCommand("VALIDATION_FAILED", request.correlationId);
    }
    try {
      const response = await this.api015.handle({
        method: "POST", path: "/administration/commands",
        headers: { "x-session-id": request.sessionId }, query: {}, pathParameters: {},
        body: {
          tenantId: request.tenantId, correlationId: request.correlationId,
          operation: request.operation, payload: request.payload,
        },
        requestId: `console-command-${request.correlationId}`,
      });
      if (response.statusCode !== 200 || !isRecord(response.body)) {
        return rejectedCommand(safeCommandErrorCode(response.body), request.correlationId);
      }
      const data = response.body["data"];
      if (response.body["success"] !== true || !isRecord(data)) return rejectedCommand("INTERNAL_ERROR", request.correlationId);
      const operation = safeText(data["operation"]);
      const proposalId = safeText(data["proposalId"]);
      const resourceType = safeText(data["resourceType"]);
      const resourceId = safeText(data["resourceId"]);
      const status = safeText(data["status"]);
      const version = data["version"];
      const decisionReferences = data["decisionReferences"];
      const safeDecisionReferences = Array.isArray(decisionReferences) ? decisionReferences.map(safeText) : [];
      if (operation !== request.operation || proposalId === undefined || resourceType === undefined || resourceId === undefined
        || status === undefined || !Number.isSafeInteger(version) || (version as number) < 1
        || !Array.isArray(decisionReferences) || safeDecisionReferences.some((item) => item === undefined)) {
        return rejectedCommand("INTERNAL_ERROR", request.correlationId);
      }
      return Object.freeze({
        state: "CONFIRMED" as const, operation: request.operation, proposalId, resourceType, resourceId, status,
        version: version as number, decisionReferences: Object.freeze(safeDecisionReferences.filter((item): item is string => item !== undefined)),
      });
    } catch {
      return rejectedCommand("INTERNAL_ERROR", request.correlationId);
    }
  }

  private async readSelectorOptions(request: AdministrationSelectorReadRequest): Promise<ConsoleReadResult> {
    const definitions = [
      ["roles", "LIST_ROLES", request.selectorScopes.roles, "ROLE", "roleId"],
      ["teamScopes", "LIST_TEAM_SCOPES", request.selectorScopes.teamScopes, "TEAM_SCOPE", "teamId"],
      ["policies", "LIST_POLICIES", request.selectorScopes.policies, "POLICY", "policyId"],
      ["sourceGovernance", "LIST_SOURCE_GOVERNANCE", request.selectorScopes.sourceGovernance, "SOURCE_GOVERNANCE", "sourceRegistryEntryId"],
      ["publicationTargets", "LIST_PUBLICATION_TARGET_GOVERNANCE", request.selectorScopes.publicationTargets, "PUBLICATION_TARGET_GOVERNANCE", "publicationTargetId"],
      ["roleAssignments", "LIST_ROLE_ASSIGNMENTS", request.selectorScopes.teamScopes, "ROLE_ASSIGNMENT", "roleAssignmentId"],
    ] as const;
    try {
      const responses = await Promise.all(definitions.map(([, operation, scope], index) => this.api015.handle({
        method: "GET",
        path: "/administration/queries",
        headers: { "x-session-id": request.sessionId },
        query: {
          tenantId: request.tenantId,
          correlationId: request.correlationId,
          operation,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          limit: "100",
          ...(operation === "LIST_ROLES" ? { status: "ACTIVE" } : {}),
        },
        pathParameters: {},
        body: null,
        requestId: `console-selector-${index}-${request.correlationId}`,
      })));
      const proposalScopes = [
        request.selectorScopes.policies, request.selectorScopes.teamScopes,
        request.selectorScopes.sourceGovernance, request.selectorScopes.publicationTargets,
      ] as const;
      const proposalResponses = await Promise.all(proposalScopes.map((scope, index) => this.api015.handle({
        method: "GET", path: "/administration/queries",
        headers: { "x-session-id": request.sessionId },
        query: {
          tenantId: request.tenantId, correlationId: request.correlationId,
          operation: "LIST_ADMINISTRATION_PROPOSALS", scopeType: scope.scopeType, scopeId: scope.scopeId,
          status: "PROPOSED", limit: "100",
        },
        pathParameters: {}, body: null,
        requestId: `console-proposal-selector-${index}-${request.correlationId}`,
      })));

      if ([...responses, ...proposalResponses].some(({ statusCode }) => statusCode === 401 || statusCode === 403 || statusCode === 404)) {
        return immutableConsole({ page: request.page, state: "NOT_AUTHORIZED" as const, message: "Not authorized." });
      }
      const selectorOptions: Record<string, unknown> = {};
      for (const [index, [key, , , viewType, identityKey]] of definitions.entries()) {
        const collection = successfulCollection(responses[index]!.statusCode, responses[index]!.body);
        if (collection === undefined) return safeError(request.correlationId, request.page);
        const options = collection.items.map((item) => selectorOption(item, viewType, identityKey));
        if (options.some((item) => item === undefined)) return safeError(request.correlationId);
        selectorOptions[key] = {
          state: options.length === 0 ? "EMPTY" : "READY",
          items: options,
          truncated: collection.truncated,
        };
      }
      const proposals = proposalResponses.flatMap((response) => {
        const collection = successfulCollection(response.statusCode, response.body);
        if (collection === undefined) throw new Error("CONSOLE_PROPOSAL_READ_INVALID");
        return collection.items.map(proposalSelectorOption);
      });
      if (proposals.some((item) => item === undefined)) return safeError(request.correlationId, request.page);
      const uniqueProposals = [...new Map(proposals.map((item) => [item!.id, item!])).values()]
        .sort((left, right) => left.resourceType.localeCompare(right.resourceType)
          || left.resourceId.localeCompare(right.resourceId) || left.id.localeCompare(right.id));
      selectorOptions["proposals"] = {
        state: uniqueProposals.length === 0 ? "EMPTY" : "READY",
        items: uniqueProposals,
        truncated: proposalResponses.some((response) => successfulCollection(response.statusCode, response.body)?.truncated === true),
      };

      return immutableConsole({
        page: request.page,
        state: "READY" as const,
        data: { selectorOptions, governedScopes: {
          roles: request.selectorScopes.roles, teamScopes: request.selectorScopes.teamScopes,
          policies: request.selectorScopes.policies, sourceGovernance: request.selectorScopes.sourceGovernance,
          publicationTargets: request.selectorScopes.publicationTargets,
        } },
      });
    } catch {
      return safeError(request.correlationId, request.page);
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

function selectorOption(
  value: unknown,
  expectedViewType: string,
  identityKey: string,
): Readonly<{ id: string; roleCode?: string; subjectPrincipalReference?: string; status: string; version: number; scopeType: string; scopeId: string }> | undefined {
  if (!isRecord(value) || value["viewType"] !== expectedViewType || !isRecord(value["scope"])) return undefined;
  const id = safeText(value[identityKey]);
  const status = safeText(value["status"]);
  const scopeType = safeText(value["scope"]["scopeType"]);
  const scopeId = safeText(value["scope"]["scopeId"]);
  const version = value["version"];
  const roleCode = expectedViewType === "ROLE" ? safeText(value["roleCode"]) : undefined;
  const subjectPrincipalReference = expectedViewType === "ROLE_ASSIGNMENT" ? safeText(value["subjectPrincipalReference"]) : undefined;
  if (id === undefined || status === undefined || scopeType === undefined || scopeId === undefined
    || (expectedViewType === "ROLE" && roleCode === undefined) || (expectedViewType === "ROLE_ASSIGNMENT" && subjectPrincipalReference === undefined) || !Number.isSafeInteger(version) || (version as number) < 1) return undefined;
  return Object.freeze({ id, ...(roleCode === undefined ? {} : { roleCode }), ...(subjectPrincipalReference === undefined ? {} : { subjectPrincipalReference }), status, version: version as number, scopeType, scopeId });
}


function proposalSelectorOption(value: unknown): Readonly<{
  id: string; resourceType: string; resourceId: string; proposerReference: string;
  status: string; version: number; scopeType: string; scopeId: string;
}> | undefined {
  if (!isRecord(value) || value["viewType"] !== "ADMINISTRATION_PROPOSAL" || !isRecord(value["scope"])) return undefined;
  const id = safeText(value["proposalId"]);
  const resourceType = safeText(value["resourceType"]);
  const resourceId = safeText(value["resourceId"]);
  const proposerReference = safeText(value["proposerReference"]);
  const status = safeText(value["status"]);
  const scopeType = safeText(value["scope"]["scopeType"]);
  const scopeId = safeText(value["scope"]["scopeId"]);
  const version = value["version"];
  if ([id, resourceType, resourceId, proposerReference, status, scopeType, scopeId].some((item) => item === undefined)
    || !Number.isSafeInteger(version) || (version as number) < 1) return undefined;
  return Object.freeze({ id: id!, resourceType: resourceType!, resourceId: resourceId!, proposerReference: proposerReference!, status: status!, version: version as number, scopeType: scopeType!, scopeId: scopeId! });
}
function unavailableSection(): Readonly<{ state: "UNAVAILABLE" }> {
  return Object.freeze({ state: "UNAVAILABLE" as const });
}

function safeError(correlationId: string, page: ConsoleReadRequest["page"] = "ADMINISTRATION"): ConsoleReadResult {
  return immutableConsole({
    page,
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

const prohibitedAuthorityKeys = new Set([
  "actorId", "principalId", "sessionId", "roles", "capabilities", "isAdmin", "isMfaVerified",
  "assurance", "assuranceLevel", "approvalStatus", "proposerActorId", "approvalDecisionId",
]);

function containsBrowserAuthority(payload: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(payload).some((key) => prohibitedAuthorityKeys.has(key));
}

function safeCommandErrorCode(body: unknown): string {
  if (!isRecord(body) || body["success"] !== false || !isRecord(body["error"])) return "INTERNAL_ERROR";
  const code = safeText(body["error"]["code"]);
  return code !== undefined && new Set([
    "AUTHENTICATION_REQUIRED", "AUTHORIZATION_DENIED", "NOT_FOUND", "VALIDATION_FAILED",
    "SELF_APPROVAL_FORBIDDEN", "MFA_REQUIRED", "VERSION_CONFLICT", "IDEMPOTENCY_CONFLICT",
    "INVALID_STATE", "POLICY_DENIED", "INTERNAL_ERROR",
  ]).has(code) ? code : "INTERNAL_ERROR";
}

function rejectedCommand(errorCode: string, correlationId: string): AdministrationConsoleCommandResult {
  const safeCorrelationId = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(correlationId)
    ? correlationId
    : "console-correlation-unavailable";
  const messages: Readonly<Record<string, string>> = Object.freeze({
    AUTHENTICATION_REQUIRED: "Authentication required.", AUTHORIZATION_DENIED: "Not authorized.",
    NOT_FOUND: "Resource not found.", VALIDATION_FAILED: "Request validation failed.",
    SELF_APPROVAL_FORBIDDEN: "Independent approval is required.", MFA_REQUIRED: "MFA / step-up is required.",
    VERSION_CONFLICT: "The governed resource changed. Refresh before retrying.",
    IDEMPOTENCY_CONFLICT: "The command conflicts with an earlier request.", INVALID_STATE: "The requested transition is not valid.",
    POLICY_DENIED: "The current policy denied this request.", INTERNAL_ERROR: "The request could not be completed.",
  });
  return Object.freeze({ state: "REJECTED" as const, errorCode, message: messages[errorCode] ?? messages["INTERNAL_ERROR"]!, correlationId: safeCorrelationId });
}
