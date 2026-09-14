import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "../../audit/src/audit-intent-materializer.js";
import {
  DurableSourceRegistryStore,
  SourceRegistryPersistenceError,
  type SourceRegistryAuditIntent,
  type TenantBoundSourcePolicy,
} from "./source-registry-durable-persistence.js";

const committedAt = "2026-09-13T00:00:00.000Z";

function source(overrides: Partial<TenantBoundSourcePolicy> = {}): TenantBoundSourcePolicy {
  return {
    tenantId: "tenant-a",
    id: "source-a",
    name: "Approved portal",
    sourceType: "PORTAL",
    status: "DRAFT",
    policyVersion: 1,
    allowedMethods: ["MANUAL"],
    allowedPurposes: ["LISTING_INTAKE"],
    classification: "CONFIDENTIAL_BUSINESS",
    proposedBy: "actor-a",
    ...overrides,
  };
}

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): SourceRegistryAuditIntent {
  return {
    auditIntentContractVersion: "v2",
    intentId: "source-intent-a",
    sourceDomain: "SOURCE_REGISTRY",
    aggregateId: "source-a",
    mutationIdentity: "command-a",
    eventType: "SOURCE_POLICY_PROPOSED",
    eventCategory: "COMMAND_ACCEPTED",
    action: "source.propose",
    target: { type: "SourceRegistry", id: "source-a", version: 1 },
    principalProvenance: {
      kind: "TRUSTED_SNAPSHOT",
      principal: { id: "actor-a", type: "HUMAN", roles: ["ADM"], sessionId: "session-a" },
    },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" },
    purpose: "SOURCE_GOVERNANCE",
    policyVersion: "policy-v1",
    classification: "CONFIDENTIAL_BUSINESS",
    decision: "ALLOW",
    outcome: "ACCEPTED",
    committedAt,
    correlationId: "correlation-a",
    evidenceRefs: ["evidence:source-a"],
    ...overrides,
  } as unknown as SourceRegistryAuditIntent;
}

function database(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(tmpdir(), "rel001-source-store-"));
  return { directory, databasePath: join(directory, "source.sqlite") };
}

function create(
  store: DurableSourceRegistryStore,
  auditIntent: SourceRegistryAuditIntent = intent(),
  record: TenantBoundSourcePolicy = source(),
): Readonly<{ status: "STORED" | "REPLAYED"; record: TenantBoundSourcePolicy }> {
  return store.create({ record, commandId: "command-a", commandFingerprint: "sha256:source-a", auditIntent });
}

function reverseObjectKeyOrder<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)]),
  ) as T;
}

test("Source Registry stores the validated v2 payload and exact replay appends no duplicate intent", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const expectedIntent = intent();
    assert.equal(create(store, expectedIntent).status, "STORED");
    store.close();

    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    assert.deepEqual(store.read({ tenantId: "tenant-a", sourceId: "source-a" }), source());
    assert.equal(store.read({ tenantId: "tenant-b", sourceId: "source-a" }), undefined);
    assert.equal(store.listHistory({ tenantId: "tenant-a", sourceId: "source-a" }).length, 1);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [expectedIntent]);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-b" }), []);
    assert.equal(create(store, expectedIntent).status, "REPLAYED");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [expectedIntent]);
    store.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry exact replay ignores top-level and nested object key insertion order", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const firstIntent = intent();
    const reorderedIntent = reverseObjectKeyOrder(firstIntent);
    assert.deepEqual(reorderedIntent, firstIntent);
    assert.notEqual(JSON.stringify(reorderedIntent), JSON.stringify(firstIntent));

    assert.equal(create(store, firstIntent).status, "STORED");
    assert.equal(create(store, reorderedIntent).status, "REPLAYED");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]);
    store.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry exact replay canonicalizes explicitly undefined source optional fields", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const recordWithUndefined = { ...source(), reviewedAt: undefined } as unknown as TenantBoundSourcePolicy;
    assert.equal(create(store, intent(), recordWithUndefined).status, "STORED");
    const replay = create(store, intent(), recordWithUndefined);
    assert.equal(replay.status, "REPLAYED");
    assert.deepEqual(replay.record, source());
    assert.equal(Object.hasOwn(replay.record, "reviewedAt"), false);
    store.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry exact replay canonicalizes explicitly undefined v2 intent optional fields", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const intentWithUndefined = { ...intent(), requestId: undefined, reason: undefined } as unknown as SourceRegistryAuditIntent;
    assert.equal(create(store, intentWithUndefined).status, "STORED");
    assert.equal(create(store, intentWithUndefined).status, "REPLAYED");
    const storedIntent = store.listAuditIntents({ tenantId: "tenant-a" })[0];
    assert.deepEqual(storedIntent, intent());
    assert.equal(Object.hasOwn(storedIntent, "requestId"), false);
    assert.equal(Object.hasOwn(storedIntent, "reason"), false);
    store.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry rejects legacy v1, missing principal provenance, and wrong closed mapping for new mutations", () => {
  const invalidIntents: readonly unknown[] = [
    { intentId: "source-intent-a", domainOwner: "SOURCE_REGISTRY", aggregateId: "source-a", mutationIdentity: "command-a", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "tenant:tenant-a", classificationRef: "SOURCE_POLICY_PROPOSED", committedAt, evidenceRefs: ["evidence:source-a"] },
    (() => {
      const missingProvenance = { ...intent() } as unknown as Record<string, unknown>;
      delete missingProvenance["principalProvenance"];
      return missingProvenance;
    })(),
    { ...intent(), action: "source.activate" },
  ];

  for (const [index, invalidIntent] of invalidIntents.entries()) {
    const fixture = database();
    let store: DurableSourceRegistryStore | undefined;
    try {
      store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
      assert.throws(
        () => create(store!, invalidIntent as SourceRegistryAuditIntent),
        (error: unknown) => error instanceof SourceRegistryPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID",
        `invalid intent case ${String(index)}`,
      );
      assert.equal(store.read({ tenantId: "tenant-a", sourceId: "source-a" }), undefined);
      store.close();
    } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
  }
});

