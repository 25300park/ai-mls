import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { validateAiResult } from "../../jobs/src/ai-result-validator.js";
import { JobService, type JobPolicy } from "../../jobs/src/job-service.js";
import { RawSourceStore } from "../../source/src/raw-source-store.js";
import { activePolicy } from "../../source/src/source-test-fixture.js";
import { SourceRegistryService } from "../../source/src/source-registry-service.js";
import { IntakeService, type CandidateDraftPort } from "./intake-service.js";

function session(id: string, role: "COL" | "SAG" | "SVC", type: "HUMAN" | "SERVICE" = "HUMAN"): SessionContext {
  return Object.freeze({
    id: `session-${id}`, principalId: id, principalType: type, roles: [role], teamId: "team-a",
    state: "ACTIVE", assurance: type === "SERVICE" ? "WORKLOAD" : "MFA",
    isMfaVerified: type === "HUMAN", authenticatedAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2026-07-19T02:00:00.000Z", absoluteExpiresAt: "2026-07-19T03:00:00.000Z",
    familyId: `family-${id}`, refreshReference: `refresh-${id}`,
  });
}

function fixture(): {
  readonly intake: IntakeService;
  readonly jobs: JobService;
  readonly candidates: { readonly registrations: { rawSourceId: string; intakeId: string; aiResultReference?: string }[] };
} {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => `audit-${String(++sequence)}` });
  const assignments: readonly RoleAssignment[] = [
    { principalId: "collector-1", role: "COL" as const },
    { principalId: "reviewer-1", role: "SAG" as const },
    { principalId: "worker-1", role: "SVC" as const },
  ].map((subject, index) => ({
    id: `assignment-${String(index)}`, ...subject, teamIds: ["team-a"],
    resourceTypes: ["SourceRegistry", "RawSource", "Intake", "BackgroundJob"],
    purposes: ["SOURCE_INTAKE"], effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE",
  }));
  const authorization = new AuthorizationService({ assignments, authoritySource: "STATIC_TEST_COMPATIBILITY", auditSink: audit, clock, policyVersion: "auth-v1" });
  const source = new SourceRegistryService({
    initialSources: [activePolicy], authorizationService: authorization, auditSink: audit, clock,
    idFactory: () => `source-${String(++sequence)}`, policyVersion: "source-v1",
  });
  const raw = new RawSourceStore({
    sourceRegistryService: source, auditSink: audit, clock,
    idFactory: () => `raw-${String(++sequence)}`, policyVersion: "raw-v1",
  });
  const policies: readonly JobPolicy[] = [{
    jobType: "AI_LISTING_PARSE", allowedPurposes: ["SOURCE_INTAKE"],
    allowedInputTypes: ["RawSource"], maxAttempts: 2,
    retryableFailureCodes: ["DEPENDENCY_UNAVAILABLE"],
  }];
  const jobs = new JobService({
    policies, authorizationService: authorization, auditSink: audit, clock,
    idFactory: () => `job-${String(++sequence)}`, policyVersion: "job-v1",
  });
  const registrations: { rawSourceId: string; intakeId: string; aiResultReference?: string }[] = [];
  const candidatePort: CandidateDraftPort = {
    register(request) {
      registrations.push({
        rawSourceId: request.rawSourceId,
        intakeId: request.intakeId,
        ...(request.aiResultReference === undefined ? {} : { aiResultReference: request.aiResultReference }),
      });
      return Object.freeze({ id: `candidate-${String(registrations.length)}`, version: 1 });
    },
  };
  return {
    jobs,
    candidates: { registrations },
    intake: new IntakeService({
      rawSourceStore: raw, jobService: jobs, candidateDraftPort: candidatePort,
      authorizationService: authorization, auditSink: audit, clock,
      idFactory: () => `intake-${String(++sequence)}`, policyVersion: "intake-v1",
    }),
  };
}

function create(intake: IntakeService) {
  return intake.createDraft({
    actor: session("collector-1", "COL"), sourceId: activePolicy.id,
    sourcePolicyVersion: activePolicy.policyVersion, method: "MANUAL_REFERENCE",
    purpose: "SOURCE_INTAKE", evidenceReference: "protected://raw/evidence-1",
    observedAt: "2026-07-19T00:00:00.000Z", capturedAt: "2026-07-19T00:01:00.000Z",
    fingerprint: "sha256-evidence-1", language: "ko",
    classification: "CONFIDENTIAL_BUSINESS", retentionClass: "SOURCE_EVIDENCE",
    correlationId: "correlation-create-1",
  });
}

test("TEST-004 and TEST-015 preserve provenance through candidate registration", () => {
  const { intake, candidates } = fixture();
  const draft = create(intake);
  const validated = intake.validate({
    actor: session("collector-1", "COL"), intakeId: draft.id, expectedVersion: draft.version,
    safetyState: "SAFE", metadataComplete: true, correlationId: "correlation-validate-1",
  });
  const reviewed = intake.review({
    actor: session("reviewer-1", "SAG"), intakeId: validated.id,
    expectedVersion: validated.version, decision: "REGISTER_CANDIDATE",
    reason: "Evidence is sufficient for candidate registration", correlationId: "correlation-review-1",
  });

  assert.equal(reviewed.status, "REGISTERED");
  assert.equal(reviewed.candidateReference?.version, 1);
  assert.deepEqual(candidates.registrations, [{ rawSourceId: draft.rawSourceId, intakeId: draft.id }]);
});

