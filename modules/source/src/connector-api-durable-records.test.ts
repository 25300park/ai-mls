import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ConnectorPersistenceError, DurableConnectorExecutionUnitOfWork, type ConnectorExecutionScope } from "./connector-durable-persistence.js";

const scope: ConnectorExecutionScope = Object.freeze({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" });

test("F18-D durable API record survives restart and preserves append-only evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-d-records-"));
  const databasePath = join(directory, "connector.sqlite");
  try {
    const first = new DurableConnectorExecutionUnitOfWork({ databasePath });
    const created = first.recordTechnicalState({ ...scope, recordType: "CONNECTOR_INSTANCE", recordId: "instance-1", status: "REGISTERED", expectedVersion: 0, idempotencyKey: "test-1", inputFingerprint: "fingerprint-instance-1", safeEvidenceReference: "evidence:instance:1", recordedAt: "2026-09-01T00:00:00.000Z" });
    assert.equal(created.version, 1);
    first.close();

    const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
    assert.deepEqual(reopened.findTechnicalState(scope, "CONNECTOR_INSTANCE", "instance-1"), created);
    assert.equal(reopened.listTechnicalEvidence(scope, "CONNECTOR_INSTANCE", "instance-1").length, 1);
    const replay = reopened.recordTechnicalState({ ...scope, recordType: "CONNECTOR_INSTANCE", recordId: "instance-1", status: "REGISTERED", expectedVersion: 0, idempotencyKey: "test-1", inputFingerprint: "fingerprint-instance-1", safeEvidenceReference: "evidence:instance:1", recordedAt: "2026-09-01T00:00:00.000Z" });
    assert.deepEqual(replay, created);
    assert.equal(reopened.listTechnicalEvidence(scope, "CONNECTOR_INSTANCE", "instance-1").length, 1);
    reopened.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("F18-D durable API records enforce version, idempotency, and scope concealment", () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-d-records-"));
  const databasePath = join(directory, "connector.sqlite");
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath });
  try {
    const input = { ...scope, recordType: "CAPTURE_BATCH" as const, recordId: "batch-1", status: "ACCEPTED", expectedVersion: 0, idempotencyKey: "test-1", inputFingerprint: "fingerprint-batch-1", safeEvidenceReference: "evidence:batch:1", recordedAt: "2026-09-01T00:00:00.000Z" };
    persistence.recordTechnicalState(input);
    assert.throws(() => persistence.recordTechnicalState({ ...input, idempotencyKey: "test-2", inputFingerprint: "fingerprint-batch-2" }), (error) => error instanceof ConnectorPersistenceError && error.code === "TECHNICAL_VERSION_CONFLICT");
    assert.throws(() => persistence.recordTechnicalState({ ...input, status: "FAILED", inputFingerprint: "different" }), (error) => error instanceof ConnectorPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.equal(persistence.findTechnicalState({ ...scope, tenantId: "tenant-2" }, "CAPTURE_BATCH", "batch-1"), undefined);
    assert.equal(persistence.findTechnicalState({ ...scope, scopeId: "team-2" }, "CAPTURE_BATCH", "batch-1"), undefined);
  } finally { persistence.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F18-D stores instance, batch, delivery, observation, and health as bounded technical records", () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-d-records-"));
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath: join(directory, "connector.sqlite") });
  try {
    const types = ["CONNECTOR_INSTANCE", "CAPTURE_BATCH", "DELIVERY_ATTEMPT", "EXTERNAL_OBSERVATION", "HEALTH_SIGNAL"] as const;
    for (const [index, recordType] of types.entries()) {
      const record = persistence.recordTechnicalState({ ...scope, recordType, recordId: `record-${index}`, status: "ACCEPTED", expectedVersion: 0, idempotencyKey: `idem-${index}`, inputFingerprint: `fingerprint-${index}`, safeEvidenceReference: `evidence:record:${index}`, recordedAt: "2026-09-01T00:00:00.000Z" });
      assert.equal(record.recordType, recordType);
      assert.equal(Object.isFrozen(record), true);
    }
  } finally { persistence.close(); rmSync(directory, { recursive: true, force: true }); }
});
