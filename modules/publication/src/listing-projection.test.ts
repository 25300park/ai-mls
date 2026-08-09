import assert from "node:assert/strict";
import test from "node:test";

import { createPublicationEventEnvelope, createPublicationEventProjectionProvenance, type PublicationEventEnvelope } from "./publication-event-contracts.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { InMemoryPublicationEventJournal } from "./in-memory-publication-event-journal.js";
import { FixedClock } from "./publication-clock.js";
import { createPublication } from "./publication-factory.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationBinding } from "./publication-contracts.js";
import { InMemoryListingProjectionAuditStore, InMemoryListingProjectionStore } from "./in-memory-listing-projection-store.js";
import { ListingProjectionConsumer, ListingProjectionReadService } from "./listing-projection.js";
import { ListingProjectionError } from "./listing-projection-error.js";
import { ListingProjectionRebuildCoordinator } from "./listing-projection-rebuild.js";
import type { ListingProjectionAuditStore } from "./listing-projection-store.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { createPublicationRuntimeServiceRegistry } from "./publication-runtime-registry.js";

const clock = new FixedClock("2026-08-10T01:00:00.000Z");
const tenantId = "team-a";
const publicationId = "publication-projection-1";
const binding = Object.freeze({
  subjectId: "listing-1", subjectRevision: 1, representationId: "representation-1", representationVersion: 2,
  representationChecksum: "checksum-1", approvalId: "approval-1", approvalVersion: 1,
  targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "policy-1",
});

test("F15-TASK-011 EVT-003 creates an immutable exact PRJ-002 record without mutating source truth", () => {
  const setup = projectionSetup();
  const aggregateBefore = structuredClone(sourceSnapshot(2, 1));
  const activated = canonicalEvent("EVT-003", 1, 2, 1);
  setup.journal.append(activated);

  const result = setup.consumer.consume(tenantId, activated.eventId);

  assert.equal(result.status, "APPLIED");
  assert.deepEqual(setup.read.getServing({ tenantId, publicationId }), {
    projectionId: `PRJ-002:${tenantId}:${publicationId}`,
    projectionType: "PRJ-002",
    publicationId,
    lifecycle: "ACTIVE",
    suspensionStatus: "NOT_SUSPENDED",
    effectiveVersion: 1,
    targetReference: "target-1@5",
    channelReference: "channel-1",
    sourceAggregateVersion: 2,
    publicationVersion: 1,
    lastEventSequence: 1,
    projectionRecordVersion: 1,
    projectionGeneration: `PRJ-002:SERVING:${tenantId}:${publicationId}`,
    stale: false,
    provenance: { eventId: activated.eventId, eventType: "EVT-003", eventContractVersion: "v2" },
  });
  const record = setup.store.getServing({ tenantId, publicationId });
  assert.equal(record?.sourceClassification, "CONFIDENTIAL_BUSINESS");
  assert.equal(record?.privacyScope, "privacy:approved-publication");
  assert.equal(record?.purpose, "PUBLICATION_EXECUTION");
  assert.equal(record?.tenantId, tenantId);
  assert.equal(record?.aggregateVersion, 2);
  assert.equal(record?.lastEventSequence, 1);
  assert.equal(Object.isFrozen(record), true);
  assert.throws(() => { (record as { lifecycle: string }).lifecycle = "WITHDRAWN"; }, TypeError);
  assert.deepEqual(sourceSnapshot(2, 1), aggregateBefore);
  assert.equal(setup.audit.list({ tenantId, publicationId }).at(-1)?.operation, "EVENT_APPLIED");
  assert.equal("payload" in (setup.audit.list({ tenantId, publicationId }).at(-1) ?? {}), false);
});

test("F15-TASK-011 exact duplicates are no-ops and conflicting duplicate identity fails closed", () => {
  const setup = projectionSetup();
  const activated = canonicalEvent("EVT-003", 1, 2, 1);
  setup.journal.append(activated);
  const first = setup.consumer.consume(tenantId, activated.eventId);
  const duplicate = setup.consumer.consume(tenantId, activated.eventId);
  assert.equal(duplicate.status, "DUPLICATE_IGNORED");
  assert.equal(duplicate.record.projectionRecordVersion, first.record.projectionRecordVersion);
  assert.equal(setup.audit.list({ tenantId, publicationId }).at(-1)?.operation, "DUPLICATE_IGNORED");

  const conflicting = canonicalEvent("EVT-003", 1, 2, 1, { effectiveVersion: 9 });
  const conflictConsumer = new ListingProjectionConsumer({
    journal: journalReturning(conflicting), store: setup.store, audit: setup.audit, clock,
  });
  assert.throws(() => conflictConsumer.consume(tenantId, conflicting.eventId), projectionError("PROJECTION_EVENT_DUPLICATE_CONFLICT"));
});

