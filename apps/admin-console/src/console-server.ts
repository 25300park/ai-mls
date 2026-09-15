import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";

import {
  CONSOLE_PAGES,
  type ConsolePage,
  type ConsoleReadPort,
  type ConsoleReadRequest,
} from "./console-read-adapter.js";
import { renderConsoleResult, renderConsoleShell } from "./console-renderer.js";
import {
  CONSOLE_ADMINISTRATION_COMMAND_OPERATIONS,
  type AdministrationConsoleCommandOperation,
  type AdministrationConsoleCommandPort,
  type AdministrationConsoleCommandResult,
  type AdministrationSelectorReadRequest,
} from "./administration-console-read-adapter.js";

interface AdminConsoleServerBaseConfiguration {
  readonly host: string;
  readonly port: number;
  readonly tenantId: string;
  readonly readAdapter: ConsoleReadPort;
  readonly administrationCommandAdapter?: AdministrationConsoleCommandPort;
  readonly administrationSelectorScopes?: AdministrationSelectorReadRequest["selectorScopes"];
}

export interface ConsoleSessionIngressRequest {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly page: ConsolePage;
  readonly purpose: "CONSOLE_ACCESS";
  readonly correlationId: string;
  readonly commandOperation?: AdministrationConsoleCommandOperation;
  readonly reason?: string;
}

export interface ConsoleSessionIngressPort {
  authorize(request: ConsoleSessionIngressRequest): void | Promise<void>;
}

interface DevelopmentAdminConsoleServerConfiguration extends AdminConsoleServerBaseConfiguration {
  readonly runtimeEnvironment?: "DEVELOPMENT" | "TEST";
  readonly sessionId: string;
}

interface StagingAdminConsoleServerConfiguration extends AdminConsoleServerBaseConfiguration {
  readonly runtimeEnvironment: "STAGING";
  readonly scopeRef: string;
  readonly sessionIngress: ConsoleSessionIngressPort;
}

export type AdminConsoleServerConfiguration = DevelopmentAdminConsoleServerConfiguration | StagingAdminConsoleServerConfiguration;

export interface AdminConsoleServer {
  readonly port: number;
  readonly localUrl: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const browserRoutes: Readonly<Record<string, ConsolePage>> = Object.freeze({
  "/": "DASHBOARD",
  "/publication/operations": "UI-031",
  "/publication/revalidation": "UI-032",
  "/publication/recovery": "UI-033",
  "/publication/audit": "UI-035",
  "/administration": "ADMINISTRATION",
  "/system/projection": "PROJECTION",
  "/administration/governance": "UI-036",
  "/system/operations": "OPERATIONS",
  "/connector/operations": "CONNECTOR",
  "/recovery/cases": "RECOVERY_CASE",
  "/integration/evidence": "EXTERNAL_INTEGRATION",
  "/audit/evidence": "EVIDENCE",
});

export function createAdminConsoleServer(configuration: AdminConsoleServerConfiguration): AdminConsoleServer {
  validateConfiguration(configuration);
  let server: Server | undefined;
  let boundPort = 0;
  let requestSequence = 0;

  return Object.freeze({
    get port(): number { return boundPort; },
    get localUrl(): string { return boundPort === 0 ? "NOT_LISTENING" : `http://${configuration.host}:${String(boundPort)}`; },
    async start(): Promise<void> {
      if (server !== undefined) throw new Error("CONSOLE_SERVER_ALREADY_STARTED");
      const created = createServer((request, response) => {
        const method = request.method ?? "";
        const rawUrl = request.url ?? "";
        requestSequence += 1;
        if (rawUrl.length > 2_048) {
          writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
          return;
        }
        let url: URL;
        try { url = new URL(rawUrl, `http://${configuration.host}`); } catch {
          writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
          return;
        }
        if (method === "POST" && url.pathname === "/api/console/administration/command") {
          void handleAdministrationCommand(request, response, configuration, requestSequence);
          return;
        }
        if (method !== "GET") {
          request.resume();
          writeJson(response, 405, { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "The Console route does not allow this method." } });
          return;
        }
        if (url.pathname === "/api/console/view") {
          const page = parsePage(url.searchParams.get("page"));
          if (page === undefined) {
            writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
            return;
          }
          const publicationId = ["UI-031", "UI-032", "UI-033", "UI-035", "PROJECTION"].includes(page)
            ? safeIdentifier(url.searchParams.get("publicationId")) : undefined;
          const connectorId = page === "CONNECTOR" ? safeIdentifier(url.searchParams.get("connectorId")) : undefined;
          const sourceId = page === "CONNECTOR" ? safeIdentifier(url.searchParams.get("sourceId")) : undefined;
          const batchId = page === "CONNECTOR" ? safeIdentifier(url.searchParams.get("batchId")) : undefined;
          const recoveryCaseId = page === "RECOVERY_CASE" ? safeIdentifier(url.searchParams.get("recoveryCaseId")) : undefined;
          const mappingId = page === "EXTERNAL_INTEGRATION" ? safeIdentifier(url.searchParams.get("mappingId")) : undefined;
          const integrationContractId = page === "EXTERNAL_INTEGRATION" ? safeIdentifier(url.searchParams.get("integrationContractId")) : undefined;
          const auditTargetId = page === "EVIDENCE" ? safeIdentifier(url.searchParams.get("auditTargetId")) : undefined;
          const auditEventType = page === "EVIDENCE" ? safeIdentifier(url.searchParams.get("auditEventType")) : undefined;
          if (mappingId !== undefined && integrationContractId !== undefined) {
            writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
            return;
          }
          void handleConsoleRead(request, response, configuration, requestSequence, page, {
            publicationId, connectorId, sourceId, batchId, recoveryCaseId, mappingId,
            integrationContractId, auditTargetId, auditEventType,
          });
          return;
        }
        const page = browserRoutes[url.pathname];
        if (page === undefined) {
          writeJson(response, 404, { success: false, error: { code: "ROUTE_NOT_FOUND", message: "The Console route was not found." } });
          return;
        }
        const publicationId = safeIdentifier(url.searchParams.get("publicationId"));
        writeHtml(response, renderConsoleShell(page, publicationId));
      });
      server = created;
      await new Promise<void>((resolve, reject) => {
        created.once("error", reject);
        created.listen(configuration.port, configuration.host, () => {
          created.off("error", reject);
          const address = created.address();
          if (address === null || typeof address === "string") {
            reject(new Error("CONSOLE_SERVER_BIND_FAILED"));
            return;
          }
          boundPort = address.port;
          resolve();
        });
      });
    },
    async stop(): Promise<void> {
      const current = server;
      if (current === undefined) return;
      await new Promise<void>((resolve, reject) => current.close((error) => error === undefined ? resolve() : reject(error)));
      server = undefined;
      boundPort = 0;
    },
  });
}

