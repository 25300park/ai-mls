import type {
  AuditPrincipal,
  AuditSink,
  Clock,
  DataClassification,
  IdFactory,
} from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface JobInputReference {
  readonly type: string;
  readonly id: string;
  readonly version: number;
  readonly checksum: string;
}

export interface JobPolicy {
  readonly jobType: string;
  readonly allowedPurposes: readonly string[];
  readonly allowedInputTypes: readonly string[];
  readonly maxAttempts: number;
  readonly retryableFailureCodes: readonly string[];
}

export interface SystemErrorReference {
  readonly id: string;
  readonly category: "DEPENDENCY" | "PROCESSING";
  readonly code: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface BackgroundJob {
  readonly id: string;
  readonly jobType: string;
  readonly status: JobStatus;
  readonly version: number;
  readonly attempt: number;
  readonly inputReferences: readonly JobInputReference[];
  readonly purpose: string;
  readonly privacyClassification: DataClassification;
  readonly deadline: string;
  readonly idempotencyKey: string;
  readonly requestedBy: string;
  readonly requestedByType: "HUMAN" | "SERVICE";
  readonly teamId?: string;
  readonly causationId: string;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly workerId?: string;
  readonly resultReference?: string;
  readonly resultChecksum?: string;
  readonly failureCode?: string;
  readonly systemErrorReference?: SystemErrorReference;
  readonly predecessorJobId?: string;
  readonly successorJobId?: string;
}

export interface SubmitJobRequest {
  readonly actor: SessionContext;
  readonly jobType: string;
  readonly inputReferences: readonly JobInputReference[];
  readonly purpose: string;
  readonly privacyClassification: DataClassification;
  readonly deadline: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly requestId?: string;
  readonly correlationId: string;
  readonly causationId: string;
}

interface JobCommand {
  readonly actor: SessionContext;
  readonly jobId: string;
  readonly expectedVersion: number;
  readonly requestId?: string;
  readonly correlationId: string;
}

interface SucceedJobRequest extends JobCommand {
  readonly resultReference: string;
  readonly resultChecksum: string;
}

interface FailJobRequest extends JobCommand {
  readonly failureCode: string;
}

interface ReasonedJobCommand extends JobCommand {
  readonly reason: string;
}

interface JobServiceDependencies {
  readonly policies: readonly JobPolicy[];
  readonly authorizationService: AuthorizationService;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly idFactory: IdFactory;
  readonly policyVersion: string;
}

interface IdempotencyRecord {
  readonly intent: string;
  readonly jobId: string;
}

const terminalStatuses = new Set<JobStatus>([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

function immutableJob(job: BackgroundJob): BackgroundJob {
  const snapshot = structuredClone(job);
  snapshot.inputReferences.forEach((reference) => Object.freeze(reference));
  Object.freeze(snapshot.inputReferences);
  if (snapshot.systemErrorReference !== undefined) {
    Object.freeze(snapshot.systemErrorReference);
  }
  return Object.freeze(snapshot);
}

function principal(session: SessionContext): AuditPrincipal {
  return {
    id: session.principalId,
    type: session.principalType,
    roles: session.roles,
    ...(session.teamId === undefined ? {} : { teamId: session.teamId }),
    sessionId: session.id,
  };
}

export class JobService {
  readonly #authorizationService: AuthorizationService;
  readonly #auditSink: AuditSink;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #policyVersion: string;
  readonly #policies = new Map<string, JobPolicy>();
  readonly #jobs = new Map<string, BackgroundJob>();
  readonly #idempotency = new Map<string, IdempotencyRecord>();

  public constructor(dependencies: JobServiceDependencies) {
    this.#authorizationService = dependencies.authorizationService;
    this.#auditSink = dependencies.auditSink;
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
    this.#policyVersion = dependencies.policyVersion;
    for (const policy of dependencies.policies) {
      this.#policies.set(policy.jobType, Object.freeze(structuredClone(policy)));
    }
  }

  public submit(request: SubmitJobRequest): BackgroundJob {
    const policy = this.#requirePolicy(request.jobType);
    this.#validateSubmission(request, policy);
    const scope = `${request.actor.principalId}:${request.idempotencyKey}`;
    const intent = this.#submissionIntent(request);
    const prior = this.#idempotency.get(scope);
    if (prior !== undefined) {
      if (prior.intent !== intent) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }
      return this.read(prior.jobId);
    }
    const jobId = this.#idFactory();
    this.#authorize(request.actor, "job.submit", jobId, request);
    const job = immutableJob({
      id: jobId,
      jobType: request.jobType,
      status: "QUEUED",
      version: 1,
      attempt: 0,
      inputReferences: request.inputReferences,
      purpose: request.purpose,
      privacyClassification: request.privacyClassification,
      deadline: request.deadline,
      idempotencyKey: request.idempotencyKey,
      requestedBy: request.actor.principalId,
      requestedByType: request.actor.principalType,
      ...(request.actor.teamId === undefined ? {} : { teamId: request.actor.teamId }),
      causationId: request.causationId,
      createdAt: this.#clock().toISOString(),
    });
    this.#jobs.set(job.id, job);
    this.#idempotency.set(scope, { intent, jobId: job.id });
    this.#record("JOB_SUBMITTED", "job.submit", job, principal(request.actor), request, request.reason);
    return job;
  }

  public read(jobId: string): BackgroundJob {
    const job = this.#jobs.get(jobId);
    if (job === undefined) {
      throw new Error("JOB_NOT_FOUND");
    }
    return job;
  }

  public readForActor(request: {
    readonly actor: SessionContext;
    readonly jobId: string;
    readonly requestId?: string;
    readonly correlationId: string;
  }): BackgroundJob {
    const job = this.read(request.jobId);
    this.#authorize(request.actor, "job.read", job.id, {
      purpose: job.purpose,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      correlationId: request.correlationId,
    });
    return job;
  }

