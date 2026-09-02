import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function productionTypescriptFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTypescriptFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

test("F18-H classifies API-017 as scheduling-only with no Connector Runtime bypass", () => {
  const jobBoundary = [
    "apps/api/src/job-api.ts",
    "modules/jobs/src/job-service.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  const connectorBoundary = [
    ...productionTypescriptFiles("modules/source/src"),
    "apps/api/src/connector-production-composition.ts",
    "apps/api/src/external-integration-production-composition.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");

  assert.doesNotMatch(jobBoundary, /API-01[89]|ConnectorExecutionCoordinator|AdvanceCheckpoint|DurableConnectorExecutionUnitOfWork/u);
  assert.doesNotMatch(connectorBoundary, /modules\/jobs|job-api|JobApi|JobService/u);
  assert.equal(connectorBoundary.match(/new ConnectorExecutionCoordinator/g)?.length, 1);
});

test("F18-H keeps F19 recovery and business reconciliation unimplemented", () => {
  const sourceFiles = productionTypescriptFiles("modules/source/src");
  const sourceIndex = readFileSync("modules/source/src/index.ts", "utf8");

  assert.deepEqual(
    sourceFiles.filter((path) => /(?:f19|recovery|reconciliation)/iu.test(path)),
    [],
  );
  assert.doesNotMatch(sourceIndex, /recovery|reconciliation/iu);
  assert.match(
    readFileSync("modules/source/src/external-integration-durable-persistence.ts", "utf8"),
    /F19_HANDOFF_REQUIRED/u,
  );
});