test("TEST-004 routes validated AI result provenance to candidate handoff", () => {
  const { intake, jobs, candidates } = fixture();
  const draft = create(intake);
  const validated = intake.validate({
    actor: session("collector-1", "COL"), intakeId: draft.id, expectedVersion: draft.version,
    safetyState: "SAFE", metadataComplete: true, correlationId: "correlation-validate-ai",
  });
  const requested = intake.requestAi({
    actor: session("collector-1", "COL"), intakeId: validated.id, expectedVersion: validated.version,
    deadline: "2026-07-19T00:35:00.000Z", idempotencyKey: "intake-ai-success-1",
    correlationId: "correlation-ai-success",
  });
  const running = jobs.start({
    actor: session("worker-1", "SVC", "SERVICE"), jobId: requested.jobId ?? "missing",
    expectedVersion: 1, correlationId: "correlation-ai-start-success",
  });
  jobs.succeed({
    actor: session("worker-1", "SVC", "SERVICE"), jobId: running.id,
    expectedVersion: running.version, resultReference: "ai-result-1",
    resultChecksum: "sha256-ai-result-1", correlationId: "correlation-ai-finish-success",
  });
  const expectedInput = {
    type: "RawSource", id: draft.rawSourceId, version: draft.rawSourceVersion,
    checksum: draft.rawSourceFingerprint,
  };
  const routed = intake.routeJobOutcome({
    actor: session("worker-1", "SVC", "SERVICE"), intakeId: requested.id,
    expectedVersion: requested.version, correlationId: "correlation-ai-route-success",
    validationDecision: validateAiResult({
      capabilityId: "AI-001", schemaId: "AI_LISTING_PARSE_RESULT_V1", expectedInput,
      result: { input: expectedInput, confidence: "MEDIUM", fields: [] },
    }),
  });
  const registered = intake.review({
    actor: session("reviewer-1", "SAG"), intakeId: routed.id, expectedVersion: routed.version,
    decision: "REGISTER_CANDIDATE", reason: "Validated advisory evidence reviewed",
    correlationId: "correlation-ai-review-success",
  });

  assert.equal(registered.aiResultReference, "ai-result-1");
  assert.equal(candidates.registrations[0]?.aiResultReference, "ai-result-1");
});

test("TEST-015 quarantines unsafe evidence and rejects stale transitions", () => {
  const { intake } = fixture();
  const draft = create(intake);
  const quarantined = intake.validate({
    actor: session("collector-1", "COL"), intakeId: draft.id, expectedVersion: draft.version,
    safetyState: "UNSAFE", metadataComplete: true, correlationId: "correlation-quarantine-1",
  });
  assert.equal(quarantined.status, "QUARANTINED");
  assert.throws(() => intake.validate({
    actor: session("collector-1", "COL"), intakeId: draft.id, expectedVersion: draft.version,
    safetyState: "SAFE", metadataComplete: true, correlationId: "correlation-stale-1",
  }), /VERSION_CONFLICT/);
});

test("TEST-004 attaches protected Raw Attachment provenance without payload", () => {
  const { intake } = fixture();
  const draft = create(intake);
  const attached = intake.attachEvidence({
    actor: session("collector-1", "COL"), intakeId: draft.id,
    expectedVersion: draft.version, evidenceReference: "protected://attachment/1",
    fingerprint: "sha256-attachment-1", classification: "RESTRICTED_PERSONAL",
    retentionClass: "SOURCE_EVIDENCE", safetyState: "CLEARED",
    correlationId: "correlation-attachment-1", rawContent: "must-not-persist",
  } as Parameters<IntakeService["attachEvidence"]>[0] & { rawContent: string });

  assert.equal(attached.attachmentReferences.length, 1);
  assert.equal(attached.attachmentReferences[0]?.status, "CLEARED");
  assert.equal("rawContent" in attached.attachmentReferences[0], false);
});

test("TEST-016 routes failed AI work to explicit manual fallback", () => {
  const { intake, jobs } = fixture();
  const draft = create(intake);
  const validated = intake.validate({
    actor: session("collector-1", "COL"), intakeId: draft.id, expectedVersion: draft.version,
    safetyState: "SAFE", metadataComplete: true, correlationId: "correlation-validate-2",
  });
  const requested = intake.requestAi({
    actor: session("collector-1", "COL"), intakeId: validated.id, expectedVersion: validated.version,
    deadline: "2026-07-19T00:35:00.000Z", idempotencyKey: "intake-ai-1",
    correlationId: "correlation-ai-1",
  });
  const running = jobs.start({
    actor: session("worker-1", "SVC", "SERVICE"), jobId: requested.jobId!,
    expectedVersion: 1, correlationId: "correlation-start-1",
  });
  jobs.fail({
    actor: session("worker-1", "SVC", "SERVICE"), jobId: running.id,
    expectedVersion: running.version, failureCode: "DEPENDENCY_UNAVAILABLE",
    correlationId: "correlation-fail-1",
  });
  const fallback = intake.routeJobOutcome({
    actor: session("worker-1", "SVC", "SERVICE"), intakeId: requested.id,
    expectedVersion: requested.version, correlationId: "correlation-fallback-1",
  });
  assert.equal(fallback.status, "REVIEW_REQUIRED");
  assert.equal(fallback.fallbackReason, "DEPENDENCY_UNAVAILABLE");
});

test("TEST-036 service principals cannot perform human intake review", () => {
  const { intake } = fixture();
  const draft = create(intake);
  const validated = intake.validate({
    actor: session("collector-1", "COL"), intakeId: draft.id, expectedVersion: draft.version,
    safetyState: "SAFE", metadataComplete: true, correlationId: "correlation-validate-3",
  });
  assert.throws(() => intake.review({
    actor: session("worker-1", "SVC", "SERVICE"), intakeId: validated.id,
    expectedVersion: validated.version, decision: "REJECT", reason: "invalid",
    correlationId: "correlation-review-service",
  }), /HUMAN_AUTHORITY_REQUIRED/);
});
