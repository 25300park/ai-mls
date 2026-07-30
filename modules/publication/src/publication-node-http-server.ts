import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerResponse,
} from "node:http";

import { createPublicationHttpResponse } from "./publication-http-contracts.js";
import {
  createPublicationNodeHttpServerConfiguration,
} from "./publication-node-http-configuration.js";
import {
  immutablePublicationNodeHttpServerDiagnostics,
  PublicationNodeHttpServerError,
  type PublicationHttpRequestHandler,
  type PublicationNodeHttpServerConfiguration,
  type PublicationNodeHttpServerDiagnostics,
  type PublicationNodeHttpServerRequestIdFactory,
  type PublicationNodeHttpServerStateSnapshot,
} from "./publication-node-http-contracts.js";
import { PublicationNodeHttpLifecycleController } from "./publication-node-http-lifecycle.js";
import { PublicationNodeHttpRequestReader } from "./publication-node-http-request-reader.js";
import { PublicationNodeHttpResponseWriter } from "./publication-node-http-response-writer.js";

export type PublicationNodeHttpServerFactory = (listener: RequestListener) => Server;

export interface PublicationNodeHttpServerOptions {
  readonly configuration?: unknown;
  readonly httpAdapter: PublicationHttpRequestHandler;
  readonly requestIdFactory?: PublicationNodeHttpServerRequestIdFactory;
  readonly serverFactory?: PublicationNodeHttpServerFactory;
  readonly responseWriter?: PublicationNodeHttpResponseWriter;
}

export class PublicationNodeHttpServer {
  public readonly configuration: PublicationNodeHttpServerConfiguration;
  private readonly lifecycle = new PublicationNodeHttpLifecycleController();
  private readonly requestReader: PublicationNodeHttpRequestReader;
  private readonly responseWriter: PublicationNodeHttpResponseWriter;
  private readonly serverFactory: PublicationNodeHttpServerFactory;
  private server: Server | undefined;
  private startPromise: Promise<PublicationNodeHttpServerStateSnapshot> | undefined;
  private stopPromise: Promise<PublicationNodeHttpServerStateSnapshot> | undefined;
  private listeningSnapshot: PublicationNodeHttpServerStateSnapshot | undefined;
  private stoppedSnapshot: PublicationNodeHttpServerStateSnapshot | undefined;
  private boundHost: string | null = null;
  private boundPort: number | null = null;
  private requestCount = 0;
  private activeRequestCount = 0;
  private successfulRequestCount = 0;
  private failedRequestCount = 0;
  private lastRequestStatus: number | null = null;
  private readonly activeRequestAborters = new Set<() => void>();

  public constructor(
    configuration: unknown,
    private readonly httpAdapter: PublicationHttpRequestHandler,
    requestIdFactory: PublicationNodeHttpServerRequestIdFactory,
    serverFactory: PublicationNodeHttpServerFactory = createServer,
    responseWriter: PublicationNodeHttpResponseWriter = new PublicationNodeHttpResponseWriter(),
  ) {
    this.configuration = createPublicationNodeHttpServerConfiguration(configuration);
    this.requestReader = new PublicationNodeHttpRequestReader(
      this.configuration.maximumBodyBytes,
      requestIdFactory,
    );
    this.serverFactory = serverFactory;
    this.responseWriter = responseWriter;
  }

  public get status(): PublicationNodeHttpServerStateSnapshot {
    return this.lifecycle.snapshot;
  }

  public get diagnostics(): PublicationNodeHttpServerDiagnostics {
    return immutablePublicationNodeHttpServerDiagnostics({
      serverState: this.lifecycle.snapshot.state,
      listening: this.lifecycle.snapshot.state === "LISTENING" && this.server?.listening === true,
      boundHost: this.boundHost,
      boundPort: this.boundPort,
      requestCount: this.requestCount,
      activeRequestCount: this.activeRequestCount,
      successfulRequestCount: this.successfulRequestCount,
      failedRequestCount: this.failedRequestCount,
      lastRequestStatus: this.lastRequestStatus,
    });
  }

  public start(): Promise<PublicationNodeHttpServerStateSnapshot> {
    if (this.lifecycle.snapshot.state === "LISTENING" && this.listeningSnapshot !== undefined) {
      return Promise.resolve(this.listeningSnapshot);
    }
    if (this.lifecycle.snapshot.state === "STARTING" && this.startPromise !== undefined) {
      return this.startPromise;
    }
    if (this.lifecycle.snapshot.state !== "CREATED") {
      return Promise.reject(new PublicationNodeHttpServerError(
        "SERVER_NOT_LISTENING",
        "Node HTTP server cannot start.",
      ));
    }
    this.startPromise = this.startInternal();
    return this.startPromise;
  }

  private async startInternal(): Promise<PublicationNodeHttpServerStateSnapshot> {
    this.lifecycle.transition("STARTING");
    try {
      const server = this.serverFactory((request, response) => {
        void this.handleRequest(request, response);
      });
      this.server = server;
      await listen(server, this.configuration.port, this.configuration.host);
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("Invalid listener address.");
      this.boundHost = this.configuration.host;
      this.boundPort = address.port;
      this.listeningSnapshot = this.lifecycle.transition("LISTENING");
      return this.listeningSnapshot;
    } catch {
      this.lifecycle.transition("FAILED");
      this.server = undefined;
      this.boundHost = null;
      this.boundPort = null;
      throw new PublicationNodeHttpServerError(
        "SERVER_START_FAILURE",
        "Node HTTP server could not start.",
      );
    }
  }

