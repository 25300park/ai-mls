import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DurableJobStore, type SubmitDurableJobInput } from "./job-durable-persistence.js";
import { JobExecutionRuntimeError, type BoundedJobHandler, type JobExecutionAdmissionPort, type JobExecutionFailureMapper } from "./job-execution-runtime.js";
import { createStagingJobExecutionRuntime } from "./job-staging-composition.js";

const principal = Object.freeze({
  kind: "TRUSTED_SNAPSHOT" as const,
  principal: Object.freeze({ id: "actor-a", type: "HUMAN" as const, roles: Object.freeze(["OPS" as const]), teamId: "team-a", sessionId: "session-a" }),
});

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-job-composition-"));
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

const handler: BoundedJobHandler = Object.freeze({
  handlerId: "AI-001",
  execute: () => Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["evidence:handler-a"]) }),
});
const requirementHandler: BoundedJobHandler = Object.freeze({ ...handler, handlerId: "AI-004" });
const matchingHandler: BoundedJobHandler = Object.freeze({ ...handler, handlerId: "AI-005" });
const admission: JobExecutionAdmissionPort = Object.freeze({
  evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }),
});
const failureMapper: JobExecutionFailureMapper = Object.freeze({ map: () => { throw new Error("UNMAPPED"); } });

test("Phase 3D Staging composition is READY only with durable store and all three approved handlers", () => {
  const f = fixture();
  try {
    const composition = createStagingJobExecutionRuntime({
      environment: "Staging",
      databasePath: f.databasePath,
      idFactory: sequence("unused"),
      clock: clockSequence("2026-09-15T00:00:00.000Z"),
      handlers: { AI_LISTING_PARSE: handler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler },
      admission,
      failureMapper,
    });

    assert.deepEqual(composition.status(), {
      health: "HEALTHY",
      readiness: "READY",
      handlerMappings: [
        { jobType: "AI_LISTING_PARSE", handlerId: "AI-001" },
        { jobType: "AI_REQUIREMENT_PARSE", handlerId: "AI-004" },
        { jobType: "AI_MATCHING", handlerId: "AI-005" },
      ],
    });
    assert.deepEqual(Object.keys(composition).sort(), ["close", "runtime", "status"]);
    assert.deepEqual(Object.keys(composition.runtime), []);
    composition.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D Staging composition accepts class-based approved application ports", () => {
  class AdmissionPort implements JobExecutionAdmissionPort {
    evaluate(): ReturnType<JobExecutionAdmissionPort["evaluate"]> {
      return Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) });
    }
  }
  class FailureMapper implements JobExecutionFailureMapper {
    map(): ReturnType<JobExecutionFailureMapper["map"]> {
      throw new Error("UNMAPPED");
    }
  }
  const f = fixture();
  try {
    const composition = createStagingJobExecutionRuntime({
      environment: "Staging",
      databasePath: f.databasePath,
      idFactory: sequence("unused"),
      clock: clockSequence("2026-09-15T00:00:00.000Z"),
      handlers: { AI_LISTING_PARSE: handler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler },
      admission: new AdmissionPort(),
      failureMapper: new FailureMapper(),
    });

    assert.equal(composition.status().readiness, "READY");
    composition.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D Staging composition becomes unavailable after its durable store is closed", () => {
  const f = fixture();
  try {
    const composition = createStagingJobExecutionRuntime({
      environment: "Staging",
      databasePath: f.databasePath,
      idFactory: sequence("unused"),
      clock: clockSequence("2026-09-15T00:00:00.000Z"),
      handlers: { AI_LISTING_PARSE: handler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler },
      admission,
      failureMapper,
    });

    composition.close();

    assert.deepEqual(composition.status(), {
      health: "UNHEALTHY",
      readiness: "NOT_READY",
      handlerMappings: [
        { jobType: "AI_LISTING_PARSE", handlerId: "AI-001" },
        { jobType: "AI_REQUIREMENT_PARSE", handlerId: "AI-004" },
        { jobType: "AI_MATCHING", handlerId: "AI-005" },
      ],
    });
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D incomplete handler composition remains NOT_READY and cannot execute", () => {
  const f = fixture();
  try {
    const submitter = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    submitter.submitJob(submission());
    submitter.close();
    const composition = createStagingJobExecutionRuntime({
      environment: "Staging",
      databasePath: f.databasePath,
      idFactory: sequence("unused"),
      clock: clockSequence("2026-09-15T00:01:00.000Z"),
      handlers: { AI_LISTING_PARSE: handler },
      admission,
      failureMapper,
    });

    assert.equal(composition.status().health, "HEALTHY");
    assert.equal(composition.status().readiness, "NOT_READY");
    assert.throws(
      () => composition.runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "RUNTIME_NOT_READY",
    );
    composition.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D Staging composition executes one queued Job without starting background work", () => {
  const f = fixture();
  try {
    const submitter = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    submitter.submitJob(submission());
    submitter.close();
    let handlerCalls = 0;
    const oneShotHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { handlerCalls += 1; return handler.execute({} as never); } });
    const composition = createStagingJobExecutionRuntime({
      environment: "Staging",
      databasePath: f.databasePath,
      idFactory: sequence("unused"),
      clock: clockSequence("2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z"),
      handlers: { AI_LISTING_PARSE: oneShotHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler },
      admission,
      failureMapper,
    });

    const result = composition.runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" });

    assert.equal(result.status, "SUCCEEDED");
    assert.equal(handlerCalls, 1);
    assert.equal(composition.runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-replay-a" }).status, "REPLAYED");
    assert.equal(handlerCalls, 1);
    composition.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D composition rejects non-Staging and non-durable configuration", () => {
  const f = fixture();
  try {
    const options = {
      environment: "Staging" as const,
      databasePath: f.databasePath,
      idFactory: sequence("unused"),
      clock: clockSequence("2026-09-15T00:00:00.000Z"),
      handlers: { AI_LISTING_PARSE: handler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler },
      admission,
      failureMapper,
    };

    assert.throws(() => createStagingJobExecutionRuntime({ ...options, environment: "Production" } as never), /STAGING_JOB_RUNTIME_CONFIGURATION_INVALID/);
    assert.throws(() => createStagingJobExecutionRuntime({ ...options, databasePath: ":memory:" }), /PERSISTENCE_INPUT_INVALID/);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D terminal replay survives restart and invokes no handler again", () => {
  const f = fixture();
  try {
    const submitter = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    submitter.submitJob(submission());
    submitter.close();
    let handlerCalls = 0;
    const executingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { handlerCalls += 1; return handler.execute({} as never); } });
    let composition = createStagingJobExecutionRuntime({ environment: "Staging", databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z"), handlers: { AI_LISTING_PARSE: executingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }, admission, failureMapper });
    assert.equal(composition.runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }).status, "SUCCEEDED");
    composition.close();

    composition = createStagingJobExecutionRuntime({ environment: "Staging", databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:03:00.000Z"), handlers: { AI_LISTING_PARSE: executingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }, admission, failureMapper });
    assert.equal(composition.runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-replay-a" }).status, "REPLAYED");
    assert.equal(handlerCalls, 1);
    composition.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D restart never re-executes a durable RUNNING Job without terminal evidence", () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z") });
    store.submitJob(submission());
    store.startJob({ jobId: "job-a", expectedVersion: 1, correlationId: "correlation-start-a", evidenceRefs: ["evidence:execution-admission-a"] });
    store.close();
    let handlerCalls = 0;
    const guardedHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { handlerCalls += 1; return handler.execute({} as never); } });
    const composition = createStagingJobExecutionRuntime({ environment: "Staging", databasePath: f.databasePath, idFactory: sequence("unused"), clock: clockSequence("2026-09-15T00:02:00.000Z"), handlers: { AI_LISTING_PARSE: guardedHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }, admission, failureMapper });

    assert.throws(
      () => composition.runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-restart-a" }),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "JOB_NOT_EXECUTABLE",
    );
    assert.equal(handlerCalls, 0);
    composition.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
