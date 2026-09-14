import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type { AuditPrincipal } from "../../../packages/security-contracts/src/index.js";
import {
  AuditIntentMaterializationError,
  AuditIntentMaterializer,
  type AuditIntentSourcePort,
  type EnrichedAuditIntentV2,
} from "./audit-intent-materializer.js";
import { DurableAuditEventStore } from "./durable-audit-event-store.js";

const committedAt = "2026-09-13T01:02:03.000Z";
const materializedAt = "2026-09-13T02:03:04.000Z";

function fixture(): { readonly directory: string; readonly databasePath: string } {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase2c-"));
  return { directory, databasePath: join(directory, "audit.sqlite") };
}

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): EnrichedAuditIntentV2 {
  return {
    auditIntentContractVersion: "v2",
    intentId: "intent-1",
    sourceDomain: "SOURCE_REGISTRY",
    aggregateId: "source-1",
    mutationIdentity: "command-1",
    eventType: "SOURCE_POLICY_PROPOSED",
    eventCategory: "COMMAND_ACCEPTED",
    action: "source.propose",
    target: { type: "SourceRegistry", id: "source-1", version: 1 },
    principalProvenance: {
      kind: "TRUSTED_SNAPSHOT",
      principal: { id: "actor-1", type: "HUMAN", roles: ["ADM"], teamId: "team-a", sessionId: "session-1" },
    },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" },
    purpose: "SOURCE_GOVERNANCE",
    policyVersion: "policy-v7",
    classification: "RESTRICTED_SECURITY",
    decision: "ALLOW",
    outcome: "ACCEPTED",
    committedAt,
    correlationId: "correlation-1",
    evidenceRefs: ["evidence:source-1"],
    ...overrides,
  };
}

function materializer(databasePath: string, resolver?: (ref: string) => AuditPrincipal | undefined): { readonly store: DurableAuditEventStore; readonly service: AuditIntentMaterializer } {
  const store = new DurableAuditEventStore({ databasePath });
  return {
    store,
    service: new AuditIntentMaterializer({
      store,
      clock: () => new Date(materializedAt),
      ...(resolver === undefined ? {} : { principalEvidenceResolver: { resolve: resolver } }),
    }),
  };
}

