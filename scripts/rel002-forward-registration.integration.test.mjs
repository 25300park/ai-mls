import { R3C2C_COMPATIBILITY_QUERY,r3c2cCompatibleRowsReady } from '../dist/apps/api/src/r3c2c-catalog-compatibility.js';
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
import { FORWARD_REGISTRATION_CONTRACT_ID, FORWARD_REGISTRATION_STRUCTURAL_ACL_QUERY, FORWARD_REGISTRATION_AUTHORITY_QUERY, validateForwardRegistrationStructure, validateForwardRegistrationReadiness, projectForwardRegistrationQuery } from '../dist/apps/api/src/forward-registration-readiness.js';
import { R3C2C_TEAM_CATALOG_QUERY,R3C2C_TEAM_CONTRACTS } from '../dist/apps/api/src/r3c2c-postgresql-readiness.js';
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from '../dist/apps/api/src/child-root-postgresql-readiness.js';
const full=true;
const sequence=full?[
 ...['modules/publication','modules/administration','modules/source/connector','modules/source/external-integration','modules/ai/advisory'].flatMap(dir=>['001_schema_v1.up.sql','002_runtime_role_grants.sql'].map(name=>`${dir}/migrations/postgresql/production/${name}`)),
 ...['001_identity_persistence_v1.up.sql','006_historical_migration_attestation_schema_v1.sql','002_runtime_role_grants.sql','012_workload_startup_binding_v1.up.sql','013_identity_workload_evidence_v1.up.sql'].map(name=>`modules/identity/migrations/postgresql/production/${name}`),
 'modules/organization/migrations/postgresql/production/001_organization_governance_v1.up.sql','modules/administration/migrations/postgresql/production/003_project_governance_v1.up.sql','modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql','modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql','modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql',
]:["modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql","modules/identity/migrations/postgresql/production/006_historical_migration_attestation_schema_v1.sql","modules/identity/migrations/postgresql/production/002_runtime_role_grants.sql","modules/identity/migrations/postgresql/production/012_workload_startup_binding_v1.up.sql","modules/identity/migrations/postgresql/production/013_identity_workload_evidence_v1.up.sql","modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql","modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql","modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql"];
test('Forward registration full structure and absent operational role on owned PG17/18',{skip:process.env.REL002_R3C2C_DISPOSABLE!=='CONFIRMED',timeout:240000},async t=>{
 const config=validateInputs({execute:true,host:'127.0.0.1',port:process.env.REL002_R3C2C_PORT,major:process.env.REL002_R3C2C_MAJOR,bin:process.env.REL002_R3C2C_BIN},{...process.env,REL002_R3C1_CAPTURE_DISPOSABLE:process.env.REL002_R3C2C_DISPOSABLE});
 for(const key of Object.keys(process.env))assert.ok(!/^PG/i.test(key));

 const env=sanitizedEnvironment(process.env),evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-forward-registration-')),dataDirectory=join(evidenceDirectory,'cluster');
 const lifecycle=(tool,args)=>{assert.equal(tool,'pg_ctl');runPgCtlLifecycle(config.bin,env,args);};
 let client;let initialized=false;const evidence={major:config.major,sequence,checksums:{},clusterStopped:false};
 try{await runOwnedCluster(async()=>{
  for(const tool of ['initdb','postgres','pg_ctl'])assert.match(execFileSync(join(config.bin,tool+'.exe'),['--version'],{env,stdio:'pipe',windowsHide:true}).toString(),new RegExp(`PostgreSQL\\) ${config.major}\\.`));
  execFileSync(join(config.bin,'initdb.exe'),['-D',dataDirectory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],{env,stdio:'ignore',windowsHide:true,timeout:60000});
  initialized=true;
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
  for(const path of sequence){
   if(path.endsWith('/002_binding_activation_team_v2.up.sql')){
    await client.query('SET ROLE ai_mls_production_runtime');
    const legacy=await client.query(projectForwardRegistrationQuery(R3C2C_COMPATIBILITY_QUERY));
    evidence.audit001Rejected=!r3c2cCompatibleRowsReady(legacy.rows);
    await client.query('RESET ROLE');
   }
   const bytes=await readFile(path);evidence.checksums[path]=createHash('sha256').update(bytes).digest('hex');await client.query('SET ROLE ai_mls_production_migration_operator');await client.query(bytes.toString());await client.query('RESET ROLE');
  }
  if(full){
   await client.query('SET ROLE ai_mls_production_migration_operator');
   await client.query("INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','disposable-operator','disposable-backup',$1,'APPLIED')",['2026-10-03T00:00:00.000Z']);await client.query('RESET ROLE');
   for(const c of R3B1_CHILD_ROOT_SCHEMA_CONTRACTS)await client.query('SELECT set_config($1,$2,false)',['ai_mls.r3b1_'+c.schemaName.slice(4)+'_artifact_sha256',c.artifactSha256]);
   await client.end();
   const {Client}=await import('pg');
   client=new Client({host:'127.0.0.1',port:config.port,user:'ai_mls_production_runtime',database:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:5000});await client.connect();
   for(const c of R3B1_CHILD_ROOT_SCHEMA_CONTRACTS)await client.query('SELECT set_config($1,$2,false)',['ai_mls.r3b1_'+c.schemaName.slice(4)+'_artifact_sha256',c.artifactSha256]);
   evidence.readiness=[];evidence.cleanup=[];
   const pool={close:async()=>{},connect:async()=>({release(){},query:async(sql,values)=>{
    const result=await client.query(sql,values);
    if(sql===projectForwardRegistrationQuery(R3C2B_IDENTITY_COMPATIBILITY_QUERY))evidence.readiness.push({gate:'R3C2B',ready:r3c2bIdentityCompatibleRowsReady(result.rows),rows:result.rows});
    if(sql===projectForwardRegistrationQuery(R3C2C_COMPATIBILITY_QUERY))evidence.readiness.push({gate:'R3C2C',ready:r3c2cCompatibleRowsReady(result.rows),rows:result.rows});
    if(sql==='ROLLBACK')evidence.cleanup.push('ROLLBACK_PASS');return {rows:result.rows,rowCount:result.rowCount};
   }})};
   try{await validateForwardRegistrationStructure(pool,FORWARD_REGISTRATION_CONTRACT_ID);await assert.rejects(validateForwardRegistrationReadiness(pool,FORWARD_REGISTRATION_CONTRACT_ID));evidence.aggregate='PASS';}catch(error){evidence.aggregate='BLOCKED';evidence.error={name:error.name,code:error.code};}
   assert.equal(evidence.aggregate,'PASS');
   assert.ok(evidence.readiness.some(r=>r.gate==='R3C2B'&&r.ready));assert.ok(evidence.readiness.some(r=>r.gate==='R3C2C'&&r.ready));
   console.log(JSON.stringify({aggregate:evidence.aggregate,readiness:evidence.readiness.map(r=>({gate:r.gate,ready:r.ready,rows:r.rows.map(row=>({schema_name:row.schema_name,table_name:row.table_name,fingerprint:row.fingerprint,authority_ok:row.authority_ok}))})),evidenceDirectory}));
   for(const c of R3B1_CHILD_ROOT_SCHEMA_CONTRACTS)await t.test(c.schemaName+' artifact binding required',async()=>{
    const key='ai_mls.r3b1_'+c.schemaName.slice(4)+'_artifact_sha256';
    await client.query('SELECT set_config($1,$2,false)',[key,'']);
    try{await assert.rejects(validateForwardRegistrationStructure(pool,FORWARD_REGISTRATION_CONTRACT_ID));}
    finally{await client.query('SELECT set_config($1,$2,false)',[key,c.artifactSha256]);}
   });
   for(const [name,match] of [['provenance','FROM app_identity.identity_schema_migrations'],['Audit002 root',' AS root_json'],['child readiness','AS artifact_sha256']])await t.test(name+' unavailable fails closed',async()=>{
    const failedPool={close:async()=>{},connect:async()=>({release(){},query:async(sql,values)=>{
     if(sql.includes(match))throw Error('local injected unavailable');
     const result=await client.query(sql,values);return {rows:result.rows,rowCount:result.rowCount};
    }})};
    await assert.rejects(validateForwardRegistrationStructure(failedPool,FORWARD_REGISTRATION_CONTRACT_ID));
   });
   await validateForwardRegistrationStructure(pool,FORWARD_REGISTRATION_CONTRACT_ID);
   await t.test('actual pre-Audit002 catalog is rejected',()=>assert.equal(evidence.audit001Rejected,true));
   // Test-only virtual catalogs: no role, grant, or membership is provisioned.
   // The existing unused pg_read_all_data OID supplies a resolvable ACL identity; only the SELECT
   // catalog view aliases its name. Production validator code sees ordinary catalogs.
   const virtualCatalog=(sql,state)=>{
    const schemaAcl=state==='unprovisioned'?"n.nspacl":"CASE WHEN n.nspname IN ('app_identity','app_audit') THEN array_append(coalesce(n.nspacl,acldefault('n',n.nspowner)),'pg_read_all_data=U/ai_mls_production_migration_operator'::aclitem) ELSE n.nspacl END";
    const tableAcl=state==='unprovisioned'?"c.relacl":`CASE WHEN c.oid IN (SELECT to_regclass(name) FROM (VALUES ('app_identity.identity_registered_service_workloads'),('app_identity.identity_workload_evidence'),('app_audit.audit_evidence_read_records')) t(name)) ${state==='partial'?"AND c.relname='identity_workload_evidence'":""} THEN array_append(coalesce(c.relacl,acldefault('r',c.relowner)),'pg_read_all_data=${state==='illegal'?'w':state==='grant-option'?'ar*':state==='partial'?'r':'ar'}/${state==='wrong-grantor'?'postgres':'ai_mls_production_migration_operator'}'::aclitem) ELSE c.relacl END`;
    const ctes=`pg_roles AS (SELECT r.oid,CASE WHEN r.rolname='pg_read_all_data' THEN 'ai_mls_production_registration_operator'::name ELSE r.rolname END AS rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolreplication,CASE WHEN r.rolname='pg_read_all_data' AND '${state}'='wrong-attributes' THEN 5 ELSE r.rolconnlimit END AS rolconnlimit,r.rolbypassrls FROM pg_catalog.pg_roles r),
    pg_auth_members AS (SELECT m.* FROM pg_catalog.pg_auth_members m WHERE '${state}'<>'wrong-membership'),
    pg_namespace AS (SELECT n.oid,n.nspname,n.nspowner,${schemaAcl} AS nspacl FROM pg_catalog.pg_namespace n),
    pg_class AS (SELECT c.oid,c.relname,c.relnamespace,c.relowner,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,${tableAcl} AS relacl FROM pg_catalog.pg_class c)`;
    return sql.startsWith('WITH ')?`WITH ${ctes}, ${sql.slice(5)}`:`WITH ${ctes} ${sql}`;
   };
   for(const state of ['unprovisioned','partial','exact','wrong-attributes','wrong-membership','illegal','grant-option','wrong-grantor'])await t.test('virtual registration '+state+' boundary',async()=>{
    let structuralQueries=0;
    const virtualPool={close:async()=>{},connect:async()=>({release(){},query:async(sql,values)=>{
     if(sql===FORWARD_REGISTRATION_AUTHORITY_QUERY)return {rows:[{ready:state==='exact'}],rowCount:1};
     if(sql.includes(FORWARD_REGISTRATION_STRUCTURAL_ACL_QUERY)){structuralQueries++;sql=virtualCatalog(sql,state);}
     let result;try{result=await client.query(sql,values);}catch(error){console.log(JSON.stringify({stage:'VIRTUAL_CATALOG_SQL',state,code:error.code,message:error.message}));throw error;}return {rows:result.rows,rowCount:result.rowCount};
    }})};
    if(['illegal','grant-option','wrong-grantor'].includes(state))await assert.rejects(validateForwardRegistrationStructure(virtualPool,FORWARD_REGISTRATION_CONTRACT_ID));
    else await validateForwardRegistrationStructure(virtualPool,FORWARD_REGISTRATION_CONTRACT_ID);
    if(state==='exact')await validateForwardRegistrationReadiness(virtualPool,FORWARD_REGISTRATION_CONTRACT_ID);
    else await assert.rejects(validateForwardRegistrationReadiness(virtualPool,FORWARD_REGISTRATION_CONTRACT_ID));
    assert.ok(structuralQueries>0);(evidence.roleStates??=[]).push({state,structural:['illegal','grant-option','wrong-grantor'].includes(state)?'FAIL_CLOSED':'PASS',operational:state==='exact'?'PASS_MOCKED_AUTHORITY':'FAIL_CLOSED'});
   });
   return; // No registration provisioning or command execution.

  }
 },async()=>{try{if(client)await client.end();}finally{if(initialized)stopOwnedCluster(lifecycle,{created:true,dataDirectory,evidenceDirectory});evidence.clusterStopped=true;}});
 }finally{await writeFile(join(evidenceDirectory,'result.json'),JSON.stringify(evidence,null,2));}
});
