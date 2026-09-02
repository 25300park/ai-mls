import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { DurableConnectorExecutionUnitOfWork } from "./connector-durable-persistence.js";

const scope = Object.freeze({
  tenantId: "tenant-f18-c",
  scopeType: "TEAM" as const,
  scopeId: "team-f18-c",
  sourceId: "source-f18-c",
  connectorId: "connector-f18-c",
});

function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f18-c-"));
  let failure: unknown;
  try { run(join(directory, "connector.sqlite")); }
  catch (error) { failure = error; }
  try { rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); }
  catch (cleanupError) { if (failure === undefined) throw cleanupError; }
  if (failure !== undefined) throw failure instanceof Error ? failure : new Error("Unexpected test failure.");
}

function leaseInput(now = "2026-09-01T00:00:00.000Z") {
  return Object.freeze({
    ...scope,
    leaseId: "lease-f18-c-1",
    ownerId: "worker-f18-c-1",
    acquiredAt: now,
    expiresAt: "2026-09-01T00:05:00.000Z",
    expectedScopeRevision: 0,
  });
}

function intentInput() {
  return Object.freeze({
    ...scope,
    invocationId: "invocation-f18-c-1",
    leaseId: "lease-f18-c-1",
    idempotencyKey: "test-1",
    inputFingerprint: "fingerprint-f18-c-1",
    inputReference: "safe-input-reference-f18-c-1",
    inputVersion: 4,
    sourcePolicyVersion: 3,
    connectorVersion: 5,
    expectedCheckpointVersion: 0,
    preparedAt: "2026-09-01T00:00:01.000Z",
  });
}

test("F18-C requires an explicit durable file path", () => {
  assert.throws(() => new DurableConnectorExecutionUnitOfWork({ databasePath: "" }), { code: "PERSISTENCE_INPUT_INVALID" });
  assert.throws(() => new DurableConnectorExecutionUnitOfWork({ databasePath: ":memory:" }), { code: "PERSISTENCE_INPUT_INVALID" });
});

test("F18-C persists lease, intent, started state, result, idempotency, checkpoint, and evidence across reopen", () => withDatabase((databasePath) => {
  const first = new DurableConnectorExecutionUnitOfWork({ databasePath });
  first.acquireLease(leaseInput());
  first.prepareInvocation(intentInput());
  first.markExecutionStarted(scope, "invocation-f18-c-1", "2026-09-01T00:00:02.000Z");
  first.completeInvocation({
    ...scope,
    invocationId: "invocation-f18-c-1",
    resultId: "result-f18-c-1",
    outcome: "SUCCEEDED",
    reasonCode: "CONFIRMED",
    safeEvidenceReference: "safe-evidence-f18-c-1",
    checkpointReference: "checkpoint-reference-f18-c-1",
    completedAt: "2026-09-01T00:00:03.000Z",
  });
  first.close();

  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  assert.equal(reopened.findLease(scope)?.status, "ACTIVE");
  assert.equal(reopened.findInvocation(scope, "invocation-f18-c-1")?.state, "SUCCEEDED");
  assert.equal(reopened.findCheckpoint(scope)?.version, 1);
  assert.equal(reopened.findIdempotency(scope, "test-1")?.resultId, "result-f18-c-1");
  assert.deepEqual(reopened.listEvidence(scope).map((item) => item.kind), ["INTENT_PREPARED", "EXECUTION_STARTED", "RESULT_RECORDED"]);
  reopened.close();
}));

test("F18-C rejects conflicting active lease and permits expiry or explicit release before reacquire", () => withDatabase((databasePath) => {
  const store = new DurableConnectorExecutionUnitOfWork({ databasePath });
  store.acquireLease(leaseInput());
  assert.throws(() => store.acquireLease({ ...leaseInput(), leaseId: "lease-f18-c-2", ownerId: "worker-f18-c-2", expectedScopeRevision: 1 }), { code: "LEASE_CONFLICT" });
  store.releaseLease(scope, "lease-f18-c-1", 1, "2026-09-01T00:00:10.000Z");
  assert.equal(store.findLease(scope)?.status, "RELEASED");
  const second = store.acquireLease({ ...leaseInput(), leaseId: "lease-f18-c-2", ownerId: "worker-f18-c-2", expectedScopeRevision: 2 });
  assert.equal(second.version, 1);
  store.expireLeases("2026-09-01T00:06:00.000Z");
  assert.equal(store.findLease(scope)?.status, "EXPIRED");
  store.close();
}));

test("F18-F active and expired lease states remain authoritative across reopen", () => withDatabase((databasePath) => {
  const first = new DurableConnectorExecutionUnitOfWork({ databasePath });
  first.acquireLease(leaseInput());
  first.close();

  const active = new DurableConnectorExecutionUnitOfWork({ databasePath });
  assert.equal(active.findLease(scope)?.status, "ACTIVE");
  assert.throws(() => active.acquireLease({ ...leaseInput(), leaseId: "lease-f18-f-conflict", ownerId: "worker-f18-f-conflict", expectedScopeRevision: 1 }), { code: "LEASE_CONFLICT" });
  active.expireLeases("2026-09-01T00:06:00.000Z");
  active.close();

  const expired = new DurableConnectorExecutionUnitOfWork({ databasePath });
  assert.equal(expired.findLease(scope)?.status, "EXPIRED");
  expired.close();
}));

