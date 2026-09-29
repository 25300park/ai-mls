import { pathToFileURL } from "node:url";

import {
  PostgreSqlSessionUnitOfWork,
  type AsyncRegisteredServiceWorkloadAuthorityLease,
  type PostgreSqlPoolPort,
} from "../../../modules/identity/src/index.js";
import {
  ProductionBootstrapError,
  startProductionRuntime,
  type ProductionAsyncClosableResource,
  type ProductionBootstrapDependencies,
  type ProductionBootstrapContextView,
  type ProductionChildRoot,
  type ProductionRuntimeConfiguration,
  type ProductionRuntimeHandle,
} from "./production-bootstrap.js";
import {
  createProductionReadinessState,
  createProductionRuntimeListenerStarter,
  type ProductionReadinessState,
  type ProductionRuntimeHttpListenerFactory,
} from "./production-readiness-http.js";
import {
  parseRailwayProductionRuntimeConfiguration,
  type RailwayProductionRuntimeConfiguration,
} from "./production-runtime-configuration.js";
import { createRailwaySealedProductionPostgreSqlPool } from "./production-secret-reference-resolver.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";

export type ProductionSignal = "SIGINT" | "SIGTERM";

export type RailwayProductionDependencyClassification =
  | "EXISTING_APPROVED_ADAPTER"
  | "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE"
  | "REQUIRES_R3_B_CHILD_ROOT_POSTGRES"
  | "EXTERNAL_PREREQUISITE"
  | "NEW_IMPLEMENTATION_REQUIRED";

export const RAILWAY_PRODUCTION_DEPENDENCY_CLASSIFICATION = Object.freeze({
  openIdentityAuthorityReadOnly: "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE",
  validateHumanIdentityAuthority: "NEW_IMPLEMENTATION_REQUIRED",
  resolveRequiredServiceIdentities: "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE",
  resolveRequiredSecrets: "EXTERNAL_PREREQUISITE",
  validateStartupGate: "NEW_IMPLEMENTATION_REQUIRED",
  createSessionUnitOfWork: "EXISTING_APPROVED_ADAPTER",
  assertComponentSchemasReady: "REQUIRES_R3_B_CHILD_ROOT_POSTGRES",
  childRootOptions: "REQUIRES_R3_B_CHILD_ROOT_POSTGRES",
  startListeners: "EXISTING_APPROVED_ADAPTER",
  startWorkers: "NEW_IMPLEMENTATION_REQUIRED",
} satisfies Readonly<Record<string, RailwayProductionDependencyClassification>>);

export interface RunningProductionMain {
  readonly shutdownComplete: Promise<void>;
  shutdown(): Promise<void>;
}

export interface ProductionMainRuntimeOptions {
  readonly readiness: ProductionReadinessState;
  readonly startRuntime?: (
    rawConfiguration: unknown,
    dependencies: ProductionBootstrapDependencies,
  ) => Promise<ProductionRuntimeHandle>;
  readonly installSignalHandler?: (handler: (signal: ProductionSignal) => void) => () => void;
  readonly shutdownTimeoutMilliseconds?: number;
  readonly handleShutdownFailure?: () => void;
  readonly terminateProcess?: (exitCode: 1) => void;
}

export async function runProductionMain(
  rawConfiguration: unknown,
  dependencies: ProductionBootstrapDependencies,
  options: ProductionMainRuntimeOptions,
): Promise<RunningProductionMain> {
  options.readiness.markNotReady();
  let resolveShutdown!: () => void;
  const shutdownComplete = new Promise<void>((resolve) => { resolveShutdown = resolve; });
  let runtime: ProductionRuntimeHandle | undefined;
  let stopRequested = false;
  let shutdownPromise: Promise<void> | undefined;
  const failureHandler = options.handleShutdownFailure ?? markProcessFailure;
  const terminateProcess = options.terminateProcess ?? hardTerminateProcess;
  let uninstall = (options.installSignalHandler ?? installProcessSignalHandler)(() => {
    stopRequested = true;
    options.readiness.markNotReady();
    if (runtime !== undefined) void shutdown();
  });
  const shutdown = (): Promise<void> => {
    if (shutdownPromise !== undefined) return shutdownPromise;
    stopRequested = true;
    options.readiness.markNotReady();
    if (runtime === undefined) return shutdownComplete;
    shutdownPromise = (async (): Promise<void> => {
      let failed = false;
      try {
        await withTimeout(runtime.close(), options.shutdownTimeoutMilliseconds ?? 30_000);
      } catch {
        failed = true;
      } finally {
        uninstall();
        uninstall = (): void => undefined;
        if (failed) {
          failureHandler();
          terminateProcess(1);
        }
        resolveShutdown();
      }
    })();
    return shutdownPromise;
  };
  try {
    runtime = await (options.startRuntime ?? startProductionRuntime)(rawConfiguration, dependencies);
    if (runtime.readiness() !== "READY") {
      await runtime.close();
      throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
    }
  } catch (error) {
    options.readiness.markNotReady();
    uninstall();
    throw error instanceof ProductionBootstrapError
      ? error
      : new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
  }
  if (stopRequested) void shutdown();
  else options.readiness.markReady();
  return Object.freeze({ shutdownComplete, shutdown });
}

