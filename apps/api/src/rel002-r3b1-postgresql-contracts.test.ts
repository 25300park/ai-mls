import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/index.js";
import {
  assertR3B1ChildRootSchemasReady,
  R3B1_CHILD_ROOT_SCHEMA_CONTRACTS,
} from "./child-root-postgresql-readiness.js";

const ROOT = process.cwd();

const domains = Object.freeze([
  ["publication", "app_publication", 8],
  ["administration", "app_administration", 9],
  ["source/connector", "app_connector", 11],
  ["source/external-integration", "app_external_integration", 5],
  ["ai/advisory", "app_advisory", 3],
] as const);

function artifact(domain: string, filename: string): string {
  return readFileSync(resolve(ROOT, "modules", domain, "migrations/postgresql/production", filename), "utf8");
}

test("R3-B1 owns five exact forward-only PostgreSQL schema contracts", () => {
  let tableCount = 0;
  for (const [domain, schema, expectedTables] of domains) {
    const migration = artifact(domain, "001_schema_v1.up.sql");
    const migrationPath = resolve(ROOT, "modules", domain, "migrations/postgresql/production", "001_schema_v1.up.sql");
    const digest = createHash("sha256").update(readFileSync(migrationPath)).digest("hex");
    assert.equal(readFileSync(`${migrationPath}.sha256`, "utf8").trim(), `${digest} *001_schema_v1.up.sql`);
    assert.match(migration, /^BEGIN;$/mu);
    assert.match(migration, /^COMMIT;$/mu);
    assert.match(migration, new RegExp(`CREATE SCHEMA ${schema} AUTHORIZATION ai_mls_production_migration_operator;`, "u"));
    assert.doesNotMatch(migration, /IF NOT EXISTS|DROP\s+(?:SCHEMA|TABLE)|CREATE EXTENSION/iu);
    assert.match(migration, /ai_mls_production_migration_operator/u);
    const created = [...migration.matchAll(new RegExp(`CREATE TABLE ${schema}\\.`, "gu"))].length;
    assert.equal(created, expectedTables, `${schema} table inventory`);
    tableCount += created;
  }
  assert.equal(tableCount, 36);
});

test("R3-B1 exact verifiers fail closed on drift and preserve version/checksum evidence", () => {
  for (const [domain, schema, expectedTables] of domains) {
    const verifier = artifact(domain, "001_schema_v1.verify.sql");
    assert.match(verifier, /expected_table_count/u);
    assert.match(verifier, new RegExp(`'${schema}'`, "u"));
    assert.match(verifier, new RegExp(`${expectedTables}[^0-9]`, "u"));
    assert.match(verifier, /schema_version/u);
    assert.match(verifier, /contract_fingerprint/u);
    assert.match(verifier, /RAISE EXCEPTION/u);
    assert.match(verifier, /unexpected|mismatch/iu);
    assert.match(verifier, /pg_get_triggerdef/u);
    assert.match(verifier, /tgenabled/u);
    assert.match(verifier, /tgfoid/u);
    assert.match(verifier, /pg_get_userbyid\(p\.proowner\)/u);
    assert.match(verifier, /aclexplode\(coalesce\(r\.relacl,acldefault\('r',r\.relowner\)\)\)/u);
    assert.match(verifier, /p\.prosecdef/u);
    assert.match(verifier, /p\.proconfig/u);
  }
});

test("R3-B1 External contract preserves insertion order, exact parent FKs, and serialized TEXT", () => {
  const migration = artifact("source/external-integration", "001_schema_v1.up.sql");
  assert.equal([...migration.matchAll(/ordinal bigint NOT NULL/gu)].length, 2);
  assert.match(migration, /UNIQUE\(tenant_id,scope_type,scope_id,connector_id,source_id,contract_id,ordinal\)/u);
  assert.equal([...migration.matchAll(/REFERENCES app_external_integration\.ext_contracts/gu)].length, 3);
  assert.doesNotMatch(migration, /REFERENCES app_external_integration\.ext_mappings/u);
  assert.doesNotMatch(migration, /GENERATED|CREATE SEQUENCE|nextval/iu);
  assert.equal([...migration.matchAll(/(?:payload_json|result_json) text NOT NULL CHECK\((?:payload_json|result_json) IS JSON\)/gu)].length, 5);
  assert.doesNotMatch(migration, /(?:payload_json|result_json) jsonb/iu);
  const advisory = artifact("ai/advisory", "001_schema_v1.up.sql");
  assert.equal([...advisory.matchAll(/payload_json jsonb NOT NULL/gu)].length, 2);
});

