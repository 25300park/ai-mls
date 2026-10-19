import assert from "node:assert/strict";
import test from "node:test";
import { rootCertificates } from "node:tls";
import { createProductionRuntimePool } from "./production-runtime-pool.js";
import { createRuntimeArtifactStartupOptions } from "./runtime-artifact-startup-bindings.js";
import { parseRailwayProductionRuntimeConfiguration } from "./production-runtime-configuration.js";
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import type { PgPoolFactory } from "../../../modules/identity/src/postgresql-pool.js";
import { PgConnectionPoolAdapter } from "../../../modules/identity/src/postgresql-pool.js";
import { readFileSync } from "node:fs";
const caCertificate = rootCertificates[0] ?? "";

function environment(): Readonly<Record<string, string>> {
  return Object.freeze({
    RUNTIME_ENVIRONMENT: "PRODUCTION",
    CONFIGURATION_REFERENCE: "config:production:v1",
    REQUIRED_SERVICE_REGISTRATIONS: "registration-api-014,registration-api-015",
    REQUIRED_SERVICE_WORKLOAD_PINS: '[{"registrationId":"registration-api-014","registrationVersion":1},{"registrationId":"registration-api-015","registrationVersion":1}]', STARTUP_WORKLOAD_PURPOSE: "startup", STARTUP_WORKLOAD_AUDIENCE: "api",
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
  });
}


const secrets = {connectionString:"postgresql://ai_mls_production_runtime:fixture-only@db.mfonujjeokvpsfucfxuq.supabase.co:5432/postgres",caCertificate};
test("canonical Production physical factory receives exactly five contract-derived startup bindings",async()=>{
 let received:string|undefined;
 const pool=createProductionRuntimePool(parseRailwayProductionRuntimeConfiguration(environment()),secrets,config=>{
  received=config.options;return {connect:()=>Promise.reject(Error('unused')),end:()=>Promise.resolve()};
 });
 assert.equal(received,R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>`-c ai_mls.r3b1_${c.schemaName.slice(4)}_artifact_sha256=${c.artifactSha256}`).join(' '));
 await pool.close();
});

test("physical creation is distinct from checkout, replacement and recreation", async () => {
 const configuration=parseRailwayProductionRuntimeConfiguration(environment());
 let sequence=0;
 const creations:{id:number;startup:string|undefined}[]=[];
 const checkouts:number[]=[];
 const factory:PgPoolFactory = pgConfiguration => {
  let idle:{id:number;startup:string|undefined}|undefined;
  return {connect:()=>{
   if(!idle){idle={id:++sequence,startup:pgConfiguration.options};creations.push(idle);}
   const backend=idle;idle=undefined;checkouts.push(backend.id);
   return Promise.resolve({query:()=>Promise.resolve({rows:[],rowCount:0}),release:(destroy=false)=>{if(!destroy)idle=backend;}});
  },end:()=>{idle=undefined;return Promise.resolve();}};
 };
 const first=createProductionRuntimePool(configuration,secrets,factory);
 (await first.connect()).release();
 (await first.connect()).release(true);
 assert.deepEqual(checkouts,[1,1]);assert.equal(creations.length,1);
 (await first.connect()).release();
 assert.deepEqual(checkouts,[1,1,2]);assert.equal(creations.length,2);
 await first.close();
 const second=createProductionRuntimePool(configuration,secrets,factory);
 (await second.connect()).release();await second.close();
 assert.deepEqual(checkouts,[1,1,2,3]);
 assert.ok(creations.every(c=>c.startup===createRuntimeArtifactStartupOptions()));
 // The unchanged generic adapter still supplies no options to other identities.
 const registration=new PgConnectionPoolAdapter({connectionString:secrets.connectionString.replace('ai_mls_production_runtime','ai_mls_production_registration_operator'),connectionTimeoutMilliseconds:10000,idleTimeoutMilliseconds:30000,statementTimeoutMilliseconds:30000,idleTransactionTimeoutMilliseconds:30000,shutdownTimeoutMilliseconds:30000,maxConnections:1,applicationName:'ai-mls-registration-operator',ssl:{rejectUnauthorized:true,ca:caCertificate}},factory);
 (await registration.connect()).release();await registration.close();
 assert.equal(creations[3]!.startup,undefined);
});

test("no raw binding override or alternate identity enters the canonical pool", () => {
 const configuration=parseRailwayProductionRuntimeConfiguration(environment());
 const unexpectedFactory:PgPoolFactory=()=>{assert.fail('physical factory must not run');};
 for(const name of ['options','startupOptions','runtimeStartupBindings','artifactBindings','ai_mls.r3b1_publication_artifact_sha256']) {
  assert.throws(()=>createProductionRuntimePool(configuration,{...secrets,[name]:'0'.repeat(64)},unexpectedFactory));
 }
 for(const name of ['options','startupOptions','runtimeStartupBindings','artifactBindings'])assert.throws(()=>createProductionRuntimePool({...configuration,[name]:'override'},secrets,unexpectedFactory));
 for(const role of ['ai_mls_production_registration_operator','ai_mls_production_migration_operator','postgres'])assert.throws(()=>createProductionRuntimePool(configuration,{...secrets,connectionString:secrets.connectionString.replace('ai_mls_production_runtime',role)},unexpectedFactory));
 assert.throws(()=>createProductionRuntimePool(configuration,{...secrets,connectionString:secrets.connectionString+'?options=override'},unexpectedFactory));
});

test("Production and readiness use one constructor; registration construction remains separate", () => {
 const resolver=readFileSync('apps/api/src/production-secret-reference-resolver.ts','utf8');
 const runner=readFileSync('tools/production/register-service-workload.ts','utf8');
 const helper=readFileSync('scripts/rel002-production-strict-registration-readiness.mjs','utf8');
 assert.match(resolver,/return createProductionRuntimePool\(configuration/u);
 assert.match(runner,/createRuntimePool:\(\)=>createProductionRuntimePool\(configuration/u);
 assert.match(runner,/createRegistrationPool:\(\)=>new PgConnectionPoolAdapter\(registrationOptions\)/u);
 assert.match(helper,/createRegistrationRunnerDependencies/u);
 assert.doesNotMatch(helper,/createRuntimeArtifactStartupOptions|new Pool\(/u);
});
