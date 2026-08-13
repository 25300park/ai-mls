import type { AdminConsoleConfiguration } from "./console-configuration.js";
import { immutableConsole, type ConsoleReadAdapter, type ConsoleReadResult } from "./console-read-adapter.js";
import { createAdminConsoleServer, type AdminConsoleServer } from "./console-server.js";
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
  readonly readAdapter?: Pick<ConsoleReadAdapter, "read">;
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
  const readAdapter = dependencies.readAdapter ?? unavailableReadAdapter;
  return Object.freeze({
    server: createAdminConsoleServer({
      host: configuration.host,
      port: configuration.port,
      sessionId: session.sessionId,
      tenantId: configuration.tenantId,
      readAdapter,
    }),
    runtimeDecision: Object.freeze({
      existingFrontendRuntime: "NONE" as const,
      selectedRuntime: "NODE_24_VANILLA_TYPESCRIPT_HTML_CSS" as const,
      newRuntimeDependencies: 0 as const,
    }),
  });
}

const unavailableReadAdapter: Pick<ConsoleReadAdapter, "read"> = Object.freeze({
  read(request): ConsoleReadResult {
    const message = request.page === "PROJECTION"
      ? "No Projection record is currently available."
      : request.page === "UI-033"
        ? "No reconciliation case is currently available."
        : request.page.startsWith("UI-")
          ? "No Publication data is currently available."
          : "Unavailable in current backend.";
    return immutableConsole({
      page: request.page,
      state: request.page === "DASHBOARD" || request.page === "OPERATIONS" ? "UNAVAILABLE" as const : "EMPTY" as const,
      message,
    });
  },
});
