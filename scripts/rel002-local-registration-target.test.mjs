import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDisposableEnvironment, assertLocalRegistrationTarget, createOwnedRegistrationCapability, createOwnedRegistrationTargetPolicy, revokeOwnedRegistrationCapability, OWNED_REGISTRATION_CLUSTER_QUERY } from './rel002-local-registration-target.mjs';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertIndependentRegistrationTargets, validateDualPoolRegistrationOperationalReadiness, REGISTRATION_TARGET_QUERY } from '../dist/tools/production/registration-dual-pool.js';
import { FORWARD_REGISTRATION_CONTRACT_ID } from '../dist/apps/api/src/forward-registration-readiness.js';

test('local target accepts only explicit owned loopback identity',()=>{
 const expected={port:55467,major:17,database_oid:5,cluster_started:'owned',tls:false};
 const row={current_user:'ai_mls_production_runtime',session_user:'ai_mls_production_runtime',database:'postgres',server_version_num:'170011',address:'127.0.0.1/32',port:55467,database_oid:5,cluster_started:'owned',pid:1,tls:false};
 assert.doesNotThrow(()=>assertLocalRegistrationTarget(row,'ai_mls_production_runtime',expected));
 for(const change of [{address:'127.0.0.2'},{address:'0.0.0.0'},{address:'external'},{port:5432},{port:55468},{database:'other'},{server_version_num:'180004'},{cluster_started:'stale'},{tls:true},{session_user:'postgres'}])assert.throws(()=>assertLocalRegistrationTarget({...row,...change},'ai_mls_production_runtime',expected));
});
test('owned capability verifies control metadata, expires, and never selects Production policy',async t=>{
 const evidenceDirectory=await mkdtemp(join(tmpdir(),'rel002-registration-'));
 const dataDirectory=join(evidenceDirectory,'cluster');await mkdir(dataDirectory);
 const runId=evidenceDirectory.split(/[\\/]/).at(-1).slice('rel002-registration-'.length);
 const receipt={created:true,optIn:'CONFIRMED',host:'127.0.0.1',runId,evidenceDirectory,dataDirectory,port:55467,major:17,tls:false};
 const control={current_user:'postgres',session_user:'postgres',database:'postgres',data_directory:dataDirectory,server_version_num:'170011',address:'127.0.0.1/32',port:55467,database_oid:5,cluster_started:'owned'};
 const client={query:async sql=>{assert.equal(sql,OWNED_REGISTRATION_CLUSTER_QUERY);return{rows:[{...control}]};}};
 try{
  for(const change of [{created:false},{optIn:'NO'},{host:'localhost'},{port:5432},{major:19},{dataDirectory:join(evidenceDirectory,'other')},{tls:true}])await t.test(`creation rejects ${JSON.stringify(change)}`,async()=>assert.rejects(createOwnedRegistrationCapability({...receipt,...change},client,{})));
  await t.test('wrong administrative data_directory rejected',async()=>{
   const old=control.data_directory;control.data_directory=join(evidenceDirectory,'other');
   try{await assert.rejects(createOwnedRegistrationCapability(receipt,client,{}));}finally{control.data_directory=old;}
  });
  await assert.rejects(createOwnedRegistrationCapability(receipt,client,{PGHOST:''}));
  assert.throws(()=>createOwnedRegistrationTargetPolicy({}));assert.throws(()=>createOwnedRegistrationTargetPolicy(undefined));
  const capability=await createOwnedRegistrationCapability(receipt,client,{}),policy=createOwnedRegistrationTargetPolicy(capability);
  const runtime={current_user:'ai_mls_production_runtime',session_user:'ai_mls_production_runtime',database:'postgres',server_version_num:'170011',address:'127.0.0.1',port:55467,database_oid:5,cluster_started:'owned',pid:1,tls:false};
  const registration={...runtime,current_user:'ai_mls_production_registration_operator',session_user:'ai_mls_production_registration_operator',pid:2,address:'127.0.0.1/32'};
  await policy.validateRuntime(runtime);await policy.validatePair(runtime,registration);
  assert.throws(()=>assertIndependentRegistrationTargets(runtime,registration,capability));
  for(const change of [{pid:1},{address:'external'},{port:5432},{session_user:'postgres'}])await assert.rejects(policy.validatePair(runtime,{...registration,...change}));
  for(const key of ['cluster_started','database_oid','port']){
   const old=control[key];control[key]=key==='cluster_started'?'changed':999;
   try{await assert.rejects(policy.validateRuntime(runtime));}finally{control[key]=old;}
  }
  const queries=[];let releases=0;
  const pool=row=>({connect:async()=>({release(){releases++;},query:async sql=>{queries.push(sql);assert.equal(sql,REGISTRATION_TARGET_QUERY);return{rows:[row],rowCount:1};}}),close:async()=>{throw Error('borrowed pools must not close');}});
  const validators={structure:async()=>({artifact_bindings_verified:true,r3c2_ready:true,identity_provenance:'NATIVE_MIGRATION_LEDGER_VERIFIED',forward_structure_ready:true}),authority:async()=>{}};
  const result=await validateDualPoolRegistrationOperationalReadiness(pool(runtime),pool(registration),FORWARD_REGISTRATION_CONTRACT_ID,policy,validators);
  assert.equal(result.target_policy,'LOCAL_OWNED_DISPOSABLE');assert.equal(result.writes,0);assert.equal(releases,2);assert.equal(queries.length,2);
  revokeOwnedRegistrationCapability(capability);await assert.rejects(policy.validateRuntime(runtime));
 }finally{await rm(evidenceDirectory,{recursive:true,force:true});}
});
test('readiness source excludes command/manifest/lock/authorizer and Production imports no local module',async()=>{
 const source=await readFile('tools/production/registration-dual-pool.ts','utf8');
 const body=source.slice(source.indexOf('export async function validateDualPoolRegistrationOperationalReadiness('),source.indexOf('/** Outer readiness harness'));
 assert.ok(!/RegisterServiceWorkloadCommand|parseRegistrationManifest|advisory|authorizeExecute|\.run\(/.test(body));
 for(const path of ['tools/production/registration-dual-pool.ts','tools/production/register-service-workload.ts'])assert.ok(!(await readFile(path,'utf8')).includes('rel002-local-registration-target'));
});
test('local environment denies production and inherited PG configuration',()=>{
 assert.doesNotThrow(()=>assertDisposableEnvironment({PATH:'local'}));
 for(const key of ['DATABASE_URL','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGSSLMODE','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1'])assert.throws(()=>assertDisposableEnvironment({[key]:''}));
});
