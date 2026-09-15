import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  AuditIntentMaterializationError,
  AuditIntentMaterializer,
  DurableAuditEventStore,
  createAuditIntentSourcePort,
} from "../../../modules/audit/src/index.js";
import {
  DurableJobStore,
  DurableJobStoreError,
  normalizeJobFailure,
  type SubmitDurableJobInput,
} from "../../../modules/jobs/src/job-durable-persistence.js";

const committedAt = "2026-09-15T01:00:00.000Z";
const materializedAt = "2026-09-15T02:00:00.000Z";
const principal = Object.freeze({
  kind: "TRUSTED_SNAPSHOT" as const,
  principal: Object.freeze({ id: "actor-a", type: "HUMAN" as const, roles: Object.freeze(["OPS" as const]), teamId: "team-a", sessionId: "session-a" }),
});

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

function sequence(...values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `unexpected-${String(index)}`;
}

function expectJobCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof DurableJobStoreError && error.code === code && error.message === code);
}

function api017Source(jobs: DurableJobStore) {
  return createAuditIntentSourcePort({
    sourceDomain: "API-017",
    read: () => jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }),
  });
}

test("Phase 3F materializes an API-017 owner-local enriched intent through API-016", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-red-"));
  const jobs = new DurableJobStore({
    databasePath: join(directory, "jobs.sqlite"),
    idFactory: () => "job-a",
    clock: () => new Date(committedAt),
  });
  const audit = new DurableAuditEventStore({ databasePath: join(directory, "audit.sqlite") });
  try {
    jobs.submitJob(submission());
    const source = createAuditIntentSourcePort({
      sourceDomain: "API-017",
      read: () => jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }),
    });
    const materializer = new AuditIntentMaterializer({ store: audit, clock: () => new Date(materializedAt) });
    const [event] = materializer.consume(source);

    assert.equal(event?.eventType, "JOB_SUBMITTED");
    assert.equal(event?.sourceDomain, "API-017");
    assert.equal(event?.occurredAt, committedAt);
    assert.equal(event?.materializedAt, materializedAt);
    assert.deepEqual(event?.visibility, { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.deepEqual(event?.principal, principal.principal);
  } finally {
    audit.close();
    jobs.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 3F materializes exactly the seven DEC-151 event types across all nine audit points", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-events-"));
  let now = "2026-09-15T00:00:00.000Z";
  const jobs = new DurableJobStore({
    databasePath: join(directory, "jobs.sqlite"),
    idFactory: sequence("job-success", "job-failed", "error-failed", "job-retry", "job-cancel", "job-expire"),
    clock: () => new Date(now),
  });
  const audit = new DurableAuditEventStore({ databasePath: join(directory, "audit.sqlite") });
  try {
    jobs.submitJob({ ...submission(), commandId: "command-success", causationId: "cause-success" });
    now = "2026-09-15T00:01:00.000Z";
    jobs.startJob({ jobId: "job-success", expectedVersion: 1, correlationId: "correlation-success", evidenceRefs: ["evidence:admission-success"] });
    now = "2026-09-15T00:02:00.000Z";
    jobs.succeedJob({ jobId: "job-success", expectedVersion: 2, attempt: 1, resultReference: "result:success", resultChecksum: "sha256:success", correlationId: "correlation-success", evidenceRefs: ["evidence:result-success"] });

    now = "2026-09-15T00:03:00.000Z";
    jobs.submitJob({ ...submission(), commandId: "command-failed", causationId: "cause-failed" });
    now = "2026-09-15T00:04:00.000Z";
    jobs.startJob({ jobId: "job-failed", expectedVersion: 1, correlationId: "correlation-failed", evidenceRefs: ["evidence:admission-failed"] });
    now = "2026-09-15T00:05:00.000Z";
    jobs.failJob({ jobId: "job-failed", expectedVersion: 2, attempt: 1, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:dependency-failed" }), correlationId: "correlation-failed", evidenceRefs: ["evidence:failure-failed"] });
    now = "2026-09-15T00:06:00.000Z";
    jobs.retryAsSuccessor({ commandId: "command-retry", predecessorJobId: "job-failed", expectedVersion: 3, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, authorityEvidenceRefs: ["evidence:retry-authority"], eligibilityEvidenceRefs: ["evidence:retry-eligible"], reasonRef: "evidence:retry-reason", correlationId: "correlation-retry" });

    now = "2026-09-15T00:07:00.000Z";
    jobs.submitJob({ ...submission(), commandId: "command-cancel", causationId: "cause-cancel" });
    now = "2026-09-15T00:08:00.000Z";
    jobs.cancelJob({ commandId: "cancel-command", jobId: "job-cancel", expectedVersion: 1, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, authorityEvidenceRefs: ["evidence:cancel-authority"], reasonRef: "evidence:cancel-reason", correlationId: "correlation-cancel" });

    now = "2026-09-15T00:09:00.000Z";
    jobs.submitJob({ ...submission(), commandId: "command-expire", causationId: "cause-expire", deadline: "2026-09-15T00:09:30.000Z" });
    now = "2026-09-15T00:10:00.000Z";
    jobs.expireJob({ jobId: "job-expire", expectedVersion: 1, correlationId: "correlation-expire", evidenceRefs: ["evidence:deadline-expired"] });

    const intents = jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.deepEqual(
      [...new Set(intents.map((intent) => intent.eventType))].sort(),
      ["JOB_CANCELLED", "JOB_EXPIRED", "JOB_FAILED", "JOB_RETRY_SUBMITTED", "JOB_STARTED", "JOB_SUBMITTED", "JOB_SUCCEEDED"],
    );
    assert.equal(intents.some((intent) => /CLAIM|HEARTBEAT/u.test(intent.eventType)), false);
    assert.equal(audit.listAll().length, 0, "API-017 mutation does not directly persist final API-016 events");

    const materializer = new AuditIntentMaterializer({ store: audit, clock: () => new Date(materializedAt) });
    const events = materializer.consume(api017Source(jobs));
    assert.equal(events.length, intents.length);
    assert.equal(audit.listAll().length, intents.length);
    const retry = events.find((event) => event.eventType === "JOB_RETRY_SUBMITTED");
    assert.ok(retry);
    assert.equal(retry.target.id, "job-retry");
    assert.ok(retry.evidenceRefs.includes("job:job-failed"));
    assert.equal(retry.reason, "evidence:retry-reason");
    assert.equal(jobs.readJob({ jobId: "job-failed", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "FAILED");
  } finally {
    audit.close();
    jobs.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 3F consumes every eligible API-017 intent beyond the bounded source page", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-pages-"));
  const jobIds = [
    ...Array.from({ length: 100 }, (_, index) => `i_${String(index).padStart(3, "0")}`),
    ...Array.from({ length: 10 }, (_, index) => `iA${String(index).padStart(3, "0")}`),
    ...Array.from({ length: 10 }, (_, index) => `ia${String(index).padStart(3, "0")}`),
  ];
  const jobs = new DurableJobStore({
    databasePath: join(directory, "jobs.sqlite"),
    idFactory: sequence(...jobIds),
    clock: () => new Date(committedAt),
  });
  const audit = new DurableAuditEventStore({ databasePath: join(directory, "audit.sqlite") });
  try {
    for (let index = 0; index < jobIds.length; index += 1) {
      jobs.submitJob({ ...submission(), commandId: `command-${String(index).padStart(3, "0")}`, causationId: `cause-${String(index).padStart(3, "0")}` });
    }
    const materializer = new AuditIntentMaterializer({ store: audit, clock: () => new Date(materializedAt) });
    assert.equal(materializer.consume(api017Source(jobs)).length, jobIds.length);
    assert.equal(audit.listAll().length, jobIds.length);
  } finally {
    audit.close();
    jobs.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 3F retry lineage preserves the existing 100-reference acceptance bound", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-lineage-bound-"));
  let now = "2026-09-15T00:00:00.000Z";
  const jobs = new DurableJobStore({ databasePath: join(directory, "jobs.sqlite"), idFactory: sequence("job-failed", "error-failed", "job-successor"), clock: () => new Date(now) });
  try {
    jobs.submitJob({ ...submission(), commandId: "command-failed", causationId: "cause-failed" });
    now = "2026-09-15T00:01:00.000Z";
    jobs.startJob({ jobId: "job-failed", expectedVersion: 1, correlationId: "correlation-failed", evidenceRefs: ["evidence:admission"] });
    now = "2026-09-15T00:02:00.000Z";
    jobs.failJob({ jobId: "job-failed", expectedVersion: 2, attempt: 1, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:failure" }), correlationId: "correlation-failed", evidenceRefs: ["evidence:failure"] });
    now = "2026-09-15T00:03:00.000Z";
    const authorityEvidenceRefs = Array.from({ length: 98 }, (_, index) => `evidence:authority-${String(index).padStart(3, "0")}`);
    const result = jobs.retryAsSuccessor({ commandId: "command-retry", predecessorJobId: "job-failed", expectedVersion: 3, tenantId: "tenant-a", scopeRef: "team:team-a", principalProvenance: principal, authorityEvidenceRefs, eligibilityEvidenceRefs: ["evidence:eligibility"], reasonRef: "evidence:reason", correlationId: "correlation-retry" });
    assert.equal(result.status, "STORED");
    const intent = jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).find((candidate) => candidate.eventType === "JOB_RETRY_SUBMITTED");
    assert.ok(intent);
    assert.equal(intent.reason, "evidence:reason");
    assert.equal(intent.target.id, "job-successor");
    assert.ok(intent.evidenceRefs.includes("job:job-failed"));
    assert.equal(intent.evidenceRefs.length, 100);
  } finally {
    jobs.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 3F replay and restart preserve one authoritative final event and reject conflicting intent content", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-replay-"));
  const jobsPath = join(directory, "jobs.sqlite");
  const auditPath = join(directory, "audit.sqlite");
  let jobs = new DurableJobStore({ databasePath: jobsPath, idFactory: () => "job-a", clock: () => new Date(committedAt) });
  let audit = new DurableAuditEventStore({ databasePath: auditPath });
  try {
    jobs.submitJob(submission());
    const originalIntent = jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" })[0]!;
    let materializer = new AuditIntentMaterializer({ store: audit, clock: () => new Date(materializedAt) });
    const first = materializer.materialize(originalIntent);
    assert.equal(first.status, "MATERIALIZED");
    jobs.close();
    audit.close();

    jobs = new DurableJobStore({ databasePath: jobsPath, idFactory: () => "unused", clock: () => new Date("2026-09-16T00:00:00.000Z") });
    audit = new DurableAuditEventStore({ databasePath: auditPath });
    materializer = new AuditIntentMaterializer({ store: audit, clock: () => new Date("2026-09-16T01:00:00.000Z") });
    const reopenedIntent = jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" })[0]!;
    const replay = materializer.materialize(reopenedIntent);
    assert.equal(replay.status, "REPLAYED");
    assert.equal(replay.event.id, first.event.id);
    assert.equal(replay.event.occurredAt, committedAt);
    assert.equal(replay.event.materializedAt, materializedAt);
    assert.deepEqual(replay.event.principal, principal.principal);
    assert.deepEqual(replay.event.visibility, { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.equal(jobs.listAuditIntents({ tenantId: "tenant-b", scopeRef: "team:team-b" }).length, 0);
    assert.throws(
      () => materializer.materialize({ ...reopenedIntent, evidenceRefs: [...reopenedIntent.evidenceRefs, "evidence:conflicting"] }),
      (error: unknown) => error instanceof AuditIntentMaterializationError && error.code === "MATERIALIZATION_IDENTITY_CONFLICT",
    );
    assert.equal(audit.listAll().length, 1);
  } finally {
    try { audit.close(); } catch { /* already closed */ }
    try { jobs.close(); } catch { /* already closed */ }
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 3F stale and duplicate terminal writers create no losing audit evidence", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-stale-"));
  const jobs = new DurableJobStore({ databasePath: join(directory, "jobs.sqlite"), idFactory: sequence("job-a"), clock: () => new Date(committedAt) });
  const audit = new DurableAuditEventStore({ databasePath: join(directory, "audit.sqlite") });
  try {
    jobs.submitJob(submission());
    jobs.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-a", evidenceRefs: ["evidence:admission-a"] });
    jobs.succeedJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, resultReference: "result:a", resultChecksum: "sha256:result-a", correlationId: "correlation-a", evidenceRefs: ["evidence:result-a"] });
    const intentCount = jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length;
    expectJobCode(
      () => jobs.failJob({ jobId: "job-a", expectedVersion: 2, attempt: 1, failure: normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:stale" }), correlationId: "correlation-a", evidenceRefs: ["evidence:stale"] }),
      "VERSION_CONFLICT",
    );
    expectJobCode(
      () => jobs.succeedJob({ jobId: "job-a", expectedVersion: 3, attempt: 1, resultReference: "result:b", resultChecksum: "sha256:result-b", correlationId: "correlation-a", evidenceRefs: ["evidence:duplicate"] }),
      "JOB_ALREADY_TERMINAL",
    );
    assert.equal(jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length, intentCount);
    const materializer = new AuditIntentMaterializer({ store: audit, clock: () => new Date(materializedAt) });
    materializer.consume(api017Source(jobs));
    assert.equal(audit.listAll().filter((event) => event.eventType === "JOB_SUCCEEDED").length, 1);
    assert.equal(audit.listAll().filter((event) => event.eventType === "JOB_FAILED").length, 0);
  } finally {
    audit.close();
    jobs.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 3F intent persistence failure rolls back the Job and unsafe failure evidence remains rejected", () => {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-phase3f-atomic-"));
  const jobsPath = join(directory, "jobs.sqlite");
  let jobs = new DurableJobStore({ databasePath: jobsPath, idFactory: () => "job-a", clock: () => new Date(committedAt), beforeAuditIntentWrite: () => { throw new Error("C:\\private\\jobs.sqlite Authorization: NON_SECRET_TEST_VALUE"); } });
  try {
    expectJobCode(() => jobs.submitJob(submission()), "PERSISTENCE_UNAVAILABLE");
    jobs.close();
    jobs = new DurableJobStore({ databasePath: jobsPath, idFactory: () => "job-a", clock: () => new Date(committedAt) });
    expectJobCode(() => jobs.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }), "JOB_NOT_FOUND");
    expectJobCode(() => normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "C:\\private\\jobs.sqlite" }), "JOB_RESULT_INVALID");
    assert.equal(jobs.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 0);
  } finally {
    jobs.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
