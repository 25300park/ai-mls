import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  ContactPersistenceError,
  DurableContactStore,
  type ContactAuditIntent,
  type DurableContactStoreOptions,
} from "../../contact/src/contact-durable-persistence.js";
import type { Contact } from "../../contact/src/contact-service.js";
import {
  DurableIntakeStore,
  type DurableIntakeStoreOptions,
  IntakePersistenceError,
  type IntakeAuditIntent,
  type TenantBoundIntake,
} from "../../intake/src/intake-durable-persistence.js";
import {
  DurableListingStore,
  type DurableListingStoreOptions,
  ListingPersistenceError,
  type ListingAuditIntent,
} from "../../listing/src/listing-durable-persistence.js";
import type { CandidateListing } from "../../listing/src/listing-service.js";
import {
  DurableMatchingStore,
  type DurableMatchingStoreOptions,
  MatchingPersistenceError,
  type MatchingAuditIntent,
} from "../../matching/src/matching-durable-persistence.js";
import type { MatchResult, MatchRun } from "../../matching/src/matching-service.js";
import {
  DurablePropertyStore,
  type DurablePropertyStoreOptions,
  PropertyPersistenceError,
  type PropertyAuditIntent,
} from "../../property/src/property-durable-persistence.js";
import type { PropertyNode } from "../../property/src/property-service.js";
import {
  DurableSourceRegistryStore,
  type DurableSourceRegistryStoreOptions,
  SourceRegistryPersistenceError,
  type SourceRegistryAuditIntent,
  type TenantBoundSourcePolicy,
} from "../../source/src/source-registry-durable-persistence.js";
import { createAuditIntentSourcePort } from "./audit-intent-materializer.js";
import {
  EnrichedAuditIntentValidationError,
  isMaterializationReadySourceDomain,
  validateEnrichedAuditIntentV2,
  type EnrichedAuditIntentV2,
  type MaterializationReadySourceDomain,
} from "./enriched-audit-intent-contract.js";

const now = "2026-09-14T00:00:00.000Z";
const tenantId = "tenant-a";
const teamId = "team-a";
const sharedIntentId = "shared-intent";
const sharedMutationIdentity = "shared-command";
const sourceStoreFiles = [
  "modules/source/src/source-registry-durable-persistence.ts",
  "modules/intake/src/intake-durable-persistence.ts",
  "modules/property/src/property-durable-persistence.ts",
  "modules/listing/src/listing-durable-persistence.ts",
  "modules/contact/src/contact-durable-persistence.ts",
  "modules/matching/src/matching-durable-persistence.ts",
] as const;

const sourceRecord: TenantBoundSourcePolicy = {
  tenantId,
  id: "source-a",
  name: "Approved portal",
  sourceType: "PORTAL",
  status: "DRAFT",
  policyVersion: 1,
  allowedMethods: ["MANUAL"],
  allowedPurposes: ["LISTING_INTAKE"],
  classification: "CONFIDENTIAL_BUSINESS",
  proposedBy: "actor-a",
};
const intakeRecord: TenantBoundIntake = {
  tenantId,
  id: "intake-a",
  version: 1,
  status: "DRAFT",
  rawSourceId: "raw-a",
  rawSourceVersion: 1,
  rawSourceFingerprint: "sha256:raw-a",
  purpose: "LISTING_INTAKE",
  classification: "CONFIDENTIAL_BUSINESS",
  createdBy: "actor-a",
  createdAt: now,
  attachmentReferences: [],
};
const propertyRecord: PropertyNode = {
  id: "property-a",
  version: 1,
  entityType: "Property",
  canonicalName: "Tower A",
  status: "proposed",
  authority: "CANONICAL_MASTER",
  classification: "INTERNAL",
  proposedBy: "actor-a",
  createdAt: now,
};
const listingRecord: CandidateListing = {
  id: "candidate-a",
  version: 1,
  status: "candidate",
  authority: "CANDIDATE",
  sourceRefs: [{ entityType: "RawSource", entityId: "raw-a", version: 1 }],
  intakeRef: { entityType: "Intake", entityId: intakeRecord.id, version: 1 },
  unresolvedFields: [],
  relatedCandidateIds: [],
  classification: "CONFIDENTIAL_BUSINESS",
  createdBy: "actor-a",
};
const contactRecord: Contact = {
  id: "contact-a",
  version: 1,
  displayLabel: "Client A",
  teamId,
  status: "ACTIVE",
  consentRefs: ["consent-a"],
  channels: [],
  classification: "RESTRICTED_PERSONAL",
};
const matchResult: MatchResult = {
  id: "result-a",
  version: 1,
  runId: "run-a",
  teamId,
  status: "REVIEW_REQUIRED",
  authority: "ADVISORY",
  classification: "RESTRICTED_PERSONAL",
  requirementRef: { id: "requirement-a", version: 1 },
  candidateRef: { id: listingRecord.id, version: 1 },
  offerRef: { id: "offer-a", version: 1 },
  hardEligibility: "PASS",
  hardMatchCount: 1,
  score: 80,
  budgetFit: 75,
  rank: 1,
  components: [],
  explanation: { kind: "DETERMINISTIC", reasonCodes: [], limitations: [] },
  matcherVersion: "deterministic-matching-v1",
  policyVersion: "policy-v1",
  calculatedAt: now,
  reviewHistory: [],
};
const matchingRecord: MatchRun = {
  id: "run-a",
  version: 1,
  teamId,
  status: "REVIEW_REQUIRED",
  authority: "ADVISORY",
  requirementRef: { id: "requirement-a", version: 1 },
  cohortSize: 1,
  results: [matchResult],
  reviewResults: [matchResult],
  requestedBy: "actor-a",
  calculatedAt: now,
  policyVersion: "policy-v1",
};

