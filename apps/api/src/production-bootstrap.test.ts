import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { AsyncRegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/index.js";
import {
  assertProductionBootstrapContext,
  ProductionBootstrapError,
  type ProductionRuntimeConfiguration,
} from "./production-bootstrap.js";
import { executeProductionBootstrap, type ProductionBootstrapEngineDependencies } from "./production-bootstrap-engine.js";
import { CURRENT_PRODUCTION_REQUIRED_WORKERS_MANIFEST } from "./production-runtime-activation.js";
import { createProductionReadinessState, createProductionRuntimeHttpListener } from "./production-readiness-http.js";
import { runProductionMain } from "./production-main.js";
import type { ProductionBootstrapDependencies } from "./production-bootstrap.js";
import { ProductionRuntimeObservability } from "./production-runtime-observability.js";
import { CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST, CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION, validateRequiredSecretsManifest } from "./production-required-secrets.js";
import {
  assertCanonicalProductionChildRootsPostgreSqlReady,
  type CanonicalProductionChildRootOptions,
} from "./production-child-root-registry.js";

test("R3F fresh composition restarts with distinct evidence and one new pool after clean shutdown", async () => {
  const attempts = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const f = harness();
    const observation = new ProductionRuntimeObservability();
    assert.equal(observation.snapshot().readiness, "NOT_READY");
    const runtime = await executeProductionBootstrap({}, { ...f.dependencies, observability: observation });
    attempts.push(observation.snapshot());
    assert.equal(runtime.readiness(), "READY");
    assert.equal(observation.snapshot().physicalPoolCount, 1);
    assert.equal(observation.snapshot().requiredWorkerCount, 0);
    const close = runtime.close();
    assert.equal(observation.snapshot().readiness, "NOT_READY");
    await Promise.all([close, runtime.close(), runtime.close()]);
    assert.equal(observation.snapshot().startupPhase, "STOPPED");
    assert.equal(observation.snapshot().poolReadiness, "CLOSED");
    assert.equal(f.events.filter(e => e === "pool-open").length, 1);
    assert.equal(f.events.filter(e => e === "pool-close").length, 1);
    assert.equal(f.events.filter(e => e === "listeners-start").length, 1);
    assert.equal(f.events.filter(e => e === "listeners-close").length, 1);
  }
  assert.notEqual(attempts[0]?.runtimeAttemptId, attempts[1]?.runtimeAttemptId);
  assert.equal(attempts[0]?.startupPhase, "RUNTIME_READY");
});

test("R3F canonical fresh-process bootstraps terminate without retained fixture handles", () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const environment = { ...process.env };
    delete environment["NODE_TEST_CONTEXT"];
    const child = spawnSync(process.execPath, ["--test", "--test-name-pattern=R3F fresh composition", fileURLToPath(import.meta.url)], { env: environment, encoding: "utf8", timeout: 15_000 });
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.match(child.stdout, /R3F fresh composition/);
  }
});

test("R3F failed startup rolls back ownership and cannot poison a fresh attempt", async () => {
  for (const point of ["listeners-start", "root-018-activate", "component-schemas"]) {
    const f = harness(point);
    const observation = new ProductionRuntimeObservability();
    await assert.rejects(executeProductionBootstrap({}, { ...f.dependencies, observability: observation }));
    const failed = observation.snapshot();
    assert.equal(failed.startupPhase, "STARTUP_FAILED");
    assert.equal(failed.readiness, "NOT_READY");
    assert.equal(f.events.filter(e => e === "pool-close").length, 1);
    assert.equal(f.events.at(-1), "pool-close");
    if (point === "root-018-activate") assert.equal(f.events.filter(e => e === "listeners-close").length, 1);
    const next = harness();
    const runtime = await executeProductionBootstrap({}, next.dependencies);
    assert.equal(runtime.readiness(), "READY");
    assert.notEqual(runtime.startupEvidence?.().runtimeAttemptId, failed.runtimeAttemptId);
    await runtime.close();
    assert.equal(observation.snapshot().startupPhase, "STARTUP_FAILED");
    assert.equal(next.events.filter(e => e === "pool-close").length, 1);
  }
});

