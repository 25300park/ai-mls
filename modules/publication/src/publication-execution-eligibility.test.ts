import assert from "node:assert/strict";
import test from "node:test";

import type { PublicationAuthorizedExecution, PublicationExecutionContext } from "./publication-application-contracts.js";
import {
  PublicationExecutionEligibilityGate,
  type PublicationExecutionEligibilityInput,
} from "./publication-execution-eligibility.js";

const checkedAt = "2026-08-30T08:00:00.000Z";
const identity = Object.freeze({ publicationId: "publication-f17-b-1", tenantScopeId: "team-a" });
const binding = Object.freeze({
  subjectId: "listing-1",
  subjectRevision: 3,
  representationId: "representation-1",
  representationVersion: 2,
  representationChecksum: "sha256:representation-1-v2",
  approvalId: "approval-1",
  approvalVersion: 4,
  targetId: "target-1",
  targetVersion: 5,
  channelId: "channel-1",
  channelPolicyVersion: "channel-policy-v3",
});
const context: PublicationExecutionContext = Object.freeze({
  actorId: "non-authoritative-body-actor",
  sessionId: "session-executor-1",
  correlationId: "correlation-f17-b-1",
  idempotencyKey: "test-key",
  intentFingerprint: "sha256:f17-b-1",
});
const authorization: PublicationAuthorizedExecution = Object.freeze({
  actorId: "executor-1",
  binding,
  currentAggregateVersion: 7,
});

function input(): PublicationExecutionEligibilityInput {
  return Object.freeze({ identity, context, authorization });
}

test("F17-B eligibility returns ELIGIBLE only for the exact effective approval and authorized execution", () => {
  const gate = new PublicationExecutionEligibilityGate({
    effectiveApproval: {
      check(request) {
        assert.equal(request.actorId, "executor-1");
        assert.equal(request.sessionId, "session-executor-1");
        assert.equal(request.tenantScopeId, "team-a");
        assert.equal(request.targetId, binding.targetId);
        assert.equal(request.channelId, binding.channelId);
        assert.equal(request.representationChecksum, binding.representationChecksum);
        return Object.freeze({
          effective: true as const,
          decisionReference: "API-013:approval-1@4",
          approvalId: binding.approvalId,
          approvalVersion: binding.approvalVersion,
          checkedAt,
          effectiveScope: Object.freeze({ targetId: binding.targetId, channelId: binding.channelId }),
          reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
        });
      },
    },
  });

  assert.deepEqual(gate.evaluate(input()), {
    status: "ELIGIBLE",
    actorId: "executor-1",
    currentAggregateVersion: 7,
    approvalDecisionReference: "API-013:approval-1@4",
    checkedAt,
  });
});

test("F17-B eligibility returns BLOCKED without throwing when approval resolution fails or drifts", () => {
  const unavailable = new PublicationExecutionEligibilityGate({
    effectiveApproval: { check(): never { throw new Error("unsafe dependency detail"); } },
  });
  const mismatched = new PublicationExecutionEligibilityGate({
    effectiveApproval: {
      check: () => Object.freeze({
        effective: true as const,
        decisionReference: "API-013:other-approval@4",
        approvalId: "other-approval",
        approvalVersion: binding.approvalVersion,
        checkedAt,
        effectiveScope: Object.freeze({ targetId: binding.targetId, channelId: binding.channelId }),
        reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
      }),
    },
  });

  assert.deepEqual(unavailable.evaluate(input()), {
    status: "BLOCKED",
    reasonCode: "APPROVAL_NOT_EFFECTIVE",
  });
  assert.deepEqual(mismatched.evaluate(input()), {
    status: "BLOCKED",
    reasonCode: "APPROVAL_NOT_EFFECTIVE",
  });
});
