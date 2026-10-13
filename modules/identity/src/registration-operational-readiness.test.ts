import assert from 'node:assert/strict';
import test from 'node:test';
import * as readiness from '../../../tools/production/registration-dual-pool.js';
import type { PostgreSqlPoolPort } from './postgresql-pool.js';
import { FORWARD_REGISTRATION_CONTRACT_ID, type ForwardRegistrationStructureEvidence } from '../../../apps/api/src/forward-registration-readiness.js';

test('separate readiness-only API is exported',()=>{
 assert.equal(typeof Reflect.get(readiness,'validateDualPoolRegistrationOperationalReadiness'),'function');
});

const runtimeRow={current_user:'ai_mls_production_runtime',session_user:'ai_mls_production_runtime',database:'postgres',server_version_num:'170011',address:'127.0.0.1',port:5432,database_oid:5,cluster_started:'owned',pid:101,tls:true};
const registrationRow={...runtimeRow,current_user:'ai_mls_production_registration_operator',session_user:'ai_mls_production_registration_operator',pid:102};
function fixture(change:Record<string,unknown>={}){
 const queries:string[]=[],events:string[]=[];
 const pool=(kind:'runtime'|'registration'):PostgreSqlPoolPort=>({
  close:async()=>{await Promise.resolve();events.push('close:'+kind);if(change['close']===kind)throw Error('driver-secret');},
  connect:async()=>{await Promise.resolve();events.push('connect:'+kind);return{
   release(){events.push('release:'+kind);},
   query:async<Row extends Record<string,unknown>>(sql:string)=>{
    await Promise.resolve();queries.push(sql);
    assert.equal(sql,readiness.REGISTRATION_TARGET_QUERY);
    if(change['queryFail']===kind)throw Error('driver-secret');
    const row={...(kind==='runtime'?runtimeRow:registrationRow),...(change[kind] as Record<string,unknown>)};
    return {rows:[row as unknown as Row],rowCount:1};
   },
  };},
 });
 const runtime=pool('runtime'),registration=change['samePool']?runtime:pool('registration');
 const validators={
  structure:async(_pool:PostgreSqlPoolPort,id:unknown):Promise<ForwardRegistrationStructureEvidence>=>{
   await Promise.resolve();events.push('structure');assert.equal(id,FORWARD_REGISTRATION_CONTRACT_ID);
   if(change['structureFailure'])throw Error('unavailable');
   return {artifact_bindings_verified:true,r3c2_ready:true,identity_provenance:'NATIVE_MIGRATION_LEDGER_VERIFIED',forward_structure_ready:true,...change['receipt'] as Partial<ForwardRegistrationStructureEvidence>};
  },
  authority:async():Promise<void>=>{await Promise.resolve();events.push('authority');if(change['authorityFailure'])throw Error('unavailable');},
 };
 return {runtime,registration,validators,queries,events};
}
test('readiness returns evidence only, borrows pools and performs no command operations',async()=>{
 const f=fixture();const result=await readiness.validateDualPoolRegistrationOperationalReadiness(f.runtime,f.registration,FORWARD_REGISTRATION_CONTRACT_ID,undefined,f.validators);
 assert.equal(result.operational_ready,true);assert.equal(result.writes,0);assert.equal(result.target_policy,'PRODUCTION_STRICT');
 assert.ok(Object.isFrozen(result));assert.equal(f.queries.length,2);
 assert.deepEqual(f.events,['connect:runtime','release:runtime','structure','connect:registration','authority','release:registration']);
 assert.ok(!Object.hasOwn(result,'authorizeExecute')&&!Object.hasOwn(result,'token'));
});
for(const change of [{samePool:true},{runtime:{current_user:'postgres'}},{runtime:{session_user:'postgres'}},{registration:{current_user:'ai_mls_production_runtime'}},{registration:{session_user:'postgres'}},{registration:{pid:101}},{registration:{database_oid:6}},{runtime:{port:55467}},{runtime:{tls:false}},{queryFail:'runtime'},{queryFail:'registration'},{structureFailure:true},{authorityFailure:true},
 {receipt:{r3c2_ready:false}},{receipt:{artifact_bindings_verified:false}},{receipt:{identity_provenance:'UNAVAILABLE'}},{receipt:{forward_structure_ready:false}}])test(`readiness failure preserves release ${JSON.stringify(change)}`,async()=>{
 const f=fixture(change);await assert.rejects(readiness.validateDualPoolRegistrationOperationalReadiness(f.runtime,f.registration,FORWARD_REGISTRATION_CONTRACT_ID,undefined,f.validators));
 for(const kind of ['runtime','registration'])if(f.events.includes('connect:'+kind))assert.ok(f.events.includes('release:'+kind));
 assert.ok(f.queries.every(sql=>sql===readiness.REGISTRATION_TARGET_QUERY));
});
test('unknown contract and implicit or unknown policy fail before pool access',async()=>{
 const f=fixture();await assert.rejects(readiness.validateDualPoolRegistrationOperationalReadiness(f.runtime,f.registration,'unknown'));
 await assert.rejects(readiness.validateDualPoolRegistrationOperationalReadiness(f.runtime,f.registration,FORWARD_REGISTRATION_CONTRACT_ID,{} as readiness.RegistrationReadinessTargetPolicy));
 assert.deepEqual(f.events,[]);
});
test('readiness defaults use real forward validators and fail closed on incomplete catalog',async()=>{
 const f=fixture();await assert.rejects(readiness.validateDualPoolRegistrationOperationalReadiness(f.runtime,f.registration,FORWARD_REGISTRATION_CONTRACT_ID));
 assert.ok(!f.events.includes('connect:registration'));
});
test('readiness never exposes original driver details',async()=>{
 const f=fixture({queryFail:'runtime'});
 await assert.rejects(readiness.validateDualPoolRegistrationOperationalReadiness(f.runtime,f.registration,FORWARD_REGISTRATION_CONTRACT_ID,undefined,f.validators),error=>error instanceof Error&&!error.message.includes('driver-secret')&&error.message==='Registration command: UNAVAILABLE');
});
for(const close of ['runtime','registration'])test(`outer owner attempts both pool closures despite ${close} failure`,async()=>{
 const f=fixture({close});await assert.rejects(readiness.closeRegistrationReadinessPools(f.runtime,f.registration));
 assert.deepEqual(f.events,['close:runtime','close:registration']);
});
