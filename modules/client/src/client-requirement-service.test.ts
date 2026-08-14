import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { ClientRequirementService } from "./client-requirement-service.js";

const clock = (): Date => new Date("2026-07-19T03:30:00.000Z");
function actor(overrides: Partial<SessionContext> = {}): SessionContext { return Object.freeze({ id: "session-client-agent", principalId: "agent-client", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T02:00:00.000Z", expiresAt: "2026-07-19T04:00:00.000Z", absoluteExpiresAt: "2026-07-19T05:00:00.000Z", familyId: "family-client", refreshReference: "refresh-client", ...overrides }); }

function fixture(): { readonly service: ClientRequirementService; readonly audit: AuditLog } {
  let sequence = 0;
  const audit = new AuditLog({ clock, idFactory: () => `audit-client-${String(++sequence)}` });
  const assignments: readonly RoleAssignment[] = [
    { id: "assignment-client-agent", principalId: "agent-client", role: "AGT", teamIds: ["team-a"], resourceTypes: ["Client", "Requirement"], purposes: ["CLIENT_SERVICE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
    { id: "assignment-client-service", principalId: "service-client", role: "SVC", teamIds: ["team-a"], resourceTypes: ["Requirement"], purposes: ["CLIENT_SERVICE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
  ];
  const authorization = new AuthorizationService({ assignments, authoritySource: "STATIC_TEST_COMPATIBILITY", auditSink: audit, clock, policyVersion: "authorization-v1" });
  return { service: new ClientRequirementService({ authorizationService: authorization, auditSink: audit, clock, idFactory: () => `client-object-${String(++sequence)}`, policyVersion: "client-v1" }), audit };
}
function context() { return { actor: actor(), purpose: "CLIENT_SERVICE", correlationId: "correlation-client" } as const; }

test("TEST-030 FEAT-009 creates a scoped Client without duplicating Contact channels", () => {
  const { service } = fixture();
  const client = service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "agent-client", contactRef: { entityType: "Contact", entityId: "contact-1", version: 2 }, consentRefs: ["consent-client-1"] });
  assert.equal(client.status, "ACTIVE");
  assert.equal(client.contactRef.entityId, "contact-1");
  assert.equal(JSON.stringify(client).includes("phone"), false);
  assert.equal(service.readClient({ ...context(), clientId: client.id }).assignedAgentId, "agent-client");
  assert.throws(() => service.readClient({ ...context(), actor: actor({ teamId: "team-b" }), clientId: client.id }), /CLIENT_SCOPE_DENIED/u);
  assert.throws(() => service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "another-agent", contactRef: { entityType: "Contact", entityId: "contact-other", version: 1 }, consentRefs: ["consent-other"] }), /CLIENT_SCOPE_DENIED/u);
});

test("TEST-018 FEAT-010 keeps invalid Requirement drafts out of ACTIVE", () => {
  const { service } = fixture();
  const client = service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "agent-client", contactRef: { entityType: "Contact", entityId: "contact-2", version: 1 }, consentRefs: ["consent-client-2"] });
  const draft = service.createRequirement({ ...context(), clientId: client.id, expectedClientVersion: 1, originalSourceRef: { entityType: "Communication", entityId: "communication-1", version: 1 }, intent: "UNKNOWN", constraints: [], budget: { currency: "PHP", lower: 30000, upper: 25000, frequency: "MONTHLY" }, locations: [], validationGaps: ["intent", "budget-range"] });
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.readiness, "NOT_READY");
  assert.throws(() => service.activateRequirement({ ...context(), requirementId: draft.id, expectedVersion: 1, reason: "Attempt invalid activation" }), /REQUIREMENT_INVALID/u);
});

test("TEST-018 human activation and material revision preserve history and emit stale boundary", () => {
  const { service, audit } = fixture();
  const client = service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "agent-client", contactRef: { entityType: "Contact", entityId: "contact-3", version: 1 }, consentRefs: ["consent-client-3"] });
  const draft = service.createRequirement({ ...context(), clientId: client.id, expectedClientVersion: 1, originalSourceRef: { entityType: "Communication", entityId: "communication-2", version: 1 }, intent: "RENT", constraints: [{ criterion: "bedrooms", kind: "HARD", value: "2" }], budget: { currency: "PHP", lower: 25000, upper: 35000, frequency: "MONTHLY" }, locations: [{ rawTerm: "BGC", canonicalLocationId: "location-bgc", preference: "DESIRED" }], validationGaps: [] });
  const active = service.activateRequirement({ ...context(), requirementId: draft.id, expectedVersion: 1, reason: "Client confirmed material terms" });
  const revision = service.reviseRequirement({ ...context(), requirementId: active.id, expectedVersion: 2, reason: "Client increased budget", material: true, intent: "RENT", constraints: active.constraints, budget: { currency: "PHP", lower: 30000, upper: 40000, frequency: "MONTHLY" }, locations: active.locations, validationGaps: [] });
  assert.equal(active.status, "ACTIVE");
  assert.equal(active.readiness, "READY");
  assert.equal(revision.status, "DRAFT");
  assert.equal(revision.staleMatchSignal, true);
  assert.deepEqual(service.readRequirementHistory({ ...context(), requirementId: active.id }).map((entry) => entry.version), [1, 2, 3]);
  assert.equal(JSON.stringify(audit.query({ requesterId: "reviewer", purpose: "TEST" })).toLowerCase().includes("client increased budget"), false);
});

