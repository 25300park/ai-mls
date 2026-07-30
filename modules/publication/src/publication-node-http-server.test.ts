import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { createServer, request as nodeRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { createPublicationInProcessExecutable } from "./publication-executable-bootstrap.js";
import { createInProcessPublicationHttpAdapter } from "./publication-in-process-http-adapter.js";
import {
  PublicationNodeHttpServerError,
  type PublicationNodeHttpServerConfiguration,
  type PublicationNodeHttpServerDiagnostics,
  type PublicationNodeHttpServerRequestIdFactory,
} from "./publication-node-http-contracts.js";
import {
  createPublicationNodeHttpServerConfiguration,
  defaultPublicationNodeHttpServerConfiguration,
} from "./publication-node-http-configuration.js";
import { PublicationNodeHttpLifecycleController } from "./publication-node-http-lifecycle.js";
import { PublicationNodeHttpRequestReader } from "./publication-node-http-request-reader.js";
import { PublicationNodeHttpResponseWriter } from "./publication-node-http-response-writer.js";
import {
  createPublicationNodeHttpServer,
  type PublicationNodeHttpServer,
} from "./publication-node-http-server.js";

const timestamp = "2026-07-30T01:00:00.000Z";

test("PHASE13-14 creates an immutable isolated loopback server configuration", () => {
  const input = { host: "127.0.0.1", port: 0, maximumBodyBytes: 512, shutdownTimeout: 250 };
  const configuration = createPublicationNodeHttpServerConfiguration(input);
  input.port = 8080;

  assert.deepEqual(configuration, {
    host: "127.0.0.1",
    port: 0,
    maximumBodyBytes: 512,
    shutdownTimeout: 250,
  });
  assert.equal(Object.isFrozen(configuration), true);
  assert.deepEqual(defaultPublicationNodeHttpServerConfiguration, {
    host: "127.0.0.1",
    port: 0,
    maximumBodyBytes: 1_048_576,
    shutdownTimeout: 5_000,
  });
});

test("PHASE13-14 rejects invalid or deployment-shaped server configuration", () => {
  for (const input of [
    null,
    {},
    { host: "0.0.0.0", port: 0, maximumBodyBytes: 512, shutdownTimeout: 250 },
    { host: "127.0.0.1", port: -1, maximumBodyBytes: 512, shutdownTimeout: 250 },
    { host: "127.0.0.1", port: 65_536, maximumBodyBytes: 512, shutdownTimeout: 250 },
    { host: "127.0.0.1", port: 0, maximumBodyBytes: 0, shutdownTimeout: 250 },
    { host: "127.0.0.1", port: 0, maximumBodyBytes: 512, shutdownTimeout: 0 },
    { host: "127.0.0.1", port: 0, maximumBodyBytes: 512, shutdownTimeout: 250, tls: true },
  ]) {
    assert.throws(
      () => createPublicationNodeHttpServerConfiguration(input),
      (error: unknown) => error instanceof PublicationNodeHttpServerError
        && error.code === "INVALID_NODE_REQUEST"
        && !error.message.includes("tls"),
    );
  }
});

test("PHASE13-14 lifecycle accepts only the canonical deterministic transition table", () => {
  const lifecycle = new PublicationNodeHttpLifecycleController();
  assert.deepEqual(lifecycle.snapshot, { state: "CREATED", sequence: 0 });
  assert.deepEqual(lifecycle.transition("STARTING"), { state: "STARTING", sequence: 1 });
  assert.deepEqual(lifecycle.transition("LISTENING"), { state: "LISTENING", sequence: 2 });
  assert.deepEqual(lifecycle.transition("STOPPING"), { state: "STOPPING", sequence: 3 });
  assert.deepEqual(lifecycle.transition("STOPPED"), { state: "STOPPED", sequence: 4 });
  assert.equal(Object.isFrozen(lifecycle.snapshot), true);

  assert.throws(
    () => lifecycle.transition("STARTING"),
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "SERVER_NOT_LISTENING",
  );

  const failed = new PublicationNodeHttpLifecycleController();
  failed.transition("STARTING");
  assert.deepEqual(failed.transition("FAILED"), { state: "FAILED", sequence: 2 });
});

test("PHASE13-14 starts a real listener and repeated start is idempotent", async () => {
  const server = createTestServer();
  const first = await server.start();
  const second = await server.start();

  assert.equal(first.state, "LISTENING");
  assert.strictEqual(second, first);
  assert.equal(server.diagnostics.listening, true);
  assert.equal(server.diagnostics.boundHost, "127.0.0.1");
  assert.equal(typeof server.diagnostics.boundPort, "number");
  await server.stop();
});

test("PHASE13-14 concurrent start calls share one deterministic listener result", async () => {
  const server = createTestServer();
  const [first, second] = await Promise.all([server.start(), server.start()]);

  assert.strictEqual(second, first);
  assert.equal(server.status.state, "LISTENING");
  await server.stop();
});

test("PHASE13-14 contains listener startup failure without leaking endpoint details", async () => {
  const occupied = createServer();
  await listen(occupied, 0);
  const address = occupied.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP address.");
  const port = address.port;
  const server = createTestServer({ port });

  await assert.rejects(
    () => server.start(),
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "SERVER_START_FAILURE"
      && !error.message.includes(String(port)),
  );
  assert.equal(server.status.state, "FAILED");
  assert.equal(server.diagnostics.listening, false);
  await close(occupied);
});

test("PHASE13-14 synchronous listen failure removes temporary lifecycle listeners", async () => {
  const fake = new EventEmitter() as EventEmitter & {
    listen: () => never;
    close: () => void;
    closeIdleConnections: () => void;
    closeAllConnections: () => void;
    listening: boolean;
  };
  fake.listening = false;
  fake.listen = () => { throw new Error("SYNC_LISTEN_SECRET"); };
  fake.close = () => undefined;
  fake.closeIdleConnections = () => undefined;
  fake.closeAllConnections = () => undefined;
  const server = createPublicationNodeHttpServer({
    configuration: testConfiguration(),
    requestIdFactory: fixedRequestId("sync-start-failure"),
    httpAdapter: { handle: () => Promise.reject(new Error("not expected")) },
    serverFactory: () => fake as unknown as ReturnType<typeof createServer>,
  });

  await assert.rejects(
    () => server.start(),
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "SERVER_START_FAILURE"
      && !error.message.includes("SECRET"),
  );
  assert.equal(fake.listenerCount("error"), 0);
  assert.equal(fake.listenerCount("listening"), 0);
});

test("PHASE13-14 gracefully stops active listener and repeated stop is idempotent", async () => {
  const server = createTestServer();
  await server.start();
  const port = requiredBoundPort(server.diagnostics);
  const first = await server.stop();
  const second = await server.stop();

  assert.equal(first.state, "STOPPED");
  assert.strictEqual(second, first);
  assert.equal(server.diagnostics.listening, false);
  await assert.rejects(() => sendJson(port, "/publications/commands/create", {}, "after-stop"));
  await assert.rejects(
    () => server.start(),
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "SERVER_NOT_LISTENING",
  );
});

test("PHASE13-14 concurrent stop calls share one deterministic terminal result", async () => {
  const server = createTestServer();
  await server.start();
  const [first, second] = await Promise.all([server.stop(), server.stop()]);

  assert.strictEqual(second, first);
  assert.equal(server.status.state, "STOPPED");
});

test("PHASE13-14 graceful shutdown waits for an active Adapter request", async () => {
  const gate = deferred<void>();
  const server = createPublicationNodeHttpServer({
    configuration: testConfiguration(),
    requestIdFactory: fixedRequestId("active-graceful"),
    httpAdapter: {
      handle: async (request: unknown) => {
        await gate.promise;
        const requestId = (request as { requestId: string }).requestId;
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: { success: true },
          requestId,
        };
      },
    },
  });
  await server.start();
  const responsePromise = sendJson(
    requiredBoundPort(server.diagnostics),
    "/publications/commands/create",
    {},
    "active-graceful",
  );
  await waitUntil(() => server.diagnostics.activeRequestCount === 1);
  const stopPromise = server.stop();
  assert.equal(server.status.state, "STOPPING");
  gate.resolve();

  assert.equal((await responsePromise).statusCode, 200);
  assert.equal((await stopPromise).state, "STOPPED");
  assert.equal(server.diagnostics.activeRequestCount, 0);
});

