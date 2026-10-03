import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import {
  PostgreSqlSessionUnitOfWork,
  type AsyncRegisteredServiceWorkloadAuthorityLease,
  type PostgreSqlPoolPort,
} from "../../../modules/identity/src/index.js";
import { AuditLog } from "../../../modules/audit/src/index.js";
import {
  ProductionBootstrapError,
  startProductionRuntime,
  type ProductionAsyncClosableResource,
  type ProductionBootstrapDependencies,
  type ProductionRuntimeConfiguration,
  type ProductionRuntimeHandle,
} from "./production-bootstrap.js";
import {
  createProductionReadinessState,
  type ProductionReadinessState,
  type ProductionRuntimeHttpListenerFactory,
} from "./production-readiness-http.js";
import { assertR3C2AggregateSchemasReady } from "./r3c2-aggregate-readiness.js";
import {createProductionStartupPreparation,type ProductionStartupPreparation} from "./production-startup-preparation.js";
import {
  parseRailwayProductionRuntimeConfiguration,
  type RailwayProductionRuntimeConfiguration,
} from "./production-runtime-configuration.js";
import { createRailwaySealedProductionPostgreSqlPool } from "./production-secret-reference-resolver.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";
import type {ProductionAuthenticationBinding} from "./production-human-identity-contracts.js";
import {createProductionHumanReadinessComponents,validateProductionHumanIdentityReadiness,HumanIdentityReadinessError,type ProductionHumanReadinessComponents} from "./production-human-identity-readiness.js";
import {
  captureRequiredSecretsManifest,
  CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST,
  CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION,
  validateRequiredSecretsManifest,
} from "./production-required-secrets.js";

export type ProductionSignal = "SIGINT" | "SIGTERM";

export type RailwayProductionDependencyClassification =
  | "EXISTING_APPROVED_ADAPTER"
  | "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE"
  | "REQUIRES_R3_B_CHILD_ROOT_POSTGRES"
  | "EXTERNAL_PREREQUISITE"
  | "NEW_IMPLEMENTATION_REQUIRED";

