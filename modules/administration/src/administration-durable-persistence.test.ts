import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  AdministrationPersistenceError,
  type AdministrationDecisionRecord,
  type AdministrationIdempotencyRecord,
  type AdministrationProposalRecord,
  type AdministrationTransactionIdentity,
  type RoleAssignmentPersistenceRecord,
} from "./administration-persistence.js";
import { DurableAdministrationUnitOfWork } from "./administration-durable-persistence.js";
import { createAdministrationPersistenceFailureInjector } from "./administration-persistence-test-support.js";

const identity: AdministrationTransactionIdentity = Object.freeze({
  tenantId: "tenant-r1",
  resourceType: "ROLE_ASSIGNMENT",
  resourceId: "assignment-r1",
});
const scope = Object.freeze({ tenantId: "tenant-r1", scopeType: "TEAM" as const, scopeId: "team-r1" });
const evidence = (id: string) => Object.freeze({ type: "AUDIT" as const, id, version: 1 });

function assignment(version: number, status: RoleAssignmentPersistenceRecord["status"]): RoleAssignmentPersistenceRecord {
  return {
    recordType: "ROLE_ASSIGNMENT",
    tenantId: identity.tenantId,
    roleAssignmentId: identity.resourceId,
    proposalId: "proposal-r1",
    scope,
    subjectPrincipalId: "principal-agent-r1",
    subjectPrincipalType: "HUMAN",
    roleId: "role-agent-r1",
    teamIds: ["team-r1"],
    resourceTypes: ["CandidateListing"],
    purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-08-26T00:00:00.000Z",
    effectiveUntil: "2026-09-26T00:00:00.000Z",
    status,
    version,
    proposedBy: "principal-admin-r1",
    ...(status === "ACTIVE" ? { approvedBy: "principal-admin-r2" } : {}),
    reasonReference: "reason-r1",
    evidenceReferences: status === "ACTIVE"
      ? [evidence("resource-created"), evidence("resource-approved")]
      : [evidence("resource-created")],
  };
}

function proposal(status: AdministrationProposalRecord["status"], version: number): AdministrationProposalRecord {
  return {
    proposalId: "proposal-r1",
    tenantId: identity.tenantId,
    resourceType: identity.resourceType,
    resourceId: identity.resourceId,
    resourceVersion: 1,
    scope,
    proposedBy: "principal-admin-r1",
    proposedChangeReference: "change-r1",
    policyReference: "policy-r1",
    status,
    version,
    reasonReference: "reason-r1",
    evidenceReferences: status === "APPROVED"
      ? [evidence("proposal-created"), evidence("proposal-approved")]
      : [evidence("proposal-created")],
  };
}

function decision(): AdministrationDecisionRecord {
  return {
    decisionId: "decision-r1",
    proposalId: "proposal-r1",
    tenantId: identity.tenantId,
    operation: "APPROVE_ROLE_ASSIGNMENT",
    resourceType: identity.resourceType,
    resourceId: identity.resourceId,
    scope,
    proposerId: "principal-admin-r1",
    decisionActorId: "principal-admin-r2",
    status: "APPROVED",
    reasonReference: "decision-reason-r1",
    evidenceReferences: [evidence("decision-approved")],
    version: 2,
    decidedAt: "2026-08-26T01:00:00.000Z",
  };
}

function idempotency(operation: AdministrationIdempotencyRecord["operation"], key: string, resultReference: string, resultVersion: number): AdministrationIdempotencyRecord {
  return {
    ...identity,
    idempotencyKey: key,
    operation,
    fingerprint: `fingerprint-${key}`,
    resultReference,
    resultVersion,
    resultStatus: operation === "PROPOSE_ROLE_ASSIGNMENT" ? "PROPOSED" : "ACTIVE",
    recordedAt: "2026-08-26T01:00:00.000Z",
  };
}

function stageProposal(unitOfWork: DurableAdministrationUnitOfWork): void {
  const transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.save(assignment(1, "PROPOSED"));
  transaction.proposals.save(proposal("PROPOSED", 1));
  transaction.idempotency.record(idempotency("PROPOSE_ROLE_ASSIGNMENT", "idempotency-propose", "proposal-r1", 1));
  transaction.commit();
}