test("PHASE13-14 forced shutdown releases an active socket and request counter", async () => {
  const server = createPublicationNodeHttpServer({
    configuration: { ...testConfiguration(), shutdownTimeout: 25 },
    requestIdFactory: fixedRequestId("forced-shutdown"),
    httpAdapter: { handle: () => new Promise(() => undefined) },
  });
  await server.start();
  const responsePromise = sendJson(
    requiredBoundPort(server.diagnostics),
    "/publications/commands/create",
    {},
    "forced-shutdown",
  );
  void responsePromise.catch(() => undefined);
  await waitUntil(() => server.diagnostics.activeRequestCount === 1);

  assert.equal((await server.stop()).state, "STOPPED");
  await assert.rejects(() => responsePromise);
  await waitUntil(() => server.diagnostics.activeRequestCount === 0);
});

test("PHASE13-14 request reader maps method path query headers and valid JSON", async () => {
  const reader = new PublicationNodeHttpRequestReader(512, fixedRequestId("generated-unused"));
  const incoming = fakeIncoming({
    method: "POST",
    url: "/publications/commands/create?view=full&include=summary&include=status",
    headers: { "content-type": "application/json", "x-request-id": "incoming-1", "x-mode": "safe" },
  });
  const promise = reader.read(incoming.message);
  incoming.emitData('{"safe":true}');
  incoming.emitEnd();
  const result = await promise;

  assert.deepEqual(result, {
    method: "POST",
    path: "/publications/commands/create",
    headers: {
      "content-type": "application/json",
      "x-mode": "safe",
      "x-request-id": "incoming-1",
    },
    query: { include: ["summary", "status"], view: "full" },
    pathParameters: {},
    body: { safe: true },
    requestId: "incoming-1",
  });
});

