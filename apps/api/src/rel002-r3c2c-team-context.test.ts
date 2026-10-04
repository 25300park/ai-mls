import type { WorkloadStartupBindingRecord } from "../../../modules/identity/src/workload-startup-binding.js";
import assert from "node:assert/strict";
import test from "node:test";
import { assertWorkloadStartupBindingRecord } from "../../../modules/identity/src/workload-startup-binding.js";
const binding = {bindingId:"b",bindingVersion:1,registrationId:"r",registrationVersion:1,tenantId:"t",principalId:"p",organizationId:"o",projectId:"j",scopeType:"TEAM",scopeId:"s",identityEvidenceRef:"i",organizationEvidenceRef:"organization-governance:o:1",projectEvidenceRef:"project-governance:j:1",scopeEvidenceRef:"administration-scope:t:TEAM_SCOPE:s:1",status:"PROPOSED",auditEvidenceRef:"a",createdAt:"2026-10-02T00:00:00.000Z",updatedAt:"2026-10-02T00:00:00.000Z"};
test("R3-C2C explicit authorization team is preserved by canonical binding validation",()=>{
 const explicit={...binding,authorizationTeamId:"selected-team"};
 assert.doesNotThrow(()=>assertWorkloadStartupBindingRecord(explicit));
 assert.equal(explicit.authorizationTeamId,"selected-team");
 assert.throws(()=>assertWorkloadStartupBindingRecord({...explicit,authorizationTeamId:""}));
});

type TeamCheck = (binding: Record<string, unknown>, team: Record<string, unknown> | undefined, assignments: readonly Record<string, unknown>[], now: Date) => void;
const load = async (): Promise<TeamCheck> => {const path="../../../modules/identity/src/workload-startup-team-context.js"; return (await import(path) as {assertStartupTeamEligibility: TeamCheck}).assertStartupTeamEligibility;};
const selected={...binding,authorizationTeamId:"chosen"};
const team={recordType:"TEAM_SCOPE",teamId:"chosen",tenantId:"t",organizationId:"o",status:"ACTIVE"};
const assignment={roleAssignmentId:"ra",version:1,tenantId:"t",subjectPrincipalId:"p",subjectPrincipalType:"SERVICE",status:"ACTIVE",teamIds:["other","chosen"],effectiveFrom:"2026-01-01T00:00:00.000Z",effectiveUntil:"2027-01-01T00:00:00.000Z"};
const now=new Date("2026-10-02T00:00:00.000Z");
test("R3-C2C explicit membership succeeds independently of array order",async()=>{const check=await load(); check(selected,team,[assignment],now); check(selected,team,[{...assignment,teamIds:["chosen","other"]}],now);});
test("R3-C2C never derives a missing team from assignments or governance",async()=>{const check=await load(); for(const scopeType of ["TEAM","POLICY","SOURCE","TARGET"]) assert.throws(()=>check({...binding,scopeType},team,[assignment],now));});
test("R3-C2C unknown, inactive, tenant and organization mismatch fail closed",async()=>{const check=await load(); for(const invalid of [undefined,{...team,teamId:"other"},{...team,status:"REVOKED"},{...team,tenantId:"other"},{...team,organizationId:"other"}]) assert.throws(()=>check(selected,invalid,[assignment],now));});
test("R3-C2C membership absent, expired and wrong principal fail closed",async()=>{const check=await load(); for(const invalid of [[],[{...assignment,teamIds:["other"]}],[{...assignment,subjectPrincipalId:"other"}],[{...assignment,effectiveUntil:now.toISOString()}]]) assert.throws(()=>check(selected,team,invalid,now));});
test("R3-C2C conflicting assignment identity fails closed",async()=>{const check=await load(); assert.throws(()=>check(selected,team,[assignment,{...assignment,teamIds:["other"]}],now));});
import { PostgreSqlAuditEvidenceStore, assertAuditEvidence, assertBindingAuditEvidence } from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
const activation={auditEvidenceRef:"a",sourceDomain:"IDENTITY",aggregateType:"WORKLOAD_STARTUP_BINDING",aggregateId:"b",aggregateVersion:1,eventType:"WORKLOAD_STARTUP_BINDING.ACTIVATED",payloadSchemaVersion:2,final:true,tenantId:"t",scopeRef:"s",payload:{bindingId:"b",bindingVersion:1,registrationId:"r",registrationVersion:1,tenantId:"t",principalId:"p",organizationId:"o",projectId:"j",authorizationTeamId:"chosen",scopeType:"TEAM",scopeId:"s",status:"ACTIVE"},occurredAt:now.toISOString(),materializedAt:now.toISOString()};
test("R3-C2C activation schema 2 binds exact team and rejects mismatch",()=>{assert.doesNotThrow(()=>assertAuditEvidence(activation)); assertBindingAuditEvidence(activation,{...selected,status:"ACTIVE"}); assert.throws(()=>assertBindingAuditEvidence(activation,{...selected,status:"ACTIVE",authorizationTeamId:"other"})); const {authorizationTeamId: omitted,...legacy}=activation.payload; void omitted; assert.throws(()=>assertAuditEvidence({...activation,payload:legacy})); assert.throws(()=>assertBindingAuditEvidence({...activation,payloadSchemaVersion:1,payload:legacy},{...selected,status:"ACTIVE"}));});

