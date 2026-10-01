import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { adaptSynchronousConnectorPersistence } from "./connector-async-persistence.js";
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
const admissionInput = Object.freeze({
  actor: Object.freeze({}) as SourceIngestionAdmissionInput["actor"],
  tenantId: eligible.tenantId,
  scope: eligible.scope,
  sourceId: eligible.sourceId,
  sourcePolicyVersion: eligible.sourcePolicyVersion,
  connectorId: eligible.connectorId,
  connectorVersion: eligible.connectorVersion,
  method: eligible.method,
  purpose: eligible.purpose,
  correlationId: "correlation-f18-f",
}) satisfies SourceIngestionAdmissionInput;

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

async function withStore(run: (store: DurableConnectorExecutionUnitOfWork, databasePath: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f18-c-coordinator-"));
  const databasePath = join(directory, "connector.sqlite");
  let failure: unknown;
  try {
    const store = new DurableConnectorExecutionUnitOfWork({ databasePath });
    await run(store, databasePath);
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
  ambiguityCaseWriter?: Readonly<{ linkAmbiguousInvocation(input: Readonly<{ invocationId: string; tenantId: string; scopeRef: string; sourceId: string; connectorId: string; evidenceRefs: readonly string[]; createdBy: string; createdAt: string }>): void }>,
): ConnectorExecutionCoordinator {
  return new ConnectorExecutionCoordinator({ persistence: adaptSynchronousConnectorPersistence(store), connector, admission: { evaluate: () => decision }, ambiguityCaseWriter: ambiguityCaseWriter ?? { linkAmbiguousInvocation(): void { void 0; } } });
}

test("F18-C blocked admission creates zero lease, invocation, checkpoint, evidence, and connector call", async () => withStore(async (store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const execution = coordinator(store, adapter, blocked);

  assert.deepEqual(await execution.execute(input()), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
  assert.equal(adapter.invocationCount, 0);
  assert.equal(store.findLease(scope), undefined);
  assert.equal(store.findInvocation(scope, "invocation-f18-c-coordinator"), undefined);
  assert.equal(store.findCheckpoint(scope), undefined);
  assert.deepEqual(store.listEvidence(scope), []);
  store.close();
}));

test("F19-D links exactly one immutable Connector-origin recovery case for an ambiguous original invocation", async () => withStore(async (store) => {
  const linked: unknown[] = [];
  const writer = { linkAmbiguousInvocation(input: unknown) { linked.push(input); } };
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "THROW", safeEvidenceReference: "unused" });
  const execution = coordinator(store, adapter, eligible, writer);
  assert.equal((await execution.execute(input())).status, "AMBIGUOUS");
  assert.equal((await execution.execute(input({ expectedScopeRevision: 1 }))).status, "AMBIGUOUS");
  assert.equal(adapter.invocationCount, 1);
  assert.deepEqual(linked, [Object.freeze({ invocationId: "invocation-f18-c-coordinator", tenantId: "tenant-f18-c", scopeRef: "team:team-f18-c", sourceId: "source-f18-c", connectorId: "connector-f18-c", evidenceRefs: Object.freeze(["connector-invocation:invocation-f18-c-coordinator:ambiguous"]), createdBy: "worker-f18-c", createdAt: "2026-09-01T00:00:03.000Z" })]);
  store.close();
}));

test("F18-C commits intent and EXECUTION_STARTED before invoking the connector with exact bindings", async () => withStore(async (store) => {
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
  const result = await coordinator(store, adapter).execute(input());
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(adapter.invocationCount, 1);
  store.close();
}));

test("F18-C authoritative success atomically records result, idempotency, evidence, and checkpoint", async () => withStore(async (store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const result = await coordinator(store, adapter).execute(input());
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(store.findCheckpoint(scope)?.checkpointReference, "checkpoint-1");
  assert.equal(store.findIdempotency(scope, "test-1")?.resultId, result.resultId);
  assert.equal(store.listEvidence(scope).at(-1)?.kind, "RESULT_RECORDED");
  store.close();
}));

test("F18-C failure is durable but cannot advance checkpoint", async () => withStore(async (store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "safe-failure-evidence", reasonCode: "TECHNICAL_FAILURE" });
  const result = await coordinator(store, adapter).execute(input());
  assert.equal(result.status, "FAILED");
  assert.equal(store.findInvocation(scope, "invocation-f18-c-coordinator")?.state, "FAILED");
  assert.equal(store.findCheckpoint(scope), undefined);
  store.close();
}));

