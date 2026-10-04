import { createServer, type RequestListener, type Server } from "node:http";

import { createPublicationHttpResponse, type PublicationHttpRequest, type PublicationHttpResponse } from "../../../modules/publication/src/publication-http-contracts.js";
import { PublicationNodeHttpRequestReader } from "../../../modules/publication/src/publication-node-http-request-reader.js";
import { PublicationNodeHttpResponseWriter } from "../../../modules/publication/src/publication-node-http-response-writer.js";
import { PublicationNodeHttpServerError, type PublicationHttpRequestHandler } from "../../../modules/publication/src/publication-node-http-contracts.js";
import type { ProductionBootstrapDependencies, ProductionChildRoot } from "./production-bootstrap.js";
import type { RailwayProductionRuntimeConfiguration } from "./production-runtime-configuration.js";
import { ProductionCleanupBudget, ProductionRuntimeActivationError } from "./production-runtime-activation.js";

export interface ProductionReadinessState {
  readiness(): "READY" | "NOT_READY";
  markReady(): void;
  markNotReady(): void;
}

export interface ProductionRuntimeHttpListener {
  readonly port: number;
  start(): Promise<void>;
  close(): Promise<void>;
  stopAccepting?(): void;
}

export type ProductionRuntimeHttpListenerFactory = (options: Readonly<{
  port: number;
  readiness: ProductionReadinessState;
  roots: readonly ProductionChildRoot[];
}>) => ProductionRuntimeHttpListener;

export function createProductionReadinessState(): ProductionReadinessState {
  let state: "READY" | "NOT_READY" = "NOT_READY";
  return Object.freeze({
    readiness: () => state,
    markReady: () => { state = "READY"; },
    markNotReady: () => { state = "NOT_READY"; },
  });
}

export function createProductionRuntimeHttpListener(options: Readonly<{
  port: number;
  readiness: ProductionReadinessState;
  roots: readonly ProductionChildRoot[];
  shutdownTimeoutMilliseconds?: number;
  serverFactory?: (listener: RequestListener) => Server;
}>): ProductionRuntimeHttpListener {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) throw new Error("Production listener is unavailable.");
  const shutdownTimeoutMilliseconds = options.shutdownTimeoutMilliseconds ?? 30_000;
  if (!Number.isInteger(shutdownTimeoutMilliseconds) || shutdownTimeoutMilliseconds < 1 || shutdownTimeoutMilliseconds > 30_000) {
    throw new Error("Production listener is unavailable.");
  }
  const applicationHandler = composeApplicationHandler(options.roots);
  const requestReader = new PublicationNodeHttpRequestReader(1_048_576, () => globalThis.crypto.randomUUID());
  const responseWriter = new PublicationNodeHttpResponseWriter();
  const server = (options.serverFactory ?? createServer)((request, response) => {
    if (request.url === "/readyz" || request.url === "/livez") {
      response.setHeader("content-type", "application/json");
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.statusCode = 405;
        response.end(request.method === "HEAD" ? undefined : '{"status":"NOT_READY"}');
        return;
      }
      const live = request.url === "/livez";
      const ready = live || options.readiness.readiness() === "READY";
      response.statusCode = ready ? 200 : 503;
      response.end(request.method === "HEAD" ? undefined : live ? '{"status":"LIVE"}' : ready ? '{"status":"READY"}' : '{"status":"NOT_READY"}');
      return;
    }
    if (isApplicationRoute(request.url)) {
      if (options.readiness.readiness() !== "READY") {
        response.statusCode = 503;
        response.setHeader("content-type", "application/json");
        response.end('{"status":"NOT_READY"}');
        return;
      }
      void handleApplicationRequest(requestReader, responseWriter, applicationHandler, request, response);
      return;
    }
    request.resume();
    void responseWriter.write(response, notFound(globalThis.crypto.randomUUID()));
  });
  let boundPort = -1;
  let started = false;
  let closed = false;
  let starting: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  const stopAccepting = (): void => {
    options.readiness.markNotReady();
    closed = true;
    closing ??= started ? close(server, shutdownTimeoutMilliseconds) : (async (): Promise<void> => {
      try { await starting; } catch { /* failed bind owns no listening socket */ }
      if (server.listening) await close(server, shutdownTimeoutMilliseconds);
    })();
    void closing.catch(() => undefined); // close() reports the same failure after all activation cleanup.
  };
  return Object.freeze({
    get port(): number {
      if (!started || boundPort < 0) throw new Error("Production listener is unavailable.");
      return boundPort;
    },
    start: (): Promise<void> => {
      if (starting !== undefined || closed) return Promise.reject(new Error("Production listener is unavailable."));
      starting = (async (): Promise<void> => {
        await listen(server, options.port);
        const address = server.address();
        if (address === null || typeof address === "string") throw new Error("Production listener is unavailable.");
        boundPort = address.port;
        started = true;
      })();
      return starting;
    },
    stopAccepting,
    close: async (): Promise<void> => {
      stopAccepting();
      await closing;
    },
  });
}