  public stop(): Promise<PublicationNodeHttpServerStateSnapshot> {
    if (this.lifecycle.snapshot.state === "STOPPED" && this.stoppedSnapshot !== undefined) {
      return Promise.resolve(this.stoppedSnapshot);
    }
    if (this.lifecycle.snapshot.state === "STOPPING" && this.stopPromise !== undefined) {
      return this.stopPromise;
    }
    if (this.lifecycle.snapshot.state !== "LISTENING" || this.server === undefined) {
      return Promise.reject(new PublicationNodeHttpServerError(
        "SERVER_NOT_LISTENING",
        "Node HTTP server is not listening.",
      ));
    }
    this.stopPromise = this.stopInternal();
    return this.stopPromise;
  }

  private async stopInternal(): Promise<PublicationNodeHttpServerStateSnapshot> {
    this.lifecycle.transition("STOPPING");
    try {
      await closeGracefully(
        this.server!,
        this.configuration.shutdownTimeout,
        (): void => this.abortActiveRequests(),
      );
      this.stoppedSnapshot = this.lifecycle.transition("STOPPED");
      return this.stoppedSnapshot;
    } catch {
      this.lifecycle.transition("FAILED");
      throw new PublicationNodeHttpServerError(
        "SERVER_STOP_FAILURE",
        "Node HTTP server could not stop.",
      );
    }
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.requestCount += 1;
    this.activeRequestCount += 1;
    let requestId = "unavailable";
    let abortRequest!: () => void;
    const shutdown = new Promise<never>((_resolve, reject) => {
      abortRequest = (): void => {
        reject(new PublicationNodeHttpServerError(
          "REQUEST_ABORTED",
          "HTTP request was aborted.",
          requestId,
        ));
      };
    });
    this.activeRequestAborters.add(abortRequest);
    try {
      const httpRequest = await Promise.race([this.requestReader.read(request), shutdown]);
      requestId = httpRequest.requestId;
      let adapterResponse;
      try {
        const handled = await Promise.race([
          waitForAdapterOrResponseClose(
            this.httpAdapter.handle(httpRequest),
            request,
            response,
            requestId,
          ),
          shutdown,
        ]);
        adapterResponse = createPublicationHttpResponse(handled);
      } catch (error) {
        if (error instanceof PublicationNodeHttpServerError
          && error.code === "REQUEST_ABORTED") {
          throw error;
        }
        adapterResponse = createPublicationHttpResponse({
          statusCode: 500,
          headers: { "content-type": "application/json" },
          body: {
            success: false,
            error: { code: "HTTP_ADAPTER_FAILURE", message: "HTTP Adapter request failed." },
          },
          requestId,
        });
      }
      const result = await this.responseWriter.write(response, adapterResponse);
      this.recordResult(result.statusCode);
    } catch (error) {
      const safeError = error instanceof PublicationNodeHttpServerError
        ? error
        : new PublicationNodeHttpServerError(
          "INTERNAL_SERVER_ERROR",
          "Node HTTP request could not be processed.",
          requestId,
        );
      requestId = safeError.requestId;
      if (safeError.code === "REQUEST_ABORTED") {
        this.failedRequestCount += 1;
        this.lastRequestStatus = null;
      } else {
        const result = await this.responseWriter.writeServerError(response, requestId, safeError.code);
        this.recordResult(result.statusCode);
      }
    } finally {
      this.activeRequestAborters.delete(abortRequest);
      this.activeRequestCount -= 1;
    }
  }

  private abortActiveRequests(): void {
    for (const abortRequest of [...this.activeRequestAborters]) abortRequest();
  }

  private recordResult(statusCode: number): void {
    this.lastRequestStatus = statusCode;
    if (statusCode >= 200 && statusCode < 400) this.successfulRequestCount += 1;
    else this.failedRequestCount += 1;
  }
}

export function createPublicationNodeHttpServer(
  options: PublicationNodeHttpServerOptions,
): PublicationNodeHttpServer {
  const requestIdFactory = options.requestIdFactory ?? createLocalRequestIdFactory();
  return new PublicationNodeHttpServer(
    options.configuration,
    options.httpAdapter,
    requestIdFactory,
    options.serverFactory,
    options.responseWriter,
  );
}

function createLocalRequestIdFactory(): PublicationNodeHttpServerRequestIdFactory {
  return () => globalThis.crypto.randomUUID();
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (): void => {
      server.off("listening", onListening);
      reject(new Error("Listener startup failed."));
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    try {
      server.listen(port, host);
    } catch (error) {
      server.off("error", onError);
      server.off("listening", onListening);
      reject(error instanceof Error ? error : new Error("Listener startup failed."));
    }
  });
}

function waitForAdapterOrResponseClose<Value>(
  adapterResult: Promise<Value>,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<Value> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      response.off("close", onClose);
      request.socket.off("close", onClose);
    };
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onClose = (): void => finish(() => reject(new PublicationNodeHttpServerError(
      "REQUEST_ABORTED",
      "HTTP request was aborted.",
      requestId,
    )));
    response.once("close", onClose);
    request.socket.once("close", onClose);
    void adapterResult.then(
      (value) => finish(() => resolve(value)),
      () => finish(() => reject(new PublicationNodeHttpServerError(
        "HTTP_ADAPTER_FAILURE",
        "HTTP Adapter request failed.",
        requestId,
      ))),
    );
  });
}

function closeGracefully(
  server: Server,
  shutdownTimeout: number,
  abortActiveRequests: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      abortActiveRequests();
      if (error === undefined) resolve();
      else reject(error);
    };
    const timer = setTimeout(() => {
      abortActiveRequests();
      server.closeAllConnections();
      finish();
    }, shutdownTimeout);
    timer.unref();
    server.close((error) => finish(error));
    server.closeIdleConnections();
  });
}
