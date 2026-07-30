import { Buffer } from "node:buffer";
import type { IncomingMessage } from "node:http";

import {
  createPublicationHttpRequest,
  type PublicationHttpQueryValue,
  type PublicationHttpRequest,
} from "./publication-http-contracts.js";
import {
  PublicationNodeHttpServerError,
  type PublicationNodeHttpServerRequestIdFactory,
} from "./publication-node-http-contracts.js";

const validRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class PublicationNodeHttpRequestReader {
  public constructor(
    private readonly maximumBodyBytes: number,
    private readonly requestIdFactory: PublicationNodeHttpServerRequestIdFactory,
  ) {}

  public read(request: IncomingMessage): Promise<PublicationHttpRequest> {
    let requestId = "unavailable";
    try {
      requestId = this.resolveRequestId(request.headers["x-request-id"]);
      const method = request.method;
      const requestUrl = request.url;
      if (typeof method !== "string" || typeof requestUrl !== "string") {
        throw invalidRequest(requestId);
      }
      const declaredLength = request.headers["content-length"];
      if (typeof declaredLength === "string") {
        const parsedLength = Number(declaredLength);
        if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) throw invalidRequest(requestId);
        if (parsedLength > this.maximumBodyBytes) {
          request.resume();
          return Promise.reject(bodyTooLarge(requestId));
        }
      }
      return this.collect(request, method, requestUrl, requestId);
    } catch (error) {
      if (error instanceof PublicationNodeHttpServerError) return Promise.reject(error);
      return Promise.reject(invalidRequest(requestId));
    }
  }

  private collect(
    request: IncomingMessage,
    method: string,
    requestUrl: string,
    requestId: string,
  ): Promise<PublicationHttpRequest> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let byteLength = 0;
      let settled = false;

      const cleanup = (): void => {
        request.off("data", onData);
        request.off("end", onEnd);
        request.off("aborted", onAborted);
        request.off("close", onClose);
        request.off("error", onError);
      };
      const fail = (error: PublicationNodeHttpServerError, drain: boolean): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (drain) request.resume();
        reject(error);
      };
      const onData = (chunk: unknown): void => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        byteLength += buffer.byteLength;
        if (byteLength > this.maximumBodyBytes) {
          fail(bodyTooLarge(requestId), true);
          return;
        }
        chunks.push(buffer);
      };
      const onEnd = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          const parsedUrl = new URL(requestUrl, "http://loopback.invalid");
          const bodyText = Buffer.concat(chunks, byteLength).toString("utf8");
          const body: unknown = bodyText.length === 0 ? {} : JSON.parse(bodyText);
          resolve(createPublicationHttpRequest({
            method,
            path: parsedUrl.pathname,
            headers: normaliseHeaders(request.headers),
            query: normaliseQuery(parsedUrl.searchParams),
            pathParameters: {},
            body,
            requestId,
          }));
        } catch {
          reject(invalidRequest(requestId));
        }
      };
      const onAborted = (): void => fail(aborted(requestId), false);
      const onClose = (): void => fail(aborted(requestId), false);
      const onError = (): void => fail(invalidRequest(requestId), false);

      request.on("data", onData);
      request.once("end", onEnd);
      request.once("aborted", onAborted);
      request.once("close", onClose);
      request.once("error", onError);
    });
  }

  private resolveRequestId(header: string | readonly string[] | undefined): string {
    if (typeof header === "string" && validRequestId.test(header)) return header;
    const generated = this.requestIdFactory();
    if (typeof generated !== "string" || !validRequestId.test(generated)) {
      throw invalidRequest("unavailable");
    }
    return generated;
  }
}

function normaliseHeaders(
  headers: IncomingMessage["headers"],
): Readonly<Record<string, string>> {
  const output: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers).sort(([left], [right]) => left.localeCompare(right))) {
    if (value === undefined) continue;
    defineOwn(output, name, Array.isArray(value) ? value.join(", ") : value);
  }
  return output;
}

function normaliseQuery(search: URLSearchParams): Readonly<Record<string, PublicationHttpQueryValue>> {
  const grouped = new Map<string, string[]>();
  for (const [key, value] of search.entries()) {
    const values = grouped.get(key) ?? [];
    values.push(value);
    grouped.set(key, values);
  }
  const output: Record<string, PublicationHttpQueryValue> = {};
  for (const [key, values] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    defineOwn(output, key, values.length === 1 ? values[0]! : values);
  }
  return output;
}

function defineOwn<Value>(output: Record<string, Value>, key: string, value: Value): void {
  Object.defineProperty(output, key, { enumerable: true, configurable: true, writable: true, value });
}

function invalidRequest(requestId: string): PublicationNodeHttpServerError {
  return new PublicationNodeHttpServerError(
    "INVALID_NODE_REQUEST",
    "Node HTTP request is invalid.",
    requestId,
  );
}

function bodyTooLarge(requestId: string): PublicationNodeHttpServerError {
  return new PublicationNodeHttpServerError(
    "REQUEST_BODY_TOO_LARGE",
    "HTTP request body is too large.",
    requestId,
  );
}

function aborted(requestId: string): PublicationNodeHttpServerError {
  return new PublicationNodeHttpServerError(
    "REQUEST_ABORTED",
    "HTTP request was aborted.",
    requestId,
  );
}
