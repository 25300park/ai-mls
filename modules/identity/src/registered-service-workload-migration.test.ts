import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import * as schemaExports from "./registered-service-workload-schema.js";

type Readiness = "READY" | "NOT_READY_MISSING_SCHEMA" | "NOT_READY_INCOMPATIBLE_SCHEMA"
  | "NOT_READY_UNSUPPORTED_VERSION" | "NOT_READY_PARTIAL_MIGRATION";

const MIGRATION_PATH = "modules/identity/migrations/production/001_registered_service_workload_v1.up.sql";
const VERIFY_PATH = "modules/identity/migrations/production/001_registered_service_workload_v1.verify.sql";

function inspect(database: DatabaseSync): Readiness {
  const candidate = (schemaExports as unknown as Record<string, unknown>)["inspectRegisteredServiceWorkloadSchema"];
  if (typeof candidate !== "function") return "__MISSING_CLASSIFIER__" as Readiness;
  return (candidate as (value: DatabaseSync) => Readiness)(database);
}

function requireArtifacts(): void {
  assert.equal(existsSync(MIGRATION_PATH), true, "explicit forward migration artifact must exist");
  assert.equal(existsSync(VERIFY_PATH), true, "explicit verification artifact must exist");
}

function migrationIdentity(): Readonly<{ id: string; checksum: string }> {
  const exports = schemaExports as unknown as Record<string, unknown>;
  assert.equal(typeof exports["REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID"], "string");
  assert.equal(typeof exports["REGISTERED_SERVICE_WORKLOAD_MIGRATION_ARTIFACT_SHA256"], "string");
  return Object.freeze({
    id: exports["REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID"] as string,
    checksum: exports["REGISTERED_SERVICE_WORKLOAD_MIGRATION_ARTIFACT_SHA256"] as string,
  });
}

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(tmpdir(), "rel002-phase2b-migration-"));
  return Object.freeze({ directory, databasePath: join(directory, "identity.sqlite") });
}

