import assert from "node:assert/strict";
import test from "node:test";

import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationSnapshot } from "./publication-contracts.js";
import { PublicationDomainError } from "./publication-domain-error.js";
import { createPublication } from "./publication-factory.js";
import { mapPersistenceToPublication, mapPublicationToPersistence } from "./publication-persistence-mapper.js";

const createdAt = "2026-07-27T12:00:00.000Z";

function activeSnapshot(): PublicationSnapshot {
  const ready = createPublication({
    identity: { publicationId: "publication-hydration-1", tenantScopeId: "team-a" },
    binding: {
      subjectId: "listing-1",
      subjectRevision: 3,
      representationId: "representation-1",
      representationVersion: 2,
      representationChecksum: "sha256:representation-1-v2",
      approvalId: "approval-1",
      approvalVersion: 4,
      targetId: "target-1",
      targetVersion: 5,
      channelId: "channel-1",
      channelPolicyVersion: "channel-policy-v3",
    },
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: { actorId: "actor-create", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved creation", correlationId: "correlation-create", occurredAt: createdAt },
  });
  const pending = ready.beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION",
    expectedAggregateVersion: 1,
    attempt: { id: "attempt-1", commandId: "command-1", operation: "INITIAL_PUBLISH", occurredAt: "2026-07-27T12:01:00.000Z", evidenceRefs: [] },
    command: { actorId: "actor-publish", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved publish", correlationId: "correlation-publish", occurredAt: "2026-07-27T12:01:00.000Z" },
  });
  return pending.resolveExecution({
    type: "RESOLVE_EXECUTION",
    expectedAggregateVersion: 2,
    outcome: "EFFECT_CONFIRMED",
    evidenceRefs: ["evidence-confirmed"],
    externalObjectReference: "external-publication-1",
    command: { actorId: "actor-confirm", authorityContext: "PUBLICATION_EXECUTION", reason: "Confirmed external effect", correlationId: "correlation-confirm", occurredAt: "2026-07-27T12:02:00.000Z" },
  }).snapshot;
}

test("DEC-157–161 rehydrate preserves every approved value without transition or version change", () => {
  const snapshot = activeSnapshot();
  const aggregate = PublicationAggregate.rehydrate(snapshot);

  assert.notEqual(aggregate.snapshot, snapshot);
  assert.deepEqual(aggregate.snapshot, snapshot);
  assert.equal(aggregate.snapshot.aggregateId, "publication-hydration-1");
  assert.equal(aggregate.snapshot.aggregateVersion, 3);
  assert.equal(aggregate.snapshot.lifecycleState, "ACTIVE");
  assert.equal(aggregate.snapshot.createdAt, createdAt);
  assert.equal(aggregate.snapshot.updatedAt, "2026-07-27T12:02:00.000Z");
  assert.equal(Object.isFrozen(aggregate.snapshot), true);
});

test("DEC-157–161 rehydrate rejects an invalid snapshot through the existing domain error model", () => {
  const snapshot = activeSnapshot();
  const invalidSnapshots: readonly PublicationSnapshot[] = [
    { ...snapshot, aggregateId: "different-aggregate" },
    { ...snapshot, tenantScopeId: " " },
    { ...snapshot, lifecycleState: "NOT_CANONICAL" as never },
    { ...snapshot, suspensionStatus: "NOT_CANONICAL" as never },
    { ...snapshot, authorizationState: "NOT_CANONICAL" as never },
    { ...snapshot, withdrawalStatus: "NOT_CANONICAL" as never },
    { ...snapshot, republishStatus: "NOT_CANONICAL" as never },
    { ...snapshot, classification: "NOT_CANONICAL" as never },
    { ...snapshot, createdAt: "not-a-timestamp" },
    { ...snapshot, binding: { ...snapshot.binding, representationVersion: 0 } },
    { ...snapshot, attempts: [{ ...snapshot.attempts[0]!, sequence: 0 }] },
    { ...snapshot, transitionHistory: [{ ...snapshot.transitionHistory[0]!, transitionId: "PUB-TR-999" as never }] },
  ];

  for (const invalidSnapshot of invalidSnapshots) {
    assert.throws(
      () => PublicationAggregate.rehydrate(invalidSnapshot),
      (error: unknown) => error instanceof PublicationDomainError,
    );
  }
});

test("DEC-157–161 persistence mapper and aggregate hydration preserve semantic equality", () => {
  const snapshot = activeSnapshot();
  const persisted = mapPublicationToPersistence(snapshot);
  const aggregate = PublicationAggregate.rehydrate(mapPersistenceToPublication(persisted));

  assert.deepEqual(aggregate.snapshot, snapshot);
  assert.deepEqual(mapPublicationToPersistence(aggregate.snapshot), persisted);
});
