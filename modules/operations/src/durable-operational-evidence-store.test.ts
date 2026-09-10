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
import {
  OperationalAlertError,
  normalizeAuthoritativeAlertSignals,
  type AuthoritativeAlertSource,
  type OperationalAlertSignal,
} from "./operational-alert-projection.js";
import type { OperationalStatusProjectionRequest, OperationalStatusSnapshot } from "./operational-status-projection.js";

interface ScopedEvidenceStore {
  appendScoped(record: OperationalTelemetryRecord, binding: Readonly<{ tenantId: string; scopeRef: string }>): OperationalTelemetryRecord;
  listScoped(binding: Readonly<{ tenantId: string; scopeRef: string }>): readonly OperationalTelemetryRecord[];
}

interface AlertStore {
  projectAlerts(source: AuthoritativeAlertSource): readonly AlertProjection[];
  listAlertsScoped(binding: Readonly<{ tenantId: string; scopeRef: string }>, filter?: Readonly<{ currentState?: "ACTIVE" | "CLEARED"; limit?: number }>): readonly AlertProjection[];
}

interface AlertProjection {
  readonly alertId: string;
  readonly alertType: string;
  readonly severity: string;
  readonly component: string;
  readonly resourceRef: string;
  readonly currentState: "ACTIVE" | "CLEARED";
  readonly safeReasonCode: string;
  readonly evidenceRefs: readonly string[];
  readonly openedAt: string;
  readonly lastEvaluatedAt: string;
  readonly clearedAt: string | null;
}

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

function statusRequest(overrides: Partial<OperationalStatusProjectionRequest> = {}): OperationalStatusProjectionRequest {
  return {
    statusSnapshotId: "status-snapshot:001",
    telemetryEventId: "telemetry:evt-001",
    health: "HEALTHY",
    readiness: "NOT_READY",
    evaluatedAt: "2026-09-09T01:05:00.000Z",
    freshnessThresholdMs: null,
    ...overrides,
  };
}

function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-b-"));
  let primaryFailure: unknown;
  try { run(join(directory, "operations.sqlite")); } catch (error) { primaryFailure = error; }
  try { rmSync(directory, { recursive: true, force: true }); } catch (cleanupFailure) {
    if (primaryFailure === undefined) throwError(cleanupFailure);
  }
  if (primaryFailure !== undefined) throwError(primaryFailure);
}

function throwError(value: unknown): never {
  if (value instanceof Error) throw value;
  throw new Error("Non-Error test failure", { cause: value });
}

function alertSource(overrides: Readonly<Record<string, unknown>> = {}): AuthoritativeAlertSource {
  return {
    sourceId: "telemetry:alert-001",
    conditionRef: "condition:publication-runtime-001",
    sourceKind: "PUBLICATION_OUTCOME",
    component: "PUBLICATION_RUNTIME",
    resourceRef: `publication:sha256:${"a".repeat(64)}`,
    tenantId: "tenant-a",
    scopeRef: "team-a",
    evidenceRefs: ["evidence:operational:alert-001"],
    observedAt: "2026-09-10T01:00:00.000Z",
    outcome: "UNKNOWN",
    ...overrides,
  };
}

function alertSignal(overrides: Readonly<Record<string, unknown>> = {}): OperationalAlertSignal {
  const [signal] = normalizeAuthoritativeAlertSignals(alertSource(overrides));
  assert.ok(signal);
  return signal;
}

function projectAlert(
  store: DurableOperationalEvidenceStore & AlertStore,
  overrides: Readonly<Record<string, unknown>> = {},
): AlertProjection | undefined {
  const source = alertSource(overrides);
  const signal = alertSignal(overrides);
  if (store.find(signal.sourceId) === undefined) {
    store.appendScoped(telemetry({
      telemetryEventId: signal.sourceId,
      component: signal.component,
      resourceRef: signal.resourceRef,
      outcome: source.sourceKind === "PUBLICATION_OUTCOME" ? source.outcome : "COMPLETED",
      evidenceRefs: signal.evidenceRefs,
      occurredAt: signal.observedAt,
    }), { tenantId: signal.tenantId, scopeRef: signal.scopeRef });
  }
  return store.projectAlerts(source)[0];
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) =>
    (error instanceof OperationalEvidenceError || error instanceof OperationalAlertError) && error.code === code);
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

