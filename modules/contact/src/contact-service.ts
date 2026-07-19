import type { AuditPrincipal, AuditSink, Clock, IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { maskRestrictedValue } from "../../security/src/privacy-controls.js";

export type ContactCaseStatus = "PENDING" | "CONTACTED" | "NO_RESPONSE" | "INVALID_CHANNEL" | "DO_NOT_CONTACT" | "COMPLETED";
export interface ContactChannel { readonly id: string; readonly version: number; readonly contactId: string; readonly channelType: "PHONE" | "EMAIL" | "MESSAGING"; readonly maskedValue: string; readonly useScope: string; readonly status: "ACTIVE" | "REVOKED" | "INVALID"; readonly classification: "RESTRICTED_PERSONAL" }
export interface Contact { readonly id: string; readonly version: number; readonly displayLabel: string; readonly teamId: string; readonly status: "ACTIVE" | "RESTRICTED" | "INACTIVE"; readonly consentRefs: readonly string[]; readonly channels: readonly ContactChannel[]; readonly classification: "RESTRICTED_PERSONAL" }
export interface ContactCase { readonly id: string; readonly version: number; readonly contactId: string; readonly channelId: string; readonly teamId: string; readonly purpose: string; readonly status: ContactCaseStatus; readonly classification: "RESTRICTED_PERSONAL" }
export interface Communication { readonly id: string; readonly version: 1; readonly caseId: string; readonly direction: "INBOUND" | "OUTBOUND"; readonly purpose: string; readonly outcome: Exclude<ContactCaseStatus, "PENDING" | "DO_NOT_CONTACT">; readonly evidenceRef: string; readonly occurredAt: string; readonly classification: "RESTRICTED_PERSONAL" }

interface Dependencies { readonly authorizationService: AuthorizationService; readonly auditSink: AuditSink; readonly clock: Clock; readonly idFactory: IdFactory; readonly policyVersion: string }
interface Context { readonly actor: SessionContext; readonly purpose: string; readonly correlationId: string; readonly requestId?: string }

function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function principal(session: SessionContext): AuditPrincipal { return { id: session.principalId, type: session.principalType, roles: session.roles, ...(session.teamId === undefined ? {} : { teamId: session.teamId }), sessionId: session.id }; }

export class ContactService {
  readonly #authorization: AuthorizationService; readonly #audit: AuditSink; readonly #clock: Clock; readonly #idFactory: IdFactory; readonly #policyVersion: string;
  readonly #contacts = new Map<string, Contact>(); readonly #contactHistory = new Map<string, Contact[]>(); readonly #channels = new Map<string, ContactChannel>(); readonly #channelValues = new Map<string, string>(); readonly #dncChannels = new Set<string>(); readonly #cases = new Map<string, ContactCase>(); readonly #communications = new Map<string, Communication[]>();

  public constructor(dependencies: Dependencies) { this.#authorization = dependencies.authorizationService; this.#audit = dependencies.auditSink; this.#clock = dependencies.clock; this.#idFactory = dependencies.idFactory; this.#policyVersion = dependencies.policyVersion; }

  public createContact(request: Context & { readonly displayLabel: string; readonly teamId: string; readonly consentRefs: readonly string[] }): Contact {
    if (request.displayLabel.trim().length === 0 || request.consentRefs.length === 0) throw new Error("CONSENT_SCOPE_DENIED");
    this.#authorize(request, "contact.create", "Contact", "new", request.teamId);
    const contact = immutable({ id: this.#idFactory(), version: 1, displayLabel: request.displayLabel, teamId: request.teamId, status: "ACTIVE" as const, consentRefs: request.consentRefs, channels: [], classification: "RESTRICTED_PERSONAL" as const });
    this.#contacts.set(contact.id, contact); this.#appendHistory(contact); this.#record("CONTACT_CREATED", "contact.create", "Contact", contact.id, contact.version, request, contact.teamId); return contact;
  }

  public correctContact(request: Context & { readonly contactId: string; readonly expectedVersion: number; readonly displayLabel: string; readonly reason: string }): Contact {
    const current = this.#currentContact(request.contactId); this.#version(current.version, request.expectedVersion); if (request.reason.trim().length === 0) throw new Error("REASON_REQUIRED"); this.#authorize(request, "contact.edit", "Contact", current.id, current.teamId, current.version);
    const updated = immutable({ ...current, version: current.version + 1, displayLabel: request.displayLabel }); this.#contacts.set(updated.id, updated); this.#appendHistory(updated); this.#record("CONTACT_CORRECTED", "contact.edit", "Contact", updated.id, updated.version, request, updated.teamId, request.reason); return updated;
  }

  public addChannel(request: Context & { readonly contactId: string; readonly expectedContactVersion: number; readonly channelType: ContactChannel["channelType"]; readonly value: string; readonly useScope: string }): ContactChannel {
    const current = this.#currentContact(request.contactId); this.#version(current.version, request.expectedContactVersion); if (request.value.trim().length === 0 || request.useScope !== request.purpose) throw new Error("CONSENT_SCOPE_DENIED"); this.#authorize(request, "contact.edit", "Contact", current.id, current.teamId, current.version);
    const channel = immutable({ id: this.#idFactory(), version: 1, contactId: current.id, channelType: request.channelType, maskedValue: maskRestrictedValue(request.value, "RESTRICTED_PERSONAL"), useScope: request.useScope, status: "ACTIVE" as const, classification: "RESTRICTED_PERSONAL" as const });
    this.#channels.set(channel.id, channel); this.#channelValues.set(channel.id, request.value);
    const updated = immutable({ ...current, version: current.version + 1, channels: [...current.channels, channel] }); this.#contacts.set(updated.id, updated); this.#appendHistory(updated); this.#record("CONTACT_CHANNEL_ADDED", "contact.edit", "ContactChannel", channel.id, channel.version, request, current.teamId); return channel;
  }

  public revokeChannel(request: Context & { readonly channelId: string; readonly expectedVersion: number; readonly reason: string }): ContactChannel {
    const current = this.#currentChannel(request.channelId); const contact = this.#currentContact(current.contactId); this.#version(current.version, request.expectedVersion); if (request.reason.trim().length === 0) throw new Error("REASON_REQUIRED"); this.#authorize(request, "contact.edit", "ContactChannel", current.id, contact.teamId, current.version);
    const updated = immutable({ ...current, version: current.version + 1, status: "REVOKED" as const }); this.#channels.set(updated.id, updated); const updatedContact = immutable({ ...contact, version: contact.version + 1, channels: contact.channels.map((item) => item.id === updated.id ? updated : item) }); this.#contacts.set(contact.id, updatedContact); this.#appendHistory(updatedContact); this.#record("CONTACT_CHANNEL_REVOKED", "contact.edit", "ContactChannel", updated.id, updated.version, request, contact.teamId, request.reason); return updated;
  }

  public openCase(request: Context & { readonly contactId: string; readonly channelId: string }): ContactCase {
    const contact = this.#currentContact(request.contactId); const channel = this.#currentChannel(request.channelId); if (this.#dncChannels.has(channel.id)) throw new Error("DO_NOT_CONTACT"); if (channel.contactId !== contact.id || channel.status !== "ACTIVE" || channel.useScope !== request.purpose) throw new Error("CHANNEL_UNAVAILABLE"); this.#authorize(request, "contact.attempt", "ContactCase", "new", contact.teamId);
    const contactCase = immutable({ id: this.#idFactory(), version: 1, contactId: contact.id, channelId: channel.id, teamId: contact.teamId, purpose: request.purpose, status: "PENDING" as const, classification: "RESTRICTED_PERSONAL" as const }); this.#cases.set(contactCase.id, contactCase); this.#record("CONTACT_CASE_OPENED", "contact.attempt", "ContactCase", contactCase.id, contactCase.version, request, contact.teamId); return contactCase;
  }

  public recordAttempt(request: Context & { readonly caseId: string; readonly expectedVersion: number; readonly direction: Communication["direction"]; readonly outcome: Communication["outcome"]; readonly evidenceRef: string }): Readonly<{ readonly contactCase: ContactCase; readonly communication: Communication }> {
    const current = this.#currentCase(request.caseId); this.#version(current.version, request.expectedVersion); if (current.status === "DO_NOT_CONTACT") throw new Error("DO_NOT_CONTACT"); const channel = this.#currentChannel(current.channelId); if (channel.status !== "ACTIVE" || channel.useScope !== request.purpose) throw new Error("CHANNEL_UNAVAILABLE"); if (request.evidenceRef.trim().length === 0) throw new Error("EVIDENCE_INVALID"); this.#authorize(request, "contact.attempt", "ContactCase", current.id, current.teamId, current.version);
    const communication = immutable({ id: this.#idFactory(), version: 1 as const, caseId: current.id, direction: request.direction, purpose: request.purpose, outcome: request.outcome, evidenceRef: request.evidenceRef, occurredAt: this.#clock().toISOString(), classification: "RESTRICTED_PERSONAL" as const }); const updated = immutable({ ...current, version: current.version + 1, status: request.outcome }); this.#cases.set(updated.id, updated); this.#communications.set(current.id, [...(this.#communications.get(current.id) ?? []), communication]); this.#record("CONTACT_ATTEMPT_RECORDED", "contact.attempt", "ContactCase", updated.id, updated.version, request, current.teamId); return Object.freeze({ contactCase: updated, communication });
  }

  public setDoNotContact(request: Context & { readonly caseId: string; readonly expectedVersion: number; readonly reason: string }): ContactCase {
    const current = this.#currentCase(request.caseId); this.#version(current.version, request.expectedVersion); if (request.reason.trim().length === 0) throw new Error("REASON_REQUIRED"); this.#authorize(request, "contact.dnc", "ContactCase", current.id, current.teamId, current.version); const updated = immutable({ ...current, version: current.version + 1, status: "DO_NOT_CONTACT" as const }); this.#cases.set(updated.id, updated); this.#dncChannels.add(current.channelId); this.#record("CONTACT_DO_NOT_CONTACT_SET", "contact.dnc", "ContactCase", updated.id, updated.version, request, current.teamId); return updated;
  }

  public readContact(request: Context & { readonly contactId: string }): Contact { const current = this.#currentContact(request.contactId); this.#authorize(request, "contact.read", "Contact", current.id, current.teamId, current.version); return current; }
  public readContactHistory(request: Context & { readonly contactId: string }): readonly Contact[] { const current = this.#currentContact(request.contactId); this.#authorize(request, "contact.read", "Contact", current.id, current.teamId, current.version); return Object.freeze([...(this.#contactHistory.get(current.id) ?? [])]); }

  public revealChannel(request: Context & { readonly channelId: string; readonly reason: string }): Readonly<{ readonly channelId: string; readonly value: string; readonly purpose: string }> {
    const channel = this.#currentChannel(request.channelId); const contact = this.#currentContact(channel.contactId); if (channel.status !== "ACTIVE" || channel.useScope !== request.purpose) throw new Error("CHANNEL_UNAVAILABLE"); this.#authorize(request, "contact.reveal", "ContactChannel", channel.id, contact.teamId, channel.version, request.reason); const value = this.#channelValues.get(channel.id); if (value === undefined) throw new Error("CHANNEL_UNAVAILABLE"); this.#record("CONTACT_CHANNEL_REVEALED", "contact.reveal", "ContactChannel", channel.id, channel.version, request, contact.teamId, request.reason); return Object.freeze({ channelId: channel.id, value, purpose: request.purpose });
  }

  #currentContact(id: string): Contact { const item = this.#contacts.get(id); if (item === undefined) throw new Error("CONTACT_NOT_FOUND"); return item; }
  #currentChannel(id: string): ContactChannel { const item = this.#channels.get(id); if (item === undefined) throw new Error("CHANNEL_UNAVAILABLE"); return item; }
  #currentCase(id: string): ContactCase { const item = this.#cases.get(id); if (item === undefined) throw new Error("CONTACT_NOT_FOUND"); return item; }
  #version(actual: number, expected: number): void { if (actual !== expected) throw new Error("VERSION_CONFLICT"); }
  #appendHistory(contact: Contact): void { this.#contactHistory.set(contact.id, [...(this.#contactHistory.get(contact.id) ?? []), contact]); }
  #authorize(context: Context, action: string, type: string, id: string, teamId: string, version?: number, reason?: string): void { if (context.actor.teamId !== teamId) throw new Error("SCOPE_DENIED"); const decision = this.#authorization.evaluate({ session: context.actor, action, resource: { type, id, teamId, ...(version === undefined ? {} : { version }) }, purpose: context.purpose, ...(reason === undefined ? {} : { reason }), ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId }); if (decision.effect === "DENY") throw new Error(decision.reasonCode); }
  #record(eventType: string, action: string, type: string, id: string, version: number, context: Context, teamId: string, _reason?: string): void { this.#audit.append({ eventType, principal: principal(context.actor), action, target: { type, id, version }, purpose: context.purpose, policyVersion: this.#policyVersion, classification: "RESTRICTED_PERSONAL", decision: "ALLOW", outcome: "COMPLETED", ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId, details: { teamId, dataHandling: "MASKED_OR_REFERENCE_ONLY", reasonRecordedInDomainHistory: _reason !== undefined } }); }
}
