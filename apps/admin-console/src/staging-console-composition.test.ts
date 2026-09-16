import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseAdminConsoleArguments } from "./console-configuration.js";
import type { ConsoleReadRequest, ConsoleReadResult } from "./console-read-adapter.js";
import {
  composeStagingAdminConsole,
  type StagingAdminConsoleComposition,
  type StagingAdminConsoleDependencies,
} from "./console-composition.js";

const scopes = Object.freeze({
  roles: { tenantId: "tenant-staging", scopeType: "TENANT" as const, scopeId: "tenant-staging" },
  teamScopes: { tenantId: "tenant-staging", scopeType: "TEAM" as const, scopeId: "team-staging" },
  policies: { tenantId: "tenant-staging", scopeType: "POLICY" as const, scopeId: "policy-staging" },
  sourceGovernance: { tenantId: "tenant-staging", scopeType: "SOURCE" as const, scopeId: "source-staging" },
  publicationTargets: { tenantId: "tenant-staging", scopeType: "TARGET" as const, scopeId: "target-staging" },
});

function configuration() {
  return Object.freeze({ ...parseAdminConsoleArguments([
    "--runtime=staging", "--port=4173", "--tenant-id=tenant-staging", "--scope-ref=team-staging",
    "--administration-api-origin=http://127.0.0.1:4172",
    "--policy-scope-id=policy-staging", "--source-scope-id=source-staging", "--target-scope-id=target-staging",
  ]), port: 0 });
}

function result(request: ConsoleReadRequest, marker: string): ConsoleReadResult {
  return Object.freeze({ page: request.page, state: "READY", data: { marker } });
}

function dependencies(overrides: Partial<StagingAdminConsoleDependencies> = {}): StagingAdminConsoleDependencies {
  return {
    sessionIngress: { authorize: () => undefined },
    publicationReadAdapter: { read: (request) => result(request, "PUBLICATION") },
    administrationReadAdapter: { read: (request) => result(request, "ADMINISTRATION") },
    administrationCommandAdapter: {
      execute: (request) => Promise.resolve(Object.freeze({
        state: "CONFIRMED" as const, operation: request.operation, proposalId: "proposal-staging",
        resourceType: "POLICY", resourceId: "policy-staging", status: "PROPOSED", version: 1,
        decisionReferences: Object.freeze([]),
      })),
    },
    auditReadAdapter: { read: (request) => result(request, "API-016") },
    jobRuntimeReadPort: {
      readStatus: () => Object.freeze({
        readiness: "READY" as const,
        jobs: Object.freeze([{ jobId: "job-staging", status: "FAILED" as const, failureCategory: "PROCESSING", predecessorJobId: "job-prior" }]),
      }),
    },
    advisoryRuntimeReadPort: {
      readStatus: () => Object.freeze({
        providerIndependentImplementation: "READY" as const,
        liveProviderExecution: "NOT_READY" as const,
        externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY" as const,
        decision162: "IN_REVIEW" as const,
      }),
    },
    administrationSelectorScopes: scopes,
    ...overrides,
  };
}

async function readPage(composition: StagingAdminConsoleComposition, page: string): Promise<Response> {
  return fetch(`${composition.server.localUrl}/api/console/view?page=${page}`, {
    headers: { "x-session-id": "session-staging" },
  });
}

async function primeMandatoryReads(composition: StagingAdminConsoleComposition): Promise<void> {
  for (const page of ["ADMINISTRATION", "UI-031", "UI-035", "OPERATIONS"]) {
    const response = await readPage(composition, page);
    assert.equal(response.status, 200, page);
  }
}

