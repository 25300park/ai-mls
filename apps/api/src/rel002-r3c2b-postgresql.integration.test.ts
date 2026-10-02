import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client, Pool } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { PostgreSqlIdentityWorkloadEvidenceReader } from "../../../modules/identity/src/identity-workload-evidence-postgresql.js";
import { PostgreSqlAuditEvidenceStore, type AuditEvidenceReadRecord } from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
import { PostgreSqlWorkloadStartupBindingStore } from "../../../modules/identity/src/workload-startup-binding-postgresql.js";
import type { WorkloadStartupBindingRecord } from "../../../modules/identity/src/workload-startup-binding.js";
import { evaluateR3C2BEvidencePersistence, assertR3C2BEvidencePersistenceReady } from "./r3c2b-postgresql-readiness.js";
const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED" && process.env["REL002_TEST_POSTGRES_PORT"] === "55441";
const config = { host: "127.0.0.1", port: 55441, database: "postgres" };
const migrations = ["modules/identity/migrations/postgresql/production/013_identity_workload_evidence_v1.up.sql", "modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql"];
test("R3-C2B durable evidence in dedicated disposable PostgreSQL", { skip: !enabled, timeout: 60000 }, async t => {
  const admin = new Client({ ...config, user: "postgres" }); await admin.connect();
  const migration = new Client({ ...config, user: "ai_mls_production_migration_operator" });
  const native = new Pool({ ...config, user: "ai_mls_production_runtime", max: 1 });
  const pool: PostgreSqlPoolPort = { async connect() { const client = await native.connect(); return { query: async <Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => await client.query(sql, values ? [...values] : undefined) as unknown as PostgreSqlQueryResult<Row>, release: destroy => client.release(destroy) }; }, close: () => native.end() };
  try {
    await admin.query("DROP SCHEMA IF EXISTS app_audit CASCADE; DROP SCHEMA IF EXISTS app_identity CASCADE");
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) { if ((await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount) await admin.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`); await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`); }
    await admin.query("REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
    await migration.connect();
    await migration.query(await readFile("modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql", "utf8"));
    await migration.query("REVOKE ALL ON SCHEMA app_identity FROM PUBLIC; GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime");
    await t.test("forward-only migration errors leave no partial new schema or evidence table", async () => {
      for (const file of migrations) {
        const sql=await readFile(file,"utf8");
        await assert.rejects(migration.query(sql.replace("COMMIT;","SELECT 1/0; COMMIT;")));
        await migration.query("ROLLBACK");
        const table=file.includes("identity/") ? "app_identity.identity_workload_evidence" : "app_audit.audit_evidence_read_records";
        assert.equal((await migration.query<{relation:string|null}>("SELECT to_regclass($1)::text AS relation",[table])).rows[0]?.relation,null);
        await migration.query(sql);
      }
    });
    const event: AuditEvidenceReadRecord = { auditEvidenceRef: "registration-audit", sourceDomain: "IDENTITY", aggregateType: "REGISTERED_SERVICE_WORKLOAD", aggregateId: "registration", aggregateVersion: 1, eventType: "REGISTERED_SERVICE_WORKLOAD.REGISTERED", payloadSchemaVersion: 1, final: true, tenantId: "tenant", scopeRef: "tenant-scope", payload: { registrationId: "registration", registrationVersion: 1, tenantId: "tenant", principalId: "principal", principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION" }, occurredAt: "2026-10-02T00:00:00.000Z", materializedAt: "2026-10-02T00:00:01.000Z" };
    const audit = new PostgreSqlAuditEvidenceStore(pool);
    await t.test("migration replay rejection rolls back without rewriting evidence", async () => { for (const file of migrations) { await assert.rejects(migration.query(await readFile(file, "utf8"))); await migration.query("ROLLBACK"); } });
    await t.test("immutable independent proof is restart-readable and runtime SELECT-only", async () => {
      await migration.query("INSERT INTO app_identity.identity_workload_evidence VALUES ('proof','registration',1,'tenant','principal',1,true)");
      const reader = new PostgreSqlIdentityWorkloadEvidenceReader(pool);
      assert.equal((await reader.findByEvidenceRef("proof"))?.principalId, "principal"); await reader.close();
      assert.equal((await new PostgreSqlIdentityWorkloadEvidenceReader(pool).findByEvidenceRef("proof"))?.registrationVersion, 1);
      const client = await native.connect(); try { await assert.rejects(client.query("INSERT INTO app_identity.identity_workload_evidence VALUES ('other','registration',1,'tenant','principal',1,true)"), { code: "42501" }); await assert.rejects(client.query("UPDATE app_identity.identity_workload_evidence SET principal_id='other'"), { code: "42501" }); } finally { client.release(); }
      await assert.rejects(migration.query("UPDATE app_identity.identity_workload_evidence SET principal_id='other'"), { code: "55000" });
    });
    await t.test("Audit JSONB equality, concurrent idempotency, conflict and restart", async () => {
      assert.deepEqual(await Promise.all([audit.materialize(event), audit.materialize(event)]), [event, event]);
      assert.deepEqual(await audit.materialize({ ...event, payload: Object.fromEntries(Object.entries(event.payload).reverse()) }), event);
      await assert.rejects(audit.materialize({ ...event, payload: { ...event.payload, principalId: "other" } }), { code: "CONFLICT" });
      assert.deepEqual(await new PostgreSqlAuditEvidenceStore(pool).findByEvidenceRef(event.auditEvidenceRef), event);
      assert.equal((await migration.query<{ count: number }>("SELECT count(*)::int AS count FROM app_audit.audit_evidence_read_records")).rows[0]?.count, 1);
    });
    await t.test("runtime Audit ACL denies UPDATE DELETE DDL grant option and malformed events", async () => {
      const client = await native.connect(); try {
        for (const sql of ["UPDATE app_audit.audit_evidence_read_records SET tenant_id='other'", "DELETE FROM app_audit.audit_evidence_read_records", "CREATE TABLE app_audit.forbidden(id int)"]) await assert.rejects(client.query(sql), { code: "42501" });
        await client.query("GRANT SELECT ON app_audit.audit_evidence_read_records TO PUBLIC");
        assert.equal((await client.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='app_audit.audit_evidence_read_records'::regclass AND (a.grantee=0 OR a.is_grantable)")).rows[0]?.count, 0);
        await assert.rejects(client.query("INSERT INTO app_audit.audit_evidence_read_records SELECT 'bad',source_domain,aggregate_type,aggregate_id,aggregate_version,event_type,payload_schema_version,final,tenant_id,scope_ref,payload || '{\"principalType\":\"HUMAN\"}'::jsonb,occurred_at,materialized_at FROM app_audit.audit_evidence_read_records"));
      } finally { client.release(); }
      await assert.rejects(migration.query("DELETE FROM app_audit.audit_evidence_read_records"), { code: "55000" });
    });
    await t.test("exact readiness rejects schema owner ACL trigger function inventory and role drift", async () => {
      assert.equal((await evaluateR3C2BEvidencePersistence(pool)).status, "READY");
      await assertR3C2BEvidencePersistenceReady(pool);
      for (const file of migrations) await migration.query(await readFile(file.replace(".up.sql", ".verify.sql"), "utf8"));
      const drift = [
        ["ALTER SCHEMA app_audit OWNER TO ai_mls_production_runtime", "ALTER SCHEMA app_audit OWNER TO ai_mls_production_migration_operator; REVOKE ALL ON SCHEMA app_audit FROM ai_mls_production_runtime; GRANT USAGE ON SCHEMA app_audit TO ai_mls_production_runtime"],
        ["ALTER TABLE app_audit.audit_evidence_read_records OWNER TO ai_mls_production_runtime", "ALTER TABLE app_audit.audit_evidence_read_records OWNER TO ai_mls_production_migration_operator; REVOKE ALL ON app_audit.audit_evidence_read_records FROM ai_mls_production_runtime; GRANT SELECT,INSERT ON app_audit.audit_evidence_read_records TO ai_mls_production_runtime"],
        ["ALTER TABLE app_audit.audit_evidence_read_records RENAME TO missing", "ALTER TABLE app_audit.missing RENAME TO audit_evidence_read_records"],
        ["ALTER TABLE app_identity.identity_workload_evidence ADD COLUMN unexpected text", "ALTER TABLE app_identity.identity_workload_evidence DROP COLUMN unexpected"],
        ["ALTER TABLE app_audit.audit_evidence_read_records DISABLE TRIGGER audit_evidence_read_records_guard", "ALTER TABLE app_audit.audit_evidence_read_records ENABLE TRIGGER audit_evidence_read_records_guard"],
        ["GRANT UPDATE ON app_audit.audit_evidence_read_records TO ai_mls_production_runtime", "REVOKE UPDATE ON app_audit.audit_evidence_read_records FROM ai_mls_production_runtime"],
        ["GRANT SELECT ON app_audit.audit_evidence_read_records TO PUBLIC", "REVOKE SELECT ON app_audit.audit_evidence_read_records FROM PUBLIC"],
        ["GRANT INSERT ON app_audit.audit_evidence_read_records TO ai_mls_production_runtime WITH GRANT OPTION", "REVOKE GRANT OPTION FOR INSERT ON app_audit.audit_evidence_read_records FROM ai_mls_production_runtime"],
        ["ALTER FUNCTION app_audit.audit_evidence_read_records_guard() SECURITY DEFINER", "ALTER FUNCTION app_audit.audit_evidence_read_records_guard() SECURITY INVOKER"],
        ["CREATE TABLE app_audit.unexpected(id int)", "DROP TABLE app_audit.unexpected"],
        ["ALTER ROLE ai_mls_production_runtime INHERIT", "ALTER ROLE ai_mls_production_runtime NOINHERIT"],
        ["GRANT ai_mls_production_migration_operator TO ai_mls_production_runtime", "REVOKE ai_mls_production_migration_operator FROM ai_mls_production_runtime"],
      ];
      for (const [change, restore] of drift) {
        await admin.query(change!);
        try { assert.equal((await evaluateR3C2BEvidencePersistence(pool)).status, "NOT_READY", change); await assert.rejects(assertR3C2BEvidencePersistenceReady(pool)); }
        finally { await admin.query(restore!); }
        assert.equal((await evaluateR3C2BEvidencePersistence(pool)).status, "READY", restore);
      }
    });
    await t.test("Identity replacement atomically commits two distinct final refs and rolls back either mapping failure", async () => {
      await migration.query(await readFile("modules/identity/migrations/postgresql/production/012_workload_startup_binding_v1.up.sql", "utf8"));
      await migration.query("GRANT SELECT ON app_identity.identity_registered_service_workloads TO ai_mls_production_runtime");
      await migration.query("INSERT INTO app_identity.identity_registered_service_workloads VALUES ('registration','tenant','principal','SERVICE','WORKLOAD','PRODUCTION','ACTIVE','startup','api',1,'proof','registration-audit','2026-10-02T00:00:00Z','2026-10-02T00:00:00Z')");
      const store = new PostgreSqlWorkloadStartupBindingStore(pool, { assertBindingReferences() { return Promise.resolve(); } }, audit);
      const proposed: WorkloadStartupBindingRecord = { bindingId: "binding", bindingVersion: 1, registrationId: "registration", registrationVersion: 1, tenantId: "tenant", principalId: "principal", organizationId: "org", projectId: "project", scopeType: "TEAM", scopeId: "team", identityEvidenceRef: "proof", organizationEvidenceRef: "organization-governance:org:1", projectEvidenceRef: "project-governance:project:1", scopeEvidenceRef: "administration-scope:tenant:TEAM_SCOPE:team:1", status: "PROPOSED", auditEvidenceRef: "proposal", createdAt: event.occurredAt, updatedAt: event.occurredAt };
      const lifecycle = (record: WorkloadStartupBindingRecord): AuditEvidenceReadRecord => ({ ...event, auditEvidenceRef: record.auditEvidenceRef, aggregateType: "WORKLOAD_STARTUP_BINDING", aggregateId: record.bindingId, aggregateVersion: record.bindingVersion, eventType: `WORKLOAD_STARTUP_BINDING.${record.status === "ACTIVE" ? "ACTIVATED" : "REVOKED"}`, payload: { bindingId: record.bindingId, bindingVersion: record.bindingVersion, registrationId: record.registrationId, registrationVersion: record.registrationVersion, tenantId: record.tenantId, principalId: record.principalId, ...(record.status === "ACTIVE" ? { organizationId: record.organizationId, projectId: record.projectId, scopeType: record.scopeType, scopeId: record.scopeId } : {}), status: record.status } });
      await store.createProposed(proposed);
      const active: WorkloadStartupBindingRecord = { ...proposed, status: "ACTIVE", auditEvidenceRef: "activation-1" };
      await assert.rejects(new PostgreSqlWorkloadStartupBindingStore(pool, { assertBindingReferences() { return Promise.resolve(); } }).transition(proposed, active), { code: "INPUT_INVALID" });
      await assert.rejects(store.transition(proposed, active), { code: "INPUT_INVALID" });
      assert.equal((await store.findVersion("binding", 1, "tenant"))?.status, "PROPOSED");
      await store.transition(proposed, active, lifecycle(active));
      const standaloneRevoked: WorkloadStartupBindingRecord = { ...active, status: "REVOKED", auditEvidenceRef: "standalone-revocation" };
      await assert.rejects(store.transition(active, standaloneRevoked, { ...lifecycle(standaloneRevoked), payload: { ...lifecycle(standaloneRevoked).payload, replacementBindingId: "fictional", replacementBindingVersion: 99 } }), { code: "INPUT_INVALID" });
      const next: WorkloadStartupBindingRecord = { ...proposed, bindingVersion: 2 };
      const revoked: WorkloadStartupBindingRecord = { ...active, status: "REVOKED", auditEvidenceRef: "revocation-1" };
      const activated: WorkloadStartupBindingRecord = { ...next, status: "ACTIVE", auditEvidenceRef: "activation-2" };
      const pair = { revocation: lifecycle(revoked), activation: lifecycle(activated) };
      await assert.rejects(store.replaceActive(active, next, "shared-ref", active.updatedAt));
      await assert.rejects(store.replaceActive(active, next, { ...pair, activation: { ...pair.activation, auditEvidenceRef: pair.revocation.auditEvidenceRef } }, active.updatedAt));
      await audit.materialize({ ...pair.activation, scopeRef: "conflicting-existing" });
      await assert.rejects(store.replaceActive(active, next, pair, active.updatedAt));
      assert.equal((await store.findVersion("binding", 1, "tenant"))?.status, "ACTIVE");
      assert.equal(await store.findVersion("binding", 2, "tenant"), undefined);
      assert.equal(await audit.findByEvidenceRef("revocation-1"), undefined);
      const successPair = { ...pair, activation: { ...pair.activation, auditEvidenceRef: "activation-2-success" } };
      const replacement = await store.replaceActive(active, next, successPair, active.updatedAt);
      assert.equal(replacement.auditEvidenceRef, "activation-2-success");
      assert.equal((await store.findVersion("binding", 1, "tenant"))?.auditEvidenceRef, "revocation-1");
      assert.deepEqual(await store.replaceActive(active, next, successPair, active.updatedAt), replacement);
      assert.equal((await audit.findByEvidenceRef("revocation-1"))?.aggregateVersion, 1);
      assert.equal((await audit.findByEvidenceRef("activation-2-success"))?.aggregateVersion, 2);
      await store.close();
    });
    await audit.close();
  } finally { await native.end(); await migration.end(); await admin.end(); }
});
