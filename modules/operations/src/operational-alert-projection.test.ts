import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_ALERT_TYPES,
  OperationalAlertError,
  canonicalSeverityForAlert,
  normalizeAuthoritativeAlertSignals,
  validateOperationalAlertProjection,
} from "./operational-alert-projection.js";

const resourceRef = `publication:sha256:${"a".repeat(64)}`;
const common = Object.freeze({
  sourceId: "status-snapshot:001",
  conditionRef: "condition:operational-status-001",
  component: "PUBLICATION_RUNTIME",
  resourceRef,
  tenantId: "tenant-a",
  scopeRef: "team-a",
  evidenceRefs: ["evidence:operational:001"],
  observedAt: "2026-09-10T01:00:00.000Z",
});

function expectInvalid(run: () => unknown): void {
  assert.throws(run, (error: unknown) => error instanceof OperationalAlertError && error.code === "OPERATIONAL_ALERT_INVALID");
}

test("FEAT-023-E preserves exactly fourteen canonical Alert types and approved fixed severities", () => {
  assert.deepEqual(CANONICAL_ALERT_TYPES, [
    "COMPONENT_UNHEALTHY", "COMPONENT_NOT_READY", "STALE_OPERATIONAL_EVIDENCE",
    "PUBLICATION_UNKNOWN_OUTCOME", "CONNECTOR_AMBIGUITY", "OPEN_RECOVERY_CASE",
    "SUSPENDED_INTEGRATION_CONTRACT", "AUTHORIZATION_FAILURE_SPIKE", "IDEMPOTENCY_CONFLICT_SPIKE",
    "SECRET_LEAKAGE_DETECTED", "DEPENDENCY_SECURITY_FINDING", "ARCHITECTURE_DRIFT_DETECTED",
    "BACKUP_READINESS_FAILURE", "DEPLOYMENT_READINESS_FAILURE",
  ]);
  assert.equal(canonicalSeverityForAlert("COMPONENT_UNHEALTHY"), "HIGH");
  assert.equal(canonicalSeverityForAlert("COMPONENT_NOT_READY"), "HIGH");
  assert.equal(canonicalSeverityForAlert("STALE_OPERATIONAL_EVIDENCE"), "WARNING");
  assert.equal(canonicalSeverityForAlert("PUBLICATION_UNKNOWN_OUTCOME"), "HIGH");
  assert.equal(canonicalSeverityForAlert("CONNECTOR_AMBIGUITY"), "HIGH");
  assert.equal(canonicalSeverityForAlert("OPEN_RECOVERY_CASE"), "WARNING");
  assert.equal(canonicalSeverityForAlert("SUSPENDED_INTEGRATION_CONTRACT"), "WARNING");
  assert.equal(canonicalSeverityForAlert("SECRET_LEAKAGE_DETECTED"), "CRITICAL");
  assert.equal(canonicalSeverityForAlert("ARCHITECTURE_DRIFT_DETECTED"), "HIGH");
  for (const disabled of ["AUTHORIZATION_FAILURE_SPIKE", "IDEMPOTENCY_CONFLICT_SPIKE", "BACKUP_READINESS_FAILURE", "DEPLOYMENT_READINESS_FAILURE"] as const) {
    assert.equal(canonicalSeverityForAlert(disabled), undefined);
  }
});

test("FEAT-023-E normalizes authoritative dependency severity without adding vocabulary", () => {
  for (const [input, expected] of [["informational", "INFO"], ["info", "INFO"], ["low", "INFO"], ["moderate", "WARNING"], ["medium", "WARNING"], ["high", "HIGH"], ["critical", "CRITICAL"]] as const) {
    assert.equal(canonicalSeverityForAlert("DEPENDENCY_SECURITY_FINDING", input), expected);
  }
  expectInvalid(() => canonicalSeverityForAlert("DEPENDENCY_SECURITY_FINDING", "severe"));
  expectInvalid(() => canonicalSeverityForAlert("UNKNOWN_ALERT" as never));
});

test("FEAT-023-E derives Health, Readiness and approved Freshness signals independently", () => {
  const signals = normalizeAuthoritativeAlertSignals({
    ...common,
    sourceKind: "OPERATIONAL_STATUS",
    health: "UNHEALTHY",
    readiness: "NOT_READY",
    freshness: "STALE",
    freshnessThresholdMs: 300_000,
  });
  assert.deepEqual(signals.map(({ alertType, severity, active }) => ({ alertType, severity, active })), [
    { alertType: "COMPONENT_UNHEALTHY", severity: "HIGH", active: true },
    { alertType: "COMPONENT_NOT_READY", severity: "HIGH", active: true },
    { alertType: "STALE_OPERATIONAL_EVIDENCE", severity: "WARNING", active: true },
  ]);
  assert.equal(signals.every((signal) => signal.tenantId === "tenant-a" && signal.scopeRef === "team-a"), true);
  assert.equal(signals.every(Object.isFrozen), true);

  const unknown = normalizeAuthoritativeAlertSignals({
    ...common, sourceKind: "OPERATIONAL_STATUS", health: "DEGRADED", readiness: "DEGRADED",
    freshness: "UNKNOWN", freshnessThresholdMs: null,
  });
  assert.deepEqual(unknown.map(({ alertType, active }) => ({ alertType, active })), [
    { alertType: "COMPONENT_UNHEALTHY", active: false },
    { alertType: "COMPONENT_NOT_READY", active: false },
    { alertType: "STALE_OPERATIONAL_EVIDENCE", active: false },
  ]);
});