test("FEAT-023-E repeated active evaluation preserves one durable Alert identity", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  const first = projectAlert(store);
  const repeated = projectAlert(store, {
    sourceId: "telemetry:alert-002",
    evidenceRefs: ["evidence:operational:alert-002"],
    observedAt: "2026-09-10T01:05:00.000Z",
  });
  assert.ok(first);
  assert.ok(repeated);
  assert.equal(repeated.alertId, first.alertId);
  assert.equal(repeated.currentState, "ACTIVE");
  assert.equal(repeated.lastEvaluatedAt, "2026-09-10T01:05:00.000Z");
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }).length, 1);
  store.close();
}));

test("FEAT-023-E clear and later recurrence are deterministic without mutating prior occurrence", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  const active = projectAlert(store);
  const clearedSource = alertSource({
    sourceId: "telemetry:alert-003", evidenceRefs: ["evidence:operational:alert-003"],
    observedAt: "2026-09-10T01:10:00.000Z", outcome: "CONFIRMED",
  });
  const cleared = projectAlert(store, { ...clearedSource });
  assert.ok(active);
  assert.equal(cleared?.alertId, active.alertId);
  assert.equal(cleared?.currentState, "CLEARED");
  assert.equal(cleared?.clearedAt, "2026-09-10T01:10:00.000Z");

  const reopened = projectAlert(store, {
    sourceId: "telemetry:alert-004", evidenceRefs: ["evidence:operational:alert-004"],
    observedAt: "2026-09-10T01:20:00.000Z",
  });
  assert.ok(reopened);
  assert.notEqual(reopened.alertId, active.alertId);
  assert.equal(reopened.currentState, "ACTIVE");
  const history = store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" });
  assert.deepEqual(history.map(({ alertId, currentState }) => ({ alertId, currentState })), [
    { alertId: reopened.alertId, currentState: "ACTIVE" },
    { alertId: active.alertId, currentState: "CLEARED" },
  ]);
  store.close();
}));

test("FEAT-023-E active identity and lifecycle survive close/reopen without duplicate opening", () => withDatabase((databasePath) => {
  const first = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  const alert = projectAlert(first);
  first.close();
  const reopened = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  const replay = projectAlert(reopened);
  assert.equal(replay?.alertId, alert?.alertId);
  assert.equal(reopened.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }).length, 1);
  reopened.close();
}));

test("FEAT-023-E Alert reads fail closed across tenant or scope boundaries", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  projectAlert(store);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-b", scopeRef: "team-a" }).length, 0);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-b" }).length, 0);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }, { currentState: "ACTIVE" }).length, 1);
  store.close();
}));

test("FEAT-023-E rejects a syntactically valid Alert signal without durable authoritative evidence", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  expectCode(() => store.projectAlerts(alertSource()), "OPERATIONAL_ALERT_INVALID");
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }).length, 0);
  store.close();
}));

test("FEAT-023-E keeps distinct condition references separate for the same resource", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  const first = projectAlert(store);
  const second = projectAlert(store, {
    sourceId: "telemetry:alert-distinct-002", conditionRef: "condition:publication-runtime-002",
    evidenceRefs: ["evidence:operational:alert-distinct-002"], observedAt: "2026-09-10T01:05:00.000Z",
  });
  assert.notEqual(first?.alertId, second?.alertId);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }, { currentState: "ACTIVE" }).length, 2);
  store.close();
}));

test("FEAT-023-E same-timestamp clear wins and ACTIVE alerts are never hidden behind cleared history", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  const old = projectAlert(store, { conditionRef: "condition:old-cleared-001" });
  const cleared = projectAlert(store, {
    sourceId: "telemetry:alert-clear-same-time-002", conditionRef: "condition:old-cleared-001",
    evidenceRefs: ["evidence:operational:alert-clear-same-time-002"], outcome: "CONFIRMED",
  });
  assert.equal(cleared?.alertId, old?.alertId);
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" })[0]?.currentState, "CLEARED");
  projectAlert(store, {
    sourceId: "telemetry:alert-new-active-003", conditionRef: "condition:new-active-003",
    evidenceRefs: ["evidence:operational:alert-new-active-003"], observedAt: "2026-09-10T01:10:00.000Z",
  });
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }, { limit: 1 })[0]?.currentState, "ACTIVE");
  store.close();
}));

test("FEAT-023-E operational status projection derives durable Alerts through the same store", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  store.appendScoped(telemetry(), { tenantId: "tenant-a", scopeRef: "team-a" });
  store.projectStatus(statusRequest({ health: "UNHEALTHY", readiness: "NOT_READY" }));
  const alerts = store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }, { currentState: "ACTIVE" });
  assert.deepEqual(alerts.map(({ alertType }) => alertType).sort(), ["COMPONENT_NOT_READY", "COMPONENT_UNHEALTHY"]);
  store.close();
}));

