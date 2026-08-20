import assert from "node:assert/strict";
import test from "node:test";

import {
  AdministrationPersistenceError,
  InMemoryAdministrationUnitOfWork,
  type AdministrationDecisionRecord,
  type AdministrationIdempotencyRecord,
  type AdministrationProposalRecord,
  type AdministrationTransactionIdentity,
  type PolicyPersistenceRecord,
  type PublicationTargetGovernancePersistenceRecord,
  type RolePersistenceRecord,
  type RoleAssignmentPersistenceRecord,
  type SourceGovernancePersistenceRecord,
  type TeamScopePersistenceRecord,
} from "./administration-persistence.js";
import { createAdministrationPersistenceFailureInjector } from "./administration-persistence-test-support.js";

const identity: AdministrationTransactionIdentity = Object.freeze({
  tenantId: "tenant-1", resourceType: "ROLE_ASSIGNMENT", resourceId: "assignment-1",
});
const scope = Object.freeze({ tenantId: "tenant-1", scopeType: "TEAM" as const, scopeId: "team-1" });
const evidence = (id: string) => Object.freeze({ type: "AUDIT" as const, id, version: 1 });
const sourceMetadata = Object.freeze({
  name: "Fixture Source", sourceType: "PUBLIC_WEBSITE", allowedMethods: ["MANUAL_CAPTURE"] as const,
  allowedPurposes: ["LISTING_DISCOVERY"] as const, classification: "INTERNAL" as const,
});
const targetMetadata = Object.freeze({
  name: "Fixture Target", targetType: "MLS_PORTAL", allowedFieldReferences: ["field-title"] as const,
});

function assignment(version = 1, status: RoleAssignmentPersistenceRecord["status"] = "PROPOSED"): RoleAssignmentPersistenceRecord {
  return {
    recordType: "ROLE_ASSIGNMENT", tenantId: "tenant-1", roleAssignmentId: "assignment-1", proposalId: "proposal-1",
    scope, subjectPrincipalId: "principal-agent-1", subjectPrincipalType: "HUMAN", roleId: "role-agent-1",
    teamIds: ["team-1"], resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-08-14T00:00:00.000Z", effectiveUntil: "2026-09-14T00:00:00.000Z",
    status, version, proposedBy: "principal-admin-1", ...(status === "ACTIVE" ? { approvedBy: "principal-admin-2" } : {}),
    reasonReference: "reason-assignment-1", evidenceReferences: [evidence("evidence-assignment-1")],
  };
}

function proposal(status: AdministrationProposalRecord["status"] = "PROPOSED", version = 1): AdministrationProposalRecord {
  return {
    proposalId: "proposal-1", tenantId: "tenant-1", resourceType: "ROLE_ASSIGNMENT", resourceId: "assignment-1",
    resourceVersion: 1,
    scope, proposedBy: "principal-admin-1", proposedChangeReference: "change-assignment-1", policyReference: "policy-admin-1",
    status, version, reasonReference: "reason-proposal-1", evidenceReferences: [evidence("evidence-proposal-1")],
  };
}

function decision(): AdministrationDecisionRecord {
  return {
    decisionId: "decision-1", proposalId: "proposal-1", tenantId: "tenant-1", operation: "APPROVE_ROLE_ASSIGNMENT",
    resourceType: "ROLE_ASSIGNMENT", resourceId: "assignment-1", scope, proposerId: "principal-admin-1",
    decisionActorId: "principal-admin-2", status: "APPROVED", reasonReference: "reason-decision-1",
    evidenceReferences: [evidence("evidence-decision-1")], version: 2, decidedAt: "2026-08-14T01:00:00.000Z",
  };
}

function idempotency(fingerprint = "fingerprint-1"): AdministrationIdempotencyRecord {
  return {
    tenantId: "tenant-1", resourceType: "ROLE_ASSIGNMENT", resourceId: "assignment-1", idempotencyKey: "fixture-fixture-aaaa",
    operation: "APPROVE_ROLE_ASSIGNMENT", fingerprint, resultReference: "decision-1", resultVersion: 2,
    recordedAt: "2026-08-14T01:00:00.000Z",
  };
}

function expectCode(action: () => unknown, code: AdministrationPersistenceError["code"]): void {
  assert.throws(action, (error: unknown) => error instanceof AdministrationPersistenceError && error.code === code);
}

function stageApproval(transaction: ReturnType<InMemoryAdministrationUnitOfWork["begin"]>): void {
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision());
  transaction.idempotency.record(idempotency());
}

function stageRoleProposal(transaction: ReturnType<InMemoryAdministrationUnitOfWork["begin"]>): void {
  transaction.roleAssignments.save(assignment());
  transaction.proposals.save(proposal());
  transaction.idempotency.record({
    ...idempotency(), idempotencyKey: "fixture-fixture-bbbb", operation: "PROPOSE_ROLE_ASSIGNMENT", resultReference: "proposal-1", resultVersion: 1,
  });
}

