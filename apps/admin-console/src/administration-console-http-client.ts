import { createPublicationHttpRequest, createPublicationHttpResponse } from "../../../modules/publication/src/publication-http-contracts.js";
import type { PublicationHttpResponse } from "../../../modules/publication/src/publication-http-contracts.js";
import type { AdministrationHttpRequestHandler } from "../../api/src/administration-http-adapter.js";

const MAX_RESPONSE_CHARACTERS = 1_000_000;

export class AdministrationConsoleHttpClient implements AdministrationHttpRequestHandler {
  private readonly origin: string;

  public constructor(origin: string) {
    this.origin = normalizeAdministrationApiOrigin(origin);
  }

  public async handle(input: unknown): Promise<PublicationHttpResponse> {
    const request = createPublicationHttpRequest(input);
    if (request.method !== "GET" || request.path !== "/administration/queries"
      || request.body !== null || Object.keys(request.pathParameters).length !== 0) {
      throw new Error("CONSOLE_ADMINISTRATION_READ_ONLY");
    }
    const sessionId = request.headers["x-session-id"];
    if (sessionId === undefined || sessionId.trim().length === 0) throw new Error("AUTHENTICATION_REQUIRED");
    const url = new URL(request.path, this.origin);
    for (const [key, value] of Object.entries(request.query).sort(([left], [right]) => left.localeCompare(right))) {
      for (const item of typeof value === "string" ? [value] : value) url.searchParams.append(key, item);
    }
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", "x-request-id": request.requestId, "x-session-id": sessionId },
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) throw new Error("CONSOLE_ADMINISTRATION_RESPONSE_INVALID");
    const text = await response.text();
    if (text.length > MAX_RESPONSE_CHARACTERS) throw new Error("CONSOLE_ADMINISTRATION_RESPONSE_INVALID");
    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new Error("CONSOLE_ADMINISTRATION_RESPONSE_INVALID");
    }
    return createPublicationHttpResponse({
      statusCode: response.status,
      headers: { "content-type": contentType },
      body,
      requestId: request.requestId,
    });
  }
}

export function normalizeAdministrationApiOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("CONSOLE_CONFIGURATION_INVALID");
  }
  const port = Number(parsed.port);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)
    || parsed.username.length !== 0 || parsed.password.length !== 0 || parsed.pathname !== "/"
    || parsed.search.length !== 0 || parsed.hash.length !== 0 || parsed.port.length === 0
    || !Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("CONSOLE_CONFIGURATION_INVALID");
  }
  return parsed.origin;
}
