import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Client, Pool } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS, evaluateR3B1ChildRootSchemas, assertR3B1ChildRootSchemasReady, ChildRootSchemaReadinessError } from "./child-root-postgresql-readiness.js";
const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED" && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const schemas = R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c => c.schemaName);
const directories = ["modules/publication", "modules/administration", "modules/source/connector", "modules/source/external-integration", "modules/ai/advisory"];
test("R3-B8 aggregate gate uses one disposable runtime pool and detects every schema/ACL failure without repair", { skip: !enabled, timeout: 30000 }, async () => {
  const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);
  const admin = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  await admin.connect();
  const cleanup = async () => {
    for (const schema of [...schemas, "r3b8_missing"].reverse()) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      if ((await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount !== 0) {
        await admin.query(`DROP OWNED BY ${role}`); await admin.query(`DROP ROLE ${role}`);
      }
    }
  };
  try {
    await cleanup();
    for (const role of ["ai_mls_production_migration_operator", "ai_mls_production_runtime"]) await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await admin.query("GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");
    await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
    const migration = new Client({ host: "127.0.0.1", port, user: "ai_mls_production_migration_operator", database: "postgres" });
    await migration.connect();
    try {
      for (const directory of directories) for (const name of ["001_schema_v1.up.sql", "002_runtime_role_grants.sql", "001_schema_v1.verify.sql"]) await migration.query(await readFile(resolve(directory, "migrations/postgresql/production", name), "utf8"));
    } finally { await migration.end(); }
    const native = new Pool({ host: "127.0.0.1", port, user: "ai_mls_production_runtime", database: "postgres", max: 1,
      options: R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c => `-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(" ") });
    const queries: string[] = []; let leases = 0; let releases = 0;
    const pool: PostgreSqlPoolPort = { connect: async () => {
      leases++; const client = await native.connect(); return {
        query: async <Row extends Record<string, unknown>>(sql: string, args?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => {
          queries.push(sql); return await client.query(sql, args === undefined ? undefined : [...args]) as unknown as PostgreSqlQueryResult<Row>;
        }, release: () => { releases++; client.release(); }
      };
    }, close: () => native.end() };
    try {
      assert.equal((await evaluateR3B1ChildRootSchemas(pool)).status, "READY");
      for (const schema of schemas) {
        await admin.query(`ALTER SCHEMA ${schema} RENAME TO r3b8_missing`);
        try {
          const result = await evaluateR3B1ChildRootSchemas(pool);
          assert.equal(result.status, "NOT_READY"); assert.deepEqual(result.failingSchemas, [schema]);
          assert.equal(result.children.filter(c => c.status === "PASS").length, 4);
          await assert.rejects(() => assertR3B1ChildRootSchemasReady(pool), (error: unknown) => error instanceof ChildRootSchemaReadinessError && error.evidence.failingSchemas.includes(schema));
        } finally { await admin.query(`ALTER SCHEMA r3b8_missing RENAME TO ${schema}`); }
      }
      await admin.query("COMMENT ON SCHEMA app_publication IS 'r3b8-drift'");
      await admin.query("GRANT CREATE ON SCHEMA app_advisory TO ai_mls_production_runtime");
      try {
        const result = await evaluateR3B1ChildRootSchemas(pool);
        assert.deepEqual(result.failingSchemas, ["app_publication", "app_advisory"]);
        assert.equal((await admin.query<{ allowed: boolean }>("SELECT has_schema_privilege('ai_mls_production_runtime','app_advisory','CREATE') AS allowed")).rows[0]!.allowed, true);
      } finally {
        await admin.query("COMMENT ON SCHEMA app_publication IS '" + R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[0]!.schemaComment + "'");
        await admin.query("REVOKE CREATE ON SCHEMA app_advisory FROM ai_mls_production_runtime");
      }
      assert.equal((await evaluateR3B1ChildRootSchemas(pool)).status, "READY");
      assert.equal(native.totalCount, 1); assert.equal(leases, releases);
      assert.ok(queries.every(sql => /^\s*WITH expected/u.test(sql)));
      const runtime = await native.connect();
      try {
        assert.equal((await runtime.query<{ role: string }>("SELECT current_user AS role")).rows[0]!.role, "ai_mls_production_runtime");
        await assert.rejects(() => runtime.query("SET ROLE ai_mls_production_migration_operator"), { code: "42501" });
        for (const schema of schemas) await assert.rejects(() => runtime.query(`CREATE TABLE ${schema}.r3b8_forbidden(id integer)`), { code: "42501" });
      } finally { runtime.release(); }
    } finally { await pool.close(); }
  } finally { await cleanup(); await admin.end(); }
});
