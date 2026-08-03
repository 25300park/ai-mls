import assert from "node:assert/strict";
import test from "node:test";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { PublicationApproval, ApprovalReviewContext, EffectiveApprovalDecision, ImmutableRepresentationSnapshot } from "../../../modules/publication-approval/src/publication-approval-service.js";
import type { ClientProposal } from "../../../modules/proposal/src/proposal-service.js";
import { composeApiModulesBeforePublication, type ApiModuleDependencies } from "./composition.js";
import { ProposalApprovalApi } from "./proposal-approval-api.js";

const baseActor: SessionContext = Object.freeze({ id: "session-pua", principalId: "pua-1", principalType: "HUMAN", roles: ["PUA"], teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-23T00:00:00.000Z", expiresAt: "2026-07-24T00:00:00.000Z", absoluteExpiresAt: "2026-07-25T00:00:00.000Z", familyId: "family-pua", refreshReference: "refresh-pua" } as const);
const context = { sessionId: baseActor.id, requestId: "request-1", correlationId: "correlation-1" } as const;
const approval = Object.freeze({ id: "approval-1", version: 2, status: "UNDER_REVIEW", assignedApproverActorId: "pua-1", targetId: "target-1", channelId: "channel-1", representationId: "representation-1", representationVersion: 1, representationChecksum: "sha256:checksum", requestedAt: "2026-07-23T01:00:00.000Z", expiresAt: "2026-07-28T00:00:00.000Z", approvedFieldScope: ["PRICE"], approvedMediaScope: [], audience: { code: "AUD_PUBLIC" }, language: "en" } as unknown as PublicationApproval);
const representation = Object.freeze({ id: "representation-1", version: 1, checksum: "sha256:checksum" } as unknown as ImmutableRepresentationSnapshot);
const proposal = Object.freeze({ id: "proposal-1", version: 1, status: "DRAFT" } as unknown as ClientProposal);
const reviewContext = Object.freeze({ approval, representation, verificationValid: true, permissionValid: true, targetPolicyValid: true, actorEligible: true, actorConflictReasonCodes: [], privacyResult: "MASKED_AND_MINIMIZED", safeReasonCodes: [] } as const) satisfies ApprovalReviewContext;
const effective = Object.freeze({ effective: true, approvalId: approval.id, approvalVersion: approval.version, checkedAt: "2026-07-23T02:00:00.000Z", effectiveScope: { targetId: "target-1", channelId: "channel-1", fieldScope: ["PRICE"], mediaScope: [], audience: { code: "AUD_PUBLIC" }, language: "en" }, expiresAt: approval.expiresAt, reasonCodes: ["APPROVAL_EFFECTIVE"] } as const) satisfies EffectiveApprovalDecision;

function dependencies(calls: { readonly name: string; readonly actorId: string }[], actor = baseActor) {
  const capture = <T>(name: string, result: T) => (request: { readonly actor: SessionContext }) => { calls.push({ name, actorId: request.actor.principalId }); return result; };
  return {
    sessionReader: () => actor,
    proposalService: {
      createProposal: capture("CreateProposal", proposal), readProposal: capture("ReadProposal", proposal), reviewProposal: capture("ReviewProposal", proposal), recordProposalShare: capture("RecordProposalShare", proposal), recordProposalFeedback: capture("RecordProposalFeedback", proposal), readHistory: capture("ReadProposalHistory", [proposal]),
    },
    publicationApprovalService: {
      createRepresentationSnapshot: capture("CreateRepresentationSnapshot", representation),
      readApproval: capture("ReadApproval", approval), listApprovalQueue: capture("ListApprovalQueue", [approval]), getApprovalReviewContext: capture("GetApprovalReviewContext", reviewContext), checkEffectiveApproval: capture("CheckEffectiveApproval", effective),
      createApprovalRequest: capture("CreateApprovalRequest", approval), assignOrClaimApprover: capture("AssignOrClaimApprover", approval), reassignOrReleaseApprover: capture("ReassignOrReleaseApprover", approval), decideApproval: capture("DecideApproval", approval), revokeApproval: capture("RevokeApproval", approval), expireApproval: capture("ExpireApproval", approval), readApprovalHistory: capture("ReadApprovalHistory", [approval]),
    },
  };
}

test("TEST-021 API-013 keeps Proposal namespace and authority separate from Publication Approval", () => {
  const calls: { readonly name: string; readonly actorId: string }[] = []; const api = new ProposalApprovalApi(dependencies(calls));
  const results = [api.createProposal({ context } as never), api.readProposal({ context } as never), api.reviewProposal({ context } as never), api.recordProposalShare({ context } as never), api.recordProposalFeedback({ context } as never)];
  assert.equal(results.every((result) => result.ok && result.data.screenId === "UI-025"), true);
  assert.deepEqual(calls.map((call) => call.name), ["CreateProposal", "ReadProposal", "ReviewProposal", "RecordProposalShare", "RecordProposalFeedback"]);
  assert.equal(calls.every((call) => call.actorId === "pua-1"), true);
  assert.equal(JSON.stringify(results).includes("PublicationApproval"), false);
});

test("TEST-022/033 API-013 exposes all ten canonical Approval operations with session-derived Actor", () => {
  const calls: { readonly name: string; readonly actorId: string }[] = []; const api = new ProposalApprovalApi(dependencies(calls));
  const responses = [
    api.readApproval({ context } as never), api.listApprovalQueue({ context, purpose: "PURPOSE_PUBLICATION_APPROVAL" } as never), api.getApprovalReviewContext({ context } as never), api.checkEffectiveApproval({ context } as never),
    api.createApprovalRequest({ context } as never), api.assignOrClaimApprover({ context } as never), api.reassignOrReleaseApprover({ context } as never), api.decideApproval({ context } as never), api.revokeApproval({ context } as never), api.expireApproval({ context } as never),
  ];
  assert.equal(responses.every((response) => response.ok), true);
  assert.deepEqual([...new Set(calls.map((call) => call.name))], ["ReadApproval", "ListApprovalQueue", "GetApprovalReviewContext", "CheckEffectiveApproval", "CreateApprovalRequest", "AssignOrClaimApprover", "ReassignOrReleaseApprover", "DecideApproval", "RevokeApproval", "ExpireApproval"]);
  assert.equal(calls.every((call) => call.actorId === "pua-1"), true);
  assert.equal(calls.some((call) => /Deliver|Publish|Connector|Reconcile/u.test(call.name)), false);
});

test("UI-029 and UI-030 expose bounded role-aware actions and accessible safe states", () => {
  const calls: { readonly name: string; readonly actorId: string }[] = []; const puaApi = new ProposalApprovalApi(dependencies(calls));
  const queue = puaApi.listApprovalQueue({ context, purpose: "PURPOSE_PUBLICATION_APPROVAL" } as never); const detail = puaApi.getApprovalReviewContext({ context } as never);
  assert.equal(queue.ok && queue.data.screenId, "UI-029"); assert.equal(detail.ok && detail.data.screenId, "UI-030");
  if (queue.ok && detail.ok) { assert.equal(queue.data.items[0]?.allowedActions.includes("RELEASE"), true); assert.equal(queue.data.items[0]?.eligibility, "ELIGIBLE"); assert.equal(detail.data.allowedActions.includes("APPROVE"), true); assert.equal(queue.data.accessibility.keyboardOperable, true); assert.equal(detail.data.reviewContext?.privacyResult, "MASKED_AND_MINIMIZED"); assert.equal(JSON.stringify(detail.data).match(/phone|email|contactValue/giu), null); }
  const manager: SessionContext = Object.freeze({ ...baseActor, id: "session-manager", principalId: "manager-1", roles: ["MGR"] satisfies SessionContext["roles"] }); const managerApi = new ProposalApprovalApi(dependencies([], manager)); const managerDetail = managerApi.readApproval({ context: { ...context, sessionId: manager.id } } as never);
  assert.deepEqual(managerDetail.ok ? managerDetail.data.allowedActions : [], ["READ"]);
});

test("UI-029 and UI-030 suppress claim and decision actions for actor-level conflicts", () => {
  const conflictedContext = Object.freeze({ ...reviewContext, actorConflictReasonCodes: ["APPROVAL_CONFLICT"] });
  const deps = dependencies([]); const api = new ProposalApprovalApi({ ...deps, publicationApprovalService: { ...deps.publicationApprovalService, getApprovalReviewContext: () => conflictedContext } });
  const queue = api.listApprovalQueue({ context, purpose: "PURPOSE_PUBLICATION_APPROVAL" } as never); const detail = api.getApprovalReviewContext({ context } as never);
  assert.equal(queue.ok && queue.data.items[0]?.eligibility, "CONFLICTED"); assert.deepEqual(queue.ok ? queue.data.items[0]?.allowedActions : [], ["READ"]); assert.deepEqual(detail.ok ? detail.data.allowedActions : [], ["READ"]);
});

test("UI-029 and UI-030 suppress actions when current PUA eligibility is revoked", () => {
  const ineligibleContext = Object.freeze({ ...reviewContext, actorEligible: false }); const deps = dependencies([]); const api = new ProposalApprovalApi({ ...deps, publicationApprovalService: { ...deps.publicationApprovalService, getApprovalReviewContext: () => ineligibleContext } });
  const queue = api.listApprovalQueue({ context, purpose: "PURPOSE_PUBLICATION_APPROVAL" } as never); const detail = api.getApprovalReviewContext({ context } as never); assert.equal(queue.ok && queue.data.items[0]?.eligibility, "NOT_PUA"); assert.deepEqual(queue.ok ? queue.data.items[0]?.allowedActions : [], ["READ"]); assert.deepEqual(detail.ok ? detail.data.allowedActions : [], ["READ"]);
});

test("API-013 returns stable safe semantic errors without restricted evidence", () => {
  const api = new ProposalApprovalApi({ ...dependencies([]), publicationApprovalService: { ...dependencies([]).publicationApprovalService, decideApproval: () => { throw new Error("APPROVAL_CONFLICT"); } } });
  const response = api.decideApproval({ context } as never); assert.equal(response.ok, false); if (!response.ok) { assert.equal(response.error.code, "APPROVAL_CONFLICT"); assert.equal(response.error.message, "Request could not be completed."); }
  assert.equal(JSON.stringify(response).match(/verifier-1|pmr-1|contactValue/giu), null);
});

test("SP-008 composition adds API-013 without replacing API-001 through API-012", () => {
  const deps = dependencies([]); const composed = composeApiModulesBeforePublication({ sessionService: { readSession: () => baseActor }, proposalService: deps.proposalService, publicationApprovalService: deps.publicationApprovalService, permissionService: {}, verificationService: {}, authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {}, contactService: {}, clientRequirementService: {}, matchingService: {}, matchingInputResolver: {} } as unknown as ApiModuleDependencies);
  assert.equal(composed.proposalAndApproval instanceof ProposalApprovalApi, true); assert.ok(composed.identity); assert.ok(composed.permission); assert.equal("publicationDelivery" in composed, false);
});
