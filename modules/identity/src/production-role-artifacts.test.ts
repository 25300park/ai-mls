import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const runtimeSql = readFileSync(resolve("modules/identity/migrations/postgresql/production/002_runtime_role_grants.sql"), "utf8");
const migrationSql = readFileSync(resolve("modules/identity/migrations/postgresql/production/003_migration_operator_role_grants.sql"), "utf8");
const roleCreationPath = resolve("modules/identity/migrations/postgresql/production/000_production_role_creation.sql");
const preMigrationRoleVerificationPath = resolve("modules/identity/migrations/postgresql/production/003a_pre_migration_role_privilege_verification.sql");
const roleVerificationPath = resolve("modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql");
const recoveryPath = resolve("modules/identity/migrations/postgresql/production/009_complete_production_runtime_role_boundary_after_partial_002.sql");
const executionRunbookPath = resolve("docs/implementation/REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md");

function executableStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gmu, "")
    .split(";")
    .map((statement) => statement.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

test("role creation artifact creates the exact two passwordless least-privilege LOGIN roles", () => {
  assert.equal(existsSync(roleCreationPath), true);
  const sql = readFileSync(roleCreationPath, "utf8");
  for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
    assert.match(sql, new RegExp(`CREATE\\s+ROLE\\s+${role}\\s+LOGIN\\s+NOSUPERUSER\\s+NOCREATEDB\\s+NOCREATEROLE\\s+NOINHERIT\\s+NOREPLICATION\\s+NOBYPASSRLS`, "iu"));
  }
  assert.doesNotMatch(sql, /PASSWORD|SECRET|CREDENTIAL|DO\s+\$\$|IF\s+NOT\s+EXISTS/iu);
});

test("role privilege verification artifact is read-only and checks positive and negative authority", () => {
  assert.equal(existsSync(roleVerificationPath), true);
  const sql = readFileSync(roleVerificationPath, "utf8");
  assert.match(sql, /ai_mls_production_runtime/u);
  assert.match(sql, /ai_mls_production_migration_operator/u);
  assert.match(sql, /has_database_privilege/iu);
  assert.match(sql, /has_schema_privilege/iu);
  assert.match(sql, /has_table_privilege/iu);
  assert.match(sql, /rolsuper/iu);
  assert.match(sql, /rolcreatedb/iu);
  assert.match(sql, /rolcreaterole/iu);
  assert.match(sql, /rolinherit/iu);
  assert.match(sql, /rolreplication/iu);
  assert.match(sql, /rolbypassrls/iu);
  assert.match(sql, /database_acl\s+AS\s*\(/iu);
  assert.match(sql, /aclexplode\s*\(/iu);
  assert.match(sql, /privilege_type\s*=\s*'TEMPORARY'/iu);
  assert.match(sql, /database_acl[^]*is_grantable/iu);
  assert.match(sql, /identity_historical_migration_attestations/iu);
  assert.match(sql, /identity_historical_attestation_schema_is_exact/iu);
  assert.match(sql, /function_acl\s+AS\s*\(/iu);
  assert.match(sql, /COALESCE\(grantee_roles\.rolname::text,\s*'PUBLIC'\)/iu);
  assert.match(sql, /grantee_roles\.rolname\s+IN\s*\(\s*'ai_mls_production_runtime',\s*'ai_mls_production_migration_operator'\s*\)/iu);
  assert.match(sql, /privileges\.grantee\s*<>\s*objects\.relowner/iu);
  assert.match(sql, /member_role\.rolname\s+IN\s*\(\s*'ai_mls_production_runtime',\s*'ai_mls_production_migration_operator'\s*\)/iu);
  assert.doesNotMatch(sql, /granted_role\.rolname\s+IN\s*\([^)]*\)\s+OR\s+member_role\.rolname/iu);
  assert.doesNotMatch(sql, /NOT\s+pg_catalog\.has_database_privilege\([^)]*'TEMPORARY'\)/iu);
  assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/imu);
  assert.doesNotMatch(sql, /PASSWORD|SECRET|CREDENTIAL/iu);
});

test("runtime role grants only steady-state Identity and Session privileges", () => {
  const roleCreationSql = readFileSync(roleCreationPath, "utf8");
  assert.match(runtimeSql, /ai_mls_production_runtime/u);
  assert.match(roleCreationSql, /CREATE\s+ROLE\s+ai_mls_production_runtime\s+LOGIN\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE\s+NOINHERIT\s+NOREPLICATION\s+NOBYPASSRLS/iu);
  assert.doesNotMatch(runtimeSql, /\bALTER\s+ROLE\b/iu);
  assert.match(runtimeSql, /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+TABLE\s+app_identity\.identity_sessions/iu);
  assert.match(runtimeSql, /GRANT\s+INSERT\s+ON\s+TABLE\s+app_identity\.identity_session_revocations/iu);
  assert.match(runtimeSql, /GRANT\s+SELECT\s+ON\s+TABLE\s+app_identity\.identity_historical_migration_attestations\s+TO\s+ai_mls_production_runtime/iu);
  assert.match(runtimeSql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+app_identity\.identity_historical_attestation_schema_is_exact\(\)\s+TO\s+ai_mls_production_runtime/iu);
  assert.doesNotMatch(runtimeSql, /GRANT[^;]*(?:CREATE|ALTER|DROP|TRUNCATE|DELETE|REFERENCES|TRIGGER|ROLE|WITH\s+GRANT\s+OPTION)/iu);
  assert.doesNotMatch(runtimeSql, /\b(?:GRANT|REVOKE)[^;]*\bPUBLIC\b/iu);
  assert.doesNotMatch(runtimeSql, /ai_mls_production_migration_operator/u);
  assert.match(runtimeSql, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+(?:TABLES|FUNCTIONS|SEQUENCES)/iu);
});

