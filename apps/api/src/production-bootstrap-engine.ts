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

export interface ProductionBootstrapEngineDependencies extends Omit<ProductionBootstrapDependencies, "childRootOptions"> {
  readonly childRootFactories: ProductionChildRootFactories;
}

/** Internal bootstrap engine. Production code must enter through startProductionRuntime(). */
export async function executeProductionBootstrap(rawConfiguration: unknown, dependencies: ProductionBootstrapEngineDependencies): Promise<ProductionRuntimeHandle> {
  const cleanup: (() => void | Promise<void>)[] = [];
  let listener: { close(): void | Promise<void> } | undefined;
  let workers: { close(): void | Promise<void> } | undefined;
  const shutdown = async (): Promise<void> => {
    let failed = false;
    if (listener !== undefined) {
      try { await listener.close(); } catch { failed = true; }
    }
    if (workers !== undefined) {
      try { await workers.close(); } catch { failed = true; }
    }
    if (await cleanupReverse(cleanup)) failed = true;
    if (failed) throw unavailable();
  };
  try {
    const configuration = dependencies.parseConfiguration(rawConfiguration);
    assertProductionConfiguration(configuration);
    dependencies.validateConfiguration(configuration);
    dependencies.validateMandatorySecretReferences(configuration);
    const pool = await dependencies.openPostgreSqlPool(configuration);
    cleanup.push(() => pool.close());
    const authority = await dependencies.openIdentityAuthorityReadOnly(pool);
    cleanup.push(() => authority.close());
    const identitySchemaReadinessProvenance = await authority.assertSchemaReady();
    dependencies.validateHumanIdentityAuthority(configuration);
    const identities = Object.freeze([...(await dependencies.resolveRequiredServiceIdentities(authority, configuration))]);
    assertRequiredIdentities(configuration, identities);
    await dependencies.resolveRequiredSecrets(configuration);
    const validationFingerprint = dependencies.validateStartupGate(configuration, identities);
    if (!safeReference(validationFingerprint)) throw unavailable();
    const context = issueProductionBootstrapContext({ validationFingerprint, configurationReference: configuration.configurationReference });
    const session = await dependencies.createSessionUnitOfWork(pool);
    cleanup.push(() => session.close());
    await dependencies.assertComponentSchemasReady(configuration, pool);

    const roots: ProductionChildRoot[] = [];
    for (const componentId of ["API-014", "API-015", "API-018", "API-019", "FEAT-022"] as const) {
      const root = dependencies.childRootFactories[componentId](context, configuration, identities, pool);
      if (typeof root?.close === "function") cleanup.push(() => root.close());
      if (root?.componentId !== componentId || typeof root.close !== "function" || typeof root.activateRuntime !== "function") throw unavailable();
      roots.push(root);
    }
    Object.freeze(roots);
    listener = await dependencies.startListeners(context, roots);
    for (const root of roots) root.activateRuntime();
    workers = dependencies.startWorkers(context, roots);

    let state: "READY" | "NOT_READY" = "READY";
    let closed = false;
    return Object.freeze({
      validationFingerprint,
      identitySchemaReadinessProvenance,
      readiness: () => state,
      close: async () => {
        if (closed) return;
        closed = true;
        state = "NOT_READY";
        await shutdown();
      },
    });
  } catch {
    try { await shutdown(); } catch { /* startup remains unavailable after exhaustive cleanup */ }
    throw unavailable();
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

async function cleanupReverse(cleanup: readonly (() => void | Promise<void>)[]): Promise<boolean> {
  let failed = false;
  for (let index = cleanup.length - 1; index >= 0; index -= 1) {
    try { await cleanup[index]?.(); } catch { failed = true; }
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
