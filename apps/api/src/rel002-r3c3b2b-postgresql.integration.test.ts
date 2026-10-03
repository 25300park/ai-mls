import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { Client, Pool } from "pg";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import { Argon2idV1Verifier } from "../../../modules/identity/src/first-party-credential-argon2.js";
import { FirstPartyCredentialAuthenticationAdapter } from "../../../modules/identity/src/first-party-credential-adapter.js";
import { PostgreSqlHumanCredentialReader } from "../../../modules/identity/src/first-party-credential-postgresql.js";
import { PostgreSqlSessionReader, PostgreSqlSessionUnitOfWork, type AsyncSessionUnitOfWork } from "../../../modules/identity/src/session-postgresql-persistence.js";
import { SessionService } from "../../../modules/identity/src/session-service.js";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { assertFirstPartyAuthenticationReady, createFirstPartyAuthenticationRegistration } from "./first-party-authentication-composition.js";
import { assertFirstPartyCredentialPersistenceReady } from "./first-party-authentication-readiness.js";

const enabled = process.env['REL002_TEST_POSTGRES_DISPOSABLE'] === 'CONFIRMED' && process.env['REL002_TEST_POSTGRES_PORT'] === '55441';
const config = { host: '127.0.0.1', port: 55441, database: 'postgres' };
const migrationFile = 'modules/identity/migrations/postgresql/production/015_identity_human_credentials_v1.up.sql';
const binding = { adapterId: 'ai-mls.identity.first-party-credential.v1', adapterKind: 'FIRST_PARTY_CREDENTIAL', configurationRef: { schemaVersion: 1, adapterId: 'ai-mls.identity.first-party-credential.v1', algorithmProfile: 'ARGON2ID_V1' } };
const evidence = { schemaVersion: 1 as const, loginIdentifier: 'User01', password: 'synthetic fixture password' };

