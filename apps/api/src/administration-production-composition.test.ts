import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  AdministrationPersistenceError,
  DurableAdministrationUnitOfWork,
  type AdministrationDecisionRecord,
  type AdministrationIdempotencyRecord,
  type AdministrationProposalRecord,
  type RoleAssignmentPersistenceRecord,
} from "../../../modules/administration/src/index.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import {
  composeProductionAdministrationApi015NodeHttpServer,
  type ProductionAdministrationCompositionOptions,
} from "./composition.js";

const requiredDependencies = Object.freeze({
  sessionResolver: undefined as never,
  clock: () => new Date("2026-08-26T01:00:00.000Z"),
  idFactory: () => "f16-r1-id",
  auditSink: new AuditLog({ clock: () => new Date("2026-08-26T01:00:00.000Z"), idFactory: () => "audit-f16-r1" }),
  policyVersion: "f16-r1-production-policy",
});

const tenantId = "tenant-production-r1";
const sessionId = "session-production-r1";
const session: SessionContext = Object.freeze({
  id: sessionId,
  principalId: "principal-production-r1",
  principalType: "HUMAN",
  roles: [] as const,
  teamId: "team-production-r1",
  state: "ACTIVE",
  assurance: "MFA",
  isMfaVerified: true,
  authenticatedAt: "2026-08-26T00:00:00.000Z",
  expiresAt: "2026-08-26T04:00:00.000Z",
  absoluteExpiresAt: "2026-08-27T00:00:00.000Z",
  familyId: "family-production-r1",
  refreshReference: "refresh-production-r1",
});
const decisionSessionId = "session-production-r2-approver";
const decisionSession: SessionContext = Object.freeze({
  ...session,
  id: decisionSessionId,
  principalId: "principal-production-r2-approver",
  familyId: "family-production-r2-approver",
  refreshReference: "refresh-production-r2-approver",
});

function productionOptions(databasePath: string): ProductionAdministrationCompositionOptions {
  const clock = () => new Date("2026-08-26T01:00:00.000Z");
  let sequence = 0;
  return {
    databasePath,
    sessionResolver: {
      resolve: (requestedSessionId) => requestedSessionId === sessionId ? session
        : requestedSessionId === decisionSessionId ? decisionSession : undefined,
    },
    clock,
    idFactory: () => `proposal-production-r1-${String(++sequence)}`,
    auditSink: new AuditLog({ clock, idFactory: () => "audit-production-r1" }),
    policyVersion: "f16-r1-production-policy",
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 4_096, shutdownTimeout: 250 },
  };
}

function revokeProductionAuthority(databasePath: string): void {
  const unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
  const identity = { tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: "assignment-production-r1" };
  const current = unitOfWork.roleAssignments.find(identity);
  assert.ok(current);
  const evidence = { type: "AUDIT" as const, id: "evidence-authority-revoked-r1", version: 1 };
  const proposal: AdministrationProposalRecord = {
    proposalId: "proposal-authority-revoke-production-r1", tenantId, resourceType: "ROLE_ASSIGNMENT",
    resourceId: identity.resourceId, resourceVersion: current.version, proposedBy: "principal-authority-revoke-proposer-r1",
    proposedChangeReference: "change-authority-revoke-production-r1", policyReference: "policy-authority-production-r1",
    status: "PROPOSED", version: 1, reasonReference: "reason-authority-revoke-production-r1",
    evidenceReferences: [evidence], scope: current.scope,
  };
  let transaction = unitOfWork.begin(identity);
  transaction.proposals.save(proposal);
  transaction.idempotency.record({
    ...identity, idempotencyKey: "idempotency-authority-revoke-propose-r1", operation: "PROPOSE_ROLE_ASSIGNMENT",
    fingerprint: "fingerprint-authority-revoke-propose-r1", resultReference: proposal.proposalId,
    resultVersion: 1, recordedAt: "2026-08-26T01:00:00.000Z",
  });
  transaction.commit();
  const decision: AdministrationDecisionRecord = {
    decisionId: "decision-authority-revoke-production-r1", proposalId: proposal.proposalId, tenantId,
    operation: "REVOKE_ROLE_ASSIGNMENT", resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId,
    scope: current.scope, proposerId: proposal.proposedBy, decisionActorId: "principal-authority-revoke-approver-r1",
    status: "REVOKED", reasonReference: "reason-authority-revoked-production-r1", evidenceReferences: [evidence],
    version: current.version + 1, decidedAt: "2026-08-26T01:00:00.000Z",
  };
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(current.version, {
    ...current, status: "REVOKED", version: current.version + 1,
    revokedBy: decision.decisionActorId, evidenceReferences: [...current.evidenceReferences, evidence],
  });
  transaction.proposals.update(1, { ...proposal, status: "REVOKED", version: 2, evidenceReferences: [...proposal.evidenceReferences, evidence] });
  transaction.decisions.append(decision);
  transaction.idempotency.record({
    ...identity, idempotencyKey: "idempotency-authority-revoke-r1", operation: "REVOKE_ROLE_ASSIGNMENT",
    fingerprint: "fingerprint-authority-revoke-r1", resultReference: decision.decisionId,
    resultVersion: decision.version, resultStatus: "REVOKED", recordedAt: "2026-08-26T01:00:00.000Z",
  });
  transaction.commit();
  unitOfWork.close();
}