test("F16-PHASE-6 repository writes and reads isolated immutable copies", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  const mutable = structuredClone(assignment()) as unknown as { teamIds: string[]; evidenceReferences: { type: string; id: string; version: number }[] } & RoleAssignmentPersistenceRecord;
  const transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.save(mutable);
  transaction.proposals.save(proposal());
  transaction.idempotency.record({ ...idempotency(), idempotencyKey: "fixture-fixture-bbbb", operation: "PROPOSE_ROLE_ASSIGNMENT", resultReference: "proposal-1", resultVersion: 1 });
  transaction.commit();
  mutable.teamIds.push("team-mutated");
  mutable.evidenceReferences.push({ type: "AUDIT", id: "evidence-mutated", version: 2 });

  const firstRead = unitOfWork.roleAssignments.find(identity);
  assert.deepEqual(firstRead?.teamIds, ["team-1"]);
  assert.deepEqual(firstRead?.evidenceReferences, [{ type: "AUDIT", id: "evidence-assignment-1", version: 1 }]);
  assert.equal(Object.isFrozen(firstRead), true);
  assert.equal(Object.isFrozen(firstRead?.teamIds), true);
  assert.equal(Object.isFrozen(firstRead?.evidenceReferences[0]), true);
  assert.throws(() => (firstRead?.teamIds as string[]).push("team-reader"));
  assert.deepEqual(unitOfWork.roleAssignments.find(identity)?.teamIds, ["team-1"]);
});

test("F16-PHASE-6 commits authoritative state, decision and idempotency atomically", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();

  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision());
  assert.equal(transaction.idempotency.record(idempotency()).status, "STORED");
  transaction.commit();

  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 2);
  assert.equal(unitOfWork.proposals.findById("tenant-1", "proposal-1")?.proposedBy, "principal-admin-1");
  assert.equal(unitOfWork.decisions.list(identity).length, 1);
  assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "fixture-fixture-aaaa" })?.resultVersion, 2);
});

for (const failurePoint of ["STATE_WRITE", "DECISION_APPEND", "IDEMPOTENCY_WRITE", "COMMIT"] as const) {
  test(`F16-PHASE-6 ${failurePoint} failure rolls back state, evidence and idempotency`, () => {
    const failures = createAdministrationPersistenceFailureInjector();
    const unitOfWork = new InMemoryAdministrationUnitOfWork(failures.port);
    let transaction = unitOfWork.begin(identity);
    stageRoleProposal(transaction);
    transaction.commit();

    failures.failNext(failurePoint);
    transaction = unitOfWork.begin(identity);
    expectCode(() => {
      transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
      transaction.proposals.update(1, proposal("APPROVED", 2));
      transaction.decisions.append(decision());
      transaction.idempotency.record(idempotency());
      transaction.commit();
    }, "PERSISTENCE_WRITE_FAILED");
    if (failurePoint !== "COMMIT") expectCode(() => transaction.commit(), "TRANSACTION_ROLLBACK_ONLY");

    assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
    assert.equal(unitOfWork.proposals.findById("tenant-1", "proposal-1")?.status, "PROPOSED");
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "fixture-fixture-aaaa" }), undefined);
  });
}

test("F16-PHASE-6 stale expected version changes no state, evidence or idempotency", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();

  transaction = unitOfWork.begin(identity);
  expectCode(() => transaction.roleAssignments.update(0, assignment(2, "ACTIVE")), "VERSION_CONFLICT");
  transaction.rollback();
  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
  assert.deepEqual(unitOfWork.decisions.list(identity), []);
  assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "fixture-fixture-aaaa" }), undefined);
});

test("F16-PHASE-6 idempotency replays identical intent and rejects collisions", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  stageApproval(transaction);
  transaction.commit();

  transaction = unitOfWork.begin(identity);
  assert.equal(transaction.idempotency.record(idempotency()).status, "REPLAYED");
  expectCode(() => transaction.idempotency.record(idempotency("fingerprint-conflict")), "IDEMPOTENCY_CONFLICT");
  transaction.rollback();
  assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "fixture-fixture-aaaa" })?.fingerprint, "fingerprint-1");
});

test("F16-PHASE-6 decision history is append-only and preserves original proposer", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  stageApproval(transaction);
  transaction.commit();

  assert.equal("update" in unitOfWork.decisions, false);
  assert.equal("delete" in unitOfWork.decisions, false);
  assert.equal(unitOfWork.decisions.list(identity)[0]?.proposerId, "principal-admin-1");
  transaction = unitOfWork.begin(identity);
  expectCode(() => transaction.proposals.update(2, { ...proposal("APPROVED", 3), proposedBy: "principal-admin-2" }), "PROPOSER_IMMUTABLE");
  transaction.rollback();
  transaction = unitOfWork.begin(identity);
  expectCode(() => transaction.decisions.append(decision()), "DECISION_DUPLICATE");
  transaction.rollback();
});

test("F16-PHASE-6 tenant and resource transaction scopes cannot alias", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();

  assert.equal(unitOfWork.roleAssignments.find({ ...identity, tenantId: "tenant-2" }), undefined);
  transaction = unitOfWork.begin({ ...identity, tenantId: "tenant-2" });
  expectCode(() => transaction.roleAssignments.save(assignment()), "PERSISTENCE_SCOPE_VIOLATION");
  transaction.rollback();
});

