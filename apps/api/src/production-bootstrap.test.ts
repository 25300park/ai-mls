import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import type { RegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/index.js";
import {
  assertProductionBootstrapContext,
  ProductionBootstrapError,
  type ProductionRuntimeConfiguration,
} from "./production-bootstrap.js";
import { executeProductionBootstrap, type ProductionBootstrapEngineDependencies } from "./production-bootstrap-engine.js";

function configuration(): ProductionRuntimeConfiguration {
  return Object.freeze({
    runtimeEnvironment: "PRODUCTION", configurationReference: "config:production:v1",
    requiredServiceRegistrations: Object.freeze(["registration-api-014"]), providerExecutionAuthorized: false,
  });
}

function harness(failAt?: string): Readonly<{ events: string[]; dependencies: ProductionBootstrapEngineDependencies }> {
  const events: string[] = [];
  const step = <T>(name: string, value: T): T => {
    events.push(name);
    if (failAt === name) throw new Error(`C:\\private\\${name}.sqlite SELECT secret`);
    return value;
  };
  const authority: RegisteredServiceWorkloadAuthorityLease = {
    assertSchemaReady: () => { step("identity-schema-ready", undefined); },
    findByRegistrationId: () => undefined,
    close: () => { events.push("identity-close"); },
  };
  const root = <T extends "API-014" | "API-015" | "API-018" | "API-019" | "FEAT-022">(componentId: T, event: string) => Object.freeze({
    componentId,
    activateRuntime: () => { step(`${event}-activate`, undefined); },
    close: () => { events.push(`${event}-close`); },
  });
  const dependencies: ProductionBootstrapEngineDependencies = {
    parseConfiguration: () => step("parse", configuration()),
    validateConfiguration: () => { step("validate-config", undefined); },
    validateMandatorySecretReferences: () => { step("validate-secret-refs", undefined); },
    openIdentityAuthorityReadOnly: () => step("identity-open", authority),
    validateHumanIdentityAuthority: () => { step("human-identity", undefined); },
    resolveRequiredServiceIdentities: () => step("service-identities", Object.freeze([Object.freeze({
      registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-publication",
      principalType: "SERVICE" as const, assurance: "WORKLOAD" as const, environment: "PRODUCTION" as const,
      workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 1,
      identityEvidenceRef: "identity-evidence:registration-api-014",
      auditEvidenceRef: "audit-evidence:registration-api-014",
    })])),
    resolveRequiredSecrets: () => { step("resolve-secrets", undefined); },
    validateStartupGate: () => step("gate-pass", "sha256:validation-fingerprint"),
    createSessionUnitOfWork: () => step("session-create", { close: () => { events.push("session-close"); } }),
    assertComponentSchemasReady: () => { step("component-schemas", undefined); },
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

test("executes the exact canonical order and constructs Session only after gate PASS", () => {
  const { events, dependencies } = harness();
  const runtime = executeProductionBootstrap({}, dependencies);
  assert.deepEqual(events, [
    "parse", "validate-config", "validate-secret-refs", "identity-open", "identity-schema-ready",
    "human-identity", "service-identities", "resolve-secrets", "gate-pass", "session-create",
    "component-schemas", "root-014-create", "root-015-create", "root-018-create", "root-019-create",
    "root-022-create", "root-014-activate", "root-015-activate", "root-018-activate",
    "root-019-activate", "root-022-activate", "listeners-start", "workers-start",
  ]);
  assert.equal(runtime.readiness(), "READY");
  assert.equal(runtime.validationFingerprint, "sha256:validation-fingerprint");
  runtime.close();
  assert.deepEqual(events.slice(-9), [
    "workers-close", "listeners-close", "root-022-close", "root-019-close", "root-018-close",
    "root-015-close", "root-014-close", "session-close", "identity-close",
  ]);
  runtime.close();
  assert.equal(events.filter((event) => event.endsWith("-close")).length, 9);
});

test("every pre-gate failure keeps Session, schema, child, listener, worker and provider side effects at zero", () => {
  for (const failAt of ["parse", "validate-config", "validate-secret-refs", "identity-open", "identity-schema-ready", "human-identity", "service-identities", "resolve-secrets", "gate-pass"]) {
    const { events, dependencies } = harness(failAt);
    assert.throws(() => executeProductionBootstrap({}, dependencies), (error: unknown) =>
      error instanceof ProductionBootstrapError && error.code === "PRODUCTION_STARTUP_UNAVAILABLE"
      && error.message === "Production runtime startup is unavailable.");
    assert.equal(events.includes("session-create"), false, failAt);
    assert.equal(events.includes("component-schemas"), false, failAt);
    assert.equal(events.some((event) => event.endsWith("-create") && event.startsWith("child-")), false, failAt);
    assert.equal(events.includes("listeners-start"), false, failAt);
    assert.equal(events.includes("workers-start"), false, failAt);
  }
});

test("post-gate partial failures clean up constructed resources in reverse order and never start later stages", () => {
  const { events, dependencies } = harness("listeners-start");
  assert.throws(() => executeProductionBootstrap({}, dependencies), ProductionBootstrapError);
  assert.equal(events.includes("workers-start"), false);
  assert.deepEqual(events.slice(-7), [
    "root-022-close", "root-019-close", "root-018-close", "root-015-close",
    "root-014-close", "session-close", "identity-close",
  ]);
});

test("a child construction failure closes every previously constructed child before Session and identity", () => {
  const { events, dependencies } = harness("root-019-create");
  assert.throws(() => executeProductionBootstrap({}, dependencies), ProductionBootstrapError);
  assert.equal(events.includes("root-022-create"), false);
  assert.equal(events.includes("listeners-start"), false);
  assert.deepEqual(events.slice(-5), [
    "root-018-close", "root-015-close", "root-014-close", "session-close", "identity-close",
  ]);
});

test("a malformed child root is closed before bootstrap fails closed", () => {
  const { events, dependencies } = harness();
  const malformed = Object.freeze({ componentId: "API-015" as const, activateRuntime: () => undefined, close: () => { events.push("malformed-child-close"); } });
  assert.throws(() => executeProductionBootstrap({}, {
    ...dependencies,
    childRootFactories: { ...dependencies.childRootFactories, "API-014": () => malformed },
  }), ProductionBootstrapError);
  assert.deepEqual(events.slice(-3), ["malformed-child-close", "session-close", "identity-close"]);
});

test("bootstrap context is non-forgeable, non-serializable proof rather than authority", () => {
  const unavailableProof = (error: unknown): boolean => error instanceof Error
    && (error as Error & { code?: string }).code === "PRODUCTION_STARTUP_UNAVAILABLE";
  assert.throws(() => assertProductionBootstrapContext({ validationFingerprint: "sha256:forged", configurationReference: "config:forged" }), unavailableProof);
  assert.throws(() => assertProductionBootstrapContext(JSON.parse(JSON.stringify({ validationFingerprint: "sha256:forged", configurationReference: "config:forged" }))), unavailableProof);
});

test("lower-environment fallback and provider activation are rejected", () => {
  for (const replacement of [
    { ...configuration(), runtimeEnvironment: "STAGING" },
    { ...configuration(), providerExecutionAuthorized: true },
  ] as unknown as ProductionRuntimeConfiguration[]) {
    const { dependencies } = harness();
    assert.throws(() => executeProductionBootstrap({}, { ...dependencies, parseConfiguration: () => replacement }), ProductionBootstrapError);
  }
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