test("PHASE13-14 request reader contains malformed JSON without raw body leakage", async () => {
  const reader = new PublicationNodeHttpRequestReader(512, fixedRequestId("malformed-id"));
  const incoming = fakeIncoming({ method: "POST", url: "/publications/commands/create", headers: {} });
  const promise = reader.read(incoming.message);
  incoming.emitData('{"secret":');
  incoming.emitEnd();

  await assert.rejects(
    () => promise,
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "INVALID_NODE_REQUEST"
      && !error.message.includes("secret"),
  );
});

test("PHASE13-14 request reader rejects oversized bodies and stops bounded accumulation", async () => {
  const reader = new PublicationNodeHttpRequestReader(8, fixedRequestId("oversized-id"));
  const incoming = fakeIncoming({ method: "POST", url: "/publications/commands/create", headers: {} });
  const promise = reader.read(incoming.message);
  incoming.emitData("12345678");
  incoming.emitData("9SECRET");

  await assert.rejects(
    () => promise,
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "REQUEST_BODY_TOO_LARGE"
      && !error.message.includes("SECRET"),
  );
  assert.equal(incoming.resumeCount, 1);
});

test("PHASE13-14 request reader contains aborted requests", async () => {
  const reader = new PublicationNodeHttpRequestReader(512, fixedRequestId("aborted-id"));
  const incoming = fakeIncoming({ method: "POST", url: "/publications/commands/create", headers: {} });
  const promise = reader.read(incoming.message);
  incoming.emitData("{");
  incoming.emitAborted();

  await assert.rejects(
    () => promise,
    (error: unknown) => error instanceof PublicationNodeHttpServerError
      && error.code === "REQUEST_ABORTED",
  );
});