test("F15-TASK-011 Event apply and required audit evidence commit atomically", () => {
  const journal = new InMemoryPublicationEventJournal();
  const store = new InMemoryListingProjectionStore();
  const audit = new InMemoryListingProjectionAuditStore();
  const failingAudit: ListingProjectionAuditStore = {
    append(record) {
      if (record.operation === "EVENT_APPLIED") throw new Error("simulated apply audit failure");
      return audit.append(record);
    },
    list: (identity) => audit.list(identity),
  };
  const activated = canonicalEvent("EVT-003", 1, 2, 1);
  journal.append(activated);
  const consumer = new ListingProjectionConsumer({ journal, store, audit: failingAudit, clock });

  assert.throws(() => consumer.consume(tenantId, activated.eventId), projectionError("INTERNAL_PROJECTION_ERROR"));
  assert.equal(store.getServing({ tenantId, publicationId }), undefined);
  assert.equal(store.getServingGeneration({ tenantId, publicationId }), undefined);
  const generationId = `PRJ-002:SERVING:${tenantId}:${publicationId}`;
  assert.equal(store.getGeneration({ tenantId, publicationId }, generationId), undefined);
  assert.equal(audit.list({ tenantId, publicationId }).some(({ operation }) => operation === "EVENT_APPLIED"), false);

  const retry = new ListingProjectionConsumer({ journal, store, audit, clock }).consume(tenantId, activated.eventId);
  assert.equal(retry.status, "APPLIED");
  assert.equal(store.getServing({ tenantId, publicationId })?.projectionRecordVersion, 1);
});

test("F15-TASK-011 drift audit failures preserve the canonical error and do not partially mark stale", () => {
  const setup = initializedProjection();
  const gap = canonicalEvent("EVT-004", 3, 4, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" });
  const failingAudit: ListingProjectionAuditStore = {
    append(record) {
      if (record.operation === "DRIFT_DETECTED") throw new Error("simulated drift audit failure");
      return setup.audit.append(record);
    },
    list: (identity) => setup.audit.list(identity),
  };
  const consumer = new ListingProjectionConsumer({ journal: journalReturning(gap), store: setup.store, audit: failingAudit, clock });

  assert.throws(() => consumer.consume(tenantId, gap.eventId), projectionError("PROJECTION_SEQUENCE_GAP"));
  assert.equal(setup.store.getServing({ tenantId, publicationId })?.stale, false);
});

test("F15-TASK-011 gaps and out-of-order/version regressions fail closed and expose stale state", () => {
  const setup = initializedProjection();
  const gap = canonicalEvent("EVT-004", 3, 4, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" });
  setup.journal.append(canonicalEvent("EVT-004", 2, 3, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" }));
  setup.journal.append(gap);
  assert.throws(() => setup.consumer.consume(tenantId, gap.eventId), projectionError("PROJECTION_SEQUENCE_GAP"));
  const stale = setup.read.getServing({ tenantId, publicationId });
  assert.equal(stale?.stale, true);
  assert.equal(stale?.staleReason, "EVENT_SEQUENCE_GAP");

  const lowerSetup = initializedProjection();
  const lower = canonicalEvent("EVT-004", 1, 1, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(lower), store: lowerSetup.store, audit: lowerSetup.audit, clock }).consume(tenantId, lower.eventId), projectionError("PROJECTION_EVENT_OUT_OF_ORDER"));
  const regressionSetup = initializedProjection();
  const regressed = canonicalEvent("EVT-004", 2, 1, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(regressed), store: regressionSetup.store, audit: regressionSetup.audit, clock }).consume(tenantId, regressed.eventId), projectionError("PROJECTION_SOURCE_VERSION_DRIFT"));
  const publicationRegressionSetup = initializedProjection();
  const publicationRegressed = canonicalEvent("EVT-007", 2, 3, 0);
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(publicationRegressed), store: publicationRegressionSetup.store, audit: publicationRegressionSetup.audit, clock }).consume(tenantId, publicationRegressed.eventId), projectionError("PROJECTION_PUBLICATION_VERSION_DRIFT"));
  const unrelated = canonicalEvent("EVT-005", 4, 5, 1, { revalidationReference: "revalidation-1", outcome: "EFFECTIVE", evidenceReferences: ["evidence-1"] });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(unrelated), store: setup.store, audit: setup.audit, clock }).consume(tenantId, unrelated.eventId), projectionError("PROJECTION_STALE"));
  assert.equal(setup.read.getServing({ tenantId, publicationId })?.stale, true);
});

