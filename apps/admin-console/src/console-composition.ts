import type { AdminConsoleConfiguration, DevelopmentAdminConsoleConfiguration } from "./console-configuration.js";
import { immutableConsole, type ConsoleReadPort, type ConsoleReadRequest, type ConsoleReadResult } from "./console-read-adapter.js";
import { createAdminConsoleServer, type AdminConsoleServer, type ConsoleSessionIngressPort } from "./console-server.js";
import type {
  AdministrationConsoleCommandPort,
  AdministrationSelectorReadRequest,
} from "./administration-console-read-adapter.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";
import {
  isSensitiveSecurityDetailKey,
  isUnsafeSecurityDetailValue,
} from "../../../packages/security-contracts/src/index.js";

export interface DevelopmentAdminConsoleComposition {
  readonly server: AdminConsoleServer;
  readonly runtimeDecision: Readonly<{
    readonly existingFrontendRuntime: "NONE";
    readonly selectedRuntime: "NODE_24_VANILLA_TYPESCRIPT_HTML_CSS";
    readonly newRuntimeDependencies: 0;
  }>;
}

export interface DevelopmentAdminConsoleDependencies {
  readonly readAdapter?: ConsoleReadPort;
  readonly administrationReadAdapter?: ConsoleReadPort;
  readonly administrationCommandAdapter?: AdministrationConsoleCommandPort;
  readonly administrationSelectorScopes?: AdministrationSelectorReadRequest["selectorScopes"];
}

export function composeDevelopmentAdminConsole(
  configuration: DevelopmentAdminConsoleConfiguration,
  dependencies: DevelopmentAdminConsoleDependencies = {},
): DevelopmentAdminConsoleComposition {
  const session = createDevelopmentConsoleSessionAdapter({
    enabled: configuration.developmentSessionEnabled,
    runtimeEnvironment: configuration.runtimeEnvironment,
    sessionId: configuration.sessionId,
    principalId: configuration.principalId,
    tenantId: configuration.tenantId,
  });
  const publicationReadAdapter = dependencies.readAdapter ?? unavailableReadAdapter;
  const administrationReadAdapter = dependencies.administrationReadAdapter ?? unavailableReadAdapter;
  const readAdapter: ConsoleReadPort = Object.freeze({
    read: (request: ConsoleReadRequest) => request.page === "ADMINISTRATION" || request.page === "UI-036"
      ? administrationReadAdapter.read(request)
      : publicationReadAdapter.read(request),
  });
  return Object.freeze({
    server: createAdminConsoleServer({
      host: configuration.host,
      port: configuration.port,
      sessionId: session.sessionId,
      tenantId: configuration.tenantId,
      readAdapter,
      ...(dependencies.administrationCommandAdapter === undefined ? {} : { administrationCommandAdapter: dependencies.administrationCommandAdapter }),
      ...(dependencies.administrationSelectorScopes === undefined ? {} : { administrationSelectorScopes: dependencies.administrationSelectorScopes }),
    }),
    runtimeDecision: Object.freeze({
      existingFrontendRuntime: "NONE" as const,
      selectedRuntime: "NODE_24_VANILLA_TYPESCRIPT_HTML_CSS" as const,
      newRuntimeDependencies: 0 as const,
    }),
  });
}

