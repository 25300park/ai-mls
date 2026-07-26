import assert from "node:assert/strict";
import test from "node:test";

import type { DeliveryOperation, PublicationSnapshot } from "./publication-contracts.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import { PublicationDomainError } from "./publication-domain-error.js";
import { createPublication } from "./publication-factory.js";

const occurredAt = "2026-07-27T01:00:00.000Z";
const context = (suffix: string) => ({ actorId: `actor-${suffix}`, authorityContext: "PUBLICATION_EXECUTION", reason: `Approved reason ${suffix}`, correlationId: `correlation-${suffix}`, occurredAt });
const binding = {
  subjectId: "listing-1", subjectRevision: 3,
  representationId: "representation-1", representationVersion: 2,
  representationChecksum: "sha256:representation-1-v2",
  approvalId: "approval-1", approvalVersion: 4,
  targetId: "target-1", targetVersion: 5,
  channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
} as const;

function ready(id = "publication-1") {
  return createPublication({
    identity: { publicationId: id, tenantScopeId: "team-a" }, binding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: context(`create-${id}`),
  });
}

function attempt(id: string, operation: DeliveryOperation) {
  return { id, commandId: `command-${id}`, operation, occurredAt, evidenceRefs: [] } as const;
}

function active(id = "publication-active") {
  const initial = ready(id).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: attempt(`${id}-attempt-1`, "INITIAL_PUBLISH"), command: context(`${id}-begin`) });
  return initial.resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-confirmed"], externalObjectReference: `external-${id}`, command: context(`${id}-confirm`) });
}

function withdrawn(id = "publication-withdrawn") {
  const current = active(id);
  const pending = current.requestWithdrawal({ type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: current.snapshot.aggregateVersion, attempt: attempt(`${id}-withdraw-1`, "WITHDRAWAL"), command: context(`${id}-withdraw`) });
  return pending.resolveWithdrawal({ type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: pending.snapshot.aggregateVersion, outcome: "CONFIRMED", evidenceRefs: ["evidence-absent"], command: context(`${id}-withdraw-confirm`) });
}

function transitions(snapshot: PublicationSnapshot): readonly string[] {
  return snapshot.transitionHistory.map((entry) => entry.transitionId);
}

test("F15-TASK-001 factory creates canonical READY aggregate and rejects missing prerequisites", () => {
  const publication = ready();
  assert.equal(publication.snapshot.lifecycleState, "READY");
  assert.equal(publication.snapshot.aggregateVersion, 1);
  assert.equal(publication.snapshot.publicationVersion, 0);
  assert.deepEqual(transitions(publication.snapshot), ["PUB-TR-001"]);
  assert.equal(Object.isFrozen(publication.snapshot), true);
  assert.throws(
    () => createPublication({ identity: { publicationId: "publication-bad", tenantScopeId: "team-a" }, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: false as true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: context("bad") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INVARIANT_VIOLATION",
  );
});

test("F15-TASK-001 aggregate creation cannot bypass canonical identity validation", () => {
  assert.throws(
    () => PublicationAggregate.create({ identity: { publicationId: " ", tenantScopeId: "team-a" }, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: context("invalid-identity") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_IDENTITY_INVALID",
  );
  assert.throws(
    () => createPublication({ identity: { publicationId: "publication-self-lineage", tenantScopeId: "team-a" }, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", predecessorPublicationId: "publication-self-lineage", command: context("self-lineage") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INVARIANT_VIOLATION",
  );
});

test("F15-TASK-002 covers initial execution transitions PUB-TR-002, 003, 004 and 007", () => {
  const base = ready("publication-initial");
  const pending = base.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: attempt("attempt-initial", "INITIAL_PUBLISH"), command: context("begin-initial") });
  const confirmed = pending.resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-confirmed"], externalObjectReference: "external-1", command: context("confirmed") });
  const noEffect = base.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: attempt("attempt-no-effect", "INITIAL_PUBLISH"), command: context("begin-no-effect") }).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "NO_EFFECT_CONFIRMED", evidenceRefs: ["evidence-absent"], command: context("no-effect") });
  const unknown = base.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: attempt("attempt-unknown", "INITIAL_PUBLISH"), command: context("begin-unknown") }).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "UNKNOWN", evidenceRefs: ["evidence-timeout"], reconciliationCaseId: "case-initial", command: context("unknown") });

  assert.equal(pending.snapshot.lifecycleState, "EXECUTION_PENDING");
  assert.equal(confirmed.snapshot.lifecycleState, "ACTIVE");
  assert.equal(confirmed.snapshot.effectiveVersion, 1);
  assert.equal(noEffect.snapshot.lifecycleState, "READY");
  assert.equal(unknown.snapshot.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.deepEqual(transitions(unknown.snapshot), ["PUB-TR-001", "PUB-TR-002", "PUB-TR-007"]);
});

