import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createPublicationEventEnvelope, createPublicationEventProjectionProvenance, validatePublicationEventEnvelope, verifyPublicationEventIntegrity } from "./publication-event-contracts.js";
import { PublicationEventError } from "./publication-event-error.js";
import { InMemoryPublicationGovernanceContextStore, type PublicationGovernanceContext, type PublicationGovernanceContextStore } from "./publication-governance-context.js";
import { InMemoryPublicationEventJournal } from "./in-memory-publication-event-journal.js";
import { FixedClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration, createTestPublicationAuthorizationGuard } from "./publication-authorization-test-support.test.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { createPublication } from "./publication-factory.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import { PublicationEventReplayService } from "./publication-event-replay-service.js";
import { mapAcceptedPublicationTransition } from "./publication-event-mapper.js";
import { ModifyPublicationHandler } from "./publication-command-handlers.js";
import { PublicationEventCoordinator } from "./publication-event-coordinator.js";
import {
  resolvePublicationEventSourceContext,
  StoredPublicationEventSourceContextResolver,
  type PublicationEventSourceContextRequest,
  type PublicationEventSourceContextResolver,
} from "./publication-event-source-context.js";
import { InMemoryPublicationUnitOfWork, type PublicationTransaction, type PublicationUnitOfWork } from "./publication-unit-of-work.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { mapPublicationApplicationError } from "./publication-application-error.js";

const source = Object.freeze({
  tenantId: "team-a",
  aggregateId: "publication-event-1",
  aggregateVersion: 2,
  classification: "CONFIDENTIAL_BUSINESS" as const,
  privacyScope: "privacy-scope:publication-approved-fields",
  consentOrLegalBasis: "legal-basis-reference:publication-1",
  audienceRestriction: "AUD_PUBLIC",
  governanceSourceVersion: 2,
  purpose: "PUBLICATION_EXECUTION",
});

const sourceContextResolver: PublicationEventSourceContextResolver = Object.freeze({
  resolve(input: PublicationEventSourceContextRequest) {
    return Object.freeze({
      publicationId: input.publicationId,
      tenantId: input.tenantId,
      classification: "CONFIDENTIAL_BUSINESS" as const,
      privacyScope: source.privacyScope,
      consentOrLegalBasis: source.consentOrLegalBasis,
      audienceRestriction: source.audienceRestriction,
      purpose: input.purpose,
      sourceVersion: input.sourceVersion,
    });
  },
});

function event(overrides: Record<string, unknown> = {}) {
  const aggregateId = typeof overrides["aggregateId"] === "string" ? overrides["aggregateId"] : source.aggregateId;
  const aggregateVersion = typeof overrides["aggregateVersion"] === "number" ? overrides["aggregateVersion"] : source.aggregateVersion;
  const eventType = typeof overrides["eventType"] === "string" ? overrides["eventType"] : "EVT-003";
  const requiresProjectionProvenance = eventType === "EVT-003" || eventType === "EVT-007" || eventType === "EVT-008" || eventType === "EVT-009";
  return createPublicationEventEnvelope({
    source: { ...source, aggregateId, aggregateVersion },
    ...(requiresProjectionProvenance ? { projectionProvenance: createPublicationEventProjectionProvenance(eventSourceSnapshot(aggregateId, aggregateVersion)) } : {}),
    eventType: "EVT-003",
    aggregateId,
    aggregateVersion,
    eventSequence: 1,
    occurredAt: "2026-08-09T00:00:00.000Z",
    recordedAt: "2026-08-09T00:00:01.000Z",
    correlationId: "correlation-1",
    causationId: "command-1",
    commandId: "command-1",
    attemptId: "attempt-1",
    actorReference: "actor-1",
    tenantId: source.tenantId,
    classification: source.classification,
    privacyScope: source.privacyScope,
    consentOrLegalBasis: source.consentOrLegalBasis,
    audienceRestriction: source.audienceRestriction,
    governanceSourceVersion: source.governanceSourceVersion,
    purpose: source.purpose,
    payload: {
      publicationId: source.aggregateId,
      priorLifecycle: "EXECUTION_PENDING",
      newLifecycle: "ACTIVE",
      attemptId: "attempt-1",
      effectiveVersion: 1,
      evidenceReferences: ["evidence-1"],
    },
    ...overrides,
  });
}

test("F15-TASK-010 creates a deterministic deeply immutable canonical Event envelope", () => {
  const first = event();
  const second = event();

  assert.deepEqual(first, second);
  assert.equal(first.eventId, second.eventId);
  assert.equal(verifyPublicationEventIntegrity(first), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.payload), true);
  assert.equal(Object.isFrozen(first.payload["evidenceReferences"]), true);
  assert.equal(first.privacyScope, source.privacyScope);
  assert.equal(first.consentOrLegalBasis, source.consentOrLegalBasis);
  assert.equal(first.audienceRestriction, source.audienceRestriction);
  assert.equal(first.eventSchemaVersion, "v2");
  assert.equal(first.eventContractVersion, "v2");
  assert.doesNotThrow(() => JSON.stringify(first));
});

test("F15-TASK-011A EVT-003 carries exact immutable projection provenance without collapsing versions", () => {
  const activated = event({
    eventSequence: 9,
    publicationVersion: 999,
    targetReference: "caller-target@999",
    channelReference: "caller-channel",
  }) as ReturnType<typeof event> & {
    readonly publicationVersion?: number;
    readonly targetReference?: string;
    readonly channelReference?: string;
  };

  assert.equal(activated.publicationVersion, 1);
  assert.equal(activated.targetReference, "target-1@5");
  assert.equal(activated.channelReference, "channel-1");
  assert.notEqual(activated.aggregateVersion, activated.publicationVersion);
  assert.notEqual(activated.eventSequence, activated.publicationVersion);
});

