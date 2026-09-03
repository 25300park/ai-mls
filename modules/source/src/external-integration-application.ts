import { createHash } from "node:crypto";
import { isAuthenticationAssuranceConsistent, type SessionContext } from "../../identity/src/session-service.js";
import { parseExternalIntegrationRequest, type ExternalIntegrationOperation, type ExternalIntegrationRequest, type ExternalIntegrationRequestKind } from "./external-integration-api-contracts.js";
import { ExternalIntegrationPersistenceError, type DurableExternalIntegrationStore, type ExternalIntegrationScope } from "./external-integration-durable-persistence.js";

export type ExternalIntegrationTrustedContext=Readonly<{session:SessionContext;tenantId:string;scopeType:"TENANT"|"TEAM"|"ORGANIZATION"|"SOURCE";scopeId:string;connectorId:string;sourceId?:string;purpose:string}>;
export interface ExternalIntegrationContextResolver{resolve(sessionId:string):ExternalIntegrationTrustedContext|undefined;}
export interface ExternalIntegrationAuthorizer{authorize(input:Readonly<{context:ExternalIntegrationTrustedContext;operation:ExternalIntegrationOperation;resourceId:string}>):boolean;}
export type GovernedIntegrationBinding=Readonly<{integrationContractId:string;providerNamespace:string;connectorId:string;sourceId?:string;governedBindingRef:string;evidenceRef:string}>;
export interface GovernedIntegrationBindingResolver{resolve(input:Readonly<{context:ExternalIntegrationTrustedContext;integrationContractId:string}>):GovernedIntegrationBinding|undefined;}
export type ExternalIntegrationUnresolvedConflictLink=Readonly<{integrationContractId:string;mappingId:string;observationId?:string;conflictEvidenceId:string;tenantId:string;scopeRef:string;evidenceRefs:readonly string[];createdBy:string;createdAt:string}>;
export interface ExternalIntegrationUnresolvedConflictCaseWriter{linkUnresolvedConflict(input:ExternalIntegrationUnresolvedConflictLink):void;}
export type ExternalIntegrationErrorCode="VALIDATION_FAILED"|"UNAUTHENTICATED"|"FORBIDDEN"|"NOT_FOUND"|"VERSION_CONFLICT"|"IDEMPOTENCY_CONFLICT"|"CONFLICT"|"INTERNAL_ERROR";
export type ExternalIntegrationApplicationResult=Readonly<{ok:true;operation:ExternalIntegrationOperation;data:Readonly<Record<string,unknown>>}>|Readonly<{ok:false;error:Readonly<{code:ExternalIntegrationErrorCode;message:string}>}>;

