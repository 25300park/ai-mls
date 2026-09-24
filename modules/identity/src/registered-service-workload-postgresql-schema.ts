import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "./postgresql-pool.js";
import { RegisteredServiceWorkloadError } from "./registered-service-workload.js";
import type { RegisteredServiceWorkloadSchemaReadiness } from "./registered-service-workload-schema.js";

export const POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID = "REL002-P2D0B-IDENTITY-PG-V1";
export const POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_VERSION = 1;
export const POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT = "33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82";
export const POSTGRESQL_SESSION_SCHEMA_FINGERPRINT = "fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7";
export const POSTGRESQL_IDENTITY_MIGRATION_ARTIFACT_SHA256 = "b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e";

export type PostgreSqlIdentitySchemaReadinessProvenance =
  | "NATIVE_MIGRATION_LEDGER_VERIFIED"
  | "HISTORICAL_MIGRATION_ATTESTATION_VERIFIED";

export interface PostgreSqlIdentitySchemaEvidence {
  readonly readiness: RegisteredServiceWorkloadSchemaReadiness;
  readonly provenance: PostgreSqlIdentitySchemaReadinessProvenance | null;
}

const TABLE_COLUMNS = new Map<string, readonly string[]>([
  ["identity_schema_contracts", ["contract_id:text:NO", "schema_version:integer:NO", "database_engine:text:NO", "contract_fingerprint:text:NO", "recorded_at:timestamp with time zone:NO"]],
  ["identity_schema_migrations", ["migration_id:text:NO", "artifact_checksum:text:NO", "contract_id:text:NO", "schema_version:integer:NO", "database_engine:text:NO", "contract_fingerprint:text:NO", "target_environment:text:NO", "operator_evidence_ref:text:NO", "backup_evidence_ref:text:NO", "applied_at:timestamp with time zone:NO", "result:text:NO"]],
  ["identity_sessions", ["session_id:text:NO", "session_version:bigint:NO", "state:text:NO", "payload_json:jsonb:NO", "created_at:timestamp with time zone:NO", "updated_at:timestamp with time zone:NO"]],
  ["identity_session_revocations", ["session_id:text:NO", "session_version:bigint:NO", "revoked_at:timestamp with time zone:NO", "reason:text:NO", "identity_evidence_ref:text:NO", "audit_evidence_ref:text:NO"]],
  ["identity_registered_service_workloads", ["registration_id:text:NO", "tenant_id:text:NO", "principal_id:text:NO", "principal_type:text:NO", "assurance:text:NO", "environment:text:NO", "status:text:NO", "workload_purpose:text:NO", "audience:text:NO", "registration_version:bigint:NO", "identity_evidence_ref:text:NO", "audit_evidence_ref:text:NO", "created_at:timestamp with time zone:NO", "updated_at:timestamp with time zone:NO"]],
]);

interface ExpectedConstraint {
  readonly kind: "p" | "u" | "f" | "c";
  readonly columns: string;
  readonly referencedTable?: string;
  readonly referencedColumns?: string;
  readonly checkExpression?: string;
}