test("F15-TASK-002 covers reconciliation transitions PUB-TR-008 through PUB-TR-011", () => {
  const initialUnknown = ready("publication-reconcile-initial").beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: attempt("attempt-ri", "INITIAL_PUBLISH"), command: context("ri-begin") }).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "UNKNOWN", evidenceRefs: ["evidence-unknown"], reconciliationCaseId: "case-ri", command: context("ri-unknown") });
  const initialConfirmed = initialUnknown.resolveReconciliation({ type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: 3, caseId: "case-ri", resolution: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-confirmed"], externalObjectReference: "external-ri", command: context("ri-confirm") });
  const initialNoEffect = initialUnknown.resolveReconciliation({ type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: 3, caseId: "case-ri", resolution: "INITIAL_NO_EFFECT", evidenceRefs: ["evidence-absent"], command: context("ri-absent") });

  const activeBase = active("publication-reconcile-active");
  const activeUnknown = activeBase.beginActiveOperation({ type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: activeBase.snapshot.aggregateVersion, operation: "CORRECTION", materiality: "NON_MATERIAL", nextBinding: { ...binding, representationVersion: 3, representationChecksum: "sha256:representation-1-v3", approvalId: "approval-2", approvalVersion: 1 }, attempt: attempt("attempt-ra", "CORRECTION"), command: context("ra-begin") }).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: activeBase.snapshot.aggregateVersion + 1, outcome: "UNKNOWN", evidenceRefs: ["evidence-unknown"], reconciliationCaseId: "case-ra", command: context("ra-unknown") });
  const activeNoEffect = activeUnknown.resolveReconciliation({ type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: activeUnknown.snapshot.aggregateVersion, caseId: "case-ra", resolution: "ACTIVE_ORIGIN_NO_EFFECT", evidenceRefs: ["evidence-prior-active"], command: context("ra-resolve") });

  const withdrawnBase = withdrawn("publication-reconcile-withdrawn");
  const withdrawnUnknown = withdrawnBase.beginWithdrawnRepublish({ type: "BEGIN_WITHDRAWN_REPUBLISH", expectedAggregateVersion: withdrawnBase.snapshot.aggregateVersion, nextBinding: { ...binding, approvalId: "approval-republish", approvalVersion: 1 }, attempt: attempt("attempt-rw", "REPUBLISH"), command: context("rw-begin") }).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: withdrawnBase.snapshot.aggregateVersion + 1, outcome: "UNKNOWN", evidenceRefs: ["evidence-unknown"], reconciliationCaseId: "case-rw", command: context("rw-unknown") });
  const withdrawnNoEffect = withdrawnUnknown.resolveReconciliation({ type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: withdrawnUnknown.snapshot.aggregateVersion, caseId: "case-rw", resolution: "WITHDRAWN_ORIGIN_NO_EFFECT", evidenceRefs: ["evidence-absent"], command: context("rw-resolve") });

  assert.equal(initialConfirmed.snapshot.lifecycleState, "ACTIVE");
  assert.equal(initialNoEffect.snapshot.lifecycleState, "READY");
  assert.equal(activeNoEffect.snapshot.lifecycleState, "ACTIVE");
  assert.equal(withdrawnNoEffect.snapshot.lifecycleState, "WITHDRAWN");
  assert.equal(transitions(initialConfirmed.snapshot).at(-1), "PUB-TR-008");
  assert.equal(transitions(initialNoEffect.snapshot).at(-1), "PUB-TR-009");
  assert.equal(transitions(activeNoEffect.snapshot).at(-1), "PUB-TR-010");
  assert.equal(transitions(withdrawnNoEffect.snapshot).at(-1), "PUB-TR-011");
});

