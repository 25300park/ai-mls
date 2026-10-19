import { createHash } from "node:crypto";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import { assertR3C2IdentityBaseReady, type IdentityTeamRequirement, type IdentityBaseDiagnosticStage } from "./r3c2-aggregate-readiness.js";
import { classifyPhysicalConnectionFailure } from "./production-connection-diagnostics.js";

interface InitialIdentityDiagnostic {
 readonly event: 'PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC';
 readonly stage: IdentityBaseDiagnosticStage | 'ARTIFACT_BINDING';
 readonly code: 'PRESENT_MATCH' | 'MISSING' | 'MISMATCH' | 'UNRESOLVED' | 'READY' | 'READINESS_UNAVAILABLE';
 readonly artifactKey?: string;
 readonly requirement?: IdentityTeamRequirement;
 readonly result?: 'PASS' | 'FAIL';
 readonly sqlstate: string | null;
 readonly querySha256: string | null;
}
function emit(event: InitialIdentityDiagnostic): void { try { process.stderr.write(`${JSON.stringify(event)}\n`); } catch { /* diagnostics only */ } }
/** Production-only observation; uses the exact borrowed inspector session and never changes decisions. */
export async function assertInitialProductionIdentityReady(pool: PostgreSqlPoolPort, sink: (event: InitialIdentityDiagnostic) => void = emit): ReturnType<typeof assertR3C2IdentityBaseReady> {
 let stage:IdentityBaseDiagnosticStage='IDENTITY_BASE_SCHEMA_PROVENANCE',querySha256:string|null=null,sqlstate:string|null=null;
 const report=(event:InitialIdentityDiagnostic):void=>{try{sink(Object.freeze(event));}catch{/* preserve outcome */}};
 const diagnosticPool:PostgreSqlPoolPort={close:()=>pool.close(),connect:async()=>{
  const client=await pool.connect();
  const keys=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256`);
  try{
   const result=await client.query('SELECT '+keys.map((_,i)=>`current_setting($${i*2+1}, true) IS NOT NULL AS present${i}, current_setting($${i*2+1}, true) = $${i*2+2} AS binding${i}`).join(', '),keys.flatMap((key,i)=>[key,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[i]!.artifactSha256]));
   for(const [i,key] of keys.entries()) {const row=result.rows.length===1?result.rows[0]:undefined;report({event:'PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC',stage:'ARTIFACT_BINDING',artifactKey:key,code:row?.[`binding${i}`]===true?'PRESENT_MATCH':row?.[`present${i}`]===false?'MISSING':row?.[`present${i}`]===true?'MISMATCH':'UNRESOLVED',sqlstate:null,querySha256:null});}
  }catch{for(const key of keys)report({event:'PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC',stage:'ARTIFACT_BINDING',artifactKey:key,code:'UNRESOLVED',sqlstate:null,querySha256:null});}
  return {release:destroy=>client.release(destroy),query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
   if(sql!=='ROLLBACK'&&sql!=='COMMIT'){querySha256=createHash('sha256').update(sql).digest('hex');sqlstate=null;}
   try{return await client.query<R>(sql,values);}catch(error){if(sql!=='ROLLBACK')sqlstate=classifyPhysicalConnectionFailure(error).sqlstate;throw error;}
  }};
 }};
 try{const provenance=await assertR3C2IdentityBaseReady(diagnosticPool,(value,requirement,result)=>{stage=value;if(requirement===undefined){querySha256=null;}else{report({event:'PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC',stage,code:result===true?'READY':'READINESS_UNAVAILABLE',requirement,result:result===true?'PASS':'FAIL',sqlstate:null,querySha256});}});report({event:'PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC',stage,code:'READY',sqlstate:null,querySha256:null});return provenance;}
 catch(error){report({event:'PRODUCTION_INITIAL_IDENTITY_DIAGNOSTIC',stage,code:'READINESS_UNAVAILABLE',sqlstate,querySha256});throw error;}
}
