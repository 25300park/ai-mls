type BoundaryReadiness = "READY" | "NOT_READY";

interface SessionStatusPort {
  status(): Readonly<{
    health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
    readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN";
  }>;
}

interface AuditStatusPort {
  status(): Readonly<{
    health: "HEALTHY";
    readiness: "READY";
    sourceCount: 7;
  }>;
}

interface JobStatusPort {
  status(): Readonly<{
    health: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
    readiness: "READY" | "NOT_READY" | "UNKNOWN";
    handlerMappings: readonly Readonly<{
      jobType: "AI_LISTING_PARSE" | "AI_REQUIREMENT_PARSE" | "AI_MATCHING";
      handlerId: "AI-001" | "AI-004" | "AI-005";
    }>[];
  }>;
}

interface AdvisoryStatusPort {
  status(): Readonly<{
    capabilities: readonly Readonly<{
      capabilityId: "AI-001" | "AI-004" | "AI-005";
      providerIndependent: "READY" | "NOT_READY";
      stagingExecution: "READY" | "NOT_READY";
    }>[];
    providerIndependentReady: number;
    stagingExecutionReady: number;
  }>;
}

interface ConsoleStatusPort {
  status(): Readonly<{
    environment: "Staging";
    readiness: "DEGRADED" | "NOT_READY";
    executableScreens: 6;
    providerIndependentImplementation: "READY";
    liveProviderExecution: "NOT_READY";
    components: Readonly<{
      session: BoundaryReadiness;
      publication: BoundaryReadiness;
      api015: BoundaryReadiness;
      api016: BoundaryReadiness;
      api017: BoundaryReadiness;
      feat022ProviderIndependent: BoundaryReadiness;
    }>;
  }>;
}

export interface IntegratedStagingRuntimeVerificationInput {
  readonly session: SessionStatusPort;
  readonly audit: AuditStatusPort;
  readonly jobs: JobStatusPort;
  readonly advisory: AdvisoryStatusPort;
  readonly console: ConsoleStatusPort;
}

export interface IntegratedStagingRuntimeStatus {
  readonly classification: "READY_FOR_AVAILABLE_BOUNDARY" | "NOT_READY";
  readonly mandatory: Readonly<{
    session: BoundaryReadiness;
    api015: BoundaryReadiness;
    api016: BoundaryReadiness;
    api017: BoundaryReadiness;
    feat022ProviderIndependent: BoundaryReadiness;
    adminConsole: BoundaryReadiness;
  }>;
  readonly holds: Readonly<{
    liveProvider: "NOT_READY";
    decision162: "IN_REVIEW";
    externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY";
    coreTransport: "HOLD";
    ui006CoreData: "SAFELY_DEFERRED";
  }>;
}

export interface IntegratedStagingRuntimeVerification {
  status(): IntegratedStagingRuntimeStatus;
}

export function createIntegratedStagingRuntimeVerification(
  input: IntegratedStagingRuntimeVerificationInput,
): IntegratedStagingRuntimeVerification {
  if (!validInput(input)) throw new Error("STAGING_INTEGRATED_RUNTIME_NOT_READY");
  return Object.freeze({
    status: (): IntegratedStagingRuntimeStatus => createStatus(input),
  });
}

function createStatus(input: IntegratedStagingRuntimeVerificationInput): IntegratedStagingRuntimeStatus {
  const session = safeStatus(input.session, validSessionStatus);
  const audit = safeStatus(input.audit, validAuditStatus);
  const jobs = safeStatus(input.jobs, validJobStatus);
  const advisory = safeStatus(input.advisory, validAdvisoryStatus);
  const console = safeStatus(input.console, validConsoleStatus);

  const componentReadiness = {
    session: session?.health === "HEALTHY" && session.readiness === "READY" && console?.components.session === "READY",
    api015: console?.components.api015 === "READY",
    api016: audit?.readiness === "READY" && console?.components.api016 === "READY",
    api017: jobs?.health === "HEALTHY" && jobs.readiness === "READY" && console?.components.api017 === "READY",
    feat022ProviderIndependent:
      advisory?.providerIndependentReady === 3
      && advisory.stagingExecutionReady === 0
      && console?.components.feat022ProviderIndependent === "READY",
  } as const;
  const mandatory = {
    session: ready(componentReadiness.session),
    api015: ready(componentReadiness.api015),
    api016: ready(componentReadiness.api016),
    api017: ready(componentReadiness.api017),
    feat022ProviderIndependent: ready(componentReadiness.feat022ProviderIndependent),
    adminConsole: ready(
      console?.readiness === "DEGRADED"
      && console.components.publication === "READY"
      && Object.values(componentReadiness).every(Boolean),
    ),
  } as const;
  const allReady = Object.values(mandatory).every((value) => value === "READY");
  return immutable({
    classification: allReady ? "READY_FOR_AVAILABLE_BOUNDARY" as const : "NOT_READY" as const,
    mandatory,
    holds: {
      liveProvider: "NOT_READY" as const,
      decision162: "IN_REVIEW" as const,
      externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY" as const,
      coreTransport: "HOLD" as const,
      ui006CoreData: "SAFELY_DEFERRED" as const,
    },
  });
}

