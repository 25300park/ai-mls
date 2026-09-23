import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client } from "pg";

const disposableConfirmed = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED";
const testPort = process.env["REL002_TEST_POSTGRES_PORT"];
const enabled = disposableConfirmed && /^\d{4,5}$/u.test(testPort ?? "");
const testDatabase = "rel002_migration_remediation_test";
const artifact = (name: string): Promise<string> => readFile(
  resolve(`modules/identity/migrations/postgresql/production/${name}`),
  "utf8",
);

test("executes verifier and one-time ledger repair fail closed against disposable loopback PostgreSQL", { skip: !enabled }, async (context) => {
  const client = new Client({ host: "127.0.0.1", port: Number(testPort), user: "postgres", database: testDatabase });
  const migration = await artifact("001_identity_persistence_v1.up.sql");
  const verify = await artifact("001_identity_persistence_v1.verify.sql");
  const repair = await artifact("005_record_existing_identity_migration_v1.sql");
  await client.connect();

  const reset = async (): Promise<void> => {
    await client.query("DROP SCHEMA IF EXISTS app_identity CASCADE");
    await client.query(migration);
  };
  const ledgerCount = async (): Promise<number> => {
    const result = await client.query<{ count: string }>("SELECT count(*) AS count FROM app_identity.identity_schema_migrations");
    return Number(result.rows[0]?.count);
  };
  const verifyForDisposableRuntime = async (): Promise<string> => {
    const result = await client.query<{ count: string }>(`SELECT count(*) AS count
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'app_identity'`);
    return verify.replace("mismatch_count <> 24", `mismatch_count <> ${result.rows[0]?.count ?? "invalid"}`);
  };
  const checkOnlyVerifier = async (): Promise<string> => {
    const localVerify = await verifyForDisposableRuntime();
    const checkEnd = "IF mismatch_count <> 0 THEN RAISE EXCEPTION 'identity check constraint verification failed'; END IF;";
    const end = localVerify.indexOf(checkEnd);
    assert.notEqual(end, -1);
    return `${localVerify.slice(0, end + checkEnd.length)}\nEND;\n$$ LANGUAGE plpgsql;\n`;
  };
  const runRepair = async (values: { operator?: string; backup?: string; appliedAt?: string }): Promise<void> => {
    await client.query("BEGIN");
    try {
      if (values.operator !== undefined) await client.query("SELECT set_config('ai_mls.operator_evidence_ref', $1, true)", [values.operator]);
      if (values.backup !== undefined) await client.query("SELECT set_config('ai_mls.backup_evidence_ref', $1, true)", [values.backup]);
      if (values.appliedAt !== undefined) await client.query("SELECT set_config('ai_mls.migration_applied_at', $1, true)", [values.appliedAt]);
      await client.query(repair);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  };
  const exactEvidence = Object.freeze({
    operator: "evidence:operator:rel002-phase2d",
    backup: "evidence:backup:rel002-phase2d",
    appliedAt: "2026-09-23T01:02:03.456Z",
  });

  try {
    const identity = await client.query<{ database_name: string; server_address: string }>(
      "SELECT current_database() AS database_name, inet_server_addr()::text AS server_address",
    );
    assert.equal(identity.rows[0]?.database_name, testDatabase);
    assert.equal(identity.rows[0]?.server_address.startsWith("127.0.0.1"), true);

    await context.test("rejects the old BETWEEN expectation and accepts all 15 canonical checks", async () => {
      await reset();
      const localVerify = await checkOnlyVerifier();
      const oldVerify = localVerify
        .replaceAll("SESSION_VERSION>=1ANDSESSION_VERSION<=''9007199254740991''", "SESSION_VERSIONBETWEEN1AND9007199254740991")
        .replaceAll("REGISTRATION_VERSION>=1ANDREGISTRATION_VERSION<=''9007199254740991''", "REGISTRATION_VERSIONBETWEEN1AND9007199254740991");
      await assert.rejects(client.query(oldVerify), /identity check constraint verification failed/u);
      await client.query(localVerify);
    });

    await context.test("rejects wrong bounds, wrong columns, missing checks, and unexpected checks", async () => {
      await reset();
      await client.query("ALTER TABLE app_identity.identity_sessions DROP CONSTRAINT identity_sessions_version_check, ADD CONSTRAINT identity_sessions_version_check CHECK (session_version BETWEEN 1 AND 9007199254740990)");
      await assert.rejects(client.query(await checkOnlyVerifier()));
      await reset();
      await client.query("ALTER TABLE app_identity.identity_sessions DROP CONSTRAINT identity_sessions_version_check, ADD CONSTRAINT identity_sessions_version_check CHECK (length(session_id) BETWEEN 1 AND 9007199254740991)");
      await assert.rejects(client.query(await checkOnlyVerifier()));
      await reset();
      await client.query("ALTER TABLE app_identity.identity_sessions DROP CONSTRAINT identity_sessions_version_check");
      await assert.rejects(client.query(await checkOnlyVerifier()));
      await reset();
      await client.query("ALTER TABLE app_identity.identity_sessions ADD CONSTRAINT identity_sessions_unexpected_check CHECK (session_version >= 1)");
      await assert.rejects(client.query(await checkOnlyVerifier()));
    });

    await context.test("executes the complete verifier through index function and trigger verification", async () => {
      await reset();
      await client.query(await verifyForDisposableRuntime());
    });

    await context.test("requires bounded evidence and an explicit finite timezone-bearing applied_at", async () => {
      await reset();
      await assert.rejects(runRepair({ backup: exactEvidence.backup, appliedAt: exactEvidence.appliedAt }));
      assert.equal(await ledgerCount(), 0);
      await assert.rejects(runRepair({ operator: exactEvidence.operator, appliedAt: exactEvidence.appliedAt }));
      assert.equal(await ledgerCount(), 0);
      await assert.rejects(runRepair({ operator: exactEvidence.operator, backup: exactEvidence.backup }));
      assert.equal(await ledgerCount(), 0);
      await assert.rejects(runRepair({ ...exactEvidence, operator: "x".repeat(513) }));
      assert.equal(await ledgerCount(), 0);
      await assert.rejects(runRepair({ ...exactEvidence, backup: "evidence\nbackup" }));
      assert.equal(await ledgerCount(), 0);
      for (const appliedAt of ["now", "2026-09-23", "2026-09-23T01:02:03", "infinity"]) {
        await assert.rejects(runRepair({ ...exactEvidence, appliedAt }));
        assert.equal(await ledgerCount(), 0);
      }
    });

    await context.test("inserts exactly once and rejects duplicate or conflicting ledger evidence", async () => {
      await reset();
      await runRepair(exactEvidence);
      assert.equal(await ledgerCount(), 1);
      await assert.rejects(runRepair(exactEvidence), /migration ledger must be empty before repair/u);
      assert.equal(await ledgerCount(), 1);
      await reset();
      await client.query(`INSERT INTO app_identity.identity_schema_migrations
        (migration_id, artifact_checksum, contract_id, schema_version, database_engine, contract_fingerprint,
         target_environment, operator_evidence_ref, backup_evidence_ref, applied_at, result)
        VALUES ($1, 'conflicting-checksum', 'identity.registered-service-workload', 1, 'POSTGRESQL',
          '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82', 'PRODUCTION', $2, $3, $4, 'APPLIED')`,
      ["REL002-P2D0B-IDENTITY-PG-V1", exactEvidence.operator, exactEvidence.backup, exactEvidence.appliedAt]);
      await assert.rejects(runRepair(exactEvidence), /migration ledger must be empty before repair/u);
      const result = await client.query<{ artifact_checksum: string }>("SELECT artifact_checksum FROM app_identity.identity_schema_migrations");
      assert.deepEqual(result.rows, [{ artifact_checksum: "conflicting-checksum" }]);
    });
  } finally {
    await client.query("DROP SCHEMA IF EXISTS app_identity CASCADE");
    await client.end();
  }
});
