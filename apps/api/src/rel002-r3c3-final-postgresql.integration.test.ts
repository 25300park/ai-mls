import assert from 'node:assert/strict';
import test from 'node:test';
import {Client,Pool} from 'pg';
import {AuditLog} from '../../../modules/audit/src/audit-log.js';
import type {PostgreSqlPoolPort,PostgreSqlQueryResult} from '../../../modules/identity/src/postgresql-pool.js';
import {createProductionHumanReadinessComponents,validateProductionHumanIdentityReadiness} from './production-human-identity-readiness.js';
import {createRailwayProductionDependencies} from './production-main.js';
import {createProductionReadinessState} from './production-readiness-http.js';
import {executeProductionBootstrap} from './production-bootstrap-engine.js';
import {ProductionBootstrapError} from './production-bootstrap.js';
import {R3B1_CHILD_ROOT_SCHEMA_CONTRACTS} from './child-root-postgresql-readiness.js';
const enabled=process.env['REL002_TEST_POSTGRES_DISPOSABLE']==='CONFIRMED'&&process.env['REL002_TEST_POSTGRES_PORT']==='55441';
const config={host:'127.0.0.1',port:55441,database:'postgres'};
const binding={adapterId:'ai-mls.identity.first-party-credential.v1',adapterKind:'FIRST_PARTY_CREDENTIAL',configurationRef:{schemaVersion:1,adapterId:'ai-mls.identity.first-party-credential.v1',algorithmProfile:'ARGON2ID_V1'}};
const freshness={AI_MLS_HUMAN_IDLE_TIMEOUT_MILLISECONDS:'60000',AI_MLS_HUMAN_ABSOLUTE_LIFETIME_MILLISECONDS:'120000',AI_MLS_HUMAN_MFA_FRESHNESS_MILLISECONDS:'30000'};
function productionEnvironment(): Readonly<Record<string, string>> {
  return Object.freeze({
    RUNTIME_ENVIRONMENT: "PRODUCTION",
    CONFIGURATION_REFERENCE: "config:production:v1",
    REQUIRED_SERVICE_REGISTRATIONS: "registration-api-014",
    REQUIRED_SERVICE_WORKLOAD_PINS: '[{"registrationId":"registration-api-014","registrationVersion":1}]', STARTUP_WORKLOAD_PURPOSE: "startup", STARTUP_WORKLOAD_AUDIENCE: "api",
    PROVIDER_EXECUTION_AUTHORIZED: "false",
    IDENTITY_PERSISTENCE_ENGINE: "POSTGRESQL",
    IDENTITY_DATABASE_CONNECTION_MODE: "DIRECT",
    IDENTITY_DATABASE_HOST: "db.mfonujjeokvpsfucfxuq.supabase.co",
    IDENTITY_DATABASE_PORT: "5432",
    IDENTITY_DATABASE_NAME: "postgres",
    IDENTITY_DATABASE_USER: "ai_mls_production_runtime",
    IDENTITY_DATABASE_CONNECTION_REF: "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1",
    IDENTITY_DATABASE_CA_CERT_REF: "railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1",
    IDENTITY_DATABASE_SSL_MODE: "VERIFY_FULL",
    IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS: "10000",
    IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS: "30000",
    IDENTITY_DATABASE_MAX_CONNECTIONS: "5",
    IDENTITY_DATABASE_APPLICATION_NAME: "ai-mls-api-production",
    PORT: "8080",
    RAILWAY_PROJECT_ID: "project-id",
    RAILWAY_ENVIRONMENT_ID: "environment-id",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_SERVICE_ID: "service-id",
    RAILWAY_SERVICE_NAME: "ai-mls-api",
    RAILWAY_DEPLOYMENT_ID: "deployment-id",
  });
}

