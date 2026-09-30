import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createCanonicalProductionChildRootFactories } from "./production-child-root-registry.js";
import { composeProductionPublicationApi014NodeHttpServer } from "./composition.js";
import { composeProductionAdministrationApi015NodeHttpServer } from "./administration-production-composition.js";
import { issueProductionBootstrapContext } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";

test("canonical Production registry is closed to the five approved actual roots", () => {
  const registry = createCanonicalProductionChildRootFactories({
    api014: {} as never, api015: {} as never, api018: {} as never, api019: {} as never, feat022: {} as never,
  });
  assert.deepEqual(Object.keys(registry).sort(), ["API-014", "API-015", "API-018", "API-019", "FEAT-022"]);
  assert.equal(Object.isFrozen(registry), true);
});

test("API-014 and API-015 cannot create an independent listener in Production", () => {
  const bootstrapContext = issueProductionBootstrapContext({
    validationFingerprint: "sha256:production-listener-test",
    configurationReference: "config:production:v1",
  });
  assert.throws(() => composeProductionPublicationApi014NodeHttpServer({
    runtimeEnvironment: "PRODUCTION", bootstrapContext, databasePath: "unused.sqlite",
  }), /Independent Production listener is unavailable/u);
  assert.throws(() => composeProductionAdministrationApi015NodeHttpServer({
    runtimeEnvironment: "PRODUCTION", bootstrapContext, databasePath: "unused.sqlite",
  } as never), /Independent Production listener is unavailable/u);
});

test("registry binds API-014 and API-015 to the bootstrap pool without adding roots", () => {
  const source = readFileSync(new URL("./production-child-root-registry.js", import.meta.url), "utf8");
  for (const factory of [
    "composeProductionPublicationApi014HttpHandler", "composeProductionAdministrationApi015HttpHandler",
    "createProductionConnectorApi018Composition", "createProductionExternalIntegrationComposition", "createProductionAdvisoryRuntime",
  ]) assert.match(source, new RegExp(`${factory}\\(`, "u"));
  assert.equal((source.match(/schemaMode: "REQUIRE_EXISTING"/gu) ?? []).length, 3);
  assert.match(source, /api014[\s\S]*postgreSqlPool: pool[\s\S]*runtimeEnvironment: "PRODUCTION"/u);
  assert.match(source, /api015[\s\S]*postgreSqlPool: pool[\s\S]*runtimeEnvironment: "PRODUCTION"/u);
  assert.doesNotMatch(source, /API-017|API-001|API-002/u);
});

test("R3-B3 prepares API-015 PostgreSQL composition while the remaining three child roots stay explicit fail-closed", () => {
  const main = readFileSync(new URL("./production-main.js", import.meta.url), "utf8");
  assert.match(main, /api014:\s*Object\.freeze\(\{ runtimeEnvironment: "PRODUCTION" \}\)/u);
  for (const root of ["api018", "api019", "feat022"] as const) assert.match(main, new RegExp(`${root}: null`, "u"));
  assert.match(main, /assertR3B1PublicationSchemaReady\(pool\)/u);
  assert.match(main, /assertR3B1AdministrationSchemaReady\(pool\)/u);
  assert.doesNotMatch(main, /assertR3B1ChildRootSchemasReady\(pool\)/u);
});

test("only the canonical bootstrap imports the internal context issuer", () => {
  const bootstrap = readFileSync(new URL("./production-bootstrap.js", import.meta.url), "utf8");
  const engine = readFileSync(new URL("./production-bootstrap-engine.js", import.meta.url), "utf8");
  const registry = readFileSync(new URL("./production-child-root-registry.js", import.meta.url), "utf8");
  assert.match(bootstrap, /createCanonicalProductionChildRootFactories/u);
  assert.match(engine, /issueProductionBootstrapContext/u);
  assert.doesNotMatch(registry, /issueProductionBootstrapContext/u);
});

test("canonical entry binds the closed actual registry and the engine remains an internal test seam", () => {
  const bootstrap = readFileSync(new URL("./production-bootstrap.js", import.meta.url), "utf8");
  const sourceTest = readFileSync(new URL("./production-bootstrap.test.js", import.meta.url), "utf8");
  assert.match(bootstrap, /childRootFactories:\s*createCanonicalProductionChildRootFactories\(dependencies\.childRootOptions\)/u);
  assert.match(sourceTest, /executeProductionBootstrap/u);
  assert.doesNotMatch(bootstrap, /childRootFactories:\s*dependencies\.childRootFactories/u);
});

test("actual root registry defers process activation until all roots have been prepared", () => {
  const source = readFileSync(new URL("./production-child-root-registry.js", import.meta.url), "utf8");
  assert.equal((source.match(/runtimeEnvironment: "PRODUCTION"/gu) ?? []).length, 5);
  assert.equal((source.match(/deferRuntimeActivation: true/gu) ?? []).length, 3);
  assert.equal((source.match(/activateRuntime:/gu) ?? []).length, 5);
  assert.equal((source.match(/httpHandler: root\.httpHandler/gu) ?? []).length, 2);
  assert.doesNotMatch(source, /listener: root\.server/u);
});

test("internal bootstrap engine and context issuer have no alternate production importer", () => {
  const grep = (pattern: string): string[] => {
    const result = spawnSync("rg", ["-F", "-l", pattern, "apps", "modules", "packages", "-g", "*.ts", "-g", "!*.test.ts"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim().split(/\r?\n/u).map((value) => value.replaceAll("\\", "/")).sort();
  };
  assert.deepEqual(grep("issueProductionBootstrapContext"), [
    "apps/api/src/production-bootstrap-engine.ts",
    "packages/security-contracts/src/production-bootstrap-proof.ts",
  ]);
  assert.deepEqual(grep("executeProductionBootstrap"), [
    "apps/api/src/production-bootstrap-engine.ts",
    "apps/api/src/production-bootstrap.ts",
  ]);
  const expectedRegistryAndDefinition = (definition: string): string[] => [
    definition,
    "apps/api/src/production-child-root-registry.ts",
  ].sort();
  assert.deepEqual(grep("composeProductionPublicationApi014HttpHandler("), expectedRegistryAndDefinition("apps/api/src/composition.ts"));
  assert.deepEqual(grep("composeProductionAdministrationApi015HttpHandler("), expectedRegistryAndDefinition("apps/api/src/administration-production-composition.ts"));
  assert.deepEqual(grep("createProductionConnectorApi018Composition("), expectedRegistryAndDefinition("apps/api/src/connector-production-composition.ts"));
  assert.deepEqual(grep("createProductionExternalIntegrationComposition("), expectedRegistryAndDefinition("apps/api/src/external-integration-production-composition.ts"));
  assert.deepEqual(grep("createProductionAdvisoryRuntime("), expectedRegistryAndDefinition("modules/ai/src/advisory-production-composition.ts"));
});
