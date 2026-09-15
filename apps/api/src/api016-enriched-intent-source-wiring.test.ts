import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { DurableContactStore } from "../../../modules/contact/src/contact-durable-persistence.js";
import { DurableIntakeStore } from "../../../modules/intake/src/intake-durable-persistence.js";
import { DurableListingStore } from "../../../modules/listing/src/listing-durable-persistence.js";
import { DurableMatchingStore } from "../../../modules/matching/src/matching-durable-persistence.js";
import { DurablePropertyStore } from "../../../modules/property/src/property-durable-persistence.js";
import { DurableSourceRegistryStore } from "../../../modules/source/src/source-registry-durable-persistence.js";
import { DurableJobStore } from "../../../modules/jobs/src/job-durable-persistence.js";
import {
  AuditIntentMaterializationError,
  DurableAuditEventStore,
  type AuditIntentSourcePort,
  type EnrichedAuditIntentV2,
  type MaterializationReadySourceDomain,
} from "../../../modules/audit/src/index.js";
import { createMaterializationReadyAuditIntentSources } from "./api016-enriched-intent-source-wiring.js";
import { createStagingApi016AuditRuntime } from "./api016-production-composition.js";

const sourceDomains = ["SOURCE_REGISTRY", "INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING", "API-017"] as const;
const committedAt = "2026-09-14T01:02:03.000Z";