test("F15-TASK-011A projection provenance participates in integrity and missing provenance fails closed", () => {
  for (const [field, value] of [
    ["publicationVersion", 7],
    ["targetReference", "target-other@1"],
    ["channelReference", "channel-other"],
  ] as const) {
    const changed = structuredClone(event()) as unknown as Record<string, unknown>;
    changed[field] = value;
    assert.equal(verifyPublicationEventIntegrity(changed), false, field);
  }

  for (const field of ["publicationVersion", "targetReference", "channelReference"] as const) {
    const incomplete = structuredClone(event()) as unknown as Record<string, unknown>;
    delete incomplete[field];
    assert.throws(
      () => validatePublicationEventEnvelope(incomplete as never),
      matches("EVENT_PROJECTION_PROVENANCE_INCOMPLETE"),
      field,
    );
  }
});

test("F15-TASK-011A rejects unbranded caller provenance and omits provenance from technical Events", () => {
  assert.throws(
    () => createPublicationEventEnvelope({
      ...eventInputForTechnicalEvent(),
      eventType: "EVT-003",
      projectionProvenance: {
        publicationVersion: 999,
        targetReference: "caller-target@999",
        channelReference: "caller-channel",
      } as never,
      payload: event().payload,
    }),
    matches("EVENT_PROJECTION_PROVENANCE_INCOMPLETE"),
  );

  const replayCompleted = createPublicationEventEnvelope(eventInputForTechnicalEvent());
  assert.equal(replayCompleted.eventType, "EVT-012");
  assert.equal("publicationVersion" in replayCompleted, false);
  assert.equal("targetReference" in replayCompleted, false);
  assert.equal("channelReference" in replayCompleted, false);

  const suspended = event({
    eventType: "EVT-004",
    payload: { publicationId: source.aggregateId, suspensionStatus: "SUSPENDED", reasonCode: "POLICY_HOLD" },
  });
  assert.equal("publicationVersion" in suspended, false);
  assert.equal("targetReference" in suspended, false);
  assert.equal("channelReference" in suspended, false);
});

test("F15-TASK-011A rejects branded projection provenance minted for another accepted snapshot", () => {
  const foreign = createPublication({
    identity: { publicationId: "publication-foreign", tenantScopeId: source.tenantId },
    binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: source.classification,
    command: domain("foreign-event-source-create"),
  }).beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION",
    expectedAggregateVersion: 1,
    attempt: deliveryAttempt("foreign-event-source", "INITIAL_PUBLISH"),
    command: domain("foreign-event-source-begin"),
  }).snapshot;

  assert.throws(
    () => event({ projectionProvenance: createPublicationEventProjectionProvenance(foreign) }),
    matches("EVENT_PROJECTION_PROVENANCE_INCOMPLETE"),
  );
});

test("F15-TASK-011A EVT-009 preserves material-change binding provenance as closed Event data", () => {
  const materialChange = event({
    eventType: "EVT-009",
    payload: {
      publicationId: source.aggregateId,
      representationId: "representation-1",
      representationVersion: 2,
      dispositionReference: "material-change-1",
    },
  });

  assert.equal(materialChange.publicationVersion, 1);
  assert.equal(materialChange.targetReference, "target-1@5");
  assert.equal(materialChange.channelReference, "channel-1");
  assert.deepEqual(
    Object.keys(materialChange.payload).sort(),
    ["dispositionReference", "publicationId", "representationId", "representationVersion"],
  );
});

test("F15-TASK-010R Event envelope fails closed on missing or widened governance context", () => {
  assert.throws(() => event({ source: { ...source, privacyScope: "" }, privacyScope: "" }), matches("EVENT_SOURCE_CONTEXT_INVALID"));
  assert.throws(() => event({ source: { ...source, consentOrLegalBasis: "" }, consentOrLegalBasis: "" }), matches("EVENT_SOURCE_CONTEXT_INVALID"));
  assert.throws(() => event({ source: { ...source, audienceRestriction: "" }, audienceRestriction: "" }), matches("EVENT_SOURCE_CONTEXT_INVALID"));
  assert.throws(() => event({ source: { ...source, privacyScope: "SOURCE_CLASSIFICATION:CONFIDENTIAL_BUSINESS" }, privacyScope: "SOURCE_CLASSIFICATION:CONFIDENTIAL_BUSINESS" }), matches("EVENT_PRIVACY_VIOLATION"));
  assert.throws(() => event({ classification: "INTERNAL" }), matches("EVENT_CLASSIFICATION_VIOLATION"));
  assert.throws(() => event({ privacyScope: "privacy-scope:wider" }), matches("EVENT_PRIVACY_VIOLATION"));
  assert.throws(() => event({ purpose: "RECOVERY_VALIDATION" }), matches("EVENT_PURPOSE_VIOLATION"));
  assert.throws(() => event({ tenantId: "team-b" }), matches("EVENT_TENANT_MISMATCH"));
  assert.throws(() => event({ audienceRestriction: "AUD_UNBOUNDED" }), matches("EVENT_AUDIENCE_VIOLATION"));
});

test("F15-TASK-010 journal enforces aggregate-local ordering and exact duplicate idempotency", () => {
  const journal = new InMemoryPublicationEventJournal();
  const first = event();
  const second = event({
    eventType: "EVT-004",
    aggregateVersion: 3,
    eventSequence: 2,
    causationId: "command-2",
    commandId: "command-2",
    attemptId: undefined,
    payload: { publicationId: source.aggregateId, suspensionStatus: "SUSPENDED", reasonCode: "POLICY_HOLD" },
  });

  assert.equal(journal.append(first).status, "APPENDED");
  assert.equal(journal.append(first).status, "REPLAYED");
  assert.equal(journal.append(second).status, "APPENDED");
  assert.deepEqual(journal.listByAggregate(source.tenantId, source.aggregateId).map((item) => item.eventSequence), [1, 2]);
  assert.equal(journal.getLastSequence(source.tenantId, source.aggregateId), 2);
});

