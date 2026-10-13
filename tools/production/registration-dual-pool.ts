import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../modules/identity/src/postgresql-pool.js";
import { parseRegistrationManifest, RegisterServiceWorkloadCommand, RegistrationCommandError, type RegistrationResult, type ProductionWorkloadRegistrationManifestV1 } from "../../modules/identity/src/register-service-workload.js";
import { FORWARD_REGISTRATION_CONTRACT_ID, forwardRegistrationIdentityReady, validateForwardRegistrationStructure, validateForwardRegistrationAuthority } from "../../apps/api/src/forward-registration-readiness.js";
import { assertForwardRegistrationContract, validateForwardRegistrationStructureEvidence, type ForwardRegistrationStructureEvidence } from "../../apps/api/src/forward-registration-readiness.js";

export const REGISTRATION_TARGET_QUERY = `SELECT current_user,session_user,current_database() AS database,
 current_setting('server_version_num') AS server_version_num,inet_server_addr()::text AS address,
 inet_server_port() AS port,(SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
 pg_postmaster_start_time()::text AS cluster_started,pg_backend_pid() AS pid,
 (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls`;
const unavailable=():RegistrationCommandError=>new RegistrationCommandError('UNAVAILABLE');
function assertTarget(row: Record<string,unknown>, role: string): void {
 if(!forwardRegistrationIdentityReady([row],role)||row['port']!==5432||row['tls']!==true
  ||typeof row['address']!=='string'||!row['address']||typeof row['cluster_started']!=='string'||!row['cluster_started']
  ||!Number.isInteger(row['pid'])||Number(row['pid'])<=0||!Number.isInteger(row['database_oid'])||Number(row['database_oid'])<=0)throw unavailable();
}
export function assertIndependentRegistrationTargets(runtime: Record<string,unknown>, registration: Record<string,unknown>): void {
 assertTarget(runtime,'ai_mls_production_runtime');assertTarget(registration,'ai_mls_production_registration_operator');
 assertRegistrationSessionPair(runtime,registration);
}
/** Shared identity comparison only; callers must separately enforce endpoint policy. */
export function assertRegistrationSessionPair(runtime: Record<string,unknown>, registration: Record<string,unknown>): void {
 if(!forwardRegistrationIdentityReady([runtime],'ai_mls_production_runtime')||!forwardRegistrationIdentityReady([registration],'ai_mls_production_registration_operator')
 || !Number.isInteger(runtime['pid']) || Number(runtime['pid'])<=0 || !Number.isInteger(registration['pid']) || Number(registration['pid'])<=0)throw unavailable();
 if(runtime['pid']===registration['pid']||['address','port','database_oid','cluster_started','server_version_num','database'].some(k=>runtime[k]!==registration[k]))throw unavailable();
}

export interface RegistrationReadinessTargetPolicy {
 readonly name: 'PRODUCTION_STRICT' | 'LOCAL_OWNED_DISPOSABLE';
 readonly validateRuntime: (row: Record<string,unknown>)=>Promise<void>;
 readonly validatePair: (runtime: Record<string,unknown>,registration: Record<string,unknown>)=>Promise<void>;
}
const productionReadinessPolicy: RegistrationReadinessTargetPolicy = Object.freeze({
 name:'PRODUCTION_STRICT',
 validateRuntime:async(row:Record<string,unknown>):Promise<void>=>{assertTarget(row,'ai_mls_production_runtime');await Promise.resolve();},
 validatePair:async(runtime:Record<string,unknown>,registration:Record<string,unknown>):Promise<void>=>{assertIndependentRegistrationTargets(runtime,registration);await Promise.resolve();},
});

/** Borrows pools; never constructs a command or grants execution authority.
 * Policy/validator injection is trusted composition, unavailable to the production runner/CLI.
 */
export async function validateDualPoolRegistrationOperationalReadiness(
 runtime:PostgreSqlPoolPort, registration:PostgreSqlPoolPort, contractId:unknown,
 policy:RegistrationReadinessTargetPolicy=productionReadinessPolicy,
 validators:{structure:(pool:PostgreSqlPoolPort,id:unknown)=>Promise<ForwardRegistrationStructureEvidence>;authority:(client:PostgreSqlClientPort,id:unknown)=>Promise<void>}={structure:validateForwardRegistrationStructureEvidence,authority:validateForwardRegistrationAuthority},
):Promise<Readonly<ForwardRegistrationStructureEvidence & {contract_id:string;target_policy:string;runtime_identity_verified:true;registration_identity_verified:true;target_match:true;sessions_distinct:true;identity_provenance_verified:true;forward_authority_ready:true;operational_ready:true;writes:0}>> {
 try {
 assertForwardRegistrationContract(contractId);
 if(runtime===registration||!policy||!['PRODUCTION_STRICT','LOCAL_OWNED_DISPOSABLE'].includes(policy.name)||typeof policy.validateRuntime!=='function'||typeof policy.validatePair!=='function')throw unavailable();
 let runtimeRow:Record<string,unknown>;
 const runtimeClient=await runtime.connect();
 try{runtimeRow=await target(runtimeClient);await policy.validateRuntime(runtimeRow);}finally{runtimeClient.release();}
 const structure=await validators.structure(noRoleSwitches(runtime),contractId);
 if(structure.artifact_bindings_verified!==true||structure.r3c2_ready!==true||structure.forward_structure_ready!==true
 ||!['NATIVE_MIGRATION_LEDGER_VERIFIED','HISTORICAL_MIGRATION_ATTESTATION_VERIFIED'].includes(structure.identity_provenance))throw unavailable();
 const registrationClient=await noRoleSwitches(registration).connect();
 try{
  await policy.validatePair(runtimeRow,await target(registrationClient));
  await validators.authority(registrationClient,contractId);
 }finally{registrationClient.release();}
 return Object.freeze({...structure,contract_id:FORWARD_REGISTRATION_CONTRACT_ID,target_policy:policy.name,runtime_identity_verified:true,registration_identity_verified:true,target_match:true,sessions_distinct:true,identity_provenance_verified:true,forward_authority_ready:true,operational_ready:true,writes:0});
 }catch{throw unavailable();}
}

