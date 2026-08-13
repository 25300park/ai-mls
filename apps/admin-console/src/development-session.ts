import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { PublicationSessionResolver } from "../../../modules/publication/src/publication-authorization.js";

export type ConsoleRuntimeEnvironment = "DEVELOPMENT" | "TEST" | "PRODUCTION";

export interface DevelopmentConsoleSessionConfiguration {
  readonly enabled: boolean;
  readonly runtimeEnvironment: ConsoleRuntimeEnvironment;
  readonly sessionId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly now?: () => Date;
}

export interface DevelopmentConsoleSessionAdapter extends PublicationSessionResolver {
  readonly sessionId: string;
}

const sessionLifetimeMs = 8 * 60 * 60 * 1_000;

export function createDevelopmentConsoleSessionAdapter(
  configuration: DevelopmentConsoleSessionConfiguration,
): DevelopmentConsoleSessionAdapter {
  if (!configuration.enabled) throw new Error("DEVELOPMENT_SESSION_DISABLED");
  if (configuration.runtimeEnvironment === "PRODUCTION") {
    throw new Error("DEVELOPMENT_SESSION_FORBIDDEN");
  }
  const now = (configuration.now ?? currentDate)();
  const authenticatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs).toISOString();
  const roles = Object.freeze(["OPS", "SEC"] as const);
  const session: SessionContext = Object.freeze({
    id: requireIdentifier(configuration.sessionId),
    principalId: requireIdentifier(configuration.principalId),
    principalType: "HUMAN",
    roles,
    teamId: requireIdentifier(configuration.tenantId),
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt,
    expiresAt,
    absoluteExpiresAt: expiresAt,
    familyId: "console-development-family",
    refreshReference: "console-development-no-refresh",
  });
  return Object.freeze({
    sessionId: session.id,
    resolve(sessionId: string): SessionContext | undefined {
      return sessionId === session.id ? session : undefined;
    },
  });
}

function currentDate(): Date {
  return new Date();
}

function requireIdentifier(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(value)) {
    throw new Error("DEVELOPMENT_SESSION_CONFIGURATION_INVALID");
  }
  return value;
}