test("F15-TASK-011 lifecycle Events preserve suspension, reconciliation, withdrawal and republish provenance", () => {
  const setup = projectionSetup();
  appendAndConsume(setup, canonicalEvent("EVT-003", 1, 2, 1));
  appendAndConsume(setup, canonicalEvent("EVT-004", 2, 3, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" }));
  appendAndConsume(setup, canonicalEvent("EVT-006", 3, 4, 1, { caseId: "case-1", attemptId: "attempt-1", resolutionCategory: "WITHDRAWAL_CONFIRMED", evidenceReferences: ["evidence-1"] }));
  appendAndConsume(setup, canonicalEvent("EVT-007", 4, 5, 2));
  appendAndConsume(setup, canonicalEvent("EVT-008", 5, 6, 3));
  const record = setup.store.getServing({ tenantId, publicationId });
  assert.equal(record?.lifecycle, "ACTIVE");
  assert.equal(record?.suspensionStatus, "SUSPENDED_PROVIDER_POLICY");
  assert.equal(record?.publicationVersion, 3);
  assert.equal(record?.targetReference, "target-1@5");
  assert.equal(record?.channelReference, "channel-1");
  assert.equal(record?.lastEventSequence, 5);
  assert.equal(record?.projectionRecordVersion, 5);
});

test("F15-TASK-011 recovery control Event advances progress without expanding Projection purpose", () => {
  const setup = initializedProjection();
  const replayCompleted = canonicalEvent(
    "EVT-012", 2, 2, 1,
    { replayVersion: "v1", replayedFromSequence: 1, replayedToSequence: 1, validatedEventCount: 1 },
    tenantId,
    { ...defaultEventSecurity, purpose: "RECOVERY_VALIDATION" },
  );
  appendAndConsume(setup, replayCompleted);
  const record = setup.store.getServing({ tenantId, publicationId });
  assert.equal(record?.lastEventType, "EVT-012");
  assert.equal(record?.lastEventSequence, 2);
  assert.equal(record?.purpose, "PUBLICATION_EXECUTION");
});

test("F15-TASK-011 provenance, schema, definition and security drift are rejected safely", () => {
  const setup = projectionSetup();
  appendAndConsume(setup, canonicalEvent("EVT-003", 1, 2, 1));
  const wrongTenant = canonicalEvent("EVT-004", 2, 3, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" }, "team-b");
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(wrongTenant), store: setup.store, audit: setup.audit, clock }).consume(tenantId, wrongTenant.eventId), projectionError("PROJECTION_TENANT_MISMATCH"));

  const corrupted = structuredClone(canonicalEvent("EVT-004", 2, 3, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" })) as unknown as Record<string, unknown>;
  corrupted["eventSchemaVersion"] = "v1";
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(corrupted as unknown as PublicationEventEnvelope), store: setup.store, audit: setup.audit, clock }).consume(tenantId, String(corrupted["eventId"])), projectionError("PROJECTION_SCHEMA_VERSION_DRIFT"));

  const definitionSetup = initializedProjection();
  const record = definitionSetup.store.getServing({ tenantId, publicationId })!;
  definitionSetup.store.save({ ...record, projectionDefinitionVersion: "v0.0", projectionRecordVersion: record.projectionRecordVersion + 1 }, record.projectionRecordVersion);
  const next = canonicalEvent("EVT-004", 2, 3, 1, { suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(next), store: definitionSetup.store, audit: definitionSetup.audit, clock }).consume(tenantId, next.eventId), projectionError("PROJECTION_DEFINITION_VERSION_DRIFT"));

  const classificationSetup = initializedProjection();
  const classificationDrift = canonicalEvent("EVT-004", 2, 3, 1, {}, tenantId, { ...defaultEventSecurity, classification: "RESTRICTED_SECURITY" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(classificationDrift), store: classificationSetup.store, audit: classificationSetup.audit, clock }).consume(tenantId, classificationDrift.eventId), projectionError("PROJECTION_CLASSIFICATION_VIOLATION"));

  const purposeSetup = initializedProjection();
  const purposeDrift = canonicalEvent("EVT-004", 2, 3, 1, {}, tenantId, { ...defaultEventSecurity, purpose: "RECOVERY_VALIDATION" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(purposeDrift), store: purposeSetup.store, audit: purposeSetup.audit, clock }).consume(tenantId, purposeDrift.eventId), projectionError("PROJECTION_PURPOSE_VIOLATION"));

  const integritySetup = initializedProjection();
  const integrityDrift = structuredClone(canonicalEvent("EVT-004", 2, 3, 1)) as unknown as Record<string, unknown>;
  integrityDrift["correlationId"] = "tampered-correlation";
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(integrityDrift as unknown as PublicationEventEnvelope), store: integritySetup.store, audit: integritySetup.audit, clock }).consume(tenantId, String(integrityDrift["eventId"])), projectionError("PROJECTION_PROVENANCE_INCOMPLETE"));
});