function configuration(): ProductionRuntimeConfiguration {
  return Object.freeze({
    runtimeEnvironment: "PRODUCTION", configurationReference: "config:production:v1",
    requiredServiceRegistrations: Object.freeze(["registration-api-014"]), providerExecutionAuthorized: false,
    identityPersistenceEngine: "POSTGRESQL",
  });
}

test("initial authority/schema failure diagnostics distinguish gates without exposing raw errors", async context => {
 const lines:string[]=[];
 context.mock.method(process.stderr,'write',(chunk:unknown):boolean=>{lines.push(String(chunk));return true;});
 for(const [failure,stage] of [['identity-open','INITIAL_IDENTITY_AUTHORITY_OPEN'],['identity-schema-ready','INITIAL_IDENTITY_READINESS']]) {
  lines.length=0;const f=harness(failure);
  await assert.rejects(executeProductionBootstrap({},f.dependencies));
  const diagnostics=lines.filter(line=>line.includes('PRODUCTION_RUNTIME_DATABASE_DIAGNOSTIC')).map(line=>JSON.parse(line) as Record<string,unknown>);
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0]?.['stage'],stage);assert.equal(diagnostics[0]?.['code'],'READINESS_UNAVAILABLE');
  assert.doesNotMatch(lines.join(''),/private|SELECT secret/u);
  assert.equal(f.events.filter(event=>event==='pool-close').length,1);
  assert.ok(!f.events.includes('listeners-start'));
 }
});

function harness(failAt?: string): Readonly<{ events: string[]; dependencies: ProductionBootstrapEngineDependencies }> {
  const events: string[] = [];
  const step = <T>(name: string, value: T): T => {
    events.push(name);
    if (failAt === name) throw new Error(`C:\\private\\${name}.sqlite SELECT secret`);
    return value;
  };
  const authority: AsyncRegisteredServiceWorkloadAuthorityLease = {
    assertSchemaReady: () => { step("identity-schema-ready", undefined); return Promise.resolve("HISTORICAL_MIGRATION_ATTESTATION_VERIFIED" as const); },
    findByRegistrationId: () => Promise.resolve(undefined),
    close: () => { events.push("identity-close"); return Promise.resolve(); },
  };
  const root = <T extends "API-014" | "API-015" | "API-018" | "API-019" | "FEAT-022">(componentId: T, event: string) => Object.freeze({
    componentId,
    activateRuntime: () => { step(`${event}-activate`, undefined); },
    close: event === "root-014"
      ? async () => { await Promise.resolve(); events.push(`${event}-close`); }
      : () => { events.push(`${event}-close`); },
  });
  const dependencies: ProductionBootstrapEngineDependencies = {
    ...{ requiredWorkersManifest: CURRENT_PRODUCTION_REQUIRED_WORKERS_MANIFEST },
    parseConfiguration: () => step("parse", configuration()),
    validateConfiguration: () => { step("validate-config", undefined); },
    validateMandatorySecretReferences: () => { step("validate-secret-refs", undefined); },
    openPostgreSqlPool: () => Promise.resolve(step("pool-open", { connect: () => Promise.reject(new Error("unused")), close: () => { events.push("pool-close"); return Promise.resolve(); } })),
    openIdentityAuthorityReadOnly: () => Promise.resolve(step("identity-open", authority)),
    validateHumanIdentityAuthority: () => { step("human-identity", undefined); },
    resolveRequiredServiceIdentities: () => Promise.resolve(step("service-identities", Object.freeze([Object.freeze({
      registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-publication",
      principalType: "SERVICE" as const, assurance: "WORKLOAD" as const, environment: "PRODUCTION" as const,
      workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 1,
      identityEvidenceRef: "identity-evidence:registration-api-014",
      auditEvidenceRef: "audit-evidence:registration-api-014",
    })]))),
    resolveRequiredSecrets: () => { step("resolve-secrets", undefined); return Promise.resolve(); },
    validateStartupGate: () => step("gate-pass", "sha256:validation-fingerprint"),
    createSessionUnitOfWork: () => Promise.resolve(step("session-create", { close: () => { events.push("session-close"); return Promise.resolve(); } })),
    assertComponentSchemasReady: () => { step("component-schemas", undefined); return Promise.resolve(); },
    childRootFactories: {
      "API-014": (context) => { assertProductionBootstrapContext(context); return step("root-014-create", root("API-014", "root-014")); },
      "API-015": (context) => { assertProductionBootstrapContext(context); return step("root-015-create", root("API-015", "root-015")); },
      "API-018": (context) => { assertProductionBootstrapContext(context); return step("root-018-create", root("API-018", "root-018")); },
      "API-019": (context) => { assertProductionBootstrapContext(context); return step("root-019-create", root("API-019", "root-019")); },
      "FEAT-022": (context) => { assertProductionBootstrapContext(context); return step("root-022-create", root("FEAT-022", "root-022")); },
    },
    startListeners: (context) => {
      assertProductionBootstrapContext(context);
      return step("listeners-start", Object.freeze({ close: () => { events.push("listeners-close"); } }));
    },
    startWorkers: (context) => {
      assertProductionBootstrapContext(context);
      return step("workers-start", Object.freeze({ close: () => { events.push("workers-close"); } }));
    },
  };
  return Object.freeze({ events, dependencies });
}

