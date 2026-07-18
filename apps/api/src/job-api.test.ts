import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { BackgroundJob } from "../../../modules/jobs/src/job-service.js";
import { JobApi, type JobApiDependencies } from "./job-api.js";

const actor: SessionContext = Object.freeze({
  id: "session-ops", principalId: "ops-1", principalType: "HUMAN", roles: ["OPS" as const], teamId: "team-a",
  state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T00:00:00.000Z",
  expiresAt: "2026-07-19T02:00:00.000Z", absoluteExpiresAt: "2026-07-19T03:00:00.000Z",
  familyId: "family-ops", refreshReference: "refresh-ops",
});
const job: BackgroundJob = Object.freeze({
  id: "job-1", jobType: "AI_LISTING_PARSE", status: "QUEUED", version: 1, attempt: 0,
  inputReferences: [{ type: "RawSource", id: "raw-1", version: 1, checksum: "sha256-1" }],
  purpose: "SOURCE_INTAKE", privacyClassification: "CONFIDENTIAL_BUSINESS",
  deadline: "2026-07-19T00:35:00.000Z", idempotencyKey: "operation-1", requestedBy: actor.principalId,
  requestedByType: "HUMAN", teamId: "team-a", causationId: "intake-1", createdAt: "2026-07-19T00:05:00.000Z",
});

test("TEST-035 API-017 derives job actor and preserves queued semantics", () => {
  let seen: SessionContext | undefined;
  const dependencies: JobApiDependencies = {
    sessionReader: () => actor,
    jobService: {
      submit: (request) => { seen = request.actor; return job; }, readForActor: () => job,
      start: () => ({ ...job, status: "RUNNING", version: 2, attempt: 1 }),
      succeed: () => ({ ...job, status: "SUCCEEDED", version: 3, attempt: 1 }),
      fail: () => ({ ...job, status: "FAILED", version: 3, attempt: 1 }),
      cancel: () => ({ ...job, status: "CANCELLED", version: 2 }),
      retryAsSuccessor: () => ({ ...job, id: "job-2", predecessorJobId: job.id }),
    },
  };
  const response = new JobApi(dependencies).submit({
    context: { sessionId: actor.id, correlationId: "correlation-api-017" },
    jobType: job.jobType, inputReferences: job.inputReferences, purpose: job.purpose,
    privacyClassification: job.privacyClassification, deadline: job.deadline,
    idempotencyKey: job.idempotencyKey, reason: "Submit bounded work", causationId: job.causationId,
  });
  assert.equal(response.ok, true);
  if (response.ok) assert.equal(response.data.status, "QUEUED");
  assert.equal(seen, actor);
});
