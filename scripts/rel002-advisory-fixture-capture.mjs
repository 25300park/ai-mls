// Local diagnostic only. Importing this module never starts PostgreSQL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const STAGE = 'POST_ADVISORY_RUNTIME_GRANTS';

import { validateInputs, sanitizedEnvironment, assertOwnedTarget, runPgCtlLifecycle, runOwnedCluster, stopOwnedCluster, createStageReporter } from './rel002-r3c1-fixture-capture.mjs';
export const ARTIFACTS = ['modules/ai/advisory/migrations/postgresql/production/001_schema_v1.up.sql','modules/ai/advisory/migrations/postgresql/production/002_runtime_role_grants.sql'];
export const DIAGNOSTIC = 'docs/diagnostics/REL002_ADVISORY_COMPONENT_DIAGNOSTIC.sql';
export const VERIFIER = 'modules/ai/advisory/migrations/postgresql/production/001_schema_v1.verify.sql';
export function validateAdvisoryInputs(input, env) {
  return validateInputs(input, {...env, REL002_R3C1_CAPTURE_DISPOSABLE: env.REL002_ADVISORY_CAPTURE_DISPOSABLE});
}
export function assertSelectOnly(sql) {
  const lexical = sql.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
  assert.match(lexical,/^\s*WITH\b/);
  assert.doesNotMatch(lexical,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|DO|CALL|SET|COPY|set_config)\b/i);
  assert.equal((lexical.match(/;/g)??[]).length,1);
}
export async function captureAdvisory(client, load, diagnostic, stages=createStageReporter()) {
  await stages.run('SET_MIGRATION_ROLE',()=>client.query('SET ROLE ai_mls_production_migration_operator'));
  for(const [i,path] of ARTIFACTS.entries()) await stages.run(['APPLY_ADVISORY_001','APPLY_ADVISORY_002'][i],async()=>client.query(await load(path)));
  await stages.run('RESET_MIGRATION_ROLE',()=>client.query('RESET ROLE'));
  // Historical role_table_grants material must be observed by the administrator,
  // just as the historical migration verifier; runtime effective privileges are explicit.
  return (await stages.run('RUN_COMPONENT_DIAGNOSTIC',()=>client.query(diagnostic))).rows;
}
export function compareAdvisoryCaptures(a,b) {
  assert.equal(a.captureStage,STAGE); assert.equal(b.captureStage,STAGE);
  assert.deepEqual([Math.floor(Number(a.serverVersionNum)/10000),Math.floor(Number(b.serverVersionNum)/10000)].sort(),[17,18]);
  assert.deepEqual(a.checksums,b.checksums);
  const pg17=Number(a.serverVersionNum)<180000?a:b, pg18=pg17===a?b:a;
  return { nonNConstraintsEqual: pg17.components[0].components.constraints.hash === pg18.components[0].non_n_constraints.hash,
    components: Object.fromEntries(Object.keys(pg17.components[0].components).map(k=>[k,pg17.components[0].components[k].hash===pg18.components[0].components[k].hash])) };
}
import { buildDiagnostic as buildHistoricalDiagnostic } from './rel002-publication-fixture-capture.mjs';
export const CHILD_SOURCE='apps/api/src/child-root-postgresql-readiness.ts';
export function buildDiagnostic(source,verifier) {
 let base=buildHistoricalDiagnostic(verifier).replaceAll('app_publication','app_advisory').replaceAll('ai_mls.r3b1_publication_artifact_sha256','ai_mls.r3b1_advisory_artifact_sha256').replaceAll('POST_PUBLICATION_RUNTIME_GRANTS','POST_ADVISORY_RUNTIME_GRANTS');
 const names={columns_hash:'columns',constraints_hash:'constraints',indexes_hash:'indexes',runtime_acl_hash:'runtimeACL',trigger_hash:'triggers',function_hash:'functions',effective_acl_hash:'effectiveACL'};
 const ctes=[];let constraint;
 for(const [alias,name] of Object.entries(names)) {
  const line=source.split('\n').find(l=>l.includes(' AS '+alias+','));
  assert.ok(line,'CHILD_COMPONENT_NOT_FOUND');
  let expression=line.trim().slice(0,line.trim().lastIndexOf(' AS '+alias+','));
  expression=expression.replace('(SELECT md5(', '(SELECT ').replace(')) FROM',') FROM').replaceAll('expected.schema_name',"'app_advisory'").replaceAll(String.fromCharCode(92).repeat(2),String.fromCharCode(92));
  ctes.push(name+' AS (SELECT '+expression+" AS serialized FROM pg_namespace n WHERE n.nspname='app_advisory')");
  if(name==='constraints')constraint=expression;
 }
 assert.ok(constraint);
 ctes.push('non_n AS (SELECT '+constraint.replace("WHERE cn.nspname='app_advisory'", "WHERE cn.nspname='app_advisory' AND c.contype <> 'n'")+" AS serialized FROM pg_namespace n WHERE n.nspname='app_advisory')");
 base=base.slice(base.indexOf('\nSELECT current_setting'));
 return '-- Isolated Advisory catalog metadata only.\nWITH '+ctes.join(',\n')+base.replace(" current_user,current_database(),", " current_setting('data_directory') AS data_directory,current_user,current_database(),");
}