test("TEST-018 authorized lifecycle transitions append a new Requirement revision", () => {
  const { service } = fixture();
  const client = service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "agent-client", contactRef: { entityType: "Contact", entityId: "contact-5", version: 1 }, consentRefs: ["consent-client-5"] });
  const draft = service.createRequirement({ ...context(), clientId: client.id, expectedClientVersion: 1, originalSourceRef: { entityType: "Communication", entityId: "communication-5", version: 1 }, intent: "RENT", constraints: [], locations: [], validationGaps: [] });
  const active = service.activateRequirement({ ...context(), requirementId: draft.id, expectedVersion: 1, reason: "Client confirmed" });
  const paused = service.transitionRequirement({ ...context(), requirementId: active.id, expectedVersion: 2, targetStatus: "PAUSED", reason: "Client paused search" });
  const resumed = service.transitionRequirement({ ...context(), requirementId: active.id, expectedVersion: 3, targetStatus: "ACTIVE", reason: "Client resumed search" });
  assert.equal(paused.status, "PAUSED");
  assert.equal(paused.readiness, "NOT_READY");
  assert.equal(resumed.status, "ACTIVE");
  assert.equal(resumed.readiness, "READY");
  assert.deepEqual(service.readRequirementHistory({ ...context(), requirementId: active.id }).map((entry) => entry.version), [1, 2, 3, 4]);
});

test("TEST-030 a service principal cannot activate or transition a Requirement", () => {
  const { service } = fixture();
  const client = service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "agent-client", contactRef: { entityType: "Contact", entityId: "contact-4", version: 1 }, consentRefs: ["consent-client-4"] });
  const draft = service.createRequirement({ ...context(), clientId: client.id, expectedClientVersion: 1, originalSourceRef: { entityType: "Communication", entityId: "communication-3", version: 1 }, intent: "BUY", constraints: [], locations: [], validationGaps: [] });
  const serviceActor = actor({ id: "session-service-client", principalId: "service-client", principalType: "SERVICE", roles: ["SVC"], assurance: "WORKLOAD", isMfaVerified: false });
  assert.throws(() => service.activateRequirement({ ...context(), actor: serviceActor, requirementId: draft.id, expectedVersion: 1, reason: "Automated activation" }), /HUMAN_AUTHORITY_REQUIRED/u);
});

test("TEST-042/044/045 AI-004 and AI-006 remain closed-schema advisory validation only", () => {
  const { service } = fixture();
  const client = service.createClient({ ...context(), teamId: "team-a", assignedAgentId: "agent-client", contactRef: { entityType: "Contact", entityId: "contact-ai", version: 1 }, consentRefs: ["consent-ai"] });
  const draft = service.createRequirement({ ...context(), clientId: client.id, expectedClientVersion: 1, originalSourceRef: { entityType: "Communication", entityId: "communication-ai", version: 1 }, intent: "RENT", constraints: [], locations: [], validationGaps: [] });
  const subjectRef = { entityType: "Requirement", entityId: draft.id, version: draft.version } as const;
  const base = { schemaVersion: "1.0", subjectRef, provenance: [subjectRef], classification: "RESTRICTED_PERSONAL", confidence: { band: "MEDIUM", reasonCodes: ["HUMAN_CONFIRMATION_REQUIRED"], policyVersion: "confidence-bands-v1" } } as const;

  const proposal = service.validateRequirementProposal({ ...context(), requirementId: draft.id, expectedVersion: 1, result: { ...base, capabilityId: "AI-004", output: { intent: "RENT", constraints: [], clarifications: [] } } });
  const search = service.validateSearchInterpretation({ ...context(), requirementId: draft.id, expectedVersion: 1, result: { ...base, capabilityId: "AI-006", output: { intent: "REQUIREMENT_SEARCH", filters: [], resultClass: "REQUIREMENT", unresolved: [], warnings: [] } } });
  const prohibited = service.validateRequirementProposal({ ...context(), requirementId: draft.id, expectedVersion: 1, result: { ...base, capabilityId: "AI-004", output: { intent: "RENT", constraints: [], clarifications: [], activate: true } } });

  assert.deepEqual(proposal, { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" });
  assert.deepEqual(search, { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" });
  assert.equal(prohibited.status, "REJECTED");
  assert.equal(prohibited.reasonCode, "PROHIBITED_AUTHORITY_FIELD");
  assert.equal(service.readRequirement({ ...context(), requirementId: draft.id }).version, 1);
  assert.equal(service.readRequirement({ ...context(), requirementId: draft.id }).status, "DRAFT");
});
