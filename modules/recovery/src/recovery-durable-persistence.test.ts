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

test("F19-B durable configuration and nested origin lineage fail closed", () => {
  assert.throws(() => new DurableRecoveryOrchestrationStore({ databasePath: "" }), /durable recovery database path/i);
  assert.throws(() => new DurableRecoveryOrchestrationStore({ databasePath: ":memory:" }), /durable recovery database path/i);
  withDatabase((databasePath) => {
    const store = new DurableRecoveryOrchestrationStore({ databasePath });
    const parent = create(store);
    const child = store.createCase({
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
    });
    assert.equal(child.parentRecoveryCaseId, parent.recoveryCaseId);
    assert.equal(store.findCase(parent.recoveryCaseId)?.version, 1);
    assert.throws(() => store.createCase({ resourceType: "ConnectorInvocation", resourceId: "cross-tenant", originDomain: "CONNECTOR", originIdentity: { invocationId: "cross-tenant" }, tenantId: "tenant-2", scopeRef: "team:other", parentRecoveryCaseId: parent.recoveryCaseId, evidenceRefs: ["evidence:cross"], createdBy: "service-evidence-2", createdAt }), (error) => error instanceof RecoveryStoreError && error.code === "INVALID_STATE");
    store.close();
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
