import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
const roots = [
  ["modules/organization", "001_organization_governance_v1"],
  ["modules/administration", "003_project_governance_v1"],
  ["modules/identity", "012_workload_startup_binding_v1"],
] as const;
for (const [directory, name] of roots) {
  test(`R3-C1 ${name} forward-only artifact is hashed and bounded`, async () => {
    const prefix = `${directory}/migrations/postgresql/production/${name}`;
    const sql = await readFile(`${prefix}.up.sql`, "utf8");
    assert.equal(createHash("sha256").update(sql).digest("hex"), (await readFile(`${prefix}.up.sql.sha256`, "utf8")).trim());
    assert.match(sql, /BEGIN;/u); assert.match(sql, /COMMIT;/u);
    assert.match(sql, /ai_mls_production_migration_operator/u);
    assert.match(sql, /REVOKE ALL/u);
    assert.doesNotMatch(sql, /binding_evidence_ref|DATABASE_URL|CREATE ROLE|DROP TABLE|CREATE (?:TABLE|SCHEMA) IF NOT EXISTS/u);
  });
}