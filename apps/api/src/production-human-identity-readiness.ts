import type {AuditSink,Clock} from "../../../packages/security-contracts/src/index.js";
import type {PostgreSqlPoolPort} from "../../../modules/identity/src/postgresql-pool.js";
import {Argon2idV1Verifier} from "../../../modules/identity/src/first-party-credential-argon2.js";
import {FirstPartyCredentialAuthenticationAdapter} from "../../../modules/identity/src/first-party-credential-adapter.js";
import {FIRST_PARTY_ADAPTER_ID,FIRST_PARTY_ADAPTER_KIND,assertFirstPartyCredentialConfigRef} from "../../../modules/identity/src/first-party-credential-contracts.js";
import {PostgreSqlHumanCredentialReader} from "../../../modules/identity/src/first-party-credential-postgresql.js";
import {PostgreSqlSessionReader} from "../../../modules/identity/src/session-postgresql-persistence.js";
import {PostgreSqlAdministrationUnitOfWork} from "../../../modules/administration/src/administration-postgresql-persistence.js";
import {createAsyncAdministrationBackedAuthorizationService,type AsyncLiveAdministrationAuthorizationService} from "../../../modules/administration/src/live-assignment-adapter.js";
import {resolveExplicitTeamOnClient} from "../../../modules/administration/src/production-team-binding.js";
import {assertProductionSessionBinding} from "../../../modules/identity/src/production-session-binding.js";
import {createFirstPartyAuthenticationRegistration} from "./first-party-authentication-composition.js";
import {assertFirstPartyCredentialPersistenceReady} from "./first-party-authentication-readiness.js";
import {ProductionTrustedBindingResolver,ProductionPostAuthenticationBinding,assertFresh} from "./production-trusted-binding.js";
import {assertProductionSessionBindingPersistenceReady} from "./production-trusted-binding-readiness.js";
import {assertR3C2AggregateSchemasReady} from "./r3c2-aggregate-readiness.js";
import {parseProductionHumanFreshnessPolicy,type ProductionAuthenticationBinding} from "./production-human-identity-contracts.js";

