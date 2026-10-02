import assert from "node:assert/strict";
import test from "node:test";

import type {
  ProductionBootstrapDependencies,
  ProductionChildRoot,
  ProductionRuntimeHandle,
} from "./production-bootstrap.js";
import { ProductionBootstrapError, startProductionRuntime } from "./production-bootstrap.js";
import { createProductionReadinessState } from "./production-readiness-http.js";
import type { ProductionRuntimeHttpListenerFactory } from "./production-readiness-http.js";
import {
  RAILWAY_PRODUCTION_DEPENDENCY_CLASSIFICATION,
  createRailwayProductionDependencies,
  runProductionMain,
  type ProductionSignal,
} from "./production-main.js";
import { ProductionSecretBindingError } from "./production-secret-reference-resolver.js";
import { PostgreSqlSessionUnitOfWork, type PostgreSqlPoolPort } from "../../../modules/identity/src/index.js";

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

function r3aDependencies(environment: Readonly<Record<string, string>>): ProductionBootstrapDependencies {
  return createRailwayProductionDependencies(environment, createProductionReadinessState());
}

function productionHttpRoots(): readonly ProductionChildRoot[] {
  const handler = Object.freeze({ handle: () => Promise.reject(new Error("unused")) });
  return Object.freeze([
    Object.freeze({ componentId: "API-014" as const, httpHandler: handler, activateRuntime: () => undefined, close: () => undefined }),
    Object.freeze({ componentId: "API-015" as const, httpHandler: handler, activateRuntime: () => undefined, close: () => undefined }),
    Object.freeze({ componentId: "API-018" as const, activateRuntime: () => undefined, close: () => undefined }),
    Object.freeze({ componentId: "API-019" as const, activateRuntime: () => undefined, close: () => undefined }),
    Object.freeze({ componentId: "FEAT-022" as const, activateRuntime: () => undefined, close: () => undefined }),
  ]);
}

test("the executable composition fails closed before PostgreSQL when sealed runtime values are unbound", async () => {
  const environment = productionEnvironment();
  const dependencies = createRailwayProductionDependencies(environment);
  const configuration = dependencies.parseConfiguration(environment);

  await assert.rejects(() => dependencies.openPostgreSqlPool(configuration), ProductionSecretBindingError);
});

test("the Railway factory classifies every R3-A dependency without selecting test or development composition", () => {
  assert.deepEqual(RAILWAY_PRODUCTION_DEPENDENCY_CLASSIFICATION, {
    openIdentityAuthorityReadOnly: "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE",
    validateHumanIdentityAuthority: "NEW_IMPLEMENTATION_REQUIRED",
    resolveRequiredServiceIdentities: "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE",
    resolveRequiredSecrets: "EXTERNAL_PREREQUISITE",
    validateStartupGate: "NEW_IMPLEMENTATION_REQUIRED",
    createSessionUnitOfWork: "EXISTING_APPROVED_ADAPTER",
    assertComponentSchemasReady: "REQUIRES_R3_B_CHILD_ROOT_POSTGRES",
    childRootOptions: "REQUIRES_R3_B_CHILD_ROOT_POSTGRES",
    startListeners: "EXISTING_APPROVED_ADAPTER",
    startWorkers: "NEW_IMPLEMENTATION_REQUIRED",
  });
});

test("the Railway factory wires Session and API-014/015/018/019 boundaries while FEAT-022 stays fail closed", async () => {
  const dependencies = r3aDependencies(productionEnvironment());
  const pool: PostgreSqlPoolPort = Object.freeze({
    connect: () => Promise.reject(new Error("unused")),
    close: () => Promise.resolve(),
  });

  const session = await dependencies.createSessionUnitOfWork(pool);
  assert.equal(session instanceof PostgreSqlSessionUnitOfWork, true);
  await session.close();
  await assert.rejects(() => dependencies.openIdentityAuthorityReadOnly(pool), ProductionBootstrapError);
  assert.equal(dependencies.childRootOptions?.api014.runtimeEnvironment, "PRODUCTION");
  assert.equal(dependencies.childRootOptions?.api015?.runtimeEnvironment, "PRODUCTION");
  assert.equal(dependencies.childRootOptions?.api015?.policyVersion, "REL002-R3B3");
  assert.equal(dependencies.childRootOptions?.api018?.runtimeEnvironment, "PRODUCTION");
  assert.throws(() => dependencies.childRootOptions?.api018?.contextResolver.resolve("session-r3b4"), ProductionBootstrapError);
  assert.notEqual(dependencies.childRootOptions?.api019, null);
  assert.equal(dependencies.childRootOptions?.feat022, null);
  await assert.rejects(() => startProductionRuntime(productionEnvironment(), dependencies), ProductionBootstrapError);
  assert.throws(() => dependencies.startWorkers({} as never, []), ProductionBootstrapError);
});

test("the Railway factory composes exactly one injectable listener and no duplicate worker engine", async () => {
  let created = 0;
  let started = 0;
  let closed = 0;
  const listenerFactory: ProductionRuntimeHttpListenerFactory = () => {
    created += 1;
    return Object.freeze({
      port: 8080,
      start: () => { started += 1; return Promise.resolve(); },
      close: () => { closed += 1; return Promise.resolve(); },
    });
  };
  const factory = createRailwayProductionDependencies as unknown as (
    environment: Readonly<Record<string, string>>,
    readiness: ReturnType<typeof createProductionReadinessState>,
    listenerFactory: ProductionRuntimeHttpListenerFactory,
  ) => ProductionBootstrapDependencies;
  const dependencies = factory(productionEnvironment(), createProductionReadinessState(), listenerFactory);
  const listener = await dependencies.startListeners({} as never, productionHttpRoots());

  assert.equal(created, 1);
  assert.equal(started, 1);
  assert.throws(() => dependencies.startWorkers({} as never, productionHttpRoots()), ProductionBootstrapError);
  await listener.close();
  assert.equal(closed, 1);
});

test("the Railway factory rejects migration, SQLite, localhost, and raw DATABASE_URL runtime authorities", () => {
  const rejected = [
    { IDENTITY_DATABASE_USER: "ai_mls_production_migration_operator" },
    { IDENTITY_PERSISTENCE_ENGINE: "SQLITE" },
    { IDENTITY_DATABASE_HOST: "localhost" },
    { DATABASE_URL: "postgresql://runtime:secret@localhost/postgres" },
  ];
  for (const override of rejected) {
    const environment = { ...productionEnvironment(), ...override };
    const dependencies = r3aDependencies(environment);
    assert.throws(() => dependencies.parseConfiguration(environment));
  }
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