export interface ConsoleJobRuntimeStatusReadPort {
  readStatus(request: Readonly<{
    sessionId: string;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): Readonly<{
    readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN";
    jobs: readonly Readonly<{
      jobId: string;
      status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
      failureCategory?: string;
      predecessorJobId?: string;
      successorJobId?: string;
    }>[];
  }> | Promise<Readonly<{
    readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN";
    jobs: readonly Readonly<{
      jobId: string;
      status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
      failureCategory?: string;
      predecessorJobId?: string;
      successorJobId?: string;
    }>[];
  }>>;
}

export interface ConsoleAdvisoryRuntimeStatusReadPort {
  readStatus(request: Readonly<{
    sessionId: string;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): Readonly<{
    providerIndependentImplementation: "READY";
    liveProviderExecution: "NOT_READY";
    externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY";
    decision162: "IN_REVIEW";
  }> | Promise<Readonly<{
    providerIndependentImplementation: "READY";
    liveProviderExecution: "NOT_READY";
    externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY";
    decision162: "IN_REVIEW";
  }>>;
}

export interface ConsoleCurrentPrincipalView {
  readonly principalId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly scopes: readonly Readonly<{
    tenantId: string;
    teamId?: string;
  }>[];
}

export interface ConsoleCoreIdentityReadPort {
  readCurrentPrincipal(request: Readonly<{
    sessionId: string;
    tenantId: string;
    scopeRef: string;
    correlationId: string;
  }>): ConsoleCurrentPrincipalView | Promise<ConsoleCurrentPrincipalView>;
}

export interface StagingAdminConsoleDependencies {
  readonly sessionIngress: ConsoleSessionIngressPort;
  readonly publicationReadAdapter: ConsoleReadPort;
  readonly administrationReadAdapter: ConsoleReadPort;
  readonly administrationCommandAdapter: AdministrationConsoleCommandPort;
  readonly auditReadAdapter: ConsoleReadPort;
  readonly jobRuntimeReadPort: ConsoleJobRuntimeStatusReadPort;
  readonly advisoryRuntimeReadPort: ConsoleAdvisoryRuntimeStatusReadPort;
  readonly coreIdentityReadPort?: ConsoleCoreIdentityReadPort;
  readonly administrationSelectorScopes: AdministrationSelectorReadRequest["selectorScopes"];
}

export interface StagingAdminConsoleComposition {
  readonly server: AdminConsoleServer;
  status(): Readonly<{
    environment: "Staging";
    readiness: "DEGRADED" | "NOT_READY";
    executableScreens: 6;
    providerIndependentImplementation: "READY";
    liveProviderExecution: "NOT_READY";
    components: Readonly<{
      session: "READY" | "NOT_READY";
      publication: "READY" | "NOT_READY";
      api015: "READY" | "NOT_READY";
      api016: "READY" | "NOT_READY";
      api017: "READY" | "NOT_READY";
      feat022ProviderIndependent: "READY" | "NOT_READY";
    }>;
  }>;
}

export function composeStagingAdminConsole(
  configuration: AdminConsoleConfiguration,
  dependencies: StagingAdminConsoleDependencies,
): StagingAdminConsoleComposition {
  if (configuration.runtimeEnvironment !== "STAGING" || !validStagingDependencies(configuration, dependencies)) {
    throw new Error("STAGING_CONSOLE_NOT_READY");
  }
  const unavailableMandatoryBoundaries = new Set<string>([
    "SESSION", "PUBLICATION", "API-015", "API-016", "API-017", "FEAT-022",
  ]);
  const observe = (boundary: string, available: boolean): void => {
    if (available) unavailableMandatoryBoundaries.delete(boundary);
    else unavailableMandatoryBoundaries.add(boundary);
  };
  const readBoundary = async (
    boundary: string,
    port: ConsoleReadPort,
    request: ConsoleReadRequest,
  ): Promise<ConsoleReadResult> => {
    try {
      const result = safeBoundaryResult(await port.read(request), request);
      observe(boundary, result.state !== "ERROR" && result.state !== "UNAVAILABLE");
      return result;
    } catch {
      observe(boundary, false);
      return unavailableBoundaryResult(request);
    }
  };
  const readAdapter: ConsoleReadPort = Object.freeze({
    read: async (request: ConsoleReadRequest): Promise<ConsoleReadResult> => {
      if (request.page === "ADMINISTRATION") {
        return withCoreIdentity(
          await readBoundary("API-015", dependencies.administrationReadAdapter, request),
          request,
          dependencies.coreIdentityReadPort ?? unavailableCoreIdentityReadPort,
        );
      }
      if (request.page === "UI-036") return readBoundary("API-015", dependencies.administrationReadAdapter, request);
      if (request.page === "UI-035") return readBoundary("API-016", dependencies.auditReadAdapter, request);
      if (request.page === "OPERATIONS") return readStagingOperations(request, dependencies, observe);
      return readBoundary("PUBLICATION", dependencies.publicationReadAdapter, request);
    },
  });
  const sessionIngress: ConsoleSessionIngressPort = Object.freeze({
    authorize: async (request: Parameters<ConsoleSessionIngressPort["authorize"]>[0]) => {
      try {
        await dependencies.sessionIngress.authorize(request);
        observe("SESSION", true);
      } catch (error) {
        if (isSessionBoundaryUnavailable(error)) observe("SESSION", false);
        throw error;
      }
    },
  });
  const administrationCommandAdapter: AdministrationConsoleCommandPort = Object.freeze({
    execute: async (request: Parameters<AdministrationConsoleCommandPort["execute"]>[0]) => {
      try {
        const result = await dependencies.administrationCommandAdapter.execute(request);
        observe("API-015-COMMAND-FAULT", result.state !== "REJECTED" || result.errorCode !== "INTERNAL_ERROR");
        return result;
      } catch (error) {
        observe("API-015-COMMAND-FAULT", false);
        throw error;
      }
    },
  });
  return Object.freeze({
    server: createAdminConsoleServer({
      runtimeEnvironment: "STAGING",
      host: configuration.host,
      port: configuration.port,
      tenantId: configuration.tenantId,
      scopeRef: configuration.scopeRef,
      sessionIngress,
      readAdapter,
      administrationCommandAdapter,
      administrationSelectorScopes: dependencies.administrationSelectorScopes,
    }),
    status: () => Object.freeze({
      environment: "Staging" as const,
      readiness: unavailableMandatoryBoundaries.size === 0 ? "DEGRADED" as const : "NOT_READY" as const,
      executableScreens: 6 as const,
      providerIndependentImplementation: "READY" as const,
      liveProviderExecution: "NOT_READY" as const,
      components: Object.freeze({
        session: observedReadiness(unavailableMandatoryBoundaries, "SESSION"),
        publication: observedReadiness(unavailableMandatoryBoundaries, "PUBLICATION"),
        api015: unavailableMandatoryBoundaries.has("API-015") || unavailableMandatoryBoundaries.has("API-015-COMMAND-FAULT")
          ? "NOT_READY" as const : "READY" as const,
        api016: observedReadiness(unavailableMandatoryBoundaries, "API-016"),
        api017: observedReadiness(unavailableMandatoryBoundaries, "API-017"),
        feat022ProviderIndependent: observedReadiness(unavailableMandatoryBoundaries, "FEAT-022"),
      }),
    }),
  });
}

function observedReadiness(unavailable: ReadonlySet<string>, boundary: string): "READY" | "NOT_READY" {
  return unavailable.has(boundary) ? "NOT_READY" : "READY";
}

function validStagingDependencies(configuration: Extract<AdminConsoleConfiguration, { runtimeEnvironment: "STAGING" }>, value: StagingAdminConsoleDependencies): boolean {
  const scopes = value.administrationSelectorScopes;
  return value !== null && typeof value === "object"
    && typeof value.sessionIngress?.authorize === "function"
    && typeof value.publicationReadAdapter?.read === "function"
    && typeof value.administrationReadAdapter?.read === "function"
    && typeof value.administrationCommandAdapter?.execute === "function"
    && typeof value.auditReadAdapter?.read === "function"
    && typeof value.jobRuntimeReadPort?.readStatus === "function"
    && typeof value.advisoryRuntimeReadPort?.readStatus === "function"
    && (value.coreIdentityReadPort === undefined || typeof value.coreIdentityReadPort.readCurrentPrincipal === "function")
    && scopes !== undefined
    && configuration.policyScopeId !== undefined
    && configuration.sourceScopeId !== undefined
    && configuration.targetScopeId !== undefined
    && exactScope(scopes.roles, configuration.tenantId, "TENANT", configuration.tenantId)
    && exactScope(scopes.teamScopes, configuration.tenantId, "TEAM", configuration.scopeRef)
    && exactScope(scopes.policies, configuration.tenantId, "POLICY", configuration.policyScopeId)
    && exactScope(scopes.sourceGovernance, configuration.tenantId, "SOURCE", configuration.sourceScopeId)
    && exactScope(scopes.publicationTargets, configuration.tenantId, "TARGET", configuration.targetScopeId);
}

function exactScope(
  scope: AdministrationSelectorReadRequest["selectorScopes"][keyof AdministrationSelectorReadRequest["selectorScopes"]],
  tenantId: string,
  scopeType: string,
  scopeId: string,
): boolean {
  return scope.tenantId === tenantId && scope.scopeType === scopeType && scope.scopeId === scopeId;
}

async function readStagingOperations(
  request: ConsoleReadRequest,
  dependencies: StagingAdminConsoleDependencies,
  observe: (boundary: string, available: boolean) => void,
): Promise<ConsoleReadResult> {
  try {
    const context = Object.freeze({
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      scopeRef: request.teamId,
      correlationId: request.correlationId,
    });
    const [jobs, advisory] = await Promise.all([
      dependencies.jobRuntimeReadPort.readStatus(context),
      dependencies.advisoryRuntimeReadPort.readStatus(context),
    ]);
    if (!validJobs(jobs) || !validAdvisory(advisory)) throw new Error("STAGING_CONSOLE_BACKEND_INVALID");
    const safeJobs = jobs.jobs.map((job) => Object.freeze({
      jobId: job.jobId,
      status: job.status,
      ...(job.failureCategory === undefined ? {} : { failureCategory: job.failureCategory }),
      ...(job.predecessorJobId === undefined ? {} : { predecessorJobId: job.predecessorJobId }),
      ...(job.successorJobId === undefined ? {} : { successorJobId: job.successorJobId }),
    }));
    const safeAdvisory = Object.freeze({
      providerIndependentImplementation: advisory.providerIndependentImplementation,
      liveProviderExecution: advisory.liveProviderExecution,
      externalDependency: advisory.externalDependency,
      decision162: advisory.decision162,
    });
    observe("API-017", jobs.readiness !== "NOT_READY" && jobs.readiness !== "UNKNOWN");
    observe("FEAT-022", true);
    return immutableConsole({
      page: "OPERATIONS" as const,
      state: "READY" as const,
      data: {
        health: "DEGRADED",
        readiness: {
          session: "READY",
          api015: "UNKNOWN",
          api016: "UNKNOWN",
          api017: jobs.readiness,
          feat022ProviderIndependent: advisory.providerIndependentImplementation,
          liveProvider: advisory.liveProviderExecution,
        },
        components: [
          { component: "API-017", readiness: jobs.readiness, jobs: safeJobs },
          { component: "FEAT-022", ...safeAdvisory },
        ],
        metrics: {
          jobStatusCount: jobs.jobs.length,
          providerIndependentImplementation: advisory.providerIndependentImplementation,
          liveProviderExecution: advisory.liveProviderExecution,
          externalDependency: advisory.externalDependency,
          decision162: advisory.decision162,
        },
        telemetry: "UNAVAILABLE",
        operationalStatuses: "UNAVAILABLE",
        securityPrivacySummary: "UNAVAILABLE",
        operationalReadiness: "UNAVAILABLE",
        alerts: "UNAVAILABLE",
        releaseTrace: "UNAVAILABLE",
      },
    });
  } catch {
    observe("API-017", false);
    observe("FEAT-022", false);
    return unavailableBoundaryResult(request);
  }
}

function unavailableBoundaryResult(request: ConsoleReadRequest): ConsoleReadResult {
  return immutableConsole({
    page: request.page,
    state: "ERROR" as const,
    error: {
      code: "CONSOLE_READ_UNAVAILABLE" as const,
      message: "The requested Console view is unavailable.",
      correlationId: request.correlationId,
    },
  });
}

function isSessionBoundaryUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as Readonly<{ code?: unknown }>).code;
  return code === "SESSION_PERSISTENCE_UNAVAILABLE" || code === "STAGING_SESSION_NOT_READY";
}