test("F15-TASK-010 coordinator retry reuses the canonical occurrence identity and audits the duplicate", () => {
  const clock = new FixedClock("2026-08-09T00:30:00.000Z");
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const identity = { publicationId: "publication-event-coordinator-retry", tenantScopeId: "team-a" } as const;
  const previous = createPublication({
    identity,
    binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: domain("coordinator-retry-create"),
  }).beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION",
    expectedAggregateVersion: 1,
    attempt: deliveryAttempt("coordinator-retry", "INITIAL_PUBLISH"),
    command: domain("coordinator-retry-begin"),
  });
  const current = previous.resolveExecution({
    type: "RESOLVE_EXECUTION",
    expectedAggregateVersion: 2,
    outcome: "EFFECT_CONFIRMED",
    evidenceRefs: ["evidence-coordinator-retry"],
    externalObjectReference: "external-coordinator-retry",
    command: domain("coordinator-retry-resolve"),
  });
  const command = {
    kind: "MODIFY_PUBLICATION",
    publicationVersion: 999,
    targetReference: "caller-target@999",
    channelReference: "caller-channel",
    identity,
    input: {
      type: "RESOLVE_EXECUTION",
      expectedAggregateVersion: 2,
      outcome: "EFFECT_CONFIRMED",
      evidenceRefs: ["evidence-coordinator-retry"],
      externalObjectReference: "external-coordinator-retry",
      command: domain("coordinator-retry-resolve"),
    },
  } as const;
  const coordinator = new PublicationEventCoordinator(clock, sourceContextResolver);

  const first = unitOfWork.begin(identity);
  const appended = coordinator.appendAcceptedTransition(first, previous.snapshot, current.snapshot, command);
  first.commit();
  const retry = unitOfWork.begin(identity);
  const replayed = coordinator.appendAcceptedTransition(retry, previous.snapshot, current.snapshot, command);
  retry.commit();

  assert.equal(appended[0]?.eventId, replayed[0]?.eventId);
  assert.equal(appended[0]?.eventSequence, replayed[0]?.eventSequence);
  assert.equal(appended[0]?.recordedAt, replayed[0]?.recordedAt);
  assert.equal(appended[0]?.publicationVersion, current.snapshot.publicationVersion);
  assert.equal(appended[0]?.targetReference, `${current.snapshot.binding.targetId}@${String(current.snapshot.binding.targetVersion)}`);
  assert.equal(appended[0]?.channelReference, current.snapshot.binding.channelId);
  assert.equal(unitOfWork.eventJournal.listByAggregate(identity.tenantScopeId, identity.publicationId).length, 1);
  assert.deepEqual(
    unitOfWork.audit.list(identity).map((record) => record.safeReasonCode),
    ["EVENT_APPENDED", "EVENT_DUPLICATE_IDEMPOTENT"],
  );
});

test("F15-TASK-010R Event coordinator fails closed for missing or stale authoritative source context", () => {
  const clock = new FixedClock("2026-08-09T00:31:00.000Z");
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const identity = { publicationId: "publication-event-source-context", tenantScopeId: "team-a" } as const;
  const previous = createPublication({ identity, binding: publicationBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: domain("source-create") })
    .beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: deliveryAttempt("source", "INITIAL_PUBLISH"), command: domain("source-begin") });
  const input = { type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-source"], externalObjectReference: "external-source", command: domain("source-resolve") } as const;
  const current = previous.resolveExecution(input);
  const command = { kind: "MODIFY_PUBLICATION", identity, input } as const;
  const authoritative = resolvePublicationEventSourceContext(sourceContextResolver, current.snapshot, "PUBLICATION_EXECUTION");
  assert.equal(authoritative.privacyScope, source.privacyScope);
  assert.equal(authoritative.consentOrLegalBasis, source.consentOrLegalBasis);
  assert.equal(authoritative.audienceRestriction, source.audienceRestriction);
  assert.equal(Object.isFrozen(authoritative), true);
  const invalidContexts: readonly (readonly [Partial<typeof authoritative>, string])[] = [
    [{ privacyScope: "" }, "EVENT_SOURCE_CONTEXT_INVALID"],
    [{ consentOrLegalBasis: "" }, "EVENT_SOURCE_CONTEXT_INVALID"],
    [{ audienceRestriction: "" }, "EVENT_SOURCE_CONTEXT_INVALID"],
    [{ privacyScope: "SOURCE_CLASSIFICATION:CONFIDENTIAL_BUSINESS" }, "EVENT_PRIVACY_VIOLATION"],
    [{ classification: "INTERNAL" }, "EVENT_CLASSIFICATION_VIOLATION"],
    [{ purpose: "RECOVERY_VALIDATION" }, "EVENT_PURPOSE_VIOLATION"],
    [{ tenantId: "team-b" }, "EVENT_TENANT_MISMATCH"],
    [{ sourceVersion: current.snapshot.binding.representationVersion - 1 }, "EVENT_SOURCE_VERSION_STALE"],
  ];
  for (const [override, code] of invalidContexts) {
    const resolver: PublicationEventSourceContextResolver = { resolve: () => ({ ...authoritative, ...override }) };
    assert.throws(() => resolvePublicationEventSourceContext(resolver, current.snapshot, "PUBLICATION_EXECUTION"), matches(code));
  }
  const missing = unitOfWork.begin(identity);
  assert.throws(() => new PublicationEventCoordinator(clock).appendAcceptedTransition(missing, previous.snapshot, current.snapshot, command), matches("EVENT_SOURCE_CONTEXT_UNAVAILABLE"));
  missing.rollback();
  const stale = unitOfWork.begin(identity);
  const staleResolver: PublicationEventSourceContextResolver = { resolve: (request) => ({ ...sourceContextResolver.resolve(request)!, sourceVersion: request.sourceVersion - 1 }) };
  assert.throws(() => new PublicationEventCoordinator(clock, staleResolver).appendAcceptedTransition(stale, previous.snapshot, current.snapshot, command), matches("EVENT_SOURCE_VERSION_STALE"));
  stale.rollback();
});

