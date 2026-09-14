import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  DurableJobStore,
  DurableJobStoreError,
  normalizeJobFailure,
  type SubmitDurableJobInput,
} from "./job-durable-persistence.js";

const createdAt = "2026-09-15T00:00:00.000Z";
const startedAt = "2026-09-15T00:01:00.000Z";
const completedAt = "2026-09-15T00:02:00.000Z";
const principal = Object.freeze({
  kind: "TRUSTED_SNAPSHOT" as const,
  principal: Object.freeze({ id: "actor-a", type: "HUMAN" as const, roles: Object.freeze(["OPS" as const]), teamId: "team-a", sessionId: "session-a" }),
});

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-job-store-"));
  return Object.freeze({ directory, databasePath: join(directory, "jobs.sqlite") });
}

function sequence(...values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `unexpected-${String(index)}`;
}

function clockSequence(...values: readonly string[]): () => Date {
  let index = 0;
  return () => new Date(values[index++] ?? values.at(-1) ?? createdAt);
}

function submission(overrides: Partial<SubmitDurableJobInput> = {}): SubmitDurableJobInput {
  return {
    commandId: "domain-command-a",
    jobType: "AI_LISTING_PARSE",
    inputReferences: [{ type: "RawSource", id: "raw-a", version: 3, checksum: "sha256:raw-a-v3" }],
    tenantId: "tenant-a",
    scopeRef: "team:team-a",
    purpose: "LISTING_GOVERNANCE",
    privacyClassification: "CONFIDENTIAL_BUSINESS",
    deadline: "2026-09-16T00:00:00.000Z",
    principalProvenance: principal,
    authorityEvidenceRefs: ["evidence:authority-a"],
    policyVersion: "jobs-policy-v1",
    correlationId: "correlation-a",
    causationId: "causation-a",
    ...overrides,
  };
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof DurableJobStoreError && error.code === code);
}

