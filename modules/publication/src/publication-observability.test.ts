import assert from "node:assert/strict";
import test from "node:test";

import type { PublicationClock } from "./publication-clock.js";
import { FixedClock } from "./publication-clock.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { createPublicationRuntimeServiceRegistry } from "./publication-runtime-registry.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { createPublicationEventEnvelope, createPublicationEventProjectionProvenance } from "./publication-event-contracts.js";
import { createPublication } from "./publication-factory.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationBinding } from "./publication-contracts.js";
import { PublicationOperationsError } from "./publication-operations-error.js";
import { PublicationOperationsStatusService } from "./publication-observability.js";
import { InMemoryPublicationOperationalMetrics } from "./in-memory-publication-operations.js";
import type { PublicationOperationalEvidenceStore } from "./publication-operations-contracts.js";
import { ListingProjectionConsumer } from "./listing-projection.js";
import { ListingProjectionError } from "./listing-projection-error.js";
import { PublicationEventCoordinator } from "./publication-event-coordinator.js";
import { InMemoryPublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import {
  classifyOperationalFailure,
} from "./publication-observability.js";
import type { PublicationOperationsObservation } from "./publication-operations-contracts.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import type { PublicationInfrastructureConfigurationInput } from "./publication-infrastructure-configuration.js";
import type { PublicationLiveAuthorizationContext } from "./publication-authorization.js";

const timestamp = "2026-08-10T03:00:00.000Z";
class FixedPublicationClock implements PublicationClock { public constructor(private readonly value: string) {} public now(): string { return this.value; } }

test("F15-TASK-012 classifies technical failures without retrying authority, SoD or integrity failures", () => {
  assert.equal(classifyOperationalFailure("DEPENDENCY_TIMEOUT"), "TRANSIENT");
  assert.equal(classifyOperationalFailure("DEPENDENCY_PERSISTENT_FAILURE"), "PERSISTENT");
  assert.equal(classifyOperationalFailure("PUBLICATION_VERSION_CONFLICT"), "CONFLICT");
  assert.equal(classifyOperationalFailure("AUTHORIZATION_DENIED"), "AUTHORITY_FAILURE");
  assert.equal(classifyOperationalFailure("SEPARATION_OF_DUTIES_DENIED"), "AUTHORITY_FAILURE");
  assert.equal(classifyOperationalFailure("EVENT_INTEGRITY_INVALID"), "INTEGRITY_FAILURE");
  assert.equal(classifyOperationalFailure("PROJECTION_SEQUENCE_GAP"), "DRIFT");
  assert.equal(classifyOperationalFailure("internal stack C:\\secret"), "UNKNOWN");
});

test("F15-TASK-012 exposes immutable health and capability-specific readiness", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedPublicationClock(timestamp) });
  const initial = infrastructure.operationsRead.getSystemOperationalStatus();
  assert.equal(initial.health, "HEALTHY");
  assert.deepEqual(initial.readiness, { operationsRead: true, publicationMutation: true, projectionRead: true });
  assert.throws(() => ((initial.readiness as { publicationMutation: boolean }).publicationMutation = false));

  infrastructure.operationsStatus.observe(failure("EVENT_JOURNAL", "EVENT_JOURNAL_UNAVAILABLE"));
  const degraded = infrastructure.operationsRead.getSystemOperationalStatus();
  assert.equal(degraded.health, "HEALTHY");
  assert.equal(degraded.readiness.publicationMutation, false);
  assert.equal(degraded.readiness.operationsRead, true);
});

test("F15-TASK-012 records bounded append-only evidence and deterministic immutable metrics", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedPublicationClock(timestamp) });
  infrastructure.operationsStatus.observe(failure("EVENT_JOURNAL", "EVENT_INTEGRITY_INVALID"));
  const evidence = infrastructure.operationsEvidence.list({ component: "EVENT_JOURNAL" });
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.safeReasonCode, "OPERATIONS_INTEGRITY_FAILURE");
  assert.equal("payload" in (evidence[0] ?? {}), false);
  assert.equal(JSON.stringify(evidence).includes("secret-value"), false);
  assert.throws(() => ((evidence as unknown as unknown[]).push({})));

  const metrics = infrastructure.operationsMetrics.snapshot();
  assert.equal(metrics.operationsObserved, 1);
  assert.equal(metrics.operationsFailed, 1);
  assert.equal(metrics.journalIntegrityFailures, 1);
  assert.throws(() => ((metrics as { operationsFailed: number }).operationsFailed = 99));
});

