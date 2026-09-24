import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionBootstrapDependencies, ProductionRuntimeHandle } from "./production-bootstrap.js";
import { createProductionReadinessState } from "./production-readiness-http.js";
import { createRailwayProductionDependencies, runProductionMain, type ProductionSignal } from "./production-main.js";
import { ProductionSecretBindingError } from "./production-secret-reference-resolver.js";

function productionEnvironment(): Readonly<Record<string, string>> {
  return Object.freeze({
    RUNTIME_ENVIRONMENT: "PRODUCTION",
    CONFIGURATION_REFERENCE: "config:production:v1",
    REQUIRED_SERVICE_REGISTRATIONS: "registration-api-014",
    PROVIDER_EXECUTION_AUTHORIZED: "false",
    IDENTITY_PERSISTENCE_ENGINE: "POSTGRESQL",
    IDENTITY_DATABASE_CONNECTION_MODE: "DIRECT",
    IDENTITY_DATABASE_HOST: "db.mfonujjeokvpsfucfxuq.supabase.co",
    IDENTITY_DATABASE_PORT: "5432",
    IDENTITY_DATABASE_NAME: "postgres",
    IDENTITY_DATABASE_USER: "ai_mls_production_runtime",
    IDENTITY_DATABASE_CONNECTION_REF: "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1",
    IDENTITY_DATABASE_CA_CERT_REF: "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1",
    IDENTITY_DATABASE_SSL_MODE: "VERIFY_FULL",
    IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS: "10000",
    IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_MAX_CONNECTIONS: "5",
    IDENTITY_DATABASE_APPLICATION_NAME: "ai-mls-api-production",
    PORT: "8080",
    RAILWAY_PROJECT_ID: "project-id",
    RAILWAY_ENVIRONMENT_ID: "environment-id",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_SERVICE_ID: "service-id",
    RAILWAY_SERVICE_NAME: "ai-mls-api",
    RAILWAY_DEPLOYMENT_ID: "deployment-id",
  });
}

test("the executable composition fails closed before PostgreSQL when sealed runtime values are unbound", async () => {
  const environment = productionEnvironment();
  const dependencies = createRailwayProductionDependencies(environment);
  const configuration = dependencies.parseConfiguration(environment);

  await assert.rejects(() => dependencies.openPostgreSqlPool(configuration), ProductionSecretBindingError);
});

test("invokes canonical start exactly once and marks readiness only after startup returns", async () => {
  const readiness = createProductionReadinessState();
  const events: string[] = [];
  const runtime: ProductionRuntimeHandle = Object.freeze({
    validationFingerprint: "sha256:test",
    identitySchemaReadinessProvenance: "NATIVE_MIGRATION_LEDGER_VERIFIED",
    readiness: () => "READY" as const,
    close: () => { events.push("close"); return Promise.resolve(); },
  });
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness,
    startRuntime: () => { events.push(`start:${readiness.readiness()}`); return Promise.resolve(runtime); },
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
  });
  assert.deepEqual(events, ["start:NOT_READY"]);
  assert.equal(readiness.readiness(), "READY");
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.deepEqual(events, ["start:NOT_READY", "close", "uninstall"]);
});

test("SIGINT and SIGTERM share one deterministic idempotent shutdown", async () => {
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness: createProductionReadinessState(),
    startRuntime: () => Promise.resolve(Object.freeze({
      validationFingerprint: "sha256:test", identitySchemaReadinessProvenance: "NATIVE_MIGRATION_LEDGER_VERIFIED" as const, readiness: () => "READY" as const,
      close: () => { events.push("close"); return Promise.resolve(); },
    })),
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
  });
  signalHandler?.("SIGINT");
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.deepEqual(events, ["close", "uninstall"]);
});

test("a signal received during startup prevents READY and closes immediately after startup returns", async () => {
  const readiness = createProductionReadinessState();
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness,
    installSignalHandler: (handler) => { signalHandler = handler; events.push("installed"); return () => events.push("uninstall"); },
    startRuntime: () => {
      events.push("start");
      signalHandler?.("SIGTERM");
      return Promise.resolve(Object.freeze({
        validationFingerprint: "sha256:test", identitySchemaReadinessProvenance: "NATIVE_MIGRATION_LEDGER_VERIFIED" as const, readiness: () => "READY" as const,
        close: () => { events.push("close"); return Promise.resolve(); },
      }));
    },
  });
  await running.shutdownComplete;
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.deepEqual(events, ["installed", "start", "close", "uninstall"]);
});

test("shutdown failure remains NOT_READY and reaches the terminal failure handler", async () => {
  const readiness = createProductionReadinessState();
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness,
    startRuntime: () => Promise.resolve(Object.freeze({
      validationFingerprint: "sha256:test", identitySchemaReadinessProvenance: "NATIVE_MIGRATION_LEDGER_VERIFIED" as const, readiness: () => "READY" as const,
      close: () => Promise.reject(new Error("unsafe internal detail")),
    })),
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
    handleShutdownFailure: () => events.push("terminal-failure"),
    terminateProcess: (code) => events.push(`terminate:${String(code)}`),
  });
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.deepEqual(events, ["uninstall", "terminal-failure", "terminate:1"]);
});

test("a bounded close timeout invokes the hard non-zero terminal action", async () => {
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness: createProductionReadinessState(),
    startRuntime: () => Promise.resolve(Object.freeze({
      validationFingerprint: "sha256:test", identitySchemaReadinessProvenance: "NATIVE_MIGRATION_LEDGER_VERIFIED" as const, readiness: () => "READY" as const,
      close: () => new Promise<void>(() => undefined),
    })),
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
    shutdownTimeoutMilliseconds: 1,
    handleShutdownFailure: () => events.push("terminal-failure"),
    terminateProcess: (code) => events.push(`terminate:${String(code)}`),
  });
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.deepEqual(events, ["uninstall", "terminal-failure", "terminate:1"]);
});