function seedProductionTeamScope(unitOfWork: DurableAdministrationUnitOfWork, scope: Readonly<{
  tenantId: string; scopeType: "TEAM"; scopeId: string;
}>): void {
  const identity = { tenantId: scope.tenantId, resourceType: "TEAM_SCOPE" as const, resourceId: scope.scopeId };
  const createdEvidence = { type: "AUDIT" as const, id: "evidence-team-created-r2", version: 1 };
  const approvedEvidence = { type: "AUDIT" as const, id: "evidence-team-approved-r2", version: 1 };
  const proposal: AdministrationProposalRecord = {
    proposalId: "proposal-team-production-r2", tenantId: scope.tenantId, resourceType: "TEAM_SCOPE",
    resourceId: scope.scopeId, resourceVersion: 1, proposedBy: "principal-team-proposer-r2",
    proposedChangeReference: "change-team-production-r2", policyReference: "policy-team-production-r2",
    status: "PROPOSED", version: 1, reasonReference: "reason-team-production-r2",
    evidenceReferences: [createdEvidence], scope,
  };
  let transaction = unitOfWork.begin(identity);
  transaction.teamScopes.save({
    recordType: "TEAM_SCOPE", tenantId: scope.tenantId, teamId: scope.scopeId,
    organizationId: "organization-production-r2", scope, status: "PROPOSED", version: 1,
    evidenceReferences: [createdEvidence],
  });
  transaction.proposals.save(proposal);
  transaction.idempotency.record({
    ...identity, idempotencyKey: "idempotency-team-seed-propose-r2", operation: "PROPOSE_TEAM_SCOPE_CHANGE",
    fingerprint: "fingerprint-team-seed-propose-r2", resultReference: proposal.proposalId,
    resultVersion: 1, resultStatus: "PROPOSED", recordedAt: "2026-08-26T01:00:00.000Z",
  });
  transaction.commit();
  const decision: AdministrationDecisionRecord = {
    decisionId: "decision-team-production-r2", proposalId: proposal.proposalId, tenantId: scope.tenantId,
    operation: "APPROVE_TEAM_SCOPE_CHANGE", resourceType: "TEAM_SCOPE", resourceId: scope.scopeId, scope,
    proposerId: proposal.proposedBy, decisionActorId: "principal-team-approver-r2", status: "APPROVED",
    reasonReference: "reason-team-approved-r2", evidenceReferences: [approvedEvidence], version: 2,
    decidedAt: "2026-08-26T01:00:00.000Z",
  };
  transaction = unitOfWork.begin(identity);
  transaction.teamScopes.update(1, {
    recordType: "TEAM_SCOPE", tenantId: scope.tenantId, teamId: scope.scopeId,
    organizationId: "organization-production-r2", scope, status: "ACTIVE", version: 2,
    evidenceReferences: [createdEvidence, approvedEvidence],
  });
  transaction.proposals.update(1, {
    ...proposal, status: "APPROVED", version: 2, evidenceReferences: [createdEvidence, approvedEvidence],
  });
  transaction.decisions.append(decision);
  transaction.idempotency.record({
    ...identity, idempotencyKey: "idempotency-team-seed-approve-r2", operation: "APPROVE_TEAM_SCOPE_CHANGE",
    fingerprint: "fingerprint-team-seed-approve-r2", resultReference: decision.decisionId,
    resultVersion: 2, resultStatus: "ACTIVE", recordedAt: "2026-08-26T01:00:00.000Z",
  });
  transaction.commit();
}