test("Phase 2C rejects legacy v1 intents instead of materializing them", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const legacy = { intentId: "legacy-1", domainOwner: "SOURCE_REGISTRY", actorId: "actor-1" };
    assert.throws(() => service.materialize(legacy), (error: unknown) => error instanceof AuditIntentMaterializationError && error.code === "INTENT_NOT_MATERIALIZATION_READY");
    assert.equal(store.listAll().length, 0);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C durable store rejects a pre-existing weakened final-event schema", () => {
  const f = fixture();
  const database = new DatabaseSync(f.databasePath);
  try {
    database.exec("CREATE TABLE api016_audit_events (event_id TEXT, source_domain TEXT, audit_intent_id TEXT, intent_fingerprint TEXT, tenant_id TEXT, scope_ref TEXT, occurred_at TEXT, materialized_at TEXT, payload_json TEXT)");
  } finally { database.close(); }
  try {
    assert.throws(() => {
      const opened = new DurableAuditEventStore({ databasePath: f.databasePath });
      opened.close();
    }, /PERSISTENCE_UNAVAILABLE/);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C exact replay returns one durable final event", () => {
  const f = fixture();
  let store = new DurableAuditEventStore({ databasePath: f.databasePath });
  try {
    let service = new AuditIntentMaterializer({ store, clock: () => new Date(materializedAt) });
    const first = service.materialize(intent());
    const replay = service.materialize(intent());
    assert.equal(first.status, "MATERIALIZED");
    assert.equal(replay.status, "REPLAYED");
    assert.equal(replay.event.id, first.event.id);
    assert.equal(store.listAll().length, 1);
    store.close();
    store = new DurableAuditEventStore({ databasePath: f.databasePath });
    service = new AuditIntentMaterializer({ store, clock: () => new Date("2026-09-14T00:00:00.000Z") });
    assert.equal(service.materialize(intent()).status, "REPLAYED");
    assert.equal(store.listAll().length, 1);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C normalizes evidence reference order for exact replay identity", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const first = service.materialize(intent({ evidenceRefs: ["evidence:z", "evidence:a"] }));
    const replay = service.materialize(intent({ evidenceRefs: ["evidence:a", "evidence:z"] }));
    assert.equal(first.status, "MATERIALIZED");
    assert.equal(replay.status, "REPLAYED");
    assert.deepEqual(replay.event.evidenceRefs, ["evidence:a", "evidence:z"]);
    assert.equal(store.listAll().length, 1);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C conflicting payload for the same intent is rejected without overwrite", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const first = service.materialize(intent()).event;
    assert.throws(() => service.materialize(intent({ evidenceRefs: ["evidence:source-2"] })), (error: unknown) => error instanceof AuditIntentMaterializationError && error.code === "MATERIALIZATION_IDENTITY_CONFLICT");
    assert.deepEqual(store.readByIntentId({ sourceDomain: "SOURCE_REGISTRY", intentId: "intent-1" }), first);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C preserves tenant scope principal and source chronology", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const event = service.materialize(intent()).event;
    assert.deepEqual(event.visibility, { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" });
    assert.deepEqual(event.principal, { id: "actor-1", type: "HUMAN", roles: ["ADM"], teamId: "team-a", sessionId: "session-1" });
    assert.equal(event.occurredAt, committedAt);
    assert.equal(event.materializedAt, materializedAt);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C never reconstructs principal provenance from processing-time state", () => {
  const f = fixture();
  let resolverCalls = 0;
  const { store, service } = materializer(f.databasePath, () => { resolverCalls += 1; return { id: "current-actor", type: "HUMAN", roles: ["ADM"] }; });
  try {
    const event = service.materialize(intent()).event;
    assert.equal(event.principal.id, "actor-1");
    assert.equal(resolverCalls, 0);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2E fails closed when immutable principal evidence has no canonical resolver", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const referenced = intent({
      principalProvenance: { kind: "IMMUTABLE_REFERENCE", principalId: "actor-1", evidenceRef: "evidence:principal-1" },
    });
    assert.throws(
      () => service.materialize(referenced),
      (error: unknown) => error instanceof AuditIntentMaterializationError && error.code === "INTENT_INVALID" && error.message === "INTENT_INVALID",
    );
    assert.equal(store.listAll().length, 0);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2E final Audit Events remain structurally append-only", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const original = service.materialize(intent()).event;
    const database = new DatabaseSync(f.databasePath);
    try {
      assert.throws(() => database.exec("UPDATE api016_audit_events SET scope_ref = 'team:other'"), /append-only audit event/);
      assert.throws(() => database.exec("DELETE FROM api016_audit_events"), /append-only audit event/);
    } finally { database.close(); }
    assert.deepEqual(store.listAll(), [original]);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C rejects Client Requirement and invented updateClient event mappings", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    const blocked = { ...intent(), sourceDomain: "CLIENT_REQUIREMENT", eventType: "CLIENT_UPDATED", action: "client.update", target: { type: "Client", id: "client-1", version: 2 } };
    assert.throws(() => service.materialize(blocked), (error: unknown) => error instanceof AuditIntentMaterializationError && error.code === "SOURCE_NOT_MATERIALIZATION_READY");
    assert.equal(store.listAll().length, 0);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C rejects unsafe and unknown intent payload fields", () => {
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    assert.throws(() => service.materialize({ ...intent(), rawProviderResponse: "Bearer NON_SECRET_TEST_AUTHORIZATION_MATERIAL" }), /INTENT_INVALID/);
    assert.throws(() => service.materialize(intent({ evidenceRefs: ["C:\\runtime\\audit.sqlite"] })), /INTENT_INVALID/);
    assert.equal(store.listAll().length, 0);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C materialization failure retains the authoritative source intent", () => {
  const f = fixture();
  const sourceIntent = intent();
  const source: AuditIntentSourcePort = {
    sourceDomain: "SOURCE_REGISTRY",
    readByIntentId: (intentId) => intentId === sourceIntent.intentId ? sourceIntent : undefined,
    listEligible: () => ({ intents: [sourceIntent] }),
  };
  const store = new DurableAuditEventStore({ databasePath: f.databasePath, beforeCommit: () => { throw new Error("injected failure"); } });
  const service = new AuditIntentMaterializer({ store, clock: () => new Date(materializedAt) });
  try {
    assert.throws(() => service.consume(source), /MATERIALIZATION_FAILED/);
    assert.equal(source.readByIntentId("intent-1"), sourceIntent);
    assert.equal(store.listAll().length, 0);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Phase 2C materializes only the six closed source mappings", () => {
  const cases = [
    ["SOURCE_REGISTRY", "SOURCE_POLICY_PROPOSED", "source.propose", "SourceRegistry", "COMMAND_ACCEPTED", "ACCEPTED"],
    ["INTAKE", "INTAKE_CREATED", "intake.create", "Intake", "COMMAND_ACCEPTED", "ACCEPTED"],
    ["PROPERTY", "PROPERTY_PROPOSED", "property.propose", "Property", "COMMAND_ACCEPTED", "COMPLETED"],
    ["LISTING", "CANDIDATE_CREATED", "candidate.create", "CandidateListing", "COMMAND_ACCEPTED", "COMPLETED"],
    ["CONTACT", "CONTACT_CREATED", "contact.create", "Contact", "COMMAND_ACCEPTED", "COMPLETED"],
    ["MATCHING", "MATCH_RUN_CREATED", "matching.request", "MatchRun", "COMMAND_ACCEPTED", "COMPLETED"],
  ] as const;
  const f = fixture();
  const { store, service } = materializer(f.databasePath);
  try {
    for (const [index, [sourceDomain, eventType, action, targetType, eventCategory, outcome]] of cases.entries()) {
      const system = sourceDomain === "PROPERTY";
      const value = intent({
        intentId: `intent-${String(index)}`,
        sourceDomain,
        eventType,
        action,
        eventCategory,
        outcome,
        target: { type: targetType, id: `aggregate-${String(index)}`, version: 1 },
        aggregateId: `aggregate-${String(index)}`,
        visibility: system ? { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" } : { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" },
      });
      assert.equal(service.materialize(value).status, "MATERIALIZED");
    }
    assert.equal(store.listAll().length, 6);
  } finally { store.close(); rmSync(f.directory, { recursive: true, force: true }); }
});
