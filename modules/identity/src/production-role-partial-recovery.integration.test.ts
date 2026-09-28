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
type BoundarySnapshot = Readonly<{
  schema_usage: boolean;
  schema_create: boolean;
  original_select_count: string;
  historical_select: boolean;
  verifier_execute: boolean;
  verifier_public_execute: boolean;
  mutation_execute: boolean;
  mutation_public_execute: boolean;
  database_acl: string;
  schema_acl: string;
  table_acl: string;
  function_acl: string;
  memberships: string;
}>;

type BoundaryCore = Omit<BoundarySnapshot, "database_acl" | "schema_acl" | "table_acl" | "function_acl" | "memberships">;

function verificationPassed(results: QueryResult<VerificationRow>[]): boolean {
  const rows = results.flatMap((result) => result.rows).filter((row) => row.matches_expected !== undefined);
  return rows.length > 0 && rows.every((row) => row.matches_expected === true);
}

function boundaryCore(snapshot: BoundarySnapshot): BoundaryCore {
  return {
    schema_usage: snapshot.schema_usage,
    schema_create: snapshot.schema_create,
    original_select_count: snapshot.original_select_count,
    historical_select: snapshot.historical_select,
    verifier_execute: snapshot.verifier_execute,
    verifier_public_execute: snapshot.verifier_public_execute,
    mutation_execute: snapshot.mutation_execute,
    mutation_public_execute: snapshot.mutation_public_execute,
  };
}