test("F15-TASK-012 retry policy is decision-only, bounded, idempotency-aware and live-authority aware", () => {
  let authorityChecks = 0;
  const infrastructure = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryAuthority: {
      revalidate() { authorityChecks += 1; return true; },
    },
    operationsRetryStateResolver: retryStateResolver(),
  });
  const eligible = infrastructure.operationsRetry.decide({
    operationIdentity: "dispatch:attempt-1",
    tenantId: "team-operations",
    failureCode: "DEPENDENCY_TIMEOUT",
    attemptNumber: 1,
    maximumAttempts: 2,
    idempotencySafe: true,
    requiresAuthorityRevalidation: true,
    idempotencyKey: "retry-key-1",
    fingerprint: "sha256:fingerprint-1",
    correlationId: "correlation-retry-1",
    actorOrServiceReference: "service-operations-1",
  });
  assert.equal(eligible.decision, "ELIGIBLE");
  assert.equal(authorityChecks, 1);

  const exhausted = infrastructure.operationsRetry.decide({
    operationIdentity: "dispatch:attempt-2",
    tenantId: "team-operations",
    failureCode: "DEPENDENCY_TIMEOUT",
    attemptNumber: 2,
    maximumAttempts: 2,
    idempotencySafe: true,
    requiresAuthorityRevalidation: false,
    idempotencyKey: "retry-key-2",
    fingerprint: "sha256:fingerprint-2",
    correlationId: "correlation-retry-2",
    actorOrServiceReference: "service-operations-1",
  });
  assert.equal(exhausted.decision, "EXHAUSTED");
  assert.equal(infrastructure.operationsMetrics.snapshot().retryExhausted, 1);

  assert.equal(infrastructure.operationsRetry.decide({
    operationIdentity: "approval-denial",
    tenantId: "team-operations",
    failureCode: "AUTHORIZATION_DENIED",
    attemptNumber: 1,
    maximumAttempts: 2,
    idempotencySafe: true,
    requiresAuthorityRevalidation: false,
    idempotencyKey: "retry-key-3",
    fingerprint: "sha256:fingerprint-3",
    correlationId: "correlation-retry-3",
    actorOrServiceReference: "service-operations-1",
  }).decision, "NOT_ALLOWED");

  assert.equal(infrastructure.operationsRetry.decide(retryRequest({ operationIdentity: "dispatch:completed", idempotencyKey: "retry-completed" })).decision, "ALREADY_COMPLETED");
  assert.equal(infrastructure.operationsRetry.decide(retryRequest({ idempotencySafe: false })).decision, "NOT_ALLOWED");
  infrastructure.operationsRetry.decide(retryRequest({ operationIdentity: "dispatch:conflict", idempotencyKey: "retry-conflict", fingerprint: "sha256:fingerprint-a" }));
  assert.throws(() => infrastructure.operationsRetry.decide(retryRequest({ operationIdentity: "dispatch:conflict", idempotencyKey: "retry-conflict", fingerprint: "sha256:fingerprint-b", attemptNumber: 2 })), operationsErrorCode("OPERATIONS_RECOVERY_CONFLICT"));

  const exhaustedMetrics = infrastructure.operationsMetrics.snapshot().retryExhausted;
  const exhaustedReplay = infrastructure.operationsRetry.decide({ ...retryRequest({ operationIdentity: "dispatch:attempt-2", idempotencyKey: "retry-key-2", attemptNumber: 3, maximumAttempts: 4 }), fingerprint: "sha256:fingerprint-2" });
  assert.equal(exhaustedReplay.decision, "EXHAUSTED");
  assert.equal(infrastructure.operationsMetrics.snapshot().retryExhausted, exhaustedMetrics);
  const exactReplay = infrastructure.operationsRetry.decide({ ...retryRequest({ operationIdentity: "dispatch:attempt-2", idempotencyKey: "retry-key-2", attemptNumber: 3, maximumAttempts: 4 }), fingerprint: "sha256:fingerprint-2" });
  assert.equal(exactReplay.decision, "EXHAUSTED");
  assert.equal(infrastructure.operationsMetrics.snapshot().retryExhausted, exhaustedMetrics);

  const stale = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryAuthority: { revalidate: () => false },
    operationsRetryStateResolver: retryStateResolver(),
  });
  assert.equal(stale.operationsRetry.decide(retryRequest({ requiresAuthorityRevalidation: true })).decision, "STALE_AUTHORITY");
  assert.equal(stale.operationsMetrics.snapshot().retryAttempts, 0);
  assert.equal(infrastructure.operationsRead.getComponentStatus("CONNECTOR_ATTEMPT").retryExhausted, true);

  let authorityIsCurrent = true;
  const live = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryAuthority: { revalidate: () => authorityIsCurrent },
    operationsRetryStateResolver: retryStateResolver(),
  });
  const liveRequest = retryRequest({ idempotencyKey: "retry-live-authority", requiresAuthorityRevalidation: true });
  assert.equal(live.operationsRetry.decide(liveRequest).decision, "ELIGIBLE");
  const liveEvidenceBeforeRevocation = live.operationsEvidence.list({ component: "CONNECTOR_ATTEMPT" }).length;
  authorityIsCurrent = false;
  assert.equal(live.operationsRetry.decide(liveRequest).decision, "STALE_AUTHORITY");
  assert.equal(live.operationsEvidence.list({ component: "CONNECTOR_ATTEMPT" }).length, liveEvidenceBeforeRevocation + 1);
  assert.throws(
    () => live.operationsRetry.decide({ ...liveRequest, failureCode: "AUTHORIZATION_DENIED" }),
    operationsErrorCode("OPERATIONS_RECOVERY_CONFLICT"),
  );

  let externalEffectCompleted = false;
  let subsystemStatus: "HEALTHY" | "FAILED" = "HEALTHY";
  const currentState = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted, subsystemStatus, authorityRevalidationRequired: false }) },
  });
  const completionRequest = retryRequest({ idempotencyKey: "retry-current-completion" });
  assert.equal(currentState.operationsRetry.decide(completionRequest).decision, "ELIGIBLE");
  externalEffectCompleted = true;
  assert.equal(currentState.operationsRetry.decide(completionRequest).decision, "ALREADY_COMPLETED");
  const failureRequest = retryRequest({ operationIdentity: "dispatch:failed-state", idempotencyKey: "retry-current-failure" });
  externalEffectCompleted = false;
  assert.equal(currentState.operationsRetry.decide(failureRequest).decision, "ELIGIBLE");
  subsystemStatus = "FAILED";
  assert.equal(currentState.operationsRetry.decide(failureRequest).decision, "NOT_ALLOWED");
});

