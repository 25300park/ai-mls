export type ChildRootName = 'PUBLICATION'|'ADMINISTRATION'|'CONNECTOR'|'EXTERNAL_INTEGRATION'|'ADVISORY';
export type RootRequirement = 'QUERY_EXECUTION'|'ROOT_CARDINALITY'|'SERVER_VERSION'|'INVENTORY'|'ARTIFACT_BINDING'|'SCHEMA_COMMENT'|'COLUMNS'|'CONSTRAINTS'|'INDEXES'|'RUNTIME_ACL'|'TRIGGERS'|'FUNCTIONS'|'EFFECTIVE_ACL'|'AUTHORITY_CONTRACT'|'CONNECTION_RELEASE';
export interface ChildRootDiagnostic {readonly root:ChildRootName;readonly requirement:RootRequirement;readonly result:'PASS'|'FAIL';readonly category:'NONE'|'OPERATION_REJECTED';readonly sqlstate:string|null;readonly querySha256:null}
export type ChildRootObserver=(event:ChildRootDiagnostic)=>void;
const failures=new WeakMap<Error,{root:ChildRootName;requirement:RootRequirement}>();
export function childRootFailure(root:ChildRootName,requirement:RootRequirement):Error{
 const error=new Error(root+'_CATALOG_UNAVAILABLE');failures.set(error,{root,requirement});return error;
}
export function childRootFailureDetail(error:unknown):{root:ChildRootName;requirement:RootRequirement}|undefined{return error instanceof Error?failures.get(error):undefined;}
export function rootRequirement(key:string):RootRequirement{
 const fields:Readonly<Record<string,RootRequirement>>={artifact_sha256:'ARTIFACT_BINDING',table_count:'INVENTORY',schema_comment:'SCHEMA_COMMENT',columns_hash:'COLUMNS',constraints_hash:'CONSTRAINTS',indexes_hash:'INDEXES',runtime_acl_hash:'RUNTIME_ACL',trigger_hash:'TRIGGERS',function_hash:'FUNCTIONS',effective_acl_hash:'EFFECTIVE_ACL'};
 return fields[key]??'AUTHORITY_CONTRACT';
}
export function reportChildRoot(observer:ChildRootObserver|undefined,root:ChildRootName,requirement:RootRequirement,result:'PASS'|'FAIL',error?:unknown):void{
 let sqlstate:string|null=null;
 if(error!==null&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&['42501','42704','42P01','42883','25006','57014','08006','08003'].includes(error.code))sqlstate=error.code;
 try{observer?.(Object.freeze({root,requirement,result,category:result==='PASS'?'NONE':'OPERATION_REJECTED',sqlstate,querySha256:null}));}catch{/* observation never changes readiness */}
}
export const CHILD_ROOT_NAMES:Readonly<Record<string,ChildRootName>>=Object.freeze({app_publication:'PUBLICATION',app_administration:'ADMINISTRATION',app_connector:'CONNECTOR',app_external_integration:'EXTERNAL_INTEGRATION',app_advisory:'ADVISORY'});
