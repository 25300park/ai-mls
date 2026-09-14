import { DurableJobStore, type DurableJobType } from "./job-durable-persistence.js";
import {
  JobExecutionRegistry,
  JobExecutionRuntime,
  type BoundedJobHandler,
  type JobExecutionAdmissionPort,
  type JobExecutionFailureMapper,
} from "./job-execution-runtime.js";

export interface StagingJobExecutionRuntimeOptions {
  readonly environment: "Staging";
  readonly databasePath: string;
  readonly idFactory: () => string;
  readonly clock: () => Date;
  readonly handlers: Readonly<Partial<Record<DurableJobType, BoundedJobHandler>>>;
  readonly admission: JobExecutionAdmissionPort;
  readonly failureMapper: JobExecutionFailureMapper;
}

export interface StagingJobExecutionRuntimeComposition {
  readonly runtime: JobExecutionRuntime;
  status(): Readonly<{
    readonly health: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
    readonly readiness: "READY" | "NOT_READY" | "UNKNOWN";
    readonly handlerMappings: ReturnType<JobExecutionRegistry["listMappings"]>;
  }>;
  close(): void;
}

export function createStagingJobExecutionRuntime(options: StagingJobExecutionRuntimeOptions): StagingJobExecutionRuntimeComposition {
  if (!exactOptions(options) || options.environment !== "Staging") throw new Error("STAGING_JOB_RUNTIME_CONFIGURATION_INVALID");
  const store = new DurableJobStore({ databasePath: options.databasePath, idFactory: options.idFactory, clock: options.clock });
  try {
    const registry = new JobExecutionRegistry(options.handlers);
    const runtime = new JobExecutionRuntime({ store, registry, admission: options.admission, failureMapper: options.failureMapper });
    let closed = false;
    const composition = {
      runtime,
      status: (): ReturnType<StagingJobExecutionRuntimeComposition["status"]> => immutable({
        health: closed ? "UNHEALTHY" as const : "HEALTHY" as const,
        readiness: closed ? "NOT_READY" as const : registry.readiness(),
        handlerMappings: registry.listMappings(),
      }),
      close: (): void => {
        if (closed) return;
        store.close();
        closed = true;
      },
    };
    return Object.freeze(composition);
  } catch (error) {
    store.close();
    throw error;
  }
}

function exactOptions(value: unknown): value is StagingJobExecutionRuntimeOptions {
  if (!plain(value)) return false;
  const keys = Object.keys(value).sort();
  return JSON.stringify(keys) === JSON.stringify(["admission", "clock", "databasePath", "environment", "failureMapper", "handlers", "idFactory"])
    && typeof value["databasePath"] === "string"
    && typeof value["idFactory"] === "function"
    && typeof value["clock"] === "function"
    && plain(value["handlers"])
    && validMethod(value["admission"], "evaluate")
    && validMethod(value["failureMapper"], "map");
}

function validMethod(value: unknown, method: string): boolean {
  return value !== null && (typeof value === "object" || typeof value === "function")
    && typeof (value as Record<string, unknown>)[method] === "function";
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
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