test("FCR-002 retry authority requirement is derived from trusted state and ignores caller flags", () => {
  let authorityChecks = 0;
  let receivedAuthorityRequest: unknown;
  const authoritative = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryAuthority: { revalidate: (request) => { authorityChecks += 1; receivedAuthorityRequest = request; return false; } },
    operationsRetryStateResolver: {
      resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "DEGRADED" as const, authorityRevalidationRequired: true, authorizationRequest: retryAuthorizationRequest() }),
    },
  });
  assert.equal(authoritative.operationsRetry.decide(retryRequest({
    idempotencyKey: "retry-server-authoritative",
    requiresAuthorityRevalidation: false,
  })).decision, "STALE_AUTHORITY");
  assert.equal(authorityChecks, 1);
  assert.equal(Object.hasOwn(receivedAuthorityRequest as object, "requiresAuthorityRevalidation"), false);
  assert.equal((receivedAuthorityRequest as { authorizationRequest: { commandType: string } }).authorizationRequest.commandType, "RESOLVE_EXECUTION");

  const technical = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryStateResolver: {
      resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "DEGRADED" as const, authorityRevalidationRequired: false }),
    },
  });
  assert.equal(technical.operationsRetry.decide(retryRequest({
    operationIdentity: "projection:technical-retry",
    idempotencyKey: "retry-server-technical",
    requiresAuthorityRevalidation: true,
  })).decision, "ELIGIBLE");
});

test("FCR-002 production retry adapter blocks stale Session, Approval, Verification, Permission, SoD, binding, policy and version", () => {
  const base = createTestPublicationAuthorizationConfiguration(new FixedPublicationClock(timestamp), "team-operations");
  const allowed = createPublicationInfrastructure({
    ...base,
    operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "DEGRADED" as const, authorityRevalidationRequired: true, authorizationRequest: retryAuthorizationRequest() }) },
  });
  assert.equal(allowed.operationsRetry.decide(retryRequest({ idempotencyKey: "retry-live-complete" })).decision, "ELIGIBLE");

  const staleCases = [
    { name: "expired-session", configuration: { ...base, sessionResolver: { resolve: () => activeSession({ id: "session-operations", principalId: "session-operations", teamId: "team-operations", expiresAt: "2026-08-10T02:00:00.000Z" }) } } },
    { name: "revoked-session", configuration: { ...base, sessionResolver: { resolve: () => activeSession({ id: "session-operations", principalId: "session-operations", teamId: "team-operations", state: "REVOKED" }) } } },
    { name: "contradictory-mfa-session", configuration: { ...base, sessionResolver: { resolve: () => activeSession({ id: "session-operations", principalId: "session-operations", teamId: "team-operations", assurance: "SINGLE_FACTOR", isMfaVerified: true }) } } },
    { name: "approval", configuration: { ...base, liveContextResolver: transformLive(base, (live) => ({ ...live, approval: { ...live.approval, status: "REVOKED" as const } })) } },
    { name: "verification", configuration: { ...base, liveContextResolver: transformLive(base, (live) => ({ ...live, verification: { ...live.verification, status: "EXPIRED" } })) } },
    { name: "permission", configuration: { ...base, liveContextResolver: transformLive(base, (live) => ({ ...live, permission: { ...live.permission, status: "REVOKED" } })) } },
    { name: "sod", configuration: { ...base, liveContextResolver: transformLive(base, (live) => ({ ...live, approval: { ...live.approval, decisionActorId: "session-operations" } })) } },
    { name: "binding", configuration: { ...base, liveContextResolver: transformLive(base, (live) => ({ ...live, target: { ...live.target, channelId: "other-channel" } })) } },
    { name: "policy", configuration: { ...base, liveContextResolver: transformLive(base, (live) => ({ ...live, policyVersion: "stale-policy" })) } },
  ];
  for (const { name, configuration } of staleCases) {
    const infrastructure = createPublicationInfrastructure({
      ...configuration,
      operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "DEGRADED" as const, authorityRevalidationRequired: true, authorizationRequest: retryAuthorizationRequest() }) },
    });
    assert.equal(infrastructure.operationsRetry.decide(retryRequest({ operationIdentity: `dispatch:${name}`, idempotencyKey: `retry-${name}` })).decision, "STALE_AUTHORITY", name);
  }
  const versionConflict = createPublicationInfrastructure({
    ...base,
    operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "DEGRADED" as const, authorityRevalidationRequired: true, authorizationRequest: { ...retryAuthorizationRequest(), currentAggregateVersion: 3 } }) },
  });
  assert.equal(versionConflict.operationsRetry.decide(retryRequest({ operationIdentity: "dispatch:version", idempotencyKey: "retry-version" })).decision, "STALE_AUTHORITY");
});

