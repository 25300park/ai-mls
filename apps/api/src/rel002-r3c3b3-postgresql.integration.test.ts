import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {Client,Pool} from "pg";
import {AuditLog} from "../../../modules/audit/src/audit-log.js";
import {Argon2idV1Verifier} from "../../../modules/identity/src/first-party-credential-argon2.js";
import {FirstPartyCredentialAuthenticationAdapter} from "../../../modules/identity/src/first-party-credential-adapter.js";
import {PostgreSqlHumanCredentialReader} from "../../../modules/identity/src/first-party-credential-postgresql.js";
import {PostgreSqlSessionReader,PostgreSqlSessionUnitOfWork,type AsyncSessionUnitOfWork} from "../../../modules/identity/src/session-postgresql-persistence.js";
import {SessionService,type AuthenticationAdapter} from "../../../modules/identity/src/session-service.js";
import type {PostgreSqlPoolPort,PostgreSqlQueryResult} from "../../../modules/identity/src/postgresql-pool.js";
import {ProductionPostAuthenticationBinding,ProductionTrustedBindingResolver} from "./production-trusted-binding.js";
import {assertProductionSessionBindingPersistenceReady} from "./production-trusted-binding-readiness.js";
import {assertR3C2IdentityBaseReady} from "./r3c2-aggregate-readiness.js";
import {resolveExplicitTeamOnClient} from "../../../modules/administration/src/production-team-binding.js";
import {R3B1_CHILD_ROOT_SCHEMA_CONTRACTS} from "./child-root-postgresql-readiness.js";
const enabled=process.env['REL002_TEST_POSTGRES_DISPOSABLE']==='CONFIRMED'&&process.env['REL002_TEST_POSTGRES_PORT']==='55441';
const config={host:'127.0.0.1',port:55441,database:'postgres'},instant='2026-10-03T00:00:00.000Z';
const migrationFile='modules/identity/migrations/postgresql/production/016_production_session_binding_v1.up.sql';
const freshness={IDLE_TIMEOUT_MILLISECONDS:60000,ABSOLUTE_LIFETIME_MILLISECONDS:120000,MFA_FRESHNESS_MILLISECONDS:30000};
async function resource(migration:Client,type:string,id:string,record:Record<string,unknown>,operation?:string):Promise<void>{
 const scope={tenantId:"tenant-b3",scopeType:"TEAM",scopeId:"chosen-team"},version=operation?2:1,evidence=[{type:"APPROVAL",id:`approval-${id}`,version:1}];
 const payload={...record,recordType:type,tenantId:"tenant-b3",scope,version,status:"ACTIVE",evidenceReferences:evidence};
 await migration.query("INSERT INTO app_administration.administration_revisions VALUES ('tenant-b3',$1,$2,1)",[type,id]);
 await migration.query("INSERT INTO app_administration.administration_resources VALUES ('tenant-b3',$1,$2,$3,'TEAM','chosen-team',$4)",[type,id,version,JSON.stringify(payload)]);
 await migration.query("INSERT INTO app_administration.administration_resource_evidence VALUES ('tenant-b3',$1,$2,1,$3)",[type,id,JSON.stringify(evidence[0])]);
 if(!operation)return;
 const proposal={proposalId:`proposal-${id}`,tenantId:"tenant-b3",resourceType:type,resourceId:id,resourceVersion:1,scope,proposedBy:"proposer",proposedChangeReference:"change",policyReference:"policy",status:"APPROVED",version:2,reasonReference:"reason",evidenceReferences:evidence};
 await migration.query("INSERT INTO app_administration.administration_proposals VALUES ('tenant-b3',$1,$2,$3,2,'TEAM','chosen-team',$4)",[proposal.proposalId,type,id,JSON.stringify(proposal)]);
 await migration.query("INSERT INTO app_administration.administration_proposal_evidence VALUES ('tenant-b3',$1,1,$2)",[proposal.proposalId,JSON.stringify(evidence[0])]);
 const decision={decisionId:`decision-${id}`,proposalId:proposal.proposalId,tenantId:"tenant-b3",operation,resourceType:type,resourceId:id,scope,proposerId:"proposer",decisionActorId:"approver",status:"APPROVED",reasonReference:"reason",evidenceReferences:evidence,version:2,decidedAt:instant};
 await migration.query("INSERT INTO app_administration.administration_decisions VALUES ('tenant-b3',$1,$2,$3,$4,2,'TEAM','chosen-team',$5)",[decision.decisionId,proposal.proposalId,type,id,JSON.stringify(decision)]);
 await migration.query("INSERT INTO app_administration.administration_decision_evidence VALUES ('tenant-b3',$1,1,$2)",[decision.decisionId,JSON.stringify(evidence[0])]);
 const result={tenantId:"tenant-b3",resourceType:type,resourceId:id,idempotencyKey:`approve-${id}`,operation,fingerprint:`fingerprint-${id}`,resultReference:decision.decisionId,resultVersion:2,resultStatus:"ACTIVE",recordedAt:instant};
 await migration.query("INSERT INTO app_administration.administration_idempotency VALUES ('tenant-b3',$1,$2,$3,$4,$5,$6,2,$7)",[type,id,result.idempotencyKey,operation,result.fingerprint,decision.decisionId,JSON.stringify(result)]);
}
test('B3 bound issuance and live trusted binding in disposable PostgreSQL',{skip:!enabled,timeout:60000},async t=>{
 const migration=new Client({...config,user:'ai_mls_production_migration_operator'});await migration.connect();
 const native=new Pool({...config,user:'ai_mls_production_runtime',max:1,options:R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(' ')});let releaseCount=0,leaseCount=0;
 const pool:PostgreSqlPoolPort={async connect(){const c=await native.connect();leaseCount++;return {query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>await c.query(sql,values?[...values]:undefined) as unknown as PostgreSqlQueryResult<R>,release:destroy=>{releaseCount++;c.release(destroy);}};},close:()=>native.end()};
 let sequence=0;const clock=()=>new Date(instant),audit=new AuditLog({clock,idFactory:()=>`b3-audit-${String(++sequence)}`}),reader=new PostgreSqlHumanCredentialReader(pool),crypto=new Argon2idV1Verifier();
 const evidence={schemaVersion:1 as const,loginIdentifier:'B3User',password:'synthetic B3 fixture password'};
 const unit=new PostgreSqlSessionUnitOfWork(pool);
 const service=(u:AsyncSessionUnitOfWork=unit,adapter:AuthenticationAdapter=new FirstPartyCredentialAuthenticationAdapter('tenant-b3',reader,crypto))=>new SessionService({authenticationAdapter:adapter,asyncCreationUnitOfWork:u,postAuthenticationBinding:new ProductionPostAuthenticationBinding(pool,'tenant-b3',clock),auditSink:audit,clock,idFactory:()=>`b3-session-${String(++sequence)}`,accessLifetimeMs:60000,absoluteLifetimeMs:120000});
 const resolver=(now=instant)=>new ProductionTrustedBindingResolver({pool,expectedTenantId:'tenant-b3',freshness,clock:()=>new Date(now),auditSink:audit,authorizationPolicyVersion:'policy'});
 const request=(sessionId:string)=>({sessionId,action:'property.read',resource:{type:'Property',id:'property',tenantId:'tenant-b3',teamId:'chosen-team'},purpose:'PROPERTY_ADMINISTRATION',correlationId:'b3-request'});
 const issue=(teamId:string|undefined='chosen-team')=>service().createSession({evidence,requestedTeamId:teamId,correlationId:'b3-issue'});
 const mutate=(type:string,id:string,patch:Record<string,unknown>)=>migration.query('UPDATE app_administration.administration_resources SET payload_json=payload_json||$3::jsonb WHERE tenant_id=$1 AND resource_type=$2 AND resource_id=$4',['tenant-b3',type,JSON.stringify(patch),id]);
 try{
  if((await migration.query("SELECT 1 FROM pg_attribute WHERE attrelid='app_identity.identity_sessions'::regclass AND attname='tenant_id'")).rowCount===0)await migration.query(await readFile(migrationFile,'utf8'));
  await migration.query('TRUNCATE app_administration.administration_revisions,app_administration.administration_resources,app_administration.administration_proposals,app_administration.administration_decisions,app_administration.administration_resource_evidence,app_administration.administration_proposal_evidence,app_administration.administration_decision_evidence,app_administration.administration_idempotency,app_identity.identity_sessions,app_identity.identity_session_revocations,app_identity.identity_human_principals,app_identity.identity_human_credentials');
  await resource(migration,'ROLE','role-b3',{roleId:'role-b3',roleCode:'AGT',policyReference:'policy'});
  await resource(migration,'TEAM_SCOPE','chosen-team',{teamId:'chosen-team',organizationId:'org'},'APPROVE_TEAM_SCOPE_CHANGE');
  const assignment={roleAssignmentId:'assignment-b3',proposalId:'proposal-assignment-b3',subjectPrincipalId:'principal-b3',subjectPrincipalType:'HUMAN',roleId:'role-b3',teamIds:['other-team','chosen-team'],resourceTypes:['Property'],purposes:['PROPERTY_ADMINISTRATION'],effectiveFrom:'2026-10-01T00:00:00.000Z',effectiveUntil:'2026-11-01T00:00:00.000Z',proposedBy:'proposer',approvedBy:'approver',reasonReference:'reason'};
  await resource(migration,'ROLE_ASSIGNMENT','assignment-b3',assignment,'APPROVE_ROLE_ASSIGNMENT');
  await migration.query("INSERT INTO app_identity.identity_human_principals VALUES ('principal-b3','principal-b3','tenant-b3','B3User','ACTIVE','2026-01-01','2026-01-01')");
  const salt=crypto.generateSalt(),key=await crypto.derive(evidence.password,salt);
  await migration.query("INSERT INTO app_identity.identity_human_credentials VALUES ('credential-b3','principal-b3',1,'PASSWORD','ARGON2ID','ARGON2ID_V1',$1,$2,'ACTIVE','2026-01-01',NULL,NULL)",[salt,key]);
  await t.test('checksum exact readiness ACL and base compatibility',async()=>{
   assert.equal(createHash('sha256').update(await readFile(migrationFile)).digest('hex'),(await readFile(migrationFile+'.sha256','utf8')).trim());
   await migration.query(await readFile(migrationFile.replace('.up.sql','.verify.sql'),'utf8'));
   await assertProductionSessionBindingPersistenceReady(pool);await assertR3C2IdentityBaseReady(pool);
   assert.equal((await migration.query<{count:string}>('SELECT count(*) FROM app_identity.identity_sessions')).rows[0]?.count,'0');await resolver().assertReady();
   const c=await pool.connect();try{assert.equal((await c.query("SELECT current_user AS role")).rows[0]?.['role'],'ai_mls_production_runtime');await assert.rejects(c.query('ALTER TABLE app_identity.identity_sessions ADD COLUMN forbidden text'));}finally{c.release();}
   await migration.query('BEGIN');try{await migration.query('ALTER TABLE app_identity.identity_sessions DISABLE TRIGGER identity_sessions_production_binding_guard');await assert.rejects(migration.query(await readFile(migrationFile.replace('.up.sql','.verify.sql'),'utf8')));}finally{await migration.query('ROLLBACK');}
   let extensionVerified=false;
   const partialPool:PostgreSqlPoolPort={connect:async()=>{const c=await pool.connect();return {query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
    const result=await c.query<R>(sql,values);
    if(sql.includes('AS fingerprint')&&sql.includes("'identity_sessions'")){extensionVerified=true;return {...result,rows:result.rows.map(row=>({...row,fingerprint:'partial-extension'}))};}
    if(sql.includes('pg_catalog')&&sql.includes('app_identity'))return {...result,rows:result.rows.filter(row=>!(row['table_name']==='identity_sessions'&&(['tenant_id','team_id','team_binding_origin'].includes(String(row['column_name']))||row['constraint_name']==='identity_sessions_production_binding_check')))};
    return result;
   },release:destroy=>c.release(destroy)};},close:()=>Promise.reject(new Error('shared pool close forbidden'))};
   await assert.rejects(assertR3C2IdentityBaseReady(partialPool));assert.equal(extensionVerified,true);
  });
  await t.test('exact durable binding restart read live authorization and no password persistence',async()=>{
   const s=await issue(),r=await new PostgreSqlSessionReader(pool).find(s.id);
   assert.equal(r?.tenantId,'tenant-b3');assert.equal(r.teamId,'chosen-team');assert.equal(r.tenantBindingOrigin,'AUTHENTICATED_PRINCIPAL_TENANT');assert.equal(r.teamBindingOrigin,'EXPLICIT_TEAM_SELECTION_VALIDATED');
   const resolved=await resolver().resolveAuthorized(request(s.id));assert.equal(resolved.teamId,'chosen-team');assert.deepEqual(resolved.roles,['AGT']);assert.notEqual(resolved.id,s.id);
   assert.equal(JSON.stringify(r).includes(evidence.password),false);assert.equal(native.totalCount,1);
   await assert.rejects(resolver().resolveAuthorized({...request(s.id),resource:{...request(s.id).resource,tenantId:'wrong'}}));
   await assert.rejects(resolver().resolveAuthorized({...request(s.id),resource:{...request(s.id).resource,teamId:'other-team'}}));
  });
  await t.test('missing unknown inactive wrong-tenant and membership team selection fail',async()=>{
   for(const requestedTeamId of [undefined,'unknown','other-team'])await assert.rejects(service().createSession({evidence,...(requestedTeamId===undefined?{}:{requestedTeamId}),correlationId:'b3-invalid'}));
   for(const patch of [{status:'RETIRED'},{tenantId:'wrong'}]){await mutate('TEAM_SCOPE','chosen-team',patch);await assert.rejects(issue());await mutate('TEAM_SCOPE','chosen-team',{status:'ACTIVE',tenantId:'tenant-b3'});}
   await mutate('ROLE_ASSIGNMENT','assignment-b3',{teamIds:['other-team']});await assert.rejects(issue());await mutate('ROLE_ASSIGNMENT','assignment-b3',{teamIds:['chosen-team','other-team']});
   assert.equal((await issue()).teamId,'chosen-team');
  });
  await t.test('live role and team removal invalidate an existing Session',async()=>{
   const s=await issue();await mutate('ROLE_ASSIGNMENT','assignment-b3',{teamIds:['other-team']});await assert.rejects(resolver().resolveAuthorized(request(s.id)));await mutate('ROLE_ASSIGNMENT','assignment-b3',{teamIds:['chosen-team']});
   await mutate('TEAM_SCOPE','chosen-team',{status:'RETIRED'});await assert.rejects(resolver().resolveAuthorized(request(s.id)));await mutate('TEAM_SCOPE','chosen-team',{status:'ACTIVE'});
   await migration.query("UPDATE app_identity.identity_human_principals SET status='DISABLED' WHERE principal_id='principal-b3'");await assert.rejects(resolver().resolveAuthorized(request(s.id)));await migration.query("UPDATE app_identity.identity_human_principals SET status='ACTIVE' WHERE principal_id='principal-b3'");
  });
  await t.test('existing privileged action requires verified and fresh MFA at request time',async()=>{
   const s=await issue();const raw=await new PostgreSqlSessionReader(pool).find(s.id);assert.ok(raw);
   const privileged={...request(s.id),action:'contact.reveal',reason:'approved-test-reason'};
   await assert.rejects(resolver().resolveAuthorized(privileged),{code:'REAUTHENTICATION_REQUIRED'});
   await unit.transaction({sessionId:'mfa-b3',expectedVersion:0},repo=>repo.create({...raw,id:'mfa-b3',assurance:'MFA',isMfaVerified:true,lastMfaVerifiedAt:instant}));
   assert.equal((await resolver().resolveAuthorized({...privileged,sessionId:'mfa-b3'})).isMfaVerified,true);
   await assert.rejects(resolver('2026-10-03T00:00:30.001Z').resolveAuthorized({...privileged,sessionId:'mfa-b3'}),{code:'REAUTHENTICATION_REQUIRED'});
  });
  await t.test('freshness revoked and historical unbound Sessions fail closed without inferred backfill',async()=>{
   const s=await issue();await assert.rejects(resolver('2026-10-03T00:01:00.000Z').resolveAuthorized(request(s.id)));await assert.rejects(resolver('2026-10-03T00:02:00.000Z').resolveAuthorized(request(s.id)));
   const raw=await new PostgreSqlSessionReader(pool).find(s.id);assert.ok(raw);
   await unit.transaction({sessionId:s.id,expectedVersion:1},async repo=>repo.appendRevocation(1,{sessionId:s.id,revokedAt:instant,revocationEvidenceRef:'revoked-b3',auditEvidenceRef:'revoked-audit-b3'}));await assert.rejects(resolver().resolveAuthorized(request(s.id)));
   const {tenantId:_tenant,teamId:_team,teamBindingOrigin:_origin,...legacy}=raw;
   void _tenant;void _team;void _origin;
   await unit.transaction({sessionId:'legacy-b3',expectedVersion:0},async repo=>repo.create({...legacy,id:'legacy-b3',tenantBindingOrigin:'historical-origin'}));await assert.rejects(resolver().resolveAuthorized(request('legacy-b3')));
   assert.equal((await new PostgreSqlSessionReader(pool).find('legacy-b3'))?.tenantId,undefined);
   await assert.rejects(migration.query("UPDATE app_identity.identity_sessions SET tenant_id='tenant-b3',team_id='chosen-team',team_binding_origin='EXPLICIT_TEAM_SELECTION_VALIDATED',payload_json=payload_json||$1::jsonb WHERE session_id='legacy-b3'",[JSON.stringify({tenantId:'tenant-b3',teamId:'chosen-team',tenantBindingOrigin:'AUTHENTICATED_PRINCIPAL_TENANT',teamBindingOrigin:'EXPLICIT_TEAM_SELECTION_VALIDATED'})]),{code:'55000'});
  });
  await t.test('eligibility removed between credential verify and issuance fails atomically',async()=>{
   const before=(await migration.query('SELECT count(*) FROM app_identity.identity_sessions')).rows;
   const base=new FirstPartyCredentialAuthenticationAdapter('tenant-b3',reader,crypto);
   const racing={verify:async(input:Parameters<typeof base.verify>[0])=>{const result=await base.verify(input);await mutate('ROLE_ASSIGNMENT','assignment-b3',{teamIds:['other-team']});return result;},revalidate:(...args:Parameters<typeof base.revalidate>)=>base.revalidate(...args)};
   await assert.rejects(service(unit,racing).createSession({evidence,requestedTeamId:'chosen-team',correlationId:'race'}));assert.deepEqual((await migration.query('SELECT count(*) FROM app_identity.identity_sessions')).rows,before);await mutate('ROLE_ASSIGNMENT','assignment-b3',{teamIds:['chosen-team']});
  });
  await t.test('Session insertion failure rolls back and releases client',async()=>{
   const before=(await migration.query('SELECT count(*) FROM app_identity.identity_sessions')).rows;
   const failing:AsyncSessionUnitOfWork={close:()=>unit.close(),transaction:(identity,operation,beforeOperation)=>unit.transaction(identity,repo=>operation({...repo,create:async record=>{await repo.create(record);throw new Error('injected insertion failure');}}),beforeOperation)};
   await assert.rejects(service(failing).createSession({evidence,requestedTeamId:'chosen-team',correlationId:'rollback'}));assert.deepEqual((await migration.query('SELECT count(*) FROM app_identity.identity_sessions')).rows,before);assert.equal(native.idleCount,1);
  });
  await t.test('selected team and assignment writers cannot commit before Session insertion',async()=>{
   const writer=new Client({...config,user:'ai_mls_production_migration_operator'});await writer.connect();
   const protectedUnit:AsyncSessionUnitOfWork={close:()=>unit.close(),transaction:(identity,operation,beforeOperation)=>unit.transaction(identity,async repo=>{
    for(const [type,id] of [['TEAM_SCOPE','chosen-team'],['ROLE_ASSIGNMENT','assignment-b3'],['ROLE','role-b3']]){
     await writer.query('BEGIN');await writer.query("SET LOCAL lock_timeout='40ms'");
     await assert.rejects(writer.query('SELECT 1 FROM app_administration.administration_revisions WHERE tenant_id=$1 AND resource_type=$2 AND resource_id=$3 FOR UPDATE',['tenant-b3',type,id]),{code:'55P03'});await writer.query('ROLLBACK');
    }
    return operation(repo);
   },beforeOperation)};
   try{await service(protectedUnit).createSession({evidence,requestedTeamId:'chosen-team',correlationId:'lock-race'});}finally{await writer.end();}
  });
  await t.test('principal and credential changes before issuance roll back exact tenant binding',async()=>{
   const before=(await migration.query('SELECT count(*) FROM app_identity.identity_sessions')).rows;
   for(const change of ["UPDATE app_identity.identity_human_principals SET status='DISABLED' WHERE principal_id='principal-b3'","UPDATE app_identity.identity_human_credentials SET status='REVOKED',revoked_at='2026-10-03',revocation_evidence_ref='b3-revoked' WHERE principal_id='principal-b3'"]){
    const base=new FirstPartyCredentialAuthenticationAdapter('tenant-b3',reader,crypto);
    const racing={verify:async(input:Parameters<typeof base.verify>[0])=>{const result=await base.verify(input);await migration.query(change);return result;},revalidate:(...args:Parameters<typeof base.revalidate>)=>base.revalidate(...args)};
    await assert.rejects(service(unit,racing).createSession({evidence,requestedTeamId:'chosen-team',correlationId:'principal-race'}));assert.deepEqual((await migration.query('SELECT count(*) FROM app_identity.identity_sessions')).rows,before);
    await migration.query("UPDATE app_identity.identity_human_principals SET status='ACTIVE' WHERE principal_id='principal-b3'");
    if(change.includes('identity_human_credentials')){await migration.query('TRUNCATE app_identity.identity_human_credentials');await migration.query("INSERT INTO app_identity.identity_human_credentials VALUES ('credential-b3','principal-b3',1,'PASSWORD','ARGON2ID','ARGON2ID_V1',$1,$2,'ACTIVE','2026-01-01',NULL,NULL)",[salt,key]);}
   }
   const wrongTenant=new FirstPartyCredentialAuthenticationAdapter('wrong-tenant',reader,crypto);
   await assert.rejects(service(unit,wrongTenant).createSession({evidence,requestedTeamId:'chosen-team',correlationId:'wrong-tenant'}));
  });
  await t.test('new assignment after shared-lock snapshot is not consumed',async()=>{
   const c=await pool.connect();try{await c.query('BEGIN');let inserted=false;
    const interleaved={query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{const result=await c.query<R>(sql,values);if(sql.includes('FOR SHARE OF rev,r')&&!inserted){inserted=true;await resource(migration,'ROLE_ASSIGNMENT','phantom-b3',{...assignment,roleAssignmentId:'phantom-b3',proposalId:'proposal-phantom-b3'},'APPROVE_ROLE_ASSIGNMENT');}return result;},release(){throw new Error('participant must not release');}};
    await assert.rejects(resolveExplicitTeamOnClient(interleaved,{tenantId:'tenant-b3',principalId:'principal-b3',requestedTeamId:'chosen-team'},clock()));assert.equal(inserted,true);
   }finally{await c.query('ROLLBACK');c.release();}
  });
  assert.equal(leaseCount,releaseCount);assert.equal(native.totalCount,1);
 }finally{await pool.close();await migration.end();}
});
