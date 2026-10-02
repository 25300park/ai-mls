import { createHash } from "node:crypto";
import { AsyncProductionServiceIdentityResolver, type ProductionPinnedServiceIdentityReference, type ProductionServiceIdentityBinding } from "./production-service-identity-resolver.js";
import type { AsyncRegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/registered-service-workload-postgresql.js";
import { assertIdentityEvidenceMatchesRegistration, type PostgreSqlIdentityWorkloadEvidenceReader } from "../../../modules/identity/src/identity-workload-evidence-postgresql.js";
import { assertBindingAuditEvidence, assertRegistrationAuditEvidence, type PostgreSqlAuditEvidenceStore } from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
import { assertWorkloadStartupBindingRecord, decodeCanonicalReference, type AsyncWorkloadStartupBindingPersistenceContract } from "../../../modules/identity/src/workload-startup-binding.js";
import { assertOrganizationGovernanceRecord, type AsyncOrganizationGovernanceReadContract } from "../../../modules/organization/src/organization-governance.js";
import { assertProjectGovernanceRecord, type AsyncProjectGovernanceReadContract } from "../../../modules/administration/src/project-governance.js";
import type { AsyncAdministrationUnitOfWork } from "../../../modules/administration/src/administration-async-persistence.js";
import type { AuthorizationDecision, WorkloadAuthorizationRequest } from "../../../modules/authorization/src/authorization-service.js";
import { startupAuthorizationResource, type WorkloadStartupTeamVerifier } from "../../../modules/identity/src/workload-startup-team-context.js";
import { canonicalJson, safeText } from "../../../modules/organization/src/governance-persistence-support.js";
export type ProductionStartupFailureStage="PINNED_WORKLOAD"|"IDENTITY_EVIDENCE"|"REGISTRATION_AUDIT"|"BINDING"|"BINDING_AUDIT"|"SERVICE_PRINCIPAL"|"ORGANIZATION"|"PROJECT"|"AUTHORIZATION_TEAM"|"TYPED_SCOPE"|"AUTHORIZATION"|"REVALIDATION"|"SCHEMA_READINESS";
export class ProductionStartupBindingError extends Error {
 public readonly code="PRODUCTION_STARTUP_BINDING_UNAVAILABLE";
 public constructor(public readonly stage:ProductionStartupFailureStage){super(`Production startup gate unavailable: ${stage}`);this.name="ProductionStartupBindingError";}
}
export interface ProductionStartupBindingResolverDependencies {
 readonly authority:AsyncRegisteredServiceWorkloadAuthorityLease;
 readonly identityEvidence:Pick<PostgreSqlIdentityWorkloadEvidenceReader,"findByEvidenceRef">;
 readonly auditEvidence:Pick<PostgreSqlAuditEvidenceStore,"findByEvidenceRef">;
 readonly bindings:Pick<AsyncWorkloadStartupBindingPersistenceContract,"findActive">;
 readonly organizations:AsyncOrganizationGovernanceReadContract;
 readonly projects:AsyncProjectGovernanceReadContract;
 readonly administration:Pick<AsyncAdministrationUnitOfWork,"teamScopes"|"policies"|"sourceGovernance"|"publicationTargets">;
 readonly teamVerifier:WorkloadStartupTeamVerifier;
 readonly authorization:{evaluateWorkload(request:WorkloadAuthorizationRequest):Promise<AuthorizationDecision>};
 readonly assertAggregateReady:()=>Promise<void>;
 readonly expectedWorkloadPurpose:string;readonly expectedAudience:string;
}
interface StartupSnapshot {
 identity:ProductionServiceIdentityBinding;
 proof:NonNullable<Awaited<ReturnType<PostgreSqlIdentityWorkloadEvidenceReader["findByEvidenceRef"]>>>;
 registrationAudit:NonNullable<Awaited<ReturnType<PostgreSqlAuditEvidenceStore["findByEvidenceRef"]>>>;
 binding:NonNullable<Awaited<ReturnType<AsyncWorkloadStartupBindingPersistenceContract["findActive"]>>>;
 activation:NonNullable<Awaited<ReturnType<PostgreSqlAuditEvidenceStore["findByEvidenceRef"]>>>;
 organization:NonNullable<Awaited<ReturnType<AsyncOrganizationGovernanceReadContract["findVersion"]>>>;
 project:NonNullable<Awaited<ReturnType<AsyncProjectGovernanceReadContract["findVersion"]>>>;
 scope:NonNullable<Awaited<ReturnType<AsyncAdministrationUnitOfWork["teamScopes"]["find"]|AsyncAdministrationUnitOfWork["policies"]["find"]|AsyncAdministrationUnitOfWork["sourceGovernance"]["find"]|AsyncAdministrationUnitOfWork["publicationTargets"]["find"]>>>;
 request:WorkloadAuthorizationRequest;
};
export class ProductionStartupBindingResolver {
 readonly #identity:AsyncProductionServiceIdentityResolver;
 public constructor(private readonly dependencies:ProductionStartupBindingResolverDependencies){this.#identity=new AsyncProductionServiceIdentityResolver(dependencies);}
 public async resolve(pin:ProductionPinnedServiceIdentityReference):Promise<Readonly<{status:"PASS";identity:ProductionServiceIdentityBinding;fingerprint:string}>> {
  const captured=await this.read(pin);await this.authorize(captured.request);
  await this.at("REVALIDATION",async()=>{const current=await this.read(pin);if(canonicalJson(current)!==canonicalJson(captured))throw Error("changed authority");await this.authorize(current.request);});
  await this.at("SCHEMA_READINESS",()=>this.dependencies.assertAggregateReady());
  // Readiness can yield; do not return a captured identity whose authority changed during it.
  await this.at("REVALIDATION",async()=>{const current=await this.read(pin);if(canonicalJson(current)!==canonicalJson(captured))throw Error("changed authority");await this.authorize(current.request);});
  return Object.freeze({status:"PASS",identity:captured.identity,fingerprint:createHash("sha256").update(canonicalJson(captured)).digest("hex")});
 }
 private async at<T>(stage:ProductionStartupFailureStage,operation:()=>Promise<T>):Promise<T>{try{return await operation();}catch{throw new ProductionStartupBindingError(stage);}}
 private async authorize(request:WorkloadAuthorizationRequest):Promise<void>{await this.at("AUTHORIZATION",async()=>{const decision=await this.dependencies.authorization.evaluateWorkload(request);if(decision?.effect!=="ALLOW")throw Error("authorization denied");});}
 private async read(pin:ProductionPinnedServiceIdentityReference):Promise<StartupSnapshot> {
  const d=this.dependencies;
  const identity=await this.at("PINNED_WORKLOAD",()=>this.#identity.resolve(pin));
  const proof=await this.at("IDENTITY_EVIDENCE",async()=>{const row=await d.identityEvidence.findByEvidenceRef(identity.identityEvidenceRef);assertIdentityEvidenceMatchesRegistration(row,{...identity});return row;});
  const registrationAudit=await this.at("REGISTRATION_AUDIT",async()=>{const row=await d.auditEvidence.findByEvidenceRef(identity.auditEvidenceRef);assertRegistrationAuditEvidence(row,{...identity});return row;});
  const binding=await this.at("BINDING",async()=>{
   const row=await d.bindings.findActive(identity.registrationId,identity.registrationVersion,identity.tenantId,identity.principalId);assertWorkloadStartupBindingRecord(row);
   if(row.status!=="ACTIVE"||row.registrationId!==identity.registrationId||row.registrationVersion!==identity.registrationVersion||row.tenantId!==identity.tenantId||row.principalId!==identity.principalId||row.identityEvidenceRef!==identity.identityEvidenceRef||!safeText(row.authorizationTeamId))throw Error("binding unavailable");return structuredClone(row);
  });
  const activation=await this.at("BINDING_AUDIT",async()=>{const row=await d.auditEvidence.findByEvidenceRef(binding.auditEvidenceRef);assertBindingAuditEvidence(row,{...binding});if(row.eventType!=="WORKLOAD_STARTUP_BINDING.ACTIVATED"||row.payloadSchemaVersion!==2)throw Error("activation unavailable");return row;});
  const organization=await this.at("ORGANIZATION",async()=>{const version=decodeCanonicalReference(binding.organizationEvidenceRef,"organization-governance",[binding.organizationId]);const row=await d.organizations.findVersion(binding.organizationId,version,binding.tenantId);assertOrganizationGovernanceRecord(row);if(row.organizationId!==binding.organizationId||row.organizationVersion!==version||row.tenantId!==binding.tenantId||row.status!=="ACTIVE")throw Error("organization unavailable");return row;});
  const project=await this.at("PROJECT",async()=>{const version=decodeCanonicalReference(binding.projectEvidenceRef,"project-governance",[binding.projectId]);const row=await d.projects.findVersion(binding.projectId,version,binding.tenantId);assertProjectGovernanceRecord(row);if(row.projectId!==binding.projectId||row.projectVersion!==version||row.organizationId!==organization.organizationId||row.tenantId!==binding.tenantId||row.status!=="ACTIVE"||!row.containedScopes.some(s=>s.scopeType===binding.scopeType&&s.scopeId===binding.scopeId))throw Error("project unavailable");return row;});
  await this.at("AUTHORIZATION_TEAM",()=>d.teamVerifier.assertTeamEligibility(binding));
  const scope=await this.at("TYPED_SCOPE",async()=>{
   const types={TEAM:"TEAM_SCOPE",POLICY:"POLICY",SOURCE:"SOURCE_REGISTRY",TARGET:"PUBLICATION_TARGET"} as const;const type=types[binding.scopeType];
   const version=decodeCanonicalReference(binding.scopeEvidenceRef,"administration-scope",[binding.tenantId,type,binding.scopeId]);const key={tenantId:binding.tenantId,resourceType:type,resourceId:binding.scopeId};
   const row=binding.scopeType==="TEAM"?await d.administration.teamScopes.find(key):binding.scopeType==="POLICY"?await d.administration.policies.find(key):binding.scopeType==="SOURCE"?await d.administration.sourceGovernance.find(key):await d.administration.publicationTargets.find(key);
   const id=row?.recordType==="TEAM_SCOPE"?row.teamId:row?.recordType==="POLICY"?row.policyId:row?.recordType==="SOURCE_REGISTRY"?row.sourceRegistryEntryId:row?.recordType==="PUBLICATION_TARGET"?row.publicationTargetId:undefined;
   if(row?.recordType!==type||id!==binding.scopeId||row.tenantId!==binding.tenantId||row.version!==version||row.status!=="ACTIVE"||(row.recordType==="TEAM_SCOPE"&&row.organizationId!==organization.organizationId))throw Error("scope unavailable");return row;
  });
  const request:WorkloadAuthorizationRequest={subject:{registrationId:identity.registrationId,registrationVersion:identity.registrationVersion,tenantId:identity.tenantId,principalId:identity.principalId,principalType:"SERVICE",assurance:"WORKLOAD",identityEvidenceRef:identity.identityEvidenceRef,auditEvidenceRef:identity.auditEvidenceRef},action:"scope.use",resource:startupAuthorizationResource({...binding},scope.version),purpose:identity.workloadPurpose,correlationId:`startup:${binding.bindingId}:${binding.bindingVersion}`};
  return structuredClone({identity,proof,registrationAudit,binding,activation,organization,project,scope,request});
 }
}
