import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurablePropertyStore, PropertyPersistenceError, type PropertyAuditIntent } from "./property-durable-persistence.js";
import type { PropertyAlias, PropertyNode } from "./property-service.js";

const now = "2026-09-13T02:00:00.000Z";
const node: PropertyNode = { id: "property-a", version: 1, entityType: "Property", canonicalName: "Tower A", status: "proposed", authority: "CANONICAL_MASTER", classification: "INTERNAL", proposedBy: "actor-a", createdAt: now };
const alias: PropertyAlias = { id: "alias-a", version: 1, targetRef: { entityType: "Property", entityId: "property-a", version: 1 }, alias: "A Tower", language: "en", sourceRef: { entityType: "RawSource", entityId: "raw-a", version: 1 }, confidence: "HIGH", status: "proposed", classification: "INTERNAL" };
function intent(id: string, aggregateId: string): PropertyAuditIntent { return { intentId: id, domainOwner: "PROPERTY", aggregateId, mutationIdentity: id, actorId: "actor-a", scopeRef: "system:property-master", classificationRef: "PROPERTY_MUTATION", committedAt: now, evidenceRefs: [`evidence:${aggregateId}`] }; }
function fixture() { const directory = mkdtempSync(join(tmpdir(), "rel001-property-store-")); return { directory, databasePath: join(directory, "property.sqlite") }; }

test("Property persists a system-bound canonical node and alias with stable command replay across restart", () => {
  const f = fixture();
  try {
    let store = new DurablePropertyStore({ databasePath: f.databasePath });
    assert.equal(store.createNode({ record: node, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent: intent("node-command", node.id) }).status, "STORED");
    assert.equal(store.createAlias({ record: alias, commandId: "alias-command", commandFingerprint: "sha256:alias", auditIntent: intent("alias-command", alias.id) }).status, "STORED");
    store.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    assert.deepEqual(store.readNode(node.id), node);
    assert.deepEqual(store.readAlias(alias.id), alias);
    assert.equal(store.createNode({ record: node, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent: intent("node-command", node.id) }).status, "REPLAYED");
    assert.equal(store.listAuditIntents().length, 2);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property rejects conflicting command input and stale VERSION_ONLY mutation", () => {
  const f = fixture();
  try {
    const store = new DurablePropertyStore({ databasePath: f.databasePath });
    store.createNode({ record: node, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent: intent("node-command", node.id) });
    assert.throws(() => store.createNode({ record: { ...node, canonicalName: "Changed" }, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent: intent("node-command", node.id) }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.throws(() => store.updateNode({ expectedVersion: 0, record: { ...node, status: "active" }, auditIntent: intent("update-node", node.id) }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "VERSION_CONFLICT");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property audit-intent failure rolls back the system master mutation", () => {
  const f = fixture();
  try {
    let store = new DurablePropertyStore({ databasePath: f.databasePath, beforeAuditIntentWrite: () => { throw new Error("fail"); } });
    assert.throws(() => store.createNode({ record: node, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent: intent("node-command", node.id) }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurablePropertyStore({ databasePath: f.databasePath });
    assert.equal(store.readNode(node.id), undefined);
    assert.equal(store.listAuditIntents().length, 0);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Property persistence API contains no tenant authorization inference", () => {
  assert.equal("tenantId" in node, false);
  assert.equal(DurablePropertyStore.prototype.readNode.length, 1);
});

test("Property retains append-only version history", () => {
  const f = fixture();
  try {
    const store = new DurablePropertyStore({ databasePath: f.databasePath });
    store.createNode({ record: node, commandId: "node-command", commandFingerprint: "sha256:node", auditIntent: intent("node-command", node.id) });
    store.updateNode({ expectedVersion: 1, record: { ...node, version: 2, status: "active" }, auditIntent: intent("update-node", node.id) });
    assert.deepEqual(store.listHistory({ recordType: "NODE", recordId: node.id }).map((item) => item.version), [1, 2]);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
