import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import { DurableRecoveryOrchestrationStore } from "../../recovery/src/recovery-durable-persistence.js";
import { DurableConnectorExecutionUnitOfWork, type ConnectorExecutionScope } from "./connector-durable-persistence.js";
import { ConnectorExecutionCoordinator, type ConnectorExecutionInput } from "./connector-execution-coordinator.js";
import type { ConnectorInvocationPort, ConnectorInvocationRequest, ConnectorInvocationResponse } from "./connector-invocation-port.js";
import {
  ConnectorAmbiguityRecoveryCaseWriterAdapter,
  ConnectorRecoveryAuthorizationAdapter,
  ConnectorRecoveryExecutionHandoff,
  ConnectorRecoveryExecutionPlanner,
  type AuthorizedConnectorRecovery,
  type ConnectorRecoveryExecutionRequest,
} from "./connector-recovery-handoff.js";
import type { ConnectorRuntimeAuthorizer, ConnectorTrustedRuntimeContext } from "./connector-runtime-application.js";
import { DurableExternalIntegrationStore, type IntegrationContract } from "./external-integration-durable-persistence.js";
import { SourceIngestionAdmissionGate, type ConnectorAdmissionSnapshot, type SourceIngestionPolicySnapshot } from "./source-ingestion-admission.js";

const originalInvocationId = "invocation-original-f19-d";
const recoveryId = "recovery-f19-d";
const recoveryInvocationId = `connector-recovery:${recoveryId}`;
const serverNow = "2026-09-03T00:10:01.000Z";
const scope: ConnectorExecutionScope = Object.freeze({ tenantId: "tenant-f19-d", scopeType: "TEAM", scopeId: "team-f19-d", sourceId: "source-f19-d", connectorId: "connector-f19-d" });
const session: SessionContext = Object.freeze({
  id: "session-f19-d", principalId: "connector-executor-f19-d", principalType: "SERVICE", roles: Object.freeze([]), teamId: scope.scopeId,
  state: "ACTIVE", assurance: "WORKLOAD", isMfaVerified: false, authenticatedAt: "2026-09-03T00:00:00.000Z",
  expiresAt: "2026-09-03T01:00:00.000Z", absoluteExpiresAt: "2026-09-03T02:00:00.000Z", familyId: "family-f19-d", refreshReference: "refresh-reference-f19-d",
});
const context: ConnectorTrustedRuntimeContext = Object.freeze({
  session, tenantId: scope.tenantId, scope: Object.freeze({ scopeType: scope.scopeType, scopeId: scope.scopeId }), sourceId: scope.sourceId,
  connectorId: scope.connectorId, purpose: "LISTING_DISCOVERY", sourcePolicyVersion: 3, connectorVersion: 5, correlationId: "correlation-f19-d",
});
const sourcePolicy: SourceIngestionPolicySnapshot = Object.freeze({
  sourceId: scope.sourceId, tenantId: scope.tenantId, scope: context.scope, status: "ACTIVE", version: 3,
  allowedMethods: Object.freeze(["CONNECTOR"]), allowedPurposes: Object.freeze([context.purpose]), classification: "CONFIDENTIAL_BUSINESS",
});
const connectorConfiguration: ConnectorAdmissionSnapshot = Object.freeze({
  connectorId: scope.connectorId, tenantId: scope.tenantId, scope: context.scope, status: "ACTIVE", version: 5, sourceIds: Object.freeze([scope.sourceId]),
  allowedMethods: Object.freeze(["CONNECTOR"]), allowedPurposes: Object.freeze([context.purpose]),
});
const contractBinding = Object.freeze({
  ...scope, integrationContractId: "contract-f19-d", providerNamespace: "provider-f19-d", governedBindingRef: "binding:f19-d",
  evidenceRef: "evidence:contract:f19-d", provisionedAt: "2026-09-03T00:00:00.000Z",
});

function authorized(overrides: Readonly<Record<string, unknown>> = {}): AuthorizedConnectorRecovery {
  return Object.freeze({
    recoveryId, recoveryCaseId: "case-f19-d", originDomain: "CONNECTOR", originIdentity: Object.freeze({ invocationId: originalInvocationId }),
    status: "RESOLVED", finding: "CONFIRMED_NOT_EXECUTED", recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "CONNECTOR_REEXECUTION",
    recoveryExecutionIdentity: Object.freeze({ invocationId: recoveryInvocationId }), authorizedBy: "recovery-authorizer-f19-d", ...overrides,
  });
}

