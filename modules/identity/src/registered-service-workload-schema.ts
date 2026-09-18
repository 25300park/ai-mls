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

export function assertRegisteredServiceWorkloadSchemaCompatible(database: DatabaseSync): void {
  const contract = REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT;
  const columns = database.prepare(`PRAGMA table_xinfo(${contract.tableName})`).all();
  if (columns.length !== contract.columns.length || columns.some((value, index) => !sameColumn(value, contract.columns[index]))) {
    throw new Error("schema incompatible");
  }
  const table = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?").get(contract.tableName);
  const sql = normalize(table?.["sql"]);
  const constraints = [
    "CHECK (PRINCIPAL_TYPE = 'SERVICE')", "CHECK (ASSURANCE = 'WORKLOAD')",
    "CHECK (ENVIRONMENT = 'PRODUCTION')", "CHECK (STATUS IN ('ACTIVE', 'SUSPENDED', 'REVOKED'))",
    "CHECK (REGISTRATION_VERSION >= 1)", "UNIQUE (TENANT_ID, PRINCIPAL_ID)",
  ];
  if (constraints.some((fragment) => !sql.includes(fragment))) throw new Error("schema incompatible");

  const indexes = database.prepare(`PRAGMA index_list(${contract.tableName})`).all();
  if (!hasIndex(database, indexes, "identity_registered_service_workloads_tenant_status_idx", contract.tenantStatusIndex, false)
    || !hasUniqueColumns(database, indexes, contract.uniqueColumns)) throw new Error("schema incompatible");
  if (database.prepare(`PRAGMA foreign_key_list(${contract.tableName})`).all().length !== 0) throw new Error("schema incompatible");
  if (database.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ?").all(contract.tableName).length !== 0) {
    throw new Error("schema incompatible");
  }

  const metadataColumns = database.prepare("PRAGMA table_xinfo(identity_schema_contracts)").all();
  const expectedMetadata = [column("contract_id", "TEXT", 1, 1), column("schema_version", "INTEGER", 1, 0), column("contract_fingerprint", "TEXT", 1, 0)];
  if (metadataColumns.length !== expectedMetadata.length || metadataColumns.some((value, index) => !sameColumn(value, expectedMetadata[index]))) {
    throw new Error("schema metadata unavailable");
  }
  const metadata = database.prepare("SELECT schema_version, contract_fingerprint FROM identity_schema_contracts WHERE contract_id = ?").get(contract.contractId);
  if (metadata?.["schema_version"] !== contract.schemaVersion || metadata["contract_fingerprint"] !== REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT) {
    throw new Error("schema metadata incompatible");
  }
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
  return indexes.some((value) => value["unique"] === 1 && typeof value["name"] === "string"
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
