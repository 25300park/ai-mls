import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client, Pool } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { PostgreSqlOrganizationGovernanceStore } from "../../../modules/organization/src/organization-governance-postgresql.js";
import type { OrganizationGovernanceRecord } from "../../../modules/organization/src/organization-governance.js";
import { PostgreSqlProjectGovernanceStore } from "../../../modules/administration/src/project-governance-postgresql.js";
import type { ProjectGovernanceRecord } from "../../../modules/administration/src/project-governance.js";
import { PostgreSqlWorkloadStartupBindingStore } from "../../../modules/identity/src/workload-startup-binding-postgresql.js";
import { decodeCanonicalReference, type WorkloadStartupBindingRecord } from "../../../modules/identity/src/workload-startup-binding.js";
import { evaluateR3C1Persistence, assertR3C1PersistenceReady } from "./r3c1-postgresql-readiness.js";
const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED" && process.env["REL002_TEST_POSTGRES_PORT"] === "55439";
const roots = [
  ["modules/organization", "001_organization_governance_v1", "app_organization", "organization_governance_versions", "organization_id", "organization_version"],
  ["modules/administration", "003_project_governance_v1", "app_administration", "project_governance_versions", "project_id", "project_version"],
  ["modules/identity", "012_workload_startup_binding_v1", "app_identity", "workload_startup_binding_versions", "binding_id", "binding_version"],
] as const;
const config = { host: "127.0.0.1", port: 55439, database: "postgres" };
test("R3-C1 durable contracts in isolated disposable PostgreSQL", { skip: !enabled, timeout: 60000 }, async t => {
  const admin = new Client({ ...config, user: "postgres" }); await admin.connect();
  const clean = async () => {
    for (const schema of ["app_organization", "app_administration", "app_identity"]) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query("DROP ROLE IF EXISTS r3c1_unauthorized_migration_member");
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      if ((await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount) {
        await admin.query(`DROP OWNED BY ${role}`); await admin.query(`DROP ROLE ${role}`);
      }
    }
  };
  const migration = new Client({ ...config, user: "ai_mls_production_migration_operator" });
  const runtime = new Client({ ...config, user: "ai_mls_production_runtime" });
  try {
    await clean();
    for (const role of ["ai_mls_production_migration_operator", "ai_mls_production_runtime"]) await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await admin.query("REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC");
    await admin.query("GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");
    await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
    await migration.connect();
    await migration.query(await readFile("modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql", "utf8"));
    await admin.query("ALTER SCHEMA app_identity OWNER TO ai_mls_production_migration_operator");
    await migration.query(await readFile("modules/administration/migrations/postgresql/production/001_schema_v1.up.sql", "utf8"));
    await migration.query(await readFile("modules/administration/migrations/postgresql/production/002_runtime_role_grants.sql", "utf8"));
    await migration.query("GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime; GRANT SELECT ON app_identity.identity_registered_service_workloads TO ai_mls_production_runtime");
    await t.test("forward-only migration atomic rollback and duplicate apply rejection", async () => {
      for (const [directory, name, schema, table] of roots) {
        const sql = await readFile(`${directory}/migrations/postgresql/production/${name}.up.sql`, "utf8");
        await assert.rejects(() => migration.query(sql.replace("COMMIT;", "SELECT 1/0; COMMIT;")));
        await migration.query("ROLLBACK");
        assert.equal((await admin.query<{object:string|null}>("SELECT to_regclass($1) AS object", [`${schema}.${table}`])).rows[0]?.object, null);
        await migration.query(sql);
        await assert.rejects(() => migration.query(sql)); await migration.query("ROLLBACK");
      }
    });
    await migration.query(`INSERT INTO app_identity.identity_registered_service_workloads VALUES ('registration-1','tenant-1','principal-1','SERVICE','WORKLOAD','PRODUCTION','ACTIVE','purpose','audience',1,'identity-proof','registration-audit',now(),now())`);
    await runtime.connect();
    const evidence = JSON.stringify([{ type: "AUDIT", id: "audit-1", version: 1 }]);
    await t.test("organization version, immutable payload, tenant key, lifecycle and RETIRED terminal", async () => {
      await runtime.query("INSERT INTO app_organization.organization_governance_versions VALUES ('org-1',1,'tenant-1','PROPOSED',$1,'2026-10-02T00:00:00Z','2026-10-02T00:00:00Z')", [evidence]);
      await assert.rejects(() => runtime.query("INSERT INTO app_organization.organization_governance_versions SELECT * FROM app_organization.organization_governance_versions"), { code: "23505" });
      await assert.rejects(() => migration.query("UPDATE app_organization.organization_governance_versions SET tenant_id='wrong'"));
      assert.equal((await runtime.query("SELECT * FROM app_organization.organization_governance_versions WHERE organization_id='org-1' AND organization_version=1 AND tenant_id='wrong'")).rowCount, 0);
      for (const state of ["ACTIVE", "SUSPENDED", "ACTIVE", "RETIRED"]) await runtime.query("UPDATE app_organization.organization_governance_versions SET status=$1,updated_at=now() WHERE organization_id='org-1'", [state]);
      await assert.rejects(() => runtime.query("UPDATE app_organization.organization_governance_versions SET status='ACTIVE',updated_at=now()"));
    });
    await t.test("project containment versioning, lifecycle, frozen fields and duplicates", async () => {
      const scopes = JSON.stringify([{ scopeType: "TEAM", scopeId: "team-1" }]);
      await runtime.query("INSERT INTO app_administration.project_governance_versions VALUES ('project-1',1,'org-1','tenant-1','PROPOSED',$1,$2,'2026-10-02T00:00:00Z','2026-10-02T00:00:00Z')", [scopes, evidence]);
      await assert.rejects(() => migration.query("UPDATE app_administration.project_governance_versions SET contained_scopes='[]'::jsonb"));
      await assert.rejects(() => runtime.query("INSERT INTO app_administration.project_governance_versions SELECT * FROM app_administration.project_governance_versions"), { code: "23505" });
      await runtime.query("INSERT INTO app_administration.project_governance_versions SELECT project_id,2,organization_id,tenant_id,status,'[{\"scopeType\":\"POLICY\",\"scopeId\":\"policy-1\"}]'::jsonb,evidence_references,created_at,updated_at FROM app_administration.project_governance_versions");
      for (const state of ["ACTIVE", "SUSPENDED", "ACTIVE", "RETIRED"]) await runtime.query("UPDATE app_administration.project_governance_versions SET status=$1,updated_at=now() WHERE project_version=1", [state]);
      await assert.rejects(() => runtime.query("UPDATE app_administration.project_governance_versions SET status='ACTIVE',updated_at=now() WHERE project_version=1"));
    });
    const bindingInsert = `INSERT INTO app_identity.workload_startup_binding_versions VALUES ($1,$2,'registration-1',1,'tenant-1','principal-1','org-1','project-1',$3,'team-1','identity-proof','organization-governance:org-1:1','project-governance:project-1:1','administration-scope:tenant-1:TEAM_SCOPE:team-1:1','PROPOSED','binding-audit','2026-10-02T00:00:00Z','2026-10-02T00:00:00Z')`;
    await t.test("binding lifecycle, frozen fields, scope enforcement, no duplicate proof and active uniqueness", async () => {
      await runtime.query(bindingInsert, ["binding-1", 1, "TEAM"]);
      await assert.rejects(() => runtime.query(bindingInsert, ["bad-scope", 1, "RESOURCE"]));
      await assert.rejects(() => runtime.query(bindingInsert, ["binding-1", 1, "TEAM"]), { code: "23505" });
      await assert.rejects(() => migration.query("UPDATE app_identity.workload_startup_binding_versions SET principal_id='wrong'"));
      await runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='ACTIVE',updated_at=now() WHERE binding_id='binding-1'");
      await runtime.query(bindingInsert, ["binding-2", 1, "TEAM"]);
      await assert.rejects(() => runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='ACTIVE',updated_at=now() WHERE binding_id='binding-2'"), { code: "23505" });
      assert.equal((await admin.query<{count:number}>("SELECT count(*)::integer AS count FROM information_schema.columns WHERE table_schema='app_identity' AND table_name='workload_startup_binding_versions' AND column_name='binding_evidence_ref'")).rows[0]?.count, 0);
    });
    await t.test("binding replacement commits or rolls back atomically and revoked is terminal", async () => {
      await runtime.query("BEGIN");
      await runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='REVOKED',updated_at=now() WHERE binding_id='binding-1'");
      await runtime.query(bindingInsert, ["binding-1", 2, "TEAM"]);
      await runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='ACTIVE',updated_at=now() WHERE binding_id='binding-1' AND binding_version=2");
      await runtime.query("ROLLBACK");
      assert.deepEqual((await runtime.query("SELECT binding_version::integer,status FROM app_identity.workload_startup_binding_versions WHERE binding_id='binding-1'")).rows, [{ binding_version: 1, status: "ACTIVE" }]);
      await runtime.query("BEGIN");
      await runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='REVOKED',updated_at=now() WHERE binding_id='binding-1'");
      await runtime.query(bindingInsert, ["binding-1", 2, "TEAM"]);
      await runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='ACTIVE',updated_at=now() WHERE binding_id='binding-1' AND binding_version=2");
      await runtime.query("COMMIT");
      await assert.rejects(() => runtime.query("UPDATE app_identity.workload_startup_binding_versions SET status='ACTIVE',updated_at=now() WHERE binding_id='binding-1' AND binding_version=1"));
    });
    await t.test("async stores share one pool: durable replay, containment, CAS, atomic replacement and concurrency", async () => {
      const native=new Pool({ ...config,user:"ai_mls_production_runtime",max:1 }); let leases=0,releases=0;
      const pool: PostgreSqlPoolPort={connect:async()=>{leases++;const client=await native.connect();return {query:async <Row extends Record<string,unknown>>(sql:string,args?:readonly unknown[]):Promise<PostgreSqlQueryResult<Row>> => await client.query(sql,args===undefined?undefined:[...args]) as unknown as PostgreSqlQueryResult<Row>,release:destroy=>{releases++;client.release(destroy);}};},close:()=>native.end()};
      const organizations=new PostgreSqlOrganizationGovernanceStore(pool);
      const projects=new PostgreSqlProjectGovernanceStore(pool,organizations);
      let referencesAvailable=true;
      const references={assertBindingReferences:async(record:WorkloadStartupBindingRecord):Promise<void>=>{
        if(!referencesAvailable)throw new Error("injected reference outage");
        const orgVersion=decodeCanonicalReference(record.organizationEvidenceRef,"organization-governance",[record.organizationId]);
        const projectVersion=decodeCanonicalReference(record.projectEvidenceRef,"project-governance",[record.projectId]);
        const org=await organizations.findVersion(record.organizationId,orgVersion,record.tenantId);
        const project=await projects.findVersion(record.projectId,projectVersion,record.tenantId);
        assert.equal(org?.status,"ACTIVE"); assert.equal(project?.status,"ACTIVE"); assert.equal(project.organizationId,org.organizationId);
        assert.ok(project.containedScopes.some(s=>s.scopeType===record.scopeType&&s.scopeId===record.scopeId));
        // Trusted read-boundary fixture only. R3-C1 does not activate a scope/audit startup resolver.
        assert.equal(record.scopeId,"team-api"); assert.equal(record.scopeType,"TEAM"); assert.ok(record.auditEvidenceRef.startsWith("binding-audit"));
      }};
      const bindings=new PostgreSqlWorkloadStartupBindingStore(pool,references);
      try {
        const instant="2026-10-02T00:00:00.000Z",later="2026-10-02T00:01:00.000Z";
        const org:OrganizationGovernanceRecord={organizationId:"org-api",organizationVersion:1,tenantId:"tenant-api",status:"PROPOSED",evidenceReferences:[{type:"AUDIT",id:"audit-api",version:1}],createdAt:instant,updatedAt:instant};
        assert.deepEqual(await organizations.createProposed(org),org);
        assert.deepEqual(await organizations.createProposed({...org,evidenceReferences:[{version:1,id:"audit-api",type:"AUDIT"}]}),org);
        const activeOrg:OrganizationGovernanceRecord={...org,status:"ACTIVE",updatedAt:later};
        await organizations.transition(org,activeOrg); assert.deepEqual(await organizations.transition(org,activeOrg),activeOrg);
        assert.equal(await organizations.findVersion(org.organizationId,1,"wrong"),undefined);
        await assert.rejects(()=>organizations.createProposed({...org,evidenceReferences:[{type:"AUDIT",id:"conflict",version:1}]}),{code:"CONFLICT"});
        const project:ProjectGovernanceRecord={projectId:"project-api",projectVersion:1,organizationId:org.organizationId,tenantId:org.tenantId,status:"PROPOSED",containedScopes:[{scopeType:"TEAM",scopeId:"team-api"}],evidenceReferences:org.evidenceReferences,createdAt:instant,updatedAt:instant};
        await assert.rejects(()=>projects.createProposed({...project,tenantId:"wrong"}),{code:"CONFLICT"});
        await projects.createProposed(project); const activeProject:ProjectGovernanceRecord={...project,status:"ACTIVE",updatedAt:later};
        await projects.transition(project,activeProject); assert.deepEqual(await projects.transition(project,activeProject),activeProject);
        const suspendedOrg:OrganizationGovernanceRecord={...activeOrg,status:"SUSPENDED",updatedAt:"2026-10-02T00:01:30.000Z"};
        await organizations.transition(activeOrg,suspendedOrg);
        assert.deepEqual(await projects.createProposed(project),activeProject);
        assert.deepEqual(await projects.transition(project,activeProject),activeProject);
        await organizations.transition(suspendedOrg,{...activeOrg,updatedAt:"2026-10-02T00:01:45.000Z"});
        await projects.createProposed({...project,projectVersion:2,containedScopes:[...project.containedScopes,{scopeType:"POLICY",scopeId:"policy-api"}]});
        await assert.rejects(()=>projects.transition(project,{...activeProject,containedScopes:[{scopeType:"TEAM",scopeId:"different"}]}),{code:"CONFLICT"});
        await migration.query(`INSERT INTO app_identity.identity_registered_service_workloads VALUES ('registration-api','tenant-api','principal-api','SERVICE','WORKLOAD','PRODUCTION','ACTIVE','purpose','audience',1,'identity-api','audit-api',now(),now())`);
        const binding:WorkloadStartupBindingRecord={bindingId:"binding-api",bindingVersion:1,registrationId:"registration-api",registrationVersion:1,tenantId:org.tenantId,principalId:"principal-api",organizationId:org.organizationId,projectId:project.projectId,scopeType:"TEAM",scopeId:"team-api",identityEvidenceRef:"identity-api",organizationEvidenceRef:"organization-governance:org-api:1",projectEvidenceRef:"project-governance:project-api:1",scopeEvidenceRef:"administration-scope:tenant-api:TEAM_SCOPE:team-api:1",status:"PROPOSED",auditEvidenceRef:"binding-audit-create",createdAt:instant,updatedAt:instant};
        await bindings.createProposed(binding); assert.deepEqual(await bindings.createProposed(binding),binding);
        await assert.rejects(()=>bindings.createProposed({...binding,scopeEvidenceRef:"administration-scope:tenant-api:TEAM_SCOPE:team-api:2"}),{code:"CONFLICT"});
        const active:WorkloadStartupBindingRecord={...binding,status:"ACTIVE",updatedAt:later,auditEvidenceRef:"binding-audit-active"};
        await bindings.transition(binding,active);
        referencesAvailable=false;
        assert.deepEqual(await bindings.createProposed(binding),active);
        assert.deepEqual(await bindings.transition(binding,active),active);
        referencesAvailable=true;
        await assert.rejects(()=>bindings.findActive(binding.registrationId,1,binding.tenantId,"wrong"),{code:"CONFLICT"});
        assert.equal(await bindings.findActive(binding.registrationId,2,binding.tenantId,binding.principalId),undefined);
        const proposed2:WorkloadStartupBindingRecord={...binding,bindingVersion:2,createdAt:later,updatedAt:later};
        const replacement=await bindings.replaceActive(active,proposed2,"binding-audit-replace","2026-10-02T00:02:00.000Z");
        referencesAvailable=false;
        assert.deepEqual(await bindings.replaceActive(active,proposed2,"binding-audit-replace","2026-10-02T00:02:00.000Z"),replacement);
        referencesAvailable=true;
        await migration.query(`CREATE FUNCTION app_identity.r3c1_test_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.binding_version=3 AND NEW.status='ACTIVE' THEN RAISE EXCEPTION 'injected abort'; END IF; RETURN NEW; END $$; CREATE TRIGGER r3c1_test_abort BEFORE UPDATE ON app_identity.workload_startup_binding_versions FOR EACH ROW EXECUTE FUNCTION app_identity.r3c1_test_abort()`);
        try {
          await assert.rejects(()=>bindings.replaceActive(replacement,{...proposed2,bindingVersion:3},"binding-audit-failed","2026-10-02T00:03:00.000Z"));
          assert.equal((await bindings.findActive(binding.registrationId,1,binding.tenantId,binding.principalId))?.bindingVersion,2);
          assert.equal(await bindings.findVersion(binding.bindingId,3,binding.tenantId),undefined);
        } finally { await migration.query("DROP TRIGGER r3c1_test_abort ON app_identity.workload_startup_binding_versions; DROP FUNCTION app_identity.r3c1_test_abort()"); }
        const outcomes=await Promise.allSettled([4,5].map(version=>bindings.replaceActive(replacement,{...proposed2,bindingVersion:version},"binding-audit-race","2026-10-02T00:04:00.000Z")));
        assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);assert.equal(outcomes.filter(o=>o.status==="rejected").length,1);
        await bindings.close(); const restarted=new PostgreSqlWorkloadStartupBindingStore(pool,references);
        try { assert.ok([4,5].includes((await restarted.findActive(binding.registrationId,1,binding.tenantId,binding.principalId))!.bindingVersion)); } finally { await restarted.close(); }
        assert.equal((await organizations.findActive(org.organizationId,org.tenantId))?.organizationVersion,1);
        assert.equal((await evaluateR3C1Persistence(pool)).status,"READY");
        assert.equal(leases,releases);
      } finally { await bindings.close();await projects.close();await organizations.close();await native.end(); }
    });
    await t.test("three-root exact readiness and replay-safe verifier reject structural, owner, ACL and role drift", async () => {
      const pool:PostgreSqlPoolPort={connect:async()=>await Promise.resolve({query:async <Row extends Record<string,unknown>>(sql:string,args?:readonly unknown[]):Promise<PostgreSqlQueryResult<Row>>=>await runtime.query(sql,args===undefined?undefined:[...args]) as unknown as PostgreSqlQueryResult<Row>,release:()=>undefined}),close:()=>Promise.resolve()};
      assert.equal((await evaluateR3C1Persistence(pool)).status,"READY");
      for(const[directory,name]of roots) for(let i=0;i<2;i++)await migration.query(await readFile(`${directory}/migrations/postgresql/production/${name}.verify.sql`,"utf8"));
      for(const[,,schema,table]of roots){
        const target=`${schema}.${table}`;
        const mutations=[
          [`GRANT SELECT ON ${target} TO PUBLIC`,`REVOKE SELECT ON ${target} FROM PUBLIC`],
          [`GRANT UPDATE(tenant_id) ON ${target} TO ai_mls_production_runtime`,`REVOKE UPDATE(tenant_id) ON ${target} FROM ai_mls_production_runtime`],
          [`ALTER TABLE ${target} DISABLE TRIGGER ${table}_guard`,`ALTER TABLE ${target} ENABLE TRIGGER ${table}_guard`],
          [`ALTER FUNCTION ${schema}.${table}_guard() SECURITY DEFINER`,`ALTER FUNCTION ${schema}.${table}_guard() SECURITY INVOKER`],
          [`GRANT EXECUTE ON FUNCTION ${schema}.${table}_guard() TO PUBLIC`,`REVOKE EXECUTE ON FUNCTION ${schema}.${table}_guard() FROM PUBLIC`],
          [`ALTER TABLE ${target} OWNER TO postgres`,`ALTER TABLE ${target} OWNER TO ai_mls_production_migration_operator`],
          [`GRANT CREATE ON SCHEMA ${schema} TO ai_mls_production_runtime`,`REVOKE CREATE ON SCHEMA ${schema} FROM ai_mls_production_runtime`],
        ];
        for(const[change,restore]of mutations){await admin.query(change!);try{const verdict=await evaluateR3C1Persistence(pool);assert.equal(verdict.status,"NOT_READY");assert.ok(verdict.failingRoots.includes(schema));await assert.rejects(()=>assertR3C1PersistenceReady(pool));}finally{await admin.query(restore!);}assert.equal((await evaluateR3C1Persistence(pool)).status,"READY");}
        const index=`${table}_one_active`;
        const definition=(await admin.query<{definition:string}>("SELECT pg_get_indexdef($1::regclass) AS definition",[`${schema}.${index}`])).rows[0]!.definition;
        await admin.query(`DROP INDEX ${schema}.${index}`);try{assert.equal((await evaluateR3C1Persistence(pool)).status,"NOT_READY");}finally{await admin.query(definition);}
      }
      await admin.query("CREATE TABLE app_organization.unexpected(id integer)");try{assert.equal((await evaluateR3C1Persistence(pool)).status,"NOT_READY");}finally{await admin.query("DROP TABLE app_organization.unexpected");}
      await admin.query("ALTER ROLE ai_mls_production_runtime CREATEROLE");try{assert.equal((await evaluateR3C1Persistence(pool)).failingRoots.length,3);}finally{await admin.query("ALTER ROLE ai_mls_production_runtime NOCREATEROLE");}
      await admin.query("CREATE ROLE r3c1_unauthorized_migration_member LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
      await admin.query("GRANT ai_mls_production_migration_operator TO r3c1_unauthorized_migration_member");
      try {
        assert.equal((await evaluateR3C1Persistence(pool)).failingRoots.length,3);
        for(const[directory,name]of roots){
          const verifier=await readFile(`${directory}/migrations/postgresql/production/${name}.verify.sql`,"utf8");
          await assert.rejects(()=>migration.query(verifier));
        }
      } finally {
        await admin.query("REVOKE ai_mls_production_migration_operator FROM r3c1_unauthorized_migration_member");
        await admin.query("DROP ROLE r3c1_unauthorized_migration_member");
      }
      assert.equal((await evaluateR3C1Persistence(pool)).status,"READY");
    });
    await t.test("runtime least privilege and migration exclusion", async () => {
      await assert.rejects(() => runtime.query("SET ROLE ai_mls_production_migration_operator"), { code: "42501" });
      for (const [, , schema, table] of roots) {
        await assert.rejects(() => runtime.query(`CREATE TABLE ${schema}.forbidden(id integer)`), { code: "42501" });
        await assert.rejects(() => runtime.query(`DELETE FROM ${schema}.${table}`), { code: "42501" });
        await assert.rejects(() => runtime.query(`UPDATE ${schema}.${table} SET created_at=now()`), { code: "42501" });
        await runtime.query(`GRANT SELECT ON ${schema}.${table} TO PUBLIC`);
        assert.equal((await admin.query<{count:number}>("SELECT count(*)::integer AS count FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0", [`${schema}.${table}`])).rows[0]?.count, 0);
      }
    });
  } finally {
    await runtime.end(); await migration.end(); await clean(); await admin.end();
  }
});
