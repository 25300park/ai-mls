import type { PostgreSqlPoolPort } from "./postgresql-pool.js";
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { REGISTRATION_OPERATOR_ACL_QUERY } from "./registration-operator-acl.js";
import { RegisterServiceWorkloadCommand, parseRegistrationManifest, REGISTRATION_DATABASE_TARGET, REGISTRATION_OPERATOR } from "./register-service-workload.js";
import { openRegistrationOperatorPool, parseRegistrationRunnerArguments } from "../../../tools/production/register-service-workload.js";

export function registrationFixture(id = "fixture-registration"): unknown {
  return { schemaVersion:1,registrationId:id,registrationVersion:1,tenantId:`tenant-${id}`,principalId:`principal-${id}`,environment:"PRODUCTION",purpose:"AI_MLS_PRODUCTION_API_RUNTIME",audience:"ai-mls-api",scopeRef:`registered-service-workload:${id}:1`,identityEvidenceRef:`proof-${id}`,auditEvidenceRef:`audit-${id}`,expectedDatabaseTarget:REGISTRATION_DATABASE_TARGET,expectedExecutionRole:REGISTRATION_OPERATOR,expectedWrites:3,timestampPolicy:"GENERATED_AT_EXECUTION" };
}
test("registration manifest exact tuple and generated timestamp policy", () => {
  const value = parseRegistrationManifest(registrationFixture());
  assert.equal(value.expectedWrites, 3); assert.ok(Object.isFrozen(value)); assert.ok(Object.isFrozen(value.expectedDatabaseTarget));
});
test("forward provisioning checksums and standalone verifier match exact implementation", async () => {
  const base="modules/identity/migrations/postgresql/production/";
  for(const file of ["017_registration_operator_role.sql","018_registration_operator_grants.sql"]) assert.equal(createHash("sha256").update(await readFile(base+file)).digest("hex"),(await readFile(base+file+".sha256","utf8")).trim());
  assert.match(await readFile(base+"018_registration_operator_grants.verify.sql","utf8"), /NOT EXISTS \(SELECT 1 FROM pg_auth_members WHERE member=/u);
});
test("registration scope has no arbitrary, tenant or principal fallback", () => {
  const value = parseRegistrationManifest(registrationFixture());
  for (const scopeRef of ["scope",`tenant:${value.tenantId}`,`principal:${value.principalId}`,"registered-service-workload:wrong:1",`registered-service-workload:${value.registrationId}:2`]) assert.throws(() => parseRegistrationManifest({ ...value, scopeRef }));
});
test("registration manifest rejects missing, extra, secret and semantic mismatches", () => {
  const value = parseRegistrationManifest(registrationFixture());
  for (const changed of [{schemaVersion:2},{registrationVersion:0},{environment:"STAGING"},{purpose:"wrong"},{audience:"wrong"},{expectedWrites:2},{timestampPolicy:"HISTORICAL"},{expectedExecutionRole:"ai_mls_production_runtime"},{password:"fixture"},{createdAt:"2020-01-01"},{expectedDatabaseTarget:{...REGISTRATION_DATABASE_TARGET,host:"wrong"}}]) assert.throws(() => parseRegistrationManifest({ ...value, ...changed }));
  const missing = { ...value } as Record<string,unknown>; delete missing["tenantId"]; assert.throws(() => parseRegistrationManifest(missing));
});
test("one-shot requires explicit exclusive mode and allows no CLI credential", () => {
  assert.deepEqual(parseRegistrationRunnerArguments(["--dry-run","--manifest","manifest.json"]), {mode:"DRY_RUN",manifestPath:"manifest.json"});
  assert.equal(parseRegistrationRunnerArguments(["--execute","--manifest","manifest.json"]).mode,"EXECUTE");
  for (const args of [[],["--manifest","manifest.json"],["--execute","--dry-run","--manifest","manifest.json"],["--execute","--manifest","manifest.json","--password","fixture"]]) assert.throws(() => parseRegistrationRunnerArguments(args));
});
test("operator pool rejects missing sealed binding and never falls back to runtime or raw URL", () => {
  for (const env of [{},{DATABASE_URL:"fixture"},{AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1:"fixture"},{AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1:"fixture",AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1:"fixture"}]) assert.throws(() => openRegistrationOperatorPool(env), {code:"UNAVAILABLE"});
});
test("actual one-shot CLI exits fail-closed without echoing unsupported credential arguments", () => {
  for (const args of [[],["--dry-run","--manifest","nonexistent.json"],["--execute","--manifest","unused.json","--password","DO_NOT_ECHO_FIXTURE"]]) {
    const child=spawnSync(process.execPath,[fileURLToPath(new URL("../../../tools/production/register-service-workload.js",import.meta.url)),...args],{encoding:"utf8",timeout:10000});
    assert.equal(child.status,1); assert.equal(child.signal,null);
    assert.equal((child.stdout+child.stderr).includes("DO_NOT_ECHO_FIXTURE"),false);
    assert.equal(child.stderr.includes("stack"),false);
    if(args[0]==="--dry-run") assert.deepEqual(JSON.parse(child.stderr),{command:"REGISTER_SERVICE_WORKLOAD",DRY_RUN:"FAIL",EXPECTED_WRITES:3,ACTUAL_WRITES:0});
  }
});

test("runtime registration ACL requires the complete forward 023 POST contract", async () => {
  const sql = (await readFile("modules/identity/migrations/postgresql/production/023_registration_operator_managed_compatibility_grants.verify.sql", "utf8")).trim().replace(/;$/u, "");
  assert.ok(REGISTRATION_OPERATOR_ACL_QUERY.includes(sql));
  assert.match(REGISTRATION_OPERATOR_ACL_QUERY, /count\(\*\)=2/u);
});
test("runner blocks both modes before transaction when 023 POST is not ready", async () => {
  for (const mode of ["DRY_RUN", "EXECUTE"] as const) {
    const queries: string[] = [];
    const pool = { connect: () => Promise.resolve({
      query: (sql: string) => {
        queries.push(sql);
        return Promise.resolve({ rows: sql === REGISTRATION_OPERATOR_ACL_QUERY ? [{ ready: false }] : [{ current_user: REGISTRATION_OPERATOR, session_user: REGISTRATION_OPERATOR, database: "postgres" }], rowCount: 1 });
      }, release: () => undefined,
    }), close: () => Promise.resolve() };
    const command = new RegisterServiceWorkloadCommand(pool as unknown as PostgreSqlPoolPort);
    await assert.rejects(command.run(registrationFixture(), mode), { code: "UNAVAILABLE" });
    assert.equal(queries.includes(REGISTRATION_OPERATOR_ACL_QUERY), true);
    assert.equal(queries.some(sql => /^(?:BEGIN|INSERT)/u.test(sql)), false);
  }
});