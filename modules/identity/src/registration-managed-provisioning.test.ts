import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "./postgresql-pool.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";

const base = "modules/identity/migrations/postgresql/production/";
const historicalVerifier = base + "019_r3g1b_production_recovery.verify.sql";
const verifier = base + "023_registration_operator_managed_compatibility_grants.verify.sql";
const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && process.env["REL002_TEST_POSTGRES_PORT"] === "55444";

test("022/023 managed registration provisioning contains only read-only SELECT statements", async () => {
  const sql = await readFile(verifier, "utf8");
  const tokens = sql.replace(/--[^\n]*/gu, "").replace(/'(?:''|[^'])*'/gu, "''");
  assert.doesNotMatch(tokens, /\b(?:GRANT|REVOKE|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|CALL|DO)\b/iu);
  assert.doesNotMatch(sql, /set_config|pg_advisory|nextval/iu);
});

test("022/023 managed registration provisioning on exclusive disposable post-013/Audit001 pre-018", { skip: !enabled }, async t => {
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
    await migration.query<Record<string, unknown>>(await readFile(base + "001_identity_persistence_v1.up.sql", "utf8"));
    await migration.query("REVOKE ALL ON SCHEMA app_identity FROM PUBLIC,ai_mls_production_runtime; GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime; GRANT SELECT ON app_identity.identity_registered_service_workloads TO ai_mls_production_runtime");
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
    const { REGISTRATION_OPERATOR_ACL_QUERY } = await import("./registration-operator-acl.js");
    const { withRegistrationOperatorReadiness } = await import("../../../apps/api/src/registration-readiness-compatibility.js");
    const aggregateSql = withRegistrationOperatorReadiness((await readFile(base + "021_r3g1b_not_null_catalog_compatibility.verify.sql", "utf8")).trim().replace(/;$/u, ""));
    const { R3C2B_EVIDENCE_CATALOG_QUERY, R3C2B_EVIDENCE_CONTRACTS } = await import("../../../apps/api/src/r3c2b-postgresql-readiness.js");
    const check = async (expected: boolean) => {
      await migration.query<Record<string, unknown>>("BEGIN READ ONLY");
      try {
        const result = await migration.query<Record<string, unknown>>(sql);
        const runtime = await migration.query<Record<string, unknown>>(REGISTRATION_OPERATOR_ACL_QUERY);
        assert.equal(runtime.rows[0]?.["ready"], expected);
        assert.equal((await migration.query(aggregateSql)).rows.length, expected ? 2 : 0);
        const evidence = await migration.query<Record<string, unknown>>(R3C2B_EVIDENCE_CATALOG_QUERY);
        assert.equal(evidence.rows.length, expected ? 2 : 0);
        if (expected) for (const contract of R3C2B_EVIDENCE_CONTRACTS) {
          const row = evidence.rows.find(r => r["schema_name"] === contract.schemaName);
          assert.equal(row?.["authority_ok"], true); assert.equal(row?.["fingerprint"], contract.fingerprint);
        }
        assert.equal(result.rows.length, 2);
        assert.equal(result.rows.every(r => r["ready"] === true), expected, JSON.stringify(result.rows));
      } finally { await migration.query<Record<string, unknown>>("ROLLBACK"); }
    };

    const provisioning = await readFile(base + "022_registration_operator_managed_compatibility_grants.sql", "utf8");
    const aclSnapshot = async () => (await admin.query<Record<string, unknown>>(
      "SELECT (SELECT jsonb_agg(jsonb_build_array(n.nspname,a.grantee,a.grantor,a.privilege_type,a.is_grantable) ORDER BY n.nspname,a.grantee,a.privilege_type) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname IN ('app_identity','app_audit')) AS schemas, (SELECT jsonb_agg(jsonb_build_array(c.relname,a.grantee,a.grantor,a.privilege_type,a.is_grantable) ORDER BY c.relname,a.grantee,a.privilege_type) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE n.nspname IN ('app_identity','app_audit')) AS tables"
    )).rows;
    await t.test("PRE baseline is 021 ready and 023 not ready", async () => {
      const pre = await migration.query<Record<string, unknown>>(await readFile(base + "021_r3g1b_not_null_catalog_compatibility.verify.sql", "utf8"));
      assert.equal(pre.rows.length, 2); assert.ok(pre.rows.every(r => r["ready"] === true));
      const post = await migration.query<Record<string, unknown>>(sql);
      assert.ok(post.rows.every(r => r["ready"] === false));
    });
    await t.test("wrong executor guard failure preserves PRE ACL", async () => {
      const before = await aclSnapshot();
      await assert.rejects(admin.query<Record<string, unknown>>(provisioning), { message: "REGISTRATION_GRANTOR_REQUIRED" });
      await admin.query("ROLLBACK"); assert.deepEqual(await aclSnapshot(), before);
    });
    await t.test("failure after first REVOKE rolls back all ACL changes", async () => {
      const before = await aclSnapshot();
      const injected = provisioning.replace("REVOKE ALL ON ALL TABLES", "SELECT 1/0; REVOKE ALL ON ALL TABLES");
      await assert.rejects(migration.query<Record<string, unknown>>(injected));
      await migration.query("ROLLBACK"); assert.deepEqual(await aclSnapshot(), before);
    });
    await t.test("failure after GRANT rolls back all ACL changes", async () => {
      const before = await aclSnapshot();
      const injected = provisioning.replace("GRANT SELECT, INSERT", "SELECT 1/0; GRANT SELECT, INSERT");
      await assert.rejects(migration.query<Record<string, unknown>>(injected));
      await migration.query("ROLLBACK"); assert.deepEqual(await aclSnapshot(), before);
    });
    await t.test("postcondition failure rolls back completed grants", async () => {
      const before = await aclSnapshot();
      const injected = provisioning.replace("DO $guard$\nDECLARE ok boolean;\nBEGIN", "GRANT UPDATE ON app_identity.identity_workload_evidence TO ai_mls_production_registration_operator; DO $guard$\nDECLARE ok boolean;\nBEGIN");
      assert.notEqual(injected, provisioning);
      await assert.rejects(migration.query<Record<string, unknown>>(injected), { message: "REGISTRATION_FORWARD_POSTCONDITION_REQUIRED" });
      await migration.query("ROLLBACK"); assert.deepEqual(await aclSnapshot(), before);
    });
    await t.test("022 reaches exact POST and re-run is idempotent", async () => {
      await migration.query(provisioning); await check(true);
      const before = await aclSnapshot(); await migration.query(provisioning);
      assert.deepEqual(await aclSnapshot(), before); await check(true);
    });
    await t.test("actual registration operator DRY_RUN accepts POST with zero writes", async () => {
      const operator = new Client({ host: "127.0.0.1", port: 55444, database: "postgres", user: "ai_mls_production_registration_operator" });
      await operator.connect();
      try {
        const { RegisterServiceWorkloadCommand } = await import("./register-service-workload.js");
        const pool: PostgreSqlPoolPort = {
          connect: () => Promise.resolve({
            query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => {
              const result = await operator.query<Row>(text, values ? [...values] : undefined);
              return { rows: result.rows, rowCount: result.rowCount ?? 0 };
            }, release: () => undefined,
          }), close: () => Promise.resolve(),
        };
        const manifest = JSON.parse(await readFile("docs/implementation/REL002_R3G1B4_PRODUCTION_WORKLOAD_REGISTRATION_MANIFEST.json", "utf8")) as Record<string, unknown>;
        Object.assign(manifest, { registrationId: "fixture-forward-runtime", tenantId: "fixture-forward-tenant", principalId: "fixture-forward-principal", scopeRef: "registered-service-workload:fixture-forward-runtime:1", identityEvidenceRef: "fixture-forward-proof", auditEvidenceRef: "fixture-forward-audit" });
        const result = await new RegisterServiceWorkloadCommand(pool).run(manifest, "DRY_RUN");
        assert.equal(result.result, "VALIDATED"); assert.equal(result.actualWrites, 0);
        assert.equal((await admin.query<{ n: number }>("SELECT count(*)::int AS n FROM app_identity.identity_registered_service_workloads")).rows[0]?.n, 0);
      } finally { await operator.end(); }
    });
    await t.test("forward runner/readiness ACL accepts verified POST managed topology", async () => {
      const { REGISTRATION_OPERATOR_ACL_QUERY } = await import("./registration-operator-acl.js");
      const legacy = await migration.query<Record<string, unknown>>(REGISTRATION_OPERATOR_ACL_QUERY);
      assert.equal(legacy.rows[0]?.["ready"], true);
    });

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
          assert.equal((await admin.query<Record<string, unknown>>(REGISTRATION_OPERATOR_ACL_QUERY)).rows[0]?.["ready"], false);
          assert.equal((await admin.query(aggregateSql)).rows.length, 0);
          assert.equal((await admin.query(R3C2B_EVIDENCE_CATALOG_QUERY)).rows.length, 0);
          assert.equal(result.rows.length, 2);
          assert.equal(result.rows.every(r => r["ready"] === true), false);
        } finally { await admin.query<Record<string, unknown>>("ROLLBACK"); }
        await check(true);
      });
    };
    await negative("zero managed memberships rejected", "DELETE FROM pg_auth_members WHERE roleid IN ('ai_mls_production_migration_operator'::regrole,'ai_mls_production_runtime'::regrole,'ai_mls_production_registration_operator'::regrole)");
    await negative("direct registration database CREATE rejected", "GRANT CREATE ON DATABASE postgres TO ai_mls_production_registration_operator");
    await negative("registration CONNECT grant option rejected", "GRANT CONNECT ON DATABASE postgres TO ai_mls_production_registration_operator WITH GRANT OPTION");
    await negative("unexpected PUBLIC CREATE authority rejected", "GRANT CREATE ON DATABASE postgres TO PUBLIC");
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
    for (const [table, columns] of [
      ["app_identity.identity_workload_evidence", ["identity_evidence_ref", "registration_id", "registration_version", "tenant_id", "principal_id", "schema_version", "immutable"]],
      ["app_audit.audit_evidence_read_records", ["audit_evidence_ref", "source_domain", "aggregate_type", "aggregate_id", "aggregate_version", "event_type", "payload_schema_version", "final", "tenant_id", "scope_ref", "payload", "occurred_at", "materialized_at"]],
    ] as const) {
      for (const column of columns) {
        const primary = column === "identity_evidence_ref" || column === "audit_evidence_ref";
        await negative(`${table}.${column} NOT NULL removal rejected`,
          `${primary ? `ALTER TABLE ${table} DROP CONSTRAINT ${table.split(".")[1]}_pkey; ` : ""}ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`);
      }
    }
    await negative("primary key modification rejected", "ALTER TABLE app_identity.identity_workload_evidence DROP CONSTRAINT identity_workload_evidence_pkey; ALTER TABLE app_identity.identity_workload_evidence ADD PRIMARY KEY (registration_id)");
    await negative("unexpected CHECK rejected", "ALTER TABLE app_identity.identity_workload_evidence ADD CONSTRAINT unexpected CHECK (schema_version > 0)");
    await negative("unexpected UNIQUE rejected", "ALTER TABLE app_identity.identity_workload_evidence ADD CONSTRAINT unexpected UNIQUE (registration_id)");
    await negative("unexpected foreign key rejected", "ALTER TABLE app_identity.identity_workload_evidence ADD CONSTRAINT unexpected FOREIGN KEY (registration_id) REFERENCES app_identity.identity_workload_evidence(identity_evidence_ref)");
    await negative("unexpected exclusion rejected", "ALTER TABLE app_identity.identity_workload_evidence ADD CONSTRAINT unexpected EXCLUDE USING btree (identity_evidence_ref WITH =)");
    await negative("schema ACL drift rejected", "GRANT USAGE ON SCHEMA app_identity TO PUBLIC");
    await negative("function config drift rejected", "ALTER FUNCTION app_identity.identity_workload_evidence_guard() SET search_path=public");
    await negative("function ACL drift rejected", "GRANT EXECUTE ON FUNCTION app_identity.identity_workload_evidence_guard() TO PUBLIC");
    await negative("trigger drift rejected", "ALTER TABLE app_identity.identity_workload_evidence DISABLE TRIGGER identity_workload_evidence_guard");
    await negative("column ACL drift rejected", "GRANT UPDATE (tenant_id) ON app_identity.identity_workload_evidence TO ai_mls_production_runtime");
    await negative("registration MAINTAIN rejected", "GRANT MAINTAIN ON app_identity.identity_workload_evidence TO ai_mls_production_registration_operator");

    await negative("wrong connection limit rejected", "ALTER ROLE ai_mls_production_registration_operator CONNECTION LIMIT 1");
    await negative("direct registration TEMPORARY rejected", "GRANT TEMPORARY ON DATABASE postgres TO ai_mls_production_registration_operator");
    await negative("registration schema CREATE rejected", "GRANT CREATE ON SCHEMA app_identity TO ai_mls_production_registration_operator");
    await negative("extra registration schema grant rejected", "GRANT USAGE ON SCHEMA public TO ai_mls_production_registration_operator");
    await negative("extra table grant rejected", "GRANT SELECT ON app_identity.identity_sessions TO ai_mls_production_registration_operator");
    await negative("extra column grant rejected", "GRANT SELECT (principal_id) ON app_identity.identity_workload_evidence TO ai_mls_production_registration_operator");
    await negative("extra function grant rejected", "GRANT EXECUTE ON FUNCTION app_identity.identity_workload_evidence_guard() TO ai_mls_production_registration_operator");
    await negative("unexpected sequence grant rejected", "CREATE SEQUENCE app_identity.fixture_sequence; GRANT USAGE ON SEQUENCE app_identity.fixture_sequence TO ai_mls_production_registration_operator");
    await negative("unexpected grant option rejected", "GRANT SELECT ON app_identity.identity_workload_evidence TO ai_mls_production_registration_operator WITH GRANT OPTION");
    await negative("registered table owner drift rejected", "ALTER TABLE app_identity.identity_registered_service_workloads OWNER TO postgres");
    await negative("migration ACL drift rejected", "REVOKE CREATE ON DATABASE postgres FROM ai_mls_production_migration_operator");
    await negative("runtime ACL drift rejected", "GRANT INSERT ON app_identity.identity_registered_service_workloads TO ai_mls_production_runtime");
    await negative("SECURITY DEFINER bypass rejected", "CREATE FUNCTION app_identity.fixture_bypass() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'");
    await negative("default ACL grant rejected", "ALTER DEFAULT PRIVILEGES IN SCHEMA app_identity GRANT SELECT ON TABLES TO ai_mls_production_registration_operator");
  } finally {
    await migration.end();
    if (fixtureCreated) await admin.query<Record<string, unknown>>("DROP SCHEMA IF EXISTS app_identity CASCADE; DROP SCHEMA IF EXISTS app_audit CASCADE; DROP OWNED BY ai_mls_production_runtime,ai_mls_production_registration_operator,ai_mls_production_migration_operator; DROP ROLE ai_mls_production_runtime,ai_mls_production_registration_operator,ai_mls_production_migration_operator; DROP ROLE supabase_admin");
    await admin.end();
  }
});