test("F15-TASK-011 closed provenance and public-field boundaries fail closed", () => {
  const snapshot = sourceSnapshot(2, 1);
  assert.throws(() => createPublicationEventEnvelope({
    source: eventSecuritySource(), eventType: "EVT-003", aggregateId: publicationId, aggregateVersion: 2,
    eventSequence: 1, occurredAt: clock.now(), recordedAt: clock.now(), correlationId: "missing-provenance",
    causationId: "command-missing", commandId: "command-missing", actorReference: "executor-1", tenantId,
    classification: "CONFIDENTIAL_BUSINESS", privacyScope: "privacy:approved-publication",
    consentOrLegalBasis: "permission:public-publication", audienceRestriction: "PUBLIC_APPROVED",
    governanceSourceVersion: 2, purpose: "PUBLICATION_EXECUTION",
    payload: { publicationId, priorLifecycle: "EXECUTION_PENDING", newLifecycle: "ACTIVE", attemptId: "attempt-1", effectiveVersion: 1, evidenceReferences: [] },
  }));
  const otherSnapshot = sourceSnapshot(3, 1, tenantId, { ...binding, targetId: "target-other" });
  assert.throws(() => createPublicationEventEnvelope({
    source: eventSecuritySource(), projectionProvenance: createPublicationEventProjectionProvenance(otherSnapshot),
    eventType: "EVT-003", aggregateId: publicationId, aggregateVersion: 2, eventSequence: 1,
    occurredAt: clock.now(), recordedAt: clock.now(), correlationId: "cross-snapshot", causationId: "command-cross",
    commandId: "command-cross", actorReference: "executor-1", tenantId, classification: "CONFIDENTIAL_BUSINESS",
    privacyScope: "privacy:approved-publication", consentOrLegalBasis: "permission:public-publication",
    audienceRestriction: "PUBLIC_APPROVED", governanceSourceVersion: 2, purpose: "PUBLICATION_EXECUTION",
    payload: { publicationId, priorLifecycle: "EXECUTION_PENDING", newLifecycle: "ACTIVE", attemptId: "attempt-1", effectiveVersion: 1, evidenceReferences: [] },
  }));
  assert.equal(snapshot.publicationId, publicationId);

  assert.throws(() => canonicalEvent("EVT-003", 1, 2, 1, { restrictedContact: "must-never-project" }));

  const targetSetup = initializedProjection();
  const changedTarget = canonicalEvent("EVT-007", 2, 3, 2, {}, tenantId, defaultEventSecurity, { ...binding, targetId: "target-other" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(changedTarget), store: targetSetup.store, audit: targetSetup.audit, clock }).consume(tenantId, changedTarget.eventId), projectionError("PROJECTION_PROVENANCE_CONFLICT"));
  const channelSetup = initializedProjection();
  const changedChannel = canonicalEvent("EVT-007", 2, 3, 2, {}, tenantId, defaultEventSecurity, { ...binding, channelId: "channel-other" });
  assert.throws(() => new ListingProjectionConsumer({ journal: journalReturning(changedChannel), store: channelSetup.store, audit: channelSetup.audit, clock }).consume(tenantId, changedChannel.eventId), projectionError("PROJECTION_PROVENANCE_CONFLICT"));
});

