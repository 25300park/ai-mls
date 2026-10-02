import assert from "node:assert/strict";
import test from "node:test";
import { assertIdentityWorkloadEvidence } from "../../../modules/identity/src/identity-workload-evidence-postgresql.js";
import { assertAuditEvidence, assertBindingAuditEvidence } from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
const proof={identityEvidenceRef:"proof-1",registrationId:"registration",registrationVersion:1,tenantId:"tenant",principalId:"principal",schemaVersion:1,immutable:true};
const payload={bindingId:"binding",bindingVersion:2,registrationId:"registration",registrationVersion:1,tenantId:"tenant",principalId:"principal",organizationId:"org",projectId:"project",scopeType:"TEAM",scopeId:"team",status:"ACTIVE"};
const event={auditEvidenceRef:"audit-2",sourceDomain:"IDENTITY",aggregateType:"WORKLOAD_STARTUP_BINDING",aggregateId:"binding",aggregateVersion:2,eventType:"WORKLOAD_STARTUP_BINDING.ACTIVATED",payloadSchemaVersion:1 as const,final:true as const,tenantId:"tenant",scopeRef:"team-scope",payload,occurredAt:"2026-10-02T00:00:00.000Z",materializedAt:"2026-10-02T00:00:01.000Z"};
test("C2B independent proof has exact immutable schema and tuple",()=>{
  assertIdentityWorkloadEvidence(proof);
  for(const patch of [{schemaVersion:2},{immutable:false},{registrationVersion:0},{secret:"private"}])assert.throws(()=>assertIdentityWorkloadEvidence({...proof,...patch}));
});
test("C2B lifecycle event validates exact binding envelope and payload",()=>{
  assertAuditEvidence(event);assertBindingAuditEvidence(event,{...payload,auditEvidenceRef:"audit-2"});
  for(const patch of [{aggregateVersion:1},{final:false},{payloadSchemaVersion:2},{payload:{...payload,status:"REVOKED"}},{payload:{...payload,credential:"private"}}])assert.throws(()=>assertAuditEvidence({...event,...patch}));
  assert.throws(()=>assertBindingAuditEvidence(event,{...payload,bindingVersion:3,auditEvidenceRef:"audit-2"}));
});
test("C2B revocation remains the old aggregate and supports replacement-only linkage",()=>{
  const revoked={...event,eventType:"WORKLOAD_STARTUP_BINDING.REVOKED",aggregateVersion:1,payload:{bindingId:"binding",bindingVersion:1,registrationId:"registration",registrationVersion:1,tenantId:"tenant",principalId:"principal",status:"REVOKED",replacementBindingId:"binding",replacementBindingVersion:2}};
  assertAuditEvidence(revoked);
  assert.throws(()=>assertAuditEvidence({...revoked,payload:{...revoked.payload,replacementBindingVersion:undefined}}));
});

import { PostgreSqlIdentityWorkloadEvidenceReader } from "../../../modules/identity/src/identity-workload-evidence-postgresql.js";
import { PostgreSqlAuditEvidenceStore } from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
function fakePool(rows: readonly Record<string, unknown>[], role = "ai_mls_production_runtime"): { pool: PostgreSqlPoolPort; calls: string[] } {
  const calls: string[] = [];
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(sql: string) {
      calls.push(sql);
      return Promise.resolve({ rows: (sql === "SELECT current_user AS role" ? [{ role }] : sql.startsWith("SELECT ") && !sql.includes("pg_advisory") ? rows : []) as readonly Row[], rowCount: 0 });
    },
    release(destroy) { calls.push(`release:${String(destroy)}`); }
  };
  return { calls, pool: { connect() { return Promise.resolve(client); }, close() { return Promise.reject(new Error("shared pool must remain owned by composition")); } } };
}
const proofRow = { identity_evidence_ref: "proof-1", registration_id: "registration", registration_version: "1", tenant_id: "tenant", principal_id: "principal", schema_version: "1", immutable: true };
const eventRow = { audit_evidence_ref: event.auditEvidenceRef, source_domain: event.sourceDomain, aggregate_type: event.aggregateType, aggregate_id: event.aggregateId, aggregate_version: "2", event_type: event.eventType, payload_schema_version: "1", final: true, tenant_id: event.tenantId, scope_ref: event.scopeRef, payload: event.payload, occurred_at: new Date(event.occurredAt), materialized_at: new Date(event.materializedAt) };
test("C2B proof reader decodes durable rows, rejects duplicate/ref mismatch and excludes migration role", async () => {
  const { pool, calls } = fakePool([proofRow]);
  const reader = new PostgreSqlIdentityWorkloadEvidenceReader(pool);
  assert.deepEqual(await reader.findByEvidenceRef("proof-1"), proof);
  assert.equal(calls.at(-1), "release:false");
  await reader.close();
  await assert.rejects(reader.findByEvidenceRef("proof-1"));
  for (const rows of [[proofRow, proofRow], [{ ...proofRow, identity_evidence_ref: "wrong" }]]) await assert.rejects(new PostgreSqlIdentityWorkloadEvidenceReader(fakePool(rows).pool).findByEvidenceRef("proof-1"));
  await assert.rejects(new PostgreSqlIdentityWorkloadEvidenceReader(fakePool([proofRow], "ai_mls_production_migration_operator").pool).findByEvidenceRef("proof-1"));
});
test("C2B audit projection exact replay is transactional, immutable and restart-readable", async () => {
  const { pool, calls } = fakePool([eventRow]);
  const store = new PostgreSqlAuditEvidenceStore(pool);
  assert.deepEqual(await store.findByEvidenceRef("audit-2"), event);
  assert.deepEqual(await store.materialize(event), event);
  assert.equal(calls.filter(sql => sql === "BEGIN").length, 1);
  assert.equal(calls.filter(sql => sql === "COMMIT").length, 1);
  assert.equal(calls.some(sql => /UPDATE|DELETE/u.test(sql)), false);
  assert.deepEqual(await new PostgreSqlAuditEvidenceStore(pool).findByEvidenceRef("audit-2"), event);
  await store.close();
});
test("C2B same-ref conflict rolls back and Audit participant never owns client lifecycle", async () => {
  const { pool, calls } = fakePool([{ ...eventRow, scope_ref: "different" }]);
  const store = new PostgreSqlAuditEvidenceStore(pool);
  await assert.rejects(store.materialize(event));
  assert.equal(calls.includes("ROLLBACK"), true);
  calls.length = 0;
  const client = await pool.connect();
  await assert.rejects(store.materializeOnClient(client, event));
  assert.equal(calls.some(sql => /^(BEGIN|COMMIT|ROLLBACK|release:)/u.test(sql)), false);
});