test("F15-TASK-010R production resolver reads only current canonical Governance Context", () => {
  const clock = new FixedClock("2026-08-09T00:32:00.000Z");
  const identity = { publicationId: "publication-governance-source", tenantScopeId: "team-a" } as const;
  const snapshot = createPublication({ identity, binding: publicationBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: domain("governance-source") }).snapshot;
  const canonical = governanceContext(identity.publicationId);
  const store = new InMemoryPublicationGovernanceContextStore([canonical]);
  const resolver = new StoredPublicationEventSourceContextResolver(store, clock);
  const resolved = resolvePublicationEventSourceContext(resolver, snapshot, "PUBLICATION_EXECUTION");

  assert.deepEqual(resolved, {
    publicationId: identity.publicationId,
    tenantId: identity.tenantScopeId,
    classification: canonical.classification,
    privacyScope: canonical.privacyScope,
    consentOrLegalBasis: canonical.consentOrLegalBasis,
    audienceRestriction: canonical.audienceRestriction,
    purpose: canonical.purpose,
    sourceVersion: canonical.sourceVersion,
  });
  assert.equal(Object.isFrozen(resolved), true);
  assert.equal(store.findById(canonical.governanceContextId, "team-b"), undefined);
  assert.equal(store.findCurrentByPublicationId(identity.publicationId, "team-b", canonical.purpose), undefined);
  const before = structuredClone(snapshot);
  resolvePublicationEventSourceContext(resolver, snapshot, "PUBLICATION_EXECUTION");
  assert.deepEqual(snapshot, before);
  const productionSource = readFileSync(join(process.cwd(), "modules", "publication", "src", "publication-event-source-context.ts"), "utf8");
  assert.equal(productionSource.includes("privacy-scope:publication-approved-fields"), false);
  assert.equal(productionSource.includes("legal-basis-reference:publication-test"), false);
});

test("F15-TASK-010R production resolver rejects missing, inactive, expired, stale and mismatched Governance Context", () => {
  const clock = new FixedClock("2026-08-09T00:33:00.000Z");
  const identity = { publicationId: "publication-governance-rejection", tenantScopeId: "team-a" } as const;
  const snapshot = createPublication({ identity, binding: publicationBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: domain("governance-rejection") }).snapshot;
  const cases: readonly (readonly [PublicationGovernanceContextStore, string])[] = [
    [new InMemoryPublicationGovernanceContextStore(), "EVENT_SOURCE_CONTEXT_UNAVAILABLE"],
    [new InMemoryPublicationGovernanceContextStore([{ ...governanceContext(identity.publicationId), status: "INACTIVE" }]), "EVENT_SOURCE_CONTEXT_UNAVAILABLE"],
    [new InMemoryPublicationGovernanceContextStore([{ ...governanceContext(identity.publicationId), effectiveUntil: "2026-08-09T00:32:59.000Z" }]), "EVENT_SOURCE_CONTEXT_UNAVAILABLE"],
    [new InMemoryPublicationGovernanceContextStore([
      governanceContext(identity.publicationId),
      { ...governanceContext(identity.publicationId), governanceContextId: "governance-context-current-v3", sourceVersion: publicationBinding.representationVersion + 1 },
    ]), "EVENT_SOURCE_VERSION_STALE"],
    [storeReturning({ ...governanceContext(identity.publicationId), publicationId: "publication-other" }), "EVENT_TENANT_MISMATCH"],
    [storeReturning({ ...governanceContext(identity.publicationId), tenantId: "team-b" }), "EVENT_TENANT_MISMATCH"],
    [storeReturning({ ...governanceContext(identity.publicationId), classification: "INTERNAL" }), "EVENT_CLASSIFICATION_VIOLATION"],
    [storeReturning({ ...governanceContext(identity.publicationId), purpose: "RECOVERY_VALIDATION" }), "EVENT_PURPOSE_VIOLATION"],
  ];
  for (const [store, code] of cases) {
    const resolver = new StoredPublicationEventSourceContextResolver(store, clock);
    assert.throws(() => resolvePublicationEventSourceContext(resolver, snapshot, "PUBLICATION_EXECUTION"), matches(code));
  }
  for (const field of ["privacyScope", "consentOrLegalBasis", "audienceRestriction"] as const) {
    assert.throws(() => new InMemoryPublicationGovernanceContextStore([{ ...governanceContext(identity.publicationId), [field]: "" }]), matches("EVENT_SOURCE_CONTEXT_INVALID"));
  }
  assert.throws(() => new InMemoryPublicationGovernanceContextStore([{ ...governanceContext(identity.publicationId), privacyScope: "SOURCE_CLASSIFICATION:CONFIDENTIAL_BUSINESS" }]), matches("EVENT_PRIVACY_VIOLATION"));
});

test("F15-TASK-010 journal rejects identity conflict, sequence gap, out-of-order and stale aggregate version", () => {
  const journal = new InMemoryPublicationEventJournal();
  const first = event();
  journal.append(first);

  assert.throws(() => journal.append(event({ payload: { ...first.payload, effectiveVersion: 2 } })), matches("EVENT_IDENTITY_CONFLICT"));
  assert.throws(() => journal.append(event({ eventSequence: 3, aggregateVersion: 3, causationId: "gap", commandId: "gap" })), matches("EVENT_SEQUENCE_GAP"));
  assert.throws(() => journal.append(event({ eventSequence: 1, causationId: "old", commandId: "old" })), matches("EVENT_OUT_OF_ORDER"));
  assert.throws(() => journal.append(event({ eventSequence: 2, aggregateVersion: 1, causationId: "stale", commandId: "stale" })), matches("EVENT_AGGREGATE_VERSION_MISMATCH"));
  assert.equal(journal.listByAggregate(source.tenantId, source.aggregateId).length, 1);
});

test("F15-TASK-010 validates versions, source restrictions, payload closure and integrity", () => {
  assert.throws(() => event({ eventSchemaVersion: "v1" }), matches("EVENT_SCHEMA_VERSION_UNSUPPORTED"));
  assert.throws(() => event({ eventContractVersion: "v1" }), matches("EVENT_CONTRACT_VERSION_UNSUPPORTED"));
  assert.throws(() => event({ tenantId: "team-b", source }), matches("EVENT_TENANT_MISMATCH"));
  assert.throws(() => event({ classification: "PUBLIC_APPROVED", source }), matches("EVENT_CLASSIFICATION_VIOLATION"));
  assert.throws(() => event({ purpose: "PUBLIC_DISCLOSURE", source }), matches("EVENT_PURPOSE_VIOLATION"));
  assert.throws(() => event({ payload: { publicationId: source.aggregateId, rawConnectorResponse: "secret" } }), matches("EVENT_PAYLOAD_INVALID"));
  const valid = event();
  const tampered = { ...valid, payload: { ...valid.payload, effectiveVersion: 2 } };
  assert.equal(verifyPublicationEventIntegrity(tampered), false);
  assert.throws(() => new InMemoryPublicationEventJournal().append(tampered), matches("EVENT_INTEGRITY_FAILURE"));
});