test("F15-TASK-011 store preserves tenant/generation isolation, optimistic versions and atomic cutover", () => {
  const store = new InMemoryListingProjectionStore();
  store.createGeneration(generation("gen-a", "ACTIVE"));
  store.createGeneration(generation("gen-b", "BUILDING"));
  const identity = { tenantId, publicationId };
  assert.throws(() => store.compareAndSwapServingGeneration(identity, undefined, "gen-a"), projectionError("PROJECTION_GENERATION_INCOMPLETE"));
  assert.throws(() => store.compareAndSwapServingGeneration(identity, undefined, "gen-b"), projectionError("PROJECTION_GENERATION_INCOMPLETE"));
  assert.equal(store.getServingGeneration(identity), undefined);
  assert.throws(() => store.getByGeneration({ tenantId: "team-b", publicationId }, "gen-a"), projectionError("PROJECTION_TENANT_MISMATCH"));
  const initialized = initializedProjection();
  const record = initialized.store.getServing({ tenantId, publicationId })!;
  assert.throws(() => initialized.store.save({ ...record, projectionRecordVersion: record.projectionRecordVersion + 1 }, record.projectionRecordVersion - 1), projectionError("PROJECTION_RECORD_VERSION_CONFLICT"));
});

test("F15-TASK-011 serving generation cutover is isolated per Publication within one tenant", () => {
  const store = new InMemoryListingProjectionStore();
  const first = { tenantId, publicationId };
  const second = { tenantId, publicationId: "publication-projection-2" };
  seedGeneration(store, first, "first-a");
  seedGeneration(store, second, "second-a");
  seedGeneration(store, first, "first-b");
  store.compareAndSwapServingGeneration(first, undefined, "first-a");
  store.compareAndSwapServingGeneration(second, undefined, "second-a");

  store.compareAndSwapServingGeneration(first, "first-a", "first-b");

  assert.equal(store.getServingGeneration(first)?.generationId, "first-b");
  assert.equal(store.getServingGeneration(second)?.generationId, "second-a");
});

test("F15-TASK-011 rebuild uses an isolated generation, deterministic Journal replay and atomic cutover", () => {
  const setup = projectionSetup();
  appendAndConsume(setup, canonicalEvent("EVT-003", 1, 2, 1));
  const beforeServing = setup.store.getServingGeneration({ tenantId, publicationId })?.generationId;
  const aggregateBefore = structuredClone(sourceSnapshot(2, 1));
  const eventsBefore = setup.journal.listByAggregate(tenantId, publicationId);
  const coordinator = new ListingProjectionRebuildCoordinator({
    journal: setup.journal, store: setup.store, audit: setup.audit, clock,
    authority: { authorize: (request) => request.purpose === "PROJECTION_REBUILD" },
  });
  const request = rebuildRequest("rebuild-key-1", "generation-b", beforeServing);
  const result = coordinator.rebuild(request);
  const replay = coordinator.rebuild(request);
  assert.equal(result.generationId, "generation-b");
  assert.equal(replay.replayed, true);
  assert.equal(setup.store.getServingGeneration({ tenantId, publicationId })?.generationId, "generation-b");
  assert.equal(setup.store.getGeneration({ tenantId, publicationId }, beforeServing!)?.lifecycle, "ARCHIVED");
  assert.notEqual(beforeServing, "generation-b");
  assert.deepEqual(setup.journal.listByAggregate(tenantId, publicationId), eventsBefore);
  assert.deepEqual(sourceSnapshot(2, 1), aggregateBefore);
  assert.equal(result.record.lifecycle, "ACTIVE");
  assert.equal(result.record.publicationVersion, 1);
  assert.equal(setup.audit.list({ tenantId, publicationId }).some(({ operation }) => operation === "GENERATION_CUTOVER"), true);
  assert.equal(setup.audit.list({ tenantId, publicationId }).some(({ operation }) => operation === "GENERATION_ARCHIVED"), true);
  const second = coordinator.rebuild(rebuildRequest("rebuild-key-2", "generation-c", "generation-b"));
  const { generationId: firstGeneration, generatedAt: firstGeneratedAt, updatedAt: firstUpdatedAt, ...firstSemantic } = result.record;
  const { generationId: secondGeneration, generatedAt: secondGeneratedAt, updatedAt: secondUpdatedAt, ...secondSemantic } = second.record;
  assert.deepEqual(secondSemantic, firstSemantic);
  assert.notEqual(firstGeneration, secondGeneration);
  assert.equal(typeof firstGeneratedAt, "string");
  assert.equal(typeof firstUpdatedAt, "string");
  assert.equal(typeof secondGeneratedAt, "string");
  assert.equal(typeof secondUpdatedAt, "string");
  assert.throws(() => coordinator.rebuild({ ...request, generationId: "generation-c" }), projectionError("PROJECTION_REBUILD_FAILED"));
});

