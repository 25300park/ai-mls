import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

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

function intent(overrides: Partial<SourceRegistryAuditIntent> = {}): SourceRegistryAuditIntent {
  return {
    intentId: "source-intent-a",
    domainOwner: "SOURCE_REGISTRY",
    aggregateId: "source-a",
    mutationIdentity: "command-a",
    actorId: "actor-a",
    tenantId: "tenant-a",
    scopeRef: "tenant:tenant-a",
    classificationRef: "SOURCE_POLICY_PROPOSED",
    committedAt,
    evidenceRefs: ["evidence:source-a"],
    ...overrides,
  };
}

function database(): Readonly<{ directory: string; databasePath: string }> {
  const directory = mkdtempSync(join(tmpdir(), "rel001-source-store-"));
  return { directory, databasePath: join(directory, "source.sqlite") };
}

test("Source Registry persists direct tenant binding, command replay and audit intent across restart", () => {
  const fixture = database();
  try {
    let store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    const first = store.create({
      record: source(),
      commandId: "command-a",
      commandFingerprint: "sha256:source-a",
      auditIntent: intent(),
    });
    assert.equal(first.status, "STORED");
    store.close();

    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    assert.deepEqual(store.read({ tenantId: "tenant-a", sourceId: "source-a" }), source());
    assert.equal(store.listHistory({ tenantId: "tenant-a", sourceId: "source-a" }).length, 1);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    const replay = store.create({
      record: source(),
      commandId: "command-a",
      commandFingerprint: "sha256:source-a",
      auditIntent: intent(),
    });
    assert.equal(replay.status, "REPLAYED");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 1);
    store.close();
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Source Registry conceals cross-tenant records and conflicts on changed command input", () => {
  const fixture = database();
  try {
    const store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    store.create({ record: source(), commandId: "command-a", commandFingerprint: "sha256:source-a", auditIntent: intent() });
    assert.equal(store.read({ tenantId: "tenant-b", sourceId: "source-a" }), undefined);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-b" }), []);
    assert.throws(
      () => store.create({ record: source({ name: "Changed" }), commandId: "command-a", commandFingerprint: "sha256:source-a", auditIntent: intent() }),
      (error: unknown) => error instanceof SourceRegistryPersistenceError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    store.close();
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Source Registry rolls back state and idempotency when mandatory audit intent persistence fails", () => {
  const fixture = database();
  try {
    let store = new DurableSourceRegistryStore({
      databasePath: fixture.databasePath,
      beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); },
    });
    assert.throws(
      () => store.create({ record: source(), commandId: "command-a", commandFingerprint: "sha256:source-a", auditIntent: intent() }),
      (error: unknown) => error instanceof SourceRegistryPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE",
    );
    store.close();

    store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    assert.equal(store.read({ tenantId: "tenant-a", sourceId: "source-a" }), undefined);
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), []);
    const created = store.create({ record: source(), commandId: "command-a", commandFingerprint: "sha256:source-a", auditIntent: intent() });
    assert.equal(created.status, "STORED");
    store.close();
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Source Registry owns audit intent only and never materializes a final API-016 event", () => {
  const fixture = database();
  try {
    const store = new DurableSourceRegistryStore({ databasePath: fixture.databasePath });
    store.create({ record: source(), commandId: "command-a", commandFingerprint: "sha256:source-a", auditIntent: intent() });
    store.close();
    const sqlite = new DatabaseSync(fixture.databasePath, { readOnly: true });
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row["name"]);
    assert.deepEqual(tables, ["source_registry_audit_intents", "source_registry_commands", "source_registry_history", "source_registry_policies"]);
    assert.equal(tables.some((name) => String(name).includes("audit_event")), false);
    sqlite.close();
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