function request(overrides: Readonly<Record<string, unknown>> = {}): ConnectorRecoveryExecutionRequest {
  return Object.freeze({
    recoveryId, sessionId: session.id, integrationContractId: contractBinding.integrationContractId, expectedIntegrationContractVersion: 1,
    leaseId: "lease-recovery-f19-d", leaseAcquiredAt: "2026-09-03T00:10:00.000Z", leaseExpiresAt: "2026-09-03T00:15:00.000Z",
    expectedScopeRevision: 2, inputReference: "evidence:recovery-input", inputVersion: 1, expectedCheckpointVersion: 0,
    preparedAt: "2026-09-03T00:10:00.000Z", startedAt: "2026-09-03T00:10:01.000Z", completedAt: "2026-09-03T00:10:02.000Z", ...overrides,
  });
}

function originalExecutionInput(overrides: Readonly<Record<string, unknown>> = {}): ConnectorExecutionInput {
  return Object.freeze({
    admissionInput: Object.freeze({ actor: session, tenantId: scope.tenantId, scope: context.scope, sourceId: scope.sourceId, sourcePolicyVersion: 3, connectorId: scope.connectorId, connectorVersion: 5, method: "CONNECTOR", purpose: context.purpose, correlationId: context.correlationId }),
    leaseId: "lease-original-f19-d", leaseOwnerId: session.principalId, leaseAcquiredAt: "2026-09-03T00:00:00.000Z", leaseExpiresAt: "2026-09-03T00:05:00.000Z",
    expectedScopeRevision: 0, invocationId: originalInvocationId, idempotencyKey: "original-f19-d", inputFingerprint: "fingerprint-original-f19-d",
    inputReference: "evidence:original-input", inputVersion: 1, expectedCheckpointVersion: 0, preparedAt: "2026-09-03T00:00:01.000Z",
    startedAt: "2026-09-03T00:00:02.000Z", completedAt: "2026-09-03T00:00:03.000Z", ...overrides,
  });
}

function allowDecision() {
  return Object.freeze({ effect: "ALLOW" as const, reasonCode: "AUTHORIZED", policyVersion: "policy-f19-d", obligations: Object.freeze(["AUDIT" as const]), assignmentIds: Object.freeze(["assignment-f19-d"]) });
}

function admissionGate(authorizationLookups: unknown[] = []): SourceIngestionAdmissionGate {
  return new SourceIngestionAdmissionGate({
    sourcePolicies: { readCurrent: () => sourcePolicy },
    connectors: { readCurrent: () => connectorConfiguration },
    authorization: { evaluate: (input) => { authorizationLookups.push(input); return allowDecision(); } },
  });
}

class CountingConnector implements ConnectorInvocationPort {
  public invocationCount = 0;
  public readonly requests: ConnectorInvocationRequest[] = [];

  public constructor(private readonly response: ConnectorInvocationResponse | "THROW" = Object.freeze({ outcome: "SUCCEEDED", reasonCode: "CONFIRMED", safeEvidenceReference: "evidence:recovery-result", checkpointReference: "checkpoint:recovery:1" })) {}

  public invoke(input: ConnectorInvocationRequest): ConnectorInvocationResponse {
    this.invocationCount += 1;
    this.requests.push(input);
    if (this.response === "THROW") throw new Error("deterministic connector ambiguity");
    return this.response;
  }
}

type HarnessOptions = Readonly<{
  context?: ConnectorTrustedRuntimeContext | null;
  recovery?: AuthorizedConnectorRecovery | null;
  runtimeAuthorized?: boolean;
  contractState?: "ACTIVE" | "SUSPENDED" | "MISSING";
  contractOverride?: Readonly<Partial<IntegrationContract>>;
}>;

