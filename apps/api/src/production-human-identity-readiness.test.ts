import assert from "node:assert/strict";
import test from "node:test";
import { Argon2idV1Verifier } from "../../../modules/identity/src/first-party-credential-argon2.js";
import { FirstPartyCredentialAuthenticationAdapter } from "../../../modules/identity/src/first-party-credential-adapter.js";
import { createFirstPartyAuthenticationRegistration } from "./first-party-authentication-composition.js";
import { assertFirstPartyCredentialConfigRef } from "../../../modules/identity/src/first-party-credential-contracts.js";
import { ProductionTrustedBindingResolver } from "./production-trusted-binding.js";
import { validateProductionHumanIdentityReadiness, HumanIdentityReadinessError, type ProductionHumanReadinessComponents } from "./production-human-identity-readiness.js";
const binding={adapterId:'ai-mls.identity.first-party-credential.v1',adapterKind:'FIRST_PARTY_CREDENTIAL',configurationRef:{schemaVersion:1,adapterId:'ai-mls.identity.first-party-credential.v1',algorithmProfile:'ARGON2ID_V1'}};
const environment={AI_MLS_HUMAN_IDLE_TIMEOUT_MILLISECONDS:'60000',AI_MLS_HUMAN_ABSOLUTE_LIFETIME_MILLISECONDS:'120000',AI_MLS_HUMAN_MFA_FRESHNESS_MILLISECONDS:'30000'};
function fixture():{calls:string[];components:ProductionHumanReadinessComponents}{
 const calls:string[]=[];
 return {calls,components:{registrations:[{adapterId:binding.adapterId,adapterKind:binding.adapterKind,environment:'PRODUCTION',implementation:FirstPartyCredentialAuthenticationAdapter,factory:createFirstPartyAuthenticationRegistration,validateConfigurationReference:assertFirstPartyCredentialConfigRef}],crypto:new Argon2idV1Verifier(),trustedBindingFactory:ProductionTrustedBindingResolver,
  assertPrincipalCredentialReady:()=>{calls.push('credential');return Promise.resolve();},assertSessionReady:()=>{calls.push('session');return Promise.resolve();},assertTrustedBindingReady:()=>{calls.push('trusted');return Promise.resolve();},authorization:{evaluate:()=>{throw new Error('No synthetic authorization');},evaluateWorkload:()=>{throw new Error('No synthetic workload');}}}};
}
test('tenant-independent Human readiness composes all components without selecting tenant principal or Session',async()=>{
 const f=fixture();await validateProductionHumanIdentityReadiness(environment,[binding],f.components);assert.deepEqual(f.calls,['credential','session','trusted']);
});
test('explicit binding and exact registry fail closed without defaults or Staging',async()=>{
 const f=fixture();
 for(const bindings of [[],[binding,binding],[{...binding,adapterId:'unknown'}],[{...binding,adapterKind:'wrong'}],[{...binding,configurationRef:undefined}],[{...binding,configurationRef:{...binding.configurationRef,password:'synthetic'}}]])await assert.rejects(validateProductionHumanIdentityReadiness(environment,bindings,f.components),{reason:'AUTH_BINDING'});
 const registration=f.components.registrations[0]!;
 for(const registrations of [[],[registration,registration],[{...registration,environment:'STAGING' as const}]])await assert.rejects(validateProductionHumanIdentityReadiness(environment,[binding],{...f.components,registrations}),HumanIdentityReadinessError);
});
test('explicit Production freshness has no default or Staging fallback',async()=>{
 const f=fixture();for(const key of Object.keys(environment)){
  const missing:Record<string,string|undefined>={...environment,[key]:undefined,IDLE_TIMEOUT_MILLISECONDS:'60000'};
  await assert.rejects(validateProductionHumanIdentityReadiness(missing,[binding],f.components),{reason:'FRESHNESS_POLICY'});
  await assert.rejects(validateProductionHumanIdentityReadiness({...environment,[key]:'1.5'},[binding],f.components),{reason:'FRESHNESS_POLICY'});
 }
});
test('Argon2 and missing trusted authorization dependencies fail closed with safe reasons',async()=>{
 const f=fixture();await assert.rejects(validateProductionHumanIdentityReadiness(environment,[binding],{...f.components,crypto:new Argon2idV1Verifier({})}),{reason:'ARGON2_RUNTIME'});
 await assert.rejects(validateProductionHumanIdentityReadiness(environment,[binding],{...f.components,trustedBindingFactory:undefined}),{reason:'TRUSTED_BINDING'});
 await assert.rejects(validateProductionHumanIdentityReadiness(environment,[binding],{...f.components,authorization:undefined}),{reason:'LIVE_AUTHORIZATION'});
});
test('persistence and composition failures are normalized and halt subsequent checks',async()=>{
 for(const [field,reason] of [['assertPrincipalCredentialReady','HUMAN_PERSISTENCE'],['assertSessionReady','SESSION_PERSISTENCE'],['assertTrustedBindingReady','TRUSTED_BINDING']] as const){
  const f=fixture();await assert.rejects(validateProductionHumanIdentityReadiness(environment,[binding],{...f.components,[field]:()=>Promise.reject(new Error('private salt configuration SQL'))}),error=>error instanceof HumanIdentityReadinessError&&error.reason===reason&&!error.message.includes('private'));
 }
});
