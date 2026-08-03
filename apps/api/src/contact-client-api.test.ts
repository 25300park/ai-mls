import assert from "node:assert/strict";
import test from "node:test";

import type { Client, Requirement } from "../../../modules/client/src/client-requirement-service.js";
import type { Contact, ContactChannel } from "../../../modules/contact/src/contact-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { ContactClientApi, type ContactClientApiDependencies } from "./contact-client-api.js";
import { composeApiModulesBeforePublication, type ApiModuleDependencies } from "./composition.js";

const actor: SessionContext = Object.freeze({ id: "session-api-sp004", principalId: "agent-api-sp004", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T02:00:00.000Z", expiresAt: "2026-07-19T04:00:00.000Z", absoluteExpiresAt: "2026-07-19T05:00:00.000Z", familyId: "family-api-sp004", refreshReference: "refresh-api-sp004" });
const contact: Contact = Object.freeze({ id: "contact-api-1", version: 1, displayLabel: "Masked Client", teamId: "team-a", status: "ACTIVE", consentRefs: ["consent-api"], channels: [], classification: "RESTRICTED_PERSONAL" });
const channel: ContactChannel = Object.freeze({ id: "channel-api-1", version: 1, contactId: contact.id, channelType: "PHONE", maskedValue: "***4567", useScope: "CLIENT_SERVICE", status: "ACTIVE", classification: "RESTRICTED_PERSONAL" });
const client: Client = Object.freeze({ id: "client-api-1", version: 1, status: "ACTIVE", teamId: "team-a", assignedAgentId: actor.principalId, contactRef: { entityType: "Contact", entityId: contact.id, version: 1 }, consentRefs: ["consent-api"], classification: "RESTRICTED_PERSONAL" });
const requirement: Requirement = Object.freeze({ id: "requirement-api-1", version: 1, clientId: client.id, teamId: "team-a", status: "DRAFT", intent: "RENT", constraints: [], budget: undefined, locations: [], originalSourceRef: { entityType: "Communication", entityId: "communication-api-1", version: 1 }, validationGaps: [], readiness: "NOT_READY", staleMatchSignal: false, classification: "RESTRICTED_PERSONAL", changedBy: actor.principalId, changedAt: "2026-07-19T03:00:00.000Z", changeReason: "INITIAL_DRAFT" });

function dependencies(seen: SessionContext[], fail = false): ContactClientApiDependencies {
  return {
    sessionReader: () => actor,
    contactService: {
      createContact: (request) => { seen.push(request.actor); return contact; }, addChannel: (request) => { seen.push(request.actor); return channel; }, correctContact: () => contact, revokeChannel: () => channel, openCase: () => ({ id: "case-1", version: 1, contactId: contact.id, channelId: channel.id, teamId: "team-a", purpose: "CLIENT_SERVICE", status: "PENDING", classification: "RESTRICTED_PERSONAL" }), recordAttempt: () => { throw new Error("not used"); }, setDoNotContact: () => { throw new Error("not used"); }, readContact: () => contact, readContactHistory: () => [contact], revealChannel: () => ({ channelId: channel.id, value: "+15550104567", purpose: "CLIENT_SERVICE" }),
    },
    clientRequirementService: {
      createClient: (request) => { seen.push(request.actor); return client; }, readClient: () => client,
      createRequirement: (request) => { seen.push(request.actor); return requirement; }, activateRequirement: () => { if (fail) throw new Error("REQUIREMENT_INVALID"); return { ...requirement, version: 2, status: "ACTIVE", readiness: "READY" }; }, reviseRequirement: () => ({ ...requirement, version: 2 }), transitionRequirement: () => ({ ...requirement, version: 2, status: "PAUSED" }), readRequirement: () => requirement, readRequirementHistory: () => [requirement], validateRequirementProposal: () => ({ status: "VALID", route: "HUMAN_REVIEW_REQUIRED" }), validateSearchInterpretation: () => ({ status: "VALID", route: "HUMAN_REVIEW_REQUIRED" }),
    },
  };
}

test("TEST-029/030 API-007–009 derive Actor from session and return bounded states", () => {
  const seen: SessionContext[] = [];
  const api = new ContactClientApi(dependencies(seen));
  const contactResponse = api.createContact({ context: { sessionId: actor.id, correlationId: "correlation-api-contact" }, displayLabel: "Masked Client", teamId: "team-a", consentRefs: ["consent-api"], purpose: "CLIENT_SERVICE", actor: { principalId: "forged" } } as Parameters<ContactClientApi["createContact"]>[0] & { actor: unknown });
  const clientResponse = api.createClient({ context: { sessionId: actor.id, correlationId: "correlation-api-client" }, teamId: "team-a", assignedAgentId: actor.principalId, contactRef: client.contactRef, consentRefs: client.consentRefs, purpose: "CLIENT_SERVICE" });
  const requirementResponse = api.createRequirement({ context: { sessionId: actor.id, correlationId: "correlation-api-requirement" }, clientId: client.id, expectedClientVersion: 1, originalSourceRef: requirement.originalSourceRef, intent: "RENT", constraints: [], locations: [], validationGaps: [], purpose: "CLIENT_SERVICE" });
  assert.equal(contactResponse.ok && contactResponse.data.presentationState, "MASKED");
  assert.equal(clientResponse.ok && clientResponse.data.presentationState, "READY");
  assert.equal(requirementResponse.ok && requirementResponse.data.presentationState, "DRAFT");
  assert.deepEqual(seen, [actor, actor, actor]);
});

test("TEST-030 API-009 exposes readiness/stale boundary without Matching execution", () => {
  const api = new ContactClientApi(dependencies([]));
  const response = api.readRequirement({ context: { sessionId: actor.id, correlationId: "correlation-api-read-requirement" }, requirementId: requirement.id, purpose: "CLIENT_SERVICE" });
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal(response.data.readiness, "NOT_READY");
    assert.equal(response.data.staleMatchSignal, false);
    assert.equal("matches" in response.data, false);
  }
});

test("API-007–009 fail with safe errors for missing session and invalid Requirement", () => {
  const api = new ContactClientApi(dependencies([], true));
  const noSession = api.readClient({ context: { correlationId: "correlation-api-no-session" }, clientId: client.id, purpose: "CLIENT_SERVICE" });
  const invalid = api.activateRequirement({ context: { sessionId: actor.id, correlationId: "correlation-api-invalid" }, requirementId: requirement.id, expectedVersion: 1, reason: "Invalid", purpose: "CLIENT_SERVICE" });
  assert.equal(noSession.ok, false);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "REQUIREMENT_INVALID");
});

test("SP-004 composition exposes API-007–009 without replacing earlier API modules", () => {
  const sp004 = dependencies([]);
  const composed = composeApiModulesBeforePublication({
    sessionService: { readSession: sp004.sessionReader },
    contactService: sp004.contactService,
    clientRequirementService: sp004.clientRequirementService,
    authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {},
  } as unknown as ApiModuleDependencies);
  assert.ok(composed.contactClient instanceof ContactClientApi);
  assert.ok("identity" in composed);
  assert.ok("propertyAndListing" in composed);
});