test("F16-PHASE-6 concurrent transactions fail closed instead of overwriting", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();

  const first = unitOfWork.begin(identity);
  expectCode(() => unitOfWork.begin(identity), "TRANSACTION_ALREADY_ACTIVE");
  stageApproval(first);
  first.commit();
  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 2);
  expectCode(() => first.commit(), "TRANSACTION_ALREADY_COMPLETED");
});

test("F16-PHASE-6 rejects incomplete or incoherent authoritative commit bundles", () => {
  for (const mismatch of ["MISSING", "DECISION_VERSION", "RESULT_VERSION", "RESULT_REFERENCE", "OPERATION"] as const) {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(identity);
    stageRoleProposal(transaction);
    transaction.commit();
    transaction = unitOfWork.begin(identity);
    transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
    if (mismatch !== "MISSING") {
      transaction.proposals.update(1, proposal("APPROVED", 2));
      transaction.decisions.append({ ...decision(), ...(mismatch === "DECISION_VERSION" ? { version: 99 } : {}) });
      transaction.idempotency.record({
        ...idempotency(),
        ...(mismatch === "RESULT_VERSION" ? { resultVersion: 77 } : {}),
        ...(mismatch === "RESULT_REFERENCE" ? { resultReference: "decision-other" } : {}),
        ...(mismatch === "OPERATION" ? { operation: "REJECT_ROLE_ASSIGNMENT" as const } : {}),
      });
    }
    expectCode(() => transaction.commit(), "ATOMIC_BUNDLE_INCOMPLETE");
    assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
    assert.equal(unitOfWork.idempotency.find({ ...identity, idempotencyKey: "fixture-fixture-aaaa" }), undefined);
  }
});

test("F16-PHASE-6 preserves role assignment proposal, proposer, subject and scope linkage", () => {
  for (const changed of [
    { proposalId: "proposal-other" },
    { proposedBy: "principal-other" },
    { subjectPrincipalId: "principal-other" },
    { roleId: "role-manager-1" },
    { teamIds: ["team-other"] },
    { resourceTypes: ["Publication"] },
    { purposes: ["ADMINISTRATION"] },
    { effectiveFrom: "2026-08-15T00:00:00.000Z" },
    { effectiveUntil: "2027-09-14T00:00:00.000Z" },
    { reasonReference: "reason-other" },
    { scope: { tenantId: "tenant-1", scopeType: "ORGANIZATION" as const, scopeId: "organization-1" } },
  ]) {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(identity);
    stageRoleProposal(transaction);
    transaction.commit();
    transaction = unitOfWork.begin(identity);
    expectCode(() => transaction.roleAssignments.update(1, { ...assignment(2, "ACTIVE"), ...changed }), changed.scope === undefined ? "PROPOSER_IMMUTABLE" : "PERSISTENCE_SCOPE_VIOLATION");
    expectCode(() => transaction.commit(), "TRANSACTION_ROLLBACK_ONLY");
    assert.deepEqual(unitOfWork.roleAssignments.find(identity), assignment());
  }
});

test("F16-PHASE-6 rejects decisions linked to a different proposal for the same resource", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  expectCode(() => transaction.decisions.append({ ...decision(), proposalId: "proposal-other" }), "PROPOSER_IMMUTABLE");
  expectCode(() => transaction.commit(), "TRANSACTION_ROLLBACK_ONLY");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
  assert.deepEqual(unitOfWork.decisions.list(identity), []);
});

test("F16-PHASE-6 permits at most one authoritative version advancement per transaction", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  expectCode(() => transaction.roleAssignments.update(2, assignment(3, "ACTIVE")), "VERSION_ADVANCEMENT_INVALID");
  expectCode(() => transaction.commit(), "TRANSACTION_ROLLBACK_ONLY");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
});

test("F16-PHASE-6 commits rejection evidence and idempotency without activating governed state", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.proposals.update(1, proposal("REJECTED", 2));
  transaction.decisions.append({ ...decision(), operation: "REJECT_ROLE_ASSIGNMENT", status: "REJECTED", version: 1 });
  transaction.idempotency.record({ ...idempotency(), operation: "REJECT_ROLE_ASSIGNMENT", resultVersion: 1 });
  transaction.commit();
  assert.equal(unitOfWork.roleAssignments.find(identity)?.status, "PROPOSED");
  assert.equal(unitOfWork.proposals.findById("tenant-1", "proposal-1")?.status, "REJECTED");
  assert.equal(unitOfWork.decisions.list(identity)[0]?.status, "REJECTED");
});

