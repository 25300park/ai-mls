import assert from "node:assert/strict";
import test from "node:test";

import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../identity/src/index.js";
import { AdministrationPersistenceError, type RoleAssignmentPersistenceRecord, type RolePersistenceRecord } from "./administration-persistence.js";
import { PostgreSqlAdministrationUnitOfWork } from "./administration-postgresql-persistence.js";

const identity = Object.freeze({ tenantId: "tenant-r3b3", resourceType: "ROLE" as const, resourceId: "role-r3b3" });
const scope = Object.freeze({ tenantId: identity.tenantId, scopeType: "TENANT" as const, scopeId: identity.tenantId });
const role: RolePersistenceRecord = Object.freeze({
  recordType: "ROLE", tenantId: identity.tenantId, roleId: identity.resourceId, roleCode: "ADM",
  scope, status: "ACTIVE", policyReference: "policy-r3b3", version: 1,
  evidenceReferences: Object.freeze([{ type: "AUDIT" as const, id: "evidence-r3b3", version: 1 }]),
});
const assignmentIdentity = Object.freeze({ tenantId: identity.tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: "assignment-r3b3" });
const activeAssignmentWithoutDecision: RoleAssignmentPersistenceRecord = Object.freeze({
  recordType: "ROLE_ASSIGNMENT", tenantId: identity.tenantId, roleAssignmentId: assignmentIdentity.resourceId,
  proposalId: "proposal-assignment-r3b3", subjectPrincipalId: "principal-r3b3", subjectPrincipalType: "HUMAN",
  roleId: role.roleId, scope, teamIds: Object.freeze([]), resourceTypes: Object.freeze([]), purposes: Object.freeze([]),
  status: "ACTIVE", effectiveFrom: "2026-09-30T00:00:00.000Z", effectiveUntil: "2026-10-01T00:00:00.000Z",
  proposedBy: "proposer-r3b3", reasonReference: "reason-r3b3", version: 1, evidenceReferences: role.evidenceReferences,
});
const proposal = Object.freeze({
  proposalId: "proposal-r3b3", tenantId: identity.tenantId, resourceType: "ROLE" as const,
  resourceId: identity.resourceId, resourceVersion: 1, scope, proposedBy: "principal-r3b3",
  proposedChangeReference: "change-r3b3", policyReference: "change-r3b3", status: "PROPOSED" as const,
  version: 1, reasonReference: "reason-r3b3", evidenceReferences: role.evidenceReferences,
});
const idempotency = Object.freeze({
  ...identity, idempotencyKey: ["idempotency", "r3b3"].join("-"), operation: "PROPOSE_ROLE_CHANGE" as const,
  fingerprint: "fingerprint-r3b3", resultReference: proposal.proposalId, resultVersion: 1,
  resultStatus: "PROPOSED" as const, resultEvidenceReferences: role.evidenceReferences,
  recordedAt: "2026-09-30T00:00:00.000Z",
});

function fixture(options: { readonly failCommit?: boolean; readonly corruptResourcePayload?: boolean; readonly corruptAuthoritativeStatus?: boolean } = {}) {
  const queries: string[] = [];
  const releases: boolean[] = [];
  let currentRevision = 1;
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<Row>> {
      const sql = text.replace(/\s+/gu, " ").trim();
      queries.push(sql);
      if (options.failCommit === true && sql === "COMMIT") return Promise.reject(new Error("unsafe transport detail"));
      if (sql.startsWith("SELECT tenant_id,resource_type,resource_id,revision")) {
        const selected = options.corruptAuthoritativeStatus === true ? assignmentIdentity : identity;
        return Promise.resolve({ rows: [{ tenant_id: selected.tenantId, resource_type: selected.resourceType, resource_id: selected.resourceId, revision: currentRevision }] as unknown as Row[], rowCount: 1 });
      }
      if (sql.includes("FROM app_administration.administration_resources")) {
        const selected = options.corruptAuthoritativeStatus === true ? activeAssignmentWithoutDecision : role;
        return Promise.resolve({ rows: [{ tenant_id: selected.tenantId, resource_type: selected.recordType, resource_id: options.corruptAuthoritativeStatus === true ? assignmentIdentity.resourceId : role.roleId, version: selected.version, scope_type: selected.scope.scopeType, scope_id: selected.scope.scopeId, payload_json: options.corruptResourcePayload === true ? { ...selected, tenantId: "wrong-tenant" } : selected }] as unknown as Row[], rowCount: 1 });
      }
      if (sql.includes("FROM app_administration.administration_resource_evidence")) return Promise.resolve({ rows: role.evidenceReferences.map((item, index) => ({ sequence: index + 1, payload_json: item })) as unknown as Row[], rowCount: role.evidenceReferences.length });
      if (sql.startsWith("UPDATE app_administration.administration_revisions")) {
        const expected = values?.at(-1);
        if (expected !== currentRevision) return Promise.resolve({ rows: [], rowCount: 0 });
        currentRevision += 1;
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: sql.startsWith("INSERT") || sql.startsWith("UPDATE") ? 1 : 0 });
    },
    release(destroy?: boolean): void { releases.push(destroy === true); },
  };
  const pool: PostgreSqlPoolPort = { connect: () => Promise.resolve(client), close: () => Promise.resolve() };
  return { pool, queries, releases };
}

