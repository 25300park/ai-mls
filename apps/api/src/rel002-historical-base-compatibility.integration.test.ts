import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence } from "../../../modules/identity/src/registered-service-workload-postgresql-schema.js";
import { assertR3C2IdentityBaseReady, R3C2_HISTORICAL_COMPATIBILITY_QUERY } from "./r3c2-aggregate-readiness.js";

const enabled = process.env["REL002_HISTORICAL_COMPAT_DISPOSABLE"] === "CONFIRMED";
const port = Number(process.env["REL002_HISTORICAL_COMPAT_PORT"]);
const base = "modules/identity/migrations/postgresql/production/";
const artifact = (file: string) => readFile(base + file, "utf8");

test("projected historical base uses one snapshot and rejects unapproved drift", { skip: !enabled }, async t => {
 assert.ok([55446,55447].includes(port));
 const admin = new Client({host:"127.0.0.1",port,user:"postgres",database:"postgres"});
 await admin.connect();
 let runtime: Client | undefined;
 let fixtureCreated=false;
 let leases=0, releases=0;
 const queries: string[]=[];
 try {
  assert.equal((await admin.query<{existing:string|null}>("SELECT to_regnamespace('app_identity') AS existing")).rows[0]?.existing,null);
  await admin.query("CREATE ROLE ai_mls_production_migration_operator LOGIN NOINHERIT; CREATE ROLE ai_mls_production_runtime LOGIN NOINHERIT; REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
  fixtureCreated=true;
  await admin.query("SET ROLE ai_mls_production_migration_operator");
  await admin.query(await artifact("001_identity_persistence_v1.up.sql"));
  await admin.query(await artifact("006_historical_migration_attestation_schema_v1.sql"));
  await admin.query("SELECT set_config('ai_mls.operator_evidence_ref','evidence:fixture-operator',false),set_config('ai_mls.backup_evidence_ref','evidence:fixture-backup',false),set_config('ai_mls.schema_verification_evidence_ref','evidence:fixture-schema',false)");
  await admin.query(await artifact("007_record_historical_identity_migration_attestation_v1.sql"));
  await admin.query("GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime; GRANT SELECT,INSERT,UPDATE ON app_identity.identity_sessions TO ai_mls_production_runtime; GRANT INSERT ON app_identity.identity_session_revocations TO ai_mls_production_runtime; GRANT SELECT ON app_identity.identity_registered_service_workloads,app_identity.identity_schema_contracts,app_identity.identity_schema_migrations TO ai_mls_production_runtime");
  runtime=new Client({host:"127.0.0.1",port,user:"ai_mls_production_runtime",database:"postgres"});await runtime.connect();
  const pool:PostgreSqlPoolPort={connect:async()=>{await Promise.resolve();leases++;return {
   query:async<R extends Record<string,unknown>>(sql:string,args?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{queries.push(sql);const result=await runtime!.query<R>(sql,args?[...args]:undefined);return {rows:result.rows,rowCount:result.rowCount??0};},release:()=>{releases++;}
  };},close:()=>Promise.reject(Error("shared pool close forbidden"))};
  const ready=async()=>{const before=leases;assert.equal(await assertR3C2IdentityBaseReady(pool),"HISTORICAL_MIGRATION_ATTESTATION_VERIFIED");assert.equal(leases,before+1);assert.equal(leases,releases);};
  await t.test("pristine historical schema PASS",ready);
  await t.test("native provenance remains distinct with empty historical attestation ledger",async()=>{
   await admin.query("ALTER TABLE app_identity.identity_historical_migration_attestations DISABLE TRIGGER USER; DELETE FROM app_identity.identity_historical_migration_attestations; ALTER TABLE app_identity.identity_historical_migration_attestations ENABLE TRIGGER USER");
   await admin.query(`INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','evidence:fixture','evidence:fixture',now(),'APPLIED')`);
   assert.equal(await assertR3C2IdentityBaseReady(pool),"NATIVE_MIGRATION_LEDGER_VERIFIED");
   await admin.query("DELETE FROM app_identity.identity_schema_migrations");
   await admin.query(await artifact("007_record_historical_identity_migration_attestation_v1.sql"));await ready();
  });
  const negative=async(name:string,change:string,undo:string)=>{await t.test(name,async()=>{
   await admin.query(change);queries.length=0;
   try {await assert.rejects(assertR3C2IdentityBaseReady(pool));assert.ok(["COMMIT","ROLLBACK"].includes(queries.at(-1)!));assert.equal(leases,releases);}
   finally {await admin.query(undo);}
  });};
  await negative("unknown extra table FAIL","CREATE TABLE app_identity.unapproved(id integer)","DROP TABLE app_identity.unapproved");
  await negative("unknown view FAIL","CREATE VIEW app_identity.unapproved_view AS SELECT 1 AS id","DROP VIEW app_identity.unapproved_view");
  await negative("unknown sequence FAIL","CREATE SEQUENCE app_identity.unapproved_sequence","DROP SEQUENCE app_identity.unapproved_sequence");
  await negative("unknown function FAIL","CREATE FUNCTION app_identity.unapproved_function() RETURNS integer LANGUAGE sql AS 'SELECT 1'","DROP FUNCTION app_identity.unapproved_function()");
  await negative("unknown extra column FAIL","ALTER TABLE app_identity.identity_sessions ADD COLUMN unapproved text","ALTER TABLE app_identity.identity_sessions DROP COLUMN unapproved");
  await negative("unknown constraint FAIL","ALTER TABLE app_identity.identity_sessions ADD CONSTRAINT unapproved CHECK (session_version>0)","ALTER TABLE app_identity.identity_sessions DROP CONSTRAINT unapproved");
  await negative("unknown index FAIL","CREATE INDEX unapproved ON app_identity.identity_sessions(created_at)","DROP INDEX app_identity.unapproved");
  await negative("unknown trigger FAIL","CREATE TRIGGER unapproved BEFORE DELETE ON app_identity.identity_sessions FOR EACH ROW EXECUTE FUNCTION app_identity.reject_session_revocation_mutation()","DROP TRIGGER unapproved ON app_identity.identity_sessions");
  await negative("base NOT NULL drift FAIL","ALTER TABLE app_identity.identity_sessions ALTER COLUMN state DROP NOT NULL","ALTER TABLE app_identity.identity_sessions ALTER COLUMN state SET NOT NULL");
  await negative("base default drift FAIL","ALTER TABLE app_identity.identity_sessions ALTER COLUMN state SET DEFAULT 'ACTIVE'","ALTER TABLE app_identity.identity_sessions ALTER COLUMN state DROP DEFAULT");
  await negative("base constraint drift FAIL","ALTER TABLE app_identity.identity_sessions DROP CONSTRAINT identity_sessions_state_check","ALTER TABLE app_identity.identity_sessions ADD CONSTRAINT identity_sessions_state_check CHECK (state IN ('ACTIVE','REVOKED','EXPIRED'))");
  await negative("base index drift FAIL","ALTER INDEX app_identity.identity_sessions_family_idx RENAME TO changed_family_idx","ALTER INDEX app_identity.changed_family_idx RENAME TO identity_sessions_family_idx");
  await negative("base trigger drift FAIL","ALTER TABLE app_identity.identity_session_revocations DISABLE TRIGGER identity_session_revocations_no_delete","ALTER TABLE app_identity.identity_session_revocations ENABLE TRIGGER identity_session_revocations_no_delete");
  await negative("historical verifier metadata drift FAIL","ALTER FUNCTION app_identity.identity_historical_attestation_schema_is_exact() VOLATILE","ALTER FUNCTION app_identity.identity_historical_attestation_schema_is_exact() STABLE");
  await negative("duplicate historical verifier FAIL","CREATE FUNCTION app_identity.identity_historical_attestation_schema_is_exact(integer) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT true'","DROP FUNCTION app_identity.identity_historical_attestation_schema_is_exact(integer)");
  await negative("historical verifier SECURITY DEFINER FAIL","ALTER FUNCTION app_identity.identity_historical_attestation_schema_is_exact() SECURITY DEFINER","ALTER FUNCTION app_identity.identity_historical_attestation_schema_is_exact() SECURITY INVOKER");
  const historical=await artifact("006_historical_migration_attestation_schema_v1.sql");
  const originalFunction=historical.slice(historical.indexOf("CREATE FUNCTION app_identity.identity_historical_attestation_schema_is_exact()"),historical.indexOf("REVOKE ALL ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact()"));
  await negative("historical verifier source hash drift FAIL","CREATE OR REPLACE FUNCTION app_identity.identity_historical_attestation_schema_is_exact() RETURNS boolean LANGUAGE sql STABLE AS 'SELECT true'",originalFunction.replace("CREATE FUNCTION","CREATE OR REPLACE FUNCTION"));
  await negative("native ledger + historical attestation conflict FAIL",`INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','evidence:fixture','evidence:fixture',now(),'APPLIED')`,"DELETE FROM app_identity.identity_schema_migrations");
  await t.test("workload evidence extension passes; default inspector remains incompatible",async()=>{
   await admin.query(await artifact("013_identity_workload_evidence_v1.up.sql"));
   assert.equal((await admin.query<{exact:boolean}>("SELECT app_identity.identity_historical_attestation_schema_is_exact() AS exact")).rows[0]?.exact,false);
   await ready();
   assert.notEqual((await inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(pool)).readiness,"READY");
  });
  await negative("approved workload evidence drift FAIL","ALTER TABLE app_identity.identity_workload_evidence ADD COLUMN unapproved text","ALTER TABLE app_identity.identity_workload_evidence DROP COLUMN unapproved");
  await t.test("approved human extensions alone PASS",async()=>{
   await admin.query("DROP TABLE app_identity.identity_workload_evidence; DROP FUNCTION app_identity.identity_workload_evidence_guard()");
   await admin.query(await artifact("015_identity_human_credentials_v1.up.sql"));await ready();
  });
  await t.test("approved session binding alone PASS",async()=>{
   await admin.query("DROP TABLE app_identity.identity_human_credentials,app_identity.identity_human_principals; DROP FUNCTION app_identity.identity_human_credentials_guard(),app_identity.identity_human_principals_guard()");
   await admin.query(await artifact("016_production_session_binding_v1.up.sql"));await ready();
  });
  await t.test("approved extension combination PASS",async()=>{
   await admin.query(await artifact("013_identity_workload_evidence_v1.up.sql"));
   await admin.query(await artifact("015_identity_human_credentials_v1.up.sql"));await ready();
  });
  await t.test("approved workload startup/team binding extensions PASS",async()=>{await admin.query(await artifact("012_workload_startup_binding_v1.up.sql"));await admin.query(await artifact("014_workload_startup_authorization_team_v1.up.sql"));await ready();});
  await negative("approved human extension NOT NULL drift FAIL","ALTER TABLE app_identity.identity_human_principals ALTER COLUMN login_identifier DROP NOT NULL","ALTER TABLE app_identity.identity_human_principals ALTER COLUMN login_identifier SET NOT NULL");
  await negative("approved session binding drift FAIL","ALTER TABLE app_identity.identity_sessions DISABLE TRIGGER identity_sessions_production_binding_guard","ALTER TABLE app_identity.identity_sessions ENABLE TRIGGER identity_sessions_production_binding_guard");
  await t.test("projected hash query remains SELECT-only in same read-only snapshot",async()=>{
   queries.length=0;await ready();assert.equal(queries[0],"BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");assert.equal(queries.at(-1),"COMMIT");
   assert.ok(queries.some(q=>q.includes(R3C2_HISTORICAL_COMPATIBILITY_QUERY)));
  });
 } finally {
  await runtime?.end();await admin.query("RESET ROLE");
  if(fixtureCreated)await admin.query("DROP SCHEMA IF EXISTS app_identity CASCADE; REVOKE ALL ON DATABASE postgres FROM ai_mls_production_runtime,ai_mls_production_migration_operator; DROP ROLE ai_mls_production_runtime,ai_mls_production_migration_operator");
  await admin.end();
 }
});