function parsePage(value: string | null): ConsolePage | undefined {
  return value !== null && CONSOLE_PAGES.includes(value as ConsolePage) ? value as ConsolePage : undefined;
}

function safeIdentifier(value: string | null): string | undefined {
  if (value === null || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(value)) return undefined;
  return value;
}

function validateConfiguration(configuration: AdminConsoleServerConfiguration): void {
  if (configuration.host !== "127.0.0.1" || !Number.isSafeInteger(configuration.port) || configuration.port < 0 || configuration.port > 65_535) {
    throw new Error("CONSOLE_SERVER_CONFIGURATION_INVALID");
  }
  if (safeIdentifier(configuration.tenantId) === undefined) {
    throw new Error("CONSOLE_SERVER_CONFIGURATION_INVALID");
  }
  if (configuration.runtimeEnvironment === "STAGING") {
    if (safeIdentifier(configuration.scopeRef) === undefined || typeof configuration.sessionIngress?.authorize !== "function") {
      throw new Error("CONSOLE_SERVER_CONFIGURATION_INVALID");
    }
  } else if (safeIdentifier(configuration.sessionId) === undefined) throw new Error("CONSOLE_SERVER_CONFIGURATION_INVALID");
}

async function handleConsoleRead(
  incoming: IncomingMessage,
  response: ServerResponse,
  configuration: AdminConsoleServerConfiguration,
  requestSequence: number,
  page: ConsolePage,
  references: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const correlationId = `correlation:console-read-${String(requestSequence)}`;
  const identity = await authorizeRequest(incoming, configuration, page, correlationId, response);
  if (identity === undefined) return;
  const baseReadRequest: ConsoleReadRequest = {
    page,
    sessionId: identity.sessionId,
    tenantId: configuration.tenantId,
    teamId: identity.scopeRef,
    ...Object.fromEntries(Object.entries(references).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    correlationId,
  };
  if (page === "UI-036" && configuration.administrationSelectorScopes === undefined) {
    writeJson(response, 200, { html: renderConsoleResult({
      page, state: "UNAVAILABLE", message: "Authorized governed selector scopes are unavailable.",
    }) });
    return;
  }
  const readRequest: ConsoleReadRequest | AdministrationSelectorReadRequest = page === "UI-036" && configuration.administrationSelectorScopes !== undefined
    ? { ...baseReadRequest, selectorScopes: configuration.administrationSelectorScopes }
    : baseReadRequest;
  try {
    const result = await configuration.readAdapter.read(readRequest);
    writeJson(response, 200, { html: renderConsoleResult(result) });
  } catch {
    writeJson(response, 200, { html: renderConsoleResult({
      page,
      state: "ERROR",
      error: {
        code: "CONSOLE_READ_UNAVAILABLE",
        message: "The requested Console view is unavailable.",
        correlationId,
      },
    }) });
  }
}

async function authorizeRequest(
  incoming: IncomingMessage,
  configuration: AdminConsoleServerConfiguration,
  page: ConsolePage,
  correlationId: string,
  response: ServerResponse,
  command?: Readonly<{ operation: AdministrationConsoleCommandOperation; reason?: string }>,
): Promise<Readonly<{ sessionId: string; scopeRef: string }> | undefined> {
  if (configuration.runtimeEnvironment !== "STAGING") {
    return Object.freeze({ sessionId: configuration.sessionId, scopeRef: configuration.tenantId });
  }
  const carrier = incoming.headers["x-session-id"];
  const sessionId = typeof carrier === "string" ? safeIdentifier(carrier) : undefined;
  if (sessionId === undefined) {
    unauthenticated(response);
    return undefined;
  }
  try {
    await configuration.sessionIngress.authorize({
      sessionId,
      tenantId: configuration.tenantId,
      scopeRef: configuration.scopeRef,
      page,
      purpose: "CONSOLE_ACCESS",
      correlationId,
      ...(command === undefined ? {} : { commandOperation: command.operation }),
      ...(command?.reason === undefined ? {} : { reason: command.reason }),
    });
    return Object.freeze({ sessionId, scopeRef: configuration.scopeRef });
  } catch {
    unauthenticated(response);
    return undefined;
  }
}

function unauthenticated(response: ServerResponse): void {
  writeJson(response, 401, { success: false, error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
}


async function handleAdministrationCommand(
  request: IncomingMessage,
  response: ServerResponse,
  configuration: AdminConsoleServerConfiguration,
  requestSequence: number,
): Promise<void> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    request.resume();
    invalidConsoleRequest(response);
    return;
  }
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || !hasExactKeys(body, ["operation", "payload"]) || typeof body["operation"] !== "string"
      || !CONSOLE_ADMINISTRATION_COMMAND_OPERATIONS.includes(body["operation"] as AdministrationConsoleCommandOperation)
      || !isRecord(body["payload"])) {
      invalidConsoleRequest(response);
      return;
    }
    const correlationId = `console-command-${String(requestSequence)}`;
    const reason = typeof body["payload"]["reason"] === "string" ? body["payload"]["reason"] : undefined;
    const identity = await authorizeRequest(request, configuration, "UI-036", correlationId, response, {
      operation: body["operation"] as AdministrationConsoleCommandOperation,
      ...(reason === undefined ? {} : { reason }),
    });
    if (identity === undefined) return;
    const commandAdapter = configuration.administrationCommandAdapter;
    const selectorScopes = configuration.administrationSelectorScopes;
    if (commandAdapter === undefined || selectorScopes === undefined) {
      writeJson(response, 503, { success: false, error: { code: "CONTROLLED_ADMINISTRATION_UNAVAILABLE", message: "Controlled administration is unavailable." } });
      return;
    }

    const rawResult = await commandAdapter.execute({
      sessionId: identity.sessionId,
      tenantId: configuration.tenantId,
      correlationId,
      operation: body["operation"] as AdministrationConsoleCommandOperation,
      payload: canonicalizeBrowserPayload(body["payload"], configuration.tenantId, selectorScopes),
    });
    const result = projectSafeCommandResult(rawResult, correlationId);
    const refreshRequest: AdministrationSelectorReadRequest = {
      page: "UI-036", sessionId: identity.sessionId, tenantId: configuration.tenantId,
      teamId: identity.scopeRef, correlationId: `console-refresh-${String(requestSequence)}`, selectorScopes,
    };
    const refreshed = await configuration.readAdapter.read(refreshRequest);
    writeJson(response, 200, { result, html: renderConsoleResult(refreshed) });
  } catch {
    invalidConsoleRequest(response);
  }
}