async function withCoreIdentity(
  result: ConsoleReadResult,
  request: ConsoleReadRequest,
  port: ConsoleCoreIdentityReadPort,
): Promise<ConsoleReadResult> {
  if (result.state !== "READY") return result;
  try {
    const principal = await port.readCurrentPrincipal({
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      scopeRef: request.teamId,
      correlationId: request.correlationId,
    });
    if (!validCurrentPrincipal(principal, request.tenantId, request.teamId)) return coreUnavailable(result);
    return immutableConsole({
      ...result,
      data: {
        ...(result.data ?? {}),
        currentPrincipal: principal,
        coreApi001: "AVAILABLE",
        coreDependency: "READY",
      },
    });
  } catch {
    return coreUnavailable(result);
  }
}

function coreUnavailable(result: ConsoleReadResult): ConsoleReadResult {
  const safeData = withoutCoreIdentityData(result.data);
  return immutableConsole({
    ...result,
    data: {
      ...safeData,
      coreApi001: "NOT_AVAILABLE",
      coreDependency: "NOT_READY",
    },
  });
}

function withoutCoreIdentityData(data: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  const omitted = new Set(["currentPrincipal", "coreApi001", "coreApi001002", "coreDependency"]);
  return Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => !omitted.has(key)));
}

const unavailableCoreIdentityReadPort: ConsoleCoreIdentityReadPort = Object.freeze({
  readCurrentPrincipal: () => { throw new Error("CORE_IDENTITY_UNAVAILABLE"); },
});

