import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import test from "node:test";

import {
  createProductionReadinessState,
  createProductionRuntimeListenerStarter,
  createProductionRuntimeHttpListener,
} from "./production-readiness-http.js";
import type { ProductionChildRoot } from "./production-bootstrap.js";
import { parseRailwayProductionRuntimeConfiguration } from "./production-runtime-configuration.js";

function get(port: number, path: string, method = "GET"): Promise<Readonly<{ statusCode: number; body: string }>> {
  return new Promise((resolve, reject) => {
    const call = request({ host: "127.0.0.1", port, path, method, headers: { connection: "close" } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.once("end", () => resolve(Object.freeze({
        statusCode: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      })));
    });
    call.once("error", reject);
    call.end();
  });
}

function root(
  componentId: ProductionChildRoot["componentId"],
  marker?: string,
): ProductionChildRoot {
  return Object.freeze({
    componentId,
    ...(marker === undefined ? {} : {
      httpHandler: Object.freeze({
        handle: (input: unknown) => Promise.resolve(Object.freeze({
          statusCode: 200,
          headers: Object.freeze({ "content-type": "application/json" }),
          body: Object.freeze({ success: true, data: marker }),
          requestId: typeof input === "object" && input !== null && "requestId" in input
            ? String(input.requestId)
            : "unavailable",
        })),
      }),
    }),
    activateRuntime: () => undefined,
    close: () => undefined,
  });
}

function canonicalRoots(): readonly ProductionChildRoot[] {
  return Object.freeze([
    root("API-014", "API-014"), root("API-015", "API-015"), root("API-018"), root("API-019"), root("FEAT-022"),
  ]);
}

test("serves bounded NOT_READY then READY from the same operational listener", async () => {
  const state = createProductionReadinessState();
  const listener = createProductionRuntimeHttpListener({ port: 0, readiness: state, roots: canonicalRoots() });
  await listener.start();
  try {
    assert.deepEqual(await get(listener.port, "/readyz"), {
      statusCode: 503, body: '{"status":"NOT_READY"}',
    });
    state.markReady();
    assert.deepEqual(await get(listener.port, "/readyz"), {
      statusCode: 200, body: '{"status":"READY"}',
    });
    assert.deepEqual(await get(listener.port, "/readyz", "POST"), {
      statusCode: 405, body: '{"status":"NOT_READY"}',
    });
  } finally {
    state.markNotReady();
    await listener.close();
  }
});

test("readiness output is a fixed allowlist and never exposes sensitive diagnostics", async () => {
  const state = createProductionReadinessState();
  const listener = createProductionRuntimeHttpListener({ port: 0, readiness: state, roots: canonicalRoots() });
  await listener.start();
  try {
    const result = await get(listener.port, "/readyz?database=secret");
    assert.equal(result.statusCode, 404);
    assert.equal(/secret|postgres|stack|policy|tenant|principal/iu.test(result.body), false);
  } finally {
    await listener.close();
  }
});

test("one listener owns readiness plus the closed API-014 and API-015 route table", async () => {
  const state = createProductionReadinessState();
  const listener = createProductionRuntimeHttpListener({ port: 0, readiness: state, roots: canonicalRoots() });
  await listener.start();
  try {
    assert.deepEqual(await get(listener.port, "/api/publication/commands", "POST"), {
      statusCode: 503, body: '{"status":"NOT_READY"}',
    });
    state.markReady();
    assert.equal((await get(listener.port, "/api/publication/commands", "POST")).body.includes("API-014"), true);
    assert.equal((await get(listener.port, "/administration/queries")).body.includes("API-015"), true);
    assert.deepEqual(await get(listener.port, "/api/publication/commands/extra", "POST"), {
      statusCode: 404, body: '{"error":{"code":"ROUTE_NOT_FOUND","message":"Resource not found."},"success":false}',
    });
    assert.deepEqual(await get(listener.port, "/administration/queries/extra"), {
      statusCode: 404, body: '{"error":{"code":"ROUTE_NOT_FOUND","message":"Resource not found."},"success":false}',
    });
  } finally {
    await listener.close();
  }
});