function safeStatus<T>(port: { status(): T }, valid: (value: unknown) => value is T): T | undefined {
  try {
    const value = port.status();
    return valid(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function validInput(value: unknown): value is IntegratedStagingRuntimeVerificationInput {
  if (!plain(value) || !exactKeys(value, ["advisory", "audit", "console", "jobs", "session"])) return false;
  return Object.values(value).every((port) => plain(port) && typeof port["status"] === "function");
}

function validSessionStatus(value: unknown): value is ReturnType<SessionStatusPort["status"]> {
  if (!plain(value) || !exactKeys(value, ["health", "readiness"])) return false;
  return new Set(["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"]).has(String(value["health"]))
    && new Set(["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]).has(String(value["readiness"]));
}

function validAuditStatus(value: unknown): value is ReturnType<AuditStatusPort["status"]> {
  return plain(value) && exactKeys(value, ["health", "readiness", "sourceCount"])
    && value["health"] === "HEALTHY" && value["readiness"] === "READY" && value["sourceCount"] === 7;
}

function validJobStatus(value: unknown): value is ReturnType<JobStatusPort["status"]> {
  const expectedMappings = new Map([
    ["AI_LISTING_PARSE", "AI-001"],
    ["AI_REQUIREMENT_PARSE", "AI-004"],
    ["AI_MATCHING", "AI-005"],
  ]);
  return plain(value) && exactKeys(value, ["handlerMappings", "health", "readiness"])
    && new Set(["HEALTHY", "UNHEALTHY", "UNKNOWN"]).has(String(value["health"]))
    && new Set(["READY", "NOT_READY", "UNKNOWN"]).has(String(value["readiness"]))
    && Array.isArray(value["handlerMappings"])
    && value["handlerMappings"].length === 3
    && new Set(value["handlerMappings"].map((mapping) => plain(mapping) ? mapping["jobType"] : undefined)).size === 3
    && value["handlerMappings"].every((mapping) => plain(mapping)
      && exactKeys(mapping, ["handlerId", "jobType"])
      && expectedMappings.get(String(mapping["jobType"])) === mapping["handlerId"]);
}

function validAdvisoryStatus(value: unknown): value is ReturnType<AdvisoryStatusPort["status"]> {
  if (!plain(value) || !exactKeys(value, ["capabilities", "providerIndependentReady", "stagingExecutionReady"])) return false;
  if (!Array.isArray(value["capabilities"]) || value["capabilities"].length !== 3
    || value["providerIndependentReady"] !== 3 || value["stagingExecutionReady"] !== 0) return false;
  const expected = ["AI-001", "AI-004", "AI-005"];
  return value["capabilities"].every((item, index) => plain(item)
    && exactKeys(item, ["capabilityId", "providerIndependent", "stagingExecution"])
    && item["capabilityId"] === expected[index]
    && item["providerIndependent"] === "READY"
    && item["stagingExecution"] === "NOT_READY");
}

function validConsoleStatus(value: unknown): value is ReturnType<ConsoleStatusPort["status"]> {
  if (!plain(value) || !exactKeys(value, ["components", "environment", "executableScreens", "liveProviderExecution", "providerIndependentImplementation", "readiness"])) return false;
  const components = value["components"];
  return value["environment"] === "Staging"
    && new Set(["DEGRADED", "NOT_READY"]).has(String(value["readiness"]))
    && value["executableScreens"] === 6
    && value["providerIndependentImplementation"] === "READY"
    && value["liveProviderExecution"] === "NOT_READY"
    && plain(components)
    && exactKeys(components, ["api015", "api016", "api017", "feat022ProviderIndependent", "publication", "session"])
    && Object.values(components).every((item) => item === "READY" || item === "NOT_READY");
}

function ready(value: boolean): BoundaryReadiness {
  return value ? "READY" : "NOT_READY";
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