test("executes the exact canonical order and constructs Session only after gate PASS", async () => {
  const { events, dependencies } = harness();
  const runtime = await executeProductionBootstrap({}, dependencies);
  assert.equal(runtime.identitySchemaReadinessProvenance, "HISTORICAL_MIGRATION_ATTESTATION_VERIFIED");
  assert.deepEqual(events, [
    "parse", "validate-config", "validate-secret-refs", "pool-open", "identity-open", "identity-schema-ready",
    "service-identities", "gate-pass", "human-identity", "resolve-secrets", "component-schemas",
    "session-create", "root-014-create", "root-015-create", "root-018-create", "root-019-create",
    "root-022-create", "listeners-start", "root-014-activate", "root-015-activate", "root-018-activate",
    "root-019-activate", "root-022-activate",
  ]);
  assert.equal(runtime.readiness(), "READY");
  assert.equal(runtime.validationFingerprint, "sha256:validation-fingerprint");
  assert.equal(runtime.startupEvidence?.().readiness, "READY");
  assert.equal(runtime.startupEvidence?.().requiredWorkerCount, 0);
  await runtime.close();
  assert.equal(runtime.startupEvidence?.().startupPhase, "STOPPED");
  assert.equal(runtime.startupEvidence?.().poolReadiness, "CLOSED");
  assert.deepEqual(events.slice(-9), [
    "listeners-close", "root-022-close", "root-019-close", "root-018-close",
    "root-015-close", "root-014-close", "session-close", "identity-close", "pool-close",
  ]);
  await runtime.close();
  assert.equal(events.filter((event) => event.endsWith("-close")).length, 9);
});