test("F15-TASK-010 journal snapshots are append-only, isolated and mutation safe", () => {
  const journal = new InMemoryPublicationEventJournal();
  journal.append(event());
  const returned = journal.listByAggregate(source.tenantId, source.aggregateId);

  assert.equal(journal.findByEventId(source.tenantId, returned[0]!.eventId)?.eventId, returned[0]!.eventId);
  assert.deepEqual(journal.listByAggregate("team-b", source.aggregateId), []);
  assert.throws(() => (returned as unknown as unknown[]).push({}));
  assert.equal(journal.listByAggregate(source.tenantId, source.aggregateId).length, 1);
  assert.equal("globalSequence" in returned[0]!, false);
  const other = event({ aggregateId: "publication-event-2", causationId: "other", commandId: "other", payload: { ...event().payload, publicationId: "publication-event-2" } });
  assert.equal(journal.append(other).event.eventSequence, 1);
});

test("F15-TASK-010 accepted lifecycle transitions emit only the canonical allowlisted Events atomically", () => {
  const clock = new FixedClock("2026-08-09T01:00:00.000Z");
  const infrastructure = createPublicationInfrastructure(createTestPublicationAuthorizationConfiguration(clock));
  const lifecycleIdentity = { publicationId: "publication-event-lifecycle", tenantScopeId: "team-a" } as const;
  const pending = createPublication({
    identity: lifecycleIdentity, binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: domain("create"),
  }).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: deliveryAttempt("initial", "INITIAL_PUBLISH"), command: domain("begin") });
  infrastructure.repository.save(pending.snapshot);
  assert.deepEqual(infrastructure.eventJournal.listByAggregate("team-a", lifecycleIdentity.publicationId), []);

  const activated = executeModify(infrastructure, lifecycleIdentity, "activate", {
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED",
    evidenceRefs: ["evidence-activated"], externalObjectReference: "external-1", command: domain("activate"),
  });
  assert.equal(activated.operationResult, "SUCCEEDED");
  assert.equal(infrastructure.repository.find(lifecycleIdentity)?.lifecycleState, "ACTIVE");
  assert.deepEqual(infrastructure.eventJournal.listByAggregate("team-a", lifecycleIdentity.publicationId).map((item) => item.eventType), ["EVT-003"]);

  const suspended = executeModify(infrastructure, lifecycleIdentity, "suspend", {
    type: "SET_SUSPENSION", expectedAggregateVersion: 3, suspensionStatus: "SUSPENDED_SECURITY", command: domain("suspend"),
  });
  assert.equal(suspended.operationResult, "SUCCEEDED");
  assert.equal(infrastructure.repository.find(lifecycleIdentity)?.suspensionStatus, "SUSPENDED_SECURITY");
  assert.deepEqual(infrastructure.eventJournal.listByAggregate("team-a", lifecycleIdentity.publicationId).map((item) => item.eventType), ["EVT-003", "EVT-004"]);

  const replay = executeModify(infrastructure, lifecycleIdentity, "suspend", {
    type: "SET_SUSPENSION", expectedAggregateVersion: 3, suspensionStatus: "SUSPENDED_SECURITY", command: domain("suspend"),
  });
  assert.equal(replay.operationResult, "SUCCEEDED");
  assert.equal(infrastructure.eventJournal.listByAggregate("team-a", lifecycleIdentity.publicationId).length, 2);

  const stale = executeModify(infrastructure, lifecycleIdentity, "stale", {
    type: "SET_SUSPENSION", expectedAggregateVersion: 1, suspensionStatus: "SUSPENDED_COMPLIANCE", command: domain("stale"),
  });
  assert.equal(stale.operationResult, "FAILED");
  assert.equal(infrastructure.eventJournal.listByAggregate("team-a", lifecycleIdentity.publicationId).length, 2);
  assert.equal(infrastructure.audit.list(lifecycleIdentity).filter((record) => record.command === "APPEND_CANONICAL_EVENT").length, 2);
});

test("F15-TASK-010 confirmed withdrawal, republish and reconciliation map exact existing source transitions", () => {
  const clock = new FixedClock("2026-08-09T02:00:00.000Z");
  const infrastructure = createPublicationInfrastructure(createTestPublicationAuthorizationConfiguration(clock));
  const lifecycleIdentity = { publicationId: "publication-event-operations", tenantScopeId: "team-a" } as const;
  const active = activePublication(lifecycleIdentity.publicationId);
  infrastructure.repository.save(active.snapshot);
  assert.equal(executeModify(infrastructure, lifecycleIdentity, "withdraw-request", {
    type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: 3, attempt: deliveryAttempt("withdraw", "WITHDRAWAL"), command: domain("withdraw-request"),
  }).operationResult, "SUCCEEDED");
  const withdrawalResult = executeModify(infrastructure, lifecycleIdentity, "withdraw-confirm", {
    type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: 4, outcome: "CONFIRMED", evidenceRefs: ["evidence-withdrawn"], command: domain("withdraw-confirm"),
  });
  assert.equal(withdrawalResult.operationResult, "SUCCEEDED", JSON.stringify(withdrawalResult));
  const republishedBinding = { ...publicationBinding, approvalId: "approval-2", approvalVersion: 1 } as const;
  assert.equal(executeModify(infrastructure, lifecycleIdentity, "republish-begin", {
    type: "BEGIN_WITHDRAWN_REPUBLISH", expectedAggregateVersion: 5, nextBinding: republishedBinding, attempt: deliveryAttempt("republish", "REPUBLISH"), command: domain("republish-begin"),
  }).operationResult, "SUCCEEDED");
  assert.equal(executeModify(infrastructure, lifecycleIdentity, "republish-confirm", {
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: 6, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-republished"], externalObjectReference: "external-2", command: domain("republish-confirm"),
  }).operationResult, "SUCCEEDED");
  const lifecycleEvents = infrastructure.eventJournal.listByAggregate("team-a", lifecycleIdentity.publicationId);
  assert.deepEqual(lifecycleEvents.map((item) => item.eventType), ["EVT-007", "EVT-008"]);
  assert.deepEqual(
    lifecycleEvents.map(({ eventType, publicationVersion, targetReference, channelReference }) => ({ eventType, publicationVersion, targetReference, channelReference })),
    [
      { eventType: "EVT-007", publicationVersion: 2, targetReference: "target-1@5", channelReference: "channel-1" },
      { eventType: "EVT-008", publicationVersion: 3, targetReference: "target-1@5", channelReference: "channel-1" },
    ],
  );

  const reconciliationIdentity = { publicationId: "publication-event-reconciliation", tenantScopeId: "team-a" } as const;
  const unknown = createPublication({
    identity: reconciliationIdentity, binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: domain("reconcile-create"),
  }).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: deliveryAttempt("unknown", "INITIAL_PUBLISH"), command: domain("reconcile-begin") })
    .resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "UNKNOWN", evidenceRefs: ["evidence-unknown"], reconciliationCaseId: "case-1", command: domain("unknown") });
  assert.deepEqual(mapAcceptedPublicationTransition(unknown.snapshot, unknown.snapshot, { kind: "MODIFY_PUBLICATION", identity: reconciliationIdentity, input: { type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: 3, caseId: "case-1", resolution: "EFFECT_CONFIRMED", evidenceRefs: ["contradictory-unresolved"], externalObjectReference: "external-3", command: domain("unresolved") } }), []);
  const resolved = unknown.resolveReconciliation({
    type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: 3, caseId: "case-1", resolution: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-resolved"], externalObjectReference: "external-3", command: domain("reconcile"),
  });
  const reconciliationEvents = mapAcceptedPublicationTransition(unknown.snapshot, resolved.snapshot, {
    kind: "MODIFY_PUBLICATION", identity: reconciliationIdentity,
    input: { type: "RESOLVE_RECONCILIATION", expectedAggregateVersion: 3, caseId: "case-1", resolution: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-resolved"], externalObjectReference: "external-3", command: domain("reconcile") },
  });
  assert.deepEqual(reconciliationEvents.map((item) => item.eventType), ["EVT-006", "EVT-003"]);
});