test("F15-TASK-002 covers withdrawal transitions PUB-TR-012 through PUB-TR-016", () => {
  const base = active("publication-withdrawal");
  const pending = base.requestWithdrawal({ type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: base.snapshot.aggregateVersion, attempt: attempt("attempt-w1", "WITHDRAWAL"), command: context("withdraw-request") });
  const confirmed = pending.resolveWithdrawal({ type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: pending.snapshot.aggregateVersion, outcome: "CONFIRMED", evidenceRefs: ["evidence-absent"], command: context("withdraw-confirm") });
  const unknown = base.requestWithdrawal({ type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: base.snapshot.aggregateVersion, attempt: attempt("attempt-w2", "WITHDRAWAL"), command: context("withdraw-request-2") }).resolveWithdrawal({ type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: base.snapshot.aggregateVersion + 1, outcome: "UNKNOWN", evidenceRefs: ["evidence-timeout"], reconciliationCaseId: "case-w", command: context("withdraw-unknown") });
  const reconciledWithdrawn = unknown.resolveReconciliation({ type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: unknown.snapshot.aggregateVersion, caseId: "case-w", resolution: "WITHDRAWAL_CONFIRMED", evidenceRefs: ["evidence-absent-2"], command: context("withdraw-resolved") });
  const reconciledActive = unknown.resolveReconciliation({ type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: unknown.snapshot.aggregateVersion, caseId: "case-w", resolution: "WITHDRAWAL_NO_EFFECT", evidenceRefs: ["evidence-still-active"], command: context("withdraw-no-effect") });

  assert.equal(pending.snapshot.lifecycleState, "WITHDRAWAL_PENDING");
  assert.equal(confirmed.snapshot.lifecycleState, "WITHDRAWN");
  assert.equal(unknown.snapshot.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal(reconciledWithdrawn.snapshot.lifecycleState, "WITHDRAWN");
  assert.equal(reconciledActive.snapshot.lifecycleState, "ACTIVE");
  assert.deepEqual([pending, confirmed, unknown, reconciledWithdrawn, reconciledActive].map((item) => transitions(item.snapshot).at(-1)), ["PUB-TR-012", "PUB-TR-013", "PUB-TR-014", "PUB-TR-015", "PUB-TR-016"]);
});

test("F15-TASK-002 covers correction, republish, supersede and terminate transitions PUB-TR-005, 006, 017 through 020", () => {
  const activeBase = active("publication-operations");
  const correctionPending = activeBase.beginActiveOperation({ type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: activeBase.snapshot.aggregateVersion, operation: "CORRECTION", materiality: "NON_MATERIAL", nextBinding: { ...binding, representationVersion: 3, representationChecksum: "sha256:representation-1-v3", approvalId: "approval-2", approvalVersion: 1 }, attempt: attempt("attempt-correction", "CORRECTION"), command: context("correction") });
  const correctionNoEffect = correctionPending.resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: correctionPending.snapshot.aggregateVersion, outcome: "NO_EFFECT_CONFIRMED", evidenceRefs: ["evidence-prior-active"], command: context("correction-no-effect") });
  const republishPending = activeBase.beginActiveOperation({ type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: activeBase.snapshot.aggregateVersion, operation: "REPUBLISH", materiality: "SAME_INTENT", nextBinding: { ...binding, approvalId: "approval-republish-active", approvalVersion: 1 }, attempt: attempt("attempt-republish-active", "REPUBLISH"), command: context("republish-active") });
  const withdrawnBase = withdrawn("publication-republish-withdrawn");
  const withdrawnPending = withdrawnBase.beginWithdrawnRepublish({ type: "BEGIN_WITHDRAWN_REPUBLISH", expectedAggregateVersion: withdrawnBase.snapshot.aggregateVersion, nextBinding: { ...binding, approvalId: "approval-republish-withdrawn", approvalVersion: 1 }, attempt: attempt("attempt-republish-withdrawn", "REPUBLISH"), command: context("republish-withdrawn") });
  const withdrawnNoEffect = withdrawnPending.resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: withdrawnPending.snapshot.aggregateVersion, outcome: "NO_EFFECT_CONFIRMED", evidenceRefs: ["evidence-absent"], command: context("republish-no-effect") });
  const superseded = activeBase.supersede({ type: "SUPERSEDE", expectedAggregateVersion: activeBase.snapshot.aggregateVersion, successorPublicationId: "publication-successor", evidenceRefs: ["evidence-successor-active"], command: context("supersede") });
  const terminated = ready("publication-terminate").terminate({ type: "TERMINATE", expectedAggregateVersion: 1, command: context("terminate") });

  assert.equal(correctionNoEffect.snapshot.lifecycleState, "ACTIVE");
  assert.deepEqual(correctionNoEffect.snapshot.bindingHistory.find((entry) => entry.publicationVersion === correctionNoEffect.snapshot.effectiveVersion)?.binding, binding);
  assert.equal(republishPending.snapshot.lifecycleState, "EXECUTION_PENDING");
  assert.equal(withdrawnPending.snapshot.lifecycleState, "EXECUTION_PENDING");
  assert.equal(withdrawnNoEffect.snapshot.lifecycleState, "WITHDRAWN");
  assert.equal(superseded.snapshot.lifecycleState, "SUPERSEDED");
  assert.equal(terminated.snapshot.lifecycleState, "TERMINATED");
  assert.deepEqual([correctionPending, correctionNoEffect, withdrawnPending, withdrawnNoEffect, superseded, terminated].map((item) => transitions(item.snapshot).at(-1)), ["PUB-TR-017", "PUB-TR-005", "PUB-TR-018", "PUB-TR-006", "PUB-TR-019", "PUB-TR-020"]);
});

