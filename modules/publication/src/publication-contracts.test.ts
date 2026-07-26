import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommandContext,
  createPublicationBinding,
  createPublicationIdentity,
  createPublicationVersions,
  samePublicationBinding,
} from "./publication-contracts.js";
import { PublicationDomainError } from "./publication-domain-error.js";
import { createDeliveryAttempt, createReconciliationCase, createTransitionRecord } from "./publication-entities.js";

const bindingInput = {
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
} as const;

test("F15-TASK-001 creates immutable value-equal identity and binding objects", () => {
  const firstIdentity = createPublicationIdentity({ publicationId: "publication-1", tenantScopeId: "team-a" });
  const secondIdentity = createPublicationIdentity({ publicationId: "publication-1", tenantScopeId: "team-a" });
  const firstBinding = createPublicationBinding(bindingInput);
  const secondBinding = createPublicationBinding({ ...bindingInput });

  assert.deepEqual(firstIdentity, secondIdentity);
  assert.equal(Object.isFrozen(firstIdentity), true);
  assert.equal(Object.isFrozen(firstBinding), true);
  assert.equal(samePublicationBinding(firstBinding, secondBinding), true);
  const reorderedBinding = createPublicationBinding({
    channelPolicyVersion: bindingInput.channelPolicyVersion,
    channelId: bindingInput.channelId,
    targetVersion: bindingInput.targetVersion,
    targetId: bindingInput.targetId,
    approvalVersion: bindingInput.approvalVersion,
    approvalId: bindingInput.approvalId,
    representationChecksum: bindingInput.representationChecksum,
    representationVersion: bindingInput.representationVersion,
    representationId: bindingInput.representationId,
    subjectRevision: bindingInput.subjectRevision,
    subjectId: bindingInput.subjectId,
  });
  assert.equal(samePublicationBinding(firstBinding, reorderedBinding), true);
  assert.equal(samePublicationBinding(firstBinding, createPublicationBinding({ ...bindingInput, targetId: "target-2" })), false);
});

test("F15-TASK-001 rejects invalid identity, binding, versions and command context", () => {
  const invalid = [
    () => createPublicationIdentity({ publicationId: " ", tenantScopeId: "team-a" }),
    () => createPublicationBinding({ ...bindingInput, representationVersion: 0 }),
    () => createPublicationBinding({ ...bindingInput, representationChecksum: "" }),
    () => createPublicationVersions({ aggregateVersion: 0, publicationVersion: 1 }),
    () => createCommandContext({ actorId: "actor-1", authorityContext: "PUBLICATION_EXECUTION", reason: " ", correlationId: "correlation-1", occurredAt: "2026-07-27T00:00:00.000Z" }),
    () => createCommandContext({ actorId: "actor-1", authorityContext: "PUBLICATION_EXECUTION", reason: "reason", correlationId: "correlation-1", occurredAt: "July 27, 2026" }),
  ];

  for (const createInvalid of invalid) {
    assert.throws(createInvalid, (error: unknown) => error instanceof PublicationDomainError && error.category === "VALIDATION");
  }
});

test("F15-TASK-001 creates aggregate-owned immutable child entities and rejects invalid lifecycle data", () => {
  const attempt = createDeliveryAttempt({ id: "attempt-1", publicationId: "publication-1", commandId: "command-1", operation: "INITIAL_PUBLISH", outcome: "PENDING", sequence: 1, occurredAt: "2026-07-27T00:01:00.000Z", evidenceRefs: [] });
  const reconciliation = createReconciliationCase({ id: "case-1", publicationId: "publication-1", attemptId: attempt.id, origin: "INITIAL", status: "OPEN", evidenceRefs: ["evidence-1"], openedAt: "2026-07-27T00:02:00.000Z" });

  assert.equal(Object.isFrozen(attempt), true);
  assert.equal(Object.isFrozen(attempt.evidenceRefs), true);
  assert.equal(Object.isFrozen(reconciliation), true);
  assert.throws(() => createDeliveryAttempt({ ...attempt, sequence: 0 }), (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID");
  assert.throws(() => createReconciliationCase({ ...reconciliation, evidenceRefs: [] }), (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID");
  assert.throws(() => createDeliveryAttempt({ ...attempt, outcome: "NOT_CANONICAL" as never }), (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID");
  assert.throws(() => createReconciliationCase({ ...reconciliation, status: "NOT_CANONICAL" as never }), (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID");
  assert.throws(
    () => createTransitionRecord({ id: "transition-1", publicationId: "publication-1", sequence: 1, transitionId: "PUB-TR-999" as never, toState: "READY", actorId: "actor-1", reason: "reason", correlationId: "correlation-1", occurredAt: "2026-07-27T00:03:00.000Z" }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID",
  );
  assert.throws(
    () => createReconciliationCase({ ...reconciliation, status: "RESOLVED", resolution: "WITHDRAWAL_CONFIRMED", resolvedAt: "2026-07-27T00:04:00.000Z" }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_STATE_INVALID",
  );
  assert.throws(
    () => createTransitionRecord({ id: "transition-2", publicationId: "publication-1", sequence: 2, transitionId: "PUB-TR-020", fromState: "ACTIVE", toState: "WITHDRAWN", actorId: "actor-1", reason: "reason", correlationId: "correlation-1", occurredAt: "2026-07-27T00:05:00.000Z" }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_STATE_INVALID",
  );
});