export class ExternalIntegrationEvidenceApplication{
 public constructor(private readonly dependencies:Readonly<{store:DurableExternalIntegrationStore;contextResolver:ExternalIntegrationContextResolver;authorizer:ExternalIntegrationAuthorizer;bindingResolver:GovernedIntegrationBindingResolver;clock:()=>string;unresolvedConflictCaseWriter:ExternalIntegrationUnresolvedConflictCaseWriter}>){}
 public execute(kind:ExternalIntegrationRequestKind,input:unknown,sessionId:string):ExternalIntegrationApplicationResult{
  let request:ExternalIntegrationRequest;try{request=parseExternalIntegrationRequest(kind,input);}catch{return error("VALIDATION_FAILED");}
  const now=this.dependencies.clock();let context:ExternalIntegrationTrustedContext|undefined;try{context=this.dependencies.contextResolver.resolve(sessionId);}catch{context=undefined;}
  if(!validContext(context,now))return error("UNAUTHENTICATED");
  const resourceId=stringValue(request,"integrationContractId")??stringValue(request,"mappingId")??stringValue(request,"externalObjectId")??"external-integration";
  try{if(!this.dependencies.authorizer.authorize({context,operation:request.operation,resourceId}))return error("FORBIDDEN");}catch{return error("FORBIDDEN");}
  try{return this.dispatch(request,context,now);}catch(caught){return mapError(caught);}
 }
 private dispatch(request:ExternalIntegrationRequest,context:ExternalIntegrationTrustedContext,now:string):ExternalIntegrationApplicationResult{
  const scope=scopeOf(context);
  if(request.operation==="ReadExternalMapping"){const mapping=stringValue(request,"mappingId")!==undefined?this.dependencies.store.readMappingById(scope,stringValue(request,"mappingId")!):this.dependencies.store.readMappingByExternal(scope,stringValue(request,"providerNamespace")!,stringValue(request,"externalObjectId")!);return mapping===undefined?error("NOT_FOUND"):success(request.operation,mappingView(mapping));}
  if(request.operation==="ReadIntegrationContract"){const value=this.dependencies.store.readContract(scope,stringValue(request,"integrationContractId")!);return value===undefined?error("NOT_FOUND"):success(request.operation,contractView(value));}
  const contractId=stringValue(request,"integrationContractId")!;const binding=this.dependencies.bindingResolver.resolve({context,integrationContractId:contractId});if(binding?.integrationContractId!==contractId||binding.connectorId!==context.connectorId||binding.sourceId!==context.sourceId)return error("FORBIDDEN");
  const requestedProvider=stringValue(request,"providerNamespace");if(requestedProvider!==undefined&&requestedProvider!==binding.providerNamespace)return error("CONFLICT");
  this.dependencies.store.provisionContract({...scope,integrationContractId:binding.integrationContractId,providerNamespace:binding.providerNamespace,governedBindingRef:binding.governedBindingRef,evidenceRef:binding.evidenceRef,provisionedAt:now});
  const fingerprint=hash(request);
  switch(request.operation){
   case "RegisterExternalMapping":{const value=this.dependencies.store.registerMapping({...scope,integrationContractId:contractId,providerNamespace:stringValue(request,"providerNamespace")!,externalObjectId:stringValue(request,"externalObjectId")!,internalResourceType:stringValue(request,"internalResourceType")!,internalResourceId:stringValue(request,"internalResourceId")!,expectedVersion:numberValue(request,"expectedVersion")??0,idempotencyKey:stringValue(request,"idempotencyKey")!,inputFingerprint:fingerprint,evidenceRef:stringValue(request,"evidenceRef")!,recordedAt:now});return success(request.operation,mappingView(value));}
   case "SubmitProviderObservation":{
    if(stringValue(request,"connectorId")!==context.connectorId||stringValue(request,"sourceId")!==context.sourceId)return error("CONFLICT");
    const expected=numberValue(request,"expectedMappingVersion");
    const value=this.dependencies.store.submitObservation({...scope,integrationContractId:contractId,observationId:stringValue(request,"observationId")!,providerNamespace:stringValue(request,"providerNamespace")!,externalObjectId:stringValue(request,"externalObjectId")!,observationType:stringValue(request,"observationType")!,normalizedFields:request["normalizedFields"] as Readonly<Record<string,string|number|boolean|null>>,observedAt:stringValue(request,"observedAt")!,idempotencyKey:stringValue(request,"idempotencyKey")!,inputFingerprint:fingerprint,...(expected===undefined?{}:{expectedMappingVersion:expected})});
    return success(request.operation,{observationId:value.observationId,...(value.mappingId===undefined?{}:{mappingId:value.mappingId}),mappingState:value.mappingState??"ACTIVE",technicalAcceptanceStatus:"ACCEPTED",evidenceRef:value.evidenceRef,observedAt:value.observedAt});
   }
   case "ReconcileIntegrationEvidence":{
    const value=this.dependencies.store.reconcileEvidence({...scope,integrationContractId:contractId,mappingId:stringValue(request,"mappingId")!,expectedVersion:numberValue(request,"expectedVersion")!,proofType:stringValue(request,"proofType")!,evidenceRefs:request["evidenceRefs"] as readonly string[],observationIds:(request["observationIds"] as readonly string[]|undefined)??[],idempotencyKey:stringValue(request,"idempotencyKey")!,inputFingerprint:fingerprint,recordedAt:now});
    if(value.reconciliationStatus==="UNRESOLVED_CONFLICT")this.dependencies.unresolvedConflictCaseWriter.linkUnresolvedConflict(Object.freeze({integrationContractId:value.integrationContractId,mappingId:value.mappingId,...(value.observationId===undefined?{}:{observationId:value.observationId}),conflictEvidenceId:value.technicalEvidenceId,tenantId:context.tenantId,scopeRef:`${context.scopeType.toLowerCase()}:${context.scopeId}`,evidenceRefs:Object.freeze([value.technicalEvidenceId]),createdBy:context.session.principalId,createdAt:now}));
    return success(request.operation,value);
   }
   case "SuspendIntegrationContract":{const value=this.dependencies.store.suspendContract({...scope,integrationContractId:contractId,expectedVersion:numberValue(request,"expectedVersion")!,idempotencyKey:stringValue(request,"idempotencyKey")!,inputFingerprint:fingerprint,reasonCode:stringValue(request,"reasonCode")!,evidenceRef:stringValue(request,"evidenceRef")!,recordedAt:now});return success(request.operation,contractView(value));}
  }
 }
}
function validContext(value:ExternalIntegrationTrustedContext|undefined,now:string):value is ExternalIntegrationTrustedContext{return value?.session.state==="ACTIVE"&&value.session.id.trim()!==""&&Date.parse(value.session.expiresAt)>Date.parse(now)&&Date.parse(value.session.absoluteExpiresAt)>Date.parse(now)&&isAuthenticationAssuranceConsistent(value.session)&&value.tenantId.trim()!==""&&value.scopeId.trim()!==""&&value.connectorId.trim()!==""&&value.purpose.trim()!=="";}
function scopeOf(c:ExternalIntegrationTrustedContext):ExternalIntegrationScope{return Object.freeze({tenantId:c.tenantId,scopeType:c.scopeType,scopeId:c.scopeId,connectorId:c.connectorId,...(c.sourceId===undefined?{}:{sourceId:c.sourceId})});}
function mappingView(v:Readonly<Record<string,unknown>>):Readonly<Record<string,unknown>>{return Object.freeze({mappingId:v["mappingId"],providerNamespace:v["providerNamespace"],externalObjectId:v["externalObjectId"],internalResourceType:v["internalResourceType"],internalResourceId:v["internalResourceId"],state:v["state"],version:v["version"],evidenceRef:v["evidenceRef"],createdAt:v["createdAt"],updatedAt:v["updatedAt"]});}
function contractView(v:Readonly<Record<string,unknown>>):Readonly<Record<string,unknown>>{return Object.freeze({integrationContractId:v["integrationContractId"],technicalStatus:v["status"],providerNamespace:v["providerNamespace"],connectorId:v["connectorId"],...(v["sourceId"]===undefined?{}:{sourceId:v["sourceId"]}),version:v["version"],evidenceRef:v["evidenceRef"],createdAt:v["createdAt"],updatedAt:v["updatedAt"]});}
function hash(v:unknown):string{return createHash("sha256").update(JSON.stringify(v)).digest("hex");}
function stringValue(v:Readonly<Record<string,unknown>>,key:string):string|undefined{return typeof v[key]==="string"?v[key]:undefined;}
function numberValue(v:Readonly<Record<string,unknown>>,key:string):number|undefined{return typeof v[key]==="number"?v[key]:undefined;}
function success(operation:ExternalIntegrationOperation,data:Readonly<Record<string,unknown>>):ExternalIntegrationApplicationResult{return Object.freeze({ok:true,operation,data:Object.freeze(data)});}
function error(code:ExternalIntegrationErrorCode):ExternalIntegrationApplicationResult{const message=code==="UNAUTHENTICATED"?"Authentication is required.":code==="FORBIDDEN"?"External integration operation is not permitted.":code==="NOT_FOUND"?"External integration resource is unavailable.":"External integration operation could not be completed.";return Object.freeze({ok:false,error:Object.freeze({code,message})});}
function mapError(caught:unknown):ExternalIntegrationApplicationResult{if(caught instanceof ExternalIntegrationPersistenceError){const code=caught.code==="PERSISTENCE_INPUT_INVALID"?"VALIDATION_FAILED":caught.code==="PERSISTENCE_UNAVAILABLE"?"INTERNAL_ERROR":caught.code;return error(code);}return error("INTERNAL_ERROR");}
