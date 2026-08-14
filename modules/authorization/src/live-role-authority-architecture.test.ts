import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("F16-PHASE-7 live authority dependency and scope boundaries remain one-way", () => {
  const authorization = readFileSync("modules/authorization/src/authorization-service.ts", "utf8");
  const adapter = readFileSync("modules/administration/src/live-assignment-adapter.ts", "utf8");
  const administrationIndex = readFileSync("modules/administration/src/index.ts", "utf8");
  assert.doesNotMatch(authorization, /administration-persistence|InMemoryAdministration/iu);
  assert.match(authorization, /interface LiveAssignmentResolver/);
  assert.doesNotMatch(authorization, /#assignments\s*:/u);
  assert.match(adapter, /RoleAssignmentReadRepository/);
  assert.match(adapter, /RoleReadRepository/);
  assert.match(adapter, /AdministrationProposalReadRepository/);
  assert.match(adapter, /AdministrationDecisionReadRepository/);
  assert.doesNotMatch(adapter, /\.begin\(|\.save\(|\.update\(|InMemoryAdministration/iu);
  assert.match(administrationIndex, /createAdministrationBackedAuthorizationService/);
  assert.doesNotMatch(`${authorization}\n${adapter}`, /database|typeorm|prisma|sequelize|drizzle|mongoose/iu);
});

test("F16-PHASE-7 production sources cannot select static assignment compatibility", () => {
  const sources = ["apps", "modules", "packages"].flatMap(listTypeScriptSources);
  const production = sources.filter((path) => !path.endsWith(".test.ts")
    && !path.endsWith("source-test-fixture.ts")
    && !path.endsWith("authorization-service.ts"));
  for (const path of production) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /STATIC_TEST_COMPATIBILITY/u, path);
  }
});

function listTypeScriptSources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listTypeScriptSources(path) : path.endsWith(".ts") ? [path] : [];
  });
}