test("C2B ambiguous COMMIT quarantines the Audit store and destroys its client", async () => {
  const fake = fakePool([eventRow]);
  const original = await fake.pool.connect();
  const pool: PostgreSqlPoolPort = { ...fake.pool, connect() { return Promise.resolve({ ...original, query<Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]) { return sql === "COMMIT" ? Promise.reject(new Error("connection lost after COMMIT")) : original.query<Row>(sql, values); } }); } };
  const store = new PostgreSqlAuditEvidenceStore(pool);
  await assert.rejects(store.materialize(event), { code: "UNAVAILABLE" });
  assert.equal(fake.calls.at(-1), "release:true");
  assert.equal(fake.calls.includes("ROLLBACK"), false);
  const count = fake.calls.length;
  await assert.rejects(store.findByEvidenceRef("audit-2"), { code: "UNAVAILABLE" });
  assert.equal(fake.calls.length, count);
});
test("C2B Audit participant close drains an already active Identity-owned operation", async () => {
  const fake = fakePool([eventRow]);
  const original = await fake.pool.connect();
  let unblock!: () => void;
  let entered!: () => void;
  const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
  const blocked = new Promise<void>(resolve => { unblock = resolve; });
  const client: PostgreSqlClientPort = { ...original, async query<Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]) {
    if (sql.startsWith("INSERT")) { entered(); await blocked; }
    return original.query<Row>(sql, values);
  } };
  const store = new PostgreSqlAuditEvidenceStore(fake.pool);
  const active = store.materializeOnClient(client, event);
  await enteredPromise;
  let closed = false;
  const close = store.close().then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(closed, false);
  unblock();
  await active; await close;
  await assert.rejects(store.materializeOnClient(client, event), { code: "UNAVAILABLE" });
  assert.equal(fake.calls.some(sql => /^(BEGIN|COMMIT|ROLLBACK|release:)/u.test(sql)), false);
});

import { assertRegistrationAuditEvidence } from "../../../modules/audit/src/audit-evidence-read-postgresql.js";
const registrationPayload = { registrationId: "registration", registrationVersion: 1, tenantId: "tenant", principalId: "principal", principalType: "SERVICE", assurance: "WORKLOAD", environment: "PRODUCTION" };
const registered = { ...event, auditEvidenceRef: "registration-audit", aggregateType: "REGISTERED_SERVICE_WORKLOAD", aggregateId: "registration", aggregateVersion: 1, eventType: "REGISTERED_SERVICE_WORKLOAD.REGISTERED", payload: registrationPayload };
test("C2B approved registration final audit profile validates exact DEC-169 identity", () => {
  assertAuditEvidence(registered);
  assertRegistrationAuditEvidence(registered, { ...registrationPayload, auditEvidenceRef: "registration-audit" });
  for (const patch of [{ aggregateType: "WORKLOAD_STARTUP_BINDING" }, { eventType: "REGISTERED_SERVICE_WORKLOAD.ACTIVE" }, { aggregateId: "other" }, { aggregateVersion: 2 }, { sourceDomain: "AUDIT" }, { final: false }, { payloadSchemaVersion: 2 }, { payload: { ...registrationPayload, principalType: "HUMAN" } }]) assert.throws(() => assertAuditEvidence({ ...registered, ...patch }));
  for (const patch of [{ registrationId: "other" }, { registrationVersion: 2 }, { tenantId: "other" }, { principalId: "other" }, { auditEvidenceRef: "other" }]) assert.throws(() => assertRegistrationAuditEvidence(registered, { ...registrationPayload, auditEvidenceRef: "registration-audit", ...patch }));
});

import { assertIdentityEvidenceMatchesRegistration } from "../../../modules/identity/src/identity-workload-evidence-postgresql.js";
test("C2B independent proof decoder rejects mismatched expected registration tuple", () => {
  const registration = { registrationId: "registration", registrationVersion: 1, tenantId: "tenant", principalId: "principal", identityEvidenceRef: "proof-1" };
  assertIdentityEvidenceMatchesRegistration(proof, registration);
  for (const patch of [{ registrationId: "other" }, { registrationVersion: 2 }, { tenantId: "other" }, { principalId: "other" }, { identityEvidenceRef: "other" }]) assert.throws(() => assertIdentityEvidenceMatchesRegistration(proof, { ...registration, ...patch }));
});