test('Final tenant-independent Human startup readiness in disposable PostgreSQL',{skip:!enabled,timeout:60000},async t=>{
 const migration=new Client({...config,user:'ai_mls_production_migration_operator'});await migration.connect();
 const native=new Pool({...config,user:'ai_mls_production_runtime',max:1,options:R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(' ')});
 const statements:string[]=[];let leases=0,releases=0,closes=0;
 const pool:PostgreSqlPoolPort={connect:async()=>{const c=await native.connect();leases++;return {query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{statements.push(sql);return await c.query(sql,values?[...values]:undefined) as unknown as PostgreSqlQueryResult<R>;},release:destroy=>{releases++;c.release(destroy);}};},close:()=>{closes++;return native.end();}};
 const clock=()=>new Date('2026-10-03T00:00:00.000Z');let auditSequence=0;
 const audit=new AuditLog({clock,idFactory:()=>`final-audit-${String(++auditSequence)}`});
 const counts=async():Promise<unknown>=> (await migration.query('SELECT (SELECT count(*) FROM app_identity.identity_sessions) AS sessions,(SELECT count(*) FROM app_identity.identity_human_principals) AS principals,(SELECT count(*) FROM app_identity.identity_human_credentials) AS credentials')).rows;
 try{
 const before=await counts();assert.deepEqual(before,[{sessions:'0',principals:'0',credentials:'0'}]);
 await t.test('zero-data tenant-independent readiness and actual Production composition root PASS',async()=>{
  await validateProductionHumanIdentityReadiness(freshness,[binding],createProductionHumanReadinessComponents(pool,clock,audit));
  const root=createRailwayProductionDependencies({...productionEnvironment(),...freshness},createProductionReadinessState(),undefined,[binding]);
  const configuration=root.parseConfiguration({...productionEnvironment(),...freshness});await root.openIdentityAuthorityReadOnly(pool);await root.validateHumanIdentityAuthority(configuration);
  assert.equal(closes,0);assert.equal(native.totalCount,1);assert.equal(native.totalCount-native.idleCount,0);assert.equal(leases,releases);
  assert.equal(statements.some(sql=>/FROM app_identity\.identity_human_(?:principals|credentials)\b/iu.test(sql)),false);
  assert.equal(statements.filter(sql=>/FROM app_identity\.identity_sessions\b/iu.test(sql)).every(sql=>sql.includes('LIMIT 0')),true);
  assert.equal(statements.some(sql=>/^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b/iu.test(sql)),false);
  assert.deepEqual(audit.query({requesterId:'security',purpose:'TEST'}),[]);assert.deepEqual(await counts(),before);
 });
 await t.test('principal credential Session and ACL catalog mismatch fail closed and release every lease',async()=>{
  for(const table of ['identity_human_principals','identity_human_credentials','identity_sessions']){
   const changed:PostgreSqlPoolPort={connect:async()=>{const c=await pool.connect();return {query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
    const result=await c.query<R>(sql,values);return {...result,rows:result.rows.map(row=>row['table_name']===table?{...row,fingerprint:'changed',authority_ok:false}:row)};
   },release:destroy=>c.release(destroy)};},close:()=>Promise.reject(new Error('child cannot close pool'))};
   await assert.rejects(validateProductionHumanIdentityReadiness(freshness,[binding],createProductionHumanReadinessComponents(changed,clock,audit)),{reason:table==='identity_sessions'?'SESSION_PERSISTENCE':'HUMAN_PERSISTENCE'});assert.equal(leases,releases);assert.equal(native.totalCount-native.idleCount,0);
  }
 });
 await t.test('Session read failure keeps shared pool open and normalizes private database errors',async()=>{
  const failed:PostgreSqlPoolPort={connect:async()=>{const c=await pool.connect();return {query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{if(sql.includes('FROM app_identity.identity_sessions LIMIT 0'))throw new Error('private session database details');return c.query<R>(sql,values);},release:destroy=>c.release(destroy)};},close:()=>Promise.reject(new Error('child cannot close pool'))};
  await assert.rejects(validateProductionHumanIdentityReadiness(freshness,[binding],createProductionHumanReadinessComponents(failed,clock,audit)),{reason:'SESSION_PERSISTENCE',message:'Production Human Identity readiness is unavailable.'});assert.equal(closes,0);assert.equal(leases,releases);assert.equal(native.totalCount-native.idleCount,0);
 });
 await t.test('service prerequisite PASS and actual Human PASS reach unchanged Secrets blocker with owner cleanup',async()=>{
  const environment={...productionEnvironment(),...freshness},root=createRailwayProductionDependencies(environment,createProductionReadinessState(),undefined,[binding]);
  const events:string[]=[];let activated=false;
  // Service-workload validation is an already-verified prerequisite fixture; Human uses real PostgreSQL readiness.
  const dependencies={...root,openPostgreSqlPool:()=>Promise.resolve(pool),resolveRequiredServiceIdentities:()=>{events.push('service');return Promise.resolve([{registrationId:'registration-api-014',tenantId:'tenant-a',principalId:'service-publication',principalType:'SERVICE' as const,assurance:'WORKLOAD' as const,environment:'PRODUCTION' as const,workloadPurpose:'startup',audience:'api',registrationVersion:1,identityEvidenceRef:'identity:service',auditEvidenceRef:'audit:service'}]);},validateStartupGate:()=>{events.push('service-gate');return 'sha256:service-gate-fixture';},validateHumanIdentityAuthority:async(configuration:Parameters<typeof root.validateHumanIdentityAuthority>[0])=>{await root.validateHumanIdentityAuthority(configuration);events.push('human-pass');},resolveRequiredSecrets:(...args:Parameters<typeof root.resolveRequiredSecrets>)=>{events.push('secrets');return root.resolveRequiredSecrets(...args);},childRootFactories:{'API-014':()=>{throw new Error('child must not construct');},'API-015':()=>{throw new Error('child must not construct');},'API-018':()=>{throw new Error('child must not construct');},'API-019':()=>{throw new Error('child must not construct');},'FEAT-022':()=>{throw new Error('child must not construct');}},startListeners:()=>{activated=true;throw new Error('listener must not start');},startWorkers:()=>{activated=true;throw new Error('worker must not start');}};
  await assert.rejects(executeProductionBootstrap(environment,dependencies),ProductionBootstrapError);assert.deepEqual(events,['service','service-gate','human-pass','secrets']);assert.equal(activated,false);assert.equal(closes,1);assert.equal(leases,releases);assert.deepEqual(await counts(),before);
 });
 }finally{if(closes===0)await pool.close();await migration.end();}
});
