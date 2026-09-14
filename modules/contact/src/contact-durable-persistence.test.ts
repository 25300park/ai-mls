import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "../../audit/src/audit-intent-materializer.js";
import { DurableContactStore, ContactPersistenceError, type ContactAuditIntent } from "./contact-durable-persistence.js";
import type { Communication, Contact, ContactChannel } from "./contact-service.js";

const now = "2026-09-13T04:00:00.000Z";
const contact: Contact = { id: "contact-a", version: 1, displayLabel: "Client A", teamId: "team-a", status: "ACTIVE", consentRefs: ["consent-a"], channels: [], classification: "RESTRICTED_PERSONAL" };
const channel: ContactChannel = { id: "channel-a", version: 1, contactId: contact.id, channelType: "EMAIL", maskedValue: "c***@example.test", useScope: "CLIENT_SERVICE", status: "ACTIVE", classification: "RESTRICTED_PERSONAL" };
const communication: Communication = { id: "communication-a", version: 1, caseId: "case-a", direction: "INBOUND", purpose: "CLIENT_SERVICE", outcome: "CONTACTED", evidenceRef: "evidence:communication-a", occurredAt: now, classification: "RESTRICTED_PERSONAL" };

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): ContactAuditIntent {
  return {
    auditIntentContractVersion: "v2", intentId: "01-contact-create", sourceDomain: "CONTACT", aggregateId: contact.id,
    mutationIdentity: "01-contact-create", eventType: "CONTACT_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "contact.create",
    target: { type: "Contact", id: contact.id, version: 1 },
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-a", sessionId: "session-a" } },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" }, purpose: "CLIENT_SERVICE",
    policyVersion: "contact-v1", classification: "RESTRICTED_PERSONAL", decision: "ALLOW", outcome: "COMPLETED",
    committedAt: now, correlationId: "correlation-a", evidenceRefs: ["evidence:contact-a"], ...overrides,
  } as unknown as ContactAuditIntent;
}
function contactIntent(record: Contact, identity: string, corrected = false): ContactAuditIntent {
  return intent({ intentId: identity, aggregateId: record.id, mutationIdentity: identity, eventType: corrected ? "CONTACT_CORRECTED" : "CONTACT_CREATED",
    eventCategory: corrected ? "STATE_CHANGED" : "COMMAND_ACCEPTED", action: corrected ? "contact.edit" : "contact.create",
    target: { type: "Contact", id: record.id, version: record.version }, outcome: "COMPLETED", evidenceRefs: [`evidence:${record.id}`] });
}
function channelIntent(record: ContactChannel, identity: string, revoked = false): ContactAuditIntent {
  return intent({ intentId: identity, aggregateId: record.id, mutationIdentity: identity, eventType: revoked ? "CONTACT_CHANNEL_REVOKED" : "CONTACT_CHANNEL_ADDED",
    eventCategory: "STATE_CHANGED", action: "contact.edit", target: { type: "ContactChannel", id: record.id, version: record.version },
    purpose: record.useScope, outcome: "COMPLETED", evidenceRefs: [`evidence:${record.id}`] });
}
function attemptIntent(record: Communication, identity: string): ContactAuditIntent {
  return intent({ intentId: identity, aggregateId: record.caseId, mutationIdentity: identity, eventType: "CONTACT_ATTEMPT_RECORDED",
    eventCategory: "EVIDENCE_APPENDED", action: "contact.attempt", target: { type: "ContactCase", id: record.caseId },
    purpose: record.purpose, outcome: "COMPLETED", evidenceRefs: [record.evidenceRef] });
}
function fixture(): Readonly<{ directory: string; databasePath: string }> { const directory = mkdtempSync(join(tmpdir(), "rel001-contact-store-")); return { directory, databasePath: join(directory, "contact.sqlite") }; }
function caseResolver() { return { resolveCaseBinding(caseId: string) { return caseId === "case-a" ? { tenantId: "tenant-a", contactId: contact.id, teamId: "team-a", purpose: "CLIENT_SERVICE" } : undefined; } }; }
function createContact(store: DurableContactStore, record: Contact = contact, identity = "01-contact-create", auditIntent: ContactAuditIntent = contactIntent(record, identity)) { return store.createContact({ tenantId: "tenant-a", record, commandId: identity, commandFingerprint: `sha256:${identity}`, auditIntent }); }
function reverseObjectKeyOrder<T>(value: T): T { if (Array.isArray(value)) return value.map(reverseObjectKeyOrder) as T; if (value === null || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)])) as T; }
function count(database: DatabaseSync, table: string): number { return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.["count"]); }
function assertCreateRejected(auditIntent: ContactAuditIntent): void {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    assert.throws(() => createContact(store!, contact, "01-contact-create", auditIntent), (error: unknown) => error instanceof ContactPersistenceError && ["PERSISTENCE_INPUT_INVALID", "TENANT_BINDING_INVALID"].includes(error.code));
    assert.equal(store.readContact({ tenantId: "tenant-a", contactId: contact.id }), undefined); assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), []);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
}