test('R3-C3B2B first-party authentication in dedicated disposable PostgreSQL', { skip: !enabled, timeout: 60000 }, async t => {
  const migration = new Client({ ...config, user: 'ai_mls_production_migration_operator' });
  const native = new Pool({ ...config, user: 'ai_mls_production_runtime', max: 1 });
  const pool: PostgreSqlPoolPort = { async connect() {
    const client = await native.connect();
    return { query: async <Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> => await client.query(sql, values ? [...values] : undefined) as unknown as PostgreSqlQueryResult<Row>, release: destroy => client.release(destroy) };
  }, close: () => native.end() };
  await migration.connect();
  const crypto = new Argon2idV1Verifier();
  const reader = new PostgreSqlHumanCredentialReader(pool);
  let sequence = 0;
  const clock = () => new Date('2026-10-03T00:00:00.000Z');
  const audit = new AuditLog({ clock, idFactory: () => `b2b-audit-${String(++sequence)}` });
  const service = (adapter = new FirstPartyCredentialAuthenticationAdapter('tenant-a', reader, crypto)) => new SessionService({ authenticationAdapter: adapter, asyncCreationUnitOfWork: new PostgreSqlSessionUnitOfWork(pool), auditSink: audit, clock, idFactory: () => `b2b-session-${String(++sequence)}`, accessLifetimeMs: 60000, absoluteLifetimeMs: 120000, tenantBindingOrigin: 'identity:first-party:tenant-a' });
  try {
    const exists = await migration.query<{ table: string | null }>("SELECT to_regclass('app_identity.identity_human_principals') AS table");
    if (exists.rows[0]?.table === null) await migration.query(await readFile(migrationFile, 'utf8'));
    await migration.query('TRUNCATE app_identity.identity_human_credentials,app_identity.identity_human_principals');
    await t.test('migration checksum, exact verifier, empty readiness and native primitive', async () => {
      const sql = await readFile(migrationFile);
      assert.equal(createHash('sha256').update(sql).digest('hex'), (await readFile(migrationFile + '.sha256', 'utf8')).trim());
      await migration.query(await readFile(migrationFile.replace('.up.sql', '.verify.sql'), 'utf8'));
      await assertFirstPartyAuthenticationReady(pool, [binding], [createFirstPartyAuthenticationRegistration(pool, 'tenant-a')]);
      await assert.rejects(assertFirstPartyAuthenticationReady(pool, [], []));
      await assert.rejects(assertFirstPartyAuthenticationReady(pool, [binding, binding], [createFirstPartyAuthenticationRegistration(pool, 'tenant-a')]));
      await assert.rejects(assertFirstPartyAuthenticationReady(pool, [{ ...binding, configurationRef: { ...binding.configurationRef, secret: 'synthetic' } }], [createFirstPartyAuthenticationRegistration(pool, 'tenant-a')]));
      await assert.rejects(assertFirstPartyAuthenticationReady(pool, [binding], [createFirstPartyAuthenticationRegistration(pool, 'tenant-a')], new Argon2idV1Verifier({})));
    });
    await t.test('tenant-scoped exact collation, Unicode and uniqueness', async () => {
      for (const [id, tenant, login] of [['a','tenant-a','User01'],['b','tenant-b','User01'],['lower','tenant-a','user01'],['composed','tenant-a','é'],['decomposed','tenant-a','e\u0301']]) {
        await migration.query("INSERT INTO app_identity.identity_human_principals VALUES ($1,$1,$2,$3,'ACTIVE','2026-01-01','2026-01-01')", [id, tenant, login]);
      }
      await assert.rejects(migration.query("INSERT INTO app_identity.identity_human_principals VALUES ('duplicate','duplicate','tenant-a','User01','ACTIVE','2026-01-01','2026-01-01')"), { code: '23505' });
      assert.equal((await migration.query<{ count: string }>("SELECT count(*) FROM app_identity.identity_human_principals WHERE login_identifier='é'")).rows[0]?.count, '1');
      assert.equal((await migration.query<{ count: string }>("SELECT count(*) FROM app_identity.identity_human_principals WHERE tenant_id='tenant-a' AND login_identifier='User01'")).rows[0]?.count, '1');
      const salt = crypto.generateSalt();
      const key = await crypto.derive(evidence.password, salt);
      for (const id of ['a', 'b']) await migration.query("INSERT INTO app_identity.identity_human_credentials VALUES ($1,$2,1,'PASSWORD','ARGON2ID','ARGON2ID_V1',$3,$4,'ACTIVE','2026-01-01',NULL,NULL)", [`credential-${id}`, id, salt, key]);
      assert.equal((await reader.capture('tenant-a','User01'))?.principal.principalId, 'a');
      assert.equal((await reader.capture('tenant-b','User01'))?.principal.principalId, 'b');
      assert.equal(await reader.capture('unknown-tenant','User01'), null);
      assert.equal(await reader.capture('tenant-a','user01'), null);
      await assert.rejects(migration.query("INSERT INTO app_identity.identity_human_credentials VALUES ('duplicate-active','a',2,'PASSWORD','ARGON2ID','ARGON2ID_V1',$1,$2,'ACTIVE','2026-01-01',NULL,NULL)", [salt,key]), { code: '23505' });
    });
    await t.test('runtime SELECT only, no DDL or credential write, migration role excluded', async () => {
      const client = await pool.connect();
      try {
        for (const table of ['identity_human_principals','identity_human_credentials']) {
          await client.query(`SELECT * FROM app_identity.${table} LIMIT 0`);
          for (const sql of [`DELETE FROM app_identity.${table}`, `UPDATE app_identity.${table} SET status=status`, `TRUNCATE app_identity.${table}`, `INSERT INTO app_identity.${table} SELECT * FROM app_identity.${table} LIMIT 0`, `ALTER TABLE app_identity.${table} ADD COLUMN unexpected text`]) await assert.rejects(client.query(sql), { code: '42501' });
        }
      } finally { client.release(); }
      const migrationPool: PostgreSqlPoolPort = { connect: () => Promise.resolve({ query: async <Row extends Record<string, unknown>>(sql: string): Promise<PostgreSqlQueryResult<Row>> => await migration.query(sql) as unknown as PostgreSqlQueryResult<Row>, release() { /* caller owns migration connection */ } }), close: () => Promise.resolve() };
      await assert.rejects(assertFirstPartyCredentialPersistenceReady(migrationPool));
    });
    await t.test('Session issuance uses one runtime pool and is restart-safe without secret persistence', async () => {
      const before = (await migration.query('SELECT credential_id,credential_version,salt,derived_key,status FROM app_identity.identity_human_credentials ORDER BY credential_id')).rows;
      const session = await service().createSession({ evidence, correlationId: 'b2b-issue' });
      assert.equal((await new PostgreSqlSessionReader(pool).find(session.id))?.principalId, 'a');
      assert.equal(JSON.stringify((await migration.query('SELECT payload_json FROM app_identity.identity_sessions WHERE session_id=$1',[session.id])).rows).includes(evidence.password), false);
      assert.equal(JSON.stringify(audit.query({ requesterId: 'security', purpose: 'TEST' })).includes(evidence.password), false);
      assert.deepEqual((await migration.query('SELECT credential_id,credential_version,salt,derived_key,status FROM app_identity.identity_human_credentials ORDER BY credential_id')).rows, before);
      assert.equal(native.options.max, 1);
      assert.equal(native.totalCount, 1);
      assert.equal(native.idleCount, 1);
      assert.throws(() => service().readSession(session.id), /AUTHENTICATION_UNAVAILABLE/);
    });
    await t.test('principal changes between verification and transaction roll back without Session', async () => {
      const before = (await migration.query<{ count: string }>('SELECT count(*) FROM app_identity.identity_sessions')).rows[0]?.count;
      const racing = new FirstPartyCredentialAuthenticationAdapter('tenant-a', { async capture(tenant, login, client) {
        const captured = await reader.capture(tenant,login,client);
        if (client === undefined) await migration.query("UPDATE app_identity.identity_human_principals SET status='DISABLED' WHERE principal_id='a'");
        return captured;
      } }, crypto);
      await assert.rejects(service(racing).createSession({ evidence, correlationId: 'b2b-race' }), /Authentication failed/);
      assert.equal((await migration.query<{ count: string }>('SELECT count(*) FROM app_identity.identity_sessions')).rows[0]?.count, before);
      await migration.query("UPDATE app_identity.identity_human_principals SET status='ACTIVE' WHERE principal_id='a'");
    });
    await t.test('post-revalidation disable and revocation cannot commit before Session issuance', async () => {
      const unit = new PostgreSqlSessionUnitOfWork(pool);

      // Reuse the existing UoW and inject only a test interleaving before its Session operation.
      const interleaving: AsyncSessionUnitOfWork = {
        close: () => unit.close(),
        transaction: (identity, operation, revalidate) => unit.transaction(identity, async sessions => {
          for (const sql of ["UPDATE app_identity.identity_human_principals SET status='DISABLED' WHERE principal_id='a'", "UPDATE app_identity.identity_human_credentials SET status='REVOKED',revoked_at='2026-10-03' WHERE principal_id='a'"]) {
            await migration.query('BEGIN; SET LOCAL lock_timeout = \'80ms\'');
            try { await assert.rejects(migration.query(sql), { code: '55P03' }); } finally { await migration.query('ROLLBACK'); }
          }
          return operation(sessions);
        }, revalidate),
      };
      const issuing = new SessionService({ authenticationAdapter: new FirstPartyCredentialAuthenticationAdapter('tenant-a',reader,crypto), asyncCreationUnitOfWork: interleaving, auditSink: audit, clock, idFactory: () => `b2b-session-${String(++sequence)}`, accessLifetimeMs:60000,absoluteLifetimeMs:120000,tenantBindingOrigin:'identity:first-party:tenant-a' });
      const session = await issuing.createSession({ evidence, correlationId:'b2b-after-revalidation' });
      assert.ok(await new PostgreSqlSessionReader(pool).find(session.id));
      await migration.query("UPDATE app_identity.identity_human_principals SET status='DISABLED' WHERE principal_id='a'");
      await migration.query("UPDATE app_identity.identity_human_principals SET status='ACTIVE' WHERE principal_id='a'");
      assert.throws(() => new SessionService({ authenticationAdapter: new FirstPartyCredentialAuthenticationAdapter('tenant-a',reader,crypto), auditSink:audit,clock,idFactory:()=> 'never',accessLifetimeMs:60000,absoluteLifetimeMs:120000 }), /AUTHENTICATION_UNAVAILABLE/);
    });
    await t.test('Session insert failure rolls back and releases its client', async () => {
      await migration.query("CREATE FUNCTION app_identity.b2b_test_session_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic insert failure'; END $$; CREATE TRIGGER b2b_test_session_failure BEFORE INSERT ON app_identity.identity_sessions FOR EACH ROW EXECUTE FUNCTION app_identity.b2b_test_session_failure()");
      try {
        const before = (await migration.query<{ count: string }>('SELECT count(*) FROM app_identity.identity_sessions')).rows[0]?.count;
        await assert.rejects(service().createSession({ evidence, correlationId: 'b2b-insert-failure' }));
        assert.equal((await migration.query<{ count: string }>('SELECT count(*) FROM app_identity.identity_sessions')).rows[0]?.count, before);
      } finally { await migration.query('DROP TRIGGER b2b_test_session_failure ON app_identity.identity_sessions; DROP FUNCTION app_identity.b2b_test_session_failure()'); }
      await assertFirstPartyCredentialPersistenceReady(pool);
    });
    await t.test('readiness fails closed on schema and ACL drift', async () => {
      for (const [change, restore] of [["ALTER TABLE app_identity.identity_human_principals ADD COLUMN unexpected text", "ALTER TABLE app_identity.identity_human_principals DROP COLUMN unexpected"], ["REVOKE SELECT ON app_identity.identity_human_credentials FROM ai_mls_production_runtime", "GRANT SELECT ON app_identity.identity_human_credentials TO ai_mls_production_runtime"], ["GRANT UPDATE ON app_identity.identity_human_credentials TO ai_mls_production_runtime", "REVOKE UPDATE ON app_identity.identity_human_credentials FROM ai_mls_production_runtime"], ["GRANT SELECT ON app_identity.identity_human_credentials TO PUBLIC", "REVOKE SELECT ON app_identity.identity_human_credentials FROM PUBLIC"]]) {
        await migration.query(change!);
        try { await assert.rejects(assertFirstPartyCredentialPersistenceReady(pool)); } finally { await migration.query(restore!); }
        await assertFirstPartyCredentialPersistenceReady(pool);
      }
    });
    await t.test('immutable credential history and revocation fail closed', async () => {
      await assert.rejects(migration.query("UPDATE app_identity.identity_human_credentials SET derived_key=decode(repeat('00',32),'hex') WHERE principal_id='a'"), { code: '55000' });
      await migration.query("UPDATE app_identity.identity_human_credentials SET status='REVOKED',revoked_at='2026-10-03' WHERE principal_id='a'");
      assert.equal(await service().createSession({ evidence, correlationId: 'b2b-revoked' }).then(() => true, () => false), false);
      await assert.rejects(migration.query("UPDATE app_identity.identity_human_credentials SET status='ACTIVE',revoked_at=NULL WHERE principal_id='a'"), { code: '55000' });
      await assert.rejects(migration.query("DELETE FROM app_identity.identity_human_credentials WHERE principal_id='a'"), { code: '55000' });
    });
  } finally {
    await migration.query("DELETE FROM app_identity.identity_sessions WHERE session_id LIKE 'b2b-session-%'");
    await migration.query('TRUNCATE app_identity.identity_human_credentials,app_identity.identity_human_principals');
    await native.end();
    await migration.end();
  }
});
