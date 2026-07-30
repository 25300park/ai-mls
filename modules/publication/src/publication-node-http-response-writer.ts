import type { ServerResponse } from "node:http";

import {
  createPublicationHttpResponse,
  type PublicationHttpResponse,
} from "./publication-http-contracts.js";
import {
  immutablePublicationNodeHttpResponseWriteResult,
  type PublicationNodeHttpResponseWriteResult,
  type PublicationNodeHttpServerErrorCode,
} from "./publication-node-http-contracts.js";

const allowedResponseHeaders = new Set(["content-type"]);

export class PublicationNodeHttpResponseWriter {
  public async write(
    response: ServerResponse,
    value: PublicationHttpResponse,
  ): Promise<PublicationNodeHttpResponseWriteResult> {
    if (response.destroyed || response.writableEnded) {
      return immutablePublicationNodeHttpResponseWriteResult(500, false);
    }
    let canonical: PublicationHttpResponse;
    try {
      canonical = createPublicationHttpResponse(value);
    } catch {
      return this.writeFallback(response, safeRequestId(value));
    }
    return new Promise((resolve) => {
      let settled = false;
      const cleanup = (): void => {
        response.off("finish", onFinish);
        response.off("error", onError);
        response.off("close", onClose);
      };
      const complete = (result: PublicationNodeHttpResponseWriteResult): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const onFinish = (): void => {
        complete(immutablePublicationNodeHttpResponseWriteResult(canonical.statusCode, false));
      };
      const onError = (): void => {
        complete(this.writeFallback(response, canonical.requestId));
      };
      const onClose = (): void => {
        complete(immutablePublicationNodeHttpResponseWriteResult(500, false));
      };
      try {
        response.once("finish", onFinish);
        response.once("error", onError);
        response.once("close", onClose);
      } catch {
        complete(this.writeFallback(response, canonical.requestId));
        return;
      }
      try {
      response.statusCode = canonical.statusCode;
      for (const [name, headerValue] of Object.entries(canonical.headers)) {
        if (allowedResponseHeaders.has(name)) response.setHeader(name, headerValue);
      }
      response.setHeader("x-request-id", canonical.requestId);
      response.end(JSON.stringify(canonical.body));
      } catch {
        onError();
      }
    });
  }

  public async writeServerError(
    response: ServerResponse,
    requestId: string,
    code: PublicationNodeHttpServerErrorCode,
  ): Promise<PublicationNodeHttpResponseWriteResult> {
    const policy = serverErrorPolicy(code);
    return this.write(response, createPublicationHttpResponse({
      statusCode: policy.statusCode,
      headers: { "content-type": "application/json" },
      body: { success: false, error: { code, message: policy.message } },
      requestId,
    }));
  }

  private writeFallback(
    response: ServerResponse,
    requestId: string,
  ): PublicationNodeHttpResponseWriteResult {
    try {
      if (response.headersSent || response.writableEnded || response.destroyed) {
        return immutablePublicationNodeHttpResponseWriteResult(500, false);
      }
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.setHeader("x-request-id", requestId);
      response.end(JSON.stringify({
        success: false,
        error: { code: "RESPONSE_WRITE_FAILURE", message: "HTTP response could not be written." },
      }));
    } catch {
      // The socket may already be unusable. No internal exception is rethrown.
    }
    return immutablePublicationNodeHttpResponseWriteResult(500, true);
  }
}

function safeRequestId(value: unknown): string {
  try {
    if (typeof value !== "object" || value === null) return "unavailable";
    const requestId = (value as Readonly<Record<string, unknown>>)["requestId"];
    return typeof requestId === "string" && requestId.trim().length > 0 ? requestId : "unavailable";
  } catch {
    return "unavailable";
  }
}

function serverErrorPolicy(code: PublicationNodeHttpServerErrorCode): Readonly<{
  statusCode: number;
  message: string;
}> {
  switch (code) {
    case "INVALID_NODE_REQUEST": return Object.freeze({ statusCode: 400, message: "Node HTTP request is invalid." });
    case "REQUEST_BODY_TOO_LARGE": return Object.freeze({ statusCode: 413, message: "HTTP request body is too large." });
    case "REQUEST_ABORTED": return Object.freeze({ statusCode: 400, message: "HTTP request was aborted." });
    case "HTTP_ADAPTER_FAILURE": return Object.freeze({ statusCode: 500, message: "HTTP Adapter request failed." });
    case "RESPONSE_WRITE_FAILURE": return Object.freeze({ statusCode: 500, message: "HTTP response could not be written." });
    case "SERVER_NOT_LISTENING": return Object.freeze({ statusCode: 503, message: "Node HTTP server is not listening." });
    case "SERVER_START_FAILURE": return Object.freeze({ statusCode: 500, message: "Node HTTP server could not start." });
    case "SERVER_STOP_FAILURE": return Object.freeze({ statusCode: 500, message: "Node HTTP server could not stop." });
    case "INTERNAL_SERVER_ERROR": return Object.freeze({ statusCode: 500, message: "Node HTTP request could not be processed." });
  }
}
