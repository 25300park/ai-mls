import type { AuditSink, Clock } from "../../../packages/security-contracts/src/index.js";
import { AuthorizationService, type AuthorizationRequest } from "../../../modules/authorization/src/authorization-service.js";
import { assertAllowed } from "../../../modules/identity/src/session-access-coordinator.js";
import { AdministrationLiveAssignmentAdapter } from "../../../modules/administration/src/live-assignment-adapter.js";
import { resolveExplicitTeamOnClient, resolveExplicitTeamAuthorityOnClient } from "../../../modules/administration/src/production-team-binding.js";
import { PostgreSqlHumanCredentialReader } from "../../../modules/identity/src/first-party-credential-postgresql.js";
import { PostgreSqlSessionReader, PostgreSqlSessionUnitOfWork } from "../../../modules/identity/src/session-postgresql-persistence.js";
import { assertProductionSessionBinding, type ProductionBoundSessionRecord } from "../../../modules/identity/src/production-session-binding.js";
import { AuthenticationError, type AuthenticatedIdentity, type PostAuthenticationBindingResolver, type SessionContext, type SessionIssuanceBinding } from "../../../modules/identity/src/session-service.js";
import { sessionEvidenceReference } from "../../../modules/identity/src/session-persistence.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import type { ProductionHumanFreshnessPolicy } from "./production-human-identity-contracts.js";
import { assertProductionSessionBindingPersistenceReady } from "./production-trusted-binding-readiness.js";
import { assertFirstPartyCredentialPersistenceReady } from "./first-party-authentication-readiness.js";
import { assertR3C2AggregateSchemasReady } from "./r3c2-aggregate-readiness.js";

