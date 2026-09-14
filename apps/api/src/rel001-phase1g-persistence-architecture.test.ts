import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { DurablePropertyStore, PropertyPersistenceError, type PropertyAuditIntent } from "../../../modules/property/src/property-durable-persistence.js";
import type { PropertyNode } from "../../../modules/property/src/property-service.js";

const storeFiles = Object.freeze([
  "modules/source/src/source-registry-durable-persistence.ts",
  "modules/intake/src/intake-durable-persistence.ts",
  "modules/property/src/property-durable-persistence.ts",
  "modules/listing/src/listing-durable-persistence.ts",
  "modules/contact/src/contact-durable-persistence.ts",
  "modules/client/src/client-requirement-durable-persistence.ts",
  "modules/matching/src/matching-durable-persistence.ts",
]);

test("REL-001 Phase 1G has exactly seven owner-bounded durable adapters with atomic append-only audit intent", () => {
  assert.equal(storeFiles.length, 7);
  for (const path of storeFiles) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /from "node:sqlite"/u, path);
    assert.match(source, /BEGIN IMMEDIATE/u, path);
    assert.match(source, /audit_intents/u, path);
    assert.match(source, /audit(?:_intents)?_no_update/u, path);
    assert.match(source, /audit(?:_intents)?_no_delete/u, path);
    assert.match(source, /safeEvidenceRefs/u, path);
    assert.match(source, /assertSchema/u, path);
    assert.match(source, /history_no_update/u, path);
    assert.match(source, /history_no_delete/u, path);
    assert.doesNotMatch(source, /CREATE TABLE[^;]*(?:audit_events|AuditEvent)/iu, path);
    assert.doesNotMatch(source, /API-017|JobDispatcher|HTTP|Router/u, path);
    assert.doesNotMatch(source, /new Map</u, path);
  }
  const contact = readFileSync(storeFiles[4]!, "utf8");
  assert.doesNotMatch(contact, /\b(?:createCase|openCase)\s*\(/u);
});

test("REL-001 Phase 1G rejects unsafe evidence values and exposes bounded diagnostics only", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase1g-hardening-"));
  let store: DurablePropertyStore | undefined;
  const node: PropertyNode = { id: "property-safe", version: 1, entityType: "Property", canonicalName: "Safe", status: "proposed", authority: "CANONICAL_MASTER", classification: "INTERNAL", proposedBy: "actor-a", createdAt: "2026-09-13T07:00:00.000Z" };
  const unsafeValues = ["Bearer raw-token", "person@example.test", "C:\\internal\\core.sqlite", "{\"rawPrompt\":\"reasoning\"}", "evidence:C:/secret/token", "evidence:raw-prompt-reasoning", "evidence:bearer-token-value"];
  try {
    const activeStore = new DurablePropertyStore({ databasePath: join(directory, "property.sqlite") });
    store = activeStore;
    for (const [index, unsafe] of unsafeValues.entries()) {
      const auditIntent: PropertyAuditIntent = { intentId: `unsafe-${String(index)}`, domainOwner: "PROPERTY", aggregateId: node.id, mutationIdentity: `unsafe-${String(index)}`, actorId: "actor-a", scopeRef: "system:property-master", classificationRef: "PROPERTY_MUTATION", committedAt: "2026-09-13T07:00:00.000Z", evidenceRefs: [unsafe] };
      assert.throws(() => activeStore.createNode({ record: node, commandId: auditIntent.mutationIdentity, commandFingerprint: `sha256:${String(index)}`, auditIntent }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID" && error.message === "PERSISTENCE_INPUT_INVALID" && !error.message.includes(unsafe));
    }
    assert.equal(activeStore.readNode(node.id), undefined);
    assert.equal(activeStore.listAuditIntents().length, 0);
    activeStore.close();
    store = undefined;
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("REL-001 Phase 1G reconstructed durable truth cannot be overridden by process-local mutation", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase1g-reopen-"));
  const databasePath = join(directory, "property.sqlite");
  const node: PropertyNode = { id: "property-durable", version: 1, entityType: "Property", canonicalName: "Durable", status: "proposed", authority: "CANONICAL_MASTER", classification: "INTERNAL", proposedBy: "actor-a", createdAt: "2026-09-13T07:00:00.000Z" };
  const auditIntent: PropertyAuditIntent = {
    auditIntentContractVersion: "v2", intentId: "property-create", sourceDomain: "PROPERTY", aggregateId: node.id, mutationIdentity: "property-create",
    eventType: "PROPERTY_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "property.propose", target: { type: node.entityType, id: node.id, version: node.version },
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["DST"], sessionId: "session-a" } },
    visibility: { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" }, purpose: "LISTING_GOVERNANCE", policyVersion: "policy-v1", classification: "INTERNAL",
    decision: "ALLOW", outcome: "COMPLETED", committedAt: "2026-09-13T07:00:00.000Z", correlationId: "correlation-a", evidenceRefs: ["evidence:property-durable"],
  };
  let store: DurablePropertyStore | undefined;
  try {
    store = new DurablePropertyStore({ databasePath });
    store.createNode({ record: node, commandId: "property-create", commandFingerprint: "sha256:property", auditIntent });
    const first = store.readNode(node.id);
    assert.ok(first);
    assert.equal(Object.isFrozen(first), true);
    assert.throws(() => { (first as { canonicalName: string }).canonicalName = "Process Local Override"; }, TypeError);
    store.close();
    store = undefined;
    store = new DurablePropertyStore({ databasePath });
    assert.equal(store.readNode(node.id)?.canonicalName, "Durable");
    store.close();
    store = undefined;
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("REL-001 Phase 1G fails closed on a pre-existing same-column schema with weakened constraints", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase1g-schema-"));
  const databasePath = join(directory, "property.sqlite");
  const triggerDatabasePath = join(directory, "property-trigger.sqlite");
  try {
    const database = new DatabaseSync(databasePath);
    database.exec("CREATE TABLE property_master_records (record_kind TEXT, record_id TEXT, version INTEGER, payload_json TEXT)");
    database.close();
    assert.throws(() => new DurablePropertyStore({ databasePath }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE");
    const canonical = new DurablePropertyStore({ databasePath: triggerDatabasePath });
    canonical.close();
    const weakened = new DatabaseSync(triggerDatabasePath);
    weakened.exec("DROP TRIGGER property_commands_no_update; CREATE TRIGGER property_commands_no_update BEFORE UPDATE ON property_master_commands BEGIN SELECT 1; END;");
    weakened.close();
    assert.throws(() => new DurablePropertyStore({ databasePath: triggerDatabasePath }), (error: unknown) => error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
