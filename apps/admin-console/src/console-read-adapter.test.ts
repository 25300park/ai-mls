import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PublicationApi } from "../../api/src/publication-api.js";
import type { PublicationQueryResponse } from "../../api/src/publication-api-contracts.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import { DurableOperationalEvidenceStore } from "../../../modules/operations/src/durable-operational-evidence-store.js";
import { createTestOperationalReadinessEvidenceAdmission } from "../../../modules/operations/src/operational-readiness-test-support.js";
import { SecurityPrivacyOperationalControlService } from "../../../modules/operations/src/security-privacy-operational-controls.js";
import {
  ConsoleReadAdapter,
  type ConsoleOperationalAlertReadPort,
  type ConsoleOperationalEvidenceStatusReadPort,
  type ConsoleOperationalReadinessReadPort,
  type ConsoleReleaseTraceReadPort,
} from "./console-read-adapter.js";
import { createAdminConsoleServer } from "./console-server.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";

const now = "2026-08-13T00:00:00.000Z";
const publicationId = "publication-console-1";
const tenantId = "team-a";

async function setup(
  alertReadPort?: ConsoleOperationalAlertReadPort,
  readinessReadPort?: ConsoleOperationalReadinessReadPort,
  evidenceStatusReadPort?: ConsoleOperationalEvidenceStatusReadPort,
  releaseTraceReadPort?: ConsoleReleaseTraceReadPort,
) {
  const clock = new FixedClock(now);
  const session = createDevelopmentConsoleSessionAdapter({
    enabled: true,
    runtimeEnvironment: "TEST",
    sessionId: "console-session",
    principalId: "console-operator",
    tenantId,
    now: () => new Date(now),
  });
  let auditSequence = 0;
  const audit = new AuditLog({
    clock: () => new Date(now),
    idFactory: () => `console-auth-audit-${String(++auditSequence)}`,
  });
  const assignments: readonly RoleAssignment[] = Object.freeze([
    assignment("OPS", ["Publication", "PublicationOperations", "ListingProjectionOperationalStatus"]),
    assignment("SEC", ["Publication"]),
  ]);
  const authorization = new AuthorizationService({
    assignments,
    authoritySource: "STATIC_TEST_COMPATIBILITY",
    auditSink: audit,
    clock: () => new Date(now),
    policyVersion: "console-development-policy-v1",
  });
  const infrastructure = createPublicationInfrastructure({
    clock,
    sessionResolver: session,
    authorizationEvaluator: authorization,
    publicationPolicyVersion: "publication-policy-v1",
  });
  await infrastructure.repository.save(PublicationAggregate.create({
    identity: { publicationId, tenantScopeId: tenantId },
    binding: {
      subjectId: "listing-console-1",
      subjectRevision: 3,
      representationId: "representation-console-1",
      representationVersion: 2,
      representationChecksum: "sha256:representation-console-1-v2",
      approvalId: "approval-console-1",
      approvalVersion: 4,
      targetId: "target-console-1",
      targetVersion: 5,
      channelId: "channel-console-1",
      channelPolicyVersion: "channel-policy-console-v1",
    },
    prerequisites: {
      immutableSnapshot: true,
      effectiveApproval: true,
      exactTargetChannel: true,
      provenancePresent: true,
    },
    classification: "CONFIDENTIAL_BUSINESS",
    command: {
      actorId: "console-operator",
      authorityContext: "PUBLICATION_EXECUTION",
      reason: "Deterministic Console read-path fixture",
      correlationId: "console-fixture-correlation",
      occurredAt: now,
    },
  }).snapshot);
  let commandCalls = 0;
  const api = new PublicationApi(infrastructure);
  const queryPort = {
    executeQuery: async (request: unknown) => { await Promise.resolve(); return api.executeQuery(request); },
    executeCommand: (_request: unknown) => {
      commandCalls += 1;
      throw new Error("Console must not execute commands");
    },
  };
  const adapter = new ConsoleReadAdapter({
    queryPort,
    operationsRead: infrastructure.operationsRead,
    projectionRead: infrastructure.operationsProjectionRead,
    sessionResolver: session,
    authorizationEvaluator: authorization,
    clock,
    ...(alertReadPort === undefined ? {} : { alertReadPort }),
    ...(readinessReadPort === undefined ? {} : { readinessReadPort }),
    ...(evidenceStatusReadPort === undefined ? {} : { evidenceStatusReadPort }),
    ...(releaseTraceReadPort === undefined ? {} : { releaseTraceReadPort }),
  });
  return {
    adapter,
    session,
    infrastructure,
    authorization,
    clock,
    get commandCalls() { return commandCalls; },
  };
}

const releaseCandidateId = "1".repeat(64);
const artifactFingerprint = "2".repeat(64);
const candidateFingerprint = "3".repeat(64);
const acceptanceManifestId = "4".repeat(64);
const manifestFingerprint = "5".repeat(64);
const compositionFingerprint = "6".repeat(64);
const sourceCommitSha = "d".repeat(40);
const runtimeGapComponentIds = Object.freeze([
  "ADMIN_CONSOLE",
  "AI_ADVISORY_FEAT_022",
  "AUDIT_API_016",
  "CORE_APIS_FEAT_001_011",
  "JOBS_API_017",
]);

function incompleteReleaseTrace(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    candidate: Object.freeze({
      releaseCandidateId, logicalReleaseId: "REL-001", sourceCommitSha, artifactFingerprint,
      candidateFingerprint, targetEnvironment: "Staging", acceptanceResult: "INCOMPLETE",
      runtimeGapComponentIds,
    }),
    acceptanceManifest: Object.freeze({
      acceptanceManifestId, manifestFingerprint, releaseCandidateId, logicalReleaseId: "REL-001",
      sourceCommitSha, artifactFingerprint, targetEnvironment: "Staging", acceptanceResult: "INCOMPLETE",
      acceptedBy: null, acceptedAt: null, evaluatedAt: now,
      decisionEvidenceRef: "evidence:release:decision:001",
      evidenceRefs: Object.freeze(["evidence:release:verification:001"]),
      readinessRefs: Object.freeze(["readiness:deployment:001"]),
    }),
    evidenceComposition: Object.freeze({
      releaseCandidateId, logicalReleaseId: "REL-001", sourceCommitSha, artifactFingerprint,
      candidateBindingFingerprint: candidateFingerprint, targetEnvironment: "Staging",
      acceptanceResult: "INCOMPLETE", compositionFingerprint, runtimeGapComponentIds,
      evidenceRefs: Object.freeze(["evidence:release:verification:001"]),
      readinessRefs: Object.freeze(["readiness:deployment:001"]),
    }),
    promotionHandoff: Object.freeze({ state: "UNAVAILABLE" }),
    authorityProvenance: Object.freeze({
      acceptedBy: null,
      acceptanceAuthorityEvidenceRefs: Object.freeze([]),
      deploymentSodEvidenceRefs: Object.freeze([]),
    }),
  });
}

