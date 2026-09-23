import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "./postgresql-pool.js";
import { PostgreSqlRegisteredServiceWorkloadStore } from "./registered-service-workload-postgresql.js";
import {
  inspectPostgreSqlRegisteredServiceWorkloadSchema,
  POSTGRESQL_IDENTITY_MIGRATION_ARTIFACT_SHA256,
  POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID,
} from "./registered-service-workload-postgresql-schema.js";

const tableColumns = Object.freeze({
  identity_schema_contracts: [["contract_id", "text"], ["schema_version", "integer"], ["database_engine", "text"], ["contract_fingerprint", "text"], ["recorded_at", "timestamp with time zone"]],
  identity_schema_migrations: [["migration_id", "text"], ["artifact_checksum", "text"], ["contract_id", "text"], ["schema_version", "integer"], ["database_engine", "text"], ["contract_fingerprint", "text"], ["target_environment", "text"], ["operator_evidence_ref", "text"], ["backup_evidence_ref", "text"], ["applied_at", "timestamp with time zone"], ["result", "text"]],
  identity_sessions: [["session_id", "text"], ["session_version", "bigint"], ["state", "text"], ["payload_json", "jsonb"], ["created_at", "timestamp with time zone"], ["updated_at", "timestamp with time zone"]],
  identity_session_revocations: [["session_id", "text"], ["session_version", "bigint"], ["revoked_at", "timestamp with time zone"], ["reason", "text"], ["identity_evidence_ref", "text"], ["audit_evidence_ref", "text"]],
  identity_registered_service_workloads: [["registration_id", "text"], ["tenant_id", "text"], ["principal_id", "text"], ["principal_type", "text"], ["assurance", "text"], ["environment", "text"], ["status", "text"], ["workload_purpose", "text"], ["audience", "text"], ["registration_version", "bigint"], ["identity_evidence_ref", "text"], ["audit_evidence_ref", "text"], ["created_at", "timestamp with time zone"], ["updated_at", "timestamp with time zone"]],
} as const);

const columns = Object.entries(tableColumns).flatMap(([table_name, values]) => values.map(([column_name, data_type]) => ({ table_name, column_name, data_type, is_nullable: "NO", generated: "", default_expression: null })));

