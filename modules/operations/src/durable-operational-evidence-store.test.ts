import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  DurableOperationalEvidenceStore,
  createProductionOperationalEvidenceStore,
} from "./durable-operational-evidence-store.js";
import { OperationalEvidenceError, type OperationalTelemetryRecord } from "./operational-telemetry-contracts.js";

function telemetry(overrides: Partial<OperationalTelemetryRecord> = {}): OperationalTelemetryRecord {
  return {
    telemetryEventId: "telemetry:evt-001",
    eventType: "PUBLICATION_EXECUTION_OBSERVED",
    component: "PUBLICATION_RUNTIME",
    operation: "EXECUTE_PUBLICATION",
    resourceType: "PUBLICATION",
    resourceRef: `publication:sha256:${"a".repeat(64)}`,
    outcome: "COMPLETED",
    safeErrorCode: null,
    correlationId: "correlation:001",
    evidenceRefs: ["evidence:publication:001"],
    occurredAt: "2026-09-09T01:00:00.000Z",
    attemptId: "attempt:001",
    ...overrides,
  };
}

function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-b-"));
  try { run(join(directory, "operations.sqlite")); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof OperationalEvidenceError && error.code === code);
}

function expectOpenFailure(databasePath: string): void {
  let unexpected: DurableOperationalEvidenceStore | undefined;
  try {
    unexpected = new DurableOperationalEvidenceStore({ databasePath });
    assert.fail("Expected durable startup to fail closed.");
  } catch (error) {
    assert.equal(error instanceof OperationalEvidenceError && error.code === "PERSISTENCE_UNAVAILABLE", true);
  } finally { unexpected?.close(); }
}

test("FEAT-023-B persists canonical telemetry across close and reopen with bounded filtering", () => withDatabase((databasePath) => {
  const first = createProductionOperationalEvidenceStore({ databasePath });
  first.append(telemetry());
  const { attemptId: ignoredAttemptId, ...connectorRecord } = telemetry({ telemetryEventId: "telemetry:evt-002", component: "CONNECTOR_RUNTIME", resourceType: "CONNECTOR", resourceRef: `connector:sha256:${"b".repeat(64)}`, operation: "EXECUTE_CONNECTOR", invocationId: "invocation:002" });
  void ignoredAttemptId;
  first.append(connectorRecord);
  first.close();

  const reopened = new DurableOperationalEvidenceStore({ databasePath });
  assert.deepEqual(reopened.find("telemetry:evt-001"), telemetry());
  assert.deepEqual(reopened.append(structuredClone(telemetry())), telemetry());
  assert.equal(reopened.list().length, 2);
  assert.deepEqual(reopened.list({ component: "CONNECTOR_RUNTIME", limit: 10 }).map(({ telemetryEventId }) => telemetryEventId), ["telemetry:evt-002"]);
  assert.equal(Object.isFrozen(reopened.list()), true);
  assert.equal(Object.isFrozen(reopened.find("telemetry:evt-001")), true);
  reopened.close();
}));

test("FEAT-023-B exact identity replay is stable and conflicting identity is rejected", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  const first = store.append(telemetry());
  const replay = store.append(structuredClone(telemetry()));
  assert.deepEqual(replay, first);
  assert.equal(store.list().length, 1);
  expectCode(() => store.append(telemetry({ outcome: "FAILED", safeErrorCode: "DEPENDENCY_UNAVAILABLE" })), "TELEMETRY_IDENTITY_CONFLICT");
  assert.equal(store.list().length, 1);
  store.close();
}));

test("FEAT-023-B durable configuration fails closed and never falls back to memory", () => {
  expectCode(() => createProductionOperationalEvidenceStore({ databasePath: "" }), "PERSISTENCE_UNAVAILABLE");
  expectCode(() => createProductionOperationalEvidenceStore({ databasePath: ":memory:" }), "PERSISTENCE_UNAVAILABLE");
  expectCode(() => createProductionOperationalEvidenceStore({ databasePath: "file::memory:" }), "PERSISTENCE_UNAVAILABLE");
});