test("F15-TASK-010 authorized replay preserves occurrences, performs no business effects and records EVT-012", () => {
  const clock = new FixedClock("2026-08-09T03:00:00.000Z");
  const infrastructure = createPublicationInfrastructure(createTestPublicationAuthorizationConfiguration(clock));
  const replayIdentity = { publicationId: "publication-event-replay", tenantScopeId: "team-a" } as const;
  const pending = createPublication({
    identity: replayIdentity, binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: domain("replay-create"),
  }).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: deliveryAttempt("replay", "INITIAL_PUBLISH"), command: domain("replay-begin") });
  infrastructure.repository.save(pending.snapshot);
  assert.equal(executeModify(infrastructure, replayIdentity, "replay-activate", {
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-replay"], externalObjectReference: "external-replay", command: domain("replay-activate"),
  }).operationResult, "SUCCEEDED");
  const before = infrastructure.repository.find(replayIdentity)!;
  const originalEvents = infrastructure.eventJournal.listByAggregate("team-a", replayIdentity.publicationId);
  for (const [name, resolver] of [
    ["missing", undefined],
    ["stale", overridingResolver({ sourceVersion: 1 })],
    ["privacy", overridingResolver({ privacyScope: "privacy-scope:wider" })],
    ["purpose", overridingResolver({ purpose: "RECOVERY_VALIDATION" })],
    ["tenant", overridingResolver({ tenantId: "team-b" })],
    ["classification", overridingResolver({ classification: "INTERNAL" })],
  ] as const) {
    let rejectedCalls = 0;
    const rejected = new PublicationEventReplayService({ repository: infrastructure.repository, journal: infrastructure.eventJournal, unitOfWork: infrastructure.unitOfWork, audit: infrastructure.audit, clock, authority: { authorize: () => true }, ...(resolver === undefined ? {} : { sourceContextResolver: resolver }) });
    assert.throws(() => rejected.replay({ ...replayIdentity, actorId: "ops-replay", purpose: "RECOVERY_VALIDATION", correlationId: `correlation-${name}`, commandId: `command-${name}`, replayVersion: 10, occurredAt: clock.now() }, { accept: () => { rejectedCalls += 1; } }));
    assert.equal(rejectedCalls, 0);
  }
  let consumed = 0;
  const service = new PublicationEventReplayService({
    repository: infrastructure.repository, journal: infrastructure.eventJournal, unitOfWork: infrastructure.unitOfWork,
    audit: infrastructure.audit, clock, authority: { authorize: () => true }, sourceContextResolver: infrastructure.eventSourceContextResolver,
  });
  const result = service.replay({ ...replayIdentity, actorId: "ops-replay", purpose: "RECOVERY_VALIDATION", correlationId: "correlation-replay", commandId: "command-replay", replayVersion: 1, occurredAt: clock.now() }, {
    accept(replayed) {
      consumed += 1;
      assert.equal(replayed.eventId, originalEvents[consumed - 1]?.eventId);
      assert.equal(replayed.eventSequence, originalEvents[consumed - 1]?.eventSequence);
      assert.equal(replayed.publicationVersion, originalEvents[consumed - 1]?.publicationVersion);
      assert.equal(replayed.targetReference, originalEvents[consumed - 1]?.targetReference);
      assert.equal(replayed.channelReference, originalEvents[consumed - 1]?.channelReference);
    },
  });
  assert.equal(result.validatedEventCount, 1);
  assert.equal(result.replayed, false);
  assert.equal(result.completionEvent.eventType, "EVT-012");
  assert.equal("publicationVersion" in result.completionEvent, false);
  assert.equal("targetReference" in result.completionEvent, false);
  assert.equal("channelReference" in result.completionEvent, false);
  assert.equal(consumed, 1);
  assert.deepEqual(infrastructure.repository.find(replayIdentity), before);
  assert.deepEqual(infrastructure.eventJournal.listByAggregate("team-a", replayIdentity.publicationId).map((item) => item.eventType), ["EVT-003", "EVT-012"]);
  const replayedResult = service.replay({ ...replayIdentity, actorId: "ops-replay", purpose: "RECOVERY_VALIDATION", correlationId: "correlation-replay", commandId: "command-replay", replayVersion: 1, occurredAt: clock.now() }, { accept: () => { consumed += 1; } });
  assert.equal(replayedResult.replayed, true);
  assert.equal(replayedResult.completionEvent.eventId, result.completionEvent.eventId);
  assert.equal(replayedResult.completionEvent.eventSequence, result.completionEvent.eventSequence);
  assert.equal(consumed, 1);
  assert.equal(infrastructure.eventJournal.listByAggregate("team-a", replayIdentity.publicationId).length, 2);
  let deniedConsumerCalls = 0;
  assert.throws(() => infrastructure.eventReplay.replay({ ...replayIdentity, actorId: "denied", purpose: "RECOVERY_VALIDATION", correlationId: "denied", commandId: "denied", replayVersion: 2, occurredAt: clock.now() }, { accept: () => { deniedConsumerCalls += 1; } }), matches("EVENT_REPLAY_UNAUTHORIZED"));
  assert.equal(deniedConsumerCalls, 0);
  assert.equal(infrastructure.audit.list(replayIdentity).some((record) => record.command === "REPLAY_CANONICAL_EVENTS_STARTED"), true);
  assert.equal(infrastructure.audit.list(replayIdentity).some((record) => record.command === "REPLAY_CANONICAL_EVENTS_FAILED" && record.failureReason === "EVENT_REPLAY_UNAUTHORIZED"), true);
});

