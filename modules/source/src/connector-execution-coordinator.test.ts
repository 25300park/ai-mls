import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableConnectorExecutionUnitOfWork } from "./connector-durable-persistence.js";
import { ConnectorExecutionCoordinator } from "./connector-execution-coordinator.js";
import type { ConnectorInvocationPort, ConnectorInvocationRequest, ConnectorInvocationResponse } from "./connector-invocation-port.js";
import type { SourceIngestionAdmissionDecision } from "./source-ingestion-admission.js";
import type { SourceIngestionAdmissionInput } from "./source-ingestion-admission.js";

const eligible: Extract<SourceIngestionAdmissionDecision, { readonly status: "ELIGIBLE" }> = Object.freeze({
  status: "ELIGIBLE",
  tenantId: "tenant-f18-c",
  scope: Object.freeze({ scopeType: "TEAM", scopeId: "team-f18-c" }),
  sourceId: "source-f18-c",
  sourcePolicyVersion: 3,
  connectorId: "connector-f18-c",
  connectorVersion: 5,
  method: "CONNECTOR",
  purpose: "LISTING_DISCOVERY",
});
const blocked: SourceIngestionAdmissionDecision = Object.freeze({ status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
const scope = Object.freeze({ tenantId: eligible.tenantId, scopeType: eligible.scope.scopeType, scopeId: eligible.scope.scopeId, sourceId: eligible.sourceId, connectorId: eligible.connectorId });
const admissionInput = Object.freeze({}) as SourceIngestionAdmissionInput;

function input(overrides: Readonly<Record<string, unknown>> = {}) {
  return Object.freeze({
    admissionInput,
    leaseId: "lease-f18-c-coordinator",
    leaseOwnerId: "worker-f18-c",
    leaseAcquiredAt: "2026-09-01T00:00:00.000Z",
    leaseExpiresAt: "2026-09-01T00:05:00.000Z",
    expectedScopeRevision: 0,
    invocationId: "invocation-f18-c-coordinator",
    idempotencyKey: "test-1",
    inputFingerprint: "fingerprint-f18-c-coordinator",
    inputReference: "safe-input-reference-f18-c",
    inputVersion: 4,
    expectedCheckpointVersion: 0,
    preparedAt: "2026-09-01T00:00:01.000Z",
    startedAt: "2026-09-01T00:00:02.000Z",
    completedAt: "2026-09-01T00:00:03.000Z",
    ...overrides,
  });
}

function withStore(run: (store: DurableConnectorExecutionUnitOfWork, databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f18-c-coordinator-"));
  const databasePath = join(directory, "connector.sqlite");
  let failure: unknown;
  try {
    const store = new DurableConnectorExecutionUnitOfWork({ databasePath });
    run(store, databasePath);
  } catch (error) { failure = error; }
  try { rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); }
  catch (cleanupError) { if (failure === undefined) throw cleanupError; }
  if (failure !== undefined) throw failure instanceof Error ? failure : new Error("Unexpected test failure.");
}

class DeterministicConnectorTestAdapter implements ConnectorInvocationPort {
  public invocationCount = 0;

  public constructor(private readonly behavior: Readonly<{
    readonly outcome: ConnectorInvocationResponse["outcome"] | "THROW";
    readonly safeEvidenceReference: string;
    readonly reasonCode?: string;
    readonly checkpointReference?: string;
    readonly onInvoke?: (request: ConnectorInvocationRequest) => void;
  }>) {}

  public invoke(request: ConnectorInvocationRequest): ConnectorInvocationResponse {
    this.invocationCount += 1;
    this.behavior.onInvoke?.(request);
    if (this.behavior.outcome === "THROW") throw new Error("deterministic connector test failure");
    return Object.freeze({
      outcome: this.behavior.outcome,
      reasonCode: this.behavior.reasonCode ?? (this.behavior.outcome === "SUCCEEDED" ? "CONFIRMED" : this.behavior.outcome === "FAILED" ? "TECHNICAL_FAILURE" : "OUTCOME_UNPROVEN"),
      safeEvidenceReference: this.behavior.safeEvidenceReference,
      ...(this.behavior.checkpointReference === undefined ? {} : { checkpointReference: this.behavior.checkpointReference }),
    });
  }
}

function coordinator(
  store: DurableConnectorExecutionUnitOfWork,
  connector: ConnectorInvocationPort,
  decision: SourceIngestionAdmissionDecision = eligible,
): ConnectorExecutionCoordinator {
  return new ConnectorExecutionCoordinator({ persistence: store, connector, admission: { evaluate: () => decision } });
}

test("F18-C blocked admission creates zero lease, invocation, checkpoint, evidence, and connector call", () => withStore((store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const execution = coordinator(store, adapter, blocked);

  assert.deepEqual(execution.execute(input()), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
  assert.equal(adapter.invocationCount, 0);
  assert.equal(store.findLease(scope), undefined);
  assert.equal(store.findInvocation(scope, "invocation-f18-c-coordinator"), undefined);
  assert.equal(store.findCheckpoint(scope), undefined);
  assert.deepEqual(store.listEvidence(scope), []);
  store.close();
}));

test("F18-C commits intent and EXECUTION_STARTED before invoking the connector with exact bindings", () => withStore((store) => {
  const adapter = new DeterministicConnectorTestAdapter({
    outcome: "SUCCEEDED",
    safeEvidenceReference: "safe-evidence",
    checkpointReference: "checkpoint-1",
    onInvoke: (request) => {
      assert.equal(store.findInvocation(scope, request.invocationId)?.state, "AMBIGUOUS");
      assert.deepEqual(store.listEvidence(scope).map((item) => item.kind), ["INTENT_PREPARED", "EXECUTION_STARTED"]);
      assert.deepEqual(request, {
        ...scope,
        invocationId: "invocation-f18-c-coordinator",
        inputReference: "safe-input-reference-f18-c",
        inputVersion: 4,
        sourcePolicyVersion: 3,
        connectorVersion: 5,
      });
    },
  });
  const result = coordinator(store, adapter).execute(input());
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(adapter.invocationCount, 1);
  store.close();
}));

test("F18-C authoritative success atomically records result, idempotency, evidence, and checkpoint", () => withStore((store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const result = coordinator(store, adapter).execute(input());
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(store.findCheckpoint(scope)?.checkpointReference, "checkpoint-1");
  assert.equal(store.findIdempotency(scope, "test-1")?.resultId, result.resultId);
  assert.equal(store.listEvidence(scope).at(-1)?.kind, "RESULT_RECORDED");
  store.close();
}));

test("F18-C failure is durable but cannot advance checkpoint", () => withStore((store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "safe-failure-evidence", reasonCode: "TECHNICAL_FAILURE" });
  const result = coordinator(store, adapter).execute(input());
  assert.equal(result.status, "FAILED");
  assert.equal(store.findInvocation(scope, "invocation-f18-c-coordinator")?.state, "FAILED");
  assert.equal(store.findCheckpoint(scope), undefined);
  store.close();
}));

test("F18-C UNKNOWN or thrown result remains AMBIGUOUS and never advances checkpoint", () => {
  for (const behavior of ["UNKNOWN", "THROW"] as const) withStore((store) => {
    const adapter = new DeterministicConnectorTestAdapter({ outcome: behavior, safeEvidenceReference: "safe-unknown-evidence" });
    const result = coordinator(store, adapter).execute(input());
    assert.equal(result.status, "AMBIGUOUS", behavior);
    assert.equal(store.findCheckpoint(scope), undefined, behavior);
    store.close();
  });
});

test("F18-C reconstructs unsafe connector evidence as bounded UNKNOWN without raw leakage", () => withStore((store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "Bearer unsafe-token", checkpointReference: "checkpoint-1" });
  const result = coordinator(store, adapter).execute(input());
  const serialized = JSON.stringify(store.findInvocation(scope, "invocation-f18-c-coordinator"));
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(serialized.includes("unsafe-token"), false);
  assert.equal(serialized.includes("Bearer"), false);
  assert.equal(store.findCheckpoint(scope), undefined);
  store.close();
}));

