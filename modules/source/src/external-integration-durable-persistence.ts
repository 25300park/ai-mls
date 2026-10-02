import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

export type ExternalIntegrationScope = Readonly<{ tenantId: string; scopeType: "TENANT"|"TEAM"|"ORGANIZATION"|"SOURCE"; scopeId: string; connectorId: string; sourceId?: string }>;
export type IntegrationContract = ExternalIntegrationScope & Readonly<{ integrationContractId:string; providerNamespace:string; governedBindingRef:string; status:"ACTIVE"|"SUSPENDED"; version:number; evidenceRef:string; createdAt:string; updatedAt:string }>;
export type ExternalMapping = ExternalIntegrationScope & Readonly<{ integrationContractId:string; mappingId:string; providerNamespace:string; externalObjectId:string; internalResourceType:string; internalResourceId:string; state:"ACTIVE"|"SUSPENDED"; version:number; evidenceRef:string; createdAt:string; updatedAt:string }>;
export type ProviderObservation = ExternalIntegrationScope & Readonly<{ integrationContractId:string; observationId:string; providerNamespace:string; externalObjectId:string; observationType:string; normalizedFields:Readonly<Record<string,string|number|boolean|null>>; observedAt:string; mappingId?:string; mappingState?:"ACTIVE"|"SUSPENDED"; evidenceRef:string }>;
export type ExternalIntegrationEvidence = ExternalIntegrationScope & Readonly<{ evidenceId:string; integrationContractId:string; mappingId?:string; kind:"MAPPING_RECORDED"|"MAPPING_CONFLICT"|"OBSERVATION_RECORDED"|"TECHNICAL_RECONCILIATION"|"CONTRACT_SUSPENDED"; reasonCode:string; evidenceRefs:readonly string[]; recordedAt:string }>;
export type ExternalIntegrationReconciliationResult = Readonly<{integrationContractId:string;mappingId:string;observationId?:string;reconciliationStatus:"CONFIRMED_TECHNICAL_MATCH"|"NO_CHANGE"|"UNRESOLVED_CONFLICT";mappingState:"ACTIVE"|"SUSPENDED";version:number;acceptedEvidenceRefs:readonly string[];technicalEvidenceId:string;reasonCode:string;updatedAt:string}>;
export type ExternalIntegrationPersistenceErrorCode = "PERSISTENCE_INPUT_INVALID"|"PERSISTENCE_UNAVAILABLE"|"NOT_FOUND"|"VERSION_CONFLICT"|"IDEMPOTENCY_CONFLICT"|"CONFLICT"|"FORBIDDEN";
export class ExternalIntegrationPersistenceError extends Error { public constructor(public readonly code:ExternalIntegrationPersistenceErrorCode,message:string){super(message);this.name="ExternalIntegrationPersistenceError";} }

const COLUMNS="tenant_id,scope_type,scope_id,connector_id,source_id";
const WHERE="tenant_id=? AND scope_type=? AND scope_id=? AND connector_id=? AND source_id=?";

