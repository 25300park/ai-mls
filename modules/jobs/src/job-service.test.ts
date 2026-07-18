import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import {
  AuthorizationService,
  type RoleAssignment,
} from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import {
  JobService,
  type JobPolicy,
  type SubmitJobRequest,
} from "./job-service.js";

function session(
  principalId: string,
  role: "COL" | "OPS" | "SVC",
  principalType: "HUMAN" | "SERVICE" = "HUMAN",
): SessionContext {
  return Object.freeze({
    id: `session-${principalId}`,
    principalId,
    principalType,
    roles: [role],
    teamId: "team-a",
    state: "ACTIVE",
    assurance: principalType === "SERVICE" ? "WORKLOAD" : "MFA",
    isMfaVerified: principalType === "HUMAN",
    authenticatedAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2026-07-19T02:00:00.000Z",
    absoluteExpiresAt: "2026-07-19T03:00:00.000Z",
    familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
  });
}

function fixture(): {
  readonly service: JobService;
  readonly auditLog: AuditLog;
  advance(minutes: number): void;
} {
  let now = new Date("2026-07-19T00:05:00.000Z");
  let sequence = 0;
  const clock = (): Date => new Date(now);
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `audit-job-${String(++sequence)}`,
  });
  const assignments: readonly RoleAssignment[] = [
    { principalId: "user-collector-1", role: "COL" as const },
    { principalId: "user-operations-1", role: "OPS" as const },
    { principalId: "service-worker-1", role: "SVC" as const },
  ].map((subject, index) => ({
    id: `job-assignment-${String(index + 1)}`,
    ...subject,
    teamIds: ["team-a"],
    resourceTypes: ["BackgroundJob"],
    purposes: ["SOURCE_INTAKE"],
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE",
  }));
  const policies: readonly JobPolicy[] = [{
    jobType: "AI_LISTING_PARSE",
    allowedPurposes: ["SOURCE_INTAKE"],
    allowedInputTypes: ["RawSource"],
    maxAttempts: 2,
    retryableFailureCodes: ["DEPENDENCY_UNAVAILABLE"],
  }];
  return {
    service: new JobService({
      policies,
      authorizationService: new AuthorizationService({
        assignments,
        auditSink: auditLog,
        clock,
        policyVersion: "authorization-v1",
      }),
      auditSink: auditLog,
      clock,
      idFactory: () => `job-${String(++sequence)}`,
      policyVersion: "job-v1",
    }),
    auditLog,
    advance(minutes: number): void {
      now = new Date(now.getTime() + minutes * 60 * 1000);
    },
  };
}

function submitRequest(
  overrides: Partial<SubmitJobRequest> = {},
): SubmitJobRequest {
  return {
    actor: session("user-collector-1", "COL"),
    jobType: "AI_LISTING_PARSE",
    inputReferences: [{
      type: "RawSource",
      id: "raw-source-1",
      version: 1,
      checksum: "sha256-input-fixture-1",
    }],
    purpose: "SOURCE_INTAKE",
    privacyClassification: "CONFIDENTIAL_BUSINESS",
    deadline: "2026-07-19T00:35:00.000Z",
    idempotencyKey: "operation-job-1",
    reason: "Parse accepted intake evidence",
    correlationId: "correlation-job-1",
    causationId: "intake-1",
    ...overrides,
  };
}

test("TEST-035 submit is idempotent and queued is not success", () => {
  const { service, auditLog } = fixture();
  const original = service.submit(submitRequest());
  const replay = service.submit(submitRequest());

  assert.equal(original.status, "QUEUED");
  assert.equal(original.resultReference, undefined);
  assert.equal(replay.id, original.id);
  assert.equal(
    auditLog.query({
      requesterId: "test-runner",
      purpose: "TEST_EVIDENCE",
      eventType: "JOB_SUBMITTED",
    })[0]?.outcome,
    "ACCEPTED",
  );
  assert.throws(
    () => service.submit(submitRequest({
      inputReferences: [{
        type: "RawSource",
        id: "raw-source-2",
        version: 1,
        checksum: "sha256-input-fixture-2",
      }],
    })),
    /IDEMPOTENCY_CONFLICT/,
  );
});