test("F15-TASK-011 failed or unauthorized rebuild never replaces the serving generation", () => {
  const setup = projectionSetup();
  appendAndConsume(setup, canonicalEvent("EVT-003", 1, 2, 1));
  const serving = setup.store.getServingGeneration({ tenantId, publicationId })?.generationId;
  const denied = new ListingProjectionRebuildCoordinator({ journal: setup.journal, store: setup.store, audit: setup.audit, clock, authority: { authorize: () => false } });
  assert.throws(() => denied.rebuild(rebuildRequest("denied", "generation-denied", serving)), projectionError("PROJECTION_REBUILD_UNAUTHORIZED"));
  assert.equal(setup.store.getServingGeneration({ tenantId, publicationId })?.generationId, serving);

  const empty = new ListingProjectionRebuildCoordinator({ journal: new InMemoryPublicationEventJournal(), store: setup.store, audit: setup.audit, clock, authority: { authorize: () => true } });
  assert.throws(() => empty.rebuild(rebuildRequest("empty", "generation-failed", serving)), projectionError("PROJECTION_REBUILD_FAILED"));
  assert.equal(setup.store.getServingGeneration({ tenantId, publicationId })?.generationId, serving);
  assert.equal(setup.store.getGeneration({ tenantId, publicationId }, "generation-failed")?.lifecycle, "FAILED");

  for (const forbiddenPurpose of ["PUBLISH", "APPROVE", "WITHDRAW", "REPUBLISH"] as const) {
    assert.throws(
      () => denied.rebuild({ ...rebuildRequest(`forbidden-${forbiddenPurpose}`, `generation-${forbiddenPurpose}`, serving), purpose: forbiddenPurpose } as never),
      projectionError("PROJECTION_REBUILD_UNAUTHORIZED"),
    );
  }
});

test("F15-TASK-011 post-cutover evidence failure restores the prior serving generation", () => {
  const setup = initializedProjection();
  const serving = setup.store.getServingGeneration({ tenantId, publicationId })?.generationId;
  const failingAudit: ListingProjectionAuditStore = {
    append(record) {
      if (record.operation === "GENERATION_CUTOVER") throw new Error("simulated audit boundary failure");
      return setup.audit.append(record);
    },
    list: (identity) => setup.audit.list(identity),
  };
  const coordinator = new ListingProjectionRebuildCoordinator({
    journal: setup.journal, store: setup.store, audit: failingAudit, clock, authority: { authorize: () => true },
  });
  assert.throws(() => coordinator.rebuild(rebuildRequest("cutover-audit-failure", "generation-audit-failure", serving)), projectionError("PROJECTION_REBUILD_FAILED"));
  assert.equal(setup.store.getServingGeneration({ tenantId, publicationId })?.generationId, serving);
  assert.equal(setup.store.getGeneration({ tenantId, publicationId }, "generation-audit-failure")?.lifecycle, "FAILED");
});

test("F15-TASK-011 first cutover failure clears a serving pointer that had no predecessor", () => {
  const journal = new InMemoryPublicationEventJournal();
  const store = new InMemoryListingProjectionStore();
  const audit = new InMemoryListingProjectionAuditStore();
  const activated = canonicalEvent("EVT-003", 1, 2, 1);
  journal.append(activated);
  const failingAudit: ListingProjectionAuditStore = {
    append(record) {
      if (record.operation === "GENERATION_CUTOVER") throw new Error("simulated first cutover audit failure");
      return audit.append(record);
    },
    list: (identity) => audit.list(identity),
  };
  const coordinator = new ListingProjectionRebuildCoordinator({ journal, store, audit: failingAudit, clock, authority: { authorize: () => true } });
  assert.throws(() => coordinator.rebuild(rebuildRequest("first-cutover-failure", "generation-first-failure", undefined)), projectionError("PROJECTION_REBUILD_FAILED"));
  assert.equal(store.getServingGeneration({ tenantId, publicationId }), undefined);
  assert.equal(store.getGeneration({ tenantId, publicationId }, "generation-first-failure")?.lifecycle, "FAILED");
});

test("F15-TASK-011 rebuild audit failures are sanitized and cannot create an untracked generation", () => {
  const journal = new InMemoryPublicationEventJournal();
  const store = new InMemoryListingProjectionStore();
  const audit = new InMemoryListingProjectionAuditStore();
  const failingAudit: ListingProjectionAuditStore = {
    append(record) {
      if (record.operation === "REBUILD_REQUESTED" || record.operation === "REBUILD_FAILED") throw new Error("simulated rebuild audit failure");
      return audit.append(record);
    },
    list: (identity) => audit.list(identity),
  };
  const coordinator = new ListingProjectionRebuildCoordinator({ journal, store, audit: failingAudit, clock, authority: { authorize: () => true } });

  assert.throws(() => coordinator.rebuild(rebuildRequest("request-audit-failure", "generation-request-audit-failure", undefined)), projectionError("PROJECTION_REBUILD_FAILED"));
  assert.equal(store.getGeneration({ tenantId, publicationId }, "generation-request-audit-failure"), undefined);
  assert.equal(store.getServingGeneration({ tenantId, publicationId }), undefined);
});

