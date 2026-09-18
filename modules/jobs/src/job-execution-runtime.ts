import { isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";
import { DurableJobStoreError, type DurableJobRecord, type DurableJobStore, type DurableJobType, type NormalizedJobFailure } from "./job-durable-persistence.js";

export type CanonicalJobHandlerId = "AI-001" | "AI-004" | "AI-005";

export interface JobExecutionContext {
  readonly jobId: string;
  readonly attempt: number;
  readonly jobType: DurableJobType;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly purpose: string;
  readonly inputReferences: readonly Readonly<{
    readonly type: string;
    readonly id: string;
    readonly version: number;
    readonly checksum: string;
  }>[];
  readonly policyVersion: string;
  readonly admissionEvidenceRefs: readonly string[];
  readonly originatingAuthorityEvidenceRefs: readonly string[];
  readonly initiatingPrincipalProvenance: DurableJobRecord["principalProvenance"];
  readonly correlationId: string;
}

export interface JobExecutionAdmissionContext {
  readonly jobId: string;
  readonly prospectiveAttempt: number;
  readonly jobType: DurableJobType;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly purpose: string;
  readonly inputReferences: JobExecutionContext["inputReferences"];
  readonly policyVersion: string;
  readonly originatingAuthorityEvidenceRefs: readonly string[];
  readonly correlationId: string;
}

export interface JobExecutionAdmissionPort {
  evaluate(context: JobExecutionAdmissionContext):
    | Readonly<{ readonly status: "ALLOWED"; readonly evidenceRefs: readonly string[] }>
    | Readonly<{ readonly status: "BLOCKED" }>;
}

export interface JobExecutionFailureMapper {
  map(error: unknown, context: JobExecutionContext): NormalizedJobFailure;
}

export interface BoundedJobHandler {
  readonly handlerId: CanonicalJobHandlerId;
  execute(context: JobExecutionContext): Readonly<{
    readonly resultReference: string;
    readonly resultChecksum: string;
    readonly evidenceRefs: readonly string[];
  }>;
}

interface HandlerRegistration {
  readonly handlerId: CanonicalJobHandlerId;
  readonly handler: BoundedJobHandler;
}

export type JobExecutionRuntimeErrorCode = "RUNTIME_NOT_READY" | "JOB_NOT_EXECUTABLE" | "HANDLER_NOT_FOUND" | "ADMISSION_INVALID" | "HANDLER_RESULT_INVALID" | "FAILURE_UNMAPPED";

export class JobExecutionRuntimeError extends Error {
  public constructor(public readonly code: JobExecutionRuntimeErrorCode) {
    super(code);
    this.name = "JobExecutionRuntimeError";
  }
}

export type JobExecutionResult =
  | Readonly<{ readonly status: "BLOCKED"; readonly job: DurableJobRecord }>
  | Readonly<{ readonly status: "REPLAYED"; readonly job: DurableJobRecord }>
  | Readonly<{ readonly status: "SUCCEEDED"; readonly handlerId: CanonicalJobHandlerId; readonly job: DurableJobRecord }>
  | Readonly<{ readonly status: "FAILED"; readonly handlerId: CanonicalJobHandlerId; readonly job: DurableJobRecord }>;

const handlerIds = Object.freeze({
  AI_LISTING_PARSE: "AI-001",
  AI_REQUIREMENT_PARSE: "AI-004",
  AI_MATCHING: "AI-005",
} satisfies Readonly<Record<DurableJobType, CanonicalJobHandlerId>>);

export class JobExecutionRegistry {
  readonly #handlers: Readonly<Partial<Record<DurableJobType, BoundedJobHandler>>>;

  public constructor(handlers: Readonly<Partial<Record<DurableJobType, BoundedJobHandler>>>) {
    if (!plain(handlers) || !Object.keys(handlers).every((key) => key in handlerIds)
      || !Object.entries(handlers).every(([jobType, handler]) => validHandler(handler) && handler.handlerId === handlerIds[jobType as DurableJobType])) {
      throw new Error("JOB_HANDLER_REGISTRY_INVALID");
    }
    this.#handlers = Object.freeze({ ...handlers });
  }

  public resolve(jobType: string): HandlerRegistration | undefined {
    if (!(jobType in handlerIds)) return undefined;
    const canonicalType = jobType as DurableJobType;
    const handler = this.#handlers[canonicalType];
    if (handler === undefined) return undefined;
    return Object.freeze({ handlerId: handlerIds[canonicalType], handler });
  }

  public listMappings(): readonly Readonly<{ jobType: DurableJobType; handlerId: CanonicalJobHandlerId }>[] {
    return Object.freeze((Object.keys(handlerIds) as DurableJobType[])
      .filter((jobType) => this.#handlers[jobType] !== undefined)
      .map((jobType) => Object.freeze({ jobType, handlerId: handlerIds[jobType] })));
  }

  public readiness(): "READY" | "NOT_READY" {
    return this.listMappings().length === 3 ? "READY" : "NOT_READY";
  }
}

export class JobExecutionRuntime {
  readonly #store: DurableJobStore;
  readonly #registry: JobExecutionRegistry;
  readonly #admission: JobExecutionAdmissionPort;
  readonly #failureMapper: JobExecutionFailureMapper;

  public constructor(dependencies: Readonly<{
    readonly store: DurableJobStore;
    readonly registry: JobExecutionRegistry;
    readonly admission: JobExecutionAdmissionPort;
    readonly failureMapper: JobExecutionFailureMapper;
  }>) {
    if (!plain(dependencies) || dependencies.store === undefined || !(dependencies.registry instanceof JobExecutionRegistry)
      || !validMethod(dependencies.admission, "evaluate") || !validMethod(dependencies.failureMapper, "map")) {
      throw runtimeFailure("RUNTIME_NOT_READY");
    }
    this.#store = dependencies.store;
    this.#registry = dependencies.registry;
    this.#admission = dependencies.admission;
    this.#failureMapper = dependencies.failureMapper;
  }

  public execute(input: Readonly<{ readonly jobId: string; readonly tenantId: string; readonly scopeRef: string; readonly correlationId: string }>): JobExecutionResult {
    if (this.#registry.readiness() !== "READY") throw runtimeFailure("RUNTIME_NOT_READY");
    const job = this.#store.readJob(input);
    if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "CANCELLED" || job.status === "EXPIRED") {
      return immutable({ status: "REPLAYED" as const, job });
    }
    if (job.status !== "QUEUED") throw runtimeFailure("JOB_NOT_EXECUTABLE");
    const admissionContext = immutable<JobExecutionAdmissionContext>({
      jobId: job.id,
      prospectiveAttempt: job.attempt + 1,
      jobType: job.jobType,
      tenantId: job.tenantId,
      scopeRef: job.scopeRef,
      purpose: job.purpose,
      inputReferences: job.inputReferences,
      policyVersion: job.policyVersion,
      originatingAuthorityEvidenceRefs: job.authorityEvidenceRefs,
      correlationId: input.correlationId,
    });
    const admission = this.#admission.evaluate(admissionContext);
    if (!validAdmission(admission)) throw runtimeFailure("ADMISSION_INVALID");
    if (admission.status === "BLOCKED") return immutable({ status: "BLOCKED" as const, job });
    const registration = this.#registry.resolve(job.jobType);
    if (registration === undefined) throw runtimeFailure("HANDLER_NOT_FOUND");
    const running = this.#store.startJob({ jobId: job.id, expectedVersion: job.version, correlationId: input.correlationId, evidenceRefs: admission.evidenceRefs });
    const executionContext = immutable<JobExecutionContext>({
      jobId: running.id,
      attempt: running.attempt,
      jobType: running.jobType,
      tenantId: running.tenantId,
      scopeRef: running.scopeRef,
      purpose: running.purpose,
      inputReferences: running.inputReferences,
      policyVersion: running.policyVersion,
      admissionEvidenceRefs: admission.evidenceRefs,
      originatingAuthorityEvidenceRefs: running.authorityEvidenceRefs,
      initiatingPrincipalProvenance: running.principalProvenance,
      correlationId: input.correlationId,
    });
    let outcome: ReturnType<BoundedJobHandler["execute"]>;
    try {
      outcome = registration.handler.execute(executionContext);
      if (!validSuccess(outcome)) throw runtimeFailure("HANDLER_RESULT_INVALID");
    } catch (error) {
      return this.#persistFailure(error, executionContext, running, input.correlationId, registration.handlerId);
    }
    const commitAdmission = this.#admission.evaluate(admissionContext);
    if (!validAdmission(commitAdmission)) throw runtimeFailure("ADMISSION_INVALID");
    if (commitAdmission.status === "BLOCKED") throw runtimeFailure("JOB_NOT_EXECUTABLE");
    let succeeded: DurableJobRecord;
    try {
      succeeded = this.#store.succeedJob({
        jobId: running.id,
        expectedVersion: running.version,
        attempt: running.attempt,
        resultReference: outcome.resultReference,
        resultChecksum: outcome.resultChecksum,
        correlationId: input.correlationId,
        evidenceRefs: outcome.evidenceRefs,
      });
    } catch (error) {
      if (!(error instanceof DurableJobStoreError) || error.code !== "JOB_RESULT_INVALID") throw error;
      return this.#persistFailure(runtimeFailure("HANDLER_RESULT_INVALID"), executionContext, running, input.correlationId, registration.handlerId);
    }
    return immutable({ status: "SUCCEEDED" as const, handlerId: registration.handlerId, job: succeeded });
  }

  #persistFailure(error: unknown, context: JobExecutionContext, running: DurableJobRecord, correlationId: string, handlerId: CanonicalJobHandlerId): JobExecutionResult {
    let failure: NormalizedJobFailure;
    try {
      failure = this.#failureMapper.map(error, context);
    } catch {
      throw runtimeFailure("FAILURE_UNMAPPED");
    }
    const failed = this.#store.failJob({
      jobId: running.id,
      expectedVersion: running.version,
      attempt: running.attempt,
      failure,
      correlationId,
      evidenceRefs: context.admissionEvidenceRefs,
    });
    return immutable({ status: "FAILED" as const, handlerId, job: failed });
  }
}

