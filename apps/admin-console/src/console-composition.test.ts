import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseAdminConsoleArguments } from "./console-configuration.js";
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
    parseAdminConsoleArguments(["--runtime=development", "--development-session", "--port=4173"]),
    {
      runtimeEnvironment: "DEVELOPMENT",
      developmentSessionEnabled: true,
      host: "127.0.0.1",
      port: 4173,
      tenantId: "team-a",
      sessionId: "console-development-session",
      principalId: "console-development-operator",
    },
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
  });
  await composition.server.start();
  assert.notEqual(composition.server.port, 0);
  assert.equal(composition.server.localUrl.startsWith("http://127.0.0.1:"), true);
  const response = await fetch(`${composition.server.localUrl}/api/console/view?page=DASHBOARD`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes("Unavailable in current backend."), true);
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
  }, {
    readAdapter: {
      read: (request) => {
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

test("POST-F15-CONSOLE production boundary imports no authoritative graph or command capability", () => {
  const sourceRoot = join(process.cwd(), "apps", "admin-console", "src");
  const productionFiles = readdirSync(sourceRoot).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  for (const file of productionFiles) {
    const source = readFileSync(join(sourceRoot, file), "utf8");
    assert.equal(
      /publication-(repository|aggregate|command-handlers|lifecycle-service|reconciliation-service)|createPublicationInfrastructure|new AuthorizationService|new PublicationApi|executeCommand|operationsControl|operationsRetry/iu.test(source),
      false,
      file,
    );
  }
  const serverSource = readFileSync(join(sourceRoot, "console-server.ts"), "utf8");
  assert.equal(serverSource.includes('method !== "GET"'), true);
  assert.equal(serverSource.includes('"POST"'), false);
});
