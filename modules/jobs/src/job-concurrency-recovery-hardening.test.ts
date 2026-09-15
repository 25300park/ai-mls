import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  DurableJobStore,
  DurableJobStoreError,
  normalizeJobFailure,
  type SubmitDurableJobInput,
} from "./job-durable-persistence.js";
import {
  JobExecutionRegistry,
  JobExecutionRuntime,
  JobExecutionRuntimeError,
  type BoundedJobHandler,
  type JobExecutionContext,
  type JobExecutionFailureMapper,
} from "./job-execution-runtime.js";

const principal = Object.freeze({
  kind: "TRUSTED_SNAPSHOT" as const,
  principal: Object.freeze({ id: "actor-a", type: "HUMAN" as const, roles: Object.freeze(["OPS" as const]), teamId: "team-a", sessionId: "session-a" }),
});

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-job-hardening-"));
  return Object.freeze({ directory, databasePath: join(directory, "jobs.sqlite") });
}

function sequence(...values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `unexpected-${String(index)}`;
}

function clockSequence(...values: readonly string[]): () => Date {
  let index = 0;
  return () => new Date(values[index++] ?? values.at(-1) ?? "2026-09-15T00:00:00.000Z");
}

function submission(): SubmitDurableJobInput {
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
  };
}

function expectSafeStoreFailure(run: () => unknown, code = "PERSISTENCE_UNAVAILABLE"): void {
  assert.throws(run, (error: unknown) => error instanceof DurableJobStoreError
    && error.code === code
    && !/sqlite|database|\\|\/|stack|token/iu.test(error.message));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function immutableFingerprint(value: Record<string, unknown>): string {
  const keys = ["id", "jobType", "inputReferences", "purpose", "privacyClassification", "deadline", "idempotencyKey", "requestedBy", "requestedByType", "teamId", "causationId", "createdAt", "tenantId", "scopeRef", "originatingDomainCommandId", "policyVersion", "principalProvenance", "authorityEvidenceRefs", "predecessorJobId"];
  return createHash("sha256").update(canonical(Object.fromEntries(keys.map((key) => [key, value[key]])))).digest("hex");
}

async function concurrentWorkerOperations(input: Readonly<{ databasePath: string; operation: "SUBMIT" | "START"; holdWriteLock?: boolean }>): Promise<readonly Record<string, unknown>[]> {
  const shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  const state = new Int32Array(shared);
  const moduleUrl = new URL("./job-durable-persistence.js", import.meta.url).href;
  const script = `
    const { parentPort, workerData } = require("node:worker_threads");
    const state = new Int32Array(workerData.shared);
    let signalledReady = false;
    const signalReady = () => { if (!signalledReady) { Atomics.add(state, 0, 1); Atomics.notify(state, 0); signalledReady = true; } };
    (async () => {
      const { DurableJobStore } = await import(workerData.moduleUrl);
      const principal = Object.freeze({ kind: "TRUSTED_SNAPSHOT", principal: Object.freeze({ id: "actor-a", type: "HUMAN", roles: Object.freeze(["OPS"]), teamId: "team-a", sessionId: "session-a" }) });
      const submission = { commandId: "domain-command-a", jobType: "AI_LISTING_PARSE", inputReferences: [{ type: "RawSource", id: "raw-a", version: 3, checksum: "sha256:raw-a-v3" }], tenantId: "tenant-a", scopeRef: "team:team-a", purpose: "LISTING_GOVERNANCE", privacyClassification: "CONFIDENTIAL_BUSINESS", deadline: "2026-09-16T00:00:00.000Z", principalProvenance: principal, authorityEvidenceRefs: ["evidence:authority-a"], policyVersion: "jobs-policy-v1", correlationId: "correlation-a", causationId: "causation-a" };
      const store = new DurableJobStore({ databasePath: workerData.databasePath, idFactory: () => workerData.jobId, clock: () => new Date("2026-09-15T00:01:00.000Z"), busyTimeoutMilliseconds: 5000 });
      signalReady();
      Atomics.wait(state, 1, 0);
      let message;
      try {
        const result = workerData.operation === "SUBMIT" ? store.submitJob(submission) : store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-start-a", evidenceRefs: ["evidence:admission-a"] });
        message = { status: result.status, jobId: result.job?.id ?? result.id };
      } catch (error) {
        message = { errorCode: error?.code ?? "UNKNOWN" };
      } finally { store.close(); }
      parentPort.postMessage(message);
    })().catch((error) => { signalReady(); parentPort.postMessage({ errorCode: error?.code ?? "WORKER_FAILURE" }); });
  `;
  const workers: Worker[] = [];
  const results: Promise<Record<string, unknown>>[] = [];
  for (const jobId of ["worker-job-a", "worker-job-b"]) {
    const worker = new Worker(script, { eval: true, workerData: { ...input, jobId, moduleUrl, shared } });
    workers.push(worker);
    results.push(new Promise<Record<string, unknown>>((resolve, reject) => {
      worker.once("message", (result: Record<string, unknown>) => { void worker.terminate().then(() => resolve(result), reject); });
      worker.once("error", reject);
    }));
    const readinessDeadline = Date.now() + 10_000;
    while (Atomics.load(state, 0) < workers.length) {
      if (Date.now() >= readinessDeadline) {
        await Promise.allSettled(workers.map(async (active) => active.terminate()));
        throw new Error("WORKER_READINESS_TIMEOUT");
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  let lock: DatabaseSync | undefined;
  try {
    if (input.holdWriteLock === true) { lock = new DatabaseSync(input.databasePath); lock.exec("BEGIN IMMEDIATE"); }
    Atomics.store(state, 1, 1);
    Atomics.notify(state, 1, workers.length);
    if (lock !== undefined) { await new Promise((resolve) => setTimeout(resolve, 100)); lock.exec("ROLLBACK"); lock.close(); lock = undefined; }
    return await Promise.all(results);
  } finally {
    try { lock?.exec("ROLLBACK"); } catch { /* safe cleanup */ }
    try { lock?.close(); } catch { /* safe cleanup */ }
  }
}

const successHandler: BoundedJobHandler = Object.freeze({
  handlerId: "AI-001",
  execute: () => Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["evidence:handler-a"]) }),
});
const requirementHandler: BoundedJobHandler = Object.freeze({ ...successHandler, handlerId: "AI-004" });
const matchingHandler: BoundedJobHandler = Object.freeze({ ...successHandler, handlerId: "AI-005" });
const admission = Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:admission-a"]) }) });
const rejectingMapper: JobExecutionFailureMapper = Object.freeze({ map: () => { throw new Error("UNMAPPED"); } });

function runtime(store: DurableJobStore, handler: BoundedJobHandler = successHandler, failureMapper: JobExecutionFailureMapper = rejectingMapper): JobExecutionRuntime {
  return new JobExecutionRuntime({
    store,
    registry: new JobExecutionRegistry({ AI_LISTING_PARSE: handler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
    admission,
    failureMapper,
  });
}

test("Phase 3E rejects a current Job row that no longer matches append-only history", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    store.close();

    const raw = new DatabaseSync(f.databasePath);
    const row = raw.prepare("SELECT payload_json FROM jobs_job_records WHERE job_id = ?").get("job-a");
    const payload = JSON.parse(String(row?.["payload_json"])) as Record<string, unknown>;
    payload["version"] = 9;
    raw.prepare("UPDATE jobs_job_records SET version = ?, payload_json = ? WHERE job_id = ?").run(9, JSON.stringify(payload), "job-a");
    raw.close();

    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:01:00.000Z") });
    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }));
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E binds the selected durable row key to the decoded Job identity", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "job-b"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z") });
    store.submitJob(submission());
    store.submitJob({ ...submission(), commandId: "domain-command-b", correlationId: "correlation-b", causationId: "causation-b" });
    store.close();
    const raw = new DatabaseSync(f.databasePath);
    const copied = raw.prepare("SELECT version, status, immutable_fingerprint, payload_json FROM jobs_job_records WHERE job_id = ?").get("job-b");
    assert.ok(copied !== undefined);
    raw.prepare("UPDATE jobs_job_records SET tenant_id = ?, scope_ref = ?, version = ?, status = ?, immutable_fingerprint = ?, payload_json = ? WHERE job_id = ?").run("tenant-a", "team:team-a", Number(copied["version"]), String(copied["status"]), String(copied["immutable_fingerprint"]), String(copied["payload_json"]), "job-a");
    raw.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:02:00.000Z") });
    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }));
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E rejects a successor whose durable predecessor lineage is missing", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({
      databasePath: f.databasePath,
      idFactory: sequence("job-a", "error-a", "job-b"),
      clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z", "2026-09-15T00:03:00.000Z"),
    });
    store.submitJob(submission());
    const running = store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-start-a", evidenceRefs: ["evidence:admission-a"] });
    const failed = store.failJob({
      jobId: "job-a",
      expectedVersion: running.version,
      attempt: running.attempt,
      failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:failure-a" }),
      correlationId: "correlation-fail-a",
      evidenceRefs: ["evidence:admission-a"],
    });
    const retry = store.retryAsSuccessor({
      commandId: "retry-command-a",
      predecessorJobId: failed.id,
      expectedVersion: failed.version,
      tenantId: failed.tenantId,
      scopeRef: failed.scopeRef,
      principalProvenance: principal,
      reasonRef: "evidence:retry-reason-a",
      authorityEvidenceRefs: ["evidence:authority-a"],
      eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"],
      correlationId: "correlation-retry-a",
    });
    assert.equal(retry.successor.id, "job-b");
    store.close();

    const raw = new DatabaseSync(f.databasePath);
    raw.exec("DROP TRIGGER jobs_lineage_no_delete");
    raw.prepare("DELETE FROM jobs_successor_lineage WHERE predecessor_job_id = ?").run("job-a");
    raw.exec("CREATE TRIGGER jobs_lineage_no_delete BEFORE DELETE ON jobs_successor_lineage BEGIN SELECT RAISE(ABORT, 'append-only'); END");
    raw.close();

    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:04:00.000Z") });
    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-b", tenantId: "tenant-a", scopeRef: "team:team-a" }));
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E rejects successor lineage whose causal binding is coherently corrupted", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "error-a", "job-b"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z", "2026-09-15T00:03:00.000Z") });
    store.submitJob(submission());
    const running = store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-start-a", evidenceRefs: ["evidence:admission-a"] });
    const failed = store.failJob({ jobId: "job-a", expectedVersion: running.version, attempt: running.attempt, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:failure-a" }), correlationId: "correlation-fail-a", evidenceRefs: ["evidence:admission-a"] });
    store.retryAsSuccessor({ commandId: "retry-command-a", predecessorJobId: failed.id, expectedVersion: failed.version, tenantId: failed.tenantId, scopeRef: failed.scopeRef, principalProvenance: principal, reasonRef: "evidence:retry-reason-a", authorityEvidenceRefs: ["evidence:authority-a"], eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"], correlationId: "correlation-retry-a" });
    store.close();
    const raw = new DatabaseSync(f.databasePath);
    const row = raw.prepare("SELECT payload_json FROM jobs_job_records WHERE job_id = ?").get("job-b");
    const payload = JSON.parse(String(row?.["payload_json"])) as Record<string, unknown>;
    payload["causationId"] = "job-unrelated";
    const fingerprint = immutableFingerprint(payload);
    raw.exec("DROP TRIGGER jobs_history_no_update");
    raw.prepare("UPDATE jobs_job_records SET immutable_fingerprint = ?, payload_json = ? WHERE job_id = ?").run(fingerprint, JSON.stringify(payload), "job-b");
    raw.prepare("UPDATE jobs_job_history SET payload_json = ? WHERE job_id = ? AND version = ?").run(JSON.stringify(payload), "job-b", 1);
    raw.exec("CREATE TRIGGER jobs_history_no_update BEFORE UPDATE ON jobs_job_history BEGIN SELECT RAISE(ABORT, 'append-only'); END");
    raw.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:04:00.000Z") });
    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-b", tenantId: "tenant-a", scopeRef: "team:team-a" }));
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E overlapping exact submissions converge on one STORED and one REPLAYED result", async () => {
  const f = fixture();
  try {
    const bootstrap = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    bootstrap.close();
    const results = await concurrentWorkerOperations({ databasePath: f.databasePath, operation: "SUBMIT", holdWriteLock: true });
    assert.deepEqual(results.map((result) => result["status"]).sort(), ["REPLAYED", "STORED"]);
    assert.equal(new Set(results.map((result) => result["jobId"])).size, 1);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E command replay identity remains concealed from another tenant and scope", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "job-b", "error-b", "job-c"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z", "2026-09-15T00:03:00.000Z") });
    store.submitJob(submission());
    const cancel = { commandId: "cancel-command-a", jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", expectedVersion: 1, principalProvenance: principal, authorityEvidenceRefs: ["evidence:authority-a"], correlationId: "correlation-cancel-a", reasonRef: "evidence:cancel-reason-a" } as const;
    store.cancelJob(cancel);
    expectSafeStoreFailure(() => store!.cancelJob({ ...cancel, tenantId: "tenant-b", scopeRef: "team:team-b" }), "JOB_NOT_FOUND");

    store.submitJob({ ...submission(), commandId: "domain-command-b", correlationId: "correlation-b", causationId: "causation-b" });
    const running = store.startJob({ jobId: "job-b", expectedVersion: 1, correlationId: "correlation-start-b", evidenceRefs: ["evidence:admission-b"] });
    const failed = store.failJob({ jobId: "job-b", expectedVersion: running.version, attempt: running.attempt, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:failure-b" }), correlationId: "correlation-fail-b", evidenceRefs: ["evidence:admission-b"] });
    const retry = { commandId: "retry-command-a", predecessorJobId: failed.id, expectedVersion: failed.version, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:retry-reason-a", authorityEvidenceRefs: ["evidence:authority-a"], eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"], correlationId: "correlation-retry-a" } as const;
    store.retryAsSuccessor(retry);
    expectSafeStoreFailure(() => store!.retryAsSuccessor({ ...retry, tenantId: "tenant-b", scopeRef: "team:team-b" }), "JOB_NOT_FOUND");
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E normalizes SQLite lock acquisition failure without leaking diagnostics", () => {
  const f = fixture();
  let raw: DatabaseSync | undefined;
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z"), busyTimeoutMilliseconds: 1 });
    store.submitJob(submission());
    raw = new DatabaseSync(f.databasePath);
    raw.exec("BEGIN IMMEDIATE");

    expectSafeStoreFailure(() => store!.cancelJob({
      commandId: "cancel-command-a",
      jobId: "job-a",
      tenantId: "tenant-a",
      scopeRef: "team:team-a",
      expectedVersion: 1,
      principalProvenance: principal,
      authorityEvidenceRefs: ["evidence:authority-a"],
      correlationId: "correlation-cancel-a",
      reasonRef: "evidence:cancel-reason-a",
    }));
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "QUEUED");
    store.close();
  } finally {
    try { raw?.exec("ROLLBACK"); } catch { /* diagnostic connection may already be closed */ }
    try { raw?.close(); } catch { /* safe cleanup */ }
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E every closed-store mutation fails through the bounded store error", () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    store.close();

    expectSafeStoreFailure(() => store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-start-a", evidenceRefs: ["evidence:admission-a"] }));
    expectSafeStoreFailure(() => store.submitJob({ ...submission(), commandId: "domain-command-b" }));
    expectSafeStoreFailure(() => store.succeedJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", correlationId: "correlation-success-a", evidenceRefs: ["evidence:result-a"] }));
    expectSafeStoreFailure(() => store.failJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:failure-a" }), correlationId: "correlation-fail-a", evidenceRefs: ["evidence:failure-a"] }));
    expectSafeStoreFailure(() => store.cancelJob({
      commandId: "cancel-command-a",
      jobId: "job-a",
      tenantId: "tenant-a",
      scopeRef: "team:team-a",
      expectedVersion: 1,
      principalProvenance: principal,
      authorityEvidenceRefs: ["evidence:authority-a"],
      correlationId: "correlation-cancel-a",
      reasonRef: "evidence:cancel-reason-a",
    }));
    expectSafeStoreFailure(() => store.expireJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-expire-a", evidenceRefs: ["evidence:deadline-a"] }));
    expectSafeStoreFailure(() => store.retryAsSuccessor({ commandId: "retry-command-a", predecessorJobId: "job-a", expectedVersion: 1, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, reasonRef: "evidence:retry-reason-a", authorityEvidenceRefs: ["evidence:authority-a"], eligibilityEvidenceRefs: ["evidence:retry-eligibility-a"], correlationId: "correlation-retry-a" }));
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E two durable adapters preserve one start CAS winner and one audit record", () => {
  const f = fixture();
  try {
    const first = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z") });
    first.submitJob(submission());
    const second = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:01:01.000Z") });

    const winner = first.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-winner-a", evidenceRefs: ["evidence:admission-a"] });
    assert.equal(winner.status, "RUNNING");
    expectSafeStoreFailure(
      () => second.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-loser-a", evidenceRefs: ["evidence:admission-a"] }),
      "VERSION_CONFLICT",
    );
    assert.equal(second.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 2);
    assert.equal(second.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).filter((intent) => intent.eventType === "JOB_STARTED").length, 1);
    first.close();
    second.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E concurrent worker threads have exactly one durable start winner", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    store.close();
    const results = await concurrentWorkerOperations({ databasePath: f.databasePath, operation: "START" });
    assert.equal(results.filter((result) => result["status"] === "RUNNING").length, 1);
    assert.equal(results.filter((result) => result["errorCode"] === "VERSION_CONFLICT").length, 1);
    const verify = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:02:00.000Z") });
    assert.equal(verify.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 2);
    assert.equal(verify.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).filter((intent) => intent.eventType === "JOB_STARTED").length, 1);
    verify.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E a stale handler success cannot overwrite a concurrent cancellation", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const cancellingHandler: BoundedJobHandler = Object.freeze({
      handlerId: "AI-001",
      execute: (context: JobExecutionContext) => {
        store!.cancelJob({ commandId: "cancel-command-a", jobId: context.jobId, tenantId: context.tenantId, scopeRef: context.scopeRef, expectedVersion: 2, principalProvenance: principal, authorityEvidenceRefs: ["evidence:authority-a"], correlationId: "correlation-cancel-a", reasonRef: "evidence:cancel-reason-a" });
        return successHandler.execute(context);
      },
    });

    expectSafeStoreFailure(() => runtime(store!, cancellingHandler).execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }), "VERSION_CONFLICT");
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "CANCELLED");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).map((intent) => intent.eventType), ["JOB_SUBMITTED", "JOB_STARTED", "JOB_CANCELLED"]);
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E a stale mapped failure cannot overwrite a concurrently committed success", () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const throwingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { throw new Error("handler failure"); } });
    const mapper: JobExecutionFailureMapper = Object.freeze({
      map: (_error: unknown, context: JobExecutionContext) => {
        store.succeedJob({ jobId: context.jobId, expectedVersion: 2, attempt: context.attempt, resultReference: "advisory:concurrent-result", resultChecksum: "sha256:concurrent-result", correlationId: "correlation-concurrent-success", evidenceRefs: ["evidence:concurrent-success"] });
        return normalizeJobFailure({ kind: "JOB_RESULT_INVALID", evidenceRef: "evidence:mapped-failure" });
      },
    });

    expectSafeStoreFailure(() => runtime(store, throwingHandler, mapper).execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }), "VERSION_CONFLICT");
    const current = store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.equal(current.status, "SUCCEEDED");
    assert.equal(current.resultReference, "advisory:concurrent-result");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).some((intent) => intent.eventType === "JOB_FAILED"), false);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E interrupted final persistence remains RUNNING after restart and is never blindly re-executed", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    let auditWrites = 0;
    store = new DurableJobStore({
      databasePath: f.databasePath,
      idFactory: sequence("job-a"),
      clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z"),
      beforeAuditIntentWrite: () => { auditWrites += 1; if (auditWrites === 3) throw new Error("unsafe storage detail"); },
    });
    store.submitJob(submission());
    expectSafeStoreFailure(() => runtime(store!).execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));
    store.close();

    let handlerCalls = 0;
    const countingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: (context: JobExecutionContext) => { handlerCalls += 1; return successHandler.execute(context); } });
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:03:00.000Z") });
    assert.throws(
      () => runtime(store!, countingHandler).execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-restart-a" }),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "JOB_NOT_EXECUTABLE",
    );
    assert.equal(handlerCalls, 0);
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "RUNNING");
    assert.equal(store.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 2);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 2);
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E terminal replay after restart returns one authoritative result without new evidence", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    assert.equal(runtime(store).execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }).status, "SUCCEEDED");
    store.close();

    let handlerCalls = 0;
    const countingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: (context: JobExecutionContext) => { handlerCalls += 1; return successHandler.execute(context); } });
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:03:00.000Z") });
    const replay = runtime(store, countingHandler).execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-replay-a" });
    assert.equal(replay.status, "REPLAYED");
    assert.equal(replay.job.status, "SUCCEEDED");
    assert.equal(handlerCalls, 0);
    assert.equal(store.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 3);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 3);
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E restart recovery conceals the durable Job from a different tenant or scope", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    store.close();
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:01:00.000Z") });

    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-b", scopeRef: "team:team-a" }), "JOB_NOT_FOUND");
    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-b" }), "JOB_NOT_FOUND");
    assert.deepEqual(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).principalProvenance, principal);
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3E unknown durable handler type remains fail closed after restart", () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    store.close();
    const raw = new DatabaseSync(f.databasePath);
    const current = raw.prepare("SELECT payload_json FROM jobs_job_records WHERE job_id = ?").get("job-a");
    const currentPayload = JSON.parse(String(current?.["payload_json"])) as Record<string, unknown>;
    currentPayload["jobType"] = "UNKNOWN_JOB_TYPE";
    raw.prepare("UPDATE jobs_job_records SET payload_json = ? WHERE job_id = ?").run(JSON.stringify(currentPayload), "job-a");
    raw.close();

    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:01:00.000Z") });
    expectSafeStoreFailure(() => store!.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }));
    store.close();
  } finally {
    try { store?.close(); } catch { /* safe cleanup */ }
    rmSync(f.directory, { recursive: true, force: true });
  }
});