test("listener composition binds the exact parsed Railway PORT and rejects missing, duplicate, or child-owned routes", async () => {
  const configuration = parseRailwayProductionRuntimeConfiguration({
    RUNTIME_ENVIRONMENT: "PRODUCTION", CONFIGURATION_REFERENCE: "config:production:v1",
    REQUIRED_SERVICE_REGISTRATIONS: "registration-api-014",
    REQUIRED_SERVICE_WORKLOAD_PINS: '[{"registrationId":"registration-api-014","registrationVersion":1}]', STARTUP_WORKLOAD_PURPOSE: "startup", STARTUP_WORKLOAD_AUDIENCE: "api", PROVIDER_EXECUTION_AUTHORIZED: "false",
    IDENTITY_PERSISTENCE_ENGINE: "POSTGRESQL", IDENTITY_DATABASE_CONNECTION_MODE: "DIRECT",
    IDENTITY_DATABASE_HOST: "db.mfonujjeokvpsfucfxuq.supabase.co", IDENTITY_DATABASE_PORT: "5432",
    IDENTITY_DATABASE_NAME: "postgres", IDENTITY_DATABASE_USER: "ai_mls_production_runtime",
    IDENTITY_DATABASE_CONNECTION_REF: "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1",
    IDENTITY_DATABASE_CA_CERT_REF: "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1", IDENTITY_DATABASE_SSL_MODE: "VERIFY_FULL",
    IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS: "10000", IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS: "30000", IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS: "30000", IDENTITY_DATABASE_MAX_CONNECTIONS: "5",
    IDENTITY_DATABASE_APPLICATION_NAME: "ai-mls-api-production", PORT: "4321",
  });
  let receivedPort = -1;
  const starter = createProductionRuntimeListenerStarter(
    configuration,
    createProductionReadinessState(),
    (options) => {
      receivedPort = options.port;
      return Object.freeze({ port: options.port, start: () => Promise.resolve(), close: () => Promise.resolve() });
    },
  );
  const resource = await starter({} as never, canonicalRoots());
  assert.equal(receivedPort, 4321);
  await resource.close();

  await assert.rejects(async () => { await starter({} as never, canonicalRoots().slice(1)); }, /listener composition is unavailable/u);
  await assert.rejects(async () => { await starter({} as never, [...canonicalRoots(), root("API-014", "duplicate")]); }, /listener composition is unavailable/u);
  await assert.rejects(async () => { await starter({} as never, [{ ...root("API-014", "API-014"), listener: {} }, ...canonicalRoots().slice(1)] as never); }, /listener composition is unavailable/u);
});

test("listener close drains an active request before completing and a new host can bind after close", async () => {
  let release!: () => void;
  let entered!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const requestEntered = new Promise<void>((resolve) => { entered = resolve; });
  const roots = [...canonicalRoots()];
  roots[0] = Object.freeze({
    ...root("API-014", "API-014"),
    httpHandler: Object.freeze({
      handle: async (input: unknown) => {
        entered();
        await hold;
        return Object.freeze({
          statusCode: 200, headers: Object.freeze({ "content-type": "application/json" }),
          body: Object.freeze({ success: true }),
          requestId: typeof input === "object" && input !== null && "requestId" in input ? String(input.requestId) : "unavailable",
        });
      },
    }),
  });
  const state = createProductionReadinessState();
  const listener = createProductionRuntimeHttpListener({ port: 0, readiness: state, roots });
  await listener.start();
  const port = listener.port;
  state.markReady();
  const response = get(port, "/api/publication/commands", "POST");
  await requestEntered;
  let closeCompleted = false;
  const closing = listener.close().then(() => { closeCompleted = true; });
  await Promise.resolve();
  assert.equal(closeCompleted, false);
  release();
  assert.equal((await response).statusCode, 200);
  await closing;
  const restarted = createProductionRuntimeHttpListener({ port, readiness: createProductionReadinessState(), roots: canonicalRoots() });
  await restarted.start();
  await restarted.close();
});

test("actual bind failure is contained and never reports a usable listener", async () => {
  const occupied = createServer();
  await new Promise<void>((resolve, reject) => {
    occupied.once("error", reject);
    occupied.listen(0, "0.0.0.0", resolve);
  });
  try {
    const address = occupied.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, "object");
    const listener = createProductionRuntimeHttpListener({
      port: typeof address === "object" && address !== null ? address.port : -1,
      readiness: createProductionReadinessState(), roots: canonicalRoots(),
    });
    await assert.rejects(() => listener.start(), /Production listener is unavailable/u);
    assert.throws(() => listener.port, /Production listener is unavailable/u);
  } finally {
    await new Promise<void>((resolve) => occupied.close(() => resolve()));
  }
});