test("PHASE13-14 contains a real aborted loopback request and releases diagnostics", async () => {
  const server = createTestServer();
  await server.start();
  const port = requiredBoundPort(server.diagnostics);
  const clientError = new Promise<void>((resolve) => {
    const client = nodeRequest({
      host: "127.0.0.1",
      port,
      method: "POST",
      path: "/publications/commands/create",
      headers: { "content-length": "100", "x-request-id": "real-abort" },
    });
    client.on("error", () => resolve());
    client.write("{");
    void waitUntil(() => server.diagnostics.activeRequestCount === 1).then(() => client.destroy());
  });

  await clientError;
  await waitUntil(() => server.diagnostics.activeRequestCount === 0);
  assert.equal(server.diagnostics.failedRequestCount, 1);
  assert.equal(server.diagnostics.lastRequestStatus, null);
  await server.stop();
});

test("PHASE13-14 request reader preserves a valid request ID and generates a safe fallback", async () => {
  let generated = 0;
  const reader = new PublicationNodeHttpRequestReader(512, () => `generated-${++generated}`);
  const preserved = fakeIncoming({
    method: "POST",
    url: "/publications/commands/create",
    headers: { "x-request-id": "preserved_1" },
  });
  const preservedPromise = reader.read(preserved.message);
  preserved.emitData("{}");
  preserved.emitEnd();
  assert.equal((await preservedPromise).requestId, "preserved_1");

  const invalid = fakeIncoming({
    method: "POST",
    url: "/publications/commands/create",
    headers: { "x-request-id": "bad id with spaces" },
  });
  const invalidPromise = reader.read(invalid.message);
  invalid.emitData("{}");
  invalid.emitEnd();
  assert.equal((await invalidPromise).requestId, "generated-1");
});

test("PHASE13-14 response writer completes a successful response exactly once", async () => {
  const output = fakeResponse();
  const writer = new PublicationNodeHttpResponseWriter();
  const result = await writer.write(output.response, {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { success: true },
    requestId: "writer-success",
  });

  assert.deepEqual(result, { statusCode: 200, fallbackUsed: false });
  assert.equal(output.statusCode, 200);
  assert.deepEqual(output.headers, {
    "content-type": "application/json",
    "x-request-id": "writer-success",
  });
  assert.deepEqual(output.bodies, ['{"success":true}']);
});

test("PHASE13-14 response writer contains failure with a safe fallback", async () => {
  const output = fakeResponse({ throwOnFirstEnd: true });
  const writer = new PublicationNodeHttpResponseWriter();
  const result = await writer.write(output.response, {
    statusCode: 200,
    headers: { "content-type": "application/json", "x-internal": "not-forwarded" },
    body: { success: true },
    requestId: "writer-failure",
  });

  assert.deepEqual(result, { statusCode: 500, fallbackUsed: true });
  assert.equal(output.statusCode, 500);
  assert.equal(output.bodies.length, 1);
  assert.equal(output.bodies[0]?.includes("RESPONSE_WRITE_FAILURE"), true);
  assert.equal(output.bodies[0]?.includes("not-forwarded"), false);
});

test("PHASE13-14 response writer contains asynchronous response errors", async () => {
  const output = fakeResponse({ emitErrorInsteadOfFinish: true });
  const writer = new PublicationNodeHttpResponseWriter();
  const result = await writer.write(output.response, {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { success: true },
    requestId: "writer-async-failure",
  });

  assert.equal(result.statusCode, 500);
  assert.equal(output.endCount, 1);
  assert.equal(output.bodies.some((body) => body.includes("WRITE_SECRET")), false);
});

test("PHASE13-14 response writer settles when the connection closes before finish", async () => {
  const output = fakeResponse({ emitCloseInsteadOfFinish: true });
  const writer = new PublicationNodeHttpResponseWriter();
  const result = await Promise.race([
    writer.write(output.response, {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: { success: true },
      requestId: "writer-premature-close",
    }),
    new Promise<"TIMED_OUT">((resolve) => setTimeout(() => resolve("TIMED_OUT"), 50)),
  ]);

  assert.notEqual(result, "TIMED_OUT");
  assert.deepEqual(result, { statusCode: 500, fallbackUsed: false });
  assert.equal(output.endCount, 1);
});

