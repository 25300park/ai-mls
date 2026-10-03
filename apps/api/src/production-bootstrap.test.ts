import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import type { AsyncRegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/index.js";
import {
  assertProductionBootstrapContext,
  ProductionBootstrapError,
  type ProductionRuntimeConfiguration,
} from "./production-bootstrap.js";
import { executeProductionBootstrap, type ProductionBootstrapEngineDependencies } from "./production-bootstrap-engine.js";
import {
  assertCanonicalProductionChildRootsPostgreSqlReady,
  type CanonicalProductionChildRootOptions,
} from "./production-child-root-registry.js";

function configuration(): ProductionRuntimeConfiguration {
  return Object.freeze({
    runtimeEnvironment: "PRODUCTION", configurationReference: "config:production:v1",
    requiredServiceRegistrations: Object.freeze(["registration-api-014"]), providerExecutionAuthorized: false,
    identityPersistenceEngine: "POSTGRESQL",
  });
}

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
    "root-019-activate", "root-022-activate", "workers-start",
  ]);
  assert.equal(runtime.readiness(), "READY");
  assert.equal(runtime.validationFingerprint, "sha256:validation-fingerprint");
  await runtime.close();
  assert.deepEqual(events.slice(-10), [
    "listeners-close", "workers-close", "root-022-close", "root-019-close", "root-018-close",
    "root-015-close", "root-014-close", "session-close", "identity-close", "pool-close",
  ]);
  await runtime.close();
  assert.equal(events.filter((event) => event.endsWith("-close")).length, 10);
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
  assert.deepEqual(events.slice(-10), [
    "listeners-close-failed", "workers-close", "root-022-close", "root-019-close", "root-018-close",
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

test('service and Human readiness PASS cannot bypass the unchanged Required Secrets blocker',async()=>{
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