test("F15-TASK-010 required Event append failure rolls back Aggregate, Event, success audit and idempotency", () => {
  const clock = new FixedClock("2026-08-09T04:00:00.000Z");
  const backing = new InMemoryPublicationUnitOfWork();
  const atomicIdentity = { publicationId: "publication-event-atomic", tenantScopeId: "team-a" } as const;
  const pending = createPublication({
    identity: atomicIdentity, binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: domain("atomic-create"),
  }).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: deliveryAttempt("atomic", "INITIAL_PUBLISH"), command: domain("atomic-begin") });
  backing.repository.save(pending.snapshot);
  const unitOfWork: PublicationUnitOfWork = {
    begin(identity): PublicationTransaction {
      const transaction = backing.begin(identity);
      return {
        ...transaction,
        eventJournal: {
          append: transaction.eventJournal.append.bind(transaction.eventJournal),
          appendAll(): never { throw new PublicationEventError("EVENT_APPEND_FAILED", "simulated append failure"); },
          findByEventId: transaction.eventJournal.findByEventId.bind(transaction.eventJournal),
          listByAggregate: transaction.eventJournal.listByAggregate.bind(transaction.eventJournal),
          getLastSequence: transaction.eventJournal.getLastSequence.bind(transaction.eventJournal),
        },
      };
    },
  };
  const handler = new ModifyPublicationHandler({
    unitOfWork, repository: backing.repository, idempotency: backing.idempotency, audit: backing.audit,
    clock, authorization: createTestPublicationAuthorizationGuard(clock), eventCoordinator: new PublicationEventCoordinator(clock, sourceContextResolver),
  });
  const execution = { actorId: "forged", sessionId: "executor-independent", correlationId: "correlation-atomic", idempotencyKey: "idempotency-atomic", intentFingerprint: "sha256:atomic" } as const;
  const before = backing.repository.find(atomicIdentity);
  const result = handler.execute({ kind: "MODIFY_PUBLICATION", identity: atomicIdentity, input: {
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-atomic"], externalObjectReference: "external-atomic", command: { ...domain("atomic"), correlationId: execution.correlationId },
  } }, execution);

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "EVENT_APPEND_FAILED");
  assert.deepEqual(backing.repository.find(atomicIdentity), before);
  assert.deepEqual(backing.eventJournal.listByAggregate("team-a", atomicIdentity.publicationId), []);
  assert.equal(backing.audit.list(atomicIdentity).some((record) => record.result === "COMPLETED"), false);
  assert.equal(backing.idempotency.find({ tenantScopeId: "team-a", aggregateId: atomicIdentity.publicationId, commandKey: execution.idempotencyKey }), undefined);
});

test("F15-TASK-010 Runtime and Composition Root register one shared Event Journal and coordinator graph", () => {
  const graph = composePublicationApplication({ runtimeOptions: { infrastructureConfiguration: createTestPublicationAuthorizationConfiguration(new FixedClock("2026-08-09T05:00:00.000Z")) } });
  assert.equal(graph.runtime.services.eventJournal, graph.runtime.services.unitOfWork.eventJournal);
  assert.equal(typeof graph.runtime.services.eventCoordinator.appendAcceptedTransition, "function");
  assert.equal(typeof graph.runtime.services.eventReplay.replay, "function");
  assert.equal(typeof graph.runtime.services.eventGovernanceContextStore.findCurrentByPublicationId, "function");
  assert.equal(typeof graph.runtime.services.eventSourceContextResolver.resolve, "function");
  assert.equal(graph.runtime.context.registeredServices.includes("eventJournal"), true);
  graph.runtime.stop();
  graph.runtime.dispose();
});

test("F15-TASK-010 replay implementation has no command, connector, notification or authority-creation dependency", () => {
  const source = readFileSync(join(process.cwd(), "modules", "publication", "src", "publication-event-replay-service.ts"), "utf8");
  const imports = [...source.matchAll(/from\s+"([^"]+)"/gu)].map((match) => match[1]);
  const forbidden = ["publication-command-handlers", "publication-application-service", "publication-service", "publication-lifecycle-service", "publication-reconciliation-service", "connector", "notification", "approval", "verification", "permission"];
  assert.equal(imports.some((specifier) => forbidden.some((term) => specifier?.toLowerCase().includes(term))), false);
  assert.equal(source.includes(".dispatch("), false);
  assert.equal(source.includes(".execute("), false);
  assert.equal(source.includes(".publish("), false);
});

