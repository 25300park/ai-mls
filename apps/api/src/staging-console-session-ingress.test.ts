import assert from "node:assert/strict";
import test from "node:test";

import type { ResolveAuthorizedSessionRequest } from "../../../modules/identity/src/session-access-coordinator.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { StagingAdminConsoleConfiguration } from "../../admin-console/src/console-configuration.js";
import type { ConsoleReadPort, ConsoleReadRequest } from "../../admin-console/src/console-read-adapter.js";
import { startStagingAdminConsoleBootstrap } from "./staging-admin-console-bootstrap.js";
import { createStagingConsoleSessionIngress } from "./staging-console-session-ingress.js";

const session = Object.freeze({
  id: "session:evidence", principalId: "operator-staging", principalType: "HUMAN", roles: Object.freeze(["SEC"]),
  teamId: "team-staging", state: "ACTIVE", assurance: "MFA", isMfaVerified: true,
  authenticatedAt: "2026-09-16T00:00:00.000Z", expiresAt: "2026-09-16T12:00:00.000Z",
  absoluteExpiresAt: "2026-09-16T12:00:00.000Z", familyId: "session:family", refreshReference: "[PROTECTED]",
} satisfies SessionContext);

test("REL001-PHASE5B Phase 1D ingress preserves trusted Session tenant/scope and owning read action", () => {
  const observed: ResolveAuthorizedSessionRequest[] = [];
  const ingress = createStagingConsoleSessionIngress({
    resolveAuthorized: (request) => { observed.push(request); return session; },
  });

  ingress.authorize({
    sessionId: "session-staging", tenantId: "tenant-staging", scopeRef: "team-staging",
    page: "UI-035", purpose: "CONSOLE_ACCESS", correlationId: "correlation-staging-audit",
  });
  ingress.authorize({
    sessionId: "session-staging", tenantId: "tenant-staging", scopeRef: "team-staging",
    page: "UI-036", purpose: "CONSOLE_ACCESS", correlationId: "correlation-staging-admin",
  });
  ingress.authorize({
    sessionId: "session-staging", tenantId: "tenant-staging", scopeRef: "team-staging",
    page: "UI-036", purpose: "CONSOLE_ACCESS", correlationId: "correlation-staging-command",
    commandOperation: "APPROVE_POLICY_CHANGE", reason: "Approve reviewed policy change",
  });

  assert.deepEqual(observed, [
    {
      sessionId: "session-staging", action: "audit.query",
      resource: { type: "AdminConsole", id: "UI-035", tenantId: "tenant-staging", teamId: "team-staging" },
      purpose: "SECURITY_MONITORING", correlationId: "correlation-staging-audit",
    },
    {
      sessionId: "session-staging", action: "resource.view",
      resource: { type: "AdminConsole", id: "UI-036", tenantId: "tenant-staging", teamId: "team-staging" },
      purpose: "ACCESS_GOVERNANCE", correlationId: "correlation-staging-admin",
    },
    {
      sessionId: "session-staging", action: "security.admin",
      resource: { type: "AdminConsole", id: "UI-036", tenantId: "tenant-staging", teamId: "team-staging" },
      purpose: "ACCESS_GOVERNANCE", reason: "Approve reviewed policy change", correlationId: "correlation-staging-command",
    },
  ]);
});

test("REL001-PHASE5B Phase 1D ingress propagates revocation/expiry/MFA denial fail closed", () => {
  const ingress = createStagingConsoleSessionIngress({ resolveAuthorized: () => { throw new Error("AUTHENTICATION_REQUIRED"); } });
  assert.throws(() => ingress.authorize({
    sessionId: "session-expired", tenantId: "tenant-staging", scopeRef: "team-staging",
    page: "UI-036", purpose: "CONSOLE_ACCESS", correlationId: "correlation-staging-denied",
  }), /AUTHENTICATION_REQUIRED/u);
});

