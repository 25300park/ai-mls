import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client, Pool } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/index.js";
import { PostgreSqlAdministrationUnitOfWork } from "../../../modules/administration/src/administration-postgresql-persistence.js";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);
const tenantId = "tenant-r3b3";
const identity = Object.freeze({ tenantId, resourceType: "TEAM_SCOPE" as const, resourceId: "team-r3b3" });
const scope = Object.freeze({ tenantId, scopeType: "TEAM" as const, scopeId: identity.resourceId });
const evidence = Object.freeze([{ type: "AUDIT" as const, id: "evidence-r3b3", version: 1 }]);

async function artifact(name: string): Promise<string> {
  return readFile(resolve("modules/administration/migrations/postgresql/production", name), "utf8");
}

test("R3-B3 Administration PostgreSQL persistence commits approval atomically and rolls back on one runtime pool", { skip: !enabled }, async () => {
  const admin = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  await admin.connect();
  const cleanup = async (): Promise<void> => {
    await admin.query("DROP SCHEMA IF EXISTS app_administration CASCADE");
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      const result = await admin.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS exists", [role]);
      if (result.rows[0]?.exists === true) { await admin.query(`DROP OWNED BY ${role}`); await admin.query(`DROP ROLE ${role}`); }
    }
  };
  try {
    await cleanup();
    await admin.query("CREATE ROLE ai_mls_production_migration_operator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query("CREATE ROLE ai_mls_production_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query("GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");
    await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
    const migration = new Client({ host: "127.0.0.1", port, user: "ai_mls_production_migration_operator", database: "postgres" });
    await migration.connect();
    try { await migration.query(await artifact("001_schema_v1.up.sql")); await migration.query(await artifact("002_runtime_role_grants.sql")); }
    finally { await migration.end(); }

    const nativePool = new Pool({ host: "127.0.0.1", port, user: "ai_mls_production_runtime", database: "postgres", max: 2 });
    const pool: PostgreSqlPoolPort = {
      connect: async () => {
        const client = await nativePool.connect();
        return {
          query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]) => client.query(text, values === undefined ? undefined : [...values]) as unknown as Promise<PostgreSqlQueryResult<Row>>,
          release: (destroy?: boolean) => client.release(destroy === true),
        };
      },
      close: () => nativePool.end(),
    };
    const store = new PostgreSqlAdministrationUnitOfWork(pool);
    const proposal = Object.freeze({
      proposalId: "proposal-r3b3", tenantId, resourceType: "TEAM_SCOPE" as const, resourceId: identity.resourceId,
      resourceVersion: 1, scope, proposedBy: "proposer-r3b3", proposedChangeReference: "change-r3b3",
      policyReference: "change-r3b3", status: "PROPOSED" as const, version: 1,
      reasonReference: "reason-r3b3", evidenceReferences: evidence,
    });
    try {
      let transaction = await store.begin(identity);
      transaction.teamScopes.save({ recordType: "TEAM_SCOPE", tenantId, teamId: identity.resourceId, organizationId: "org-r3b3", scope, status: "PROPOSED", version: 1, evidenceReferences: evidence });
      transaction.proposals.save(proposal);
      transaction.idempotency.record({ ...identity, idempotencyKey: "propose-r3b3", operation: "PROPOSE_TEAM_SCOPE_CHANGE", fingerprint: "fingerprint-propose-r3b3", resultReference: proposal.proposalId, resultVersion: 1, resultStatus: "PROPOSED", resultEvidenceReferences: evidence, recordedAt: "2026-09-30T00:00:00.000Z" });
      await transaction.commit();
      assert.equal((await store.teamScopes.find(identity))?.status, "PROPOSED");

      const decisionEvidence = Object.freeze([{ type: "DECISION" as const, id: "decision-r3b3", version: 2 }]);
      transaction = await store.begin(identity);
      transaction.teamScopes.update(1, { recordType: "TEAM_SCOPE", tenantId, teamId: identity.resourceId, organizationId: "org-r3b3", scope, status: "ACTIVE", version: 2, evidenceReferences: [...evidence, ...decisionEvidence] });
      transaction.proposals.update(1, { ...proposal, status: "APPROVED", version: 2, evidenceReferences: [...evidence, ...decisionEvidence] });
      transaction.decisions.append({ decisionId: "decision-r3b3", proposalId: proposal.proposalId, tenantId, operation: "APPROVE_TEAM_SCOPE_CHANGE", resourceType: "TEAM_SCOPE", resourceId: identity.resourceId, scope, proposerId: proposal.proposedBy, decisionActorId: "approver-r3b3", status: "APPROVED", reasonReference: "reason-approve-r3b3", evidenceReferences: decisionEvidence, version: 2, decidedAt: "2026-09-30T00:00:01.000Z" });
      transaction.idempotency.record({ ...identity, idempotencyKey: "approve-r3b3", operation: "APPROVE_TEAM_SCOPE_CHANGE", fingerprint: "fingerprint-approve-r3b3", resultReference: "decision-r3b3", resultVersion: 2, resultStatus: "ACTIVE", recordedAt: "2026-09-30T00:00:01.000Z" });
      await transaction.commit();
      assert.equal((await store.teamScopes.find(identity))?.status, "ACTIVE");
      assert.equal((await store.decisions.list(identity)).length, 1);

      transaction = await store.begin(identity);
      await transaction.rollback();
      assert.equal((await store.decisions.list(identity)).length, 1);
    } finally { await store.close(); await pool.close(); }
  } finally { await cleanup(); await admin.end(); }
});