test("PHASE13-14 maps malformed JSON and oversized body to safe network responses", async () => {
  const server = createTestServer({ maximumBodyBytes: 16 });
  await server.start();
  const port = requiredBoundPort(server.diagnostics);

  const malformed = await sendRaw(port, "/publications/commands/create", "{", "malformed-network");
  const oversized = await sendRaw(port, "/publications/commands/create", "12345678901234567", "large-network");

  assert.equal(malformed.statusCode, 400);
  assert.deepEqual(malformed.body, safeFailure("INVALID_NODE_REQUEST", "Node HTTP request is invalid."));
  assert.equal(oversized.statusCode, 413);
  assert.deepEqual(oversized.body, safeFailure("REQUEST_BODY_TOO_LARGE", "HTTP request body is too large."));
  await server.stop();
});

test("PHASE13-14 sanitises HTTP Adapter failure without internal detail", async () => {
  const server = createPublicationNodeHttpServer({
    configuration: testConfiguration(),
    requestIdFactory: fixedRequestId("adapter-failure"),
    httpAdapter: {
      handle: () => Promise.reject(new Error("C:\\internal\\adapter-secret.ts")),
    },
  });
  await server.start();
  const response = await sendJson(
    requiredBoundPort(server.diagnostics),
    "/publications/commands/create",
    {},
    "adapter-failure",
  );

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, safeFailure("HTTP_ADAPTER_FAILURE", "HTTP Adapter request failed."));
  assert.equal(JSON.stringify(response).includes("secret"), false);
  await server.stop();
});

test("PHASE13-14 diagnostics are immutable safe scalar evidence", async () => {
  const server = createTestServer();
  await server.start();
  const port = requiredBoundPort(server.diagnostics);
  await sendJson(port, "/missing", {}, "diagnostics-request");
  const diagnostics = server.diagnostics;

  assert.deepEqual(diagnostics, {
    serverState: "LISTENING",
    listening: true,
    boundHost: "127.0.0.1",
    boundPort: port,
    requestCount: 1,
    activeRequestCount: 0,
    successfulRequestCount: 0,
    failedRequestCount: 1,
    lastRequestStatus: 404,
  });
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.doesNotThrow(() => JSON.stringify(diagnostics));
  assert.equal(containsNonPlainObject(diagnostics), false);
  for (const forbidden of ["socket", "executable", "adapter", "body", "stack"]) {
    assert.equal(JSON.stringify(diagnostics).toLowerCase().includes(forbidden), false);
  }
  await server.stop();
});

test("PHASE13-14 construction and import never starts a listener", () => {
  let adapterCalls = 0;
  const server = createPublicationNodeHttpServer({
    configuration: testConfiguration(),
    requestIdFactory: fixedRequestId("no-auto-listen"),
    httpAdapter: {
      handle: () => {
        adapterCalls += 1;
        return Promise.reject(new Error("not expected"));
      },
    },
  });

  assert.equal(server.status.state, "CREATED");
  assert.equal(server.diagnostics.listening, false);
  assert.equal(server.diagnostics.boundPort, null);
  assert.equal(adapterCalls, 0);
});

