// Owned disposable PG17/18 only. No Production defaults or registration execution.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile,mkdtemp,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateInputs,sanitizedEnvironment,assertOwnedTarget,runPgCtlLifecycle,runOwnedCluster,stopOwnedCluster } from './rel002-r3c1-fixture-capture.mjs';
import { R3C2B_IDENTITY_COMPATIBILITY_QUERY,r3c2bIdentityCompatibleRowsReady } from '../dist/apps/api/src/r3c2b-identity-catalog-compatibility.js';
import { R3C2B_EVIDENCE_CATALOG_QUERY } from '../dist/apps/api/src/r3c2b-postgresql-readiness.js';
import { assertR3C2AggregateSchemasReady } from '../dist/apps/api/src/r3c2-aggregate-readiness.js';
import { R3C2C_TEAM_CATALOG_QUERY,R3C2C_TEAM_CONTRACTS } from '../dist/apps/api/src/r3c2c-postgresql-readiness.js';
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from '../dist/apps/api/src/child-root-postgresql-readiness.js';
const full=process.env.REL002_R3C2B_FULL_AGGREGATE==='CONFIRMED';
const sequence=full?[
 ...['modules/publication','modules/administration','modules/source/connector','modules/source/external-integration','modules/ai/advisory'].flatMap(dir=>['001_schema_v1.up.sql','002_runtime_role_grants.sql'].map(name=>`${dir}/migrations/postgresql/production/${name}`)),
 ...['001_identity_persistence_v1.up.sql','006_historical_migration_attestation_schema_v1.sql','002_runtime_role_grants.sql','012_workload_startup_binding_v1.up.sql','013_identity_workload_evidence_v1.up.sql'].map(name=>`modules/identity/migrations/postgresql/production/${name}`),
 'modules/organization/migrations/postgresql/production/001_organization_governance_v1.up.sql','modules/administration/migrations/postgresql/production/003_project_governance_v1.up.sql','modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql','modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql','modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql',
]:['modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql','modules/identity/migrations/postgresql/production/006_historical_migration_attestation_schema_v1.sql','modules/identity/migrations/postgresql/production/002_runtime_role_grants.sql','modules/identity/migrations/postgresql/production/013_identity_workload_evidence_v1.up.sql','modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql'];
test('R3C2B Identity canonical and drift on new owned PG17/18',{skip:process.env.REL002_R3C2B_DISPOSABLE!=='CONFIRMED',timeout:240000},async t=>{
 const config=validateInputs({execute:true,host:'127.0.0.1',port:process.env.REL002_R3C2B_PORT,major:process.env.REL002_R3C2B_MAJOR,bin:process.env.REL002_R3C2B_BIN},{...process.env,REL002_R3C1_CAPTURE_DISPOSABLE:process.env.REL002_R3C2B_DISPOSABLE});
 for(const key of Object.keys(process.env))assert.ok(!/^PG/i.test(key));
 if(full)assert.equal(config.major,17,'FULL_REVALIDATION_PG17_ONLY');
 const env=sanitizedEnvironment(process.env),evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-r3c2b-compat-')),dataDirectory=join(evidenceDirectory,'cluster');
 const lifecycle=(tool,args)=>{assert.equal(tool,'pg_ctl');runPgCtlLifecycle(config.bin,env,args);};
 let client;const evidence={major:config.major,sequence,checksums:{},clusterStopped:false};
 try{await runOwnedCluster(async()=>{
  for(const tool of ['initdb','postgres','pg_ctl'])assert.match(execFileSync(join(config.bin,tool+'.exe'),['--version'],{env,stdio:'pipe',windowsHide:true}).toString(),new RegExp(`PostgreSQL\\) ${config.major}\\.`));
  execFileSync(join(config.bin,'initdb.exe'),['-D',dataDirectory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],{env,stdio:'ignore',windowsHide:true,timeout:60000});
  lifecycle('pg_ctl',['start','-D',dataDirectory,'-l',join(evidenceDirectory,'server.log'),'-o',`-h 127.0.0.1 -p ${config.port}`,'-w']);
 },async()=>{
  const {Client}=await import('pg');client=new Client({host:'127.0.0.1',port:config.port,user:'postgres',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:5000});await client.connect();
  const target=(await client.query("SELECT current_user AS \"currentUser\",current_database() AS database,inet_server_addr()::text AS \"serverAddress\",inet_server_port() AS port,current_setting('server_version_num') AS version_num,current_setting('data_directory') AS \"dataDirectory\"")).rows[0];
  console.log(JSON.stringify({stage:'BEFORE_FIXTURE_MUTATION',...target,evidenceDirectory}));
  assertOwnedTarget({...config,dataDirectory,currentUser:'postgres',database:'postgres',serverAddress:'127.0.0.1'},{...target,created:true,major:Math.floor(Number(target.version_num)/10000)});
  assert.equal((await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE left(nspname,4)='app_') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present")).rows[0].present,false);
 },async()=>{
  for(const role of ['ai_mls_production_runtime','ai_mls_production_migration_operator'])await client.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  await client.query('REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime');
  for(const path of sequence){const bytes=await readFile(path);evidence.checksums[path]=createHash('sha256').update(bytes).digest('hex');await client.query('SET ROLE ai_mls_production_migration_operator');await client.query(bytes.toString());await client.query('RESET ROLE');}
  if(full){
   await client.query('SET ROLE ai_mls_production_migration_operator');
   await client.query("INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','disposable-operator','disposable-backup',$1,'APPLIED')",['2026-10-03T00:00:00.000Z']);await client.query('RESET ROLE');
   for(const c of R3B1_CHILD_ROOT_SCHEMA_CONTRACTS)await client.query('SELECT set_config($1,$2,false)',['ai_mls.r3b1_'+c.schemaName.slice(4)+'_artifact_sha256',c.artifactSha256]);
   await client.query('SET ROLE ai_mls_production_runtime');evidence.readiness=[];evidence.cleanup=[];
   const pool={close:async()=>{},connect:async()=>({release(){},query:async(sql,values)=>{
    const result=await client.query(sql,values);
    if(sql===R3C2B_IDENTITY_COMPATIBILITY_QUERY)evidence.readiness.push({gate:'R3C2B',ready:r3c2bIdentityCompatibleRowsReady(result.rows),rows:result.rows});
    if(sql===R3C2C_TEAM_CATALOG_QUERY)evidence.readiness.push({gate:'R3C2C',ready:result.rows.length===2&&R3C2C_TEAM_CONTRACTS.every(c=>result.rows.filter(r=>r.schema_name===c.schemaName&&r.table_name===c.tableName&&r.fingerprint===c.fingerprint&&r.authority_ok===true).length===1),rows:result.rows});
    if(sql==='ROLLBACK')evidence.cleanup.push('ROLLBACK_PASS');return {rows:result.rows,rowCount:result.rowCount};
   }})};
   try{await assertR3C2AggregateSchemasReady(pool);evidence.aggregate='PASS';}catch(error){evidence.aggregate='BLOCKED';evidence.error={name:error.name,code:error.code};}
   assert.ok(evidence.readiness.some(r=>r.gate==='R3C2B'&&r.ready));
   console.log(JSON.stringify({aggregate:evidence.aggregate,readiness:evidence.readiness.map(r=>({gate:r.gate,ready:r.ready,rows:r.rows.map(row=>({schema_name:row.schema_name,table_name:row.table_name,fingerprint:row.fingerprint,authority_ok:row.authority_ok}))})),evidenceDirectory}));
   return; // Stop at the first later blocker. No drift/setup/registration after aggregate.
  }
  const rows=async()=>{await client.query('SET ROLE ai_mls_production_runtime');try{return (await client.query(R3C2B_IDENTITY_COMPATIBILITY_QUERY)).rows;}finally{await client.query('RESET ROLE');}};
  const ready=async()=>r3c2bIdentityCompatibleRowsReady(await rows());
  await t.test('operator absent canonical and historical fingerprints',async()=>{
   evidence.baseline=await rows();assert.equal(r3c2bIdentityCompatibleRowsReady(evidence.baseline),true);
   const expected=config.major===17?'175b48a0962f684c34b6f9f5ad7a9956':'88222856a373735336da52e4cae9f2c8';assert.equal(evidence.baseline[0].fingerprint,expected);
   const historical=(await client.query(R3C2B_EVIDENCE_CATALOG_QUERY)).rows.find(r=>r.schema_name==='app_identity');assert.equal(historical.fingerprint,expected);
  });
  const mutations=[
   ['NOT NULL removed','ALTER TABLE app_identity.identity_workload_evidence ALTER COLUMN tenant_id DROP NOT NULL'],
   ['unexpected NOT NULL column','ALTER TABLE app_identity.identity_workload_evidence ADD COLUMN unexpected text NOT NULL'],
   ['nullable column added','ALTER TABLE app_identity.identity_workload_evidence ADD COLUMN unexpected text'],
   ['non-n constraint changed','ALTER TABLE app_identity.identity_workload_evidence DROP CONSTRAINT identity_workload_evidence_schema_version_check; ALTER TABLE app_identity.identity_workload_evidence ADD CONSTRAINT identity_workload_evidence_schema_version_check CHECK(schema_version=2)'],
   ['non-n constraint added','ALTER TABLE app_identity.identity_workload_evidence ADD CONSTRAINT unexpected CHECK(registration_version>0)'],
   ['non-n constraint removed','ALTER TABLE app_identity.identity_workload_evidence DROP CONSTRAINT identity_workload_evidence_schema_version_check'],
   ['index','CREATE INDEX unexpected ON app_identity.identity_workload_evidence(tenant_id)'],
   ['trigger','ALTER TABLE app_identity.identity_workload_evidence DISABLE TRIGGER identity_workload_evidence_guard'],
   ['function','ALTER FUNCTION app_identity.identity_workload_evidence_guard() SET search_path=public'],
   ['schema owner','ALTER SCHEMA app_identity OWNER TO postgres'],
   ['table owner','ALTER TABLE app_identity.identity_workload_evidence OWNER TO postgres'],
   ['schema ACL','GRANT CREATE ON SCHEMA app_identity TO PUBLIC'],
   ['table ACL','GRANT SELECT ON app_identity.identity_workload_evidence TO PUBLIC'],
   ['column ACL','GRANT UPDATE(tenant_id) ON app_identity.identity_workload_evidence TO ai_mls_production_runtime'],
   ['effective privilege','GRANT INSERT ON app_identity.identity_workload_evidence TO ai_mls_production_runtime'],
   ['RLS','ALTER TABLE app_identity.identity_workload_evidence ENABLE ROW LEVEL SECURITY'],
   ['forceRLS','ALTER TABLE app_identity.identity_workload_evidence FORCE ROW LEVEL SECURITY'],
   ['options','ALTER TABLE app_identity.identity_workload_evidence SET(fillfactor=80)'],
   ['comment',"COMMENT ON TABLE app_identity.identity_workload_evidence IS 'drift'"],
   ['authority','GRANT ai_mls_production_migration_operator TO ai_mls_production_runtime'],
   ['missing root','DROP TABLE app_identity.identity_workload_evidence'],
  ];
  for(const [name,sql] of mutations)await t.test(name+' denied',async()=>{await client.query('BEGIN');try{await client.query(sql);assert.equal(await ready(),false);}finally{await client.query('ROLLBACK');}assert.equal(await ready(),true);});
  await t.test('approved registration operator present retains semantics and cannot bypass drift',async()=>{
   await client.query('CREATE ROLE supabase_admin SUPERUSER; CREATE ROLE ai_mls_production_registration_operator LOGIN NOINHERIT; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_registration_operator; GRANT TEMPORARY ON DATABASE postgres TO PUBLIC; GRANT ai_mls_production_runtime,ai_mls_production_migration_operator,ai_mls_production_registration_operator TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE');
   // Same provider-provenance emulation as the approved 021 disposable test; owned cluster only.
   await client.query("UPDATE pg_auth_members SET grantor='supabase_admin'::regrole WHERE roleid IN ('ai_mls_production_runtime'::regrole,'ai_mls_production_migration_operator'::regrole,'ai_mls_production_registration_operator'::regrole)");
   const pre=(await client.query(await readFile('modules/identity/migrations/postgresql/production/021_r3g1b_not_null_catalog_compatibility.verify.sql','utf8'))).rows;
   console.log(JSON.stringify({managedPrecondition:pre}));assert.ok(pre.every(r=>r.ready===true));
   const {Client}=await import('pg');const migration=new Client({host:'127.0.0.1',port:config.port,database:'postgres',user:'ai_mls_production_migration_operator',password:'',ssl:false,options:''});await migration.connect();
   try{await migration.query(await readFile('modules/identity/migrations/postgresql/production/022_registration_operator_managed_compatibility_grants.sql','utf8'));}finally{await migration.end();}
   assert.equal(await ready(),true);
   await client.query('BEGIN');try{await client.query('GRANT UPDATE ON app_identity.identity_workload_evidence TO ai_mls_production_registration_operator');assert.equal(await ready(),false);}finally{await client.query('ROLLBACK');}
  });
 },async()=>{try{if(client)await client.end();}finally{stopOwnedCluster(lifecycle,{created:true,dataDirectory,evidenceDirectory});evidence.clusterStopped=true;}});
 }finally{await writeFile(join(evidenceDirectory,'result.json'),JSON.stringify(evidence,null,2));}
});