/** Outer readiness harness owns physical pools; attempt both closures independently. */
export async function closeRegistrationReadinessPools(runtime:PostgreSqlPoolPort,registration:PostgreSqlPoolPort):Promise<void>{
 const results=await Promise.allSettled([...new Set([runtime,registration])].map(async pool=>pool.close()));
 if(results.some(result=>result.status==='rejected'))throw unavailable();
}
export function assertRegistrationExecuteAuthorization(value: unknown): void {
 if(!value||typeof value!=='object'||(value as Record<string,unknown>)['humanAuthorized']!==true||(value as Record<string,unknown>)['quiescentWindowConfirmed']!==true)throw unavailable();
}
async function target(client: PostgreSqlClientPort): Promise<Record<string,unknown>> {
 const rows=(await client.query(REGISTRATION_TARGET_QUERY)).rows;if(rows.length!==1)throw unavailable();return rows[0]!;
}
function noRoleSwitches(pool: PostgreSqlPoolPort): PostgreSqlPoolPort {
 return {close:()=>Promise.reject(unavailable()),connect:async():Promise<PostgreSqlClientPort>=>{
  const client=await pool.connect();return {release:destroy=>client.release(destroy),query:<Row extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<Row>>=>{
   if(/\b(?:SET|RESET)\s+(?:(?:LOCAL|SESSION)\s+)?ROLE\b/iu.test(sql))throw unavailable();
   return client.query<Row>(sql,values);
  }};
 }};
}
export interface DualPoolRegistrationDependencies {
 readonly createRuntimePool: ()=>PostgreSqlPoolPort;
 readonly createRegistrationPool: ()=>PostgreSqlPoolPort;
 readonly validateRuntimeStructure: (pool: PostgreSqlPoolPort, contract: string)=>Promise<void>;
 readonly validateRegistrationAuthority: (client: PostgreSqlClientPort, contract: string)=>Promise<void>;
 // Trusted composition supplies fresh external approval at both boundaries. No env/CLI fallback.
 readonly authorizeExecute?: (manifest: ProductionWorkloadRegistrationManifestV1)=>Promise<unknown>;
}
export const forwardRegistrationValidators = Object.freeze({validateRuntimeStructure:validateForwardRegistrationStructure,validateRegistrationAuthority:validateForwardRegistrationAuthority});

/** Owns both physical pools. Model C passes runtime readiness to the existing atomic command. */
export async function runDualPoolRegistration(input: unknown, mode: 'DRY_RUN'|'EXECUTE', dependencies: DualPoolRegistrationDependencies): Promise<RegistrationResult> {
 const manifest=parseRegistrationManifest(input);
 if(mode!=='DRY_RUN'&&mode!=='EXECUTE')throw unavailable();
 let runtime:PostgreSqlPoolPort|undefined,registration:PostgreSqlPoolPort|undefined;
 let runtimeTarget:Record<string,unknown>;
 const authorize=async():Promise<void>=>{
  if(!dependencies.authorizeExecute)throw unavailable();
  assertRegistrationExecuteAuthorization(await dependencies.authorizeExecute(manifest));
 };
 const checkRuntime=async():Promise<void>=>{
  const client=await runtime!.connect();
  try{const observed=await target(client);assertTarget(observed,'ai_mls_production_runtime');runtimeTarget=observed;}finally{client.release();}
  await dependencies.validateRuntimeStructure(noRoleSwitches(runtime!),FORWARD_REGISTRATION_CONTRACT_ID);
 };
 const checkAuthority=async(client:PostgreSqlClientPort):Promise<void>=>{
  assertIndependentRegistrationTargets(runtimeTarget,await target(client));
  await dependencies.validateRegistrationAuthority(client,FORWARD_REGISTRATION_CONTRACT_ID);
 };
 try {
  if(mode==='EXECUTE')await authorize();
  runtime=dependencies.createRuntimePool();await checkRuntime();
  registration=dependencies.createRegistrationPool();if(runtime===registration)throw unavailable();
  return await new RegisterServiceWorkloadCommand(noRoleSwitches(registration),undefined,{
   validateAuthority:checkAuthority,
   beforeInspection:async(client,current,currentMode):Promise<void>=>{
    // Manifest is parsed/frozen again by the command. No reusable readiness result.
    parseRegistrationManifest(current);
    if(currentMode==='EXECUTE')await authorize();
    await checkRuntime();await checkAuthority(client);
   },
  }).run(manifest,mode);
 }catch(error){if(error instanceof RegistrationCommandError)throw error;throw unavailable();}
 finally{
  // Attempt each close even when the other fails; never expose driver errors.
  const pools=[...new Set([registration,runtime].filter((p):p is PostgreSqlPoolPort=>p!==undefined))];
  const closed=await Promise.allSettled(pools.map(async p=>p.close()));
  if(closed.some(r=>r.status==='rejected'))throw unavailable();
 }
}
