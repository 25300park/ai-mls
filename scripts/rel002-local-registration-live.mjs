import { createReadOnlyStatementPolicy } from './rel002-read-only-statement-policy.mjs';
import { prepareBootstrapControl, provisionFixtureMemberships } from './rel002-membership-grantor.mjs';
// Explicitly authorized PG17 local execution only. No command/DRY_RUN entrypoint.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import { Client, Pool } from 'pg';
import { sanitizedEnvironment, runPgCtlLifecycle, stopOwnedCluster } from './rel002-r3c1-fixture-capture.mjs';
import { assertDisposableEnvironment, createOwnedRegistrationCapability, createOwnedRegistrationTargetPolicy, revokeOwnedRegistrationCapability } from './rel002-local-registration-target.mjs';
import { validateDualPoolRegistrationOperationalReadiness, REGISTRATION_TARGET_QUERY, closeRegistrationReadinessPools } from '../dist/tools/production/registration-dual-pool.js';
import { FORWARD_REGISTRATION_CONTRACT_ID, FORWARD_REGISTRATION_AUTHORITY_QUERY } from '../dist/apps/api/src/forward-registration-readiness.js';
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from '../dist/apps/api/src/child-root-postgresql-readiness.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const bin='C:/Users/Pc/AI-MLS-Tools/PostgreSQL-17/17.11/pgsql/bin',port=55468;
const roles=['ai_mls_production_migration_operator','ai_mls_production_runtime','ai_mls_production_registration_operator'];
const targets=['app_identity.identity_registered_service_workloads','app_identity.identity_workload_evidence','app_audit.audit_evidence_read_records'];
const sequence=[
 ...['modules/publication','modules/administration','modules/source/connector','modules/source/external-integration','modules/ai/advisory'].flatMap(dir=>['001_schema_v1.up.sql','002_runtime_role_grants.sql'].map(name=>`${dir}/migrations/postgresql/production/${name}`)),
 ...['001_identity_persistence_v1.up.sql','006_historical_migration_attestation_schema_v1.sql','002_runtime_role_grants.sql','012_workload_startup_binding_v1.up.sql','013_identity_workload_evidence_v1.up.sql'].map(name=>`modules/identity/migrations/postgresql/production/${name}`),
 'modules/organization/migrations/postgresql/production/001_organization_governance_v1.up.sql','modules/administration/migrations/postgresql/production/003_project_governance_v1.up.sql','modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql','modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql','modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql',
];
assert.equal(process.argv[2],'--approved-pg17-live-readiness','EXPLICIT_EXECUTION_REQUIRED');
assert.equal(process.argv.length,3,'NO_OTHER_ARGUMENTS');
for(const key of Object.keys(process.env))assert.ok(!/^(?:PG|AI_MLS_PRODUCTION_)|^DATABASE_URL$/i.test(key),'PRODUCTION_ENVIRONMENT_DENIED');
const env=sanitizedEnvironment(process.env);assertDisposableEnvironment(env);
assert.ok(sequence.length===20&&!sequence.some(path=>/\/(?:015|016|022)_/.test(path)),'SEQUENCE_DENIED');
await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(Error('LOCAL_PORT_UNAVAILABLE')));server.listen(port,'127.0.0.1',()=>server.close(error=>error?reject(Error('LOCAL_PORT_UNAVAILABLE')):resolve()));});
for(const tool of ['initdb','postgres','pg_ctl'])assert.match(execFileSync(join(bin,tool+'.exe'),['--version'],{env,windowsHide:true,stdio:'pipe'}).toString(),/PostgreSQL\) 17\.11/);
const evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-registration-')),dataDirectory=join(evidenceDirectory,'cluster'),runId=evidenceDirectory.split(/[\\/]/).at(-1).slice('rel002-registration-'.length);
const evidence={classification:'DISPOSABLE_FIXTURE_EVIDENCE',head:'f91a8953666f8c6c1ac6be25e3f6c97803576df6',policy:'LOCAL_OWNED_DISPOSABLE',sequence,checksums:{},stage:'INITDB',status:'BLOCKED',cleanup:[],queries:[],negativeCases:{},clusterStopped:false};
let initialized=false,bootstrap,control,migration,grantor,runtimePool,registrationPool,capability;
const connect=async(user,password)=>{const client=new Client({host:'127.0.0.1',port,database:'postgres',user,password,ssl:false,options:'',connectionTimeoutMillis:5000});await client.connect();return client;};
const lifecycle=(tool,args)=>{assert.equal(tool,'pg_ctl');runPgCtlLifecycle(bin,env,args);};
const passwords=new Map(roles.concat('supabase_admin').map(role=>[role,randomBytes(32).toString('hex')]));
const counts=async()=>Object.fromEntries(await Promise.all(targets.map(async table=>[table,Number((await control.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count)])));
const safeFailure=error=>({name:['AssertionError','Error','RegistrationCommandError','GovernancePersistenceError'].includes(error?.name)?error.name:'Error',code:/^[A-Z0-9_]{1,40}$/.test(error?.code??'')?error.code:null,message:'LOCAL_READINESS_FAILED_CLOSED'});
try{
 execFileSync(join(bin,'initdb.exe'),['-D',dataDirectory,'-U','supabase_admin','--auth=trust','--encoding=UTF8','--locale=C'],{env,stdio:'ignore',windowsHide:true,timeout:60000});initialized=true;
 await writeFile(join(dataDirectory,'pg_hba.conf'),'local all all trust\nhost all supabase_admin 127.0.0.1/32 trust\nhost all postgres 127.0.0.1/32 trust\nhost all all 127.0.0.1/32 scram-sha-256\n');
 evidence.stage='START_OWNED_CLUSTER';lifecycle('pg_ctl',['start','-D',dataDirectory,'-l',join(evidenceDirectory,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w']);
 bootstrap=await connect('supabase_admin','');
 await prepareBootstrapControl(bootstrap,{dataDirectory,port,password:passwords.get('supabase_admin')});
 await writeFile(join(dataDirectory,'pg_hba.conf'),'local all all trust\nhost all postgres 127.0.0.1/32 trust\nhost all all 127.0.0.1/32 scram-sha-256\n');
 await bootstrap.query('SELECT pg_reload_conf()');
 await bootstrap.end();bootstrap=undefined;
 control=await connect('postgres','');
 capability=await createOwnedRegistrationCapability({created:true,optIn:'CONFIRMED',host:'127.0.0.1',runId,evidenceDirectory,dataDirectory,port,major:17,tls:false},control,env);
 const policy=createOwnedRegistrationTargetPolicy(capability);
 evidence.ownedClusterVerified=true;
 evidence.environment=(await control.query("SELECT version() AS version,current_setting('server_version_num') AS version_num,inet_server_port() AS port,current_database() AS database,pg_postmaster_start_time()::text AS cluster_started")).rows[0];
 evidence.dataDirectorySha256=sha(dataDirectory);evidence.clusterIdentifier=sha(runId+evidence.environment.cluster_started);
 assert.equal((await control.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE left(nspname,4)='app_') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present")).rows[0].present,false);
 evidence.stage='CANONICAL_PREREQUISITES';
 for(const role of roles.slice(0,2))await control.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${passwords.get(role)}'`);
 await control.query('REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime');
 migration=await connect(roles[0],passwords.get(roles[0]));
 for(const path of sequence){evidence.stage='APPLY_'+path;const bytes=await readFile(path);evidence.checksums[path]=sha(bytes);await migration.query(bytes.toString());}
 evidence.schemaSequenceApplied=true;evidence.stage='DISPOSABLE_NATIVE_PROVENANCE';
 await migration.query("INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','disposable-operator','disposable-backup',$1,'APPLIED')",['2026-10-03T00:00:00.000Z']);
 evidence.stage='HISTORICAL017';const roleSql=await readFile('modules/identity/migrations/postgresql/production/017_registration_operator_role.sql');evidence.checksums.historical017=sha(roleSql);await control.query(roleSql.toString());evidence.historical017Applied=true;
 await control.query(`ALTER ROLE ${roles[2]} PASSWORD '${passwords.get(roles[2])}'`);
 grantor=await connect('supabase_admin',passwords.get('supabase_admin'));
 evidence.stage='CURRENT_FORWARD_LOCAL_TOPOLOGY';
 evidence.memberships=await provisionFixtureMemberships(grantor);
 await control.query('GRANT TEMPORARY ON DATABASE postgres TO PUBLIC');
 evidence.stage='CURRENT_FORWARD_LOCAL_GRANTS';
 await migration.query('BEGIN');
 await migration.query('GRANT USAGE ON SCHEMA app_identity,app_audit TO ai_mls_production_registration_operator');
 for(const table of targets)await migration.query(`GRANT SELECT,INSERT ON TABLE ${table} TO ai_mls_production_registration_operator`);
 await migration.query('COMMIT');
 evidence.roles=(await control.query('SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,rolconnlimit FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname',[roles])).rows;
 evidence.memberships=(await control.query("SELECT r.rolname AS granted_role,u.rolname AS member_role,g.rolname AS grantor_role,m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor WHERE r.rolname=ANY($1) OR u.rolname=ANY($1) ORDER BY r.rolname",[roles])).rows;
 evidence.databaseAcl=(await control.query("SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname='postgres' ORDER BY grantee,a.privilege_type")).rows;
 evidence.effectiveDatabase=(await control.query("SELECT rolname,has_database_privilege(oid,'postgres','CONNECT') AS connect,has_database_privilege(oid,'postgres','CREATE') AS create,has_database_privilege(oid,'postgres','TEMPORARY') AS temporary FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname",[roles])).rows;
 evidence.schemaGrants=(await control.query("SELECT n.nspname,pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee='ai_mls_production_registration_operator'::regrole ORDER BY n.nspname")).rows;
 evidence.tableGrants=(await control.query("SELECT c.oid::regclass::text AS table_name,pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee='ai_mls_production_registration_operator'::regrole ORDER BY table_name,a.privilege_type")).rows;
 evidence.owners=(await control.query("SELECT c.oid::regclass::text AS table_name,pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.oid=ANY($1::regclass[]) ORDER BY table_name",[targets])).rows;
 const options=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(' ');
 const openPool=role=>{
  const physical=new Pool({host:'127.0.0.1',port,database:'postgres',user:role,password:passwords.get(role),ssl:false,options,max:1,connectionTimeoutMillis:5000});
  return{close:()=>physical.end(),connect:async()=>{
   const client=await physical.connect(),statementPolicy=createReadOnlyStatementPolicy();return{release:destroy=>client.release(destroy||statementPolicy.state!=='IDLE'),query:async(sql,values)=>{
    statementPolicy.accept(sql);
    evidence.queries.push({role,sha256:sha(sql)});try{return await client.query(sql,values);}catch(error){statementPolicy.fail();throw error;}
   }};
  }};
 };
 runtimePool=openPool(roles[1]);registrationPool=openPool(roles[2]);
 for(const [key,pool] of [['runtime',runtimePool],['registration',registrationPool]]){const client=await pool.connect();try{evidence[key]=(await client.query(REGISTRATION_TARGET_QUERY)).rows[0];}finally{client.release();}}
 assert.notEqual(evidence.runtime.pid,evidence.registration.pid);
 evidence.stage='LIVE_FORWARD_AUTHORITY';
 {const client=await registrationPool.connect();try{evidence.authority=(await client.query(FORWARD_REGISTRATION_AUTHORITY_QUERY)).rows;assert.equal(evidence.authority.length,1);assert.equal(evidence.authority[0].ready,true);}finally{client.release();}}
 evidence.beforeCounts=await counts();evidence.stage='LIVE_READINESS_ONLY';
 evidence.readiness=await validateDualPoolRegistrationOperationalReadiness(runtimePool,registrationPool,FORWARD_REGISTRATION_CONTRACT_ID,policy);
 evidence.afterCounts=await counts();assert.deepEqual(evidence.afterCounts,evidence.beforeCounts);
 evidence.writes=0;evidence.registrationCommandCalled=false;evidence.mutationLockAcquired=false;evidence.executionAuthorizerCalled=false;
 evidence.stage='BOUNDED_NEGATIVES';
 const reject=async(name,operation)=>{await assert.rejects(operation);evidence.negativeCases[name]='PASS';};
 await reject('same_pool',()=>validateDualPoolRegistrationOperationalReadiness(runtimePool,runtimePool,FORWARD_REGISTRATION_CONTRACT_ID,policy));
 await reject('swapped_roles',()=>validateDualPoolRegistrationOperationalReadiness(registrationPool,runtimePool,FORWARD_REGISTRATION_CONTRACT_ID,policy));
 await reject('same_backend',()=>policy.validatePair(evidence.runtime,{...evidence.registration,pid:evidence.runtime.pid}));
 await reject('port5432_without_cluster',()=>policy.validatePair(evidence.runtime,{...evidence.registration,port:5432}));
 assert.throws(()=>createOwnedRegistrationTargetPolicy({}));evidence.negativeCases.invalid_capability='PASS';
 await reject('controlled_metadata_target_mismatch',()=>policy.validatePair(evidence.runtime,{...evidence.registration,database_oid:evidence.registration.database_oid+1}));
 evidence.negativeCases.acl_matrix='NOT_RUN';evidence.status='PASS';evidence.stage='COMPLETE';
}catch(error){evidence.failure=safeFailure(error);evidence.status='FAIL';}
finally{
 if(capability)revokeOwnedRegistrationCapability(capability);
 if(runtimePool&&registrationPool){try{await closeRegistrationReadinessPools(runtimePool,registrationPool);evidence.cleanup.push({resource:'operational_pools',pass:true});}catch{evidence.cleanup.push({resource:'operational_pools',pass:false});evidence.status='FAIL';}}
 for(const [resource,client] of [['bootstrap',bootstrap],['migration',migration],['grantor',grantor],['control',control]])if(client){try{await client.end();evidence.cleanup.push({resource,pass:true});}catch{evidence.cleanup.push({resource,pass:false});evidence.status='FAIL';}}
 if(initialized){try{stopOwnedCluster(lifecycle,{created:true,dataDirectory,evidenceDirectory});evidence.clusterStopped=true;}catch{evidence.status='FAIL';evidence.clusterStopped=false;}}
 passwords.clear();
 await writeFile(join(evidenceDirectory,'live-readiness-evidence.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({status:evidence.status,stage:evidence.stage,evidencePath:join(evidenceDirectory,'live-readiness-evidence.json'),clusterStopped:evidence.clusterStopped,failure:evidence.failure??null}));
}
if(evidence.status!=='PASS')process.exitCode=1;