  public start(request: JobCommand): BackgroundJob {
    const current = this.read(request.jobId);
    this.#assertNotTerminal(current);
    this.#assertVersion(current, request.expectedVersion);
    this.#authorize(request.actor, "job.execute", current.id, {
      ...request,
      purpose: current.purpose,
    });
    if (current.status !== "QUEUED") {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    if (this.#clock().getTime() >= new Date(current.deadline).getTime()) {
      throw new Error("JOB_ALREADY_TERMINAL");
    }
    const running = this.#replace({
      ...current,
      status: "RUNNING",
      version: current.version + 1,
      attempt: current.attempt + 1,
      startedAt: this.#clock().toISOString(),
      workerId: request.actor.principalId,
    });
    this.#record("JOB_STARTED", "job.start", running, principal(request.actor), request);
    return running;
  }

  public succeed(request: SucceedJobRequest): BackgroundJob {
    const current = this.read(request.jobId);
    this.#assertNotTerminal(current);
    this.#assertVersion(current, request.expectedVersion);
    this.#authorize(request.actor, "job.execute", current.id, {
      ...request,
      purpose: current.purpose,
    });
    if (
      current.status !== "RUNNING" ||
      current.workerId !== request.actor.principalId ||
      request.resultReference.trim().length === 0 ||
      request.resultChecksum.trim().length === 0
    ) {
      throw new Error("JOB_RESULT_INVALID");
    }
    const succeeded = this.#replace({
      ...current,
      status: "SUCCEEDED",
      version: current.version + 1,
      completedAt: this.#clock().toISOString(),
      resultReference: request.resultReference,
      resultChecksum: request.resultChecksum,
    });
    this.#record("JOB_SUCCEEDED", "job.succeed", succeeded, principal(request.actor), request);
    return succeeded;
  }

  public fail(request: FailJobRequest): BackgroundJob {
    const current = this.read(request.jobId);
    this.#assertNotTerminal(current);
    this.#assertVersion(current, request.expectedVersion);
    this.#authorize(request.actor, "job.execute", current.id, {
      ...request,
      purpose: current.purpose,
    });
    if (
      current.status !== "RUNNING" ||
      current.workerId !== request.actor.principalId ||
      request.failureCode.trim().length === 0
    ) {
      throw new Error("STATE_TRANSITION_INVALID");
    }
    const policy = this.#requirePolicy(current.jobType);
    const retryable = policy.retryableFailureCodes.includes(request.failureCode);
    const failed = this.#replace({
      ...current,
      status: "FAILED",
      version: current.version + 1,
      completedAt: this.#clock().toISOString(),
      failureCode: request.failureCode,
      systemErrorReference: {
        id: this.#idFactory(),
        category: retryable ? "DEPENDENCY" : "PROCESSING",
        code: request.failureCode,
        retryable,
        occurredAt: this.#clock().toISOString(),
      },
    });
    this.#record("JOB_FAILED", "job.fail", failed, principal(request.actor), request, request.failureCode);
    return failed;
  }

  public cancel(request: ReasonedJobCommand): BackgroundJob {
    const current = this.read(request.jobId);
    this.#assertNotTerminal(current);
    this.#assertVersion(current, request.expectedVersion);
    this.#authorize(request.actor, "job.cancel", current.id, {
      ...request,
      purpose: current.purpose,
    });
    if (request.reason.trim().length === 0) {
      throw new Error("JOB_CANCEL_CONFLICT");
    }
    const cancelled = this.#replace({
      ...current,
      status: "CANCELLED",
      version: current.version + 1,
      completedAt: this.#clock().toISOString(),
    });
    this.#record("JOB_CANCELLED", "job.cancel", cancelled, principal(request.actor), request, request.reason);
    return cancelled;
  }

  public retryAsSuccessor(request: ReasonedJobCommand): BackgroundJob {
    const current = this.read(request.jobId);
    this.#assertVersion(current, request.expectedVersion);
    this.#authorize(request.actor, "job.retry", current.id, {
      ...request,
      purpose: current.purpose,
    });
    const policy = this.#requirePolicy(current.jobType);
    if (
      current.status !== "FAILED" ||
      current.failureCode === undefined ||
      !policy.retryableFailureCodes.includes(current.failureCode)
    ) {
      throw new Error("RETRY_NOT_SAFE");
    }
    if (current.attempt >= policy.maxAttempts) {
      throw new Error("RETRY_LIMIT_REACHED");
    }
    if (new Date(current.deadline).getTime() <= this.#clock().getTime()) {
      throw new Error("JOB_INPUT_STALE");
    }
    if (request.reason.trim().length === 0) {
      throw new Error("RETRY_NOT_SAFE");
    }
    const successorId = this.#idFactory();
    const predecessor = this.#replace({
      ...current,
      version: current.version + 1,
      successorJobId: successorId,
    });
    const successor = immutableJob({
      id: successorId,
      jobType: current.jobType,
      status: "QUEUED",
      version: 1,
      attempt: current.attempt,
      inputReferences: current.inputReferences,
      purpose: current.purpose,
      privacyClassification: current.privacyClassification,
      deadline: current.deadline,
      idempotencyKey: `${current.idempotencyKey}:successor:${String(current.attempt + 1)}`,
      requestedBy: request.actor.principalId,
      requestedByType: request.actor.principalType,
      ...(request.actor.teamId === undefined ? {} : { teamId: request.actor.teamId }),
      causationId: current.causationId,
      createdAt: this.#clock().toISOString(),
      predecessorJobId: predecessor.id,
    });
    this.#jobs.set(successor.id, successor);
    this.#record("JOB_RETRY_SUBMITTED", "job.retry", successor, principal(request.actor), request, request.reason);
    return successor;
  }

  public expireDue(correlationId: string): readonly BackgroundJob[] {
    const now = this.#clock();
    const expired: BackgroundJob[] = [];
    for (const job of this.#jobs.values()) {
      if (
        !terminalStatuses.has(job.status) &&
        now.getTime() >= new Date(job.deadline).getTime()
      ) {
        const update = this.#replace({
          ...job,
          status: "EXPIRED",
          version: job.version + 1,
          completedAt: now.toISOString(),
        });
        expired.push(update);
        this.#record(
          "JOB_EXPIRED",
          "job.expire",
          update,
          { id: "scheduler", type: "SERVICE", roles: ["SVC"] },
          { correlationId },
        );
      }
    }
    return Object.freeze(expired);
  }

  #validateSubmission(request: SubmitJobRequest, policy: JobPolicy): void {
    if (
      request.inputReferences.length === 0 ||
      request.idempotencyKey.trim().length === 0 ||
      request.reason.trim().length === 0 ||
      request.causationId.trim().length === 0 ||
      !policy.allowedPurposes.includes(request.purpose) ||
      request.inputReferences.some(
        (reference) =>
          !policy.allowedInputTypes.includes(reference.type) ||
          reference.id.trim().length === 0 ||
          reference.version < 1 ||
          reference.checksum.trim().length === 0,
      ) ||
      new Date(request.deadline).getTime() <= this.#clock().getTime()
    ) {
      throw new Error("JOB_INPUT_STALE");
    }
  }

  #submissionIntent(request: SubmitJobRequest): string {
    return JSON.stringify({
      jobType: request.jobType,
      inputReferences: request.inputReferences,
      purpose: request.purpose,
      privacyClassification: request.privacyClassification,
      deadline: request.deadline,
      causationId: request.causationId,
    });
  }

  #requirePolicy(jobType: string): JobPolicy {
    const policy = this.#policies.get(jobType);
    if (policy === undefined) {
      throw new Error("JOB_TYPE_NOT_ALLOWED");
    }
    return policy;
  }

  #authorize(
    actor: SessionContext,
    action: string,
    jobId: string,
    context: { readonly purpose: string; readonly requestId?: string; readonly correlationId: string },
  ): void {
    const decision = this.#authorizationService.evaluate({
      session: actor,
      action,
      resource: {
        type: "BackgroundJob",
        id: jobId,
        ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
      },
      purpose: context.purpose,
      ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
      correlationId: context.correlationId,
    });
    if (decision.effect === "DENY") {
      throw new Error(decision.reasonCode);
    }
  }

  #assertVersion(job: BackgroundJob, expectedVersion: number): void {
    if (job.version !== expectedVersion) {
      throw new Error("VERSION_CONFLICT");
    }
  }

  #assertNotTerminal(job: BackgroundJob): void {
    if (terminalStatuses.has(job.status)) {
      throw new Error("JOB_ALREADY_TERMINAL");
    }
  }

  #replace(job: BackgroundJob): BackgroundJob {
    const snapshot = immutableJob(job);
    this.#jobs.set(snapshot.id, snapshot);
    return snapshot;
  }

  #record(
    eventType: string,
    action: string,
    job: BackgroundJob,
    actor: AuditPrincipal,
    context: { readonly requestId?: string; readonly correlationId: string },
    reason?: string,
  ): void {
    this.#auditSink.append({
      eventType,
      principal: actor,
      action,
      target: { type: "BackgroundJob", id: job.id, version: job.version },
      purpose: job.purpose,
      policyVersion: this.#policyVersion,
      classification: job.privacyClassification,
      decision: "ALLOW",
      outcome: eventType === "JOB_SUBMITTED" || eventType === "JOB_RETRY_SUBMITTED"
        ? "ACCEPTED"
        : job.status === "FAILED"
          ? "FAILED"
          : "COMPLETED",
      ...(reason === undefined ? {} : { reason }),
      ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
      correlationId: context.correlationId,
      details: {
        jobType: job.jobType,
        status: job.status,
        attempt: job.attempt,
        inputChecksums: job.inputReferences.map((item) => item.checksum),
        ...(job.resultChecksum === undefined ? {} : { resultChecksum: job.resultChecksum }),
        ...(job.predecessorJobId === undefined
          ? {}
          : { predecessorJobId: job.predecessorJobId }),
        ...(job.systemErrorReference === undefined
          ? {}
          : { systemErrorId: job.systemErrorReference.id, failureCode: job.systemErrorReference.code }),
      },
    });
  }
}
