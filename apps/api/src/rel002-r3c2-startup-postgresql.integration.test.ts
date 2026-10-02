import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {Client,Pool} from "pg";
import type {PostgreSqlPoolPort,PostgreSqlQueryResult} from "../../../modules/identity/src/postgresql-pool.js";
import {R3B1_CHILD_ROOT_SCHEMA_CONTRACTS} from "./child-root-postgresql-readiness.js";
import {assertR3C2AggregateSchemasReady} from "./r3c2-aggregate-readiness.js";
import {createProductionStartupPreparation} from "./production-startup-preparation.js";
import {PostgreSqlAuditEvidenceStore,type AuditEvidenceReadRecord} from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
const enabled=process.env["REL002_TEST_POSTGRES_DISPOSABLE"]==="CONFIRMED"&&process.env["REL002_TEST_POSTGRES_PORT"]==="55441";
const config={host:"127.0.0.1",port:55441,database:"postgres"},instant="2026-10-03T00:00:00.000Z";
async function provision(admin:Client,migration:Client):Promise<void>{
 for(const name of ["publication","administration","connector","external_integration","advisory","identity","organization","audit"])await admin.query(`DROP SCHEMA IF EXISTS app_${name} CASCADE`);
 for(const role of ["ai_mls_production_runtime","ai_mls_production_migration_operator"]){if((await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1",[role])).rowCount)await admin.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`);await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);}
 await admin.query("REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator; GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");await migration.connect();
 for(const dir of ["modules/publication","modules/administration","modules/source/connector","modules/source/external-integration","modules/ai/advisory"])for(const name of ["001_schema_v1.up.sql","002_runtime_role_grants.sql","001_schema_v1.verify.sql"])await migration.query(await readFile(`${dir}/migrations/postgresql/production/${name}`,"utf8"));
 for(const name of ["001_identity_persistence_v1.up.sql","006_historical_migration_attestation_schema_v1.sql","002_runtime_role_grants.sql","012_workload_startup_binding_v1.up.sql","013_identity_workload_evidence_v1.up.sql"])await migration.query(await readFile(`modules/identity/migrations/postgresql/production/${name}`,"utf8"));
 for(const file of ["modules/organization/migrations/postgresql/production/001_organization_governance_v1.up.sql","modules/administration/migrations/postgresql/production/003_project_governance_v1.up.sql","modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql","modules/identity/migrations/postgresql/production/014_workload_startup_authorization_team_v1.up.sql","modules/audit/migrations/postgresql/production/002_binding_activation_team_v2.up.sql"])await migration.query(await readFile(file,"utf8"));
 await migration.query("INSERT INTO app_identity.identity_schema_migrations VALUES ('REL002-P2D0B-IDENTITY-PG-V1','b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e','identity.registered-service-workload',1,'POSTGRESQL','33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82','PRODUCTION','disposable-operator','disposable-backup',$1,'APPLIED')",[instant]);
}
async function resource(migration:Client,type:string,id:string,record:Record<string,unknown>,operation?:string):Promise<void>{
 const scope={tenantId:"tenant",scopeType:"TEAM",scopeId:"chosen-team"},version=operation?2:1,evidence=[{type:"APPROVAL",id:`approval-${id}`,version:1}];
 const payload={...record,recordType:type,tenantId:"tenant",scope,version,status:"ACTIVE",evidenceReferences:evidence};
 await migration.query("INSERT INTO app_administration.administration_revisions VALUES ('tenant',$1,$2,1)",[type,id]);
 await migration.query("INSERT INTO app_administration.administration_resources VALUES ('tenant',$1,$2,$3,'TEAM','chosen-team',$4)",[type,id,version,JSON.stringify(payload)]);
 await migration.query("INSERT INTO app_administration.administration_resource_evidence VALUES ('tenant',$1,$2,1,$3)",[type,id,JSON.stringify(evidence[0])]);
 if(!operation)return;
 const proposal={proposalId:`proposal-${id}`,tenantId:"tenant",resourceType:type,resourceId:id,resourceVersion:1,scope,proposedBy:"proposer",proposedChangeReference:"change",policyReference:"policy",status:"APPROVED",version:2,reasonReference:"reason",evidenceReferences:evidence};
 await migration.query("INSERT INTO app_administration.administration_proposals VALUES ('tenant',$1,$2,$3,2,'TEAM','chosen-team',$4)",[proposal.proposalId,type,id,JSON.stringify(proposal)]);
 await migration.query("INSERT INTO app_administration.administration_proposal_evidence VALUES ('tenant',$1,1,$2)",[proposal.proposalId,JSON.stringify(evidence[0])]);
 const decision={decisionId:`decision-${id}`,proposalId:proposal.proposalId,tenantId:"tenant",operation,resourceType:type,resourceId:id,scope,proposerId:"proposer",decisionActorId:"approver",status:"APPROVED",reasonReference:"reason",evidenceReferences:evidence,version:2,decidedAt:instant};
 await migration.query("INSERT INTO app_administration.administration_decisions VALUES ('tenant',$1,$2,$3,$4,2,'TEAM','chosen-team',$5)",[decision.decisionId,proposal.proposalId,type,id,JSON.stringify(decision)]);
 await migration.query("INSERT INTO app_administration.administration_decision_evidence VALUES ('tenant',$1,1,$2)",[decision.decisionId,JSON.stringify(evidence[0])]);
 const result={tenantId:"tenant",resourceType:type,resourceId:id,idempotencyKey:`approve-${id}`,operation,fingerprint:`fingerprint-${id}`,resultReference:decision.decisionId,resultVersion:2,resultStatus:"ACTIVE",recordedAt:instant};
 await migration.query("INSERT INTO app_administration.administration_idempotency VALUES ('tenant',$1,$2,$3,$4,$5,$6,2,$7)",[type,id,result.idempotencyKey,operation,result.fingerprint,decision.decisionId,JSON.stringify(result)]);
}
test("R3-C2 disposable durable startup with single pool, restart and exact fail-closed roots",{skip:!enabled,timeout:60000},async t=>{
 const admin=new Client({...config,user:"postgres"}),migration=new Client({...config,user:"ai_mls_production_migration_operator"});await admin.connect();
 const native=new Pool({...config,user:"ai_mls_production_runtime",max:1,options:R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(" ")});let leases=0,releases=0;
 const pool:PostgreSqlPoolPort={connect:async()=>{leases++;const client=await native.connect();return {query:async<R extends Record<string,unknown>>(sql:string,args?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>await client.query(sql,args?[...args]:undefined) as unknown as PostgreSqlQueryResult<R>,release:destroy=>{releases++;client.release(destroy);}};},close:()=>native.end()};
 try{
 await provision(admin,migration);
 await t.test("all approved roots ready, unrelated Identity inventory and runtime ACL drift remain fail-closed",async()=>{
  await assertR3C2AggregateSchemasReady(pool);await migration.query("CREATE TABLE app_identity.unexpected(id integer)");await assert.rejects(assertR3C2AggregateSchemasReady(pool));await migration.query("DROP TABLE app_identity.unexpected");
  await migration.query("GRANT UPDATE ON app_audit.audit_evidence_read_records TO ai_mls_production_runtime");await assert.rejects(assertR3C2AggregateSchemasReady(pool));await migration.query("REVOKE UPDATE ON app_audit.audit_evidence_read_records FROM ai_mls_production_runtime");await assertR3C2AggregateSchemasReady(pool);
 });
 await resource(migration,"ROLE","role",{roleId:"role",roleCode:"SVC",policyReference:"policy"});
 await resource(migration,"TEAM_SCOPE","chosen-team",{teamId:"chosen-team",organizationId:"org"},"APPROVE_TEAM_SCOPE_CHANGE");
 await resource(migration,"ROLE_ASSIGNMENT","assignment",{roleAssignmentId:"assignment",proposalId:"proposal-assignment",subjectPrincipalId:"service",subjectPrincipalType:"SERVICE",roleId:"role",teamIds:["chosen-team"],resourceTypes:["Administration"],purposes:["startup"],effectiveFrom:"2026-10-01T00:00:00.000Z",effectiveUntil:"2026-11-01T00:00:00.000Z",proposedBy:"proposer",approvedBy:"approver",reasonReference:"reason"},"APPROVE_ROLE_ASSIGNMENT");
 await migration.query("INSERT INTO app_organization.organization_governance_versions VALUES ('org',1,'tenant','PROPOSED',$1,$2,$2)",[JSON.stringify([{type:"AUDIT",id:"org-audit",version:1}]),instant]);
 await migration.query("INSERT INTO app_administration.project_governance_versions VALUES ('project',1,'org','tenant','PROPOSED',$1,$2,$3,$3)",[JSON.stringify([{scopeType:"TEAM",scopeId:"chosen-team"}]),JSON.stringify([{type:"AUDIT",id:"project-audit",version:1}]),instant]);
 await migration.query("INSERT INTO app_identity.identity_registered_service_workloads VALUES ('registered','tenant','service','SERVICE','WORKLOAD','PRODUCTION','ACTIVE','startup','api',1,'proof','registration-audit',$1,$1)",[instant]);
 await migration.query("INSERT INTO app_identity.identity_workload_evidence VALUES ('proof','registered',1,'tenant','service',1,true)");
 await migration.query("INSERT INTO app_identity.workload_startup_binding_versions (binding_id,binding_version,registration_id,registration_version,tenant_id,principal_id,organization_id,project_id,scope_type,scope_id,identity_evidence_ref,organization_evidence_ref,project_evidence_ref,scope_evidence_ref,status,audit_evidence_ref,created_at,updated_at,authorization_team_id) VALUES ('binding',1,'registered',1,'tenant','service','org','project','TEAM','chosen-team','proof','organization-governance:org:1','project-governance:project:1','administration-scope:tenant:TEAM_SCOPE:chosen-team:2','PROPOSED','binding-audit',$1,$1,'chosen-team')",[instant]);
 await migration.query("UPDATE app_organization.organization_governance_versions SET status='ACTIVE'; UPDATE app_administration.project_governance_versions SET status='ACTIVE'; UPDATE app_identity.workload_startup_binding_versions SET status='ACTIVE'");
 const audit=new PostgreSqlAuditEvidenceStore(pool),event:AuditEvidenceReadRecord={auditEvidenceRef:"registration-audit",sourceDomain:"IDENTITY",aggregateType:"REGISTERED_SERVICE_WORKLOAD",aggregateId:"registered",aggregateVersion:1,eventType:"REGISTERED_SERVICE_WORKLOAD.REGISTERED",payloadSchemaVersion:1,final:true,tenantId:"tenant",scopeRef:"chosen-team",payload:{registrationId:"registered",registrationVersion:1,tenantId:"tenant",principalId:"service",principalType:"SERVICE",assurance:"WORKLOAD",environment:"PRODUCTION"},occurredAt:instant,materializedAt:instant};
 await audit.materialize(event);await audit.materialize({...event,auditEvidenceRef:"binding-audit",aggregateType:"WORKLOAD_STARTUP_BINDING",aggregateId:"binding",eventType:"WORKLOAD_STARTUP_BINDING.ACTIVATED",payloadSchemaVersion:2,payload:{bindingId:"binding",bindingVersion:1,registrationId:"registered",registrationVersion:1,tenantId:"tenant",principalId:"service",organizationId:"org",projectId:"project",authorizationTeamId:"chosen-team",scopeType:"TEAM",scopeId:"chosen-team",status:"ACTIVE"}});await audit.close();
 const configuration={requiredServiceWorkloadPins:[{registrationId:"registered",registrationVersion:1}],startupWorkloadPurpose:"startup",startupWorkloadAudience:"api"};
 await t.test("durable proof, live canonical authorization, gate receipt and restart pass with max=1",async()=>{
  for(let restart=0;restart<2;restart++){const preparation=createProductionStartupPreparation(pool,configuration,()=>new Date(instant));assert.equal(await preparation.authority.assertSchemaReady(),"NATIVE_MIGRATION_LEDGER_VERIFIED");const identities=await preparation.resolveRequired();assert.match(preparation.validateStartupGate(identities),/^[a-f0-9]{64}$/u);await preparation.close();await assert.rejects(preparation.resolveRequired());}
  assert.equal(native.totalCount,1);assert.equal(leases,releases);
 });
 await t.test("revoked pinned registration fails without fallback and cleanup retains pool ownership",async()=>{await migration.query("UPDATE app_identity.identity_registered_service_workloads SET status='REVOKED' WHERE registration_id='registered'");const preparation=createProductionStartupPreparation(pool,configuration,()=>new Date(instant));await assert.rejects(preparation.resolveRequired());assert.equal(native.totalCount,1);assert.equal(leases,releases);});
 }finally{await native.end();await migration.end();await admin.end();}
});
