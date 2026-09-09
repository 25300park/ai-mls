import assert from "node:assert/strict";
import test from "node:test";

import {
  OperationalStatusError,
  deriveEvidenceFreshness,
  validateOperationalStatusProjectionRequest,
  validateOperationalStatusSnapshot,
  type OperationalStatusProjectionRequest,
  type OperationalStatusSnapshot,
} from "./operational-status-projection.js";

function snapshot(overrides: Partial<OperationalStatusSnapshot> = {}): OperationalStatusSnapshot {
  return {
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
    ...overrides,
  };
}

function expectInvalid(run: () => unknown): void {
  assert.throws(run, (error: unknown) => error instanceof OperationalStatusError && error.code === "OPERATIONAL_STATUS_INVALID");
}

test("FEAT-023-C preserves independent exact Health and Readiness vocabularies", () => {
  const valid = validateOperationalStatusSnapshot(snapshot());
  assert.equal(valid.health, "HEALTHY");
  assert.equal(valid.readiness, "NOT_READY");
  assert.equal(Object.isFrozen(valid), true);
  for (const health of ["FAILED", "READY", "healthy"]) expectInvalid(() => validateOperationalStatusSnapshot(snapshot({ health: health as never })));
  for (const readiness of ["HEALTHY", "FAILED", "ready"]) expectInvalid(() => validateOperationalStatusSnapshot(snapshot({ readiness: readiness as never })));
  expectInvalid(() => validateOperationalStatusSnapshot({ ...snapshot(), authorized: true }));
});

test("FEAT-023-C derives UNKNOWN without a threshold and never invents a freshness TTL", () => {
  assert.equal(deriveEvidenceFreshness("2026-09-09T01:00:00.000Z", "2026-09-09T01:05:00.000Z", null), "UNKNOWN");
  const { freshnessThresholdMs: omitted, ...withoutThreshold } = statusRequest();
  void omitted;
  assert.equal(validateOperationalStatusProjectionRequest(withoutThreshold).freshnessThresholdMs, null);
  assert.equal(validateOperationalStatusProjectionRequest({ ...statusRequest(), freshnessThresholdMs: undefined }).freshnessThresholdMs, null);
  assert.equal(validateOperationalStatusSnapshot(snapshot()).freshness, "UNKNOWN");
  expectInvalid(() => validateOperationalStatusSnapshot(snapshot({ freshness: "FRESH" })));
});

function statusRequest(overrides: Partial<OperationalStatusProjectionRequest> = {}): OperationalStatusProjectionRequest {
  return {
    statusSnapshotId: "status-snapshot:001",
    telemetryEventId: "telemetry:evt-001",
    health: "HEALTHY",
    readiness: "READY",
    evaluatedAt: "2026-09-09T01:05:00.000Z",
    freshnessThresholdMs: null,
    ...overrides,
  };
}

test("FEAT-023-C derives freshness deterministically from an explicit approved threshold", () => {
  assert.equal(deriveEvidenceFreshness("2026-09-09T01:00:00.000Z", "2026-09-09T01:05:00.000Z", 300_000), "FRESH");
  assert.equal(deriveEvidenceFreshness("2026-09-09T01:00:00.000Z", "2026-09-09T01:05:00.001Z", 300_000), "STALE");
  assert.equal(validateOperationalStatusSnapshot(snapshot({ freshness: "FRESH", freshnessThresholdMs: 300_000 })).freshness, "FRESH");
  expectInvalid(() => deriveEvidenceFreshness("2026-09-09T01:05:00.000Z", "2026-09-09T01:00:00.000Z", 300_000));
  expectInvalid(() => deriveEvidenceFreshness("2026-09-09T01:00:00.000Z", "2026-09-09T01:05:00.000Z", 0));
  expectInvalid(() => validateOperationalStatusSnapshot(snapshot({ freshness: "STALE", freshnessThresholdMs: 300_000 })));
});