const EXPECTED_CONSTRAINTS = new Map<string, ExpectedConstraint>([
  ["identity_schema_contracts_pkey", { kind: "p", columns: "contract_id,schema_version,database_engine" }],
  ["identity_schema_contracts_version_check", { kind: "c", columns: "schema_version", checkExpression: "SCHEMA_VERSION >= 1" }],
  ["identity_schema_contracts_engine_check", { kind: "c", columns: "database_engine", checkExpression: "DATABASE_ENGINE = 'POSTGRESQL'" }],
  ["identity_schema_migrations_pkey", { kind: "p", columns: "migration_id" }],
  ["identity_schema_migrations_version_check", { kind: "c", columns: "schema_version", checkExpression: "SCHEMA_VERSION >= 1" }],
  ["identity_schema_migrations_engine_check", { kind: "c", columns: "database_engine", checkExpression: "DATABASE_ENGINE = 'POSTGRESQL'" }],
  ["identity_schema_migrations_environment_check", { kind: "c", columns: "target_environment", checkExpression: "TARGET_ENVIRONMENT = 'PRODUCTION'" }],
  ["identity_schema_migrations_result_check", { kind: "c", columns: "result", checkExpression: "RESULT = 'APPLIED'" }],
  ["identity_schema_migrations_contract_key", { kind: "u", columns: "contract_id,schema_version,database_engine" }],
  ["identity_schema_migrations_contract_fkey", { kind: "f", columns: "contract_id,schema_version,database_engine", referencedTable: "identity_schema_contracts", referencedColumns: "contract_id,schema_version,database_engine" }],
  ["identity_sessions_pkey", { kind: "p", columns: "session_id" }],
  ["identity_sessions_version_check", { kind: "c", columns: "session_version", checkExpression: "SESSION_VERSION BETWEEN 1 AND 9007199254740991" }],
  ["identity_sessions_state_check", { kind: "c", columns: "state", checkExpression: "STATE IN 'ACTIVE', 'REVOKED', 'EXPIRED'" }],
  ["identity_sessions_chronology_check", { kind: "c", columns: "created_at,updated_at", checkExpression: "UPDATED_AT >= CREATED_AT" }],
  ["identity_session_revocations_pkey", { kind: "p", columns: "session_id,session_version" }],
  ["identity_session_revocations_version_check", { kind: "c", columns: "session_version", checkExpression: "SESSION_VERSION BETWEEN 1 AND 9007199254740991" }],
  ["identity_session_revocations_session_fkey", { kind: "f", columns: "session_id", referencedTable: "identity_sessions", referencedColumns: "session_id" }],
  ["identity_registered_service_workloads_pkey", { kind: "p", columns: "registration_id" }],
  ["identity_registered_service_workloads_tenant_principal_key", { kind: "u", columns: "tenant_id,principal_id" }],
  ["identity_registered_service_workloads_principal_type_check", { kind: "c", columns: "principal_type", checkExpression: "PRINCIPAL_TYPE = 'SERVICE'" }],
  ["identity_registered_service_workloads_assurance_check", { kind: "c", columns: "assurance", checkExpression: "ASSURANCE = 'WORKLOAD'" }],
  ["identity_registered_service_workloads_environment_check", { kind: "c", columns: "environment", checkExpression: "ENVIRONMENT = 'PRODUCTION'" }],
  ["identity_registered_service_workloads_status_check", { kind: "c", columns: "status", checkExpression: "STATUS IN 'ACTIVE', 'SUSPENDED', 'REVOKED'" }],
  ["identity_registered_service_workloads_version_check", { kind: "c", columns: "registration_version", checkExpression: "REGISTRATION_VERSION BETWEEN 1 AND 9007199254740991" }],
]);

interface ExpectedIndex { readonly keys: readonly string[]; readonly unique: boolean; readonly primary: boolean }
const REQUIRED_INDEXES = new Map<string, ExpectedIndex>([
  ["identity_schema_contracts_pkey", { keys: ["CONTRACT_ID", "SCHEMA_VERSION", "DATABASE_ENGINE"], unique: true, primary: true }],
  ["identity_schema_migrations_pkey", { keys: ["MIGRATION_ID"], unique: true, primary: true }],
  ["identity_schema_migrations_contract_key", { keys: ["CONTRACT_ID", "SCHEMA_VERSION", "DATABASE_ENGINE"], unique: true, primary: false }],
  ["identity_sessions_pkey", { keys: ["SESSION_ID"], unique: true, primary: true }],
  ["identity_sessions_family_idx", { keys: ["PAYLOAD_JSON ->> 'FAMILYID'", "SESSION_ID"], unique: false, primary: false }],
  ["identity_sessions_state_updated_idx", { keys: ["STATE", "UPDATED_AT", "SESSION_ID"], unique: false, primary: false }],
  ["identity_session_revocations_pkey", { keys: ["SESSION_ID", "SESSION_VERSION"], unique: true, primary: true }],
  ["identity_registered_service_workloads_pkey", { keys: ["REGISTRATION_ID"], unique: true, primary: true }],
  ["identity_registered_service_workloads_tenant_principal_key", { keys: ["TENANT_ID", "PRINCIPAL_ID"], unique: true, primary: false }],
  ["identity_registered_service_workloads_tenant_status_idx", { keys: ["TENANT_ID", "STATUS"], unique: false, primary: false }],
]);