test("F16-PHASE-6 rejects multiple decision or idempotency creations in one transaction", () => {
  for (const duplicate of ["DECISION", "IDEMPOTENCY"] as const) {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(identity);
    stageRoleProposal(transaction);
    transaction.commit();
    transaction = unitOfWork.begin(identity);
    transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
    transaction.proposals.update(1, proposal("APPROVED", 2));
    transaction.decisions.append(decision());
    if (duplicate === "DECISION") {
      expectCode(() => transaction.decisions.append({ ...decision(), decisionId: "decision-2" }), "ATOMIC_BUNDLE_INCOMPLETE");
    } else {
      transaction.idempotency.record(idempotency());
      expectCode(() => transaction.idempotency.record({ ...idempotency(), idempotencyKey: "fixture-fixture-cccc" }), "ATOMIC_BUNDLE_INCOMPLETE");
    }
    expectCode(() => transaction.commit(), "TRANSACTION_ROLLBACK_ONLY");
    assert.deepEqual(unitOfWork.decisions.list(identity), []);
  }
});

test("F16-PHASE-6 proposes a change to an existing governed resource without mutating it", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  const nextProposal = { ...proposal(), proposalId: "proposal-2", resourceVersion: 1, proposedChangeReference: "change-assignment-2" };
  transaction.proposals.save(nextProposal);
  transaction.idempotency.record({ ...idempotency(), idempotencyKey: "fixture-fixture-dddd", operation: "PROPOSE_ROLE_ASSIGNMENT", resultReference: "proposal-2", resultVersion: 1 });
  transaction.commit();
  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 1);
  assert.equal(unitOfWork.proposals.findById("tenant-1", "proposal-2")?.resourceVersion, 1);
});

test("F16-PHASE-6 rejects operation-resource and lifecycle status mismatches", () => {
  for (const mismatch of ["RESOURCE", "STATUS"] as const) {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(identity);
    stageRoleProposal(transaction);
    transaction.commit();
    transaction = unitOfWork.begin(identity);
    transaction.roleAssignments.update(1, assignment(2, mismatch === "STATUS" ? "REVOKED" : "ACTIVE"));
    transaction.proposals.update(1, proposal("APPROVED", 2));
    transaction.decisions.append(decision());
    transaction.idempotency.record({ ...idempotency(), ...(mismatch === "RESOURCE" ? { operation: "APPROVE_POLICY_CHANGE" as const } : {}) });
    expectCode(() => transaction.commit(), "ATOMIC_BUNDLE_INCOMPLETE");
    assert.equal(unitOfWork.roleAssignments.find(identity)?.status, "PROPOSED");
  }
});

test("F16-PHASE-6 preserves original proposal policy, reason and evidence", () => {
  for (const changed of [
    { policyReference: "policy-other" },
    { reasonReference: "reason-other" },
    { evidenceReferences: [evidence("replacement")] },
  ]) {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(identity);
    stageRoleProposal(transaction);
    transaction.commit();
    transaction = unitOfWork.begin(identity);
    expectCode(() => transaction.proposals.update(1, { ...proposal("APPROVED", 2), ...changed }), "PROPOSER_IMMUTABLE");
    expectCode(() => transaction.commit(), "TRANSACTION_ROLLBACK_ONLY");
  }
});

test("F16-PHASE-6 rejects a stale proposal after the authoritative resource version advances", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  const stale = { ...proposal(), proposalId: "proposal-stale", proposedChangeReference: "change-stale", resourceVersion: 1 };
  transaction.proposals.save(stale);
  transaction.idempotency.record({ ...idempotency(), idempotencyKey: "idempotency-stale-proposal", operation: "PROPOSE_ROLE_ASSIGNMENT", resultReference: "proposal-stale", resultVersion: 1 });
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  stageApproval(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(2, { ...assignment(3, "ACTIVE"), approvedBy: "principal-admin-2" });
  transaction.proposals.update(1, { ...stale, status: "APPROVED", version: 2 });
  transaction.decisions.append({ ...decision(), decisionId: "decision-stale", proposalId: "proposal-stale", version: 3 });
  transaction.idempotency.record({ ...idempotency(), idempotencyKey: "idempotency-stale-decision", resultReference: "decision-stale", resultVersion: 3 });
  expectCode(() => transaction.commit(), "ATOMIC_BUNDLE_INCOMPLETE");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.version, 2);
  assert.equal(unitOfWork.decisions.list(identity).length, 1);
});

test("F16-PHASE-6 revokes through a successor proposal while preserving approver and appending evidence", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction); transaction.commit();
  transaction = unitOfWork.begin(identity); stageApproval(transaction); transaction.commit();
  const revokeProposal = { ...proposal(), proposalId: "proposal-revoke", proposedChangeReference: "change-revoke", resourceVersion: 2 };
  transaction = unitOfWork.begin(identity);
  transaction.proposals.save(revokeProposal);
  transaction.idempotency.record({ ...idempotency(), idempotencyKey: "idempotency-revoke-proposal", operation: "PROPOSE_ROLE_ASSIGNMENT", resultReference: "proposal-revoke", resultVersion: 1 });
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(2, { ...assignment(3, "REVOKED"), approvedBy: "principal-admin-2", revokedBy: "principal-admin-3", evidenceReferences: [...assignment().evidenceReferences, evidence("evidence-revoke")] });
  transaction.proposals.update(1, { ...revokeProposal, status: "REVOKED", version: 2, evidenceReferences: [...revokeProposal.evidenceReferences, evidence("evidence-revoke")] });
  transaction.decisions.append({ ...decision(), decisionId: "decision-revoke", proposalId: "proposal-revoke", operation: "REVOKE_ROLE_ASSIGNMENT", status: "REVOKED", version: 3, decisionActorId: "principal-admin-3" });
  transaction.idempotency.record({ ...idempotency(), idempotencyKey: "idempotency-revoke", operation: "REVOKE_ROLE_ASSIGNMENT", resultReference: "decision-revoke", resultVersion: 3 });
  transaction.commit();
  assert.equal(unitOfWork.roleAssignments.find(identity)?.approvedBy, "principal-admin-2");
  assert.deepEqual(unitOfWork.roleAssignments.find(identity)?.evidenceReferences.map(({ id }) => id), ["evidence-assignment-1", "evidence-revoke"]);
});

