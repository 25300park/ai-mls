import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";

const base = "modules/identity/migrations/postgresql/production/";
const historicalVerifier = base + "019_r3g1b_production_recovery.verify.sql";
const verifier = base + "020_r3g1b_registration_membership_compatibility.verify.sql";
const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && process.env["REL002_TEST_POSTGRES_PORT"] === "55444";

test("forward recovery verifier contains only read-only SELECT statements", async () => {
  const sql = await readFile(verifier, "utf8");
  const tokens = sql.replace(/--[^\n]*/gu, "").replace(/'(?:''|[^'])*'/gu, "''");
  assert.doesNotMatch(tokens, /\b(?:GRANT|REVOKE|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|CALL|DO)\b/iu);
  assert.doesNotMatch(sql, /set_config|pg_advisory|nextval/iu);
});

test("forward recovery verifier on exclusive disposable post-013/Audit001 pre-018", { skip: !enabled }, async t => {
  const admin = new Client({ host: "127.0.0.1", port: 55444, database: "postgres", user: "postgres" });
  await admin.connect();
  const migration = new Client({ host: "127.0.0.1", port: 55444, database: "postgres", user: "ai_mls_production_migration_operator" });
  let fixtureCreated = false;
  try {
    // Fresh dedicated cluster required. Never reset a shared database.
    assert.equal((await admin.query<Record<string, unknown>>("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN ('app_identity','app_audit')")).rows[0]?.["n"], 0);
    await admin.query<Record<string, unknown>>("CREATE ROLE supabase_admin SUPERUSER; CREATE ROLE ai_mls_production_migration_operator LOGIN NOINHERIT; CREATE ROLE ai_mls_production_runtime LOGIN NOINHERIT; CREATE ROLE ai_mls_production_registration_operator LOGIN NOINHERIT; REVOKE CREATE ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime,ai_mls_production_registration_operator; GRANT ai_mls_production_migration_operator,ai_mls_production_runtime,ai_mls_production_registration_operator TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE");
    fixtureCreated = true;
    // Emulate managed-provider grant provenance in this disposable cluster only.
    await admin.query<Record<string, unknown>>("UPDATE pg_auth_members SET grantor='supabase_admin'::regrole WHERE roleid IN ('ai_mls_production_runtime'::regrole,'ai_mls_production_migration_operator'::regrole,'ai_mls_production_registration_operator'::regrole)");
    await migration.connect();
    await migration.query<Record<string, unknown>>("CREATE SCHEMA app_identity; REVOKE ALL ON SCHEMA app_identity FROM PUBLIC,ai_mls_production_runtime; GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime");
    await migration.query<Record<string, unknown>>(await readFile(base + "013_identity_workload_evidence_v1.up.sql", "utf8"));
    await t.test("Identity intermediate columns constraints and primary index", async () => {
      const columns = (await admin.query<Record<string, unknown>>("SELECT attname,format_type(atttypid,atttypmod) AS type,attnotnull FROM pg_attribute WHERE attrelid='app_identity.identity_workload_evidence'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum")).rows;
      assert.deepEqual(columns.map(r => [r["attname"],r["type"],r["attnotnull"]]), [["identity_evidence_ref","text",true],["registration_id","text",true],["registration_version","bigint",true],["tenant_id","text",true],["principal_id","text",true],["schema_version","integer",true],["immutable","boolean",true]]);
      assert.equal((await admin.query<Record<string, unknown>>("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='app_identity.identity_workload_evidence'::regclass AND contype IN ('p','c') AND convalidated AND NOT condeferrable AND NOT condeferred")).rows[0]?.["n"],4);
      assert.equal((await admin.query<Record<string, unknown>>("SELECT count(*)::int AS n FROM pg_index WHERE indrelid='app_identity.identity_workload_evidence'::regclass AND indisprimary AND indisunique AND indisvalid AND indisready AND indislive")).rows[0]?.["n"],1);
      const checks = (await admin.query<Record<string, unknown>>("SELECT conname,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE conrelid='app_identity.identity_workload_evidence'::regclass AND contype IN ('p','c') ORDER BY conname")).rows;
      assert.deepEqual(checks.map(r => r["definition"]), ["CHECK (immutable)","PRIMARY KEY (identity_evidence_ref)","CHECK (registration_version >= 1 AND registration_version <= '9007199254740991'::bigint)","CHECK (schema_version = 1)"]);
      assert.equal((await admin.query<Record<string, unknown>>("SELECT pg_get_indexdef(indexrelid) AS definition FROM pg_index WHERE indrelid='app_identity.identity_workload_evidence'::regclass")).rows[0]?.["definition"], "CREATE UNIQUE INDEX identity_workload_evidence_pkey ON app_identity.identity_workload_evidence USING btree (identity_evidence_ref)");
      await assert.rejects(admin.query<Record<string, unknown>>(await readFile(base + "013_identity_workload_evidence_v1.verify.sql", "utf8")), { message: "C2B_EVIDENCE_SCHEMA_NOT_READY" });
    });
    await migration.query<Record<string, unknown>>(await readFile("modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql", "utf8"));
    const sql = await readFile(verifier, "utf8");
    const check = async (expected: boolean) => {
      await migration.query<Record<string, unknown>>("BEGIN READ ONLY");
      try {
        const result = await migration.query<Record<string, unknown>>(sql);
        assert.equal(result.rows.length, 2);
        assert.equal(result.rows.every(r => r["ready"] === true), expected, JSON.stringify(result.rows));
      } finally { await migration.query<Record<string, unknown>>("ROLLBACK"); }
    };
    await t.test("canonical structures PUBLIC-only TEMPORARY and exact three-row managed membership PASS", async () => { await check(true); });
    await t.test("019 remains fail-closed for approved three-row topology", async () => {
      const result = await migration.query<Record<string, unknown>>(await readFile(historicalVerifier, "utf8"));
      assert.equal(result.rows.length, 2);
      assert.ok(result.rows.every(r => r["membership_ok"] === false && r["ready"] === false));
    });
    const negative = async (name: string, change: string) => {
      await t.test(name, async () => {
        await admin.query<Record<string, unknown>>("BEGIN");
        try {
          await admin.query<Record<string, unknown>>(change);

          const result = await admin.query<Record<string, unknown>>(sql);
          assert.equal(result.rows.length, 2);
          assert.equal(result.rows.every(r => r["ready"] === true), false);
        } finally { await admin.query<Record<string, unknown>>("ROLLBACK"); }
        await check(true);
      });
    };
    await negative("registration membership missing rejected", "DELETE FROM pg_auth_members WHERE roleid='ai_mls_production_registration_operator'::regrole AND member='postgres'::regrole");
    await negative("registration membership reversed rejected", "DELETE FROM pg_auth_members WHERE roleid='ai_mls_production_registration_operator'::regrole AND member='postgres'::regrole; GRANT postgres TO ai_mls_production_registration_operator WITH ADMIN TRUE, INHERIT FALSE, SET FALSE");
    await negative("registration membership wrong grantor rejected", "UPDATE pg_auth_members SET grantor='postgres'::regrole WHERE roleid='ai_mls_production_registration_operator'::regrole");
    await negative("registration membership admin false rejected", "GRANT ai_mls_production_registration_operator TO postgres WITH ADMIN FALSE");
    await negative("registration membership inherit true rejected", "GRANT ai_mls_production_registration_operator TO postgres WITH INHERIT TRUE");
    await negative("registration membership set true rejected", "GRANT ai_mls_production_registration_operator TO postgres WITH SET TRUE");
    await negative("fourth membership rejected", "GRANT ai_mls_production_registration_operator TO supabase_admin WITH ADMIN TRUE, INHERIT FALSE, SET FALSE");
    await negative("migration membership missing rejected", "DELETE FROM pg_auth_members WHERE roleid='ai_mls_production_migration_operator'::regrole AND member='postgres'::regrole");
    await negative("runtime membership missing rejected", "DELETE FROM pg_auth_members WHERE roleid='ai_mls_production_runtime'::regrole AND member='postgres'::regrole");
    await negative("direct runtime TEMPORARY rejected", "GRANT TEMPORARY ON DATABASE postgres TO ai_mls_production_runtime");
    await negative("direct migration TEMPORARY rejected", "GRANT TEMPORARY ON DATABASE postgres TO ai_mls_production_migration_operator");
    await negative("runtime ownership rejected", "ALTER TABLE app_identity.identity_workload_evidence OWNER TO ai_mls_production_runtime");
    await negative("registration ownership rejected", "ALTER SCHEMA app_audit OWNER TO ai_mls_production_registration_operator");
    await negative("reverse membership rejected", "GRANT ai_mls_production_registration_operator TO ai_mls_production_runtime");
    await negative("managed membership option drift rejected", "GRANT ai_mls_production_runtime TO postgres WITH INHERIT TRUE");
    await negative("Identity structural drift rejected", "ALTER TABLE app_identity.identity_workload_evidence ADD COLUMN drift text");
    await negative("Audit structural drift rejected", "ALTER TABLE app_audit.audit_evidence_read_records DROP CONSTRAINT audit_evidence_read_records_final_check");
    await negative("missing Identity table rejected", "DROP TABLE app_identity.identity_workload_evidence");
    await negative("missing Audit root rejected", "DROP SCHEMA app_audit CASCADE");
    await negative("unexpected index rejected", "CREATE INDEX drift ON app_identity.identity_workload_evidence (principal_id)");
    await negative("PUBLIC table privilege rejected", "GRANT SELECT ON app_identity.identity_workload_evidence TO PUBLIC");
    await negative("registration role attribute drift rejected", "ALTER ROLE ai_mls_production_registration_operator CREATEDB");
    await negative("runtime database grant option rejected", "GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime WITH GRANT OPTION");
    await negative("Identity range drift rejected", "ALTER TABLE app_identity.identity_workload_evidence DROP CONSTRAINT identity_workload_evidence_registration_version_check; ALTER TABLE app_identity.identity_workload_evidence ADD CHECK (registration_version BETWEEN 1 AND 9007199254740990)");
    await negative("018 privilege boundary rejected", "GRANT USAGE ON SCHEMA app_identity,app_audit TO ai_mls_production_registration_operator");
  } finally {
    await migration.end();
    if (fixtureCreated) await admin.query<Record<string, unknown>>("DROP SCHEMA IF EXISTS app_identity CASCADE; DROP SCHEMA IF EXISTS app_audit CASCADE; DROP OWNED BY ai_mls_production_runtime,ai_mls_production_registration_operator,ai_mls_production_migration_operator; DROP ROLE ai_mls_production_runtime,ai_mls_production_registration_operator,ai_mls_production_migration_operator; DROP ROLE supabase_admin");
    await admin.end();
  }
});