test("R3-B1 defines the exact twenty-trigger topology and atomic readiness evidence", () => {
  const expectedTriggers = [6, 5, 4, 2, 3] as const;
  domains.forEach(([domain], index) => {
    const migration = artifact(domain, "001_schema_v1.up.sql");
    assert.equal([...migration.matchAll(/^CREATE TRIGGER /gmu)].length, expectedTriggers[index]);
  });
  const contracts = R3B1_CHILD_ROOT_SCHEMA_CONTRACTS;
  assert.equal(contracts.length, 5);
  for (const contract of contracts) {
    assert.match(contract.artifactSha256, /^[a-f0-9]{64}$/u);
    assert.match(contract.triggerHash, /^[a-f0-9]{32}$/u);
    assert.match(contract.functionHash, /^[a-f0-9]{32}$/u);
    assert.match(contract.effectiveAclHash, /^[a-f0-9]{32}$/u);
  }
});

test("R3-B1 ACL artifacts grant bounded runtime DML without DDL, grant options, or PUBLIC leakage", () => {
  for (const [domain, schema] of domains) {
    const grants = artifact(domain, "002_runtime_role_grants.sql");
    assert.match(grants, /^BEGIN;$/mu);
    assert.match(grants, /^COMMIT;$/mu);
    assert.match(grants, /ai_mls_production_runtime/u);
    assert.match(grants, /ai_mls_production_migration_operator/u);
    assert.match(grants, new RegExp(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`, "u"));
    assert.match(grants, new RegExp(`GRANT USAGE ON SCHEMA ${schema} TO ai_mls_production_runtime`, "u"));
    assert.doesNotMatch(grants, /GRANT\s+(?:CREATE|TRUNCATE|TRIGGER|REFERENCES)[\s\S]*ai_mls_production_runtime/iu);
    assert.doesNotMatch(grants, /WITH GRANT OPTION/iu);
  }
});

test("R3-B1 artifacts never auto-migrate at runtime or create duplicate pool authority", () => {
  const productionMain = readFileSync(resolve(ROOT, "apps/api/src/production-main.ts"), "utf8");
  assert.match(productionMain, /REQUIRES_R3_B_CHILD_ROOT_POSTGRES/u);
  assert.doesNotMatch(productionMain, /001_schema_v1\.up\.sql|CREATE SCHEMA app_(?:publication|administration|connector|external_integration|advisory)/u);
});

test("R3-B1 readiness requires all five exact contracts and releases the shared pool client", async () => {
  let released = 0;
  const rows = R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map((contract) => ({
    schema_name: contract.schemaName,
    artifact_sha256: contract.artifactSha256,
    table_count: contract.tableCount,
    schema_comment: contract.schemaComment,
    runtime_usage: true,
    runtime_create: false,
    public_acl_count: 0,
    runtime_grant_option_count: 0,
    columns_hash: contract.columnsHash,
    constraints_hash: contract.constraintsHash,
    indexes_hash: contract.indexesHash,
    runtime_acl_hash: contract.runtimeAclHash,
    owner_name: "ai_mls_production_migration_operator",
    public_schema_acl_count: 0,
    schema_grant_option_count: 0,
    function_acl_violation_count: 0,
    trigger_hash: contract.triggerHash,
    function_hash: contract.functionHash,
    effective_acl_hash: contract.effectiveAclHash,
    table_owner_violation_count: 0,
    function_owner_violation_count: 0,
    table_acl_violation_count: 0,
    unexpected_runtime_membership_count: 0,
    sequence_count: 0,
    unexpected_role_membership: false,
  }));
  const client: PostgreSqlClientPort = {
    query: <Row extends Record<string, unknown>>() => Promise.resolve(({ rows, rowCount: rows.length }) as unknown as PostgreSqlQueryResult<Row>),
    release: () => { released += 1; },
  };
  const pool: PostgreSqlPoolPort = { connect: () => Promise.resolve(client), close: () => Promise.resolve() };
  await assertR3B1ChildRootSchemasReady(pool);
  assert.equal(released, 1);
});

test("R3-B1 readiness fails closed on partial or drifted schema evidence", async () => {
  const client: PostgreSqlClientPort = {
    query: <Row extends Record<string, unknown>>() => Promise.resolve(({ rows: [{ schema_name: "app_publication", table_count: 7 }], rowCount: 1 }) as unknown as PostgreSqlQueryResult<Row>),
    release: () => undefined,
  };
  const pool: PostgreSqlPoolPort = { connect: () => Promise.resolve(client), close: () => Promise.resolve() };
  await assert.rejects(() => assertR3B1ChildRootSchemasReady(pool), /R3B1_CHILD_ROOT_SCHEMA_NOT_READY/u);
});
