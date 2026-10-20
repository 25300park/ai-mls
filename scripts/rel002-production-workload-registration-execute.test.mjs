import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runOneShotRegistration,MANIFEST_PATH} from './rel002-production-workload-registration-execute.mjs';
import {runDualPoolRegistration,REGISTRATION_TARGET_QUERY} from '../dist/tools/production/registration-dual-pool.js';

const bytes=await readFile(new URL('../docs/implementation/REL002_R3G1B4_PRODUCTION_WORKLOAD_REGISTRATION_MANIFEST.json',import.meta.url));
const manifest=JSON.parse(bytes);
const environment=()=>({REL002_REGISTRATION_HUMAN_AUTHORIZED:'YES',REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED:'YES'});
function fixture(overrides={}){
 let calls=0,created=0;const checkpoints=[];
 const deps={readManifest:async path=>{assert.equal(path,MANIFEST_PATH);return bytes;},createDependencies:()=>{created++;return {};},
  run:async(args,env,output,dependencies)=>{
   calls++;assert.deepEqual(args,['--execute','--manifest',MANIFEST_PATH]);
   for(let index=0;index<2;index++){
    const receipt=await dependencies.authorizeExecute(structuredClone(manifest));
    checkpoints.push(receipt.checkpoint);assert.equal(receipt.humanAuthorized,true);assert.equal(receipt.quiescentWindowConfirmed,true);
   }
   output('SAFE_CANONICAL_RESULT');
  },...overrides};
 return {deps,checkpoints,get calls(){return calls;},get created(){return created;}};
}
test('exact pinned composition authorizes only the two named checkpoints',async()=>{
 const f=fixture(),lines=[];await runOneShotRegistration(environment(),line=>lines.push(line),f.deps);
 assert.deepEqual(f.checkpoints,['BEFORE_POOLS','IN_TRANSACTION_BEFORE_INSPECTION']);assert.deepEqual(lines,['SAFE_CANONICAL_RESULT']);assert.equal(f.calls,1);
});
for(const field of Object.keys(environment()))for(const value of [undefined,'','NO','yes'])test('reject '+field+' '+String(value)+' before runner',async()=>{
 const f=fixture();await assert.rejects(runOneShotRegistration({...environment(),[field]:value},()=>{},f.deps));assert.equal(f.calls,0);assert.equal(f.created,0);
});
test('changed manifest bytes fail before canonical dependency creation',async()=>{
 const f=fixture({readManifest:async()=>Buffer.concat([bytes,Buffer.from(' ')])});await assert.rejects(runOneShotRegistration(environment(),()=>{},f.deps));assert.equal(f.created,0);
});
for(const change of [{registrationId:'other'},{registrationVersion:2},{tenantId:'other'},{purpose:'other'},{extra:true}])test('callback rejects complete tuple drift '+JSON.stringify(change),async()=>{
 const f=fixture({run:async(_a,_e,_o,d)=>{await d.authorizeExecute({...manifest,...change});}});await assert.rejects(runOneShotRegistration(environment(),()=>{},f.deps));
});
test('third callback is denied',async()=>{
 const f=fixture({run:async(_a,_e,_o,d)=>{for(let i=0;i<3;i++)await d.authorizeExecute(manifest);}});await assert.rejects(runOneShotRegistration(environment(),()=>{},f.deps));
});
test('second checkpoint rechecks Human confirmation',async()=>{
 const env=environment();const f=fixture({run:async(_a,_e,_o,d)=>{await d.authorizeExecute(manifest);env.REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED='NO';await d.authorizeExecute(manifest);}});
 await assert.rejects(runOneShotRegistration(env,()=>{},f.deps));
});
test('second checkpoint rechecks manifest file hash',async()=>{
 let reads=0;const f=fixture({readManifest:async()=>++reads===3?Buffer.from('{}'):bytes});await assert.rejects(runOneShotRegistration(environment(),()=>{},f.deps));
});
test('missing second checkpoint cannot report success',async()=>{
 const lines=[];const f=fixture({run:async(_a,_e,o,d)=>{await d.authorizeExecute(manifest);o('EARLY_SUCCESS');}});
 await assert.rejects(runOneShotRegistration(environment(),line=>lines.push(line),f.deps));assert.deepEqual(lines,[]);
});
test('failure output never forwards raw errors or premature result',async()=>{
 const lines=[];const f=fixture({run:async(_a,_e,o)=>{o('SECRET');throw Error('PRIVATE_URI');}});
 await assert.rejects(runOneShotRegistration(environment(),line=>lines.push(line),f.deps),error=>error.message==='REL002_EXECUTION_UNAVAILABLE_INSPECT_DURABLE_STATE_BEFORE_RETRY');assert.deepEqual(lines,[]);
});
for(const key of ['DATABASE_URL','REL002_TARGET_POLICY','REL002_LOCAL_DISPOSABLE'])test('reject override '+key,async()=>{
 const f=fixture();await assert.rejects(runOneShotRegistration({...environment(),[key]:'PRIVATE'},()=>{},f.deps));assert.equal(f.calls,0);
});
test('real dual-pool call sites recheck authorization inside transaction and roll back before inspection',async()=>{
 const env=environment(),events=[];
 const identity={database:'postgres',server_version_num:'170011',address:'fixture',port:5432,database_oid:5,cluster_started:'fixture',tls:true};
 const pool=kind=>({
  close:async()=>{events.push('close:'+kind);},
  connect:async()=>({release:()=>{events.push('release:'+kind);},query:async sql=>{
   events.push(sql);const role=kind==='runtime'?'ai_mls_production_runtime':'ai_mls_production_registration_operator';
   let rows=[];
   if(sql===REGISTRATION_TARGET_QUERY||sql==='SELECT current_user,session_user,current_database() AS database')rows=[{...identity,current_user:role,session_user:role,pid:kind==='runtime'?101:102}];
   else if(sql.includes('has_schema_privilege'))rows=[{use:true,create:false}];
   else if(sql.includes('has_table_privilege'))rows=[{read:true,insert:true,forbidden:false}];
   if(sql.startsWith('SELECT pg_advisory_xact_lock'))env.REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED='NO';
   return {rows,rowCount:rows.length};
  }}),
 });
 const f=fixture({createDependencies:()=>({
  createRuntimePool:()=>{events.push('create:runtime');return pool('runtime');},createRegistrationPool:()=>pool('registration'),
  validateRuntimeStructure:async()=>{},validateRegistrationAuthority:async()=>{},
 }),run:async(_a,_e,_o,deps)=>{await runDualPoolRegistration(manifest,'EXECUTE',deps);}});
 await assert.rejects(runOneShotRegistration(env,()=>{},f.deps));
 assert.ok(events.includes('BEGIN'));assert.ok(events.includes('ROLLBACK'));assert.ok(!events.some(sql=>sql.startsWith('INSERT')||sql.startsWith('SELECT registration_id')));
 assert.ok(events.includes('close:runtime'));assert.ok(events.includes('close:registration'));
});
test('real dual-pool first callback rejects before pool creation when scope is wrong',async()=>{
 let pools=0;const f=fixture({createDependencies:()=>({createRuntimePool:()=>{pools++;throw Error();}}),run:async(_a,_e,_o,deps)=>{
  await runDualPoolRegistration({...manifest,registrationVersion:2,scopeRef:manifest.scopeRef.replace(/:1$/,':2')},'EXECUTE',deps);
 }});
 await assert.rejects(runOneShotRegistration(environment(),()=>{},f.deps));assert.equal(pools,0);
});