test("F16-PHASE-6 verifies non-role approval, rejection and governance transition families", () => {
  const policyIdentity = { tenantId: "tenant-1", resourceType: "POLICY" as const, resourceId: "policy-flow" };
  const policyScope = { tenantId: "tenant-1", scopeType: "POLICY" as const, scopeId: "policy-flow" };
  for (const outcome of ["APPROVED", "REJECTED"] as const) {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(policyIdentity);
    transaction.policies.save({ recordType: "POLICY", tenantId: "tenant-1", policyId: "policy-flow", scope: policyScope, status: "PROPOSED", version: 1, policyReference: "policy-ref", evidenceReferences: [evidence("policy-evidence")] });
    const policyProposal = { ...proposal(), proposalId: "proposal-policy", resourceType: "POLICY" as const, resourceId: "policy-flow", resourceVersion: 1, scope: policyScope };
    transaction.proposals.save(policyProposal);
    transaction.idempotency.record({ ...idempotency(), ...policyIdentity, idempotencyKey: "idem-policy-propose", operation: "PROPOSE_POLICY_CHANGE", resultReference: "proposal-policy", resultVersion: 1 });
    transaction.commit();
    transaction = unitOfWork.begin(policyIdentity);
    if (outcome === "APPROVED") transaction.policies.update(1, { recordType: "POLICY", tenantId: "tenant-1", policyId: "policy-flow", scope: policyScope, status: "ACTIVE", version: 2, policyReference: "policy-ref", evidenceReferences: [evidence("policy-evidence")] });
    transaction.proposals.update(1, { ...policyProposal, status: outcome, version: 2 });
    const operation = outcome === "APPROVED" ? "APPROVE_POLICY_CHANGE" as const : "REJECT_POLICY_CHANGE" as const;
    transaction.decisions.append({ ...decision(), decisionId: `decision-policy-${outcome}`, proposalId: "proposal-policy", resourceType: "POLICY", resourceId: "policy-flow", scope: policyScope, operation, status: outcome, version: outcome === "APPROVED" ? 2 : 1 });
    transaction.idempotency.record({ ...idempotency(), ...policyIdentity, idempotencyKey: `idem-policy-${outcome}`, operation, resultReference: `decision-policy-${outcome}`, resultVersion: outcome === "APPROVED" ? 2 : 1 });
    transaction.commit();
    assert.equal(unitOfWork.policies.find(policyIdentity)?.status, outcome === "APPROVED" ? "ACTIVE" : "PROPOSED");
  }

  for (const resourceType of ["SOURCE_REGISTRY", "PUBLICATION_TARGET"] as const) {
    const resourceId = resourceType === "SOURCE_REGISTRY" ? "source-flow" : "target-flow";
    const flowIdentity = { tenantId: "tenant-1", resourceType, resourceId };
    const flowScope = { tenantId: "tenant-1", scopeType: resourceType === "SOURCE_REGISTRY" ? "SOURCE" as const : "TARGET" as const, scopeId: resourceId };
    const operation = resourceType === "SOURCE_REGISTRY" ? "TRANSITION_SOURCE_GOVERNANCE" as const : "TRANSITION_PUBLICATION_TARGET_GOVERNANCE" as const;
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    let transaction = unitOfWork.begin(flowIdentity);
    if (resourceType === "SOURCE_REGISTRY") transaction.sourceGovernance.save({ recordType: "SOURCE_REGISTRY", tenantId: "tenant-1", sourceRegistryEntryId: resourceId, scope: flowScope, status: "DRAFT", version: 1, policyReference: "policy-ref", ...sourceMetadata, evidenceReferences: [evidence("flow-evidence")] });
    else transaction.publicationTargets.save({ recordType: "PUBLICATION_TARGET", tenantId: "tenant-1", publicationTargetId: resourceId, scope: flowScope, status: "PROPOSED", version: 1, policyReference: "policy-ref", channelReference: "channel-ref", ...targetMetadata, evidenceReferences: [evidence("flow-evidence")] });
    const initialProposal = { ...proposal(), proposalId: "proposal-flow", resourceType, resourceId, resourceVersion: 1, scope: flowScope };
    transaction.proposals.save(initialProposal);
    transaction.idempotency.record({ ...idempotency(), ...flowIdentity, idempotencyKey: "idem-flow-propose", operation: resourceType === "SOURCE_REGISTRY" ? "PROPOSE_SOURCE_GOVERNANCE" : "PROPOSE_PUBLICATION_TARGET_GOVERNANCE", resultReference: "proposal-flow", resultVersion: 1 });
    transaction.commit();
    transaction = unitOfWork.begin(flowIdentity);
    if (resourceType === "SOURCE_REGISTRY") transaction.sourceGovernance.update(1, { recordType: "SOURCE_REGISTRY", tenantId: "tenant-1", sourceRegistryEntryId: resourceId, scope: flowScope, status: "ACTIVE", version: 2, policyReference: "policy-ref", ...sourceMetadata, evidenceReferences: [evidence("flow-evidence")] });
    else transaction.publicationTargets.update(1, { recordType: "PUBLICATION_TARGET", tenantId: "tenant-1", publicationTargetId: resourceId, scope: flowScope, status: "ACTIVE", version: 2, policyReference: "policy-ref", channelReference: "channel-ref", ...targetMetadata, evidenceReferences: [evidence("flow-evidence")] });
    transaction.proposals.update(1, { ...initialProposal, status: "APPROVED", version: 2 });
    const approveOperation = resourceType === "SOURCE_REGISTRY" ? "APPROVE_SOURCE_GOVERNANCE" as const : "APPROVE_PUBLICATION_TARGET_GOVERNANCE" as const;
    transaction.decisions.append({ ...decision(), decisionId: "decision-flow-approve", proposalId: "proposal-flow", resourceType, resourceId, scope: flowScope, operation: approveOperation, version: 2 });
    transaction.idempotency.record({ ...idempotency(), ...flowIdentity, idempotencyKey: "idem-flow-approve", operation: approveOperation, resultReference: "decision-flow-approve", resultVersion: 2 });
    transaction.commit();
    const transitionProposal = { ...initialProposal, proposalId: "proposal-transition", proposedChangeReference: "change-transition", resourceVersion: 2 };
    transaction = unitOfWork.begin(flowIdentity);
    transaction.proposals.save(transitionProposal);
    transaction.idempotency.record({ ...idempotency(), ...flowIdentity, idempotencyKey: "idem-transition-propose", operation: resourceType === "SOURCE_REGISTRY" ? "PROPOSE_SOURCE_GOVERNANCE" : "PROPOSE_PUBLICATION_TARGET_GOVERNANCE", resultReference: "proposal-transition", resultVersion: 1 });
    transaction.commit();
    transaction = unitOfWork.begin(flowIdentity);
    if (resourceType === "SOURCE_REGISTRY") transaction.sourceGovernance.update(2, { recordType: "SOURCE_REGISTRY", tenantId: "tenant-1", sourceRegistryEntryId: resourceId, scope: flowScope, status: "PAUSED", version: 3, policyReference: "policy-ref", ...sourceMetadata, evidenceReferences: [evidence("flow-evidence")] });
    else transaction.publicationTargets.update(2, { recordType: "PUBLICATION_TARGET", tenantId: "tenant-1", publicationTargetId: resourceId, scope: flowScope, status: "PAUSED", version: 3, policyReference: "policy-ref", channelReference: "channel-ref", ...targetMetadata, evidenceReferences: [evidence("flow-evidence")] });
    transaction.proposals.update(1, { ...transitionProposal, status: "APPROVED", version: 2 });
    transaction.decisions.append({ ...decision(), decisionId: "decision-flow", proposalId: "proposal-transition", resourceType, resourceId, scope: flowScope, operation, version: 3 });
    transaction.idempotency.record({ ...idempotency(), ...flowIdentity, idempotencyKey: "idem-flow-transition", operation, resultReference: "decision-flow", resultVersion: 3 });
    transaction.commit();
    assert.equal(resourceType === "SOURCE_REGISTRY" ? unitOfWork.sourceGovernance.find(flowIdentity)?.status : unitOfWork.publicationTargets.find(flowIdentity)?.status, "PAUSED");
  }
});