function projectSafeCommandResult(value: unknown, correlationId: string): AdministrationConsoleCommandResult {
  if (isRecord(value) && value["state"] === "CONFIRMED" && hasExactKeys(value, [
    "state", "operation", "proposalId", "resourceType", "resourceId", "status", "version", "decisionReferences",
  ])) {
    const operation = value["operation"];
    const references = value["decisionReferences"];
    if (typeof operation === "string" && CONSOLE_ADMINISTRATION_COMMAND_OPERATIONS.includes(operation as AdministrationConsoleCommandOperation)
      && safeCommandIdentifier(value["proposalId"]) && safeCommandIdentifier(value["resourceType"])
      && safeCommandIdentifier(value["resourceId"]) && safeCommandIdentifier(value["status"])
      && Number.isSafeInteger(value["version"]) && (value["version"] as number) >= 1
      && Array.isArray(references) && references.length <= 100 && references.every(safeCommandIdentifier)) {
      return Object.freeze({
        state: "CONFIRMED" as const,
        operation: operation as AdministrationConsoleCommandOperation,
        proposalId: value["proposalId"],
        resourceType: value["resourceType"],
        resourceId: value["resourceId"],
        status: value["status"],
        version: value["version"] as number,
        decisionReferences: Object.freeze([...references] as string[]),
      });
    }
  }
  if (isRecord(value) && value["state"] === "REJECTED" && hasExactKeys(value, [
    "state", "errorCode", "message", "correlationId",
  ])) {
    const errorCode = value["errorCode"];
    const message = typeof errorCode === "string" ? SAFE_COMMAND_ERROR_MESSAGES[errorCode] : undefined;
    if (typeof errorCode === "string" && message !== undefined) {
      return Object.freeze({ state: "REJECTED" as const, errorCode, message, correlationId });
    }
  }
  return Object.freeze({
    state: "REJECTED" as const,
    errorCode: "INTERNAL_ERROR",
    message: "The request could not be completed.",
    correlationId,
  });
}

