import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionFiles = [
  "modules/administration/src/administration-persistence.ts",
  "modules/administration/src/index.ts",
] as const;

test("F16-PHASE-6 persistence ports and adapter contain no physical database or execution dependency", () => {
  const source = productionFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  for (const forbidden of [
    "prisma", "drizzle", "typeorm", "sequelize", "knex", "postgres", "mysql", "mariadb", "sqlite", "supabase",
    "publication-aggregate", "publication-service", "publication-event", "listing-projection", "connector", "ai-provider",
    "apps/admin-console", "authorization-service", "session-service",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, `forbidden dependency leaked: ${forbidden}`);
  }
});

test("F16-PHASE-6 main Administration exports do not expose test failure controls or generic repositories", () => {
  const source = readFileSync("modules/administration/src/index.ts", "utf8");
  assert.equal(source.includes("administration-persistence-test-support"), false);
  assert.equal(/Repository\s*<\s*T\s*>/u.test(source), false);
  assert.equal(source.includes("FailureInjector"), false);
});

test("F16-PHASE-6 repository module cannot grant authority or expose Console mutation paths", () => {
  const source = readFileSync("modules/administration/src/administration-persistence.ts", "utf8");
  for (const forbidden of ["evaluate(", "isMfaVerified", "callerRole", "callerCapability", "POST ", "PATCH ", "DELETE "]) {
    assert.equal(source.includes(forbidden), false, `authority or transport behavior leaked: ${forbidden}`);
  }
});
