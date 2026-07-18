import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { JobService } from "../../../modules/jobs/src/job-service.js";
import { executeBoundary, requireSessionId, type ApiResponse, type RequestContext } from "./contracts.js";

type JobPort = Pick<JobService, "submit" | "readForActor" | "start" | "succeed" | "fail" | "cancel" | "retryAsSuccessor">;

export interface JobApiDependencies {
  readonly jobService: JobPort;
  readonly sessionReader: (sessionId: string) => SessionContext;
}

type Contextual<T> = Omit<T, "actor" | "requestId" | "correlationId"> & { readonly context: RequestContext };
type SubmitInput = Contextual<Parameters<JobService["submit"]>[0]>;
type ReadInput = Contextual<Parameters<JobService["readForActor"]>[0]>;
type StartInput = Contextual<Parameters<JobService["start"]>[0]>;
type SucceedInput = Contextual<Parameters<JobService["succeed"]>[0]>;
type FailInput = Contextual<Parameters<JobService["fail"]>[0]>;
type CancelInput = Contextual<Parameters<JobService["cancel"]>[0]>;
type RetryInput = Contextual<Parameters<JobService["retryAsSuccessor"]>[0]>;

export class JobApi {
  public constructor(private readonly dependencies: JobApiDependencies) {}

  public submit(input: SubmitInput): ApiResponse<ReturnType<JobService["submit"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.submit({
      actor: this.#actor(input.context), jobType: input.jobType, inputReferences: input.inputReferences,
      purpose: input.purpose, privacyClassification: input.privacyClassification, deadline: input.deadline,
      idempotencyKey: input.idempotencyKey, reason: input.reason, causationId: input.causationId,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public read(input: ReadInput): ApiResponse<ReturnType<JobService["readForActor"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.readForActor({
      actor: this.#actor(input.context), jobId: input.jobId,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    }));
  }

  public start(input: StartInput): ApiResponse<ReturnType<JobService["start"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.start(this.#command(input)));
  }

  public succeed(input: SucceedInput): ApiResponse<ReturnType<JobService["succeed"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.succeed({
      ...this.#command(input), resultReference: input.resultReference, resultChecksum: input.resultChecksum,
    }));
  }

  public fail(input: FailInput): ApiResponse<ReturnType<JobService["fail"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.fail({
      ...this.#command(input), failureCode: input.failureCode,
    }));
  }

  public cancel(input: CancelInput): ApiResponse<ReturnType<JobService["cancel"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.cancel({
      ...this.#command(input), reason: input.reason,
    }));
  }

  public retry(input: RetryInput): ApiResponse<ReturnType<JobService["retryAsSuccessor"]>> {
    return executeBoundary(input.context, () => this.dependencies.jobService.retryAsSuccessor({
      ...this.#command(input), reason: input.reason,
    }));
  }

  #command(input: { readonly context: RequestContext; readonly jobId: string; readonly expectedVersion: number }): {
    readonly actor: SessionContext;
    readonly jobId: string;
    readonly expectedVersion: number;
    readonly requestId?: string;
    readonly correlationId: string;
  } {
    return {
      actor: this.#actor(input.context), jobId: input.jobId, expectedVersion: input.expectedVersion,
      ...(input.context.requestId === undefined ? {} : { requestId: input.context.requestId }),
      correlationId: input.context.correlationId,
    };
  }

  #actor(context: RequestContext): SessionContext {
    return this.dependencies.sessionReader(requireSessionId(context));
  }
}
