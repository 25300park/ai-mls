import type { SessionContext } from "../../identity/src/session-service.js";
import {
  InMemoryPublicationAuthorizationEvidenceStore,
  PublicationAuthorizationGuard,
  type PublicationAuthorizationDependencies,
  type PublicationLiveAuthorizationContext,
} from "./publication-authorization.js";
import type { PublicationClock } from "./publication-clock.js";
import type { PublicationInfrastructureConfigurationInput } from "./publication-infrastructure-configuration.js";

export function createTestPublicationSession(principalId = "actor-application", sessionId = principalId, teamId = "team-a"): SessionContext {
  return Object.freeze({
    id: sessionId,
    principalId,
    principalType: "HUMAN",
    roles: Object.freeze(["OPS"] as const),
    teamId,
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-07-27T00:00:00.000Z",
    expiresAt: "2030-07-28T00:00:00.000Z",
    absoluteExpiresAt: "2030-07-29T00:00:00.000Z",
    familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
  });
}

export function createTestPublicationAuthorizationConfiguration(clock?: PublicationClock, teamId = "team-a"): PublicationInfrastructureConfigurationInput {
  return {
    ...(clock === undefined ? {} : { clock }),
    sessionResolver: { resolve: (sessionId) => createTestPublicationSession(sessionId, sessionId, teamId) },
    authorizationEvaluator: {
      evaluate: () => Object.freeze({
        effect: "ALLOW" as const,
        reasonCode: "POLICY_ALLOWED",
        policyVersion: "test-authorization-v1",
        obligations: Object.freeze(["AUDIT", "MFA", "REASON"] as const),
        assignmentIds: Object.freeze(["test-assignment"]),
      }),
    },
    liveContextResolver: { resolve: (binding, scope) => createTestLiveAuthorizationContext(binding, scope.tenantId, teamId) },
    publicationPolicyVersion: "publication-policy-v1",
  };
}

export function createTestPublicationAuthorizationGuard(clock: PublicationClock, teamId = "team-a"): PublicationAuthorizationGuard {
  const configuration = createTestPublicationAuthorizationConfiguration(clock, teamId);
  const dependencies: PublicationAuthorizationDependencies = {
    sessionResolver: configuration.sessionResolver!,
    authorizationEvaluator: configuration.authorizationEvaluator!,
    liveContextResolver: configuration.liveContextResolver!,
    evidence: new InMemoryPublicationAuthorizationEvidenceStore(),
    clock,
    publicationPolicyVersion: configuration.publicationPolicyVersion!,
  };
  return new PublicationAuthorizationGuard(dependencies);
}

function createTestLiveAuthorizationContext(binding: Parameters<NonNullable<PublicationInfrastructureConfigurationInput["liveContextResolver"]>["resolve"]>[0], tenantId: string, teamId: string): PublicationLiveAuthorizationContext {
  return Object.freeze({
    tenantId,
    teamId,
    purpose: "PUBLICATION_EXECUTION",
    policyVersion: "publication-policy-v1",
    representation: Object.freeze({ id: binding.representationId, version: binding.representationVersion, checksum: binding.representationChecksum, subjectId: binding.subjectId, subjectRevision: binding.subjectRevision, creatorActorId: "creator-independent", editorActorIds: Object.freeze(["editor-independent"]) }),
    approval: Object.freeze({ id: binding.approvalId, version: binding.approvalVersion, status: "APPROVED", expiresAt: "2030-07-28T00:00:00.000Z", requesterActorId: "requester-independent", decisionActorId: "approver-independent", representationId: binding.representationId, representationVersion: binding.representationVersion, representationChecksum: binding.representationChecksum, subjectId: binding.subjectId, subjectRevision: binding.subjectRevision, verificationId: "verification-test", verificationVersion: 1, permissionId: "permission-test", permissionVersion: 1, targetId: binding.targetId, targetPolicyVersion: "target-policy-v1", channelId: binding.channelId, channelPolicyVersion: binding.channelPolicyVersion, audience: "AUD_PUBLIC" }),
    verification: Object.freeze({ id: "verification-test", version: 1, status: "VERIFIED", subjectId: binding.subjectId, subjectRevision: binding.subjectRevision, decisionActorId: "verifier-independent" }),
    permission: Object.freeze({ id: "permission-test", version: 1, status: "ACTIVE", type: "PUBLIC_PUBLICATION", purpose: "PURPOSE_PUBLICATION_APPROVAL", subjectId: binding.subjectId, subjectRevision: binding.subjectRevision, decisionActorId: "permission-independent", audience: "AUD_PUBLIC" }),
    target: Object.freeze({ id: binding.targetId, version: binding.targetVersion, status: "ACTIVE", policyVersion: "target-policy-v1", channelId: binding.channelId, channelStatus: "ACTIVE", channelPolicyVersion: binding.channelPolicyVersion }),
    evidenceSubmitterActorIds: Object.freeze(["evidence-independent"]),
  });
}
