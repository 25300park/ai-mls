// LOCAL / DISPOSABLE only. No migrations, registration, or Production access.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { rootCertificates } from 'node:tls';
import pg from 'pg';
import { sanitizedEnvironment, runPgCtlLifecycle, stopOwnedCluster, assertOwnedTarget } from './rel002-r3c1-fixture-capture.mjs';
import { createProductionRuntimePool } from '../dist/apps/api/src/production-runtime-pool.js';
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from '../dist/apps/api/src/child-root-postgresql-readiness.js';

let stage='PREFLIGHT', directory, created=false, started=false, stopped=false, control;
const pools=[], diagnostics=[];
let evidence={scope:'LOCAL_DISPOSABLE',productionConnection:false};
try {
 assert.equal(process.env.REL002_A2_GUC_DISPOSABLE,'CONFIRMED');
 for(const key of ['DATABASE_URL','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_REGISTRATION_DATABASE_CA_CERT_V1'])assert.ok(!Object.hasOwn(process.env,key));
 const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--bin');assert.equal(args[2],'--port');
 const bin=args[1], port=Number(args[3]);assert.ok(isAbsolute(bin));assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535&&port!==5432);
 const childEnvironment=sanitizedEnvironment(process.env);
 assert.match(execFileSync(join(bin,'postgres.exe'),['--version'],{encoding:'utf8',env:childEnvironment,windowsHide:true,timeout:10000}),/PostgreSQL\) 17\./u);
 await new Promise((yes,no)=>{const server=createServer();server.once('error',no);server.listen(port,'127.0.0.1',()=>server.close(error=>error?no(error):yes()));});
 directory=mkdtempSync(join(tmpdir(),'rel002-a2-startup-guc-'));
 const dataDirectory=join(directory,'cluster');
 stage='INITDB';execFileSync(join(bin,'initdb.exe'),['-D',dataDirectory,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'],{env:childEnvironment,stdio:'ignore',windowsHide:true,timeout:60000});created=true;
 stage='START';started=true;runPgCtlLifecycle(bin,childEnvironment,['start','-D',dataDirectory,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w']);
 stage='TARGET_IDENTITY';control=new pg.Client({host:'127.0.0.1',port,database:'postgres',user:'postgres',password:'',ssl:false,options:'',connectionTimeoutMillis:5000});await control.connect();
 const row=(await control.query("SELECT current_user, current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port, current_setting('server_version_num') AS version, current_setting('data_directory') AS data_directory")).rows[0];
 assertOwnedTarget({port,major:17,currentUser:'postgres',database:'postgres',serverAddress:'127.0.0.1',dataDirectory},{created,currentUser:row.current_user,database:row.database,serverAddress:row.address,port:row.port,major:Math.floor(Number(row.version)/10000),dataDirectory:row.data_directory});
 evidence={...evidence,target:{...row,data_directory:resolve(row.data_directory)},captureStage:'RUNTIME_STARTUP_GUCS_ONLY'};
 assert.equal(Number((await control.query("SELECT count(*) AS count FROM pg_namespace WHERE nspname LIKE 'app_%'")).rows[0].count),0);
 assert.equal(Number((await control.query("SELECT count(*) AS count FROM pg_roles WHERE rolname LIKE 'ai_mls_%'")).rows[0].count),0);
 stage='LOCAL_ROLE';await control.query('CREATE ROLE ai_mls_production_runtime LOGIN');
 const configuration={identityDatabase:{host:'db.mfonujjeokvpsfucfxuq.supabase.co',port:5432,name:'postgres',user:'ai_mls_production_runtime',connectionTimeoutMilliseconds:10000,poolIdleTimeoutMilliseconds:30000,statementTimeoutMilliseconds:30000,idleTransactionTimeoutMilliseconds:30000,shutdownTimeoutMilliseconds:30000,maxConnections:1,applicationName:'ai-mls-api-production',sslMode:'VERIFY_FULL'}};
 const secrets={connectionString:'postgresql://ai_mls_production_runtime:fixture-only@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres',caCertificate:rootCertificates[0]};
 // Explicit local transport replacement is trusted test composition only. The
 // canonical startup options are preserved, but this test does NOT prove TLS.
 const localFactory=config=>{
  const local={...config,host:'127.0.0.1',port,database:'postgres',user:'ai_mls_production_runtime',password:'',ssl:false};delete local.connectionString;
  const pool=new pg.Pool(local);
  evidence.startupOptions=config.options;
  return {connect:async()=>{const client=await pool.connect();return {query:async(text,values)=>{const result=await client.query(text,values);return {rows:result.rows,rowCount:result.rowCount??0};},release:destroy=>client.release(destroy)};},end:()=>pool.end()};
 };
 const construct=()=>{const pool=createProductionRuntimePool(configuration,secrets,localFactory,event=>diagnostics.push(event));pools.push(pool);return pool;};
 const capture=async(pool,destroy=false)=>{const client=await pool.connect();try{
  assert.equal((await client.query('SELECT 1 AS ready')).rows[0].ready,1);
  const identity=(await client.query('SELECT pg_backend_pid() AS pid,current_user')).rows[0];assert.equal(identity.current_user,'ai_mls_production_runtime');
  const keys=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256`);
  const settings=await client.query('SELECT key,current_setting(key,true) AS value FROM unnest($1::text[]) AS keys(key)',[keys]);
  assert.equal(settings.rows.length,5);const matches=settings.rows.map((r,index)=>({key:r.key,present:!!r.value,match:r.value===R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[index].artifactSha256}));assert.ok(matches.every(r=>r.present&&r.match));return {pid:identity.pid,matches};
 }finally{client.release(destroy);}};
 stage='CAPTURE';const first=construct();const a=await capture(first),b=await capture(first,true),c=await capture(first);assert.equal(a.pid,b.pid);assert.notEqual(a.pid,c.pid);await first.close();const second=construct(),d=await capture(second);assert.notEqual(c.pid,d.pid);await second.close();
 evidence={...evidence,captures:[a,b,c,d],diagnostics,tlsVerified:false,firstQueryPass:true,firstPhysicalPass:true,logicalReusePass:true,replacementPass:true,recreationPass:true,status:'PASS'};
} catch {
 evidence={...evidence,status:'FAIL',failedStage:stage};process.exitCode=1;
} finally {
 const closures=await Promise.allSettled(pools.map(pool=>pool.close()));
 if(closures.some(r=>r.status==='rejected')){evidence.status='FAIL';evidence.cleanupFailed=true;process.exitCode=1;}
 try{await control?.end();}catch{evidence.status='FAIL';process.exitCode=1;}
 if(created&&started){try{stopOwnedCluster((_tool,args)=>runPgCtlLifecycle(process.argv[3],sanitizedEnvironment(process.env),args),{created,dataDirectory:join(directory,'cluster'),evidenceDirectory:directory});stopped=true;}catch{evidence.status='FAIL';evidence.clusterStopFailed=true;process.exitCode=1;}}
 if(directory){evidence.clusterStopped=stopped;writeFileSync(join(directory,'local-guc-evidence.json'),JSON.stringify(evidence,null,2));console.log('LOCAL_GUC_EVIDENCE='+join(directory,'local-guc-evidence.json'));}
 console.log('LOCAL_GUC_VERIFICATION='+(evidence.status??'FAIL'));console.log('OWNED_CLUSTER_STOPPED='+stopped);
}
