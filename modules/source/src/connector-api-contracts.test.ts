import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECTOR_API_COMMAND_OPERATIONS,
  CONNECTOR_API_HTTP_OPERATIONS,
  CONNECTOR_API_INTERNAL_OPERATIONS,
  CONNECTOR_API_OPERATIONS,
  CONNECTOR_API_QUERY_OPERATIONS,
  parseConnectorApiRequest,
} from "./connector-api-contracts.js";

test("F18-D exposes exactly the approved eight API-018 operations with seven HTTP and one internal", () => {
  assert.deepEqual(CONNECTOR_API_OPERATIONS, [
    "RegisterConnectorInstance", "SubmitCaptureBatch", "AdvanceCheckpoint", "LeaseApprovedDelivery",
    "ReportDeliveryAttempt", "SubmitExternalObservation", "ReportHealth", "ReadBatchStatus",
  ]);
  assert.deepEqual(CONNECTOR_API_COMMAND_OPERATIONS, [
    "RegisterConnectorInstance", "SubmitCaptureBatch", "AdvanceCheckpoint", "LeaseApprovedDelivery",
    "ReportDeliveryAttempt", "SubmitExternalObservation", "ReportHealth",
  ]);
  assert.deepEqual(CONNECTOR_API_QUERY_OPERATIONS, ["ReadBatchStatus"]);
  assert.deepEqual(CONNECTOR_API_INTERNAL_OPERATIONS, ["AdvanceCheckpoint"]);
  assert.deepEqual(CONNECTOR_API_HTTP_OPERATIONS, [
    "RegisterConnectorInstance", "SubmitCaptureBatch", "LeaseApprovedDelivery",
    "ReportDeliveryAttempt", "SubmitExternalObservation", "ReportHealth", "ReadBatchStatus",
  ]);
});

test("F18-D parses each approved closed operation and deeply freezes the canonical request", () => {
  const requests = [
    { kind: "COMMAND" as const, request: { operation: "RegisterConnectorInstance", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", expectedVersion: 0, idempotencyKey: "test-1" } },
    { kind: "COMMAND" as const, request: { operation: "SubmitCaptureBatch", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", batchId: "batch-1", invocationId: "invocation-1", expectedVersion: 0, idempotencyKey: "test-2", captureItemEvidenceRefs: ["evidence:item:1"] } },
    { kind: "COMMAND" as const, request: { operation: "AdvanceCheckpoint", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", invocationId: "invocation-1", priorCheckpointVersion: 0, checkpointCandidate: "checkpoint:1", evidenceReference: "evidence:checkpoint:1" } },
    { kind: "COMMAND" as const, request: { operation: "LeaseApprovedDelivery", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", deliveryAttemptId: "attempt-1", expectedVersion: 0, idempotencyKey: "test-3" } },
    { kind: "COMMAND" as const, request: { operation: "ReportDeliveryAttempt", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", deliveryAttemptId: "attempt-1", leaseId: "lease-1", invocationId: "invocation-1", outcome: "FAILED", reasonCode: "TECHNICAL_FAILURE", idempotencyKey: "test-4", expectedVersion: 0 } },
    { kind: "COMMAND" as const, request: { operation: "SubmitExternalObservation", sessionId: "session-1", integrationContractId: "contract-1", connectorId: "connector-1", sourceId: "source-1", observationId: "observation-1", providerNamespace: "provider-1", externalObjectId: "external-1", observationType: "STATUS", normalizedFields: { active: true }, observedAt: "2026-09-01T00:00:00.000Z", idempotencyKey: "test-5", expectedVersion: 0 } },
    { kind: "COMMAND" as const, request: { operation: "ReportHealth", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", observedAt: "2026-09-01T00:00:00.000Z", healthStatus: "HEALTHY", reasonCodes: ["CONNECTOR_READY"], expectedVersion: 0, idempotencyKey: "test-6" } },
    { kind: "QUERY" as const, request: { operation: "ReadBatchStatus", sessionId: "session-1", batchId: "batch-1", connectorId: "connector-1", sourceId: "source-1" } },
  ];
  for (const item of requests) {
    const parsed = parseConnectorApiRequest(item.kind, item.request);
    assert.equal(parsed.operation, item.request.operation);
    assert.equal(Object.isFrozen(parsed), true);
  }
});

test("F18-D rejects unknown operations, wrong command/query classification, and public AdvanceCheckpoint", () => {
  assert.throws(() => parseConnectorApiRequest("COMMAND", { operation: "UnknownConnectorOperation" }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseConnectorApiRequest("QUERY", { operation: "ReportHealth" }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseConnectorApiRequest("HTTP_COMMAND", { operation: "AdvanceCheckpoint" }), { code: "VALIDATION_FAILED" });
});

test("F18-D rejects unknown and body-authored authority fields", () => {
  const valid = { operation: "RegisterConnectorInstance", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", expectedVersion: 0, idempotencyKey: "test-1" };
  for (const field of ["actorId", "tenantId", "teamId", "scope", "purpose", "credentials", "providerPayload", "unknownField"]) {
    assert.throws(() => parseConnectorApiRequest("COMMAND", { ...valid, [field]: "forged" }), { code: "VALIDATION_FAILED" }, field);
  }
});

test("F18-D rejects malformed identifiers, unbounded references, arrays, and raw diagnostic data", () => {
  assert.throws(() => parseConnectorApiRequest("COMMAND", { operation: "RegisterConnectorInstance", sessionId: "session-1", connectorId: " ", instanceId: "instance-1", expectedVersion: 0, idempotencyKey: "test-1" }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseConnectorApiRequest("COMMAND", { operation: "SubmitCaptureBatch", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", batchId: "batch-1", invocationId: "invocation-1", expectedVersion: 0, idempotencyKey: "test-2", captureItemEvidenceRefs: Array.from({ length: 65 }, (_, index) => `evidence:${index}`) }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseConnectorApiRequest("COMMAND", { operation: "ReportHealth", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", observedAt: "2026-09-01T00:00:00.000Z", healthStatus: "HEALTHY", reasonCodes: ["Bearer unsafe-token"], expectedVersion: 0, idempotencyKey: "test-6" }), { code: "VALIDATION_FAILED" });
});
