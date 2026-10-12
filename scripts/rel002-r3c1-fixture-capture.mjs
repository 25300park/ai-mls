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
const STAGE = 'POST_GRANTS_PRE_IDENTITY014';

export function safeError(error) {
  const name = ['Error', 'AssertionError', 'TypeError', 'RangeError'].includes(error?.name) ? error.name : 'Error';
  const code = /^(?:[0-9A-Z]{5}|ETIMEDOUT|ECONNREFUSED|ENOENT|EACCES|EPERM|ERR_ASSERTION)$/.test(error?.code ?? '') ? error.code : null;
  const firstLine = typeof error?.message === 'string' ? error.message.split('\n')[0].trim() : '';
  const knownMessages = new Set(['OWNED_CLUSTER_STOP_FAILED', 'PRE_EXISTING_FIXTURE_DENIED', 'DIAGNOSTIC_COMPONENT_COUNT_MISMATCH', 'DATA_DIRECTORY_MISMATCH', 'UNOWNED_CLUSTER', 'UNOWNED_CLUSTER_TEARDOWN_DENIED', 'TEARDOWN_SCOPE_MISMATCH']);
  const safeMessage = knownMessages.has(firstLine) || /^(?:permission denied for (?:schema (?:app_identity|app_administration|app_organization|app_audit)|database postgres)|TARGET_(?:port|major|currentUser|database|serverAddress)_MISMATCH)$/.test(firstLine);
  const result = { name, code, message: safeMessage ? firstLine : '[REDACTED_UNRECOGNIZED_ERROR_MESSAGE]' };
  if (['ERROR', 'FATAL', 'PANIC', 'WARNING'].includes(error?.severity)) result.severity = error.severity;
  if (/^[0-9]{1,9}$/.test(error?.position ?? '')) result.position = String(error.position);
  return result;
}

export function createStageReporter(emit = console.error) {
  const failures = []; let reported = false;
  return {
    async run(stage, operation) {
      try { return await operation(); }
      catch (error) { failures.push({ FAILED_STAGE: stage, error: safeError(error) }); throw error; }
    },
    report(error) {
      if (reported) return;
      reported = true;
      const failure = failures[0] ?? { FAILED_STAGE: 'HARNESS_PREFLIGHT', error: safeError(error) };
      const stopFailure = failures.find(f => f.FAILED_STAGE === 'STOP_OWNED_CLUSTER');
      emit(JSON.stringify(stopFailure && stopFailure !== failure ? { ...failure, cleanup_failure: stopFailure } : failure));
    },
  };
}

export function validateInputs(input, env) {
  assert.ok(input.execute === true, 'EXPLICIT_EXECUTION_REQUIRED');
  assert.equal(env.REL002_R3C1_CAPTURE_DISPOSABLE, 'CONFIRMED', 'DISPOSABLE_OPT_IN_REQUIRED');
  assert.ok(['127.0.0.1', 'localhost'].includes(input.host), 'LOOPBACK_REQUIRED');
  assert.ok(!/mfonujjeokvpsfucfxuq|supabase|railway|pooler/i.test(input.host));
  assert.ok(/^\d{4,5}$/.test(input.port), 'EXPLICIT_PORT_REQUIRED');
  const port = Number(input.port);
  assert.ok(port !== 5432 && port >= 1024 && port <= 65535, 'PORT_DENIED');
  assert.ok(['17', '18'].includes(input.major), 'PG_MAJOR_REQUIRED');
  assert.ok(typeof input.bin === 'string' && isAbsolute(input.bin), 'EXPLICIT_BINARY_DIRECTORY_REQUIRED');
  assert.ok(/^[A-Za-z]:[\\/]/.test(input.bin), 'LOCAL_WINDOWS_BINARY_DIRECTORY_REQUIRED');
  for (const name of ['DATABASE_URL', 'AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1', 'AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1']) {
    assert.ok(!Object.hasOwn(env, name), `${name}_MUST_BE_UNSET`);
  }
  return { host: '127.0.0.1', port, major: Number(input.major), bin: resolve(input.bin) };
}

export function sanitizedEnvironment(env) {
  const safe = {};
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP', 'COMSPEC']) {
    if (env[key] !== undefined) safe[key] = env[key];
  }
  return safe;
}

