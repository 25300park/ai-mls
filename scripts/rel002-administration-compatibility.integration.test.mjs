// Explicitly opted-in, new owned loopback cluster only. Never consumes a Production binding.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg'; const {Client}=pg;
import { validateInputs, sanitizedEnvironment, deriveFixturePlan, assertOwnedTarget, runPgCtlLifecycle, runOwnedCluster, stopOwnedCluster, captureFixture } from './rel002-r3c1-fixture-capture.mjs';
import { ADMINISTRATION_COMPATIBILITY_QUERY, administrationCompatibleRow, withAdministrationCatalogCompatibility } from '../dist/apps/api/src/administration-catalog-compatibility.js';
import { READINESS_QUERY, evaluateContracts, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from '../dist/apps/api/src/child-root-postgresql-readiness.js';
import { R3C2_ADMINISTRATION_SCHEMA_OVERLAY } from '../dist/apps/api/src/r3c2-aggregate-readiness.js';
import { ARTIFACTS, captureAdministration } from './rel002-administration-fixture-capture.mjs';
test('Administration canonical and drift in a new owned loopback cluster',{skip:process.env.REL002_R3C1_CAPTURE_DISPOSABLE!=='CONFIRMED',timeout:180000},async t=>{
 const config=validateInputs({execute:true,host:'127.0.0.1',port:process.env.REL002_ADMINISTRATION_COMPAT_PORT,major:process.env.REL002_ADMINISTRATION_COMPAT_MAJOR,bin:process.env.REL002_ADMINISTRATION_COMPAT_BIN},process.env);
 const artifacts=new Map();for(const path of ARTIFACTS)artifacts.set(path,await readFile(path,'utf8'));
 assert.equal(createHash('sha256').update(artifacts.get(ARTIFACTS[0])).digest('hex'),'f3da51aa3f55a0e7e1ba483f6d903950d8742b94a0d0bce9aea5f82bb8bfce3b');
 const env=sanitizedEnvironment(process.env);
 for(const tool of ['initdb','pg_ctl','postgres'])assert.match(execFileSync(join(config.bin,tool+'.exe'),['--version'],{env,stdio:'pipe',windowsHide:true,timeout:10000}).toString(),new RegExp(`PostgreSQL\\) ${config.major}\\.`));
 const evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-administration-compat-'));const dataDirectory=join(evidenceDirectory,'cluster');
 let client;
 const lifecycle=(tool,args)=>{assert.equal(tool,'pg_ctl');runPgCtlLifecycle(config.bin,env,args);};
 // The native pg Client is always fully configured; no PG* or DATABASE_URL defaults.
 await runOwnedCluster(async()=>{
  execFileSync(join(config.bin,'initdb.exe'),['-D',dataDirectory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],{env,stdio:'ignore',windowsHide:true,timeout:60000});
  lifecycle('pg_ctl',['start','-D',dataDirectory,'-l',join(evidenceDirectory,'server.log'),'-o',`-h 127.0.0.1 -p ${config.port}`,'-w']);
 },async()=>{
  client=new Client({host:config.host,port:config.port,database:'postgres',user:'postgres',password:'',ssl:false,options:'',application_name:'rel002-administration-compat-test',connectionTimeoutMillis:5000});await client.connect();
  const identity=(await client.query("SELECT current_user AS \"currentUser\",current_database() AS database,inet_server_addr()::text AS \"serverAddress\",inet_server_port() AS port,current_setting('server_version_num') AS version_num,current_setting('data_directory') AS \"dataDirectory\"")).rows[0];
  console.log(JSON.stringify({stage:'BEFORE_FIXTURE_MUTATION',...identity,evidenceDirectory}));
  assertOwnedTarget({...config,dataDirectory,currentUser:'postgres',database:'postgres',serverAddress:'127.0.0.1'},{...identity,major:Math.floor(Number(identity.version_num)/10000),created:true});
  assert.equal((await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'app_%') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present")).rows[0].present,false);
 },async()=>{
  for(const role of ['ai_mls_production_runtime','ai_mls_production_migration_operator'])await client.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  await client.query('REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime');
  await captureAdministration(client,async path=>artifacts.get(path),'SELECT 1');
  await client.query("SELECT set_config('ai_mls.r3b1_administration_artifact_sha256','f3da51aa3f55a0e7e1ba483f6d903950d8742b94a0d0bce9aea5f82bb8bfce3b',false)");
  const read=async()=>{await client.query('SET ROLE ai_mls_production_runtime');try{return (await client.query(ADMINISTRATION_COMPATIBILITY_QUERY)).rows.find(r=>r.schema_name==='app_administration');}finally{await client.query('RESET ROLE');}};
  const ready=async()=>{try{administrationCompatibleRow(await read());return true;}catch{return false;}};
  console.log(JSON.stringify({baseline:await read()}));
  await t.test('canonical all components PASS',async()=>assert.equal(await ready(),true));
  const pool={connect:async()=>({query:async(sql,values)=>{await client.query('SET ROLE ai_mls_production_runtime');try{const r=await client.query(sql,values);return {rows:r.rows,rowCount:r.rowCount};}finally{await client.query('RESET ROLE');}},release:()=>{}}),close:async()=>{}};
  await t.test('forward child-root composition PASS / historical stays exact',async()=>{
   assert.equal((await evaluateContracts(withAdministrationCatalogCompatibility(pool),[({...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[1],...R3C2_ADMINISTRATION_SCHEMA_OVERLAY})])).status,'READY');
   assert.equal((await evaluateContracts(pool,[({...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[1],...R3C2_ADMINISTRATION_SCHEMA_OVERLAY})])).status,config.major===18?'READY':'NOT_READY');
  });
  const mutations=[
   ['NOT NULL removed','ALTER TABLE app_administration.administration_revisions ALTER COLUMN revision DROP NOT NULL'],
   ['unexpected NOT NULL','ALTER TABLE app_administration.administration_revisions ADD COLUMN extra text NOT NULL'],
   ['nullable column changed','ALTER TABLE app_administration.project_governance_versions ALTER COLUMN updated_at DROP NOT NULL'],
   ['PK changed','ALTER TABLE app_administration.administration_schema DROP CONSTRAINT administration_schema_pkey; ALTER TABLE app_administration.administration_schema ADD PRIMARY KEY(schema_version)'],
   ['FK removed','ALTER TABLE app_administration.administration_resources DROP CONSTRAINT administration_resources_tenant_id_resource_type_resource__fkey'],
   ['CHECK removed','ALTER TABLE app_administration.administration_revisions DROP CONSTRAINT administration_revisions_revision_check'],
   ['UNIQUE removed','ALTER TABLE app_administration.administration_proposals DROP CONSTRAINT administration_proposals_tenant_id_proposal_id_resource_typ_key CASCADE'],
   ['unexpected non-n','ALTER TABLE app_administration.administration_revisions ADD CONSTRAINT extra CHECK(revision<100)'],
   ['index changed','CREATE INDEX extra ON app_administration.administration_revisions(revision)'],
   ['trigger changed','ALTER TABLE app_administration.administration_decisions DISABLE TRIGGER administration_decisions_append_only'],
   ['function changed',"CREATE OR REPLACE FUNCTION app_administration.reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$"],
   ['schema owner','ALTER SCHEMA app_administration OWNER TO postgres'],
   ['schema comment',"COMMENT ON SCHEMA app_administration IS 'drift'"],
   ['inventory','CREATE TABLE app_administration.extra(id int)'],
   ['runtime ACL','GRANT DELETE ON app_administration.administration_revisions TO ai_mls_production_runtime'],
   ['effective ACL','GRANT UPDATE ON app_administration.administration_decisions TO ai_mls_production_runtime'],
   ['PUBLIC leakage','GRANT SELECT ON app_administration.administration_decisions TO PUBLIC'],
   ['runtime CREATE','GRANT CREATE ON SCHEMA app_administration TO ai_mls_production_runtime'],
['runtime USAGE','REVOKE USAGE ON SCHEMA app_administration FROM ai_mls_production_runtime'],
['grant option','GRANT SELECT ON app_administration.administration_decisions TO ai_mls_production_runtime WITH GRANT OPTION'],
['membership','GRANT ai_mls_production_migration_operator TO ai_mls_production_runtime'],
   ['missing schema','DROP SCHEMA app_administration CASCADE'],
  ];
  for(const [name,sql] of mutations)await t.test(name+' FAIL',async()=>{await client.query('BEGIN');try{await client.query(sql);assert.equal(await ready(),false);}finally{await client.query('ROLLBACK');}assert.equal(await ready(),true);});
  await t.test('artifact absence FAIL',async()=>{await client.query("SELECT set_config('ai_mls.r3b1_administration_artifact_sha256','',false)");assert.equal(await ready(),false);});
  await writeFile(join(evidenceDirectory,'result.json'),JSON.stringify({major:config.major,sequence:ARTIFACTS,tests:mutations.length+4,production:false}));
 },async()=>{try{if(client)await client.end();}finally{stopOwnedCluster(lifecycle,{created:true,dataDirectory,evidenceDirectory});}});
});
