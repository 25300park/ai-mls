import assert from "node:assert/strict";
import test from "node:test";
import { assertIndependentRegistrationTargets, assertRegistrationExecuteAuthorization, REGISTRATION_TARGET_QUERY, runDualPoolRegistration, forwardRegistrationValidators } from "../../../tools/production/registration-dual-pool.js";
import type { PostgreSqlPoolPort } from "./postgresql-pool.js";
import { REGISTRATION_DATABASE_TARGET, REGISTRATION_OPERATOR } from "./register-service-workload.js";
import { FORWARD_REGISTRATION_AUTHORITY_QUERY, FORWARD_REGISTRATION_CONTRACT_ID, FORWARD_REGISTRATION_IDENTITY_QUERY } from "../../../apps/api/src/forward-registration-readiness.js";
import { createRegistrationRunnerDependencies } from "../../../tools/production/register-service-workload.js";
import { rootCertificates } from "node:tls";

const runtime={current_user:'ai_mls_production_runtime',session_user:'ai_mls_production_runtime',database:'postgres',server_version_num:'170011',address:'127.0.0.1',port:5432,database_oid:5,cluster_started:'fixture',pid:101,tls:true};
const registration={...runtime,current_user:'ai_mls_production_registration_operator',session_user:'ai_mls_production_registration_operator',pid:102};
for(const version of ['170011','180004'])test(`independent PG${version} authenticated targets`,()=>{
 assert.doesNotThrow(()=>assertIndependentRegistrationTargets({...runtime,server_version_num:version},{...registration,server_version_num:version}));
});
for(const change of [{pid:101},{current_user:runtime.current_user},{session_user:'postgres'},{database:'other'},{address:'other'},{port:55461},{database_oid:6},{cluster_started:'other'},{tls:false},{server_version_num:'190000'}])test(`reject crossed target/session ${JSON.stringify(change)}`,()=>{
 assert.throws(()=>assertIndependentRegistrationTargets(runtime,{...registration,...change}));
});
test('execute requires fresh external human and quiescent-window authority',()=>{
 for(const value of [undefined,{}, {humanAuthorized:true},{quiescentWindowConfirmed:true},{humanAuthorized:false,quiescentWindowConfirmed:true}])assert.throws(()=>assertRegistrationExecuteAuthorization(value));
 assert.doesNotThrow(()=>assertRegistrationExecuteAuthorization({humanAuthorized:true,quiescentWindowConfirmed:true}));
});