test("FEAT-023-E rejects source-specific alert facts not proven by durable telemetry", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  store.appendScoped(telemetry(), { tenantId: "tenant-a", scopeRef: "team-a" });
  expectCode(() => store.projectAlerts({
    sourceId: "telemetry:evt-001",
    conditionRef: "condition:publication-outcome-001",
    sourceKind: "PUBLICATION_OUTCOME",
    component: "PUBLICATION_RUNTIME",
    resourceRef: `publication:sha256:${"a".repeat(64)}`,
    tenantId: "tenant-a",
    scopeRef: "team-a",
    evidenceRefs: ["evidence:publication:001"],
    observedAt: "2026-09-09T01:00:00.000Z",
    outcome: "UNKNOWN",
  }), "OPERATIONAL_ALERT_INVALID");
  const relabelCommon = {
    component: "PUBLICATION_RUNTIME", resourceRef: `publication:sha256:${"a".repeat(64)}`,
    tenantId: "tenant-a", scopeRef: "team-a", evidenceRefs: ["evidence:publication:001"],
    observedAt: "2026-09-09T01:00:00.000Z",
  } as const;
  store.appendScoped(telemetry({ telemetryEventId: "telemetry:evt-security-relabel-002", outcome: "DETECTED" }), { tenantId: "tenant-a", scopeRef: "team-a" });
  expectCode(() => store.projectAlerts({ ...relabelCommon, sourceId: "telemetry:evt-security-relabel-002",
    conditionRef: "condition:security-finding-001", sourceKind: "SECURITY_FINDING", detected: true }), "OPERATIONAL_ALERT_INVALID");
  store.appendScoped(telemetry({ telemetryEventId: "telemetry:evt-architecture-relabel-003", outcome: "DRIFT" }), { tenantId: "tenant-a", scopeRef: "team-a" });
  expectCode(() => store.projectAlerts({ ...relabelCommon, sourceId: "telemetry:evt-architecture-relabel-003",
    conditionRef: "condition:architecture-checksum-001", sourceKind: "ARCHITECTURE_CHECKSUM",
    matchesBaseline: false, approvedDelta: false }), "OPERATIONAL_ALERT_INVALID");
  assert.equal(store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" }).length, 0);
  store.close();
}));

test("FEAT-023-E status snapshots provide distinct replay identities for lifecycle transitions", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  store.appendScoped(telemetry(), { tenantId: "tenant-a", scopeRef: "team-a" });
  store.projectStatus(statusRequest({
    statusSnapshotId: "status-snapshot:stale-001",
    health: "HEALTHY",
    readiness: "READY",
    evaluatedAt: "2026-09-09T01:11:00.000Z",
    freshnessThresholdMs: 600_000,
  }));
  store.projectStatus(statusRequest({
    statusSnapshotId: "status-snapshot:fresh-002",
    health: "HEALTHY",
    readiness: "READY",
    evaluatedAt: "2026-09-09T01:12:00.000Z",
    freshnessThresholdMs: 1_200_000,
  }));
  const [alert] = store.listAlertsScoped({ tenantId: "tenant-a", scopeRef: "team-a" });
  assert.equal(alert?.alertType, "STALE_OPERATIONAL_EVIDENCE");
  assert.equal(alert?.currentState, "CLEARED");
  assert.equal(alert?.lastEvaluatedAt, "2026-09-09T01:12:00.000Z");
  store.close();
}));

test("FEAT-023-E source identity conflict is rejected and Alert tables are append-only", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  projectAlert(store);
  assert.throws(() => store.projectAlerts(alertSource({ conditionRef: "condition:publication-runtime-conflict-002" })), (error: unknown) =>
    error instanceof OperationalAlertError && error.code === "OPERATIONAL_ALERT_IDENTITY_CONFLICT");
  store.close();

  const database = new DatabaseSync(databasePath);
  assert.throws(() => database.exec("UPDATE operational_alert_occurrence SET opened_at = '2026-09-10T02:00:00.000Z'"));
  assert.throws(() => database.exec("DELETE FROM operational_alert_evaluation"));
  database.close();
}));

test("FEAT-023-E reopen rejects a tampered Alert occurrence tenant binding", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath }) as DurableOperationalEvidenceStore & AlertStore;
  projectAlert(store);
  store.close();

  const raw = new DatabaseSync(databasePath);
  raw.exec("DROP TRIGGER operational_alert_occurrence_no_update");
  raw.exec("UPDATE operational_alert_occurrence SET tenant_id = 'tenant-b'");
  raw.close();

  expectCode(() => new DurableOperationalEvidenceStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
}));

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

