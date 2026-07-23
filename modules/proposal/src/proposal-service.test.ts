import assert from "node:assert/strict";
import test from "node:test";
import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { MatchResult } from "../../matching/src/matching-service.js";
import type { Permission } from "../../permission/src/permission-service.js";
import { ProposalService } from "./proposal-service.js";

let now = new Date("2026-07-23T01:00:00.000Z");
let sequence = 0;
const clock = () => new Date(now);
const idFactory = () => `proposal-id-${String(++sequence)}`;

function actor(id: string, roles: SessionContext["roles"], teamId = "team-a"): SessionContext {
  return Object.freeze({
    id: `session-${id}`,
    principalId: id,
    principalType: "HUMAN",
    roles: Object.freeze([...roles]),
    teamId,
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-07-23T00:00:00.000Z",
    expiresAt: "2026-07-24T00:00:00.000Z",
    absoluteExpiresAt: "2026-07-25T00:00:00.000Z",
    familyId: `family-${id}`,
    refreshReference: `refresh-${id}`,
  });
}

const match: MatchResult = Object.freeze({
  id: "match-1", version: 3, runId: "run-1", teamId: "team-a", status: "ACCEPTED", authority: "ADVISORY", classification: "RESTRICTED_PERSONAL",
  requirementRef: { id: "requirement-1", version: 2 }, candidateRef: { id: "candidate-1", version: 4 }, offerRef: { id: "offer-1", version: 5 },
  hardEligibility: "PASS", hardMatchCount: 1, score: 100, budgetFit: 100, rank: 1, components: [],
  explanation: { kind: "DETERMINISTIC", reasonCodes: [], limitations: [] }, matcherVersion: "deterministic-matching-v1", policyVersion: "matching-v1",
  calculatedAt: "2026-07-22T00:00:00.000Z", reviewHistory: [],
} as const);

const permission: Permission = Object.freeze({
  id: "permission-1", version: 3, teamId: "team-a",
  subjectRef: { entityType: "CandidateListing", entityId: "candidate-1", version: 4 },
  verificationId: "verification-1", verificationVersion: 2, fieldScope: ["PRICE", "AVAILABILITY"],
  permissionType: "CLIENT_SHARING", permissionPurpose: "PURPOSE_CLIENT_PRESENTATION",
  audience: { code: "AUD_NAMED_CLIENT", recipientRef: { entityType: "Client", entityId: "client-1", version: 2 } },
  status: "ACTIVE", createdBy: "pmr-1", requestedAt: "2026-07-22T00:00:00.000Z", validFrom: "2026-07-22T00:00:00.000Z", validUntil: "2026-07-30T00:00:00.000Z",
  validityBasis: "DEFAULT_14_DAYS", reviewHistory: [], approvalHistory: [{ actorId: "pmr-1", decision: "GRANTED", reason: "Client sharing approved", occurredAt: "2026-07-22T00:00:00.000Z", managerOverride: false }],
  statusHistory: [], classification: "RESTRICTED_PERSONAL", policyVersion: "permission-v1",
} as const);

function fixture() {
  sequence = 0;
  now = new Date("2026-07-23T01:00:00.000Z");
  const audit = new AuditLog({ clock, idFactory });
  const base = { teamIds: ["team-a"], resourceTypes: ["ClientProposal"], purposes: ["PURPOSE_CLIENT_PRESENTATION"], effectiveFrom: "2026-07-22T00:00:00.000Z", effectiveUntil: "2026-07-30T00:00:00.000Z", status: "ACTIVE" as const };
  const assignments: readonly RoleAssignment[] = [
    { ...base, id: "assignment-agent", principalId: "agent-1", role: "AGT" },
    { ...base, id: "assignment-reviewer", principalId: "senior-1", role: "SAG" },
  ];
  const authorization = new AuthorizationService({ assignments, auditSink: audit, clock, policyVersion: "authorization-v1" });
  let currentPermission: Permission = permission;
  const service = new ProposalService({ authorizationService: authorization, auditSink: audit, clock, idFactory, policyVersion: "proposal-v1", matchResultResolver: (id: string) => id === match.id ? match : undefined, permissionResolver: (id: string) => id === currentPermission.id ? currentPermission : undefined });
  return { service, audit, setPermission: (value: Permission) => { currentPermission = value; } };
}

const context = (id: string, roles: SessionContext["roles"]) => ({ actor: actor(id, roles), purpose: "PURPOSE_CLIENT_PRESENTATION" as const, correlationId: `correlation-${id}` });

