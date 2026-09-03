import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { DurableRecoveryOrchestrationStore } from "./recovery-durable-persistence.js";
import { RecoveryStoreError } from "./recovery-orchestration-contracts.js";

const createdAt = "2026-09-02T10:00:00.000Z";

function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-b-"));
  try { run(join(directory, "recovery.sqlite")); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function create(store: DurableRecoveryOrchestrationStore, suffix = "1") {
  return store.createCase({
    resourceType: "Publication",
    resourceId: `publication-${suffix}`,
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: `publication-case-${suffix}`, attemptId: `attempt-${suffix}` },
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    evidenceRefs: [`evidence:dispatch:${suffix}`],
    createdBy: "service-evidence-1",
    createdAt,
  });
}

test("F19-B durable case and evidence survive close and reopen", () => withDatabase((databasePath) => {
  const first = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(first);
  first.close();
  const reopened = new DurableRecoveryOrchestrationStore({ databasePath });
  assert.deepEqual(reopened.findCase(created.recoveryCaseId), created);
  reopened.close();
}));

test("F19-B finding is atomic, versioned, append-only and idempotent", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(store);
  const input = {
    recoveryCaseId: created.recoveryCaseId,
    expectedVersion: 1,
    finding: "CONFIRMED_NOT_EXECUTED" as const,
    reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED",
    evidenceRefs: ["evidence:trusted:1"],
    decidedBy: "resolver-1",
    decidedAt: "2026-09-02T10:05:00.000Z",
    idempotencyKey: "finding-key-1",
    fingerprint: "finding-fingerprint-1",
  };
  const applied = store.recordFinding(input);
  assert.equal(applied.replay, false);
  assert.equal(applied.record.status, "RESOLVED");
  assert.equal(applied.record.version, 2);
  assert.equal(applied.record.finding?.finding, "CONFIRMED_NOT_EXECUTED");
  assert.equal(applied.record.finding?.reasonCode, "PROVIDER_CONFIRMED_NOT_EXECUTED");
  assert.equal(store.recordFinding(input).replay, true);
  assert.throws(() => store.recordFinding({ ...input, fingerprint: "conflicting" }), (error) => error instanceof RecoveryStoreError && error.code === "IDEMPOTENCY_CONFLICT");
  assert.throws(() => store.recordFinding({ ...input, expectedVersion: 2, idempotencyKey: "finding-key-2", fingerprint: "finding-fingerprint-2", finding: "CONFIRMED_EXECUTED" }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");
  store.close();
}));

test("F19-B recovery authorization atomically binds immutable execution identity and replays after restart", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(store);
  store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:trusted:1"], decidedBy: "resolver-1", decidedAt: createdAt, idempotencyKey: "finding-key", fingerprint: "finding-fingerprint" });
  const input = {
    recoveryCaseId: created.recoveryCaseId,
    expectedVersion: 2,
    recoveryDisposition: "RECOVERY_AUTHORIZED" as const,
    recoveryActionType: "PUBLICATION_RECOVERY" as const,
    recoveryExecutionIdentity: { attemptId: "attempt-2", commandId: "command-2" },
    evidenceRefs: ["evidence:authorization:1"],
    decidedBy: "authorizer-1",
    decidedAt: "2026-09-02T10:10:00.000Z",
    idempotencyKey: "authorization-key",
    fingerprint: "authorization-fingerprint",
  };
  const applied = store.authorizeRecovery(input);
  assert.equal(applied.replay, false);
  assert.equal(applied.record.version, 3);
  assert.deepEqual(applied.record.recovery?.recoveryExecutionIdentity, input.recoveryExecutionIdentity);
  assert.deepEqual(applied.record.recovery?.originalOriginIdentity, created.originIdentity);
  assert.equal(applied.record.recovery?.decisionVersion, 2);
  store.close();
  const reopened = new DurableRecoveryOrchestrationStore({ databasePath });
  assert.equal(reopened.authorizeRecovery(input).replay, true);
  assert.throws(() => reopened.authorizeRecovery({ ...input, fingerprint: "conflicting" }), (error) => error instanceof RecoveryStoreError && error.code === "IDEMPOTENCY_CONFLICT");
  reopened.close();
}));

