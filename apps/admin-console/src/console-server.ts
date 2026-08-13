import { createServer, type Server, type ServerResponse } from "node:http";

import {
  CONSOLE_PAGES,
  type ConsolePage,
  type ConsoleReadAdapter,
  type ConsoleReadRequest,
} from "./console-read-adapter.js";
import { renderConsoleResult, renderConsoleShell } from "./console-renderer.js";

interface AdminConsoleServerConfiguration {
  readonly host: string;
  readonly port: number;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly readAdapter: Pick<ConsoleReadAdapter, "read">;
}

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
  "/system/projection": "PROJECTION",
  "/system/operations": "OPERATIONS",
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
        if (method !== "GET") {
          request.resume();
          writeJson(response, 405, { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "The Console exposes read-only GET routes." } });
          return;
        }
        if (rawUrl.length > 2_048) {
          writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
          return;
        }
        let url: URL;
        try { url = new URL(rawUrl, `http://${configuration.host}`); } catch {
          writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
          return;
        }
        if (url.pathname === "/api/console/view") {
          const page = parsePage(url.searchParams.get("page"));
          if (page === undefined) {
            writeJson(response, 400, { success: false, error: { code: "INVALID_CONSOLE_REQUEST", message: "The Console request is invalid." } });
            return;
          }
          const publicationId = safePublicationId(url.searchParams.get("publicationId"));
          const readRequest: ConsoleReadRequest = {
            page,
            sessionId: configuration.sessionId,
            tenantId: configuration.tenantId,
            teamId: configuration.tenantId,
            ...(publicationId === undefined ? {} : { publicationId }),
            correlationId: `console-read-${String(requestSequence)}`,
          };
          const result = configuration.readAdapter.read(readRequest);
          writeJson(response, 200, { html: renderConsoleResult(result) });
          return;
        }
        const page = browserRoutes[url.pathname];
        if (page === undefined) {
          writeJson(response, 404, { success: false, error: { code: "ROUTE_NOT_FOUND", message: "The Console route was not found." } });
          return;
        }
        const publicationId = safePublicationId(url.searchParams.get("publicationId"));
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

function safePublicationId(value: string | null): string | undefined {
  if (value === null || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(value)) return undefined;
  return value;
}

function validateConfiguration(configuration: AdminConsoleServerConfiguration): void {
  if (configuration.host !== "127.0.0.1" || !Number.isSafeInteger(configuration.port) || configuration.port < 0 || configuration.port > 65_535) {
    throw new Error("CONSOLE_SERVER_CONFIGURATION_INVALID");
  }
  if (safePublicationId(configuration.sessionId) === undefined || safePublicationId(configuration.tenantId) === undefined) {
    throw new Error("CONSOLE_SERVER_CONFIGURATION_INVALID");
  }
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
