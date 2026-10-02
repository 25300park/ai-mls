import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  JobExecutionRuntime,
  JobExecutionRuntimeError,
  JobExecutionRegistry,
  type BoundedJobHandler,
  type CanonicalJobHandlerId,
  type JobExecutionAdmissionContext,
  type JobExecutionAdmissionPort,
  type JobExecutionContext,
  type JobExecutionFailureMapper,
} from "./job-execution-runtime.js";
import { DurableJobStore, DurableJobStoreError, normalizeJobFailure, type SubmitDurableJobInput } from "./job-durable-persistence.js";

const handler: BoundedJobHandler = Object.freeze({
  handlerId: "AI-001",
  execute: () => Object.freeze({
    resultReference: "advisory:result-a",
    resultChecksum: "sha256:result-a",
    evidenceRefs: Object.freeze(["evidence:handler-a"]),
  }),
});
const requirementHandler: BoundedJobHandler = Object.freeze({ ...handler, handlerId: "AI-004" });
const matchingHandler: BoundedJobHandler = Object.freeze({ ...handler, handlerId: "AI-005" });

const principal = Object.freeze({
  kind: "TRUSTED_SNAPSHOT" as const,
  principal: Object.freeze({ id: "actor-a", type: "HUMAN" as const, roles: Object.freeze(["OPS" as const]), teamId: "team-a", sessionId: "session-a" }),
});

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(process.cwd(), ".rel001-job-runtime-"));
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

const rejectingFailureMapper: JobExecutionFailureMapper = Object.freeze({
  map: () => { throw new Error("UNMAPPED"); },
});

test("Phase 3D registry resolves only the three approved Job type handler mappings", () => {
  const registry = new JobExecutionRegistry({
    AI_LISTING_PARSE: handler,
    AI_REQUIREMENT_PARSE: requirementHandler,
    AI_MATCHING: matchingHandler,
  });

  const expected = Object.freeze([
    Object.freeze({ jobType: "AI_LISTING_PARSE", handlerId: "AI-001" }),
    Object.freeze({ jobType: "AI_REQUIREMENT_PARSE", handlerId: "AI-004" }),
    Object.freeze({ jobType: "AI_MATCHING", handlerId: "AI-005" }),
  ] satisfies readonly Readonly<{ jobType: string; handlerId: CanonicalJobHandlerId }>[]);

  assert.deepEqual(registry.listMappings(), expected);
  assert.equal(registry.resolve("AI_LISTING_PARSE")?.handlerId, "AI-001");
  assert.equal(registry.resolve("AI_REQUIREMENT_PARSE")?.handlerId, "AI-004");
  assert.equal(registry.resolve("AI_MATCHING")?.handlerId, "AI-005");
  assert.equal(registry.readiness(), "READY");
});

test("Phase 3D registry accepts an approved application handler implemented as a class", () => {
  class ApplicationHandler implements BoundedJobHandler {
    readonly handlerId = "AI-001" as const;

    async execute(): Promise<Awaited<ReturnType<BoundedJobHandler["execute"]>>> {
      return (await handler.execute({} as never));
    }
  }

  const applicationHandler = new ApplicationHandler();
  const registry = new JobExecutionRegistry({
    AI_LISTING_PARSE: applicationHandler,
    AI_REQUIREMENT_PARSE: requirementHandler,
    AI_MATCHING: matchingHandler,
  });

  assert.equal(registry.readiness(), "READY");
  assert.equal(registry.resolve("AI_LISTING_PARSE")?.handler, applicationHandler);
});

test("Phase 3D registry fails closed for unknown or unmapped Job types without fallback", () => {
  const incomplete = new JobExecutionRegistry({ AI_LISTING_PARSE: handler });

  assert.equal(incomplete.resolve("RETENTION_DELETE"), undefined);
  assert.equal(incomplete.resolve("AI_REQUIREMENT_PARSE"), undefined);
  assert.equal(incomplete.readiness(), "NOT_READY");
  assert.deepEqual(incomplete.listMappings(), [
    Object.freeze({ jobType: "AI_LISTING_PARSE", handlerId: "AI-001" }),
  ]);

  assert.throws(
    () => new JobExecutionRegistry({ AI_LISTING_PARSE: handler, RETENTION_DELETE: handler } as never),
    /JOB_HANDLER_REGISTRY_INVALID/,
  );
});

