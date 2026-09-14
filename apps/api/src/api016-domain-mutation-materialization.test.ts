import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { AuditIntentMaterializer, DurableAuditEventStore, createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "../../../modules/audit/src/index.js";
import { DurableContactStore, type ContactAuditIntent } from "../../../modules/contact/src/contact-durable-persistence.js";
import type { Contact } from "../../../modules/contact/src/contact-service.js";
import { DurableIntakeStore, type IntakeAuditIntent, type TenantBoundIntake } from "../../../modules/intake/src/intake-durable-persistence.js";
import { DurableListingStore, type ListingAuditIntent } from "../../../modules/listing/src/listing-durable-persistence.js";
import type { CandidateListing } from "../../../modules/listing/src/listing-service.js";
import { DurableMatchingStore, type MatchingAuditIntent } from "../../../modules/matching/src/matching-durable-persistence.js";
import type { MatchResult, MatchRun } from "../../../modules/matching/src/matching-service.js";
import { DurablePropertyStore, type PropertyAuditIntent } from "../../../modules/property/src/property-durable-persistence.js";
import type { PropertyNode } from "../../../modules/property/src/property-service.js";
import { DurableSourceRegistryStore, type SourceRegistryAuditIntent, type TenantBoundSourcePolicy } from "../../../modules/source/src/source-registry-durable-persistence.js";
import { createMaterializationReadyAuditIntentSources } from "./api016-enriched-intent-source-wiring.js";
import { createStagingApi016AuditRuntime } from "./api016-production-composition.js";

const sourceTimes = Object.freeze({
  SOURCE_REGISTRY: "2026-09-14T00:00:01.000Z",
  INTAKE: "2026-09-14T00:00:02.000Z",
  PROPERTY: "2026-09-14T00:00:03.000Z",
  LISTING: "2026-09-14T00:00:04.000Z",
  CONTACT: "2026-09-14T00:00:05.000Z",
  MATCHING: "2026-09-14T00:00:06.000Z",
} as const);
const materializedAt = "2026-09-14T01:00:00.000Z";

function baseIntent(sourceDomain: EnrichedAuditIntentV2["sourceDomain"], committedAt: string): EnrichedAuditIntentV2 {
  return {
    auditIntentContractVersion: "v2",
    intentId: "shared-intent",
    sourceDomain,
    aggregateId: "placeholder",
    mutationIdentity: "shared-intent",
    eventType: "PLACEHOLDER",
    eventCategory: "COMMAND_ACCEPTED",
    action: "placeholder",
    target: { type: "Placeholder", id: "placeholder", version: 1 },
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-a", sessionId: "session-a" } },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" },
    purpose: "LISTING_GOVERNANCE",
    policyVersion: "policy-v1",
    classification: "CONFIDENTIAL_BUSINESS",
    decision: "ALLOW",
    outcome: "COMPLETED",
    committedAt,
    correlationId: `correlation:${sourceDomain}`,
    evidenceRefs: [`evidence:${sourceDomain}`],
  };
}

