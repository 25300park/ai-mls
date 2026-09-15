import { composeDevelopmentAdminConsole } from "./console-composition.js";
import { parseAdminConsoleArguments } from "./console-configuration.js";
import { AdministrationConsoleHttpClient } from "./administration-console-http-client.js";
import { AdministrationConsoleReadAdapter } from "./administration-console-read-adapter.js";

const configuration = parseAdminConsoleArguments(process.argv.slice(2));
if (configuration.runtimeEnvironment === "STAGING") {
  throw new Error("STAGING_PLATFORM_HOST_COMPOSITION_REQUIRED");
}
const administrationAdapter = new AdministrationConsoleReadAdapter(
  new AdministrationConsoleHttpClient(configuration.administrationApiOrigin),
);
const governedSelectorScopes = configuration.policyScopeId !== undefined
  && configuration.sourceScopeId !== undefined && configuration.targetScopeId !== undefined
  ? Object.freeze({
      roles: { tenantId: configuration.tenantId, scopeType: "TENANT" as const, scopeId: configuration.tenantId },
      teamScopes: { tenantId: configuration.tenantId, scopeType: "TEAM" as const, scopeId: configuration.tenantId },
      policies: { tenantId: configuration.tenantId, scopeType: "POLICY" as const, scopeId: configuration.policyScopeId },
      sourceGovernance: { tenantId: configuration.tenantId, scopeType: "SOURCE" as const, scopeId: configuration.sourceScopeId },
      publicationTargets: { tenantId: configuration.tenantId, scopeType: "TARGET" as const, scopeId: configuration.targetScopeId },
    })
  : undefined;
const composition = composeDevelopmentAdminConsole(configuration, {
  administrationReadAdapter: administrationAdapter,
  administrationCommandAdapter: administrationAdapter,
  ...(governedSelectorScopes === undefined ? {} : { administrationSelectorScopes: governedSelectorScopes }),
});

await composition.server.start();
process.stdout.write(`AI-MLS Admin Console: ${composition.server.localUrl}\n`);

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  await composition.server.stop();
};

process.once("SIGINT", () => { void stop().then(() => process.exit(0)); });
process.once("SIGTERM", () => { void stop().then(() => process.exit(0)); });