function validHandler(value: unknown): value is BoundedJobHandler {
  return validMethod(value, "execute") && Object.values(handlerIds).includes((value as BoundedJobHandler).handlerId);
}

function validAdmission(value: unknown): value is ReturnType<JobExecutionAdmissionPort["evaluate"]> {
  if (!plain(value)) return false;
  if (value["status"] === "BLOCKED") return Object.keys(value).every((key) => key === "status");
  return value["status"] === "ALLOWED" && Object.keys(value).every((key) => key === "status" || key === "evidenceRefs") && Array.isArray(value["evidenceRefs"]);
}

function validSuccess(value: unknown): value is ReturnType<BoundedJobHandler["execute"]> {
  return plain(value) && Object.keys(value).every((key) => ["resultReference", "resultChecksum", "evidenceRefs"].includes(key))
    && safeReference(value["resultReference"]) && safeReference(value["resultChecksum"]) && safeReferences(value["evidenceRefs"]);
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value) && !isUnsafeSecurityDetailValue(value)
    && /^[A-Za-z][A-Za-z0-9._-]{0,63}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value);
}

function safeReferences(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(safeReference);
}

function validMethod(value: unknown, method: string): boolean {
  return value !== null && (typeof value === "object" || typeof value === "function")
    && typeof (value as Record<string, unknown>)[method] === "function";
}

function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const nested of Object.values(value)) deepFreeze(nested);
  Object.freeze(value);
}

function runtimeFailure(code: JobExecutionRuntimeErrorCode): JobExecutionRuntimeError {
  return new JobExecutionRuntimeError(code);
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
