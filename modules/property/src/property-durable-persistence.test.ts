import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "../../audit/src/audit-intent-materializer.js";
import { DurablePropertyStore, PropertyPersistenceError, type PropertyAuditIntent } from "./property-durable-persistence.js";
import type { PropertyAlias, PropertyNode } from "./property-service.js";

const now = "2026-09-13T02:00:00.000Z";
const node: PropertyNode = { id: "property-a", version: 1, entityType: "Property", canonicalName: "Tower A", status: "proposed", authority: "CANONICAL_MASTER", classification: "INTERNAL", proposedBy: "actor-a", createdAt: now };
const alias: PropertyAlias = { id: "alias-a", version: 1, targetRef: { entityType: "Property", entityId: "property-a", version: 1 }, alias: "A Tower", language: "en", sourceRef: { entityType: "RawSource", entityId: "raw-a", version: 1 }, confidence: "HIGH", status: "proposed", classification: "INTERNAL" };

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): PropertyAuditIntent {
  return {
    auditIntentContractVersion: "v2", intentId: "node-command", sourceDomain: "PROPERTY", aggregateId: node.id, mutationIdentity: "node-command",
    eventType: "PROPERTY_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "property.propose", target: { type: node.entityType, id: node.id, version: node.version },
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["DST"], sessionId: "session-a" } },
    visibility: { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" }, purpose: "LISTING_GOVERNANCE", policyVersion: "policy-v1", classification: "INTERNAL",
    decision: "ALLOW", outcome: "COMPLETED", committedAt: now, correlationId: "correlation-a", evidenceRefs: ["evidence:property-a"], ...overrides,
  } as unknown as PropertyAuditIntent;
}

function aliasIntent(overrides: Partial<EnrichedAuditIntentV2> = {}): PropertyAuditIntent {
  return intent({ intentId: "alias-command", aggregateId: alias.id, mutationIdentity: "alias-command", eventType: "PROPERTY_ALIAS_PROPOSED", target: { type: "PropertyAlias", id: alias.id, version: alias.version }, evidenceRefs: ["evidence:alias-a"], ...overrides });
}

function decidedIntent(overrides: Partial<EnrichedAuditIntentV2> = {}): PropertyAuditIntent {
  return intent({ intentId: "update-node", mutationIdentity: "update-node", eventType: "PROPERTY_DECIDED", eventCategory: "STATE_CHANGED", action: "property.decide", target: { type: node.entityType, id: node.id, version: 2 }, outcome: "COMPLETED", ...overrides });
}

function fixture(): Readonly<{ directory: string; databasePath: string }> { const directory = mkdtempSync(join(tmpdir(), "rel001-property-store-")); return { directory, databasePath: join(directory, "property.sqlite") }; }
function createNode(store: DurablePropertyStore, auditIntent: PropertyAuditIntent = intent(), record: PropertyNode = node) { return store.createNode({ record, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent }); }
function reverseObjectKeyOrder<T>(value: T): T { if (Array.isArray(value)) return value.map(reverseObjectKeyOrder) as T; if (value === null || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)])) as T; }

