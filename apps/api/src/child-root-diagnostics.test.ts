import assert from 'node:assert/strict';
import test from 'node:test';
import type { PostgreSqlPoolPort } from '../../../modules/identity/src/postgresql-pool.js';
import { evaluateContracts,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from './child-root-postgresql-readiness.js';
import { childRootFailure,reportChildRoot } from './child-root-diagnostics.js';
import type {ChildRootDiagnostic} from './child-root-diagnostics.js';
function fixture(rows:readonly Record<string,unknown>[],error?:Error,releaseError=false){let released=0;const pool:PostgreSqlPoolPort={close:()=>Promise.resolve(),connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>()=>error?Promise.reject(error):Promise.resolve({rows:rows as R[],rowCount:rows.length}),release:()=>{released++;if(releaseError)throw Error('PRIVATE');}})};return {pool,released:()=>released};}
for(const [code,expected] of [['42501','42501'],['PRIVATE',null]])test('shared query failure preserves safe SQLSTATE '+String(expected),async()=>{
 const f=fixture([],Object.assign(Error('PRIVATE_URI'),{code})),events:ChildRootDiagnostic[]=[];
 assert.equal((await evaluateContracts(f.pool,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS,e=>events.push(e))).status,'NOT_READY');
 assert.equal(events.length,5);assert.ok(events.every(e=>e.requirement==='QUERY_EXECUTION'&&e.result==='FAIL'&&e.sqlstate===expected&&e.querySha256===null));assert.equal(f.released(),1);assert.doesNotMatch(JSON.stringify(events),/PRIVATE/u);
});
test('single compatibility rejection explains shared unavailability without inventing five independent failures',async()=>{
 const f=fixture([],childRootFailure('ADVISORY','CONSTRAINTS')),events:ChildRootDiagnostic[]=[];
 const result=await evaluateContracts(f.pool,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS,e=>events.push(e));
 assert.equal(result.children.filter(c=>c.status==='FAIL').length,5);assert.equal(events.length,1);assert.equal(events[0]?.root,'ADVISORY');assert.equal(events[0]?.requirement,'CONSTRAINTS');
});
test('zero rows separate successful execution from root cardinality',async()=>{
 const f=fixture([]),events:ChildRootDiagnostic[]=[];await evaluateContracts(f.pool,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS,e=>events.push(e));
 assert.equal(events.filter(e=>e.requirement==='QUERY_EXECUTION'&&e.result==='PASS').length,5);assert.equal(events.filter(e=>e.requirement==='ROOT_CARDINALITY'&&e.result==='FAIL').length,5);
});
test('observer cannot alter failure or cleanup; release failure is separately reported',async()=>{
 const f=fixture([],undefined,true),events:ChildRootDiagnostic[]=[];assert.equal((await evaluateContracts(f.pool,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS,e=>events.push(e))).status,'NOT_READY');assert.equal(events.filter(e=>e.requirement==='CONNECTION_RELEASE').length,5);
 assert.equal((await evaluateContracts(f.pool,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS,()=>{throw Error('PRIVATE');})).status,'NOT_READY');assert.equal(f.released(),2);
});
test('safe reporter never reflects arbitrary SQLSTATE or error text',()=>{const events:ChildRootDiagnostic[]=[];reportChildRoot(e=>events.push(e),'PUBLICATION','QUERY_EXECUTION','FAIL',{code:'SECRET',message:'SECRET'});assert.doesNotMatch(JSON.stringify(events),/SECRET/u);});

test('individual contract diagnostics distinguish artifact, fingerprint and authority without changing readiness',async()=>{
 const c=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[0]!;
 const row:Record<string,unknown>={schema_name:c.schemaName,artifact_sha256:c.artifactSha256,table_count:c.tableCount,schema_comment:c.schemaComment,columns_hash:c.columnsHash,constraints_hash:c.constraintsHash,indexes_hash:c.indexesHash,runtime_acl_hash:c.runtimeAclHash,trigger_hash:c.triggerHash,function_hash:c.functionHash,effective_acl_hash:c.effectiveAclHash,runtime_usage:true,runtime_create:false,owner_name:'ai_mls_production_migration_operator',unexpected_role_membership:false};
 for(const key of ['public_acl_count','runtime_grant_option_count','table_owner_violation_count','function_owner_violation_count','table_acl_violation_count','unexpected_runtime_membership_count','public_schema_acl_count','schema_grant_option_count','function_acl_violation_count','sequence_count'])row[key]=0;
 for(const [key,requirement] of [['artifact_sha256','ARTIFACT_BINDING'],['columns_hash','COLUMNS'],['runtime_usage','AUTHORITY_CONTRACT']] as const){
  const f=fixture([{...row,[key]:'PRIVATE'}]),events:ChildRootDiagnostic[]=[];
  assert.equal((await evaluateContracts(f.pool,[c],e=>events.push(e))).status,'NOT_READY');
  assert.deepEqual(events.filter(e=>e.result==='FAIL').map(e=>e.requirement),[requirement]);
 }
 const events:ChildRootDiagnostic[]=[];assert.equal((await evaluateContracts(fixture([row]).pool,[c],e=>events.push(e))).status,'READY');assert.ok(events.every(e=>e.result==='PASS'));assert.doesNotMatch(JSON.stringify(events),/PRIVATE|schema_name|columns_hash/u);
});
