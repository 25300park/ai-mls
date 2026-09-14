import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  createAuditIntentSourcePort,
  type EnrichedAuditIntentV2,
} from "../../audit/src/audit-intent-materializer.js";
import {
  DurableIntakeStore,
  IntakePersistenceError,
  type IntakeAuditIntent,
  type TenantBoundIntake,
} from "./intake-durable-persistence.js";

const now = "2026-09-13T01:00:00.000Z";
const resolver = { resolveTenant: ({ rawSourceId }: { rawSourceId: string }) => rawSourceId === "raw-a" ? "tenant-a" : undefined };

function record(overrides: Partial<TenantBoundIntake> = {}): TenantBoundIntake {
  return {
    tenantId: "tenant-a",
    id: "intake-a",
    version: 1,
    status: "DRAFT",
    rawSourceId: "raw-a",
    rawSourceVersion: 1,
    rawSourceFingerprint: "sha256:raw-a",
    purpose: "LISTING_INTAKE",
    classification: "CONFIDENTIAL_BUSINESS",
    createdBy: "actor-a",
    createdAt: now,
    attachmentReferences: [],
    ...overrides,
  };
}

function intent(overrides: Partial<EnrichedAuditIntentV2<"INTAKE">> = {}): IntakeAuditIntent {
  return {
    auditIntentContractVersion: "v2",
    intentId: "intake-intent-a",
    sourceDomain: "INTAKE",
    aggregateId: "intake-a",
    mutationIdentity: "command-a",
    eventType: "INTAKE_CREATED",
    eventCategory: "COMMAND_ACCEPTED",
    action: "intake.create",
    target: { type: "Intake", id: "intake-a", version: 1 },
    principalProvenance: {
      kind: "TRUSTED_SNAPSHOT",
      principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], sessionId: "session-a" },
    },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" },
    purpose: "LISTING_INTAKE",
    policyVersion: "policy-v1",
    classification: "CONFIDENTIAL_BUSINESS",
    decision: "ALLOW",
    outcome: "ACCEPTED",
    committedAt: now,
    correlationId: "correlation-a",
    evidenceRefs: ["evidence:intake-a:1"],
    ...overrides,
  } as unknown as IntakeAuditIntent;
}

function fixture(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(tmpdir(), "rel001-intake-store-"));
  return { directory, databasePath: join(directory, "intake.sqlite") };
}

function create(store: DurableIntakeStore, auditIntent: IntakeAuditIntent = intent(), value: TenantBoundIntake = record()) {
  return store.create({ record: value, commandId: "command-a", commandFingerprint: "sha256:intake-a", auditIntent });
}

function attachedRecord(): TenantBoundIntake {
  return record({
    version: 2,
    attachmentReferences: [{
      id: "attachment-a",
      evidenceReference: "evidence:attachment-a",
      fingerprint: "sha256:attachment-a",
      classification: "CONFIDENTIAL_BUSINESS",
      retentionClass: "BUSINESS",
      status: "CLEARED",
    }],
  });
}

function evidenceIntent(overrides: Partial<EnrichedAuditIntentV2<"INTAKE">> = {}): IntakeAuditIntent {
  return intent({
    intentId: "intake-intent-evidence-a",
    mutationIdentity: "attachment-a",
    eventType: "RAW_ATTACHMENT_LINKED",
    eventCategory: "EVIDENCE_APPENDED",
    action: "intake.attach-evidence",
    target: { type: "Intake", id: "intake-a", version: 2 },
    outcome: "COMPLETED",
    evidenceRefs: ["evidence:attachment-a"],
    ...overrides,
  });
}

function reverseObjectKeyOrder<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)]),
  ) as T;
}

