import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client } from "pg";
import type { QueryResult } from "pg";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);
const database = "rel002_historical_attestation_test";
const artifact = (name: string): Promise<string> => readFile(
  resolve(`modules/identity/migrations/postgresql/production/${name}`), "utf8",
);

test("historical migration attestation is exact-bound append-only and native-ledger subordinate", { skip: !enabled }, async (context) => {
  const client = new Client({ host: "127.0.0.1", port, user: "postgres", database });
  const migration = await artifact("001_identity_persistence_v1.up.sql");
  const schema = await artifact("006_historical_migration_attestation_schema_v1.sql");
  const record = await artifact("007_record_historical_identity_migration_attestation_v1.sql");
  const verify = await artifact("008_historical_identity_migration_attestation_v1.verify.sql");
  await client.connect();

  const reset = async (): Promise<void> => {
    await client.query("DROP SCHEMA IF EXISTS app_identity CASCADE");
    await client.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_mls_production_runtime') THEN CREATE ROLE ai_mls_production_runtime NOLOGIN; END IF; END $$");
    await client.query(migration);
    await client.query(schema);
  };
  const runRecord = async (values: { operator?: string; backup?: string; schema?: string }): Promise<void> => {
    await client.query("BEGIN");
    try {
      if (values.operator !== undefined) await client.query("SELECT set_config('ai_mls.operator_evidence_ref', $1, true)", [values.operator]);
      if (values.backup !== undefined) await client.query("SELECT set_config('ai_mls.backup_evidence_ref', $1, true)", [values.backup]);
      if (values.schema !== undefined) await client.query("SELECT set_config('ai_mls.schema_verification_evidence_ref', $1, true)", [values.schema]);
      await client.query(record);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  };
  const insertDirect = async (overrides: {
    migrationId?: string; checksum?: string; fingerprint?: string;
    historicalAppliedAt?: Date | null; historicalAppliedAtKnown?: boolean;
  } = {}): Promise<void> => {
    await client.query(`INSERT INTO app_identity.identity_historical_migration_attestations
      (migration_id, artifact_checksum, contract_id, schema_version, database_engine, contract_fingerprint,
       target_environment, historical_applied_at, historical_applied_at_known, operator_evidence_ref,
       backup_evidence_ref, schema_verification_evidence_ref, reason, result)
      VALUES ($1, $2, 'identity.registered-service-workload', 1, 'POSTGRESQL', $3, 'PRODUCTION', $4, $5,
       'evidence:operator', 'evidence:backup', 'evidence:schema',
       'HISTORICAL_APPLIED_AT_UNRECOVERABLE', 'VERIFIED_EXISTING_SCHEMA')`, [
      overrides.migrationId ?? "REL002-P2D0B-IDENTITY-PG-V1",
      overrides.checksum ?? "b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e",
      overrides.fingerprint ?? "33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82",
      overrides.historicalAppliedAt ?? null,
      overrides.historicalAppliedAtKnown ?? false,
    ]);
  };
  const exact = Object.freeze({ operator: "evidence:operator", backup: "evidence:backup", schema: "evidence:schema-verifier" });

  try {
    await context.test("records the exact historical exception and exposes historical provenance", async () => {
      await reset();
      await runRecord(exact);
      const row = await client.query<{
        historical_applied_at: Date | null;
        historical_applied_at_known: boolean;
        evidence_recorded_at: Date;
      }>("SELECT historical_applied_at, historical_applied_at_known, evidence_recorded_at FROM app_identity.identity_historical_migration_attestations");
      assert.equal(row.rowCount, 1);
      assert.equal(row.rows[0]?.historical_applied_at, null);
      assert.equal(row.rows[0]?.historical_applied_at_known, false);
      assert.ok(row.rows[0]?.evidence_recorded_at instanceof Date);
      const results = await client.query<{ readiness_provenance: string }>(verify) as unknown as QueryResult<{ readiness_provenance: string }>[];
      assert.equal(results.at(-1)?.rows.at(-1)?.readiness_provenance, "HISTORICAL_MIGRATION_ATTESTATION_VERIFIED");
    });

    await context.test("rejects missing evidence, duplicate evidence, and native-ledger conflicts", async () => {
      await reset();
      await assert.rejects(runRecord({ backup: exact.backup, schema: exact.schema }));
      await assert.rejects(runRecord({ operator: exact.operator, schema: exact.schema }));
      await assert.rejects(runRecord({ operator: exact.operator, backup: exact.backup }));
      await runRecord(exact);
      await assert.rejects(runRecord(exact), /historical migration attestation ledger must be empty/u);
      await reset();
      await client.query(`INSERT INTO app_identity.identity_schema_migrations
        (migration_id, artifact_checksum, contract_id, schema_version, database_engine, contract_fingerprint,
         target_environment, operator_evidence_ref, backup_evidence_ref, applied_at, result)
        VALUES ('REL002-P2D0B-IDENTITY-PG-V1', 'b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e',
        'identity.registered-service-workload', 1, 'POSTGRESQL',
        '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82',
        'PRODUCTION', 'evidence:operator', 'evidence:backup', transaction_timestamp(), 'APPLIED')`);
      await assert.rejects(runRecord(exact), /requires absent native ledger evidence/u);
    });

    await context.test("rejects generic exceptions, schema mismatches, and every mutation path", async () => {
      await reset();
      await assert.rejects(insertDirect({ migrationId: "OTHER" }));
      await assert.rejects(insertDirect({ checksum: "0".repeat(64) }));
      await assert.rejects(insertDirect({ fingerprint: "0".repeat(64) }));
      await assert.rejects(insertDirect({ historicalAppliedAtKnown: true }));
      await assert.rejects(insertDirect({ historicalAppliedAt: new Date("2026-09-24T00:00:00.000Z") }));
      await client.query(`ALTER TABLE app_identity.identity_sessions
        DROP CONSTRAINT identity_sessions_chronology_check,
        ADD CONSTRAINT identity_sessions_chronology_check CHECK (TRUE)`);
      await assert.rejects(runRecord(exact), /exact schema verification failed/u);
      await reset();
      await runRecord(exact);
      await client.query(`ALTER TABLE app_identity.identity_historical_migration_attestations
        DROP CONSTRAINT identity_historical_attestations_exact_migration_check,
        ADD CONSTRAINT identity_historical_attestations_exact_migration_check CHECK (TRUE)`);
      await assert.rejects(client.query(verify), /exact schema verification failed/u);
      await reset();
      await runRecord(exact);
      await assert.rejects(client.query("UPDATE app_identity.identity_historical_migration_attestations SET result = result"), /APPEND-ONLY/u);
      await assert.rejects(client.query("DELETE FROM app_identity.identity_historical_migration_attestations"), /APPEND-ONLY/u);
      await assert.rejects(client.query("TRUNCATE app_identity.identity_historical_migration_attestations"), /APPEND-ONLY/u);
    });
  } finally {
    await client.query("DROP SCHEMA IF EXISTS app_identity CASCADE");
    await client.end();
  }
});