test("Phase 2E materializes six actual domain mutations with durable replay and source chronology", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase2e-six-source-"));
  const paths = Object.freeze({
    source: join(directory, "source.sqlite"), intake: join(directory, "intake.sqlite"), property: join(directory, "property.sqlite"),
    listing: join(directory, "listing.sqlite"), contact: join(directory, "contact.sqlite"), matching: join(directory, "matching.sqlite"), audit: join(directory, "audit.sqlite"),
  });
  let sourceStore: DurableSourceRegistryStore | undefined;
  let intakeStore: DurableIntakeStore | undefined;
  let propertyStore: DurablePropertyStore | undefined;
  let listingStore: DurableListingStore | undefined;
  let contactStore: DurableContactStore | undefined;
  let matchingStore: DurableMatchingStore | undefined;
  let runtime: ReturnType<typeof createStagingApi016AuditRuntime> | undefined;
  try {
    sourceStore = new DurableSourceRegistryStore({ databasePath: paths.source });
    intakeStore = new DurableIntakeStore({ databasePath: paths.intake, tenantResolver: { resolveTenant: () => "tenant-a" } });
    propertyStore = new DurablePropertyStore({ databasePath: paths.property });
    listingStore = new DurableListingStore({ databasePath: paths.listing, tenantResolver: { resolveCandidateBinding: () => ({ tenantId: "tenant-a", teamId: "team-a" }) } });
    contactStore = new DurableContactStore({ databasePath: paths.contact, caseResolver: { resolveCaseBinding: () => undefined } });
    matchingStore = new DurableMatchingStore({ databasePath: paths.matching, bindingResolver: {
      resolveRequirementBinding: () => ({ tenantId: "tenant-a", teamId: "team-a" }), resolveCandidateBinding: () => ({ tenantId: "tenant-a", teamId: "team-a" }),
    } });

    const source: TenantBoundSourcePolicy = { tenantId: "tenant-a", id: "source-a", name: "Approved portal", sourceType: "PORTAL", status: "DRAFT", policyVersion: 1, allowedMethods: ["MANUAL"], allowedPurposes: ["LISTING_INTAKE"], classification: "CONFIDENTIAL_BUSINESS", proposedBy: "actor-a" };
    const sourceIntent = { ...baseIntent("SOURCE_REGISTRY", sourceTimes.SOURCE_REGISTRY), aggregateId: source.id, eventType: "SOURCE_POLICY_PROPOSED", action: "source.propose", target: { type: "SourceRegistry", id: source.id, version: 1 }, purpose: "SOURCE_GOVERNANCE", outcome: "ACCEPTED", principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["ADM"], sessionId: "session-a" } }, visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" } } as SourceRegistryAuditIntent;
    sourceStore.create({ record: source, commandId: "shared-intent", commandFingerprint: "sha256:source", auditIntent: sourceIntent });

    const intake: TenantBoundIntake = { tenantId: "tenant-a", id: "intake-a", version: 1, status: "DRAFT", rawSourceId: "raw-a", rawSourceVersion: 1, rawSourceFingerprint: "sha256:raw-a", purpose: "LISTING_INTAKE", classification: "CONFIDENTIAL_BUSINESS", createdBy: "actor-a", createdAt: sourceTimes.INTAKE, attachmentReferences: [] };
    const intakeIntent = { ...baseIntent("INTAKE", sourceTimes.INTAKE), aggregateId: intake.id, eventType: "INTAKE_CREATED", action: "intake.create", target: { type: "Intake", id: intake.id, version: 1 }, purpose: "LISTING_INTAKE", outcome: "ACCEPTED", visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" } } as IntakeAuditIntent;
    intakeStore.create({ record: intake, commandId: "shared-intent", commandFingerprint: "sha256:intake", auditIntent: intakeIntent });

    const property: PropertyNode = { id: "property-a", version: 1, entityType: "Property", canonicalName: "Tower A", status: "proposed", authority: "CANONICAL_MASTER", classification: "INTERNAL", proposedBy: "actor-a", createdAt: sourceTimes.PROPERTY };
    const propertyIntent = { ...baseIntent("PROPERTY", sourceTimes.PROPERTY), aggregateId: property.id, eventType: "PROPERTY_PROPOSED", action: "property.propose", target: { type: "Property", id: property.id, version: 1 }, classification: "INTERNAL", visibility: { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" } } as PropertyAuditIntent;
    propertyStore.createNode({ record: property, commandId: "shared-intent", commandFingerprint: "sha256:property", auditIntent: propertyIntent });

    const listing: CandidateListing = { id: "candidate-a", version: 1, status: "candidate", authority: "CANDIDATE", sourceRefs: [{ entityType: "RawSource", entityId: "raw-a", version: 1 }], intakeRef: { entityType: "Intake", entityId: "intake-a", version: 1 }, unresolvedFields: [], relatedCandidateIds: [], classification: "CONFIDENTIAL_BUSINESS", createdBy: "actor-a" };
    const listingIntent = { ...baseIntent("LISTING", sourceTimes.LISTING), aggregateId: listing.id, eventType: "CANDIDATE_CREATED", action: "candidate.create", target: { type: "CandidateListing", id: listing.id, version: 1 }, policyVersion: "listing-v1" } as ListingAuditIntent;
    listingStore.createCandidate({ record: listing, commandId: "shared-intent", commandFingerprint: "sha256:listing", auditIntent: listingIntent });

    const contact: Contact = { id: "contact-a", version: 1, displayLabel: "Client A", teamId: "team-a", status: "ACTIVE", consentRefs: ["consent-a"], channels: [], classification: "RESTRICTED_PERSONAL" };
    const contactIntent = { ...baseIntent("CONTACT", sourceTimes.CONTACT), aggregateId: contact.id, eventType: "CONTACT_CREATED", action: "contact.create", target: { type: "Contact", id: contact.id, version: 1 }, purpose: "CLIENT_SERVICE", policyVersion: "contact-v1", classification: "RESTRICTED_PERSONAL" } as ContactAuditIntent;
    contactStore.createContact({ tenantId: "tenant-a", record: contact, commandId: "shared-intent", commandFingerprint: "sha256:contact", auditIntent: contactIntent });

    const result: MatchResult = { id: "result-a", version: 1, runId: "run-a", teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", classification: "RESTRICTED_PERSONAL", requirementRef: { id: "requirement-a", version: 1 }, candidateRef: { id: "candidate-a", version: 1 }, offerRef: { id: "offer-a", version: 1 }, hardEligibility: "PASS", hardMatchCount: 1, score: 80, budgetFit: 75, rank: 1, components: [], explanation: { kind: "DETERMINISTIC", reasonCodes: [], limitations: [] }, matcherVersion: "deterministic-matching-v1", policyVersion: "policy-v1", calculatedAt: sourceTimes.MATCHING, reviewHistory: [] };
    const run: MatchRun = { id: "run-a", version: 1, teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", requirementRef: { id: "requirement-a", version: 1 }, cohortSize: 1, results: [result], reviewResults: [result], requestedBy: "actor-a", calculatedAt: sourceTimes.MATCHING, policyVersion: "policy-v1" };
    const matchingIntent = { ...baseIntent("MATCHING", sourceTimes.MATCHING), aggregateId: run.id, mutationIdentity: "run-command", eventType: "MATCH_RUN_CREATED", action: "matching.request", target: { type: "MatchRun", id: run.id, version: 1 }, purpose: "CLIENT_MATCHING", classification: "RESTRICTED_PERSONAL" } as MatchingAuditIntent;
    matchingStore.createRun({ tenantId: "tenant-a", record: run, commandId: "run-command", commandFingerprint: "sha256:matching", auditIntent: matchingIntent });

    const stores = { sourceRegistry: () => sourceStore!.listAuditIntents({ tenantId: "tenant-a" }), intake: () => intakeStore!.listAuditIntents({ tenantId: "tenant-a" }), property: () => propertyStore!.listAuditIntents(), listing: () => listingStore!.listAuditIntents({ tenantId: "tenant-a" }), contact: () => contactStore!.listAuditIntents({ tenantId: "tenant-a" }), matching: () => matchingStore!.listAuditIntents({ tenantId: "tenant-a" }) };
    runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath: paths.audit, sources: createMaterializationReadyAuditIntentSources(stores), clock: () => new Date(materializedAt) });
    assert.deepEqual(runtime.status(), { health: "HEALTHY", readiness: "READY", sourceCount: 6 });
    const first = runtime.materializeAvailable();
    assert.equal(first.length, 6);
    assert.deepEqual(first.map((event) => event.sourceDomain).sort(), ["CONTACT", "INTAKE", "LISTING", "MATCHING", "PROPERTY", "SOURCE_REGISTRY"]);
    for (const event of first) {
      assert.equal(event.auditIntentId, "shared-intent");
      assert.equal(event.occurredAt, sourceTimes[event.sourceDomain as keyof typeof sourceTimes]);
      assert.equal(event.materializedAt, materializedAt);
      assert.equal(event.principal.id, "actor-a");
    }
    assert.deepEqual(first.find((event) => event.sourceDomain === "PROPERTY")?.visibility, { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" });
    assert.deepEqual(first.find((event) => event.sourceDomain === "SOURCE_REGISTRY")?.visibility, { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" });
    assert.deepEqual(first.find((event) => event.sourceDomain === "INTAKE")?.visibility, { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" });
    for (const domain of ["LISTING", "CONTACT", "MATCHING"] as const) {
      assert.deepEqual(first.find((event) => event.sourceDomain === domain)?.visibility, { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" });
    }
    assert.deepEqual(first.find((event) => event.sourceDomain === "SOURCE_REGISTRY")?.principal, { id: "actor-a", type: "HUMAN", roles: ["ADM"], sessionId: "session-a" });
    for (const domain of ["INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING"] as const) {
      assert.deepEqual(first.find((event) => event.sourceDomain === domain)?.principal, { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-a", sessionId: "session-a" });
    }
    assert.equal(runtime.materializeAvailable().length, 6);
    runtime.close(); runtime = undefined;
    runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath: paths.audit, sources: createMaterializationReadyAuditIntentSources(stores), clock: () => new Date("2026-09-14T02:00:00.000Z") });
    const replay = runtime.materializeAvailable();
    assert.equal(replay.length, 6);
    assert.ok(replay.every((event) => event.materializedAt === materializedAt));
    runtime.close(); runtime = undefined;
    const auditDatabase = new DatabaseSync(paths.audit, { readOnly: true });
    try { assert.equal(Number(auditDatabase.prepare("SELECT COUNT(*) AS count FROM api016_audit_events").get()?.["count"]), 6); }
    finally { auditDatabase.close(); }
  } finally {
    runtime?.close(); sourceStore?.close(); intakeStore?.close(); propertyStore?.close(); listingStore?.close(); contactStore?.close(); matchingStore?.close(); rmSync(directory, { recursive: true, force: true });
  }
});

test("Phase 2E failed final-event commit leaves a durable source intent replayable after restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase2e-failure-replay-"));
  const sourcePath = join(directory, "source.sqlite");
  const auditPath = join(directory, "audit.sqlite");
  let sourceStore: DurableSourceRegistryStore | undefined;
  let auditStore: DurableAuditEventStore | undefined;
  try {
    const record: TenantBoundSourcePolicy = { tenantId: "tenant-a", id: "source-a", name: "Approved portal", sourceType: "PORTAL", status: "DRAFT", policyVersion: 1, allowedMethods: ["MANUAL"], allowedPurposes: ["LISTING_INTAKE"], classification: "CONFIDENTIAL_BUSINESS", proposedBy: "actor-a" };
    const auditIntent = { ...baseIntent("SOURCE_REGISTRY", sourceTimes.SOURCE_REGISTRY), aggregateId: record.id, eventType: "SOURCE_POLICY_PROPOSED", action: "source.propose", target: { type: "SourceRegistry", id: record.id, version: 1 }, purpose: "SOURCE_GOVERNANCE", outcome: "ACCEPTED", principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["ADM"], sessionId: "session-a" } }, visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" } } as SourceRegistryAuditIntent;
    sourceStore = new DurableSourceRegistryStore({ databasePath: sourcePath });
    sourceStore.create({ record, commandId: "shared-intent", commandFingerprint: "sha256:source", auditIntent });
    const sourcePort = createAuditIntentSourcePort({ sourceDomain: "SOURCE_REGISTRY", read: () => sourceStore!.listAuditIntents({ tenantId: "tenant-a" }) });
    auditStore = new DurableAuditEventStore({ databasePath: auditPath, beforeCommit: () => { throw new Error("unsafe injected internal detail"); } });
    const failing = new AuditIntentMaterializer({ store: auditStore, clock: () => new Date(materializedAt) });
    assert.throws(() => failing.consume(sourcePort), (error: unknown) => error instanceof Error && error.message === "MATERIALIZATION_FAILED" && !error.message.includes("unsafe injected"));
    assert.equal(sourcePort.readByIntentId("shared-intent")?.intentId, "shared-intent");
    assert.equal(auditStore.listAll().length, 0);
    auditStore.close(); auditStore = undefined;
    sourceStore.close(); sourceStore = undefined;

    sourceStore = new DurableSourceRegistryStore({ databasePath: sourcePath });
    auditStore = new DurableAuditEventStore({ databasePath: auditPath });
    const recovered = new AuditIntentMaterializer({ store: auditStore, clock: () => new Date(materializedAt) });
    assert.equal(recovered.consume(createAuditIntentSourcePort({ sourceDomain: "SOURCE_REGISTRY", read: () => sourceStore!.listAuditIntents({ tenantId: "tenant-a" }) }))[0]?.auditIntentId, "shared-intent");
    assert.equal(auditStore.listAll().length, 1);
  } finally { auditStore?.close(); sourceStore?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("Phase 2E Staging composition keeps immutable-reference source truth and fails closed without a resolver", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase2e-reference-"));
  const sourcePath = join(directory, "source.sqlite");
  const auditPath = join(directory, "audit.sqlite");
  let sourceStore: DurableSourceRegistryStore | undefined;
  let runtime: ReturnType<typeof createStagingApi016AuditRuntime> | undefined;
  try {
    const record: TenantBoundSourcePolicy = { tenantId: "tenant-a", id: "source-a", name: "Approved portal", sourceType: "PORTAL", status: "DRAFT", policyVersion: 1, allowedMethods: ["MANUAL"], allowedPurposes: ["LISTING_INTAKE"], classification: "CONFIDENTIAL_BUSINESS", proposedBy: "actor-a" };
    const auditIntent = { ...baseIntent("SOURCE_REGISTRY", sourceTimes.SOURCE_REGISTRY), aggregateId: record.id, eventType: "SOURCE_POLICY_PROPOSED", action: "source.propose", target: { type: "SourceRegistry", id: record.id, version: 1 }, purpose: "SOURCE_GOVERNANCE", outcome: "ACCEPTED", principalProvenance: { kind: "IMMUTABLE_REFERENCE", principalId: "actor-a", evidenceRef: "evidence:principal-a" }, visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "tenant:tenant-a" } } as SourceRegistryAuditIntent;
    sourceStore = new DurableSourceRegistryStore({ databasePath: sourcePath });
    sourceStore.create({ record, commandId: "shared-intent", commandFingerprint: "sha256:source-reference", auditIntent });
    const reads = { sourceRegistry: () => sourceStore!.listAuditIntents({ tenantId: "tenant-a" }), intake: () => [], property: () => [], listing: () => [], contact: () => [], matching: () => [] };
    runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath: auditPath, sources: createMaterializationReadyAuditIntentSources(reads), clock: () => new Date(materializedAt) });
    assert.throws(() => runtime!.materializeAvailable(), (error: unknown) => error instanceof Error && error.message === "INTENT_INVALID");
    runtime.close(); runtime = undefined;
    sourceStore.close(); sourceStore = undefined;
    sourceStore = new DurableSourceRegistryStore({ databasePath: sourcePath });
    assert.deepEqual(sourceStore.listAuditIntents({ tenantId: "tenant-a" }), [auditIntent]);
    const auditDatabase = new DatabaseSync(auditPath, { readOnly: true });
    try { assert.equal(Number(auditDatabase.prepare("SELECT COUNT(*) AS count FROM api016_audit_events").get()?.["count"]), 0); }
    finally { auditDatabase.close(); }
  } finally { runtime?.close(); sourceStore?.close(); rmSync(directory, { recursive: true, force: true }); }
});