test("F18-C UNKNOWN or thrown result remains AMBIGUOUS and never advances checkpoint", async () => {
  for (const behavior of ["UNKNOWN", "THROW"] as const) await withStore(async (store) => {
    const adapter = new DeterministicConnectorTestAdapter({ outcome: behavior, safeEvidenceReference: "safe-unknown-evidence" });
    const result = await coordinator(store, adapter).execute(input());
    assert.equal(result.status, "AMBIGUOUS", behavior);
    assert.equal(store.findCheckpoint(scope), undefined, behavior);
    store.close();
  });
});

test("F18-C reconstructs unsafe connector evidence as bounded UNKNOWN without raw leakage", async () => withStore(async (store) => {
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "Bearer unsafe-token", checkpointReference: "checkpoint-1" });
  const result = await coordinator(store, adapter).execute(input());
  const serialized = JSON.stringify(store.findInvocation(scope, "invocation-f18-c-coordinator"));
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(serialized.includes("unsafe-token"), false);
  assert.equal(serialized.includes("Bearer"), false);
  assert.equal(store.findCheckpoint(scope), undefined);
  store.close();
}));

test("F18-C exact idempotent replay returns the durable prior result with zero duplicate call", async () => withStore(async (store) => {
  const firstAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const first = await coordinator(store, firstAdapter).execute(input());
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "must-not-run" });
  const replay = await coordinator(store, replayAdapter).execute(input({ expectedScopeRevision: 1 }));
  assert.deepEqual(replay, first);
  assert.equal(replayAdapter.invocationCount, 0);
  store.close();
}));

test("F18-F completed exact replay bypasses blocked execution admission without new effects", async () => withStore(async (store, databasePath) => {
  const firstAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  const first = await coordinator(store, firstAdapter).execute(input());
  const originalLease = store.findLease(scope);
  store.close();

  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "must-not-run" });
  const replay = await coordinator(reopened, replayAdapter, blocked).execute(input({ expectedScopeRevision: 1 }));
  assert.deepEqual(replay, first);
  assert.equal(replayAdapter.invocationCount, 0);
  assert.equal(reopened.findCheckpoint(scope)?.version, 1);
  assert.deepEqual(reopened.findLease(scope), originalLease);
  reopened.close();
}));

test("F18-F ambiguous exact replay bypasses blocked execution admission without blind rerun", async () => withStore(async (store, databasePath) => {
  store.acquireLease({ ...scope, leaseId: "lease-f18-c-coordinator", ownerId: "worker-f18-c", acquiredAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-09-01T00:05:00.000Z", expectedScopeRevision: 0 });
  store.prepareInvocation({ ...scope, invocationId: "invocation-f18-c-coordinator", leaseId: "lease-f18-c-coordinator", idempotencyKey: "test-1", inputFingerprint: "fingerprint-f18-c-coordinator", inputReference: "safe-input-reference-f18-c", inputVersion: 4, sourcePolicyVersion: 3, connectorVersion: 5, expectedCheckpointVersion: 0, preparedAt: "2026-09-01T00:00:01.000Z" });
  store.markExecutionStarted(scope, "invocation-f18-c-coordinator", "2026-09-01T00:00:02.000Z");
  store.close();

  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "must-not-run", checkpointReference: "must-not-run" });
  const replay = await coordinator(reopened, replayAdapter, blocked).execute(input({ expectedScopeRevision: 1 }));
  assert.deepEqual(replay, { status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: "invocation-f18-c-coordinator" });
  assert.equal(replayAdapter.invocationCount, 0);
  assert.equal(reopened.findCheckpoint(scope), undefined);
  reopened.close();
}));

test("F18-F conflicting replay fingerprint fails before admission and mutation", async () => withStore(async (store) => {
  const firstAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  await coordinator(store, firstAdapter).execute(input());
  const evidenceBefore = store.listEvidence(scope);
  const leaseBefore = store.findLease(scope);
  const checkpointBefore = store.findCheckpoint(scope);
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "must-not-run" });

  await assert.rejects(
    coordinator(store, replayAdapter, blocked).execute(input({ expectedScopeRevision: 1, inputFingerprint: "conflicting-fingerprint" })),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  assert.equal(replayAdapter.invocationCount, 0);
  assert.deepEqual(store.listEvidence(scope), evidenceBefore);
  assert.deepEqual(store.findLease(scope), leaseBefore);
  assert.deepEqual(store.findCheckpoint(scope), checkpointBefore);
  store.close();
}));