function denied(): AuthenticationError { return new AuthenticationError("AUTHENTICATION_REQUIRED","Authentication required."); }
export class ProductionPostAuthenticationBinding implements PostAuthenticationBindingResolver {
  readonly #principal: PostgreSqlHumanCredentialReader;
  public constructor(pool:PostgreSqlPoolPort,private readonly expectedTenantId:string,private readonly clock:Clock){ this.#principal=new PostgreSqlHumanCredentialReader(pool); }
  public async resolve(identity:AuthenticatedIdentity,requestedTeamId:string|undefined,client:PostgreSqlClientPort):Promise<SessionIssuanceBinding>{
    try{
      if(identity.principalType!=="HUMAN" || requestedTeamId===undefined)throw denied();
      const principal=await this.#principal.findPrincipal(identity.principalId,client);
      if(principal?.status!=="ACTIVE" || principal.tenantId!==this.expectedTenantId)throw denied();
      await resolveExplicitTeamOnClient(client,{tenantId:this.expectedTenantId,principalId:identity.principalId,requestedTeamId},this.clock());
      return Object.freeze({tenantId:this.expectedTenantId,teamId:requestedTeamId,tenantBindingOrigin:"AUTHENTICATED_PRINCIPAL_TENANT",teamBindingOrigin:"EXPLICIT_TEAM_SELECTION_VALIDATED"});
    }catch{throw denied();}
  }
}
export interface ProductionTrustedBindingOptions {
  readonly pool:PostgreSqlPoolPort;
  readonly expectedTenantId:string;
  readonly freshness:ProductionHumanFreshnessPolicy;
  readonly clock:Clock;
  readonly auditSink:AuditSink;
  readonly authorizationPolicyVersion:string;
}
export type ProductionAuthorizedSessionRequest = Omit<AuthorizationRequest,"session"> & {readonly sessionId:string};
export class ProductionTrustedBindingResolver {
  readonly #sessions:PostgreSqlSessionReader;
  readonly #principal:PostgreSqlHumanCredentialReader;
  readonly #unit:PostgreSqlSessionUnitOfWork;
  public constructor(private readonly options:ProductionTrustedBindingOptions){
    if(!exactId(options.expectedTenantId) || !validFreshness(options.freshness) || typeof options.clock!=="function"
      || typeof options.auditSink?.append!=="function" || !exactId(options.authorizationPolicyVersion) || typeof options.pool?.connect!=="function")throw denied();
    this.options=Object.freeze({...options,freshness:Object.freeze({...options.freshness})});
    this.#sessions=new PostgreSqlSessionReader(options.pool);
    this.#principal=new PostgreSqlHumanCredentialReader(options.pool);
    this.#unit=new PostgreSqlSessionUnitOfWork(options.pool);
  }
  public async assertReady():Promise<void>{
    try{await assertProductionSessionBindingPersistenceReady(this.options.pool);await assertFirstPartyCredentialPersistenceReady(this.options.pool);await assertR3C2AggregateSchemasReady(this.options.pool);await this.#sessions.assertReadPathReady();}catch{throw denied();}
  }
  public async resolveAuthorized(request:ProductionAuthorizedSessionRequest):Promise<SessionContext>{
    if(!exactId(request.sessionId) || request.resource.tenantId!==this.options.expectedTenantId)throw denied();
    let client:PostgreSqlClientPort|undefined;
    try{
      const initial=await this.#sessions.find(request.sessionId);
      if(initial===undefined)throw denied();
      return await this.#unit.transaction({sessionId:initial.id,expectedVersion:initial.sessionVersion},async sessions=>{
        const record=await sessions.find(request.sessionId);
        assertProductionSessionBinding(record,this.options.expectedTenantId);
        const now=this.options.clock();
        assertFresh(record,now,this.options.freshness);
        if(request.resource.teamId!==undefined && request.resource.teamId!==record.teamId)throw denied();
        if(client===undefined)throw denied();
        await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",[`identity-human-credential:${record.principalId}`]);
        const principal=await this.#principal.findPrincipal(record.principalId,client);
        if(principal?.status!=="ACTIVE" || principal.tenantId!==record.tenantId)throw denied();
        const {roles,repositories:authority}=await resolveExplicitTeamAuthorityOnClient(client,{tenantId:record.tenantId,principalId:record.principalId,requestedTeamId:record.teamId},now);
        const authorization=new AuthorizationService({liveAssignmentResolver:new AdministrationLiveAssignmentAdapter(authority),auditSink:this.options.auditSink,clock:this.options.clock,policyVersion:this.options.authorizationPolicyVersion});
        const session=projectSession(record,roles,this.options.freshness);
        const {sessionId:_sessionId,...authorizationRequest}=request;
        void _sessionId;
        const decision=authorization.evaluate({...authorizationRequest,session});
        assertAllowed(decision);
        if(decision.obligations.includes("MFA") && !hasFreshProductionMfa(record,now,this.options.freshness))throw new AuthenticationError("REAUTHENTICATION_REQUIRED","Reauthentication is required.");
        const updated={...record,lastAccessedAt:now.toISOString(),sessionVersion:record.sessionVersion+1};
        await sessions.update(record.sessionVersion,updated);
        return projectSession(updated,roles,this.options.freshness);
      },transactionClient=>{client=transactionClient;return Promise.resolve();});
    }catch(error){if(error instanceof AuthenticationError)throw error;throw denied();}
  }
}
export function assertFresh(record:ProductionBoundSessionRecord,now:Date,policy:ProductionHumanFreshnessPolicy):void{
  const current=now.getTime(),issued=Date.parse(record.issuedAt),access=Date.parse(record.lastAccessedAt);
  if(record.state!=="ACTIVE" || !Number.isFinite(current) || !Number.isFinite(issued) || !Number.isFinite(access)
    || current<issued || current<access || current-issued>=policy.ABSOLUTE_LIFETIME_MILLISECONDS || current-access>=policy.IDLE_TIMEOUT_MILLISECONDS)throw denied();
}
export function hasFreshProductionMfa(record:ProductionBoundSessionRecord,now:Date,policy:ProductionHumanFreshnessPolicy):boolean{
  const last=Date.parse(record.lastMfaVerifiedAt??"");
  return record.assurance==="MFA" && record.isMfaVerified && Number.isFinite(last) && now.getTime()>=last && now.getTime()-last<=policy.MFA_FRESHNESS_MILLISECONDS;
}
function projectSession(record:ProductionBoundSessionRecord,roles:SessionContext['roles'],policy:ProductionHumanFreshnessPolicy):SessionContext{
  const expiry=new Date(Date.parse(record.issuedAt)+policy.ABSOLUTE_LIFETIME_MILLISECONDS).toISOString();
  const snapshot={...record,id:sessionEvidenceReference(record.id),familyId:sessionEvidenceReference(record.familyId),refreshReference:"[PROTECTED]",roles,authenticatedAt:record.issuedAt,expiresAt:expiry,absoluteExpiresAt:expiry};
  return Object.freeze(snapshot);
}
function validFreshness(policy:ProductionHumanFreshnessPolicy):boolean{return policy!==undefined && [policy.IDLE_TIMEOUT_MILLISECONDS,policy.ABSOLUTE_LIFETIME_MILLISECONDS,policy.MFA_FRESHNESS_MILLISECONDS].every(value=>Number.isSafeInteger(value)&&value>0);}
function exactId(value:unknown):value is string{return typeof value==="string" && value.length>0 && value.length<=512 && value.trim()===value && !/[\u0000-\u001f\u007f\\]/u.test(value);}
