import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const runtimeSql = readFileSync(resolve("modules/identity/migrations/postgresql/production/002_runtime_role_grants.sql"), "utf8");
const migrationSql = readFileSync(resolve("modules/identity/migrations/postgresql/production/003_migration_operator_role_grants.sql"), "utf8");
const roleCreationPath = resolve("modules/identity/migrations/postgresql/production/000_production_role_creation.sql");
const roleVerificationPath = resolve("modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql");

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
  assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/imu);
  assert.doesNotMatch(sql, /PASSWORD|SECRET|CREDENTIAL/iu);
});

test("runtime role grants only steady-state Identity and Session privileges", () => {
  assert.match(runtimeSql, /ai_mls_production_runtime/u);
  assert.match(runtimeSql, /ALTER\s+ROLE\s+ai_mls_production_runtime\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE\s+NOINHERIT\s+NOREPLICATION\s+NOBYPASSRLS/iu);
  assert.match(runtimeSql, /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+TABLE\s+app_identity\.identity_sessions/iu);
  assert.match(runtimeSql, /GRANT\s+INSERT\s+ON\s+TABLE\s+app_identity\.identity_session_revocations/iu);
  assert.doesNotMatch(runtimeSql, /GRANT[^;]*(?:CREATE|ALTER|DROP|TRUNCATE|DELETE|REFERENCES|TRIGGER|ROLE|WITH\s+GRANT\s+OPTION)/iu);
  assert.doesNotMatch(runtimeSql, /ai_mls_production_migration_operator/u);
  assert.match(runtimeSql, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL\s+(?:TABLES|FUNCTIONS|SEQUENCES)/iu);
});

test("migration operator is separate and the runtime role receives no migration authority", () => {
  assert.match(migrationSql, /ai_mls_production_migration_operator/u);
  assert.match(migrationSql, /ALTER\s+ROLE\s+ai_mls_production_migration_operator\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE\s+NOINHERIT\s+NOREPLICATION\s+NOBYPASSRLS/iu);
  assert.match(migrationSql, /GRANT\s+CREATE\s+ON\s+DATABASE\s+postgres/iu);
  assert.doesNotMatch(migrationSql, /GRANT[^;]*TO\s+ai_mls_production_runtime/iu);
  assert.doesNotMatch(migrationSql, /GRANT[^;]*(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE)\b/iu);
  assert.doesNotMatch(migrationSql, /ON\s+(?:TABLE|ALL\s+TABLES|FUNCTION|ALL\s+FUNCTIONS|SEQUENCE|ALL\s+SEQUENCES|SCHEMA)\b/iu);
  assert.doesNotMatch(migrationSql, /PASSWORD|SECRET|CREDENTIAL/iu);
});
