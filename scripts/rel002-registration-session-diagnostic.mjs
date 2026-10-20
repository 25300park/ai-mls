// Human-invoked isolated connection probe; importing never connects.
import {pathToFileURL} from 'node:url';
import {classifyPhysicalConnectionFailure} from '../dist/apps/api/src/production-connection-diagnostics.js';
export async function runSessionDiagnostic(environment,output,injected){
 let configField='NONE',configState='NONE';
 let pool,client,first='CONFIGURATION',classification={sqlstate:null,transportCode:'UNKNOWN_CONNECTION_FAILURE'},ok=false;
 const emit=line=>{try{output(line);}catch{/* observation has no authority */}};
 try{
  for(const key of ['REL002_PRODUCTION_READINESS_ONLY','REL002_REGISTRATION_SESSION_DIAGNOSTIC']){
   if(environment[key]!=='YES'){configField=key;configState=environment[key]===undefined?'MISSING':environment[key]===''?'BLANK':'MISMATCH';throw Error();}
  }
  for(const key of ['DATABASE_URL','REL002_LOCAL_DISPOSABLE','LOCAL_OWNED_DISPOSABLE','REL002_REGISTRATION_DISPOSABLE','REL002_TARGET_POLICY']){
   if(environment[key]!==undefined){configField=key;configState='INVALID';throw Error();}
  }
  configField='CANONICAL_BUILT_MODULES';configState='OTHER';
  const deps=injected??await canonicalDependencies();
  configField='CANONICAL_CONFIGURATION';configState='INVALID';
  deps.validateConfiguration(environment);
  configField='NONE';configState='NONE';
  const factory=config=>{
   const physical=deps.createPhysicalPool(config);
   return {end:()=>physical.end(),connect:async()=>{
    try{return await physical.connect();}catch(error){classification=classifyPhysicalConnectionFailure(error);throw error;}
   }};
  };
  first='REGISTRATION_PHYSICAL_CONNECTION';
  pool=deps.openPool(environment,factory);
  client=await pool.connect();emit('REGISTRATION_PHYSICAL_CONNECTION=PASS');
  first='REGISTRATION_SESSION_QUERY';
  const result=await client.query(deps.targetQuery);
  const row=result.rowCount===1&&result.rows.length===1?result.rows[0]:undefined;
  if(!row)throw Error();
  const checks=[['REGISTRATION_CURRENT_USER',row.current_user==='ai_mls_production_registration_operator'],['REGISTRATION_SESSION_USER',row.session_user==='ai_mls_production_registration_operator'],['REGISTRATION_DATABASE',row.database==='postgres'],['REGISTRATION_TLS',row.tls===true],['REGISTRATION_PORT',row.port===5432]];
  for(const [name,pass]of checks){emit(name+'='+(pass?'PASS':'FAIL'));if(!pass&&first==='REGISTRATION_SESSION_QUERY')first=name;}
  ok=checks.every(([,pass])=>pass);if(ok)first='NONE';
 }catch{if(first==='REGISTRATION_PHYSICAL_CONNECTION')emit('REGISTRATION_PHYSICAL_CONNECTION=FAIL');}
 finally{
  try{client?.release();}catch{ok=false;first='CLIENT_RELEASE';}
  try{await pool?.close();}catch{ok=false;first='POOL_CLOSE';}
 }
 emit('CONFIGURATION_FIELD='+configField);emit('CONFIGURATION_STATE='+configState);
 const diagnosticStage=first==='CONFIGURATION'?'CONFIGURATION':first==='REGISTRATION_PHYSICAL_CONNECTION'?'CONNECTION_ACQUISITION':first==='NONE'?'COMPLETE':'SESSION_IDENTITY';
 emit('DIAGNOSTIC_STAGE='+diagnosticStage);
 emit('SQLSTATE='+classification.sqlstate);emit('TRANSPORT_CODE='+(first==='REGISTRATION_PHYSICAL_CONNECTION'?classification.transportCode:'NOT_APPLICABLE'));
 emit('RUNTIME_REGISTRATION_SAME_TARGET=NOT_CHECKED');emit('RUNTIME_REGISTRATION_DISTINCT_BACKEND=NOT_CHECKED');emit('REGISTRATION_AUTHORITY_CHECK=NOT_CHECKED');
 emit('FIRST_FAILING_REGISTRATION_SESSION_REQUIREMENT='+first);emit('REGISTRATION_SESSION_DIAGNOSTIC='+(ok?'PASS':'FAIL'));return ok;
}
async function canonicalDependencies(){
 const [{createRegistrationRunnerDependencies,openRegistrationOperatorPool},{REGISTRATION_TARGET_QUERY},{Pool}]=await Promise.all([import('../dist/tools/production/register-service-workload.js'),import('../dist/tools/production/registration-dual-pool.js'),import('pg')]);
 return {validateConfiguration:env=>{createRegistrationRunnerDependencies(env);},openPool:openRegistrationOperatorPool,targetQuery:REGISTRATION_TARGET_QUERY,createPhysicalPool:config=>{
  const physical=new Pool(config);return {end:()=>physical.end(),connect:async()=>{const client=await physical.connect();return {release:destroy=>client.release(destroy),query:async(sql,values)=>{const r=await client.query(sql,values);return {rows:r.rows,rowCount:r.rowCount??0};}};}};
 }};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==2)process.exitCode=1;else if(!await runSessionDiagnostic(process.env,line=>console.log(line)))process.exitCode=1;}