function harness(options: HarnessOptions = {}) {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-d-handoff-"));
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath: join(directory, "connector.sqlite") });
  const contracts = new DurableExternalIntegrationStore({ databasePath: join(directory, "external.sqlite") });
  const connector = new CountingConnector();
  const recoveryLookups: unknown[] = [];
  const runtimeAuthorizationLookups: Parameters<ConnectorRuntimeAuthorizer["authorize"]>[0][] = [];
  const contractLookups: unknown[] = [];
  const admissionAuthorizationLookups: unknown[] = [];
  let coordinatorCalls = 0;

  persistence.acquireLease({ ...scope, leaseId: "lease-original-f19-d", ownerId: session.principalId, acquiredAt: "2026-09-03T00:00:00.000Z", expiresAt: "2026-09-03T00:05:00.000Z", expectedScopeRevision: 0 });
  persistence.prepareInvocation({ ...scope, invocationId: originalInvocationId, leaseId: "lease-original-f19-d", idempotencyKey: "original-f19-d", inputFingerprint: "fingerprint-original-f19-d", inputReference: "evidence:original-input", inputVersion: 1, sourcePolicyVersion: 3, connectorVersion: 5, expectedCheckpointVersion: 0, preparedAt: "2026-09-03T00:00:01.000Z" });
  persistence.markExecutionStarted(scope, originalInvocationId, "2026-09-03T00:00:02.000Z");
  persistence.releaseLease(scope, "lease-original-f19-d", 1, "2026-09-03T00:00:03.000Z");

  if (options.contractState !== "MISSING") {
    contracts.provisionContract(contractBinding);
    contracts.provisionContract({ ...contractBinding, integrationContractId: "contract-f19-d-other", governedBindingRef: "binding:f19-d:other" });
    if (options.contractState === "SUSPENDED") {
      contracts.suspendContract({ ...scope, integrationContractId: contractBinding.integrationContractId, expectedVersion: 1, idempotencyKey: "suspend-contract-f19-d", inputFingerprint: "suspend-contract-f19-d", reasonCode: "TECHNICAL_SUSPENSION", evidenceRef: "evidence:contract:suspended:f19-d", recordedAt: "2026-09-03T00:09:00.000Z" });
    }
  }

  const coordinator = new ConnectorExecutionCoordinator({ persistence, connector, admission: admissionGate(admissionAuthorizationLookups) });
  const handoff = new ConnectorRecoveryExecutionHandoff({
    authorizations: { findAuthorizedConnectorRecovery: (input) => { recoveryLookups.push(input); return options.recovery === null ? undefined : options.recovery ?? authorized(); } },
    planner: new ConnectorRecoveryExecutionPlanner(), persistence, coordinator: { execute: (input) => { coordinatorCalls += 1; return coordinator.execute(input); } },
    contextResolver: { resolve: () => options.context === null ? undefined : options.context ?? context },
    authorizer: { authorize: (input) => { runtimeAuthorizationLookups.push(input); return options.runtimeAuthorized ?? true; } },
    clock: () => serverNow,
    integrationContracts: {
      readContract: (input, integrationContractId) => {
        contractLookups.push(Object.freeze({ scope: input, integrationContractId }));
        const contract = contracts.readContract(input, integrationContractId);
        return contract === undefined ? undefined : Object.freeze({ ...contract, ...options.contractOverride });
      },
    },
  });

  return {
    handoff, persistence, contracts, connector, recoveryLookups, runtimeAuthorizationLookups, contractLookups, admissionAuthorizationLookups, coordinatorCalls: () => coordinatorCalls,
    close(): void { persistence.close(); contracts.close(); rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); },
  };
}

function mutationSnapshot(value: ReturnType<typeof harness>) {
  return structuredClone({
    lease: value.persistence.findLease(scope),
    checkpoint: value.persistence.findCheckpoint(scope),
    evidence: value.persistence.listEvidence(scope),
    invocation: value.persistence.findInvocation(scope, recoveryInvocationId),
    idempotency: value.persistence.findIdempotency(scope, `connector-recovery:${recoveryId}`),
  });
}

function withHarness(options: HarnessOptions, run: (value: ReturnType<typeof harness>) => void): void {
  const value = harness(options);
  try { run(value); } finally { value.close(); }
}

