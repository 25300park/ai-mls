// Human-only, exact-scope composition. Importing this module never creates pools.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const MANIFEST_PATH=fileURLToPath(new URL('../docs/implementation/REL002_R3G1B4_PRODUCTION_WORKLOAD_REGISTRATION_MANIFEST.json',import.meta.url));
const manifestSha256='557e11e6c1846e02a26e7fee748028d12f662b7bf13634ca3ccad3df4dc594a1';
const expected={
 schemaVersion:1,registrationId:'53c1f7db-52de-4873-8b41-a016cab8e6c6',registrationVersion:1,
 tenantId:'bcc988b1-00c9-481b-9dbb-bfb56b5ea91f',principalId:'f2f97677-8f55-4d62-a5cc-2ff10e757718',
 environment:'PRODUCTION',purpose:'AI_MLS_PRODUCTION_API_RUNTIME',audience:'ai-mls-api',
 scopeRef:'registered-service-workload:53c1f7db-52de-4873-8b41-a016cab8e6c6:1',
 identityEvidenceRef:'workload-identity-evidence:53c1f7db-52de-4873-8b41-a016cab8e6c6:1',
 auditEvidenceRef:'registered-service-workload-audit:53c1f7db-52de-4873-8b41-a016cab8e6c6:1',
 expectedDatabaseTarget:{host:'db.mfonujjeokvpsfucfxuq.supabase.co',database:'postgres',projectRef:'mfonujjeokvpsfucfxuq',region:'ap-southeast-1'},
 expectedExecutionRole:'ai_mls_production_registration_operator',expectedWrites:3,timestampPolicy:'GENERATED_AT_EXECUTION',
};
const unavailable=()=>new Error('REL002_EXECUTION_UNAVAILABLE_INSPECT_DURABLE_STATE_BEFORE_RETRY');
function confirmations(environment){
 if(environment.REL002_REGISTRATION_HUMAN_AUTHORIZED!=='YES'||environment.REL002_REGISTRATION_QUIESCENT_WINDOW_CONFIRMED!=='YES')throw unavailable();
 for(const key of ['DATABASE_URL','REL002_LOCAL_DISPOSABLE','LOCAL_OWNED_DISPOSABLE','REL002_REGISTRATION_DISPOSABLE','REL002_TARGET_POLICY'])if(environment[key]!==undefined)throw unavailable();
}
async function canonicalDependencies(){
 const {createRegistrationRunnerDependencies,runRegistrationOperator}=await import('../dist/tools/production/register-service-workload.js');
 return {readManifest:readFile,createDependencies:createRegistrationRunnerDependencies,run:runRegistrationOperator};
}
// Dependency injection is an in-process test seam; no CLI/module override is accepted.
export async function runOneShotRegistration(environment,output,injected){
 try{
  confirmations(environment);
  const deps=injected??await canonicalDependencies();
  const verifyFile=async()=>{
   const bytes=await deps.readManifest(MANIFEST_PATH);
   if(createHash('sha256').update(bytes).digest('hex')!==manifestSha256||!isDeepStrictEqual(JSON.parse(bytes.toString('utf8')),expected))throw unavailable();
  };
  await verifyFile();confirmations(environment);
  const canonical=deps.createDependencies(environment);
  let checkpointCount=0,denied=false;
  const authorizeExecute=async manifest=>{
   const checkpoint=['BEFORE_POOLS','IN_TRANSACTION_BEFORE_INSPECTION'][checkpointCount++];
   try{
    if(denied||!checkpoint||!isDeepStrictEqual(manifest,expected))throw unavailable();
    await verifyFile();confirmations(environment);
    return Object.freeze({humanAuthorized:true,quiescentWindowConfirmed:true,checkpoint});
   }catch{denied=true;throw unavailable();}
  };
  const reports=[];
  await deps.run(['--execute','--manifest',MANIFEST_PATH],environment,line=>reports.push(line),{...canonical,authorizeExecute});
  if(denied||checkpointCount!==2||reports.length!==1)throw unavailable();
  output(reports[0]);
 }catch{throw unavailable();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==2)throw unavailable();
  await runOneShotRegistration(process.env,line=>process.stdout.write(line+'\n'));
 }catch{process.stderr.write('REL002_EXECUTION_UNAVAILABLE_INSPECT_DURABLE_STATE_BEFORE_RETRY\n');process.exitCode=1;}
}
