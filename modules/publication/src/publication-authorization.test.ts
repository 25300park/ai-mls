import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import {
  InMemoryPublicationAuthorizationEvidenceStore,
  PublicationAuthorizationGuard,
  type PublicationAuthorizationDependencies,
  type PublicationAuthorizationRequest,
  type PublicationLiveAuthorizationContext,
  publicationCapability,
} from "./publication-authorization.js";

const now = "2026-07-28T12:00:00.000Z";

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({
    id: "session-ops",
    principalId: "ops-authoritative",
    principalType: "HUMAN",
    roles: Object.freeze(["OPS"] as const),
    teamId: "team-a",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-07-28T10:00:00.000Z",
    expiresAt: "2026-07-28T13:00:00.000Z",
    absoluteExpiresAt: "2026-07-29T10:00:00.000Z",
    familyId: "family-ops",
    refreshReference: "refresh-ops",
    ...overrides,
  });
}

const liveContext: PublicationLiveAuthorizationContext = Object.freeze({
  tenantId: "tenant-a",
  teamId: "team-a",
  purpose: "PUBLICATION_EXECUTION",
  policyVersion: "publication-policy-v1",
  representation: Object.freeze({
    id: "representation-1",
    version: 2,
    checksum: "sha256:representation",
    subjectId: "listing-1",
    subjectRevision: 4,
    creatorActorId: "creator-1",
    editorActorIds: Object.freeze(["editor-1"]),
  }),
  approval: Object.freeze({
    id: "approval-1",
    version: 3,
    status: "APPROVED",
    expiresAt: "2026-07-29T00:00:00.000Z",
    requesterActorId: "requester-1",
    decisionActorId: "approver-1",
    representationId: "representation-1",
    representationVersion: 2,
    representationChecksum: "sha256:representation",
    subjectId: "listing-1",
    subjectRevision: 4,
    verificationId: "verification-1",
    verificationVersion: 5,
    permissionId: "permission-1",
    permissionVersion: 6,
    targetId: "target-1",
    targetPolicyVersion: "target-policy-v1",
    channelId: "channel-1",
    channelPolicyVersion: "channel-policy-v1",
    audience: "AUD_PUBLIC",
  }),
  verification: Object.freeze({
    id: "verification-1",
    version: 5,
    status: "VERIFIED",
    subjectId: "listing-1",
    subjectRevision: 4,
    decisionActorId: "verifier-1",
  }),
  permission: Object.freeze({
    id: "permission-1",
    version: 6,
    status: "ACTIVE",
    type: "PUBLIC_PUBLICATION",
    purpose: "PURPOSE_PUBLICATION_APPROVAL",
    subjectId: "listing-1",
    subjectRevision: 4,
    decisionActorId: "permission-decider-1",
    audience: "AUD_PUBLIC",
  }),
  target: Object.freeze({
    id: "target-1",
    version: 7,
    status: "ACTIVE",
    policyVersion: "target-policy-v1",
    channelId: "channel-1",
    channelStatus: "ACTIVE",
    channelPolicyVersion: "channel-policy-v1",
  }),
  evidenceSubmitterActorIds: Object.freeze(["evidence-submitter-1"]),
});

function dependencies(overrides: Partial<PublicationAuthorizationDependencies> = {}): PublicationAuthorizationDependencies {
  return {
    sessionResolver: { resolve: () => session() },
    authorizationEvaluator: { evaluate: () => Object.freeze({ effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "authz-v1", obligations: Object.freeze(["AUDIT", "MFA", "REASON"] as const), assignmentIds: Object.freeze(["assignment-ops"]) }) },
    liveContextResolver: { resolve: () => liveContext },
    evidence: new InMemoryPublicationAuthorizationEvidenceStore(),
    clock: { now: () => now },
    publicationPolicyVersion: "publication-policy-v1",
    ...overrides,
  };
}