function seedAdditionalProductionAuthority(
  unitOfWork: DurableAdministrationUnitOfWork,
  actor: SessionContext,
  roleId: string,
): void {
  assert.ok(actor.teamId);
  const identity = {
    tenantId, resourceType: "ROLE_ASSIGNMENT" as const,
    resourceId: `assignment-${actor.principalId}`,
  };
  const scope = { tenantId, scopeType: "TEAM" as const, scopeId: actor.teamId };
  const proposalId = `proposal-${actor.principalId}`;
  const createdEvidence = { type: "AUDIT" as const, id: `evidence-created-${actor.principalId}`, version: 1 };
  const approvedEvidence = { type: "AUDIT" as const, id: `evidence-approved-${actor.principalId}`, version: 1 };
  const assignment = (version: number, status: RoleAssignmentPersistenceRecord["status"]): RoleAssignmentPersistenceRecord => ({
    recordType: "ROLE_ASSIGNMENT", tenantId, roleAssignmentId: identity.resourceId, proposalId,
    subjectPrincipalId: actor.principalId, subjectPrincipalType: "HUMAN", roleId,
    teamIds: [actor.teamId!], resourceTypes: [
      `Administration:TENANT:${tenantId}`,
      `Administration:TEAM:${actor.teamId!}`,
    ],
    purposes: ["ACCESS_GOVERNANCE"], effectiveFrom: "2026-08-26T00:00:00.000Z",
    effectiveUntil: "2026-08-27T00:00:00.000Z", status, version,
    proposedBy: `principal-proposer-${actor.principalId}`,
    ...(status === "ACTIVE" ? { approvedBy: `principal-approver-${actor.principalId}` } : {}),
    reasonReference: `reason-${actor.principalId}`,
    evidenceReferences: status === "ACTIVE" ? [createdEvidence, approvedEvidence] : [createdEvidence], scope,
  });
  const proposal = (status: AdministrationProposalRecord["status"], version: number): AdministrationProposalRecord => ({
    proposalId, tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId,
    resourceVersion: 1, proposedBy: `principal-proposer-${actor.principalId}`,
    proposedChangeReference: `change-${actor.principalId}`, policyReference: "policy-authority-production-r2",
    status, version, reasonReference: `reason-${actor.principalId}`,
    evidenceReferences: status === "APPROVED" ? [createdEvidence, approvedEvidence] : [createdEvidence], scope,
  });
  let transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.save(assignment(1, "PROPOSED"));
  transaction.proposals.save(proposal("PROPOSED", 1));
  transaction.idempotency.record({
    ...identity, idempotencyKey: `idempotency-propose-${actor.principalId}`, operation: "PROPOSE_ROLE_ASSIGNMENT",
    fingerprint: `fingerprint-propose-${actor.principalId}`, resultReference: proposalId,
    resultVersion: 1, resultStatus: "PROPOSED", recordedAt: "2026-08-26T01:00:00.000Z",
  });
  transaction.commit();
  const decision: AdministrationDecisionRecord = {
    decisionId: `decision-${actor.principalId}`, proposalId, tenantId, operation: "APPROVE_ROLE_ASSIGNMENT",
    resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId, scope,
    proposerId: `principal-proposer-${actor.principalId}`, decisionActorId: `principal-approver-${actor.principalId}`,
    status: "APPROVED", reasonReference: `reason-approved-${actor.principalId}`,
    evidenceReferences: [approvedEvidence], version: 2, decidedAt: "2026-08-26T01:00:00.000Z",
  };
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision);
  transaction.idempotency.record({
    ...identity, idempotencyKey: `idempotency-approve-${actor.principalId}`, operation: "APPROVE_ROLE_ASSIGNMENT",
    fingerprint: `fingerprint-approve-${actor.principalId}`, resultReference: decision.decisionId,
    resultVersion: 2, resultStatus: "ACTIVE", recordedAt: "2026-08-26T01:00:00.000Z",
  });
  transaction.commit();
}