test("PHASE13-14 completes the real loopback FEAT-015 execution path", async () => {
  const executable = createPublicationInProcessExecutable();
  executable.start();
  const httpAdapter = createInProcessPublicationHttpAdapter(executable);
  const server = createPublicationNodeHttpServer({
    configuration: testConfiguration(),
    requestIdFactory: fixedRequestId("generated-e2e"),
    httpAdapter,
  });
  await server.start();
  const port = requiredBoundPort(server.diagnostics);

  const response = await sendJson(
    port,
    "/publications/commands/create?view=full",
    validCreateBody("node-http-e2e"),
    "node-http-e2e",
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json");
  assert.equal(response.headers["x-request-id"], "node-http-e2e");
  const presentation = response.body as {
    readonly presentationResult?: unknown;
    readonly category?: unknown;
    readonly metadata?: { readonly requestId?: unknown };
  };
  assert.equal(presentation.presentationResult, "SUCCESS");
  assert.equal(presentation.category, "SUCCESS");
  assert.equal(presentation.metadata?.requestId, "node-http-e2e");
  assert.deepEqual(server.diagnostics, {
    serverState: "LISTENING",
    listening: true,
    boundHost: "127.0.0.1",
    boundPort: port,
    requestCount: 1,
    activeRequestCount: 0,
    successfulRequestCount: 1,
    failedRequestCount: 0,
    lastRequestStatus: 200,
  });
  await server.stop();
  assert.equal(server.diagnostics.listening, false);
  assert.equal(executable.stop().state, "STOPPED");
  await assert.rejects(() => sendJson(port, "/publications/commands/create", {}, "closed-e2e"));
});

test("PHASE13-14 server production files preserve HTTP Adapter-only dependency and forbidden-scope isolation", () => {
  const sourceDirectory = join(process.cwd(), "modules", "publication", "src");
  const productionFiles = readdirSync(sourceDirectory)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");
  const serverFiles = productionFiles.filter((file) => file.startsWith("publication-node-http-"));
  const serverSpecifiers = new Set(serverFiles.map((file) => `./${file.slice(0, -3)}.js`));
  const allowedImports = new Set([
    "node:http",
    "node:buffer",
    "./publication-http-contracts.js",
    ...serverSpecifiers,
  ]);
  const forbidden = [
    /publication-(executable|application-host|composition|transport|runtime|repository|aggregate)/,
    /\b(express|fastify|nestjs|koa|hapi|graphql|websocket|sse)\b/,
    /\b(authentication|authorization|jwt|oauth|cookie|cors|csrf|multipart)\b/,
    /\b(database|orm|migration|redis|queue|docker|kubernetes|vercel|supabase)\b/,
    /process\.(env|exit|abort|on)|dotenv/,
  ];

  assert.deepEqual(serverFiles.sort(), [
    "publication-node-http-configuration.ts",
    "publication-node-http-contracts.ts",
    "publication-node-http-lifecycle.ts",
    "publication-node-http-request-reader.ts",
    "publication-node-http-response-writer.ts",
    "publication-node-http-server.ts",
  ]);
  for (const file of serverFiles) {
    const source = readFileSync(join(sourceDirectory, file), "utf8");
    assert.equal(
      extractModuleSpecifiers(source).every((specifier) => allowedImports.has(specifier)),
      true,
      `${file} imports outside the approved Node HTTP boundary`,
    );
    assert.equal(forbidden.some((pattern) => pattern.test(source)), false, `${file} contains forbidden scope`);
  }
  for (const file of productionFiles.filter((file) => !serverFiles.includes(file))) {
    const imports = extractModuleSpecifiers(readFileSync(join(sourceDirectory, file), "utf8"));
    assert.equal(
      imports.some((specifier) => serverSpecifiers.has(specifier)),
      false,
      `${file} imports Node HTTP Server`,
    );
  }
});

function createTestServer(overrides: Partial<PublicationNodeHttpServerConfiguration> = {}): PublicationNodeHttpServer {
  return createPublicationNodeHttpServer({
    configuration: { ...testConfiguration(), ...overrides },
    requestIdFactory: fixedRequestId("generated-test"),
    httpAdapter: {
      handle: (request: unknown) => {
        const requestId = (request as { requestId: string }).requestId;
        const path = (request as { path: string }).path;
        if (path === "/missing") {
          return Promise.resolve({
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: safeFailure("ROUTE_NOT_FOUND", "HTTP route was not found."),
            requestId,
          });
        }
        return Promise.resolve({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: { success: true },
          requestId,
        });
      },
    },
  });
}

function testConfiguration(): PublicationNodeHttpServerConfiguration {
  return { host: "127.0.0.1", port: 0, maximumBodyBytes: 1_024, shutdownTimeout: 250 };
}

function fixedRequestId(value: string): PublicationNodeHttpServerRequestIdFactory {
  return () => value;
}

function requiredBoundPort(diagnostics: PublicationNodeHttpServerDiagnostics): number {
  assert.notEqual(diagnostics.boundPort, null);
  return diagnostics.boundPort!;
}

function validCreateBody(requestId: string) {
  return {
    context: {
      actorId: "actor-node-http",
      correlationId: `correlation-${requestId}`,
      idempotencyKey: `idempotency-${requestId}`,
      intentFingerprint: `sha256:${requestId}`,
    },
    input: {
      identity: { publicationId: `publication-${requestId}`, tenantScopeId: "team-a" },
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
        actorId: "actor-node-http",
        authorityContext: "PUBLICATION_EXECUTION",
        reason: "Approved Node HTTP loopback request",
        correlationId: `correlation-${requestId}`,
        occurredAt: timestamp,
      },
    },
  };
}