function acceptedReleaseTrace(): Readonly<Record<string, unknown>> {
  const base = incompleteReleaseTrace();
  const candidate = base["candidate"] as Readonly<Record<string, unknown>>;
  const manifest = base["acceptanceManifest"] as Readonly<Record<string, unknown>>;
  const composition = base["evidenceComposition"] as Readonly<Record<string, unknown>>;
  const authorityRefs = Object.freeze(["evidence:release:authority:001"]);
  const sodRefs = Object.freeze(["evidence:release:sod:001"]);
  const readinessRefs = Object.freeze(["readiness:deployment:001"]);
  return Object.freeze({
    candidate: Object.freeze({ ...candidate, runtimeGapComponentIds: Object.freeze([]) }),
    acceptanceManifest: Object.freeze({ ...manifest, acceptanceResult: "ACCEPTED", acceptedBy: "release-owner-1", acceptedAt: now }),
    evidenceComposition: Object.freeze({ ...composition, acceptanceResult: "ACCEPTED", runtimeGapComponentIds: Object.freeze([]) }),
    promotionHandoff: Object.freeze({
      state: "AVAILABLE", releaseCandidateId, acceptanceManifestId, manifestFingerprint,
      logicalReleaseId: "REL-001", sourceCommitSha, artifactFingerprint, targetEnvironment: "Staging",
      acceptanceResult: "ACCEPTED", acceptedAt: now, readinessRefs,
      acceptanceActorId: "release-owner-1", acceptanceAuthorityEvidenceRefs: authorityRefs,
      deploymentSodEvidenceRefs: sodRefs, handoffEvidenceFingerprint: "7".repeat(64),
    }),
    authorityProvenance: Object.freeze({ acceptedBy: "release-owner-1", acceptanceAuthorityEvidenceRefs: authorityRefs, deploymentSodEvidenceRefs: sodRefs }),
  });
}

function assignment(role: "OPS" | "SEC", resourceTypes: readonly string[]): RoleAssignment {
  return Object.freeze({
    id: `console-assignment-${role}`,
    principalId: "console-operator",
    role,
    teamIds: Object.freeze([tenantId]),
    resourceTypes: Object.freeze([...resourceTypes]),
    purposes: Object.freeze(["PUBLICATION_EXECUTION"]),
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: "2099-01-01T00:00:00.000Z",
    status: "ACTIVE",
  });
}

function request(page: "DASHBOARD" | "UI-031" | "UI-032" | "UI-033" | "UI-035" | "PROJECTION" | "OPERATIONS") {
  return Object.freeze({
    page,
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    publicationId,
    correlationId: `console-${page.toLowerCase()}`,
  });
}

test("POST-F15-CONSOLE read adapter returns immutable UI-031 data through API-014 without command execution", async () => {
  const setupResult = await setup();
  const result = await setupResult.adapter.read(request("UI-031"));

  assert.equal(result.state, "READY");
  assert.equal(result.page, "UI-031");
  assert.equal(result.data?.["screenId"], "UI-031");
  assert.equal(result.data?.["publicationId"], publicationId);
  assert.equal(setupResult.commandCalls, 0);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.data), true);
});

test("F20-C composes the existing API-014 operations, revalidation, recovery and audit reads without mutation", async () => {
  const setupResult = await setup();
  const operations: string[] = [];
  const adapter = new ConsoleReadAdapter({
    queryPort: {
      async executeQuery(input: unknown) {
        await Promise.resolve();
        const operation = (input as Readonly<Record<string, unknown>>)["operation"] as string;
        operations.push(operation);
        const views: Readonly<Record<string, Readonly<Record<string, unknown>>>> = Object.freeze({
          GET_PUBLICATION_OPERATIONS_VIEW: Object.freeze({
            screenId: "UI-031", publicationId, lifecycle: "RECONCILIATION_REQUIRED",
            suspensionStatus: "NOT_SUSPENDED", aggregateVersion: 9,
            target: Object.freeze({ id: "target-console-1", version: 5 }),
            channel: Object.freeze({ id: "channel-console-1", policyVersion: "channel-policy-console-v1" }),
            currentOperationState: "RECONCILIATION_REQUIRED",
            prerequisiteSummary: Object.freeze({ approval: "APPROVED", verification: "VERIFIED", permission: "ACTIVE", policy: "publication-policy-v1", binding: "MATCHED", mfaReady: true, documentedReasonRequired: true }),
            availableActions: Object.freeze([]), blockedActions: Object.freeze(["RECONCILIATION_REQUIRED"]), stale: false,
          }),
          GET_PUBLICATION_REVALIDATION_VIEW: Object.freeze({
            screenId: "UI-032", publicationId, approvalStatus: "APPROVED", verificationStatus: "VERIFIED",
            permissionStatus: "ACTIVE", policyStatus: "CURRENT", bindingStatus: "MATCHED",
            stale: false, revalidationRequired: false, availableActions: Object.freeze([]),
          }),
          GET_PUBLICATION_RECOVERY_VIEW: Object.freeze({
            screenId: "UI-033", publicationId, lifecycle: "RECONCILIATION_REQUIRED", reconciliationStatus: "OPEN",
            caseId: "reconciliation-case-1", attemptId: "attempt-2", outcomeCategory: "UNKNOWN",
            manualReviewRequired: true, availableActions: Object.freeze([]),
            safeEvidenceSummary: Object.freeze({ referenceCount: 2, restricted: true }),
          }),
          GET_PUBLICATION_AUDIT_VIEW: Object.freeze({
            screenId: "UI-035", historyKind: "PUBLICATION_AUDIT_HISTORY", publicationId, aggregateVersion: 9,
            lifecycleHistory: Object.freeze([]),
            attemptHistory: Object.freeze([
              Object.freeze({ id: "attempt-1", sequence: 1, operation: "PUBLISH", outcome: "CONFIRMED", occurredAt: now }),
              Object.freeze({ id: "attempt-2", sequence: 2, operation: "CORRECT", outcome: "UNKNOWN", occurredAt: now, rawProviderPayload: "Bearer leaked-secret" }),
            ]),
            reconciliationHistory: Object.freeze([]),
            authorizationDecisionSummary: Object.freeze({ allowed: 2, denied: 1 }),
            auditEntries: Object.freeze([Object.freeze({ id: "audit-safe-1", command: "CORRECT_PUBLICATION", timestamp: now, version: 9, result: "FAILED", failureCode: "COMMAND_FAILED" })]),
          }),
        });
        return Object.freeze({
          requestId: "f20-c-read", success: true as const, operation: operation as never,
          result: Object.freeze({ view: views[operation]!, sourceVersion: 9, generatedAt: now, stale: false, provenance: Object.freeze({ source: "CANONICAL_PUBLICATION" as const }) }),
          metadata: Object.freeze({ correlationId: "f20-c-correlation" }),
        }) as unknown as PublicationQueryResponse;
      },
    },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
  });

  const result = await adapter.read(request("UI-031"));

  assert.deepEqual(operations, [
    "GET_PUBLICATION_OPERATIONS_VIEW", "GET_PUBLICATION_REVALIDATION_VIEW",
    "GET_PUBLICATION_RECOVERY_VIEW", "GET_PUBLICATION_AUDIT_VIEW",
  ]);
  assert.equal(result.state, "READY");
  assert.deepEqual(result.data?.["latestAttempt"], {
    id: "attempt-2", sequence: 2, operation: "CORRECT", outcome: "UNKNOWN", occurredAt: now,
  });
  assert.equal(result.data?.["latestNormalizedOutcome"], "UNKNOWN");
  assert.deepEqual(result.data?.["recovery"], {
    reconciliationStatus: "OPEN", caseId: "reconciliation-case-1", attemptId: "attempt-2",
    manualReviewRequired: true, reconciliationFinding: "UNAVAILABLE", recoveryDisposition: "UNAVAILABLE",
  });
  assert.deepEqual(result.data?.["eligibility"], {
    approvalStatus: "APPROVED", verificationStatus: "VERIFIED", permissionStatus: "ACTIVE",
    policyStatus: "CURRENT", bindingStatus: "MATCHED", stale: false, revalidationRequired: false,
  });
  assert.deepEqual(result.data?.["safeEvidence"], {
    referenceCount: 2, auditReferences: ["audit-safe-1"], restricted: true,
  });
  assert.equal(setupResult.commandCalls, 0);
  assert.equal(Object.isFrozen(result.data?.["latestAttempt"]), true);
  assert.equal(JSON.stringify(result).includes("provider"), false);
  assert.equal(JSON.stringify(result).includes("leaked-secret"), false);
});