export async function main(args, env) {
  if(args[0] === '--compare-captures') {
    assert.equal(args.length,3);
    const captures=[];
    for(const path of args.slice(1)) {
      assert.ok(/^[A-Za-z]:[\\/]/.test(path));
      captures.push(JSON.parse(await readFile(path,'utf8')));
    }
    console.log(JSON.stringify(compareAdvisoryCaptures(...captures)));
    return;
  }
  const stages = createStageReporter();
  try { return await runHarness(args, env, stages); }
  catch (error) { stages.report(error); throw error; }
}

async function runHarness(args, env, stages) {
  const input = {};
  for (const arg of args) {
    if (arg === '--execute-fixture') input.execute = true;
    else { const m = arg.match(/^--(host|port|major|bin)=(.+)$/); assert.ok(m, 'UNKNOWN_ARGUMENT'); assert.ok(!Object.hasOwn(input, m[1]), 'DUPLICATE_ARGUMENT'); input[m[1]] = m[2]; }
  }
  const config = validateAdvisoryInputs(input, env);
  const plan = { artifacts: [...ARTIFACTS] };
  const checksums = {};
  const sql = new Map();
  for (const path of plan.artifacts) {
    const bytes = await readFile(join(ROOT, path)); sql.set(path, bytes.toString('utf8'));
    if (path === ARTIFACTS[0]) {
      const expected = (await readFile(join(ROOT, path + '.sha256'), 'utf8')).trim().split(/\s+/)[0];
      assert.equal(sha(bytes), expected, 'MIGRATION_CHECKSUM_MISMATCH');
    }
    checksums[path] = sha(bytes);
  }
  const diagnostic = await readFile(join(ROOT, DIAGNOSTIC), 'utf8');
  assertSelectOnly(diagnostic);
  assert.equal(diagnostic, buildDiagnostic(await readFile(join(ROOT, CHILD_SOURCE),'utf8'),await readFile(join(ROOT, VERIFIER), 'utf8')), 'DIAGNOSTIC_SOURCE_MISMATCH');
  const run = (tool, arguments_) => execFileSync(join(config.bin, tool + '.exe'), arguments_, { env: sanitizedEnvironment(env), stdio: 'pipe', windowsHide: true, timeout: 60000 }).toString('utf8');
  const lifecycle = (tool, arguments_) => {
    assert.equal(tool, 'pg_ctl');
    runPgCtlLifecycle(config.bin, env, arguments_);
  };
  for (const tool of ['initdb', 'pg_ctl', 'postgres']) assert.match(run(tool, ['--version']), new RegExp(`PostgreSQL\\) ${config.major}\\.`));
  assert.ok(/^[A-Za-z]:[\\/]/.test(tmpdir()), 'LOCAL_EVIDENCE_DIRECTORY_REQUIRED');
  const evidenceDirectory = await mkdtemp(join(tmpdir(), 'rel002-advisory-capture-'));
  const dataDirectory = join(evidenceDirectory, 'cluster');
  const oldPg = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^PG/i.test(k)));
  for (const key of Object.keys(oldPg)) delete process.env[key];
  let client; let completed = false;
  try {
    run('initdb', ['-D', dataDirectory, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
    await runOwnedCluster(
    () => lifecycle('pg_ctl', ['start', '-D', dataDirectory, '-l', join(evidenceDirectory, 'local-server.log'), '-o', `-h 127.0.0.1 -p ${config.port}`, '-w']),
    async () => {
    const { Client } = await import('pg');
    client = new Client({ host: config.host, port: config.port, database: 'postgres', user: 'postgres', password: '', ssl: false, options: '', application_name: 'rel002-advisory-fixture-capture', connectionTimeoutMillis: 5000 });
    await client.connect();
    const identity = (await client.query("SELECT current_user AS \"currentUser\",current_database() AS database,inet_server_addr()::text AS \"serverAddress\",inet_server_port() AS port,current_setting('server_version') AS version,current_setting('server_version_num') AS version_num,current_setting('data_directory') AS \"dataDirectory\"")).rows[0];
    const target = { ...identity, major: Math.floor(Number(identity.version_num) / 10000), created: true };
    console.log(JSON.stringify({ target, evidenceDirectory, stage: 'BEFORE_FIXTURE_MUTATION' }));
    await stages.run('TARGET_IDENTITY_VERIFICATION', () => assertOwnedTarget({ ...config, dataDirectory, currentUser: 'postgres', database: 'postgres', serverAddress: '127.0.0.1' }, target));
    return identity;
    },
    async identity => {
    await stages.run('PRE_EXISTING_FIXTURE_CHECK', async () => {
      const existing = await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE left(nspname,4)='app_') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present");
      assert.equal(existing.rows[0].present, false, 'PRE_EXISTING_FIXTURE_DENIED');
    });
    await stages.run('CREATE_ROLES', async () => {
      for (const role of ['ai_mls_production_migration_operator', 'ai_mls_production_runtime']) await client.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    });
    await stages.run('DATABASE_PRIVILEGES', async () => {
    await client.query('REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC');
    await client.query('GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator');
    await client.query('GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime');
    });
    const rows = await captureAdvisory(client, async path => sql.get(path), diagnostic, stages);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].capture_stage, STAGE);
    const evidence = { runId: evidenceDirectory.split(/[\\/]/).at(-1), captureStage: STAGE, host: config.host, port: config.port, database: 'postgres', serverVersion: identity.version, serverVersionNum: identity.version_num, migrationSequence: plan.artifacts, checksums, diagnosticSha256: sha(diagnostic), components: rows, businessRowsCreated: 0 };
    await stages.run('WRITE_CAPTURE_JSON', () => writeFile(join(evidenceDirectory, 'capture.json'), JSON.stringify(evidence, null, 2), { flag: 'wx' }));
    completed = true;
    },
    async () => {
      try { if (client) await client.end(); }
      finally { await stages.run('STOP_OWNED_CLUSTER', () => stopOwnedCluster(lifecycle, { created: true, dataDirectory, evidenceDirectory })); }
    });
  } finally {
    Object.assign(process.env, oldPg);
  }
  console.log(JSON.stringify({ capture: completed ? 'COMPLETE' : 'FAILED', captureStage: STAGE, evidenceDirectory, clusterStopped: true, retainedLocalClusterFiles: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2), process.env).catch(() => { process.exitCode = 1; });
}