export function createProductionRuntimeListenerStarter(
  configuration: RailwayProductionRuntimeConfiguration,
  readiness: ProductionReadinessState,
  listenerFactory: ProductionRuntimeHttpListenerFactory = createProductionRuntimeHttpListener,
  cleanupTimeoutMilliseconds = 25_000,
): ProductionBootstrapDependencies["startListeners"] {
  return async (_context, roots) => {
    assertProductionHttpRoots(roots);
    const listener = listenerFactory({
      port: configuration.port,
      readiness,
      roots,
    });
    try { await listener.start(); } catch {
      try { await new ProductionCleanupBudget(cleanupTimeoutMilliseconds).run(() => listener.close()); } catch {
        throw new ProductionRuntimeActivationError("ACTIVATION_CLEANUP_FAILED");
      }
      throw new Error("Production listener is unavailable.");
    }
    return Object.freeze({
      stopAccepting: () => listener.stopAccepting === undefined ? listener.close() : listener.stopAccepting(),
      close: () => listener.close(),
    });
  };
}

const API_014_ROUTES = new Set(["/api/publication/commands", "/api/publication/queries"]);
const API_015_ROUTES = new Set(["/administration/commands", "/administration/queries"]);

function composeApplicationHandler(roots: readonly ProductionChildRoot[]): PublicationHttpRequestHandler {
  assertProductionHttpRoots(roots);
  const byId = new Map(roots.map((root) => [root.componentId, root]));
  const api014 = byId.get("API-014")!.httpHandler!;
  const api015 = byId.get("API-015")!.httpHandler!;
  return Object.freeze({
    handle: (input: unknown) => {
      const request = input as PublicationHttpRequest;
      if (API_014_ROUTES.has(request.path)) return api014.handle(request);
      if (API_015_ROUTES.has(request.path)) return api015.handle(request);
      return Promise.resolve(notFound(request.requestId));
    },
  });
}

function assertProductionHttpRoots(roots: readonly ProductionChildRoot[]): void {
  const expected = ["API-014", "API-015", "API-018", "API-019", "FEAT-022"] as const;
  if (roots.length !== expected.length) throw new Error("Production listener composition is unavailable.");
  const byId = new Map(roots.map((root) => [root.componentId, root]));
  if (byId.size !== expected.length || expected.some((componentId) => !byId.has(componentId))) {
    throw new Error("Production listener composition is unavailable.");
  }
  if (roots.some((root) => "listener" in root)
    || byId.get("API-014")?.httpHandler === undefined
    || byId.get("API-015")?.httpHandler === undefined
    || expected.slice(2).some((componentId) => byId.get(componentId)?.httpHandler !== undefined)) {
    throw new Error("Production listener composition is unavailable.");
  }
}

function isApplicationRoute(rawUrl: string | undefined): boolean {
  if (typeof rawUrl !== "string") return false;
  try {
    const path = new URL(rawUrl, "http://production.invalid").pathname;
    return API_014_ROUTES.has(path) || API_015_ROUTES.has(path);
  } catch {
    return false;
  }
}

async function handleApplicationRequest(
  requestReader: PublicationNodeHttpRequestReader,
  responseWriter: PublicationNodeHttpResponseWriter,
  handler: PublicationHttpRequestHandler,
  request: Parameters<RequestListener>[0],
  response: Parameters<RequestListener>[1],
): Promise<void> {
  let requestId = "unavailable";
  try {
    const parsed = await requestReader.read(request);
    requestId = parsed.requestId;
    await responseWriter.write(response, await handler.handle(parsed));
  } catch (error) {
    const code = error instanceof PublicationNodeHttpServerError ? error.code : "INTERNAL_SERVER_ERROR";
    if (error instanceof PublicationNodeHttpServerError) requestId = error.requestId;
    await responseWriter.writeServerError(response, requestId, code);
  }
}

function notFound(requestId: string): PublicationHttpResponse {
  return createPublicationHttpResponse({
    statusCode: 404,
    headers: { "content-type": "application/json" },
    body: { success: false, error: { code: "ROUTE_NOT_FOUND", message: "Resource not found." } },
    requestId,
  });
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (): void => { server.off("listening", onListening); reject(new Error("Production listener is unavailable.")); };
    const onListening = (): void => { server.off("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });
}

function close(server: Server, timeoutMilliseconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.closeAllConnections();
      reject(new Error("Production listener is unavailable."));
    }, timeoutMilliseconds);
    timer.unref();
    server.close((error) => {
      clearTimeout(timer);
      if (error === undefined) resolve();
      else reject(new Error("Production listener is unavailable."));
    });
    server.closeIdleConnections();
  });
}