test("F15-TASK-010R forged Event errors and evidence are sanitized at the Application boundary", () => {
  const forged = new PublicationEventError("SECRET_INTERNAL_CODE" as never, "stack C:\\secret rawEventPayload", {
    eventId: "raw payload",
    eventType: "SECRET",
    eventSequence: -1,
    correlationId: "secret-correlation",
  });
  const mapped = mapPublicationApplicationError(forged);
  assert.equal(forged.code, "INTERNAL_EVENT_JOURNAL_ERROR");
  assert.equal(forged.evidence, undefined);
  const malformedEvidence = new PublicationEventError("EVENT_APPEND_FAILED", "safe", {
    eventId: "evt_safe",
    eventType: "EVT-003",
    eventSequence: 1,
    correlationId: 42,
  } as never);
  assert.equal(malformedEvidence.evidence, undefined);
  assert.deepEqual(mapped, { ok: false, error: { code: "INTERNAL_EVENT_JOURNAL_ERROR", category: "INFRASTRUCTURE", message: "Canonical Event evidence could not be committed." } });
  const serialized = JSON.stringify(mapped);
  assert.equal(serialized.includes("SECRET_INTERNAL_CODE"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("rawEventPayload"), false);
  assert.equal(serialized.includes("PublicationEventError"), false);
});

const publicationBinding = {
  subjectId: "listing-1", subjectRevision: 3, representationId: "representation-1", representationVersion: 2,
  representationChecksum: "sha256:representation-1-v2", approvalId: "approval-1", approvalVersion: 4,
  targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
} as const;

function domain(suffix: string) {
  return { actorId: "executor-independent", authorityContext: "PUBLICATION_EXECUTION", reason: `Approved ${suffix}`, correlationId: `correlation-${suffix}`, occurredAt: "2026-08-09T00:00:00.000Z" } as const;
}

function eventSourceSnapshot(aggregateId: string = source.aggregateId, aggregateVersion: number = source.aggregateVersion) {
  const snapshot = createPublication({
    identity: { publicationId: source.aggregateId, tenantScopeId: source.tenantId },
    binding: publicationBinding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: source.classification,
    command: domain("event-source-create"),
  }).beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION",
    expectedAggregateVersion: 1,
    attempt: deliveryAttempt("event-source", "INITIAL_PUBLISH"),
    command: domain("event-source-begin"),
  }).snapshot;
  return PublicationAggregate.rehydrate({
    ...snapshot,
    publicationId: aggregateId,
    aggregateId,
    aggregateVersion,
  }).snapshot;
}

function eventInputForTechnicalEvent() {
  return {
    source: { ...source, purpose: "RECOVERY_VALIDATION" as const },
    eventType: "EVT-012" as const,
    aggregateId: source.aggregateId,
    aggregateVersion: source.aggregateVersion,
    eventSequence: 1,
    occurredAt: "2026-08-09T00:00:00.000Z",
    recordedAt: "2026-08-09T00:00:01.000Z",
    correlationId: "correlation-replay-complete",
    causationId: "command-replay-complete",
    commandId: "command-replay-complete",
    actorReference: "actor-replay",
    tenantId: source.tenantId,
    classification: source.classification,
    privacyScope: source.privacyScope,
    consentOrLegalBasis: source.consentOrLegalBasis,
    audienceRestriction: source.audienceRestriction,
    governanceSourceVersion: source.governanceSourceVersion,
    purpose: "RECOVERY_VALIDATION" as const,
    payload: { publicationId: source.aggregateId, replayVersion: 1, replayedFromSequence: 1, replayedToSequence: 1, validatedEventCount: 1 },
  };
}

function deliveryAttempt(suffix: string, operation: "INITIAL_PUBLISH" | "REPUBLISH" | "WITHDRAWAL") {
  return { id: `attempt-${suffix}`, commandId: `command-${suffix}`, operation, occurredAt: "2026-08-09T00:00:00.000Z", evidenceRefs: [] } as const;
}

function activePublication(publicationId: string) {
  const ready = createPublication({ identity: { publicationId, tenantScopeId: "team-a" }, binding: publicationBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: domain("active-create") });
  const pending = ready.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: deliveryAttempt("active", "INITIAL_PUBLISH"), command: domain("active-begin") });
  return pending.resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-active"], externalObjectReference: "external-active", command: domain("active-confirm") });
}

function executeModify(infrastructure: ReturnType<typeof createPublicationInfrastructure>, identity: { readonly publicationId: string; readonly tenantScopeId: string }, suffix: string, input: Record<string, unknown>) {
  const result = new ModifyPublicationHandler({
    unitOfWork: infrastructure.unitOfWork,
    repository: infrastructure.repository,
    idempotency: infrastructure.idempotency,
    audit: infrastructure.audit,
    clock: infrastructure.clock,
    authorization: infrastructure.authorization,
    eventCoordinator: infrastructure.eventCoordinator,
  }).execute({ kind: "MODIFY_PUBLICATION", identity, input } as never, {
    actorId: "non-authoritative-compatibility-actor",
    sessionId: "executor-independent",
    correlationId: `correlation-${suffix}`,
    idempotencyKey: `idempotency-${suffix}`,
    intentFingerprint: `sha256:${suffix}`,
  });
  return result.ok
    ? { operationResult: "SUCCEEDED" as const }
    : { operationResult: "FAILED" as const, failureCode: result.error.code };
}

function matches(code: string) {
  return (error: unknown): boolean => error instanceof PublicationEventError && error.code === code;
}

function governanceContext(publicationId: string): PublicationGovernanceContext {
  return {
    governanceContextId: `governance-${publicationId}`,
    publicationId,
    tenantId: "team-a",
    classification: "RESTRICTED_SECURITY",
    privacyScope: "privacy-scope:canonical-publication",
    consentOrLegalBasis: "legal-basis-reference:canonical-publication",
    audienceRestriction: "AUD_PUBLIC",
    purpose: "PUBLICATION_EXECUTION",
    sourceVersion: publicationBinding.representationVersion,
    effectiveFrom: "2026-08-01T00:00:00.000Z",
    effectiveUntil: "2026-09-01T00:00:00.000Z",
    status: "ACTIVE",
  };
}

function storeReturning(record: PublicationGovernanceContext): PublicationGovernanceContextStore {
  return { findCurrentByPublicationId: () => record, findById: () => record };
}

function overridingResolver(override: Partial<ReturnType<PublicationEventSourceContextResolver["resolve"]> extends infer Value ? NonNullable<Value> : never>): PublicationEventSourceContextResolver {
  return { resolve: (request) => ({ ...sourceContextResolver.resolve(request)!, ...override }) };
}
