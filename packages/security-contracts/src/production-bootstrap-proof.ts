export interface ProductionBootstrapContextView {
  readonly validationFingerprint: string;
  readonly configurationReference: string;
}

const issuedContexts = new WeakSet<object>();

export function issueProductionBootstrapContext(input: ProductionBootstrapContextView): Readonly<ProductionBootstrapContextView> {
  if (!safeReference(input.validationFingerprint) || !safeReference(input.configurationReference)) throw unavailable();
  const context = Object.freeze({ ...input });
  issuedContexts.add(context);
  return context;
}

export function assertProductionBootstrapContext(value: unknown): asserts value is ProductionBootstrapContextView {
  if (typeof value !== "object" || value === null || !issuedContexts.has(value)) throw unavailable();
}

export function assertProductionRootBootstrapContext(value: unknown): void {
  assertProductionBootstrapContext(value);
}

function safeReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f\\]/u.test(value);
}

function unavailable(): Error & Readonly<{ code: "PRODUCTION_STARTUP_UNAVAILABLE" }> {
  return Object.assign(new Error("Production runtime startup is unavailable."), { code: "PRODUCTION_STARTUP_UNAVAILABLE" as const });
}
