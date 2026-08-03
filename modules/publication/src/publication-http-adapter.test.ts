import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createPublicationInProcessExecutable } from "./publication-executable-bootstrap.js";
import { createPublicationApplicationHost } from "./publication-host-bootstrap.js";
import { FixedClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import {
  createPublicationHttpRequest,
  createPublicationHttpResponse,
  PublicationHttpAdapterError,
  type PublicationHttpRequest,
} from "./publication-http-contracts.js";
import { PublicationHttpErrorMapper } from "./publication-http-error-mapper.js";
import {
  type PublicationExecutableInvoker,
} from "./publication-http-executable-invocation-adapter.js";
import { PublicationHttpRequestMapper } from "./publication-http-request-mapper.js";
import { PublicationHttpResponseMapper } from "./publication-http-response-mapper.js";
import {
  createDefaultPublicationHttpRouteRegistry,
  PublicationHttpRouteRegistry,
} from "./publication-http-route-registry.js";
import { createInProcessPublicationHttpAdapter } from "./publication-in-process-http-adapter.js";
import type { PublicationExecutableResult } from "./publication-executable-contracts.js";

const timestamp = "2026-07-29T04:00:00.000Z";

test("PHASE13-13 creates a canonical serialisable HTTP request model", () => {
  const request = createPublicationHttpRequest({
    method: "post",
    path: "/publications/commands/create/",
    headers: { "X-Trace": "trace-1" },
    query: { view: "full" },
    pathParameters: {},
    body: { value: 1 },
    requestId: "http-request-1",
  });

  assert.deepEqual(request, {
    method: "POST",
    path: "/publications/commands/create",
    headers: { "x-trace": "trace-1" },
    query: { view: "full" },
    pathParameters: {},
    body: { value: 1 },
    requestId: "http-request-1",
  });
  assert.doesNotThrow(() => JSON.stringify(request));
});

test("PHASE13-13 creates a canonical serialisable HTTP response model", () => {
  const response = createPublicationHttpResponse({
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: { success: true },
    requestId: "http-response-1",
  });

  assert.deepEqual(response, {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { success: true },
    requestId: "http-response-1",
  });
});

test("PHASE13-13 request models isolate and freeze caller-owned values", () => {
  const input = validHttpRequest("request-immutable") as MutableHttpRequest;
  const request = createPublicationHttpRequest(input);
  input.body.context.actorId = "mutated";

  assert.equal((request.body as { context: { actorId: string } }).context.actorId, "actor-http");
  assert.equal(isDeeplyFrozen(request), true);
  assert.throws(() => {
    (request.headers as Record<string, string>)["x-new"] = "value";
  }, TypeError);
});

test("PHASE13-13 response models isolate and freeze nested values", () => {
  const body = { nested: { value: "safe" } };
  const response = createPublicationHttpResponse({
    statusCode: 422,
    headers: { "content-type": "application/json" },
    body,
    requestId: "response-immutable",
  });
  body.nested.value = "mutated";

  assert.deepEqual(response.body, { nested: { value: "safe" } });
  assert.equal(isDeeplyFrozen(response), true);
});

test("PHASE13-13 normalises header names case-insensitively and rejects ambiguity", () => {
  const request = createPublicationHttpRequest({
    ...validHttpRequest("headers-normalised"),
    headers: { "X-Request-Mode": "safe", Accept: "application/json" },
  });
  assert.deepEqual(request.headers, {
    accept: "application/json",
    "x-request-mode": "safe",
  });

  assert.throws(
    () => createPublicationHttpRequest({
      ...validHttpRequest("headers-duplicate"),
      headers: { "X-Mode": "a", "x-mode": "b" },
    }),
    (error: unknown) => error instanceof PublicationHttpAdapterError
      && error.code === "INVALID_HTTP_REQUEST",
  );
});

test("PHASE13-13 rejects malformed HTTP header names", () => {
  assert.throws(
    () => createPublicationHttpRequest({
      ...validHttpRequest("headers-malformed"),
      headers: { "bad header": "value" },
    }),
    (error: unknown) => error instanceof PublicationHttpAdapterError
      && error.code === "INVALID_HTTP_REQUEST",
  );
});

test("PHASE13-13 preserves own __proto__ JSON and dictionary keys without prototype mutation", () => {
  const request = createPublicationHttpRequest({
    ...validHttpRequest("proto-keys"),
    headers: ownProtoValue("header-value"),
    query: ownProtoValue("query-value"),
    pathParameters: ownProtoValue("path-value"),
    body: ownProtoValue({ safe: true }),
  });

  assert.equal(Object.getPrototypeOf(request.headers), Object.prototype);
  assert.equal(Object.getPrototypeOf(request.query), Object.prototype);
  assert.equal(Object.getPrototypeOf(request.pathParameters), Object.prototype);
  assert.equal(Object.getPrototypeOf(request.body), Object.prototype);
  assert.equal(Object.hasOwn(request.headers, "__proto__"), true);
  assert.equal(Object.hasOwn(request.query, "__proto__"), true);
  assert.equal(Object.hasOwn(request.pathParameters, "__proto__"), true);
  assert.equal(Object.hasOwn(request.body as object, "__proto__"), true);
  assert.equal(JSON.stringify(request.body), '{"__proto__":{"safe":true}}');
});

test("PHASE13-13 registers only explicit immutable routes", () => {
  const registry = createDefaultPublicationHttpRouteRegistry();

  assert.deepEqual(registry.routes, [
    { method: "POST", path: "/publications/commands/create", operation: "CREATE_PUBLICATION" },
    { method: "POST", path: "/publications/commands/modify", operation: "MODIFY_PUBLICATION" },
  ]);
  assert.equal(isDeeplyFrozen(registry.routes), true);
});

test("PHASE13-13 rejects duplicate route keys", () => {
  assert.throws(
    () => new PublicationHttpRouteRegistry([
      { method: "POST", path: "/publications/commands/create", operation: "CREATE_PUBLICATION" },
      { method: "post", path: "/publications/commands/create/", operation: "MODIFY_PUBLICATION" },
    ]),
    (error: unknown) => error instanceof PublicationHttpAdapterError
      && error.code === "INVALID_HTTP_REQUEST",
  );
});

test("PHASE13-13 sanitises hostile route registration", () => {
  const hostileRoutes = new Proxy([], {
    get: () => {
      throw new Error("ROUTE_REGISTRY_SECRET");
    },
  });

  assert.throws(
    () => new PublicationHttpRouteRegistry(hostileRoutes),
    (error: unknown) => error instanceof PublicationHttpAdapterError
      && error.code === "INVALID_HTTP_REQUEST"
      && !error.message.includes("SECRET"),
  );
});

test("PHASE13-13 rejects sparse route registration before resolution", () => {
  assert.throws(
    () => new PublicationHttpRouteRegistry(new Array(1)),
    (error: unknown) => error instanceof PublicationHttpAdapterError
      && error.code === "INVALID_HTTP_REQUEST",
  );
});

test("PHASE13-13 resolves a known route deterministically", () => {
  const resolved = createDefaultPublicationHttpRouteRegistry()
    .resolve("post", "/publications/commands/modify/");

  assert.deepEqual(resolved, {
    kind: "MATCH",
    route: {
      method: "POST",
      path: "/publications/commands/modify",
      operation: "MODIFY_PUBLICATION",
    },
  });
  assert.equal(isDeeplyFrozen(resolved), true);
});

test("PHASE13-13 maps an unknown route to a safe 404 response", async () => {
  const adapter = createAdapter(successfulInvoker());
  const response = await adapter.handle({
    ...validHttpRequest("route-missing"),
    path: "/publications/commands/missing",
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, failureBody("ROUTE_NOT_FOUND", "HTTP route was not found."));
});

test("PHASE13-13 maps an unsupported method to a safe 405 response", async () => {
  const response = await createAdapter(successfulInvoker()).handle({
    ...validHttpRequest("method-not-allowed"),
    method: "GET",
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.body, failureBody("METHOD_NOT_ALLOWED", "HTTP method is not allowed."));
});

test("PHASE13-13 maps a valid HTTP request to the executable boundary", () => {
  const mapper = new PublicationHttpRequestMapper(createDefaultPublicationHttpRouteRegistry());
  const body = validCreateBody("mapped");
  const request = createPublicationHttpRequest({
    ...validHttpRequest("request-mapped"),
    query: { include: ["summary", "status"], view: "full" },
    pathParameters: { tenant: "team-a" },
    body,
  });

  assert.deepEqual(mapper.map(request), {
    executionId: "request-mapped",
    request: {
      requestId: "request-mapped",
      operation: "CREATE_PUBLICATION",
      payload: { ...body, context: { ...body.context, sessionId: "actor-http" } },
      metadata: {
        "http.boundary": "true",
        "http.path.tenant": "team-a",
        "http.query.include": "[\"summary\",\"status\"]",
        "http.query.view": "full",
      },
    },
  });
});

test("F15-TASK-005 HTTP boundary accepts Session identity only from the header and drops body authority claims", () => {
  const mapper = new PublicationHttpRequestMapper(createDefaultPublicationHttpRouteRegistry());
  const original = validCreateBody("session-boundary");
  const forgedBody = {
    ...original,
    context: {
      ...original.context,
      actorId: "actor-body-forged",
      sessionId: "session-body-forged",
      roles: ["OPS"],
      capabilities: ["publication.create"],
    },
  };

  const mapped = mapper.map(createPublicationHttpRequest({
    ...validHttpRequest("session-boundary"),
    headers: { "x-session-id": "session-header-authoritative" },
    body: forgedBody,
  }));
  const context = ((mapped as { request: { payload: { context: Readonly<Record<string, unknown>> } } }).request.payload).context;

  assert.equal(context["sessionId"], "session-header-authoritative");
  assert.equal(context["actorId"], "actor-body-forged");
  assert.equal("roles" in context, false);
  assert.equal("capabilities" in context, false);

  const withoutHeader = mapper.map(createPublicationHttpRequest({
    ...validHttpRequest("session-boundary-missing"),
    headers: {},
    body: forgedBody,
  }));
  const missingContext = ((withoutHeader as { request: { payload: { context: Readonly<Record<string, unknown>> } } }).request.payload).context;
  assert.equal("sessionId" in missingContext, false);
});

test("PHASE13-13 contains malformed and hostile HTTP request input", async () => {
  const hostile = new Proxy({}, {
    getPrototypeOf: () => {
      throw new Error("HTTP_REQUEST_SECRET");
    },
  });
  const response = await createAdapter(successfulInvoker()).handle(hostile);

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.stringify(response).includes("SECRET"), false);
  assert.deepEqual(response.body, failureBody("INVALID_HTTP_REQUEST", "HTTP request is invalid."));
});

test("PHASE13-13 canonicalises hostile request-thrown HTTP-local errors", async () => {
  const hostile = Object.defineProperty(validHttpRequest("hostile-local-code"), "method", {
    enumerable: true,
    get: () => {
      throw new PublicationHttpAdapterError("EXECUTABLE_UNAVAILABLE", "injected");
    },
  });
  const response = await createAdapter(successfulInvoker()).handle(hostile);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, failureBody("INVALID_HTTP_REQUEST", "HTTP request is invalid."));
});

test("PHASE13-13 never trusts HTTP-local errors thrown by executable invocation", async () => {
  const response = await createAdapter({
    execute: () => {
      throw new PublicationHttpAdapterError("ROUTE_NOT_FOUND", "injected");
    },
  }).handle(validHttpRequest("invocation-local-code"));

  assert.equal(response.statusCode, 500);
  assert.deepEqual(
    response.body,
    failureBody("INTERNAL_HTTP_ADAPTER_ERROR", "HTTP request could not be processed."),
  );
});

test("PHASE13-13 contains an invalid request body before executable invocation", async () => {
  let invocations = 0;
  const response = await createAdapter({
    execute: () => {
      invocations += 1;
      return successfulExecutableResult("invalid-body");
    },
  }).handle({
    ...validHttpRequest("invalid-body"),
    body: ["not", "an", "operation", "object"],
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, failureBody("INVALID_REQUEST_BODY", "HTTP request body is invalid."));
  assert.equal(invocations, 0);
});

test("PHASE13-13 maps executable success to HTTP 200 without changing Presentation data", () => {
  const response = new PublicationHttpResponseMapper(new PublicationHttpErrorMapper())
    .map(successfulExecutableResult("success-map"));

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json");
  assert.deepEqual(response.body, presentation("success-map", "SUCCESS"));
});

test("PHASE13-13 maps Presentation validation failure to HTTP 400", () => {
  const response = mapPresentationFailure("validation-map", "VALIDATION");
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, presentation("validation-map", "VALIDATION"));
});

test("PHASE13-13 maps Presentation not-found failure to HTTP 404", () => {
  assert.equal(mapPresentationFailure("not-found-map", "NOT_FOUND").statusCode, 404);
});

test("PHASE13-13 maps Presentation conflict failure to HTTP 409", () => {
  assert.equal(mapPresentationFailure("conflict-map", "CONFLICT").statusCode, 409);
});

test("PHASE13-13 maps Presentation application rejection to HTTP 422", () => {
  assert.equal(mapPresentationFailure("rejection-map", "APPLICATION_REJECTION").statusCode, 422);
});

test("PHASE13-13 maps not-ready and stopped executables to HTTP 503", () => {
  const mapper = new PublicationHttpResponseMapper(new PublicationHttpErrorMapper());
  for (const code of ["EXECUTABLE_NOT_READY", "EXECUTABLE_STOPPED"] as const) {
    const response = mapper.map(executableFailure("unavailable", code));
    assert.equal(response.statusCode, 503);
    assert.deepEqual(
      response.body,
      failureBody("EXECUTABLE_UNAVAILABLE", "Executable is unavailable."),
    );
  }
});

test("PHASE13-13 sanitises unknown invocation errors to a generic HTTP 500", async () => {
  const response = await createAdapter({
    execute: () => {
      throw new Error("C:\\internal\\secret.ts RuntimeSecret");
    },
  }).handle(validHttpRequest("unknown-error"));

  assert.equal(response.statusCode, 500);
  assert.deepEqual(
    response.body,
    failureBody("INTERNAL_HTTP_ADAPTER_ERROR", "HTTP request could not be processed."),
  );
  assert.equal(JSON.stringify(response).includes("secret"), false);
});

test("PHASE13-13 preserves request ID through success and local failure", async () => {
  const adapter = createAdapter(successfulInvoker());
  const success = await adapter.handle(validHttpRequest("request-id-success"));
  const failure = await adapter.handle({
    ...validHttpRequest("request-id-failure"),
    path: "/missing",
  });

  assert.equal(success.requestId, "request-id-success");
  assert.equal((success.body as { metadata: { requestId: string } }).metadata.requestId, "request-id-success");
  assert.equal(failure.requestId, "request-id-failure");
});

test("PHASE13-13 rejects an executable result that changes the original request ID", async () => {
  const response = await createAdapter({
    execute: () => successfulExecutableResult("wrong-request-id"),
  }).handle(validHttpRequest("original-request-id"));

  assert.equal(response.statusCode, 500);
  assert.equal(response.requestId, "original-request-id");
  assert.deepEqual(
    response.body,
    failureBody("INTERNAL_HTTP_ADAPTER_ERROR", "HTTP request could not be processed."),
  );
  assert.equal(JSON.stringify(response).includes("wrong-request-id"), false);
});

test("PHASE13-13 snapshots a mutable executable result before request ID validation", async () => {
  let executionIdReads = 0;
  const wrongResult = successfulExecutableResult("wrong-proxy-id");
  const proxyResult = new Proxy(wrongResult, {
    get: (target, property, receiver): unknown => {
      if (property === "executionId") {
        executionIdReads += 1;
        return executionIdReads === 1 ? "original-proxy-id" : "wrong-proxy-id";
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const response = await createAdapter({
    execute: () => proxyResult,
  }).handle(validHttpRequest("original-proxy-id"));

  assert.equal(response.statusCode, 500);
  assert.equal(response.requestId, "original-proxy-id");
  assert.deepEqual(
    response.body,
    failureBody("INTERNAL_HTTP_ADAPTER_ERROR", "HTTP request could not be processed."),
  );
  assert.equal(JSON.stringify(response).includes("wrong-proxy-id"), false);
});

test("PHASE13-13 response validation prevents internal object leakage", async () => {
  class InternalGraph {}
  const response = await createAdapter({
    execute: () => ({
      ...successfulExecutableResult("internal-leak"),
      result: new InternalGraph(),
    }) as unknown as PublicationExecutableResult,
  }).handle(validHttpRequest("internal-leak"));

  assert.equal(response.statusCode, 500);
  assert.equal(containsNonPlainObject(response), false);
  assert.equal(JSON.stringify(response).includes("InternalGraph"), false);
});

test("PHASE13-13 construction and import never start the executable", () => {
  let hostCreations = 0;
  const executable = createPublicationInProcessExecutable(undefined, () => {
    hostCreations += 1;
    throw new Error("Host must not be created.");
  });

  createInProcessPublicationHttpAdapter(executable);
  assert.equal(hostCreations, 0);
  assert.equal(executable.status.state, "CREATED");
});

test("PHASE13-13 completes the full HTTP-shaped in-process execution path", async () => {
  const executable = createPublicationInProcessExecutable(undefined, () => createPublicationApplicationHost({
    compositionOptions: { runtimeOptions: { infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)) } },
  }));
  executable.start();
  const adapter = createInProcessPublicationHttpAdapter(executable);

  const response = await adapter.handle(validHttpRequest("http-e2e"));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.headers, { "content-type": "application/json" });
  assert.equal((response.body as { presentationResult: string }).presentationResult, "SUCCESS");
  assert.equal((response.body as { category: string }).category, "SUCCESS");
  assert.equal(
    (response.body as { metadata: { requestId: string } }).metadata.requestId,
    "http-e2e",
  );
  assert.equal(response.requestId, "http-e2e");
  assert.equal(isDeeplyFrozen(response), true);
  assert.equal(containsNonPlainObject(response), false);
  assert.equal(executable.stop().state, "STOPPED");
});

test("PHASE13-13 HTTP production files preserve executable-only dependency and forbidden-server isolation", () => {
  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const httpFiles = productionFiles.filter((file) => file.startsWith("publication-http-")
    || file === "publication-in-process-http-adapter.ts");
  const httpSpecifiers = new Set(httpFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const allowedImports = new Set([
    "./publication-executable-contracts.js",
    "./publication-in-process-executable.js",
    ...httpSpecifiers,
  ]);
  const forbidden = [
    /publication-(application-host|composition|transport|runtime|repository|aggregate)/,
    /node:http|createServer|\.listen\s*\(/,
    /\b(express|fastify|nestjs|koa|hapi|graphql|websocket|swagger|openapi)\b/,
    /\b(authentication|authorization|jwt|oauth|cookie|cors|csrf|multipart)\b/,
    /\b(database|orm|migration|redis|queue|docker|kubernetes|vercel|supabase)\b/,
    /process\.(env|exit|abort)|dotenv/,
  ];

  assert.deepEqual(httpFiles.sort(), [
    "publication-http-contracts.ts",
    "publication-http-error-mapper.ts",
    "publication-http-executable-invocation-adapter.ts",
    "publication-http-request-mapper.ts",
    "publication-http-response-mapper.ts",
    "publication-http-route-registry.ts",
    "publication-http-validation.ts",
    "publication-in-process-http-adapter.ts",
  ]);
  for (const file of httpFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8");
    assert.equal(
      extractModuleSpecifiers(source).every((specifier) => allowedImports.has(specifier)),
      true,
      `${file} imports an unapproved inner layer`,
    );
    assert.equal(
      forbidden.some((pattern) => pattern.test(source)),
      false,
      `${file} contains forbidden server or framework scope`,
    );
  }
  for (const file of productionFiles.filter((file) => !httpFiles.includes(file)
    && !file.startsWith("publication-node-http-"))) {
    const imports = extractModuleSpecifiers(readFileSync(join(sourceDirectory, file), "utf8"));
    assert.equal(
      imports.some((specifier) => httpSpecifiers.has(specifier)),
      false,
      `${file} imports HTTP Adapter`,
    );
  }
});

function createAdapter(invoker: PublicationExecutableInvoker) {
  return createInProcessPublicationHttpAdapter(invoker);
}

function successfulInvoker(): PublicationExecutableInvoker {
  return {
    execute: (request) => successfulExecutableResult(request.executionId),
  };
}

function validHttpRequest(requestId: string): PublicationHttpRequest {
  return {
    method: "POST",
    path: "/publications/commands/create",
    headers: { "x-session-id": "actor-http" },
    query: {},
    pathParameters: {},
    body: validCreateBody(requestId),
    requestId,
  };
}

function validCreateBody(requestId: string) {
  return {
    context: {
      actorId: "actor-http",
      correlationId: `correlation-${requestId}`,
      idempotencyKey: `idempotency-${requestId}`,
      intentFingerprint: `sha256:${requestId}`,
    },
    input: {
      identity: {
        publicationId: `publication-${requestId}`,
        tenantScopeId: "team-a",
      },
      binding: {
        subjectId: "listing-1",
        subjectRevision: 3,
        representationId: "representation-1",
        representationVersion: 2,
        representationChecksum: "sha256:representation-1-v2",
        approvalId: "approval-1",
        approvalVersion: 4,
        targetId: "target-1",
        targetVersion: 5,
        channelId: "channel-1",
        channelPolicyVersion: "channel-policy-v3",
      },
      prerequisites: {
        immutableSnapshot: true,
        effectiveApproval: true,
        exactTargetChannel: true,
        provenancePresent: true,
      },
      classification: "CONFIDENTIAL_BUSINESS",
      command: {
        actorId: "actor-http",
        authorityContext: "PUBLICATION_EXECUTION",
        reason: "Approved HTTP-shaped request",
        correlationId: `correlation-${requestId}`,
        occurredAt: timestamp,
      },
    },
  };
}

function successfulExecutableResult(requestId: string): PublicationExecutableResult {
  return executableResult(requestId, true, presentation(requestId, "SUCCESS"), null);
}

function presentation(
  requestId: string,
  category: "SUCCESS" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "APPLICATION_REJECTION" | "INTERNAL_ERROR",
) {
  const success = category === "SUCCESS";
  return {
    presentationResult: success ? "SUCCESS" : "ERROR",
    category,
    message: success ? "Publication operation completed." : "Publication operation failed.",
    fields: success
      ? [
        { key: "publicationId", label: "Publication ID", value: `publication-${requestId}` },
        { key: "version", label: "Version", value: "1" },
        { key: "replayed", label: "Replayed", value: "No" },
      ]
      : [{ key: "errorCode", label: "Error Code", value: "SAFE_FAILURE" }],
    metadata: {
      generatedAt: timestamp,
      version: "1",
      requestId,
      resultType: success ? "SUCCESS" : "ERROR",
    },
  };
}

function mapPresentationFailure(
  requestId: string,
  category: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "APPLICATION_REJECTION" | "INTERNAL_ERROR",
) {
  return new PublicationHttpResponseMapper(new PublicationHttpErrorMapper())
    .map(executableResult(requestId, false, presentation(requestId, category), null));
}

function executableFailure(
  requestId: string,
  code: "EXECUTABLE_NOT_READY" | "EXECUTABLE_STOPPED",
): PublicationExecutableResult {
  return executableResult(requestId, false, null, { code, message: "Executable unavailable." });
}

function executableResult(
  executionId: string,
  success: boolean,
  result: unknown,
  error: PublicationExecutableResult["error"],
): PublicationExecutableResult {
  return {
    executionId,
    success,
    state: "READY",
    result: result as PublicationExecutableResult["result"],
    error,
    diagnostics: {
      executableState: "READY",
      hostState: "READY",
      started: true,
      stopped: false,
      executionCount: 1,
      lastExecutionStatus: success ? "SUCCESS" : "FAILURE",
      capabilities: ["START", "EXECUTE", "STOP", "STATUS", "DIAGNOSTICS"],
    },
  };
}

function failureBody(code: string, message: string) {
  return { success: false, error: { code, message } };
}

function ownProtoValue<Value>(value: Value): Record<string, Value> {
  return Object.defineProperty({}, "__proto__", {
    enumerable: true,
    configurable: true,
    writable: true,
    value,
  });
}

type MutableHttpRequest = PublicationHttpRequest & {
  body: { context: { actorId: string } };
};

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Object.values(value).every((item) => isDeeplyFrozen(item, seen));
}

function containsNonPlainObject(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsNonPlainObject(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return true;
  return Object.values(value).some((item) => containsNonPlainObject(item, seen));
}

function extractModuleSpecifiers(source: string): string[] {
  const patterns = [
    /from\s+"([^"]+)"/g,
    /import\s+"([^"]+)"/g,
    /import\(\s*"([^"]+)"\s*\)/g,
  ];
  return patterns
    .flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]))
    .filter((specifier): specifier is string => specifier !== undefined);
}
