import type { PublicationExecutableRequest } from "./publication-executable-contracts.js";
import {
  immutablePublicationHttpValue,
  PublicationHttpAdapterError,
  type PublicationHttpRequest,
} from "./publication-http-contracts.js";
import type { PublicationHttpRouteRegistry } from "./publication-http-route-registry.js";

export class PublicationHttpRequestMapper {
  public constructor(private readonly routes: PublicationHttpRouteRegistry) {}

  public map(request: PublicationHttpRequest): PublicationExecutableRequest {
    const resolution = this.routes.resolve(request.method, request.path);
    if (resolution.kind === "METHOD_NOT_ALLOWED") {
      throw new PublicationHttpAdapterError("METHOD_NOT_ALLOWED", "HTTP method is not allowed.");
    }
    if (resolution.kind === "ROUTE_NOT_FOUND") {
      throw new PublicationHttpAdapterError("ROUTE_NOT_FOUND", "HTTP route was not found.");
    }
    if (!isPlainObject(request.body)) {
      throw new PublicationHttpAdapterError("INVALID_REQUEST_BODY", "HTTP request body is invalid.");
    }
    return immutablePublicationHttpValue({
      executionId: request.requestId,
      request: {
        requestId: request.requestId,
        operation: resolution.route.operation,
        payload: request.body,
        metadata: createMetadata(request),
      },
    }) as unknown as PublicationExecutableRequest;
  }
}

function createMetadata(request: PublicationHttpRequest): Readonly<Record<string, string>> {
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(request.pathParameters)) {
    entries.push([`http.path.${key}`, value]);
  }
  for (const [key, value] of Object.entries(request.query)) {
    entries.push([`http.query.${key}`, typeof value === "string" ? value : JSON.stringify(value)]);
  }
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