async function withTimeout(operation: Promise<void>, milliseconds: number): Promise<void> {
  if (!Number.isInteger(milliseconds) || milliseconds < 1 || milliseconds > 30_000) {
    throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE")), milliseconds);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function installProcessSignalHandler(handler: (signal: ProductionSignal) => void): () => void {
  const onSigint = (): void => handler("SIGINT");
  const onSigterm = (): void => handler("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  return () => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };
}

function markProcessFailure(): void {
  process.exitCode = 1;
}

function hardTerminateProcess(exitCode: 1): void {
  process.exit(exitCode);
}

/**
 * The Railway sealed-value boundary is repository-ready, but startup remains
 * fail closed until the exact Production service variables are human-bound.
 * Every dependency outside the bounded secret/pool boundary remains governed
 * by its existing separately authorized composition.
 */
export function createRailwayProductionDependencies(
  environment: Readonly<Record<string, string | undefined>>,
  readiness: ProductionReadinessState = createProductionReadinessState(),
  listenerFactory?: ProductionRuntimeHttpListenerFactory,
): ProductionBootstrapDependencies {
  const unreachable = (): never => { throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE"); };
  const unavailablePromise = <Value>(): Promise<Value> => Promise.reject(new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE"));
  return Object.freeze({
    parseConfiguration: parseRailwayProductionRuntimeConfiguration,
    validateConfiguration: () => undefined,
    validateMandatorySecretReferences: () => undefined,
    openPostgreSqlPool: (configuration: ProductionRuntimeConfiguration): Promise<PostgreSqlPoolPort> =>
      Promise.resolve().then(() =>
        createRailwaySealedProductionPostgreSqlPool(
          configuration as RailwayProductionRuntimeConfiguration,
          environment,
          "PG_IDENTITY_POOL",
        )),
    openIdentityAuthorityReadOnly: (): Promise<AsyncRegisteredServiceWorkloadAuthorityLease> => unavailablePromise(),
    validateHumanIdentityAuthority: unreachable,
    resolveRequiredServiceIdentities: (): Promise<readonly ProductionServiceIdentityBinding[]> => unavailablePromise(),
    resolveRequiredSecrets: (): Promise<void> => unavailablePromise(),
    validateStartupGate: unreachable,
    createSessionUnitOfWork: (pool: PostgreSqlPoolPort): Promise<ProductionAsyncClosableResource> =>
      Promise.resolve(new PostgreSqlSessionUnitOfWork(pool)),
    assertComponentSchemasReady: (): Promise<void> => unavailablePromise(),
    childRootOptions: null,
    startListeners: (context: ProductionBootstrapContextView, roots: readonly ProductionChildRoot[]) => createProductionRuntimeListenerStarter(
      parseRailwayProductionRuntimeConfiguration(environment),
      readiness,
      listenerFactory,
    )(context, roots),
    startWorkers: unreachable,
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(entry).href === import.meta.url;
}

if (isDirectExecution()) {
  const readiness = createProductionReadinessState();
  void runProductionMain(process.env, createRailwayProductionDependencies(process.env, readiness), {
    readiness,
  }).then(
    (running) => running.shutdownComplete,
    () => { process.exitCode = 1; },
  );
}
