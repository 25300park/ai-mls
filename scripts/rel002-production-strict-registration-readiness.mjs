// Human-invoked readiness only. Importing this module never opens a connection.
import { pathToFileURL } from 'node:url';
import { createReadOnlyStatementPolicy } from './rel002-read-only-statement-policy.mjs';
export const CONTRACT_ID='REL002-REGISTRATION-POST-IDENTITY014-AUDIT002-V1';
export const BINDINGS=Object.freeze(['AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1']);
// AO REL002 policy amendment: preserve the actual verified provenance class.
const acceptedProvenance=new Set(['NATIVE_MIGRATION_LEDGER_VERIFIED','HISTORICAL_MIGRATION_ATTESTATION_VERIFIED']);
const flags=['runtime_identity_verified','registration_identity_verified','target_match','sessions_distinct','r3c2_ready','artifact_bindings_verified','forward_structure_ready','forward_authority_ready','operational_ready','identity_provenance_verified'];
const passLines=provenance=>['PRODUCTION_STRICT_DUAL_POOL_READINESS=PASS','TARGET_POLICY=PRODUCTION_STRICT','RUNTIME_IDENTITY_VERIFIED=true','REGISTRATION_IDENTITY_VERIFIED=true','TARGET_MATCH=true','SESSIONS_DISTINCT=true','FULL_R3C2=true','IDENTITY_PROVENANCE='+provenance,'ARTIFACT_BINDINGS_VERIFIED=true','FORWARD_STRUCTURE_READY=true','FORWARD_AUTHORITY_READY=true','OPERATIONAL_READY=true','WRITES=0','POOLS_CLOSED=true'];
export function observePool(pool,observation){
 return {close:()=>pool.close(),connect:async()=>{
  const client=await pool.connect(),policy=createReadOnlyStatementPolicy();
  return {release:destroy=>client.release(destroy||policy.state!=='IDLE'),query:async(sql,values)=>{
   policy.accept(sql);observation.dispatched++;
   try{return await client.query(sql,values);}catch(error){policy.fail();throw error;}
  }};
 }};
}
async function canonicalDependencies(){
 // These modules also export command APIs; no command API is called here.
 const [{createRegistrationRunnerDependencies},{validateDualPoolRegistrationOperationalReadiness}]=await Promise.all([
  import('../dist/tools/production/register-service-workload.js'),import('../dist/tools/production/registration-dual-pool.js')]);
 return {createDependencies:createRegistrationRunnerDependencies,validate:(runtime,registration,_contract,trace)=>validateDualPoolRegistrationOperationalReadiness(runtime,registration,CONTRACT_ID,undefined,undefined,trace)};
}
// Test dependencies are available only through this imported function, never CLI input.
export async function runReadiness(environment,output,testDependencies){
 let stage='CONFIGURATION',failed=false,closed=true,verifiedProvenance;const pools=[];
 const allowedSubgates=new Set(['CONTRACT','POOL_SEPARATION_POLICY','RUNTIME_SESSION','FORWARD_STRUCTURE','RUNTIME_STRUCTURE_IDENTITY','FULL_R3C2','IDENTITY_BASE_PROVENANCE','STRUCTURE_RESULT','REGISTRATION_SESSION','SESSION_PAIR','FORWARD_AUTHORITY','OPERATIONAL_RESULT','VERIFIED_PROVENANCE','RUNTIME_SESSION_RECHECK','REGISTRATION_IDENTITY','SESSION_PAIR_IDENTITIES','DISTINCT_BACKENDS','SAME_TARGET','REGISTRATION_AUTHORITY_IDENTITY','REGISTRATION_AUTHORITY_CATALOG']);
 const allowedChildren=new Set(['RUNTIME_ACCESS','PUBLICATION','ADMINISTRATION','CONNECTOR','EXTERNAL_INTEGRATION','ADVISORY','IDENTITY_BASE_PROVENANCE','R3C1_R3C2B_TRANSACTION','R3C1','R3C2B','R3C2C']);
 const allowedRoots=new Set(['PUBLICATION','ADMINISTRATION','CONNECTOR','EXTERNAL_INTEGRATION','ADVISORY']);
 const allowedRequirements=new Set(['QUERY_EXECUTION','ROOT_CARDINALITY','SERVER_VERSION','INVENTORY','ARTIFACT_BINDING','SCHEMA_COMMENT','COLUMNS','CONSTRAINTS','INDEXES','RUNTIME_ACL','TRIGGERS','FUNCTIONS','EFFECTIVE_ACL','AUTHORITY_CONTRACT','CONNECTION_RELEASE']);
 const trace=event=>{try{if(!event||!allowedSubgates.has(event.subgate)||!['PASS','FAIL'].includes(event.result))return;if(event.rootDetail!==undefined){const d=event.rootDetail;if(event.subgate!=='FULL_R3C2'||!d||!allowedRoots.has(d.root)||!allowedRequirements.has(d.requirement)||!['PASS','FAIL'].includes(d.result))return;output('FULL_R3C2_ROOT='+d.root);output('ROOT_REQUIREMENT='+d.requirement);output('RESULT='+d.result);output('FAILURE_CATEGORY='+(d.result==='PASS'?'NONE':'OPERATION_REJECTED'));output('SQLSTATE='+(['42501','42704','42P01','42883','25006','57014','08006','08003'].includes(d.sqlstate)?d.sqlstate:'null'));output('QUERY_SHA256=null');return;}if(event.child!==undefined){if(event.subgate!=='FULL_R3C2'||!allowedChildren.has(event.child))return;output('FULL_R3C2_CHILD='+event.child);output('RESULT='+event.result);output('FAILURE_CATEGORY='+(event.result==='PASS'?'NONE':'OPERATION_REJECTED'));return;}output('READINESS_SUBGATE='+event.subgate);output('READINESS_RESULT='+event.result);output('FAILURE_CATEGORY='+(event.result==='PASS'?'NONE':'OPERATION_REJECTED'));}catch{/* diagnostics never change decisions */}};
 try{
  if(environment.REL002_PRODUCTION_READINESS_ONLY!=='YES'||environment.DATABASE_URL!==undefined
   ||environment.REL002_LOCAL_DISPOSABLE!==undefined||environment.LOCAL_OWNED_DISPOSABLE!==undefined
   ||environment.REL002_REGISTRATION_DISPOSABLE!==undefined||environment.REL002_TARGET_POLICY!==undefined
   ||BINDINGS.some(key=>typeof environment[key]!=='string'||!environment[key].trim()))throw Error();
  const dependencies=testDependencies??await canonicalDependencies();
  const factories=dependencies.createDependencies(environment);
  stage='POOL_CREATION';
  const physicalRuntime=factories.createRuntimePool();pools.push(physicalRuntime);
  const physicalRegistration=factories.createRegistrationPool();pools.push(physicalRegistration);
  if(!physicalRuntime||!physicalRegistration||physicalRuntime===physicalRegistration)throw Error();
  const observation={dispatched:0};
  const runtime=observePool(physicalRuntime,observation),registration=observePool(physicalRegistration,observation);
  stage='READINESS';
  const result=await dependencies.validate(runtime,registration,CONTRACT_ID,trace);
  stage='RESULT_ASSERTIONS';
  trace({subgate:'VERIFIED_PROVENANCE',result:acceptedProvenance.has(result?.identity_provenance)?'PASS':'FAIL'});
  if(!result||result.contract_id!==CONTRACT_ID||result.target_policy!=='PRODUCTION_STRICT'
   ||!acceptedProvenance.has(result.identity_provenance)||result.writes!==0
   ||flags.some(key=>result[key]!==true))throw Error();
  verifiedProvenance=result.identity_provenance;
 }catch{failed=true;}
 finally{
  const outcomes=await Promise.allSettled([...new Set(pools)].map(async pool=>pool.close()));
  closed=outcomes.every(outcome=>outcome.status==='fulfilled');
  if(!closed){failed=true;stage='POOL_CLEANUP';}
 }
 if(failed){for(const line of ['PRODUCTION_STRICT_DUAL_POOL_READINESS=FAIL',`FAIL_STAGE=${stage}`,'FAIL_CODE=READINESS_UNAVAILABLE',`POOLS_CLOSED=${closed}`])output(line);}
 else for(const line of passLines(verifiedProvenance))output(line);
 return !failed;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){console.log('PRODUCTION_STRICT_DUAL_POOL_READINESS=FAIL\nFAIL_STAGE=INVOCATION\nFAIL_CODE=READINESS_UNAVAILABLE\nPOOLS_CLOSED=true');process.exitCode=1;}
 else if(!await runReadiness(process.env,line=>console.log(line)))process.exitCode=1;
}