test("PostgreSQL Administration UoW stages governed proposal/idempotency and commits once on one client", async () => {
  const { pool, queries, releases } = fixture();
  const unitOfWork = new PostgreSqlAdministrationUnitOfWork(pool);
  assert.deepEqual(await unitOfWork.roles.find(identity), role);
  const transaction = await unitOfWork.begin(identity);
  transaction.proposals.save(proposal);
  transaction.idempotency.record(idempotency);
  await transaction.commit();
  assert.equal(queries.filter((sql) => sql === "BEGIN").length, 1);
  assert.equal(queries.filter((sql) => sql === "COMMIT").length, 1);
  assert.equal(queries.some((sql) => sql.startsWith("INSERT INTO app_administration.administration_proposals")), true);
  assert.equal(queries.some((sql) => sql.startsWith("INSERT INTO app_administration.administration_idempotency")), true);
  assert.deepEqual(releases, [false, false]);
});

test("PostgreSQL Administration UoW rollback releases the checked-out client without writes", async () => {
  const { pool, queries, releases } = fixture();
  const transaction = await new PostgreSqlAdministrationUnitOfWork(pool).begin(identity);
  await transaction.rollback();
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.equal(queries.some((sql) => sql.startsWith("INSERT INTO app_administration")), false);
  assert.deepEqual(releases, [false]);
});

test("PostgreSQL Administration UoW quarantines an ambiguous COMMIT outcome", async () => {
  const { pool, queries, releases } = fixture({ failCommit: true });
  const unitOfWork = new PostgreSqlAdministrationUnitOfWork(pool);
  const transaction = await unitOfWork.begin(identity);
  transaction.proposals.save(proposal);
  transaction.idempotency.record(idempotency);
  await assert.rejects(transaction.commit(), (error: unknown) => error instanceof AdministrationPersistenceError
    && error.code === "PERSISTENCE_WRITE_FAILED" && !error.message.includes("unsafe"));
  await assert.rejects(unitOfWork.roles.find(identity), (error: unknown) => error instanceof AdministrationPersistenceError
    && error.code === "PERSISTENCE_WRITE_FAILED");
  assert.equal(queries.includes("ROLLBACK"), false);
  assert.deepEqual(releases, [true]);
});

test("PostgreSQL Administration UoW permits concurrent transactions and rejects a stale same-resource commit", async () => {
  const { pool } = fixture();
  const unitOfWork = new PostgreSqlAdministrationUnitOfWork(pool);
  const first = await unitOfWork.begin(identity);
  const second = await unitOfWork.begin(identity);
  await first.commit();
  await assert.rejects(second.commit(), (error: unknown) => error instanceof AdministrationPersistenceError && error.code === "VERSION_CONFLICT");
  await unitOfWork.close();
});

test("PostgreSQL Administration hydration fails closed when canonical columns disagree with payload", async () => {
  const { pool } = fixture({ corruptResourcePayload: true });
  const unitOfWork = new PostgreSqlAdministrationUnitOfWork(pool);
  await assert.rejects(() => unitOfWork.roles.find(identity), (error: unknown) => error instanceof AdministrationPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
  await unitOfWork.close();
});

test("PostgreSQL Administration hydration rejects ACTIVE authority without an approval decision", async () => {
  const { pool } = fixture({ corruptAuthoritativeStatus: true });
  const unitOfWork = new PostgreSqlAdministrationUnitOfWork(pool);
  await assert.rejects(() => unitOfWork.roleAssignments.find(assignmentIdentity), (error: unknown) => error instanceof AdministrationPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
  await unitOfWork.close();
});