test("Phase 3D registry rejects a handler whose declared canonical identity is swapped", () => {
  const swapped = Object.freeze({ ...handler, handlerId: "AI-004" });

  assert.throws(
    () => new JobExecutionRegistry({ AI_LISTING_PARSE: swapped, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
    /JOB_HANDLER_REGISTRY_INVALID/,
  );
});

test("Phase 3D blocked live admission leaves the durable queued Job unchanged and invokes no handler", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    let handlerCalls = 0;
    const blockedHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: async () => { handlerCalls += 1; return (await handler.execute({} as never)); } });
    const admission: JobExecutionAdmissionPort = Object.freeze({ evaluate: () => Object.freeze({ status: "BLOCKED" as const }) });
    const runtime = new JobExecutionRuntime({ store, registry: new JobExecutionRegistry({ AI_LISTING_PARSE: blockedHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }), admission, failureMapper: rejectingFailureMapper });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "BLOCKED");
    assert.equal(handlerCalls, 0);
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "QUEUED");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).length, 1);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D one-shot execution passes only durable canonical context and persists success", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const contexts: unknown[] = [];
    const executingHandler: BoundedJobHandler = Object.freeze({
      handlerId: "AI-001",
      execute: (context: JobExecutionContext) => {
        contexts.push(context);
        return Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["evidence:handler-a"]) });
      },
    });
    const admission: JobExecutionAdmissionPort = Object.freeze({
      evaluate: (context: JobExecutionAdmissionContext) => {
        assert.deepEqual(context, {
          jobId: "job-a",
          prospectiveAttempt: 1,
          jobType: "AI_LISTING_PARSE",
          tenantId: "tenant-a",
          scopeRef: "team:team-a",
          purpose: "LISTING_GOVERNANCE",
          inputReferences: [{ type: "RawSource", id: "raw-a", version: 3, checksum: "sha256:raw-a-v3" }],
          policyVersion: "jobs-policy-v1",
          originatingAuthorityEvidenceRefs: ["evidence:authority-a"],
          correlationId: "correlation-execute-a",
        });
        return Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) });
      },
    });
    const runtime = new JobExecutionRuntime({ store, registry: new JobExecutionRegistry({ AI_LISTING_PARSE: executingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }), admission, failureMapper: rejectingFailureMapper });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "SUCCEEDED");
    assert.equal(result.handlerId, "AI-001");
    assert.equal(result.job.status, "SUCCEEDED");
    assert.deepEqual(contexts, [{
      jobId: "job-a",
      attempt: 1,
      jobType: "AI_LISTING_PARSE",
      tenantId: "tenant-a",
      scopeRef: "team:team-a",
      purpose: "LISTING_GOVERNANCE",
      inputReferences: [{ type: "RawSource", id: "raw-a", version: 3, checksum: "sha256:raw-a-v3" }],
      policyVersion: "jobs-policy-v1",
      admissionEvidenceRefs: ["evidence:execution-admission-a"],
      originatingAuthorityEvidenceRefs: ["evidence:authority-a"],
      initiatingPrincipalProvenance: principal,
      correlationId: "correlation-execute-a",
    }]);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).map((intent) => intent.eventType), ["JOB_SUBMITTED", "JOB_STARTED", "JOB_SUCCEEDED"]);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D concealment and terminal replay prevent duplicate handler execution", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    let handlerCalls = 0;
    const executingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { handlerCalls += 1; return Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["evidence:handler-a"]) }); } });
    const admission: JobExecutionAdmissionPort = Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) });
    const runtime = new JobExecutionRuntime({ store, registry: new JobExecutionRegistry({ AI_LISTING_PARSE: executingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }), admission, failureMapper: rejectingFailureMapper });

    await assert.rejects(
      async () => (await runtime.execute({ jobId: "job-a", tenantId: "tenant-b", scopeRef: "team:team-a", correlationId: "correlation-wrong-tenant" })),
      (error: unknown) => error instanceof DurableJobStoreError && error.code === "JOB_NOT_FOUND",
    );
    assert.equal(handlerCalls, 0);
    assert.equal((await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" })).status, "SUCCEEDED");
    const replay = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-replay-a" }));
    assert.equal(replay.status, "REPLAYED");
    assert.equal(replay.job.status, "SUCCEEDED");
    assert.equal(handlerCalls, 1);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Production commit revalidation denial leaves the durable running result uncommitted without a false failure mutation", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z") });
    store.submitJob(submission());
    let admissionCalls = 0;
    const admission: JobExecutionAdmissionPort = Object.freeze({ evaluate: () => {
      admissionCalls += 1;
      return admissionCalls === 1
        ? Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) })
        : Object.freeze({ status: "BLOCKED" as const });
    } });
    const runtime = new JobExecutionRuntime({ store, registry: new JobExecutionRegistry({ AI_LISTING_PARSE: handler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }), admission, failureMapper: rejectingFailureMapper });
    await assert.rejects(
      async () => (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" })),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "JOB_NOT_EXECUTABLE",
    );
    assert.equal(admissionCalls, 2);
    assert.deepEqual(store.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).map((job) => job.status), ["QUEUED", "RUNNING"]);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D runtime fails closed before mutation when the registry is incomplete", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    const runtime = new JobExecutionRuntime({ store, registry: new JobExecutionRegistry({ AI_LISTING_PARSE: handler }), admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:admission-a"]) }) }), failureMapper: rejectingFailureMapper });

    await assert.rejects(
      async () => (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" })),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "RUNTIME_NOT_READY",
    );
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "QUEUED");
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D trusted failure mapper persists only the canonical normalized failure", async () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "system-error-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const internalFailure = Object.assign(new Error("internal handler failure"), { internalDetail: "not-persisted" });
    const failingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { throw internalFailure; } });
    const mappedContexts: JobExecutionContext[] = [];
    const failureMapper: JobExecutionFailureMapper = Object.freeze({
      map: (error: unknown, context: JobExecutionContext) => {
        assert.equal(error, internalFailure);
        mappedContexts.push(context);
        return normalizeJobFailure({ kind: "DEPENDENCY_UNAVAILABLE", evidenceRef: "evidence:dependency-unavailable-a" });
      },
    });
    const runtime = new JobExecutionRuntime({
      store,
      registry: new JobExecutionRegistry({ AI_LISTING_PARSE: failingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
      admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) }),
      failureMapper,
    });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "FAILED");
    assert.equal(result.handlerId, "AI-001");
    assert.equal(result.job.failureCode, "DEPENDENCY_UNAVAILABLE");
    assert.equal(result.job.failureEvidenceRef, "evidence:dependency-unavailable-a");
    assert.equal(JSON.stringify(result).includes("not-persisted"), false);
    assert.equal(mappedContexts.length, 1);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).map((intent) => intent.eventType), ["JOB_SUBMITTED", "JOB_STARTED", "JOB_FAILED"]);
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D unmapped raw handler exceptions fail closed without persisting diagnostics", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z") });
    store.submitJob(submission());
    const unsafe = "Bearer raw-token C:\\internal\\jobs.sqlite Error at worker.ts:7";
    const failingHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => { throw new Error(unsafe); } });
    const runtime = new JobExecutionRuntime({
      store,
      registry: new JobExecutionRegistry({ AI_LISTING_PARSE: failingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
      admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) }),
      failureMapper: rejectingFailureMapper,
    });

    await assert.rejects(
      async () => (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" })),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "FAILURE_UNMAPPED" && !error.message.includes(unsafe),
    );
    const durable = store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.equal(durable.status, "RUNNING");
    assert.equal(JSON.stringify(durable).includes("raw-token"), false);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a", scopeRef: "team:team-a" }).map((intent) => intent.eventType), ["JOB_SUBMITTED", "JOB_STARTED"]);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D malformed handler success is normalized as JOB_RESULT_INVALID without unsafe fields", async () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "system-error-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const malformedHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => ({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: ["evidence:handler-a"], rawProviderResponse: "secret" }) as never });
    const failureMapper: JobExecutionFailureMapper = Object.freeze({
      map: (error: unknown) => {
        assert.equal(error instanceof JobExecutionRuntimeError && error.code === "HANDLER_RESULT_INVALID", true);
        return normalizeJobFailure({ kind: "JOB_RESULT_INVALID", evidenceRef: "evidence:result-invalid-a" });
      },
    });
    const runtime = new JobExecutionRuntime({
      store,
      registry: new JobExecutionRegistry({ AI_LISTING_PARSE: malformedHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
      admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) }),
      failureMapper,
    });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "FAILED");
    assert.equal(result.job.failureCode, "JOB_RESULT_INVALID");
    assert.equal(JSON.stringify(result).includes("rawProviderResponse"), false);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D shape-valid unsafe success is mapped and durably failed instead of stranded RUNNING", async () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "system-error-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const unsafeResultHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => Object.freeze({ resultReference: "not-a-reference", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["evidence:handler-a"]) }) });
    let mapperCalls = 0;
    const failureMapper: JobExecutionFailureMapper = Object.freeze({
      map: (error: unknown) => {
        mapperCalls += 1;
        assert.equal(error instanceof JobExecutionRuntimeError && error.code === "HANDLER_RESULT_INVALID", true);
        return normalizeJobFailure({ kind: "JOB_RESULT_INVALID", evidenceRef: "evidence:result-invalid-a" });
      },
    });
    const runtime = new JobExecutionRuntime({
      store,
      registry: new JobExecutionRegistry({ AI_LISTING_PARSE: unsafeResultHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
      admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) }),
      failureMapper,
    });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "FAILED");
    assert.equal(result.job.status, "FAILED");
    assert.equal(mapperCalls, 1);
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D unsafe handler evidence is mapped and durably failed instead of stranded RUNNING", async () => {
  const f = fixture();
  let store: DurableJobStore | undefined;
  try {
    store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a", "system-error-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    const unsafeEvidenceHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: () => Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["not-a-reference"]) }) });
    let mapperCalls = 0;
    const failureMapper: JobExecutionFailureMapper = Object.freeze({
      map: (error: unknown) => {
        mapperCalls += 1;
        assert.equal(error instanceof JobExecutionRuntimeError && error.code === "HANDLER_RESULT_INVALID", true);
        return normalizeJobFailure({ kind: "JOB_RESULT_INVALID", evidenceRef: "evidence:result-invalid-a" });
      },
    });
    const runtime = new JobExecutionRuntime({
      store,
      registry: new JobExecutionRegistry({ AI_LISTING_PARSE: unsafeEvidenceHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
      admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) }),
      failureMapper,
    });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "FAILED");
    assert.equal(result.job.status, "FAILED");
    assert.equal(mapperCalls, 1);
  } finally {
    store?.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D concurrent invocation cannot overwrite the running CAS path", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z", "2026-09-15T00:01:00.000Z", "2026-09-15T00:02:00.000Z") });
    store.submitJob(submission());
    let nestedError: unknown;
    const executingHandler: BoundedJobHandler = Object.freeze({
      handlerId: "AI-001",
      execute: async () => {
        try {
          (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-concurrent-a" }));
        } catch (error) {
          nestedError = error;
        }
        return Object.freeze({ resultReference: "advisory:result-a", resultChecksum: "sha256:result-a", evidenceRefs: Object.freeze(["evidence:handler-a"]) });
      },
    });
    const runtime = new JobExecutionRuntime({
      store,
      registry: new JobExecutionRegistry({ AI_LISTING_PARSE: executingHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }),
      admission: Object.freeze({ evaluate: () => Object.freeze({ status: "ALLOWED" as const, evidenceRefs: Object.freeze(["evidence:execution-admission-a"]) }) }),
      failureMapper: rejectingFailureMapper,
    });

    const result = (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" }));

    assert.equal(result.status, "SUCCEEDED");
    assert.equal(nestedError instanceof JobExecutionRuntimeError && nestedError.code === "JOB_NOT_EXECUTABLE", true);
    assert.deepEqual(store.listHistory({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).map((job) => job.status), ["QUEUED", "RUNNING", "SUCCEEDED"]);
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("Phase 3D malformed admission authority fails before start or handler invocation", async () => {
  const f = fixture();
  try {
    const store = new DurableJobStore({ databasePath: f.databasePath, idFactory: sequence("job-a"), clock: clockSequence("2026-09-15T00:00:00.000Z") });
    store.submitJob(submission());
    let handlerCalls = 0;
    const guardedHandler: BoundedJobHandler = Object.freeze({ handlerId: "AI-001", execute: async () => { handlerCalls += 1; return (await handler.execute({} as never)); } });
    const malformedAdmission: JobExecutionAdmissionPort = Object.freeze({
      evaluate: () => ({ status: "ALLOWED", evidenceRefs: ["evidence:execution-admission-a"], actorRole: "SYSTEM_ADMIN" }) as never,
    });
    const runtime = new JobExecutionRuntime({ store, registry: new JobExecutionRegistry({ AI_LISTING_PARSE: guardedHandler, AI_REQUIREMENT_PARSE: requirementHandler, AI_MATCHING: matchingHandler }), admission: malformedAdmission, failureMapper: rejectingFailureMapper });

    await assert.rejects(
      async () => (await runtime.execute({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a", correlationId: "correlation-execute-a" })),
      (error: unknown) => error instanceof JobExecutionRuntimeError && error.code === "ADMISSION_INVALID",
    );
    assert.equal(handlerCalls, 0);
    assert.equal(store.readJob({ jobId: "job-a", tenantId: "tenant-a", scopeRef: "team:team-a" }).status, "QUEUED");
    store.close();
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
