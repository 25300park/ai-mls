import { createHash } from "node:crypto";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";

export const REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT = Object.freeze({
  contractId: "identity.registered-service-workload",
  schemaVersion: 1,
  tableName: "identity_registered_service_workloads",
  columns: Object.freeze([
    column("registration_id", "TEXT", 1, 1), column("tenant_id", "TEXT", 1, 0),
    column("principal_id", "TEXT", 1, 0), column("principal_type", "TEXT", 1, 0),
    column("assurance", "TEXT", 1, 0), column("environment", "TEXT", 1, 0),
    column("status", "TEXT", 1, 0), column("workload_purpose", "TEXT", 1, 0),
    column("audience", "TEXT", 1, 0), column("registration_version", "INTEGER", 1, 0),
    column("identity_evidence_ref", "TEXT", 1, 0), column("audit_evidence_ref", "TEXT", 1, 0),
    column("created_at", "TEXT", 1, 0), column("updated_at", "TEXT", 1, 0),
  ]),
  uniqueColumns: Object.freeze(["tenant_id", "principal_id"]),
  tenantStatusIndex: Object.freeze(["tenant_id", "status"]),
  foreignKeys: Object.freeze([]),
  triggers: Object.freeze([]),
});

export const REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT = createHash("sha256")
  .update(JSON.stringify(REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT))
  .digest("hex");

export const REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID = "REL002-P2A-IDENTITY-RSW-V1";
export const REGISTERED_SERVICE_WORKLOAD_MIGRATION_ARTIFACT_SHA256 = "fd31b7376cf6d04102b1c5280b07b02985aefb0ebcf18111cdbdb5a5ead7bb90";

export type RegisteredServiceWorkloadSchemaReadiness =
  | "READY"
  | "NOT_READY_MISSING_SCHEMA"
  | "NOT_READY_INCOMPATIBLE_SCHEMA"
  | "NOT_READY_UNSUPPORTED_VERSION"
  | "NOT_READY_PARTIAL_MIGRATION";

const METADATA_COLUMNS = Object.freeze([
  column("contract_id", "TEXT", 1, 1),
  column("schema_version", "INTEGER", 1, 0),
  column("contract_fingerprint", "TEXT", 1, 0),
]);

const MIGRATION_COLUMNS = Object.freeze([
  column("migration_id", "TEXT", 1, 1), column("artifact_checksum", "TEXT", 1, 0),
  column("contract_id", "TEXT", 1, 0), column("schema_version", "INTEGER", 1, 0),
  column("contract_fingerprint", "TEXT", 1, 0), column("target_environment", "TEXT", 1, 0),
  column("change_evidence_ref", "TEXT", 1, 0), column("operator_evidence_ref", "TEXT", 1, 0),
  column("applied_at", "TEXT", 1, 0), column("result", "TEXT", 1, 0),
]);

export function inspectRegisteredServiceWorkloadSchema(database: DatabaseSync): RegisteredServiceWorkloadSchemaReadiness {
  const contract = REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT;
  const workloadExists = tableExists(database, contract.tableName);
  const metadataExists = tableExists(database, "identity_schema_contracts");
  const ledgerExists = tableExists(database, "identity_schema_migrations");

  if (metadataExists && !hasExactColumns(database, "identity_schema_contracts", METADATA_COLUMNS)) {
    return "NOT_READY_INCOMPATIBLE_SCHEMA";
  }
  if (ledgerExists && (!hasExactColumns(database, "identity_schema_migrations", MIGRATION_COLUMNS)
    || !migrationLedgerConstraintsCompatible(database))) {
    return "NOT_READY_INCOMPATIBLE_SCHEMA";
  }

  const metadata = metadataExists
    ? database.prepare("SELECT schema_version, contract_fingerprint FROM identity_schema_contracts WHERE contract_id = ?").get(contract.contractId)
    : undefined;
  if (metadata !== undefined && metadata["schema_version"] !== contract.schemaVersion) {
    return "NOT_READY_UNSUPPORTED_VERSION";
  }
  if (metadata !== undefined && metadata["contract_fingerprint"] !== REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT) {
    return "NOT_READY_INCOMPATIBLE_SCHEMA";
  }

  const migrationById = ledgerExists
    ? database.prepare("SELECT * FROM identity_schema_migrations WHERE migration_id = ?").get(REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID)
    : undefined;
  const migrationByContract = ledgerExists
    ? database.prepare("SELECT * FROM identity_schema_migrations WHERE contract_id = ? AND schema_version = ?")
      .get(contract.contractId, contract.schemaVersion)
    : undefined;
  if ((migrationById !== undefined && !sameMigrationRecord(migrationById))
    || (migrationByContract !== undefined && !sameMigrationRecord(migrationByContract))) {
    return "NOT_READY_INCOMPATIBLE_SCHEMA";
  }
  if (workloadExists && !workloadSchemaCompatible(database)) {
    return "NOT_READY_INCOMPATIBLE_SCHEMA";
  }

  const migrationExists = migrationById !== undefined || migrationByContract !== undefined;
  const targetParts = Number(workloadExists) + Number(metadata !== undefined) + Number(migrationExists);
  if (targetParts === 0) return "NOT_READY_MISSING_SCHEMA";
  if (targetParts !== 3) return "NOT_READY_PARTIAL_MIGRATION";
  return "READY";
}