test("F15-TASK-002 preserves orthogonal suspension without changing lifecycle", () => {
  const base = active("publication-suspension");
  const suspended = base.setSuspension({ type: "SET_SUSPENSION", expectedAggregateVersion: base.snapshot.aggregateVersion, suspensionStatus: "SUSPENDED_SECURITY", command: context("suspend") });
  assert.equal(suspended.snapshot.lifecycleState, "ACTIVE");
  assert.equal(suspended.snapshot.suspensionStatus, "SUSPENDED_SECURITY");
  assert.equal(suspended.snapshot.aggregateVersion, base.snapshot.aggregateVersion + 1);
  assert.throws(
    () => suspended.beginActiveOperation({ type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: suspended.snapshot.aggregateVersion, operation: "REPUBLISH", materiality: "SAME_INTENT", nextBinding: { ...binding, approvalId: "approval-suspended", approvalVersion: 1 }, attempt: attempt("attempt-suspended", "REPUBLISH"), command: context("suspended-command") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_STATE_INVALID",
  );
  const withdrawal = suspended.requestWithdrawal({ type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: suspended.snapshot.aggregateVersion, attempt: attempt("attempt-suspended-withdrawal", "WITHDRAWAL"), command: context("suspended-withdrawal") });
  assert.equal(withdrawal.snapshot.lifecycleState, "WITHDRAWAL_PENDING");
});

test("F15-TASK-001 rejects runtime values outside closed domain vocabularies", () => {
  assert.throws(
    () => createPublication({ identity: { publicationId: "publication-invalid-classification", tenantScopeId: "team-a" }, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "NOT_CANONICAL" as never, command: context("invalid-classification") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID",
  );
  const base = ready("publication-invalid-vocabulary");
  assert.throws(
    () => base.setSuspension({ type: "SET_SUSPENSION", expectedAggregateVersion: base.snapshot.aggregateVersion, suspensionStatus: "NOT_CANONICAL" as never, command: context("invalid-suspension") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID",
  );
  const pending = base.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: base.snapshot.aggregateVersion, attempt: attempt("attempt-invalid-outcome", "INITIAL_PUBLISH"), command: context("invalid-outcome-begin") });
  assert.throws(
    () => pending.resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: pending.snapshot.aggregateVersion, outcome: "NOT_CANONICAL" as never, evidenceRefs: ["evidence-invalid"], command: context("invalid-outcome") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID",
  );
});

test("F15-TASK-002 fails closed for stale versions, forbidden transitions, duplicates and material disguise", () => {
  const base = ready("publication-denied");
  assert.throws(
    () => base.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 99, attempt: attempt("attempt-stale", "INITIAL_PUBLISH"), command: context("stale") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_VERSION_CONFLICT",
  );
  const pending = base.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: attempt("attempt-duplicate", "INITIAL_PUBLISH"), command: context("first") });
  assert.throws(
    () => pending.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 2, attempt: attempt("attempt-duplicate", "INITIAL_PUBLISH"), command: context("duplicate") }),
    (error: unknown) => error instanceof PublicationDomainError && (error.code === "PUBLICATION_TRANSITION_INVALID" || error.code === "PUBLICATION_DUPLICATE_ENTITY"),
  );
  const current = active("publication-material");
  assert.throws(
    () => current.beginActiveOperation({ type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: current.snapshot.aggregateVersion, operation: "CORRECTION", materiality: "SAME_INTENT", nextBinding: { ...binding, representationVersion: 3, representationChecksum: "sha256:representation-1-v3", approvalId: "approval-2", approvalVersion: 1 }, attempt: attempt("attempt-wrong-materiality", "CORRECTION"), command: context("wrong-materiality") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INPUT_INVALID",
  );
  assert.throws(
    () => current.beginActiveOperation({ type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: current.snapshot.aggregateVersion, operation: "CORRECTION", materiality: "MATERIAL", nextBinding: binding, attempt: attempt("attempt-material", "CORRECTION"), command: context("material") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR",
  );
  const terminal = ready("publication-terminal").terminate({ type: "TERMINATE", expectedAggregateVersion: 1, command: context("terminal") });
  assert.throws(
    () => terminal.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: terminal.snapshot.aggregateVersion, attempt: attempt("attempt-terminal", "INITIAL_PUBLISH"), command: context("terminal-retry") }),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_TRANSITION_INVALID",
  );
});

test("F15-TASK-002 blocks external mutation of aggregate snapshots and history", () => {
  const publication = active("publication-immutable");
  const snapshot = publication.snapshot;
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.binding), true);
  assert.equal(Object.isFrozen(snapshot.attempts), true);
  assert.equal(Object.isFrozen(snapshot.transitionHistory), true);
  assert.throws(() => { (snapshot as { lifecycleState: string }).lifecycleState = "READY"; }, TypeError);
  assert.equal(publication.snapshot.lifecycleState, "ACTIVE");
});