test("Contact stores all five enriched v2 mapping families across restart", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    assert.equal(createContact(store).status, "STORED");
    assert.equal(store.createChannel({ tenantId: "tenant-a", record: channel, commandId: "02-channel-add", commandFingerprint: "sha256:02-channel-add", auditIntent: channelIntent(channel, "02-channel-add") }).status, "STORED");
    const corrected = { ...contact, version: 2, displayLabel: "Client A corrected" };
    assert.deepEqual(store.updateContact({ tenantId: "tenant-a", expectedVersion: 1, record: corrected, auditIntent: contactIntent(corrected, "03-contact-correct", true) }), corrected);
    const revoked = { ...channel, version: 2, status: "REVOKED" as const };
    assert.deepEqual(store.updateChannel({ tenantId: "tenant-a", expectedVersion: 1, record: revoked, auditIntent: channelIntent(revoked, "04-channel-revoke", true) }), revoked);
    assert.equal(store.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: attemptIntent(communication, "05-attempt") }).status, "APPENDED");
    store.close(); store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    assert.deepEqual(store.readContact({ tenantId: "tenant-a", contactId: contact.id }), corrected); assert.deepEqual(store.readChannel({ tenantId: "tenant-a", channelId: channel.id }), revoked);
    assert.equal(store.readContact({ tenantId: "tenant-b", contactId: contact.id }), undefined);
    assert.deepEqual(store.listCommunications({ tenantId: "tenant-a", caseId: "case-a" }), [communication]); assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 5);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact rejects legacy writes, missing provenance, and wrong create tuple or binding before mutation", () => {
  const legacy = { intentId: "01-contact-create", domainOwner: "CONTACT", aggregateId: contact.id, mutationIdentity: "01-contact-create", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "CONTACT_MUTATION", committedAt: now, evidenceRefs: ["evidence:contact-a"] } as unknown as ContactAuditIntent;
  const missingProvenance = { ...intent() } as unknown as Record<string, unknown>; delete missingProvenance["principalProvenance"];
  const invalid: readonly ContactAuditIntent[] = [legacy, missingProvenance as unknown as ContactAuditIntent,
    intent({ eventType: "CONTACT_CORRECTED", eventCategory: "STATE_CHANGED", action: "contact.edit", outcome: "COMPLETED" }), intent({ action: "contact.edit" }), intent({ eventCategory: "STATE_CHANGED" }),
    intent({ target: { type: "ContactChannel", id: contact.id, version: 1 } }), intent({ target: { type: "Contact", id: "contact-b", version: 1 } }), intent({ target: { type: "Contact", id: contact.id, version: 2 } }),
    intent({ aggregateId: "contact-b" }), intent({ mutationIdentity: "other-command" }), intent({ purpose: "OTHER_PURPOSE" }), intent({ decision: "DENY" }), intent({ outcome: "ACCEPTED" }), intent({ classification: "INTERNAL" }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "team:team-a" } }), intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-b" } }),
    intent({ principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-b" } } }),
  ];
  for (const auditIntent of invalid) assertCreateRejected(auditIntent);
});