export function assertRegisteredServiceWorkloadSchemaCompatible(database: DatabaseSync): void {
  if (inspectRegisteredServiceWorkloadSchema(database) !== "READY") throw new Error("schema incompatible");
}

function workloadSchemaCompatible(database: DatabaseSync): boolean {
  const contract = REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT;
  const columns = database.prepare(`PRAGMA table_xinfo(${contract.tableName})`).all();
  if (columns.length !== contract.columns.length || columns.some((value, index) => !sameColumn(value, contract.columns[index]))) {
    return false;
  }
  const table = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?").get(contract.tableName);
  const sql = normalize(table?.["sql"]);
  const constraints = [
    "CHECK (PRINCIPAL_TYPE = 'SERVICE')", "CHECK (ASSURANCE = 'WORKLOAD')",
    "CHECK (ENVIRONMENT = 'PRODUCTION')", "CHECK (STATUS IN ('ACTIVE', 'SUSPENDED', 'REVOKED'))",
    "CHECK (REGISTRATION_VERSION >= 1)", "UNIQUE (TENANT_ID, PRINCIPAL_ID)",
  ];
  if (constraints.some((fragment) => !sql.includes(fragment))) return false;

  const indexes = database.prepare(`PRAGMA index_list(${contract.tableName})`).all();
  if (!hasIndex(database, indexes, "identity_registered_service_workloads_tenant_status_idx", contract.tenantStatusIndex, false)
    || !hasUniqueColumns(database, indexes, contract.uniqueColumns)) return false;
  if (database.prepare(`PRAGMA foreign_key_list(${contract.tableName})`).all().length !== 0) return false;
  if (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ?").all(contract.tableName).length !== 0) {
    return false;
  }
  return true;
}

function tableExists(database: DatabaseSync, name: string): boolean {
  return database.prepare("SELECT 1 AS present FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name) !== undefined;
}

function hasExactColumns(database: DatabaseSync, table: string, expected: readonly ReturnType<typeof column>[]): boolean {
  const actual = database.prepare(`PRAGMA table_xinfo(${table})`).all();
  return actual.length === expected.length && actual.every((value, index) => sameColumn(value, expected[index]));
}

function migrationLedgerConstraintsCompatible(database: DatabaseSync): boolean {
  const table = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'identity_schema_migrations'").get();
  const sql = normalize(table?.["sql"]);
  const indexes = database.prepare("PRAGMA index_list(identity_schema_migrations)").all();
  return sql.includes("CHECK (TARGET_ENVIRONMENT = 'PRODUCTION')")
    && sql.includes("CHECK (RESULT = 'APPLIED')")
    && hasUniqueColumns(database, indexes, ["contract_id", "schema_version"]);
}

function sameMigrationRecord(value: Record<string, SQLOutputValue>): boolean {
  return value["migration_id"] === REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID
    && value["artifact_checksum"] === REGISTERED_SERVICE_WORKLOAD_MIGRATION_ARTIFACT_SHA256
    && value["contract_id"] === REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT.contractId
    && value["schema_version"] === REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT.schemaVersion
    && value["contract_fingerprint"] === REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT
    && value["target_environment"] === "PRODUCTION"
    && nonEmpty(value["change_evidence_ref"])
    && nonEmpty(value["operator_evidence_ref"])
    && validTimestamp(value["applied_at"])
    && value["result"] === "APPLIED";
}

function nonEmpty(value: SQLOutputValue | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: SQLOutputValue | undefined): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function column(name: string, type: string, notnull: 1, pk: 0 | 1): Readonly<{ name: string; type: string; notnull: 1; pk: 0 | 1; dfltValue: null; hidden: 0 }> {
  return Object.freeze({ name, type, notnull, pk, dfltValue: null, hidden: 0 });
}

function sameColumn(value: Record<string, SQLOutputValue>, expected: ReturnType<typeof column> | undefined): boolean {
  return expected !== undefined && value["name"] === expected.name && String(value["type"]).toUpperCase() === expected.type
    && value["notnull"] === expected.notnull && value["pk"] === expected.pk
    && value["dflt_value"] === expected.dfltValue && value["hidden"] === expected.hidden;
}

function hasIndex(database: DatabaseSync, indexes: readonly Record<string, SQLOutputValue>[], name: string, columns: readonly string[], unique: boolean): boolean {
  const index = indexes.find((value) => value["name"] === name);
  return index !== undefined && Boolean(index["unique"]) === unique && index["partial"] === 0
    && indexColumns(database, name).join("\u0000") === columns.join("\u0000");
}

function hasUniqueColumns(database: DatabaseSync, indexes: readonly Record<string, SQLOutputValue>[], columns: readonly string[]): boolean {
  return indexes.some((value) => value["unique"] === 1 && value["partial"] === 0 && typeof value["name"] === "string"
    && indexColumns(database, value["name"]).join("\u0000") === columns.join("\u0000"));
}

function indexColumns(database: DatabaseSync, name: string): string[] {
  return database.prepare(`PRAGMA index_xinfo(${JSON.stringify(name)})`).all()
    .filter((value) => value["key"] === 1)
    .sort((left, right) => Number(left["seqno"]) - Number(right["seqno"]))
    .map((value) => String(value["name"]));
}

function normalize(value: SQLOutputValue | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").toUpperCase() : "";
}
