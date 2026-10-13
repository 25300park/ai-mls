// Test-owned support only. Importing this module creates no resources or connections.
import assert from 'node:assert/strict';
import { realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, basename, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { assertRegistrationSessionPair } from '../dist/tools/production/registration-dual-pool.js';

const capabilities=new WeakMap();
export const OWNED_REGISTRATION_CLUSTER_QUERY=`SELECT current_user,session_user,current_database() AS database,
 current_setting('data_directory') AS data_directory,current_setting('server_version_num') AS server_version_num,
 inet_server_addr()::text AS address,inet_server_port() AS port,
 (SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
 pg_postmaster_start_time()::text AS cluster_started`;
const loopback=address=>address==='127.0.0.1'||address==='127.0.0.1/32';
export function assertDisposableEnvironment(environment){
 assert.ok(environment&&typeof environment==='object','LOCAL_ENVIRONMENT_REQUIRED');
 for(const name of Object.keys(environment))assert.ok(!/^(?:PG|AI_MLS_PRODUCTION_)|^DATABASE_URL$/i.test(name),'PRODUCTION_ENVIRONMENT_DENIED');
 const allowed=new Set(['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP','COMSPEC']);
 for(const name of Object.keys(environment))assert.ok(allowed.has(name),'SANITIZED_ENVIRONMENT_REQUIRED');
}
export function assertLocalRegistrationTarget(row,role,expected){
 assert.ok(row&&expected,'OWNED_TARGET_REQUIRED');
 assert.ok([17,18].includes(expected.major)&&Number.isInteger(expected.port)&&expected.port>=1024&&expected.port<=65535&&expected.port!==5432,'LOCAL_PORT_MAJOR_DENIED');
 assert.equal(row.current_user,role,'LOCAL_ROLE_MISMATCH');assert.equal(row.session_user,role,'LOCAL_SESSION_MISMATCH');
 assert.equal(row.database,'postgres','LOCAL_DATABASE_MISMATCH');
 assert.ok(new RegExp(`^${expected.major}\\d{4}$`).test(row.server_version_num),'LOCAL_MAJOR_MISMATCH');
 assert.ok(loopback(row.address),'LOCAL_LOOPBACK_REQUIRED');
 for(const key of ['port','database_oid','cluster_started','tls'])assert.equal(row[key],expected[key],'LOCAL_TARGET_MISMATCH');
 assert.ok(Number.isInteger(row.pid)&&row.pid>0,'LOCAL_PID_REQUIRED');
}
async function controlIdentity(client){
 const rows=(await client.query(OWNED_REGISTRATION_CLUSTER_QUERY)).rows;
 assert.equal(rows.length,1,'OWNED_CONTROL_CARDINALITY');const row=rows[0];
 assert.equal(row.current_user,'postgres','OWNED_CONTROL_ROLE');assert.equal(row.session_user,'postgres','OWNED_CONTROL_SESSION');
 assert.equal(row.database,'postgres','OWNED_CONTROL_DATABASE');assert.ok(loopback(row.address),'OWNED_CONTROL_LOOPBACK');
 return row;
}
/** Trusted harness supplies its creation receipt; this is not a security boundary against malicious callers. */
export async function createOwnedRegistrationCapability(receipt,controlClient,environment){
 assertDisposableEnvironment(environment);
 assert.equal(receipt?.created,true,'NEW_OWNED_CLUSTER_REQUIRED');
 assert.equal(receipt?.optIn,'CONFIRMED','EXPLICIT_DISPOSABLE_AUTHORITY_REQUIRED');
 assert.equal(receipt?.host,'127.0.0.1','LOCAL_HOST_REQUIRED');
 assert.ok(typeof receipt?.runId==='string'&&/^[A-Za-z0-9_-]{6,80}$/.test(receipt.runId),'OWNED_RUN_ID_REQUIRED');
 const evidence=resolve(receipt.evidenceDirectory),directory=resolve(receipt.dataDirectory),temp=await realpath(tmpdir());
 const inside=relative(temp,evidence);
 assert.ok(inside&&!inside.startsWith('..')&&!isAbsolute(inside),'OWNED_TEMP_REQUIRED');
 assert.equal(dirname(directory),evidence,'OWNED_DIRECTORY_SCOPE');assert.equal(basename(directory),'cluster','OWNED_DIRECTORY_SCOPE');
 assert.equal(basename(evidence),`rel002-registration-${receipt.runId}`,'OWNED_RUN_DIRECTORY');
 for(const path of [evidence,directory]){
  const stat=await lstat(path);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'OWNED_REAL_DIRECTORY_REQUIRED');
  assert.equal(resolve(await realpath(path)).toLowerCase(),path.toLowerCase(),'OWNED_REAL_DIRECTORY_REQUIRED');
 }
 const row=await controlIdentity(controlClient);
 assert.equal(resolve(row.data_directory).toLowerCase(),directory.toLowerCase(),'OWNED_DATA_DIRECTORY_MISMATCH');
 assert.equal(row.port,receipt.port,'OWNED_PORT_MISMATCH');
 assert.ok(typeof row.server_version_num==='string'&&new RegExp(`^${receipt.major}\\d{4}$`).test(row.server_version_num),'OWNED_MAJOR_MISMATCH');
 assert.ok([17,18].includes(receipt.major)&&receipt.port!==5432&&Number.isInteger(receipt.port)&&receipt.port>=1024&&receipt.port<=65535,'OWNED_PORT_MAJOR_REQUIRED');
 assert.ok(Number.isInteger(row.database_oid)&&row.database_oid>0&&typeof row.cluster_started==='string'&&row.cluster_started,'OWNED_IDENTITY_REQUIRED');
 assert.equal(receipt.tls,false,'EXPLICIT_LOCAL_NON_TLS_POLICY_REQUIRED');
 const capability=Object.freeze({});
 capabilities.set(capability,{controlClient,directory,environment:Object.freeze({...environment}),expected:Object.freeze({port:receipt.port,major:receipt.major,database_oid:row.database_oid,cluster_started:row.cluster_started,tls:false})});
 return capability;
}
export function revokeOwnedRegistrationCapability(capability){capabilities.delete(capability);}
export function createOwnedRegistrationTargetPolicy(capability){
 assert.ok(capabilities.has(capability),'OWNED_CAPABILITY_REQUIRED');
 const check=async()=>{
  const state=capabilities.get(capability);assert.ok(state,'OWNED_CAPABILITY_REQUIRED');
  assertDisposableEnvironment(state.environment);
  const row=await controlIdentity(state.controlClient);
  assert.equal(resolve(row.data_directory).toLowerCase(),state.directory.toLowerCase(),'OWNED_DATA_DIRECTORY_MISMATCH');
  for(const key of ['port','database_oid','cluster_started'])assert.equal(row[key],state.expected[key],'STALE_OWNED_CAPABILITY');
  assert.ok(new RegExp(`^${state.expected.major}\\d{4}$`).test(row.server_version_num),'STALE_OWNED_CAPABILITY');
  return state.expected;
 };
 return Object.freeze({name:'LOCAL_OWNED_DISPOSABLE',
  validateRuntime:async row=>assertLocalRegistrationTarget(row,'ai_mls_production_runtime',await check()),
  validatePair:async(runtime,registration)=>{
   const expected=await check();assertLocalRegistrationTarget(runtime,'ai_mls_production_runtime',expected);assertLocalRegistrationTarget(registration,'ai_mls_production_registration_operator',expected);
   assertRegistrationSessionPair({...runtime,address:'127.0.0.1'},{...registration,address:'127.0.0.1'});
  },
 });
}