test("Source Registry rejects wrong aggregate, mutation, tenant, and scope binding before transaction", () => {
  const invalidIntents = [
    intent({ aggregateId: "source-b", target: { type: "SourceRegistry", id: "source-b", version: 1 } }),
    intent({ mutationIdentity: "command-b" }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "tenant:tenant-a" } }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-b" } }),
  ];

  for (const [index, invalidIntent] of invalidIntents.entries()) {
    const fixture = database();
    let store: DurableSourceRegistryStore | undefined;
    try {
      store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
      assert.throws(
        () => create(store!, invalidIntent),
        (error: unknown) => error instanceof SourceRegistryPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID",
        `binding case ${String(index)}`,
      );
      assert.equal(store.read({ tenantId: "tenant-a", sourceId: "source-a" }), undefined);
      store.close();
    } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
  }
});

test("Source Registry conflicting replay fails closed without appending an intent", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const storedIntent = intent();
    create(store, storedIntent);
    assert.throws(
      () => create(store!, intent({ correlationId: "correlation-conflict" })),
      (error: unknown) => error instanceof SourceRegistryPersistenceError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [storedIntent]);
    store.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry rolls back record, history, idempotency, and intent when mandatory intent write fails", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath, beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(
      () => create(store!),
      (error: unknown) => error instanceof SourceRegistryPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE",
    );
    store.close();

    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    assert.equal(store.read({ tenantId: "tenant-a", sourceId: "source-a" }), undefined);
    assert.deepEqual(store.listHistory({ tenantId: "tenant-a", sourceId: "source-a" }), []);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), []);
    assert.equal(create(store).status, "STORED");
    store.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry preserves a pre-existing v1 row byte-for-byte and exposes it as non-materialization-ready", () => {
  const fixture = database();
  const legacy = {
    intentId: "legacy-source-intent",
    domainOwner: "SOURCE_REGISTRY",
    aggregateId: "source-a",
    mutationIdentity: "legacy-command-a",
    actorId: "actor-a",
    tenantId: "tenant-a",
    scopeRef: "tenant:tenant-a",
    classificationRef: "SOURCE_POLICY_PROPOSED",
    committedAt,
    evidenceRefs: ["evidence:source-a"],
  } as const;
  const legacyJson = JSON.stringify(legacy);
  try {
    let store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    store.close();
    const sqlite = new DatabaseSync(fixture.databasePath);
    sqlite.prepare("INSERT INTO source_registry_policies (tenant_id, source_id, policy_version, payload_json) VALUES (?, ?, ?, ?)").run("tenant-a", "source-a", 1, JSON.stringify(source()));
    sqlite.prepare("INSERT INTO source_registry_audit_intents (intent_id, tenant_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)").run(legacy.intentId, legacy.tenantId, legacy.aggregateId, legacy.mutationIdentity, legacyJson);
    sqlite.close();

    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const rows = store.listAuditIntents({ tenantId: "tenant-a" });
    assert.deepEqual(rows, [legacy]);
    const port = createAuditIntentSourcePort({ sourceDomain: "SOURCE_REGISTRY", read: () => rows });
    assert.deepEqual(port.listEligible({}), { intents: [] });
    store.close();

    const verify = new DatabaseSync(fixture.databasePath, { readOnly: true });
    assert.equal(verify.prepare("SELECT payload_json FROM source_registry_audit_intents WHERE intent_id = ?").get(legacy.intentId)?.["payload_json"], legacyJson);
    verify.close();
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("Source Registry owns audit intent only and never materializes a final API-016 event", () => {
  const fixture = database();
  let store: DurableSourceRegistryStore | undefined;
  try {
    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    create(store);
    store.close();
    const sqlite = new DatabaseSync(fixture.databasePath, { readOnly: true });
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row["name"]);
    assert.deepEqual(tables, ["source_registry_audit_intents", "source_registry_commands", "source_registry_history", "source_registry_policies"]);
    assert.equal(tables.some((name) => String(name).includes("audit_event")), false);
    sqlite.close();
  } finally { store?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});
