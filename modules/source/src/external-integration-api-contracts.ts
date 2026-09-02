export const EXTERNAL_INTEGRATION_COMMAND_OPERATIONS = Object.freeze(["RegisterExternalMapping", "SubmitProviderObservation", "ReconcileIntegrationEvidence", "SuspendIntegrationContract"] as const);
export const EXTERNAL_INTEGRATION_QUERY_OPERATIONS = Object.freeze(["ReadExternalMapping", "ReadIntegrationContract"] as const);
export const EXTERNAL_INTEGRATION_HTTP_OPERATIONS = EXTERNAL_INTEGRATION_QUERY_OPERATIONS;
export const EXTERNAL_INTEGRATION_OPERATIONS = Object.freeze([...EXTERNAL_INTEGRATION_COMMAND_OPERATIONS, ...EXTERNAL_INTEGRATION_QUERY_OPERATIONS] as const);
export const EXTERNAL_INTEGRATION_PROOF_TYPES = Object.freeze(["SAME_EXTERNAL_IDENTITY", "SAME_INTERNAL_BINDING", "DUPLICATE_OBSERVATION", "STALE_EVIDENCE_SUPERSEDED", "CONTRACT_BINDING_MATCH"] as const);
export type ExternalIntegrationOperation = (typeof EXTERNAL_INTEGRATION_OPERATIONS)[number];
export type ExternalIntegrationRequestKind = "COMMAND" | "QUERY" | "HTTP_COMMAND" | "HTTP_QUERY";
export type ExternalIntegrationRequest = Readonly<Record<string, unknown>> & Readonly<{ operation: ExternalIntegrationOperation }>;
export class ExternalIntegrationContractError extends Error { public readonly code = "VALIDATION_FAILED" as const; public constructor(message: string) { super(message); this.name = "ExternalIntegrationContractError"; } }

const ID=/^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/u, KEY=/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u, UNSAFE=/(?:bearer\s|authorization|api[_-]?key|token|secret|password|cookie|set-cookie)/iu;
const REQUIRED: Readonly<Record<ExternalIntegrationOperation,readonly string[]>>=Object.freeze({
 RegisterExternalMapping:["operation","integrationContractId","providerNamespace","externalObjectId","internalResourceType","internalResourceId","idempotencyKey","evidenceRef"],
 SubmitProviderObservation:["operation","integrationContractId","observationId","providerNamespace","externalObjectId","connectorId","observationType","normalizedFields","observedAt","idempotencyKey"],
 ReconcileIntegrationEvidence:["operation","integrationContractId","mappingId","expectedVersion","proofType","evidenceRefs","idempotencyKey"],
 SuspendIntegrationContract:["operation","integrationContractId","expectedVersion","reasonCode","evidenceRef","idempotencyKey"],
 ReadExternalMapping:["operation"], ReadIntegrationContract:["operation","integrationContractId"],
});
const OPTIONAL: Readonly<Partial<Record<ExternalIntegrationOperation,readonly string[]>>>=Object.freeze({RegisterExternalMapping:["expectedVersion"],SubmitProviderObservation:["sourceId","expectedMappingVersion"],ReconcileIntegrationEvidence:["observationIds"],ReadExternalMapping:["mappingId","providerNamespace","externalObjectId"]});

export function parseExternalIntegrationRequest(kind:ExternalIntegrationRequestKind,input:unknown):ExternalIntegrationRequest{
 if(!record(input)||typeof input["operation"]!=="string"||!EXTERNAL_INTEGRATION_OPERATIONS.includes(input["operation"] as ExternalIntegrationOperation))fail("operation is invalid");
 const operation=input["operation"] as ExternalIntegrationOperation; classify(kind,operation); const required=REQUIRED[operation],allowed=new Set([...required,...(OPTIONAL[operation]??[])]);
 if(Object.keys(input).some(f=>!allowed.has(f))||required.some(f=>!(f in input)))fail("request schema is invalid");
 const out:Record<string,unknown>={operation}; for(const f of required.slice(1))out[f]=field(f,input[f]); for(const f of OPTIONAL[operation]??[])if(input[f]!==undefined)out[f]=field(f,input[f]);
 if(operation==="ReadExternalMapping"){const byId=out["mappingId"]!==undefined,byExternal=out["providerNamespace"]!==undefined&&out["externalObjectId"]!==undefined;if(byId===byExternal||(out["providerNamespace"]===undefined)!==(out["externalObjectId"]===undefined))fail("mapping lookup is invalid");}
 return Object.freeze(out) as ExternalIntegrationRequest;
}
function classify(kind:ExternalIntegrationRequestKind,op:ExternalIntegrationOperation):void{const command=EXTERNAL_INTEGRATION_COMMAND_OPERATIONS.includes(op as never),query=EXTERNAL_INTEGRATION_QUERY_OPERATIONS.includes(op as never);if((kind==="COMMAND"&&!command)||(kind==="QUERY"&&!query)||kind==="HTTP_COMMAND"||(kind==="HTTP_QUERY"&&!query))fail("operation classification is invalid");}
function field(name:string,value:unknown):unknown{
 if(name==="expectedVersion"||name==="expectedMappingVersion"){if(!Number.isSafeInteger(value)||(value as number)<0)fail(`${name} is invalid`);return value;}
 if(name==="normalizedFields")return normalized(value);
 if(name==="evidenceRefs")return refs(value,name,1,16);
 if(name==="observationIds")return refs(value,name,0,16);
 if(name==="proofType"){if(typeof value!=="string"||!EXTERNAL_INTEGRATION_PROOF_TYPES.includes(value as never))fail("proofType is invalid");return value;}
 if(name==="observedAt"){if(typeof value!=="string"||value.length>64||Number.isNaN(Date.parse(value)))fail("observedAt is invalid");return value;}
 return id(value,name);
}
function normalized(value:unknown):Readonly<Record<string,string|number|boolean|null>>{if(!record(value)||Object.keys(value).length>32)fail("normalizedFields is invalid");const out:Record<string,string|number|boolean|null>={};for(const[k,v]of Object.entries(value)){if(!KEY.test(k)||(v!==null&&!['string','number','boolean'].includes(typeof v))||(typeof v==='string'&&(v.length>2048||UNSAFE.test(v)))||(typeof v==='number'&&!Number.isFinite(v)))fail("normalizedFields is invalid");out[k]=v as string|number|boolean|null;}if(Buffer.byteLength(JSON.stringify(out),'utf8')>16384)fail("normalizedFields is invalid");return Object.freeze(out);}
function refs(value:unknown,name:string,min:number,max:number):readonly string[]{if(!Array.isArray(value)||value.length<min||value.length>max)fail(`${name} is invalid`);return Object.freeze(value.map(v=>id(v,name)));}
function id(value:unknown,name:string):string{if(typeof value!=="string"||!ID.test(value)||UNSAFE.test(value))fail(`${name} is invalid`);return value;}
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function fail(message:string):never{throw new ExternalIntegrationContractError(message);}
