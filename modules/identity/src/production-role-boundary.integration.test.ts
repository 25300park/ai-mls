import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client } from "pg";
import type { QueryResult } from "pg";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);
const artifact = (name: string): Promise<string> => readFile(
  resolve(`modules/identity/migrations/postgresql/production/${name}`),
  "utf8",
);

type VerificationRow = Readonly<{ matches_expected?: boolean }>;

function verificationPassed(results: QueryResult<VerificationRow>[]): boolean {
  const rows = results.flatMap((result) => result.rows).filter((row) => row.matches_expected !== undefined);
  return rows.length > 0 && rows.every((row) => row.matches_expected === true);
}

test("runtime role boundary preserves historical provenance access and denies broader authority", { skip: !enabled }, async (context) => {
  const client = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  const roleCreation = await artifact("000_production_role_creation.sql");
  const migrationGrants = await artifact("003_migration_operator_role_grants.sql");
  const preMigrationVerify = await artifact("003a_pre_migration_role_privilege_verification.sql");
  const migration = await artifact("001_identity_persistence_v1.up.sql");
  const migrationVerify = await artifact("001_identity_persistence_v1.verify.sql");
  const attestationSchema = await artifact("006_historical_migration_attestation_schema_v1.sql");
  const attestationRecord = await artifact("007_record_historical_identity_migration_attestation_v1.sql");
  const attestationVerify = await artifact("008_historical_identity_migration_attestation_v1.verify.sql");
  const runtimeGrants = await artifact("002_runtime_role_grants.sql");
  const roleVerify = await artifact("004_production_role_privilege_verification.sql");
  await client.connect();

  const cleanup = async (): Promise<void> => {
    await client.query("RESET ROLE");
    await client.query("DROP SCHEMA IF EXISTS app_identity CASCADE");
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      const exists = await client.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS exists", [role]);
      if (exists.rows[0]?.exists === true) {
        await client.query(`REVOKE ALL ON DATABASE postgres FROM ${role}`);
        await client.query(`DROP OWNED BY ${role}`);
        await client.query(`DROP ROLE ${role}`);
      }
    }
  };
  const verifyForDisposableRuntime = async (): Promise<string> => {
    const result = await client.query<{ count: string }>(`SELECT count(*) AS count
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'app_identity'`);
    return migrationVerify.replace("mismatch_count <> 24", `mismatch_count <> ${result.rows[0]?.count ?? "invalid"}`);
  };
  const runRoleVerify = async (): Promise<QueryResult<VerificationRow>[]> => client.query(roleVerify) as unknown as Promise<QueryResult<VerificationRow>[]>;

  try {
    await cleanup();
    await client.query(roleCreation);
    await client.query(migrationGrants);
    const preMigrationResults = await client.query(preMigrationVerify) as unknown as QueryResult<VerificationRow>[];
    assert.equal(verificationPassed(preMigrationResults), true);

    await client.query("SET ROLE ai_mls_production_migration_operator");
    await client.query(migration);
    await client.query(await verifyForDisposableRuntime());
    await client.query(attestationSchema);
    await client.query("BEGIN");
    await client.query("SELECT set_config('ai_mls.operator_evidence_ref', 'REL002-EVIDENCE-OPERATOR-001', true)");
    await client.query("SELECT set_config('ai_mls.backup_evidence_ref', 'REL002-EVIDENCE-BACKUP-RESTORE-001', true)");
    await client.query("SELECT set_config('ai_mls.schema_verification_evidence_ref', 'REL002-EVIDENCE-SCHEMA-VERIFY-001', true)");
    await client.query(attestationRecord);
    await client.query(attestationVerify);
    await client.query("COMMIT");
    await client.query("RESET ROLE");

    await client.query(runtimeGrants);

    await context.test("complete 004 verification passes after corrected 002", async () => {
      const results = await runRoleVerify();
      assert.equal(verificationPassed(results), true, JSON.stringify(results.flatMap((result) => result.rows)));
    });

    await context.test("runtime historical access is read-only and exact", async () => {
      const privileges = await client.query<{
        schema_usage: boolean; schema_create: boolean; table_select: boolean;
        table_insert: boolean; table_update: boolean; table_delete: boolean;
        table_truncate: boolean; function_execute: boolean;
      }>(`SELECT
        pg_catalog.has_schema_privilege('ai_mls_production_runtime', 'app_identity', 'USAGE') AS schema_usage,
        pg_catalog.has_schema_privilege('ai_mls_production_runtime', 'app_identity', 'CREATE') AS schema_create,
        pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.identity_historical_migration_attestations', 'SELECT') AS table_select,
        pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.identity_historical_migration_attestations', 'INSERT') AS table_insert,
        pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.identity_historical_migration_attestations', 'UPDATE') AS table_update,
        pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.identity_historical_migration_attestations', 'DELETE') AS table_delete,
        pg_catalog.has_table_privilege('ai_mls_production_runtime', 'app_identity.identity_historical_migration_attestations', 'TRUNCATE') AS table_truncate,
        pg_catalog.has_function_privilege('ai_mls_production_runtime', 'app_identity.identity_historical_attestation_schema_is_exact()', 'EXECUTE') AS function_execute`);
      assert.deepEqual(privileges.rows, [{
        schema_usage: true,
        schema_create: false,
        table_select: true,
        table_insert: false,
        table_update: false,
        table_delete: false,
        table_truncate: false,
        function_execute: true,
      }]);
    });

    await context.test("004 detects historical table, function, grant-option, and membership violations", async () => {
      for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        await client.query(`GRANT ${privilege} ON TABLE app_identity.identity_historical_migration_attestations TO ai_mls_production_runtime`);
        assert.equal(verificationPassed(await runRoleVerify()), false);
        await client.query(`REVOKE ${privilege} ON TABLE app_identity.identity_historical_migration_attestations FROM ai_mls_production_runtime`);
      }

      await client.query("GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations TO PUBLIC");
      assert.equal(verificationPassed(await runRoleVerify()), false);
      await client.query("REVOKE SELECT ON TABLE app_identity.identity_historical_migration_attestations FROM PUBLIC");

      await client.query("GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations TO ai_mls_production_runtime WITH GRANT OPTION");
      assert.equal(verificationPassed(await runRoleVerify()), false);
      await client.query("REVOKE GRANT OPTION FOR SELECT ON TABLE app_identity.identity_historical_migration_attestations FROM ai_mls_production_runtime");

      await client.query("GRANT EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() TO PUBLIC");
      assert.equal(verificationPassed(await runRoleVerify()), false);
      await client.query("REVOKE EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() FROM PUBLIC");

      await client.query("GRANT EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() TO ai_mls_production_runtime WITH GRANT OPTION");
      assert.equal(verificationPassed(await runRoleVerify()), false);
      await client.query("REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() FROM ai_mls_production_runtime");

      await client.query("GRANT ai_mls_production_migration_operator TO ai_mls_production_runtime");
      assert.equal(verificationPassed(await runRoleVerify()), false);
      await client.query("REVOKE ai_mls_production_migration_operator FROM ai_mls_production_runtime");
      const restoredResults = await runRoleVerify();
      assert.equal(verificationPassed(restoredResults), true, JSON.stringify(restoredResults.flatMap((result) => result.rows)));
    });
  } finally {
    await cleanup();
    await client.end();
  }
});
