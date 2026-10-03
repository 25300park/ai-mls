import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { createFirstPartyAuthenticationRegistration, assertFirstPartyAuthenticationReady } from "./first-party-authentication-composition.js";
import { FIRST_PARTY_CREDENTIAL_FINGERPRINTS, assertFirstPartyCredentialPersistenceReady } from "./first-party-authentication-readiness.js";

function fixture(rows: { schema_name: string; table_name: string; fingerprint: string; authority_ok: boolean }[] = Object.entries(FIRST_PARTY_CREDENTIAL_FINGERPRINTS).map(([table, fingerprint]) => ({ schema_name: "app_identity", table_name: table, fingerprint, authority_ok: true })), role = "ai_mls_production_runtime") {
  const calls: string[] = [];
  const pool: PostgreSqlPoolPort = { connect: () => Promise.resolve({ query<Row extends Record<string, unknown>>(sql: string): Promise<PostgreSqlQueryResult<Row>> {
    calls.push(sql);
    const result = sql.includes('current_user AS role') ? [{ role }] : rows;
    return Promise.resolve({ rows: result as unknown as readonly Row[], rowCount: result.length });
  }, release() { /* fixture caller owns lifecycle */ } }), close: () => Promise.resolve() };
  return { pool, calls };
}
const binding = { adapterId: "ai-mls.identity.first-party-credential.v1", adapterKind: "FIRST_PARTY_CREDENTIAL", configurationRef: { schemaVersion: 1, adapterId: "ai-mls.identity.first-party-credential.v1", algorithmProfile: "ARGON2ID_V1" } };
test("first-party readiness is catalog-only and does not authenticate or issue sessions", async () => {
  const f = fixture();
  await assertFirstPartyAuthenticationReady(f.pool, [binding], [createFirstPartyAuthenticationRegistration(f.pool, "tenant")]);
  assert.equal(f.calls.every(sql => (/^(?:SELECT|WITH) /u.test(sql) || sql === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" || sql === "COMMIT") && !sql.includes("FROM app_identity.identity_human")), true);
});
test("first-party readiness rejects unknown kinds adapters missing config and Staging", async () => {
  const { pool } = fixture();
  const registration = createFirstPartyAuthenticationRegistration(pool,"tenant");
  for (const candidate of [{ ...binding, adapterId: "unknown" }, { ...binding, adapterKind: "unknown" }, { ...binding, configurationRef: undefined }, { ...binding, configurationRef: { ...binding.configurationRef, secret: "synthetic" } }]) await assert.rejects(assertFirstPartyAuthenticationReady(pool,[candidate],[registration]));
  await assert.rejects(assertFirstPartyAuthenticationReady(pool,[binding],[{ ...registration, environment: "STAGING" }]));
  await assert.rejects(assertFirstPartyAuthenticationReady(pool,[binding],[registration,registration]));
});
test("exact persistence readiness rejects missing duplicate altered catalog or authority and migration callers", async () => {
  const valid = Object.entries(FIRST_PARTY_CREDENTIAL_FINGERPRINTS).map(([table,fingerprint]) => ({ schema_name:"app_identity",table_name:table,fingerprint,authority_ok:true }));
  for (const rows of [[],valid.slice(1),[...valid,valid[0]!],valid.map(row=>({...row,fingerprint:"changed"})),valid.map(row=>({...row,authority_ok:false}))]) await assert.rejects(assertFirstPartyCredentialPersistenceReady(fixture(rows).pool));
  await assert.rejects(assertFirstPartyCredentialPersistenceReady(fixture(valid,"ai_mls_production_migration_operator").pool));
});