export async function inspectPostgreSqlRegisteredServiceWorkloadSchema(pool: PostgreSqlPoolPort): Promise<RegisteredServiceWorkloadSchemaReadiness> {
  return (await inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(pool)).readiness;
}

export async function inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(pool: PostgreSqlPoolPort): Promise<PostgreSqlIdentitySchemaEvidence> {
  let client: PostgreSqlClientPort | undefined;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    const result = await inspectClient(client);
    await client.query("COMMIT");
    transactionOpen = false;
    return result;
  } catch {
    if (transactionOpen && client !== undefined) {
      try { await client.query("ROLLBACK"); } catch { /* preserve bounded failure */ }
    }
    throw unavailable();
  } finally {
    client?.release();
  }
}

async function inspectClient(client: PostgreSqlClientPort): Promise<PostgreSqlIdentitySchemaEvidence> {
  const namespace = await client.query<{ present: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'app_identity') AS present",
  );
  if (namespace.rows[0]?.present !== true) return evidence("NOT_READY_MISSING_SCHEMA");

  const relations = await client.query<{ relation_name: string; relation_kind: string }>(
    `SELECT rel.relname AS relation_name, rel.relkind AS relation_kind FROM pg_catalog.pg_class rel
     JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r' ORDER BY rel.relname`,
  );
  const expectedTables = [...TABLE_COLUMNS.keys()].sort();
  const actualTables = relations.rows.map((row) => row.relation_name).sort();
  const attestationTablePresent = actualTables.includes("identity_historical_migration_attestations");
  const coreTables = actualTables.filter((name) => name !== "identity_historical_migration_attestations");
  if (actualTables.length === 0) return evidence("NOT_READY_MISSING_SCHEMA");
  if (!same(coreTables, expectedTables) || actualTables.length !== expectedTables.length + Number(attestationTablePresent)
    || relations.rows.some((row) => row.relation_kind !== "r")) return evidence("NOT_READY_PARTIAL_MIGRATION");

  const columns = await client.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string; generated: string; default_expression: string | null }>(
    `SELECT rel.relname AS table_name, attr.attname AS column_name,
            pg_catalog.format_type(attr.atttypid, attr.atttypmod) AS data_type,
            CASE WHEN attr.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
            attr.attgenerated AS generated, pg_catalog.pg_get_expr(def.adbin, def.adrelid) AS default_expression
     FROM pg_catalog.pg_attribute attr JOIN pg_catalog.pg_class rel ON rel.oid = attr.attrelid
     JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
     LEFT JOIN pg_catalog.pg_attrdef def ON def.adrelid = attr.attrelid AND def.adnum = attr.attnum
     WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r'
       AND rel.relname <> 'identity_historical_migration_attestations'
       AND attr.attnum > 0 AND NOT attr.attisdropped
     ORDER BY rel.relname, attr.attnum`,
  );
  for (const [table, expected] of TABLE_COLUMNS) {
    const actual = columns.rows.filter((row) => row.table_name === table)
      .map((row) => `${row.column_name}:${row.data_type}:${row.is_nullable}`);
    if (!same(actual, expected) || columns.rows.some((row) => row.table_name === table
      && (row.generated !== "" || row.default_expression !== null))) return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
  }

  const constraints = await client.query<ConstraintRow>(
    `SELECT rel.relname AS table_name, con.conname AS constraint_name, con.contype AS kind,
            (SELECT pg_catalog.string_agg(att.attname, ',' ORDER BY key.ordinality)
             FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinality)
             JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = key.attnum) AS columns,
            ref.relname AS referenced_table,
            (SELECT pg_catalog.string_agg(att.attname, ',' ORDER BY key.ordinality)
             FROM pg_catalog.unnest(con.confkey) WITH ORDINALITY AS key(attnum, ordinality)
             JOIN pg_catalog.pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = key.attnum) AS referenced_columns,
            con.confdeltype AS delete_action, con.confupdtype AS update_action, con.confmatchtype AS match_type,
            pg_catalog.pg_get_expr(con.conbin, con.conrelid) AS check_expression
     FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
     JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
     LEFT JOIN pg_catalog.pg_class ref ON ref.oid = con.confrelid
     WHERE nsp.nspname = 'app_identity' AND rel.relname <> 'identity_historical_migration_attestations'
     ORDER BY con.conname`,
  );
  if (!same(constraints.rows.map((row) => row.constraint_name).sort(), [...EXPECTED_CONSTRAINTS.keys()].sort())) {
    return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
  }
  for (const [name, expected] of EXPECTED_CONSTRAINTS) {
    const row = constraints.rows.find((value) => value.constraint_name === name);
    if (row?.table_name !== ownedTable(name) || row.kind !== expected.kind || row.columns !== expected.columns
      || (expected.kind === "f" && (row.referenced_table !== expected.referencedTable
        || row.referenced_columns !== expected.referencedColumns || row.delete_action !== "a"
        || row.update_action !== "a" || row.match_type !== "s"))
      || (expected.kind === "c" && normalizeExpression(row.check_expression) !== expected.checkExpression)) {
      return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
    }
  }

  const indexes = await client.query<IndexRow>(
    `SELECT rel.relname AS table_name, idx.relname AS index_name, i.indisunique AS is_unique, i.indisprimary AS is_primary,
            i.indisvalid AS is_valid, (i.indpred IS NOT NULL) AS is_partial,
            ARRAY(SELECT pg_catalog.pg_get_indexdef(i.indexrelid, position, true)
                  FROM pg_catalog.generate_series(1, i.indnkeyatts) AS position ORDER BY position) AS key_expressions
     FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
     JOIN pg_catalog.pg_class rel ON rel.oid = i.indrelid JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'app_identity' AND rel.relname <> 'identity_historical_migration_attestations'
     ORDER BY idx.relname`,
  );
  if (!same(indexes.rows.map((row) => row.index_name).sort(), [...REQUIRED_INDEXES.keys()].sort())) return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
  for (const [name, expected] of REQUIRED_INDEXES) {
    const index = indexes.rows.find((row) => row.index_name === name);
    const keys = index?.key_expressions.map(normalizeExpression);
    if (index?.table_name !== ownedTable(name) || index.is_valid !== true || index.is_partial || index.is_unique !== expected.unique
      || index.is_primary !== expected.primary || keys === undefined || !same(keys, expected.keys)) {
      return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
    }
  }

  const triggers = await client.query<{ table_name: string; trigger_name: string; trigger_type: number; enabled: string; function_schema: string; function_name: string }>(
    `SELECT rel.relname AS table_name, trg.tgname AS trigger_name, trg.tgtype AS trigger_type, trg.tgenabled AS enabled,
            proc_nsp.nspname AS function_schema, proc.proname AS function_name FROM pg_catalog.pg_trigger trg
     JOIN pg_catalog.pg_class rel ON rel.oid = trg.tgrelid JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
     JOIN pg_catalog.pg_proc proc ON proc.oid = trg.tgfoid JOIN pg_catalog.pg_namespace proc_nsp ON proc_nsp.oid = proc.pronamespace
     WHERE nsp.nspname = 'app_identity' AND rel.relname <> 'identity_historical_migration_attestations'
       AND NOT trg.tgisinternal ORDER BY trg.tgname`,
  );
  if (triggers.rowCount !== 2 || !trigger(triggers.rows, "identity_session_revocations_no_delete", 11)
    || !trigger(triggers.rows, "identity_session_revocations_no_update", 19)) return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");

  const procedure = await client.query<{ source: string; language: string; result_type: string; argument_count: number; volatility: string; security_definer: boolean }>(
    `SELECT proc.prosrc AS source, lang.lanname AS language, pg_catalog.format_type(proc.prorettype, NULL) AS result_type,
            proc.pronargs AS argument_count, proc.provolatile AS volatility, proc.prosecdef AS security_definer
     FROM pg_catalog.pg_proc proc JOIN pg_catalog.pg_language lang ON lang.oid = proc.prolang
     JOIN pg_catalog.pg_namespace nsp ON nsp.oid = proc.pronamespace
     WHERE nsp.nspname = 'app_identity' AND proc.proname = 'reject_session_revocation_mutation'`,
  );
  const functionRow = procedure.rows[0];
  if (procedure.rowCount !== 1 || normalizeDefinition(functionRow?.source) !== "BEGIN RAISE EXCEPTION 'APPEND-ONLY REVOCATION'; END;"
    || functionRow?.language !== "plpgsql" || functionRow.result_type !== "trigger" || Number(functionRow.argument_count) !== 0
    || functionRow.volatility !== "v" || functionRow.security_definer !== false) {
    return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
  }

  const metadata = await client.query<{ contract_id: string; schema_version: number; database_engine: string; contract_fingerprint: string }>(
    `SELECT contract_id, schema_version, database_engine, contract_fingerprint
     FROM app_identity.identity_schema_contracts ORDER BY contract_id`,
  );
  if (metadata.rows.some((row) => Number(row.schema_version) !== 1)) return evidence("NOT_READY_UNSUPPORTED_VERSION");
  if (metadata.rowCount !== 2
    || !contract(metadata.rows, "identity.session", POSTGRESQL_SESSION_SCHEMA_FINGERPRINT)
    || !contract(metadata.rows, "identity.registered-service-workload", POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT)) {
    return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
  }

  const migrations = await client.query<MigrationRow>(
    `SELECT migration_id, artifact_checksum, contract_id, schema_version, database_engine,
            contract_fingerprint, target_environment, result
     FROM app_identity.identity_schema_migrations ORDER BY migration_id`,
  );
  let provenance: PostgreSqlIdentitySchemaReadinessProvenance;
  if (migrations.rowCount === 1 && validMigration(migrations.rows[0])) {
    if (attestationTablePresent) {
      const attestations = await client.query<HistoricalAttestationRow>(
        `SELECT migration_id, artifact_checksum, contract_id, schema_version, database_engine,
                contract_fingerprint, target_environment, historical_applied_at,
                historical_applied_at_known, evidence_recorded_at, operator_evidence_ref,
                backup_evidence_ref, schema_verification_evidence_ref, reason, result
         FROM app_identity.identity_historical_migration_attestations ORDER BY migration_id`,
      );
      if (attestations.rowCount !== 0) return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
    }
    provenance = "NATIVE_MIGRATION_LEDGER_VERIFIED";
  } else if (migrations.rowCount === 0 && attestationTablePresent) {
    const compatibility = await client.query<{ historical_attestation_schema_compatible: boolean }>(
      `SELECT count(*) = 1
          AND bool_and(lang.lanname = 'sql' AND proc.prorettype = 'boolean'::regtype
            AND proc.pronargs = 0 AND proc.provolatile = 's' AND NOT proc.prosecdef
            AND md5(upper(pg_catalog.regexp_replace(btrim(proc.prosrc), '\\s+', ' ', 'g')))
              = '392f0ab48d4de10de66923de4372c2d3')
          AND app_identity.identity_historical_attestation_schema_is_exact()
          AS historical_attestation_schema_compatible
       FROM pg_catalog.pg_proc proc
       JOIN pg_catalog.pg_namespace nsp ON nsp.oid = proc.pronamespace
       JOIN pg_catalog.pg_language lang ON lang.oid = proc.prolang
       WHERE nsp.nspname = 'app_identity'
         AND proc.proname = 'identity_historical_attestation_schema_is_exact'`,
    );
    if (compatibility.rowCount !== 1 || compatibility.rows[0]?.historical_attestation_schema_compatible !== true) {
      return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
    }
    const attestations = await client.query<HistoricalAttestationRow>(
      `SELECT migration_id, artifact_checksum, contract_id, schema_version, database_engine,
              contract_fingerprint, target_environment, historical_applied_at,
              historical_applied_at_known, evidence_recorded_at, operator_evidence_ref,
              backup_evidence_ref, schema_verification_evidence_ref, reason, result
       FROM app_identity.identity_historical_migration_attestations ORDER BY migration_id`,
    );
    if (attestations.rowCount !== 1 || !validHistoricalAttestation(attestations.rows[0])) {
      return evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
    }
    provenance = "HISTORICAL_MIGRATION_ATTESTATION_VERIFIED";
  } else {
    return evidence(migrations.rowCount === 0 ? "NOT_READY_PARTIAL_MIGRATION" : "NOT_READY_INCOMPATIBLE_SCHEMA");
  }

  const privileges = await client.query<PrivilegeRow>(
    `SELECT pg_catalog.has_schema_privilege(current_user, 'app_identity', 'USAGE') AS schema_usage,
            pg_catalog.has_schema_privilege(current_user, 'app_identity', 'CREATE') AS schema_create,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_sessions', 'SELECT') AS session_select,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_sessions', 'INSERT') AS session_insert,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_sessions', 'UPDATE') AS session_update,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_sessions', 'DELETE,TRUNCATE,REFERENCES,TRIGGER') AS session_excess,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_registered_service_workloads', 'SELECT') AS workload_read,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_registered_service_workloads', 'INSERT,UPDATE,DELETE,TRUNCATE') AS workload_write,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_session_revocations', 'INSERT') AS revocation_insert,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_session_revocations', 'UPDATE,DELETE,TRUNCATE') AS revocation_excess,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_schema_contracts', 'SELECT') AS contract_read,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_schema_contracts', 'INSERT,UPDATE,DELETE,TRUNCATE') AS contract_write,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_schema_migrations', 'SELECT') AS ledger_read,
            pg_catalog.has_table_privilege(current_user, 'app_identity.identity_schema_migrations', 'INSERT,UPDATE,DELETE,TRUNCATE') AS ledger_write,
            CASE WHEN pg_catalog.to_regclass('app_identity.identity_historical_migration_attestations') IS NULL THEN TRUE
                 ELSE pg_catalog.has_table_privilege(current_user, 'app_identity.identity_historical_migration_attestations', 'SELECT') END AS attestation_read,
            CASE WHEN pg_catalog.to_regclass('app_identity.identity_historical_migration_attestations') IS NULL THEN FALSE
                 ELSE pg_catalog.has_table_privilege(current_user, 'app_identity.identity_historical_migration_attestations', 'INSERT,UPDATE,DELETE,TRUNCATE') END AS attestation_write`,
  );
  const privilege = privileges.rows[0];
  return privileges.rowCount === 1 && privilege?.schema_usage === true && privilege.schema_create === false
    && privilege.session_select === true && privilege.session_insert === true && privilege.session_update === true
    && privilege.session_excess === false && privilege.workload_read === true
    && privilege.workload_write === false && privilege.revocation_insert === true && privilege.revocation_excess === false
    && privilege.contract_read === true && privilege.contract_write === false
    && privilege.ledger_read === true && privilege.ledger_write === false
    && privilege.attestation_read === true && privilege.attestation_write === false
    ? evidence("READY", provenance) : evidence("NOT_READY_INCOMPATIBLE_SCHEMA");
}