function validCurrentPrincipal(value: unknown, tenantId: string, scopeRef: string): value is ConsoleCurrentPrincipalView {
  if (value === null || typeof value !== "object"
    || !exactObjectKeys(value, ["principalId", "tenantId", "roles", "scopes"])) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (!safeIdentifier(candidate["principalId"])
    || candidate["tenantId"] !== tenantId
    || !Array.isArray(candidate["roles"]) || candidate["roles"].length > 64
    || !candidate["roles"].every(safeIdentifier)
    || !Array.isArray(candidate["scopes"]) || candidate["scopes"].length > 128) return false;
  const scopes: readonly unknown[] = candidate["scopes"];
  return scopes.every((scope) => scope !== null && typeof scope === "object"
      && exactObjectKeys(scope, (scope as Readonly<Record<string, unknown>>)["teamId"] === undefined ? ["tenantId"] : ["tenantId", "teamId"])
      && (scope as Readonly<Record<string, unknown>>)["tenantId"] === tenantId
      && optionalIdentifier((scope as Readonly<Record<string, unknown>>)["teamId"]))
    && scopes.some((scope) => scope !== null && typeof scope === "object"
      && (scope as Readonly<Record<string, unknown>>)["teamId"] === scopeRef);
}

function safeBoundaryResult(result: ConsoleReadResult, request: ConsoleReadRequest): ConsoleReadResult {
  if (result.page !== request.page || !new Set(["LOADING", "READY", "EMPTY", "UNAVAILABLE", "NOT_AUTHORIZED", "ERROR"]).has(result.state)
    || !safeBoundaryValue(result, 0, { count: 0 })) {
    return immutableConsole({
      page: request.page,
      state: "ERROR" as const,
      error: {
        code: "CONSOLE_READ_UNAVAILABLE" as const,
        message: "The requested Console view is unavailable.",
        correlationId: request.correlationId,
      },
    });
  }
  return immutableConsole(result);
}

