import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SessionContext } from "../../identity/src/session-service.js";
import { DurableRecoveryOrchestrationStore } from "./recovery-durable-persistence.js";
import {
  RecoveryOrchestrationApplication,
  type RecoveryCaseRecord,
  type RecoveryOrchestrationStore,
  type RecoveryTrustedContext,
} from "./recovery-orchestration-service.js";
import { PublicationRecoveryExecutionIdentityValidator, PublicationRecoveryExecutionPlanner } from "../../publication/src/publication-recovery-execution-planner.js";

const now = "2026-09-02T10:00:00.000Z";

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({
    id: "session-1",
    principalId: "service-evidence-1",
    principalType: "SERVICE",
    roles: ["SVC"] as const,
    teamId: "team-1",
    state: "ACTIVE",
    assurance: "WORKLOAD",
    isMfaVerified: false,
    authenticatedAt: "2026-09-02T09:00:00.000Z",
    expiresAt: "2026-09-02T11:00:00.000Z",
    absoluteExpiresAt: "2026-09-02T12:00:00.000Z",
    familyId: "family-1",
    refreshReference: "test-refresh-reference",
    ...overrides,
  });
}

function context(overrides: Partial<RecoveryTrustedContext> = {}): RecoveryTrustedContext {
  return Object.freeze({
    session: session(),
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    purpose: "RECONCILIATION_RECOVERY",
    ...overrides,
  });
}

test("F19-B creates a case from closed origin fields and trusted context only", () => {
  let created: Parameters<RecoveryOrchestrationStore["createCase"]>[0] | undefined;
  const record: RecoveryCaseRecord = Object.freeze({
    recoveryCaseId: "recovery-case-1",
    resourceType: "Publication",
    resourceId: "publication-1",
    originDomain: "PUBLICATION",
    originIdentity: Object.freeze({ reconciliationCaseId: "publication-case-1", attemptId: "attempt-1" }),
    tenantId: "tenant-1",
    scopeRef: "team:team-1",
    status: "OPEN",
    version: 1,
    evidenceRefs: Object.freeze(["evidence:dispatch:1"]),
    createdBy: "service-evidence-1",
    createdAt: now,
  });
  const store = {
    createCase(input: Parameters<RecoveryOrchestrationStore["createCase"]>[0]) {
      created = input;
      return record;
    },
  } as unknown as RecoveryOrchestrationStore;
  const application = new RecoveryOrchestrationApplication({
    store,
    contextResolver: { resolve: (sessionId: string) => sessionId === "session-1" ? context() : undefined },
    authorizer: { authorize: () => true },
    executionIdentityValidator: { validate: () => true },
    clock: { now: () => now },
  });

  const result = application.execute("COMMAND", {
    operation: "CREATE_RECOVERY_CASE",
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: "publication-case-1", attemptId: "attempt-1" },
    resourceType: "Publication",
    resourceId: "publication-1",
    evidenceRefs: ["evidence:dispatch:1"],
  }, "session-1");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, { recoveryCaseId: "recovery-case-1", status: "OPEN", version: 1, evidenceRefs: ["evidence:dispatch:1"], createdAt: now });
  assert.equal(created?.tenantId, "tenant-1");
  assert.equal(created?.scopeRef, "team:team-1");
  assert.equal(created?.createdBy, "service-evidence-1");
  assert.equal(created?.createdAt, now);

  const rejected = application.execute("COMMAND", {
    operation: "CREATE_RECOVERY_CASE",
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: "publication-case-1", attemptId: "attempt-1" },
    resourceType: "Publication",
    resourceId: "publication-1",
    evidenceRefs: ["evidence:dispatch:1"],
    actorId: "body-actor-must-not-be-accepted",
  }, "session-1");
  assert.deepEqual(rejected, {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Recovery operation could not be completed." },
  });
});