test("TEST-035 service worker completes an exact running job", () => {
  const { service } = fixture();
  const queued = service.submit(submitRequest());
  const running = service.start({
    actor: session("service-worker-1", "SVC", "SERVICE"),
    jobId: queued.id,
    expectedVersion: queued.version,
    correlationId: "correlation-job-start",
  });
  const succeeded = service.succeed({
    actor: session("service-worker-1", "SVC", "SERVICE"),
    jobId: running.id,
    expectedVersion: running.version,
    resultReference: "ai-result-1",
    resultChecksum: "sha256-result-fixture-1",
    correlationId: "correlation-job-success",
  });

  assert.equal(running.status, "RUNNING");
  assert.equal(running.attempt, 1);
  assert.equal(succeeded.status, "SUCCEEDED");
  assert.equal(succeeded.resultReference, "ai-result-1");
});

test("TEST-035 rejects late results after deadline expiry", () => {
  const { service, advance } = fixture();
  const queued = service.submit(submitRequest());
  const running = service.start({
    actor: session("service-worker-1", "SVC", "SERVICE"),
    jobId: queued.id,
    expectedVersion: queued.version,
    correlationId: "correlation-job-start-late",
  });
  advance(31);
  const expired = service.expireDue("correlation-job-expire");

  assert.deepEqual(expired.map((job) => job.id), [running.id]);
  assert.throws(
    () => service.succeed({
      actor: session("service-worker-1", "SVC", "SERVICE"),
      jobId: running.id,
      expectedVersion: running.version + 1,
      resultReference: "late-result-1",
      resultChecksum: "sha256-late-result-fixture",
      correlationId: "correlation-job-late-result",
    }),
    /JOB_ALREADY_TERMINAL/,
  );
});

test("TEST-016 retries a transient failure as a bounded successor", () => {
  const { service } = fixture();
  const queued = service.submit(submitRequest());
  const running = service.start({
    actor: session("service-worker-1", "SVC", "SERVICE"),
    jobId: queued.id,
    expectedVersion: queued.version,
    correlationId: "correlation-job-start-failure",
  });
  const failed = service.fail({
    actor: session("service-worker-1", "SVC", "SERVICE"),
    jobId: running.id,
    expectedVersion: running.version,
    failureCode: "DEPENDENCY_UNAVAILABLE",
    correlationId: "correlation-job-failure",
  });
  assert.equal(failed.systemErrorReference?.code, "DEPENDENCY_UNAVAILABLE");
  assert.equal(failed.systemErrorReference?.retryable, true);
  assert.equal("message" in failed.systemErrorReference, false);
  const successor = service.retryAsSuccessor({
    actor: session("user-operations-1", "OPS"),
    jobId: failed.id,
    expectedVersion: failed.version,
    reason: "Retry approved transient failure",
    correlationId: "correlation-job-retry",
  });

  assert.equal(successor.status, "QUEUED");
  assert.equal(successor.predecessorJobId, failed.id);
  assert.equal(successor.attempt, 1);
  assert.equal(service.read(failed.id).successorJobId, successor.id);
});

test("TEST-035 refuses a retry whose inherited deadline has expired", () => {
  const { service, advance } = fixture();
  const queued = service.submit(submitRequest());
  const running = service.start({
    actor: session("service-worker-1", "SVC", "SERVICE"), jobId: queued.id,
    expectedVersion: queued.version, correlationId: "correlation-job-start-expiring-retry",
  });
  const failed = service.fail({
    actor: session("service-worker-1", "SVC", "SERVICE"), jobId: running.id,
    expectedVersion: running.version, failureCode: "DEPENDENCY_UNAVAILABLE",
    correlationId: "correlation-job-fail-expiring-retry",
  });
  advance(31);
  assert.throws(() => service.retryAsSuccessor({
    actor: session("user-operations-1", "OPS"), jobId: failed.id,
    expectedVersion: failed.version, reason: "Deadline is already expired",
    correlationId: "correlation-job-expired-retry",
  }), /JOB_INPUT_STALE/);
});

test("TEST-035 cancel is best effort and cannot rewrite terminal success", () => {
  const { service } = fixture();
  const queued = service.submit(submitRequest());
  const cancelled = service.cancel({
    actor: session("user-operations-1", "OPS"),
    jobId: queued.id,
    expectedVersion: queued.version,
    reason: "Input withdrawn before execution",
    correlationId: "correlation-job-cancel",
  });

  assert.equal(cancelled.status, "CANCELLED");
  assert.throws(
    () => service.cancel({
      actor: session("user-operations-1", "OPS"),
      jobId: cancelled.id,
      expectedVersion: cancelled.version,
      reason: "Repeated cancellation",
      correlationId: "correlation-job-cancel-repeat",
    }),
    /JOB_ALREADY_TERMINAL/,
  );
});