test("FEAT-023-B database evidence is append-only and corrupted state fails closed on reopen", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  store.append(telemetry());
  store.close();

  const raw = new DatabaseSync(databasePath);
  assert.throws(() => raw.exec("UPDATE operational_telemetry SET payload_json = '{}' WHERE telemetry_event_id = 'telemetry:evt-001'"), /append-only/iu);
  assert.throws(() => raw.exec("DELETE FROM operational_telemetry WHERE telemetry_event_id = 'telemetry:evt-001'"), /append-only/iu);
  raw.exec("DROP TRIGGER operational_telemetry_no_update");
  raw.exec("UPDATE operational_telemetry SET payload_json = '{}' WHERE telemetry_event_id = 'telemetry:evt-001'");
  raw.close();

  expectCode(() => new DurableOperationalEvidenceStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
}));

test("FEAT-023-B database rejects conflict replacement of immutable evidence", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  store.append(telemetry());
  store.close();
  const replacement = telemetry({ outcome: "FAILED", safeErrorCode: "DEPENDENCY_UNAVAILABLE" });
  const raw = new DatabaseSync(databasePath);
  try {
    assert.throws(() => raw.prepare(`INSERT OR REPLACE INTO operational_telemetry
      (telemetry_event_id, event_type, component, operation, resource_type, resource_ref, outcome, safe_error_code, correlation_id, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(replacement.telemetryEventId, replacement.eventType, replacement.component, replacement.operation, replacement.resourceType,
        replacement.resourceRef, replacement.outcome, replacement.safeErrorCode, replacement.correlationId, replacement.occurredAt, JSON.stringify(replacement)), /append-only/iu);
  } finally { raw.close(); }
  const reopened = new DurableOperationalEvidenceStore({ databasePath });
  assert.deepEqual(reopened.find("telemetry:evt-001"), telemetry());
  reopened.close();
}));

test("FEAT-023-B startup rejects materialized-column drift and no-op append-only controls", () => {
  withDatabase((databasePath) => {
    const store = new DurableOperationalEvidenceStore({ databasePath });
    store.append(telemetry());
    store.close();
    const raw = new DatabaseSync(databasePath);
    raw.exec("DROP TRIGGER operational_telemetry_no_update");
    raw.exec("UPDATE operational_telemetry SET component = 'TAMPERED' WHERE telemetry_event_id = 'telemetry:evt-001'");
    raw.close();
    expectOpenFailure(databasePath);
  });
  withDatabase((databasePath) => {
    const raw = new DatabaseSync(databasePath);
    raw.exec(`CREATE TABLE operational_telemetry (
      telemetry_event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, component TEXT NOT NULL, operation TEXT NOT NULL,
      resource_type TEXT NOT NULL, resource_ref TEXT NOT NULL, outcome TEXT NOT NULL, safe_error_code TEXT,
      correlation_id TEXT, occurred_at TEXT NOT NULL, payload_json TEXT NOT NULL
    ); CREATE TRIGGER operational_telemetry_no_update BEFORE UPDATE ON operational_telemetry BEGIN SELECT 1; END;`);
    raw.close();
    expectOpenFailure(databasePath);
  });
});

test("FEAT-023-B list rejects unbounded or unsafe operational filters", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  try {
    expectCode(() => store.list({ limit: 0 }), "TELEMETRY_INPUT_INVALID");
    expectCode(() => store.list({ limit: 101 }), "TELEMETRY_INPUT_INVALID");
    expectCode(() => store.list({ resourceRef: "person@example.com" }), "TELEMETRY_UNSAFE_CONTENT");
    expectCode(() => store.list({ correlatonId: "correlation:001" } as never), "TELEMETRY_INPUT_INVALID");
    expectCode(() => store.list({ component: "connector-runtime" }), "TELEMETRY_INPUT_INVALID");
    const inherited = Object.create({ component: "CONNECTOR_RUNTIME" }) as never;
    expectCode(() => store.list(inherited), "TELEMETRY_INPUT_INVALID");
  } finally { store.close(); }
}));
