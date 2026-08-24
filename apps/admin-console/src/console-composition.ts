import type { AdminConsoleConfiguration } from "./console-configuration.js";
import { immutableConsole, type ConsoleReadPort, type ConsoleReadRequest, type ConsoleReadResult } from "./console-read-adapter.js";
import { createAdminConsoleServer, type AdminConsoleServer } from "./console-server.js";
import type {
  AdministrationConsoleCommandPort,
  AdministrationSelectorReadRequest,
} from "./administration-console-read-adapter.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";

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
  configuration: AdminConsoleConfiguration,
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