test("Property stores the three exact enriched v2 mapping families across restart", () => {
  const f = fixture(); let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    assert.equal(createNode(store).status, "STORED");
    assert.equal(store.createAlias({ record: alias, commandId: "alias-command", commandFingerprint: "sha256:alias", auditIntent: aliasIntent() }).status, "STORED");
    const updated = { ...node, version: 2, status: "active" as const };
    assert.deepEqual(store.updateNode({ expectedVersion: 1, record: updated, auditIntent: decidedIntent() }), updated);
    store.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    assert.deepEqual(store.readNode(node.id), updated); assert.deepEqual(store.readAlias(alias.id), alias);
    assert.deepEqual(store.listAuditIntents(), [aliasIntent(), intent(), decidedIntent()]);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property rejects v1 new writes, invalid node mappings, false tenant binding, and untrusted mutation context", () => {
  const missingProvenance = { ...intent() } as unknown as Record<string, unknown>; delete missingProvenance["principalProvenance"];
  const invalidIntents: readonly unknown[] = [
    { intentId: "node-command", domainOwner: "PROPERTY", aggregateId: node.id, mutationIdentity: "node-command", actorId: "actor-a", scopeRef: "system:property-master", classificationRef: "PROPERTY_MUTATION", committedAt: now, evidenceRefs: ["evidence:property-a"] },
    missingProvenance,
    intent({ target: { type: "PropertyAlias", id: node.id, version: 1 } }), intent({ action: "property.decide" }), intent({ eventCategory: "STATE_CHANGED" }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "system:property-master" } }), intent({ purpose: "CONTACT_MANAGEMENT" }), intent({ decision: "DENY" }), intent({ outcome: "ACCEPTED" }),
    intent({ principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-b", type: "HUMAN", roles: ["DST"] } } }),
    intent({ aggregateId: "property-b" }), intent({ target: { type: node.entityType, id: "property-b", version: 1 } }), intent({ target: { type: node.entityType, id: node.id, version: 2 } }), intent({ mutationIdentity: "node-command-b" }),
  ];
  for (const [index, invalidIntent] of invalidIntents.entries()) {
    const f = fixture(); let store: DurablePropertyStore | undefined;
    try {
      store = new DurablePropertyStore({ databasePath: f.databasePath });
      assert.throws(() => createNode(store!, invalidIntent as PropertyAuditIntent), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID", `invalid node intent case ${String(index)}`);
      assert.equal(store.readNode(node.id), undefined); assert.deepEqual(store.listHistory({ recordType: "NODE", recordId: node.id }), []); assert.deepEqual(store.listAuditIntents(), []);
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Property rejects alias/node operation-path mapping conflicts", () => {
  const f = fixture(); let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    assert.throws(() => store!.createAlias({ record: alias, commandId: "alias-command", commandFingerprint: "sha256:alias", auditIntent: aliasIntent({ target: { type: "Property", id: alias.id, version: 1 } }) }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    createNode(store);
    assert.throws(() => store!.updateNode({ expectedVersion: 1, record: { ...node, version: 2, status: "active" }, auditIntent: intent({ target: { type: node.entityType, id: node.id, version: 2 } }) }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.deepEqual(store.listHistory({ recordType: "NODE", recordId: node.id }).map((item) => item.version), [1]); assert.deepEqual(store.listAuditIntents(), [intent()]);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property exact replay is JSON-canonical and appends zero duplicate intents", () => {
  const f = fixture(); let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    const firstIntent = intent({ evidenceRefs: ["evidence:property-a", "evidence:property-b"] }); assert.equal(createNode(store, firstIntent).status, "STORED");
    const replayRecord = reverseObjectKeyOrder({ ...node, parentRef: undefined }) as unknown as PropertyNode;
    const replayIntent = reverseObjectKeyOrder({ ...firstIntent, requestId: undefined, reason: undefined }) as unknown as PropertyAuditIntent;
    assert.equal(createNode(store, replayIntent, replayRecord).status, "REPLAYED"); assert.deepEqual(store.listAuditIntents(), [firstIntent]);
    assert.equal(Object.hasOwn(store.listAuditIntents()[0]!, "requestId"), false); assert.equal(Object.hasOwn(store.readNode(node.id)!, "parentRef"), false);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property replay conflicts on array, scalar, and record payload changes without appending", () => {
  const f = fixture(); let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    const firstIntent = intent({ evidenceRefs: ["evidence:property-a", "evidence:property-b"] }); createNode(store, firstIntent);
    const conflicts = [
      () => createNode(store!, intent({ evidenceRefs: ["evidence:property-b", "evidence:property-a"] })),
      () => createNode(store!, intent({ evidenceRefs: ["evidence:property-a", "evidence:property-b"], correlationId: "correlation-b" })),
      () => createNode(store!, firstIntent, { ...node, canonicalName: "Changed" }),
    ];
    for (const conflict of conflicts) assert.throws(conflict, (error: unknown) => error instanceof PropertyPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(store.listAuditIntents(), [firstIntent]); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property audit-intent failure rolls back create and update mutation state", () => {
  const f = fixture(); let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath: f.databasePath, beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => createNode(store!), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath }); assert.equal(store.readNode(node.id), undefined); assert.deepEqual(store.listHistory({ recordType: "NODE", recordId: node.id }), []); assert.equal(createNode(store).status, "STORED"); store.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath, beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => store!.updateNode({ expectedVersion: 1, record: { ...node, version: 2, status: "active" }, auditIntent: decidedIntent() }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath }); assert.deepEqual(store.readNode(node.id), node); assert.deepEqual(store.listHistory({ recordType: "NODE", recordId: node.id }).map((item) => item.version), [1]); assert.deepEqual(store.listAuditIntents(), [intent()]);
    assert.equal(store.updateNode({ expectedVersion: 1, record: { ...node, version: 2, status: "active" }, auditIntent: decidedIntent() }).version, 2); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property preserves a pre-existing v1 row byte-for-byte and keeps it non-materializable", () => {
  const f = fixture(); const legacy = { intentId: "legacy-property-intent", domainOwner: "PROPERTY", aggregateId: node.id, mutationIdentity: "legacy-command", actorId: "actor-a", scopeRef: "system:property-master", classificationRef: "PROPERTY_MUTATION", committedAt: now, evidenceRefs: ["evidence:property-a"] } as const; const legacyJson = JSON.stringify(legacy);
  try {
    let store = new DurablePropertyStore({ databasePath: f.databasePath }); store.close();
    const sqlite = new DatabaseSync(f.databasePath); sqlite.prepare("INSERT INTO property_master_records (record_kind, record_id, version, payload_json) VALUES ('NODE', ?, ?, ?)").run(node.id, node.version, JSON.stringify(node)); sqlite.prepare("INSERT INTO property_master_audit_intents (intent_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?)").run(legacy.intentId, legacy.aggregateId, legacy.mutationIdentity, legacyJson); sqlite.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath }); const rows = store.listAuditIntents(); assert.deepEqual(rows, [legacy]);
    const port = createAuditIntentSourcePort({ sourceDomain: "PROPERTY", read: () => rows }); assert.deepEqual(port.listEligible({}), { intents: [] }); store.close();
    const verify = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(verify.prepare("SELECT payload_json FROM property_master_audit_intents WHERE intent_id = ?").get(legacy.intentId)?.["payload_json"], legacyJson); verify.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property persistence API contains no tenant authorization inference", () => { assert.equal("tenantId" in node, false); assert.equal(DurablePropertyStore.prototype.readNode.length, 1); });

test("Property rejects a stale VERSION_ONLY mutation", () => {
  const f = fixture(); let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath: f.databasePath }); createNode(store);
    assert.throws(() => store!.updateNode({ expectedVersion: 0, record: { ...node, status: "active" }, auditIntent: decidedIntent({ target: { type: node.entityType, id: node.id, version: 1 } }) }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "VERSION_CONFLICT");
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});
