import assert from "node:assert/strict";
import test from "node:test";

import { createPublicationBinding } from "./publication-contracts.js";
import { PublicationDomainError } from "./publication-domain-error.js";
import { assessCorrectionMateriality } from "./publication-materiality-service.js";

const current = createPublicationBinding({
  subjectId: "listing-1", subjectRevision: 3,
  representationId: "representation-1", representationVersion: 2,
  representationChecksum: "sha256:representation-1-v2",
  approvalId: "approval-1", approvalVersion: 4,
  targetId: "target-1", targetVersion: 5,
  channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
});

test("F15-TASK-002 permits an approved non-material correction without changing immutable ownership binding", () => {
  const proposed = createPublicationBinding({ ...current, representationVersion: 3, representationChecksum: "sha256:representation-1-v3", approvalId: "approval-2", approvalVersion: 1 });
  assert.deepEqual(assessCorrectionMateriality(current, proposed, "NON_MATERIAL"), {
    disposition: "IN_PLACE_CORRECTION_ALLOWED",
    reasonCodes: ["NON_MATERIAL_REPRESENTATION_CHANGE"],
  });
});

test("F15-TASK-002 requires a successor for material or ownership-binding changes", () => {
  const material = assessCorrectionMateriality(current, createPublicationBinding({ ...current }), "MATERIAL");
  const targetChange = assessCorrectionMateriality(current, createPublicationBinding({ ...current, targetId: "target-2" }), "NON_MATERIAL");
  const subjectChange = assessCorrectionMateriality(current, createPublicationBinding({ ...current, subjectRevision: 4 }), "NON_MATERIAL");

  assert.equal(material.disposition, "SUCCESSOR_REQUIRED");
  assert.deepEqual(targetChange.reasonCodes, ["TARGET_CHANGED"]);
  assert.deepEqual(subjectChange.reasonCodes, ["SUBJECT_CHANGED"]);
});

test("F15-TASK-002 rejects a non-material decision that does not bind a new representation and approval", () => {
  assert.throws(
    () => assessCorrectionMateriality(current, createPublicationBinding({ ...current }), "NON_MATERIAL"),
    (error: unknown) => error instanceof PublicationDomainError && error.code === "PUBLICATION_INVARIANT_VIOLATION",
  );
});