const mappings: Readonly<Record<MaterializationReadySourceDomain, Readonly<{
  eventType: string;
  eventCategory: EnrichedAuditIntentV2["eventCategory"];
  action: string;
  targetType: string;
  classification: EnrichedAuditIntentV2["classification"];
  purpose: string;
  outcome: EnrichedAuditIntentV2["outcome"];
}>>> = {
  SOURCE_REGISTRY: { eventType: "SOURCE_POLICY_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "source.propose", targetType: "SourceRegistry", classification: "CONFIDENTIAL_BUSINESS", purpose: "SOURCE_GOVERNANCE", outcome: "ACCEPTED" },
  INTAKE: { eventType: "INTAKE_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "intake.create", targetType: "Intake", classification: "CONFIDENTIAL_BUSINESS", purpose: "LISTING_INTAKE", outcome: "ACCEPTED" },
  PROPERTY: { eventType: "PROPERTY_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "property.propose", targetType: "Property", classification: "INTERNAL", purpose: "LISTING_GOVERNANCE", outcome: "COMPLETED" },
  LISTING: { eventType: "CANDIDATE_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "candidate.create", targetType: "CandidateListing", classification: "CONFIDENTIAL_BUSINESS", purpose: "LISTING_GOVERNANCE", outcome: "COMPLETED" },
  CONTACT: { eventType: "CONTACT_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "contact.create", targetType: "Contact", classification: "RESTRICTED_PERSONAL", purpose: "CLIENT_SERVICE", outcome: "COMPLETED" },
  MATCHING: { eventType: "MATCH_RUN_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "matching.request", targetType: "MatchRun", classification: "RESTRICTED_PERSONAL", purpose: "CLIENT_MATCHING", outcome: "COMPLETED" },
  "API-017": { eventType: "JOB_SUBMITTED", eventCategory: "COMMAND_ACCEPTED", action: "job.submit", targetType: "BackgroundJob", classification: "CONFIDENTIAL_BUSINESS", purpose: "LISTING_GOVERNANCE", outcome: "ACCEPTED" },
};

function enrichedIntent(sourceDomain: MaterializationReadySourceDomain): EnrichedAuditIntentV2 {
  const mapping = mappings[sourceDomain];
  const suffix = sourceDomain.toLowerCase();
  const value: EnrichedAuditIntentV2 = {
    auditIntentContractVersion: "v2",
    intentId: "shared-intent",
    sourceDomain,
    aggregateId: `aggregate-${suffix}`,
    mutationIdentity: `command-${suffix}`,
    eventType: mapping.eventType,
    eventCategory: mapping.eventCategory,
    action: mapping.action,
    target: { type: mapping.targetType, id: `aggregate-${suffix}`, version: 7 },
    principalProvenance: {
      kind: "TRUSTED_SNAPSHOT",
      principal: { id: `principal-${suffix}`, type: "HUMAN", roles: ["AGT"], teamId: "team-authoritative", sessionId: `session-${suffix}` },
    },
    visibility: sourceDomain === "PROPERTY"
      ? { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" }
      : { kind: "TENANT_BOUND", tenantId: "tenant-authoritative", scopeRef: sourceDomain === "SOURCE_REGISTRY" || sourceDomain === "INTAKE" ? "tenant:tenant-authoritative" : "team:team-authoritative" },
    purpose: mapping.purpose,
    policyVersion: `policy-${suffix}`,
    classification: mapping.classification,
    decision: "ALLOW",
    outcome: mapping.outcome,
    committedAt,
    correlationId: `correlation:${suffix}`,
    requestId: `request-${suffix}`,
    reason: `authoritative-${suffix}`,
    evidenceRefs: [`evidence:${suffix}/a`, `evidence:${suffix}/b`],
  };
  return Object.freeze(value);
}

function legacyIntent(sourceDomain: MaterializationReadySourceDomain): Readonly<Record<string, unknown>> {
  const suffix = sourceDomain.toLowerCase();
  return Object.freeze({
    intentId: `legacy-${suffix}`,
    domainOwner: sourceDomain,
    aggregateId: `aggregate-${suffix}`,
    mutationIdentity: `legacy-command-${suffix}`,
    actorId: "legacy-actor",
    ...(sourceDomain === "PROPERTY" ? {} : { tenantId: "tenant-authoritative" }),
    scopeRef: sourceDomain === "PROPERTY" ? "system:property-master" : "team:team-authoritative",
    classificationRef: `${sourceDomain}_MUTATION`,
    committedAt,
    evidenceRefs: [`evidence:legacy-${suffix}`],
  });
}

function readFinalEvents(databasePath: string) {
  const store = new DurableAuditEventStore({ databasePath });
  try { return store.listAll(); }
  finally { store.close(); }
}

function seedAuditIntentRows(input: Readonly<{
  databasePath: string;
  table: string;
  sourceDomain: MaterializationReadySourceDomain;
  intent: EnrichedAuditIntentV2;
  tenantBound: boolean;
}>): void {
  const database = new DatabaseSync(input.databasePath);
  const payloads = [legacyIntent(input.sourceDomain), input.intent];
  try {
    if (input.sourceDomain === "SOURCE_REGISTRY") {
      database.prepare("INSERT INTO source_registry_policies (tenant_id, source_id, policy_version, payload_json) VALUES (?, ?, ?, ?)")
        .run("tenant-authoritative", input.intent.aggregateId, 1, "{}");
    }
    if (input.sourceDomain === "INTAKE") {
      database.prepare("INSERT INTO intake_records (tenant_id, intake_id, version, raw_source_id, payload_json) VALUES (?, ?, ?, ?, ?)")
        .run("tenant-authoritative", input.intent.aggregateId, 1, "raw-source", "{}");
    }
    for (const payload of payloads) {
      const intentId = String(payload.intentId);
      const aggregateId = "aggregateId" in payload ? String(payload.aggregateId) : `aggregate-${input.sourceDomain.toLowerCase()}`;
      const mutationIdentity = "mutationIdentity" in payload ? String(payload.mutationIdentity) : `legacy-command-${input.sourceDomain.toLowerCase()}`;
      if (input.tenantBound) {
        database.prepare(`INSERT INTO ${input.table} (intent_id, tenant_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)`)
          .run(intentId, "tenant-authoritative", aggregateId, mutationIdentity, JSON.stringify(payload));
      } else {
        database.prepare(`INSERT INTO ${input.table} (intent_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?)`)
          .run(intentId, aggregateId, mutationIdentity, JSON.stringify(payload));
      }
    }
  } finally {
    database.close();
  }
}

test("seven enriched store reads compose into API-016 without reconstructing authoritative fields or materializing v1", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-api016-enriched-wiring-"));
  const databasePath = join(directory, "audit.sqlite");
  const jobStore = new DurableJobStore({ databasePath: join(directory, "jobs.sqlite"), idFactory: () => "job-api017", clock: () => new Date(committedAt) });
  jobStore.submitJob({
    commandId: "command-api017",
    jobType: "AI_LISTING_PARSE",
    inputReferences: [{ type: "RawSource", id: "raw-api017", version: 1, checksum: "sha256:raw-api017-v1" }],
    tenantId: "tenant-authoritative",
    scopeRef: "team:team-authoritative",
    purpose: "LISTING_GOVERNANCE",
    privacyClassification: "CONFIDENTIAL_BUSINESS",
    deadline: "2026-09-16T00:00:00.000Z",
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "principal-api017", type: "HUMAN", roles: ["AGT"], teamId: "team-authoritative", sessionId: "session-api017" } },
    authorityEvidenceRefs: ["evidence:api-017/authority"],
    policyVersion: "policy-api-017",
    correlationId: "correlation:api-017",
    causationId: "causation-api-017",
  });
  const expected: Record<MaterializationReadySourceDomain, EnrichedAuditIntentV2> = {
    SOURCE_REGISTRY: enrichedIntent("SOURCE_REGISTRY"),
    INTAKE: enrichedIntent("INTAKE"),
    PROPERTY: enrichedIntent("PROPERTY"),
    LISTING: enrichedIntent("LISTING"),
    CONTACT: enrichedIntent("CONTACT"),
    MATCHING: enrichedIntent("MATCHING"),
    "API-017": jobStore.listAuditIntents({ tenantId: "tenant-authoritative", scopeRef: "team:team-authoritative" })[0]!,
  };
  const sourceStore = new DurableSourceRegistryStore({ databasePath: join(directory, "source.sqlite") });
  const intakeStore = new DurableIntakeStore({ databasePath: join(directory, "intake.sqlite"), tenantResolver: { resolveTenant: () => "tenant-authoritative" } });
  const propertyStore = new DurablePropertyStore({ databasePath: join(directory, "property.sqlite") });
  const listingStore = new DurableListingStore({ databasePath: join(directory, "listing.sqlite"), tenantResolver: { resolveCandidateBinding: () => ({ tenantId: "tenant-authoritative", teamId: "team-authoritative" }) } });
  const contactStore = new DurableContactStore({ databasePath: join(directory, "contact.sqlite"), caseResolver: { resolveCaseBinding: () => undefined } });
  const matchingStore = new DurableMatchingStore({ databasePath: join(directory, "matching.sqlite"), bindingResolver: { resolveRequirementBinding: () => undefined, resolveCandidateBinding: () => undefined } });
  seedAuditIntentRows({ databasePath: join(directory, "source.sqlite"), table: "source_registry_audit_intents", sourceDomain: "SOURCE_REGISTRY", intent: expected.SOURCE_REGISTRY, tenantBound: true });
  seedAuditIntentRows({ databasePath: join(directory, "intake.sqlite"), table: "intake_audit_intents", sourceDomain: "INTAKE", intent: expected.INTAKE, tenantBound: true });
  seedAuditIntentRows({ databasePath: join(directory, "property.sqlite"), table: "property_master_audit_intents", sourceDomain: "PROPERTY", intent: expected.PROPERTY, tenantBound: false });
  seedAuditIntentRows({ databasePath: join(directory, "listing.sqlite"), table: "listing_audit_intents", sourceDomain: "LISTING", intent: expected.LISTING, tenantBound: true });
  seedAuditIntentRows({ databasePath: join(directory, "contact.sqlite"), table: "contact_audit_intents", sourceDomain: "CONTACT", intent: expected.CONTACT, tenantBound: true });
  seedAuditIntentRows({ databasePath: join(directory, "matching.sqlite"), table: "matching_audit_intents", sourceDomain: "MATCHING", intent: expected.MATCHING, tenantBound: true });
  let sourceRegistryRead = (): readonly unknown[] => sourceStore.listAuditIntents({ tenantId: "tenant-authoritative" });
  const reads = {
    sourceRegistry: () => sourceRegistryRead(),
    intake: () => intakeStore.listAuditIntents({ tenantId: "tenant-authoritative" }),
    property: () => propertyStore.listAuditIntents(),
    listing: () => listingStore.listAuditIntents({ tenantId: "tenant-authoritative" }),
    contact: () => contactStore.listAuditIntents({ tenantId: "tenant-authoritative" }),
    matching: () => matchingStore.listAuditIntents({ tenantId: "tenant-authoritative" }),
    jobs: () => jobStore.listAuditIntents({ tenantId: "tenant-authoritative", scopeRef: "team:team-authoritative" }),
  };
  const sources: readonly AuditIntentSourcePort[] = createMaterializationReadyAuditIntentSources(reads);

  try {
    assert.equal(Object.isFrozen(sources), true);
    assert.deepEqual(sources.map((source) => source.sourceDomain), sourceDomains);
    assert.equal(sources.filter((source) => (source.sourceDomain as string) === "CLIENT_REQUIREMENT").length, 0);
    for (const source of sources) {
      const eligible = source.listEligible({});
      assert.equal(eligible.intents.length, 1);
      assert.deepEqual(eligible.intents[0], expected[source.sourceDomain]);
      assert.equal(source.readByIntentId(`legacy-${source.sourceDomain.toLowerCase()}`), undefined);
    }

    let runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath, sources, clock: () => new Date("2026-09-14T02:00:00.000Z") });
    assert.equal(runtime.materializeAvailable().length, 7);
    assert.equal(runtime.materializeAvailable().length, 7);
    runtime.close();

    let finalEvents = readFinalEvents(databasePath);
    assert.equal(finalEvents.length, 7, "repeated processing appended zero duplicate final Audit Events");
    for (const sourceDomain of sourceDomains) {
      const source = expected[sourceDomain];
      const event = finalEvents.find((candidate) => candidate.sourceDomain === sourceDomain);
      assert.ok(event);
      assert.deepEqual(
        {
          principal: event.principal,
          visibility: event.visibility,
          target: event.target,
          purpose: event.purpose,
          policyVersion: event.policyVersion,
          decision: event.decision,
          outcome: event.outcome,
          reason: event.reason,
          requestId: event.requestId,
          correlationId: event.correlationId,
          occurredAt: event.occurredAt,
          evidenceRefs: event.evidenceRefs,
        },
        {
          principal: source.principalProvenance.kind === "TRUSTED_SNAPSHOT" ? source.principalProvenance.principal : undefined,
          visibility: source.visibility,
          target: source.target,
          purpose: source.purpose,
          policyVersion: source.policyVersion,
          decision: source.decision,
          outcome: source.outcome,
          reason: source.reason,
          requestId: source.requestId,
          correlationId: source.correlationId,
          occurredAt: source.committedAt,
          evidenceRefs: source.evidenceRefs,
        },
      );
    }

    runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath, sources, clock: () => new Date("2026-09-15T02:00:00.000Z") });
    assert.equal(runtime.materializeAvailable().length, 7);
    runtime.close();
    finalEvents = readFinalEvents(databasePath);
    assert.equal(finalEvents.length, 7, "restart appended zero duplicate final Audit Events");

    sourceRegistryRead = () => [legacyIntent("SOURCE_REGISTRY"), { ...expected.SOURCE_REGISTRY, evidenceRefs: [...expected.SOURCE_REGISTRY.evidenceRefs, "evidence:conflict"] }];
    runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath, sources });
    assert.throws(
      () => runtime.materializeAvailable(),
      (error: unknown) => error instanceof AuditIntentMaterializationError && error.code === "MATERIALIZATION_IDENTITY_CONFLICT",
    );
    runtime.close();
    assert.equal(readFinalEvents(databasePath).length, 7, "identity conflict appended zero final Audit Events");
  } finally {
    sourceStore.close();
    intakeStore.close();
    propertyStore.close();
    listingStore.close();
    contactStore.close();
    matchingStore.close();
    jobStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