function request(): PublicationAuthorizationRequest {
  return {
    sessionId: "session-ops",
    commandType: "BEGIN_INITIAL_EXECUTION" as const,
    actorIdClaim: "body-attacker",
    tenantId: "tenant-a",
    teamId: "team-a",
    purpose: "PUBLICATION_EXECUTION",
    aggregateId: "publication-1",
    expectedAggregateVersion: 1,
    currentAggregateVersion: 1,
    reason: "Execute the approved publication",
    correlationId: "correlation-1",
    binding: Object.freeze({
      subjectId: "listing-1",
      subjectRevision: 4,
      representationId: "representation-1",
      representationVersion: 2,
      representationChecksum: "sha256:representation",
      approvalId: "approval-1",
      approvalVersion: 3,
      targetId: "target-1",
      targetVersion: 7,
      channelId: "channel-1",
      channelPolicyVersion: "channel-policy-v1",
    }),
  };
}

describe("F15-TASK-005 Publication authorization", () => {
  it("uses the resolved Session Actor and ignores the body actor claim", () => {
    const guard = new PublicationAuthorizationGuard(dependencies());
    const decision = guard.authorize(request());
    assert.equal(decision.actor.principalId, "ops-authoritative");
    assert.notEqual(decision.actor.principalId, request().actorIdClaim);
    assert.equal(decision.evidence.decision, "ALLOW");
  });

  it("resolves the current Session on every public authorization decision", () => {
    let resolutions = 0;
    const guard = new PublicationAuthorizationGuard(dependencies({
      sessionResolver: { resolve: () => { resolutions += 1; return session(); } },
    }));
    guard.authorize(request());
    guard.authorize({ ...request(), correlationId: "correlation-2" });
    assert.equal(resolutions, 2);
  });

  it("fails closed when the SessionResolver is unavailable", () => {
    const withoutSessionResolver = { ...dependencies() };
    delete withoutSessionResolver.sessionResolver;
    const guard = new PublicationAuthorizationGuard(withoutSessionResolver);
    assert.throws(() => guard.authorize(request()), (error: unknown) => {
      assert.equal((error as { code?: string }).code, "AUTHENTICATION_REQUIRED");
      return true;
    });
  });

  it("records complete immutable exact-binding evidence", () => {
    const evidence = new InMemoryPublicationAuthorizationEvidenceStore();
    const guard = new PublicationAuthorizationGuard(dependencies({ evidence }));
    const result = guard.authorize(request());
    assert.equal(Object.isFrozen(result.evidence), true);
    assert.deepEqual(
      {
        actorId: result.evidence.actorId,
        approval: result.evidence.approvalReference,
        verification: result.evidence.verificationReference,
        permission: result.evidence.permissionReference,
        target: result.evidence.targetReference,
        channel: result.evidence.channelReference,
        policyVersion: result.evidence.policyVersion,
        classification: result.evidence.classification,
      },
      {
        actorId: "ops-authoritative",
        approval: "approval-1@3",
        verification: "verification-1@5",
        permission: "permission-1@6",
        target: "target-1@7",
        channel: "channel-1",
        policyVersion: "publication-policy-v1",
        classification: "RESTRICTED_SECURITY",
      },
    );
    assert.equal(evidence.list("publication-1").length, 1);
  });

  for (const [name, sessionValue] of [
    ["expired", session({ state: "EXPIRED" })],
    ["revoked", session({ state: "REVOKED" })],
    ["time-expired", session({ expiresAt: "2026-07-28T11:59:59.000Z" })],
    ["invalid-expiry", session({ expiresAt: "not-a-timestamp" })],
  ] as const) {
    it(`fails closed for a ${name} Session`, () => {
      const guard = new PublicationAuthorizationGuard(dependencies({ sessionResolver: { resolve: () => sessionValue } }));
      expectCode(() => guard.authorize(request()), "AUTHENTICATION_REQUIRED");
    });
  }

  it("fails closed when the session identifier is missing", () => {
    const withoutSessionId = { ...request() };
    delete withoutSessionId.sessionId;
    expectCode(() => new PublicationAuthorizationGuard(dependencies()).authorize(withoutSessionId), "AUTHENTICATION_REQUIRED");
  });

  it("fails closed when live revalidation or authorization dependencies fail", () => {
    expectCode(() => new PublicationAuthorizationGuard(dependencies({
      liveContextResolver: { resolve: () => { throw new Error("restricted live detail"); } },
    })).authorize(request()), "APPROVAL_NOT_EFFECTIVE");
    expectCode(() => new PublicationAuthorizationGuard(dependencies({
      authorizationEvaluator: { evaluate: () => { throw new Error("restricted policy detail"); } },
    })).authorize(request()), "AUTHORIZATION_DENIED");
  });

  it("preserves the safe denial code when authorization evidence persistence fails", () => {
    const throwingEvidence = {
      append: () => { throw new Error("restricted evidence storage detail"); },
      list: () => Object.freeze([]),
    };
    expectCode(() => new PublicationAuthorizationGuard(dependencies({
      evidence: throwingEvidence,
      authorizationEvaluator: { evaluate: () => Object.freeze({ effect: "DENY", reasonCode: "CAPABILITY_DENIED", policyVersion: "authz-v1", obligations: Object.freeze(["AUDIT"] as const), assignmentIds: Object.freeze([]) }) },
    })).authorize(request()), "AUTHORIZATION_DENIED");
    expectCode(() => new PublicationAuthorizationGuard(dependencies({ evidence: throwingEvidence })).authorize(request()), "AUTHORIZATION_DENIED");
  });

  it("denies capability before resolving present or absent restricted resources", () => {
    let resourceReads = 0;
    const denied = dependencies({
      authorizationEvaluator: { evaluate: () => Object.freeze({ effect: "DENY", reasonCode: "CAPABILITY_DENIED", policyVersion: "authz-v1", obligations: Object.freeze(["AUDIT"] as const), assignmentIds: Object.freeze([]) }) },
    });
    for (const resolveResource of [
      () => {
        resourceReads += 1;
        return { binding: request().binding!, currentAggregateVersion: 1 };
      },
      () => {
        resourceReads += 1;
        throw new Error("PUBLICATION_NOT_FOUND");
      },
    ]) {
      expectCode(() => new PublicationAuthorizationGuard(denied).authorize({
        ...request(),
        resolveResource,
      }), "AUTHORIZATION_DENIED");
    }
    assert.equal(resourceReads, 0);
  });

  it("denies wrong tenant, team and purpose scope", () => {
    for (const value of [
      { ...request(), tenantId: "tenant-b" },
      { ...request(), teamId: "team-b" },
      { ...request(), purpose: "CLIENT_SERVICE" },
    ]) {
      expectCode(() => new PublicationAuthorizationGuard(dependencies()).authorize(value), "PURPOSE_SCOPE_DENIED");
    }
  });

  for (const [authorizationReason, expected] of [
    ["CAPABILITY_DENIED", "AUTHORIZATION_DENIED"],
    ["REAUTHENTICATION_REQUIRED", "MFA_REQUIRED"],
    ["REASON_REQUIRED", "REASON_REQUIRED"],
  ] as const) {
    it(`maps ${authorizationReason} to a stable safe denial`, () => {
      const guard = new PublicationAuthorizationGuard(dependencies({
        authorizationEvaluator: { evaluate: () => Object.freeze({ effect: "DENY", reasonCode: authorizationReason, policyVersion: "authz-v1", obligations: Object.freeze(["AUDIT"] as const), assignmentIds: Object.freeze([]) }) },
      }));
      expectCode(() => guard.authorize(request()), expected);
    });
  }

  for (const [conflict, context] of [
    ["requester", { ...liveContext, approval: { ...liveContext.approval, requesterActorId: "ops-authoritative" } }],
    ["creator", { ...liveContext, representation: { ...liveContext.representation, creatorActorId: "ops-authoritative" } }],
    ["editor", { ...liveContext, representation: { ...liveContext.representation, editorActorIds: ["ops-authoritative"] } }],
    ["approver", { ...liveContext, approval: { ...liveContext.approval, decisionActorId: "ops-authoritative" } }],
    ["verifier", { ...liveContext, verification: { ...liveContext.verification, decisionActorId: "ops-authoritative" } }],
    ["permission decision actor", { ...liveContext, permission: { ...liveContext.permission, decisionActorId: "ops-authoritative" } }],
    ["evidence submitter", { ...liveContext, evidenceSubmitterActorIds: ["ops-authoritative"] }],
  ] as const) {
    it(`denies the ${conflict}/executor conflict even under role stacking`, () => {
      const stacked = session({ roles: ["OPS", "MGR", "ADM", "SEC"] });
      const guard = new PublicationAuthorizationGuard(dependencies({
        sessionResolver: { resolve: () => stacked },
        liveContextResolver: { resolve: () => context },
      }));
      expectCode(() => guard.authorize(request()), "SEPARATION_OF_DUTIES_DENIED");
    });
  }

  for (const [name, context, expected] of [
    ["Approval", { ...liveContext, approval: { ...liveContext.approval, status: "REVOKED" } }, "APPROVAL_NOT_EFFECTIVE"],
    ["Approval expiry", { ...liveContext, approval: { ...liveContext.approval, expiresAt: "not-a-timestamp" } }, "APPROVAL_NOT_EFFECTIVE"],
    ["Verification", { ...liveContext, verification: { ...liveContext.verification, version: 4 } }, "VERIFICATION_NOT_EFFECTIVE"],
    ["Permission", { ...liveContext, permission: { ...liveContext.permission, status: "REVOKED" } }, "PERMISSION_NOT_EFFECTIVE"],
    ["Target", { ...liveContext, target: { ...liveContext.target, id: "target-other" } }, "BINDING_MISMATCH"],
    ["Channel", { ...liveContext, target: { ...liveContext.target, channelId: "channel-other" } }, "BINDING_MISMATCH"],
    ["checksum", { ...liveContext, representation: { ...liveContext.representation, checksum: "sha256:changed" } }, "BINDING_MISMATCH"],
    ["Approval audience", { ...liveContext, approval: { ...liveContext.approval, audience: "AUD_CLIENT" } }, "BINDING_MISMATCH"],
    ["policy", { ...liveContext, target: { ...liveContext.target, channelPolicyVersion: "channel-policy-v2" } }, "POLICY_VERSION_STALE"],
    ["Publication policy", { ...liveContext, policyVersion: "publication-policy-v0" }, "POLICY_VERSION_STALE"],
  ] as const) {
    it(`fails closed for stale or mismatched ${name}`, () => {
      const guard = new PublicationAuthorizationGuard(dependencies({ liveContextResolver: { resolve: () => context } }));
      expectCode(() => guard.authorize(request()), expected);
    });
  }

  it("rejects a stale aggregate version before mutation", () => {
    expectCode(
      () => new PublicationAuthorizationGuard(dependencies()).authorize({ ...request(), currentAggregateVersion: 2 }),
      "PUBLICATION_VERSION_CONFLICT",
    );
  });

  it("declares a distinct bounded capability for every supported command type", () => {
    const commandTypes = ["CREATE_PUBLICATION", "BEGIN_INITIAL_EXECUTION", "RESOLVE_EXECUTION", "REQUEST_WITHDRAWAL", "RESOLVE_WITHDRAWAL", "BEGIN_ACTIVE_OPERATION", "BEGIN_WITHDRAWN_REPUBLISH", "RESOLVE_RECONCILIATION", "SUPERSEDE", "TERMINATE", "SET_SUSPENSION"] as const;
    const capabilities = commandTypes.map(publicationCapability);
    assert.equal(new Set(capabilities).size, commandTypes.length);
    assert.equal(capabilities.every((value) => value.startsWith("publication.")), true);
  });
});

function expectCode(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) => {
    assert.equal((error as { code?: string }).code, code);
    assert.equal(String((error as Error).message).includes("raw"), false);
    return true;
  });
}
