import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  DurableRegisteredServiceWorkloadStore,
  RegisteredServiceWorkloadError,
  type RegisteredServiceWorkloadEvidenceVerifier,
} from "./registered-service-workload.js";
import { REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT, REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT } from "./registered-service-workload-schema.js";

const SCHEMA = `
CREATE TABLE identity_registered_service_workloads (
  registration_id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK (principal_type = 'SERVICE'),
  assurance TEXT NOT NULL CHECK (assurance = 'WORKLOAD'),
  environment TEXT NOT NULL CHECK (environment = 'PRODUCTION'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  workload_purpose TEXT NOT NULL,
  audience TEXT NOT NULL,
  registration_version INTEGER NOT NULL CHECK (registration_version >= 1),
  identity_evidence_ref TEXT NOT NULL,
  audit_evidence_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, principal_id)
);
CREATE INDEX identity_registered_service_workloads_tenant_status_idx
  ON identity_registered_service_workloads (tenant_id, status);
CREATE TABLE identity_schema_contracts (
  contract_id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  contract_fingerprint TEXT NOT NULL
);
`;

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(tmpdir(), "rel002-phase1e-workload-"));
  return Object.freeze({ directory, databasePath: join(directory, "identity.sqlite") });
}

function verifier(overrides: Partial<RegisteredServiceWorkloadEvidenceVerifier> = {}): RegisteredServiceWorkloadEvidenceVerifier {
  return {
    assertRegisteredWorkloadEvidence: overrides.assertRegisteredWorkloadEvidence ?? (() => undefined),
  };
}

function provision(databasePath: string, statement = SCHEMA): DatabaseSync {
  const database = new DatabaseSync(databasePath);
  database.exec(statement);
  if (statement.includes("identity_schema_contracts")) {
    database.prepare("INSERT INTO identity_schema_contracts (contract_id, schema_version, contract_fingerprint) VALUES (?, ?, ?)")
      .run(REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT.contractId, REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT.schemaVersion, REGISTERED_SERVICE_WORKLOAD_SCHEMA_FINGERPRINT);
  }
  return database;
}

function insertValid(database: DatabaseSync, status: "ACTIVE" | "SUSPENDED" | "REVOKED" = "ACTIVE"): void {
  database.prepare(`INSERT INTO identity_registered_service_workloads (
    registration_id, tenant_id, principal_id, principal_type, assurance, environment,
    status, workload_purpose, audience, registration_version, identity_evidence_ref,
    audit_evidence_ref, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "registration-api-014", "tenant-a", "service-publication", "SERVICE", "WORKLOAD", "PRODUCTION",
    status, "PUBLICATION_RUNTIME", "API-014", 1, "identity-evidence:registration-api-014",
    "audit-evidence:registration-api-014", "2026-09-18T00:00:00.000Z", "2026-09-18T00:00:00.000Z",
  );
}

function expectUnavailable(operation: () => unknown): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof RegisteredServiceWorkloadError
    && error.code === "IDENTITY_AUTHORITY_UNAVAILABLE"
    && error.message === "Registered service workload authority is unavailable.");
}

test("reads an authoritative immutable registered SERVICE/WORKLOAD binding from a prepared schema", () => {
  const item = fixture();
  try {
    const database = provision(item.databasePath);
    insertValid(database);
    database.close();
    const store = new DurableRegisteredServiceWorkloadStore({ databasePath: item.databasePath, evidenceVerifier: verifier() });
    const record = store.findByRegistrationId("registration-api-014");
    assert.deepEqual(record, {
      registrationId: "registration-api-014", tenantId: "tenant-a", principalId: "service-publication",
      principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION", status: "ACTIVE",
      workloadPurpose: "PUBLICATION_RUNTIME", audience: "API-014", registrationVersion: 1,
      identityEvidenceRef: "identity-evidence:registration-api-014", auditEvidenceRef: "audit-evidence:registration-api-014",
      createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z",
    });
    assert.equal(Object.isFrozen(record), true);
    store.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("missing prepared schema fails closed and runtime creates no table or index", () => {
  const item = fixture();
  try {
    expectUnavailable(() => new DurableRegisteredServiceWorkloadStore({ databasePath: item.databasePath, evidenceVerifier: verifier() }));
    const database = new DatabaseSync(item.databasePath);
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'identity_registered_service_workloads%'").all().length, 0);
    database.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("missing required tenant/status index fails closed without repairing the schema", () => {
  const item = fixture();
  try {
    const database = provision(item.databasePath, SCHEMA.replace(/CREATE INDEX[\s\S]*$/u, ""));
    database.close();
    expectUnavailable(() => new DurableRegisteredServiceWorkloadStore({ databasePath: item.databasePath, evidenceVerifier: verifier() }));
    const inspection = new DatabaseSync(item.databasePath);
    assert.equal(inspection.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'identity_registered_service_workloads_tenant_status_idx'").get(), undefined);
    inspection.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("schema version, fingerprint, extra column and constraint drift fail closed without repair", () => {
  for (const mutation of [
    "UPDATE identity_schema_contracts SET schema_version = 2",
    "UPDATE identity_schema_contracts SET contract_fingerprint = 'wrong'",
    "ALTER TABLE identity_registered_service_workloads ADD COLUMN unexpected TEXT",
  ]) {
    const item = fixture();
    try {
      const database = provision(item.databasePath);
      database.exec(mutation);
      database.close();
      expectUnavailable(() => new DurableRegisteredServiceWorkloadStore({ databasePath: item.databasePath, evidenceVerifier: verifier() }));
    } finally { rmSync(item.directory, { recursive: true, force: true }); }
  }
});

test("orphaned or tenant-mismatched evidence fails closed", () => {
  const item = fixture();
  try {
    const database = provision(item.databasePath);
    insertValid(database);
    database.close();
    const store = new DurableRegisteredServiceWorkloadStore({
      databasePath: item.databasePath,
      evidenceVerifier: verifier({ assertRegisteredWorkloadEvidence: () => { throw new Error("C:\\private\\identity.sqlite raw diagnostic"); } }),
    });
    expectUnavailable(() => store.findByRegistrationId("registration-api-014"));
    store.close();
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});

test("closed stores and malformed identifiers fail safely", () => {
  const item = fixture();
  try {
    const database = provision(item.databasePath);
    database.close();
    const store = new DurableRegisteredServiceWorkloadStore({ databasePath: item.databasePath, evidenceVerifier: verifier() });
    assert.equal(store.findByRegistrationId(""), undefined);
    assert.equal(store.findByRegistrationId("x".repeat(513)), undefined);
    store.close();
    expectUnavailable(() => store.findByRegistrationId("registration-api-014"));
  } finally { rmSync(item.directory, { recursive: true, force: true }); }
});
