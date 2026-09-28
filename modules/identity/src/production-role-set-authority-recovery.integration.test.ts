import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client } from "pg";
import type { QueryResult } from "pg";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);
const adminUser = process.env["REL002_TEST_POSTGRES_ADMIN_USER"] ?? "supabase_admin";
const artifact = (name: string): Promise<string> => readFile(
  resolve(`modules/identity/migrations/postgresql/production/${name}`),
  "utf8",
);

type VerificationRow = Readonly<{ matches_expected?: boolean }>;
type StateSnapshot = Readonly<{
  database_acl: string;
  schema_acl: string;
  table_acl: string;
  function_acl: string;
  memberships: string;
}>;
type MembershipRow = Readonly<{
  granted_role: string;
  member_role: string;
  grantor_role: string;
  admin_option: boolean;
  inherit_option: boolean;
  set_option: boolean;
}>;

function verificationPassed(results: QueryResult<VerificationRow>[]): boolean {
  const rows = results.flatMap((result) => result.rows).filter((row) => row.matches_expected !== undefined);
  return rows.length > 0 && rows.every((row) => row.matches_expected === true);
}

test("010 restores the exact runtime boundary and removes only postgres-granted SET authority", { skip: !enabled }, async () => {
  const admin = new Client({ host: "127.0.0.1", port, user: adminUser, database: "postgres" });
  const execution = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  const roleCreation = await artifact("000_production_role_creation.sql");
  const migrationGrants = await artifact("003_migration_operator_role_grants.sql");
  const migration = await artifact("001_identity_persistence_v1.up.sql");
  const migrationVerify = await artifact("001_identity_persistence_v1.verify.sql");
  const attestationSchema = await artifact("006_historical_migration_attestation_schema_v1.sql");
  const attestationRecord = await artifact("007_record_historical_identity_migration_attestation_v1.sql");
  const attestationVerify = await artifact("008_historical_identity_migration_attestation_v1.verify.sql");
  const recovery = await artifact("010_complete_production_runtime_role_boundary_with_bounded_set_authority.sql");
  const roleVerify = await artifact("004_production_role_privilege_verification.sql");
  await admin.connect();

  const verifyForDisposableRuntime = async (): Promise<string> => {
    const result = await admin.query<{ count: string }>(`SELECT count(*) AS count
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'app_identity'`);
    return migrationVerify.replace("mismatch_count <> 24", `mismatch_count <> ${result.rows[0]?.count ?? "invalid"}`);
  };
  const snapshot = async (): Promise<StateSnapshot> => {
    const result = await execution.query<StateSnapshot>(`SELECT
      COALESCE((SELECT datacl::text FROM pg_catalog.pg_database WHERE datname = 'postgres'), '') AS database_acl,
      COALESCE((SELECT nspacl::text FROM pg_catalog.pg_namespace WHERE nspname = 'app_identity'), '') AS schema_acl,
      COALESCE((
        SELECT string_agg(objects.relname::text || ':' || COALESCE(objects.relacl::text, ''), ',' ORDER BY objects.relname)
        FROM pg_catalog.pg_class objects
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = objects.relnamespace
        WHERE namespaces.nspname = 'app_identity'
      ), '') AS table_acl,
      COALESCE((
        SELECT string_agg(procedures.proname::text || ':' || COALESCE(procedures.proacl::text, ''), ',' ORDER BY procedures.proname)
        FROM pg_catalog.pg_proc procedures
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
        WHERE namespaces.nspname = 'app_identity'
      ), '') AS function_acl,
      COALESCE((
        SELECT string_agg(
          granted_role.rolname::text || '->' || member_role.rolname::text || '@' || grantor_role.rolname::text || ':' ||
            memberships.admin_option::text || ':' || memberships.inherit_option::text || ':' || memberships.set_option::text,
          ',' ORDER BY granted_role.rolname, member_role.rolname, grantor_role.rolname
        )
        FROM pg_catalog.pg_auth_members memberships
        JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
        JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
        JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
        WHERE granted_role.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator')
          OR member_role.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator')
      ), '') AS memberships`);
    return result.rows[0]!;
  };
  const exactMemberships = async (): Promise<readonly MembershipRow[]> => {
    const result = await execution.query<MembershipRow>(`SELECT
      granted_role.rolname AS granted_role,
      member_role.rolname AS member_role,
      grantor_role.rolname AS grantor_role,
      memberships.admin_option,
      memberships.inherit_option,
      memberships.set_option
    FROM pg_catalog.pg_auth_members memberships
    JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
    JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
    JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
    WHERE granted_role.rolname IN ('ai_mls_production_migration_operator', 'ai_mls_production_runtime')
       OR member_role.rolname IN ('ai_mls_production_migration_operator', 'ai_mls_production_runtime')
    ORDER BY granted_role.rolname, member_role.rolname, grantor_role.rolname`);
    return result.rows;
  };

  try {
    await admin.query("CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query(roleCreation);
    await admin.query(migrationGrants);
    await admin.query(`GRANT ai_mls_production_migration_operator TO postgres
      WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`);
    await admin.query(`GRANT ai_mls_production_runtime TO postgres
      WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`);
    await admin.query("ALTER DATABASE postgres OWNER TO postgres");

    await admin.query("SET ROLE ai_mls_production_migration_operator");
    await admin.query(migration);
    await admin.query(await verifyForDisposableRuntime());
    await admin.query(attestationSchema);
    await admin.query("BEGIN");
    await admin.query("SELECT set_config('ai_mls.operator_evidence_ref', 'REL002-EVIDENCE-OPERATOR-001', true)");
    await admin.query("SELECT set_config('ai_mls.backup_evidence_ref', 'REL002-EVIDENCE-BACKUP-RESTORE-001', true)");
    await admin.query("SELECT set_config('ai_mls.schema_verification_evidence_ref', 'REL002-EVIDENCE-SCHEMA-VERIFY-001', true)");
    await admin.query(attestationRecord);
    await admin.query(attestationVerify);
    await admin.query("COMMIT");
    await admin.query("REVOKE ALL ON SCHEMA app_identity FROM ai_mls_production_runtime");
    await admin.query("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA app_identity FROM ai_mls_production_runtime");
    await admin.query("REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app_identity FROM ai_mls_production_runtime");
    await admin.query("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app_identity FROM ai_mls_production_runtime");
    await admin.query("GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations TO ai_mls_production_runtime");
    await admin.query("GRANT EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() TO ai_mls_production_runtime");
    await admin.query("RESET ROLE");
    await admin.query("REVOKE ALL ON DATABASE postgres FROM ai_mls_production_runtime");
    await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");

    await execution.connect();
    await assert.rejects(
      execution.query("SET ROLE ai_mls_production_migration_operator"),
      /permission denied to set role/iu,
    );
    const partialState = await snapshot();
    assert.deepEqual(await exactMemberships(), [
      {
        granted_role: "ai_mls_production_migration_operator",
        member_role: "postgres",
        grantor_role: adminUser,
        admin_option: true,
        inherit_option: false,
        set_option: false,
      },
      {
        granted_role: "ai_mls_production_runtime",
        member_role: "postgres",
        grantor_role: adminUser,
        admin_option: true,
        inherit_option: false,
        set_option: false,
      },
    ]);

    await admin.query("SET ROLE ai_mls_production_migration_operator");
    await admin.query("GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations TO PUBLIC");
    await admin.query("RESET ROLE");
    const publicLeakState = await snapshot();
    const publicLeakProbe = recovery.replace(
      "-- FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT",
      "SELECT 1 / 0;\n-- FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT",
    );
    await assert.rejects(
      execution.query(publicLeakProbe),
      /DIRECT_TABLE_PARTIAL_STATE_MISMATCH/iu,
    );
    await execution.query("ROLLBACK");
    assert.deepEqual(await snapshot(), publicLeakState);
    await admin.query("SET ROLE ai_mls_production_migration_operator");
    await admin.query("REVOKE SELECT ON TABLE app_identity.identity_historical_migration_attestations FROM PUBLIC");
    await admin.query("RESET ROLE");
    assert.deepEqual(await snapshot(), partialState);

    await admin.query("REVOKE TEMPORARY ON DATABASE postgres FROM PUBLIC");
    const missingPublicTemporaryState = await snapshot();
    const missingPublicTemporaryProbe = recovery.replace(
      "-- FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT",
      "SELECT 1 / 0;\n-- FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT",
    );
    await assert.rejects(
      execution.query(missingPublicTemporaryProbe),
      /DATABASE_BOUNDARY_MISMATCH/iu,
    );
    await execution.query("ROLLBACK");
    assert.deepEqual(await snapshot(), missingPublicTemporaryState);
    await admin.query("GRANT TEMPORARY ON DATABASE postgres TO PUBLIC");
    assert.deepEqual(await snapshot(), partialState);

    const failureMarkers = [
      "FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT",
      "FAILURE_INJECTION_AFTER_TEMPORARY_GRANT",
      "FAILURE_INJECTION_AFTER_SET_ROLE",
      "FAILURE_INJECTION_DURING_ACL_MUTATION",
      "FAILURE_INJECTION_AFTER_RESET_ROLE",
      "FAILURE_INJECTION_BEFORE_TEMPORARY_GRANT_CLEANUP",
      "FAILURE_INJECTION_AFTER_TEMPORARY_GRANT_CLEANUP",
    ];
    for (const marker of failureMarkers) {
      const injected = recovery.replace(`-- ${marker}`, `SELECT 1 / 0;\n-- ${marker}`);
      await assert.rejects(execution.query(injected), /division by zero/iu, marker);
      await execution.query("ROLLBACK");
      assert.deepEqual(await snapshot(), partialState, marker);
    }

    await execution.query(recovery);
    assert.equal(
      verificationPassed(await execution.query(roleVerify) as unknown as QueryResult<VerificationRow>[]),
      true,
    );
    assert.deepEqual(await exactMemberships(), [
      {
        granted_role: "ai_mls_production_migration_operator",
        member_role: "postgres",
        grantor_role: adminUser,
        admin_option: true,
        inherit_option: false,
        set_option: false,
      },
      {
        granted_role: "ai_mls_production_runtime",
        member_role: "postgres",
        grantor_role: adminUser,
        admin_option: true,
        inherit_option: false,
        set_option: false,
      },
    ]);
    const finalState = await snapshot();
    await assert.rejects(execution.query(recovery), /EXPECTED_MISSING_SCHEMA_USAGE/iu);
    await execution.query("ROLLBACK");
    assert.deepEqual(await snapshot(), finalState);

    await admin.query("SET ROLE ai_mls_production_migration_operator");
    await admin.query("DROP TABLE app_identity.identity_registered_service_workloads");
    await admin.query("RESET ROLE");
    assert.equal(
      verificationPassed(await execution.query(roleVerify) as unknown as QueryResult<VerificationRow>[]),
      false,
    );
  } finally {
    if ((execution as unknown as { _connected?: boolean })._connected === true) {
      await execution.end();
    }
    await admin.end();
  }
});
