import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = new URL("apps/api/src/administration-governance-api.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);
const index = new URL("apps/api/src/index.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);

test("F16-PHASE-8 workflow uses API-015, Phase 6 UoW and Phase 7 live authorization without execution dependencies", async () => {
  const [workflow, exports] = await Promise.all([
    readFile(source, "utf8"),
    readFile(index, "utf8"),
  ]);
  assert.match(workflow, /parseAdministrationApiRequest/);
  assert.match(workflow, /AdministrationUnitOfWork/);
  assert.match(workflow, /LiveAdministrationAuthorizationService/);
  assert.doesNotMatch(workflow, /import type \{ AuthorizationService \}/);
  assert.match(exports, /administration-governance-api\.js/);
  for (const forbidden of [
    "publication-service", "publication-aggregate", "connector", "reconciliation", "recovery",
    "admin-console", "http", "express", "fastify", "typeorm", "prisma", "sequelize", "openai",
  ]) assert.doesNotMatch(workflow.toLowerCase(), new RegExp(forbidden));
});