test("F15-TASK-012 exposes non-authoritative internal ports and registers exact shared Runtime and Composition instances", () => {
  const infrastructure = createPublicationInfrastructure();
  const runtime = createPublicationRuntimeServiceRegistry(infrastructure);
  assert.equal(runtime.operationsRead, infrastructure.operationsRead);
  assert.equal(runtime.operationsEvidence, infrastructure.operationsEvidence);
  assert.equal(runtime.operationsMetrics, infrastructure.operationsMetrics);
  assert.equal(runtime.operationsControl, infrastructure.operationsControl);
  assert.equal(runtime.listingProjectionRebuild, infrastructure.listingProjectionRebuild);
  assert.equal(runtime.eventJournal, infrastructure.eventJournal);
  assert.equal(runtime.serviceNames.includes("operationsControl"), true);

  const exposed = [...Object.getOwnPropertyNames(Object.getPrototypeOf(infrastructure.operationsControl)), ...Object.getOwnPropertyNames(Object.getPrototypeOf(infrastructure.operationsRead)), ...Object.getOwnPropertyNames(Object.getPrototypeOf(infrastructure.operationsRetry))];
  for (const forbidden of ["approve", "verify", "grantPermission", "activate", "withdraw", "republish", "save", "append", "dispatch", "retryAnything", "forceSuccess"]) assert.equal(exposed.includes(forbidden), false);

  const composition = composePublicationApplication();
  assert.equal(composition.runtime.services.operationsRead, composition.runtime.services.operationsStatus);
  assert.equal("rebuildIdentity" in composition.runtime.services.operationsControl, false);
  assert.equal("storeIdentity" in composition.runtime.services.operationsProjectionRead, false);
  assert.equal("evidenceIdentity" in composition.runtime.services.operationsStatus, false);
  assert.equal("metricsIdentity" in composition.runtime.services.operationsStatus, false);
  assert.equal(composition.runtime.services.eventJournal, composition.runtime.services.listingProjectionRebuild.journalIdentity);
});

test("F15-TASK-012 observes PRJ-002 and invokes only the existing authorized rebuild coordinator with a resolved Session actor", () => {
  const session = activeSession();
  let authorityActor = "";
  let rebuildActor = "";
  const infrastructure = createPublicationInfrastructure({
    clock: new FixedClock(timestamp),
    sessionResolver: { resolve: (sessionId) => sessionId === session.id ? session : undefined },
    operationsRebuildAuthority: { authorize: ({ session: resolved, action, purpose }) => { authorityActor = resolved.principalId; return resolved.roles.includes("OPS") && action === "projection.rebuild" && purpose === "PROJECTION_REBUILD"; } },
    listingProjectionRebuildAuthority: { authorize: (request) => { rebuildActor = request.actorOrServiceReference; return true; } },
    eventGovernanceContextStore: {
      findCurrentByPublicationId(publicationId, tenantId, purpose) {
        return Object.freeze({ governanceContextId: `governance:${publicationId}:${purpose}`, publicationId, tenantId, classification: "CONFIDENTIAL_BUSINESS" as const, privacyScope: "privacy:approved-publication", consentOrLegalBasis: "permission:public-publication", audienceRestriction: "PUBLIC_APPROVED", purpose, sourceVersion: 1, effectiveFrom: "2020-01-01T00:00:00.000Z", effectiveUntil: "2099-01-01T00:00:00.000Z", status: "ACTIVE" as const });
      },
      findById: () => undefined,
    },
  });
  const event = activatedEvent();
  infrastructure.eventJournal.append(event);
  infrastructure.listingProjectionConsumer.consume(event.tenantId, event.eventId);
  const before = infrastructure.operationsProjectionRead.getProjectionOperationalStatus({ tenantId: event.tenantId, publicationId: event.aggregateId });
  assert.equal(before.projectionStatus, "ACTIVE");
  assert.equal(before.lastEventSequence, 1);
  const rebuildRequest = {
    sessionId: session.id, tenantId: event.tenantId, publicationId: event.aggregateId,
    generationId: "generation-operations-2", ...(before.servingGeneration === undefined ? {} : { expectedServingGenerationId: before.servingGeneration }),
    reason: "Approved projection recovery", correlationId: "correlation-operations-rebuild",
    idempotencyKey: "operations-rebuild-1", sourceFromSequence: 1,
    actorId: "forged-body-actor",
  };
  const result = infrastructure.operationsControl.requestProjectionRebuild(rebuildRequest);
  assert.equal(result.generationId, "generation-operations-2");
  assert.equal(infrastructure.listingProjectionStore.getServingGeneration({ tenantId: event.tenantId, publicationId: event.aggregateId })?.generationId, "generation-operations-2");
  assert.equal(authorityActor, session.principalId);
  assert.equal(rebuildActor, session.principalId);
  assert.equal(infrastructure.operationsProjectionRead.getProjectionOperationalStatus({ tenantId: event.tenantId, publicationId: event.aggregateId }).lastSuccessfulRebuild, timestamp);
  assert.equal(infrastructure.operationsEvidence.list({ component: "PROJECTION_REBUILD" }).length >= 2, true);
  assert.equal(infrastructure.operationsMetrics.snapshot().projectionRebuildSucceeded >= 1, true);
  const metricsBeforeReplay = infrastructure.operationsMetrics.snapshot();
  const replay = infrastructure.operationsControl.requestProjectionRebuild(rebuildRequest);
  assert.equal(replay.replayed, true);
  assert.deepEqual(infrastructure.operationsMetrics.snapshot(), metricsBeforeReplay);
  assert.equal(infrastructure.operationsRead.getComponentStatus("PROJECTION_REBUILD").status, "HEALTHY");
});

