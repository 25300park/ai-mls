import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import { adaptSynchronousConnectorPersistence } from "./connector-async-persistence.js";
import { DurableConnectorExecutionUnitOfWork } from "./connector-durable-persistence.js";
import type { ConnectorExecutionInput } from "./connector-execution-coordinator.js";
import { ConnectorRuntimeApplication, type ConnectorTrustedRuntimeContext } from "./connector-runtime-application.js";

const now = "2026-09-01T00:00:00.000Z";
const session: SessionContext = Object.freeze({ id: "session-1", principalId: "service-1", principalType: "SERVICE", roles: Object.freeze(["SVC"] as const), teamId: "team-1", state: "ACTIVE", assurance: "WORKLOAD", isMfaVerified: false, authenticatedAt: now, expiresAt: "2026-09-01T01:00:00.000Z", absoluteExpiresAt: "2026-09-01T02:00:00.000Z", familyId: "family-1", refreshReference: "non-sensitive-reference" });
const context: ConnectorTrustedRuntimeContext = Object.freeze({ session, tenantId: "tenant-1", scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-1" }), sourceId: "source-1", connectorId: "connector-1", purpose: "LISTING_DISCOVERY", sourcePolicyVersion: 3, connectorVersion: 5, correlationId: "correlation-1" });

function fixture(options: Readonly<{ context?: ConnectorTrustedRuntimeContext | null; authorized?: boolean; captureStatus?: "SUCCEEDED" | "BLOCKED" }> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "f18-d-app-"));
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath: join(directory, "connector.sqlite") });
  let captureCalls = 0;
  const application = new ConnectorRuntimeApplication({
    persistence: adaptSynchronousConnectorPersistence(persistence),
    contextResolver: { resolve: () => options.context === null ? undefined : options.context ?? context },
    authorizer: { authorize: () => options.authorized ?? true },
    coordinator: { execute: (input: ConnectorExecutionInput) => { captureCalls += 1; return Promise.resolve(options.captureStatus === "BLOCKED" ? Object.freeze({ status: "BLOCKED" as const, reasonCode: "ADMISSION_DENIED" as const }) : Object.freeze({ status: "SUCCEEDED" as const, reasonCode: "CAPTURE_ACCEPTED", invocationId: input.invocationId, resultId: `${input.invocationId}:result` })); } },
    clock: () => now,
    externalObservationSink: { submit: (input) => Object.freeze({ ok: true as const, operation: "SubmitProviderObservation" as const, data: Object.freeze({ observationId: (input as Record<string, unknown>)["observationId"], mappingState: "ACTIVE", evidenceRef: "evidence:observation:1", observedAt: now }) }) },
  });
  return { application, persistence, captureCalls: () => captureCalls, close: () => { persistence.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("F18-D executes the seven HTTP operations and internal checkpoint through one application", async () => {
  const value = fixture();
  try {
    const requests = [
      ["COMMAND", { operation: "RegisterConnectorInstance", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", expectedVersion: 0, idempotencyKey: "test-1" }],
      ["COMMAND", { operation: "SubmitCaptureBatch", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", batchId: "batch-1", invocationId: "invocation-1", expectedVersion: 0, idempotencyKey: "test-2", captureItemEvidenceRefs: ["evidence:item:1"] }],
      ["QUERY", { operation: "ReadBatchStatus", sessionId: "session-1", batchId: "batch-1", connectorId: "connector-1", sourceId: "source-1" }],
      ["COMMAND", { operation: "LeaseApprovedDelivery", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", deliveryAttemptId: "delivery-1", expectedVersion: 0, idempotencyKey: "test-3" }],
      ["COMMAND", { operation: "ReportDeliveryAttempt", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", deliveryAttemptId: "delivery-1", leaseId: "delivery-1:lease", invocationId: "delivery-invocation-1", outcome: "FAILED", reasonCode: "TECHNICAL_FAILURE", expectedVersion: 1, idempotencyKey: "test-4" }],
      ["COMMAND", { operation: "SubmitExternalObservation", sessionId: "session-1", integrationContractId: "contract-1", connectorId: "connector-1", sourceId: "source-1", observationId: "observation-1", providerNamespace: "provider-1", externalObjectId: "external-1", observationType: "STATUS", normalizedFields: { active: true }, observedAt: now, expectedVersion: 0, idempotencyKey: "test-5" }],
      ["COMMAND", { operation: "ReportHealth", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", observedAt: now, healthStatus: "HEALTHY", reasonCodes: ["CONNECTOR_READY"], expectedVersion: 0, idempotencyKey: "test-6" }],
    ] as const;
    for (const [kind, request] of requests) assert.equal((await value.application.execute(kind, request)).ok, true, request.operation);
    assert.deepEqual(await value.application.execute("COMMAND", { operation: "AdvanceCheckpoint", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", invocationId: "invocation-1", priorCheckpointVersion: 0, checkpointCandidate: "checkpoint:1", evidenceReference: "evidence:checkpoint:1" }), { ok: false, error: { code: "CHECKPOINT_CONFLICT", message: "Connector checkpoint is unavailable." } });
    assert.equal(value.captureCalls(), 1);
  } finally { value.close(); }
});

test("F18-D fails closed for missing, inactive, expired, or unauthorized trusted context", async () => {
  const cases = [
    fixture({ context: null }),
    fixture({ context: Object.freeze({ ...context, session: Object.freeze({ ...session, state: "REVOKED" }) }) }),
    fixture({ context: Object.freeze({ ...context, session: Object.freeze({ ...session, expiresAt: "2026-08-31T23:59:59.000Z" }) }) }),
    fixture({ authorized: false }),
  ];
  try {
    for (const value of cases) {
      const result = await value.application.execute("COMMAND", { operation: "RegisterConnectorInstance", sessionId: "session-1", connectorId: "connector-1", instanceId: "instance-1", expectedVersion: 0, idempotencyKey: "test-1" });
      assert.equal(result.ok, false);
      assert.equal(value.persistence.findTechnicalState({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" }, "CONNECTOR_INSTANCE", "instance-1"), undefined);
    }
  } finally { for (const value of cases) value.close(); }
});

test("F18-D blocked F18-B capture admission produces zero durable batch mutation", async () => {
  const value = fixture({ captureStatus: "BLOCKED" });
  try {
    const result = await value.application.execute("COMMAND", { operation: "SubmitCaptureBatch", sessionId: "session-1", connectorId: "connector-1", sourceId: "source-1", batchId: "batch-1", invocationId: "invocation-1", expectedVersion: 0, idempotencyKey: "test-2", captureItemEvidenceRefs: ["evidence:item:1"] });
    assert.deepEqual(result, { ok: false, error: { code: "FORBIDDEN", message: "Connector operation is not permitted." } });
    assert.equal(value.persistence.findTechnicalState({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" }, "CAPTURE_BATCH", "batch-1"), undefined);
  } finally { value.close(); }
});

test("F18-D query conceals records outside trusted tenant and scope", async () => {
  const value = fixture();
  try {
    await value.application.execute("COMMAND", { operation: "SubmitExternalObservation", sessionId: "session-1", integrationContractId: "contract-1", connectorId: "connector-1", sourceId: "source-1", observationId: "observation-1", providerNamespace: "provider-1", externalObjectId: "external-1", observationType: "STATUS", normalizedFields: { active: true }, observedAt: now, expectedVersion: 0, idempotencyKey: "test-5" });
    const result = await value.application.execute("QUERY", { operation: "ReadBatchStatus", sessionId: "session-1", batchId: "observation-1", connectorId: "connector-1", sourceId: "source-1" });
    assert.deepEqual(result, { ok: false, error: { code: "NOT_FOUND", message: "Connector resource is unavailable." } });
  } finally { value.close(); }
});

test("F18-D body source or connector binding cannot override trusted runtime context", async () => {
  const value = fixture();
  try {
    const wrongSource = await value.application.execute("COMMAND", { operation: "SubmitExternalObservation", sessionId: "session-1", integrationContractId: "contract-1", connectorId: "connector-1", sourceId: "source-2", observationId: "observation-1", providerNamespace: "provider-1", externalObjectId: "external-1", observationType: "STATUS", normalizedFields: { active: true }, observedAt: now, expectedVersion: 0, idempotencyKey: "test-5" });
    const wrongConnector = await value.application.execute("COMMAND", { operation: "ReportHealth", sessionId: "session-1", connectorId: "connector-2", instanceId: "instance-1", observedAt: now, healthStatus: "HEALTHY", reasonCodes: ["CONNECTOR_READY"], expectedVersion: 0, idempotencyKey: "test-6" });
    assert.equal(wrongSource.ok, false);
    assert.equal(wrongConnector.ok, false);
    assert.equal(value.persistence.findTechnicalState({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1" }, "EXTERNAL_OBSERVATION", "observation-1"), undefined);
  } finally { value.close(); }
});

test("F18-F wrong tenant and scope cannot disclose a durable prior result", async () => {
  const otherSession = Object.freeze({ ...session, id: "session-2", teamId: "team-2" });
  const otherContext = Object.freeze({ ...context, session: otherSession, tenantId: "tenant-2", scope: Object.freeze({ scopeType: "TEAM" as const, scopeId: "team-2" }) });
  const value = fixture({ context: otherContext });
  try {
    value.persistence.recordTechnicalState({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1", recordType: "CAPTURE_BATCH", recordId: "batch-prior", status: "SUCCEEDED", expectedVersion: 0, idempotencyKey: "prior-key", inputFingerprint: "prior-fingerprint", safeEvidenceReference: "evidence:prior", recordedAt: now, bindingReference: "invocation-prior" });
    const result = await value.application.execute("QUERY", { operation: "ReadBatchStatus", sessionId: "session-2", batchId: "batch-prior", connectorId: "connector-1", sourceId: "source-1" });
    assert.deepEqual(result, { ok: false, error: { code: "NOT_FOUND", message: "Connector resource is unavailable." } });
    assert.equal(value.captureCalls(), 0);
  } finally { value.close(); }
});

test("F18-F inactive session cannot disclose a durable prior result", async () => {
  const inactiveContext = Object.freeze({ ...context, session: Object.freeze({ ...session, state: "REVOKED" as const }) });
  const value = fixture({ context: inactiveContext });
  try {
    value.persistence.recordTechnicalState({ tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1", sourceId: "source-1", connectorId: "connector-1", recordType: "CAPTURE_BATCH", recordId: "batch-prior", status: "SUCCEEDED", expectedVersion: 0, idempotencyKey: "prior-key", inputFingerprint: "prior-fingerprint", safeEvidenceReference: "evidence:prior", recordedAt: now, bindingReference: "invocation-prior" });
    const result = await value.application.execute("QUERY", { operation: "ReadBatchStatus", sessionId: "session-1", batchId: "batch-prior", connectorId: "connector-1", sourceId: "source-1" });
    assert.deepEqual(result, { ok: false, error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
    assert.equal(value.captureCalls(), 0);
  } finally { value.close(); }
});