function safeFailure(code: string, message: string) {
  return { success: false, error: { code, message } };
}

interface FakeIncomingOptions {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

function fakeIncoming(options: FakeIncomingOptions) {
  const emitter = new EventEmitter() as EventEmitter & {
    method: string;
    url: string;
    headers: Readonly<Record<string, string>>;
    resume: () => void;
  };
  emitter.method = options.method;
  emitter.url = options.url;
  emitter.headers = options.headers;
  let resumeCount = 0;
  emitter.resume = () => { resumeCount += 1; };
  return {
    message: emitter as unknown as IncomingMessage,
    emitData: (value: string) => emitter.emit("data", Buffer.from(value)),
    emitEnd: () => emitter.emit("end"),
    emitAborted: () => emitter.emit("aborted"),
    get resumeCount() { return resumeCount; },
  };
}

function fakeResponse(options: {
  readonly throwOnFirstEnd?: boolean;
  readonly emitErrorInsteadOfFinish?: boolean;
  readonly emitCloseInsteadOfFinish?: boolean;
} = {}) {
  const headers: Record<string, string> = {};
  const bodies: string[] = [];
  let statusCode = 200;
  let endCount = 0;
  let headersSent = false;
  let writableEnded = false;
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number;
    readonly headersSent: boolean;
    readonly writableEnded: boolean;
    readonly destroyed: boolean;
    setHeader: (name: string, value: string | number | readonly string[]) => void;
    end: (body: string) => void;
  };
  Object.defineProperties(response, {
    statusCode: {
      configurable: true,
      enumerable: true,
      get: () => statusCode,
      set: (value: number) => { statusCode = value; },
    },
    headersSent: { configurable: true, enumerable: true, get: () => headersSent },
    writableEnded: { configurable: true, enumerable: true, get: () => writableEnded },
    destroyed: { configurable: true, enumerable: true, get: () => false },
  });
  response.setHeader = (name: string, value: string | number | readonly string[]) => {
    headers[name.toLowerCase()] = String(value);
  };
  response.end = (body: string) => {
      endCount += 1;
      if (options.throwOnFirstEnd === true && endCount === 1) throw new Error("WRITE_SECRET");
      bodies.push(body);
      headersSent = true;
      writableEnded = true;
      queueMicrotask(() => {
        if (options.emitErrorInsteadOfFinish === true) response.emit("error", new Error("WRITE_SECRET"));
        else if (options.emitCloseInsteadOfFinish === true) response.emit("close");
        else response.emit("finish");
      });
  };
  return {
    response: response as unknown as ServerResponse,
    headers,
    bodies,
    get statusCode() { return statusCode; },
    get endCount() { return endCount; },
  };
}

async function listen(server: ReturnType<typeof createServer>, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
}

async function sendJson(port: number, path: string, body: unknown, requestId: string) {
  return sendRaw(port, path, JSON.stringify(body), requestId);
}

async function sendRaw(port: number, path: string, body: string, requestId: string): Promise<{
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
}> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest({
      host: "127.0.0.1",
      port,
      method: "POST",
      path,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "x-request-id": requestId,
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        try {
          const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: parsed,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Response parsing failed."));
        }
      });
    });
    request.on("error", reject);
    request.end(body);
  });
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

function deferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
} {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((fulfil) => { resolve = fulfil; });
  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeout = 1_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Condition was not reached.");
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

function containsNonPlainObject(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsNonPlainObject(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return true;
  return Object.values(value).some((item) => containsNonPlainObject(item, seen));
}
