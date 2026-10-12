// Explicitly opted-in, new owned loopback cluster only. Never consumes a Production binding.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { validateInputs, sanitizedEnvironment, deriveFixturePlan, assertOwnedTarget, runPgCtlLifecycle, runOwnedCluster, stopOwnedCluster, captureFixture } from './rel002-r3c1-fixture-capture.mjs';
import { R3C1_COMPATIBILITY_QUERY, r3c1CompatibleRowsReady, assertR3C1CatalogCompatibility } from '../dist/apps/api/src/r3c1-catalog-compatibility.js';
import { R3C1_CATALOG_QUERY, R3C1_PERSISTENCE_CONTRACTS } from '../dist/apps/api/src/r3c1-postgresql-readiness.js';

test('R3C1 canonical version and catalog drift in a new owned cluster', {skip:process.env.REL002_R3C1_CAPTURE_DISPOSABLE!=='CONFIRMED',timeout:180000}, async t=>{
 const config=validateInputs({execute:true,host:'127.0.0.1',port:process.env.REL002_R3C1_COMPAT_PORT,major:process.env.REL002_R3C1_COMPAT_MAJOR,bin:process.env.REL002_R3C1_COMPAT_BIN},process.env);
 const plan=deriveFixturePlan(await readFile('apps/api/src/rel002-r3c1-postgresql.integration.test.ts','utf8'));
 const artifacts=new Map();
 for(const path of plan.artifacts){const bytes=await readFile(path);artifacts.set(path,bytes.toString('utf8'));if(plan.artifacts.slice(-3).includes(path))assert.equal(createHash('sha256').update(bytes).digest('hex'),(await readFile(path+'.sha256','utf8')).trim());}
 const env=sanitizedEnvironment(process.env);
 for(const tool of ['initdb','pg_ctl','postgres'])assert.match(execFileSync(join(config.bin,tool+'.exe'),['--version'],{env,stdio:'pipe',windowsHide:true,timeout:10000}).toString(),new RegExp(`PostgreSQL\\) ${config.major}\\.`));
 const evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-r3c1-compat-'));const dataDirectory=join(evidenceDirectory,'cluster');
 let client;
 const lifecycle=(tool,args)=>{assert.equal(tool,'pg_ctl');runPgCtlLifecycle(config.bin,env,args);};
 // The native pg Client is always fully configured; no PG* or DATABASE_URL defaults.
 await runOwnedCluster(async()=>{
  execFileSync(join(config.bin,'initdb.exe'),['-D',dataDirectory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],{env,stdio:'ignore',windowsHide:true,timeout:60000});
  lifecycle('pg_ctl',['start','-D',dataDirectory,'-l',join(evidenceDirectory,'server.log'),'-o',`-h 127.0.0.1 -p ${config.port}`,'-w']);
 },async()=>{
  client=new Client({host:config.host,port:config.port,database:'postgres',user:'postgres',password:'',ssl:false,options:'',application_name:'rel002-r3c1-compat-test',connectionTimeoutMillis:5000});await client.connect();
  const identity=(await client.query("SELECT current_user AS \"currentUser\",current_database() AS database,inet_server_addr()::text AS \"serverAddress\",inet_server_port() AS port,current_setting('server_version_num') AS version_num,current_setting('data_directory') AS \"dataDirectory\"")).rows[0];
  console.log(JSON.stringify({stage:'BEFORE_FIXTURE_MUTATION',...identity,evidenceDirectory}));
  assertOwnedTarget({...config,dataDirectory,currentUser:'postgres',database:'postgres',serverAddress:'127.0.0.1'},{...identity,major:Math.floor(Number(identity.version_num)/10000),created:true});
  assert.equal((await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'app_%') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present")).rows[0].present,false);
 },async()=>{
  for(const role of ['ai_mls_production_runtime','ai_mls_production_migration_operator'])await client.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  await client.query('REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime');
  const baseline=await captureFixture(client,plan,async path=>artifacts.get(path),R3C1_COMPATIBILITY_QUERY);
  await t.test('canonical all three roots and every component PASS',()=>assert.equal(r3c1CompatibleRowsReady(baseline),true));
  await t.test('R3C2 child-root composition boundary PASS',async()=>{
   await client.query('SET ROLE ai_mls_production_runtime');
   try{await assertR3C1CatalogCompatibility(client,['app_administration','app_organization']);}finally{await client.query('RESET ROLE');}
  });
  const read=async()=>{await client.query('SET ROLE ai_mls_production_runtime');try{return (await client.query(R3C1_COMPATIBILITY_QUERY)).rows;}finally{await client.query('RESET ROLE');}};
  await t.test('historical query retains PG18 exact / PG17 distinct hashes',async()=>{
   const rows=(await client.query(R3C1_CATALOG_QUERY)).rows;
   for(const c of R3C1_PERSISTENCE_CONTRACTS)assert.equal(rows.find(r=>r.schema_name===c.schemaName).fingerprint===c.fingerprint,config.major===18);
  });
  for(const c of R3C1_PERSISTENCE_CONTRACTS){
   const table=`${c.schemaName}.${c.tableName}`;
   const constraints=(await client.query('SELECT conname,contype FROM pg_constraint WHERE conrelid=$1::regclass',[table])).rows;
   const pk=constraints.find(k=>k.contype==='p').conname;
   const check=constraints.find(k=>k.contype==='c').conname;
   const mutations=[
    ['NOT NULL removed',`ALTER TABLE ${table} ALTER COLUMN updated_at DROP NOT NULL`],
    ['unexpected NOT NULL column',`ALTER TABLE ${table} ADD COLUMN unexpected text NOT NULL`],
    ['PK changed',`ALTER TABLE ${table} DROP CONSTRAINT ${pk}; ALTER TABLE ${table} ADD PRIMARY KEY (tenant_id)`],
    ['CHECK changed',`ALTER TABLE ${table} DROP CONSTRAINT ${check}; ALTER TABLE ${table} ADD CONSTRAINT ${check} CHECK (tenant_id <> '')`],
    ['unexpected non-n constraint',`ALTER TABLE ${table} ADD CONSTRAINT extra CHECK (tenant_id <> '')`],
    ['FK drift',`CREATE TABLE public.fixture_parent (id text PRIMARY KEY); ALTER TABLE ${table} ADD CONSTRAINT extra_fk FOREIGN KEY (tenant_id) REFERENCES public.fixture_parent(id)`],
    ['owner drift',`ALTER TABLE ${table} OWNER TO postgres`],
    ['schema owner drift',`ALTER SCHEMA ${c.schemaName} OWNER TO postgres`],
    ['schema ACL drift',`GRANT CREATE ON SCHEMA ${c.schemaName} TO ai_mls_production_runtime`],
    ['table ACL and effective privilege drift',`GRANT DELETE ON ${table} TO ai_mls_production_runtime`],
    ['column ACL drift',`GRANT UPDATE (tenant_id) ON ${table} TO ai_mls_production_runtime`],
    ['index drift',`CREATE INDEX extra_idx ON ${table}(tenant_id)`],
    ['trigger drift',`ALTER TABLE ${table} DISABLE TRIGGER ${c.tableName}_guard`],
    ['function drift',`CREATE OR REPLACE FUNCTION ${c.schemaName}.${c.tableName}_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RETURN NEW; END $$`],
    ['comment drift',`COMMENT ON TABLE ${table} IS 'unexpected'`],
    ['RLS drift',`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`],
   ];
   for(const [name,sql] of mutations)await t.test(`${c.schemaName}: ${name} FAIL`,async()=>{
    await client.query('BEGIN');try{await client.query(sql);assert.equal(r3c1CompatibleRowsReady(await read()),false);}finally{await client.query('ROLLBACK');}
    assert.equal(r3c1CompatibleRowsReady(await read()),true);
   });
  }
  for(const [name,sql] of [
   ['organization inventory','CREATE TABLE app_organization.unexpected(id integer)'],
   ['role authority','ALTER ROLE ai_mls_production_runtime CREATEDB'],
   ['membership authority','GRANT ai_mls_production_runtime TO postgres'],
   ['direct TEMPORARY','GRANT TEMPORARY ON DATABASE postgres TO ai_mls_production_runtime'],
   ['registration post-provision gate','CREATE ROLE ai_mls_production_registration_operator LOGIN'],
  ])await t.test(`${name} FAIL`,async()=>{await client.query('BEGIN');try{await client.query(sql);assert.equal(r3c1CompatibleRowsReady(await read()),false);}finally{await client.query('ROLLBACK');}});
  if(process.env.REL002_R3C1_COMPAT_AGGREGATE==='CONFIRMED')await t.test('existing R3C2 aggregate integration on this owned server',async()=>{
   assert.equal(config.port,55441,'CANONICAL_AGGREGATE_TEST_PORT_REQUIRED');
   // The existing test may rebuild only this proven harness-owned cluster.
   let output;
   try{output=execFileSync(process.execPath,['--test','--test-isolation=none','dist/apps/api/src/rel002-r3c2-startup-postgresql.integration.test.js'],{env:{...env,REL002_TEST_POSTGRES_DISPOSABLE:'CONFIRMED',REL002_TEST_POSTGRES_PORT:'55441'},stdio:'pipe',windowsHide:true,timeout:90000});}
   catch(error){await writeFile(join(evidenceDirectory,'aggregate-test.log'),error.stdout??'');console.error(error.stdout?.toString());throw error;}
   await writeFile(join(evidenceDirectory,'aggregate-test.log'),output);
   assert.match(output.toString(),/pass [1-9]/);assert.match(output.toString(),/fail 0/);
  });
 },async()=>{try{if(client)await client.end();}finally{stopOwnedCluster(lifecycle,{created:true,dataDirectory,evidenceDirectory});}});
});