test("TEST-021 creates, reads and reviews a Client Proposal without creating Publication Approval", () => {
  const { service } = fixture();
  const draft = service.createProposal({ ...context("agent-1", ["AGT"]), matchResultId: match.id, clientRef: { entityType: "Client", entityId: "client-1", version: 2 }, permissionId: permission.id, representationChecksum: "sha256:proposal-checksum", reason: "Prepare exact client-scoped proposal", idempotencyKey: "proposal-create-1" });
  assert.equal(draft.status, "DRAFT"); assert.equal(Object.isFrozen(draft), true); assert.equal("publicationApprovalId" in draft, false); assert.equal("publicationId" in draft, false);
  assert.equal(service.readProposal({ ...context("agent-1", ["AGT"]), proposalId: draft.id }).id, draft.id);
  const pending = service.reviewProposal({ ...context("agent-1", ["AGT"]), proposalId: draft.id, expectedVersion: draft.version, decision: "SUBMIT", reason: "Ready for independent review", idempotencyKey: "proposal-submit-1" });
  const approved = service.reviewProposal({ ...context("senior-1", ["SAG"]), proposalId: draft.id, expectedVersion: pending.version, decision: "APPROVE", reason: "Exact client representation approved", idempotencyKey: "proposal-approve-1" });
  assert.equal(approved.status, "APPROVED_TO_SHARE");
  assert.deepEqual(service.readHistory({ ...context("senior-1", ["SAG"]), proposalId: draft.id }).map((item: { readonly status: string }) => item.status), ["DRAFT", "REVIEW_PENDING", "APPROVED_TO_SHARE"]);
});

test("TEST-021 records share and feedback as append-only evidence and keeps authority isolated", () => {
  const { service, audit } = fixture();
  const draft = service.createProposal({ ...context("agent-1", ["AGT"]), matchResultId: match.id, clientRef: { entityType: "Client", entityId: "client-1", version: 2 }, permissionId: permission.id, representationChecksum: "sha256:proposal-checksum", reason: "Prepare proposal", idempotencyKey: "proposal-create-2" });
  const pending = service.reviewProposal({ ...context("agent-1", ["AGT"]), proposalId: draft.id, expectedVersion: draft.version, decision: "SUBMIT", reason: "Submit proposal", idempotencyKey: "proposal-submit-2" });
  const approved = service.reviewProposal({ ...context("senior-1", ["SAG"]), proposalId: draft.id, expectedVersion: pending.version, decision: "APPROVE", reason: "Approve proposal", idempotencyKey: "proposal-approve-2" });
  const shared = service.recordProposalShare({ ...context("agent-1", ["AGT"]), proposalId: approved.id, expectedVersion: approved.version, audience: permission.audience, channel: "SECURE_CLIENT_PORTAL", reason: "Record approved client share", idempotencyKey: "proposal-share-2" });
  const feedback = service.recordProposalFeedback({ ...context("agent-1", ["AGT"]), proposalId: shared.id, expectedVersion: shared.version, feedbackReference: "feedback-ref-1", summary: "Client requested a price clarification", idempotencyKey: "proposal-feedback-2" });
  assert.equal(shared.status, "SHARED"); assert.equal(feedback.status, "FEEDBACK_RECEIVED"); assert.equal(feedback.shareHistory.length, 1); assert.equal(feedback.feedbackHistory.length, 1); assert.equal(Object.isFrozen(feedback.feedbackHistory[0]), true);
  assert.equal(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY", targetId: draft.id }).some((event) => event.eventType === "PROPOSAL_SHARED"), true);
});

test("TEST-021 fails closed for invalid Permission, self-review and idempotency conflict", () => {
  const { service, setPermission } = fixture();
  const input = { ...context("agent-1", ["AGT"]), matchResultId: match.id, clientRef: { entityType: "Client", entityId: "client-1", version: 2 }, permissionId: permission.id, representationChecksum: "sha256:proposal-checksum", reason: "Prepare proposal", idempotencyKey: "proposal-create-3" } as const;
  const draft = service.createProposal(input); assert.equal(service.createProposal(input).id, draft.id);
  assert.throws(() => service.createProposal({ ...input, representationChecksum: "sha256:changed" }), /IDEMPOTENCY_CONFLICT/u);
  const pending = service.reviewProposal({ ...context("agent-1", ["AGT"]), proposalId: draft.id, expectedVersion: draft.version, decision: "SUBMIT", reason: "Submit proposal", idempotencyKey: "proposal-submit-3" });
  assert.throws(() => service.reviewProposal({ ...context("agent-1", ["SAG"]), proposalId: draft.id, expectedVersion: pending.version, decision: "APPROVE", reason: "Self approval denied", idempotencyKey: "proposal-self-review" }), /SEPARATION_OF_DUTIES_DENIED|CAPABILITY_DENIED/u);
  setPermission(Object.freeze({ ...permission, status: "REVOKED" }));
  assert.throws(() => service.recordProposalShare({ ...context("agent-1", ["AGT"]), proposalId: draft.id, expectedVersion: pending.version, audience: permission.audience, channel: "SECURE_CLIENT_PORTAL", reason: "Cannot share", idempotencyKey: "proposal-invalid-share" }), /PERMISSION_REQUIRED|STATE_TRANSITION_INVALID/u);
});
