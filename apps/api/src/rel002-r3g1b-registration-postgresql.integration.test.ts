import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import { assertRegistrationAggregateSchemasReady, assertR3C2AggregateSchemasReady } from "./r3c2-aggregate-readiness.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client, Pool } from "pg";
import { parseRegistrationManifest, RegisterServiceWorkloadCommand, REGISTRATION_DATABASE_TARGET, REGISTRATION_OPERATOR } from "../../../modules/identity/src/register-service-workload.js";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED" && process.env["REL002_TEST_POSTGRES_PORT"] === "55443";
const config = { host:"127.0.0.1",port:55443,database:"postgres" };
const base = "modules/identity/migrations/postgresql/production/";
function fixture(id: string): ReturnType<typeof parseRegistrationManifest> {
  return parseRegistrationManifest({schemaVersion:1,registrationId:id,registrationVersion:1,tenantId:`tenant-${id}`,principalId:`principal-${id}`,environment:"PRODUCTION",purpose:"AI_MLS_PRODUCTION_API_RUNTIME",audience:"ai-mls-api",scopeRef:`registered-service-workload:${id}:1`,identityEvidenceRef:`proof-${id}`,auditEvidenceRef:`audit-${id}`,expectedDatabaseTarget:REGISTRATION_DATABASE_TARGET,expectedExecutionRole:REGISTRATION_OPERATOR,expectedWrites:3,timestampPolicy:"GENERATED_AT_EXECUTION"});
}
function port(native: Pool): PostgreSqlPoolPort {
  return { async connect() { const c = await native.connect(); return { query:async <Row extends Record<string,unknown>>(sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => await c.query(sql,values ? [...values] : undefined) as unknown as PostgreSqlQueryResult<Row>, release:destroy => c.release(destroy) }; },close:() => native.end() };
}
test("R3-G1B registration command and exact ACL on dedicated disposable PostgreSQL", {skip:!enabled,timeout:60000}, async t => {
  const admin = new Client({...config,user:"postgres"}); await admin.connect();
  const migration = new Client({...config,user:"ai_mls_production_migration_operator"});
  const native = new Pool({...config,user:REGISTRATION_OPERATOR,max:2});
  try {
    // Dedicated fresh test database only; never shared with earlier disposable ports.
    await admin.query<Record<string,unknown>>("DROP SCHEMA IF EXISTS app_audit CASCADE; DROP SCHEMA IF EXISTS app_identity CASCADE");
    for (const role of [REGISTRATION_OPERATOR,"ai_mls_production_runtime","ai_mls_production_migration_operator"]) {
      if ((await admin.query<Record<string,unknown>>("SELECT 1 FROM pg_roles WHERE rolname=$1",[role])).rowCount) await admin.query<Record<string,unknown>>(`DROP OWNED BY ${role}; DROP ROLE ${role}`);
    }
    await admin.query<Record<string,unknown>>("CREATE ROLE ai_mls_production_migration_operator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS; CREATE ROLE ai_mls_production_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS; REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");
    await migration.connect();
    for (const file of [base+"001_identity_persistence_v1.up.sql",base+"006_historical_migration_attestation_schema_v1.sql",base+"002_runtime_role_grants.sql",base+"013_identity_workload_evidence_v1.up.sql","modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql"]) await migration.query(await readFile(file,"utf8"));
    await migration.query("REVOKE ALL ON SCHEMA app_identity FROM PUBLIC; CREATE TABLE app_audit.unrelated (id text PRIMARY KEY)");
    await t.test("role creation rejects migration role and grant artifact requires owner", async () => {
      await assert.rejects(migration.query(await readFile(base+"017_registration_operator_role.sql","utf8"))); await migration.query("ROLLBACK");
      await admin.query<Record<string,unknown>>(await readFile(base+"017_registration_operator_role.sql","utf8"));
      await assert.rejects(admin.query<Record<string,unknown>>(await readFile(base+"018_registration_operator_grants.sql","utf8"))); await admin.query<Record<string,unknown>>("ROLLBACK");
      await migration.query(await readFile(base+"018_registration_operator_grants.sql","utf8"));
    });
    const command = new RegisterServiceWorkloadCommand(port(native));
    await t.test("dry-run performs no write; execution creates exactly three canonical rows", async () => {
      const m=fixture("create"); const dry=await command.run(m,"DRY_RUN"); assert.equal(dry.actualWrites,0);
      assert.equal((await admin.query<Record<string,unknown>>("SELECT count(*) FROM app_identity.identity_registered_service_workloads")).rows[0]?.["count"],"0");
      assert.equal((await command.run(m,"EXECUTE")).actualWrites,3);
      const reg=(await admin.query<Record<string,unknown>>("SELECT * FROM app_identity.identity_registered_service_workloads")).rows[0]!;
      const proof=(await admin.query<Record<string,unknown>>("SELECT * FROM app_identity.identity_workload_evidence")).rows[0]!;
      const event=(await admin.query<Record<string,unknown>>("SELECT * FROM app_audit.audit_evidence_read_records")).rows[0]!;
      assert.equal(reg["status"],"ACTIVE"); assert.equal(proof["immutable"],true); assert.equal(event["final"],true);
      assert.equal(event["scope_ref"],m.scopeRef); assert.equal(event["event_type"],"REGISTERED_SERVICE_WORKLOAD.REGISTERED");
      assert.deepEqual(reg["created_at"],reg["updated_at"]); assert.deepEqual(event["occurred_at"],reg["created_at"]);
    });
    await t.test("exact replay preserves timestamps/evidence and conflicts fail closed", async () => {
      const m=fixture("create"); const before=(await admin.query<Record<string,unknown>>("SELECT row_to_json(r) AS row FROM app_identity.identity_registered_service_workloads r")).rows;
      assert.equal((await command.run(m,"EXECUTE")).result,"NO_OP");
      for (const change of [{principalId:"wrong"},{auditEvidenceRef:"different"},{registrationVersion:2,scopeRef:"registered-service-workload:create:2"}]) await assert.rejects(command.run({...m,...change},"EXECUTE"),{code:"CONFLICT"});
      assert.deepEqual((await admin.query<Record<string,unknown>>("SELECT row_to_json(r) AS row FROM app_identity.identity_registered_service_workloads r")).rows,before);
    });
    await t.test("each partial write failure rolls back all three writes", async () => {
      for (const [index,table] of ["identity_registered_service_workloads","identity_workload_evidence","audit_evidence_read_records"].entries()) {
        const schema=index===2?"app_audit":"app_identity"; const m=fixture(`rollback-${index}`);
        await migration.query(`CREATE FUNCTION ${schema}.test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture' USING ERRCODE='23514'; END $$; CREATE TRIGGER test_reject BEFORE INSERT ON ${schema}.${table} FOR EACH ROW EXECUTE FUNCTION ${schema}.test_reject()`);
        try { await assert.rejects(command.run(m,"EXECUTE")); }
        finally { await migration.query(`DROP TRIGGER test_reject ON ${schema}.${table}; DROP FUNCTION ${schema}.test_reject()`); }
        for (const [relation,key,value] of [["app_identity.identity_registered_service_workloads","registration_id",m.registrationId],["app_identity.identity_workload_evidence","identity_evidence_ref",m.identityEvidenceRef],["app_audit.audit_evidence_read_records","audit_evidence_ref",m.auditEvidenceRef]]) assert.equal((await admin.query<Record<string,unknown>>(`SELECT count(*) FROM ${relation} WHERE ${key}=$1`,[value])).rows[0]?.["count"],"0");
      }
    });
    await t.test("concurrent exact creates converge to one transaction and one replay", async () => {
      const m=fixture("concurrent"); const results=await Promise.all([command.run(m,"EXECUTE"),command.run(m,"EXECUTE")]);
      assert.deepEqual(results.map(r=>r.actualWrites).sort(),[0,3]);
    });
    await t.test("conflicting evidence, partial preexisting tuple and overprivileged ACL fail closed", async () => {
      const m=fixture("proof-conflict");
      await migration.query("INSERT INTO app_identity.identity_workload_evidence VALUES ($1,$2,1,$3,'wrong',1,true)",[m.identityEvidenceRef,m.registrationId,m.tenantId]);
      await assert.rejects(command.run(m,"DRY_RUN"),{code:"CONFLICT"}); await assert.rejects(command.run(m,"EXECUTE"),{code:"CONFLICT"});
      const scope=fixture("bad-scope"); await assert.rejects(command.run({...scope,scopeRef:"tenant-scope"},"EXECUTE"),{code:"INPUT_INVALID"});
      await migration.query(`GRANT UPDATE ON app_identity.identity_registered_service_workloads TO ${REGISTRATION_OPERATOR}`);
      try {await assert.rejects(command.run(fixture("acl-failure"),"DRY_RUN"),{code:"UNAVAILABLE"});}
      finally {await migration.query(`REVOKE UPDATE ON app_identity.identity_registered_service_workloads FROM ${REGISTRATION_OPERATOR}`);}
      await migration.query("GRANT INSERT(id) ON app_audit.unrelated TO PUBLIC");
      try {await assert.rejects(command.run(fixture("public-column-failure"),"DRY_RUN"),{code:"UNAVAILABLE"});}
      finally {await migration.query("REVOKE INSERT(id) ON app_audit.unrelated FROM PUBLIC");}
      await migration.query("CREATE FUNCTION app_audit.test_public_definer() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ INSERT INTO app_audit.unrelated VALUES ('definer-write') $$");
      try {await assert.rejects(command.run(fixture("public-definer-failure"),"DRY_RUN"),{code:"UNAVAILABLE"});}
      finally {await migration.query("DROP FUNCTION app_audit.test_public_definer()");}
    });
    await t.test("role and exact privileges reject UPDATE DELETE DDL unrelated writes and runtime creation", async () => {
      const c=await native.connect(); try {
        for (const sql of ["UPDATE app_identity.identity_registered_service_workloads SET status='REVOKED'","DELETE FROM app_identity.identity_workload_evidence","TRUNCATE app_audit.audit_evidence_read_records","CREATE TABLE app_identity.forbidden(id text)","INSERT INTO app_identity.identity_sessions VALUES ('forbidden',1,'ACTIVE','{}',now(),now())","INSERT INTO app_audit.unrelated VALUES ('forbidden')"]) await assert.rejects(c.query(sql),{code:"42501"});
      } finally {c.release();}
      for (const role of ["ai_mls_production_runtime","ai_mls_production_migration_operator"]) {
        const p=new Pool({...config,user:role,max:1}); try {await assert.rejects(new RegisterServiceWorkloadCommand(port(p)).run(fixture(`wrong-${role}`),"DRY_RUN"),{code:"UNAVAILABLE"});} finally {await p.end();}
      }
      assert.equal((await admin.query<Record<string,unknown>>("SELECT has_table_privilege('ai_mls_production_runtime','app_identity.identity_registered_service_workloads','INSERT') AS allowed")).rows[0]?.["allowed"],false);
    });
    await t.test("ambiguous commit destroys client and quarantines command; fresh exact replay is safe", async () => {
      const original=port(native); let connects=0; let destroyed=false;
      const broken: PostgreSqlPoolPort = {async connect(){connects++;const c=await original.connect();return {query:async <Row extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<Row>>=>{const r=await c.query<Row>(sql,values);if(sql==="COMMIT")throw new Error("fixture lost acknowledgement");return r;},release:discard=>{destroyed=discard===true;c.release(discard);}};},close:()=>Promise.resolve()};
      const uncertain=new RegisterServiceWorkloadCommand(broken); const m=fixture("ambiguous");
      await assert.rejects(uncertain.run(m,"EXECUTE"),{code:"UNAVAILABLE"}); assert.equal(destroyed,true);
      await assert.rejects(uncertain.run(m,"EXECUTE"),{code:"UNAVAILABLE"}); assert.equal(connects,1);
      assert.equal((await command.run(m,"EXECUTE")).result,"NO_OP");
    });
    await t.test("aggregate runtime readiness preserves historical contracts with exact operator ACL and rejects drift", async () => {
      await migration.query("DROP TABLE app_audit.unrelated");
      for (const dir of ["modules/publication","modules/administration","modules/source/connector","modules/source/external-integration","modules/ai/advisory"]) {
        const schema={"modules/publication":"publication","modules/administration":"administration","modules/source/connector":"connector","modules/source/external-integration":"external_integration","modules/ai/advisory":"advisory"}[dir];
        await admin.query<Record<string,unknown>>(`DROP SCHEMA IF EXISTS app_${schema} CASCADE`);
        for (const file of ["001_schema_v1.up.sql","002_runtime_role_grants.sql","001_schema_v1.verify.sql"]) await migration.query(await readFile(`${dir}/migrations/postgresql/production/${file}`,"utf8"));
      }
      await admin.query<Record<string,unknown>>("DROP SCHEMA IF EXISTS app_organization CASCADE");
      for (const file of [
        base+"012_workload_startup_binding_v1.up.sql",
        "modules/organization/migrations/postgresql/production/001_organization_governance_v1.up.sql",
        "modules/administration/migrations/postgresql/production/003_project_governance_v1.up.sql",
        base+"014_workload_startup_authorization_team_v1.up.sql",
        "modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql",
        base+"015_identity_human_credentials_v1.up.sql",
        base+"016_production_session_binding_v1.up.sql"
      ]) await migration.query(await readFile(file,"utf8"));
      await migration.query("INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','disposable-operator','disposable-backup','2026-10-03T00:00:00Z','APPLIED')");
      const runtime=new Pool({...config,user:"ai_mls_production_runtime",max:1,options:R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(" ")});
      try {
        await assertRegistrationAggregateSchemasReady(port(runtime));
        for (const sql of [`ALTER ROLE ${REGISTRATION_OPERATOR} NOLOGIN`,`ALTER ROLE ${REGISTRATION_OPERATOR} CREATEDB`,`ALTER ROLE ${REGISTRATION_OPERATOR} CREATEROLE`,`ALTER ROLE ${REGISTRATION_OPERATOR} SUPERUSER`,`ALTER ROLE ${REGISTRATION_OPERATOR} REPLICATION`,`ALTER ROLE ${REGISTRATION_OPERATOR} BYPASSRLS`,`GRANT ai_mls_production_runtime TO ${REGISTRATION_OPERATOR}`]) {
          await admin.query<Record<string,unknown>>(sql);
          try {await assert.rejects(assertRegistrationAggregateSchemasReady(port(runtime)));}
          finally {await admin.query<Record<string,unknown>>(`ALTER ROLE ${REGISTRATION_OPERATOR} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; REVOKE ai_mls_production_runtime FROM ${REGISTRATION_OPERATOR}`);}
        }
        await migration.query(`GRANT UPDATE ON app_identity.identity_workload_evidence TO ${REGISTRATION_OPERATOR}`);
        try {await assert.rejects(assertRegistrationAggregateSchemasReady(port(runtime)));}
        finally {await migration.query(`REVOKE UPDATE ON app_identity.identity_workload_evidence FROM ${REGISTRATION_OPERATOR}`);}
        await migration.query("GRANT INSERT ON app_identity.identity_registered_service_workloads TO ai_mls_production_runtime");
        try {await assert.rejects(assertRegistrationAggregateSchemasReady(port(runtime)));}
        finally {await migration.query("REVOKE INSERT ON app_identity.identity_registered_service_workloads FROM ai_mls_production_runtime");}
        await assertRegistrationAggregateSchemasReady(port(runtime));
        await admin.query<Record<string,unknown>>(`DROP OWNED BY ${REGISTRATION_OPERATOR}; DROP ROLE ${REGISTRATION_OPERATOR}`);
        await assertR3C2AggregateSchemasReady(port(runtime));
        await assert.rejects(assertRegistrationAggregateSchemasReady(port(runtime)));
      } finally {await runtime.end();}
    });
  } finally { await native.end(); await migration.end(); await admin.end(); }
});