interface MigrationRow extends Record<string, unknown> {
  migration_id: string; artifact_checksum: string; contract_id: string; schema_version: number;
  database_engine: string; contract_fingerprint: string; target_environment: string; result: string;
}

interface HistoricalAttestationRow extends MigrationRow {
  historical_applied_at: unknown;
  historical_applied_at_known: boolean;
  evidence_recorded_at: unknown;
  operator_evidence_ref: string;
  backup_evidence_ref: string;
  schema_verification_evidence_ref: string;
  reason: string;
}

interface ConstraintRow extends Record<string, unknown> {
  table_name: string; constraint_name: string; kind: string; columns: string; referenced_table: string | null;
  referenced_columns: string | null; delete_action: string; update_action: string; match_type: string;
  check_expression: string | null;
}

interface IndexRow extends Record<string, unknown> {
  table_name: string; index_name: string; is_unique: boolean; is_primary: boolean; is_valid: boolean; is_partial: boolean;
  key_expressions: string[];
}

interface PrivilegeRow extends Record<string, unknown> {
  schema_usage: boolean; schema_create: boolean; session_select: boolean; session_insert: boolean; session_update: boolean; session_excess: boolean;
  workload_read: boolean; workload_write: boolean; revocation_insert: boolean; revocation_excess: boolean;
  contract_read: boolean; contract_write: boolean; ledger_read: boolean; ledger_write: boolean;
  attestation_read: boolean; attestation_write: boolean;
}