test("bootstrap publishes exact safe gate failures and complete phase evidence without extra database reads", async () => {
  for (const [failAt, gate] of [["service-identities", "serviceWorkloadGate"], ["human-identity", "humanIdentityGate"], ["resolve-secrets", "requiredSecretsGate"]] as const) {
    const f = harness(failAt);
    const logs: ReturnType<ProductionRuntimeObservability["snapshot"]>[] = [];
    const observation = new ProductionRuntimeObservability({ sink: (snapshot) => { logs.push(snapshot); } });
    await assert.rejects(() => executeProductionBootstrap({}, { ...f.dependencies, observability: observation }));
    const snapshot = observation.snapshot();
    assert.equal(snapshot.startupPhase, "STARTUP_FAILED"); assert.equal(snapshot[gate], "FAILED");
    assert.equal(snapshot.failureCode, "PRE_LISTENER_NOT_READY"); assert.equal(snapshot.readiness, "NOT_READY");
    assert.equal(snapshot.listenerState, "NOT_STARTED"); assert.equal(snapshot.poolReadiness, "CLOSED");
    assert.equal(JSON.stringify(logs).includes("private"), false); assert.equal(JSON.stringify(logs).includes("SELECT"), false);
    assert.equal(f.events.filter((event) => event === "pool-open").length, 1);
  }
});

test("listener failure and shutdown failure remain distinct observed classifications", async () => {
  const f = harness("listeners-start");
  const observation = new ProductionRuntimeObservability();
  await assert.rejects(() => executeProductionBootstrap({}, { ...f.dependencies, observability: observation }));
  assert.equal(observation.snapshot().failureCode, "LISTENER_START_FAILED");
  assert.equal(observation.snapshot().listenerState, "FAILED");
  const successful = harness();
  const runtime = await executeProductionBootstrap({}, { ...successful.dependencies, startListeners: () => ({ close: () => { throw new Error("private close"); } }) });
  await assert.rejects(() => runtime.close());
  assert.equal(runtime.startupEvidence?.().startupPhase, "SHUTDOWN_FAILED");
  assert.equal(runtime.startupEvidence?.().failureCode, "SHUTDOWN_FAILED");
  assert.equal(runtime.startupEvidence?.().poolReadiness, "CLOSED");
});

test("pool-only shutdown failure preserves successful listener and zero-worker cleanup evidence", async () => {
  const f = harness();
  const runtime = await executeProductionBootstrap({}, { ...f.dependencies,
    openPostgreSqlPool: () => Promise.resolve({ connect: () => Promise.reject(new Error("unused")), close: () => Promise.reject(new Error("private pool failure")) }),
  });
  await assert.rejects(() => runtime.close());
  const snapshot = runtime.startupEvidence!();
  assert.equal(snapshot.startupPhase, "SHUTDOWN_FAILED"); assert.equal(snapshot.failureCode, "SHUTDOWN_FAILED");
  assert.equal(snapshot.listenerState, "STOPPED"); assert.equal(snapshot.workerState, "STOPPED");
  assert.equal(snapshot.requiredWorkerCount, 0); assert.equal(snapshot.poolReadiness, "FAILED");
});

test("missing or unknown worker manifest blocks before listener and releases the sole pool", async () => {
  for (const manifest of [undefined, { schemaVersion: 1, workers: ["API-017"] }]) {
    const f = harness();
    const dependencies = { ...f.dependencies, requiredWorkersManifest: manifest };
    await assert.rejects(() => executeProductionBootstrap({}, dependencies), { reason: "WORKER_MANIFEST_INVALID" });
    assert.equal(f.events.includes("listeners-start"), false);
    assert.equal(f.events.includes("workers-start"), false);
    assert.equal(f.events.filter((event) => event === "pool-close").length, 1);
    assert.ok(f.events.includes("resolve-secrets"));
  }
});

test("duplicate bootstrap rejects before a second pool or listener is created", async () => {
  const f = harness();
  const first = executeProductionBootstrap({}, f.dependencies);
  await assert.rejects(() => executeProductionBootstrap({}, f.dependencies), { reason: "DUPLICATE_ACTIVATION" });
  const runtime = await first;
  await assert.rejects(() => executeProductionBootstrap({}, f.dependencies), { reason: "DUPLICATE_ACTIVATION" });
  await runtime.close();
  assert.equal(f.events.filter((event) => event === "pool-open").length, 1);
  assert.equal(f.events.filter((event) => event === "listeners-start").length, 1);
});