const constraintDefinitions = Object.freeze({
  identity_schema_contracts_pkey: "PRIMARY KEY (contract_id, schema_version, database_engine)",
  identity_schema_contracts_version_check: "CHECK (schema_version >= 1)",
  identity_schema_contracts_engine_check: "CHECK (database_engine = 'POSTGRESQL')",
  identity_schema_migrations_pkey: "PRIMARY KEY (migration_id)",
  identity_schema_migrations_version_check: "CHECK (schema_version >= 1)",
  identity_schema_migrations_engine_check: "CHECK (database_engine = 'POSTGRESQL')",
  identity_schema_migrations_environment_check: "CHECK (target_environment = 'PRODUCTION')",
  identity_schema_migrations_result_check: "CHECK (result = 'APPLIED')",
  identity_schema_migrations_contract_key: "UNIQUE (contract_id, schema_version, database_engine)",
  identity_schema_migrations_contract_fkey: "FOREIGN KEY (contract_id, schema_version, database_engine) REFERENCES app_identity.identity_schema_contracts (contract_id, schema_version, database_engine)",
  identity_sessions_pkey: "PRIMARY KEY (session_id)",
  identity_sessions_version_check: "CHECK (session_version BETWEEN 1 AND 9007199254740991)",
  identity_sessions_state_check: "CHECK (state IN ('ACTIVE', 'REVOKED', 'EXPIRED'))",
  identity_sessions_chronology_check: "CHECK (updated_at >= created_at)",
  identity_session_revocations_pkey: "PRIMARY KEY (session_id, session_version)",
  identity_session_revocations_version_check: "CHECK (session_version BETWEEN 1 AND 9007199254740991)",
  identity_session_revocations_session_fkey: "FOREIGN KEY (session_id) REFERENCES app_identity.identity_sessions (session_id)",
  identity_registered_service_workloads_pkey: "PRIMARY KEY (registration_id)",
  identity_registered_service_workloads_tenant_principal_key: "UNIQUE (tenant_id, principal_id)",
  identity_registered_service_workloads_principal_type_check: "CHECK (principal_type = 'SERVICE')",
  identity_registered_service_workloads_assurance_check: "CHECK (assurance = 'WORKLOAD')",
  identity_registered_service_workloads_environment_check: "CHECK (environment = 'PRODUCTION')",
  identity_registered_service_workloads_status_check: "CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED'))",
  identity_registered_service_workloads_version_check: "CHECK (registration_version BETWEEN 1 AND 9007199254740991)",
});
const checkColumns: Readonly<Record<string, string>> = Object.freeze({
  identity_schema_contracts_version_check: "schema_version", identity_schema_contracts_engine_check: "database_engine",
  identity_schema_migrations_version_check: "schema_version", identity_schema_migrations_engine_check: "database_engine",
  identity_schema_migrations_environment_check: "target_environment", identity_schema_migrations_result_check: "result",
  identity_sessions_version_check: "session_version", identity_sessions_state_check: "state",
  identity_sessions_chronology_check: "created_at,updated_at", identity_session_revocations_version_check: "session_version",
  identity_registered_service_workloads_principal_type_check: "principal_type",
  identity_registered_service_workloads_assurance_check: "assurance",
  identity_registered_service_workloads_environment_check: "environment",
  identity_registered_service_workloads_status_check: "status",
  identity_registered_service_workloads_version_check: "registration_version",
});
const constraints = Object.entries(constraintDefinitions).map(([constraint_name, definition]) => {
  const kind = definition.startsWith("PRIMARY KEY") ? "p" : definition.startsWith("UNIQUE") ? "u" : definition.startsWith("FOREIGN KEY") ? "f" : "c";
  const keyMatch = /^\w+(?: \w+)? \(([^)]+)\)/u.exec(definition);
  const referenceTableMatch = /REFERENCES app_identity\.([^ (]+)/u.exec(definition);
  const referenceColumnsMatch = /REFERENCES app_identity\.[^ (]+ \(([^)]+)\)/u.exec(definition);
  const columnsValue = kind === "c" ? checkColumns[constraint_name] : keyMatch?.[1]?.replaceAll(" ", "");
  return {
    table_name: ownerTable(constraint_name), constraint_name, kind, columns: columnsValue,
    referenced_table: kind === "f" ? referenceTableMatch?.[1] : null,
    referenced_columns: kind === "f" ? referenceColumnsMatch?.[1]?.replaceAll(" ", "") : null,
    delete_action: "a", update_action: "a", match_type: "s",
    check_expression: kind === "c" ? definition.replace(/^CHECK \(/u, "").replace(/\)$/u, "") : null,
  };
});

const indexColumns = Object.freeze({
  identity_schema_contracts_pkey: ["contract_id", "schema_version", "database_engine"],
  identity_schema_migrations_pkey: ["migration_id"],
  identity_schema_migrations_contract_key: ["contract_id", "schema_version", "database_engine"],
  identity_sessions_pkey: ["session_id"],
  identity_sessions_family_idx: ["payload_json ->> 'familyId'::text", "session_id"],
  identity_sessions_state_updated_idx: ["state", "updated_at", "session_id"],
  identity_session_revocations_pkey: ["session_id", "session_version"],
  identity_registered_service_workloads_pkey: ["registration_id"],
  identity_registered_service_workloads_tenant_principal_key: ["tenant_id", "principal_id"],
  identity_registered_service_workloads_tenant_status_idx: ["tenant_id", "status"],
});
const indexes = Object.entries(indexColumns).map(([index_name, key_expressions]) => ({
  table_name: ownerTable(index_name), index_name, key_expressions, is_valid: true, is_partial: false,
  is_unique: index_name.endsWith("_pkey") || index_name.endsWith("_key"), is_primary: index_name.endsWith("_pkey"),
}));