test("F20-C rejects a mixed-version Publication operations projection without retry or mutation", async () => {
  const setupResult = await setup();
  const api = new PublicationApi(setupResult.infrastructure);
  let queryCalls = 0;
  const adapter = new ConsoleReadAdapter({
    queryPort: {
      async executeQuery(input: unknown): Promise<PublicationQueryResponse> {
        queryCalls += 1;
        const response = await api.executeQuery(input);
        if (!response.success || response.operation !== "GET_PUBLICATION_AUDIT_VIEW") return response;
        return Object.freeze({
          ...response,
          result: Object.freeze({ ...response.result, sourceVersion: response.result.sourceVersion + 1 }),
        });
      },
    },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
  });

  const result = await adapter.read(request("UI-031"));

  assert.equal(result.state, "ERROR");
  assert.equal(result.error?.code, "CONSOLE_READ_UNAVAILABLE");
  assert.equal(queryCalls, 4);
  assert.equal(setupResult.commandCalls, 0);
  assert.equal(JSON.stringify(result).includes(publicationId), false);
});

test("POST-F15-CONSOLE read adapter exposes bounded Dashboard, Projection and Operations status", async () => {
  const { adapter } = await setup();
  const dashboard = await adapter.read(request("DASHBOARD"));
  const projection = await adapter.read(request("PROJECTION"));
  const operations = await adapter.read(request("OPERATIONS"));

  assert.equal(dashboard.state, "READY");
  assert.equal(dashboard.data?.["health"], "HEALTHY");
  assert.equal(dashboard.data?.["publicationCounts"], "NOT_AVAILABLE_IN_CURRENT_BACKEND");
  assert.equal(projection.state, "READY");
  assert.equal(projection.data?.["projectionStatus"], "UNAVAILABLE");
  assert.equal(operations.state, "READY");
  assert.equal((operations.data?.["readiness"] as { operationsRead?: boolean }).operationsRead, true);
  assert.equal(operations.data?.["alerts"], "UNAVAILABLE");
  assert.equal(operations.data?.["operationalReadiness"], "UNAVAILABLE");
});

test("FEAT-023-E Operations Console uses an injected tenant-safe read-only Alert port", async () => {
  let captured: Readonly<Record<string, unknown>> | undefined;
  const { adapter } = await setup({
    readAlerts(input: unknown) {
      captured = input as Readonly<Record<string, unknown>>;
      return Object.freeze([Object.freeze({
        alertId: "alert:001", alertType: "COMPONENT_UNHEALTHY", severity: "HIGH",
        component: "PUBLICATION_RUNTIME", resourceRef: `publication:sha256:${"a".repeat(64)}`,
        currentState: "ACTIVE", safeReasonCode: "COMPONENT_UNHEALTHY",
        evidenceRefs: Object.freeze(["evidence:operational:001"]),
        openedAt: now, lastEvaluatedAt: now, clearedAt: null,
      })]);
    },
  });
  const result = await adapter.read(request("OPERATIONS"));
  const alerts = result.data?.["alerts"] as readonly Readonly<Record<string, unknown>>[];
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.["severity"], "HIGH");
  assert.equal((captured?.["session"] as { principalId?: string }).principalId, "console-operator");
  assert.equal(captured?.["tenantId"], tenantId);
  assert.equal(captured?.["scopeRef"], tenantId);
  assert.equal(Object.hasOwn(alerts[0] ?? {}, "tenantId"), false);
  assert.equal(Object.hasOwn(alerts[0] ?? {}, "scopeRef"), false);
  assert.equal(Object.hasOwn(alerts[0] ?? {}, "acknowledge"), false);
  assert.equal(Object.hasOwn(alerts[0] ?? {}, "retry"), false);
});

test("FEAT-023-F Operations Console exposes only safe fields from its injected readiness read port", async () => {
  let captured: Readonly<Record<string, unknown>> | undefined;
  const { adapter } = await setup(undefined, {
    readReadiness(input: unknown) {
      captured = input as Readonly<Record<string, unknown>>;
      return Object.freeze([Object.freeze({
        readinessProjectionId: "readiness-projection:backup-001", readinessType: "BACKUP",
        binding: Object.freeze({ subjectRef: `backup-readiness:sha256:${"d".repeat(64)}`, tenantId, scopeRef: tenantId,
          candidateRef: null, environmentRef: null, protectedSetRef: `protected-set:sha256:${"e".repeat(64)}`, rollbackTargetRef: null }),
        readiness: "UNKNOWN", freshness: "UNKNOWN", safeReasonCodes: Object.freeze(["MISSING_BACKUP_EXECUTION"]),
        evidenceIds: Object.freeze(["readiness-evidence:backup-config-001"]),
        evidenceRefs: Object.freeze(["evidence:backup-config-001"]), evaluatedAt: now,
      })]);
    },
  });
  const result = await adapter.read(request("OPERATIONS"));
  const readiness = result.data?.["operationalReadiness"] as readonly Readonly<Record<string, unknown>>[];
  assert.equal(readiness[0]?.["readinessType"], "BACKUP");
  assert.equal(readiness[0]?.["readiness"], "UNKNOWN");
  assert.equal((captured?.["session"] as { principalId?: string }).principalId, "console-operator");
  assert.equal(Object.hasOwn(readiness[0] ?? {}, "tenantId"), false);
  assert.equal(Object.hasOwn(readiness[0] ?? {}, "scopeRef"), false);
  assert.equal(Object.hasOwn(readiness[0] ?? {}, "evidenceIds"), false);
  assert.equal(Object.hasOwn(readiness[0] ?? {}, "deploy"), false);
  assert.equal(Object.hasOwn(readiness[0] ?? {}, "rollback"), false);
});