test("FEAT-023-E normalizes approved domain conditions without execution authority", () => {
  const inputs = [
    { sourceKind: "PUBLICATION_OUTCOME", outcome: "UNKNOWN" },
    { sourceKind: "CONNECTOR_INVOCATION", state: "AMBIGUOUS" },
    { sourceKind: "RECOVERY_CASE", status: "OPEN" },
    { sourceKind: "INTEGRATION_CONTRACT", status: "SUSPENDED" },
    { sourceKind: "SECURITY_FINDING", detected: true },
    { sourceKind: "ARCHITECTURE_CHECKSUM", matchesBaseline: false, approvedDelta: false },
  ] as const;
  const expected = [
    ["PUBLICATION_UNKNOWN_OUTCOME", "HIGH"], ["CONNECTOR_AMBIGUITY", "HIGH"],
    ["OPEN_RECOVERY_CASE", "WARNING"], ["SUSPENDED_INTEGRATION_CONTRACT", "WARNING"],
    ["SECRET_LEAKAGE_DETECTED", "CRITICAL"], ["ARCHITECTURE_DRIFT_DETECTED", "HIGH"],
  ] as const;
  inputs.forEach((input, index) => {
    const signal = normalizeAuthoritativeAlertSignals({ ...common, ...input })[0];
    assert.deepEqual(signal === undefined ? undefined : [signal.alertType, signal.severity], expected[index]);
    assert.equal(Object.hasOwn(signal ?? {}, "retry"), false);
    assert.equal(Object.hasOwn(signal ?? {}, "recover"), false);
    assert.equal(Object.hasOwn(signal ?? {}, "authorized"), false);
  });
});

test("FEAT-023-E suppresses approved deltas and disabled alerts while rejecting unsafe source input", () => {
  assert.deepEqual(normalizeAuthoritativeAlertSignals({ ...common, sourceKind: "ARCHITECTURE_CHECKSUM", matchesBaseline: false, approvedDelta: true }).map(({ alertType, active }) => ({ alertType, active })), [
    { alertType: "ARCHITECTURE_DRIFT_DETECTED", active: false },
  ]);
  assert.deepEqual(normalizeAuthoritativeAlertSignals({ ...common, sourceKind: "AUTHORIZATION_AGGREGATE", failureCount: 10 }), []);
  assert.deepEqual(normalizeAuthoritativeAlertSignals({ ...common, sourceKind: "BACKUP_READINESS", readiness: "NOT_READY" }), []);
  expectInvalid(() => normalizeAuthoritativeAlertSignals({ ...common, sourceKind: "SECURITY_FINDING", detected: true, rawSecret: "not-a-secret-fixture" }));
  expectInvalid(() => normalizeAuthoritativeAlertSignals({ ...common, sourceKind: "DEPENDENCY_AUDIT", active: true, auditSeverity: "high", evidenceRefs: ["secret:unsafe"] }));
});

test("FEAT-023-E rejects a projection whose fixed type severity contradicts canonical mapping", () => {
  expectInvalid(() => validateOperationalAlertProjection({
    alertId: "alert:001", alertType: "COMPONENT_UNHEALTHY", severity: "INFO",
    component: "PUBLICATION_RUNTIME", resourceRef, currentState: "ACTIVE",
    safeReasonCode: "COMPONENT_UNHEALTHY", evidenceRefs: ["evidence:operational:001"],
    openedAt: "2026-09-10T01:00:00.000Z", lastEvaluatedAt: "2026-09-10T01:00:00.000Z", clearedAt: null,
  }));
});

test("FEAT-023-E rejects invented incident lifecycle and unsafe payload-bearing Alert fields", () => {
  const projection = {
    alertId: "alert:001", alertType: "COMPONENT_UNHEALTHY", severity: "HIGH",
    component: "PUBLICATION_RUNTIME", resourceRef, currentState: "ACTIVE",
    safeReasonCode: "COMPONENT_UNHEALTHY", evidenceRefs: ["evidence:operational:001"],
    openedAt: "2026-09-10T01:00:00.000Z", lastEvaluatedAt: "2026-09-10T01:00:00.000Z", clearedAt: null,
  } as const;
  expectInvalid(() => validateOperationalAlertProjection({ ...projection, currentState: "ACKNOWLEDGED" }));
  for (const unsafeField of ["secret", "rawProviderResponse", "rawModelResponse", "rawPrompt", "chainOfThought", "stackTrace", "databasePath"] as const) {
    expectInvalid(() => validateOperationalAlertProjection({ ...projection, [unsafeField]: "non-secret-test-value" }));
  }
  for (const unsafeReference of ["evidence:user@example.com", "evidence:raw-prompt-001", "evidence:token-001"] as const) {
    expectInvalid(() => validateOperationalAlertProjection({ ...projection, evidenceRefs: [unsafeReference] }));
  }
});