const manifest={schemaVersion:1,registrationId:'dual-pool-fixture',registrationVersion:1,tenantId:'tenant-fixture',principalId:'principal-fixture',environment:'PRODUCTION',purpose:'AI_MLS_PRODUCTION_API_RUNTIME',audience:'ai-mls-api',scopeRef:'registered-service-workload:dual-pool-fixture:1',identityEvidenceRef:'proof-fixture',auditEvidenceRef:'audit-fixture',expectedDatabaseTarget:REGISTRATION_DATABASE_TARGET,expectedExecutionRole:REGISTRATION_OPERATOR,expectedWrites:3,timestampPolicy:'GENERATED_AT_EXECUTION'};
function composition(change:Record<string,unknown>={}){
 const queries:string[]=[],events:string[]=[];let checks=0,authorityChecks=0,runtimeTargets=0;
 const pool=(kind:'runtime'|'registration'):PostgreSqlPoolPort=>({
  close:async()=>{await Promise.resolve();events.push('close:'+kind);if(change['close']===kind)throw Error('unsafe-driver-secret');},
  connect:async()=>{await Promise.resolve();return {
   release(destroy?:boolean){events.push('release:'+kind+(destroy?':destroy':''));},
   query:async<Row extends Record<string,unknown>>(sql:string)=>{
    await Promise.resolve();queries.push(kind+':'+sql);
    let rows:Record<string,unknown>[]=[];
    const identity={...(kind==='runtime'?runtime:registration),...(kind==='runtime'?change['runtime']:change['registration']) as Record<string,unknown>};
    if(kind==='runtime'&&sql===REGISTRATION_TARGET_QUERY&&++runtimeTargets===2&&change['targetChanged'])identity.database_oid=6;
    if(sql===REGISTRATION_TARGET_QUERY||sql===FORWARD_REGISTRATION_IDENTITY_QUERY||sql==='SELECT current_user,session_user,current_database() AS database')rows=[identity];
    else if(sql===FORWARD_REGISTRATION_AUTHORITY_QUERY){authorityChecks++;rows=[{ready:change['authority']!==false&&!(change['authorityChanged']&&authorityChecks===2)}];}
    else if(sql.includes('has_schema_privilege'))rows=[{use:true,create:false}];
    else if(sql.includes('has_table_privilege'))rows=[{read:true,insert:true,forbidden:false}];
    else if(sql.startsWith('SELECT registration_id')&&change['conflict'])rows=[{registration_id:'conflicting-fixture'}];
    else if(change['replay']&&sql.startsWith('SELECT registration_id'))rows=[{registration_id:manifest.registrationId,tenant_id:manifest.tenantId,principal_id:manifest.principalId,principal_type:'SERVICE',assurance:'WORKLOAD',environment:'PRODUCTION',status:'ACTIVE',workload_purpose:manifest.purpose,audience:manifest.audience,registration_version:1,identity_evidence_ref:manifest.identityEvidenceRef,audit_evidence_ref:manifest.auditEvidenceRef,created_at:'2026-10-13T00:00:00.000Z',updated_at:'2026-10-13T00:00:00.000Z'}];
    else if(change['replay']&&sql.startsWith('SELECT * FROM app_identity.identity_workload_evidence'))rows=[{registration_id:manifest.registrationId,registration_version:1,tenant_id:manifest.tenantId,principal_id:manifest.principalId,schema_version:1,immutable:true}];
    else if(change['replay']&&sql.startsWith('SELECT * FROM app_audit.audit_evidence_read_records'))rows=[{audit_evidence_ref:manifest.auditEvidenceRef,source_domain:'IDENTITY',aggregate_type:'REGISTERED_SERVICE_WORKLOAD',aggregate_id:manifest.registrationId,aggregate_version:1,event_type:'REGISTERED_SERVICE_WORKLOAD.REGISTERED',payload_schema_version:1,final:true,tenant_id:manifest.tenantId,scope_ref:manifest.scopeRef,payload:{registrationId:manifest.registrationId,registrationVersion:1,tenantId:manifest.tenantId,principalId:manifest.principalId,principalType:'SERVICE',assurance:'WORKLOAD',environment:'PRODUCTION'},occurred_at:'2026-10-13T00:00:00.000Z',materialized_at:'2026-10-13T00:00:00.000Z'}];
    else if(sql==='ROLLBACK'&&change['rollback'])throw Error('unsafe-driver-secret');
    else if(sql==='COMMIT'&&change['commit'])throw Error('unsafe-driver-secret');
    return {rows:rows as Row[],rowCount:rows.length};
   },
  };},
 });
 const runtimePool=pool('runtime'),registrationPool=pool('registration');
 const dependencies={...forwardRegistrationValidators,
  createRuntimePool:()=>{events.push('create:runtime');return runtimePool;},
  createRegistrationPool:()=>{events.push('create:registration');return change['samePool']?runtimePool:registrationPool;},
  validateRuntimeStructure:async(p:PostgreSqlPoolPort,id:string)=>{await Promise.resolve();assert.notEqual(p,registrationPool);assert.equal(id,FORWARD_REGISTRATION_CONTRACT_ID);events.push('structure:'+ ++checks);if(change['initialFailure']||change['finalFailure']&&checks===2)throw Error('unsafe-driver-secret');},
 };
 return {queries,events,dependencies,get checks(){return checks;}};
}
for(const version of ['170011','180004'])test(`mocked PG${version} dual pool dry-run composition writes zero`,async()=>{
 const c=composition({runtime:{server_version_num:version},registration:{server_version_num:version}});
 const result=await runDualPoolRegistration(manifest,'DRY_RUN',c.dependencies);
 assert.equal(result.result,'VALIDATED');assert.equal(result.actualWrites,0);assert.equal(result.expectedWrites,3);
 assert.equal(c.checks,2);assert.ok(c.events.indexOf('structure:1')<c.events.indexOf('create:registration'));
 assert.ok(c.queries.some(q=>q.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')));
 assert.ok(c.queries.filter(q=>q.includes(FORWARD_REGISTRATION_AUTHORITY_QUERY)).length===2);
 assert.ok(c.queries.every(q=>!/:\s*(INSERT|UPDATE|DELETE|SET ROLE|CREATE|GRANT)/i.test(q)));
 assert.equal(c.events.filter(e=>e.startsWith('close:')).length,2);
});
for(const change of [{samePool:true},{registration:{pid:101}},{runtime:{current_user:REGISTRATION_OPERATOR}},{registration:{current_user:runtime.current_user}},{runtime:{session_user:'postgres'}},{registration:{session_user:'postgres'}},{runtime:{current_user:'ai_mls_production_migration_operator'}},{registration:{address:'different'}},{initialFailure:true},{authority:false},{finalFailure:true},{authorityChanged:true},{targetChanged:true}])test(`composition fails before writes ${JSON.stringify(change)}`,async()=>{
 const c=composition(change);await assert.rejects(runDualPoolRegistration(manifest,'DRY_RUN',c.dependencies),{code:'UNAVAILABLE'});
 assert.ok(c.queries.every(q=>!/:INSERT/i.test(q)));assert.ok(c.events.includes('close:runtime'));
 if(!change.initialFailure&&!change.runtime&&!change.samePool)assert.ok(c.events.includes('close:registration'));
});
test('execute remains disabled by default without constructing pools',async()=>{
 const c=composition();await assert.rejects(runDualPoolRegistration(manifest,'EXECUTE',c.dependencies),{code:'UNAVAILABLE'});assert.equal(c.events.length,0);
});
test('exact replay preserves idempotent NO_OP and zero writes',async()=>{
 const c=composition({replay:true});const result=await runDualPoolRegistration(manifest,'DRY_RUN',c.dependencies);
 assert.equal(result.result,'NO_OP');assert.equal(result.actualWrites,0);assert.ok(c.queries.includes('registration:COMMIT'));
});
for(const gate of ['ARTIFACT_BINDINGS','R3C2','IDENTITY_PROVENANCE','FORWARD_STRUCTURE'])test(`${gate} unavailable blocks registration pool construction`,async()=>{
 const c=composition();await assert.rejects(runDualPoolRegistration(manifest,'DRY_RUN',{...c.dependencies,validateRuntimeStructure:async()=>{await Promise.resolve();throw Error(gate);}}),{code:'UNAVAILABLE'});
 assert.ok(!c.events.includes('create:registration'));assert.deepEqual(c.events.filter(e=>e.startsWith('close:')),['close:runtime']);
});
test('execute final readiness is required under lock before first write',async()=>{
 const c=composition({finalFailure:true});let authorizations=0;
 const authorizeExecute=async()=>{await Promise.resolve();authorizations++;return {humanAuthorized:true,quiescentWindowConfirmed:true};};
 await assert.rejects(runDualPoolRegistration(manifest,'EXECUTE',{...c.dependencies,authorizeExecute}),{code:'UNAVAILABLE'});
 assert.equal(c.checks,2);assert.equal(authorizations,2);
 assert.ok(c.queries.some(q=>q.includes('pg_advisory_xact_lock')));assert.ok(c.queries.some(q=>q==='registration:ROLLBACK'));
 assert.ok(c.queries.every(q=>!/:INSERT/i.test(q)));
});
test('fresh execute/window authority is checked again before writes',async()=>{
 const c=composition();let calls=0;
 await assert.rejects(runDualPoolRegistration(manifest,'EXECUTE',{...c.dependencies,authorizeExecute:async()=>{await Promise.resolve();return {humanAuthorized:true,quiescentWindowConfirmed:++calls===1};}}),{code:'UNAVAILABLE'});
 assert.equal(calls,2);assert.ok(c.queries.every(q=>!/:INSERT/i.test(q)));
});
for(const change of [{conflict:true},{conflict:true,rollback:true},{commit:true},{close:'runtime'},{close:'registration'}])test(`bounded rollback/cleanup ${JSON.stringify(change)}`,async()=>{
 const c=composition(change);await assert.rejects(runDualPoolRegistration(manifest,'DRY_RUN',c.dependencies),error=>error instanceof Error&&!error.message.includes('unsafe-driver-secret'));
 assert.equal(c.events.filter(e=>e.startsWith('close:')).length,2);
 if(change.conflict)assert.ok(c.queries.includes('registration:ROLLBACK'));
});
test('configuration never falls back to raw or opposite-role bindings',()=>{
 for(const env of [{},{DATABASE_URL:'DO_NOT_ECHO'},{AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1:'DO_NOT_ECHO'},{AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1:'DO_NOT_ECHO'}])assert.throws(()=>createRegistrationRunnerDependencies(env),error=>error instanceof Error&&!error.message.includes('DO_NOT_ECHO'));
});
for(const sql of ['SET ROLE postgres','SET LOCAL ROLE postgres','RESET ROLE','SELECT 1; SET SESSION ROLE postgres'])test(`role switching denied before driver invocation ${sql}`,async()=>{
 const c=composition();await assert.rejects(runDualPoolRegistration(manifest,'DRY_RUN',{...c.dependencies,validateRuntimeStructure:async(pool)=>{
  const client=await pool.connect();try{await client.query(sql);}finally{client.release();}
 }}),{code:'UNAVAILABLE'});
 assert.ok(c.queries.every(q=>!q.includes(sql)));assert.ok(!c.events.includes('create:registration'));
});
test('registration-side role switching also fails closed',async()=>{
 const c=composition();await assert.rejects(runDualPoolRegistration(manifest,'DRY_RUN',{...c.dependencies,validateRegistrationAuthority:async(client)=>{await client.query('SET ROLE postgres');}}),{code:'UNAVAILABLE'});
 assert.ok(c.queries.every(q=>!q.includes('SET ROLE postgres')));assert.equal(c.events.filter(e=>e.startsWith('close:')).length,2);
});
test('all four existing sealed bindings are required without opening a pool',()=>{
 // Synthetic in-memory fixture only; no credential is installed or used to connect.
 const connection=(user:string):string=>{const url=new URL('postgresql://'+REGISTRATION_DATABASE_TARGET.host+':5432/postgres');url.username=user;url.password='DO_NOT_ECHO_TEST_FIXTURE';return url.href;};
 const environment:Record<string,string>={
  RUNTIME_ENVIRONMENT:'PRODUCTION',CONFIGURATION_REFERENCE:'config:production:v1',REQUIRED_SERVICE_REGISTRATIONS:'fixture-registration',REQUIRED_SERVICE_WORKLOAD_PINS:'[{"registrationId":"fixture-registration","registrationVersion":1}]',STARTUP_WORKLOAD_PURPOSE:'startup',STARTUP_WORKLOAD_AUDIENCE:'api',PROVIDER_EXECUTION_AUTHORIZED:'false',IDENTITY_PERSISTENCE_ENGINE:'POSTGRESQL',
  IDENTITY_DATABASE_CONNECTION_MODE:'DIRECT',IDENTITY_DATABASE_HOST:REGISTRATION_DATABASE_TARGET.host,IDENTITY_DATABASE_PORT:'5432',IDENTITY_DATABASE_NAME:'postgres',IDENTITY_DATABASE_USER:runtime.current_user,
  IDENTITY_DATABASE_CONNECTION_REF:'railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1',IDENTITY_DATABASE_CA_CERT_REF:'railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1',IDENTITY_DATABASE_SSL_MODE:'VERIFY_FULL',IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS:'10000',IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS:'30000',IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS:'30000',IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS:'30000',IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS:'30000',IDENTITY_DATABASE_MAX_CONNECTIONS:'5',IDENTITY_DATABASE_APPLICATION_NAME:'ai-mls-api-production',PORT:'8080',
  AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1:connection(runtime.current_user),AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1:connection(REGISTRATION_OPERATOR),AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1:rootCertificates[0]!,AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1:rootCertificates[0]!,
 };
 const dependencies=createRegistrationRunnerDependencies(environment);
 assert.equal(dependencies.validateRuntimeStructure,forwardRegistrationValidators.validateRuntimeStructure);
 assert.equal(dependencies.validateRegistrationAuthority,forwardRegistrationValidators.validateRegistrationAuthority);
 assert.equal(dependencies.authorizeExecute,undefined);
 for(const name of ['AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1']){
  const missing={...environment};delete missing[name];assert.throws(()=>createRegistrationRunnerDependencies(missing),{code:'UNAVAILABLE'});
 }
 for(const key of ['AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1'])assert.throws(()=>createRegistrationRunnerDependencies({...environment,[key]:connection(key.includes('IDENTITY')?REGISTRATION_OPERATOR:runtime.current_user)}),{code:'UNAVAILABLE'});
});

test('readiness trace identifies first structural failure and never opens registration pool client',async()=>{
 const {validateDualPoolRegistrationOperationalReadiness}=await import('../../../tools/production/registration-dual-pool.js');
 const trace:unknown[]=[];let registrationConnected=false,runtimeReleased=false;
 const runtimePool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(_sql:string)=>Promise.resolve({rows:[runtime] as unknown as R[],rowCount:1}),release:()=>{runtimeReleased=true;}}),close:()=>Promise.resolve()};
 const registrationPool:PostgreSqlPoolPort={connect:()=>{registrationConnected=true;return Promise.reject(Error('DO_NOT_LOG'));},close:()=>Promise.resolve()};
 await assert.rejects(validateDualPoolRegistrationOperationalReadiness(runtimePool,registrationPool,FORWARD_REGISTRATION_CONTRACT_ID,undefined,{structure:()=>Promise.reject(Error('DO_NOT_LOG_URI')),authority:()=>Promise.resolve()},event=>trace.push(event)));
 assert.equal(runtimeReleased,true);assert.equal(registrationConnected,false);
 const failures=trace.filter(e=>Reflect.get(e as object,'result')==='FAIL');assert.equal(Reflect.get(failures[0] as object,'subgate'),'FORWARD_STRUCTURE');assert.doesNotMatch(JSON.stringify(trace),/DO_NOT_LOG/u);
});