test("F16-PHASE-6 rehydrates an existing canonical Role without creating proposal authority", () => {
  const roleScope = { tenantId: "tenant-1", scopeType: "TENANT" as const, scopeId: "tenant-1" };
  const roleIdentity = { tenantId: "tenant-1", resourceType: "ROLE" as const, resourceId: "role-existing" };
  const unitOfWork = InMemoryAdministrationUnitOfWork.rehydrate({ roles: [{
    recordType: "ROLE", tenantId: "tenant-1", roleId: "role-existing", scope: roleScope, status: "ACTIVE",
    roleCode: "AGT", version: 4, policyReference: "policy-role-v4", evidenceReferences: [evidence("role-hydration")],
  }] });
  assert.equal(unitOfWork.roles.find(roleIdentity)?.version, 4);
  assert.deepEqual(unitOfWork.roles.listByScope(roleScope).map(({ roleId }) => roleId), ["role-existing"]);

  let transaction = unitOfWork.begin(roleIdentity);
  const roleProposal = { ...proposal(), proposalId: "proposal-role-change", resourceType: "ROLE" as const, resourceId: "role-existing", resourceVersion: 4, scope: roleScope };
  transaction.proposals.save(roleProposal);
  transaction.idempotency.record({ ...idempotency(), ...roleIdentity, idempotencyKey: "idem-role-propose", operation: "PROPOSE_ROLE_CHANGE", resultReference: "proposal-role-change", resultVersion: 1 });
  transaction.commit();
  assert.equal(unitOfWork.roles.find(roleIdentity)?.version, 4);

  transaction = unitOfWork.begin(roleIdentity);
  transaction.roles.update(4, { recordType: "ROLE", tenantId: "tenant-1", roleId: "role-existing", roleCode: "AGT", scope: roleScope, status: "ACTIVE", version: 5, policyReference: "policy-role-v5", evidenceReferences: [evidence("role-hydration"), evidence("role-approved")] });
  transaction.proposals.update(1, { ...roleProposal, status: "APPROVED", version: 2 });
  transaction.decisions.append({ ...decision(), decisionId: "decision-role", proposalId: "proposal-role-change", resourceType: "ROLE", resourceId: "role-existing", scope: roleScope, operation: "APPROVE_ROLE_CHANGE", version: 5 });
  transaction.idempotency.record({ ...idempotency(), ...roleIdentity, idempotencyKey: "idem-role-approve", operation: "APPROVE_ROLE_CHANGE", resultReference: "decision-role", resultVersion: 5 });
  transaction.commit();
  assert.deepEqual(unitOfWork.roles.find(roleIdentity)?.evidenceReferences.map(({ id }) => id), ["role-hydration", "role-approved"]);
});

