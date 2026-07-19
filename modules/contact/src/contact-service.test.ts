import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { ContactService } from "./contact-service.js";

const clock = (): Date => new Date("2026-07-19T03:00:00.000Z");

function actor(overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({ id: "session-contact-agent", principalId: "agent-contact", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T02:00:00.000Z", expiresAt: "2026-07-19T04:00:00.000Z", absoluteExpiresAt: "2026-07-19T05:00:00.000Z", familyId: "family-contact", refreshReference: "refresh-contact", ...overrides });
}

function fixture(): { readonly service: ContactService; readonly audit: AuditLog } {
  let sequence = 0;
  const audit = new AuditLog({ clock, idFactory: () => `audit-contact-${String(++sequence)}` });
  const assignments: readonly RoleAssignment[] = [{ id: "assignment-contact-agent", principalId: "agent-contact", role: "AGT", teamIds: ["team-a"], resourceTypes: ["Contact", "ContactChannel", "ContactCase"], purposes: ["CLIENT_SERVICE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" }];
  const authorization = new AuthorizationService({ assignments, auditSink: audit, clock, policyVersion: "authorization-v1" });
  return { service: new ContactService({ authorizationService: authorization, auditSink: audit, clock, idFactory: () => `contact-object-${String(++sequence)}`, policyVersion: "contact-v1" }), audit };
}

function context() { return { actor: actor(), purpose: "CLIENT_SERVICE", correlationId: "correlation-contact" } as const; }

test("TEST-029 FEAT-008 masks Contact channels and audits explicit purpose reveal", () => {
  const { service, audit } = fixture();
  const contact = service.createContact({ ...context(), displayLabel: "Client A", teamId: "team-a", consentRefs: ["consent-1"] });
  const channel = service.addChannel({ ...context(), contactId: contact.id, expectedContactVersion: 1, channelType: "PHONE", value: "+15550104567", useScope: "CLIENT_SERVICE" });
  assert.equal(channel.maskedValue, "***4567");
  assert.equal("value" in channel, false);
  assert.equal(service.readContact({ ...context(), contactId: contact.id }).channels[0]?.maskedValue, "***4567");
  const revealed = service.revealChannel({ ...context(), channelId: channel.id, reason: "Call assigned client" });
  assert.equal(revealed.value, "+15550104567");
  assert.equal(revealed.purpose, "CLIENT_SERVICE");
  const evidence = audit.query({ requesterId: "privacy-reviewer", purpose: "TEST" });
  assert.ok(evidence.some((event) => event.eventType === "CONTACT_CHANNEL_REVEALED"));
  assert.equal(JSON.stringify(evidence).includes("+15550104567"), false);
});

test("TEST-020 Contact lifecycle records minimal communication and enforces DNC", () => {
  const { service } = fixture();
  const contact = service.createContact({ ...context(), displayLabel: "Client B", teamId: "team-a", consentRefs: ["consent-2"] });
  const channel = service.addChannel({ ...context(), contactId: contact.id, expectedContactVersion: 1, channelType: "EMAIL", value: "client@example.test", useScope: "CLIENT_SERVICE" });
  const contactCase = service.openCase({ ...context(), contactId: contact.id, channelId: channel.id });
  const attempted = service.recordAttempt({ ...context(), caseId: contactCase.id, expectedVersion: 1, direction: "OUTBOUND", outcome: "NO_RESPONSE", evidenceRef: "communication-source-1" });
  assert.equal(attempted.contactCase.status, "NO_RESPONSE");
  assert.equal(attempted.communication.evidenceRef, "communication-source-1");
  assert.equal("content" in attempted.communication, false);
  const dnc = service.setDoNotContact({ ...context(), caseId: contactCase.id, expectedVersion: 2, reason: "Client requested no further contact" });
  assert.equal(dnc.status, "DO_NOT_CONTACT");
  assert.throws(() => service.recordAttempt({ ...context(), caseId: contactCase.id, expectedVersion: 3, direction: "OUTBOUND", outcome: "CONTACTED", evidenceRef: "communication-source-2" }), /DO_NOT_CONTACT/u);
  assert.throws(() => service.openCase({ ...context(), contactId: contact.id, channelId: channel.id }), /DO_NOT_CONTACT/u);
});

test("TEST-029 channel revocation blocks reveal and preserves append-only history", () => {
  const { service } = fixture();
  const contact = service.createContact({ ...context(), displayLabel: "Client C", teamId: "team-a", consentRefs: ["consent-3"] });
  const channel = service.addChannel({ ...context(), contactId: contact.id, expectedContactVersion: 1, channelType: "PHONE", value: "+15550107777", useScope: "CLIENT_SERVICE" });
  const corrected = service.correctContact({ ...context(), contactId: contact.id, expectedVersion: 2, displayLabel: "Client C Corrected", reason: "Confirmed spelling" });
  service.revokeChannel({ ...context(), channelId: channel.id, expectedVersion: 1, reason: "Consent revoked" });
  assert.equal(corrected.version, 3);
  assert.deepEqual(service.readContactHistory({ ...context(), contactId: contact.id }).map((entry) => entry.version), [1, 2, 3, 4]);
  assert.throws(() => service.revealChannel({ ...context(), channelId: channel.id, reason: "Attempt after revoke" }), /CHANNEL_UNAVAILABLE/u);
});

test("TEST-048 Contact scope fails closed for a different team or purpose", () => {
  const { service } = fixture();
  const contact = service.createContact({ ...context(), displayLabel: "Client D", teamId: "team-a", consentRefs: ["consent-4"] });
  assert.throws(() => service.readContact({ ...context(), actor: actor({ teamId: "team-b" }), contactId: contact.id }), /SCOPE_DENIED/u);
  assert.throws(() => service.readContact({ ...context(), purpose: "MARKETING", contactId: contact.id }), /SCOPE_DENIED/u);
});