test("hung child cleanup cannot prevent remaining Session, authority and pool cleanup", async () => {
  const f = harness();
  const dependencies = { ...f.dependencies, cleanupTimeoutMilliseconds: 20,
    childRootFactories: { ...f.dependencies.childRootFactories,
      "FEAT-022": () => ({ componentId: "FEAT-022" as const, activateRuntime: () => undefined,
        close: () => { f.events.push("hung-close"); return new Promise<void>(() => undefined); } }),
    } };
  const runtime = await executeProductionBootstrap({}, dependencies);
  await assert.rejects(() => runtime.close(), { reason: "SHUTDOWN_FAILED" });
  assert.equal(f.events.filter((event) => event === "pool-close").length, 1);
  assert.deepEqual(f.events.slice(-3), ["session-close", "identity-close", "pool-close"]);
});

test("composed empty-worker startup reaches READY on a disposable local listener and closes the borrowed pool once", async () => {
  let port = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
  const f = harness();
  const readiness = createProductionReadinessState();
  let listener: ReturnType<typeof createProductionRuntimeHttpListener> | undefined;
  const dependencies = { ...f.dependencies, startListeners: async (_context: unknown, roots: Parameters<typeof createProductionRuntimeHttpListener>[0]["roots"]) => {
    assert.equal(readiness.readiness(), "NOT_READY");
    listener = createProductionRuntimeHttpListener({ port, readiness, roots: roots.map((root) => ({ ...root,
      ...(["API-014", "API-015"].includes(root.componentId) ? { httpHandler: { handle: () => Promise.resolve({ statusCode: 503, headers: {}, body: {}, requestId: "fixture" }) } } : {}) })) });
    await listener.start();
    port = listener.port;
    return { stopAccepting: () => listener!.stopAccepting!(), close: () => listener!.close() };
  } };
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness, startRuntime: () => executeProductionBootstrap({}, dependencies), installSignalHandler: () => () => undefined,
  });
  try {
    assert.equal(readiness.readiness(), "READY");
    const response = await fetch(`http://127.0.0.1:${listener!.port}/readyz`);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "READY" });
    assert.equal(f.events.includes("workers-start"), false);
  } finally { await running.shutdown(); }
  await running.shutdown();
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.equal(f.events.filter((event) => event === "pool-open").length, 1);
  assert.equal(f.events.filter((event) => event === "pool-close").length, 1);
  }
});

test("every pre-gate failure keeps Session, schema, child, listener, worker and provider side effects at zero", async () => {
  for (const failAt of ["parse", "validate-config", "validate-secret-refs", "pool-open", "identity-open", "identity-schema-ready", "human-identity", "service-identities", "resolve-secrets", "gate-pass"]) {
    const { events, dependencies } = harness(failAt);
    await assert.rejects(() => executeProductionBootstrap({}, dependencies), (error: unknown) =>
      error instanceof ProductionBootstrapError && error.code === "PRODUCTION_STARTUP_UNAVAILABLE"
      && error.message === "Production runtime startup is unavailable.");
    assert.equal(events.includes("session-create"), false, failAt);
    assert.equal(events.includes("component-schemas"), false, failAt);
    assert.equal(events.some((event) => event.endsWith("-create") && event.startsWith("child-")), false, failAt);
    assert.equal(events.includes("listeners-start"), false, failAt);
    assert.equal(events.includes("workers-start"), false, failAt);
  }
});

test("post-gate partial failures clean up constructed resources in reverse order and never start later stages", async () => {
  const { events, dependencies } = harness("listeners-start");
  await assert.rejects(() => executeProductionBootstrap({}, dependencies), ProductionBootstrapError);
  assert.equal(events.includes("workers-start"), false);
  assert.deepEqual(events.slice(-8), [
    "root-022-close", "root-019-close", "root-018-close", "root-015-close",
    "root-014-close", "session-close", "identity-close", "pool-close",
  ]);
});

