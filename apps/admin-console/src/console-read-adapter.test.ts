import assert from "node:assert/strict";
import test from "node:test";

import { PublicationApi } from "../../api/src/publication-api.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../../modules/authorization/src/authorization-service.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import { ConsoleReadAdapter } from "./console-read-adapter.js";
import { createDevelopmentConsoleSessionAdapter } from "./development-session.js";

const now = "2026-08-13T00:00:00.000Z";
const publicationId = "publication-console-1";
const tenantId = "team-a";

function setup() {
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
  infrastructure.repository.save(PublicationAggregate.create({
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
    executeQuery: (request: unknown) => api.executeQuery(request),
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

test("POST-F15-CONSOLE read adapter returns immutable UI-031 data through API-014 without command execution", () => {
  const setupResult = setup();
  const result = setupResult.adapter.read(request("UI-031"));

  assert.equal(result.state, "READY");
  assert.equal(result.page, "UI-031");
  assert.equal(result.data?.["screenId"], "UI-031");
  assert.equal(result.data?.["publicationId"], publicationId);
  assert.equal(setupResult.commandCalls, 0);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.data), true);
});

test("POST-F15-CONSOLE read adapter exposes bounded Dashboard, Projection and Operations status", () => {
  const { adapter } = setup();
  const dashboard = adapter.read(request("DASHBOARD"));
  const projection = adapter.read(request("PROJECTION"));
  const operations = adapter.read(request("OPERATIONS"));

  assert.equal(dashboard.state, "READY");
  assert.equal(dashboard.data?.["health"], "HEALTHY");
  assert.equal(dashboard.data?.["publicationCounts"], "NOT_AVAILABLE_IN_CURRENT_BACKEND");
  assert.equal(projection.state, "READY");
  assert.equal(projection.data?.["projectionStatus"], "UNAVAILABLE");
  assert.equal(operations.state, "READY");
  assert.equal((operations.data?.["readiness"] as { operationsRead?: boolean }).operationsRead, true);
});

test("POST-F15-CONSOLE every Console DTO is deeply immutable and no command capability is exposed", () => {
  const setupResult = setup();
  for (const page of ["UI-032", "UI-033", "UI-035", "PROJECTION", "OPERATIONS"] as const) {
    const result = setupResult.adapter.read(request(page));
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

test("POST-F15-CONSOLE unavailable backend failures return only the bounded safe error", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("C:\\restricted\\backend secret-token"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
  });

  const result = adapter.read(request("UI-031"));
  const serialized = JSON.stringify(result);
  assert.equal(result.state, "ERROR");
  assert.equal(result.error?.code, "CONSOLE_READ_UNAVAILABLE");
  assert.equal(serialized.includes("restricted"), false);
  assert.equal(serialized.includes("secret-token"), false);
});

test("POST-F15-CONSOLE missing and unauthorized Publication reads conceal protected data", () => {
  const { adapter } = setup();
  const withPublication = request("UI-032");
  const withoutPublication = {
    page: withPublication.page,
    sessionId: withPublication.sessionId,
    tenantId: withPublication.tenantId,
    teamId: withPublication.teamId,
    correlationId: withPublication.correlationId,
  };
  const missing = adapter.read(withoutPublication);
  const wrongTenant = adapter.read({ ...request("UI-031"), tenantId: "team-b", teamId: "team-b" });

  assert.equal(missing.state, "EMPTY");
  assert.equal(wrongTenant.state, "EMPTY");
  assert.equal(JSON.stringify(wrongTenant).includes(publicationId), false);
  assert.equal(JSON.stringify(wrongTenant).includes("console-operator"), false);
});

test("F20-B projects API-018 batch status through the read boundary without raw provider data", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
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

  const result = adapter.read({
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

test("F20-B projects API-019 exact mapping through the read boundary without raw provider data", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
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

  const result = adapter.read({
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

test("F20-B projects API-019 exact Integration Contract through the closed query branch", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
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

  const result = adapter.read({
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

test("F20-B projects F19 exact recovery case with finding and disposition kept separate", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
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
            originIdentity: Object.freeze({ invocationId: "invocation-1" }),
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

  const result = adapter.read({
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
});

test("F20-B projects API-016 audit events without details or internal evidence", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
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

  const result = adapter.read({
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
  assert.equal(Object.isFrozen((result.data?.["events"] as readonly unknown[])[0]), true);
});

test("F20-B fails safely when an approved read port returns secret-like evidence", () => {
  const setupResult = setup();
  const adapter = new ConsoleReadAdapter({
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
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

  const result = adapter.read({
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

test("F20-B new pages preserve unavailable, tenant concealment, and safe port-error states", () => {
  const setupResult = setup();
  const unavailable = setupResult.adapter.read({
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
    queryPort: { executeQuery: () => { throw new Error("Publication query must not be used"); } },
    operationsRead: setupResult.infrastructure.operationsRead,
    projectionRead: setupResult.infrastructure.operationsProjectionRead,
    sessionResolver: setupResult.session,
    authorizationEvaluator: setupResult.authorization,
    clock: setupResult.clock,
    connectorQueryPort: { execute: () => { throw new Error("C:\\restricted\\backend secret-token"); } },
  });
  const concealed = guarded.read({
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

  const failed = guarded.read({
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
