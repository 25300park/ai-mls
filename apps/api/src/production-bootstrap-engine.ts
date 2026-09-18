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
export function executeProductionBootstrap(rawConfiguration: unknown, dependencies: ProductionBootstrapEngineDependencies): ProductionRuntimeHandle {
  const cleanup: (() => void)[] = [];
  try {
    const configuration = dependencies.parseConfiguration(rawConfiguration);
    assertProductionConfiguration(configuration);
    dependencies.validateConfiguration(configuration);
    dependencies.validateMandatorySecretReferences(configuration);
    const authority = dependencies.openIdentityAuthorityReadOnly();
    cleanup.push(() => authority.close());
    authority.assertSchemaReady();
    dependencies.validateHumanIdentityAuthority(configuration);
    const identities = Object.freeze([...dependencies.resolveRequiredServiceIdentities(authority, configuration)]);
    assertRequiredIdentities(configuration, identities);
    dependencies.resolveRequiredSecrets(configuration);
    const validationFingerprint = dependencies.validateStartupGate(configuration, identities);
    if (!safeReference(validationFingerprint)) throw unavailable();
    const context = issueProductionBootstrapContext({ validationFingerprint, configurationReference: configuration.configurationReference });
    const session = dependencies.createSessionUnitOfWork();
    cleanup.push(() => session.close());
    dependencies.assertComponentSchemasReady(configuration);

    const roots: ProductionChildRoot[] = [];
    for (const componentId of ["API-014", "API-015", "API-018", "API-019", "FEAT-022"] as const) {
      const root = dependencies.childRootFactories[componentId](context, configuration, identities);
      if (typeof root?.close === "function") cleanup.push(() => root.close());
      if (root?.componentId !== componentId || typeof root.close !== "function" || typeof root.activateRuntime !== "function") throw unavailable();
      roots.push(root);
    }
    Object.freeze(roots);
    for (const root of roots) root.activateRuntime();
    const listeners = dependencies.startListeners(context, roots);
    cleanup.push(() => listeners.close());
    const workers = dependencies.startWorkers(context, roots);
    cleanup.push(() => workers.close());

    let state: "READY" | "NOT_READY" = "READY";
    let closed = false;
    return Object.freeze({
      validationFingerprint,
      readiness: () => state,
      close: () => {
        if (closed) return;
        closed = true;
        state = "NOT_READY";
        cleanupReverse(cleanup);
      },
    });
  } catch {
    cleanupReverse(cleanup);
    throw unavailable();
  }
}

function assertProductionConfiguration(value: ProductionRuntimeConfiguration): void {
  if (value?.runtimeEnvironment !== "PRODUCTION" || value.providerExecutionAuthorized !== false
    || !safeReference(value.configurationReference) || !Array.isArray(value.requiredServiceRegistrations)
    || !value.requiredServiceRegistrations.length || value.requiredServiceRegistrations.some((item) => !safeReference(item))) throw unavailable();
}

function assertRequiredIdentities(configuration: ProductionRuntimeConfiguration, identities: readonly ProductionServiceIdentityBinding[]): void {
  const expected = [...configuration.requiredServiceRegistrations].sort();
  const actual = identities.map((identity) => identity.registrationId).sort();
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) throw unavailable();
}

function cleanupReverse(cleanup: readonly (() => void)[]): void {
  for (let index = cleanup.length - 1; index >= 0; index -= 1) {
    try { cleanup[index]?.(); } catch { /* continue fail-safe cleanup */ }
  }
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f\\]/u.test(value);
}

function unavailable(): ProductionBootstrapError {
  return new ProductionBootstrapError("PRODUCTION_STARTUP_UNAVAILABLE");
}