test("F19-C authorized Publication recovery binding is found by trusted origin after restart and remains concealed outside its scope", () => withDatabase((databasePath) => {
  const first = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(first, "lookup");
  first.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:trusted:lookup"], decidedBy: "resolver-lookup", decidedAt: createdAt, idempotencyKey: "finding-key-lookup", fingerprint: "finding-fingerprint-lookup" });
  const authorized = first.authorizeRecovery({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "PUBLICATION_RECOVERY", recoveryExecutionIdentity: { attemptId: "attempt-recovery-lookup", commandId: "command-recovery-lookup" }, evidenceRefs: ["evidence:authorization:lookup"], decidedBy: "authorizer-lookup", decidedAt: createdAt, idempotencyKey: "authorization-key-lookup", fingerprint: "authorization-fingerprint-lookup" }).record;
  first.close();

  const reopened = new DurableRecoveryOrchestrationStore({ databasePath });
  const query = { tenantId: "tenant-1", scopeRef: "team:team-1", resourceType: "Publication", resourceId: "publication-lookup", reconciliationCaseId: "publication-case-lookup" } as const;
  assert.deepEqual(reopened.findAuthorizedPublicationRecovery(query), authorized);
  assert.equal(reopened.findAuthorizedPublicationRecovery({ ...query, tenantId: "tenant-other" }), undefined);
  assert.equal(reopened.findAuthorizedPublicationRecovery({ ...query, scopeRef: "team:other" }), undefined);
  assert.equal(reopened.findAuthorizedPublicationRecovery({ ...query, resourceId: "publication-other" }), undefined);
  reopened.close();
}));

test("F19-D durable Connector recovery binding is found only for its exact recovery, tenant, scope and original invocation", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = store.createCase({ resourceType: "ConnectorInvocation", resourceId: "invocation-f19-d", originDomain: "CONNECTOR", originIdentity: { invocationId: "invocation-f19-d" }, tenantId: "tenant-f19-d", scopeRef: "team:team-f19-d", evidenceRefs: ["evidence:ambiguous:f19-d"], createdBy: "executor-f19-d", createdAt });
  store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:finding:f19-d"], decidedBy: "resolver-f19-d", decidedAt: createdAt, idempotencyKey: "finding-f19-d", fingerprint: "finding-f19-d" });
  const authorized = store.authorizeRecovery({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "CONNECTOR_REEXECUTION", recoveryExecutionIdentity: { invocationId: "connector-recovery:recovery-f19-d" }, evidenceRefs: ["evidence:authorization:f19-d"], decidedBy: "authorizer-f19-d", decidedAt: createdAt, idempotencyKey: "authorization-f19-d", fingerprint: "authorization-f19-d" }).record;
  const query = { recoveryId: authorized.recovery!.recoveryId, tenantId: "tenant-f19-d", scopeRef: "team:team-f19-d" } as const;
  assert.deepEqual(store.findAuthorizedConnectorRecovery(query), authorized);
  assert.equal(store.findAuthorizedConnectorRecovery({ ...query, recoveryId: "recovery-other" }), undefined);
  assert.equal(store.findAuthorizedConnectorRecovery({ ...query, tenantId: "tenant-other" }), undefined);
  assert.equal(store.findAuthorizedConnectorRecovery({ ...query, scopeRef: "team:other" }), undefined);
  store.close();
}));

test("F19-B durable configuration and nested origin lineage fail closed", () => {
  assert.throws(() => new DurableRecoveryOrchestrationStore({ databasePath: "" }), /durable recovery database path/i);
  assert.throws(() => new DurableRecoveryOrchestrationStore({ databasePath: ":memory:" }), /durable recovery database path/i);
  withDatabase((databasePath) => {
    const store = new DurableRecoveryOrchestrationStore({ databasePath });
    try {
    const parent = create(store);
    assert.throws(() => store.createCase({
      resourceType: "ConnectorInvocation",
      resourceId: "invocation-child",
      originDomain: "CONNECTOR",
      originIdentity: { invocationId: "invocation-child" },
      tenantId: "tenant-1",
      scopeRef: "team:team-1",
      parentRecoveryCaseId: parent.recoveryCaseId,
      evidenceRefs: ["evidence:child:1"],
      createdBy: "service-evidence-2",
      createdAt,
    }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");
    assert.equal(store.findCase(parent.recoveryCaseId)?.version, 1);
    assert.throws(() => store.createCase({ resourceType: "ConnectorInvocation", resourceId: "cross-tenant", originDomain: "CONNECTOR", originIdentity: { invocationId: "cross-tenant" }, tenantId: "tenant-2", scopeRef: "team:other", parentRecoveryCaseId: parent.recoveryCaseId, evidenceRefs: ["evidence:cross"], createdBy: "service-evidence-2", createdAt }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");
    } finally {
      store.close();
    }
  });
});

test("F19-B database constraints keep identity and evidence append-only", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(store);
  store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "UNRESOLVED", reasonCode: "EVIDENCE_INSUFFICIENT", evidenceRefs: ["evidence:immutable"], decidedBy: "resolver-immutable", decidedAt: createdAt, idempotencyKey: "immutable-key", fingerprint: "immutable-fingerprint" });
  store.close();
  const raw = new DatabaseSync(databasePath);
  assert.throws(() => raw.prepare("UPDATE recovery_cases SET resource_id = 'changed' WHERE recovery_case_id = ?").run(created.recoveryCaseId), /immutable/i);
  assert.throws(() => raw.prepare("UPDATE recovery_findings SET finding = 'CONFIRMED_EXECUTED'").run(), /append-only/i);
  assert.throws(() => raw.prepare("DELETE FROM recovery_evidence").run(), /append-only/i);
  raw.close();
}));

