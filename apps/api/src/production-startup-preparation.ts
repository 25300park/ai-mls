import {randomUUID,createHash} from "node:crypto";
import type {PostgreSqlPoolPort} from "../../../modules/identity/src/postgresql-pool.js";
import {PostgreSqlRegisteredServiceWorkloadStore} from "../../../modules/identity/src/registered-service-workload-postgresql.js";
import {RegisteredServiceWorkloadEvidenceAuthorityAdapter} from "../../../modules/identity/src/registered-service-workload-evidence-authority.js";
import {PostgreSqlIdentityWorkloadEvidenceReader,assertIdentityEvidenceMatchesRegistration} from "../../../modules/identity/src/identity-workload-evidence-postgresql.js";
import {PostgreSqlAuditEvidenceStore,assertRegistrationAuditEvidence} from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
import {PostgreSqlWorkloadStartupBindingStore} from "../../../modules/identity/src/workload-startup-binding-postgresql.js";
import {PostgreSqlOrganizationGovernanceStore} from "../../../modules/organization/src/organization-governance-postgresql.js";
import {PostgreSqlProjectGovernanceStore} from "../../../modules/administration/src/project-governance-postgresql.js";
import {PostgreSqlAdministrationUnitOfWork} from "../../../modules/administration/src/administration-postgresql-persistence.js";
import {AdministrationWorkloadStartupTeamVerifier} from "../../../modules/identity/src/workload-startup-team-context.js";
import {createAsyncAdministrationBackedAuthorizationService} from "../../../modules/administration/src/live-assignment-adapter.js";
import {AuditLog} from "../../../modules/audit/src/audit-log.js";
import {canonicalJson,safeText} from "../../../modules/organization/src/governance-persistence-support.js";
import type {RailwayProductionRuntimeConfiguration} from "./production-runtime-configuration.js";
import type {ProductionServiceIdentityBinding,ProductionPinnedServiceIdentityReference} from "./production-service-identity-resolver.js";
import {ProductionStartupBindingResolver,ProductionStartupBindingError} from "./production-startup-binding-resolver.js";
import {assertR3C2AggregateSchemasReady,assertR3C2IdentityBaseReady} from "./r3c2-aggregate-readiness.js";
import type {AsyncRegisteredServiceWorkloadAuthorityLease} from "../../../modules/identity/src/registered-service-workload-postgresql.js";
import type {RegisteredServiceWorkloadRecord} from "../../../modules/identity/src/registered-service-workload.js";
import type {RegisteredServiceWorkloadIdentityEvidence,RegisteredServiceWorkloadAuditEvidence} from "../../../modules/identity/src/registered-service-workload-evidence-authority.js";
export interface ProductionStartupPreparation {
 readonly authority:AsyncRegisteredServiceWorkloadAuthorityLease;
 close():Promise<void>;
 resolveRequired():Promise<readonly ProductionServiceIdentityBinding[]>;
 validateStartupGate(identities:readonly ProductionServiceIdentityBinding[]):string;
}
export async function resolveStartupPins(resolver:Pick<ProductionStartupBindingResolver,"resolve">,pins:readonly ProductionPinnedServiceIdentityReference[]):Promise<{identities:readonly ProductionServiceIdentityBinding[];fingerprints:readonly string[]}>{
 const captured:Awaited<ReturnType<ProductionStartupBindingResolver["resolve"]>>[]=[],seen=new Set<string>();
 for(const pin of pins){if(seen.has(pin.registrationId))throw new ProductionStartupBindingError("PINNED_WORKLOAD");seen.add(pin.registrationId);captured.push(await resolver.resolve(pin));}
 for(const [index,pin] of pins.entries()){
  const current=await resolver.resolve(pin),previous=captured[index];
  if(current.fingerprint!==previous?.fingerprint||canonicalJson(current.identity)!==canonicalJson(previous.identity))throw new ProductionStartupBindingError("REVALIDATION");
 }
 return {identities:Object.freeze(captured.map(value=>Object.freeze(value.identity))),fingerprints:Object.freeze(captured.map(value=>value.fingerprint))};
}
export function createProductionStartupPreparation(pool:PostgreSqlPoolPort,configuration:Pick<RailwayProductionRuntimeConfiguration,"requiredServiceWorkloadPins"|"startupWorkloadPurpose"|"startupWorkloadAudience">,clock:()=>Date=()=>new Date()):ProductionStartupPreparation{
 if(!Array.isArray(configuration.requiredServiceWorkloadPins)||!configuration.requiredServiceWorkloadPins.length||!safeText(configuration.startupWorkloadPurpose)||!safeText(configuration.startupWorkloadAudience))throw new ProductionStartupBindingError("PINNED_WORKLOAD");
 const config=structuredClone(configuration);const proof=new PostgreSqlIdentityWorkloadEvidenceReader(pool),audit=new PostgreSqlAuditEvidenceStore(pool);
 const organizations=new PostgreSqlOrganizationGovernanceStore(pool),projects=new PostgreSqlProjectGovernanceStore(pool,organizations),administration=new PostgreSqlAdministrationUnitOfWork(pool);
 const bindings=new PostgreSqlWorkloadStartupBindingStore(pool,{assertBindingReferences:():Promise<void>=>Promise.reject(new ProductionStartupBindingError("BINDING"))});
 const store=new PostgreSqlRegisteredServiceWorkloadStore(pool,{assertRegisteredWorkloadEvidence:async(record:RegisteredServiceWorkloadRecord):Promise<void>=>{
  const identity=await proof.findByEvidenceRef(record.identityEvidenceRef);assertIdentityEvidenceMatchesRegistration(identity,{...record});
  const event=await audit.findByEvidenceRef(record.auditEvidenceRef);assertRegistrationAuditEvidence(event,{...record});
  const tuple={registrationId:record.registrationId,registrationVersion:record.registrationVersion,tenantId:record.tenantId,principalId:record.principalId,schemaVersion:1 as const,immutable:true as const};
  new RegisteredServiceWorkloadEvidenceAuthorityAdapter({findIdentityEvidence:(ref):RegisteredServiceWorkloadIdentityEvidence|undefined=>ref===identity.identityEvidenceRef?{...tuple,evidenceRef:identity.identityEvidenceRef}:undefined},{findFinalAuditEvidence:(ref):RegisteredServiceWorkloadAuditEvidence|undefined=>ref===event.auditEvidenceRef?{...tuple,evidenceRef:event.auditEvidenceRef,final:true}:undefined}).assertRegisteredWorkloadEvidence(record);
 }});
 let closed=false,receipt:{identities:readonly ProductionServiceIdentityBinding[];fingerprint:string}|undefined;
 const close=async():Promise<void>=>{closed=true;receipt=undefined;const results=await Promise.allSettled([store.close(),proof.close(),audit.close(),bindings.close(),projects.close(),organizations.close(),administration.close()]);if(results.some(r=>r.status==="rejected"))throw new ProductionStartupBindingError("REVALIDATION");};
 const authority:AsyncRegisteredServiceWorkloadAuthorityLease={findByRegistrationId:(id:string):Promise<Readonly<RegisteredServiceWorkloadRecord>|undefined>=>store.findByRegistrationId(id),assertSchemaReady:()=>assertR3C2IdentityBaseReady(pool),close};
 const resolver=new ProductionStartupBindingResolver({authority,identityEvidence:proof,auditEvidence:audit,bindings,organizations,projects,administration,teamVerifier:new AdministrationWorkloadStartupTeamVerifier(administration,clock),authorization:createAsyncAdministrationBackedAuthorizationService({...administration,auditSink:new AuditLog({clock,idFactory:randomUUID}),clock,policyVersion:"REL002-R3C2-scope.use"}),assertAggregateReady:():Promise<void>=>assertR3C2AggregateSchemasReady(pool),expectedWorkloadPurpose:config.startupWorkloadPurpose,expectedAudience:config.startupWorkloadAudience});
 return Object.freeze({authority,close,resolveRequired:async():Promise<readonly ProductionServiceIdentityBinding[]>=>{
  if(closed)throw new ProductionStartupBindingError("REVALIDATION");receipt=undefined;
  try{const {identities,fingerprints}=await resolveStartupPins(resolver,config.requiredServiceWorkloadPins);
   if(closed)throw new ProductionStartupBindingError("REVALIDATION");receipt={identities:Object.freeze(identities),fingerprint:createHash("sha256").update(canonicalJson({pins:config.requiredServiceWorkloadPins,fingerprints})).digest("hex")};return receipt.identities;
  }catch(error){await close();throw error;}
 },validateStartupGate:(identities:readonly ProductionServiceIdentityBinding[]):string=>{if(closed||!receipt||canonicalJson(identities)!==canonicalJson(receipt.identities))throw new ProductionStartupBindingError("REVALIDATION");return receipt.fingerprint;}});
}
