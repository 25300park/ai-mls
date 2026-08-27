import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = new URL("apps/api/src/administration-governance-api.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);
const index = new URL("apps/api/src/index.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);
const httpAdapter = new URL("apps/api/src/administration-http-adapter.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);
const composition = new URL("apps/api/src/composition.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);
const durablePersistence = new URL("modules/administration/src/administration-durable-persistence.ts", `file:///${process.cwd().replaceAll("\\", "/")}/`);

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

test("F16-PHASE-9 HTTP adapter uses one governance application boundary and preserves canonical ownership", async () => {
  const [adapter, root, exports] = await Promise.all([
    readFile(httpAdapter, "utf8"), readFile(composition, "utf8"), readFile(index, "utf8"),
  ]);
  assert.match(adapter, /AdministrationGovernanceApplicationPort/);
  assert.match(adapter, /x-session-id/);
  assert.match(adapter, /\/administration\/commands/);
  assert.match(adapter, /\/administration\/queries/);
  assert.match(adapter, /AdministrationHttpRequestMultiplexer/);
  assert.match(adapter, /parseQuery\(request\.query\)/);
  assert.match(root, /composeAdministrationApi015NodeHttpServer/);
  assert.match(root, /createAdministrationHttpRequestHandler\(options\.application/);
  assert.match(root, /createPublicationNodeHttpServer/);
  assert.match(exports, /administration-http-adapter\.js/);
  for (const forbidden of [
    "admin-audit-api", "administration-service", "AdministrationUnitOfWork", "Repository",
    "SET_LEGAL_HOLD", "Retention", "Legal Hold", "express", "fastify",
  ]) assert.doesNotMatch(adapter, new RegExp(forbidden, "i"));
});

test("F16-R1 production composition selects durable persistence with no in-memory fallback", async () => {
  const [root, durable] = await Promise.all([
    readFile(composition, "utf8"),
    readFile(durablePersistence, "utf8"),
  ]);
  assert.match(root, /composeProductionAdministrationApi015NodeHttpServer/);
  assert.match(root, /new DurableAdministrationUnitOfWork/);
  assert.match(root, /new AdministrationGovernanceApplication/);
  assert.doesNotMatch(root, /InMemoryAdministrationUnitOfWork/);
  const productionFactory = root.slice(
    root.indexOf("export interface ProductionAdministrationCompositionOptions"),
    root.indexOf("export interface ApiModuleDependencies"),
  );
  assert.match(productionFactory, /createAdministrationBackedAuthorizationService/);
  assert.match(productionFactory, /roleAssignments: unitOfWork\.roleAssignments/);
  assert.doesNotMatch(productionFactory, /authorizationService: options\.authorizationService/);
  assert.match(durable, /node:sqlite/);
  for (const forbidden of ["authorization-service", "session-service", "admin-console", "publication-service", "connector"]) {
    assert.doesNotMatch(durable, new RegExp(forbidden, "i"));
  }
});
