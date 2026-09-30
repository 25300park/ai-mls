import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/index.js";
import { assertR3B1ChildRootSchemasReady } from "./child-root-postgresql-readiness.js";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);

const contracts = Object.freeze([
  ["publication", "app_publication", "publication", "613ecc0dfbe1a2ffd2d2edcdbda1d27b55713b8bcd09be6bc6e7bdbb7871d885"],
  ["administration", "app_administration", "administration", "f3da51aa3f55a0e7e1ba483f6d903950d8742b94a0d0bce9aea5f82bb8bfce3b"],
  ["source/connector", "app_connector", "connector", "a6a65bd9c779cf047a4261eb11822414fff131708af68b7ee3029cb3cfbe91fd"],
  ["source/external-integration", "app_external_integration", "external_integration", "fc629a5ccdd5fb4f5a8c97029178f0f523a1d37eb3d483c64c528f7c8bdb4e68"],
  ["ai/advisory", "app_advisory", "advisory", "ae70f9c9b3b18b08eff3e2b0b8bbdb24c14b9ca6a6a980cfc1f320b9223bc6ac"],
] as const);

async function sql(domain: string, name: string): Promise<string> {
  return readFile(resolve("modules", domain, "migrations/postgresql/production", name), "utf8");
}

test("R3-B1 migrations, exact verifiers, ACLs, drift detection, and rollback pass in disposable PostgreSQL", { skip: !enabled }, async () => {
  const admin = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  await admin.connect();
  const clean = async (): Promise<void> => {
    for (const [, schema] of contracts) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    for (const role of ["r3b1_unexpected_role", "ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      const exists = await admin.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS exists", [role]);
      if (exists.rows[0]?.exists === true) {
        await admin.query(`DROP OWNED BY ${role}`);
        await admin.query(`DROP ROLE ${role}`);
      }
    }
  };
  try {
    await clean();
    await admin.query("CREATE ROLE ai_mls_production_migration_operator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query("CREATE ROLE ai_mls_production_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query("GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");
    await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
    const migration = new Client({ host: "127.0.0.1", port, user: "ai_mls_production_migration_operator", database: "postgres" });
    await migration.connect();
    try {
      const publication = await sql("publication", "001_schema_v1.up.sql");
      await assert.rejects(() => migration.query(publication.replace("COMMIT;", "SELECT 1/0;\nCOMMIT;")));
      await migration.query("ROLLBACK");
      const rolledBack = await admin.query<{ exists: boolean }>("SELECT to_regnamespace('app_publication') IS NOT NULL AS exists");
      assert.equal(rolledBack.rows[0]?.exists, false);

      for (const [domain, , key, checksum] of contracts) {
        await migration.query(await sql(domain, "001_schema_v1.up.sql"));
        await migration.query(await sql(domain, "002_runtime_role_grants.sql"));
        await migration.query("SELECT set_config($1,$2,false)", [`ai_mls.r3b1_${key}_artifact_sha256`, checksum]);
        await migration.query(await sql(domain, "001_schema_v1.verify.sql"));
      }

      const total = await migration.query<{ count: string }>("SELECT count(*)::text AS count FROM pg_tables WHERE schemaname = ANY($1::text[])", [contracts.map((contract) => contract[1])]);
      assert.equal(total.rows[0]?.count, "36");

      const publicationVerify = await sql("publication", "001_schema_v1.verify.sql");
      await migration.query("CREATE TABLE app_publication.unexpected_drift(id integer)");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("DROP TABLE app_publication.unexpected_drift");

      await migration.query("SELECT set_config('ai_mls.r3b1_publication_artifact_sha256','wrong',false)");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("SELECT set_config('ai_mls.r3b1_publication_artifact_sha256',$1,false)", [contracts[0][3]]);

      await migration.query("REVOKE USAGE ON SCHEMA app_publication FROM ai_mls_production_runtime");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("GRANT USAGE ON SCHEMA app_publication TO ai_mls_production_runtime");
      await migration.query("GRANT CREATE ON SCHEMA app_publication TO ai_mls_production_runtime");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("REVOKE CREATE ON SCHEMA app_publication FROM ai_mls_production_runtime");
      await migration.query(publicationVerify);

      await migration.query("BEGIN; ALTER TABLE app_publication.publication_scopes ADD COLUMN unexpected_column text");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("ROLLBACK");

      const connectorVerify = await sql("source/connector", "001_schema_v1.verify.sql");
      await migration.query("BEGIN; DROP INDEX app_connector.connector_active_lease_scope");
      await assert.rejects(() => migration.query(connectorVerify));
      await migration.query("ROLLBACK");

      const externalVerify = await sql("source/external-integration", "001_schema_v1.verify.sql");
      await migration.query("BEGIN; DROP TABLE app_external_integration.ext_evidence");
      await assert.rejects(() => migration.query(externalVerify));
      await migration.query("ROLLBACK");

      const externalFks = await migration.query<{ count: string }>("SELECT count(*)::text AS count FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='app_external_integration' AND c.contype='f' AND pg_get_constraintdef(c.oid,true) LIKE '%REFERENCES app_external_integration.ext_contracts%'");
      assert.equal(externalFks.rows[0]?.count, "3");
      const externalJsonTypes = await migration.query<{ column_name: string; data_type: string }>("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='app_external_integration' AND column_name IN ('payload_json','result_json') ORDER BY table_name,column_name");
      assert.equal(externalJsonTypes.rows.length, 5);
      assert.equal(externalJsonTypes.rows.every((row) => row.data_type === "text"), true);
      const serialized = '{"z":1,"a":2}';
      await migration.query("INSERT INTO app_external_integration.ext_contracts(tenant_id,scope_type,scope_id,connector_id,source_id,contract_id,version,status,payload_json) VALUES('tenant-1','SOURCE','source-1','connector-1','source-1','contract-1',1,'ACTIVE',$1)", [serialized]);
      await migration.query("INSERT INTO app_external_integration.ext_observations(tenant_id,scope_type,scope_id,connector_id,source_id,provider_namespace,observation_id,contract_id,ordinal,fingerprint,payload_json) VALUES('tenant-1','SOURCE','source-1','connector-1','source-1','provider-1','observation-1','contract-1',1,'fingerprint-1',$1)", [serialized]);
      await migration.query("INSERT INTO app_external_integration.ext_evidence(tenant_id,scope_type,scope_id,connector_id,source_id,evidence_id,contract_id,ordinal,payload_json) VALUES('tenant-1','SOURCE','source-1','connector-1','source-1','evidence-1','contract-1',1,$1)", [serialized]);
      const preserved = await migration.query<{ payload_json: string }>("SELECT payload_json FROM app_external_integration.ext_observations WHERE observation_id='observation-1'");
      assert.equal(preserved.rows[0]?.payload_json, serialized);
      await assert.rejects(() => migration.query("INSERT INTO app_external_integration.ext_observations(tenant_id,scope_type,scope_id,connector_id,source_id,provider_namespace,observation_id,contract_id,ordinal,fingerprint,payload_json) VALUES('tenant-1','SOURCE','source-1','connector-1','source-1','provider-1','observation-duplicate','contract-1',1,'fingerprint-2','{}')"));
      await assert.rejects(() => migration.query("UPDATE app_external_integration.ext_observations SET ordinal=2 WHERE observation_id='observation-1'"), /append-only/u);
      await assert.rejects(() => migration.query("INSERT INTO app_external_integration.ext_evidence(tenant_id,scope_type,scope_id,connector_id,source_id,evidence_id,contract_id,ordinal,payload_json) VALUES('tenant-1','SOURCE','source-1','connector-1','source-1','orphan','missing-contract',2,'{}')"));

      const concurrent = new Client({ host: "127.0.0.1", port, user: "ai_mls_production_migration_operator", database: "postgres" });
      await concurrent.connect();
      try {
        await migration.query("BEGIN");
        await migration.query("SELECT 1 FROM app_external_integration.ext_contracts WHERE tenant_id='tenant-1' AND scope_type='SOURCE' AND scope_id='source-1' AND connector_id='connector-1' AND source_id='source-1' AND contract_id='contract-1' FOR UPDATE");
        await migration.query("INSERT INTO app_external_integration.ext_observations(tenant_id,scope_type,scope_id,connector_id,source_id,provider_namespace,observation_id,contract_id,ordinal,fingerprint,payload_json) SELECT 'tenant-1','SOURCE','source-1','connector-1','source-1','provider-1','observation-2','contract-1',COALESCE(max(ordinal),0)+1,'fingerprint-2','{}' FROM app_external_integration.ext_observations WHERE tenant_id='tenant-1' AND scope_type='SOURCE' AND scope_id='source-1' AND connector_id='connector-1' AND source_id='source-1' AND contract_id='contract-1'");
        await concurrent.query("BEGIN");
        const waiting = concurrent.query("SELECT 1 FROM app_external_integration.ext_contracts WHERE tenant_id='tenant-1' AND scope_type='SOURCE' AND scope_id='source-1' AND connector_id='connector-1' AND source_id='source-1' AND contract_id='contract-1' FOR UPDATE");
        await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
        await migration.query("COMMIT");
        await waiting;
        await concurrent.query("INSERT INTO app_external_integration.ext_observations(tenant_id,scope_type,scope_id,connector_id,source_id,provider_namespace,observation_id,contract_id,ordinal,fingerprint,payload_json) SELECT 'tenant-1','SOURCE','source-1','connector-1','source-1','provider-1','observation-3','contract-1',COALESCE(max(ordinal),0)+1,'fingerprint-3','{}' FROM app_external_integration.ext_observations WHERE tenant_id='tenant-1' AND scope_type='SOURCE' AND scope_id='source-1' AND connector_id='connector-1' AND source_id='source-1' AND contract_id='contract-1'");
        await concurrent.query("COMMIT");
      } finally {
        await concurrent.end();
      }
      const ordered = await migration.query<{ observation_id: string; ordinal: string }>("SELECT observation_id,ordinal::text FROM app_external_integration.ext_observations WHERE contract_id='contract-1' ORDER BY ordinal");
      assert.deepEqual(ordered.rows.map((row) => [row.observation_id, row.ordinal]), [["observation-1", "1"], ["observation-2", "2"], ["observation-3", "3"]]);

      await admin.query("ALTER TABLE app_publication.publication_scopes OWNER TO postgres");
      await assert.rejects(() => migration.query(publicationVerify));
      await admin.query("ALTER TABLE app_publication.publication_scopes OWNER TO ai_mls_production_migration_operator");

      await migration.query("GRANT USAGE ON SCHEMA app_publication TO PUBLIC");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("REVOKE USAGE ON SCHEMA app_publication FROM PUBLIC");
      await migration.query("GRANT SELECT ON app_publication.publication_scopes TO ai_mls_production_runtime WITH GRANT OPTION");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("REVOKE GRANT OPTION FOR SELECT ON app_publication.publication_scopes FROM ai_mls_production_runtime");
      await migration.query("GRANT SELECT ON app_publication.publication_scopes TO PUBLIC");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("REVOKE SELECT ON app_publication.publication_scopes FROM PUBLIC");

      await admin.query("GRANT ai_mls_production_migration_operator TO ai_mls_production_runtime");
      await assert.rejects(() => migration.query(publicationVerify));
      await admin.query("REVOKE ai_mls_production_migration_operator FROM ai_mls_production_runtime");
      await admin.query("CREATE ROLE r3b1_unexpected_role");
      await admin.query("GRANT ai_mls_production_runtime TO r3b1_unexpected_role");
      await assert.rejects(() => migration.query(publicationVerify));
      await admin.query("REVOKE ai_mls_production_runtime FROM r3b1_unexpected_role; DROP ROLE r3b1_unexpected_role");
      await migration.query(publicationVerify);

      await migration.query("CREATE TRIGGER publication_unexpected_trigger BEFORE UPDATE OR DELETE ON app_publication.publication_scopes FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation()");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("DROP TRIGGER publication_unexpected_trigger ON app_publication.publication_scopes");
      await migration.query("DROP TRIGGER publication_events_append_only ON app_publication.publication_events");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("CREATE TRIGGER publication_events_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_events FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation()");
      await migration.query("ALTER TABLE app_publication.publication_events DISABLE TRIGGER publication_events_append_only");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("ALTER TABLE app_publication.publication_events ENABLE TRIGGER publication_events_append_only");
      await migration.query("CREATE FUNCTION app_publication.wrong_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$");
      await migration.query("DROP TRIGGER publication_events_append_only ON app_publication.publication_events; CREATE TRIGGER publication_events_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_events FOR EACH ROW EXECUTE FUNCTION app_publication.wrong_append_only_mutation()")
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("DROP TRIGGER publication_events_append_only ON app_publication.publication_events; DROP FUNCTION app_publication.wrong_append_only_mutation(); CREATE TRIGGER publication_events_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_events FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation()")
      await migration.query("ALTER FUNCTION app_publication.reject_append_only_mutation() SECURITY DEFINER");
      await assert.rejects(() => migration.query(publicationVerify));
      await migration.query("ALTER FUNCTION app_publication.reject_append_only_mutation() SECURITY INVOKER");
      await migration.query(publicationVerify);

      const readinessPool: PostgreSqlPoolPort = {
        connect: () => Promise.resolve({
          query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]) =>
            migration.query(text, values === undefined ? undefined : [...values]) as unknown as Promise<PostgreSqlQueryResult<Row>>,
          release: () => undefined,
        }),
        close: () => Promise.resolve(),
      };
      await assertR3B1ChildRootSchemasReady(readinessPool);
      await migration.query("SELECT set_config('ai_mls.r3b1_publication_artifact_sha256','wrong',false)");
      await assert.rejects(() => assertR3B1ChildRootSchemasReady(readinessPool), /R3B1_CHILD_ROOT_SCHEMA_NOT_READY/u);
      await migration.query("SELECT set_config('ai_mls.r3b1_publication_artifact_sha256',$1,false)", [contracts[0][3]]);
      await migration.query("ALTER TABLE app_advisory.advisory_records DISABLE TRIGGER advisory_records_append_only");
      await assert.rejects(() => assertR3B1ChildRootSchemasReady(readinessPool), /R3B1_CHILD_ROOT_SCHEMA_NOT_READY/u);
      await migration.query("ALTER TABLE app_advisory.advisory_records ENABLE TRIGGER advisory_records_append_only");
      await assertR3B1ChildRootSchemasReady(readinessPool);

      await migration.query("INSERT INTO app_advisory.advisory_records(advisory_id,tenant_id,scope_ref,capability_id,schema_id,execution_fingerprint,payload_json) VALUES('adv-1','tenant-1','scope-1','AI-001','schema-1','fingerprint-1','{}')");
      await assert.rejects(() => migration.query("UPDATE app_advisory.advisory_records SET schema_id='changed' WHERE advisory_id='adv-1'"), /append-only/u);
      await assert.rejects(() => migration.query("DELETE FROM app_advisory.advisory_records WHERE advisory_id='adv-1'"), /append-only/u);
    } finally {
      await migration.end();
    }

    const runtime = new Client({ host: "127.0.0.1", port, user: "ai_mls_production_runtime", database: "postgres" });
    await runtime.connect();
    try {
      await runtime.query("SELECT * FROM app_publication.publication_scopes LIMIT 0");
      await runtime.query("INSERT INTO app_publication.publication_scopes(tenant_scope_id,publication_id,revision,history_json) VALUES('tenant-1','publication-1',0,'[]')");
      await runtime.query("UPDATE app_publication.publication_scopes SET revision=1 WHERE tenant_scope_id='tenant-1' AND publication_id='publication-1'");
      await assert.rejects(() => runtime.query("CREATE TABLE app_publication.runtime_ddl_forbidden(id integer)"));
    } finally {
      await runtime.end();
    }
  } finally {
    await clean();
    await admin.end();
  }
});
