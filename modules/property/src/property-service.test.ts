import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { PropertyService } from "./property-service.js";

function actor(id: string, role: "AGT" | "DST"): SessionContext {
  return Object.freeze({ id: `session-${id}`, principalId: id, principalType: "HUMAN", roles: [role], teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T01:00:00.000Z", absoluteExpiresAt: "2026-07-19T02:00:00.000Z", familyId: `family-${id}`, refreshReference: `refresh-${id}` });
}

function fixture(): PropertyService {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => `audit-property-${String(++sequence)}` });
  const assignments: readonly RoleAssignment[] = [
    { id: "assignment-agent", principalId: "agent-1", role: "AGT", teamIds: ["team-a"], resourceTypes: ["Property"], purposes: ["LISTING_GOVERNANCE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
    { id: "assignment-steward", principalId: "steward-1", role: "DST", teamIds: ["team-a"], resourceTypes: ["Property", "PropertyAlias"], purposes: ["LISTING_GOVERNANCE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
  ];
  const authorizationService = new AuthorizationService({ assignments, auditSink: audit, clock, policyVersion: "auth-v1" });
  return new PropertyService({ authorizationService, auditSink: audit, clock, idFactory: () => `property-${String(++sequence)}`, policyVersion: "property-v1" });
}

test("TEST-028 proposes and independently activates a versioned Property master", () => {
  const service = fixture();
  const proposed = service.propose({ actor: actor("agent-1", "AGT"), entityType: "Property", canonicalName: "River Park", parentRef: { entityType: "Location", entityId: "location-1", version: 1 }, reason: "Candidate evidence needs a canonical target", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-property-propose" });
  assert.equal(proposed.status, "proposed");
  assert.equal(proposed.authority, "CANONICAL_MASTER");
  assert.equal(Object.isFrozen(proposed.parentRef), true);

  const active = service.decide({ actor: actor("steward-1", "DST"), nodeId: proposed.id, expectedVersion: proposed.version, decision: "ACTIVATE", reason: "Hierarchy and evidence reviewed", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-property-activate" });
  assert.equal(active.status, "active");
  assert.equal(active.version, 2);
  assert.throws(() => service.decide({ actor: actor("steward-1", "DST"), nodeId: proposed.id, expectedVersion: 1, decision: "RETIRE", reason: "stale", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-property-stale" }), /VERSION_CONFLICT/);
});

test("TEST-040 AI normalization remains an alias proposal and cannot mutate master", () => {
  const service = fixture();
  const proposed = service.propose({ actor: actor("steward-1", "DST"), entityType: "Property", canonicalName: "Harbor View", parentRef: { entityType: "Location", entityId: "location-2", version: 1 }, reason: "Steward proposal", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-property-propose-2" });
  const alias = service.proposeAlias({ actor: actor("steward-1", "DST"), targetRef: { entityType: "Property", entityId: proposed.id, version: proposed.version }, alias: "Harbour View", language: "en", sourceRef: { entityType: "AiResult", entityId: "ai-result-2", version: 1 }, confidence: "MEDIUM", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-alias" });
  assert.equal(alias.status, "proposed");
  assert.equal(Object.isFrozen(alias.sourceRef), true);
  assert.equal(service.read(proposed.id).canonicalName, "Harbor View");
});

test("TEST-044 deterministic search returns scoped canonical and alias matches", () => {
  const service = fixture();
  const proposed = service.propose({ actor: actor("steward-1", "DST"), entityType: "Property", canonicalName: "Cedar Heights", parentRef: { entityType: "Location", entityId: "location-3", version: 1 }, reason: "Steward proposal", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-property-propose-3" });
  service.proposeAlias({ actor: actor("steward-1", "DST"), targetRef: { entityType: "Property", entityId: proposed.id, version: proposed.version }, alias: "Cedar Hts", language: "en", sourceRef: { entityType: "RawSource", entityId: "raw-3", version: 1 }, confidence: "HIGH", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-alias-3" });
  const matches = service.search({ actor: actor("steward-1", "DST"), query: "cedar hts", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-search" });
  assert.equal(matches[0]?.id, proposed.id);
  assert.equal(matches[0]?.classification, "INTERNAL");
  assert.equal(service.readForActor({ actor: actor("steward-1", "DST"), nodeId: proposed.id, purpose: "LISTING_GOVERNANCE", correlationId: "correlation-property-read" }).id, proposed.id);
});
