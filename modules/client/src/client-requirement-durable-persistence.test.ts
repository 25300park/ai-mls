import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ClientRequirementPersistenceError, DurableClientRequirementStore, type ClientRequirementAuditIntent } from "./client-requirement-durable-persistence.js";
import type { Client, Requirement } from "./client-requirement-service.js";

const now = "2026-09-13T05:00:00.000Z";
const client: Client = { id: "client-a", version: 1, status: "ACTIVE", teamId: "team-a", assignedAgentId: "agent-a", contactRef: { entityType: "Contact", entityId: "contact-a", version: 1 }, consentRefs: ["consent-a"], classification: "RESTRICTED_PERSONAL" };
const requirement: Requirement = { id: "requirement-a", version: 1, clientId: client.id, teamId: "team-a", status: "DRAFT", intent: "RENT", constraints: [], budget: { currency: "PHP", lower: 20_000, upper: 30_000, frequency: "MONTHLY" }, locations: [], originalSourceRef: { entityType: "Communication", entityId: "communication-a", version: 1 }, validationGaps: [], readiness: "NOT_READY", staleMatchSignal: false, classification: "RESTRICTED_PERSONAL", changedBy: "actor-a", changedAt: now, changeReason: "INITIAL_DRAFT" };
function intent(id: string, aggregateId: string, tenantId = "tenant-a"): ClientRequirementAuditIntent { return { intentId: id, domainOwner: "CLIENT_REQUIREMENT", aggregateId, mutationIdentity: id, actorId: "actor-a", tenantId, scopeRef: "team:team-a", classificationRef: "CLIENT_REQUIREMENT_MUTATION", committedAt: now, evidenceRefs: [`evidence:${aggregateId}`] }; }
function fixture() { const directory = mkdtempSync(join(tmpdir(), "rel001-client-requirement-store-")); return { directory, databasePath: join(directory, "client-requirement.sqlite") }; }

test("Client and Client-derived Requirement persist with command replay across restart", () => {
  const f = fixture();
  try {
    let store = new DurableClientRequirementStore({ databasePath: f.databasePath });
    assert.equal(store.createClient({ tenantId: "tenant-a", record: client, commandId: "client-command", commandFingerprint: "sha256:client", auditIntent: intent("client-command", client.id) }).status, "STORED");
    assert.equal(store.createRequirement({ tenantId: "tenant-a", record: requirement, commandId: "requirement-command", commandFingerprint: "sha256:requirement", auditIntent: intent("requirement-command", requirement.id) }).status, "STORED");
    store.close();
    store = new DurableClientRequirementStore({ databasePath: f.databasePath });
    assert.deepEqual(store.readClient({ tenantId: "tenant-a", clientId: client.id }), client);
    assert.equal(store.readClient({ tenantId: "tenant-b", clientId: client.id }), undefined);
    assert.deepEqual(store.readRequirement({ tenantId: "tenant-a", requirementId: requirement.id }), requirement);
    assert.equal(store.createRequirement({ tenantId: "tenant-a", record: requirement, commandId: "requirement-command", commandFingerprint: "sha256:requirement", auditIntent: intent("requirement-command", requirement.id) }).status, "REPLAYED");
    assert.throws(() => store.createRequirement({ tenantId: "tenant-a", record: { ...requirement, status: "ACTIVE" }, commandId: "requirement-command", commandFingerprint: "sha256:requirement", auditIntent: intent("requirement-command", requirement.id) }), (error: unknown) => error instanceof ClientRequirementPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Requirement tenant and team are derived from its authoritative Client", () => {
  const f = fixture();
  try {
    const store = new DurableClientRequirementStore({ databasePath: f.databasePath });
    store.createClient({ tenantId: "tenant-a", record: client, commandId: "client-command", commandFingerprint: "sha256:client", auditIntent: intent("client-command", client.id) });
    assert.throws(() => store.createRequirement({ tenantId: "tenant-b", record: requirement, commandId: "requirement-command", commandFingerprint: "sha256:requirement", auditIntent: intent("requirement-command", requirement.id, "tenant-b") }), (error: unknown) => error instanceof ClientRequirementPersistenceError && error.code === "TENANT_BINDING_INVALID");
    assert.throws(() => store.createRequirement({ tenantId: "tenant-a", record: { ...requirement, teamId: "team-b" }, commandId: "requirement-command", commandFingerprint: "sha256:requirement", auditIntent: intent("requirement-command", requirement.id) }), (error: unknown) => error instanceof ClientRequirementPersistenceError && error.code === "SCOPE_BINDING_INVALID");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Client/Requirement preserves VERSION_ONLY history and rejects stale updates", () => {
  const f = fixture();
  try {
    const store = new DurableClientRequirementStore({ databasePath: f.databasePath });
    store.createClient({ tenantId: "tenant-a", record: client, commandId: "client-command", commandFingerprint: "sha256:client", auditIntent: intent("client-command", client.id) });
    store.createRequirement({ tenantId: "tenant-a", record: requirement, commandId: "requirement-command", commandFingerprint: "sha256:requirement", auditIntent: intent("requirement-command", requirement.id) });
    assert.throws(() => store.updateRequirement({ tenantId: "tenant-a", expectedVersion: 0, record: { ...requirement, status: "ACTIVE" }, auditIntent: intent("requirement-update", requirement.id) }), (error: unknown) => error instanceof ClientRequirementPersistenceError && error.code === "VERSION_CONFLICT");
    const revised = { ...requirement, version: 2, status: "ACTIVE" as const, readiness: "READY" as const, changeReason: "VALIDATED" };
    assert.deepEqual(store.updateRequirement({ tenantId: "tenant-a", expectedVersion: 1, record: revised, auditIntent: intent("requirement-update", requirement.id) }), revised);
    assert.equal(store.listHistory({ tenantId: "tenant-a", recordType: "REQUIREMENT", recordId: requirement.id }).length, 2);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Client/Requirement audit-intent failure atomically rolls back domain and idempotency state", () => {
  const f = fixture();
  try {
    let store = new DurableClientRequirementStore({ databasePath: f.databasePath, beforeAuditIntentWrite: () => { throw new Error("fail"); } });
    assert.throws(() => store.createClient({ tenantId: "tenant-a", record: client, commandId: "client-command", commandFingerprint: "sha256:client", auditIntent: intent("client-command", client.id) }), (error: unknown) => error instanceof ClientRequirementPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurableClientRequirementStore({ databasePath: f.databasePath });
    assert.equal(store.readClient({ tenantId: "tenant-a", clientId: client.id }), undefined);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 0);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