function insertLedger(database: DatabaseSync): void {
  const migration = migrationIdentity();
  database.prepare(`INSERT INTO identity_schema_migrations (
    migration_id, artifact_checksum, contract_id, schema_version, contract_fingerprint,
    target_environment, change_evidence_ref, operator_evidence_ref, applied_at, result
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    migration.id,
    migration.checksum,
    "identity.registered-service-workload",
    1,
    "6758c44e385d416299020512d93b6485b42377daf2d9bfd5461f0413fde65e6b",
    "PRODUCTION",
    "change-evidence:rel002-phase2b",
    "operator-evidence:rel002-phase2b",
    "2026-09-18T00:00:00.000Z",
    "APPLIED",
  );
}

function applyArtifact(database: DatabaseSync, includeLedger = true): void {
  database.exec(readFileSync(MIGRATION_PATH, "utf8"));
  if (includeLedger) insertLedger(database);
}

test("Phase 2B explicit artifact materializes the exact schema and zero service identities", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    applyArtifact(database, false);
    const count = database.prepare("SELECT COUNT(*) AS count FROM identity_registered_service_workloads").get();
    assert.equal(count?.["count"], 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM identity_schema_migrations").get()?.["count"], 0);
    assert.equal(inspect(database), "NOT_READY_PARTIAL_MIGRATION");
    insertLedger(database);
    assert.equal(inspect(database), "READY");
    database.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B binds the immutable artifact bytes to the exported migration checksum", () => {
  assert.equal(existsSync(MIGRATION_PATH), true);
  const actual = createHash("sha256").update(readFileSync(MIGRATION_PATH)).digest("hex");
  assert.equal(migrationIdentity().id, "REL002-P2A-IDENTITY-RSW-V1");
  assert.equal(migrationIdentity().checksum, actual);
  const verification = readFileSync(VERIFY_PATH, "utf8").toUpperCase();
  assert.equal(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)\b/u.test(verification), false);
});

test("Phase 2B missing schema is classified without runtime schema creation", () => {
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    assert.equal(inspect(database), "NOT_READY_MISSING_SCHEMA");
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name LIKE 'identity_%'").get()?.["count"], 0);
    database.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B exact shared metadata with unrelated rows remains compatible", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    database.exec(`CREATE TABLE identity_schema_contracts (
      contract_id TEXT PRIMARY KEY NOT NULL,
      schema_version INTEGER NOT NULL,
      contract_fingerprint TEXT NOT NULL
    );
    INSERT INTO identity_schema_contracts VALUES ('identity.other-contract', 7, 'other-fingerprint');`);
    applyArtifact(database);
    assert.equal(inspect(database), "READY");
    database.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B unsupported target version is distinct from incompatible schema", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    applyArtifact(database);
    database.prepare("UPDATE identity_schema_contracts SET schema_version = 2 WHERE contract_id = ?")
      .run("identity.registered-service-workload");
    assert.equal(inspect(database), "NOT_READY_UNSUPPORTED_VERSION");
    database.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B detects missing columns constraints and required indexes as incompatible", () => {
  requireArtifacts();
  for (const mutation of [
    "ALTER TABLE identity_registered_service_workloads DROP COLUMN updated_at",
    "DROP INDEX identity_registered_service_workloads_tenant_status_idx",
  ]) {
    const item = fixture();
    try {
      const database = new DatabaseSync(item.databasePath);
      applyArtifact(database);
      database.exec(mutation);
      assert.equal(inspect(database), "NOT_READY_INCOMPATIBLE_SCHEMA");
      database.close();
    } finally { rmSync(item.directory, { recursive: true, force: true }); }
  }
});

test("Phase 2B rejects a workload table missing an approved check constraint", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    const withoutServiceConstraint = readFileSync(MIGRATION_PATH, "utf8")
      .replace(" CHECK (principal_type = 'SERVICE')", "");
    database.exec(withoutServiceConstraint);
    insertLedger(database);
    const readiness = inspect(database);
    database.close();
    assert.equal(readiness, "NOT_READY_INCOMPATIBLE_SCHEMA");
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B classifies exact schema without ledger and ledger without schema as partial migration", () => {
  requireArtifacts();
  const first = fixture();
  const second = fixture();
  try {
    const schemaOnly = new DatabaseSync(first.databasePath);
    applyArtifact(schemaOnly, false);
    assert.equal(inspect(schemaOnly), "NOT_READY_PARTIAL_MIGRATION");
    schemaOnly.close();

    const ledgerOnly = new DatabaseSync(second.databasePath);
    ledgerOnly.exec(`CREATE TABLE identity_schema_migrations (
      migration_id TEXT PRIMARY KEY NOT NULL,
      artifact_checksum TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      contract_fingerprint TEXT NOT NULL,
      target_environment TEXT NOT NULL CHECK (target_environment = 'PRODUCTION'),
      change_evidence_ref TEXT NOT NULL,
      operator_evidence_ref TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result = 'APPLIED'),
      UNIQUE (contract_id, schema_version)
    );`);
    insertLedger(ledgerOnly);
    assert.equal(inspect(ledgerOnly), "NOT_READY_PARTIAL_MIGRATION");
    ledgerOnly.close();
  } finally {
    rmSync(first.directory, { recursive: true, force: true });
    rmSync(second.directory, { recursive: true, force: true });
  }
});

test("Phase 2B conflicting migration checksum fails closed without mutation", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    applyArtifact(database);
    database.prepare("UPDATE identity_schema_migrations SET artifact_checksum = 'conflict' WHERE migration_id = ?")
      .run("REL002-P2A-IDENTITY-RSW-V1");
    assert.equal(inspect(database), "NOT_READY_INCOMPATIBLE_SCHEMA");
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM identity_registered_service_workloads").get()?.["count"], 0);
    database.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B conflicting migration identity for the canonical contract version is incompatible", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    applyArtifact(database, false);
    database.prepare(`INSERT INTO identity_schema_migrations (
      migration_id, artifact_checksum, contract_id, schema_version, contract_fingerprint,
      target_environment, change_evidence_ref, operator_evidence_ref, applied_at, result
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "conflicting-migration-id", migrationIdentity().checksum, "identity.registered-service-workload", 1,
      "6758c44e385d416299020512d93b6485b42377daf2d9bfd5461f0413fde65e6b", "PRODUCTION",
      "change-evidence:conflict", "operator-evidence:conflict", "2026-09-18T00:00:00.000Z", "APPLIED",
    );
    const readiness = inspect(database);
    database.close();
    assert.equal(readiness, "NOT_READY_INCOMPATIBLE_SCHEMA");
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("Phase 2B rejects a partial unique index that excludes the canonical ledger identity", () => {
  requireArtifacts();
  const item = fixture();
  try {
    const database = new DatabaseSync(item.databasePath);
    const withoutLedgerUnique = readFileSync(MIGRATION_PATH, "utf8")
      .replace(",\n  UNIQUE (contract_id, schema_version)", "");
    database.exec(withoutLedgerUnique);
    database.exec(`CREATE UNIQUE INDEX identity_schema_migrations_partial_contract_version
      ON identity_schema_migrations (contract_id, schema_version)
      WHERE contract_id <> 'identity.registered-service-workload';`);
    insertLedger(database);
    const readiness = inspect(database);
    database.close();
    assert.equal(readiness, "NOT_READY_INCOMPATIBLE_SCHEMA");
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});