test("REL001-PHASE5B RED: Staging configuration is explicit and has no development identity", () => {
  const parsed = parseAdminConsoleArguments([
    "--runtime=staging", "--port=4173", "--tenant-id=tenant-staging", "--scope-ref=team-staging",
    "--administration-api-origin=http://127.0.0.1:4172",
    "--policy-scope-id=policy-staging", "--source-scope-id=source-staging", "--target-scope-id=target-staging",
  ]);
  assert.deepEqual(parsed, {
    runtimeEnvironment: "STAGING",
    developmentSessionEnabled: false,
    host: "127.0.0.1",
    port: 4173,
    tenantId: "tenant-staging",
    scopeRef: "team-staging",
    administrationApiOrigin: "http://127.0.0.1:4172",
    policyScopeId: "policy-staging",
    sourceScopeId: "source-staging",
    targetScopeId: "target-staging",
  });
  assert.equal("sessionId" in parsed, false);
  assert.equal("principalId" in parsed, false);
  assert.throws(() => parseAdminConsoleArguments(["--runtime=staging", "--tenant-id=tenant-staging"]), /CONSOLE_CONFIGURATION_INVALID/u);
  assert.throws(() => parseAdminConsoleArguments([
    "--runtime=staging", "--tenant-id=tenant-staging", "--scope-ref=team-staging", "--development-session",
  ]), /DEVELOPMENT_SESSION_FORBIDDEN/u);
  assert.throws(() => parseAdminConsoleArguments([
    "--runtime=development", "--development-session", "--tenant-id=caller-tenant",
  ]), /CONSOLE_CONFIGURATION_INVALID/u);
});

