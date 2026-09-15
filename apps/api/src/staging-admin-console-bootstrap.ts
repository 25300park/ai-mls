import {
  composeStagingAdminConsole,
  type StagingAdminConsoleComposition,
  type StagingAdminConsoleDependencies,
} from "../../admin-console/src/console-composition.js";
import type { StagingAdminConsoleConfiguration } from "../../admin-console/src/console-configuration.js";
import { AdministrationConsoleHttpClient } from "../../admin-console/src/administration-console-http-client.js";
import { AdministrationConsoleReadAdapter } from "../../admin-console/src/administration-console-read-adapter.js";
import type { ResolveAuthorizedSessionRequest } from "../../../modules/identity/src/session-access-coordinator.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { createStagingConsoleSessionIngress } from "./staging-console-session-ingress.js";

interface Phase1dSessionAccessPort {
  resolveAuthorized(request: ResolveAuthorizedSessionRequest): SessionContext;
}

export interface StagingAdminConsoleBootstrapDependencies
  extends Omit<StagingAdminConsoleDependencies, "sessionIngress" | "administrationReadAdapter" | "administrationCommandAdapter"> {
  readonly sessionAccess: Phase1dSessionAccessPort;
}

export function createStagingAdminConsoleBootstrap(
  configuration: StagingAdminConsoleConfiguration,
  dependencies: StagingAdminConsoleBootstrapDependencies,
): StagingAdminConsoleComposition {
  const administrationAdapter = new AdministrationConsoleReadAdapter(
    new AdministrationConsoleHttpClient(configuration.administrationApiOrigin),
  );
  return composeStagingAdminConsole(configuration, {
    ...dependencies,
    sessionIngress: createStagingConsoleSessionIngress(dependencies.sessionAccess),
    administrationReadAdapter: administrationAdapter,
    administrationCommandAdapter: administrationAdapter,
  });
}

export async function startStagingAdminConsoleBootstrap(
  configuration: StagingAdminConsoleConfiguration,
  dependencies: StagingAdminConsoleBootstrapDependencies,
): Promise<StagingAdminConsoleComposition> {
  const composition = createStagingAdminConsoleBootstrap(configuration, dependencies);
  await composition.server.start();
  return composition;
}