test("F15-TASK-012 rebuild control fails closed for caller identity, missing/inactive Session, MFA and live authority", () => {
  const sessions = new Map<string, SessionContext>([
    ["expired-session", activeSession({ id: "expired-session", state: "EXPIRED" })],
    ["revoked-session", activeSession({ id: "revoked-session", state: "REVOKED" })],
    ["no-mfa-session", activeSession({ id: "no-mfa-session", isMfaVerified: false })],
    ["contradictory-mfa-session", activeSession({ id: "contradictory-mfa-session", assurance: "SINGLE_FACTOR", isMfaVerified: true })],
    ["wrong-team-session", activeSession({ id: "wrong-team-session", teamId: "team-other" })],
    ["sod-session", activeSession({ id: "sod-session", roles: ["OPS", "PUA"] })],
    ["denied-session", activeSession({ id: "denied-session", roles: ["PUA"] })],
  ]);
  let rebuildCalls = 0;
  const infrastructure = createPublicationInfrastructure({
    clock: new FixedClock(timestamp), sessionResolver: { resolve: (id) => sessions.get(id) },
    operationsRebuildAuthority: { authorize: ({ session }) => session.roles.includes("OPS") && !session.roles.includes("PUA") },
    listingProjectionRebuildAuthority: { authorize: () => { rebuildCalls += 1; return true; } },
  });
  for (const sessionId of ["missing-session", "expired-session", "revoked-session"]) {
    assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest(sessionId)), operationsErrorCode("OPERATIONS_UNAUTHORIZED"));
  }
  assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest("no-mfa-session")), operationsErrorCode("OPERATIONS_FORBIDDEN"));
  assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest("contradictory-mfa-session")), operationsErrorCode("OPERATIONS_FORBIDDEN"));
  assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest("wrong-team-session")), operationsErrorCode("OPERATIONS_FORBIDDEN"));
  assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest("sod-session")), operationsErrorCode("OPERATIONS_FORBIDDEN"));
  assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest("denied-session")), operationsErrorCode("OPERATIONS_FORBIDDEN"));
  assert.equal(rebuildCalls, 0);
  assert.equal(infrastructure.listingProjectionStore.getServingGeneration({ tenantId: "team-operations", publicationId: "publication-operations-1" }), undefined);
  assert.equal(infrastructure.eventJournal.listByAggregate("team-operations", "publication-operations-1").length, 0);

  const throwingSession = createPublicationInfrastructure({
    clock: new FixedClock(timestamp),
    sessionResolver: { resolve: () => { throw new Error("session adapter detail"); } },
  });
  assert.throws(() => throwingSession.operationsControl.requestProjectionRebuild(rebuildControlRequest("throwing-session")), operationsErrorCode("OPERATIONS_UNAUTHORIZED"));
  const throwingAuthority = createPublicationInfrastructure({
    clock: new FixedClock(timestamp),
    sessionResolver: { resolve: () => activeSession() },
    operationsRebuildAuthority: { authorize: () => { throw new Error("policy adapter detail"); } },
  });
  assert.throws(() => throwingAuthority.operationsControl.requestProjectionRebuild(rebuildControlRequest("session-operations")), operationsErrorCode("OPERATIONS_FORBIDDEN"));
});