test("FEAT-023-G Operations Console exposes safe immutable telemetry status and security summary DTOs through one injected port", async () => {
  const safeEvidenceRef = `evidence:operational:e1${"e".repeat(14)}`;
  let telemetryInput: Readonly<Record<string, unknown>> | undefined;
  let statusInput: Readonly<Record<string, unknown>> | undefined;
  const port: ConsoleOperationalEvidenceStatusReadPort = {
    readTelemetry(input: unknown) {
      telemetryInput = input as Readonly<Record<string, unknown>>;
      return Object.freeze([Object.freeze({
        telemetryEventId: "telemetry:console-status-001", eventType: "SECURITY_CONTROL_OBSERVED", component: "SECURITY",
        operation: "SECURITY_MONITORING", resourceType: "SECURITY_EVENT", resourceRef: `security-event:sha256:${"c".repeat(64)}`,
        outcome: "OBSERVED", safeErrorCode: null, correlationId: "correlation:console-status-001",
        evidenceRefs: Object.freeze([safeEvidenceRef]), occurredAt: now,
      })]);
    },
    readStatuses(input: unknown) {
      statusInput = input as Readonly<Record<string, unknown>>;
      return Object.freeze([Object.freeze({
        statusSnapshotId: "status-snapshot:console-status-001", telemetryEventId: "telemetry:console-status-001",
        component: "SECURITY", resourceType: "SECURITY_EVENT", resourceRef: `security-event:sha256:${"c".repeat(64)}`,
        health: "UNKNOWN", readiness: "UNKNOWN", freshness: "UNKNOWN", evidenceOccurredAt: now, evaluatedAt: now,
        freshnessThresholdMs: null,
      })]);
    },
  };
  const result = await (await setup(undefined, undefined, port)).adapter.read(request("OPERATIONS"));
  const telemetry = result.data?.["telemetry"] as readonly Readonly<Record<string, unknown>>[];
  const statuses = result.data?.["operationalStatuses"] as readonly Readonly<Record<string, unknown>>[];
  const summary = result.data?.["securityPrivacySummary"] as Readonly<Record<string, unknown>>;

  assert.equal(telemetry.length, 1);
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0]?.["health"], "UNKNOWN");
  assert.equal(statuses[0]?.["readiness"], "UNKNOWN");
  assert.equal(statuses[0]?.["freshness"], "UNKNOWN");
  assert.deepEqual(summary, { telemetryCount: 1, statusCount: 1, evidenceRefs: [safeEvidenceRef] });
  assert.equal((telemetryInput?.["session"] as { principalId?: string }).principalId, "console-operator");
  assert.equal(telemetryInput?.["tenantId"], tenantId);
  assert.equal(statusInput?.["scopeRef"], tenantId);
  assert.equal(Object.hasOwn(telemetry[0] ?? {}, "tenantId"), false);
  assert.equal(Object.hasOwn(statuses[0] ?? {}, "scopeRef"), false);
  assert.equal(Object.hasOwn(summary, "retry"), false);
  assert.equal(Object.isFrozen(telemetry), true);
  assert.equal(Object.isFrozen(statuses), true);
  assert.equal(Object.isFrozen(summary), true);
});