export type HumanIdentityReadinessReason="AUTH_BINDING"|"AUTH_ADAPTER"|"ARGON2_RUNTIME"|"FRESHNESS_POLICY"|"HUMAN_PERSISTENCE"|"SESSION_PERSISTENCE"|"TRUSTED_BINDING"|"LIVE_AUTHORIZATION"|"COMPOSITION_INPUT";
export class HumanIdentityReadinessError extends Error{
 public constructor(public readonly reason:HumanIdentityReadinessReason){super('Production Human Identity readiness is unavailable.');this.name='HumanIdentityReadinessError';}
}
// Startup descriptor only: factory accepts trusted tenant context later, never at readiness.
export interface ProductionAuthenticationReadinessRegistration{
 readonly adapterId:string;readonly adapterKind:string;readonly environment:'PRODUCTION'|'STAGING';
 readonly implementation:typeof FirstPartyCredentialAuthenticationAdapter;
 readonly factory:typeof createFirstPartyAuthenticationRegistration;
 validateConfigurationReference(reference:unknown):void;
}
export interface ProductionHumanReadinessComponents{
 readonly registrations:readonly ProductionAuthenticationReadinessRegistration[];
 readonly crypto:Argon2idV1Verifier;
 readonly trustedBindingFactory:typeof ProductionTrustedBindingResolver|undefined;
 readonly authorization:Pick<AsyncLiveAdministrationAuthorizationService,'evaluate'|'evaluateWorkload'>|undefined;
 readonly assertPrincipalCredentialReady:()=>Promise<void>;
 readonly assertSessionReady:()=>Promise<void>;
 readonly assertTrustedBindingReady:()=>Promise<void>;
}
export async function validateProductionHumanIdentityReadiness(environment:Readonly<Record<string,string|undefined>>,bindings:readonly ProductionAuthenticationBinding[],components:ProductionHumanReadinessComponents):Promise<void>{
 await check('AUTH_BINDING',()=>{
  const binding=bindings?.[0];
  if(!Array.isArray(bindings)||bindings.length!==1||binding===undefined)throw new Error('binding');
  if(binding.adapterId!==FIRST_PARTY_ADAPTER_ID||binding.adapterKind!==FIRST_PARTY_ADAPTER_KIND)throw new Error('binding');
  assertFirstPartyCredentialConfigRef(binding.configurationRef);
  const registration=components?.registrations?.[0];
  if(!Array.isArray(components?.registrations)||components.registrations.length!==1||registration===undefined)throw new Error('registry');
  if(registration.environment!=='PRODUCTION'||registration.adapterId!==binding.adapterId||registration.adapterKind!==binding.adapterKind)throw new Error('registry');
  registration.validateConfigurationReference(binding.configurationRef);
 });
 await check('AUTH_ADAPTER',()=>{
  const registration=components.registrations[0]!;
  if(registration.implementation!==FirstPartyCredentialAuthenticationAdapter||registration.factory!==createFirstPartyAuthenticationRegistration
   ||typeof registration.implementation.prototype.verify!=='function'||typeof registration.implementation.prototype.revalidate!=='function')throw new Error('adapter');
 });
 await check('ARGON2_RUNTIME',()=>components.crypto.assertAvailable());
 await check('FRESHNESS_POLICY',()=>{parseProductionHumanFreshnessPolicy(environment);});
 await check('LIVE_AUTHORIZATION',()=>{if(typeof components.authorization?.evaluate!=='function'||typeof components.authorization.evaluateWorkload!=='function')throw new Error('authorization');});
 await check('TRUSTED_BINDING',()=>{if(components.trustedBindingFactory!==ProductionTrustedBindingResolver||typeof components.trustedBindingFactory.prototype.resolveAuthorized!=='function')throw new Error('binding');});
 await check('HUMAN_PERSISTENCE',components.assertPrincipalCredentialReady);
 await check('SESSION_PERSISTENCE',components.assertSessionReady);
 await check('TRUSTED_BINDING',components.assertTrustedBindingReady);
}
async function check(reason:HumanIdentityReadinessReason,operation:(()=>void|Promise<void>)|undefined):Promise<void>{
 try{if(typeof operation!=='function')throw new Error('missing dependency');await operation();}catch{throw new HumanIdentityReadinessError(reason);}
}
// Canonical PG_PRODUCTION_POOL is borrowed. No child owns or closes it, no tenant-bound object is created.
export function createProductionHumanReadinessComponents(pool:PostgreSqlPoolPort,clock:Clock,auditSink:AuditSink):ProductionHumanReadinessComponents{
 const principals=new PostgreSqlHumanCredentialReader(pool),sessions=new PostgreSqlSessionReader(pool),administration=new PostgreSqlAdministrationUnitOfWork(pool);
 const authorization=createAsyncAdministrationBackedAuthorizationService({...administration,clock,auditSink,policyVersion:'REL002-R3C3-FINAL'});
 return Object.freeze({
  registrations:Object.freeze([Object.freeze({adapterId:FIRST_PARTY_ADAPTER_ID,adapterKind:FIRST_PARTY_ADAPTER_KIND,environment:'PRODUCTION' as const,implementation:FirstPartyCredentialAuthenticationAdapter,factory:createFirstPartyAuthenticationRegistration,validateConfigurationReference:assertFirstPartyCredentialConfigRef})]),
  crypto:new Argon2idV1Verifier(),trustedBindingFactory:ProductionTrustedBindingResolver,authorization,
  assertPrincipalCredentialReady:():Promise<void>=>assertFirstPartyCredentialPersistenceReady(pool),
  assertSessionReady:async():Promise<void>=>{await assertProductionSessionBindingPersistenceReady(pool);await sessions.assertReadPathReady();},
  assertTrustedBindingReady:async():Promise<void>=>{
   if(typeof principals.capture!=='function'||typeof principals.findPrincipal!=='function'||typeof sessions.find!=='function'
    ||typeof administration.teamScopes.find!=='function'||typeof administration.roleAssignments.listBySubject!=='function'
    ||typeof resolveExplicitTeamOnClient!=='function'||typeof assertProductionSessionBinding!=='function'||typeof assertFresh!=='function'
    ||typeof ProductionPostAuthenticationBinding.prototype.resolve!=='function')throw new HumanIdentityReadinessError('TRUSTED_BINDING');
   await assertR3C2AggregateSchemasReady(pool);
  },
 });
}