test("F19-B appends a terminal finding after unresolved evidence without rewriting history", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(store);
  store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "UNRESOLVED", reasonCode: "EVIDENCE_INSUFFICIENT", evidenceRefs: ["evidence:unresolved"], decidedBy: "resolver-1", decidedAt: createdAt, idempotencyKey: "unresolved-key", fingerprint: "unresolved-fingerprint" });
  const terminal = store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, finding: "CONFIRMED_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_EXECUTED", evidenceRefs: ["evidence:terminal"], decidedBy: "resolver-2", decidedAt: "2026-09-02T10:20:00.000Z", idempotencyKey: "terminal-key", fingerprint: "terminal-fingerprint" });
  assert.equal(terminal.record.status, "RESOLVED");
  assert.equal(terminal.record.finding?.finding, "CONFIRMED_EXECUTED");
  store.close();
  const raw = new DatabaseSync(databasePath, { readOnly: true });
  assert.equal(Number(raw.prepare("SELECT COUNT(*) AS count FROM recovery_findings WHERE recovery_case_id = ?").get(created.recoveryCaseId)?.["count"]), 2);
  raw.close();
}));

test("F19-B rolls back finding, evidence and version when idempotency persistence fails", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  const created = create(store);
  const raw = new DatabaseSync(databasePath);
  raw.exec("CREATE TRIGGER fail_recovery_idempotency BEFORE INSERT ON recovery_idempotency BEGIN SELECT RAISE(ABORT, 'injected idempotency failure'); END;");
  assert.throws(() => store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:must-rollback"], decidedBy: "resolver-rollback", decidedAt: createdAt, idempotencyKey: "rollback-key", fingerprint: "rollback-fingerprint" }), /injected idempotency failure/i);
  const unchanged = store.findCase(created.recoveryCaseId);
  assert.equal(unchanged?.version, 1);
  assert.equal(unchanged?.finding, undefined);
  assert.equal(Number(raw.prepare("SELECT COUNT(*) AS count FROM recovery_findings WHERE recovery_case_id = ?").get(created.recoveryCaseId)?.["count"]), 0);
  assert.equal(Number(raw.prepare("SELECT COUNT(*) AS count FROM recovery_evidence WHERE owner_type = 'FINDING'").get()?.["count"]), 0);
  raw.close();
  store.close();
}));

