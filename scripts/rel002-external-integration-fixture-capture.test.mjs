import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as harness from './rel002-external-integration-fixture-capture.mjs';
test('minimal exact post-ExternalIntegration002 sequence, no Organization prerequisite',()=>assert.deepEqual(harness.ARTIFACTS,[
 'modules/source/external-integration/migrations/postgresql/production/001_schema_v1.up.sql',
 'modules/source/external-integration/migrations/postgresql/production/002_runtime_role_grants.sql',
]));
test('capture stage is post grants and ExternalIntegration002',()=>assert.equal(harness.STAGE,'POST_EXTERNAL_INTEGRATION_RUNTIME_GRANTS'));
const input={execute:true,host:'127.0.0.1',port:'55457',major:'17',bin:'C:/local/pgsql/bin'};
const env={REL002_EXTERNAL_INTEGRATION_CAPTURE_DISPOSABLE:'CONFIRMED'};
test('PG17/18 loopback and explicit opt-in only',()=>{
 for(const major of ['17','18'])assert.equal(harness.validateExternalIntegrationInputs({...input,major},env).major,Number(major));
 for(const patch of [{host:'supabase.com'},{host:'127.0.0.2'},{host:'0.0.0.0'},{port:'5432'},{major:'16'},{major:'19'},{execute:false}])assert.throws(()=>harness.validateExternalIntegrationInputs({...input,...patch},env));
 assert.throws(()=>harness.validateExternalIntegrationInputs(input,{}));
});
for(const key of ['DATABASE_URL','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1','AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1'])test(key+' reuse denied',()=>assert.throws(()=>harness.validateExternalIntegrationInputs(input,{...env,[key]:''})));
test('diagnostic exactly derived from immutable child-root components; catalog only',async()=>{
 const child=await readFile(harness.CHILD_SOURCE,'utf8'),verifier=await readFile(harness.VERIFIER,'utf8');
 const sql=await readFile(harness.DIAGNOSTIC,'utf8');
 assert.equal(sql,harness.buildDiagnostic(child,verifier));harness.assertSelectOnly(sql);
 assert.match(sql,/is_nullable/);assert.match(sql,/aclexplode/);assert.match(sql,/CASE WHEN a.is_grantable THEN 'YES' ELSE 'NO' END/);
 assert.match(sql,/data_directory/);assert.match(sql,/artifact_guc_present/);assert.match(sql,/constraint_counts_by_type/);assert.match(sql,/not_null_column_count/);assert.match(sql,/non_n_constraint_rows/);
 assert.doesNotMatch(sql,/FROM app_external_integration\./);
 assert.equal((sql.match(/c.contype <> 'n'/g)??[]).length,1);
 for(const bad of ['WITH x AS (DELETE FROM x RETURNING *) SELECT * FROM x;','WITH x AS (SELECT set_config(\'a\',\'b\',false)) SELECT * FROM x;'])assert.throws(()=>harness.assertSelectOnly(bad));
});
test('mock capture executes exact sequence then diagnostic only',async()=>{
 const calls=[];await harness.captureExternalIntegration({query:async sql=>{calls.push(sql);return {rows:[]};}},async p=>p,'SELECT diagnostic');
 assert.deepEqual(calls,['SET ROLE ai_mls_production_migration_operator',...harness.ARTIFACTS,'RESET ROLE','SELECT diagnostic']);
});
test('comparison requires both majors, same stage and exact checksums',()=>{
 const a={captureStage:harness.STAGE,serverVersionNum:'170011',checksums:{x:'same'},components:[{components:{constraints:{hash:'pg17'}},non_n_constraints:{hash:'pg17'}}]};
 const b={...a,serverVersionNum:'180004',components:[{components:{constraints:{hash:'pg18'}},non_n_constraints:{hash:'pg17'}}]};
 assert.equal(harness.compareExternalIntegrationCaptures(a,b).nonNConstraintsEqual,true);
 assert.throws(()=>harness.compareExternalIntegrationCaptures(a,{...b,checksums:{x:'drift'}}));
 assert.throws(()=>harness.compareExternalIntegrationCaptures(a,a));
});
test('owned lifecycle, all-schema preexistence and checksum gates preserved',async()=>{
 const source=await readFile('scripts/rel002-external-integration-fixture-capture.mjs','utf8');
 for(const expression of [/runOwnedCluster\(/,/assertOwnedTarget\(/,/stopOwnedCluster\(lifecycle/,/sanitizedEnvironment\(env\)/,/left\(nspname,4\)='app_'/,/path === ARTIFACTS\[0\]/,/createStageReporter\(/])assert.match(source,expression);
 assert.doesNotMatch(source,/unlink|rmSync|rmdir/); assert.doesNotMatch(source,/client.query[^\n]*set_config/);
 const migration=await readFile(harness.ARTIFACTS[1],'utf8');assert.doesNotMatch(migration,/REFERENCES app_organization|regclass.*app_organization/);
});
test('approved ExternalIntegration001 sidecar SHA matches',async()=>{
 const {createHash}=await import('node:crypto');
 for(const path of [harness.ARTIFACTS[0]])assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),(await readFile(path+'.sha256','utf8')).trim().split(/\s+/)[0]);
});



test('artifact GUC belongs only to ExternalIntegration',async()=>{
 const sql=await readFile(harness.DIAGNOSTIC,'utf8');
 assert.match(sql,/ai_mls\.r3b1_external_integration_artifact_sha256/);
 assert.doesNotMatch(sql,/r3b1_publication|r3b1_administration/);
});
test('comparison reports unequal non-n evidence without claiming equivalence',()=>{
 const a={captureStage:harness.STAGE,serverVersionNum:'170011',checksums:{x:'same'},components:[{components:{constraints:{hash:'pg17'}},non_n_constraints:{hash:'pg17'}}]};
 const b={...a,serverVersionNum:'180004',components:[{components:{constraints:{hash:'pg18'}},non_n_constraints:{hash:'different'}}]};
 assert.equal(harness.compareExternalIntegrationCaptures(a,b).nonNConstraintsEqual,false);
});