test("F18-C exact idempotent replay returns the durable prior result with zero duplicate call", () => withStore((store) => {
  const firstAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const first = coordinator(store, firstAdapter).execute(input());
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "must-not-run" });
  const replay = coordinator(store, replayAdapter).execute(input({ expectedScopeRevision: 1 }));
  assert.deepEqual(replay, first);
  assert.equal(replayAdapter.invocationCount, 0);
  store.close();
}));

test("F18-C restart after EXECUTION_STARTED has zero blind resend and conflicting payload fails closed", () => withStore((store, databasePath) => {
  store.acquireLease({ ...scope, leaseId: "lease-f18-c-coordinator", ownerId: "worker-f18-c", acquiredAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-09-01T00:05:00.000Z", expectedScopeRevision: 0 });
  store.prepareInvocation({ ...scope, invocationId: "invocation-f18-c-coordinator", leaseId: "lease-f18-c-coordinator", idempotencyKey: "test-1", inputFingerprint: "fingerprint-f18-c-coordinator", inputReference: "safe-input-reference-f18-c", inputVersion: 4, sourcePolicyVersion: 3, connectorVersion: 5, expectedCheckpointVersion: 0, preparedAt: "2026-09-01T00:00:01.000Z" });
  store.markExecutionStarted(scope, "invocation-f18-c-coordinator", "2026-09-01T00:00:02.000Z");
  store.close();

  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "must-not-run", checkpointReference: "must-not-run" });
  const execution = coordinator(reopened, adapter);
  assert.deepEqual(execution.execute(input({ expectedScopeRevision: 1 })), { status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: "invocation-f18-c-coordinator" });
  assert.equal(adapter.invocationCount, 0);
  assert.throws(() => execution.execute(input({ expectedScopeRevision: 1, inputFingerprint: "conflicting-fingerprint" })), { code: "IDEMPOTENCY_CONFLICT" });
  assert.equal(adapter.invocationCount, 0);
  reopened.close();
}));