test("REL001-PHASE5B RED: Staging ingress requires x-session-id and preserves configured tenant/scope", async () => {
  const observed: unknown[] = [];
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    sessionIngress: {
      authorize: (request) => { observed.push(request); },
    },
    publicationReadAdapter: {
      read: (request) => { observed.push(request); return result(request, "PUBLICATION"); },
    },
  }));
  await composition.server.start();

  const missing = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-031`);
  assert.equal(missing.status, 401);
  const allowed = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-031&tenantId=attacker&scopeRef=attacker`, {
    headers: { "x-session-id": "session-staging" },
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(observed, [
    {
      sessionId: "session-staging", tenantId: "tenant-staging", scopeRef: "team-staging",
      page: "UI-031", purpose: "CONSOLE_ACCESS", correlationId: "correlation:console-read-2",
    },
    {
      page: "UI-031", sessionId: "session-staging", tenantId: "tenant-staging", teamId: "team-staging",
      correlationId: "correlation:console-read-2",
    },
  ]);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: revoked or expired Session is concealed before backend reads", async () => {
  let backendReads = 0;
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    sessionIngress: { authorize: () => { throw new Error("SESSION_REVOKED_SQLITE_PATH_C:\\private\\session.sqlite"); } },
    publicationReadAdapter: { read: (request) => { backendReads += 1; return result(request, "SHOULD_NOT_RUN"); } },
  }));
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-031`, {
    headers: { "x-session-id": "session-revoked" },
  });
  const body = await response.text();
  assert.equal(response.status, 401);
  assert.equal(backendReads, 0);
  assert.equal(/SESSION_REVOKED|sqlite|private/iu.test(body), false);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: unauthorized Staging administration write never reaches API-015", async () => {
  let commands = 0;
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    sessionIngress: { authorize: () => { throw new Error("REAUTHENTICATION_REQUIRED"); } },
    administrationCommandAdapter: {
      execute: (request) => {
        commands += 1;
        return Promise.resolve(Object.freeze({
          state: "CONFIRMED" as const, operation: request.operation, proposalId: "proposal-forbidden",
          resourceType: "POLICY", resourceId: "policy-staging", status: "PROPOSED", version: 1,
          decisionReferences: Object.freeze([]),
        }));
      },
    },
  }));
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/administration/command`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-session-id": "session-stale-mfa" },
    body: JSON.stringify({ operation: "PROPOSE_POLICY_CHANGE", payload: {} }),
  });
  assert.equal(response.status, 401);
  assert.equal(commands, 0);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: browser command scope cannot escape configured governed scopes", async () => {
  let commands = 0;
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    administrationCommandAdapter: {
      execute: (request) => {
        commands += 1;
        return Promise.resolve(Object.freeze({
          state: "CONFIRMED" as const, operation: request.operation, proposalId: "proposal-forbidden",
          resourceType: "POLICY", resourceId: "policy-forbidden", status: "PROPOSED", version: 1,
          decisionReferences: Object.freeze([]),
        }));
      },
    },
  }));
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/administration/command`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-session-id": "session-staging" },
    body: JSON.stringify({
      operation: "PROPOSE_POLICY_CHANGE",
      payload: { scopeType: "POLICY", scopeId: "policy-other-tenant", reason: "Attempt cross-scope change" },
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(commands, 0);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: unsafe command outcome is reconstructed before browser disclosure", async () => {
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    administrationCommandAdapter: {
      execute: () => Promise.resolve({
        state: "CONFIRMED", operation: "PROPOSE_POLICY_CHANGE", proposalId: "sk-proj-abcdefghijklmnopqrstuvwxyz012345",
        resourceType: "POLICY", resourceId: "policy-staging", status: "PROPOSED", version: 1, decisionReferences: [],
      } as never),
    },
  }));
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/administration/command`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-session-id": "session-staging" },
    body: JSON.stringify({
      operation: "PROPOSE_POLICY_CHANGE",
      payload: { scopeType: "POLICY", scopeId: "policy-staging", reason: "Governed policy change" },
    }),
  });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes("INTERNAL_ERROR"), true);
  assert.equal(body.includes("sk-proj"), false);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: exactly six screens route through owning injected boundaries", async () => {
  const calls: string[] = [];
  const wrap = (marker: string) => ({ read: (request: ConsoleReadRequest) => { calls.push(`${request.page}:${marker}`); return result(request, marker); } });
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    publicationReadAdapter: wrap("PUBLICATION"),
    administrationReadAdapter: wrap("API-015"),
    auditReadAdapter: wrap("API-016"),
  }));
  await composition.server.start();
  for (const page of ["ADMINISTRATION", "UI-031", "UI-032", "UI-033", "UI-035", "UI-036"] as const) {
    const response = await fetch(`${composition.server.localUrl}/api/console/view?page=${page}`, {
      headers: { "x-session-id": "session-staging" },
    });
    assert.equal(response.status, 200, page);
  }
  assert.deepEqual(calls, [
    "ADMINISTRATION:API-015", "UI-031:PUBLICATION", "UI-032:PUBLICATION",
    "UI-033:PUBLICATION", "UI-035:API-016", "UI-036:API-015",
  ]);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: Operations keeps API-017 and FEAT-022 readiness truth separate", async () => {
  const composition = composeStagingAdminConsole(configuration(), dependencies());
  assert.deepEqual(composition.status(), {
    environment: "Staging", readiness: "NOT_READY", executableScreens: 6,
    providerIndependentImplementation: "READY", liveProviderExecution: "NOT_READY",
    components: {
      session: "NOT_READY", publication: "NOT_READY", api015: "NOT_READY", api016: "NOT_READY",
      api017: "NOT_READY", feat022ProviderIndependent: "NOT_READY",
    },
  });
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=OPERATIONS`, {
    headers: { "x-session-id": "session-staging" },
  });
  const body = await response.text();
  for (const expected of ["READY", "NOT_READY", "UNKNOWN", "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY", "IN_REVIEW", "job-staging", "PROCESSING"]) {
    assert.equal(body.includes(expected), true, expected);
  }
  assert.equal(body.includes("liveProviderExecution</dt><dd>READY"), false);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: false live-provider or DEC-162 readiness and unsafe backend values fail closed", async () => {
  for (const advisory of [
    { providerIndependentImplementation: "READY", liveProviderExecution: "READY", externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY", decision162: "IN_REVIEW" },
    { providerIndependentImplementation: "READY", liveProviderExecution: "NOT_READY", externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY", decision162: "APPROVED" },
    { providerIndependentImplementation: "READY", liveProviderExecution: "NOT_READY", externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY", decision162: "IN_REVIEW", providerResponse: "apparently-safe-value" },
  ]) {
    const composition = composeStagingAdminConsole(configuration(), dependencies({
      advisoryRuntimeReadPort: { readStatus: () => advisory as never },
    }));
    await composition.server.start();
    const response = await fetch(`${composition.server.localUrl}/api/console/view?page=OPERATIONS`, {
      headers: { "x-session-id": "session-staging" },
    });
    const body = await response.text();
    assert.equal(body.includes("CONSOLE_READ_UNAVAILABLE"), true);
    assert.equal(body.includes("APPROVED"), false);
    await composition.server.stop();
  }

  const unsafe = composeStagingAdminConsole(configuration(), dependencies({
    jobRuntimeReadPort: {
      readStatus: () => ({
        readiness: "READY",
        jobs: [{ jobId: "job-staging", status: "FAILED", failureCategory: "Bearer secret-token C:\\private\\jobs.sqlite" }],
      }),
    },
  }));
  await unsafe.server.start();
  const unsafeResponse = await fetch(`${unsafe.server.localUrl}/api/console/view?page=OPERATIONS`, {
    headers: { "x-session-id": "session-staging" },
  });
  const unsafeBody = await unsafeResponse.text();
  assert.equal(unsafeBody.includes("CONSOLE_READ_UNAVAILABLE"), true);
  assert.equal(/secret-token|private|sqlite/iu.test(unsafeBody), false);
  await unsafe.server.stop();

  const unknownJobField = composeStagingAdminConsole(configuration(), dependencies({
    jobRuntimeReadPort: {
      readStatus: () => ({
        readiness: "READY",
        jobs: [{ jobId: "job-staging", status: "FAILED", rawPrompt: "apparently-safe-value" }],
      } as never),
    },
  }));
  await unknownJobField.server.start();
  const unknownJobResponse = await fetch(`${unknownJobField.server.localUrl}/api/console/view?page=OPERATIONS`, {
    headers: { "x-session-id": "session-staging" },
  });
  const unknownJobBody = await unknownJobResponse.text();
  assert.equal(unknownJobBody.includes("CONSOLE_READ_UNAVAILABLE"), true);
  assert.equal(/rawPrompt|apparently-safe-value/iu.test(unknownJobBody), false);
  await unknownJobField.server.stop();
});

test("REL001-PHASE5B RED: Core API-001/002 dependency is rendered as deferred on UI-006", async () => {
  const composition = composeStagingAdminConsole(configuration(), dependencies());
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=ADMINISTRATION`, {
    headers: { "x-session-id": "session-staging" },
  });
  const body = await response.text();
  assert.equal(body.includes("NOT_AVAILABLE"), true);
  assert.equal(body.includes("DEFERRED"), true);
  assert.equal(body.includes("READY FOR PRODUCTION"), false);
  await composition.server.stop();
});