function intent(
  sourceDomain: MaterializationReadySourceDomain,
  aggregateId: string,
  eventType: string,
  eventCategory: EnrichedAuditIntentV2["eventCategory"],
  action: string,
  target: EnrichedAuditIntentV2["target"],
  purpose: string,
  policyVersion: string,
  classification: EnrichedAuditIntentV2["classification"],
  scope: "TENANT" | "SYSTEM",
): EnrichedAuditIntentV2 {
  return {
    auditIntentContractVersion: "v2",
    intentId: sharedIntentId,
    sourceDomain,
    aggregateId,
    mutationIdentity: sharedMutationIdentity,
    eventType,
    eventCategory,
    action,
    target,
    principalProvenance: {
      kind: "TRUSTED_SNAPSHOT",
      principal: {
        id: "actor-a",
        type: "HUMAN",
        roles: ["AGT"],
        ...(scope === "TENANT" && sourceDomain !== "SOURCE_REGISTRY" ? { teamId } : {}),
        sessionId: "session-a",
      },
    },
    visibility: scope === "SYSTEM"
      ? { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" }
      : { kind: "TENANT_BOUND", tenantId, scopeRef: sourceDomain === "SOURCE_REGISTRY" || sourceDomain === "INTAKE" ? `tenant:${tenantId}` : `team:${teamId}` },
    purpose,
    policyVersion,
    classification,
    decision: "ALLOW",
    outcome: sourceDomain === "SOURCE_REGISTRY" || sourceDomain === "INTAKE" ? "ACCEPTED" : "COMPLETED",
    committedAt: now,
    correlationId: `correlation:${sourceDomain.toLowerCase()}`,
    evidenceRefs: [`evidence:${sourceDomain.toLowerCase()}`],
  };
}

const intents: Readonly<Record<MaterializationReadySourceDomain, EnrichedAuditIntentV2>> = {
  SOURCE_REGISTRY: intent("SOURCE_REGISTRY", sourceRecord.id, "SOURCE_POLICY_PROPOSED", "COMMAND_ACCEPTED", "source.propose", { type: "SourceRegistry", id: sourceRecord.id, version: 1 }, "SOURCE_GOVERNANCE", "policy-v1", "CONFIDENTIAL_BUSINESS", "TENANT"),
  INTAKE: intent("INTAKE", intakeRecord.id, "INTAKE_CREATED", "COMMAND_ACCEPTED", "intake.create", { type: "Intake", id: intakeRecord.id, version: 1 }, "LISTING_INTAKE", "policy-v1", "CONFIDENTIAL_BUSINESS", "TENANT"),
  PROPERTY: intent("PROPERTY", propertyRecord.id, "PROPERTY_PROPOSED", "COMMAND_ACCEPTED", "property.propose", { type: "Property", id: propertyRecord.id, version: 1 }, "LISTING_GOVERNANCE", "policy-v1", "INTERNAL", "SYSTEM"),
  LISTING: intent("LISTING", listingRecord.id, "CANDIDATE_CREATED", "COMMAND_ACCEPTED", "candidate.create", { type: "CandidateListing", id: listingRecord.id, version: 1 }, "LISTING_GOVERNANCE", "listing-v1", "CONFIDENTIAL_BUSINESS", "TENANT"),
  CONTACT: intent("CONTACT", contactRecord.id, "CONTACT_CREATED", "COMMAND_ACCEPTED", "contact.create", { type: "Contact", id: contactRecord.id, version: 1 }, "CLIENT_SERVICE", "contact-v1", "RESTRICTED_PERSONAL", "TENANT"),
  MATCHING: intent("MATCHING", matchingRecord.id, "MATCH_RUN_CREATED", "COMMAND_ACCEPTED", "matching.request", { type: "MatchRun", id: matchingRecord.id, version: 1 }, "CLIENT_MATCHING", "policy-v1", "RESTRICTED_PERSONAL", "TENANT"),
};

interface Harness {
  readonly sourceDomain: MaterializationReadySourceDomain;
  readonly databasePath: string;
  readonly intentTable: string;
  readonly expectedTables: readonly string[];
  readonly aggregateId: string;
  open(): void;
  close(): void;
  create(auditIntent: EnrichedAuditIntentV2): "STORED" | "REPLAYED";
  read(): unknown;
  listIntents(): readonly unknown[];
  isExpectedInputError(error: unknown): boolean;
  isExpectedConflictError(error: unknown): boolean;
}

type FinalEventDependencyKey = "auditEventStore" | "durableAuditEventStore" | "finalEventPort" | "finalEventSink" | "materializer";
type HasNoFinalEventDependency<Options> = Extract<keyof Options, FinalEventDependencyKey> extends never ? true : false;
const sourceStoreBoundaryHasNoFinalEventDependency: readonly [
  HasNoFinalEventDependency<DurableSourceRegistryStoreOptions>,
  HasNoFinalEventDependency<DurableIntakeStoreOptions>,
  HasNoFinalEventDependency<DurablePropertyStoreOptions>,
  HasNoFinalEventDependency<DurableListingStoreOptions>,
  HasNoFinalEventDependency<DurableContactStoreOptions>,
  HasNoFinalEventDependency<DurableMatchingStoreOptions>,
] = [true, true, true, true, true, true];

function harnesses(directory: string): readonly Harness[] {
  let sourceStore: DurableSourceRegistryStore | undefined;
  let intakeStore: DurableIntakeStore | undefined;
  let propertyStore: DurablePropertyStore | undefined;
  let listingStore: DurableListingStore | undefined;
  let contactStore: DurableContactStore | undefined;
  let matchingStore: DurableMatchingStore | undefined;
  return [
    {
      sourceDomain: "SOURCE_REGISTRY",
      databasePath: join(directory, "source.sqlite"),
      intentTable: "source_registry_audit_intents",
      expectedTables: ["source_registry_audit_intents", "source_registry_commands", "source_registry_history", "source_registry_policies"],
      aggregateId: sourceRecord.id,
      open() { sourceStore = new DurableSourceRegistryStore({ databasePath: this.databasePath }); },
      close() { sourceStore?.close(); sourceStore = undefined; },
      create(auditIntent) { return sourceStore!.create({ record: sourceRecord, commandId: sharedMutationIdentity, commandFingerprint: "sha256:source", auditIntent: auditIntent as SourceRegistryAuditIntent }).status; },
      read() { return sourceStore!.read({ tenantId, sourceId: sourceRecord.id }); },
      listIntents() { return sourceStore!.listAuditIntents({ tenantId }); },
      isExpectedInputError(error) { return error instanceof SourceRegistryPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID"; },
      isExpectedConflictError(error) { return error instanceof SourceRegistryPersistenceError && error.code === "IDEMPOTENCY_CONFLICT"; },
    },
    {
      sourceDomain: "INTAKE",
      databasePath: join(directory, "intake.sqlite"),
      intentTable: "intake_audit_intents",
      expectedTables: ["intake_audit_intents", "intake_commands", "intake_evidence_dedup", "intake_history", "intake_records"],
      aggregateId: intakeRecord.id,
      open() { intakeStore = new DurableIntakeStore({ databasePath: this.databasePath, tenantResolver: { resolveTenant: ({ rawSourceId }) => rawSourceId === "raw-a" ? tenantId : undefined } }); },
      close() { intakeStore?.close(); intakeStore = undefined; },
      create(auditIntent) { return intakeStore!.create({ record: intakeRecord, commandId: sharedMutationIdentity, commandFingerprint: "sha256:intake", auditIntent: auditIntent as IntakeAuditIntent }).status; },
      read() { return intakeStore!.read({ tenantId, intakeId: intakeRecord.id }); },
      listIntents() { return intakeStore!.listAuditIntents({ tenantId }); },
      isExpectedInputError(error) { return error instanceof IntakePersistenceError && error.code === "PERSISTENCE_INPUT_INVALID"; },
      isExpectedConflictError(error) { return error instanceof IntakePersistenceError && error.code === "IDEMPOTENCY_CONFLICT"; },
    },
    {
      sourceDomain: "PROPERTY",
      databasePath: join(directory, "property.sqlite"),
      intentTable: "property_master_audit_intents",
      expectedTables: ["property_master_audit_intents", "property_master_commands", "property_master_history", "property_master_records"],
      aggregateId: propertyRecord.id,
      open() { propertyStore = new DurablePropertyStore({ databasePath: this.databasePath }); },
      close() { propertyStore?.close(); propertyStore = undefined; },
      create(auditIntent) { return propertyStore!.createNode({ record: propertyRecord, commandId: sharedMutationIdentity, commandFingerprint: "sha256:property", auditIntent: auditIntent as PropertyAuditIntent }).status; },
      read() { return propertyStore!.readNode(propertyRecord.id); },
      listIntents() { return propertyStore!.listAuditIntents(); },
      isExpectedInputError(error) { return error instanceof PropertyPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID"; },
      isExpectedConflictError(error) { return error instanceof PropertyPersistenceError && error.code === "IDEMPOTENCY_CONFLICT"; },
    },
    {
      sourceDomain: "LISTING",
      databasePath: join(directory, "listing.sqlite"),
      intentTable: "listing_audit_intents",
      expectedTables: ["listing_audit_intents", "listing_commands", "listing_history", "listing_records"],
      aggregateId: listingRecord.id,
      open() { listingStore = new DurableListingStore({ databasePath: this.databasePath, tenantResolver: { resolveCandidateBinding: () => ({ tenantId, teamId }) } }); },
      close() { listingStore?.close(); listingStore = undefined; },
      create(auditIntent) { return listingStore!.createCandidate({ record: listingRecord, commandId: sharedMutationIdentity, commandFingerprint: "sha256:listing", auditIntent: auditIntent as ListingAuditIntent }).status; },
      read() { return listingStore!.readCandidate({ tenantId, candidateId: listingRecord.id }); },
      listIntents() { return listingStore!.listAuditIntents({ tenantId }); },
      isExpectedInputError(error) { return error instanceof ListingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID"; },
      isExpectedConflictError(error) { return error instanceof ListingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT"; },
    },
    {
      sourceDomain: "CONTACT",
      databasePath: join(directory, "contact.sqlite"),
      intentTable: "contact_audit_intents",
      expectedTables: ["contact_audit_intents", "contact_communications", "contact_history", "contact_mutation_identities", "contact_records"],
      aggregateId: contactRecord.id,
      open() { contactStore = new DurableContactStore({ databasePath: this.databasePath, caseResolver: { resolveCaseBinding: () => undefined } }); },
      close() { contactStore?.close(); contactStore = undefined; },
      create(auditIntent) { return contactStore!.createContact({ tenantId, record: contactRecord, commandId: sharedMutationIdentity, commandFingerprint: "sha256:contact", auditIntent: auditIntent as ContactAuditIntent }).status; },
      read() { return contactStore!.readContact({ tenantId, contactId: contactRecord.id }); },
      listIntents() { return contactStore!.listAuditIntents({ tenantId }); },
      isExpectedInputError(error) { return error instanceof ContactPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID"; },
      isExpectedConflictError(error) { return error instanceof ContactPersistenceError && error.code === "IDEMPOTENCY_CONFLICT"; },
    },
    {
      sourceDomain: "MATCHING",
      databasePath: join(directory, "matching.sqlite"),
      intentTable: "matching_audit_intents",
      expectedTables: ["matching_audit_intents", "matching_commands", "matching_result_history", "matching_results", "matching_runs"],
      aggregateId: matchingRecord.id,
      open() { matchingStore = new DurableMatchingStore({ databasePath: this.databasePath, bindingResolver: {
        resolveRequirementBinding: (id) => id === "requirement-a" ? { tenantId, teamId } : undefined,
        resolveCandidateBinding: (id) => id === listingRecord.id ? { tenantId, teamId } : undefined,
      } }); },
      close() { matchingStore?.close(); matchingStore = undefined; },
      create(auditIntent) { return matchingStore!.createRun({ tenantId, record: matchingRecord, commandId: sharedMutationIdentity, commandFingerprint: "sha256:matching", auditIntent: auditIntent as MatchingAuditIntent }).status; },
      read() { return matchingStore!.readRun({ tenantId, runId: matchingRecord.id }); },
      listIntents() { return matchingStore!.listAuditIntents({ tenantId }); },
      isExpectedInputError(error) { return error instanceof MatchingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID"; },
      isExpectedConflictError(error) { return error instanceof MatchingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT"; },
    },
  ];
}

function databaseSnapshot(databasePath: string): Readonly<Record<string, readonly unknown[]>> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const names = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row["name"]));
    return Object.freeze(Object.fromEntries(names.map((name) => [name, database.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()])));
  } finally {
    database.close();
  }
}

function legacyIntent(sourceDomain: MaterializationReadySourceDomain, aggregateId: string): Readonly<Record<string, unknown>> {
  return {
    intentId: `legacy-${sourceDomain.toLowerCase()}`,
    domainOwner: sourceDomain,
    aggregateId,
    mutationIdentity: `legacy-mutation-${sourceDomain.toLowerCase()}`,
    actorId: "actor-a",
    ...(sourceDomain === "PROPERTY" ? {} : { tenantId }),
    scopeRef: sourceDomain === "PROPERTY" ? "system:property-master" : `team:${teamId}`,
    classificationRef: `${sourceDomain}_MUTATION`,
    committedAt: now,
    evidenceRefs: [`evidence:legacy-${sourceDomain.toLowerCase()}`],
  };
}

function insertLegacyIntent(harness: Harness, payload: string): void {
  const database = new DatabaseSync(harness.databasePath);
  try {
    if (harness.sourceDomain === "PROPERTY") {
      database.prepare(`INSERT INTO ${harness.intentTable} (intent_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?)`)
        .run(`legacy-${harness.sourceDomain.toLowerCase()}`, harness.aggregateId, `legacy-mutation-${harness.sourceDomain.toLowerCase()}`, payload);
    } else {
      database.prepare(`INSERT INTO ${harness.intentTable} (intent_id, tenant_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)`)
        .run(`legacy-${harness.sourceDomain.toLowerCase()}`, tenantId, harness.aggregateId, `legacy-mutation-${harness.sourceDomain.toLowerCase()}`, payload);
    }
  } finally {
    database.close();
  }
}

function storedPayload(harness: Harness, intentId: string): string {
  const database = new DatabaseSync(harness.databasePath, { readOnly: true });
  try {
    return String(database.prepare(`SELECT payload_json FROM ${harness.intentTable} WHERE intent_id = ?`).get(intentId)?.["payload_json"]);
  } finally {
    database.close();
  }
}

test("six domain-owned stores stay source-only while rejecting every cross-source injection and isolating replay identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-cross-source-"));
  const stores = harnesses(directory);
  try {
    for (const store of stores) {
      store.open();
      const beforeForeignInjection = databaseSnapshot(store.databasePath);
      for (const foreignStore of stores.filter((candidate) => candidate.sourceDomain !== store.sourceDomain)) {
        const foreignIntent = intents[foreignStore.sourceDomain];
        assert.throws(() => store.create(foreignIntent), store.isExpectedInputError, `${store.sourceDomain} rejected ${foreignIntent.sourceDomain}`);
        assert.deepEqual(
          databaseSnapshot(store.databasePath),
          beforeForeignInjection,
          `${store.sourceDomain} preserved every durable table after rejecting ${foreignIntent.sourceDomain}`,
        );
        assert.equal(store.read(), undefined);
        assert.deepEqual(store.listIntents(), []);
      }
      assert.equal(store.create(intents[store.sourceDomain]), "STORED");
      store.close();
    }

    for (const store of stores) {
      store.open();
      const stored = store.listIntents();
      assert.deepEqual(stored, [intents[store.sourceDomain]]);
      assert.notEqual(store.read(), undefined);
      const durableIntent = validateEnrichedAuditIntentV2(stored[0], store.sourceDomain);
      assert.deepEqual(
        {
          intentId: durableIntent.intentId,
          sourceDomain: durableIntent.sourceDomain,
          aggregateId: durableIntent.aggregateId,
          mutationIdentity: durableIntent.mutationIdentity,
          evidenceRefs: durableIntent.evidenceRefs,
        },
        {
          intentId: sharedIntentId,
          sourceDomain: store.sourceDomain,
          aggregateId: store.aggregateId,
          mutationIdentity: sharedMutationIdentity,
          evidenceRefs: intents[store.sourceDomain].evidenceRefs,
        },
      );

      const beforeReplay = databaseSnapshot(store.databasePath);
      assert.deepEqual(Object.keys(beforeReplay), store.expectedTables, `${store.sourceDomain} persists only its owner rows and Audit Intent`);
      assert.equal(store.create(intents[store.sourceDomain]), "REPLAYED");
      assert.deepEqual(databaseSnapshot(store.databasePath), beforeReplay, `${store.sourceDomain} exact replay appended nothing`);

      const conflicting = { ...intents[store.sourceDomain], evidenceRefs: [...intents[store.sourceDomain].evidenceRefs, "evidence:foreign-domain"] };
      assert.throws(
        () => store.create(conflicting),
        store.isExpectedConflictError,
        `${store.sourceDomain} conflicting replay rejected`,
      );
      assert.deepEqual(databaseSnapshot(store.databasePath), beforeReplay, `${store.sourceDomain} conflict preserved all durable rows`);
      assert.deepEqual(store.listIntents(), [intents[store.sourceDomain]], `${store.sourceDomain} evidence was not merged`);
      store.close();
    }

    const unsupportedSources = ["CLIENT", "REQUIREMENT", "CLIENT_REQUIREMENT"] as const;
    const probedSources = [...stores.map((store) => store.sourceDomain), ...unsupportedSources];
    assert.deepEqual(probedSources.filter(isMaterializationReadySourceDomain), stores.map((store) => store.sourceDomain));
    assert.deepEqual(sourceStoreBoundaryHasNoFinalEventDependency, [true, true, true, true, true, true]);
    for (const sourceStoreFile of sourceStoreFiles) {
      assert.doesNotMatch(
        readFileSync(sourceStoreFile, "utf8"),
        /\b(?:DurableAuditEventStore|DurableMaterializedAuditEvent|AuditIntentMaterializer|api016_audit_events)\b/u,
        `${sourceStoreFile} does not construct or import final-event persistence/materialization`,
      );
    }
    for (const unsupported of unsupportedSources) {
      assert.equal(isMaterializationReadySourceDomain(unsupported), false);
      assert.throws(
        () => validateEnrichedAuditIntentV2({ ...intents.INTAKE, sourceDomain: unsupported }),
        (error: unknown) => error instanceof EnrichedAuditIntentValidationError && error.code === "SOURCE_NOT_MATERIALIZATION_READY",
      );
      assert.throws(
        () => createAuditIntentSourcePort({ sourceDomain: unsupported as MaterializationReadySourceDomain, read: () => [] }),
        (error: unknown) => error instanceof Error && error.message === "INTENT_SOURCE_INPUT_INVALID",
      );
    }

  } finally {
    for (const store of stores) store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("six stores read legacy v1 without rewrite, backfill, or materialization eligibility", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-cross-source-v1-"));
  const stores = harnesses(directory);
  try {
    for (const store of stores) {
      store.open();
      assert.equal(store.create(intents[store.sourceDomain]), "STORED");
      store.close();

      const legacy = legacyIntent(store.sourceDomain, store.aggregateId);
      const legacyBytes = JSON.stringify(legacy);
      insertLegacyIntent(store, legacyBytes);
      const beforeRead = databaseSnapshot(store.databasePath);

      store.open();
      const rows = store.listIntents();
      assert.deepEqual(rows.find((row) => (row as { intentId?: string }).intentId === legacy["intentId"]), legacy);
      const port = createAuditIntentSourcePort({ sourceDomain: store.sourceDomain, read: () => rows });
      assert.equal(port.readByIntentId(String(legacy["intentId"])), undefined);
      assert.deepEqual(port.listEligible({}).intents, [intents[store.sourceDomain]]);
      store.close();

      assert.equal(storedPayload(store, String(legacy["intentId"])), legacyBytes, `${store.sourceDomain} v1 payload bytes preserved`);
      assert.deepEqual(databaseSnapshot(store.databasePath), beforeRead, `${store.sourceDomain} v1 read caused zero rewrite/backfill`);
    }
  } finally {
    for (const store of stores) store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