test("F15-TASK-012 bounds retry dependency failures and fails closed", () => {
  const unavailableState = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryStateResolver: { resolve: () => { throw new Error("state adapter detail"); } },
  });
  assert.throws(() => unavailableState.operationsRetry.decide(retryRequest()), operationsErrorCode("OPERATIONS_RETRY_NOT_ALLOWED"));

  const unavailableAuthority = createPublicationInfrastructure({
    clock: new FixedPublicationClock(timestamp),
    operationsRetryStateResolver: retryStateResolver(),
    operationsRetryAuthority: { revalidate: () => { throw new Error("authority adapter detail"); } },
  });
  assert.equal(unavailableAuthority.operationsRetry.decide(retryRequest({ requiresAuthorityRevalidation: true })).decision, "STALE_AUTHORITY");
});

test("F15-TASK-012 exposes Projection drift as stale degradation without changing Publication authority", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedClock(timestamp) });
  const first = activatedEvent();
  infrastructure.eventJournal.append(first);
  infrastructure.listingProjectionConsumer.consume(first.tenantId, first.eventId);
  const gap = suspensionEvent(3);
  const consumer = new ListingProjectionConsumer({
    journal: journalReturning(gap), store: infrastructure.listingProjectionStore,
    audit: infrastructure.listingProjectionAudit, clock: infrastructure.clock, operations: infrastructure.operationsStatus,
  });
  assert.throws(() => consumer.consume(gap.tenantId, gap.eventId), (error) => error instanceof ListingProjectionError && error.code === "PROJECTION_SEQUENCE_GAP");
  const status = infrastructure.operationsProjectionRead.getProjectionOperationalStatus({ tenantId: gap.tenantId, publicationId: gap.aggregateId });
  assert.equal(status.projectionStatus, "STALE");
  assert.equal(status.stale, true);
  assert.equal(status.staleReason, "EVENT_SEQUENCE_GAP");
  assert.equal(infrastructure.operationsRead.getComponentStatus("LISTING_PROJECTION").status, "DEGRADED");
  assert.equal(infrastructure.operationsRead.getSystemOperationalStatus().readiness.projectionRead, false);
  assert.equal(infrastructure.repository.find({ tenantScopeId: gap.tenantId, publicationId: gap.aggregateId }), undefined);
});

test("F15-TASK-012 failed authorized rebuild is bounded, recorded once and never cuts over", () => {
  const session = activeSession();
  const infrastructure = createPublicationInfrastructure({
    clock: new FixedClock(timestamp), sessionResolver: { resolve: () => session },
    operationsRebuildAuthority: { authorize: () => true }, listingProjectionRebuildAuthority: { authorize: () => true },
  });
  assert.throws(() => infrastructure.operationsControl.requestProjectionRebuild(rebuildControlRequest(session.id)), operationsErrorCode("OPERATIONS_PROJECTION_REBUILD_FAILED"));
  assert.equal(infrastructure.listingProjectionStore.getServingGeneration({ tenantId: "team-operations", publicationId: "publication-operations-1" }), undefined);
  assert.equal(infrastructure.operationsMetrics.snapshot().projectionRebuildFailed, 1);
  assert.equal(infrastructure.operationsEvidence.list({ component: "PROJECTION_REBUILD" }).filter(({ result }) => result === "FAILED").length, 1);
});

test("F15-TASK-012 operational state and metrics do not advance when required evidence append fails", () => {
  const failingEvidence: PublicationOperationalEvidenceStore = { append: () => { throw new Error("simulated evidence failure"); }, list: () => [] };
  const metrics = new InMemoryPublicationOperationalMetrics();
  const status = new PublicationOperationsStatusService(failingEvidence, metrics, new FixedClock(timestamp));
  assert.throws(() => status.observe(failure("EVENT_JOURNAL", "EVENT_JOURNAL_UNAVAILABLE")));
  assert.equal(status.getJournalOperationalStatus().status, "HEALTHY");
  assert.equal(status.getJournalOperationalStatus().failureCount, 0);
  assert.equal(metrics.snapshot().operationsObserved, 0);
});

test("F15-TASK-012 operational evidence sanitizes source identity and cannot carry raw payloads or secrets", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedPublicationClock(timestamp) });
  infrastructure.operationsStatus.observe({ component: "API_RUNTIME_HOST", result: "FAILED", failureCode: "DEPENDENCY_TIMEOUT", sourceReference: "connector-secret-value", correlationId: "correlation-safe", actorOrServiceReference: "service-runtime" });
  const serialized = JSON.stringify(infrastructure.operationsEvidence.list());
  assert.equal(serialized.includes("connector-secret-value"), false);
  assert.equal(serialized.includes("payload"), false);
  assert.equal(serialized.includes("stack"), false);
  assert.match(infrastructure.operationsEvidence.list()[0]?.sourceReference ?? "", /^sha256:[a-f0-9]{64}$/);
});