function readyResponse(text: string): PostgreSqlQueryResult {
  if (text.startsWith("BEGIN") || text === "COMMIT" || text === "ROLLBACK") return result([]);
  if (text.includes("SELECT EXISTS")) return result([{ present: true }]);
  if (text.includes("rel.relkind AS relation_kind")) return result(Object.keys(tableColumns).sort().map((relation_name) => ({ relation_name, relation_kind: "r" })));
  if (text.includes("pg_catalog.pg_attribute") && !text.includes("con.contype AS kind")) return result(columns);
  if (text.includes("con.contype AS kind")) return result(constraints);
  if (text.includes("pg_get_indexdef")) return result(indexes);
  if (text.includes("NOT trg.tgisinternal")) return result([
    { table_name: "identity_session_revocations", trigger_name: "identity_session_revocations_no_delete", trigger_type: 11, enabled: "O", function_schema: "app_identity", function_name: "reject_session_revocation_mutation" },
    { table_name: "identity_session_revocations", trigger_name: "identity_session_revocations_no_update", trigger_type: 19, enabled: "O", function_schema: "app_identity", function_name: "reject_session_revocation_mutation" },
  ]);
  if (text.includes("proc.prosrc AS source")) return result([{ source: "BEGIN RAISE EXCEPTION 'append-only revocation'; END;", language: "plpgsql", result_type: "trigger", argument_count: 0, volatility: "v", security_definer: false }]);
  if (text.includes("identity_schema_contracts ORDER")) return result([
    { contract_id: "identity.registered-service-workload", schema_version: 1, database_engine: "POSTGRESQL", contract_fingerprint: "33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82" },
    { contract_id: "identity.session", schema_version: 1, database_engine: "POSTGRESQL", contract_fingerprint: "fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7" },
  ]);
  if (text.includes("identity_schema_migrations ORDER")) return result([{
    migration_id: "REL002-P2D0B-IDENTITY-PG-V1", artifact_checksum: "b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e",
    contract_id: "identity.registered-service-workload", schema_version: 1, database_engine: "POSTGRESQL",
    contract_fingerprint: "33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82", target_environment: "PRODUCTION", result: "APPLIED",
  }]);
  if (text.includes("has_schema_privilege")) return result([{
    schema_usage: true, schema_create: false, session_select: true, session_insert: true, session_update: true, session_excess: false,
    workload_read: true, workload_write: false, revocation_insert: true, revocation_excess: false,
    contract_read: true, contract_write: false, ledger_read: true, ledger_write: false,
  }]);
  throw new Error(`Unexpected catalog query: ${text}`);
}

test("reports READY only for the complete five-table PostgreSQL schema, privileges, and migration ledger", async () => {
  const queries: string[] = [];
  const { pool, releases } = harness((text) => { queries.push(text); return readyResponse(text); });
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(pool), "READY", queries.at(-2));
  assert.deepEqual(releases, [false]);
});

test("fails closed for missing, partial, incompatible, or over-privileged PostgreSQL schema", async () => {
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("SELECT EXISTS") ? result([{ present: false }]) : readyResponse(text)).pool), "NOT_READY_MISSING_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("rel.relkind AS relation_kind") ? result([{ relation_name: "identity_registered_service_workloads", relation_kind: "r" }]) : readyResponse(text)).pool), "NOT_READY_PARTIAL_MIGRATION");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("con.contype AS kind") ? result(constraints.map((row) => row.constraint_name === "identity_registered_service_workloads_principal_type_check" ? { ...row, check_expression: "principal_type <> 'SERVICE'" } : row)) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("has_schema_privilege") ? result([{ schema_usage: true, schema_create: true, session_select: true, session_insert: true, session_update: true, session_excess: false, workload_read: true, workload_write: false, revocation_insert: true, revocation_excess: false, contract_read: true, contract_write: false, ledger_read: true, ledger_write: false }]) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("has_schema_privilege") ? result([{ schema_usage: true, schema_create: false, session_select: true, session_insert: false, session_update: true, session_excess: false, workload_read: true, workload_write: false, revocation_insert: true, revocation_excess: false, contract_read: true, contract_write: false, ledger_read: true, ledger_write: false }]) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
});

test("fails closed for invalid indexes, unsupported versions, and missing migration evidence", async () => {
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("pg_get_indexdef") ? result(indexes.map((row) => row.index_name === "identity_sessions_family_idx" ? { ...row, is_valid: false } : row)) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("pg_get_indexdef") ? result(indexes.map((row) => row.index_name === "identity_sessions_state_updated_idx" ? { ...row, key_expressions: ["updated_at", "state", "session_id"] } : row)) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("identity_schema_contracts ORDER") ? result([{ contract_id: "identity.session", schema_version: 2, database_engine: "POSTGRESQL", contract_fingerprint: "wrong" }]) : readyResponse(text)).pool), "NOT_READY_UNSUPPORTED_VERSION");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("identity_schema_migrations ORDER") ? result([]) : readyResponse(text)).pool), "NOT_READY_PARTIAL_MIGRATION");
});

