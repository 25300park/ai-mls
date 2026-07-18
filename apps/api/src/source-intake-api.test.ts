import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { Intake } from "../../../modules/intake/src/intake-service.js";
import type { SourcePolicy } from "../../../modules/source/src/source-registry-service.js";
import { SourceIntakeApi, type SourceIntakeApiDependencies } from "./source-intake-api.js";

const actor: SessionContext = Object.freeze({
  id: "session-collector", principalId: "collector-1", principalType: "HUMAN", roles: ["COL" as const],
  teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true,
  authenticatedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T02:00:00.000Z",
  absoluteExpiresAt: "2026-07-19T03:00:00.000Z", familyId: "family-1", refreshReference: "refresh-1",
});
const source: SourcePolicy = Object.freeze({
  id: "source-1", name: "Approved source", sourceType: "MANUAL", status: "ACTIVE",
  policyVersion: 1, allowedMethods: ["MANUAL_REFERENCE"], allowedPurposes: ["SOURCE_INTAKE"],
  classification: "CONFIDENTIAL_BUSINESS", proposedBy: "owner-1",
});
const intake: Intake = Object.freeze({
  id: "intake-1", version: 1, status: "DRAFT", rawSourceId: "raw-1", rawSourceVersion: 1,
  rawSourceFingerprint: "sha256-1", purpose: "SOURCE_INTAKE",
  classification: "CONFIDENTIAL_BUSINESS", createdBy: actor.principalId,
  createdAt: "2026-07-19T00:05:00.000Z", attachmentReferences: [],
});

test("TEST-027 API-003 and API-004 derive actor from session", () => {
  const seen: SessionContext[] = [];
  const dependencies: SourceIntakeApiDependencies = {
    sessionReader: () => actor,
    sourceRegistryService: {
      list: (request) => { seen.push(request.actor); return [source]; },
      read: (request) => { seen.push(request.actor); return source; },
      propose: (request) => { seen.push(request.actor); return source; },
    },
    intakeService: {
      createDraft: (request) => { seen.push(request.actor); return intake; },
      attachEvidence: (request) => { seen.push(request.actor); return intake; },
      readForActor: (request) => { seen.push(request.actor); return intake; },
      validate: (request) => { seen.push(request.actor); return { ...intake, version: 2, status: "VALIDATED" }; },
      requestAi: (request) => { seen.push(request.actor); return { ...intake, version: 2, status: "AI_REQUESTED", jobId: "job-1" }; },
      review: (request) => { seen.push(request.actor); return { ...intake, version: 2, status: "REJECTED" }; },
    },
  };
  const api = new SourceIntakeApi(dependencies);
  const response = api.createIntake({
    context: { sessionId: actor.id, correlationId: "correlation-api-004" },
    sourceId: source.id, sourcePolicyVersion: 1, method: "MANUAL_REFERENCE", purpose: "SOURCE_INTAKE",
    evidenceReference: "protected://raw/1", observedAt: "2026-07-19T00:00:00.000Z",
    capturedAt: "2026-07-19T00:01:00.000Z", fingerprint: "sha256-1", language: "ko",
    classification: "CONFIDENTIAL_BUSINESS", retentionClass: "SOURCE_EVIDENCE",
    actor: { principalId: "body-forgery" },
  } as Parameters<SourceIntakeApi["createIntake"]>[0] & { actor: unknown });

  assert.equal(response.ok, true);
  assert.deepEqual(seen, [actor]);
  assert.equal(api.readSource({
    context: { sessionId: actor.id, correlationId: "correlation-api-003" },
    sourceId: source.id, purpose: "SOURCE_INTAKE",
  }).ok, true);
});

test("TEST-026 API-004 returns a safe stable authentication error", () => {
  const api = new SourceIntakeApi({
    sessionReader: () => actor,
    sourceRegistryService: { list: () => [], read: () => source, propose: () => source },
    intakeService: { createDraft: () => intake, attachEvidence: () => intake, readForActor: () => intake, validate: () => intake, requestAi: () => intake, review: () => intake },
  });
  const response = api.readSource({
    context: { correlationId: "correlation-api-auth" }, sourceId: source.id, purpose: "SOURCE_INTAKE",
  });
  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "AUTHENTICATION_REQUIRED");
});

test("TEST-027 API-003 preserves allowlisted domain code without internal disclosure", () => {
  const api = new SourceIntakeApi({
    sessionReader: () => actor,
    sourceRegistryService: {
      list: () => [],
      read: () => { throw new Error("SOURCE_NOT_ALLOWED"); },
      propose: () => source,
    },
    intakeService: { createDraft: () => intake, attachEvidence: () => intake, readForActor: () => intake, validate: () => intake, requestAi: () => intake, review: () => intake },
  });
  const response = api.readSource({
    context: { sessionId: actor.id, correlationId: "correlation-api-domain-error" },
    sourceId: source.id, purpose: "SOURCE_INTAKE",
  });
  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, "SOURCE_NOT_ALLOWED");
    assert.equal(response.error.message, "Request could not be completed.");
  }
});
