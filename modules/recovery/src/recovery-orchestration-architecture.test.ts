import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { RECOVERY_ORCHESTRATION_OPERATIONS } from "./recovery-orchestration-contracts.js";

test("F19-B keeps a closed internal surface with no API, HTTP, provider or domain-store bypass", () => {
  assert.deepEqual(RECOVERY_ORCHESTRATION_OPERATIONS, ["CREATE_RECOVERY_CASE", "RESOLVE_RECOVERY_CASE", "AUTHORIZE_RECOVERY", "READ_RECOVERY_CASE"]);
  const files = readdirSync("modules/recovery/src");
  assert.equal(files.some((file) => /(?:http|api|provider|connector-adapter)/iu.test(file)), false);
  const service = readFileSync("modules/recovery/src/recovery-orchestration-service.ts", "utf8");
  for (const forbidden of ["modules/publication", "modules/source", "apps/api", "node:http", "node:https", "fetch(", "connectorDispatcher", "providerDispatcher"]) assert.equal(service.includes(forbidden), false, forbidden);
  assert.equal(service.includes("node:sqlite"), false);
  const persistence = readFileSync("modules/recovery/src/recovery-durable-persistence.ts", "utf8");
  assert.equal(persistence.includes('from "node:sqlite"'), true);
});
