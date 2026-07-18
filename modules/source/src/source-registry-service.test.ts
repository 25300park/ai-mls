import assert from "node:assert/strict";
import test from "node:test";

import {
  activePolicy,
  sourceFixture,
  sourceSession,
} from "./source-test-fixture.js";

test("TEST-014 reads an active source policy with scoped authorization", () => {
  const { service } = sourceFixture();
  const policy = service.read({
    actor: sourceSession("user-collector-1", "COL"),
    sourceId: activePolicy.id,
    purpose: "SOURCE_INTAKE",
    correlationId: "correlation-source-read",
  });

  assert.equal(policy.status, "ACTIVE");
  assert.equal(policy.policyVersion, 3);
  assert.equal(Object.isFrozen(policy), true);
});

test("TEST-027 source proposals remain non-active policy drafts", () => {
  const { service } = sourceFixture();
  const proposed = service.propose({
    actor: sourceSession("user-collector-1", "COL"),
    name: "Proposed source",
    sourceType: "USER_PROVIDED",
    allowedMethods: ["MANUAL_REFERENCE"],
    allowedPurposes: ["SOURCE_INTAKE"],
    classification: "RESTRICTED_PERSONAL",
    reason: "Request policy review",
    correlationId: "correlation-source-proposal",
  });

  assert.equal(proposed.status, "DRAFT");
  assert.equal(proposed.policyVersion, 1);
  assert.equal(proposed.proposedBy, "user-collector-1");
});