test("R3-C2C startup resource mapping uses the explicit team for all typed scopes",async()=>{
 const path="../../../modules/identity/src/workload-startup-team-context.js";
 const {startupAuthorizationResource}=await import(path) as {startupAuthorizationResource:(binding:Record<string,unknown>,version:number)=>Record<string,unknown>};
 for(const [scopeType,type] of Object.entries({TEAM:"TEAM_SCOPE",POLICY:"POLICY",SOURCE:"SOURCE_REGISTRY",TARGET:"PUBLICATION_TARGET"})) {
  assert.deepEqual(startupAuthorizationResource({...selected,scopeType},7),{type:"Administration",id:`Administration:${type}:s`,tenantId:"t",version:7,teamId:"chosen"});
  assert.throws(()=>startupAuthorizationResource({...binding,scopeType},7));
 }
 assert.throws(()=>startupAuthorizationResource({...selected,scopeType:"UNKNOWN"},7));
});
import { readFile } from "node:fs/promises";
test("R3-C2C forward migrations preserve history and require explicit new teams",async()=>{
 const identity=await readFile("modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql","utf8");
 const audit=await readFile("modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql","utf8");
 assert.match(identity,/ADD COLUMN authorization_team_id text/); assert.doesNotMatch(identity,/UPDATE app_identity|DEFAULT/); assert.match(identity,/TG_OP='INSERT'/); assert.match(audit,/authorizationTeamId/); assert.match(audit,/payload_schema_version/);
});
import { PostgreSqlWorkloadStartupBindingStore } from "../../../modules/identity/src/workload-startup-binding-postgresql.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
test("R3-C2C new binding writes reject missing team before acquiring a client",async()=>{
 let acquired=0;const pool:PostgreSqlPoolPort={connect:()=>{acquired++;throw Error("client acquisition forbidden");},close:()=>Promise.resolve()};
 const store=new PostgreSqlWorkloadStartupBindingStore(pool,{assertBindingReferences:()=>Promise.resolve()});
 await assert.rejects(store.createProposed(binding as unknown as WorkloadStartupBindingRecord),{code:"INPUT_INVALID"}); assert.equal(acquired,0);
});
import { AuthorizationService, type LiveRoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import type { AuditSink } from "../../../packages/security-contracts/src/index.js";
test("R3-C2C scope.use requires live capability and passes exact selected team",async()=>{
 const path="../../../modules/identity/src/workload-startup-team-context.js"; const {startupAuthorizationResource}=await import(path) as {startupAuthorizationResource:(binding:Record<string,unknown>,version:number)=>{type:string;id:string;tenantId:string;version:number;teamId:string}};
 let observed:string|undefined;let current: readonly LiveRoleAssignment[]=[{id:"ra",principalId:"p",role:"SVC",teamIds:["other","chosen"],resourceTypes:["Administration"],purposes:["STARTUP"],effectiveFrom:assignment.effectiveFrom,effectiveUntil:assignment.effectiveUntil,status:"ACTIVE",version:1,tenantId:"t",subjectPrincipalType:"SERVICE"}];
 const sink:AuditSink={append(input){return {...input,id:"audit",occurredAt:now.toISOString()};}};
 const service=new AuthorizationService({liveAssignmentResolver:{resolveCurrentAssignments(context){observed=context.teamId;return current;}},auditSink:sink,clock:()=>now,policyVersion:"existing-policy"});
 const request={subject:{registrationId:"r",registrationVersion:1,tenantId:"t",principalId:"p",principalType:"SERVICE" as const,assurance:"WORKLOAD" as const,identityEvidenceRef:"i",auditEvidenceRef:"a"},action:"scope.use",resource:startupAuthorizationResource(selected,1),purpose:"STARTUP",correlationId:"c"};
 assert.equal(service.evaluateWorkload(request).effect,"ALLOW"); assert.equal(observed,"chosen");
 current=[];assert.equal(service.evaluateWorkload(request).effect,"DENY");
});
test("R3-C2C historical activation replay performs no new INSERT",async()=>{

 const {authorizationTeamId: omitted,...payload}=activation.payload;void omitted;
 const legacy={...activation,payloadSchemaVersion:1 as const,final:true as const,payload};let inserts=0;
 const row={audit_evidence_ref:"a",source_domain:"IDENTITY",aggregate_type:"WORKLOAD_STARTUP_BINDING",aggregate_id:"b",aggregate_version:1,event_type:legacy.eventType,payload_schema_version:1,final:true,tenant_id:"t",scope_ref:"s",payload,occurred_at:now.toISOString(),materialized_at:now.toISOString()};
 const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(sql:string)=>{if(sql.startsWith("INSERT"))inserts++;return Promise.resolve({rows:(sql==="SELECT current_user AS role"?[{role:"ai_mls_production_runtime"}]:sql.startsWith("SELECT audit")?[row]:[]) as unknown as readonly R[],rowCount:0});},release:()=>undefined}),close:()=>Promise.resolve()};
 assert.deepEqual(await new PostgreSqlAuditEvidenceStore(pool).materialize(legacy),legacy);assert.equal(inserts,0);
});
test("R3-C2C evidence schema versions are exact numeric values",()=>{const {authorizationTeamId:omitted,...legacy}=activation.payload;void omitted;for(const payloadSchemaVersion of ["1","2",true,null])assert.throws(()=>assertAuditEvidence({...activation,payloadSchemaVersion,payload:payloadSchemaVersion==="1"?legacy:activation.payload}));});
import { createHash } from "node:crypto";
import { evaluateR3C2CTeamPersistence, R3C2C_TEAM_CONTRACTS, R3C2C_TEAM_CATALOG_QUERY } from "./r3c2c-postgresql-readiness.js";
test("R3-C2C readiness rejects missing, duplicate, drift and migration-role input",async()=>{
 const rows=R3C2C_TEAM_CONTRACTS.map(c=>({schema_name:c.schemaName,table_name:c.tableName,fingerprint:c.fingerprint,authority_ok:true}));
 for(const [values,role,expected] of [[rows,"ai_mls_production_runtime","READY"],[[],"ai_mls_production_runtime","NOT_READY"],[[...rows,...rows],"ai_mls_production_runtime","NOT_READY"],[[{...rows[0],fingerprint:"drift"},rows[1]],"ai_mls_production_runtime","NOT_READY"],[rows,"ai_mls_production_migration_operator","NOT_READY"]] as const){
  const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(sql:string)=>Promise.resolve({rows:(sql==="SELECT current_user AS role"?[{role}]:sql === R3C2C_TEAM_CATALOG_QUERY?values:[]) as unknown as readonly R[],rowCount:0}),release:()=>undefined}),close:()=>Promise.resolve()};
  assert.equal((await evaluateR3C2CTeamPersistence(pool)).status,expected);
 }
});
test("R3-C2C migration sidecars match normalized forward-only artifacts",async()=>{for(const file of ["modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql","modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql"]){const text=await readFile(file,"utf8");assert.equal(text.includes("\r"),false);assert.equal(createHash("sha256").update(text).digest("hex"),(await readFile(`${file}.sha256`,"utf8")).split(" ")[0]);}});