test("REL001-PHASE5B RED: unsafe API-016 evidence is never rendered", async () => {
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    auditReadAdapter: {
      read: (request) => Object.freeze({
        page: request.page,
        state: "READY",
        data: { auditEntries: [{ evidenceRef: "safe-reference", diagnostic: "SELECT token FROM sessions at C:\\private\\audit.sqlite" }] },
      }),
    },
  }));
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-035`, {
    headers: { "x-session-id": "session-staging" },
  });
  const body = await response.text();
  assert.equal(body.includes("CONSOLE_READ_UNAVAILABLE"), true);
  assert.equal(/SELECT token|private|sqlite/iu.test(body), false);
  await composition.server.stop();

  for (const unsafeData of [
    { evidenceRef: "sk-proj-abcdefghijklmnopqrstuvwxyz012345" },
    { providerResponse: { result: "apparently-safe-value" } },
  ]) {
    const unsafeValue = composeStagingAdminConsole(configuration(), dependencies({
      auditReadAdapter: { read: (request) => Object.freeze({ page: request.page, state: "READY", data: unsafeData }) },
    }));
    await unsafeValue.server.start();
    const unsafeValueResponse = await fetch(`${unsafeValue.server.localUrl}/api/console/view?page=UI-035`, {
      headers: { "x-session-id": "session-staging" },
    });
    const unsafeValueBody = await unsafeValueResponse.text();
    assert.equal(unsafeValueBody.includes("CONSOLE_READ_UNAVAILABLE"), true);
    assert.equal(/sk-proj|providerResponse|apparently-safe-value/iu.test(unsafeValueBody), false);
    await unsafeValue.server.stop();
  }
});

test("REL001-PHASE5B RED: missing mandatory backend cannot report READY", () => {
  const missingAudit: Partial<StagingAdminConsoleDependencies> = { ...dependencies() };
  Reflect.deleteProperty(missingAudit, "auditReadAdapter");
  assert.throws(
    () => composeStagingAdminConsole(configuration(), missingAudit as StagingAdminConsoleDependencies),
    /STAGING_CONSOLE_NOT_READY/u,
  );
});

test("REL001-PHASE5B RED: selector scopes must exactly match configured Staging boundaries", () => {
  const mismatched = dependencies({
    administrationSelectorScopes: Object.freeze({
      ...scopes,
      policies: Object.freeze({ tenantId: "tenant-staging", scopeType: "POLICY" as const, scopeId: "policy-other" }),
    }),
  });
  assert.throws(() => composeStagingAdminConsole(configuration(), mismatched), /STAGING_CONSOLE_NOT_READY/u);
});

test("REL001-PHASE5B RED: Console owns no Session, Audit, Job, or provider persistence", () => {
  const source = readFileSync(join(process.cwd(), "apps", "admin-console", "src", "console-composition.ts"), "utf8")
    + readFileSync(join(process.cwd(), "apps", "admin-console", "src", "console-server.ts"), "utf8");
  assert.equal(/DurableSessionUnitOfWork|DurableAuditEventStore|DurableJobStore|node:sqlite|OPENAI_API_KEY|FEAT022_STAGING_OPENAI_API_KEY/u.test(source), false);
});

test("REL001-PHASE5C RED: observed mandatory backend loss makes global readiness NOT_READY and a healthy refresh clears it", async () => {
  let auditAvailable = false;
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    auditReadAdapter: {
      read: (request) => {
        if (!auditAvailable) throw new Error("SQLITE_IOERR at C:\\private\\audit.sqlite");
        return result(request, "API-016");
      },
    },
  }));
  await composition.server.start();
  try {
    const failed = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-035`, {
      headers: { "x-session-id": "session-staging" },
    });
    const failedBody = await failed.text();
    assert.equal(failed.status, 200);
    assert.equal(failedBody.includes("CONSOLE_READ_UNAVAILABLE"), true);
    assert.equal(/SQLITE_IOERR|private|sqlite/iu.test(failedBody), false);
    assert.equal(composition.status().readiness, "NOT_READY");

    auditAvailable = true;
    await primeMandatoryReads(composition);
    const refreshed = await readPage(composition, "UI-035");
    assert.equal(refreshed.status, 200);
    assert.equal(composition.status().readiness, "DEGRADED");
  } finally {
    await composition.server.stop();
  }
});