function safeCommandIdentifier(value: unknown): value is string {
  return typeof value === "string" && safeIdentifier(value) !== undefined
    && !isUnsafeSecurityDetailValue(value)
    && !/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u.test(value);
}

const SAFE_COMMAND_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUTHENTICATION_REQUIRED: "Authentication required.",
  AUTHORIZATION_DENIED: "Not authorized.",
  NOT_FOUND: "Resource not found.",
  VALIDATION_FAILED: "Request validation failed.",
  SELF_APPROVAL_FORBIDDEN: "Independent approval is required.",
  MFA_REQUIRED: "MFA / step-up is required.",
  VERSION_CONFLICT: "The governed resource changed. Refresh before retrying.",
  IDEMPOTENCY_CONFLICT: "The command conflicts with an earlier request.",
  INVALID_STATE: "The requested transition is not valid.",
  POLICY_DENIED: "The current policy denied this request.",
  INTERNAL_ERROR: "The request could not be completed.",
});

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<unknown>) {
    const buffer = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > 65_536) throw new Error("INVALID_CONSOLE_REQUEST");
    chunks.push(buffer);
  }
  if (size === 0) throw new Error("INVALID_CONSOLE_REQUEST");
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function invalidConsoleRequest(response: ServerResponse): void {
  writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function canonicalizeBrowserPayload(
  input: Readonly<Record<string, unknown>>,
  tenantId: string,
  selectorScopes: AdministrationSelectorReadRequest["selectorScopes"],
): Readonly<Record<string, unknown>> {
  const payload: Record<string, unknown> = { ...input };
  const suppliedScope = isRecord(payload["scope"]) ? payload["scope"] : undefined;
  const scopeType = typeof payload["scopeType"] === "string" ? payload["scopeType"]
    : typeof suppliedScope?.["scopeType"] === "string" ? suppliedScope["scopeType"] : undefined;
  const scopeId = typeof payload["scopeId"] === "string" ? payload["scopeId"]
    : typeof suppliedScope?.["scopeId"] === "string" ? suppliedScope["scopeId"] : undefined;
  if (scopeType === undefined || scopeId === undefined) throw new Error("INVALID_CONSOLE_REQUEST");
  const trustedScope = Object.values(selectorScopes).find((scope) => scope.tenantId === tenantId
    && scope.scopeType === scopeType && scope.scopeId === scopeId);
  if (trustedScope === undefined) throw new Error("INVALID_CONSOLE_REQUEST");
  delete payload["scopeType"];
  delete payload["scopeId"];
  payload["scope"] = Object.freeze({ ...trustedScope });
  const evidenceReferenceId = payload["evidenceReferenceId"];
  delete payload["evidenceReferenceId"];
  if (typeof evidenceReferenceId === "string" && evidenceReferenceId.trim().length > 0) {
    payload["evidenceReferences"] = Object.freeze([{ type: "CASE", id: evidenceReferenceId.trim(), version: 1 }]);
  } else if (payload["evidenceReferences"] === undefined) {
    payload["evidenceReferences"] = Object.freeze([]);
  }
  for (const key of Object.keys(payload)) {
    if (payload[key] === "") delete payload[key];
  }
  return Object.freeze(payload);
}


function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function writeHtml(response: ServerResponse, body: string): void {
  write(response, 200, "text/html; charset=utf-8", body);
}

function writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
  write(response, statusCode, "application/json; charset=utf-8", JSON.stringify(value));
}

function write(response: ServerResponse, statusCode: number, contentType: string, body: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("content-security-policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.end(body);
}
