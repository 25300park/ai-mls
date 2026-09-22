import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const runtimeSql = readFileSync(resolve("modules/identity/migrations/postgresql/production/002_runtime_role_grants.sql"), "utf8");
const migrationSql = readFileSync(resolve("modules/identity/migrations/postgresql/production/003_migration_operator_role_grants.sql"), "utf8");

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
