import { createHash } from "node:crypto";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
import type { AsyncExternalIntegrationPersistence } from "./external-integration-async-persistence.js";
import { ExternalIntegrationPersistenceError, type DurableExternalIntegrationStore, type ExternalIntegrationScope, type IntegrationContract, type ExternalMapping, type ProviderObservation, type ExternalIntegrationEvidence, type ExternalIntegrationReconciliationResult, type ExternalIntegrationPersistenceErrorCode } from "./external-integration-durable-persistence.js";

const COLUMNS="tenant_id,scope_type,scope_id,connector_id,source_id";
const WHERE="tenant_id=? AND scope_type=? AND scope_id=? AND connector_id=? AND source_id=?";

/** API-019 repository; the supplied pool remains owned by ProductionBootstrap. */
export class PostgreSqlExternalIntegrationStore implements AsyncExternalIntegrationPersistence {
 #closed=false; #quarantined=false; #active=0; #closing:Promise<void>|undefined; #drained:(()=>void)|undefined;
 public constructor(private readonly pool: PostgreSqlPoolPort) {}
 public async provisionContract(...args: Parameters<DurableExternalIntegrationStore["provisionContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["provisionContract"]>> { return this.run(true, async (tx) => { return tx.provisionContract(...args); }); }
 public async readContract(...args: Parameters<DurableExternalIntegrationStore["readContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["readContract"]>> { return this.run(false, async (tx) => { return tx.readContract(...args); }); }
 public async suspendContract(...args: Parameters<DurableExternalIntegrationStore["suspendContract"]>): Promise<ReturnType<DurableExternalIntegrationStore["suspendContract"]>> { return this.run(true, async (tx) => { await tx.lockContract(args[0],args[0].integrationContractId); return tx.suspendContract(...args); }); }
 public async registerMapping(...args: Parameters<DurableExternalIntegrationStore["registerMapping"]>): Promise<ReturnType<DurableExternalIntegrationStore["registerMapping"]>> { const result=await this.run(true, async (tx) => { await tx.lockContract(args[0],args[0].integrationContractId); return tx.registerMapping(...args); });if(result===undefined)throw failure("CONFLICT","External identity conflicts.");return result; }
 public async readMappingById(...args: Parameters<DurableExternalIntegrationStore["readMappingById"]>): Promise<ReturnType<DurableExternalIntegrationStore["readMappingById"]>> { return this.run(false, async (tx) => { return tx.readMappingById(...args); }); }
 public async readMappingByExternal(...args: Parameters<DurableExternalIntegrationStore["readMappingByExternal"]>): Promise<ReturnType<DurableExternalIntegrationStore["readMappingByExternal"]>> { return this.run(false, async (tx) => { return tx.readMappingByExternal(...args); }); }
 public async submitObservation(...args: Parameters<DurableExternalIntegrationStore["submitObservation"]>): Promise<ReturnType<DurableExternalIntegrationStore["submitObservation"]>> { return this.run(true, async (tx) => { await tx.lockContract(args[0],args[0].integrationContractId); return tx.submitObservation(...args); }); }
 public async reconcileEvidence(...args: Parameters<DurableExternalIntegrationStore["reconcileEvidence"]>): Promise<ReturnType<DurableExternalIntegrationStore["reconcileEvidence"]>> { return this.run(true, async (tx) => { await tx.lockContract(args[0],args[0].integrationContractId); return tx.reconcileEvidence(...args); }); }
 public async listObservations(...args: Parameters<DurableExternalIntegrationStore["listObservations"]>): Promise<ReturnType<DurableExternalIntegrationStore["listObservations"]>> { return this.run(false, async (tx) => { return tx.listObservations(...args); }); }
 public async listEvidence(...args: Parameters<DurableExternalIntegrationStore["listEvidence"]>): Promise<ReturnType<DurableExternalIntegrationStore["listEvidence"]>> { return this.run(false, async (tx) => { return tx.listEvidence(...args); }); }
 public async close(): Promise<void> { this.#closed=true;if(this.#active===0)return;await (this.#closing??=new Promise<void>(resolve=>{this.#drained=resolve;})); }
 private async run<T>(mutation:boolean, work:(tx: ExternalTransaction)=>Promise<T>):Promise<T> {
  if(this.#closed||this.#quarantined)throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is unavailable.");
  this.#active++;
  let client:PostgreSqlClientPort|undefined;let open=false;let commitStarted=false;let destroy=false;
  try { client=await this.pool.connect();if(this.#quarantined)throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is unavailable.");if(mutation){await client.query("BEGIN");open=true;}const result=await work(new ExternalTransaction(client));if(mutation){if(this.#quarantined)throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is unavailable.");commitStarted=true;await client.query("COMMIT");open=false;}return result; }
  catch(error){if(commitStarted){this.#quarantined=true;destroy=true;}else if(open&&client!==undefined){try{await client.query("ROLLBACK");open=false;}catch{this.#quarantined=true;destroy=true;}}
   if(error instanceof ExternalIntegrationPersistenceError&&!commitStarted&&!destroy)throw error;
   if(!commitStarted&&!destroy&&typeof error==="object"&&error!==null&&"code" in error&&error.code==="23505")throw failure("IDEMPOTENCY_CONFLICT","External integration identity conflicts.");
   throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is unavailable.");
  }finally{try{client?.release(destroy);}finally{this.#active--;if(this.#active===0)this.#drained?.();}}
 }
}

class ExternalTransaction {
 public constructor(private readonly client:PostgreSqlClientPort) {}
 public async lockContract(scope:ExternalIntegrationScope,id:string):Promise<void>{validateScope(scope);validateText(id);await this.query("SELECT contract_id FROM ext_contracts WHERE "+WHERE+" AND contract_id=? FOR UPDATE",...values(scope),id);}
 private async query(sql:string,...args:unknown[]):Promise<{rows:readonly Record<string,unknown>[];rowCount:number}> {
  let text=sql;
  let index=0;text=text.replace(/\?/g,()=>"$"+(++index)).replace(/\bext_(contracts|mappings|observations|idempotency|evidence)\b/g,"app_external_integration.ext_$1");
  return this.client.query(text,args);
 }
 private async transaction<T>(work:()=>Promise<T>):Promise<T>{return work();}
 private async nextOrdinal(scope:ExternalIntegrationScope,contractId:string,table:"ext_observations"|"ext_evidence"):Promise<number>{
  const result=await this.query("SELECT COALESCE(MAX(ordinal),0)+1 AS ordinal FROM "+table+" WHERE "+WHERE+" AND contract_id=?",...values(scope),contractId);
  const ordinal=Number(result.rows[0]?.["ordinal"]);if(!Number.isSafeInteger(ordinal)||ordinal<=0)throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is unavailable.");return ordinal;
 }
 public async provisionContract(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;providerNamespace:string;governedBindingRef:string;evidenceRef:string;provisionedAt:string}>):Promise<IntegrationContract> {
    validateScope(input); validateText(input.integrationContractId,input.providerNamespace,input.governedBindingRef,input.evidenceRef,input.provisionedAt);
    return this.transaction(async ()=>{
      const current=(await this.readContract(input,input.integrationContractId));
      if(current!==undefined){ if(current.providerNamespace!==input.providerNamespace||current.connectorId!==input.connectorId||current.sourceId!==input.sourceId||current.governedBindingRef!==input.governedBindingRef) throw failure("CONFLICT","Integration contract binding conflicts."); return current; }
      const value:IntegrationContract=Object.freeze({...copyScope(input),integrationContractId:input.integrationContractId,providerNamespace:input.providerNamespace,governedBindingRef:input.governedBindingRef,status:"ACTIVE",version:1,evidenceRef:input.evidenceRef,createdAt:input.provisionedAt,updatedAt:input.provisionedAt});
      (await this.query("INSERT INTO ext_contracts("+COLUMNS+",contract_id,version,status,payload_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING", ...values(input),input.integrationContractId,1,"ACTIVE",JSON.stringify(value)));
      const stored=await this.readContract(input,input.integrationContractId); if(stored===undefined)throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is unavailable.");if(stored.providerNamespace!==input.providerNamespace||stored.governedBindingRef!==input.governedBindingRef)throw failure("CONFLICT","Integration contract binding conflicts.");return stored;
    });
  }
 public async readContract(scope:ExternalIntegrationScope,id:string):Promise<IntegrationContract|undefined> {
     validateScope(scope); validateText(id);
    const row=(await this.query("SELECT payload_json FROM ext_contracts WHERE "+WHERE+" AND contract_id=?", ...values(scope),id)).rows[0];
    return row===undefined?undefined:parse<IntegrationContract>(String(row["payload_json"]));
  }
 public async suspendContract(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;expectedVersion:number;idempotencyKey:string;inputFingerprint:string;reasonCode:string;evidenceRef:string;recordedAt:string}>):Promise<IntegrationContract> {
    validateMutation(input); const replay=(await this.replay<IntegrationContract>(input,input.idempotencyKey,input.inputFingerprint)); if(replay!==undefined)return replay;
    return this.transaction(async ()=>{
      const current=(await this.requireContract(input,input.integrationContractId)); if(current.version!==input.expectedVersion)throw failure("VERSION_CONFLICT","Integration contract changed.");
      if(current.status==="SUSPENDED")throw failure("CONFLICT","Integration contract is already suspended.");
      const next:IntegrationContract=Object.freeze({...current,status:"SUSPENDED",version:current.version+1,evidenceRef:input.evidenceRef,updatedAt:input.recordedAt});
      const changed=(await this.query("UPDATE ext_contracts SET version=?,status='SUSPENDED',payload_json=? WHERE "+WHERE+" AND contract_id=? AND version=?", next.version,JSON.stringify(next),...values(input),input.integrationContractId,current.version));
      if(Number(changed.rowCount)!==1)throw failure("VERSION_CONFLICT","Integration contract changed.");
      (await this.appendEvidence(input,input.integrationContractId,undefined,"CONTRACT_SUSPENDED",input.reasonCode,[input.evidenceRef],input.recordedAt)); (await this.remember(input,input.idempotencyKey,input.inputFingerprint,next)); return next;
    });
  }
 public async registerMapping(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;providerNamespace:string;externalObjectId:string;internalResourceType:string;internalResourceId:string;expectedVersion:number;idempotencyKey:string;inputFingerprint:string;evidenceRef:string;recordedAt:string}>):Promise<ExternalMapping|undefined> {
    validateMutation(input); const replay=(await this.replay<ExternalMapping>(input,input.idempotencyKey,input.inputFingerprint)); if(replay!==undefined)return replay;
    const result=await this.transaction(async ()=>{
      (await this.requireActiveContract(input,input.integrationContractId,input.providerNamespace));
      const current=(await this.readMappingByExternal(input,input.providerNamespace,input.externalObjectId));
      if(current!==undefined&&current.integrationContractId!==input.integrationContractId)throw failure("CONFLICT","Integration contract binding conflicts.");
      if(current!==undefined&&(current.internalResourceType!==input.internalResourceType||current.internalResourceId!==input.internalResourceId)){(await this.appendEvidence(input,input.integrationContractId,current.mappingId,"MAPPING_CONFLICT","EXTERNAL_IDENTITY_CONFLICT",[input.evidenceRef],input.recordedAt));return undefined;}
      if((current?.version??0)!==input.expectedVersion)throw failure("VERSION_CONFLICT","External mapping changed.");
      const mappingId=current?.mappingId??stableId("mapping",[input.tenantId,input.scopeId,input.providerNamespace,input.externalObjectId]);
      const value:ExternalMapping=Object.freeze({...copyScope(input),integrationContractId:input.integrationContractId,mappingId,providerNamespace:input.providerNamespace,externalObjectId:input.externalObjectId,internalResourceType:input.internalResourceType,internalResourceId:input.internalResourceId,state:"ACTIVE",version:input.expectedVersion+1,evidenceRef:input.evidenceRef,createdAt:current?.createdAt??input.recordedAt,updatedAt:input.recordedAt});
      const changed=(await this.query("INSERT INTO ext_mappings("+COLUMNS+",mapping_id,contract_id,provider_namespace,external_object_id,version,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT("+COLUMNS+",mapping_id) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json WHERE ext_mappings.version=?", ...values(input),mappingId,input.integrationContractId,input.providerNamespace,input.externalObjectId,value.version,JSON.stringify(value),input.expectedVersion));
      if(changed.rowCount!==1)throw failure("VERSION_CONFLICT","External mapping changed.");
      (await this.appendEvidence(input,input.integrationContractId,mappingId,"MAPPING_RECORDED","MAPPING_ACCEPTED",[input.evidenceRef],input.recordedAt)); (await this.remember(input,input.idempotencyKey,input.inputFingerprint,value)); return value;
    });
    return result;
  }
 public async readMappingById(scope:ExternalIntegrationScope,id:string):Promise<ExternalMapping|undefined> { return (await this.readMapping(scope,"mapping_id=?",[id])); }
 public async readMappingByExternal(scope:ExternalIntegrationScope,provider:string,externalId:string):Promise<ExternalMapping|undefined> { return (await this.readMapping(scope,"provider_namespace=? AND external_object_id=?",[provider,externalId])); }
 public async submitObservation(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;observationId:string;providerNamespace:string;externalObjectId:string;observationType:string;normalizedFields:Readonly<Record<string,string|number|boolean|null>>;observedAt:string;idempotencyKey:string;inputFingerprint:string;expectedMappingVersion?:number}>):Promise<ProviderObservation> {
    validateScope(input); validateText(input.integrationContractId,input.observationId,input.providerNamespace,input.externalObjectId,input.observationType,input.observedAt,input.idempotencyKey,input.inputFingerprint);
    const replay=(await this.replay<ProviderObservation>(input,input.idempotencyKey,input.inputFingerprint));if(replay!==undefined)return replay;
    const existingRow=(await this.query("SELECT fingerprint,payload_json FROM ext_observations WHERE "+WHERE+" AND provider_namespace=? AND observation_id=?", ...values(input),input.providerNamespace,input.observationId)).rows[0];
    if(existingRow!==undefined){if(String(existingRow["fingerprint"])!==input.inputFingerprint)throw failure("IDEMPOTENCY_CONFLICT","Observation identity conflicts.");return parse<ProviderObservation>(String(existingRow["payload_json"]));}
    return this.transaction(async ()=>{
      (await this.requireActiveContract(input,input.integrationContractId,input.providerNamespace)); const mapping=(await this.readMappingByExternal(input,input.providerNamespace,input.externalObjectId));
      if(mapping!==undefined&&mapping.integrationContractId!==input.integrationContractId)throw failure("CONFLICT","Integration contract binding conflicts.");
      if(input.expectedMappingVersion!==undefined&&(mapping?.version??0)!==input.expectedMappingVersion)throw failure("VERSION_CONFLICT","External mapping changed.");
      const evidenceRef="evidence:observation:"+input.observationId;
      const value:ProviderObservation=Object.freeze({...copyScope(input),integrationContractId:input.integrationContractId,observationId:input.observationId,providerNamespace:input.providerNamespace,externalObjectId:input.externalObjectId,observationType:input.observationType,normalizedFields:Object.freeze({...input.normalizedFields}),observedAt:input.observedAt,...(mapping===undefined?{}:{mappingId:mapping.mappingId,mappingState:mapping.state}),evidenceRef});
      (await this.query("INSERT INTO ext_observations("+COLUMNS+",provider_namespace,observation_id,contract_id,ordinal,fingerprint,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)", ...values(input),input.providerNamespace,input.observationId,input.integrationContractId,await this.nextOrdinal(input,input.integrationContractId,"ext_observations"),input.inputFingerprint,JSON.stringify(value)));
      (await this.appendEvidence(input,input.integrationContractId,mapping?.mappingId,"OBSERVATION_RECORDED","OBSERVATION_ACCEPTED",[evidenceRef],input.observedAt));(await this.remember(input,input.idempotencyKey,input.inputFingerprint,value)); return value;
    });
  }
 public async reconcileEvidence(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;mappingId:string;expectedVersion:number;proofType:string;evidenceRefs:readonly string[];observationIds:readonly string[];idempotencyKey:string;inputFingerprint:string;recordedAt:string}>):Promise<ExternalIntegrationReconciliationResult> {
    validateScope(input);validateText(input.integrationContractId,input.mappingId,input.proofType,input.idempotencyKey,input.inputFingerprint,input.recordedAt,...input.evidenceRefs,...input.observationIds);
    type Result=ExternalIntegrationReconciliationResult; const replay=(await this.replay<Result>(input,input.idempotencyKey,input.inputFingerprint));if(replay!==undefined)return replay;
    return this.transaction(async ()=>{
      (await this.requireActiveContract(input,input.integrationContractId));const mapping=(await this.readMappingById(input,input.mappingId));if(mapping?.integrationContractId!==input.integrationContractId)throw failure("NOT_FOUND","External mapping is unavailable.");if(mapping.version!==input.expectedVersion)throw failure("VERSION_CONFLICT","External mapping changed.");
      const observations=(await this.listObservations(input,input.integrationContractId));const applicable=input.observationIds.map(id=>observations.find(item=>item.observationId===id));if(applicable.some(item=>item===undefined))throw failure("NOT_FOUND","Provider observation is unavailable.");if(applicable.some(item=>item?.mappingId!==input.mappingId))throw failure("CONFLICT","Provider observation binding conflicts.");
      const known=new Set((await this.listEvidence(input,input.integrationContractId)).flatMap(item=>item.evidenceRefs));const accepted=Object.freeze(input.evidenceRefs.filter(ref=>known.has(ref)));const confirmed=accepted.length===input.evidenceRefs.length;
      const reconciliationStatus=confirmed?"CONFIRMED_TECHNICAL_MATCH" as const:"UNRESOLVED_CONFLICT" as const;
      const reasonCode=confirmed?"TECHNICAL_MATCH_CONFIRMED":"F19_HANDOFF_REQUIRED";
      const evidence=(await this.appendEvidence(input,input.integrationContractId,input.mappingId,"TECHNICAL_RECONCILIATION",reasonCode,accepted,input.recordedAt));
      const observationId=input.observationIds[0];
      const value=Object.freeze({integrationContractId:input.integrationContractId,mappingId:input.mappingId,...(observationId===undefined?{}:{observationId}),reconciliationStatus,mappingState:mapping.state,version:mapping.version,acceptedEvidenceRefs:accepted,technicalEvidenceId:evidence.evidenceId,reasonCode,updatedAt:input.recordedAt});
      (await this.remember(input,input.idempotencyKey,input.inputFingerprint,value));return value;
    });
  }
 public async listObservations(scope:ExternalIntegrationScope,contractId:string):Promise<readonly ProviderObservation[]> {return Object.freeze((await this.query("SELECT payload_json FROM ext_observations WHERE "+WHERE+" AND contract_id=? ORDER BY ordinal", ...values(scope),contractId)).rows.map(row=>parse<ProviderObservation>(String(row["payload_json"]))));}
 public async listEvidence(scope:ExternalIntegrationScope,contractId:string):Promise<readonly ExternalIntegrationEvidence[]> {return Object.freeze((await this.query("SELECT payload_json FROM ext_evidence WHERE "+WHERE+" AND contract_id=? ORDER BY ordinal", ...values(scope),contractId)).rows.map(row=>parse<ExternalIntegrationEvidence>(String(row["payload_json"]))));}
 private async readMapping(scope:ExternalIntegrationScope,clause:string,args:readonly string[]):Promise<ExternalMapping|undefined> {validateScope(scope);const row=(await this.query("SELECT payload_json FROM ext_mappings WHERE "+WHERE+" AND "+clause, ...values(scope),...args)).rows[0];return row===undefined?undefined:parse<ExternalMapping>(String(row["payload_json"]));}
 private async requireContract(scope:ExternalIntegrationScope,id:string):Promise<IntegrationContract> {const value=(await this.readContract(scope,id));if(value===undefined)throw failure("NOT_FOUND","Integration contract is unavailable.");return value;}
 private async requireActiveContract(scope:ExternalIntegrationScope,id:string,provider?:string):Promise<IntegrationContract> {const value=(await this.requireContract(scope,id));if((provider!==undefined&&value.providerNamespace!==provider)||value.connectorId!==scope.connectorId||value.sourceId!==scope.sourceId)throw failure("CONFLICT","Integration contract binding conflicts.");if(value.status!=="ACTIVE")throw failure("FORBIDDEN","Integration contract is suspended.");return value;}
 private async replay<T>(scope:ExternalIntegrationScope,key:string,fingerprint:string):Promise<T|undefined> {const row=(await this.query("SELECT fingerprint,result_json FROM ext_idempotency WHERE "+WHERE+" AND idempotency_key=?", ...values(scope),key)).rows[0];if(row===undefined)return undefined;if(String(row["fingerprint"])!==fingerprint)throw failure("IDEMPOTENCY_CONFLICT","External integration idempotency conflicts.");return parse<T>(String(row["result_json"]));}
 private async remember(scope:ExternalIntegrationScope,key:string,fingerprint:string,result:unknown):Promise<void> {(await this.query("INSERT INTO ext_idempotency("+COLUMNS+",idempotency_key,fingerprint,result_json) VALUES(?,?,?,?,?,?,?,?)", ...values(scope),key,fingerprint,JSON.stringify(result)));}
 private async appendEvidence(scope:ExternalIntegrationScope,contractId:string,mappingId: string|undefined,kind:ExternalIntegrationEvidence["kind"],reasonCode:string,refs:readonly string[],recordedAt:string):Promise<ExternalIntegrationEvidence> {const evidenceId=stableId("evidence",[contractId,kind,String((await this.listEvidence(scope,contractId)).length+1)]);const value:ExternalIntegrationEvidence=Object.freeze({...copyScope(scope),evidenceId,integrationContractId:contractId,...(mappingId===undefined?{}:{mappingId}),kind,reasonCode,evidenceRefs:Object.freeze([...refs]),recordedAt});(await this.query("INSERT INTO ext_evidence("+COLUMNS+",evidence_id,contract_id,ordinal,payload_json) VALUES(?,?,?,?,?,?,?,?,?)", ...values(scope),evidenceId,contractId,await this.nextOrdinal(scope,contractId,"ext_evidence"),JSON.stringify(value)));return value;}
}

function validateMutation(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;idempotencyKey:string;inputFingerprint:string;evidenceRef:string;recordedAt:string}>):void{validateScope(input);validateText(input.integrationContractId,input.idempotencyKey,input.inputFingerprint,input.evidenceRef,input.recordedAt);}
function validateScope(scope:ExternalIntegrationScope):void{validateText(scope.tenantId,scope.scopeType,scope.scopeId,scope.connectorId);if(scope.sourceId!==undefined)validateText(scope.sourceId);}
function validateText(...valuesToCheck:string[]):void{if(valuesToCheck.some(value=>typeof value!=="string"||value.trim()===""||value.length>2048))throw failure("PERSISTENCE_INPUT_INVALID","External integration input is invalid.");}
function values(scope:ExternalIntegrationScope):readonly string[]{return [scope.tenantId,scope.scopeType,scope.scopeId,scope.connectorId,scope.sourceId??""];}
function copyScope(scope:ExternalIntegrationScope):ExternalIntegrationScope{return Object.freeze({tenantId:scope.tenantId,scopeType:scope.scopeType,scopeId:scope.scopeId,connectorId:scope.connectorId,...(scope.sourceId===undefined?{}:{sourceId:scope.sourceId})});}
function stableId(prefix:string,parts:readonly string[]):string{return prefix+"-"+createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0,32);}
function parse<T>(json:string):T{return Object.freeze(JSON.parse(json) as T);}
function failure(code:ExternalIntegrationPersistenceErrorCode,message:string):ExternalIntegrationPersistenceError{return new ExternalIntegrationPersistenceError(code,message);}