test("Intake stores exact create and evidence v2 mappings atomically", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    const createdIntent = intent();
    const appendedIntent = evidenceIntent();
    assert.equal(create(store, createdIntent).status, "STORED");
    assert.equal(store.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attachedRecord(), auditIntent: appendedIntent }).status, "STORED");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [createdIntent, appendedIntent]);
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake derives tenant ownership and preserves v2 command identity across restart", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.equal(create(store).status, "STORED");
    store.close();

    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.deepEqual(store.read({ tenantId: "tenant-a", intakeId: "intake-a" }), record());
    assert.equal(store.read({ tenantId: "tenant-b", intakeId: "intake-a" }), undefined);
    assert.equal(create(store).status, "REPLAYED");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake retains tenant, command, and version conflict behavior on v2 paths", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.throws(
      () => create(store!, intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "tenant:tenant-b" } }), record({ tenantId: "tenant-b" })),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "TENANT_BINDING_CONFLICT",
    );
    create(store);
    assert.throws(
      () => create(store!, intent(), record({ status: "VALIDATED" })),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.throws(
      () => store!.update({
        tenantId: "tenant-a",
        intakeId: "intake-a",
        expectedVersion: 0,
        record: record({ status: "VALIDATED" }),
        auditIntent: intent({ intentId: "update-a", mutationIdentity: "update-a", eventType: "INTAKE_VALIDATED", eventCategory: "STATE_CHANGED", action: "intake.validate", outcome: "COMPLETED" }),
      }),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "VERSION_CONFLICT",
    );
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake accepts each exact update v2 mapping", () => {
  const updateMappings = [
    ["INTAKE_VALIDATED", "intake.validate", "STATE_CHANGED", "COMPLETED"],
    ["INTAKE_AI_REQUESTED", "intake.request-ai", "COMMAND_ACCEPTED", "ACCEPTED"],
    ["INTAKE_AI_RESULT_ROUTED", "intake.validate", "STATE_CHANGED", "COMPLETED"],
    ["INTAKE_MANUAL_FALLBACK", "intake.validate", "STATE_CHANGED", "COMPLETED"],
    ["INTAKE_REVIEWED", "intake.review", "STATE_CHANGED", "COMPLETED"],
  ] as const;

  for (const [eventType, action, eventCategory, outcome] of updateMappings) {
    const f = fixture();
    let store: DurableIntakeStore | undefined;
    try {
      store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
      create(store);
      const updated = record({ version: 2, status: "VALIDATED" });
      const updatedIntent = intent({
        intentId: `intent-${eventType}`,
        mutationIdentity: `mutation-${eventType}`,
        eventType,
        eventCategory,
        action,
        target: { type: "Intake", id: "intake-a", version: 2 },
        outcome,
      });
      assert.deepEqual(store.update({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, record: updated, auditIntent: updatedIntent }), updated);
      assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [intent(), updatedIntent]);
      store.close();
      store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Intake rejects legacy v1, missing provenance, wrong mapping, and conflicting source bindings", () => {
  const missingProvenance = { ...intent() } as unknown as Record<string, unknown>;
  delete missingProvenance["principalProvenance"];
  const invalidIntents: readonly unknown[] = [
    { intentId: "legacy", domainOwner: "INTAKE", aggregateId: "intake-a", mutationIdentity: "command-a", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "tenant:tenant-a", classificationRef: "INTAKE_CREATED", committedAt: now, evidenceRefs: ["evidence:intake-a"] },
    missingProvenance,
    intent({ action: "intake.review" }),
    intent({ aggregateId: "intake-b" }),
    intent({ target: { type: "Intake", id: "intake-b", version: 1 } }),
    intent({ target: { type: "Intake", id: "intake-a", version: 2 } }),
    intent({ mutationIdentity: "command-b" }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "tenant:tenant-a" } }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-b" } }),
    intent({ purpose: "CONTACT_MANAGEMENT" }),
    intent({ classification: "INTERNAL" }),
    intent({ decision: "DENY" }),
    intent({ outcome: "COMPLETED" }),
  ];

  for (const [index, invalidIntent] of invalidIntents.entries()) {
    const f = fixture();
    let store: DurableIntakeStore | undefined;
    try {
      store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
      assert.throws(
        () => create(store!, invalidIntent as IntakeAuditIntent),
        (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_INPUT_INVALID",
        `invalid intent case ${String(index)}`,
      );
      assert.equal(store.read({ tenantId: "tenant-a", intakeId: "intake-a" }), undefined);
      store.close();
      store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Intake rejects operation-path and evidence mutation conflicts", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.throws(() => create(store!, evidenceIntent()), (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    create(store);
    assert.throws(
      () => store!.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attachedRecord(), auditIntent: evidenceIntent({ mutationIdentity: "attachment-b" }) }),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_INPUT_INVALID",
    );
    assert.throws(
      () => store!.update({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, record: record({ version: 2, status: "VALIDATED" }), auditIntent: evidenceIntent() }),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_INPUT_INVALID",
    );
    assert.deepEqual(store.listHistory({ tenantId: "tenant-a", intakeId: "intake-a" }).map((item) => item.version), [1]);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [intent()]);
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake exact create replay is structural and appends no duplicate intent", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    const firstIntent = intent();
    const replayIntent = reverseObjectKeyOrder({ ...firstIntent, requestId: undefined, reason: undefined }) as unknown as IntakeAuditIntent;
    const replayRecord = reverseObjectKeyOrder({ ...record(), candidateReference: undefined }) as unknown as TenantBoundIntake;
    assert.equal(create(store, firstIntent).status, "STORED");
    assert.equal(create(store, replayIntent, replayRecord).status, "REPLAYED");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]);
    assert.throws(
      () => create(store!, intent({ correlationId: "correlation-conflict" })),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]);
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake exact evidence replay is structural and appends no duplicate intent", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    create(store);
    const firstIntent = evidenceIntent();
    assert.equal(store.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attachedRecord(), auditIntent: firstIntent }).status, "STORED");
    assert.equal(store.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: reverseObjectKeyOrder(attachedRecord()), auditIntent: reverseObjectKeyOrder({ ...firstIntent, requestId: undefined }) as unknown as IntakeAuditIntent }).status, "REPLAYED");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 2);
    assert.throws(
      () => store!.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attachedRecord(), auditIntent: evidenceIntent({ correlationId: "correlation-conflict" }) }),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 2);
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake audit-intent failure rolls back aggregate, history, command, and evidence dedup state", () => {
  const f = fixture();
  let store: DurableIntakeStore | undefined;
  try {
    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver, beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => create(store!), (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();

    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.equal(store.read({ tenantId: "tenant-a", intakeId: "intake-a" }), undefined);
    assert.deepEqual(store.listHistory({ tenantId: "tenant-a", intakeId: "intake-a" }), []);
    assert.equal(create(store).status, "STORED");
    store.close();

    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver, beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(
      () => store!.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attachedRecord(), auditIntent: evidenceIntent() }),
      (error: unknown) => error instanceof IntakePersistenceError && error.code === "PERSISTENCE_UNAVAILABLE",
    );
    store.close();

    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    assert.equal(store.read({ tenantId: "tenant-a", intakeId: "intake-a" })?.version, 1);
    assert.deepEqual(store.listHistory({ tenantId: "tenant-a", intakeId: "intake-a" }).map((item) => item.version), [1]);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    assert.equal(store.appendEvidence({ tenantId: "tenant-a", intakeId: "intake-a", expectedVersion: 1, evidenceIdentity: "attachment-a", record: attachedRecord(), auditIntent: evidenceIntent() }).status, "STORED");
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Intake preserves a pre-existing v1 row byte-for-byte and exposes it as non-materialization-ready", () => {
  const f = fixture();
  const legacy = {
    intentId: "legacy-intake-intent",
    domainOwner: "INTAKE",
    aggregateId: "intake-a",
    mutationIdentity: "legacy-command-a",
    actorId: "actor-a",
    tenantId: "tenant-a",
    scopeRef: "tenant:tenant-a",
    classificationRef: "INTAKE_CREATED",
    committedAt: now,
    evidenceRefs: ["evidence:intake-a"],
  } as const;
  const legacyJson = JSON.stringify(legacy);
  try {
    let store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    store.close();
    const sqlite = new DatabaseSync(f.databasePath);
    sqlite.prepare("INSERT INTO intake_records (tenant_id, intake_id, version, raw_source_id, payload_json) VALUES (?, ?, ?, ?, ?)").run("tenant-a", "intake-a", 1, "raw-a", JSON.stringify(record()));
    sqlite.prepare("INSERT INTO intake_audit_intents (intent_id, tenant_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)").run(legacy.intentId, legacy.tenantId, legacy.aggregateId, legacy.mutationIdentity, legacyJson);
    sqlite.close();

    store = new DurableIntakeStore({ databasePath: f.databasePath, tenantResolver: resolver });
    const rows = store.listAuditIntents({ tenantId: "tenant-a" });
    assert.deepEqual(rows, [legacy]);
    const port = createAuditIntentSourcePort({ sourceDomain: "INTAKE", read: () => rows });
    assert.deepEqual(port.listEligible({}), { intents: [] });
    store.close();

    const verify = new DatabaseSync(f.databasePath, { readOnly: true });
    assert.equal(verify.prepare("SELECT payload_json FROM intake_audit_intents WHERE intent_id = ?").get(legacy.intentId)?.["payload_json"], legacyJson);
    verify.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