test("F19-B resolves and authorizes through trusted human MFA, SoD and domain identity validation", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-b-app-"));
  const store = new DurableRecoveryOrchestrationStore({ databasePath: join(directory, "recovery.sqlite") });
  try {
    const created = store.createCase({
      resourceType: "Publication",
      resourceId: "publication-2",
      originDomain: "PUBLICATION",
      originIdentity: { reconciliationCaseId: "publication-case-2", attemptId: "attempt-2" },
      tenantId: "tenant-1",
      scopeRef: "team:team-1",
      evidenceRefs: ["evidence:submitted:2"],
      createdBy: "evidence-submitter-2",
      createdAt: now,
    });
    let validations = 0;
    const humanContext = context({ session: session({ principalId: "resolver-1", principalType: "HUMAN", roles: ["OPS"], assurance: "MFA", isMfaVerified: true }) });
    const application = new RecoveryOrchestrationApplication({
      store,
      contextResolver: { resolve: () => humanContext },
      authorizer: { authorize: () => true },
      executionIdentityValidator: { validate: () => { validations += 1; return true; } },
      clock: { now: () => now },
    });
    const resolved = application.execute("COMMAND", {
      operation: "RESOLVE_RECOVERY_CASE",
      recoveryCaseId: created.recoveryCaseId,
      expectedVersion: 1,
      finding: "CONFIRMED_NOT_EXECUTED",
      reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED",
      evidenceRefs: ["evidence:trusted:2"],
      idempotencyKey: "resolve-key-2",
    }, "session-1");
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.operation, "RESOLVE_RECOVERY_CASE");
    if (resolved.operation !== "RESOLVE_RECOVERY_CASE") return;
    assert.deepEqual(Object.keys(resolved.data).sort(), ["caseStatus", "evidenceRefs", "finding", "findingRecordId", "recoveryCaseId", "resolvedAt", "version"]);
    assert.equal(resolved.data.finding, "CONFIRMED_NOT_EXECUTED");
    assert.equal(resolved.data.caseStatus, "RESOLVED");

    const authorized = application.execute("COMMAND", {
      operation: "AUTHORIZE_RECOVERY",
      recoveryCaseId: created.recoveryCaseId,
      expectedVersion: 2,
      recoveryDisposition: "RECOVERY_AUTHORIZED",
      recoveryActionType: "PUBLICATION_RECOVERY",
      recoveryExecutionIdentity: { attemptId: "attempt-3", commandId: "command-3" },
      evidenceRefs: ["evidence:authorization:2"],
      idempotencyKey: "authorize-key-2",
    }, "session-1");
    assert.equal(authorized.ok, true);
    if (!authorized.ok) return;
    assert.equal(authorized.operation, "AUTHORIZE_RECOVERY");
    if (authorized.operation !== "AUTHORIZE_RECOVERY") return;
    assert.deepEqual(Object.keys(authorized.data).sort(), ["createdAt", "dispositionRecordId", "reconciliationFinding", "recoveryActionType", "recoveryCaseId", "recoveryDisposition", "recoveryExecutionIdentity", "recoveryId", "version"]);
    assert.equal(authorized.data.recoveryDisposition, "RECOVERY_AUTHORIZED");
    assert.equal(validations, 1);
    assert.equal(store.findCase(created.recoveryCaseId)?.version, 3);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F19-B fails closed for evidence submitter SoD, weak assurance, body claims and wrong scope", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-b-deny-"));
  const store = new DurableRecoveryOrchestrationStore({ databasePath: join(directory, "recovery.sqlite") });
  try {
    const created = store.createCase({ resourceType: "ConnectorInvocation", resourceId: "invocation-3", originDomain: "CONNECTOR", originIdentity: { invocationId: "invocation-3" }, tenantId: "tenant-1", scopeRef: "team:team-1", evidenceRefs: ["evidence:3"], createdBy: "submitter-3", createdAt: now });
    const makeApplication = (trusted: RecoveryTrustedContext) => new RecoveryOrchestrationApplication({ store, contextResolver: { resolve: () => trusted }, authorizer: { authorize: () => true }, executionIdentityValidator: { validate: () => true }, clock: { now: () => now } });
    const command = { operation: "RESOLVE_RECOVERY_CASE", recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "UNRESOLVED", reasonCode: "EVIDENCE_INSUFFICIENT", evidenceRefs: ["evidence:trusted:3"], idempotencyKey: "resolve-key-3" };
    assert.equal(makeApplication(context({ session: session({ principalId: "submitter-3", principalType: "HUMAN", roles: ["OPS"], assurance: "MFA", isMfaVerified: true }) })).execute("COMMAND", command, "session-1").ok, false);
    assert.equal(makeApplication(context({ session: session({ principalId: "resolver-3", principalType: "HUMAN", roles: ["OPS"], assurance: "SINGLE_FACTOR", isMfaVerified: false }) })).execute("COMMAND", command, "session-1").ok, false);
    assert.deepEqual(makeApplication(context({ session: session({ principalId: "resolver-3", principalType: "HUMAN", roles: ["OPS"], assurance: "MFA", isMfaVerified: true }) })).execute("COMMAND", { ...command, actorId: "body-actor" }, "session-1"), { ok: false, error: { code: "VALIDATION_FAILED", message: "Recovery operation could not be completed." } });
    const read = makeApplication(context({ tenantId: "tenant-2", scopeRef: "team:other" })).execute("QUERY", { operation: "READ_RECOVERY_CASE", recoveryCaseId: created.recoveryCaseId }, "session-1");
    assert.deepEqual(read, { ok: false, error: { code: "NOT_FOUND", message: "Recovery operation could not be completed." } });
    assert.equal(store.findCase(created.recoveryCaseId)?.version, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F19-B rejects a non-new domain execution identity with zero disposition mutation", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-b-identity-"));
  const store = new DurableRecoveryOrchestrationStore({ databasePath: join(directory, "recovery.sqlite") });
  try {
    const created = store.createCase({ resourceType: "Publication", resourceId: "publication-4", originDomain: "PUBLICATION", originIdentity: { reconciliationCaseId: "publication-case-4", attemptId: "attempt-original" }, tenantId: "tenant-1", scopeRef: "team:team-1", evidenceRefs: ["evidence:4"], createdBy: "submitter-4", createdAt: now });
    store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:trusted:4"], decidedBy: "resolver-4", decidedAt: now, idempotencyKey: "finding-key-4", fingerprint: "finding-fingerprint-4" });
    const application = new RecoveryOrchestrationApplication({
      store,
      contextResolver: { resolve: () => context({ session: session({ principalId: "authorizer-4", principalType: "HUMAN", roles: ["OPS"], assurance: "MFA", isMfaVerified: true }) }) },
      authorizer: { authorize: () => true },
      executionIdentityValidator: { validate: () => false },
      clock: { now: () => now },
    });
    const result = application.execute("COMMAND", { operation: "AUTHORIZE_RECOVERY", recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "PUBLICATION_RECOVERY", recoveryExecutionIdentity: { attemptId: "attempt-original", commandId: "command-not-new" }, evidenceRefs: ["evidence:authorization:4"], idempotencyKey: "authorize-key-4" }, "session-1");
    assert.deepEqual(result, { ok: false, error: { code: "VALIDATION_FAILED", message: "Recovery operation could not be completed." } });
    assert.equal(store.findCase(created.recoveryCaseId)?.version, 2);
    assert.equal(store.findCase(created.recoveryCaseId)?.disposition, undefined);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F19-C trusted Publication planner rejects caller substitution before durable recovery authorization binding", () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f19-c-planner-handoff-"));
  const store = new DurableRecoveryOrchestrationStore({ databasePath: join(directory, "recovery.sqlite") });
  try {
    const created = store.createCase({
      resourceType: "Publication",
      resourceId: "publication-planner-handoff",
      originDomain: "PUBLICATION",
      originIdentity: { reconciliationCaseId: "publication-case-planner-handoff", attemptId: "attempt-original-planner-handoff" },
      tenantId: "tenant-planner-handoff",
      scopeRef: "team:planner-handoff",
      evidenceRefs: ["evidence:planner-handoff"],
      createdBy: "submitter-planner-handoff",
      createdAt: now,
    });
    store.recordFinding({ recoveryCaseId: created.recoveryCaseId, expectedVersion: 1, finding: "CONFIRMED_NOT_EXECUTED", reasonCode: "PROVIDER_CONFIRMED_NOT_EXECUTED", evidenceRefs: ["evidence:trusted:planner-handoff"], decidedBy: "resolver-planner-handoff", decidedAt: now, idempotencyKey: "finding-key-planner-handoff", fingerprint: "finding-fingerprint-planner-handoff" });
    const planningInput = {
      identity: { publicationId: "publication-planner-handoff", tenantScopeId: "tenant-planner-handoff" },
      recoveryCaseId: created.recoveryCaseId,
      reconciliationCaseId: "publication-case-planner-handoff",
      originalAttemptId: "attempt-original-planner-handoff",
      originalCommandId: "command-original-planner-handoff",
    };
    const planned = new PublicationRecoveryExecutionPlanner().plan(planningInput);
    const validator = new PublicationRecoveryExecutionIdentityValidator({
      findOriginalExecution(input) {
        return input.identity.publicationId === planningInput.identity.publicationId
          && input.identity.tenantScopeId === planningInput.identity.tenantScopeId
          && input.reconciliationCaseId === planningInput.reconciliationCaseId
          && input.attemptId === planningInput.originalAttemptId
          ? { commandId: planningInput.originalCommandId }
          : undefined;
      },
    });
    const application = new RecoveryOrchestrationApplication({
      store,
      contextResolver: { resolve: () => context({ tenantId: "tenant-planner-handoff", scopeRef: "team:planner-handoff", session: session({ principalId: "authorizer-planner-handoff", principalType: "HUMAN", roles: ["OPS"], assurance: "MFA", isMfaVerified: true }) }) },
      authorizer: { authorize: () => true },
      executionIdentityValidator: validator,
      clock: { now: () => now },
    });

    const forged = application.execute("COMMAND", { operation: "AUTHORIZE_RECOVERY", recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "PUBLICATION_RECOVERY", recoveryExecutionIdentity: { attemptId: "caller-authored-attempt", commandId: "caller-authored-command" }, evidenceRefs: ["evidence:authorization:forged"], idempotencyKey: "authorize-key-forged" }, "session-1");

    assert.deepEqual(forged, { ok: false, error: { code: "VALIDATION_FAILED", message: "Recovery operation could not be completed." } });
    assert.equal(store.findCase(created.recoveryCaseId)?.version, 2);
    assert.equal(store.findCase(created.recoveryCaseId)?.disposition, undefined);

    const authorized = application.execute("COMMAND", { operation: "AUTHORIZE_RECOVERY", recoveryCaseId: created.recoveryCaseId, expectedVersion: 2, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "PUBLICATION_RECOVERY", recoveryExecutionIdentity: planned, evidenceRefs: ["evidence:authorization:planned"], idempotencyKey: "authorize-key-planned" }, "session-1");

    assert.equal(authorized.ok, true);
    assert.deepEqual(store.findCase(created.recoveryCaseId)?.recovery?.recoveryExecutionIdentity, planned);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
