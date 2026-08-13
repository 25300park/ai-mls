import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contractFiles = [
  "apps/api/src/administration-api-contracts.ts",
  "apps/api/src/administration-api-validation.ts",
];

test("F16-PHASE-5 API-015 contract boundary excludes execution and persistence dependencies", () => {
  const source = contractFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  for (const forbidden of [
    "publication-aggregate",
    "publication-command-handlers",
    "publication-connector",
    "publication-event",
    "listing-projection",
    "database",
    "repository",
    "prisma",
    "sequelize",
    "typeorm",
    "ai-provider",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("F16-PHASE-5 API-015 operation names preserve governance-only ownership", async () => {
  const { ADMINISTRATION_API_COMMAND_OPERATIONS } = await import("./administration-api-contracts.js");
  const forbiddenTokens = [
    "CRAWL",
    "FETCH",
    "PARSE",
    "INGEST",
    "PUBLISH_PUBLICATION",
    "REPUBLISH_PUBLICATION",
    "WITHDRAW_PUBLICATION",
    "DISPATCH",
    "CONNECTOR",
    "RECONCILE_PUBLICATION",
    "SET_LEGAL_HOLD",
    "REMOVE_LEGAL_HOLD",
    "CHANGE_RETENTION_POLICY",
  ];
  for (const operation of ADMINISTRATION_API_COMMAND_OPERATIONS) {
    for (const token of forbiddenTokens) assert.equal(operation.includes(token), false, `${operation}:${token}`);
  }
});
