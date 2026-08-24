import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseAdminConsoleArguments } from "./console-configuration.js";
import type { ConsoleReadRequest } from "./console-read-adapter.js";
import { composeDevelopmentAdminConsole } from "./console-composition.js";

test("POST-F15-CONSOLE startup requires explicit development Session configuration and rejects Production", () => {
  assert.throws(
    () => parseAdminConsoleArguments(["--runtime=production", "--development-session"]),
    /DEVELOPMENT_SESSION_FORBIDDEN/u,
  );
  assert.throws(
    () => parseAdminConsoleArguments(["--runtime=development"]),
    /DEVELOPMENT_SESSION_DISABLED/u,
  );
  assert.deepEqual(
    parseAdminConsoleArguments(["--runtime=development", "--development-session", "--port=4173", "--administration-api-origin=http://127.0.0.1:4172"]),
    {
      runtimeEnvironment: "DEVELOPMENT",
      developmentSessionEnabled: true,
      host: "127.0.0.1",
      port: 4173,
      tenantId: "team-a",
      sessionId: "console-development-session",
      principalId: "console-development-operator",
      administrationApiOrigin: "http://127.0.0.1:4172",
    },
  );
  assert.throws(
    () => parseAdminConsoleArguments(["--runtime=development", "--development-session", "--administration-api-origin=https://example.com"]),
    /CONSOLE_CONFIGURATION_INVALID/u,
  );
});

test("POST-F15-CONSOLE development composition starts a bounded empty-state Console", async () => {
  const composition = composeDevelopmentAdminConsole({
    runtimeEnvironment: "TEST",
    developmentSessionEnabled: true,
    host: "127.0.0.1",
    port: 0,
    tenantId: "team-a",
    sessionId: "console-composition-session",
    principalId: "console-composition-operator",
    administrationApiOrigin: "http://127.0.0.1:4172",
  });
  await composition.server.start();
  assert.notEqual(composition.server.port, 0);
  assert.equal(composition.server.localUrl.startsWith("http://127.0.0.1:"), true);
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=DASHBOARD`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes("Unavailable in current backend."), true);
  const administration = await fetch(`${composition.server.localUrl}/api/console/view?page=ADMINISTRATION`);
  const administrationBody = await administration.text();
  assert.equal(administrationBody.includes("READ_BOUNDARY_MISSING"), true);
  assert.equal(administrationBody.includes("Publication reference"), false);
  await composition.server.stop();
});

test("POST-F15-CONSOLE composition reuses the injected authorized read adapter without constructing a core graph", async () => {
  let readCalls = 0;
  const composition = composeDevelopmentAdminConsole({
    runtimeEnvironment: "TEST",
    developmentSessionEnabled: true,
    host: "127.0.0.1",
    port: 0,
    tenantId: "team-a",
    sessionId: "console-injected-session",
    principalId: "console-injected-operator",
    administrationApiOrigin: "http://127.0.0.1:4172",
  }, {
    readAdapter: {
      read: (request: ConsoleReadRequest) => {
        readCalls += 1;
        return Object.freeze({ page: request.page, state: "EMPTY", message: "Injected authorized read boundary." });
      },
    },
  });
  await composition.server.start();
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=UI-031`);
  assert.equal(response.status, 200);
  assert.equal((await response.text()).includes("Injected authorized read boundary."), true);
  assert.equal(readCalls, 1);
  await composition.server.stop();
});

test("F16-PHASE-10 composition routes UI-006 only through the injected Administration read adapter", async () => {
  const composition = composeDevelopmentAdminConsole({
    runtimeEnvironment: "TEST",
    developmentSessionEnabled: true,
    host: "127.0.0.1",
    port: 0,
    tenantId: "team-a",
    sessionId: "console-administration-session",
    principalId: "console-administration-operator",
    administrationApiOrigin: "http://127.0.0.1:4172",
  }, {
    readAdapter: { read: (request: ConsoleReadRequest) => Object.freeze({ page: request.page, state: "UNAVAILABLE", message: "Publication read boundary." }) },
    administrationReadAdapter: { read: (request: ConsoleReadRequest) => Promise.resolve(Object.freeze({ page: request.page, state: "NOT_AUTHORIZED", message: "Not authorized." })) },
  });
  await composition.server.start();

  const administration = await fetch(`${composition.server.localUrl}/api/console/view?page=ADMINISTRATION`);
  const dashboard = await fetch(`${composition.server.localUrl}/api/console/view?page=DASHBOARD`);

  assert.equal((await administration.text()).includes("Not authorized."), true);
  assert.equal((await dashboard.text()).includes("Publication read boundary."), true);
  await composition.server.stop();
});
test("POST-F15-CONSOLE production boundary imports no authoritative graph or command capability", () => {
  const sourceRoot = join(process.cwd(), "apps", "admin-console", "src");
  const productionFiles = readdirSync(sourceRoot).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  for (const file of productionFiles) {
    const source = readFileSync(join(sourceRoot, file), "utf8");
    assert.equal(
      /publication-(repository|aggregate|command-handlers|lifecycle-service|reconciliation-service)|createPublicationInfrastructure|new AuthorizationService|new PublicationApi|AdministrationGovernanceApplication|AdministrationUnitOfWork|administration-persistence|administration-service|executeCommand|operationsControl|operationsRetry/iu.test(source),
      false,
      file,
    );
  }
  const administrationAdapter = readFileSync(join(sourceRoot, "administration-console-read-adapter.ts"), "utf8");
  assert.equal(administrationAdapter.includes('method: "GET"'), true);
  assert.equal(administrationAdapter.includes('path: "/administration/queries"'), true);
  assert.equal(administrationAdapter.includes('operation: "LIST_ROLE_ASSIGNMENTS"'), true);
  assert.equal(/method: "POST"|\/administration\/commands|executeCommand|AdministrationUnitOfWork|Repository/u.test(administrationAdapter), false);
  const serverSource = readFileSync(join(sourceRoot, "console-server.ts"), "utf8");
  assert.equal(serverSource.includes('method !== "GET"'), true);
  assert.equal(serverSource.includes('"POST"'), false);
  const mainSource = readFileSync(join(sourceRoot, "main.ts"), "utf8");
  assert.match(mainSource, /AdministrationConsoleHttpClient/u);
  assert.match(mainSource, /AdministrationConsoleReadAdapter/u);
  assert.match(mainSource, /administrationReadAdapter/u);
});