test("F19-D hands the authorized identity to the actual coordinator and exact replay makes zero Connector calls or mutations", () => withHarness({}, (value) => {
  const first = value.handoff.execute(request());
  assert.deepEqual(first, { status: "SUCCEEDED", reasonCode: "CONFIRMED", invocationId: recoveryInvocationId, resultId: `${recoveryInvocationId}:result` });
  assert.equal(value.connector.invocationCount, 1);
  assert.equal(value.persistence.findCheckpoint(scope)?.checkpointReference, "checkpoint:recovery:1");
  assert.deepEqual(value.recoveryLookups, [{ recoveryId, tenantId: scope.tenantId, scopeRef: `team:${scope.scopeId}` }]);
  assert.deepEqual(value.runtimeAuthorizationLookups, [{ context, operation: "SubmitCaptureBatch", resourceId: originalInvocationId }]);
  assert.deepEqual(value.contractLookups, [{ scope, integrationContractId: contractBinding.integrationContractId }]);
  assert.deepEqual(value.admissionAuthorizationLookups, [
    { session, action: "source.read", resource: { type: "SourceRegistry", id: scope.sourceId, tenantId: scope.tenantId, version: 3, teamId: scope.scopeId }, purpose: context.purpose, correlationId: context.correlationId },
    { session, action: "intake.create", resource: { type: "RawSource", id: scope.sourceId, tenantId: scope.tenantId, version: 3, teamId: scope.scopeId }, purpose: context.purpose, correlationId: context.correlationId },
  ]);

  const beforeReplay = mutationSnapshot(value);
  const callsBeforeReplay = value.connector.invocationCount;
  assert.deepEqual(value.handoff.execute(request()), first);
  assert.equal(value.connector.invocationCount - callsBeforeReplay, 0);
  assert.deepEqual(mutationSnapshot(value), beforeReplay);
}));