test("F19-F nested ambiguity accepts only the authorized X2 identity and preserves RC1 while RC2 stays independently open", () => withDatabase((databasePath) => {
  const store = new DurableRecoveryOrchestrationStore({ databasePath });
  let parent!: ReturnType<typeof create>;
  let authorized!: ReturnType<DurableRecoveryOrchestrationStore["authorizeRecovery"]>["record"];
  let immutableRc1!: ReturnType<DurableRecoveryOrchestrationStore["authorizeRecovery"]>["record"];
  let child!: ReturnType<DurableRecoveryOrchestrationStore["createCase"]>;
  try {
  parent = create(store, "nested-f19-f");
  store.recordFinding({
    recoveryCaseId: parent.recoveryCaseId,
    expectedVersion: 1,
    finding: "CONFIRMED_NOT_EXECUTED",
    reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED",
    evidenceRefs: ["evidence:f19-f:finding:rc1"],
    decidedBy: "resolver-f19-f",
    decidedAt: "2026-09-03T10:01:00.000Z",
    idempotencyKey: "f19-f-finding-rc1",
    fingerprint: "f19-f-finding-rc1",
  });
  authorized = store.authorizeRecovery({
    recoveryCaseId: parent.recoveryCaseId,
    expectedVersion: 2,
    recoveryDisposition: "RECOVERY_AUTHORIZED",
    recoveryActionType: "PUBLICATION_RECOVERY",
    recoveryExecutionIdentity: { attemptId: "attempt-x2-f19-f", commandId: "command-x2-f19-f" },
    evidenceRefs: ["evidence:f19-f:authorization:r1"],
    decidedBy: "authorizer-f19-f",
    decidedAt: "2026-09-03T10:02:00.000Z",
    idempotencyKey: "f19-f-authorization-r1",
    fingerprint: "f19-f-authorization-r1",
  }).record;
  immutableRc1 = structuredClone(authorized);

  assert.throws(() => store.createCase({
    resourceType: "Publication",
    resourceId: "publication-nested-f19-f",
    originDomain: "PUBLICATION",
    originIdentity: parent.originIdentity,
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    parentRecoveryCaseId: parent.recoveryCaseId,
    evidenceRefs: ["evidence:f19-f:invalid-original-reuse"],
    createdBy: "executor-f19-f",
    createdAt: "2026-09-03T10:03:00.000Z",
  }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");
  assert.throws(() => store.createCase({
    resourceType: "Publication",
    resourceId: "publication-nested-f19-f",
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: "case-x3-f19-f", attemptId: "attempt-x3-f19-f" },
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    parentRecoveryCaseId: parent.recoveryCaseId,
    evidenceRefs: ["evidence:f19-f:invalid-x3"],
    createdBy: "executor-f19-f",
    createdAt: "2026-09-03T10:03:00.000Z",
  }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");
  assert.throws(() => store.createCase({
    resourceType: "Publication",
    resourceId: "publication-nested-f19-f",
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: "case-x2-f19-f", attemptId: "attempt-x2-f19-f" },
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    parentRecoveryCaseId: "missing-parent-f19-f",
    evidenceRefs: ["evidence:f19-f:missing-parent"],
    createdBy: "executor-f19-f",
    createdAt: "2026-09-03T10:03:00.000Z",
  }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");

  child = store.createCase({
    resourceType: "Publication",
    resourceId: "publication-nested-f19-f",
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: "case-x2-f19-f", attemptId: "attempt-x2-f19-f" },
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    parentRecoveryCaseId: parent.recoveryCaseId,
    evidenceRefs: ["evidence:f19-f:x2:ambiguous"],
    createdBy: "executor-f19-f",
    createdAt: "2026-09-03T10:03:00.000Z",
  });

  assert.equal(child.parentRecoveryCaseId, parent.recoveryCaseId);
  assert.deepEqual(child.originIdentity, { reconciliationCaseId: "case-x2-f19-f", attemptId: "attempt-x2-f19-f" });
  assert.equal(child.status, "OPEN");
  assert.equal(child.version, 1);
  assert.equal(child.finding, undefined);
  assert.equal(child.disposition, undefined);
  assert.equal(child.recovery, undefined);
  assert.deepEqual(store.findCase(parent.recoveryCaseId), immutableRc1);
  assert.throws(() => store.createCase({
    resourceType: child.resourceType,
    resourceId: child.resourceId,
    originDomain: child.originDomain,
    originIdentity: child.originIdentity,
    tenantId: child.tenantId,
    scopeRef: child.scopeRef,
    parentRecoveryCaseId: parent.recoveryCaseId,
    evidenceRefs: ["evidence:f19-f:overwrite-attempt"],
    createdBy: "other-executor-f19-f",
    createdAt: "2026-09-03T10:04:00.000Z",
  }), (error) => error instanceof RecoveryStoreError && error.code === "DUPLICATE_ORIGIN");
  assert.deepEqual(store.findCase(parent.recoveryCaseId), immutableRc1);
  assert.deepEqual(store.findCase(child.recoveryCaseId), child);

  } finally {
    store.close();
  }
  const reopened = new DurableRecoveryOrchestrationStore({ databasePath });
  try {
    assert.deepEqual(reopened.findCase(parent.recoveryCaseId), immutableRc1);
    assert.deepEqual(reopened.findCase(child.recoveryCaseId), child);
  } finally {
    reopened.close();
  }

  const raw = new DatabaseSync(databasePath);
  try {
    assert.throws(() => raw.prepare("UPDATE recovery_cases SET parent_recovery_case_id = NULL WHERE recovery_case_id = ?").run(child.recoveryCaseId), /immutable/i);
    assert.throws(() => raw.prepare("UPDATE recovery_bindings SET execution_identity_json = '{}' WHERE recovery_id = ?").run(authorized.recovery!.recoveryId), /append-only/i);
    assert.throws(() => raw.prepare("UPDATE recovery_evidence SET evidence_ref = 'overwritten' WHERE owner_id = ?").run(child.recoveryCaseId), /append-only/i);
  } finally {
    raw.close();
  }
}));

test("F19-F recovery execution idempotency replays the authoritative result after restart and conflicts without mutation", () => withDatabase((databasePath) => {
  const first = new DurableRecoveryOrchestrationStore({ databasePath });
  const parent = create(first, "execution-idempotency-f19-f");
  first.recordFinding({
    recoveryCaseId: parent.recoveryCaseId,
    expectedVersion: 1,
    finding: "CONFIRMED_NOT_EXECUTED",
    reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED",
    evidenceRefs: ["evidence:f19-f:execution:finding"],
    decidedBy: "resolver-f19-f-execution",
    decidedAt: "2026-09-03T11:01:00.000Z",
    idempotencyKey: "f19-f-execution-finding",
    fingerprint: "f19-f-execution-finding",
  });
  const authorized = first.authorizeRecovery({
    recoveryCaseId: parent.recoveryCaseId,
    expectedVersion: 2,
    recoveryDisposition: "RECOVERY_AUTHORIZED",
    recoveryActionType: "PUBLICATION_RECOVERY",
    recoveryExecutionIdentity: { attemptId: "attempt-f19-f-execution-x2", commandId: "command-f19-f-execution-x2" },
    evidenceRefs: ["evidence:f19-f:execution:authorization"],
    decidedBy: "authorizer-f19-f-execution",
    decidedAt: "2026-09-03T11:02:00.000Z",
    idempotencyKey: "f19-f-execution-authorization",
    fingerprint: "f19-f-execution-authorization",
  }).record;
  const recoveryId = authorized.recovery!.recoveryId;
  const identity = { recoveryId, fingerprint: "f19-f-authoritative-execution-fingerprint" } as const;
  const resultJson = JSON.stringify({ ok: true, publicationId: "publication-execution-idempotency-f19-f", aggregateVersion: 7, decision: "RECOVERED", resultReference: "result:f19-f:authoritative", replayed: false });
  const immutableRc1 = structuredClone(authorized);

  const claim = first.claimRecoveryExecution(identity);
  assert.equal(claim.replay, false);
  assert.deepEqual(claim.record, identity);
  assert.deepEqual(first.findRecoveryExecution(identity), identity);
  const completion = first.completeRecoveryExecution({ ...identity, resultJson });
  assert.equal(completion.replay, false);
  assert.deepEqual(completion.record, { ...identity, resultJson });
  assert.deepEqual(first.claimRecoveryExecution(identity), { replay: true, record: { ...identity, resultJson } });
  assert.deepEqual(first.completeRecoveryExecution({ ...identity, resultJson: "attempted-overwrite" }), { replay: true, record: { ...identity, resultJson } });
  assert.deepEqual(first.findCase(parent.recoveryCaseId), immutableRc1);
  first.close();

  const reopened = new DurableRecoveryOrchestrationStore({ databasePath });
  try {
    assert.deepEqual(reopened.findRecoveryExecution(identity), { ...identity, resultJson });
    const beforeConflict = reopened.findCase(parent.recoveryCaseId);
    assert.throws(() => reopened.findRecoveryExecution({ ...identity, fingerprint: "conflicting-fingerprint" }), (error) => error instanceof RecoveryStoreError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.throws(() => reopened.claimRecoveryExecution({ ...identity, fingerprint: "conflicting-fingerprint" }), (error) => error instanceof RecoveryStoreError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.throws(() => reopened.completeRecoveryExecution({ ...identity, fingerprint: "conflicting-fingerprint", resultJson: "conflicting-result" }), (error) => error instanceof RecoveryStoreError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(reopened.findCase(parent.recoveryCaseId), beforeConflict);
    assert.deepEqual(reopened.findRecoveryExecution(identity), { ...identity, resultJson });
  } finally {
    reopened.close();
  }

  const raw = new DatabaseSync(databasePath);
  try {
    assert.equal(Number(raw.prepare("SELECT COUNT(*) AS count FROM recovery_execution_claims").get()?.["count"]), 1);
    assert.equal(Number(raw.prepare("SELECT COUNT(*) AS count FROM recovery_execution_results").get()?.["count"]), 1);
    assert.throws(() => raw.prepare("UPDATE recovery_execution_claims SET fingerprint = 'overwritten'").run(), /append-only/i);
    assert.throws(() => raw.prepare("UPDATE recovery_execution_results SET result_json = 'overwritten'").run(), /append-only/i);
  } finally {
    raw.close();
  }
}));
