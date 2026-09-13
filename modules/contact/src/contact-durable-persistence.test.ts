import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableContactStore, ContactPersistenceError, type ContactAuditIntent } from "./contact-durable-persistence.js";
import type { Communication, Contact, ContactChannel } from "./contact-service.js";

const now = "2026-09-13T04:00:00.000Z";
const contact: Contact = { id: "contact-a", version: 1, displayLabel: "Client A", teamId: "team-a", status: "ACTIVE", consentRefs: ["consent-a"], channels: [], classification: "RESTRICTED_PERSONAL" };
const channel: ContactChannel = { id: "channel-a", version: 1, contactId: contact.id, channelType: "EMAIL", maskedValue: "c***@example.test", useScope: "CLIENT_SERVICE", status: "ACTIVE", classification: "RESTRICTED_PERSONAL" };
const communication: Communication = { id: "communication-a", version: 1, caseId: "case-a", direction: "INBOUND", purpose: "CLIENT_SERVICE", outcome: "CONTACTED", evidenceRef: "evidence:communication-a", occurredAt: now, classification: "RESTRICTED_PERSONAL" };
function intent(id: string, aggregateId: string): ContactAuditIntent { return { intentId: id, domainOwner: "CONTACT", aggregateId, mutationIdentity: id, actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "CONTACT_MUTATION", committedAt: now, evidenceRefs: [`evidence:${aggregateId}`] }; }
function fixture() { const directory = mkdtempSync(join(tmpdir(), "rel001-contact-store-")); return { directory, databasePath: join(directory, "contact.sqlite") }; }
function caseResolver() { return { resolveCaseBinding(caseId: string) { return caseId === "case-a" ? { tenantId: "tenant-a", contactId: contact.id, teamId: "team-a", purpose: "CLIENT_SERVICE" } : undefined; } }; }

test("Contact persists tenant-bound Contact and Channel across restart", () => {
  const f = fixture();
  try {
    let store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    assert.equal(store.createContact({ tenantId: "tenant-a", record: contact, commandId: "contact-command", commandFingerprint: "sha256:contact", auditIntent: intent("contact-command", contact.id) }).status, "STORED");
    assert.equal(store.createChannel({ tenantId: "tenant-a", record: channel, commandId: "channel-command", commandFingerprint: "sha256:channel", auditIntent: intent("channel-command", channel.id) }).status, "STORED");
    store.close();
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    assert.deepEqual(store.readContact({ tenantId: "tenant-a", contactId: contact.id }), contact);
    assert.equal(store.readContact({ tenantId: "tenant-b", contactId: contact.id }), undefined);
    assert.deepEqual(store.readChannel({ tenantId: "tenant-a", channelId: channel.id }), channel);
    assert.equal(store.createContact({ tenantId: "tenant-a", record: contact, commandId: "contact-command", commandFingerprint: "sha256:contact", auditIntent: intent("contact-command", contact.id) }).status, "REPLAYED");
    assert.throws(() => store.createContact({ tenantId: "tenant-a", record: { ...contact, displayLabel: "Changed" }, commandId: "contact-command", commandFingerprint: "sha256:contact", auditIntent: intent("contact-command", contact.id) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact enforces version-only mutation and atomic durable audit intent", () => {
  const f = fixture();
  try {
    const store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    store.createContact({ tenantId: "tenant-a", record: contact, commandId: "contact-command", commandFingerprint: "sha256:contact", auditIntent: intent("contact-command", contact.id) });
    assert.throws(() => store.updateContact({ tenantId: "tenant-a", expectedVersion: 0, record: { ...contact, status: "INACTIVE" }, auditIntent: intent("contact-update", contact.id) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "VERSION_CONFLICT");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact appends Communication only for an existing authoritative Case and deduplicates replay", () => {
  const f = fixture();
  try {
    const store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    store.createContact({ tenantId: "tenant-a", record: contact, commandId: "contact-command", commandFingerprint: "sha256:contact", auditIntent: intent("contact-command", contact.id) });
    assert.equal(store.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "communication-append", appendFingerprint: "sha256:communication", auditIntent: intent("communication-append", communication.id) }).status, "APPENDED");
    assert.equal(store.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "communication-append", appendFingerprint: "sha256:communication", auditIntent: intent("communication-append", communication.id) }).status, "REPLAYED");
    assert.throws(() => store.appendCommunication({ tenantId: "tenant-a", record: { ...communication, outcome: "NO_RESPONSE" }, appendIdentity: "communication-append", appendFingerprint: "sha256:communication", auditIntent: intent("communication-append", communication.id) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.throws(() => store.appendCommunication({ tenantId: "tenant-a", record: { ...communication, id: "communication-b", caseId: "missing-case" }, appendIdentity: "missing-case-append", appendFingerprint: "sha256:missing", auditIntent: intent("missing-case-append", "communication-b") }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "CONTACT_CASE_NOT_FOUND");
    assert.equal(store.listCommunications({ tenantId: "tenant-a", caseId: "case-a" }).length, 1);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact persistence cannot implicitly create Contact Case and rolls back audit-intent failure", () => {
  assert.equal("createCase" in DurableContactStore.prototype, false);
  assert.equal("openCase" in DurableContactStore.prototype, false);
  const f = fixture();
  try {
    let store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver(), beforeAuditIntentWrite: () => { throw new Error("fail"); } });
    assert.throws(() => store.createContact({ tenantId: "tenant-a", record: contact, commandId: "contact-command", commandFingerprint: "sha256:contact", auditIntent: intent("contact-command", contact.id) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: caseResolver() });
    assert.equal(store.readContact({ tenantId: "tenant-a", contactId: contact.id }), undefined);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 0);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Contact conceals authoritative Case resolver diagnostics", () => {
  const f = fixture();
  try {
    const store = new DurableContactStore({ databasePath: f.databasePath, caseResolver: { resolveCaseBinding() { throw new Error("C:\\internal\\contact.sqlite bearer raw-token"); } } });
    assert.throws(() => store.appendCommunication({ tenantId: "tenant-a", record: communication, appendIdentity: "communication-append", appendFingerprint: "sha256:communication", auditIntent: intent("communication-append", communication.id) }), (error: unknown) => error instanceof ContactPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