test("partial 002 recovery is a new atomic owner-split artifact and preserves historical 002 bytes", () => {
  assert.equal(
    createHash("sha256").update(runtimeSql).digest("hex"),
    "76275ea39fd4881633e1d3097e5227e37a611b9fac36e0a0ad960795fbb985fb",
  );
  assert.equal(existsSync(recoveryPath), true);
  const recoverySql = readFileSync(recoveryPath, "utf8");
  assert.match(recoverySql, /^BEGIN;/mu);
  assert.match(recoverySql, /SET\s+LOCAL\s+ROLE\s+ai_mls_production_migration_operator/iu);
  assert.match(recoverySql, /RESET\s+ROLE/iu);
  assert.match(recoverySql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+app_identity\.reject_historical_migration_attestation_mutation\(\)\s+FROM\s+PUBLIC/iu);
  assert.match(recoverySql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+app_identity\.identity_historical_attestation_schema_is_exact\(\)\s+TO\s+ai_mls_production_runtime/iu);
  assert.doesNotMatch(recoverySql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+app_identity\.reject_historical_migration_attestation_mutation\(\)\s+TO\s+ai_mls_production_runtime/iu);
  assert.match(recoverySql, /FAILURE_INJECTION_POINT/iu);
  assert.match(recoverySql, /COMMIT;\s*$/u);
});

test("migration operator attributes remain owned by 000 and 003 is Supabase-compatible grant-only SQL", () => {
  const roleCreationSql = readFileSync(roleCreationPath, "utf8");
  assert.match(roleCreationSql, /CREATE\s+ROLE\s+ai_mls_production_migration_operator\s+LOGIN\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE\s+NOINHERIT\s+NOREPLICATION\s+NOBYPASSRLS/iu);
  assert.doesNotMatch(migrationSql, /\bALTER\s+ROLE\b/iu);
  assert.deepEqual(executableStatements(migrationSql), [
    "REVOKE ALL ON DATABASE postgres FROM ai_mls_production_migration_operator",
    "GRANT CONNECT ON DATABASE postgres TO ai_mls_production_migration_operator",
    "GRANT CREATE ON DATABASE postgres TO ai_mls_production_migration_operator",
  ]);
  assert.doesNotMatch(migrationSql, /\b(?:SUPERUSER|CREATEDB|CREATEROLE|REPLICATION|BYPASSRLS)\b/iu);
  assert.doesNotMatch(migrationSql, /GRANT[^;]*TO\s+ai_mls_production_runtime/iu);
  assert.doesNotMatch(migrationSql, /GRANT[^;]*(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE)\b/iu);
  assert.doesNotMatch(migrationSql, /ON\s+(?:TABLE|ALL\s+TABLES|FUNCTION|ALL\s+FUNCTIONS|SEQUENCE|ALL\s+SEQUENCES|SCHEMA)\b/iu);
  assert.doesNotMatch(migrationSql, /PASSWORD|SECRET|CREDENTIAL/iu);
});

test("pre-migration verification is schema-free and validates direct database ACL state", () => {
  assert.equal(existsSync(preMigrationRoleVerificationPath), true);
  const sql = readFileSync(preMigrationRoleVerificationPath, "utf8");
  assert.match(sql, /ai_mls_production_runtime/u);
  assert.match(sql, /ai_mls_production_migration_operator/u);
  assert.match(sql, /database_acl\s+AS\s*\(/iu);
  assert.match(sql, /effective_temporary_observed/iu);
  assert.match(sql, /direct_temporary_observed/iu);
  assert.match(sql, /pg_auth_members/iu);
  assert.doesNotMatch(sql, /app_identity|has_schema_privilege|has_table_privilege/iu);
  assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/imu);
  assert.doesNotMatch(sql, /PASSWORD|SECRET|CREDENTIAL/iu);
});

test("controlled execution keeps role creation before grant, migration, runtime grant, and verification", () => {
  const runbook = readFileSync(executionRunbookPath, "utf8");
  const orderedArtifacts = [
    "000_production_role_creation.sql",
    "003_migration_operator_role_grants.sql",
    "003a_pre_migration_role_privilege_verification.sql",
    "001_identity_persistence_v1.up.sql",
    "001_identity_persistence_v1.verify.sql",
    "005_record_existing_identity_migration_v1.sql",
    "002_runtime_role_grants.sql",
    "004_production_role_privilege_verification.sql",
  ];
  const positions = orderedArtifacts.map((artifact) => runbook.indexOf(artifact));
  assert.equal(positions.every((position) => position >= 0), true);
  for (let index = 1; index < positions.length; index += 1) {
    assert.equal(positions[index - 1]! < positions[index]!, true);
  }
});