test("durable submit survives reopen and exact replay creates no duplicate job or audit intent", () => {
  const f = fixture();
  try {
    let store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt) });
    const first = store.submitJob(submission());
    assert.equal(first.status, "STORED");
    assert.equal(first.job.id, "job-a");
    assert.deepEqual(first.job.principalProvenance, principal);
    assert.deepEqual(first.job.authorityEvidenceRefs, ["evidence:authority-a"]);
    store.close();

    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("must-not-be-used"), clock: clockSequence(completedAt) });
    const replay = store.submitJob(submission());
    assert.equal(replay.status, "REPLAYED");
    assert.deepEqual(replay.job, first.job);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).map((intent) => intent.eventType), ["JOB_SUBMITTED"]);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("submit rejects conflicting command replay and duplicate generated job identity", () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "job-a"), clock: clockSequence(createdAt, startedAt) });
    store.submitJob(submission());
    expectCode(() => store.submitJob(submission({ purpose: "CONTACT_MANAGEMENT" })), "IDEMPOTENCY_CONFLICT");
    expectCode(() => store.submitJob(submission({ commandId: "domain-command-b", causationId: "causation-b" })), "JOB_IDENTITY_CONFLICT");
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).purpose, "LISTING_GOVERNANCE");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 1);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("submit identity is scoped by tenant scope job type and originating command", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "job-b"), clock: clockSequence(createdAt, startedAt) });
    assert.equal(store.submitJob(submission()).job.id, "job-a");
    assert.equal(store.submitJob(submission({ tenantId: "tenant-b", scopeRef: "team:team-b" })).job.id, "job-b");
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("lifecycle enforces SQL CAS, valid transitions, terminal immutability, and single completion", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt, startedAt, completedAt) });
    const queued = store.submitJob(submission()).job;
    expectCode(() => store!.succeedJob({ jobId: queued.id, expectedVersion: 1, attempt: 1, resultReference: "result:a", resultChecksum: "sha256:result-a", correlationId: "correlation-a", evidenceRefs: ["evidence:result-a"] }), "STATE_TRANSITION_INVALID");
    const running = store.startJob({ jobId: queued.id, expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-a"] });
    assert.equal(running.status, "RUNNING");
    assert.equal(running.version, 2);
    assert.equal(running.attempt, 1);
    expectCode(() => store!.cancelJob({ commandId: "cancel-stale", jobId: queued.id, expectedVersion: 1, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:cancel-a", authorityEvidenceRefs: ["evidence:authority-a"], correlationId: "correlation-a" }), "VERSION_CONFLICT");
    const succeeded = store.succeedJob({ jobId: queued.id, expectedVersion: 2, attempt: 1, resultReference: "result:a", resultChecksum: "sha256:result-a", correlationId: "correlation-a", evidenceRefs: ["evidence:result-a"] });
    assert.equal(succeeded.status, "SUCCEEDED");
    assert.equal(succeeded.version, 3);
    expectCode(() => store!.succeedJob({ jobId: queued.id, expectedVersion: 3, attempt: 1, resultReference: "result:b", resultChecksum: "sha256:result-b", correlationId: "correlation-a", evidenceRefs: ["evidence:result-b"] }), "JOB_ALREADY_TERMINAL");
    expectCode(() => store!.startJob({ jobId: queued.id, expectedVersion: 3, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-b"] }), "JOB_ALREADY_TERMINAL");
    store.close();

    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(completedAt) });
    assert.deepEqual(store.readJobResult({ jobId: queued.id, tenantId: "tenant-a", scopeRef: "team:team-a" }), { status: "SUCCEEDED", resultReference: "result:a", resultChecksum: "sha256:result-a" });
    assert.deepEqual(store.listHistory({ jobId: queued.id, tenantId: "tenant-a", scopeRef: "team:team-a" }).map((record) => record.version), [1, 2, 3]);
    store.close(); store = undefined;
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("stored tenant and scope survive restart and current context cannot rewrite or disclose them", () => {
  const f = fixture();
  try {
    let store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt) });
    store.submitJob(submission());
    store.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(startedAt) });
    const job = store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.equal(job.tenantId, "tenant-a");
    assert.equal(job.scopeRef, "team:team-a");
    expectCode(() => store.readJob({ jobId: "job-a", tenantId: "tenant-b", scopeRef: "team:team-a" }), "JOB_NOT_FOUND");
    expectCode(() => store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-b" }), "JOB_NOT_FOUND");
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("control mutation checks stored tenant and scope before changing a job", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt, startedAt) });
    store.submitJob(submission());
    const wrongTenantCommand = { commandId: "cancel-a", jobId: "job-a", expectedVersion: 1, tenantId: "tenant-b", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:cancel-a", authorityEvidenceRefs: ["evidence:authority-a"], correlationId: "correlation-a" };
    expectCode(() => store!.cancelJob(wrongTenantCommand), "JOB_NOT_FOUND");
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "QUEUED");
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("cancel replay survives restart without duplicating state history or audit intent", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  const command = { commandId: "cancel-a", jobId: "job-a", expectedVersion: 1, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:cancel-a", authorityEvidenceRefs: ["evidence:authority-a"], correlationId: "correlation-a" } as const;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt, completedAt) });
    store.submitJob(submission());
    assert.equal(store.cancelJob(command).status, "STORED");
    store.close(); store = undefined;
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(completedAt) });
    assert.equal(store.cancelJob(command).status, "REPLAYED");
    assert.deepEqual(store.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).map((record) => record.version), [1, 2]);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).map((intent) => intent.eventType), ["JOB_SUBMITTED", "JOB_CANCELLED"]);
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("deadline expiry persists the canonical terminal state and cannot reopen", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt, "2026-09-16T00:00:00.000Z", "2026-09-16T00:00:00.000Z") });
    store.submitJob(submission());
    const expired = store.expireJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:deadline-a"] });
    assert.equal(expired.status, "EXPIRED");
    assert.equal(expired.version, 2);
    store.close(); store = undefined;
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(completedAt) });
    expectCode(() => store!.startJob({ jobId: "job-a", expectedVersion: 2, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-a"] }), "JOB_ALREADY_TERMINAL");
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("failure path accepts only normalized safe evidence and never persists raw diagnostics", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "error-a"), clock: clockSequence(createdAt, startedAt, completedAt) });
    store.submitJob(submission());
    store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-a"] });
    expectCode(() => normalizeJobFailure({ kind: "UNKNOWN" as "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:failure-a" }), "JOB_RESULT_INVALID");
    expectCode(() => normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "C:\\internal\\jobs.sqlite bearer raw-token Error at worker.ts:7" }), "JOB_RESULT_INVALID");
    expectCode(() => store!.failJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, failure: { code: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:forged" }, correlationId: "correlation-a", evidenceRefs: ["evidence:failure-a"] }), "JOB_RESULT_INVALID");
    const failure = normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:dependency-a" });
    const failed = store.failJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, failure, correlationId: "correlation-a", evidenceRefs: ["evidence:failure-a"] });
    assert.equal(failed.failureCode, "DEPENDENCY_UNAVAILABLE");
    assert.equal(failed.systemErrorReference?.id, "error-a");
    assert.equal(store.readJobResult({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).failureEvidenceRef, "evidence:dependency-a");
    const serialized = JSON.stringify({ failed, intents: store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }) });
    assert.equal(/sqlite|bearer|raw-token|worker\.ts/iu.test(serialized), false);
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("audit intents use canonical API-017 source and persisted records reject unknown unsafe fields", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt) });
    store.submitJob(submission());
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" })[0]?.sourceDomain, "API-017");
    store.close(); store = undefined;
    const raw = new DatabaseSync(f.databasePath);
    const row = raw.prepare("SELECT payload_json FROM jobs_job_records WHERE job_id = ?").get("job-a");
    const payload = JSON.parse(String(row?.["payload_json"])) as Record<string, unknown>;
    payload["rawDiagnostic"] = "C:\\internal\\jobs.sqlite bearer raw-token";
    raw.prepare("UPDATE jobs_job_records SET payload_json = ? WHERE job_id = ?").run(JSON.stringify(payload), "job-a");
    raw.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(startedAt) });
    expectCode(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }), "PERSISTENCE_UNAVAILABLE");
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("persisted lifecycle shape cannot claim RUNNING without canonical execution chronology", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt) });
    store.submitJob(submission());
    store.close(); store = undefined;
    const raw = new DatabaseSync(f.databasePath);
    const row = raw.prepare("SELECT payload_json FROM jobs_job_records WHERE job_id = ?").get("job-a");
    const payload = JSON.parse(String(row?.["payload_json"])) as Record<string, unknown>;
    payload["status"] = "RUNNING";
    raw.prepare("UPDATE jobs_job_records SET status = ?, payload_json = ? WHERE job_id = ?").run("RUNNING", JSON.stringify(payload), "job-a");
    raw.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(startedAt) });
    expectCode(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }), "PERSISTENCE_UNAVAILABLE");
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("audit intent reads fail closed on stored tenant scope mismatch or unknown unsafe fields", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt) });
    store.submitJob(submission());
    store.close(); store = undefined;
    const raw = new DatabaseSync(f.databasePath);
    const row = raw.prepare("SELECT payload_json FROM jobs_audit_intents LIMIT 1").get();
    const payload = JSON.parse(String(row?.["payload_json"])) as Record<string, unknown>;
    payload["intentId"] = "job:job-a:v1:JOB_SUBMITTED_TAMPERED";
    payload["visibility"] = { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "team:team-b" };
    payload["rawDiagnostic"] = "C:\\internal\\jobs.sqlite bearer raw-token";
    raw.prepare("INSERT INTO jobs_audit_intents (intent_id, job_id, tenant_id, scope_ref, payload_json) VALUES (?, ?, ?, ?, ?)").run(payload["intentId"] as string, "job-a", "tenant-a", "team:team-a", JSON.stringify(payload));
    raw.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence(startedAt) });
    expectCode(() => store!.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }), "PERSISTENCE_UNAVAILABLE");
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("manual retry creates one durable successor while preserving the failed predecessor", () => {
  const f = fixture();
  try {
    let store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "error-a", "job-b"), clock: clockSequence(createdAt, startedAt, completedAt, completedAt) });
    store.submitJob(submission());
    store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-a"] });
    store.failJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:dependency-a" }), correlationId: "correlation-a", evidenceRefs: ["evidence:failure-a"] });
    const predecessorBefore = store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" });
    const retryInput = { commandId: "retry-command-a", predecessorJobId: "job-a", expectedVersion: 3, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:retry-reason-a", authorityEvidenceRefs: ["evidence:authority-a"], eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"], correlationId: "correlation-a" } as const;
    const first = store.retryAsSuccessor(retryInput);
    assert.equal(first.status, "STORED");
    assert.equal(first.successor.id, "job-b");
    assert.equal(first.successor.predecessorJobId, "job-a");
    assert.deepEqual(first.predecessor, predecessorBefore);
    assert.deepEqual(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }), predecessorBefore);
    const replay = store.retryAsSuccessor(retryInput);
    assert.equal(replay.status, "REPLAYED");
    assert.equal(replay.successor.id, "job-b");
    expectCode(() => store.retryAsSuccessor({ ...retryInput, reasonRef: "evidence:different-reason" }), "IDEMPOTENCY_CONFLICT");
    store.close();

    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("must-not-be-used"), clock: clockSequence(completedAt) });
    assert.equal(store.readJob({ jobId: "job-b", tenantId: "tenant-a", scopeRef: "team:team-a" }).predecessorJobId, "job-a");
    expectCode(() => store.retryAsSuccessor({ ...retryInput, commandId: "retry-command-b" }), "RETRY_NOT_SAFE");
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("successful jobs cannot be retried and automatic execution surfaces remain absent", () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt, startedAt, completedAt) });
    store.submitJob(submission());
    store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-a"] });
    store.succeedJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, resultReference: "result:a", resultChecksum: "sha256:result-a", correlationId: "correlation-a", evidenceRefs: ["evidence:result-a"] });
    expectCode(() => store.retryAsSuccessor({ commandId: "retry-command-a", predecessorJobId: "job-a", expectedVersion: 3, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:retry-reason-a", authorityEvidenceRefs: ["evidence:authority-a"], eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"], correlationId: "correlation-a" }), "RETRY_NOT_SAFE");
    assert.equal("schedule" in store, false);
    assert.equal("poll" in store, false);
    assert.equal("retryAutomatically" in store, false);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("audit-intent failure rolls back state and schema contains no claim heartbeat or final API-016 event table", () => {
  const f = fixture();
  try {
    let store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt), beforeAuditIntentWrite: () => { throw new Error("C:\\internal\\jobs.sqlite raw-token"); } });
    expectCode(() => store.submitJob(submission()), "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence(createdAt) });
    expectCode(() => store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }), "JOB_NOT_FOUND");
    store.close();
    const database = new DatabaseSync(f.databasePath, { readOnly: true });
    const names = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => String(row["name"]));
    assert.equal(names.some((name) => /claim|heartbeat|audit_events/iu.test(name)), false);
    database.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("history idempotency lineage and audit intent evidence are structurally append-only", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "error-a", "job-b"), clock: clockSequence(createdAt, startedAt, completedAt, completedAt) });
    store.submitJob(submission());
    store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:execution-a"] });
    store.failJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:dependency-a" }), correlationId: "correlation-a", evidenceRefs: ["evidence:failure-a"] });
    store.retryAsSuccessor({ commandId: "retry-command-a", predecessorJobId: "job-a", expectedVersion: 3, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:retry-reason-a", authorityEvidenceRefs: ["evidence:authority-a"], eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"], correlationId: "correlation-a" });
    store.close(); store = undefined;
    const database = new DatabaseSync(f.databasePath);
    for (const table of ["jobs_job_history", "jobs_command_idempotency", "jobs_successor_lineage", "jobs_audit_intents"] as const) {
      assert.throws(() => database.exec(`DELETE FROM ${table}`), /append-only/iu);
      assert.throws(() => database.exec(`UPDATE ${table} SET rowid = rowid`), /append-only/iu);
    }
    database.close();
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});