test("REL001-PHASE5B Platform Host starts the six-screen Staging Console without provider activation", async () => {
  const configuration = Object.freeze({
    runtimeEnvironment: "STAGING", developmentSessionEnabled: false,
    host: "127.0.0.1", port: 0, tenantId: "tenant-staging", scopeRef: "team-staging",
    administrationApiOrigin: "http://127.0.0.1:4172",
    policyScopeId: "policy-staging", sourceScopeId: "source-staging", targetScopeId: "target-staging",
  } satisfies StagingAdminConsoleConfiguration);
  const unavailable: ConsoleReadPort = Object.freeze({
    read: (request: ConsoleReadRequest) => Object.freeze({ page: request.page, state: "UNAVAILABLE" as const }),
  });
  const composition = await startStagingAdminConsoleBootstrap(configuration, {
    sessionAccess: { resolveAuthorized: () => session },
    publicationReadAdapter: unavailable,
    auditReadAdapter: unavailable,
    jobRuntimeReadPort: { readStatus: () => Object.freeze({ readiness: "READY" as const, jobs: Object.freeze([]) }) },
    advisoryRuntimeReadPort: { readStatus: () => Object.freeze({
      providerIndependentImplementation: "READY" as const,
      liveProviderExecution: "NOT_READY" as const,
      externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY" as const,
      decision162: "IN_REVIEW" as const,
    }) },
    administrationSelectorScopes: Object.freeze({
      roles: Object.freeze({ tenantId: "tenant-staging", scopeType: "TENANT" as const, scopeId: "tenant-staging" }),
      teamScopes: Object.freeze({ tenantId: "tenant-staging", scopeType: "TEAM" as const, scopeId: "team-staging" }),
      policies: Object.freeze({ tenantId: "tenant-staging", scopeType: "POLICY" as const, scopeId: "policy-staging" }),
      sourceGovernance: Object.freeze({ tenantId: "tenant-staging", scopeType: "SOURCE" as const, scopeId: "source-staging" }),
      publicationTargets: Object.freeze({ tenantId: "tenant-staging", scopeType: "TARGET" as const, scopeId: "target-staging" }),
    }),
  });

  assert.deepEqual(composition.status(), {
    environment: "Staging", readiness: "NOT_READY", executableScreens: 6,
    providerIndependentImplementation: "READY", liveProviderExecution: "NOT_READY",
    components: {
      session: "NOT_READY", publication: "NOT_READY", api015: "NOT_READY",
      api016: "NOT_READY", api017: "NOT_READY", feat022ProviderIndependent: "NOT_READY",
    },
  });
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-031`, {
    headers: { "x-session-id": "session-staging" },
  });
  assert.equal(response.status, 200);
  await composition.server.stop();
});

test("REL001-PHASE5C reload and runtime restart re-resolve live Session authority without cached access", async () => {
  const configuration = Object.freeze({
    runtimeEnvironment: "STAGING", developmentSessionEnabled: false,
    host: "127.0.0.1", port: 0, tenantId: "tenant-staging", scopeRef: "team-staging",
    administrationApiOrigin: "http://127.0.0.1:4172",
    policyScopeId: "policy-staging", sourceScopeId: "source-staging", targetScopeId: "target-staging",
  } satisfies StagingAdminConsoleConfiguration);
  const unavailable: ConsoleReadPort = Object.freeze({
    read: (request: ConsoleReadRequest) => Object.freeze({ page: request.page, state: "UNAVAILABLE" as const }),
  });
  let authorized = true;
  let resolutions = 0;
  const runtimeDependencies = {
    sessionAccess: {
      resolveAuthorized: () => {
        resolutions += 1;
        if (!authorized) throw new Error("AUTHENTICATION_REQUIRED");
        return session;
      },
    },
    publicationReadAdapter: unavailable,
    auditReadAdapter: unavailable,
    jobRuntimeReadPort: { readStatus: () => Object.freeze({ readiness: "READY" as const, jobs: Object.freeze([]) }) },
    advisoryRuntimeReadPort: { readStatus: () => Object.freeze({
      providerIndependentImplementation: "READY" as const,
      liveProviderExecution: "NOT_READY" as const,
      externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY" as const,
      decision162: "IN_REVIEW" as const,
    }) },
    administrationSelectorScopes: Object.freeze({
      roles: Object.freeze({ tenantId: "tenant-staging", scopeType: "TENANT" as const, scopeId: "tenant-staging" }),
      teamScopes: Object.freeze({ tenantId: "tenant-staging", scopeType: "TEAM" as const, scopeId: "team-staging" }),
      policies: Object.freeze({ tenantId: "tenant-staging", scopeType: "POLICY" as const, scopeId: "policy-staging" }),
      sourceGovernance: Object.freeze({ tenantId: "tenant-staging", scopeType: "SOURCE" as const, scopeId: "source-staging" }),
      publicationTargets: Object.freeze({ tenantId: "tenant-staging", scopeType: "TARGET" as const, scopeId: "target-staging" }),
    }),
  };

  const first = await startStagingAdminConsoleBootstrap(configuration, runtimeDependencies);
  const allowed = await fetch(`${first.server.localUrl}/api/console/view?page=UI-031`, {
    headers: { "x-session-id": "session-staging" },
  });
  assert.equal(allowed.status, 200);
  await first.server.stop();

  authorized = false;
  const restarted = await startStagingAdminConsoleBootstrap(configuration, runtimeDependencies);
  try {
    const denied = await fetch(`${restarted.server.localUrl}/api/console/view?page=UI-031`, {
      headers: { "x-session-id": "session-staging" },
    });
    assert.equal(denied.status, 401);
    assert.equal(resolutions, 2);
  } finally {
    await restarted.server.stop();
  }
});