test("a runtime activation failure after bind closes the listener before every child resource", async () => {
  const { events, dependencies } = harness("root-019-activate");
  await assert.rejects(() => executeProductionBootstrap({}, dependencies), ProductionBootstrapError);
  assert.equal(events.includes("workers-start"), false);
  assert.deepEqual(events.slice(-9), [
    "listeners-close", "root-022-close", "root-019-close", "root-018-close", "root-015-close",
    "root-014-close", "session-close", "identity-close", "pool-close",
  ]);
});

test("shutdown reports listener failure after completing worker, child, Session, identity, and pool cleanup", async () => {
  const { events, dependencies } = harness();
  const runtime = await executeProductionBootstrap({}, {
    ...dependencies,
    startListeners: () => Object.freeze({
      close: () => { events.push("listeners-close-failed"); throw new Error("C:\\private\\listener.sock"); },
    }),
  });
  await assert.rejects(() => runtime.close(), ProductionBootstrapError);
  assert.deepEqual(events.slice(-9), [
    "listeners-close-failed", "root-022-close", "root-019-close", "root-018-close",
    "root-015-close", "root-014-close", "session-close", "identity-close", "pool-close",
  ]);
});

test("a child construction failure closes every previously constructed child before Session and identity", async () => {
  const { events, dependencies } = harness("root-019-create");
  await assert.rejects(() => executeProductionBootstrap({}, dependencies), ProductionBootstrapError);
  assert.equal(events.includes("root-022-create"), false);
  assert.equal(events.includes("listeners-start"), false);
  assert.deepEqual(events.slice(-6), [
    "root-018-close", "root-015-close", "root-014-close", "session-close", "identity-close", "pool-close",
  ]);
});

test("a malformed child root is closed before bootstrap fails closed", async () => {
  const { events, dependencies } = harness();
  const malformed = Object.freeze({ componentId: "API-015" as const, activateRuntime: () => undefined, close: () => { events.push("malformed-child-close"); } });
  await assert.rejects(() => executeProductionBootstrap({}, {
    ...dependencies,
    childRootFactories: { ...dependencies.childRootFactories, "API-014": () => malformed },
  }), ProductionBootstrapError);
  assert.deepEqual(events.slice(-4), ["malformed-child-close", "session-close", "identity-close", "pool-close"]);
});

test("bootstrap context is non-forgeable, non-serializable proof rather than authority", () => {
  const unavailableProof = (error: unknown): boolean => error instanceof Error
    && (error as Error & { code?: string }).code === "PRODUCTION_STARTUP_UNAVAILABLE";
  assert.throws(() => assertProductionBootstrapContext({ validationFingerprint: "sha256:forged", configurationReference: "config:forged" }), unavailableProof);
  assert.throws(() => assertProductionBootstrapContext(JSON.parse(JSON.stringify({ validationFingerprint: "sha256:forged", configurationReference: "config:forged" }))), unavailableProof);
});

test("lower-environment fallback, SQLite, and provider activation are rejected", async () => {
  for (const replacement of [
    { ...configuration(), runtimeEnvironment: "STAGING" },
    { ...configuration(), providerExecutionAuthorized: true },
    { ...configuration(), identityPersistenceEngine: "SQLITE" },
  ] as unknown as ProductionRuntimeConfiguration[]) {
    const { dependencies } = harness();
    await assert.rejects(() => executeProductionBootstrap({}, { ...dependencies, parseConfiguration: () => replacement }), ProductionBootstrapError);
  }
});

test("canonical Production entry rejects every remaining SQLite child-root path before bootstrap", () => {
  const options = {
    api014: { databasePath: "api014.sqlite" }, api015: {}, api018: {}, api019: {}, feat022: {},
  } as unknown as CanonicalProductionChildRootOptions;
  assert.throws(() => assertCanonicalProductionChildRootsPostgreSqlReady(options), /persistence is unavailable/u);
});