test("F15-TASK-012 observes an injected canonical Journal failure without fabricating Publication success", () => {
  const infrastructure = createPublicationInfrastructure({ clock: new FixedClock(timestamp) });
  const identity = { publicationId: "publication-journal-failure", tenantScopeId: "team-operations" } as const;
  const created = createPublication({ identity, binding: projectionBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: domainCommand("create-journal-failure") });
  const previous = created.beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: 1, attempt: { id: "attempt-journal-failure", commandId: "command-journal-failure", operation: "INITIAL_PUBLISH", occurredAt: timestamp, evidenceRefs: [] }, command: domainCommand("begin-journal-failure") });
  const input = { type: "RESOLVE_EXECUTION", expectedAggregateVersion: 2, outcome: "EFFECT_CONFIRMED", evidenceRefs: ["evidence-journal-failure"], externalObjectReference: "external-journal-failure", command: domainCommand("resolve-journal-failure") } as const;
  const current = previous.resolveExecution(input);
  const audit = new InMemoryPublicationAuditStore();
  const failingJournal: PublicationEventJournal = {
    append: () => { throw new Error("simulated journal unavailable"); },
    appendAll: () => { throw new Error("simulated journal unavailable"); },
    findByEventId: () => undefined,
    listByAggregate: () => [],
    getLastSequence: () => 0,
  };
  const coordinator = new PublicationEventCoordinator(new FixedClock(timestamp), { resolve: (request) => ({ publicationId: request.publicationId, tenantId: request.tenantId, classification: request.classification, privacyScope: "privacy:approved-publication", consentOrLegalBasis: "permission:public-publication", audienceRestriction: "PUBLIC_APPROVED", purpose: request.purpose, sourceVersion: request.sourceVersion }) }, infrastructure.operationsStatus);
  assert.throws(() => coordinator.appendAcceptedTransition({ eventJournal: failingJournal, audit }, previous.snapshot, current.snapshot, { kind: "MODIFY_PUBLICATION", identity, input }));
  assert.equal(audit.list(identity).length, 0);
  assert.equal(infrastructure.repository.find(identity), undefined);
  assert.equal(infrastructure.operationsRead.getJournalOperationalStatus().status, "DEGRADED");
  assert.equal(infrastructure.operationsRead.getSystemOperationalStatus().readiness.publicationMutation, false);
  assert.equal(JSON.stringify(infrastructure.operationsEvidence.list({ component: "EVENT_JOURNAL" })).includes("payload"), false);
});

function failure(component: PublicationOperationsObservation["component"], failureCode: string): PublicationOperationsObservation {
  return {
    component,
    result: "FAILED",
    failureCode,
    sourceReference: "source-safe-1",
    correlationId: "correlation-operations-1",
    actorOrServiceReference: "service-operations-1",
  };
}

function retryRequest(overrides: Partial<Parameters<ReturnType<typeof createPublicationInfrastructure>["operationsRetry"]["decide"]>[0]> = {}) {
  return { tenantId: "team-operations", operationIdentity: "dispatch:retry-default", failureCode: "DEPENDENCY_TIMEOUT", attemptNumber: 1, maximumAttempts: 3, idempotencySafe: true, requiresAuthorityRevalidation: false, idempotencyKey: "retry-default", fingerprint: "sha256:fingerprint-default", correlationId: "correlation-retry-default", actorOrServiceReference: "service-operations-1", ...overrides };
}

function retryStateResolver() {
  return { resolve: ({ operationIdentity }: { readonly operationIdentity: string }) => ({ externalEffectCompleted: operationIdentity === "dispatch:completed", subsystemStatus: "DEGRADED" as const, authorityRevalidationRequired: true, authorizationRequest: retryAuthorizationRequest() }) };
}

function retryAuthorizationRequest() {
  return Object.freeze({
    sessionId: "session-operations",
    commandType: "RESOLVE_EXECUTION" as const,
    actorIdClaim: "caller-ignored",
    tenantId: "team-operations",
    teamId: "team-operations",
    purpose: "PUBLICATION_EXECUTION",
    aggregateId: "publication-operations-1",
    expectedAggregateVersion: 2,
    reason: "Approved retry revalidation",
    correlationId: "correlation-retry-authority",
    binding: projectionBinding,
    currentAggregateVersion: 2,
  });
}

function transformLive(
  base: PublicationInfrastructureConfigurationInput,
  transform: (live: PublicationLiveAuthorizationContext) => PublicationLiveAuthorizationContext,
) {
  return {
    resolve(binding: PublicationBinding, scope: Readonly<{ tenantId: string; teamId?: string }>) {
      const live = base.liveContextResolver?.resolve(binding, scope);
      return live === undefined ? undefined : Object.freeze(transform(live));
    },
  };
}

function operationsErrorCode(code: string): (error: unknown) => boolean { return (error) => error instanceof PublicationOperationsError && error.code === code; }