function stageApproval(unitOfWork: DurableAdministrationUnitOfWork): ReturnType<DurableAdministrationUnitOfWork["begin"]> {
  const transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision());
  transaction.idempotency.record(idempotency("APPROVE_ROLE_ASSIGNMENT", "idempotency-approve", "decision-r1", 2));
  return transaction;
}

function expectCode(action: () => unknown, code: AdministrationPersistenceError["code"]): void {
  assert.throws(action, (error: unknown) => error instanceof AdministrationPersistenceError && error.code === code);
}

test("F16-R1 durable administration persistence requires a file database path", () => {
  for (const databasePath of ["", "   ", ":memory:"]) {
    assert.throws(
      () => new DurableAdministrationUnitOfWork({ databasePath }),
      (error: unknown) => error instanceof AdministrationPersistenceError
        && error.code === "PERSISTENCE_INPUT_INVALID",
    );
  }
});

test("F16-R1 committed administration bundle and revision survive close and reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-"));
  const databasePath = join(directory, "administration.sqlite");
  try {
    let unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    let transaction = unitOfWork.begin(identity);
    transaction.roleAssignments.save(assignment(1, "PROPOSED"));
    transaction.proposals.save(proposal("PROPOSED", 1));
    transaction.idempotency.record(idempotency("PROPOSE_ROLE_ASSIGNMENT", "idempotency-propose", "proposal-r1", 1));
    transaction.commit();

    transaction = unitOfWork.begin(identity);
    transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
    transaction.proposals.update(1, proposal("APPROVED", 2));
    transaction.decisions.append(decision());
    transaction.idempotency.record(idempotency("APPROVE_ROLE_ASSIGNMENT", "idempotency-approve", "decision-r1", 2));
    transaction.commit();
    unitOfWork.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    const revision = database.prepare("SELECT revision FROM administration_revisions WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?").get(identity.tenantId, identity.resourceType, identity.resourceId) as { revision: number } | undefined;
    database.close();
    assert.equal(revision?.revision, 2);

    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment(2, "ACTIVE"));
    assert.deepEqual(unitOfWork.proposals.findById(identity.tenantId, "proposal-r1"), proposal("APPROVED", 2));
    assert.deepEqual(unitOfWork.decisions.list(identity), [decision()]);
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "idempotency-approve" })?.resultReference, "decision-r1");
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const failurePoint of ["STATE_WRITE", "DECISION_APPEND", "IDEMPOTENCY_WRITE", "COMMIT"] as const) {
  test(`F16-R1 ${failurePoint} failure leaves durable state, evidence, idempotency and revision unchanged`, () => {
    const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-failure-"));
    const databasePath = join(directory, "administration.sqlite");
    try {
      const failures = createAdministrationPersistenceFailureInjector();
      let unitOfWork = new DurableAdministrationUnitOfWork({ databasePath, failures: failures.port });
      stageProposal(unitOfWork);
      failures.failNext(failurePoint);
      const transaction = unitOfWork.begin(identity);
      expectCode(() => {
        transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
        transaction.proposals.update(1, proposal("APPROVED", 2));
        transaction.decisions.append(decision());
        transaction.idempotency.record(idempotency("APPROVE_ROLE_ASSIGNMENT", "idempotency-approve", "decision-r1", 2));
        transaction.commit();
      }, "PERSISTENCE_WRITE_FAILED");
      if (transaction.isActive()) transaction.rollback();
      unitOfWork.close();

      unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
      assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
      assert.equal(unitOfWork.proposals.findById(identity.tenantId, "proposal-r1")?.status, "PROPOSED");
      assert.deepEqual(unitOfWork.decisions.list(identity), []);
      assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "idempotency-approve" }), undefined);
      unitOfWork.close();
      const database = new DatabaseSync(databasePath, { readOnly: true });
      const row = database.prepare("SELECT revision FROM administration_revisions WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?").get(identity.tenantId, identity.resourceType, identity.resourceId) as { revision: number };
      database.close();
      assert.equal(row.revision, 1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("F16-R1 SQLite failure after governed writes rolls back the entire durable approval bundle", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-atomic-"));
  const databasePath = join(directory, "administration.sqlite");
  let unitOfWork: DurableAdministrationUnitOfWork | undefined;
  try {
    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    unitOfWork.close();
    const database = new DatabaseSync(databasePath);
    database.exec("CREATE TRIGGER fail_decision_insert BEFORE INSERT ON administration_decisions BEGIN SELECT RAISE(ABORT, 'controlled failure'); END");
    database.close();

    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    const transaction = stageApproval(unitOfWork);
    expectCode(() => transaction.commit(), "PERSISTENCE_WRITE_FAILED");
    unitOfWork.close();

    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment(1, "PROPOSED"));
    assert.deepEqual(unitOfWork.proposals.findById(identity.tenantId, "proposal-r1"), proposal("PROPOSED", 1));
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "idempotency-approve" }), undefined);
    unitOfWork.close();
  } finally {
    try { unitOfWork?.close(); } catch { /* preserve the assertion failure */ }
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); } catch { /* preserve the assertion failure */ }
  }
});