test("009 atomically recovers the exact partial 002 Production role boundary", { skip: !enabled }, async () => {
  const client = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  const roleCreation = await artifact("000_production_role_creation.sql");
  const migrationGrants = await artifact("003_migration_operator_role_grants.sql");
  const preMigrationVerify = await artifact("003a_pre_migration_role_privilege_verification.sql");
  const migration = await artifact("001_identity_persistence_v1.up.sql");
  const migrationVerify = await artifact("001_identity_persistence_v1.verify.sql");
  const attestationSchema = await artifact("006_historical_migration_attestation_schema_v1.sql");
  const attestationRecord = await artifact("007_record_historical_identity_migration_attestation_v1.sql");
  const attestationVerify = await artifact("008_historical_identity_migration_attestation_v1.verify.sql");
  const recovery = await artifact("009_complete_production_runtime_role_boundary_after_partial_002.sql");
  const roleVerify = await artifact("004_production_role_privilege_verification.sql");
  await client.connect();

  const verifyForDisposableRuntime = async (): Promise<string> => {
    const result = await client.query<{ count: string }>(`SELECT count(*) AS count
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'app_identity'`);
    return migrationVerify.replace("mismatch_count <> 24", `mismatch_count <> ${result.rows[0]?.count ?? "invalid"}`);
  };
  const snapshot = async (): Promise<BoundarySnapshot> => {
    const result = await client.query<BoundarySnapshot>(`SELECT
      pg_catalog.has_schema_privilege('ai_mls_production_runtime', 'app_identity', 'USAGE') AS schema_usage,
      pg_catalog.has_schema_privilege('ai_mls_production_runtime', 'app_identity', 'CREATE') AS schema_create,
      (SELECT count(*)::text FROM (VALUES
        ('identity_schema_contracts'),
        ('identity_schema_migrations'),
        ('identity_registered_service_workloads'),
        ('identity_sessions'),
        ('identity_session_revocations')
      ) expected(table_name)
      WHERE pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', 'app_identity.' || expected.table_name, 'SELECT'
      )) AS original_select_count,
      pg_catalog.has_table_privilege(
        'ai_mls_production_runtime', 'app_identity.identity_historical_migration_attestations', 'SELECT'
      ) AS historical_select,
      pg_catalog.has_function_privilege(
        'ai_mls_production_runtime', 'app_identity.identity_historical_attestation_schema_is_exact()', 'EXECUTE'
      ) AS verifier_execute,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc procedures
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
        ) privileges
        WHERE namespaces.nspname = 'app_identity'
          AND procedures.proname = 'identity_historical_attestation_schema_is_exact'
          AND procedures.pronargs = 0
          AND privileges.grantee = 0
          AND privileges.privilege_type = 'EXECUTE'
      ) AS verifier_public_execute,
      pg_catalog.has_function_privilege(
        'ai_mls_production_runtime', 'app_identity.reject_historical_migration_attestation_mutation()', 'EXECUTE'
      ) AS mutation_execute,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc procedures
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
        ) privileges
        WHERE namespaces.nspname = 'app_identity'
          AND procedures.proname = 'reject_historical_migration_attestation_mutation'
          AND procedures.pronargs = 0
          AND privileges.grantee = 0
          AND privileges.privilege_type = 'EXECUTE'
      ) AS mutation_public_execute,
      COALESCE((
        SELECT string_agg(
          COALESCE(roles.rolname::text, 'PUBLIC') || ':' || privileges.privilege_type || ':' || privileges.is_grantable::text,
          ',' ORDER BY COALESCE(roles.rolname::text, 'PUBLIC'), privileges.privilege_type, privileges.is_grantable
        )
        FROM pg_catalog.pg_database databases
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(databases.datacl, pg_catalog.acldefault('d', databases.datdba))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE databases.datname = 'postgres'
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), '') AS database_acl,
      COALESCE((
        SELECT string_agg(
          COALESCE(roles.rolname::text, 'PUBLIC') || ':' || privileges.privilege_type || ':' || privileges.is_grantable::text,
          ',' ORDER BY COALESCE(roles.rolname::text, 'PUBLIC'), privileges.privilege_type, privileges.is_grantable
        )
        FROM pg_catalog.pg_namespace namespaces
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(namespaces.nspacl, pg_catalog.acldefault('n', namespaces.nspowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), '') AS schema_acl,
      COALESCE((
        SELECT string_agg(
          objects.relname::text || ':' || COALESCE(roles.rolname::text, 'PUBLIC') || ':' ||
            privileges.privilege_type || ':' || privileges.is_grantable::text,
          ',' ORDER BY objects.relname, COALESCE(roles.rolname::text, 'PUBLIC'), privileges.privilege_type, privileges.is_grantable
        )
        FROM pg_catalog.pg_class objects
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = objects.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(objects.relacl, pg_catalog.acldefault('r', objects.relowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), '') AS table_acl,
      COALESCE((
        SELECT string_agg(
          procedures.proname::text || ':' || COALESCE(roles.rolname::text, 'PUBLIC') || ':' ||
            privileges.privilege_type || ':' || privileges.is_grantable::text,
          ',' ORDER BY procedures.proname, COALESCE(roles.rolname::text, 'PUBLIC'), privileges.privilege_type, privileges.is_grantable
        )
        FROM pg_catalog.pg_proc procedures
        JOIN pg_catalog.pg_namespace namespaces ON namespaces.oid = procedures.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
        ) privileges
        LEFT JOIN pg_catalog.pg_roles roles ON roles.oid = privileges.grantee
        WHERE namespaces.nspname = 'app_identity'
          AND (roles.rolname = 'ai_mls_production_runtime' OR privileges.grantee = 0)
      ), '') AS function_acl,
      COALESCE((
        SELECT string_agg(
          granted_role.rolname::text || '->' || member_role.rolname::text || ':' || memberships.admin_option::text,
          ',' ORDER BY granted_role.rolname, member_role.rolname, memberships.admin_option
        )
        FROM pg_catalog.pg_auth_members memberships
        JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
        JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
        WHERE granted_role.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator')
          OR member_role.rolname IN ('ai_mls_production_runtime', 'ai_mls_production_migration_operator')
      ), '') AS memberships`);
    return result.rows[0]!;
  };
  const partialState: BoundaryCore = {
    schema_usage: false,
    schema_create: false,
    original_select_count: "0",
    historical_select: true,
    verifier_execute: true,
    verifier_public_execute: false,
    mutation_execute: true,
    mutation_public_execute: true,
  };

  try {
    await client.query(roleCreation);
    await client.query(migrationGrants);
    assert.equal(verificationPassed(await client.query(preMigrationVerify) as unknown as QueryResult<VerificationRow>[]), true);

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

    await client.query("REVOKE ALL ON SCHEMA app_identity FROM ai_mls_production_runtime");
    await client.query("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA app_identity FROM ai_mls_production_runtime");
    await client.query("REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app_identity FROM ai_mls_production_runtime");
    await client.query("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app_identity FROM ai_mls_production_runtime");
    await client.query("GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations TO ai_mls_production_runtime");
    await client.query("GRANT EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() TO ai_mls_production_runtime");
    await client.query("RESET ROLE");
    await client.query("REVOKE ALL ON DATABASE postgres FROM ai_mls_production_runtime");
    await client.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");

    const observedPartialState = await snapshot();
    assert.deepEqual(boundaryCore(observedPartialState), partialState);
    assert.equal(verificationPassed(await client.query(roleVerify) as unknown as QueryResult<VerificationRow>[]), false);

    const membership = await client.query<{ can_set: boolean }>(
      "SELECT pg_catalog.pg_has_role(session_user, 'ai_mls_production_migration_operator', 'SET') AS can_set",
    );
    assert.deepEqual(membership.rows, [{ can_set: true }]);

    const injected = recovery.replace(
      "-- FAILURE_INJECTION_POINT",
      "SELECT 1 / 0;\n-- FAILURE_INJECTION_POINT",
    );
    await assert.rejects(client.query(injected), /division by zero/iu);
    await client.query("ROLLBACK");
    assert.deepEqual(await snapshot(), observedPartialState);

    await client.query(recovery);
    const results = await client.query(roleVerify) as unknown as QueryResult<VerificationRow>[];
    assert.equal(verificationPassed(results), true, JSON.stringify(results.flatMap((result) => result.rows)));
    const finalSnapshot = await snapshot();
    assert.deepEqual(boundaryCore(finalSnapshot), {
      schema_usage: true,
      schema_create: false,
      original_select_count: "4",
      historical_select: true,
      verifier_execute: true,
      verifier_public_execute: false,
      mutation_execute: false,
      mutation_public_execute: false,
    });
    const currentRole = await client.query<{ session_user: string; current_user: string }>(
      "SELECT session_user, current_user",
    );
    assert.deepEqual(currentRole.rows, [{ session_user: "postgres", current_user: "postgres" }]);
  } finally {
    await client.end();
  }
});
