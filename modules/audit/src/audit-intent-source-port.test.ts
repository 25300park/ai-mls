import assert from "node:assert/strict";
import test from "node:test";

import { createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "./audit-intent-materializer.js";

const enriched: EnrichedAuditIntentV2 = {
  auditIntentContractVersion: "v2",
  intentId: "intent-v2",
  sourceDomain: "SOURCE_REGISTRY",
  aggregateId: "source-1",
  mutationIdentity: "command-1",
  eventType: "SOURCE_POLICY_PROPOSED",
  eventCategory: "COMMAND_ACCEPTED",
  action: "source.propose",
  target: { type: "SourceRegistry", id: "source-1", version: 1 },
  principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-1", type: "HUMAN", roles: ["ADM"] } },
  visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" },
  purpose: "SOURCE_GOVERNANCE",
  policyVersion: "policy-v1",
  classification: "RESTRICTED_SECURITY",
  decision: "ALLOW",
  outcome: "ACCEPTED",
  committedAt: "2026-09-13T00:00:00.000Z",
  correlationId: "correlation-1",
  evidenceRefs: ["evidence:source-1"],
};

test("Phase 2C source port exposes bounded v2 intents and leaves v1 authoritative", () => {
  const legacy = { intentId: "intent-v1", domainOwner: "SOURCE_REGISTRY", actorId: "actor-1" };
  const records: readonly unknown[] = [legacy, enriched, { ...enriched, intentId: "intent-v2-2" }];
  const port = createAuditIntentSourcePort({ sourceDomain: "SOURCE_REGISTRY", read: () => records });
  assert.deepEqual(port.listEligible({ limit: 1 }), { intents: [enriched], continuation: "intent-v2" });
  assert.equal(port.readByIntentId("intent-v1"), undefined);
  assert.deepEqual(port.readByIntentId("intent-v2"), enriched);
  assert.equal(records[0], legacy);
});

test("Phase 2C source port rejects cross-domain enriched records and malformed continuation", () => {
  const port = createAuditIntentSourcePort({ sourceDomain: "SOURCE_REGISTRY", read: () => [{ ...enriched, sourceDomain: "INTAKE" }] });
  assert.deepEqual(port.listEligible({}), { intents: [] });
  assert.throws(() => port.listEligible({ continuation: " unknown ", limit: 10 }), /INTENT_SOURCE_INPUT_INVALID/);
});