export const RAILWAY_PRODUCTION_DEPENDENCY_CLASSIFICATION = Object.freeze({
  openIdentityAuthorityReadOnly: "EXISTING_APPROVED_ADAPTER",
  validateHumanIdentityAuthority: "EXISTING_APPROVED_ADAPTER",
  resolveRequiredServiceIdentities: "EXISTING_APPROVED_ADAPTER",
  resolveRequiredSecrets: "EXISTING_APPROVED_ADAPTER",
  validateStartupGate: "EXISTING_APPROVED_ADAPTER",
  createSessionUnitOfWork: "EXISTING_APPROVED_ADAPTER",
  assertComponentSchemasReady: "EXISTING_APPROVED_ADAPTER",
  childRootOptions: "REQUIRES_R3_B_CHILD_ROOT_POSTGRES",
  startListeners: "EXISTING_BUT_NOT_PRODUCTION_COMPOSABLE",
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
  humanAuthenticationBindings?:readonly ProductionAuthenticationBinding[],
  requiredSecretsManifest?: unknown,
): ProductionBootstrapDependencies {
  const unreachable = (): never => { throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE"); };
  const unavailablePromise = <Value>(): Promise<Value> => Promise.reject(new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE"));
  const clock = (): Date => new Date();
  const auditSink = new AuditLog({ clock, idFactory: randomUUID });
  let startupConfiguration:RailwayProductionRuntimeConfiguration|undefined;
  let preparation:ProductionStartupPreparation|undefined;
  let humanReadiness:ProductionHumanReadinessComponents|undefined;
  const explicitHumanBindings=humanAuthenticationBindings===undefined?[]:structuredClone(humanAuthenticationBindings);
  const explicitRequiredSecretsManifest = captureRequiredSecretsManifest(requiredSecretsManifest);
  const freshnessEnvironment=Object.freeze({
    AI_MLS_HUMAN_IDLE_TIMEOUT_MILLISECONDS:environment["AI_MLS_HUMAN_IDLE_TIMEOUT_MILLISECONDS"],
    AI_MLS_HUMAN_ABSOLUTE_LIFETIME_MILLISECONDS:environment["AI_MLS_HUMAN_ABSOLUTE_LIFETIME_MILLISECONDS"],
    AI_MLS_HUMAN_MFA_FRESHNESS_MILLISECONDS:environment["AI_MLS_HUMAN_MFA_FRESHNESS_MILLISECONDS"],
  });
  return Object.freeze({
    parseConfiguration: (raw:unknown):RailwayProductionRuntimeConfiguration=>{
      if(preparation!==undefined)throw new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
      startupConfiguration=parseRailwayProductionRuntimeConfiguration(raw);return startupConfiguration;
    },
    validateConfiguration: () => undefined,
    validateMandatorySecretReferences: () => undefined,
    openPostgreSqlPool: (configuration: ProductionRuntimeConfiguration): Promise<PostgreSqlPoolPort> =>
      Promise.resolve().then(() =>
        createRailwaySealedProductionPostgreSqlPool(
          configuration as RailwayProductionRuntimeConfiguration,
          environment,
          "PG_PRODUCTION_POOL",
        )),
    openIdentityAuthorityReadOnly: (pool:PostgreSqlPoolPort): Promise<AsyncRegisteredServiceWorkloadAuthorityLease> => {
      if(startupConfiguration===undefined||preparation!==undefined)return unavailablePromise();
      preparation=createProductionStartupPreparation(pool,startupConfiguration,clock);
      humanReadiness=createProductionHumanReadinessComponents(pool,clock,auditSink);return Promise.resolve(preparation.authority);
    },
    validateHumanIdentityAuthority:async(configuration:ProductionRuntimeConfiguration):Promise<void>=>{
      if(configuration!==startupConfiguration||humanReadiness===undefined)throw new HumanIdentityReadinessError("COMPOSITION_INPUT");
      await validateProductionHumanIdentityReadiness(freshnessEnvironment,explicitHumanBindings,humanReadiness);
    },
    resolveRequiredServiceIdentities: (authority:AsyncRegisteredServiceWorkloadAuthorityLease,configuration:ProductionRuntimeConfiguration): Promise<readonly ProductionServiceIdentityBinding[]> => {
      if(authority!==preparation?.authority||configuration!==startupConfiguration)return unavailablePromise();
      return preparation.resolveRequired();
    },
    resolveRequiredSecrets: (configuration: ProductionRuntimeConfiguration): Promise<void> => Promise.resolve().then(() => {
      if (configuration.providerExecutionAuthorized !== false) return unreachable();
      validateRequiredSecretsManifest(explicitRequiredSecretsManifest, CURRENT_PRODUCTION_REQUIRED_SECRET_COMPOSITION);
    }),
    validateStartupGate: (configuration:ProductionRuntimeConfiguration,identities:readonly ProductionServiceIdentityBinding[]):string=>{
      if(preparation===undefined||configuration!==startupConfiguration)return unreachable();return preparation.validateStartupGate(identities);
    },
    createSessionUnitOfWork: (pool: PostgreSqlPoolPort): Promise<ProductionAsyncClosableResource> =>
      Promise.resolve(new PostgreSqlSessionUnitOfWork(pool)),
    assertComponentSchemasReady: async (_configuration: ProductionRuntimeConfiguration, pool: PostgreSqlPoolPort): Promise<void> => {
      await assertR3C2AggregateSchemasReady(pool);
    },
    childRootOptions: Object.freeze({
      api014: Object.freeze({ runtimeEnvironment: "PRODUCTION" as const }),
      api015: Object.freeze({
        runtimeEnvironment: "PRODUCTION" as const,
        auditSink,
        policyVersion: "REL002-R3B3",
        clock,
        idFactory: randomUUID,
        sessionResolver: Object.freeze({ resolve: (): Promise<never> => unavailablePromise() }),
      }),
      api018: Object.freeze({
        runtimeEnvironment: "PRODUCTION" as const,
        contextResolver: Object.freeze({ resolve: unreachable }),
        authorizer: Object.freeze({ authorize: unreachable }),
        admission: Object.freeze({ evaluate: unreachable }),
        clock: () => new Date().toISOString(),
        externalObservationSink: Object.freeze({ submit: unreachable }),
        ambiguityCaseWriter: Object.freeze({ linkAmbiguousInvocation: unreachable }),
      }),
      api019: Object.freeze({
        runtimeEnvironment: "PRODUCTION" as const,
        contextResolver: Object.freeze({ resolve: unreachable }),
        authorizer: Object.freeze({ authorize: unreachable }),
        bindingResolver: Object.freeze({ resolve: unreachable }),
        clock: () => new Date().toISOString(),
        unresolvedConflictCaseWriter: Object.freeze({ linkUnresolvedConflict: unreachable }),
      }),
      feat022: Object.freeze({ runtimeEnvironment: "PRODUCTION" as const, snapshotResolver: Object.freeze({ resolve: unreachable }) }),
    }),
    // R3-C4B proves the pre-listener gate only. Activation needs later explicit approval.
    startListeners: (): Promise<ProductionAsyncClosableResource> => {
      void listenerFactory;
      readiness.markNotReady();
      return unavailablePromise();
    },
    startWorkers: unreachable,
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(entry).href === import.meta.url;
}

if (isDirectExecution()) {
  const readiness = createProductionReadinessState();
  // Explicit AO-approved binding supplied by the Production root; factory callers get no default.
  const authenticationBindings:readonly ProductionAuthenticationBinding[]=Object.freeze([Object.freeze({
    adapterId:"ai-mls.identity.first-party-credential.v1",adapterKind:"FIRST_PARTY_CREDENTIAL",
    configurationRef:Object.freeze({schemaVersion:1,adapterId:"ai-mls.identity.first-party-credential.v1",algorithmProfile:"ARGON2ID_V1"}),
  })]);
  void runProductionMain(process.env, createRailwayProductionDependencies(process.env, readiness,undefined,authenticationBindings,CURRENT_PRODUCTION_REQUIRED_SECRETS_MANIFEST), {
    readiness,
  }).then(
    (running) => running.shutdownComplete,
    () => { process.exitCode = 1; },
  );
}
