import assert from "node:assert/strict";
import test from "node:test";

import {
  OperationalEvidenceError,
  validateOperationalTelemetryRecord,
  type OperationalTelemetryRecord,
} from "./operational-telemetry-contracts.js";

const publicationRef = `publication:sha256:${"a".repeat(64)}`;

const record: OperationalTelemetryRecord = {
  telemetryEventId: "telemetry:evt-001",
  eventType: "CONNECTOR_EXECUTION_OBSERVED",
  component: "CONNECTOR_RUNTIME",
  operation: "EXECUTE_CONNECTOR",
  resourceType: "CONNECTOR",
  resourceRef: `connector:sha256:${"b".repeat(64)}`,
  outcome: "COMPLETED",
  safeErrorCode: null,
  correlationId: "correlation:001",
  evidenceRefs: ["evidence:connector:001"],
  occurredAt: "2026-09-09T01:00:00.000Z",
  invocationId: "invocation:001",
};

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof OperationalEvidenceError && error.code === code);
}

test("FEAT-023-B accepts only the canonical record and returns a deeply immutable copy", () => {
  const accepted = validateOperationalTelemetryRecord(record);
  assert.deepEqual(accepted, record);
  assert.notEqual(accepted, record);
  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(Object.isFrozen(accepted.evidenceRefs), true);
});

test("FEAT-023-B rejects missing required fields and unknown top-level fields", () => {
  const { operation: _operation, ...missing } = record;
  void _operation;
  expectCode(() => validateOperationalTelemetryRecord(missing), "TELEMETRY_INPUT_INVALID");
  expectCode(() => validateOperationalTelemetryRecord({ ...record, rawResponse: "not-allowed" }), "TELEMETRY_INPUT_INVALID");
});

test("FEAT-023-B rejects secret, PII, raw-body and unbounded telemetry content", () => {
  expectCode(() => validateOperationalTelemetryRecord({ ...record, resourceRef: "person@example.com" }), "TELEMETRY_UNSAFE_CONTENT");
  expectCode(() => validateOperationalTelemetryRecord({ ...record, evidenceRefs: ["token:NON_SECRET_TEST_VALUE"] }), "TELEMETRY_UNSAFE_CONTENT");
  expectCode(() => validateOperationalTelemetryRecord({ ...record, evidenceRefs: [JSON.stringify({ body: "raw" })] }), "TELEMETRY_UNSAFE_CONTENT");
  expectCode(() => validateOperationalTelemetryRecord({ ...record, evidenceRefs: Array.from({ length: 17 }, (_, index) => `evidence:${String(index)}`) }), "TELEMETRY_INPUT_INVALID");
  for (const resourceRef of ["Jane.Doe", "5551234567", "DROP/TABLE/users", "C:/Users/Pc/operations.sqlite", "secret:NON_SECRET_TEST_VALUE"]) {
    assert.throws(() => validateOperationalTelemetryRecord({ ...record, resourceRef }), OperationalEvidenceError);
  }
  for (const [resourceType, resourceRef] of [["CONTACT", "contact:5551234567"], ["PERSON", "person:Jane.Doe1"], ["PUBLICATION", "publication:DROP_TABLE_users1"], ["PUBLICATION", "publication:rawMessage1"]] as const) {
    assert.throws(() => validateOperationalTelemetryRecord({ ...record, resourceType, resourceRef }), OperationalEvidenceError);
  }
  assert.equal(validateOperationalTelemetryRecord({ ...record, resourceType: "PUBLICATION", resourceRef: publicationRef }).resourceRef, publicationRef);
});

test("FEAT-023-B rejects malformed categories, identifiers and timestamps", () => {
  expectCode(() => validateOperationalTelemetryRecord({ ...record, component: "connector runtime" }), "TELEMETRY_INPUT_INVALID");
  expectCode(() => validateOperationalTelemetryRecord({ ...record, correlationId: "header=value" }), "TELEMETRY_UNSAFE_CONTENT");
  expectCode(() => validateOperationalTelemetryRecord({ ...record, occurredAt: "2026-09-09" }), "TELEMETRY_INPUT_INVALID");
});
