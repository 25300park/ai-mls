import type { PublicationHttpResponse } from "./publication-http-contracts.js";

export type PublicationNodeHttpServerState =
  | "CREATED"
  | "STARTING"
  | "LISTENING"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export type PublicationNodeHttpServerErrorCode =
  | "INVALID_NODE_REQUEST"
  | "REQUEST_BODY_TOO_LARGE"
  | "REQUEST_ABORTED"
  | "HTTP_ADAPTER_FAILURE"
  | "RESPONSE_WRITE_FAILURE"
  | "SERVER_NOT_LISTENING"
  | "SERVER_START_FAILURE"
  | "SERVER_STOP_FAILURE"
  | "INTERNAL_SERVER_ERROR";

export interface PublicationNodeHttpServerConfiguration {
  readonly host: "127.0.0.1" | "::1" | "localhost";
  readonly port: number;
  readonly maximumBodyBytes: number;
  readonly shutdownTimeout: number;
}

export interface PublicationNodeHttpServerStateSnapshot {
  readonly state: PublicationNodeHttpServerState;
  readonly sequence: number;
}

export interface PublicationNodeHttpServerDiagnostics {
  readonly serverState: PublicationNodeHttpServerState;
  readonly listening: boolean;
  readonly boundHost: string | null;
  readonly boundPort: number | null;
  readonly requestCount: number;
  readonly activeRequestCount: number;
  readonly successfulRequestCount: number;
  readonly failedRequestCount: number;
  readonly lastRequestStatus: number | null;
}

export interface PublicationNodeHttpResponseWriteResult {
  readonly statusCode: number;
  readonly fallbackUsed: boolean;
}

export interface PublicationHttpRequestHandler {
  handle(input: unknown): Promise<PublicationHttpResponse>;
}

export type PublicationNodeHttpServerRequestIdFactory = () => string;

export class PublicationNodeHttpServerError extends Error {
  public constructor(
    public readonly code: PublicationNodeHttpServerErrorCode,
    message: string,
    public readonly requestId = "unavailable",
  ) {
    super(message);
    this.name = "PublicationNodeHttpServerError";
  }
}

export function immutablePublicationNodeHttpServerStateSnapshot(
  state: PublicationNodeHttpServerState,
  sequence: number,
): PublicationNodeHttpServerStateSnapshot {
  return Object.freeze({ state, sequence });
}

export function immutablePublicationNodeHttpServerDiagnostics(
  value: PublicationNodeHttpServerDiagnostics,
): PublicationNodeHttpServerDiagnostics {
  return Object.freeze({ ...value });
}

export function immutablePublicationNodeHttpResponseWriteResult(
  statusCode: number,
  fallbackUsed: boolean,
): PublicationNodeHttpResponseWriteResult {
  return Object.freeze({ statusCode, fallbackUsed });
}