function seedProductionAuthority(databasePath: string): void {
  assert.ok(session.teamId);
  const sessionTeamId = session.teamId;
  const roleId = "role-production-r1";
  const assignmentId = "assignment-production-r1";
  const proposalId = "proposal-authority-production-r1";
  const authorityScope = { tenantId, scopeType: "TEAM" as const, scopeId: sessionTeamId };
  const createdEvidence = { type: "AUDIT" as const, id: "evidence-authority-created-r1", version: 1 };
  const approvedEvidence = { type: "AUDIT" as const, id: "evidence-authority-approved-r1", version: 1 };

  let unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
  unitOfWork.close();
  const database = new DatabaseSync(databasePath);
  const role = {
    recordType: "ROLE", tenantId, roleId, roleCode: "SEC", scope: { tenantId, scopeType: "TENANT", scopeId: tenantId },
    status: "ACTIVE", policyReference: "policy-role-production-r1", version: 1,
  };
  database.exec("BEGIN IMMEDIATE");
  database.prepare("INSERT INTO administration_revisions (tenant_id, resource_type, resource_id, revision) VALUES (?, 'ROLE', ?, 1)").run(tenantId, roleId);
  database.prepare("INSERT INTO administration_resources (tenant_id, resource_type, resource_id, version, scope_type, scope_id, payload_json) VALUES (?, 'ROLE', ?, 1, 'TENANT', ?, ?)").run(tenantId, roleId, tenantId, JSON.stringify(role));
  database.prepare("INSERT INTO administration_resource_evidence (tenant_id, resource_type, resource_id, sequence, payload_json) VALUES (?, 'ROLE', ?, 1, ?)").run(tenantId, roleId, JSON.stringify(createdEvidence));
  database.exec("COMMIT");
  database.close();

  const identity = { tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: assignmentId };
  const assignment = (version: number, status: RoleAssignmentPersistenceRecord["status"]): RoleAssignmentPersistenceRecord => ({
    recordType: "ROLE_ASSIGNMENT", tenantId, roleAssignmentId: assignmentId, proposalId,
    subjectPrincipalId: session.principalId, subjectPrincipalType: "HUMAN", roleId,
    teamIds: [sessionTeamId], resourceTypes: [
      "Administration:TARGET:target-scope-production-r1",
      `Administration:TENANT:${tenantId}`,
      `Administration:TEAM:${sessionTeamId}`,
    ],
    purposes: ["ACCESS_GOVERNANCE"], effectiveFrom: "2026-08-26T00:00:00.000Z",
    effectiveUntil: "2026-08-27T00:00:00.000Z", status, version, proposedBy: "principal-authority-proposer-r1",
    ...(status === "ACTIVE" ? { approvedBy: "principal-authority-approver-r1" } : {}),
    reasonReference: "reason-authority-production-r1",
    evidenceReferences: status === "ACTIVE" ? [createdEvidence, approvedEvidence] : [createdEvidence], scope: authorityScope,
  });
  const proposal = (status: AdministrationProposalRecord["status"], version: number): AdministrationProposalRecord => ({
    proposalId, tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: assignmentId, resourceVersion: 1,
    proposedBy: "principal-authority-proposer-r1", proposedChangeReference: "change-authority-production-r1",
    policyReference: "policy-authority-production-r1", status, version, reasonReference: "reason-authority-production-r1",
    evidenceReferences: status === "APPROVED" ? [createdEvidence, approvedEvidence] : [createdEvidence], scope: authorityScope,
  });
  const idempotency = (operation: AdministrationIdempotencyRecord["operation"], idempotencyKey: string, resultReference: string, resultVersion: number): AdministrationIdempotencyRecord => ({
    ...identity, idempotencyKey, operation, fingerprint: `fingerprint-${idempotencyKey}`,
    resultReference, resultVersion,
    resultStatus: operation === "PROPOSE_ROLE_ASSIGNMENT" ? "PROPOSED" : "ACTIVE",
    recordedAt: "2026-08-26T01:00:00.000Z",
  });
  unitOfWork = new DurableAdministrationUnitOfWork({ databasePath });
  seedProductionTeamScope(unitOfWork, authorityScope);
  let transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.save(assignment(1, "PROPOSED"));
  transaction.proposals.save(proposal("PROPOSED", 1));
  transaction.idempotency.record(idempotency("PROPOSE_ROLE_ASSIGNMENT", "idempotency-authority-propose-r1", proposalId, 1));
  transaction.commit();
  const decision: AdministrationDecisionRecord = {
    decisionId: "decision-authority-production-r1", proposalId, tenantId, operation: "APPROVE_ROLE_ASSIGNMENT",
    resourceType: "ROLE_ASSIGNMENT", resourceId: assignmentId, scope: authorityScope,
    proposerId: "principal-authority-proposer-r1", decisionActorId: "principal-authority-approver-r1",
    status: "APPROVED", reasonReference: "reason-authority-approved-r1", evidenceReferences: [approvedEvidence],
    version: 2, decidedAt: "2026-08-26T01:00:00.000Z",
  };
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision);
  transaction.idempotency.record(idempotency("APPROVE_ROLE_ASSIGNMENT", "idempotency-authority-approve-r1", decision.decisionId, 2));
  transaction.commit();
  seedAdditionalProductionAuthority(unitOfWork, decisionSession, roleId);
  unitOfWork.close();
}