test("F18-F same invocation with a different idempotency key conflicts before admission and mutation", async () => withStore(async (store) => {
  const firstAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "safe-evidence", checkpointReference: "checkpoint-1" });
  await coordinator(store, firstAdapter).execute(input());
  const evidenceBefore = store.listEvidence(scope);
  const leaseBefore = store.findLease(scope);
  const checkpointBefore = store.findCheckpoint(scope);
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "FAILED", safeEvidenceReference: "must-not-run" });

  await assert.rejects(
    coordinator(store, replayAdapter, blocked).execute(input({ expectedScopeRevision: 1, idempotencyKey: "test-2" })),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  assert.equal(replayAdapter.invocationCount, 0);
  assert.deepEqual(store.listEvidence(scope), evidenceBefore);
  assert.deepEqual(store.findLease(scope), leaseBefore);
  assert.deepEqual(store.findCheckpoint(scope), checkpointBefore);
  store.close();
}));

test("F18-F crash after connector response but before local completion reopens ambiguous with zero blind rerun", async () => withStore(async (store, databasePath) => {
  const persistence = new Proxy<DurableConnectorExecutionUnitOfWork>(store, {
    get(target, property): unknown {
      if (property === "completeInvocation") return () => { throw new Error("simulated local completion failure"); };
      const value: unknown = Reflect.get(target, property);
      return typeof value === "function" ? (value as (...args: readonly unknown[]) => unknown).bind(target) : value;
    },
  });
  const firstAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "provider-confirmed", checkpointReference: "checkpoint-1" });
  const linked: unknown[] = [];
  const writer = { linkAmbiguousInvocation(input: unknown) { linked.push(input); } };
  await assert.rejects(coordinator(persistence, firstAdapter, eligible, writer).execute(input()), /simulated local completion failure/);
  assert.equal(firstAdapter.invocationCount, 1);
  assert.equal(linked.length, 1);
  store.close();

  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const replayAdapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "must-not-run", checkpointReference: "must-not-run" });
  const replay = await coordinator(reopened, replayAdapter, blocked).execute(input({ expectedScopeRevision: 1 }));
  assert.deepEqual(replay, { status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: "invocation-f18-c-coordinator" });
  assert.equal(replayAdapter.invocationCount, 0);
  assert.equal(reopened.findCheckpoint(scope), undefined);
  reopened.close();
}));

test("F18-C restart after EXECUTION_STARTED has zero blind resend and conflicting payload fails closed", async () => withStore(async (store, databasePath) => {
  store.acquireLease({ ...scope, leaseId: "lease-f18-c-coordinator", ownerId: "worker-f18-c", acquiredAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-09-01T00:05:00.000Z", expectedScopeRevision: 0 });
  store.prepareInvocation({ ...scope, invocationId: "invocation-f18-c-coordinator", leaseId: "lease-f18-c-coordinator", idempotencyKey: "test-1", inputFingerprint: "fingerprint-f18-c-coordinator", inputReference: "safe-input-reference-f18-c", inputVersion: 4, sourcePolicyVersion: 3, connectorVersion: 5, expectedCheckpointVersion: 0, preparedAt: "2026-09-01T00:00:01.000Z" });
  store.markExecutionStarted(scope, "invocation-f18-c-coordinator", "2026-09-01T00:00:02.000Z");
  store.close();

  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  const adapter = new DeterministicConnectorTestAdapter({ outcome: "SUCCEEDED", safeEvidenceReference: "must-not-run", checkpointReference: "must-not-run" });
  const execution = coordinator(reopened, adapter);
  assert.deepEqual(await execution.execute(input({ expectedScopeRevision: 1 })), { status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: "invocation-f18-c-coordinator" });
  assert.equal(adapter.invocationCount, 0);
  await assert.rejects(execution.execute(input({ expectedScopeRevision: 1, inputFingerprint: "conflicting-fingerprint" })), { code: "IDEMPOTENCY_CONFLICT" });
  assert.equal(adapter.invocationCount, 0);
  reopened.close();
}));