test("FEAT-023-G missing or unsafe operational evidence status port fails closed without leaking details", async () => {
  const unavailable = await (await setup()).adapter.read(request("OPERATIONS"));
  assert.equal(unavailable.data?.["telemetry"], "UNAVAILABLE");
  assert.equal(unavailable.data?.["operationalStatuses"], "UNAVAILABLE");
  assert.equal(unavailable.data?.["securityPrivacySummary"], "UNAVAILABLE");

  const unsafePort: ConsoleOperationalEvidenceStatusReadPort = {
    readTelemetry() {
      return [{ telemetryEventId: "telemetry:unsafe", stack: "C:\\secret\\runtime.ts:42", token: "Bearer unsafe" }];
    },
    readStatuses() { throw new Error("C:\\secret\\database.sqlite"); },
  };
  const result = await (await setup(undefined, undefined, unsafePort)).adapter.read(request("OPERATIONS"));
  assert.equal(result.data?.["telemetry"], "UNAVAILABLE");
  assert.equal(result.data?.["operationalStatuses"], "UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(JSON.stringify(result).includes("Bearer"), false);
});

test("FEAT-023-E composed Console path reads durable Alerts through the live-authorized operational service", async () => {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-e-console-"));
  const store = new DurableOperationalEvidenceStore({ databasePath: join(directory, "operations.sqlite") }, createTestOperationalReadinessEvidenceAdmission());
  try {
    store.appendScoped({
      telemetryEventId: "telemetry:console-alert-001", eventType: "SECURITY_ALERT_OBSERVED", component: "SECURITY",
      operation: "SECURITY_MONITORING", resourceType: "SECURITY_EVENT", resourceRef: `security-event:sha256:${"c".repeat(64)}`,
      outcome: "FAILED", safeErrorCode: "COMPONENT_UNHEALTHY", correlationId: "correlation:console-alert-001",
      evidenceRefs: ["evidence:security:console-alert-001"], occurredAt: now,
    }, { tenantId, scopeRef: tenantId });
    store.projectStatus({ statusSnapshotId: "status-snapshot:console-alert-001", telemetryEventId: "telemetry:console-alert-001",
      health: "UNHEALTHY", readiness: "READY", evaluatedAt: now, freshnessThresholdMs: null });
    const alertAuthorization = new AuthorizationService({
      assignments: [{ ...assignment("SEC", ["OPERATIONAL_EVIDENCE"]), purposes: Object.freeze(["SECURITY_MONITORING"]) }],
      authoritySource: "STATIC_TEST_COMPATIBILITY",
      auditSink: new AuditLog({ clock: () => new Date(now), idFactory: () => "console-alert-auth-audit" }),
      clock: () => new Date(now), policyVersion: "console-alert-policy-v1",
    });
    const service = new SecurityPrivacyOperationalControlService({ authorizationService: alertAuthorization, evidenceStore: store });
    const result = await (await setup(service)).adapter.read(Object.freeze({
      ...request("OPERATIONS"),
      correlationId: "correlation:console-alert-read-001",
    }));
    assert.equal((result.data?.["alerts"] as readonly unknown[]).length, 1);
    assert.equal(JSON.stringify(result).includes("tenantId"), false);
    assert.equal(JSON.stringify(result).includes("scopeRef"), false);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FEAT-023-F composed Console path reads durable readiness through the live-authorized operational service", async () => {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-f-console-"));
  const store = new DurableOperationalEvidenceStore({ databasePath: join(directory, "operations.sqlite") }, createTestOperationalReadinessEvidenceAdmission());
  try {
    const binding = { subjectRef: `backup-readiness:sha256:${"f".repeat(64)}`, tenantId, scopeRef: tenantId,
      candidateRef: null, environmentRef: null, protectedSetRef: `protected-set:sha256:${"e".repeat(64)}`, rollbackTargetRef: null } as const;
    const types = ["BACKUP_CONFIGURATION", "BACKUP_EXECUTION", "BACKUP_INTEGRITY", "RESTORE_VALIDATION"] as const;
    types.forEach((evidenceType, index) => store.appendReadinessEvidence({
      evidenceId: `readiness-evidence:console-backup-${String(index + 1)}`, readinessType: "BACKUP", evidenceType,
      sourceClassification: evidenceType === "RESTORE_VALIDATION" ? "RECOVERY_VALIDATOR" : "BACKUP_SYSTEM",
      binding, outcome: "SATISFIED", occurredAt: now, freshnessThresholdMs: null,
      evidenceRefs: [`evidence:console-backup-${String(index + 1)}`],
    }));
    store.projectReadiness({ readinessProjectionId: "readiness-projection:console-backup-001", readinessType: "BACKUP", binding,
      evidenceIds: types.map((_, index) => `readiness-evidence:console-backup-${String(index + 1)}`), evaluatedAt: now });
    const readinessAuthorization = new AuthorizationService({
      assignments: [{ ...assignment("SEC", ["OPERATIONAL_EVIDENCE"]), purposes: Object.freeze(["SECURITY_MONITORING"]) }],
      authoritySource: "STATIC_TEST_COMPATIBILITY",
      auditSink: new AuditLog({ clock: () => new Date(now), idFactory: () => "console-readiness-auth-audit" }),
      clock: () => new Date(now), policyVersion: "console-readiness-policy-v1",
    });
    const service = new SecurityPrivacyOperationalControlService({ authorizationService: readinessAuthorization, evidenceStore: store });
    const setupResult = await setup(undefined, service);
    const result = await setupResult.adapter.read(Object.freeze({ ...request("OPERATIONS"), correlationId: "correlation:console-readiness-read-001" }));
    const projections = result.data?.["operationalReadiness"] as readonly Readonly<Record<string, unknown>>[];
    assert.equal(projections.length, 1);
    assert.equal(projections[0]?.["readiness"], "READY");
    assert.equal(JSON.stringify(projections).includes("tenantId"), false);
    assert.equal(JSON.stringify(projections).includes("scopeRef"), false);
    assert.equal(setupResult.commandCalls, 0);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FEAT-023-G composed HTTP Console path reads durable scoped telemetry and status through the injected security privacy boundary", async () => {
  const directory = mkdtempSync(join(tmpdir(), "feat-023-g-console-"));
  const store = new DurableOperationalEvidenceStore({ databasePath: join(directory, "operations.sqlite") }, createTestOperationalReadinessEvidenceAdmission());
  try {
    const resourceRef = `security-event:sha256:${"c".repeat(64)}`;
    store.appendScoped({
      telemetryEventId: "telemetry:console-status-composed-001", eventType: "SECURITY_CONTROL_OBSERVED", component: "SECURITY",
      operation: "SECURITY_MONITORING", resourceType: "SECURITY_EVENT", resourceRef, outcome: "OBSERVED", safeErrorCode: null,
      correlationId: "correlation:console-status-composed-001", evidenceRefs: ["evidence:security:console-status-composed-001"], occurredAt: now,
    }, { tenantId, scopeRef: tenantId });
    store.projectStatus({
      statusSnapshotId: "status-snapshot:console-status-composed-001", telemetryEventId: "telemetry:console-status-composed-001",
      health: "UNKNOWN", readiness: "NOT_READY", evaluatedAt: now, freshnessThresholdMs: null,
    });
    const service = new SecurityPrivacyOperationalControlService({
      authorizationService: new AuthorizationService({
        assignments: [{ ...assignment("SEC", ["OPERATIONAL_EVIDENCE"]), purposes: Object.freeze(["SECURITY_MONITORING"]) }],
        authoritySource: "STATIC_TEST_COMPATIBILITY",
        auditSink: new AuditLog({ clock: () => new Date(now), idFactory: () => "console-status-auth-audit" }),
        clock: () => new Date(now), policyVersion: "console-status-policy-v1",
      }),
      evidenceStore: store,
    });
    const setupResult = await setup(undefined, undefined, service);
    const result = await setupResult.adapter.read(Object.freeze({ ...request("OPERATIONS"), correlationId: "correlation:console-status-read-001" }));
    const telemetry = result.data?.["telemetry"] as readonly Readonly<Record<string, unknown>>[];
    const statuses = result.data?.["operationalStatuses"] as readonly Readonly<Record<string, unknown>>[];

    assert.equal(telemetry.length, 1);
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0]?.["health"], "UNKNOWN");
    assert.equal(statuses[0]?.["readiness"], "NOT_READY");
    assert.equal(statuses[0]?.["freshness"], "UNKNOWN");
    assert.equal(JSON.stringify(result).includes("tenantId"), false);
    assert.equal(JSON.stringify(result).includes("scopeRef"), false);
    assert.equal(setupResult.commandCalls, 0);

    const server = createAdminConsoleServer({
      host: "127.0.0.1",
      port: 0,
      sessionId: "console-session",
      tenantId,
      readAdapter: setupResult.adapter,
    });
    await server.start();
    try {
      const response = await fetch(`${server.localUrl}/api/console/view?page=OPERATIONS`);
      const payload = await response.json() as Readonly<{ html?: string }>;
      assert.equal(response.status, 200);
      assert.equal(payload.html?.includes("Operational Telemetry"), true);
      assert.equal(payload.html?.includes("Health / Readiness / Freshness"), true);
      assert.equal(payload.html?.includes("UNKNOWN"), true);
      assert.equal(payload.html?.includes("NOT_READY"), true);
      assert.equal(payload.html?.includes("tenantId"), false);
      assert.equal(payload.html?.includes("scopeRef"), false);
      assert.equal(payload.html?.includes("button"), false);
      assert.equal(setupResult.commandCalls, 0);
    } finally {
      await server.stop();
    }
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("POST-F15-CONSOLE every Console DTO is deeply immutable and no command capability is exposed", async () => {
  const setupResult = await setup();
  for (const page of ["UI-032", "UI-033", "UI-035", "PROJECTION", "OPERATIONS"] as const) {
    const result = await setupResult.adapter.read(request(page));
    assert.equal(Object.isFrozen(result), true, page);
    assert.equal(Object.isFrozen(result.data), true, page);
    for (const value of Object.values(result.data ?? {})) {
      if (typeof value === "object" && value !== null) assert.equal(Object.isFrozen(value), true, page);
    }
  }
  assert.equal("executeCommand" in setupResult.adapter, false);
  assert.equal("rebuild" in setupResult.adapter, false);
  assert.equal("retry" in setupResult.adapter, false);
  assert.equal(setupResult.commandCalls, 0);
});

test("POST-F15-CONSOLE unavailable backend failures return only the bounded safe error", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("C:\\restricted\\backend secret-token"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
  });

  const result = await adapter.read(request("UI-031"));
  const serialized = JSON.stringify(result);
  assert.equal(result.state, "ERROR");
  assert.equal(result.error?.code, "CONSOLE_READ_UNAVAILABLE");
  assert.equal(serialized.includes("restricted"), false);
  assert.equal(serialized.includes("secret-token"), false);
});

