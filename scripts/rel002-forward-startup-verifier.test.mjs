import test from 'node:test';
import assert from 'node:assert/strict';
import * as forward from '../dist/apps/api/src/forward-registration-readiness.js';
import {R3C2C_COMPATIBILITY_QUERY,R3C2C_COMPONENTS,r3c2cCompatibleRowsReady} from '../dist/apps/api/src/r3c2c-catalog-compatibility.js';
import {R3C2C_TEAM_CATALOG_QUERY} from '../dist/apps/api/src/r3c2c-postgresql-readiness.js';
import {normalizeIdentityExtensionCatalogQuery} from '../dist/apps/api/src/r3c2-aggregate-readiness.js';
import {REGISTRATION_OPERATOR_ACL_QUERY} from '../dist/modules/identity/src/registration-operator-acl.js';
import {createProductionStartupPreparation} from '../dist/apps/api/src/production-startup-preparation.js';

test('canonical borrowed forward pool projects stale gate without dropping current material or borrowing ownership',async()=>{
 assert.equal(typeof forward.projectForwardRegistrationPool,'function');
 const queries=[],parameters=[];let released=0,closed=0;
 const pool={connect:async()=>({release:()=>released++,query:async(sql,values)=>{queries.push(sql);parameters.push(values);return {rows:[],rowCount:0};}}),close:async()=>{closed++;}};
 const projected=forward.projectForwardRegistrationPool(pool),client=await projected.connect();
 for(const query of [R3C2C_COMPATIBILITY_QUERY,normalizeIdentityExtensionCatalogQuery(R3C2C_TEAM_CATALOG_QUERY)])await client.query(query);
 for(const sql of queries){assert.ok(!sql.includes(REGISTRATION_OPERATOR_ACL_QUERY));assert.ok(sql.includes(forward.FORWARD_REGISTRATION_STRUCTURAL_ACL_QUERY));assert.ok(sql.includes('attnotnull'));assert.ok(sql.includes('authority_ok'));assert.ok(sql.includes('_authorization_team_guard'));}
 const values=['fixture'];await client.query('SELECT current_user',values);assert.equal(queries.at(-1),'SELECT current_user');assert.equal(parameters.at(-1),values);
 client.release();await assert.rejects(projected.close());assert.equal(released,1);assert.equal(closed,0);
});
const roots=()=>Object.entries(R3C2C_COMPONENTS).map(([schema,components])=>({schema_name:schema,table_name:schema==='app_audit'?'audit_evidence_read_records':'workload_startup_binding_versions',server_version_num:'170011',authority_ok:true,fingerprint:schema==='app_audit'?'e0112f4fbe9d0dc82892dfb08345c2ae':'474c1456def4862e43167f2777a94c23',component_hashes:{...components}}));
test('canonical PG17 Audit002 and Identity014 components pass without historical Audit001 hash',()=>{assert.equal(r3c2cCompatibleRowsReady(roots()),true);});
for(const mode of ['missing','malformed','team-component','authority','unknown-major'])test('current forward roots fail closed: '+mode,()=>{
 const rows=roots();
 if(mode==='missing')rows.pop();
 if(mode==='malformed')rows[1].component_hashes={};
 if(mode==='team-component')rows[1].component_hashes.columns='wrong';
 if(mode==='authority')rows[1].authority_ok=false;
 if(mode==='unknown-major')rows[1].server_version_num='190000';
 assert.equal(r3c2cCompatibleRowsReady(rows),false);
});
for(const role of ['ai_mls_production_registration_operator','postgres'])test('actual startup preparation rejects non-runtime identity before structural/authority queries: '+role,async()=>{
 const queries=[];let releases=0,closed=0;
 const pool={connect:async()=>({release:()=>releases++,query:async sql=>{queries.push(sql);return {rows:[{current_user:role,session_user:role,database:'postgres',server_version_num:'170011'}],rowCount:1};}}),close:async()=>{closed++;}};
 const preparation=createProductionStartupPreparation(pool,{requiredServiceWorkloadPins:[{registrationId:'53c1f7db-52de-4873-8b41-a016cab8e6c6',registrationVersion:1}],startupWorkloadPurpose:'AI_MLS_PRODUCTION_API_RUNTIME',startupWorkloadAudience:'ai-mls-api'});
 await assert.rejects(preparation.authority.assertSchemaReady());await preparation.close();
 assert.equal(queries.length,1);assert.equal(queries[0],forward.FORWARD_REGISTRATION_IDENTITY_QUERY);assert.equal(releases,1);assert.equal(closed,0);
});
test('actual startup preparation rejects missing forward roots without legacy fingerprint gate or writes',async()=>{
 const queries=[];let releases=0;
 const pool={connect:async()=>({release:()=>releases++,query:async sql=>{
  queries.push(sql);const rows=sql===forward.FORWARD_REGISTRATION_IDENTITY_QUERY?[{current_user:'ai_mls_production_runtime',session_user:'ai_mls_production_runtime',database:'postgres',server_version_num:'170011'}]:sql==='SELECT current_user AS role'?[{role:'ai_mls_production_runtime'}]:[];
  return {rows,rowCount:rows.length};
 }}),close:async()=>{throw Error('borrowed pool');}};
 const preparation=createProductionStartupPreparation(pool,{requiredServiceWorkloadPins:[{registrationId:'r',registrationVersion:1}],startupWorkloadPurpose:'AI_MLS_PRODUCTION_API_RUNTIME',startupWorkloadAudience:'ai-mls-api'});
 await assert.rejects(preparation.authority.assertSchemaReady());await preparation.close();assert.ok(releases>0);
 assert.ok(queries.every(q=>!q.includes(REGISTRATION_OPERATOR_ACL_QUERY)));
 assert.ok(queries.every(q=>!/^\s*(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|SET ROLE)/i.test(q)));
});