test("F16-PHASE-6 Role hydration rejects malformed snapshots and isolates caller input", () => {
  const base = { recordType: "ROLE" as const, tenantId: "tenant-1", roleId: "role-hydrated", roleCode: "AGT" as const, scope: { tenantId: "tenant-1", scopeType: "TENANT" as const, scopeId: "tenant-1" }, status: "ACTIVE" as const, version: 1, policyReference: "policy-role", evidenceReferences: [evidence("role-evidence")] };
  for (const invalid of [
    { ...base, version: 0 }, { ...base, version: -1 }, { ...base, version: 1.5 }, { ...base, roleId: " " },
    { ...base, tenantId: " " }, { ...base, scope: { ...base.scope, tenantId: "tenant-other" } },
    { ...base, evidenceReferences: [{ type: "AUDIT" as const, id: " ", version: 1 }] },
  ]) expectCode(() => InMemoryAdministrationUnitOfWork.rehydrate({ roles: [invalid] }), invalid.scope.tenantId !== invalid.tenantId ? "PERSISTENCE_SCOPE_VIOLATION" : "PERSISTENCE_INPUT_INVALID");
  expectCode(() => InMemoryAdministrationUnitOfWork.rehydrate({ roles: [base, base] }), "RECORD_ALREADY_EXISTS");

  const mutable = structuredClone(base);
  const hydrated = InMemoryAdministrationUnitOfWork.rehydrate({ roles: [mutable] });
  mutable.policyReference = "mutated";
  (mutable.evidenceReferences[0] as { id: string }).id = "mutated";
  const read = hydrated.roles.find({ tenantId: "tenant-1", resourceType: "ROLE", resourceId: "role-hydrated" });
  assert.equal(read?.policyReference, "policy-role");
  assert.equal(read?.evidenceReferences[0]?.id, "role-evidence");
});

test("F16-PHASE-6 revoke fails closed unless current authoritative state is ACTIVE", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  let transaction = unitOfWork.begin(identity);
  stageRoleProposal(transaction);
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "REVOKED"));
  transaction.proposals.update(1, proposal("REVOKED", 2));
  transaction.decisions.append({ ...decision(), operation: "REVOKE_ROLE_ASSIGNMENT", status: "REVOKED" });
  transaction.idempotency.record({ ...idempotency(), operation: "REVOKE_ROLE_ASSIGNMENT" });
  expectCode(() => transaction.commit(), "ATOMIC_BUNDLE_INCOMPLETE");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.status, "PROPOSED");
  assert.deepEqual(unitOfWork.decisions.list(identity), []);
});