function activeSession(overrides: Partial<SessionContext> = {}): SessionContext {
  const base: SessionContext = { id: "session-operations", principalId: "operator-session-actor", principalType: "HUMAN", roles: ["OPS"], teamId: "team-operations", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-08-10T00:00:00.000Z", expiresAt: "2026-08-10T04:00:00.000Z", absoluteExpiresAt: "2026-08-11T00:00:00.000Z", familyId: "family-operations", refreshReference: "refresh-operations" };
  return Object.freeze({ ...base, ...overrides });
}

function rebuildControlRequest(sessionId: string) {
  return { sessionId, tenantId: "team-operations", publicationId: "publication-operations-1", generationId: "generation-denied", reason: "Approved recovery reason", correlationId: "correlation-denied", idempotencyKey: "rebuild-denied", sourceFromSequence: 1 };
}

const projectionBinding: PublicationBinding = Object.freeze({ subjectId: "listing-operations", subjectRevision: 1, representationId: "representation-operations", representationVersion: 1, representationChecksum: "checksum-operations", approvalId: "approval-operations", approvalVersion: 1, targetId: "target-operations", targetVersion: 1, channelId: "channel-operations", channelPolicyVersion: "policy-operations" });

function activatedEvent() {
  const base = createPublication({ identity: { publicationId: "publication-operations-1", tenantScopeId: "team-operations" }, binding: projectionBinding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command: { actorId: "publisher-operations", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved publication", correlationId: "correlation-source", occurredAt: timestamp } }).snapshot;
  const snapshot = PublicationAggregate.rehydrate({ ...base, aggregateVersion: 2, publicationVersion: 1, bindingHistory: [...base.bindingHistory, { ...base.bindingHistory[0]!, id: "publication-operations-1:version:1", publicationVersion: 1 }] }).snapshot;
  const source = { tenantId: "team-operations", aggregateId: "publication-operations-1", aggregateVersion: 2, classification: "CONFIDENTIAL_BUSINESS" as const, privacyScope: "privacy:approved-publication", consentOrLegalBasis: "permission:public-publication", audienceRestriction: "PUBLIC_APPROVED", governanceSourceVersion: 1, purpose: "PUBLICATION_EXECUTION" as const };
  return createPublicationEventEnvelope({ source, projectionProvenance: createPublicationEventProjectionProvenance(snapshot), eventType: "EVT-003", aggregateId: source.aggregateId, aggregateVersion: 2, eventSequence: 1, occurredAt: timestamp, recordedAt: timestamp, correlationId: "correlation-event-operations", causationId: "command-event-operations", commandId: "command-event-operations", attemptId: "attempt-event-operations", actorReference: "publisher-operations", tenantId: source.tenantId, classification: source.classification, privacyScope: source.privacyScope, consentOrLegalBasis: source.consentOrLegalBasis, audienceRestriction: source.audienceRestriction, governanceSourceVersion: source.governanceSourceVersion, purpose: source.purpose, payload: { publicationId: source.aggregateId, priorLifecycle: "EXECUTION_PENDING", newLifecycle: "ACTIVE", attemptId: "attempt-event-operations", effectiveVersion: 1, evidenceReferences: ["evidence-operations"] } });
}

function suspensionEvent(sequence: number) {
  const source = { tenantId: "team-operations", aggregateId: "publication-operations-1", aggregateVersion: 3, classification: "CONFIDENTIAL_BUSINESS" as const, privacyScope: "privacy:approved-publication", consentOrLegalBasis: "permission:public-publication", audienceRestriction: "PUBLIC_APPROVED", governanceSourceVersion: 1, purpose: "PUBLICATION_EXECUTION" as const };
  return createPublicationEventEnvelope({ source, eventType: "EVT-004", aggregateId: source.aggregateId, aggregateVersion: 3, eventSequence: sequence, occurredAt: timestamp, recordedAt: timestamp, correlationId: `correlation-gap-${String(sequence)}`, causationId: `command-gap-${String(sequence)}`, commandId: `command-gap-${String(sequence)}`, actorReference: "publisher-operations", tenantId: source.tenantId, classification: source.classification, privacyScope: source.privacyScope, consentOrLegalBasis: source.consentOrLegalBasis, audienceRestriction: source.audienceRestriction, governanceSourceVersion: source.governanceSourceVersion, purpose: source.purpose, payload: { publicationId: source.aggregateId, suspensionStatus: "SUSPENDED_PROVIDER_POLICY", reasonCode: "POLICY_HOLD" } });
}

function journalReturning(event: ReturnType<typeof suspensionEvent>): PublicationEventJournal {
  return { append: () => ({ status: "APPENDED", event }), appendAll: () => [{ status: "APPENDED", event }], findByEventId: () => event, listByAggregate: () => [event], getLastSequence: () => event.eventSequence };
}

function domainCommand(suffix: string) { return { actorId: "publisher-operations", authorityContext: "PUBLICATION_EXECUTION", reason: `Approved ${suffix}`, correlationId: `correlation-${suffix}`, occurredAt: timestamp } as const; }