test("POST-F15-CONSOLE missing and unauthorized Publication reads conceal protected data", async () => {
  const { adapter } = await setup();
  const withPublication = request("UI-032");
  const withoutPublication = {
    page: withPublication.page,
    sessionId: withPublication.sessionId,
    tenantId: withPublication.tenantId,
    teamId: withPublication.teamId,
    correlationId: withPublication.correlationId,
  };
  const missing = await adapter.read(withoutPublication);
  const wrongTenant = await adapter.read({ ...request("UI-031"), tenantId: "team-b", teamId: "team-b" });

  assert.equal(missing.state, "EMPTY");
  assert.equal(wrongTenant.state, "EMPTY");
  assert.equal(JSON.stringify(wrongTenant).includes(publicationId), false);
  assert.equal(JSON.stringify(wrongTenant).includes("console-operator"), false);
});

test("F20-B projects API-018 batch status through the read boundary without raw provider data", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    connectorQueryPort: {
      execute(kind: string, input: unknown) {
        const query = input as Readonly<Record<string, unknown>>;
        if (kind !== "QUERY" || query["operation"] !== "ReadBatchStatus" || query["sessionId"] !== "console-session") {
          throw new Error("wrong API-018 query");
        }
        return Object.freeze({
          ok: true as const,
          operation: "ReadBatchStatus" as const,
          data: Object.freeze({
            batchId: "batch-1",
            invocationId: "invocation-1",
            technicalStatus: "SUCCEEDED",
            normalizedOutcome: "CONFIRMED",
            currentVersion: 2,
            evidenceRef: "evidence:batch:1",
            updatedAt: now,
            rawProviderPayload: "secret-provider-response",
          }),
        });
      },
    },
  });

  const result = await adapter.read({
    page: "CONNECTOR",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    connectorId: "connector-1",
    sourceId: "source-1",
    batchId: "batch-1",
    correlationId: "console-connector-batch",
  });

  assert.deepEqual(result, {
    page: "CONNECTOR",
    state: "READY",
    data: {
      connectorId: "connector-1",
      sourceId: "source-1",
      batchId: "batch-1",
      invocationId: "invocation-1",
      technicalStatus: "SUCCEEDED",
      normalizedOutcome: "CONFIRMED",
      currentVersion: 2,
      evidenceRef: "evidence:batch:1",
      updatedAt: now,
    },
  });
  assert.equal(JSON.stringify(result).includes("secret-provider-response"), false);
  assert.equal(Object.isFrozen(result.data), true);
});

test("F20-B projects API-019 exact mapping through the read boundary without raw provider data", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    externalIntegrationQueryPort: {
      execute(kind: string, input: unknown, sessionId: string) {
        const query = input as Readonly<Record<string, unknown>>;
        if (kind !== "HTTP_QUERY" || query["operation"] !== "ReadExternalMapping" || query["mappingId"] !== "mapping-1" || sessionId !== "console-session") {
          throw new Error("wrong API-019 query");
        }
        return Object.freeze({
          ok: true as const,
          operation: "ReadExternalMapping" as const,
          data: Object.freeze({
            mappingId: "mapping-1",
            providerNamespace: "provider-safe",
            externalObjectId: "external-1",
            internalResourceType: "Publication",
            internalResourceId: publicationId,
            state: "ACTIVE",
            version: 3,
            evidenceRef: "evidence:mapping:1",
            createdAt: now,
            updatedAt: now,
            rawProviderPayload: "secret-provider-response",
          }),
        });
      },
    },
  });

  const result = await adapter.read({
    page: "EXTERNAL_INTEGRATION",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    mappingId: "mapping-1",
    correlationId: "console-external-mapping",
  });

  assert.deepEqual(result, {
    page: "EXTERNAL_INTEGRATION",
    state: "READY",
    data: {
      mappingId: "mapping-1",
      providerNamespace: "provider-safe",
      externalObjectId: "external-1",
      internalResourceType: "Publication",
      internalResourceId: publicationId,
      state: "ACTIVE",
      version: 3,
      evidenceRef: "evidence:mapping:1",
      createdAt: now,
      updatedAt: now,
    },
  });
  assert.equal(JSON.stringify(result).includes("secret-provider-response"), false);
});

test("F20-B projects API-019 exact Integration Contract through the closed query branch", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    externalIntegrationQueryPort: {
      execute(kind: string, input: unknown, sessionId: string) {
        const query = input as Readonly<Record<string, unknown>>;
        if (kind !== "HTTP_QUERY" || query["operation"] !== "ReadIntegrationContract" || query["integrationContractId"] !== "contract-1" || sessionId !== "console-session") {
          throw new Error("wrong API-019 contract query");
        }
        return Object.freeze({
          ok: true as const,
          operation: "ReadIntegrationContract" as const,
          data: Object.freeze({
            integrationContractId: "contract-1",
            technicalStatus: "SUSPENDED",
            providerNamespace: "provider-safe",
            connectorId: "connector-1",
            sourceId: "source-1",
            version: 4,
            evidenceRef: "evidence:contract:1",
            createdAt: now,
            updatedAt: now,
            rawProviderPayload: "secret-provider-response",
          }),
        });
      },
    },
  });

  const result = await adapter.read({
    page: "EXTERNAL_INTEGRATION",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    integrationContractId: "contract-1",
    correlationId: "console-integration-contract",
  });

  assert.deepEqual(result, {
    page: "EXTERNAL_INTEGRATION",
    state: "READY",
    data: {
      integrationContractId: "contract-1",
      technicalStatus: "SUSPENDED",
      providerNamespace: "provider-safe",
      connectorId: "connector-1",
      sourceId: "source-1",
      version: 4,
      evidenceRef: "evidence:contract:1",
      createdAt: now,
      updatedAt: now,
    },
  });
  assert.equal(JSON.stringify(result).includes("secret-provider-response"), false);
});