function contract(rows: readonly { contract_id: string; database_engine: string; contract_fingerprint: string }[], id: string, fingerprint: string): boolean {
  const row = rows.find((value) => value.contract_id === id);
  return row?.database_engine === "POSTGRESQL" && row.contract_fingerprint === fingerprint;
}

function validMigration(row: MigrationRow | undefined): boolean {
  return row?.migration_id === POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID
    && row.artifact_checksum === POSTGRESQL_IDENTITY_MIGRATION_ARTIFACT_SHA256
    && row.contract_id === "identity.registered-service-workload" && Number(row.schema_version) === 1
    && row.database_engine === "POSTGRESQL" && row.contract_fingerprint === POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT
    && row.target_environment === "PRODUCTION" && row.result === "APPLIED";
}

function validHistoricalAttestation(row: HistoricalAttestationRow | undefined): boolean {
  return row?.migration_id === POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID
    && row.artifact_checksum === POSTGRESQL_IDENTITY_MIGRATION_ARTIFACT_SHA256
    && row.contract_id === "identity.registered-service-workload" && Number(row.schema_version) === 1
    && row.database_engine === "POSTGRESQL" && row.contract_fingerprint === POSTGRESQL_REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT
    && row.target_environment === "PRODUCTION" && row.historical_applied_at === null
    && row.historical_applied_at_known === false && validInstant(row.evidence_recorded_at)
    && safeReference(row.operator_evidence_ref) && safeReference(row.backup_evidence_ref)
    && safeReference(row.schema_verification_evidence_ref)
    && row.reason === "HISTORICAL_APPLIED_AT_UNRECOVERABLE" && row.result === "VERIFIED_EXISTING_SCHEMA";
}