export class DurableExternalIntegrationStore {
  readonly #database:DatabaseSync; #closed=false;
  public constructor(options:Readonly<{databasePath:string;schemaMode?:"INITIALIZE"|"REQUIRE_EXISTING"}>){
    const schemaMode=options.schemaMode??"INITIALIZE";
    if(typeof options.databasePath!=="string"||options.databasePath.trim()===""||options.databasePath===":memory:"||(schemaMode!=="INITIALIZE"&&schemaMode!=="REQUIRE_EXISTING")||(schemaMode==="REQUIRE_EXISTING"&&!existsSync(options.databasePath))) throw failure("PERSISTENCE_INPUT_INVALID","Durable external integration configuration is invalid.");
    let database:DatabaseSync|undefined;
    try { database=new DatabaseSync(options.databasePath); database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;"); if(schemaMode==="INITIALIZE"){database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");database.exec(SCHEMA);} assertPreparedSchema(database); this.#database=database; }
    catch { try{database?.close();}catch{} throw failure("PERSISTENCE_UNAVAILABLE","Durable external integration persistence is unavailable."); }
  }

  public provisionContract(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;providerNamespace:string;governedBindingRef:string;evidenceRef:string;provisionedAt:string}>):IntegrationContract {
    validateScope(input); validateText(input.integrationContractId,input.providerNamespace,input.governedBindingRef,input.evidenceRef,input.provisionedAt);
    return this.transaction(()=>{
      const current=this.readContract(input,input.integrationContractId);
      if(current!==undefined){ if(current.providerNamespace!==input.providerNamespace||current.connectorId!==input.connectorId||current.sourceId!==input.sourceId||current.governedBindingRef!==input.governedBindingRef) throw failure("CONFLICT","Integration contract binding conflicts."); return current; }
      const value:IntegrationContract=Object.freeze({...copyScope(input),integrationContractId:input.integrationContractId,providerNamespace:input.providerNamespace,governedBindingRef:input.governedBindingRef,status:"ACTIVE",version:1,evidenceRef:input.evidenceRef,createdAt:input.provisionedAt,updatedAt:input.provisionedAt});
      this.#database.prepare("INSERT INTO ext_contracts("+COLUMNS+",contract_id,version,status,payload_json) VALUES(?,?,?,?,?,?,?,?,?)").run(...values(input),input.integrationContractId,1,"ACTIVE",JSON.stringify(value));
      return value;
    });
  }

  public readContract(scope:ExternalIntegrationScope,id:string):IntegrationContract|undefined {
    this.assertOpen(); validateScope(scope); validateText(id);
    const row=this.#database.prepare("SELECT payload_json FROM ext_contracts WHERE "+WHERE+" AND contract_id=?").get(...values(scope),id);
    return row===undefined?undefined:parse<IntegrationContract>(String(row["payload_json"]));
  }

  public suspendContract(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;expectedVersion:number;idempotencyKey:string;inputFingerprint:string;reasonCode:string;evidenceRef:string;recordedAt:string}>):IntegrationContract {
    validateMutation(input); const replay=this.replay<IntegrationContract>(input,input.idempotencyKey,input.inputFingerprint); if(replay!==undefined)return replay;
    return this.transaction(()=>{
      const current=this.requireContract(input,input.integrationContractId); if(current.version!==input.expectedVersion)throw failure("VERSION_CONFLICT","Integration contract changed.");
      if(current.status==="SUSPENDED")throw failure("CONFLICT","Integration contract is already suspended.");
      const next:IntegrationContract=Object.freeze({...current,status:"SUSPENDED",version:current.version+1,evidenceRef:input.evidenceRef,updatedAt:input.recordedAt});
      const changed=this.#database.prepare("UPDATE ext_contracts SET version=?,status='SUSPENDED',payload_json=? WHERE "+WHERE+" AND contract_id=? AND version=?").run(next.version,JSON.stringify(next),...values(input),input.integrationContractId,current.version);
      if(Number(changed.changes)!==1)throw failure("VERSION_CONFLICT","Integration contract changed.");
      this.appendEvidence(input,input.integrationContractId,undefined,"CONTRACT_SUSPENDED",input.reasonCode,[input.evidenceRef],input.recordedAt); this.remember(input,input.idempotencyKey,input.inputFingerprint,next); return next;
    });
  }

  public registerMapping(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;providerNamespace:string;externalObjectId:string;internalResourceType:string;internalResourceId:string;expectedVersion:number;idempotencyKey:string;inputFingerprint:string;evidenceRef:string;recordedAt:string}>):ExternalMapping {
    validateMutation(input); const replay=this.replay<ExternalMapping>(input,input.idempotencyKey,input.inputFingerprint); if(replay!==undefined)return replay;
    const result=this.transaction(()=>{
      this.requireActiveContract(input,input.integrationContractId,input.providerNamespace);
      const current=this.readMappingByExternal(input,input.providerNamespace,input.externalObjectId);
      if(current!==undefined&&current.integrationContractId!==input.integrationContractId)throw failure("CONFLICT","Integration contract binding conflicts.");
      if(current!==undefined&&(current.internalResourceType!==input.internalResourceType||current.internalResourceId!==input.internalResourceId)){this.appendEvidence(input,input.integrationContractId,current.mappingId,"MAPPING_CONFLICT","EXTERNAL_IDENTITY_CONFLICT",[input.evidenceRef],input.recordedAt);return undefined;}
      if((current?.version??0)!==input.expectedVersion)throw failure("VERSION_CONFLICT","External mapping changed.");
      const mappingId=current?.mappingId??stableId("mapping",[input.tenantId,input.scopeId,input.providerNamespace,input.externalObjectId]);
      const value:ExternalMapping=Object.freeze({...copyScope(input),integrationContractId:input.integrationContractId,mappingId,providerNamespace:input.providerNamespace,externalObjectId:input.externalObjectId,internalResourceType:input.internalResourceType,internalResourceId:input.internalResourceId,state:"ACTIVE",version:input.expectedVersion+1,evidenceRef:input.evidenceRef,createdAt:current?.createdAt??input.recordedAt,updatedAt:input.recordedAt});
      this.#database.prepare("INSERT INTO ext_mappings("+COLUMNS+",mapping_id,contract_id,provider_namespace,external_object_id,version,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT("+COLUMNS+",mapping_id) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json WHERE ext_mappings.version=?").run(...values(input),mappingId,input.integrationContractId,input.providerNamespace,input.externalObjectId,value.version,JSON.stringify(value),input.expectedVersion);
      this.appendEvidence(input,input.integrationContractId,mappingId,"MAPPING_RECORDED","MAPPING_ACCEPTED",[input.evidenceRef],input.recordedAt); this.remember(input,input.idempotencyKey,input.inputFingerprint,value); return value;
    });
    if(result===undefined)throw failure("CONFLICT","External identity conflicts."); return result;
  }

  public readMappingById(scope:ExternalIntegrationScope,id:string):ExternalMapping|undefined { return this.readMapping(scope,"mapping_id=?",[id]); }
  public readMappingByExternal(scope:ExternalIntegrationScope,provider:string,externalId:string):ExternalMapping|undefined { return this.readMapping(scope,"provider_namespace=? AND external_object_id=?",[provider,externalId]); }

  public submitObservation(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;observationId:string;providerNamespace:string;externalObjectId:string;observationType:string;normalizedFields:Readonly<Record<string,string|number|boolean|null>>;observedAt:string;idempotencyKey:string;inputFingerprint:string;expectedMappingVersion?:number}>):ProviderObservation {
    validateScope(input); validateText(input.integrationContractId,input.observationId,input.providerNamespace,input.externalObjectId,input.observationType,input.observedAt,input.idempotencyKey,input.inputFingerprint);
    const replay=this.replay<ProviderObservation>(input,input.idempotencyKey,input.inputFingerprint);if(replay!==undefined)return replay;
    const existingRow=this.#database.prepare("SELECT fingerprint,payload_json FROM ext_observations WHERE "+WHERE+" AND provider_namespace=? AND observation_id=?").get(...values(input),input.providerNamespace,input.observationId);
    if(existingRow!==undefined){if(String(existingRow["fingerprint"])!==input.inputFingerprint)throw failure("IDEMPOTENCY_CONFLICT","Observation identity conflicts.");return parse<ProviderObservation>(String(existingRow["payload_json"]));}
    return this.transaction(()=>{
      this.requireActiveContract(input,input.integrationContractId,input.providerNamespace); const mapping=this.readMappingByExternal(input,input.providerNamespace,input.externalObjectId);
      if(mapping!==undefined&&mapping.integrationContractId!==input.integrationContractId)throw failure("CONFLICT","Integration contract binding conflicts.");
      if(input.expectedMappingVersion!==undefined&&(mapping?.version??0)!==input.expectedMappingVersion)throw failure("VERSION_CONFLICT","External mapping changed.");
      const evidenceRef="evidence:observation:"+input.observationId;
      const value:ProviderObservation=Object.freeze({...copyScope(input),integrationContractId:input.integrationContractId,observationId:input.observationId,providerNamespace:input.providerNamespace,externalObjectId:input.externalObjectId,observationType:input.observationType,normalizedFields:Object.freeze({...input.normalizedFields}),observedAt:input.observedAt,...(mapping===undefined?{}:{mappingId:mapping.mappingId,mappingState:mapping.state}),evidenceRef});
      this.#database.prepare("INSERT INTO ext_observations("+COLUMNS+",provider_namespace,observation_id,contract_id,fingerprint,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?)").run(...values(input),input.providerNamespace,input.observationId,input.integrationContractId,input.inputFingerprint,JSON.stringify(value));
      this.appendEvidence(input,input.integrationContractId,mapping?.mappingId,"OBSERVATION_RECORDED","OBSERVATION_ACCEPTED",[evidenceRef],input.observedAt);this.remember(input,input.idempotencyKey,input.inputFingerprint,value); return value;
    });
  }

  public reconcileEvidence(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;mappingId:string;expectedVersion:number;proofType:string;evidenceRefs:readonly string[];observationIds:readonly string[];idempotencyKey:string;inputFingerprint:string;recordedAt:string}>):ExternalIntegrationReconciliationResult {
    validateScope(input);validateText(input.integrationContractId,input.mappingId,input.proofType,input.idempotencyKey,input.inputFingerprint,input.recordedAt,...input.evidenceRefs,...input.observationIds);
    type Result=ReturnType<DurableExternalIntegrationStore["reconcileEvidence"]>; const replay=this.replay<Result>(input,input.idempotencyKey,input.inputFingerprint);if(replay!==undefined)return replay;
    return this.transaction(()=>{
      this.requireActiveContract(input,input.integrationContractId);const mapping=this.readMappingById(input,input.mappingId);if(mapping?.integrationContractId!==input.integrationContractId)throw failure("NOT_FOUND","External mapping is unavailable.");if(mapping.version!==input.expectedVersion)throw failure("VERSION_CONFLICT","External mapping changed.");
      const observations=this.listObservations(input,input.integrationContractId);const applicable=input.observationIds.map(id=>observations.find(item=>item.observationId===id));if(applicable.some(item=>item===undefined))throw failure("NOT_FOUND","Provider observation is unavailable.");if(applicable.some(item=>item?.mappingId!==input.mappingId))throw failure("CONFLICT","Provider observation binding conflicts.");
      const known=new Set(this.listEvidence(input,input.integrationContractId).flatMap(item=>item.evidenceRefs));const accepted=Object.freeze(input.evidenceRefs.filter(ref=>known.has(ref)));const confirmed=accepted.length===input.evidenceRefs.length;
      const reconciliationStatus=confirmed?"CONFIRMED_TECHNICAL_MATCH" as const:"UNRESOLVED_CONFLICT" as const;
      const reasonCode=confirmed?"TECHNICAL_MATCH_CONFIRMED":"F19_HANDOFF_REQUIRED";
      const evidence=this.appendEvidence(input,input.integrationContractId,input.mappingId,"TECHNICAL_RECONCILIATION",reasonCode,accepted,input.recordedAt);
      const observationId=input.observationIds[0];
      const value=Object.freeze({integrationContractId:input.integrationContractId,mappingId:input.mappingId,...(observationId===undefined?{}:{observationId}),reconciliationStatus,mappingState:mapping.state,version:mapping.version,acceptedEvidenceRefs:accepted,technicalEvidenceId:evidence.evidenceId,reasonCode,updatedAt:input.recordedAt});
      this.remember(input,input.idempotencyKey,input.inputFingerprint,value);return value;
    });
  }

  public listObservations(scope:ExternalIntegrationScope,contractId:string):readonly ProviderObservation[]{this.assertOpen();return Object.freeze(this.#database.prepare("SELECT payload_json FROM ext_observations WHERE "+WHERE+" AND contract_id=? ORDER BY rowid").all(...values(scope),contractId).map(row=>parse<ProviderObservation>(String(row["payload_json"]))));}
  public listEvidence(scope:ExternalIntegrationScope,contractId:string):readonly ExternalIntegrationEvidence[]{this.assertOpen();return Object.freeze(this.#database.prepare("SELECT payload_json FROM ext_evidence WHERE "+WHERE+" AND contract_id=? ORDER BY rowid").all(...values(scope),contractId).map(row=>parse<ExternalIntegrationEvidence>(String(row["payload_json"]))));}
  public close():void{if(!this.#closed){this.#closed=true;this.#database.close();}}

  private readMapping(scope:ExternalIntegrationScope,clause:string,args:readonly string[]):ExternalMapping|undefined{this.assertOpen();validateScope(scope);const row=this.#database.prepare("SELECT payload_json FROM ext_mappings WHERE "+WHERE+" AND "+clause).get(...values(scope),...args);return row===undefined?undefined:parse<ExternalMapping>(String(row["payload_json"]));}
  private requireContract(scope:ExternalIntegrationScope,id:string):IntegrationContract{const value=this.readContract(scope,id);if(value===undefined)throw failure("NOT_FOUND","Integration contract is unavailable.");return value;}
  private requireActiveContract(scope:ExternalIntegrationScope,id:string,provider?:string):IntegrationContract{const value=this.requireContract(scope,id);if((provider!==undefined&&value.providerNamespace!==provider)||value.connectorId!==scope.connectorId||value.sourceId!==scope.sourceId)throw failure("CONFLICT","Integration contract binding conflicts.");if(value.status!=="ACTIVE")throw failure("FORBIDDEN","Integration contract is suspended.");return value;}
  private replay<T>(scope:ExternalIntegrationScope,key:string,fingerprint:string):T|undefined{const row=this.#database.prepare("SELECT fingerprint,result_json FROM ext_idempotency WHERE "+WHERE+" AND idempotency_key=?").get(...values(scope),key);if(row===undefined)return undefined;if(String(row["fingerprint"])!==fingerprint)throw failure("IDEMPOTENCY_CONFLICT","External integration idempotency conflicts.");return parse<T>(String(row["result_json"]));}
  private remember(scope:ExternalIntegrationScope,key:string,fingerprint:string,result:unknown):void{this.#database.prepare("INSERT INTO ext_idempotency("+COLUMNS+",idempotency_key,fingerprint,result_json) VALUES(?,?,?,?,?,?,?,?)").run(...values(scope),key,fingerprint,JSON.stringify(result));}
  private appendEvidence(scope:ExternalIntegrationScope,contractId:string,mappingId: string|undefined,kind:ExternalIntegrationEvidence["kind"],reasonCode:string,refs:readonly string[],recordedAt:string):ExternalIntegrationEvidence{const evidenceId=stableId("evidence",[contractId,kind,String(this.listEvidence(scope,contractId).length+1)]);const value:ExternalIntegrationEvidence=Object.freeze({...copyScope(scope),evidenceId,integrationContractId:contractId,...(mappingId===undefined?{}:{mappingId}),kind,reasonCode,evidenceRefs:Object.freeze([...refs]),recordedAt});this.#database.prepare("INSERT INTO ext_evidence("+COLUMNS+",evidence_id,contract_id,payload_json) VALUES(?,?,?,?,?,?,?,?)").run(...values(scope),evidenceId,contractId,JSON.stringify(value));return value;}
  private transaction<T>(work:()=>T):T{this.assertOpen();this.#database.exec("BEGIN IMMEDIATE");try{const value=work();this.#database.exec("COMMIT");return value;}catch(error){try{this.#database.exec("ROLLBACK");}catch{}throw error;}}
  private assertOpen():void{if(this.#closed)throw failure("PERSISTENCE_UNAVAILABLE","External integration persistence is closed.");}
}

function validateMutation(input:ExternalIntegrationScope&Readonly<{integrationContractId:string;idempotencyKey:string;inputFingerprint:string;evidenceRef:string;recordedAt:string}>):void{validateScope(input);validateText(input.integrationContractId,input.idempotencyKey,input.inputFingerprint,input.evidenceRef,input.recordedAt);}
function validateScope(scope:ExternalIntegrationScope):void{validateText(scope.tenantId,scope.scopeType,scope.scopeId,scope.connectorId);if(scope.sourceId!==undefined)validateText(scope.sourceId);}
function validateText(...valuesToCheck:string[]):void{if(valuesToCheck.some(value=>typeof value!=="string"||value.trim()===""||value.length>2048))throw failure("PERSISTENCE_INPUT_INVALID","External integration input is invalid.");}
function values(scope:ExternalIntegrationScope):readonly string[]{return [scope.tenantId,scope.scopeType,scope.scopeId,scope.connectorId,scope.sourceId??""];}
function copyScope(scope:ExternalIntegrationScope):ExternalIntegrationScope{return Object.freeze({tenantId:scope.tenantId,scopeType:scope.scopeType,scopeId:scope.scopeId,connectorId:scope.connectorId,...(scope.sourceId===undefined?{}:{sourceId:scope.sourceId})});}
function stableId(prefix:string,parts:readonly string[]):string{return prefix+"-"+createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0,32);}
function parse<T>(json:string):T{return Object.freeze(JSON.parse(json) as T);}
function failure(code:ExternalIntegrationPersistenceErrorCode,message:string):ExternalIntegrationPersistenceError{return new ExternalIntegrationPersistenceError(code,message);}
function assertPreparedSchema(database:DatabaseSync):void{if(database.prepare("PRAGMA integrity_check").get()?.["integrity_check"]!=="ok")throw new Error("integrity");for(const name of ["ext_contracts","ext_mappings","ext_observations","ext_idempotency","ext_evidence"]){if(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name)===undefined)throw new Error("schema");}}
const SCOPE="tenant_id TEXT NOT NULL,scope_type TEXT NOT NULL,scope_id TEXT NOT NULL,connector_id TEXT NOT NULL,source_id TEXT NOT NULL";
const SCHEMA="CREATE TABLE IF NOT EXISTS ext_contracts("+SCOPE+",contract_id TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN('ACTIVE','SUSPENDED')),payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),PRIMARY KEY("+COLUMNS+",contract_id));"+
"CREATE TABLE IF NOT EXISTS ext_mappings("+SCOPE+",mapping_id TEXT NOT NULL,contract_id TEXT NOT NULL,provider_namespace TEXT NOT NULL,external_object_id TEXT NOT NULL,version INTEGER NOT NULL,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),PRIMARY KEY("+COLUMNS+",mapping_id),UNIQUE("+COLUMNS+",provider_namespace,external_object_id));"+
"CREATE TABLE IF NOT EXISTS ext_observations("+SCOPE+",provider_namespace TEXT NOT NULL,observation_id TEXT NOT NULL,contract_id TEXT NOT NULL,fingerprint TEXT NOT NULL,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),PRIMARY KEY("+COLUMNS+",provider_namespace,observation_id));"+
"CREATE TABLE IF NOT EXISTS ext_idempotency("+SCOPE+",idempotency_key TEXT NOT NULL,fingerprint TEXT NOT NULL,result_json TEXT NOT NULL CHECK(json_valid(result_json)),PRIMARY KEY("+COLUMNS+",idempotency_key));"+
"CREATE TABLE IF NOT EXISTS ext_evidence("+SCOPE+",evidence_id TEXT NOT NULL,contract_id TEXT NOT NULL,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),PRIMARY KEY("+COLUMNS+",evidence_id));"+
"CREATE TRIGGER IF NOT EXISTS ext_evidence_no_update BEFORE UPDATE ON ext_evidence BEGIN SELECT RAISE(ABORT,'append-only');END;CREATE TRIGGER IF NOT EXISTS ext_evidence_no_delete BEFORE DELETE ON ext_evidence BEGIN SELECT RAISE(ABORT,'append-only');END;CREATE TRIGGER IF NOT EXISTS ext_observations_no_update BEFORE UPDATE ON ext_observations BEGIN SELECT RAISE(ABORT,'append-only');END;CREATE TRIGGER IF NOT EXISTS ext_observations_no_delete BEFORE DELETE ON ext_observations BEGIN SELECT RAISE(ABORT,'append-only');END;";
