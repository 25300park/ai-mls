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
import { ADVISORY_COMPATIBILITY_QUERY, advisoryCompatibleRow, withAdvisoryCatalogCompatibility } from '../dist/apps/api/src/advisory-catalog-compatibility.js';
import { READINESS_QUERY, evaluateContracts, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from '../dist/apps/api/src/child-root-postgresql-readiness.js';
import { ARTIFACTS, captureAdvisory } from './rel002-advisory-fixture-capture.mjs';
test('Advisory canonical and drift in a new owned loopback cluster',{skip:process.env.REL002_R3C1_CAPTURE_DISPOSABLE!=='CONFIRMED',timeout:180000},async t=>{
 const config=validateInputs({execute:true,host:'127.0.0.1',port:process.env.REL002_ADVISORY_COMPAT_PORT,major:process.env.REL002_ADVISORY_COMPAT_MAJOR,bin:process.env.REL002_ADVISORY_COMPAT_BIN},process.env);
 const artifacts=new Map();for(const path of ARTIFACTS)artifacts.set(path,await readFile(path,'utf8'));
 assert.equal(createHash('sha256').update(artifacts.get(ARTIFACTS[0])).digest('hex'),'ae70f9c9b3b18b08eff3e2b0b8bbdb24c14b9ca6a6a980cfc1f320b9223bc6ac');
 const env=sanitizedEnvironment(process.env);
 for(const tool of ['initdb','pg_ctl','postgres'])assert.match(execFileSync(join(config.bin,tool+'.exe'),['--version'],{env,stdio:'pipe',windowsHide:true,timeout:10000}).toString(),new RegExp(`PostgreSQL\\) ${config.major}\\.`));
 const evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-advisory-compat-'));const dataDirectory=join(evidenceDirectory,'cluster');
 let client;
 const lifecycle=(tool,args)=>{assert.equal(tool,'pg_ctl');runPgCtlLifecycle(config.bin,env,args);};
 // The native pg Client is always fully configured; no PG* or DATABASE_URL defaults.
 await runOwnedCluster(async()=>{
  execFileSync(join(config.bin,'initdb.exe'),['-D',dataDirectory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],{env,stdio:'ignore',windowsHide:true,timeout:60000});
  lifecycle('pg_ctl',['start','-D',dataDirectory,'-l',join(evidenceDirectory,'server.log'),'-o',`-h 127.0.0.1 -p ${config.port}`,'-w']);
 },async()=>{
  client=new Client({host:config.host,port:config.port,database:'postgres',user:'postgres',password:'',ssl:false,options:'',application_name:'rel002-advisory-compat-test',connectionTimeoutMillis:5000});await client.connect();
  const identity=(await client.query("SELECT current_user AS \"currentUser\",current_database() AS database,inet_server_addr()::text AS \"serverAddress\",inet_server_port() AS port,current_setting('server_version_num') AS version_num,current_setting('data_directory') AS \"dataDirectory\"")).rows[0];
  console.log(JSON.stringify({stage:'BEFORE_FIXTURE_MUTATION',...identity,evidenceDirectory}));
  assertOwnedTarget({...config,dataDirectory,currentUser:'postgres',database:'postgres',serverAddress:'127.0.0.1'},{...identity,major:Math.floor(Number(identity.version_num)/10000),created:true});
  assert.equal((await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'app_%') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present")).rows[0].present,false);
 },async()=>{
  for(const role of ['ai_mls_production_runtime','ai_mls_production_migration_operator'])await client.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  await client.query('REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime');
  await captureAdvisory(client,async path=>artifacts.get(path),'SELECT 1');
  await client.query("SELECT set_config('ai_mls.r3b1_advisory_artifact_sha256','ae70f9c9b3b18b08eff3e2b0b8bbdb24c14b9ca6a6a980cfc1f320b9223bc6ac',false)");
  const read=async()=>{await client.query('SET ROLE ai_mls_production_runtime');try{return (await client.query(ADVISORY_COMPATIBILITY_QUERY)).rows.find(r=>r.schema_name==='app_advisory');}finally{await client.query('RESET ROLE');}};
  const ready=async()=>{try{advisoryCompatibleRow(await read());return true;}catch{return false;}};
  console.log(JSON.stringify({baseline:await read()}));
  await t.test('canonical all components PASS',async()=>assert.equal(await ready(),true));
  const pool={connect:async()=>({query:async(sql,values)=>{await client.query('SET ROLE ai_mls_production_runtime');try{const r=await client.query(sql,values);return {rows:r.rows,rowCount:r.rowCount};}finally{await client.query('RESET ROLE');}},release:()=>{}}),close:async()=>{}};
  await t.test('forward child-root composition PASS / historical stays exact',async()=>{
   assert.equal((await evaluateContracts(withAdvisoryCatalogCompatibility(pool),[R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[4]])).status,'READY');
   assert.equal((await evaluateContracts(pool,[R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[4]])).status,config.major===18?'READY':'NOT_READY');
  });
  const mutations=[
   ['NOT NULL removed','ALTER TABLE app_advisory.advisory_prompts ALTER COLUMN created_at DROP NOT NULL'],
   ['unexpected NOT NULL added','ALTER TABLE app_advisory.advisory_prompts ADD COLUMN extra text NOT NULL'],
   ['nullable flag changed','ALTER TABLE app_advisory.advisory_records ALTER COLUMN scope_ref DROP NOT NULL'],
   ['PK changed','ALTER TABLE app_advisory.advisory_prompts DROP CONSTRAINT advisory_prompts_pkey; ALTER TABLE app_advisory.advisory_prompts ADD PRIMARY KEY(prompt_id)'],
   ['FK removed','ALTER TABLE app_advisory.advisory_idempotency DROP CONSTRAINT advisory_idempotency_advisory_id_fkey'],
   ['CHECK removed','ALTER TABLE app_advisory.advisory_prompts DROP CONSTRAINT advisory_prompts_status_check'],
   ['unexpected non-n','ALTER TABLE app_advisory.advisory_prompts ADD CONSTRAINT extra CHECK(length(prompt_id)<100)'],
   ['index changed','CREATE INDEX extra ON app_advisory.advisory_prompts(created_at)'],
   ['trigger changed','ALTER TABLE app_advisory.advisory_records DISABLE TRIGGER advisory_records_append_only'],
   ['function changed',"CREATE OR REPLACE FUNCTION app_advisory.reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$"],
   ['schema owner','ALTER SCHEMA app_advisory OWNER TO postgres'],
   ['schema comment',"COMMENT ON SCHEMA app_advisory IS 'drift'"],
   ['inventory','CREATE TABLE app_advisory.extra(id int)'],
   ['runtime ACL','GRANT DELETE ON app_advisory.advisory_prompts TO ai_mls_production_runtime'],
   ['effective ACL','GRANT UPDATE ON app_advisory.advisory_records TO ai_mls_production_runtime'],
   ['PUBLIC leakage','GRANT SELECT ON app_advisory.advisory_records TO PUBLIC'],
   ['runtime CREATE','GRANT CREATE ON SCHEMA app_advisory TO ai_mls_production_runtime'],
   ['runtime USAGE','REVOKE USAGE ON SCHEMA app_advisory FROM ai_mls_production_runtime'],
   ['grant option','GRANT SELECT ON app_advisory.advisory_records TO ai_mls_production_runtime WITH GRANT OPTION'],
   ['membership','GRANT ai_mls_production_migration_operator TO ai_mls_production_runtime'],
   ['missing schema','DROP SCHEMA app_advisory CASCADE'],
  ];
  for(const [name,sql] of mutations)await t.test(name+' FAIL',async()=>{await client.query('BEGIN');try{await client.query(sql);assert.equal(await ready(),false);}finally{await client.query('ROLLBACK');}assert.equal(await ready(),true);});
  await t.test('artifact absence FAIL',async()=>{await client.query("SELECT set_config('ai_mls.r3b1_advisory_artifact_sha256','',false)");assert.equal(await ready(),false);});
  await writeFile(join(evidenceDirectory,'result.json'),JSON.stringify({major:config.major,sequence:ARTIFACTS,tests:mutations.length+4,production:false}));
 },async()=>{try{if(client)await client.end();}finally{stopOwnedCluster(lifecycle,{created:true,dataDirectory,evidenceDirectory});}});
});