for(const failing of ['RUNTIME_SESSION','STRUCTURE_RESULT','REGISTRATION_SESSION','SESSION_PAIR','FORWARD_AUTHORITY'] as const)test(`strict readiness first rejection is ${failing}`,async()=>{
 const {validateDualPoolRegistrationOperationalReadiness}=await import('../../../tools/production/registration-dual-pool.js');
 const events:{subgate:string;result:string}[]=[];
 const pool=(kind:'runtime'|'registration'):PostgreSqlPoolPort=>({close:()=>Promise.resolve(),connect:()=>{
  if(kind==='registration'&&failing==='REGISTRATION_SESSION')return Promise.reject(Error('DO_NOT_LOG'));
  const row=kind==='runtime'?{...runtime,...(failing==='RUNTIME_SESSION'?{session_user:'wrong'}:{})}:{...registration,...(failing==='SESSION_PAIR'?{pid:runtime.pid}:{})};
  return Promise.resolve({query:<R extends Record<string,unknown>>(_sql:string)=>Promise.resolve({rows:[row] as unknown as R[],rowCount:1}),release:()=>undefined});
 }});
 const evidence={artifact_bindings_verified:true as const,r3c2_ready:true as const,forward_structure_ready:true as const,identity_provenance:'NATIVE_MIGRATION_LEDGER_VERIFIED' as const};
 await assert.rejects(validateDualPoolRegistrationOperationalReadiness(pool('runtime'),pool('registration'),FORWARD_REGISTRATION_CONTRACT_ID,undefined,{structure:()=>Promise.resolve(failing==='STRUCTURE_RESULT'?{...evidence,r3c2_ready:false} as unknown as typeof evidence:evidence),authority:()=>failing==='FORWARD_AUTHORITY'?Promise.reject(Error('DO_NOT_LOG')):Promise.resolve()},event=>events.push(event)));
 assert.equal(events.find(e=>e.result==='FAIL')?.subgate,failing==='SESSION_PAIR'?'DISTINCT_BACKENDS':failing);assert.doesNotMatch(JSON.stringify(events),/DO_NOT_LOG|fixture|127\.0/u);
});
test('nested full R3C2 failure is emitted before structural wrapper failure',async()=>{
 const {validateDualPoolRegistrationOperationalReadiness}=await import('../../../tools/production/registration-dual-pool.js');
 const events:{subgate:string;result:string}[]=[];
 const p:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(sql:string)=>Promise.resolve({rows:(sql===REGISTRATION_TARGET_QUERY||sql===FORWARD_REGISTRATION_IDENTITY_QUERY?[runtime]:[]) as unknown as R[],rowCount:sql===REGISTRATION_TARGET_QUERY||sql===FORWARD_REGISTRATION_IDENTITY_QUERY?1:0}),release:()=>undefined}),close:()=>Promise.resolve()};
 await assert.rejects(validateDualPoolRegistrationOperationalReadiness(p,{...p},FORWARD_REGISTRATION_CONTRACT_ID,undefined,undefined,e=>events.push(e)));
 assert.equal(events.find(e=>e.result==='FAIL')?.subgate,'FULL_R3C2');
});
test('throwing trace sink cannot alter successful operational readiness',async()=>{
 const {validateDualPoolRegistrationOperationalReadiness}=await import('../../../tools/production/registration-dual-pool.js');
 const p=(row:Record<string,unknown>):PostgreSqlPoolPort=>({connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(_sql:string)=>Promise.resolve({rows:[row] as unknown as R[],rowCount:1}),release:()=>undefined}),close:()=>Promise.resolve()});
 const result=await validateDualPoolRegistrationOperationalReadiness(p(runtime),p(registration),FORWARD_REGISTRATION_CONTRACT_ID,undefined,{structure:()=>Promise.resolve({artifact_bindings_verified:true,r3c2_ready:true,forward_structure_ready:true,identity_provenance:'NATIVE_MIGRATION_LEDGER_VERIFIED'}),authority:()=>Promise.resolve()},()=>{throw Error('DO_NOT_LOG');});
 assert.equal(result.operational_ready,true);assert.equal(result.writes,0);
});
