import type { ConsoleRuntimeEnvironment } from "./development-session.js";

export interface AdminConsoleConfiguration {
  readonly runtimeEnvironment: ConsoleRuntimeEnvironment;
  readonly developmentSessionEnabled: boolean;
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly principalId: string;
}

export function parseAdminConsoleArguments(argumentsList: readonly string[]): AdminConsoleConfiguration {
  const values = new Map<string, string | true>();
  for (const argument of argumentsList) {
    if (argument === "--development-session") {
      values.set("development-session", true);
      continue;
    }
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (match?.[1] === undefined || match[2] === undefined || !["runtime", "port"].includes(match[1])) {
      throw new Error("CONSOLE_CONFIGURATION_INVALID");
    }
    values.set(match[1], match[2]);
  }
  const runtimeValue = values.get("runtime");
  const runtimeEnvironment = runtimeValue === "development" ? "DEVELOPMENT"
    : runtimeValue === "production" ? "PRODUCTION"
      : undefined;
  if (runtimeEnvironment === undefined) throw new Error("CONSOLE_CONFIGURATION_INVALID");
  const developmentSessionEnabled = values.get("development-session") === true;
  if (runtimeEnvironment === "PRODUCTION" && developmentSessionEnabled) throw new Error("DEVELOPMENT_SESSION_FORBIDDEN");
  if (!developmentSessionEnabled) throw new Error("DEVELOPMENT_SESSION_DISABLED");
  const portValue = values.get("port") ?? "4173";
  const port = typeof portValue === "string" && /^\d{1,5}$/u.test(portValue) ? Number(portValue) : Number.NaN;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("CONSOLE_CONFIGURATION_INVALID");
  return Object.freeze({
    runtimeEnvironment,
    developmentSessionEnabled,
    host: "127.0.0.1" as const,
    port,
    tenantId: "team-a",
    sessionId: "console-development-session",
    principalId: "console-development-operator",
  });
}