test("F19-D rejects expired, revoked, inactive, assurance-inconsistent, and wrong-team trusted context before handoff", () => {
  const cases: readonly Readonly<{ name: string; current: ConnectorTrustedRuntimeContext }>[] = [
    { name: "expired", current: Object.freeze({ ...context, session: Object.freeze({ ...session, expiresAt: "2026-09-03T00:10:00.000Z" }) }) },
    { name: "revoked", current: Object.freeze({ ...context, session: Object.freeze({ ...session, state: "REVOKED" }) }) },
    { name: "inactive", current: Object.freeze({ ...context, session: Object.freeze({ ...session, state: "EXPIRED" }) }) },
    { name: "assurance-inconsistent", current: Object.freeze({ ...context, session: Object.freeze({ ...session, isMfaVerified: true }) }) },
    { name: "wrong-team", current: Object.freeze({ ...context, session: Object.freeze({ ...session, teamId: "team-other" }) }) },
  ];
  for (const item of cases) withHarness({ context: item.current }, (value) => {
    const before = mutationSnapshot(value);
    assert.deepEqual(value.handoff.execute(request()), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" }, item.name);
    assert.equal(value.connector.invocationCount, 0, item.name);
    assert.equal(value.runtimeAuthorizationLookups.length, 0, item.name);
    assert.deepEqual(mutationSnapshot(value), before, item.name);
  });
});

test("F19-D rejects an expired Session against server time even when request startedAt is forged earlier", () => {
  const expired = Object.freeze({ ...context, session: Object.freeze({ ...session, expiresAt: "2026-09-03T00:05:00.000Z" }) });
  withHarness({ context: expired }, (value) => {
    const before = mutationSnapshot(value);
    assert.deepEqual(value.handoff.execute(request({ startedAt: "2026-09-03T00:04:00.000Z" })), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
    assert.equal(value.runtimeAuthorizationLookups.length, 0);
    assert.equal(value.coordinatorCalls(), 0);
    assert.equal(value.connector.invocationCount, 0);
    assert.equal(value.persistence.findCheckpoint(scope), undefined);
    assert.deepEqual(mutationSnapshot(value), before);
  });
});

test("F19-D runtime authorizer denial preserves exact trusted tenant, scope, and team lookup arguments with zero execution", () => withHarness({ runtimeAuthorized: false }, (value) => {
  const before = mutationSnapshot(value);
  assert.deepEqual(value.handoff.execute(request()), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
  assert.deepEqual(value.recoveryLookups, [{ recoveryId, tenantId: scope.tenantId, scopeRef: `team:${scope.scopeId}` }]);
  assert.deepEqual(value.runtimeAuthorizationLookups, [{ context, operation: "SubmitCaptureBatch", resourceId: originalInvocationId }]);
  assert.equal(value.contractLookups.length, 0);
  assert.equal(value.connector.invocationCount, 0);
  assert.deepEqual(mutationSnapshot(value), before);
}));

test("F19-D rejects suspended, mismatched, and missing current Integration Contract before execution", () => {
  const cases: readonly Readonly<{ name: string; options: HarnessOptions; input?: ConnectorRecoveryExecutionRequest }>[] = [
    { name: "suspended", options: { contractState: "SUSPENDED" }, input: request({ expectedIntegrationContractVersion: 2 }) },
    { name: "mismatched", options: { contractOverride: { scopeId: "team-other" } } },
    { name: "missing", options: { contractState: "MISSING" } },
  ];
  for (const item of cases) withHarness(item.options, (value) => {
    const before = mutationSnapshot(value);
    assert.deepEqual(value.handoff.execute(item.input ?? request()), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" }, item.name);
    assert.equal(value.connector.invocationCount, 0, item.name);
    assert.deepEqual(mutationSnapshot(value), before, item.name);
  });
});

test("F19-D rejects non-terminal recovery and conflicting planned identity with zero execution", () => {
  const cases: readonly Readonly<{ name: string; recovery: AuthorizedConnectorRecovery | null; input?: ConnectorRecoveryExecutionRequest }>[] = [
    { name: "missing", recovery: null },
    { name: "unresolved", recovery: authorized({ status: "OPEN", finding: "UNRESOLVED" }) },
    { name: "confirmed-executed", recovery: authorized({ finding: "CONFIRMED_EXECUTED" }) },
    { name: "unapproved", recovery: authorized({ recoveryDisposition: "NO_RECOVERY_REQUIRED" }) },
    { name: "wrong-recovery", recovery: authorized({ recoveryId: "recovery-other" }) },
    { name: "original-identity-reuse", recovery: authorized({ recoveryExecutionIdentity: Object.freeze({ invocationId: originalInvocationId }) }) },
    { name: "conflicting-planned-identity", recovery: authorized({ recoveryExecutionIdentity: Object.freeze({ invocationId: "connector-recovery:other" }) }) },
    { name: "missing-executor", recovery: authorized(), input: request({ sessionId: "" }) },
  ];
  for (const item of cases) withHarness({ recovery: item.recovery }, (value) => {
    const before = mutationSnapshot(value);
    assert.deepEqual(value.handoff.execute(item.input ?? request()), { status: "BLOCKED", reasonCode: "ADMISSION_DENIED" }, item.name);
    assert.equal(value.connector.invocationCount, 0, item.name);
    assert.deepEqual(mutationSnapshot(value), before, item.name);
  });
});

test("F19-D authoritative recovery input and contract changes conflict before Connector call or durable mutation", () => {
  const cases: readonly Readonly<{ name: string; changed: ConnectorRecoveryExecutionRequest }>[] = [
    { name: "inputReference", changed: request({ inputReference: "evidence:changed-input" }) },
    { name: "inputVersion", changed: request({ inputVersion: 2 }) },
    { name: "checkpoint", changed: request({ expectedCheckpointVersion: 1 }) },
    { name: "contract", changed: request({ integrationContractId: "contract-f19-d-other" }) },
  ];
  for (const item of cases) withHarness({}, (value) => {
    assert.equal(value.handoff.execute(request()).status, "SUCCEEDED", item.name);
    const beforeConflict = mutationSnapshot(value);
    const callsBeforeConflict = value.connector.invocationCount;
    assert.throws(() => value.handoff.execute(item.changed), { code: "IDEMPOTENCY_CONFLICT" }, item.name);
    assert.equal(value.connector.invocationCount - callsBeforeConflict, 0, item.name);
    assert.deepEqual(mutationSnapshot(value), beforeConflict, item.name);
  });
});

test("F19-D ambiguity writer treats durable DUPLICATE_ORIGIN as idempotent and authorization adapter reads the exact durable binding", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-d-recovery-adapters-"));
  const store = new DurableRecoveryOrchestrationStore({ databasePath: join(directory, "recovery.sqlite") });
  let created: ReturnType<DurableRecoveryOrchestrationStore["createCase"]> | undefined;
  const writer = new ConnectorAmbiguityRecoveryCaseWriterAdapter({ createCase(input) { const record = store.createCase(input); created = record; return record; } });
  const ambiguity = { invocationId: originalInvocationId, tenantId: scope.tenantId, scopeRef: `team:${scope.scopeId}`, sourceId: scope.sourceId, connectorId: scope.connectorId, evidenceRefs: ["evidence:ambiguous:f19-d"], createdBy: session.principalId, createdAt: "2026-09-03T00:00:03.000Z" } as const;
  try {
    writer.linkAmbiguousInvocation(ambiguity);
    assert.ok(created);
    const beforeDuplicate = store.findCase(created.recoveryCaseId);
    writer.linkAmbiguousInvocation(ambiguity);
    assert.deepEqual(store.findCase(created.recoveryCaseId), beforeDuplicate);

    store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:finding:f19-d"], decidedBy: "resolver-f19-d", decidedAt: "2026-09-03T00:04:00.000Z", idempotencyKey: "finding-f19-d", fingerprint: "finding-f19-d" });
    const durable = store.authorizeRecovery({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "CONNECTOR_REEXECUTION", recoveryExecutionIdentity: { invocationId: recoveryInvocationId }, evidenceRefs: ["evidence:authorization:f19-d"], decidedBy: "recovery-authorizer-f19-d", decidedAt: "2026-09-03T00:05:00.000Z", idempotencyKey: "authorization-f19-d", fingerprint: "authorization-f19-d" }).record;
    const adapter = new ConnectorRecoveryAuthorizationAdapter(store as unknown as ConstructorParameters<typeof ConnectorRecoveryAuthorizationAdapter>[0]);
    assert.deepEqual(adapter.findAuthorizedConnectorRecovery({ recoveryId: durable.recovery!.recoveryId, tenantId: scope.tenantId, scopeRef: `team:${scope.scopeId}` }), {
      recoveryId: durable.recovery!.recoveryId, recoveryCaseId: created.recoveryCaseId, originDomain: "CONNECTOR", originIdentity: { invocationId: originalInvocationId }, status: "RESOLVED",
      finding: "CONFIRMED_NOT_EXECUTED", recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "CONNECTOR_REEXECUTION", recoveryExecutionIdentity: { invocationId: recoveryInvocationId }, authorizedBy: "recovery-authorizer-f19-d",
    });
  } finally { store.close(); rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); }
});

test("F19-D actual coordinator links one durable ambiguity case and exact replay leaves checkpoint unchanged with call zero", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-d-ambiguity-"));
  const persistence = new DurableConnectorExecutionUnitOfWork({ databasePath: join(directory, "connector.sqlite") });
  const recovery = new DurableRecoveryOrchestrationStore({ databasePath: join(directory, "recovery.sqlite") });
  const connector = new CountingConnector("THROW");
  let linked: ReturnType<DurableRecoveryOrchestrationStore["createCase"]> | undefined;
  const writer = new ConnectorAmbiguityRecoveryCaseWriterAdapter({ createCase(input) { const record = recovery.createCase(input); linked = record; return record; } });
  const coordinator = new ConnectorExecutionCoordinator({ persistence, connector, admission: admissionGate(), ambiguityCaseWriter: writer });
  try {
    assert.deepEqual(coordinator.execute(originalExecutionInput()), { status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: originalInvocationId });
    assert.ok(linked);
    assert.equal(connector.invocationCount, 1);
    assert.equal(persistence.findCheckpoint(scope), undefined);
    const evidenceBeforeReplay = persistence.listEvidence(scope);
    const caseBeforeReplay = recovery.findCase(linked.recoveryCaseId);

    const callsBeforeReplay = connector.invocationCount;
    assert.deepEqual(coordinator.execute(originalExecutionInput({ expectedScopeRevision: 1 })), { status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: originalInvocationId });
    assert.equal(connector.invocationCount - callsBeforeReplay, 0);
    assert.equal(persistence.findCheckpoint(scope), undefined);
    assert.deepEqual(persistence.listEvidence(scope), evidenceBeforeReplay);
    assert.deepEqual(recovery.findCase(linked.recoveryCaseId), caseBeforeReplay);
  } finally {
    persistence.close(); recovery.close(); rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});