test("F15-TASK-011 Infrastructure and Runtime register one shared Journal and all PRJ-002 services", () => {
  const infrastructure = createPublicationInfrastructure();
  const runtime = createPublicationRuntimeServiceRegistry(infrastructure);
  assert.equal(infrastructure.listingProjectionConsumer.journalIdentity, infrastructure.eventJournal);
  assert.equal(infrastructure.listingProjectionRebuild.journalIdentity, infrastructure.eventJournal);
  assert.equal(runtime.listingProjectionStore, infrastructure.listingProjectionStore);
  assert.equal(runtime.listingProjectionConsumer, infrastructure.listingProjectionConsumer);
  assert.equal(runtime.listingProjectionRebuild, infrastructure.listingProjectionRebuild);
  assert.equal(runtime.listingProjectionRead, infrastructure.listingProjectionRead);
  assert.equal(runtime.serviceNames.includes("listingProjectionRead"), true);
});

function projectionSetup() {
  const journal = new InMemoryPublicationEventJournal();
  const store = new InMemoryListingProjectionStore();
  const audit = new InMemoryListingProjectionAuditStore();
  const consumer = new ListingProjectionConsumer({ journal, store, audit, clock });
  return { journal, store, audit, consumer, read: new ListingProjectionReadService(store) };
}

function initializedProjection() {
  const setup = projectionSetup();
  appendAndConsume(setup, canonicalEvent("EVT-003", 1, 2, 1));
  return setup;
}

function appendAndConsume(setup: ReturnType<typeof projectionSetup>, event: PublicationEventEnvelope): void {
  setup.journal.append(event);
  setup.consumer.consume(event.tenantId, event.eventId);
}

type EventSecurity = Readonly<{
  classification: PublicationEventEnvelope["classification"];
  privacyScope: string;
  consentOrLegalBasis: string;
  audienceRestriction: string;
  purpose: PublicationEventEnvelope["purpose"];
}>;

const defaultEventSecurity: EventSecurity = Object.freeze({
  classification: "CONFIDENTIAL_BUSINESS" as const,
  privacyScope: "privacy:approved-publication",
  consentOrLegalBasis: "permission:public-publication",
  audienceRestriction: "PUBLIC_APPROVED",
  purpose: "PUBLICATION_EXECUTION" as const,
});

