import type { ConsoleRuntimeEnvironment } from "./development-session.js";
import { normalizeAdministrationApiOrigin } from "./administration-console-http-client.js";

interface BaseAdminConsoleConfiguration {
  readonly runtimeEnvironment: ConsoleRuntimeEnvironment;
  readonly developmentSessionEnabled: boolean;
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly tenantId: string;
  readonly administrationApiOrigin: string;
  readonly policyScopeId?: string;
  readonly sourceScopeId?: string;
  readonly targetScopeId?: string;
}

export interface DevelopmentAdminConsoleConfiguration extends BaseAdminConsoleConfiguration {
  readonly runtimeEnvironment: "DEVELOPMENT" | "TEST";
  readonly developmentSessionEnabled: true;
  readonly sessionId: string;
  readonly principalId: string;
}

export interface StagingAdminConsoleConfiguration extends BaseAdminConsoleConfiguration {
  readonly runtimeEnvironment: "STAGING";
  readonly developmentSessionEnabled: false;
  readonly scopeRef: string;
}

export type AdminConsoleConfiguration = DevelopmentAdminConsoleConfiguration | StagingAdminConsoleConfiguration;

export function parseAdminConsoleArguments(argumentsList: readonly string[]): AdminConsoleConfiguration {
  const values = new Map<string, string | true>();
  for (const argument of argumentsList) {
    if (argument === "--development-session") {
      values.set("development-session", true);
      continue;
    }
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (match?.[1] === undefined || match[2] === undefined || !["runtime", "port", "administration-api-origin", "tenant-id", "scope-ref", "policy-scope-id", "source-scope-id", "target-scope-id"].includes(match[1])) {
      throw new Error("CONSOLE_CONFIGURATION_INVALID");
    }
    values.set(match[1], match[2]);
  }
  const runtimeValue = values.get("runtime");
  const runtimeEnvironment = runtimeValue === "development" ? "DEVELOPMENT"
    : runtimeValue === "staging" ? "STAGING"
    : runtimeValue === "production" ? "PRODUCTION"
      : undefined;
  if (runtimeEnvironment === undefined) throw new Error("CONSOLE_CONFIGURATION_INVALID");
  const developmentSessionEnabled = values.get("development-session") === true;
  if (runtimeEnvironment !== "DEVELOPMENT" && developmentSessionEnabled) throw new Error("DEVELOPMENT_SESSION_FORBIDDEN");
  if (runtimeEnvironment === "DEVELOPMENT" && !developmentSessionEnabled) throw new Error("DEVELOPMENT_SESSION_DISABLED");
  if (runtimeEnvironment === "PRODUCTION") throw new Error("CONSOLE_CONFIGURATION_INVALID");
  const portValue = values.get("port") ?? "4173";
  const port = typeof portValue === "string" && /^\d{1,5}$/u.test(portValue) ? Number(portValue) : Number.NaN;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("CONSOLE_CONFIGURATION_INVALID");
  const administrationApiOrigin = normalizeAdministrationApiOrigin(
    typeof values.get("administration-api-origin") === "string"
      ? values.get("administration-api-origin") as string
      : "http://127.0.0.1:4172",
  );
  const governedScope = (key: string): string | undefined => {
    const value = values.get(key);
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(value)) throw new Error("CONSOLE_CONFIGURATION_INVALID");
    return value;
  };

  const policyScopeId = governedScope("policy-scope-id");
  const sourceScopeId = governedScope("source-scope-id");
  const targetScopeId = governedScope("target-scope-id");
  if (runtimeEnvironment === "STAGING") {
    const tenantId = governedScope("tenant-id");
    const scopeRef = governedScope("scope-ref");
    if (tenantId === undefined || scopeRef === undefined || policyScopeId === undefined
      || sourceScopeId === undefined || targetScopeId === undefined) throw new Error("CONSOLE_CONFIGURATION_INVALID");
    return Object.freeze({
      runtimeEnvironment,
      developmentSessionEnabled: false as const,
      host: "127.0.0.1" as const,
      port,
      tenantId,
      scopeRef,
      administrationApiOrigin,
      ...(policyScopeId === undefined ? {} : { policyScopeId }),
      ...(sourceScopeId === undefined ? {} : { sourceScopeId }),
      ...(targetScopeId === undefined ? {} : { targetScopeId }),
    });
  }
  if (values.has("tenant-id") || values.has("scope-ref")) throw new Error("CONSOLE_CONFIGURATION_INVALID");
  return Object.freeze({
    runtimeEnvironment,
    developmentSessionEnabled: true as const,
    host: "127.0.0.1" as const,
    port,
    tenantId: "team-a",
    sessionId: "console-development-session",
    principalId: "console-development-operator",
    administrationApiOrigin,
    ...(policyScopeId === undefined ? {} : { policyScopeId }),
    ...(sourceScopeId === undefined ? {} : { sourceScopeId }),
    ...(targetScopeId === undefined ? {} : { targetScopeId }),
  });
}