test("F16-PHASE-6 bounded repositories persist every canonical governance record without generic access", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  const records = {
    role: { recordType: "ROLE", tenantId: "tenant-1", roleId: "role-1", roleCode: "AGT", scope, status: "ACTIVE", version: 1, policyReference: "policy-role-1", evidenceReferences: [evidence("evidence-role-1")] } satisfies RolePersistenceRecord,
    policy: { recordType: "POLICY", tenantId: "tenant-1", policyId: "policy-1", scope: { tenantId: "tenant-1", scopeType: "POLICY", scopeId: "policy-1" }, status: "PROPOSED", version: 1, policyReference: "policy-version-1", evidenceReferences: [evidence("evidence-policy-1")] } satisfies PolicyPersistenceRecord,
    team: { recordType: "TEAM_SCOPE", tenantId: "tenant-1", teamId: "team-1", scope, status: "PROPOSED", version: 1, organizationId: "organization-1", evidenceReferences: [evidence("evidence-team-1")] } satisfies TeamScopePersistenceRecord,
    source: { recordType: "SOURCE_REGISTRY", tenantId: "tenant-1", sourceRegistryEntryId: "source-1", scope: { tenantId: "tenant-1", scopeType: "SOURCE", scopeId: "source-1" }, status: "DRAFT", version: 1, policyReference: "source-policy-1", ...sourceMetadata, evidenceReferences: [evidence("evidence-source-1")] } satisfies SourceGovernancePersistenceRecord,
    target: { recordType: "PUBLICATION_TARGET", tenantId: "tenant-1", publicationTargetId: "target-1", scope: { tenantId: "tenant-1", scopeType: "TARGET", scopeId: "target-1" }, status: "PROPOSED", version: 1, policyReference: "target-policy-1", channelReference: "channel-1", ...targetMetadata, evidenceReferences: [evidence("evidence-target-1")] } satisfies PublicationTargetGovernancePersistenceRecord,
  };
  const cases = [
    { identity: { tenantId: "tenant-1", resourceType: "POLICY", resourceId: "policy-1" } as const, operation: "PROPOSE_POLICY_CHANGE" as const, scope: records.policy.scope, save: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.policies.save(records.policy), replaceEvidence: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.policies.update(1, { ...records.policy, version: 2, evidenceReferences: [evidence("replacement")] }), find: () => unitOfWork.policies.find({ tenantId: "tenant-1", resourceType: "POLICY", resourceId: "policy-1" }) },
    { identity: { tenantId: "tenant-1", resourceType: "TEAM_SCOPE", resourceId: "team-1" } as const, operation: "PROPOSE_TEAM_SCOPE_CHANGE" as const, scope: records.team.scope, save: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.teamScopes.save(records.team), replaceEvidence: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.teamScopes.update(1, { ...records.team, version: 2, evidenceReferences: [evidence("replacement")] }), find: () => unitOfWork.teamScopes.find({ tenantId: "tenant-1", resourceType: "TEAM_SCOPE", resourceId: "team-1" }) },
    { identity: { tenantId: "tenant-1", resourceType: "SOURCE_REGISTRY", resourceId: "source-1" } as const, operation: "PROPOSE_SOURCE_GOVERNANCE" as const, scope: records.source.scope, save: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.sourceGovernance.save(records.source), replaceEvidence: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.sourceGovernance.update(1, { ...records.source, version: 2, evidenceReferences: [evidence("replacement")] }), find: () => unitOfWork.sourceGovernance.find({ tenantId: "tenant-1", resourceType: "SOURCE_REGISTRY", resourceId: "source-1" }) },
    { identity: { tenantId: "tenant-1", resourceType: "PUBLICATION_TARGET", resourceId: "target-1" } as const, operation: "PROPOSE_PUBLICATION_TARGET_GOVERNANCE" as const, scope: records.target.scope, save: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.publicationTargets.save(records.target), replaceEvidence: (transaction: ReturnType<typeof unitOfWork.begin>) => transaction.publicationTargets.update(1, { ...records.target, version: 2, evidenceReferences: [evidence("replacement")] }), find: () => unitOfWork.publicationTargets.find({ tenantId: "tenant-1", resourceType: "PUBLICATION_TARGET", resourceId: "target-1" }) },
  ];
  for (const entry of cases) {
    const transaction = unitOfWork.begin(entry.identity);
    entry.save(transaction);
    const proposalId = `proposal-${entry.identity.resourceId}`;
    transaction.proposals.save({
      ...proposal(), proposalId, resourceType: entry.identity.resourceType, resourceId: entry.identity.resourceId,
      scope: entry.scope, proposedChangeReference: `change-${entry.identity.resourceId}`,
    });
    transaction.idempotency.record({
      ...idempotency(), ...entry.identity, idempotencyKey: `idempotency-${entry.identity.resourceId}`,
      operation: entry.operation, resultReference: proposalId, resultVersion: 1,
    });
    transaction.commit();
    assert.equal(entry.find()?.version, 1);
    const evidenceRewrite = unitOfWork.begin(entry.identity);
    expectCode(() => entry.replaceEvidence(evidenceRewrite), "PROPOSER_IMMUTABLE");
    expectCode(() => evidenceRewrite.commit(), "TRANSACTION_ROLLBACK_ONLY");
  }
  assert.deepEqual(unitOfWork.roles.listByScope(scope).map(({ roleId }) => roleId), []);
  assert.deepEqual(unitOfWork.policies.listByScope(records.policy.scope).map(({ policyId }) => policyId), ["policy-1"]);
  assert.deepEqual(unitOfWork.teamScopes.listByScope(scope).map(({ teamId }) => teamId), ["team-1"]);
  assert.deepEqual(unitOfWork.sourceGovernance.listByScope(records.source.scope).map(({ sourceRegistryEntryId }) => sourceRegistryEntryId), ["source-1"]);
  assert.deepEqual(unitOfWork.publicationTargets.listByScope(records.target.scope).map(({ publicationTargetId }) => publicationTargetId), ["target-1"]);
  assert.equal("repository" in unitOfWork, false);
});