test("F18-C rejects invocation identity, idempotency fingerprint, and stale checkpoint conflicts", () => withDatabase((databasePath) => {
  const store = new DurableConnectorExecutionUnitOfWork({ databasePath });
  store.acquireLease(leaseInput());
  store.prepareInvocation(intentInput());
  assert.throws(() => store.prepareInvocation({ ...intentInput(), inputFingerprint: "different-fingerprint" }), { code: "IDEMPOTENCY_CONFLICT" });
  assert.throws(() => store.prepareInvocation({ ...intentInput(), invocationId: "invocation-f18-c-2" }), { code: "IDEMPOTENCY_CONFLICT" });
  store.markExecutionStarted(scope, "invocation-f18-c-1", "2026-09-01T00:00:02.000Z");
  assert.throws(() => store.completeInvocation({
    ...scope,
    invocationId: "invocation-f18-c-1",
    resultId: "result-f18-c-1",
    outcome: "SUCCEEDED",
    reasonCode: "CONFIRMED",
    safeEvidenceReference: "safe-evidence-f18-c-1",
    checkpointReference: "checkpoint-reference-f18-c-1",
    expectedCheckpointVersion: 1,
    completedAt: "2026-09-01T00:00:03.000Z",
  }), { code: "CHECKPOINT_VERSION_CONFLICT" });
  assert.equal(store.findCheckpoint(scope), undefined);
  assert.equal(store.findInvocation(scope, "invocation-f18-c-1")?.state, "AMBIGUOUS");
  store.close();
}));

test("F18-C keeps failed or ambiguous execution from advancing checkpoint", () => withDatabase((databasePath) => {
  const store = new DurableConnectorExecutionUnitOfWork({ databasePath });
  store.acquireLease(leaseInput());
  store.prepareInvocation(intentInput());
  store.markExecutionStarted(scope, "invocation-f18-c-1", "2026-09-01T00:00:02.000Z");
  store.completeInvocation({
    ...scope,
    invocationId: "invocation-f18-c-1",
    resultId: "result-f18-c-1",
    outcome: "FAILED",
    reasonCode: "TECHNICAL_FAILURE",
    safeEvidenceReference: "safe-evidence-f18-c-1",
    completedAt: "2026-09-01T00:00:03.000Z",
  });
  assert.equal(store.findCheckpoint(scope), undefined);
  assert.equal(store.findInvocation(scope, "invocation-f18-c-1")?.state, "FAILED");
  store.close();
}));

test("F18-C exposes EXECUTION_STARTED without a receipt as AMBIGUOUS after restart", () => withDatabase((databasePath) => {
  const first = new DurableConnectorExecutionUnitOfWork({ databasePath });
  first.acquireLease(leaseInput());
  first.prepareInvocation(intentInput());
  first.markExecutionStarted(scope, "invocation-f18-c-1", "2026-09-01T00:00:02.000Z");
  first.close();
  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const invocation = reopened.findInvocation(scope, "invocation-f18-c-1");
  assert.equal(invocation?.state, "AMBIGUOUS");
  assert.equal(invocation?.result, undefined);
  reopened.close();
}));

test("F18-C append-only result and evidence reject replacement while exact replay is stable", () => withDatabase((databasePath) => {
  const store = new DurableConnectorExecutionUnitOfWork({ databasePath });
  store.acquireLease(leaseInput());
  const first = store.prepareInvocation(intentInput());
  const replay = store.prepareInvocation(intentInput());
  assert.deepEqual(replay, first);
  store.markExecutionStarted(scope, "invocation-f18-c-1", "2026-09-01T00:00:02.000Z");
  store.completeInvocation({
    ...scope,
    invocationId: "invocation-f18-c-1",
    resultId: "result-f18-c-1",
    outcome: "FAILED",
    reasonCode: "TECHNICAL_FAILURE",
    safeEvidenceReference: "safe-evidence-f18-c-1",
    completedAt: "2026-09-01T00:00:03.000Z",
  });
  assert.throws(() => store.completeInvocation({
    ...scope,
    invocationId: "invocation-f18-c-1",
    resultId: "result-f18-c-2",
    outcome: "SUCCEEDED",
    reasonCode: "CONFIRMED",
    safeEvidenceReference: "replacement-evidence",
    checkpointReference: "replacement-checkpoint",
    completedAt: "2026-09-01T00:00:04.000Z",
  }), { code: "RESULT_CONFLICT" });
  assert.equal(store.listEvidence(scope).length, 3);
  store.close();
  const raw = new DatabaseSync(databasePath);
  assert.throws(() => raw.exec("UPDATE connector_results SET outcome = 'SUCCEEDED'"));
  assert.throws(() => raw.exec("UPDATE connector_evidence SET kind = 'RESULT_RECORDED'"));
  assert.throws(() => raw.exec("DELETE FROM connector_results"));
  assert.throws(() => raw.exec("DELETE FROM connector_evidence"));
  raw.close();
}));
