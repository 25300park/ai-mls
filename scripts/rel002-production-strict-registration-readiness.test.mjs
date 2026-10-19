import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runReadiness, observePool, BINDINGS, CONTRACT_ID } from './rel002-production-strict-registration-readiness.mjs';
const environment=()=>Object.fromEntries([...BINDINGS.map(k=>[k,'TEST_ONLY']),['REL002_PRODUCTION_READINESS_ONLY','YES']]);
const ready=()=>({contract_id:CONTRACT_ID,target_policy:'PRODUCTION_STRICT',identity_provenance:'NATIVE_MIGRATION_LEDGER_VERIFIED',writes:0,...Object.fromEntries(['runtime_identity_verified','registration_identity_verified','target_match','sessions_distinct','r3c2_ready','artifact_bindings_verified','forward_structure_ready','forward_authority_ready','operational_ready','identity_provenance_verified'].map(k=>[k,true]))});
function fixture({result=ready(),failure,closeFail, same=false}={}){
 const calls=[],lines=[];const pool=name=>({connect:async()=>({query:async()=>({rows:[],rowCount:0}),release(){}}),close:async()=>{calls.push(name);if(closeFail===name)throw Error('SECRET');}});
 const runtime=pool('runtime'),registration=same?runtime:pool('registration');
 const dependencies={createDependencies:env=>{calls.push('factory');assert.equal(env.DATABASE_URL,undefined);return{createRuntimePool:()=>runtime,createRegistrationPool:()=>registration};},validate:async(...args)=>{calls.push('validate');assert.equal(args.length,4);assert.equal(args[2],CONTRACT_ID);if(failure)throw Error('postgresql://SECRET');return result;}};
 return {calls,lines,execute:env=>runReadiness(env??environment(),line=>lines.push(line),dependencies)};
}
test('canonical factory, three-argument default path, safe PASS, both closes',async()=>{const f=fixture();assert.equal(await f.execute(),true);assert.deepEqual(f.calls,['factory','validate','runtime','registration']);assert.ok(f.lines.includes('PRODUCTION_STRICT_DUAL_POOL_READINESS=PASS'));assert.equal(f.lines.at(-1),'POOLS_CLOSED=true');assert.equal(f.lines.length,17);});
for(const key of BINDINGS)test(`missing ${key} fails before factory`,async()=>{const f=fixture(),env=environment();delete env[key];assert.equal(await f.execute(env),false);assert.deepEqual(f.calls,[]);});
for(const key of ['DATABASE_URL','REL002_LOCAL_DISPOSABLE','LOCAL_OWNED_DISPOSABLE'])test(`${key} rejected`,async()=>{const f=fixture();assert.equal(await f.execute({...environment(),[key]:'YES'}),false);assert.deepEqual(f.calls,[]);});
test('explicit Human marker required',async()=>{const f=fixture(),env=environment();delete env.REL002_PRODUCTION_READINESS_ONLY;assert.equal(await f.execute(env),false);assert.deepEqual(f.calls,[]);});
for(const key of Object.keys(ready()))test(`missing or invalid ${key} fails`,async()=>{for(const value of [undefined,key==='writes'?1:false]){const r=ready();r[key]=value;const f=fixture({result:r});assert.equal(await f.execute(),false);assert.ok(f.calls.includes('registration'));}});
test('historical provenance denied',async()=>{const f=fixture({result:{...ready(),identity_provenance:'HISTORICAL_MIGRATION_ATTESTATION_VERIFIED'}});assert.equal(await f.execute(),false);});
test('same physical pool denied',async()=>{const f=fixture({same:true});assert.equal(await f.execute(),false);assert.ok(!f.calls.includes('validate'));});
test('raw validator error sanitized',async()=>{const f=fixture({failure:true});assert.equal(await f.execute(),false);assert.ok(!f.lines.join('').includes('SECRET'));});
for(const name of ['runtime','registration'])test(`${name} close failure still closes other pool`,async()=>{const f=fixture({closeFail:name});assert.equal(await f.execute(),false);assert.deepEqual(f.calls.slice(-2),['runtime','registration']);assert.equal(f.lines.at(-1),'POOLS_CLOSED=false');});
test('partial construction closes first pool',async()=>{let closed=false;const lines=[];const ok=await runReadiness(environment(),x=>lines.push(x),{createDependencies:()=>({createRuntimePool:()=>({close:async()=>{closed=true;}}),createRegistrationPool:()=>{throw Error('SECRET');}})});assert.equal(ok,false);assert.equal(closed,true);});
test('observation preserves read-only transaction dispatch',async()=>{const sent=[];const p=observePool({connect:async()=>({query:async sql=>{sent.push(sql);return{rows:[]};},release(){}})}, {dispatched:0});const c=await p.connect();for(const sql of ['BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY','SELECT 1','COMMIT','SELECT 2'])await c.query(sql);assert.equal(sent.length,4);});
for(const sql of ['INSERT INTO x VALUES (1)','SET ROLE postgres','SELECT pg_advisory_xact_lock(1)','WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x','SELECT 1; DELETE FROM t'])test(`unsafe dispatch denied: ${sql}`,async()=>{let sent=false;const c=await observePool({connect:async()=>({query:async()=>{sent=true;},release(){}})},{dispatched:0}).connect();await assert.rejects(()=>c.query(sql));assert.equal(sent,false);});
test('entrypoint has no command invocation or validator injection',async()=>{const source=await readFile(new URL('./rel002-production-strict-registration-readiness.mjs',import.meta.url),'utf8');assert.ok(!/RegisterServiceWorkloadCommand|runDualPoolRegistration\(|runRegistrationOperator\(|assertRegistrationExecuteAuthorization\(/.test(source));assert.ok(source.includes('validateDualPoolRegistrationOperationalReadiness(runtime,registration,CONTRACT_ID,undefined,undefined,trace)'));});

test('readiness subgate output is allowlisted, safe and cleanup remains complete',async()=>{const lines=[];let closed=0;const pools=()=>({close:async()=>{closed++;}});await runReadiness(environment(),line=>lines.push(line),{createDependencies:()=>({createRuntimePool:pools,createRegistrationPool:pools}),validate:async(_r,_g,_id,trace)=>{trace({subgate:'DO_NOT_LOG_URI',result:'FAIL'});trace({subgate:'FULL_R3C2',result:'FAIL',category:'DO_NOT_LOG'});throw Error('DO_NOT_LOG');}});assert.equal(closed,2);assert.ok(lines.includes('READINESS_SUBGATE=FULL_R3C2'));assert.ok(lines.includes('READINESS_RESULT=FAIL'));assert.ok(lines.includes('FAIL_STAGE=READINESS'));assert.doesNotMatch(lines.join('\n'),/DO_NOT_LOG/u);});

test('Full R3C2 child output is bounded and cannot reflect injected data',async()=>{
 const lines=[];let closed=0;const pool=()=>({close:async()=>{closed++;}});
 await runReadiness(environment(),line=>lines.push(line),{createDependencies:()=>({createRuntimePool:pool,createRegistrationPool:pool}),validate:async(_r,_g,_id,trace)=>{
 trace({subgate:'FULL_R3C2',child:'PUBLICATION',result:'PASS'});
 trace({subgate:'FULL_R3C2',child:'ADMINISTRATION',result:'FAIL',category:'SECRET'});
 trace({subgate:'FULL_R3C2',child:'SECRET',result:'FAIL'});
 trace({subgate:'CONTRACT',child:'R3C1',result:'FAIL'});
 throw Error('SECRET');}});
 assert.equal(closed,2);assert.deepEqual(lines.filter(x=>x.startsWith('FULL_R3C2_CHILD=')),['FULL_R3C2_CHILD=PUBLICATION','FULL_R3C2_CHILD=ADMINISTRATION']);
 assert.ok(lines.includes('RESULT=PASS'));assert.ok(lines.includes('RESULT=FAIL'));assert.doesNotMatch(lines.join('\n'),/SECRET/u);
});

test('root requirement diagnostics allow only safe enums and SQLSTATE; query hash cannot be injected',async()=>{
 const lines=[];let closed=0;const pool=()=>({close:async()=>{closed++;}});
 await runReadiness(environment(),line=>lines.push(line),{createDependencies:()=>({createRuntimePool:pool,createRegistrationPool:pool}),validate:async(_r,_g,_id,trace)=>{
 trace({subgate:'FULL_R3C2',result:'FAIL',rootDetail:{root:'PUBLICATION',requirement:'QUERY_EXECUTION',result:'FAIL',sqlstate:'42501',querySha256:'SECRET'}});
 trace({subgate:'FULL_R3C2',result:'FAIL',rootDetail:{root:'ADVISORY',requirement:'CONSTRAINTS',result:'FAIL',sqlstate:'SECRET'}});
 trace({subgate:'FULL_R3C2',result:'FAIL',rootDetail:{root:'SECRET',requirement:'QUERY_EXECUTION',result:'FAIL'}});
 throw Error('SECRET');}});
 assert.equal(closed,2);assert.ok(lines.includes('FULL_R3C2_ROOT=PUBLICATION'));assert.ok(lines.includes('ROOT_REQUIREMENT=QUERY_EXECUTION'));assert.ok(lines.includes('SQLSTATE=42501'));assert.ok(lines.includes('SQLSTATE=null'));assert.ok(lines.includes('QUERY_SHA256=null'));assert.doesNotMatch(lines.join('\n'),/SECRET/u);
});