function evidence(
  readiness: RegisteredServiceWorkloadSchemaReadiness,
  provenance: PostgreSqlIdentitySchemaReadinessProvenance | null = null,
): PostgreSqlIdentitySchemaEvidence {
  return Object.freeze({ readiness, provenance });
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validInstant(value: unknown): boolean {
  return value instanceof Date ? Number.isFinite(value.getTime())
    : safeReference(value) && Number.isFinite(Date.parse(value));
}

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeDefinition(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim().toUpperCase() : "";
}

function normalizeExpression(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/::(?:text|bigint|integer)/giu, "")
      .replace(/=\s*ANY\s*\(\s*ARRAY\s*\[/giu, "IN ")
      .replace(/\]\s*\)/gu, "")
      .replace(/[()]/gu, " ").replace(/\s*,\s*/gu, ", ").replace(/\s+/gu, " ").trim().toUpperCase()
    : "";
}

function trigger(
  rows: readonly { table_name: string; trigger_name: string; trigger_type: number; enabled: string; function_schema: string; function_name: string }[],
  name: string,
  type: number,
): boolean {
  const row = rows.find((value) => value.trigger_name === name);
  return row?.table_name === "identity_session_revocations" && row.trigger_type === type && row.enabled === "O" && row.function_schema === "app_identity"
    && row.function_name === "reject_session_revocation_mutation";
}

function ownedTable(name: string): string {
  if (name.startsWith("identity_schema_contracts_")) return "identity_schema_contracts";
  if (name.startsWith("identity_schema_migrations_")) return "identity_schema_migrations";
  if (name.startsWith("identity_session_revocations_")) return "identity_session_revocations";
  if (name.startsWith("identity_sessions_")) return "identity_sessions";
  if (name.startsWith("identity_registered_service_workloads_")) return "identity_registered_service_workloads";
  return "";
}

export async function assertPostgreSqlRegisteredServiceWorkloadSchemaCompatible(pool: PostgreSqlPoolPort): Promise<void> {
  if ((await inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(pool)).readiness !== "READY") throw unavailable();
}

function unavailable(): RegisteredServiceWorkloadError {
  return new RegisteredServiceWorkloadError("IDENTITY_AUTHORITY_UNAVAILABLE");
}