test("a Production process cannot call a governed root without an issued bootstrap context", () => {
  const moduleUrl = new URL("./production-bootstrap.js", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import { assertProductionRootBootstrapContext } from ${JSON.stringify(moduleUrl)};
    try { assertProductionRootBootstrapContext(undefined); process.exit(9); }
    catch (error) { if (error?.code !== "PRODUCTION_STARTUP_UNAVAILABLE") process.exit(8); }
  `], { encoding: "utf8", env: { ...process.env, NODE_TEST_CONTEXT: "" } });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

test("R3-B7 concurrent bootstrap close waits for the same owned resource shutdown", async () => {
 const { dependencies, events } = harness();let release!:()=>void;const drain=new Promise<void>(r=>{release=r;});
 const runtime=await executeProductionBootstrap({}, {...dependencies,startListeners:()=>({close:async()=>{events.push("listeners-close");await drain;}})});
 let firstDone=false;let secondDone=false;const first=runtime.close().then(()=>{firstDone=true;});const second=runtime.close().then(()=>{secondDone=true;});
 await Promise.resolve();await Promise.resolve();assert.equal(firstDone,false);assert.equal(secondDone,false);release();await Promise.all([first,second]);assert.equal(events.filter(e=>e==="pool-close").length,1);
});

test("R3-B8 aggregate failure prevents all downstream construction and exhaustively closes prerequisites",async()=>{
 const {events,dependencies}=harness("component-schemas");
 await assert.rejects(()=>executeProductionBootstrap({},dependencies),ProductionBootstrapError);
 assert.equal(events.includes("session-create"),false); assert.equal(events.some(e=>e.startsWith("root-")),false);
 assert.equal(events.includes("listeners-start"),false); assert.equal(events.includes("workers-start"),false);
 assert.deepEqual(events.slice(-2),["identity-close","pool-close"]);
});

test("R3-B8 bootstrap preserves safe aggregate evidence while closing prerequisites", async () => {
  const {events,dependencies}=harness();
  const readiness = await import("./child-root-postgresql-readiness.js");
  const pool = { connect: () => Promise.reject(new Error("unsafe-driver private-host stack")), close: () => Promise.resolve() };
  await assert.rejects(() => executeProductionBootstrap({}, {
    ...dependencies, assertComponentSchemasReady: () => readiness.assertR3B1ChildRootSchemasReady(pool),
  }), (error: unknown) => {
    assert.ok(error instanceof ProductionBootstrapError);
    const evidence = error.schemaReadiness;
    assert.ok(evidence); assert.equal(evidence.status,"NOT_READY"); assert.equal(evidence.children.length,5); assert.equal(evidence.failingSchemas.length,5);
    assert.ok(evidence.children.every(c=>c.reason==="READINESS_UNAVAILABLE"));
    assert.doesNotMatch(JSON.stringify(error),/unsafe-driver|private-host|stack/u);
    return true;
  });
  assert.equal(events.includes("session-create"),false);
  assert.deepEqual(events.slice(-2),["identity-close","pool-close"]);
});

test('awaits async Human readiness after service gate and before secrets with owner-only cleanup',async()=>{
 const {events,dependencies}=harness();
 let rejectReadiness!:(reason:Error)=>void;
 const pending=new Promise<void>((_resolve,reject)=>{rejectReadiness=reject;});
 const start=executeProductionBootstrap({}, {...dependencies,validateHumanIdentityAuthority:()=>{events.push('human-identity');return pending;}});
 const rejected=assert.rejects(start,ProductionBootstrapError);
 await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(events.includes('gate-pass'),true);
 assert.equal(events.includes('resolve-secrets'),false);
 assert.equal(events.includes('listeners-start'),false);
 rejectReadiness(new Error('private credential detail'));
 await rejected;
 assert.deepEqual(events.slice(-2),['identity-close','pool-close']);
 assert.equal(events.filter(e=>e==='pool-close').length,1);
});

test('service and Human readiness PASS cannot bypass a Required Secrets failure',async()=>{
 const {events,dependencies}=harness();
 await assert.rejects(executeProductionBootstrap({}, {...dependencies,
  validateHumanIdentityAuthority:async()=>{await Promise.resolve();events.push('human-identity');},
  resolveRequiredSecrets:()=>{events.push('resolve-secrets');return Promise.reject(new Error('required secrets unavailable'));},
 }),ProductionBootstrapError);
 assert.ok(events.indexOf('gate-pass')<events.indexOf('human-identity'));
 assert.ok(events.indexOf('human-identity')<events.indexOf('resolve-secrets'));
 assert.equal(events.includes('listeners-start'),false);assert.equal(events.includes('workers-start'),false);
 assert.equal(events.includes('session-create'),false);assert.equal(events.includes('component-schemas'),false);
 assert.deepEqual(events.slice(-2),['identity-close','pool-close']);
});

test("earlier DB bootstrap failure blocks startup before a valid empty secret gate", async () => {
 const {events,dependencies}=harness("pool-open");
 let gates=0;
 await assert.rejects(executeProductionBootstrap({}, {...dependencies,resolveRequiredSecrets:()=>{
  gates+=1;validateRequiredSecretsManifest(CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST,CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION);
  return Promise.resolve();
 }}),ProductionBootstrapError);
 assert.equal(gates,0);
 assert.equal(events.includes("human-identity"),false);
 assert.equal(events.includes("listeners-start"),false);
 assert.equal(events.includes("workers-start"),false);
});

test("empty secret gate follows Identity gates and preserves cleanup at the activation hold", async () => {
 const {events,dependencies}=harness();
 await assert.rejects(executeProductionBootstrap({}, {...dependencies,resolveRequiredSecrets:()=>{
  validateRequiredSecretsManifest(CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST,CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION);
  events.push("empty-secrets-ready");
  return Promise.resolve();
 },startListeners:()=>{throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");}}),(error:unknown)=>{
  assert.ok(error instanceof ProductionBootstrapError);
  assert.equal(Reflect.get(error,"preListenerStartupChain"),"READY");
  return true;
 });
 assert.ok(events.indexOf("human-identity")<events.indexOf("empty-secrets-ready"));
 assert.ok(events.indexOf("empty-secrets-ready")<events.indexOf("component-schemas"));
 assert.equal(events.includes("listeners-start"),false);
 assert.equal(events.includes("workers-start"),false);
 assert.equal(events.some(event=>event.endsWith("-activate")),false);
 assert.equal(events.filter(event=>event==="pool-open").length,1);
 assert.equal(events.filter(event=>event==="pool-close").length,1);
 assert.deepEqual(events.slice(-8),["root-022-close","root-019-close","root-018-close","root-015-close","root-014-close","session-close","identity-close","pool-close"]);
});

test("each pre-listener gate failure exposes BLOCKED and never runs downstream gates", async () => {
 for (const failAt of ["gate-pass", "human-identity", "resolve-secrets"]) {
  const {events,dependencies}=harness(failAt);
  await assert.rejects(executeProductionBootstrap({},dependencies),(error:unknown)=>{
   assert.ok(error instanceof ProductionBootstrapError);
   assert.equal(Reflect.get(error,"preListenerStartupChain"),"BLOCKED");
   assert.equal(JSON.stringify(error).includes("private"),false);
   return true;
  });
  if(failAt==="gate-pass")assert.equal(events.includes("human-identity"),false);
  if(failAt!=="resolve-secrets")assert.equal(events.includes("resolve-secrets"),false);
  assert.equal(events.includes("listeners-start"),false);
  assert.equal(events.includes("workers-start"),false);
  assert.equal(events.includes("session-create"),false);
  assert.deepEqual(events.slice(-2),["identity-close","pool-close"]);
 }
});
