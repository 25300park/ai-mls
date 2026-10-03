import assert from "node:assert/strict";
import test from "node:test";
import { createRailwayProductionDependencies } from "./production-main.js";
import { ProductionBootstrapError, type ProductionBootstrapDependencies } from "./production-bootstrap.js";
import { createProductionReadinessState } from "./production-readiness-http.js";
import {
  captureRequiredSecretsManifest,
  CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION as composition,
  CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST as manifest,
  validateRequiredSecretsManifest,
} from "./production-required-secrets.js";

// Exercise the existing factory before the new contract is implemented.
const factory = createRailwayProductionDependencies as unknown as (
  environment: Readonly<Record<string, string | undefined>>,
  readiness: ReturnType<typeof createProductionReadinessState>,
  listenerFactory: undefined,
  authenticationBindings: undefined,
  manifest: unknown,
) => ProductionBootstrapDependencies;

test("explicit empty manifest passes independently without reading environment or resolving values", async () => {
  const environment = new Proxy({}, { get: (_target, key) => {
    if (typeof key === "string" && key.startsWith("AI_MLS_HUMAN_")) return undefined;
    throw new Error("No environment secret reads allowed");
  } });
  const dependencies = factory(environment, createProductionReadinessState(), undefined, undefined, { schemaVersion: 1, entries: [] });
  await dependencies.resolveRequiredSecrets({ providerExecutionAuthorized: false } as never);
});

test("missing and malformed manifests stay fail closed", async () => {
  for (const manifest of [undefined, null, {}, { schemaVersion: 1 }, { schemaVersion: 2, entries: [] }, { schemaVersion: 1, entries: {} }, { schemaVersion: 1, entries: [null] }]) {
    const dependencies = factory({}, createProductionReadinessState(), undefined, undefined, manifest);
    await assert.rejects(() => dependencies.resolveRequiredSecrets({ providerExecutionAuthorized: false } as never), ProductionBootstrapError);
  }
});

test("empty gate cannot activate a listener or worker even with an injected listener factory", async () => {
  let starts = 0;
  const dependencies = createRailwayProductionDependencies({}, createProductionReadinessState(), () => {
    starts += 1;
    throw new Error("Activation forbidden in R3-C4B");
  });
  await assert.rejects(async () => dependencies.startListeners({} as never, []), ProductionBootstrapError);
  assert.throws(() => dependencies.startWorkers({} as never, []), ProductionBootstrapError);
  assert.equal(starts, 0);
});

test("canonical manifest and composition are immutable and the gate reports zero side effects", () => {
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.entries), true);
  assert.equal(Object.isFrozen(composition), true);
  assert.equal(Object.isFrozen(composition.requiredConsumers), true);
  assert.deepEqual(validateRequiredSecretsManifest(manifest, composition), {
    status: "READY_EMPTY_MANIFEST", resolvedSecretValueCount: 0, secretResolverCallCount: 0,
    externalSecretProviderCallCount: 0, secretResolutionSideEffects: "NONE",
  });
});

test("manifest requires exact own data fields with no malformed shape or inherited defaults", () => {
  const candidates: unknown[] = [undefined, null, [], {}, { entries: [] }, { schemaVersion: "1", entries: [] },
    { schemaVersion: 1, entries: null }, { schemaVersion: 1, entries: "[]" },
    { schemaVersion: 1, entries: [], extra: "not approved" }, Object.create(manifest),
    { schemaVersion: 1, get entries(): never { throw new Error("request-private material"); } }];
  for (const candidate of candidates) assert.throws(() => validateRequiredSecretsManifest(candidate, composition), ProductionBootstrapError);
});

test("future nonempty entries fail closed rather than resolving or treating mandatory material as optional", () => {
  for (const requiredAt of ["PRE_LISTENER_REQUIRED", "PRE_WORKER_REQUIRED", "LAZY_FEATURE_REQUIRED"]) {
    assert.throws(() => validateRequiredSecretsManifest({ schemaVersion: 1, entries: [
      { secretReference: "reference:future:v1", consumerId: "future-consumer", requiredAt },
    ] }, composition), ProductionBootstrapError);
  }
  for (const entry of [null, {}, { secretReference: "", consumerId: "future", requiredAt: "OPTIONAL" }]) {
    assert.throws(() => validateRequiredSecretsManifest({ schemaVersion: 1, entries: [entry] }, composition), ProductionBootstrapError);
  }
});

test("declared unresolved mandatory consumers fail in every activation classification", () => {
  for (const requiredAt of ["PRE_LISTENER_REQUIRED", "PRE_WORKER_REQUIRED", "LAZY_FEATURE_REQUIRED"]) {
    assert.throws(() => validateRequiredSecretsManifest(manifest, { ...composition, requiredConsumers: [
      { secretReference: "reference:unresolved:v1", consumerId: "unknown-mandatory", requiredAt },
    ] }), ProductionBootstrapError);
  }
});

test("composition requires exact approved scope and preserves separate DB ownership and deferred provider", () => {
  for (const candidate of [undefined, {}, { ...composition, scope: "STAGING" },
    { ...composition, databaseSecretOwnership: "R3_C4" }, { ...composition, rel001ProviderStatus: "ACTIVE" },
    { ...composition, requiredConsumers: undefined }, { ...composition, unregisteredSecret: true }]) {
    assert.throws(() => validateRequiredSecretsManifest(manifest, candidate), ProductionBootstrapError);
  }
  assert.equal(composition.databaseSecretOwnership, "EARLIER_BOOTSTRAP");
  assert.equal(composition.rel001ProviderStatus, "DEFERRED");
  assert.deepEqual(manifest.entries, []);
});

test("factory captures a valid manifest immutably and never turns missing configuration into empty", async () => {
  const input = { schemaVersion: 1, entries: [] as unknown[] };
  const dependencies = factory({}, createProductionReadinessState(), undefined, undefined, input);
  input.entries.push({ consumerId: "injected" });
  await dependencies.resolveRequiredSecrets({ providerExecutionAuthorized: false } as never);
  assert.equal(captureRequiredSecretsManifest(undefined), undefined);
  assert.equal(captureRequiredSecretsManifest({ schemaVersion: 1 }), undefined);
});

test("failure metadata and readiness contain no supplied private material or reference value", () => {
  const privateMarker = "synthetic-private-material-not-a-credential";
  const badManifest = { schemaVersion: 1, entries: [{ secretReference: privateMarker, password: privateMarker }] };
  assert.throws(() => validateRequiredSecretsManifest(badManifest, composition), (error: unknown) => {
    assert.equal(error instanceof ProductionBootstrapError, true);
    assert.equal(String(error).includes(privateMarker), false);
    assert.equal(JSON.stringify(error).includes(privateMarker), false);
    assert.deepEqual(Object.keys(error as object).sort(), ["code", "name", "schemaReadiness"]);
    return true;
  });
  assert.equal(JSON.stringify(validateRequiredSecretsManifest(manifest, composition)).includes(privateMarker), false);
});

test("hostile manifest failures are normalized without leaking exception metadata", () => {
  const hostile = new Proxy({}, { ownKeys: (): never => { throw new Error("private fixture"); } });
  assert.throws(() => validateRequiredSecretsManifest(hostile, composition), ProductionBootstrapError);
  assert.equal(captureRequiredSecretsManifest(hostile), undefined);
});

test("Production required-secrets gate cannot authorize external provider execution", async () => {
  const dependencies = factory({}, createProductionReadinessState(), undefined, undefined, manifest);
  await assert.rejects(() => dependencies.resolveRequiredSecrets({ providerExecutionAuthorized: true } as never), ProductionBootstrapError);
});