test("F16-R1 decision, evidence and idempotency rows reject SQL update and delete", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-append-only-"));
  const databasePath = join(directory, "administration.sqlite");
  try {
    const unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    stageApproval(unitOfWork).commit();
    unitOfWork.close();

    const database = new DatabaseSync(databasePath);
    for (const statement of [
      "UPDATE administration_decisions SET version = version WHERE decision_id = 'decision-r1'",
      "DELETE FROM administration_decisions WHERE decision_id = 'decision-r1'",
      "UPDATE administration_resource_evidence SET sequence = sequence WHERE resource_id = 'assignment-r1'",
      "DELETE FROM administration_resource_evidence WHERE resource_id = 'assignment-r1'",
      "UPDATE administration_proposal_evidence SET sequence = sequence WHERE proposal_id = 'proposal-r1'",
      "DELETE FROM administration_proposal_evidence WHERE proposal_id = 'proposal-r1'",
      "UPDATE administration_decision_evidence SET sequence = sequence WHERE decision_id = 'decision-r1'",
      "DELETE FROM administration_decision_evidence WHERE decision_id = 'decision-r1'",
      "UPDATE administration_idempotency SET fingerprint = fingerprint WHERE idempotency_key = 'idempotency-approve'",
      "DELETE FROM administration_idempotency WHERE idempotency_key = 'idempotency-approve'",
    ]) assert.throws(() => database.exec(statement));
    database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F16-R1 idempotency replay survives reopen and conflicting intent fails closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-replay-"));
  const databasePath = join(directory, "administration.sqlite");
  try {
    let unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    unitOfWork.close();
    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    const transaction = unitOfWork.begin(identity);
    const stored = idempotency("PROPOSE_ROLE_ASSIGNMENT", "idempotency-propose", "proposal-r1", 1);
    assert.equal(transaction.idempotency.record(stored).status, "REPLAYED");
    expectCode(() => transaction.idempotency.record({ ...stored, fingerprint: "conflicting-fingerprint" }), "IDEMPOTENCY_CONFLICT");
    transaction.rollback();
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "idempotency-propose" })?.fingerprint, stored.fingerprint);
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F16-R1 two durable adapters reject a stale transaction without partial rows", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-concurrency-"));
  const databasePath = join(directory, "administration.sqlite");
  try {
    let seed = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(seed);
    seed.close();

    const first = new DurableAdministrationUnitOfWork({ databasePath });
    const second = new DurableAdministrationUnitOfWork({ databasePath });
    const firstTransaction = stageApproval(first);
    const staleTransaction = stageApproval(second);
    firstTransaction.commit();
    expectCode(() => staleTransaction.commit(), "VERSION_CONFLICT");
    first.close();
    second.close();

    seed = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(seed.roleAssignments.find(identity), assignment(2, "ACTIVE"));
    assert.deepEqual(seed.decisions.list(identity), [decision()]);
    assert.equal(seed.idempotency.find({ ...identity, idempotencyKey: "idempotency-approve" })?.resultReference, "decision-r1");
    seed.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F16-R1 held SQLite write lock fails within the bounded timeout without partial rows", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-lock-"));
  const databasePath = join(directory, "administration.sqlite");
  let unitOfWork: DurableAdministrationUnitOfWork | undefined;
  let blocker: DatabaseSync | undefined;
  try {
    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    const transaction = stageApproval(unitOfWork);
    blocker = new DatabaseSync(databasePath);
    blocker.exec("PRAGMA busy_timeout = 1");
    blocker.exec("BEGIN IMMEDIATE");
    const startedAt = Date.now();
    expectCode(() => transaction.commit(), "VERSION_CONFLICT");
    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed >= 4_500 && elapsed < 7_500, `unexpected busy timeout: ${String(elapsed)}ms`);
    blocker.exec("ROLLBACK");
    blocker.close();
    blocker = undefined;
    unitOfWork.close();
    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment(1, "PROPOSED"));
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
  } finally {
    try { blocker?.exec("ROLLBACK"); } catch { /* preserve assertion failure */ }
    try { blocker?.close(); } catch { /* preserve assertion failure */ }
    try { unitOfWork?.close(); } catch { /* preserve assertion failure */ }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R1 durable reads observe a commit made by another adapter without reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-live-read-"));
  const databasePath = join(directory, "administration.sqlite");
  let observer: DurableAdministrationUnitOfWork | undefined;
  let writer: DurableAdministrationUnitOfWork | undefined;
  try {
    observer = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(observer);
    writer = new DurableAdministrationUnitOfWork({ databasePath });

    assert.equal(observer.roleAssignments.find(identity)?.status, "PROPOSED");
    stageApproval(writer).commit();

    assert.equal(observer.roleAssignments.find(identity)?.status, "ACTIVE");
    assert.equal(observer.proposals.findById(identity.tenantId, "proposal-r1")?.status, "APPROVED");
    assert.deepEqual(observer.decisions.list(identity), [decision()]);
  } finally {
    try { observer?.close(); } catch { /* preserve assertion failure */ }
    try { writer?.close(); } catch { /* preserve assertion failure */ }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R1 durable refresh observes one complete SQLite read snapshot during a concurrent commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-read-snapshot-"));
  const databasePath = join(directory, "administration.sqlite");
  const prototype = DatabaseSync.prototype as unknown as { prepare(sql: string): ReturnType<DatabaseSync["prepare"]> };
  const originalPrepare = prototype.prepare;
  let observer: DurableAdministrationUnitOfWork | undefined;
  let writer: DurableAdministrationUnitOfWork | undefined;
  let armed = false;
  try {
    observer = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(observer);
    writer = new DurableAdministrationUnitOfWork({ databasePath });
    const approval = stageApproval(writer);
    prototype.prepare = function(this: DatabaseSync, sql: string): ReturnType<DatabaseSync["prepare"]> {
      if (armed && sql.startsWith("SELECT tenant_id, proposal_id")) {
        armed = false;
        approval.commit();
      }
      return originalPrepare.call(this, sql);
    };
    armed = true;
    assert.doesNotThrow(() => observer?.roleAssignments.find(identity));
    assert.equal(observer.roleAssignments.find(identity)?.status, "ACTIVE");
  } finally {
    prototype.prepare = originalPrepare;
    try { observer?.close(); } catch { /* preserve assertion failure */ }
    try { writer?.close(); } catch { /* preserve assertion failure */ }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R1 uncertain COMMIT outcome quarantines the adapter and reopens as one complete bundle", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-uncertain-"));
  const databasePath = join(directory, "administration.sqlite");
  const prototype = DatabaseSync.prototype as unknown as { exec(sql: string): void };
  const originalExec = prototype.exec;
  let unitOfWork: DurableAdministrationUnitOfWork | undefined;
  let armed = false;
  try {
    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    const transaction = stageApproval(unitOfWork);
    prototype.exec = function(this: DatabaseSync, sql: string): void {
      originalExec.call(this, sql);
      if (armed && sql === "COMMIT") {
        armed = false;
        throw new Error("controlled uncertain commit outcome");
      }
    };
    armed = true;
    expectCode(() => transaction.commit(), "PERSISTENCE_WRITE_FAILED");
    expectCode(() => unitOfWork?.begin(identity), "PERSISTENCE_WRITE_FAILED");
    unitOfWork.close();
    prototype.exec = originalExec;

    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment(2, "ACTIVE"));
    assert.deepEqual(unitOfWork.proposals.findById(identity.tenantId, "proposal-r1"), proposal("APPROVED", 2));
    assert.deepEqual(unitOfWork.decisions.list(identity), [decision()]);
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "idempotency-approve" })?.resultReference, "decision-r1");
    unitOfWork.close();
  } finally {
    prototype.exec = originalExec;
    try { unitOfWork?.close(); } catch { /* preserve assertion failure */ }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R1 uncertain pre-COMMIT failure reopens as the complete old bundle", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-uncertain-old-"));
  const databasePath = join(directory, "administration.sqlite");
  const prototype = DatabaseSync.prototype as unknown as { exec(sql: string): void };
  const originalExec = prototype.exec;
  let unitOfWork: DurableAdministrationUnitOfWork | undefined;
  let armed = false;
  try {
    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    const transaction = stageApproval(unitOfWork);
    prototype.exec = function(this: DatabaseSync, sql: string): void {
      if (armed && sql === "COMMIT") {
        armed = false;
        throw new Error("controlled pre-COMMIT uncertainty");
      }
      originalExec.call(this, sql);
    };
    armed = true;
    expectCode(() => transaction.commit(), "PERSISTENCE_WRITE_FAILED");
    expectCode(() => unitOfWork?.begin(identity), "PERSISTENCE_WRITE_FAILED");
    unitOfWork.close();
    prototype.exec = originalExec;

    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment(1, "PROPOSED"));
    assert.deepEqual(unitOfWork.proposals.findById(identity.tenantId, "proposal-r1"), proposal("PROPOSED", 1));
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "idempotency-approve" }), undefined);
  } finally {
    prototype.exec = originalExec;
    try { unitOfWork?.close(); } catch { /* preserve assertion failure */ }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R1 pre-COMMIT child termination recovers only the previously committed state", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-crash-"));
  const databasePath = join(directory, "administration.sqlite");
  try {
    let unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    stageProposal(unitOfWork);
    unitOfWork.close();

    const fixturePath = join(process.cwd(), "dist", "modules", "administration", "src", "administration-durable-crash-fixture.js");
    const child = spawn(process.execPath, [fixturePath, databasePath], { stdio: ["ignore", "pipe", "pipe"] });
    await waitForStaged(child);
    const exited = once(child, "exit");
    assert.equal(child.kill(), true);
    await exited;

    unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment(1, "PROPOSED"));
    assert.equal(unitOfWork.proposals.findById(identity.tenantId, "proposal-r1")?.status, "PROPOSED");
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