test("FEAT-023-C persists a telemetry-correlated status snapshot across reopen", () => withDatabase((databasePath) => {
  const first = new DurableOperationalEvidenceStore({ databasePath });
  first.append(telemetry());
  const projected = first.projectStatus(statusRequest());
  assert.deepEqual(projected, {
    statusSnapshotId: "status-snapshot:001",
    telemetryEventId: "telemetry:evt-001",
    component: "PUBLICATION_RUNTIME",
    resourceType: "PUBLICATION",
    resourceRef: `publication:sha256:${"a".repeat(64)}`,
    health: "HEALTHY",
    readiness: "NOT_READY",
    freshness: "UNKNOWN",
    evidenceOccurredAt: "2026-09-09T01:00:00.000Z",
    evaluatedAt: "2026-09-09T01:05:00.000Z",
    freshnessThresholdMs: null,
  } satisfies OperationalStatusSnapshot);
  first.close();

  const reopened = new DurableOperationalEvidenceStore({ databasePath });
  assert.deepEqual(reopened.findStatus("status-snapshot:001"), projected);
  assert.deepEqual(reopened.listStatuses({ component: "PUBLICATION_RUNTIME" }), [projected]);
  assert.equal(Object.isFrozen(reopened.listStatuses()), true);
  reopened.close();
}));

test("FEAT-023-C status projection requires durable telemetry and immutable identity", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  try {
    assert.throws(() => store.projectStatus(statusRequest()), { code: "TELEMETRY_NOT_FOUND" });
    store.append(telemetry());
    const first = store.projectStatus(statusRequest());
    assert.deepEqual(store.projectStatus(structuredClone(statusRequest())), first);
    assert.throws(() => store.projectStatus(statusRequest({ readiness: "READY" })), { code: "OPERATIONAL_STATUS_IDENTITY_CONFLICT" });
    assert.equal(store.listStatuses().length, 1);
  } finally { store.close(); }
}));

test("FEAT-023-C operational status snapshots are append-only at the database boundary", () => withDatabase((databasePath) => {
  const store = new DurableOperationalEvidenceStore({ databasePath });
  store.append(telemetry());
  store.projectStatus(statusRequest());
  store.close();
  const raw = new DatabaseSync(databasePath);
  try {
    assert.throws(() => raw.exec("UPDATE operational_status_snapshot SET health = 'UNHEALTHY' WHERE status_snapshot_id = 'status-snapshot:001'"), /append-only/iu);
    assert.throws(() => raw.exec("DELETE FROM operational_status_snapshot WHERE status_snapshot_id = 'status-snapshot:001'"), /append-only/iu);
  } finally { raw.close(); }
}));

test("FEAT-023-D unbound evidence is concealed and tenant scope binding survives restart append-only", () => withDatabase((databasePath) => {
  const first = new DurableOperationalEvidenceStore({ databasePath });
  const scoped = first as unknown as ScopedEvidenceStore;
  const binding = { tenantId: "tenant-001", scopeRef: "team-001" } as const;
  const boundRecord = telemetry({ telemetryEventId: "telemetry:evt-023-d" });
  try {
    first.append(telemetry());
    assert.deepEqual(scoped.listScoped(binding), []);
    expectCode(() => scoped.appendScoped(telemetry(), binding), "TELEMETRY_IDENTITY_CONFLICT");
    assert.deepEqual(scoped.listScoped(binding), []);
    assert.deepEqual(scoped.appendScoped(boundRecord, binding), boundRecord);
    assert.deepEqual(scoped.listScoped(binding), [boundRecord]);
    assert.deepEqual(scoped.listScoped({ ...binding, tenantId: "tenant-002" }), []);
    assert.deepEqual(scoped.listScoped({ ...binding, scopeRef: "team-002" }), []);
  } finally { first.close(); }

  const reopened = new DurableOperationalEvidenceStore({ databasePath }) as unknown as ScopedEvidenceStore & { close(): void };
  assert.deepEqual(reopened.listScoped(binding), [boundRecord]);
  reopened.close();

  const raw = new DatabaseSync(databasePath);
  try {
    assert.throws(() => raw.exec("UPDATE operational_evidence_binding SET tenant_id = 'tenant-002' WHERE telemetry_event_id = 'telemetry:evt-023-d'"), /append-only/iu);
    assert.throws(() => raw.exec("DELETE FROM operational_evidence_binding WHERE telemetry_event_id = 'telemetry:evt-023-d'"), /append-only/iu);
  } finally { raw.close(); }
}));
