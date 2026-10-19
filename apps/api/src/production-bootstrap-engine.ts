import { ChildRootSchemaReadinessError } from "./child-root-postgresql-readiness.js";
import { emitRuntimeDatabaseDiagnostic, safeRuntimeDatabaseFailure } from "./production-runtime-pool.js";
import { issueProductionBootstrapContext } from "../../../packages/security-contracts/src/production-bootstrap-proof.js";
import {
  ProductionBootstrapError,
  type ProductionBootstrapDependencies,
  type ProductionChildRoot,
  type ProductionChildRootFactories,
  type ProductionRuntimeConfiguration,
  type ProductionRuntimeHandle,
} from "./production-bootstrap.js";
import type { ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";
import type { AsyncRegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/index.js";
import { ProductionRuntimeActivation, ProductionRuntimeActivationError, ProductionCleanupBudget, validateRequiredWorkersManifest } from "./production-runtime-activation.js";
import { ProductionRuntimeObservability, safeStartupFailureCode, type ProductionObservedFailureCode } from "./production-runtime-observability.js";

const activeCompositions = new WeakSet<ProductionBootstrapEngineDependencies>();

export interface ProductionBootstrapEngineDependencies extends Omit<ProductionBootstrapDependencies, "childRootOptions"> {
  readonly childRootFactories: ProductionChildRootFactories;
  readonly cleanupTimeoutMilliseconds?: number;
}

export interface ProductionPreListenerStartupChainResult {
  readonly status: "READY";
  readonly validationFingerprint: string;
  readonly identities: readonly ProductionServiceIdentityBinding[];
}

export type ProductionPreListenerGateDependencies = Pick<ProductionBootstrapDependencies,
  "resolveRequiredServiceIdentities" | "validateStartupGate" | "validateHumanIdentityAuthority" | "resolveRequiredSecrets" | "observability">;

/** Internal readiness composition; borrows authority and grants no runtime activation. */
export async function executeProductionPreListenerStartupChain(
  configuration: ProductionRuntimeConfiguration,
  authority: AsyncRegisteredServiceWorkloadAuthorityLease,
  dependencies: ProductionPreListenerGateDependencies,
): Promise<ProductionPreListenerStartupChainResult> {
  const observation = dependencies.observability;
  observation?.advance("PRE_LISTENER_VALIDATING");
  let gate: "serviceWorkloadGate" | "humanIdentityGate" | "requiredSecretsGate" = "serviceWorkloadGate";
  try {
    const identities = Object.freeze([...(await dependencies.resolveRequiredServiceIdentities(authority, configuration))]);
    assertRequiredIdentities(configuration, identities);
    const validationFingerprint = dependencies.validateStartupGate(configuration, identities);
    if (!safeReference(validationFingerprint)) throw unavailable();
    observation?.gate(gate, "READY");
    gate = "humanIdentityGate";
    await dependencies.validateHumanIdentityAuthority(configuration);
    observation?.gate(gate, "READY");
    gate = "requiredSecretsGate";
    await dependencies.resolveRequiredSecrets(configuration);
    observation?.gate(gate, "READY_EMPTY_MANIFEST");
    observation?.advance("PRE_LISTENER_READY");
    return Object.freeze({ status: "READY", validationFingerprint, identities });
  } catch (error) {
    const fallback = gate === "serviceWorkloadGate" ? "SERVICE_WORKLOAD_GATE_FAILED" : gate === "humanIdentityGate" ? "HUMAN_IDENTITY_GATE_FAILED" : "REQUIRED_SECRETS_GATE_FAILED";
    observation?.gate(gate, "FAILED", safeStartupFailureCode(error, fallback));
    observation?.failed("PRE_LISTENER_NOT_READY");
    throw Object.assign(unavailable(), { preListenerStartupChain: "BLOCKED" as const });
  }
}

/** Internal bootstrap engine. Production code must enter through startProductionRuntime(). */
export async function executeProductionBootstrap(rawConfiguration: unknown, dependencies: ProductionBootstrapEngineDependencies): Promise<ProductionRuntimeHandle> {
  if (activeCompositions.has(dependencies)) throw new ProductionRuntimeActivationError("DUPLICATE_ACTIVATION");
  activeCompositions.add(dependencies);
  const observation = dependencies.observability ?? new ProductionRuntimeObservability();
  let failureContext: ProductionObservedFailureCode = "PRODUCTION_STARTUP_UNAVAILABLE";
  const cleanup: (() => void | Promise<void>)[] = [];
  const activation = new ProductionRuntimeActivation(dependencies.cleanupTimeoutMilliseconds);
  let preListenerStartupChain: "READY" | "BLOCKED" = "BLOCKED";
  const shutdown = async (): Promise<void> => {
    let failed = false;
    const budget = new ProductionCleanupBudget(dependencies.cleanupTimeoutMilliseconds);
    try { await activation.close(budget, cleanup.length); } catch { failed = true; }
    observation.emptyWorkersStopped();
    if (await cleanupReverse(cleanup, budget)) failed = true;
    if (observation.snapshot().startupPhase === "SHUTTING_DOWN") observation.shutdownFinished(failed);
    if (failed) throw Object.assign(unavailable(), { reason: "SHUTDOWN_FAILED" });
  };
  try {
    const configuration = dependencies.parseConfiguration(rawConfiguration);
    assertProductionConfiguration(configuration);
    dependencies.validateConfiguration(configuration);
    dependencies.validateMandatorySecretReferences(configuration);
    failureContext = "DATABASE_READINESS_FAILED";
    const pool = await dependencies.openPostgreSqlPool(configuration);
    observation.poolOpened();
    cleanup.push(async () => {
      try { await pool.close(); observation.poolClosed(); }
      catch (error) { observation.poolCloseFailed(); throw error; }
    });
    const authority = await (async (): Promise<AsyncRegisteredServiceWorkloadAuthorityLease> => {
      try { return await dependencies.openIdentityAuthorityReadOnly(pool); }
      catch (error) {
        emitRuntimeDatabaseDiagnostic(safeRuntimeDatabaseFailure("INITIAL_IDENTITY_AUTHORITY_OPEN", error));
        throw error;
      }
    })();
    cleanup.push(() => authority.close());
    const identitySchemaReadinessProvenance = await (async (): ReturnType<AsyncRegisteredServiceWorkloadAuthorityLease["assertSchemaReady"]> => {
      try { return await authority.assertSchemaReady(); }
      catch (error) {
        emitRuntimeDatabaseDiagnostic(safeRuntimeDatabaseFailure("INITIAL_IDENTITY_READINESS", error));
        throw error;
      }
    })();
    observation.identityReadVerified();
    failureContext = "PRE_LISTENER_NOT_READY";
    const chain = await executeProductionPreListenerStartupChain(configuration, authority, { ...dependencies, observability: observation });
    preListenerStartupChain = chain.status;
    const { identities, validationFingerprint } = chain;
    validateRequiredWorkersManifest(dependencies.requiredWorkersManifest);
    observation.workerManifestReady();
    const context = issueProductionBootstrapContext({ validationFingerprint, configurationReference: configuration.configurationReference });
    failureContext = "DATABASE_READINESS_FAILED";
    await dependencies.assertComponentSchemasReady(configuration, pool);
    observation.poolReady();
    failureContext = "PRODUCTION_STARTUP_UNAVAILABLE";
    const session = await dependencies.createSessionUnitOfWork(pool);
    cleanup.push(() => session.close());

    const roots: ProductionChildRoot[] = [];
    for (const componentId of ["API-014", "API-015", "API-018", "API-019", "FEAT-022"] as const) {
      const root = dependencies.childRootFactories[componentId](context, configuration, identities, pool);
      if (typeof root?.close === "function") cleanup.push(() => root.close());
      if (root?.componentId !== componentId || typeof root.close !== "function" || typeof root.activateRuntime !== "function") throw unavailable();
      roots.push(root);
    }
    Object.freeze(roots);
    observation.advance("ACTIVATING_LISTENER");
    await activation.start(async () => {
      const listener = await dependencies.startListeners(context, roots);
      if (typeof listener?.close !== "function") throw unavailable();
      return {
        ...(listener.stopAccepting === undefined ? {} : { stopAccepting: (): void | Promise<void> => listener.stopAccepting!() }),
        close: async (): Promise<void> => {
          try { await listener.close(); observation.listenerClosed(); }
          catch (error) { observation.listenerClosed(true); throw error; }
        },
      };
    }, [], () => {
      observation.advance("ACTIVATING_WORKERS");
      for (const root of roots) root.activateRuntime();
    });
    observation.advance("RUNTIME_READY");

    let state: "READY" | "NOT_READY" = "READY";
    let closing: Promise<void> | undefined;
    return Object.freeze({
      startupEvidence: () => observation.snapshot(),
      validationFingerprint,
      identitySchemaReadinessProvenance,
      readiness: () => state === "READY" ? activation.readiness() : state,
      close: async () => {
        state = "NOT_READY";
        if (closing === undefined) observation.advance("SHUTTING_DOWN");
        await (closing ??= shutdown());
      },
    });
  } catch (error) {
    if (observation.snapshot().startupPhase !== "STARTUP_FAILED") observation.failed(safeStartupFailureCode(error, failureContext));
    try { await shutdown(); } catch { /* startup remains unavailable after exhaustive cleanup */ }
    if (error instanceof ProductionRuntimeActivationError) throw Object.assign(unavailable(), { reason: error.reason, preListenerStartupChain });
    throw Object.assign(
      new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE", error instanceof ChildRootSchemaReadinessError ? error.evidence : undefined),
      { preListenerStartupChain, ...(error instanceof ProductionBootstrapError && Reflect.get(error, "preListenerStartupChain") === "BLOCKED"
        ? { reason: "PRE_LISTENER_NOT_READY" as const } : {}) },
    );
  }
}

function assertProductionConfiguration(value: ProductionRuntimeConfiguration): void {
  if (value?.runtimeEnvironment !== "PRODUCTION" || value.providerExecutionAuthorized !== false
    || value.identityPersistenceEngine !== "POSTGRESQL"
    || !safeReference(value.configurationReference) || !Array.isArray(value.requiredServiceRegistrations)
    || !value.requiredServiceRegistrations.length || value.requiredServiceRegistrations.some((item) => !safeReference(item))) throw unavailable();
}

function assertRequiredIdentities(configuration: ProductionRuntimeConfiguration, identities: readonly ProductionServiceIdentityBinding[]): void {
  const expected = [...configuration.requiredServiceRegistrations].sort();
  const actual = identities.map((identity) => identity.registrationId).sort();
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) throw unavailable();
}

async function cleanupReverse(cleanup: readonly (() => void | Promise<void>)[], budget: ProductionCleanupBudget): Promise<boolean> {
  let failed = false;
  for (let index = cleanup.length - 1; index >= 0; index -= 1) {
    try { await budget.run(() => cleanup[index]?.(), index + 1); } catch { failed = true; }
  }
  return failed;
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f\\]/u.test(value);
}

function unavailable(): ProductionBootstrapError {
  return new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
}