function safeBoundaryValue(value: unknown, depth: number, budget: { count: number }): boolean {
  budget.count += 1;
  if (budget.count > 2_000 || depth > 8) return false;
  if (value === null || typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return value.length <= 2_048
    && !isUnsafeSecurityDetailValue(value)
    && !/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u.test(value)
    && !/(?:\b(?:select|insert|update|delete|pragma)\b.+\b(?:from|into|table)\b|sqlite)/iu.test(value);
  if (Array.isArray(value)) return value.length <= 200 && value.every((item) => safeBoundaryValue(item, depth + 1, budget));
  if (typeof value !== "object") return false;
  const entries = Object.entries(value);
  return entries.length <= 200 && entries.every(([key, child]) => safeIdentifier(key)
    && !isSensitiveSecurityDetailKey(key)
    && safeBoundaryValue(child, depth + 1, budget));
}

function validJobs(value: Awaited<ReturnType<ConsoleJobRuntimeStatusReadPort["readStatus"]>>): boolean {
  const readiness = new Set(["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]);
  return exactObjectKeys(value, ["jobs", "readiness"])
    && readiness.has(value.readiness)
    && Array.isArray(value.jobs) && value.jobs.length <= 100
    && (value.jobs as readonly unknown[]).every(validJob);
}

function validJob(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const job = value as Record<string, unknown>;
  const keys = Object.keys(job);
  const allowedKeys = new Set(["failureCategory", "jobId", "predecessorJobId", "status", "successorJobId"]);
  const statuses = new Set(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]);
  return keys.includes("jobId") && keys.includes("status") && keys.every((key) => allowedKeys.has(key))
    && typeof job["jobId"] === "string" && safeIdentifier(job["jobId"])
    && typeof job["status"] === "string" && statuses.has(job["status"])
    && (job["failureCategory"] === undefined
      || (typeof job["failureCategory"] === "string" && optionalSafeText(job["failureCategory"])))
    && (job["predecessorJobId"] === undefined
      || (typeof job["predecessorJobId"] === "string" && optionalIdentifier(job["predecessorJobId"])))
    && (job["successorJobId"] === undefined
      || (typeof job["successorJobId"] === "string" && optionalIdentifier(job["successorJobId"])));
}

function validAdvisory(value: Awaited<ReturnType<ConsoleAdvisoryRuntimeStatusReadPort["readStatus"]>>): boolean {
  return exactObjectKeys(value, ["decision162", "externalDependency", "liveProviderExecution", "providerIndependentImplementation"])
    && value.providerIndependentImplementation === "READY"
    && value.liveProviderExecution === "NOT_READY"
    && value.externalDependency === "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY"
    && value.decision162 === "IN_REVIEW";
}

function exactObjectKeys(value: object, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function optionalIdentifier(value: unknown): value is string | undefined {
  return value === undefined || safeIdentifier(value);
}

function optionalSafeText(value: string | undefined): boolean {
  return value === undefined || (/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,127}$/u.test(value)
    && !/(?:authorization|bearer|credential|password|secret|token|prompt|chain.?of.?thought|stack|sql|sqlite|database|[A-Z]:\\)/iu.test(value));
}

const unavailableReadAdapter: ConsoleReadPort = Object.freeze({
  read(request: ConsoleReadRequest): ConsoleReadResult {
    const message = request.page === "ADMINISTRATION"
      ? "Administration data is unavailable."
      : request.page === "PROJECTION"
      ? "No Projection record is currently available."
      : request.page === "UI-033"
        ? "No reconciliation case is currently available."
        : request.page.startsWith("UI-")
          ? "No Publication data is currently available."
          : "Unavailable in current backend.";
    return immutableConsole({
      page: request.page,
      state: request.page === "DASHBOARD" || request.page === "ADMINISTRATION" || request.page === "OPERATIONS"
        ? "UNAVAILABLE" as const
        : "EMPTY" as const,
      message,
    });
  },
});