test("F20-B projects F19 exact recovery case with finding and disposition kept separate", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    recoveryQueryPort: {
      execute(kind: string, input: unknown, sessionId: string) {
        const query = input as Readonly<Record<string, unknown>>;
        if (kind !== "QUERY" || query["operation"] !== "READ_RECOVERY_CASE" || query["recoveryCaseId"] !== "recovery-case-1" || sessionId !== "console-session") {
          throw new Error("wrong F19 query");
        }
        return Object.freeze({
          ok: true as const,
          operation: "READ_RECOVERY_CASE" as const,
          data: Object.freeze({
            recoveryCaseId: "recovery-case-1",
            resourceType: "Publication",
            resourceId: publicationId,
            originDomain: "CONNECTOR",
            originIdentity: Object.freeze({ invocationId: "invocation-1", mappingId: "cross-domain-mapping", authorization: "Bearer test-sensitive-value" }),
            parentRecoveryCaseId: "recovery-parent-secret",
            status: "RESOLVED",
            finding: "CONFIRMED_NOT_EXECUTED",
            recoveryId: "recovery-1",
            recoveryDisposition: "RECOVERY_AUTHORIZED",
            recoveryExecutionIdentity: Object.freeze({ invocationId: "invocation-secret" }),
            evidenceRefs: Object.freeze(["evidence:recovery:1"]),
            version: 3,
            createdAt: now,
            resolvedAt: now,
            rawEvidence: "secret-provider-response",
          }),
        });
      },
    },
  });

  const result = await adapter.read({
    page: "RECOVERY_CASE",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    recoveryCaseId: "recovery-case-1",
    correlationId: "console-recovery-case",
  });

  assert.deepEqual(result, {
    page: "RECOVERY_CASE",
    state: "READY",
    data: {
      recoveryCaseId: "recovery-case-1",
      originDomain: "CONNECTOR",
      originIdentity: { invocationId: "invocation-1" },
      status: "RESOLVED",
      finding: "CONFIRMED_NOT_EXECUTED",
      recoveryId: "recovery-1",
      evidenceRefs: ["evidence:recovery:1"],
      version: 3,
      createdAt: now,
      resolvedAt: now,
    },
  });
  assert.equal(Object.hasOwn(result.data ?? {}, "finding"), true);
  assert.equal(Object.hasOwn(result.data ?? {}, "recoveryId"), true);
  assert.equal(Object.hasOwn(result.data ?? {}, "recoveryDisposition"), false);
  assert.equal(Object.hasOwn(result.data ?? {}, "recoveryExecutionIdentity"), false);
  assert.equal(Object.hasOwn(result.data ?? {}, "resourceType"), false);
  assert.equal(Object.hasOwn(result.data ?? {}, "parentRecoveryCaseId"), false);
  assert.equal(JSON.stringify(result).includes("secret-provider-response"), false);
  assert.equal(JSON.stringify(result).includes("test-sensitive-value"), false);
  assert.equal(JSON.stringify(result).includes("cross-domain-mapping"), false);
});

test("F20-B projects API-016 audit events without details or internal evidence", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    auditQueryPort: {
      queryAudit(input: unknown) {
        const query = input as { context?: { sessionId?: string }; purpose?: string };
        if (query.context?.sessionId !== "console-session" || query.purpose !== "OPERATIONS_AUDIT") {
          throw new Error("wrong API-016 query");
        }
        return Object.freeze({
          ok: true as const,
          data: Object.freeze([Object.freeze({
            id: "audit-1",
            eventType: "RECOVERY_CASE_RESOLVED",
            principal: Object.freeze({ id: "operator-1", type: "HUMAN" }),
            action: "recovery.resolve",
            target: Object.freeze({ type: "RecoveryCase", id: "recovery-case-1" }),
            purpose: "OPERATIONS_AUDIT",
            decision: "ALLOW",
            outcome: "COMPLETED",
            correlationId: "correlation-1",
            occurredAt: now,
            evidenceRefs: Object.freeze(["evidence:recovery:1"]),
            details: Object.freeze({ rawProviderPayload: "secret-provider-response" }),
          })]),
          meta: Object.freeze({ correlationId: "console-audit-evidence" }),
        });
      },
    },
  });

  const result = await adapter.read({
    page: "EVIDENCE",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    auditTargetId: "recovery-case-1",
    correlationId: "console-audit-evidence",
  });

  assert.deepEqual(result, {
    page: "EVIDENCE",
    state: "READY",
    data: {
      events: [{
        eventId: "audit-1",
        eventType: "RECOVERY_CASE_RESOLVED",
        actorId: "operator-1",
        actorType: "HUMAN",
        action: "recovery.resolve",
        resourceType: "RecoveryCase",
        resourceId: "recovery-case-1",
        decision: "ALLOW",
        outcome: "COMPLETED",
        correlationId: "correlation-1",
        occurredAt: now,
        evidenceRefs: ["evidence:recovery:1"],
      }],
    },
  });
  assert.equal(JSON.stringify(result).includes("secret-provider-response"), false);
  assert.equal(Object.isFrozen((result.data?.events as readonly unknown[])[0]), true);
});

test("F20-B fails safely when an approved read port returns secret-like evidence", async () => {
  const setupResult = await setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    connectorQueryPort: {
      execute: () => Object.freeze({
        ok: true as const,
        operation: "ReadBatchStatus" as const,
        data: Object.freeze({
          batchId: "batch-unsafe",
          technicalStatus: "SUCCEEDED",
          evidenceRef: "Authorization: Bearer top-secret",
          updatedAt: now,
        }),
      }),
    },
  });

  const result = await adapter.read({
    page: "CONNECTOR",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    connectorId: "connector-1",
    sourceId: "source-1",
    batchId: "batch-unsafe",
    correlationId: "console-unsafe-evidence",
  });

  assert.equal(result.state, "ERROR");
  assert.equal(result.error?.code, "CONSOLE_READ_UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("top-secret"), false);
  assert.equal(JSON.stringify(result).includes("Authorization"), false);
});

