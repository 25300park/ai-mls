export type PublicationHttpScalar = null | boolean | number | string;
export type PublicationHttpJsonValue =
  | PublicationHttpScalar
  | readonly PublicationHttpJsonValue[]
  | { readonly [key: string]: PublicationHttpJsonValue };

export type PublicationHttpQueryValue = string | readonly string[];

export interface PublicationHttpRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, PublicationHttpQueryValue>>;
  readonly pathParameters: Readonly<Record<string, string>>;
  readonly body: PublicationHttpJsonValue;
  readonly requestId: string;
}

export interface PublicationHttpResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: PublicationHttpJsonValue;
  readonly requestId: string;
}

export type PublicationHttpAdapterErrorCode =
  | "INVALID_HTTP_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "ROUTE_NOT_FOUND"
  | "INVALID_REQUEST_BODY"
  | "EXECUTABLE_UNAVAILABLE"
  | "REQUEST_EXECUTION_FAILED"
  | "INTERNAL_HTTP_ADAPTER_ERROR";

export class PublicationHttpAdapterError extends Error {
  public constructor(
    public readonly code: PublicationHttpAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationHttpAdapterError";
  }
}

export function createPublicationHttpRequest(value: unknown): PublicationHttpRequest {
  try {
    if (!isPlainRecord(value)) throw invalidRequest();
    const method = normalisePublicationHttpMethod(value["method"]);
    const path = normalisePublicationHttpPath(value["path"]);
    const headers = normaliseStringRecord(value["headers"], true);
    const query = normaliseQuery(value["query"]);
    const pathParameters = normaliseStringRecord(value["pathParameters"], false);
    const requestId = requiredString(value["requestId"]);
    const body = immutablePublicationHttpValue(value["body"]);
    return Object.freeze({ method, path, headers, query, pathParameters, body, requestId });
  } catch {
    throw invalidRequest();
  }
}

export function createPublicationHttpResponse(value: unknown): PublicationHttpResponse {
  try {
    if (!isPlainRecord(value)) throw internalError();
    const statusCode = value["statusCode"];
    if (!Number.isInteger(statusCode) || (statusCode as number) < 100 || (statusCode as number) > 599) {
      throw internalError();
    }
    const headers = normaliseStringRecord(value["headers"], true);
    const requestId = requiredString(value["requestId"]);
    const body = immutablePublicationHttpValue(value["body"]);
    return Object.freeze({ statusCode: statusCode as number, headers, body, requestId });
  } catch (error) {
    if (error instanceof PublicationHttpAdapterError) throw error;
    throw internalError();
  }
}

export function immutablePublicationHttpValue(value: unknown): PublicationHttpJsonValue {
  return copyHttpValue(value, new Set<object>());
}

export function normalisePublicationHttpMethod(value: unknown): string {
  if (typeof value !== "string") throw invalidRequest();
  const method = value.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(method)) throw invalidRequest();
  return method;
}

export function normalisePublicationHttpPath(value: unknown): string {
  if (typeof value !== "string") throw invalidRequest();
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("?") || trimmed.includes("#") || trimmed.includes("//")) {
    throw invalidRequest();
  }
  return trimmed.length > 1 && trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normaliseStringRecord(
  value: unknown,
  lowerCaseKeys: boolean,
): Readonly<Record<string, string>> {
  if (!isPlainRecord(value)) throw invalidRequest();
  const output: Record<string, string> = {};
  const entries = Object.entries(value)
    .map(([key, item]) => [lowerCaseKeys ? key.trim().toLowerCase() : key.trim(), item] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  for (const [key, item] of entries) {
    if (key.length === 0 || (lowerCaseKeys && !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(key))
      || typeof item !== "string" || Object.hasOwn(output, key)) {
      throw invalidRequest();
    }
    defineOwnValue(output, key, item);
  }
  return Object.freeze(output);
}

function normaliseQuery(value: unknown): Readonly<Record<string, PublicationHttpQueryValue>> {
  if (!isPlainRecord(value)) throw invalidRequest();
  const output: Record<string, PublicationHttpQueryValue> = {};
  for (const [rawKey, item] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    const key = rawKey.trim();
    if (key.length === 0 || Object.hasOwn(output, key)) throw invalidRequest();
    if (typeof item === "string") {
      defineOwnValue(output, key, item);
      continue;
    }
    if (!Array.isArray(item) || Object.keys(item).length !== item.length
      || !item.every((entry) => typeof entry === "string")) {
      throw invalidRequest();
    }
    defineOwnValue(output, key, Object.freeze([...item]));
  }
  return Object.freeze(output);
}

function copyHttpValue(value: unknown, ancestors: Set<object>): PublicationHttpJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || ancestors.has(value)) throw invalidRequest();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) throw invalidRequest();
      return Object.freeze(value.map((item) => copyHttpValue(item, ancestors)));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) throw invalidRequest();
    const output: Record<string, PublicationHttpJsonValue> = {};
    for (const [key, item] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
      defineOwnValue(output, key, copyHttpValue(item, ancestors));
    }
    return Object.freeze(output);
  } finally {
    ancestors.delete(value);
  }
}

function defineOwnValue<Value>(output: Record<string, Value>, key: string, value: Value): void {
  Object.defineProperty(output, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value,
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw invalidRequest();
  return value;
}

function invalidRequest(): PublicationHttpAdapterError {
  return new PublicationHttpAdapterError("INVALID_HTTP_REQUEST", "HTTP request is invalid.");
}

function internalError(): PublicationHttpAdapterError {
  return new PublicationHttpAdapterError(
    "INTERNAL_HTTP_ADAPTER_ERROR",
    "HTTP response is invalid.",
  );
}
