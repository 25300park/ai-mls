import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DurableIntakeStore,
  IntakePersistenceError,
  type IntakeAuditIntent,
  type TenantBoundIntake,
} from "./intake-durable-persistence.js";

const now = "2026-09-13T01:00:00.000Z";
const resolver = { resolveTenant: ({ rawSourceId }: { rawSourceId: string }) => rawSourceId === "raw-a" ? "tenant-a" : undefined };

function record(overrides: Partial<TenantBoundIntake> = {}): TenantBoundIntake {
  return { tenantId: "tenant-a", id: "intake-a", version: 1, status: "DRAFT", rawSourceId: "raw-a", rawSourceVersion: 1, rawSourceFingerprint: "sha256:raw-a", purpose: "LISTING_INTAKE", classification: "CONFIDENTIAL_BUSINESS", createdBy: "actor-a", createdAt: now, attachmentReferences: [], ...overrides };
}

function intent(id: string, version: number, overrides: Partial<IntakeAuditIntent> = {}): IntakeAuditIntent {
  return { intentId: id, domainOwner: "INTAKE", aggregateId: "intake-a", mutationIdentity: id, actorId: "actor-a", tenantId: "tenant-a", scopeRef: "tenant:tenant-a", classificationRef: "INTAKE_MUTATION", committedAt: now, evidenceRefs: [`evidence:${String(version)}`], ...overrides };
}

function fixture() { const directory = mkdtempSync(join(tmpdir(), "rel001-intake-store-")); return { directory, databasePath: join(directory, "intake.sqlite") }; }

test("Intake derives tenant from Source ownership and survives restart with command identity and audit intent", () => {
  const f = fixture();
  try {
    let store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.equal(store.create({ record: record(), commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent: intent("command-a", 1) }).status, "STORED");
    store.close();
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.deepEqual(store.read({ tenantId: "tenant-a", intakeId: "intake-a" }), record());
    assert.equal(store.create({ record: record(), commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent: intent("command-a", 1) }).status, "REPLAYED");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake rejects caller tenant mismatch, conflicting command and stale version", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    const active = store;
    assert.throws(() => active.create({ record: record({ tenantId: "tenant-b" }), commandId: "bad", commandFingerprint: "bad", auditIntent: intent("bad", 1, { tenantId: "tenant-b" }) }), (error: unknown) => error instanceof IntakePersistenceError && error.code === "TENANT_BINDING_CONFLICT");
    active.create({ record: record(), commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent: intent("command-a", 1) });
    assert.equal(active.read({ tenantId: "tenant-b", intakeId: "intake-a" }), undefined);
    assert.throws(() => active.create({ record: record({ status: "VALIDATED" }), commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent: intent("command-a", 1) }), (error: unknown) => error instanceof IntakePersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.throws(() => active.update({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 0, record: record({ status: "VALIDATED" }), auditIntent: intent("update-a", 1) }), (error: unknown) => error instanceof IntakePersistenceError && error.code === "VERSION_CONFLICT");
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake append-dedup preserves one evidence append and one immutable audit intent", () => {
  const f = fixture();
  try {
    const store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    store.create({ record: record(), commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent: intent("command-a", 1) });
    const attached = record({ version: 2, attachmentReferences: [{ id: "attachment-a", evidenceReference: "evidence:attachment-a", fingerprint: "sha256:attachment-a", classification: "CONFIDENTIAL_BUSINESS", retentionClass: "BUSINESS", status: "CLEARED" }] });
    assert.equal(store.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attached, auditIntent: intent("append-a", 2) }).status, "STORED");
    assert.equal(store.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attached, auditIntent: intent("append-a", 2) }).status, "REPLAYED");
    assert.equal(store.read({ tenantId: "tenant-a", intakeId: "intake-a" })?.attachmentReferences.length, 1);
    assert.deepEqual(store.listHistory({ tenantId: "tenant-a", intakeId: "intake-a" }).map((item) => item.version), [1, 2]);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 2);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake audit-intent failure rolls back aggregate, idempotency and evidence state", () => {
  const f = fixture();
  try {
    let store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver, beforeAuditIntentWrite: () => { throw new Error("fail"); } });
    assert.throws(() => store.create({ record: record(), commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent: intent("command-a", 1) }), (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.equal(store.read({ tenantId: "tenant-a", intakeId: "intake-a" }), undefined);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 0);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