test("Contact accepts both closed provenance alternatives against the Contact record scope", () => {
  const provenance: readonly EnrichedAuditIntentV2["principalProvenance"][] = [
    { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"] } },
    { kind: "IMMUTABLE_REFERENCE", principalId: "actor-a", evidenceRef: "evidence:principal-a" },
  ];
  for (const [index, principalProvenance] of provenance.entries()) {
    const f = fixture(); let store: DurableContactStore | undefined;
    try {
      store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
      assert.equal(createContact(store, contact, "01-contact-create", intent({ principalProvenance })).status, "STORED", `provenance case ${String(index)}`);
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Contact rejects wrong Contact correction and Channel add/revoke mappings and consent purpose", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); createContact(store);
    const corrected = { ...contact, version: 2, displayLabel: "Corrected" };
    assert.throws(() => store!.updateContact({ tenantId: "tenant-a", expectedVersion: 1, record: corrected, auditIntent: contactIntent(corrected, "wrong-correct") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.throws(() => store!.updateContact({ tenantId: "tenant-a", expectedVersion: 0, record: { ...contact, displayLabel: "Stale correction" }, auditIntent: contactIntent({ ...contact, displayLabel: "Stale correction" }, "03-contact-correct", true) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "VERSION_CONFLICT");
    assert.throws(() => store!.createChannel({ tenantId: "tenant-a", record: channel, commandId: "02-channel-add", commandFingerprint: "sha256:02-channel-add", auditIntent: intent({ intentId: "02-channel-add", aggregateId: channel.id, mutationIdentity: "02-channel-add", target: { type: "Contact", id: channel.id, version: 1 } }) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.throws(() => store!.createChannel({ tenantId: "tenant-a", record: channel, commandId: "02-channel-add", commandFingerprint: "sha256:02-channel-add", auditIntent: channelIntent(channel, "02-channel-add", true) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.throws(() => store!.createChannel({ tenantId: "tenant-a", record: channel, commandId: "02-channel-add", commandFingerprint: "sha256:02-channel-add", auditIntent: intent({ ...channelIntent(channel, "02-channel-add") as unknown as EnrichedAuditIntentV2, purpose: "OTHER_PURPOSE" }) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.equal(store.createChannel({ tenantId: "tenant-a", record: channel, commandId: "02-channel-add", commandFingerprint: "sha256:02-channel-add", auditIntent: channelIntent(channel, "02-channel-add") }).status, "STORED");
    const revoked = { ...channel, version: 2, status: "REVOKED" as const };
    assert.throws(() => store!.updateChannel({ tenantId: "tenant-a", expectedVersion: 1, record: revoked, auditIntent: channelIntent(revoked, "04-channel-revoke") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact attempt requires the existing matching Case and binds its aggregate, target, tenant, scope, and purpose", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); createContact(store);
    const base = attemptIntent(communication, "05-attempt") as unknown as EnrichedAuditIntentV2;
    const invalid = [intent({ ...base, aggregateId: communication.id }), intent({ ...base, mutationIdentity: "other-append" }), intent({ ...base, target: { type: "ContactCase", id: "case-b" } }), intent({ ...base, target: { type: "Contact", id: "case-a" } }), intent({ ...base, purpose: "OTHER_PURPOSE" }), intent({ ...base, visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "team:team-a" } }), intent({ ...base, visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-b" } })];
    for (const auditIntent of invalid) assert.throws(() => store!.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent }), (error: unknown) => error instanceof ContactPersistenceError && ["PERSISTENCE_INPUT_INVALID", "TENANT_BINDING_INVALID"].includes(error.code));
    assert.throws(() => store!.appendCommunication({ tenantId: "tenant-a", record: { ...communication, id: "communication-missing", caseId: "case-missing" }, appendIdentity: "missing-attempt", appendFingerprint: "sha256:missing", auditIntent: attemptIntent({ ...communication, id: "communication-missing", caseId: "case-missing" }, "missing-attempt") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "CONTACT_CASE_NOT_FOUND");
    store.close(); store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: { resolveCaseBinding: () => ({ tenantId: "tenant-a", contactId: "contact-b", teamId: "team-a", purpose: "CLIENT_SERVICE" }) } });
    assert.throws(() => store!.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: attemptIntent(communication, "05-attempt") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "RECORD_NOT_FOUND");
    assert.equal(store.listCommunications({ tenantId: "tenant-a", caseId: "case-a" }).length, 0); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact never creates Contact Case authority implicitly", () => {
  assert.equal("createCase" in DurableContactStore.prototype, false); assert.equal("openCase" in DurableContactStore.prototype, false);
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); createContact(store);
    assert.equal(store.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: attemptIntent(communication, "05-attempt") }).status, "APPENDED"); store.close();
    store = undefined;
    const sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(Number(sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'contact_cases'").get()?.["count"]), 0); sqlite.close();
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact exact structural replay appends zero duplicates and rejects conflicting intent replay", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); const firstIntent = contactIntent(contact, "01-contact-create"); assert.equal(createContact(store, contact, "01-contact-create", firstIntent).status, "STORED");
    const replayRecord = reverseObjectKeyOrder(contact); const replayIntent = reverseObjectKeyOrder({ ...firstIntent as unknown as EnrichedAuditIntentV2, requestId: undefined, reason: undefined }) as unknown as ContactAuditIntent;
    assert.equal(createContact(store, replayRecord, "01-contact-create", replayIntent).status, "REPLAYED"); assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]);
    const conflicts = [intent({ ...firstIntent as unknown as EnrichedAuditIntentV2, evidenceRefs: ["evidence:contact-a", "evidence:other"] }), intent({ ...firstIntent as unknown as EnrichedAuditIntentV2, correlationId: "correlation-b" })];
    for (const auditIntent of conflicts) assert.throws(() => createContact(store!, contact, "01-contact-create", auditIntent), (error: unknown) => error instanceof ContactPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact attempt replay is structural and appends zero communication or intent duplicates", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); createContact(store);
    const firstIntent = attemptIntent(communication, "05-attempt");
    assert.equal(store.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: firstIntent }).status, "APPENDED");
    const replayRecord = reverseObjectKeyOrder(communication); const replayIntent = reverseObjectKeyOrder({ ...firstIntent as unknown as EnrichedAuditIntentV2, requestId: undefined, reason: undefined }) as unknown as ContactAuditIntent;
    assert.equal(store.appendCommunication({ tenantId: "tenant-a", record: replayRecord, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: replayIntent }).status, "REPLAYED");
    const conflicting = intent({ ...firstIntent as unknown as EnrichedAuditIntentV2, correlationId: "correlation-b" });
    assert.throws(() => store!.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: conflicting }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.equal(store.listCommunications({ tenantId: "tenant-a", caseId: "case-a" }).length, 1); assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 2);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact audit failure fully rolls back create, update, and attempt mutations", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver(), beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => createContact(store!), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
    let sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(count(sqlite, "contact_records"), 0); assert.equal(count(sqlite, "contact_history"), 0); assert.equal(count(sqlite, "contact_mutation_identities"), 0); assert.equal(count(sqlite, "contact_audit_intents"), 0); sqlite.close();
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); createContact(store); store.close();
    const corrected = { ...contact, version: 2, displayLabel: "Corrected" }; store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver(), beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => store!.updateContact({ tenantId: "tenant-a", expectedVersion: 1, record: corrected, auditIntent: contactIntent(corrected, "03-contact-correct", true) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    assert.throws(() => store!.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: attemptIntent(communication, "05-attempt") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
    sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(sqlite.prepare("SELECT version FROM contact_records WHERE record_kind = 'CONTACT' AND record_id = ?").get(contact.id)?.["version"], 1); assert.equal(count(sqlite, "contact_history"), 1); assert.equal(count(sqlite, "contact_communications"), 0); assert.equal(count(sqlite, "contact_mutation_identities"), 1); assert.equal(count(sqlite, "contact_audit_intents"), 1); sqlite.close();
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact preserves a pre-existing v1 row byte-for-byte and keeps it non-materializable", () => {
  const f = fixture(); const legacy = { intentId: "legacy-contact-intent", domainOwner: "CONTACT", aggregateId: contact.id, mutationIdentity: "legacy-command", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "CONTACT_MUTATION", committedAt: now, evidenceRefs: ["evidence:contact-a"] } as const; const legacyJson = JSON.stringify(legacy);
  try {
    let store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); store.close();
    const sqlite = new DatabaseSync(f.databasePath); sqlite.prepare("INSERT INTO contact_audit_intents (intent_id, aggregate_id, tenant_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)").run(legacy.intentId, legacy.aggregateId, legacy.tenantId, legacy.mutationIdentity, legacyJson); sqlite.close();
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() }); const rows = store.listAuditIntents({ tenantId: "tenant-a" }); assert.deepEqual(rows, [legacy]);
    const port = createAuditIntentSourcePort({ sourceDomain: "CONTACT", read: () => rows }); assert.deepEqual(port.listEligible({}), { intents: [] }); store.close();
    const verify = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(verify.prepare("SELECT payload_json FROM contact_audit_intents WHERE intent_id = ?").get(legacy.intentId)?.["payload_json"], legacyJson); verify.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact conceals authoritative Case resolver diagnostics", () => {
  const f = fixture(); let store: DurableContactStore | undefined;
  try {
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: { resolveCaseBinding() { throw new Error("C:\\internal\\contact.sqlite bearer raw-token"); } } });
    assert.throws(() => store!.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "05-attempt", appendFingerprint: "sha256:05-attempt", auditIntent: attemptIntent(communication, "05-attempt") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE"); store.close();
    store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});