test("REL001-PHASE5C RED: API-017 NOT_READY is reflected in global readiness without changing provider truth", async () => {
  let jobsReady = true;
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    jobRuntimeReadPort: {
      readStatus: () => Object.freeze({ readiness: jobsReady ? "READY" as const : "NOT_READY" as const, jobs: Object.freeze([]) }),
    },
  }));
  await composition.server.start();
  try {
    assert.equal(composition.status().readiness, "NOT_READY");
    await primeMandatoryReads(composition);
    assert.equal(composition.status().readiness, "DEGRADED");
    jobsReady = false;
    const response = await readPage(composition, "OPERATIONS");
    assert.equal(response.status, 200);
    assert.equal(composition.status().readiness, "NOT_READY");
    assert.equal(composition.status().liveProviderExecution, "NOT_READY");
  } finally {
    await composition.server.stop();
  }
});

test("REL001-PHASE6 RED: Console status exposes each mandatory observation without hiding canonical holds", async () => {
  const composition = composeStagingAdminConsole(configuration(), dependencies());
  assert.deepEqual(composition.status().components, {
    session: "NOT_READY",
    publication: "NOT_READY",
    api015: "NOT_READY",
    api016: "NOT_READY",
    api017: "NOT_READY",
    feat022ProviderIndependent: "NOT_READY",
  });

  await composition.server.start();
  try {
    await primeMandatoryReads(composition);
    assert.deepEqual(composition.status().components, {
      session: "READY",
      publication: "READY",
      api015: "READY",
      api016: "READY",
      api017: "READY",
      feat022ProviderIndependent: "READY",
    });
    assert.equal(composition.status().readiness, "DEGRADED");
    assert.equal(composition.status().liveProviderExecution, "NOT_READY");
  } finally {
    await composition.server.stop();
  }
});