for (const corruption of [
  "UNSUPPORTED_SCHEMA", "MALFORMED_PAYLOAD", "STRUCTURAL_PAYLOAD_MISMATCH", "SEMANTIC_STATUS",
  "UNKNOWN_OPERATION", "OPERATION_RESOURCE_MISMATCH", "IDEMPOTENCY_RESULT_MISMATCH",
  "DECISION_PROPOSER_MISMATCH", "LIFECYCLE_VERSION_MISMATCH",
  "DECISIONLESS_STATUS_ELEVATION", "APPROVED_STATUS_MISMATCH",
  "FOREIGN_KEY", "CORRUPTED_FILE",
] as const) {
  test(`F16-R1 ${corruption} database fails startup without exposing storage details`, () => {
    const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-corruption-"));
    const databasePath = join(directory, "administration.sqlite");
    try {
      if (corruption === "CORRUPTED_FILE") {
        writeFileSync(databasePath, "not-a-sqlite-database", { encoding: "utf8" });
      } else {
        const unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
        stageProposal(unitOfWork);
        if (corruption === "DECISION_PROPOSER_MISMATCH" || corruption === "LIFECYCLE_VERSION_MISMATCH"
          || corruption === "APPROVED_STATUS_MISMATCH") stageApproval(unitOfWork).commit();
        unitOfWork.close();
        const database = new DatabaseSync(databasePath);
        if (corruption === "UNSUPPORTED_SCHEMA") database.exec("UPDATE administration_schema SET schema_version = 99 WHERE singleton_id = 1");
        if (corruption === "MALFORMED_PAYLOAD") database.exec("UPDATE administration_resources SET payload_json = '{\"roleAssignmentId\":\"\"}' WHERE resource_id = 'assignment-r1'");
        if (corruption === "STRUCTURAL_PAYLOAD_MISMATCH") database.exec("UPDATE administration_resources SET payload_json = json_set(payload_json, '$.tenantId', 'tenant-other') WHERE resource_id = 'assignment-r1'");
        if (corruption === "SEMANTIC_STATUS") database.exec("UPDATE administration_resources SET payload_json = json_set(payload_json, '$.status', 'INVALID') WHERE resource_id = 'assignment-r1'");
        if (corruption === "UNKNOWN_OPERATION") {
          database.exec("DROP TRIGGER administration_idempotency_no_update");
          database.exec("UPDATE administration_idempotency SET operation = 'PROPOSE_CUSTOM_ROLE_ASSIGNMENT', payload_json = json_set(payload_json, '$.operation', 'PROPOSE_CUSTOM_ROLE_ASSIGNMENT') WHERE idempotency_key = 'idempotency-propose'");
        }
        if (corruption === "OPERATION_RESOURCE_MISMATCH") {
          database.exec("DROP TRIGGER administration_idempotency_no_update");
          database.exec("UPDATE administration_idempotency SET operation = 'APPROVE_POLICY_CHANGE', payload_json = json_set(payload_json, '$.operation', 'APPROVE_POLICY_CHANGE') WHERE idempotency_key = 'idempotency-propose'");
        }
        if (corruption === "IDEMPOTENCY_RESULT_MISMATCH") {
          database.exec("DROP TRIGGER administration_idempotency_no_update");
          database.exec("UPDATE administration_idempotency SET result_reference = 'proposal-missing', payload_json = json_set(payload_json, '$.resultReference', 'proposal-missing') WHERE idempotency_key = 'idempotency-propose'");
        }
        if (corruption === "DECISION_PROPOSER_MISMATCH") {
          database.exec("DROP TRIGGER administration_decisions_no_update");
          database.exec("UPDATE administration_decisions SET payload_json = json_set(payload_json, '$.proposerId', 'principal-other') WHERE decision_id = 'decision-r1'");
        }
        if (corruption === "LIFECYCLE_VERSION_MISMATCH") {
          database.exec("DROP TRIGGER administration_decisions_no_update");
          database.exec("DROP TRIGGER administration_idempotency_no_update");
          database.exec("UPDATE administration_proposals SET payload_json = json_set(payload_json, '$.resourceVersion', 7) WHERE proposal_id = 'proposal-r1'");
          database.exec("UPDATE administration_decisions SET version = 8, payload_json = json_set(payload_json, '$.version', 8) WHERE decision_id = 'decision-r1'");
          database.exec("UPDATE administration_idempotency SET result_version = 8, payload_json = json_set(payload_json, '$.resultVersion', 8) WHERE idempotency_key = 'idempotency-approve'");
        }
        if (corruption === "DECISIONLESS_STATUS_ELEVATION") {
          database.exec("UPDATE administration_resources SET payload_json = json_set(payload_json, '$.status', 'ACTIVE') WHERE resource_id = 'assignment-r1'");
        }
        if (corruption === "APPROVED_STATUS_MISMATCH") {
          database.exec("UPDATE administration_resources SET payload_json = json_set(payload_json, '$.status', 'REVOKED') WHERE resource_id = 'assignment-r1'");
        }
        if (corruption === "FOREIGN_KEY") {
          database.exec("PRAGMA foreign_keys = OFF");
          database.exec("DELETE FROM administration_revisions WHERE resource_id = 'assignment-r1'");
        }
        database.close();
      }
      let unexpected: DurableAdministrationUnitOfWork | undefined;
      try {
        unexpected = new DurableAdministrationUnitOfWork({ databasePath });
        assert.fail("corrupted durable store unexpectedly opened");
      } catch (error: unknown) {
        if (unexpected !== undefined) throw error;
        assert.equal(error instanceof AdministrationPersistenceError, true);
        assert.equal((error as Error).message.includes(databasePath), false);
        assert.equal((error as Error).message.toUpperCase().includes("SELECT"), false);
        assert.equal((error as Error).message.toUpperCase().includes("SQLITE"), false);
      } finally {
        unexpected?.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });
}

async function waitForStaged(child: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("crash fixture did not stage in time")), 5_000);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`crash fixture exited before staging: ${String(code)}`)); });
    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString("utf8").includes("STAGED")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}