function publicationTargetCommand(suffix = "r1") {
  return {
    tenantId,
    correlationId: `correlation-production-${suffix}`,
    operation: "PROPOSE_PUBLICATION_TARGET_GOVERNANCE",
    payload: {
      scope: { tenantId, scopeType: "TARGET", scopeId: "target-scope-production-r1" },
      expectedVersion: 0,
      idempotencyKey: `idempotency-production-${suffix}`,
      reason: "approved production durability verification",
      evidenceReferences: [{ type: "AUDIT", id: "evidence-production-r1", version: 1 }],
      name: "Production Target",
      targetType: "MLS_PORTAL",
      channelReference: "channel-production-r1",
      policyReference: "policy-production-r1",
      allowedFieldReferences: ["field-title"],
    },
  };
}

test("F16-R1 production HTTP composition persists API-015 mutation and idempotent replay across restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r1-production-"));
  const databasePath = join(directory, "administration.sqlite");
  let composition: ReturnType<typeof composeProductionAdministrationApi015NodeHttpServer> | undefined;
  try {
    seedProductionAuthority(databasePath);
    composition = composeProductionAdministrationApi015NodeHttpServer(productionOptions(databasePath));
    await composition.server.start();
    const firstOrigin = `http://127.0.0.1:${String(composition.server.diagnostics.boundPort)}`;
    const firstResponse = await fetch(`${firstOrigin}/administration/commands`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "request-production-r1", "x-session-id": sessionId },
      body: JSON.stringify(publicationTargetCommand()),
    });
    const firstBody = await firstResponse.json() as Record<string, unknown>;
    assert.equal(firstResponse.status, 200, JSON.stringify(firstBody));
    await composition.close();
    composition = undefined;

    composition = composeProductionAdministrationApi015NodeHttpServer(productionOptions(databasePath));
    await composition.server.start();
    const secondOrigin = `http://127.0.0.1:${String(composition.server.diagnostics.boundPort)}`;
    const replayResponse = await fetch(`${secondOrigin}/administration/commands`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "request-production-r1-replay", "x-session-id": sessionId },
      body: JSON.stringify(publicationTargetCommand()),
    });
    assert.equal(replayResponse.status, 200);
    assert.deepEqual(await replayResponse.json(), firstBody);

    const query = new URLSearchParams({
      tenantId,
      correlationId: "correlation-production-r1-query",
      operation: "LIST_PUBLICATION_TARGET_GOVERNANCE",
      scopeType: "TARGET",
      scopeId: "target-scope-production-r1",
      status: "PROPOSED",
      limit: "10",
    });
    const queryResponse = await fetch(`${secondOrigin}/administration/queries?${query}`, {
      headers: { "x-request-id": "request-production-r1-query", "x-session-id": sessionId },
    });
    assert.equal(queryResponse.status, 200);
    const queryBody = await queryResponse.json() as { success: boolean; data: { items: readonly unknown[] } };
    assert.equal(queryBody.success, true);
    assert.equal(queryBody.data.items.length, 1);

    revokeProductionAuthority(databasePath);
    const deniedResponse = await fetch(`${secondOrigin}/administration/commands`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "request-production-r1-revoked", "x-session-id": sessionId },
      body: JSON.stringify(publicationTargetCommand("revoked")),
    });
    assert.equal(deniedResponse.status, 404);
    const verification = new DurableAdministrationUnitOfWork({ databasePath });
    assert.equal(verification.publicationTargets.listByScope({ tenantId, scopeType: "TARGET", scopeId: "target-scope-production-r1" }).length, 1);
    verification.close();
    await composition.close();
    composition = undefined;
  } finally {
    await composition?.close();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R2 production HTTP composition executes Role, Team and Decision boundaries on the durable UoW", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f16-r2-production-"));
  const databasePath = join(directory, "administration.sqlite");
  let composition: ReturnType<typeof composeProductionAdministrationApi015NodeHttpServer> | undefined;
  try {
    seedProductionAuthority(databasePath);
    composition = composeProductionAdministrationApi015NodeHttpServer(productionOptions(databasePath));
    await composition.server.start();
    const origin = `http://127.0.0.1:${String(composition.server.diagnostics.boundPort)}`;
    assert.ok(session.teamId);
    const productionTeamId = session.teamId;
    const roleScope = { tenantId, scopeType: "TENANT" as const, scopeId: tenantId };
    const teamScope = { tenantId, scopeType: "TEAM" as const, scopeId: productionTeamId };
    const post = async (requestId: string, operation: string, payload: Record<string, unknown>, actorSessionId = sessionId) => fetch(`${origin}/administration/commands`, {
      method: "POST", headers: { "content-type": "application/json", "x-request-id": requestId, "x-session-id": actorSessionId },
      body: JSON.stringify({ tenantId, correlationId: `correlation-${requestId}`, operation, payload }),
    });
    const commandData = async (response: Response) => {
      const body = await response.json() as {
        success: boolean;
        data: { proposalId: string; decisionReferences: readonly string[]; status: string; version: number };
      };
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.success, true);
      return body.data;
    };
    const roleProposal = await commandData(await post("request-role-propose-r2", "PROPOSE_ROLE_CHANGE", {
      roleId: "role-production-r1", proposedChangeReference: "policy-role-production-r2",
      scope: roleScope, expectedVersion: 1, idempotencyKey: "idempotency-role-propose-r2",
      reason: "approved role change proposal", evidenceReferences: [{ type: "AUDIT", id: "evidence-role-propose-r2", version: 1 }],
    }));
    const roleApproval = await commandData(await post("request-role-approve-r2", "APPROVE_ROLE_CHANGE", {
      proposalId: roleProposal.proposalId, roleId: "role-production-r1", scope: roleScope,
      expectedVersion: 1, idempotencyKey: "idempotency-role-approve-r2", reason: "independent role approval",
      evidenceReferences: [{ type: "AUDIT", id: "evidence-role-approve-r2", version: 1 }],
    }, decisionSessionId));
    assert.equal(roleApproval.version, 2);
    const roleRejectionProposal = await commandData(await post("request-role-reject-propose-r2", "PROPOSE_ROLE_CHANGE", {
      roleId: "role-production-r1", proposedChangeReference: "policy-role-rejected-r2",
      scope: roleScope, expectedVersion: 2, idempotencyKey: "idempotency-role-reject-propose-r2",
      reason: "role rejection proposal", evidenceReferences: [{ type: "AUDIT", id: "evidence-role-reject-propose-r2", version: 1 }],
    }));
    const roleRejection = await commandData(await post("request-role-reject-r2", "REJECT_ROLE_CHANGE", {
      proposalId: roleRejectionProposal.proposalId, roleId: "role-production-r1", scope: roleScope,
      expectedVersion: 2, idempotencyKey: "idempotency-role-reject-r2", reason: "independent role rejection",
      evidenceReferences: [{ type: "AUDIT", id: "evidence-role-reject-r2", version: 1 }],
    }, decisionSessionId));
    assert.equal(roleRejection.status, "REJECTED");

    const teamProposal = await commandData(await post("request-team-propose-r2", "PROPOSE_TEAM_SCOPE_CHANGE", {
      teamId: productionTeamId, proposedChangeReference: "team-scope-production-r2",
      scope: teamScope, expectedVersion: 2, idempotencyKey: "idempotency-team-propose-r2",
      reason: "approved team scope change proposal", evidenceReferences: [{ type: "AUDIT", id: "evidence-team-propose-r2", version: 1 }],
    }));
    const teamApproval = await commandData(await post("request-team-approve-r2", "APPROVE_TEAM_SCOPE_CHANGE", {
      proposalId: teamProposal.proposalId, teamId: productionTeamId, scope: teamScope,
      expectedVersion: 2, idempotencyKey: "idempotency-team-approve-r2", reason: "independent team approval",
      evidenceReferences: [{ type: "AUDIT", id: "evidence-team-approve-r2", version: 1 }],
    }, decisionSessionId));
    assert.equal(teamApproval.version, 3);
    const teamRejectionProposal = await commandData(await post("request-team-reject-propose-r2", "PROPOSE_TEAM_SCOPE_CHANGE", {
      teamId: productionTeamId, proposedChangeReference: "team-scope-rejected-r2",
      scope: teamScope, expectedVersion: 3, idempotencyKey: "idempotency-team-reject-propose-r2",
      reason: "team rejection proposal", evidenceReferences: [{ type: "AUDIT", id: "evidence-team-reject-propose-r2", version: 1 }],
    }));
    const teamRejection = await commandData(await post("request-team-reject-r2", "REJECT_TEAM_SCOPE_CHANGE", {
      proposalId: teamRejectionProposal.proposalId, teamId: productionTeamId, scope: teamScope,
      expectedVersion: 3, idempotencyKey: "idempotency-team-reject-r2", reason: "independent team rejection",
      evidenceReferences: [{ type: "AUDIT", id: "evidence-team-reject-r2", version: 1 }],
    }, decisionSessionId));
    assert.equal(teamRejection.status, "REJECTED");

    const query = async (requestId: string, values: Record<string, string>) => fetch(
      `${origin}/administration/queries?${new URLSearchParams({ tenantId, correlationId: `correlation-${requestId}`, ...values })}`,
      { headers: { "x-request-id": requestId, "x-session-id": sessionId } },
    );
    const roleRead = await query("request-role-read-r2", {
      operation: "READ_ROLE", scopeType: "TENANT", scopeId: tenantId, roleId: "role-production-r1",
    });
    assert.equal(roleRead.status, 200);
    const teamRead = await query("request-team-read-r2", {
      operation: "READ_TEAM_SCOPE", scopeType: "TEAM", scopeId: productionTeamId, teamId: productionTeamId,
    });
    assert.equal(teamRead.status, 200);
    const decisionRead = await query("request-decision-read-r2", {
      operation: "READ_ADMINISTRATION_DECISION", scopeType: "TENANT", scopeId: tenantId,
      decisionId: roleApproval.decisionReferences[0]!,
    });
    assert.equal(decisionRead.status, 200);
    const decisionList = await query("request-decision-list-r2", {
      operation: "LIST_ADMINISTRATION_DECISIONS", scopeType: "TENANT", scopeId: tenantId,
      status: "APPROVED", limit: "10",
    });
    assert.equal(decisionList.status, 200);
    const decisionBody = await decisionList.json() as { data: { items: readonly unknown[] } };
    assert.equal(decisionBody.data.items.length >= 1, true);

    await composition.close();
    composition = undefined;
    const reopened = new DurableAdministrationUnitOfWork({ databasePath });
    const roleIdentity = { tenantId, resourceType: "ROLE" as const, resourceId: "role-production-r1" };
    const teamIdentity = { tenantId, resourceType: "TEAM_SCOPE" as const, resourceId: productionTeamId };
    assert.equal(reopened.roles.find(roleIdentity)?.policyReference, "policy-role-production-r2");
    assert.equal(reopened.roles.find(roleIdentity)?.version, 2);
    assert.equal(reopened.teamScopes.find(teamIdentity)?.organizationId, "organization-production-r2");
    assert.equal(reopened.teamScopes.find(teamIdentity)?.version, 3);
    assert.equal(reopened.decisions.list(roleIdentity).length, 2);
    assert.equal(reopened.decisions.list(teamIdentity).length, 3);
    assert.equal(reopened.idempotency.find({ ...roleIdentity, idempotencyKey: "idempotency-role-reject-r2" })?.resultStatus, "REJECTED");
    assert.equal(reopened.idempotency.find({ ...teamIdentity, idempotencyKey: "idempotency-team-reject-r2" })?.resultStatus, "REJECTED");
    reopened.close();
  } finally {
    await composition?.close();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("F16-R1 production Administration composition requires a durable file database path", () => {
  for (const databasePath of ["", "   ", ":memory:"]) {
    assert.throws(
      () => composeProductionAdministrationApi015NodeHttpServer({ ...requiredDependencies, databasePath }),
      (error: unknown) => error instanceof AdministrationPersistenceError
        && error.code === "PERSISTENCE_INPUT_INVALID",
    );
  }
});