test("REL001-PHASE5C RED: Session backend loss and API-015 command failure invalidate observed readiness", async () => {
  let sessionAllowed = true;
  let sessionBackendAvailable = true;
  let commandAvailable = true;
  const composition = composeStagingAdminConsole(configuration(), dependencies({
    sessionIngress: { authorize: () => {
      if (!sessionBackendAvailable) {
        throw Object.assign(new Error("unsafe internal detail"), { code: "SESSION_PERSISTENCE_UNAVAILABLE" });
      }
      if (!sessionAllowed) throw new Error("AUTHENTICATION_REQUIRED");
    } },
    administrationCommandAdapter: {
      execute: (request) => {
        if (!commandAvailable) return Promise.resolve(Object.freeze({
          state: "REJECTED" as const,
          errorCode: "INTERNAL_ERROR",
          message: "Administration service unavailable.",
          correlationId: "phase5c-command-failure",
        }));
        return Promise.resolve(Object.freeze({
          state: "CONFIRMED" as const, operation: request.operation, proposalId: "proposal-staging",
          resourceType: "POLICY", resourceId: "policy-staging", status: "PROPOSED", version: 1,
          decisionReferences: Object.freeze([]),
        }));
      },
    },
  }));
  await composition.server.start();
  try {
    await primeMandatoryReads(composition);
    assert.equal(composition.status().readiness, "DEGRADED");

    sessionAllowed = false;
    assert.equal((await readPage(composition, "UI-031")).status, 401);
    assert.equal(composition.status().readiness, "DEGRADED");
    sessionAllowed = true;
    await readPage(composition, "UI-031");
    assert.equal(composition.status().readiness, "DEGRADED");

    sessionBackendAvailable = false;
    assert.equal((await readPage(composition, "UI-031")).status, 401);
    assert.equal(composition.status().readiness, "NOT_READY");
    sessionBackendAvailable = true;
    await readPage(composition, "UI-031");
    assert.equal(composition.status().readiness, "DEGRADED");

    commandAvailable = false;
    const failedCommand = await fetch(`${composition.server.localUrl}/api/console/administration/command`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-id": "session-staging" },
      body: JSON.stringify({
        operation: "PROPOSE_POLICY_CHANGE",
        payload: {
          policyId: "policy-staging", proposedChangeReference: "policy-change-staging",
          scopeType: "POLICY", scopeId: "policy-staging", expectedVersion: 0,
          idempotencyKey: "phase5c-command-failure-repeat", reason: "Verify bounded failure",
          evidenceReferences: [{ type: "AUDIT", id: "evidence-phase5c", version: 1 }],
        },
      }),
    });
    assert.equal(failedCommand.status, 200);
    assert.equal((await failedCommand.text()).includes("INTERNAL_ERROR"), true);
    assert.equal(composition.status().readiness, "NOT_READY");

    commandAvailable = true;
    const recoveredCommand = await fetch(`${composition.server.localUrl}/api/console/administration/command`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-id": "session-staging" },
      body: JSON.stringify({
        operation: "PROPOSE_POLICY_CHANGE",
        payload: {
          policyId: "policy-staging", proposedChangeReference: "policy-change-staging",
          scopeType: "POLICY", scopeId: "policy-staging", expectedVersion: 0,
          idempotencyKey: "phase5c-command-recovery-repeat", reason: "Verify bounded recovery",
          evidenceReferences: [{ type: "AUDIT", id: "evidence-phase5c", version: 1 }],
        },
      }),
    });
    assert.equal(recoveredCommand.status, 200);
    assert.equal(composition.status().readiness, "DEGRADED");
  } finally {
    await composition.server.stop();
  }
});