test("F20-B new pages preserve unavailable, tenant concealment, and safe port-error states", async () => {
  const setupResult = await setup();
  const unavailable = await setupResult.adapter.read({
    page: "CONNECTOR",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    connectorId: "connector-1",
    sourceId: "source-1",
    batchId: "batch-1",
    correlationId: "console-unavailable",
  });
  assert.equal(unavailable.state, "UNAVAILABLE");

  const guarded = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    connectorQueryPort: { execute: () => { throw new Error("C:\\restricted\\backend secret-token"); } },
  });
  const concealed = await guarded.read({
    page: "CONNECTOR",
    sessionId: "console-session",
    tenantId: "team-b",
    teamId: "team-b",
    connectorId: "connector-1",
    sourceId: "source-1",
    batchId: "batch-1",
    correlationId: "console-wrong-tenant",
  });
  assert.equal(concealed.state, "EMPTY");

  const failed = await guarded.read({
    page: "CONNECTOR",
    sessionId: "console-session",
    tenantId,
    teamId: tenantId,
    connectorId: "connector-1",
    sourceId: "source-1",
    batchId: "batch-1",
    correlationId: "console-port-failure",
  });
  assert.equal(failed.state, "ERROR");
  assert.equal(failed.error?.code, "CONSOLE_READ_UNAVAILABLE");
  assert.equal(JSON.stringify(failed).includes("restricted"), false);
  assert.equal(JSON.stringify(failed).includes("secret-token"), false);
});

test("FEAT-024-G projects exact REL-001 Staging trace only after trusted live authorization", async () => {
  let reads = 0;
  let trustedActor = "";
  const port: ConsoleReleaseTraceReadPort = {
    readReleaseTrace(input) {
      reads += 1;
      trustedActor = input.session.principalId;
      assert.equal(input.tenantId, tenantId);
      assert.equal(input.scopeRef, tenantId);
      return incompleteReleaseTrace();
    },
  };
  const configured = await setup(undefined, undefined, undefined, port);

  const visible = await configured.adapter.read({
    page: "OPERATIONS", sessionId: "console-session", tenantId, teamId: tenantId,
    correlationId: "release-trace-visible",
  });
  assert.equal(visible.state, "READY");
  assert.equal(reads, 1);
  assert.equal(trustedActor, "console-operator");
  assert.deepEqual(visible.data?.["releaseTrace"], incompleteReleaseTrace());
  assert.equal(Object.isFrozen(visible.data?.["releaseTrace"]), true);

  const concealed = await configured.adapter.read({
    page: "OPERATIONS", sessionId: "console-session", tenantId: "team-b", teamId: "team-b",
    correlationId: "release-trace-concealed",
  });
  assert.equal(concealed.state, "EMPTY");
  assert.equal(reads, 1);
});

test("FEAT-024-G passes the exact authorized Session to the release trace port without resolver TOCTOU", async () => {
  const setupResult = await setup();
  let resolverCalls = 0;
  let observedActor = "";
  const firstSession = setupResult.session.resolve("console-session");
  assert.notEqual(firstSession, undefined);
  const secondSession = Object.freeze({ ...firstSession!, principalId: "cross-context-actor", tenantId: "team-b", teamIds: Object.freeze(["team-b"]) });
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: { resolve: () => (++resolverCalls === 1 ? firstSession : secondSession) },
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    releaseTraceReadPort: {
      readReleaseTrace: ({ session }) => {
        observedActor = session.principalId;
        return incompleteReleaseTrace();
      },
    },
  });

  const result = await adapter.read({
    page: "OPERATIONS", sessionId: "console-session", tenantId, teamId: tenantId,
    correlationId: "release-trace-session-toctou",
  });

  assert.equal(result.state, "READY");
  assert.equal(observedActor, "console-operator");
  assert.equal(resolverCalls, 1);
});

test("FEAT-024-G rejects cross-candidate environment binding and unsafe release evidence fail closed", async () => {
  const setupResult = await setup();
  const cases = [
    { ...incompleteReleaseTrace(), evidenceComposition: { ...(incompleteReleaseTrace()["evidenceComposition"] as object), artifactFingerprint: "9".repeat(64) } },
    { ...incompleteReleaseTrace(), acceptanceManifest: { ...(incompleteReleaseTrace()["acceptanceManifest"] as object), targetEnvironment: "Production" } },
    { ...incompleteReleaseTrace(), rawScannerPayload: "Authorization: Bearer secret-fixture-value" },
    { ...incompleteReleaseTrace(), evidenceComposition: { ...(incompleteReleaseTrace()["evidenceComposition"] as object), evidenceRefs: ["C:\\internal\\release.sqlite"] } },
  ];
  for (const [index, value] of cases.entries()) {
    const adapter = new ConsoleReadAdapter({
      queryPort: { executeQuery: async () => {
        await Promise.resolve(); throw new Error("Publication query must not be used"); } },
      operationsRead: setupResult.infrastructure.operationsRead,
      projectionRead: setupResult.infrastructure.operationsProjectionRead,
      sessionResolver: setupResult.session,
      authorizationEvaluator: setupResult.authorization,
      clock: setupResult.clock,
      releaseTraceReadPort: { readReleaseTrace: () => value },
    });
    const result = await adapter.read({
      page: "OPERATIONS", sessionId: "console-session", tenantId, teamId: tenantId,
      correlationId: `release-trace-invalid-${index}`,
    });
    assert.equal(result.state, "READY");
    assert.equal(result.data?.["releaseTrace"], "UNAVAILABLE");
    assert.equal(JSON.stringify(result).includes("Bearer"), false);
    assert.equal(JSON.stringify(result).includes("release.sqlite"), false);
  }
});

test("FEAT-024-G keeps the release trace unavailable when its injected boundary is absent or fails", async () => {
  const unavailable = await (await setup()).adapter.read({
    page: "OPERATIONS", sessionId: "console-session", tenantId, teamId: tenantId,
    correlationId: "release-trace-unavailable",
  });
  assert.equal(unavailable.data?.["releaseTrace"], "UNAVAILABLE");

  const setupResult = await setup();
  const failed = await new ConsoleReadAdapter({
    queryPort: { executeQuery: async () => {
      await Promise.resolve(); throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    releaseTraceReadPort: { readReleaseTrace: () => { throw new Error("C:\\secret\\release.sqlite Authorization: Bearer unsafe"); } },
  }).read({
    page: "OPERATIONS", sessionId: "console-session", tenantId, teamId: tenantId,
    correlationId: "release-trace-failed",
  });
  assert.equal(failed.state, "READY");
  assert.equal(failed.data?.["releaseTrace"], "UNAVAILABLE");
  assert.equal(JSON.stringify(failed).includes("unsafe"), false);
});

test("FEAT-024-G preserves a test-only exact accepted handoff as bounded read evidence without executing promotion", async () => {
  const trace = acceptedReleaseTrace();
  const result = await (await setup(undefined, undefined, undefined, { readReleaseTrace: () => trace })).adapter.read({
    page: "OPERATIONS", sessionId: "console-session", tenantId, teamId: tenantId,
    correlationId: "release-trace-accepted-fixture",
  });
  assert.equal(result.state, "READY");
  assert.deepEqual(result.data?.["releaseTrace"], trace);
});