test("fails closed for defaults, cascading foreign keys, and altered trigger identity", async () => {
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("pg_catalog.pg_attribute") ? result(columns.map((row) => row.column_name === "state" ? { ...row, default_expression: "'ACTIVE'::text" } : row)) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("con.contype AS kind") ? result(constraints.map((row) => row.constraint_name === "identity_session_revocations_session_fkey" ? { ...row, delete_action: "c" } : row)) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("NOT trg.tgisinternal") ? result([{ table_name: "identity_sessions", trigger_name: "identity_session_revocations_no_delete", trigger_type: 11, enabled: "O", function_schema: "app_identity", function_name: "reject_session_revocation_mutation" }, { table_name: "identity_session_revocations", trigger_name: "identity_session_revocations_no_update", trigger_type: 19, enabled: "O", function_schema: "app_identity", function_name: "reject_session_revocation_mutation" }]) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
  assert.equal(await inspectPostgreSqlRegisteredServiceWorkloadSchema(harness((text) => text.includes("con.contype AS kind") ? result(constraints.map((row) => row.constraint_name === "identity_session_revocations_version_check" ? { ...row, table_name: "identity_sessions" } : row)) : readyResponse(text)).pool), "NOT_READY_INCOMPATIBLE_SCHEMA");
});

test("loads a bounded immutable workload record and normalizes pg timestamptz Date values", async () => {
  let verified = 0;
  const { pool, releases } = harness(() => result([{
    registration_id: "reg-api", tenant_id: "tenant-1", principal_id: "svc-api", principal_type: "SERVICE",
    assurance: "WORKLOAD", environment: "PRODUCTION", status: "ACTIVE", workload_purpose: "API",
    audience: "internal", registration_version: "2", identity_evidence_ref: "evidence:identity",
    audit_evidence_ref: "evidence:audit", created_at: new Date("2026-09-19T00:00:00.000Z"), updated_at: new Date("2026-09-19T00:01:00.000Z"),
  }]));
  const store = new PostgreSqlRegisteredServiceWorkloadStore(pool, { assertRegisteredWorkloadEvidence: () => { verified += 1; } });
  const record = await store.findByRegistrationId("reg-api");
  assert.equal(record?.registrationVersion, 2);
  assert.equal(record?.createdAt, "2026-09-19T00:00:00.000Z");
  assert.equal(Object.isFrozen(record), true);
  assert.equal(verified, 1);
  assert.deepEqual(releases, [false]);
  await store.close();
  await assert.rejects(() => store.findByRegistrationId("reg-api"));
});

test("migration artifacts are executor-owned PostgreSQL DDL and executable structural assertions", async () => {
  const sql = await readFile(resolve("modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql"), "utf8");
  const verify = await readFile(resolve("modules/identity/migrations/postgresql/production/001_identity_persistence_v1.verify.sql"), "utf8");
  assert.match(sql, /CREATE SCHEMA app_identity/u);
  assert.match(sql, /CREATE TABLE app_identity\.identity_sessions/u);
  assert.match(sql, /CREATE TABLE app_identity\.identity_registered_service_workloads/u);
  assert.match(sql, /timestamptz/u);
  assert.equal(/\b(?:BEGIN|COMMIT)\s*;/u.test(sql), false);
  assert.equal(sql.includes("sqlite"), false);
  assert.equal(sql.includes("INSERT INTO app_identity.identity_registered_service_workloads"), false);
  assert.match(sql, /CHECK \(principal_type = 'SERVICE'\)/u);
  assert.match(sql, /UNIQUE \(tenant_id, principal_id\)/u);
  assert.match(sql, /identity_registered_service_workloads_tenant_status_idx/u);
  assert.match(verify, /DO \$\$/u);
  assert.match(verify, /RAISE EXCEPTION/u);
  assert.match(verify, /FULL JOIN actual/u);
  assert.match(verify, /pg_catalog\.format_type/u);
  assert.match(verify, /pg_catalog\.pg_get_constraintdef/u);
  assert.match(verify, /pg_catalog\.pg_get_indexdef/u);
  assert.match(verify, /trg\.tgtype = 11/u);
  assert.match(verify, /trg\.tgtype = 19/u);
  assert.match(verify, /fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7/u);
  assert.match(verify, /33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82/u);
  assert.equal(createHash("sha256").update(sql).digest("hex"), POSTGRESQL_IDENTITY_MIGRATION_ARTIFACT_SHA256);
  assert.equal(POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID, "REL002-P2D0B-IDENTITY-PG-V1");
});