function canonicalEvent(
  type: PublicationEventEnvelope["eventType"],
  sequence: number,
  aggregateVersion: number,
  publicationVersion: number,
  payloadOverrides: Readonly<Record<string, unknown>> = {},
  eventTenant = tenantId,
  security: EventSecurity = defaultEventSecurity,
  eventBinding: PublicationBinding = binding,
): PublicationEventEnvelope {
  const relevant = new Set(["EVT-003", "EVT-007", "EVT-008", "EVT-009"]).has(type);
  const payload = type === "EVT-003" || type === "EVT-007" || type === "EVT-008"
    ? { publicationId, priorLifecycle: type === "EVT-003" ? "EXECUTION_PENDING" : type === "EVT-007" ? "WITHDRAWAL_PENDING" : "EXECUTION_PENDING", newLifecycle: type === "EVT-007" ? "WITHDRAWN" : "ACTIVE", attemptId: `attempt-${sequence}`, effectiveVersion: publicationVersion, evidenceReferences: [`evidence-${sequence}`], ...payloadOverrides }
    : type === "EVT-004"
      ? { publicationId, suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD", ...payloadOverrides }
      : type === "EVT-006"
        ? { publicationId, caseId: "case-1", attemptId: "attempt-1", resolutionCategory: "EFFECT_CONFIRMED", evidenceReferences: ["evidence-1"], ...payloadOverrides }
        : type === "EVT-012"
          ? { publicationId, replayVersion: "v1", replayedFromSequence: 1, replayedToSequence: sequence - 1, validatedEventCount: sequence - 1, ...payloadOverrides }
          : { publicationId, ...payloadOverrides };
  const snapshot = sourceSnapshot(aggregateVersion, publicationVersion, eventTenant, eventBinding);
  return createPublicationEventEnvelope({
    source: eventSecuritySource(eventTenant, aggregateVersion, security),
    ...(relevant ? { projectionProvenance: createPublicationEventProjectionProvenance(snapshot) } : {}),
    eventType: type, aggregateId: publicationId, aggregateVersion, eventSequence: sequence,
    occurredAt: `2026-08-10T00:00:0${Math.min(sequence, 9)}.000Z`, recordedAt: `2026-08-10T00:01:0${Math.min(sequence, 9)}.000Z`,
    correlationId: `correlation-${sequence}`, causationId: `command-${sequence}`, commandId: `command-${sequence}`,
    actorReference: "executor-1", tenantId: eventTenant, ...security, governanceSourceVersion: 2, payload,
  });
}

function eventSecuritySource(
  eventTenant = tenantId,
  aggregateVersion = 2,
  security: EventSecurity = defaultEventSecurity,
) {
  return { tenantId: eventTenant, aggregateId: publicationId, aggregateVersion, ...security, governanceSourceVersion: 2 };
}

function sourceSnapshot(aggregateVersion: number, publicationVersion: number, snapshotTenant = tenantId, snapshotBinding: PublicationBinding = binding) {
  const base = createPublication({ identity: { publicationId, tenantScopeId: snapshotTenant }, binding: snapshotBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: domain("source") }).snapshot;
  const bindingHistory = publicationVersion === 0 ? base.bindingHistory : [...base.bindingHistory, { ...base.bindingHistory[0]!, id: `${publicationId}:version:${publicationVersion}`, publicationVersion }];
  return PublicationAggregate.rehydrate({ ...base, aggregateVersion, publicationVersion, bindingHistory }).snapshot;
}

function domain(suffix: string) { return { actorId: "executor-1", authorityContext: "PUBLICATION_EXECUTION", reason: `Approved ${suffix}`, correlationId: `correlation-${suffix}`, occurredAt: "2026-08-10T00:00:00.000Z" } as const; }

function journalReturning(event: PublicationEventEnvelope): PublicationEventJournal {
  return { findByEventId: () => event, listByAggregate: () => [event], getLastSequence: () => event.eventSequence, append: () => ({ status: "APPENDED", event }), appendAll: () => [{ status: "APPENDED", event }] };
}

function generation(generationId: string, lifecycle: "BUILDING" | "ACTIVE", generationPublicationId = publicationId) {
  return { projectionType: "PRJ-002" as const, tenantId, publicationId: generationPublicationId, generationId, lifecycle, projectionDefinitionVersion: "v0.1" as const, projectionSchemaVersion: "v1" as const, createdAt: clock.now(), updatedAt: clock.now(), complete: lifecycle === "ACTIVE" };
}

function seedGeneration(
  store: InMemoryListingProjectionStore,
  identity: Readonly<{ tenantId: string; publicationId: string }>,
  generationId: string,
): void {
  store.createGeneration({ ...generation(generationId, "BUILDING", identity.publicationId), tenantId: identity.tenantId });
  const template = initializedProjection().store.getServing({ tenantId, publicationId })!;
  const record = store.save({
    ...template,
    tenantId: identity.tenantId,
    publicationId: identity.publicationId,
    projectionId: `PRJ-002:${identity.tenantId}:${identity.publicationId}`,
    generationId,
    projectionRecordVersion: 1,
  }, undefined);
  store.markGeneration(identity, generationId, {
    lifecycle: "ACTIVE",
    complete: true,
    finalEventSequence: record.lastEventSequence,
    sourceAggregateVersion: record.aggregateVersion,
    publicationVersion: record.publicationVersion,
    sourceClassification: record.sourceClassification,
    privacyScope: record.privacyScope,
    purpose: record.purpose,
    targetReference: record.targetReference,
    channelReference: record.channelReference,
    updatedAt: clock.now(),
  });
}

function rebuildRequest(idempotencyKey: string, generationId: string, expectedServingGenerationId: string | undefined) {
  return { tenantId, publicationId, projectionId: "PRJ-002" as const, generationId, ...(expectedServingGenerationId === undefined ? {} : { expectedServingGenerationId }), actorOrServiceReference: "service-projection-rebuild", purpose: "PROJECTION_REBUILD" as const, reason: "Approved deterministic rebuild", correlationId: `correlation-${idempotencyKey}`, idempotencyKey, sourceFromSequence: 1 };
}

function projectionError(code: string): (error: unknown) => boolean { return (error) => error instanceof ListingProjectionError && error.code === code; }