export function deriveFixturePlan(source) {
  const rootsBlock = source.match(/const roots = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(rootsBlock, 'FIXTURE_ROOTS_NOT_FOUND');
  const roots = [...rootsBlock.matchAll(/\["(modules\/\w+)", "([^"]+)"/g)].map(m => `${m[1]}/migrations/postgresql/production/${m[2]}.up.sql`);
  assert.deepEqual(roots, [
    'modules/organization/migrations/postgresql/production/001_organization_governance_v1.up.sql',
    'modules/administration/migrations/postgresql/production/003_project_governance_v1.up.sql',
    'modules/identity/migrations/postgresql/production/012_workload_startup_binding_v1.up.sql',
  ], 'HISTORICAL_FIXTURE_ORDER_CHANGED');
  const beforeRoots = source.slice(source.indexOf('await migration.connect();'), source.indexOf('await t.test("forward-only'));
  const initial = [...beforeRoots.matchAll(/readFile\("([^"]+\.sql)", "utf8"\)/g)].map(m => m[1]);
  assert.deepEqual(initial, [
    'modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql',
    'modules/administration/migrations/postgresql/production/001_schema_v1.up.sql',
    'modules/administration/migrations/postgresql/production/002_runtime_role_grants.sql',
  ]);
  const identityGrants = beforeRoots.match(/migration.query\("(GRANT USAGE ON SCHEMA app_identity[^"\n]+)"\)/)?.[1];
  assert.ok(identityGrants);
  return { artifacts: [...initial, ...roots], identityGrants };
}

export function normalizeLoopbackServerAddress(address) {
  assert.ok(address === '127.0.0.1' || address === '127.0.0.1/32', 'TARGET_serverAddress_MISMATCH');
  return '127.0.0.1';
}

export function assertOwnedTarget(expected, observed) {
  assert.equal(observed.created, true, 'UNOWNED_CLUSTER');
  for (const key of ['port', 'major', 'currentUser', 'database']) assert.equal(observed[key], expected[key], `TARGET_${key}_MISMATCH`);
  assert.equal(normalizeLoopbackServerAddress(observed.serverAddress), normalizeLoopbackServerAddress(expected.serverAddress), 'TARGET_serverAddress_MISMATCH');
  assert.equal(resolve(observed.dataDirectory).toLowerCase(), resolve(expected.dataDirectory).toLowerCase(), 'DATA_DIRECTORY_MISMATCH');
}

export function stopOwnedCluster(run, ownership) {
  assert.equal(ownership.created, true, 'UNOWNED_CLUSTER_TEARDOWN_DENIED');
  assert.equal(resolve(ownership.dataDirectory), join(resolve(ownership.evidenceDirectory), 'cluster'), 'TEARDOWN_SCOPE_MISMATCH');
  run('pg_ctl', ['stop', '-D', ownership.dataDirectory, '-m', 'fast', '-w']);
}

// A Windows postgres child must not retain stdout/stderr pipes awaited by Node.
// Startup server output is recorded by pg_ctl's explicit -l file instead.
export function runPgCtlLifecycle(bin, env, args, execute = execFileSync) {
  assert.ok(['start', 'stop'].includes(args[0]), 'INVALID_PGCTL_LIFECYCLE');
  execute(join(bin, 'pg_ctl.exe'), args, { env: sanitizedEnvironment(env), stdio: 'ignore', windowsHide: true, timeout: 60000 });
}

export async function runOwnedCluster(start, proveReadiness, capture, stop, report = console.error) {
  try {
    await start();
    const identity = await proveReadiness();
    return await capture(identity);
  } finally {
    try { await stop(); }
    catch {
      report('OWNED_CLUSTER_STOP_FAILED; retained cluster files require Human review.');
      throw new Error('OWNED_CLUSTER_STOP_FAILED');
    }
  }
}

export async function captureFixture(client, plan, load, diagnostic, stages = createStageReporter()) {
  await stages.run('SET_MIGRATION_ROLE', () => client.query('SET ROLE ai_mls_production_migration_operator'));
  const labels = ['APPLY_IDENTITY_001', 'APPLY_ADMINISTRATION_001', 'APPLY_ADMINISTRATION_002', 'APPLY_ORGANIZATION_001', 'APPLY_ADMINISTRATION_003', 'APPLY_IDENTITY_012'];
  for (const [index, path] of plan.artifacts.entries()) {
    await stages.run(labels[index], async () => client.query(await load(path)));
    if (index === 0) await stages.run('ALTER_IDENTITY_SCHEMA_OWNER', () => client.query('ALTER SCHEMA app_identity OWNER TO ai_mls_production_migration_operator'));
    if (index === 2) await stages.run('APPLY_IDENTITY_RUNTIME_GRANTS', () => client.query(plan.identityGrants));
  }
  await stages.run('RESET_MIGRATION_ROLE', () => client.query('RESET ROLE'));
  await stages.run('SET_RUNTIME_ROLE', () => client.query('SET ROLE ai_mls_production_runtime'));
  try { return (await stages.run('RUN_COMPONENT_DIAGNOSTIC', () => client.query(diagnostic))).rows; }
  finally { await stages.run('RESET_RUNTIME_ROLE', () => client.query('RESET ROLE')); }
}

export async function main(args, env) {
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
  const config = validateInputs(input, env);
  const plan = deriveFixturePlan(await readFile(join(ROOT, 'apps/api/src/rel002-r3c1-postgresql.integration.test.ts'), 'utf8'));
  const checksums = {};
  const sql = new Map();
  for (const path of plan.artifacts) {
    const bytes = await readFile(join(ROOT, path)); sql.set(path, bytes.toString('utf8'));
    if (plan.artifacts.slice(-3).includes(path)) {
      const expected = (await readFile(join(ROOT, path + '.sha256'), 'utf8')).trim();
      assert.equal(sha(bytes), expected, 'MIGRATION_CHECKSUM_MISMATCH');
    }
    checksums[path] = sha(bytes);
  }
  const diagnostic = await readFile(join(ROOT, 'docs/diagnostics/REL002_R3C1_FIXTURE_COMPONENT_DIAGNOSTIC.sql'), 'utf8');
  const source = await readFile(join(ROOT, 'apps/api/src/r3c1-postgresql-readiness.ts'), 'utf8');
  const raw = JSON.parse(source.match(/withRegistrationOperatorReadiness\(("(?:[^"\\]|\\.)*")\);/)[1]);
  const material = raw.replace('md5(jsonb_build_object(', 'jsonb_build_object(').replace(')::text) AS fingerprint', ') AS root_json');
  assert.ok(diagnostic.includes(`WITH raw_material AS (${material}),`), 'DIAGNOSTIC_SOURCE_MISMATCH');
  const lexical = diagnostic.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.ok(/^\s*WITH\b/.test(lexical));
  assert.doesNotMatch(lexical, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|DO|CALL|SET|COPY)\b/i);
  assert.equal((lexical.match(/;/g) ?? []).length, 1);
  const run = (tool, arguments_) => execFileSync(join(config.bin, tool + '.exe'), arguments_, { env: sanitizedEnvironment(env), stdio: 'pipe', windowsHide: true, timeout: 60000 }).toString('utf8');
  const lifecycle = (tool, arguments_) => {
    assert.equal(tool, 'pg_ctl');
    runPgCtlLifecycle(config.bin, env, arguments_);
  };
  for (const tool of ['initdb', 'pg_ctl', 'postgres']) assert.match(run(tool, ['--version']), new RegExp(`PostgreSQL\\) ${config.major}\\.`));
  assert.ok(/^[A-Za-z]:[\\/]/.test(tmpdir()), 'LOCAL_EVIDENCE_DIRECTORY_REQUIRED');
  const evidenceDirectory = await mkdtemp(join(tmpdir(), 'rel002-r3c1-capture-'));
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
    client = new Client({ host: config.host, port: config.port, database: 'postgres', user: 'postgres', password: '', ssl: false, options: '', application_name: 'rel002-r3c1-fixture-capture', connectionTimeoutMillis: 5000 });
    await client.connect();
    const identity = (await client.query("SELECT current_user AS \"currentUser\",current_database() AS database,inet_server_addr()::text AS \"serverAddress\",inet_server_port() AS port,current_setting('server_version') AS version,current_setting('server_version_num') AS version_num,current_setting('data_directory') AS \"dataDirectory\"")).rows[0];
    const target = { ...identity, major: Math.floor(Number(identity.version_num) / 10000), created: true };
    console.log(JSON.stringify({ target, evidenceDirectory, stage: 'BEFORE_FIXTURE_MUTATION' }));
    await stages.run('TARGET_IDENTITY_VERIFICATION', () => assertOwnedTarget({ ...config, dataDirectory, currentUser: 'postgres', database: 'postgres', serverAddress: '127.0.0.1' }, target));
    return identity;
    },
    async identity => {
    await stages.run('PRE_EXISTING_FIXTURE_CHECK', async () => {
      const existing = await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('app_identity','app_administration','app_organization','app_audit')) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'ai_mls_%') AS present");
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
    const rows = await captureFixture(client, plan, async path => sql.get(path), diagnostic, stages);
    assert.equal(rows.length, 114, 'DIAGNOSTIC_COMPONENT_COUNT_MISMATCH');
    assert.ok(rows.every(row => row.raw_three_roots && row.wrapped_three_roots && row.component && row.current_user === 'ai_mls_production_runtime'));
    const evidence = { runId: evidenceDirectory.split(/[\\/]/).at(-1), captureStage: STAGE, host: config.host, port: config.port, database: 'postgres', serverVersion: identity.version, serverVersionNum: identity.version_num, migrationSequence: plan.artifacts, identityRuntimeGrants: plan.identityGrants, checksums, diagnosticSha256: sha(diagnostic), components: rows, applicationRowsCreated: 0 };
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