test("accepts PostgreSQL canonical deparse for only the three approved version bounds", async () => {
  const verify = await readFile(resolve("modules/identity/migrations/postgresql/production/001_identity_persistence_v1.verify.sql"), "utf8");
  assert.match(verify, /identity_sessions_version_check','SESSION_VERSION>=1ANDSESSION_VERSION<=''9007199254740991'''/u);
  assert.match(verify, /identity_session_revocations_version_check','SESSION_VERSION>=1ANDSESSION_VERSION<=''9007199254740991'''/u);
  assert.match(verify, /identity_registered_service_workloads_version_check','REGISTRATION_VERSION>=1ANDREGISTRATION_VERSION<=''9007199254740991'''/u);
  assert.doesNotMatch(verify, /(?:SESSION|REGISTRATION)_VERSIONBETWEEN1AND9007199254740991/u);
  assert.match(verify, /expected FULL JOIN actual USING \(table_name, name\)/u);
  assert.match(verify, /expected\.name IS NULL OR actual\.name IS NULL OR expected\.expression <> actual\.expression/u);
});

test("ledger repair is fail-closed and inserts only the canonical approved evidence row", async () => {
  const repair = await readFile(resolve("modules/identity/migrations/postgresql/production/005_record_existing_identity_migration_v1.sql"), "utf8");
  assert.match(repair, /nsp\.nspname = 'app_identity'/u);
  assert.match(repair, /mismatch_count <> 5/u);
  assert.match(repair, /identity\.session[^]*fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7/u);
  assert.match(repair, /identity\.registered-service-workload[^]*33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82/u);
  assert.match(repair, /mismatch_count <> 15/u);
  assert.match(repair, /expected FULL JOIN actual USING \(table_name, name\)/u);
  for (const setting of ["ai_mls.operator_evidence_ref", "ai_mls.backup_evidence_ref", "ai_mls.migration_applied_at"]) {
    assert.match(repair, new RegExp(`current_setting\\('${setting.replaceAll(".", "\\.")}', true\\)`, "u"));
  }
  assert.match(repair, /operator evidence reference is required/u);
  assert.match(repair, /backup evidence reference is required/u);
  assert.match(repair, /migration applied_at is required/u);
  assert.match(repair, /migration applied_at is invalid/u);
  assert.match(repair, /length\(operator_evidence_ref_value\) > 512/u);
  assert.match(repair, /length\(backup_evidence_ref_value\) > 512/u);
  assert.match(repair, /isfinite\(migration_applied_at_value\)/u);
  assert.match(repair, /\[\[:cntrl:\]\]/u);
  assert.match(repair, /migration ledger must be empty before repair/u);
  assert.match(repair, /GET DIAGNOSTICS inserted_count = ROW_COUNT/u);
  assert.match(repair, /inserted_count <> 1/u);
  assert.doesNotMatch(repair, /ON CONFLICT|UPDATE app_identity\.identity_schema_migrations|DELETE FROM app_identity\.identity_schema_migrations/iu);
  assert.match(repair, /REL002-P2D0B-IDENTITY-PG-V1/u);
  assert.match(repair, /b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e/u);
  assert.match(repair, /INSERT INTO app_identity\.identity_schema_migrations/u);
});

function result(rows: readonly Record<string, unknown>[]): PostgreSqlQueryResult {
  return { rows, rowCount: rows.length };
}

function harness(respond: (text: string) => PostgreSqlQueryResult): { pool: PostgreSqlPoolPort; releases: boolean[] } {
  const releases: boolean[] = [];
  const client: PostgreSqlClientPort = {
    query: <Row extends Record<string, unknown>>(text: string) => Promise.resolve(respond(text) as unknown as PostgreSqlQueryResult<Row>),
    release: (destroy = false) => { releases.push(destroy); },
  };
  return { pool: { connect: () => Promise.resolve(client), close: () => Promise.resolve() }, releases };
}

function ownerTable(name: string): string {
  if (name.startsWith("identity_schema_contracts_")) return "identity_schema_contracts";
  if (name.startsWith("identity_schema_migrations_")) return "identity_schema_migrations";
  if (name.startsWith("identity_session_revocations_")) return "identity_session_revocations";
  if (name.startsWith("identity_sessions_")) return "identity_sessions";
  return "identity_registered_service_workloads";
}
