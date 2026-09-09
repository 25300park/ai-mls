import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import type { AcceptedAdvisoryRecord, AdvisoryPromptRecord } from "./advisory-runtime-contracts.js";

const prompt = Object.freeze<AdvisoryPromptRecord>({
  promptId: "PRM-AI-001-001",
  promptVersion: "v1.0",
  capabilityId: "AI-001",
  schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
  contentFingerprint: "sha256:prompt-fixture-001",
  status: "ACTIVE",
  createdAt: "2026-09-09T01:00:00.000Z",
});
const subject = Object.freeze({ entityType: "RawSource", entityId: "raw-022-c", version: "4" });
const confidence = Object.freeze({ band: "MEDIUM" as const, reasonCodes: ["REVIEW_REQUIRED"], policyVersion: "ai-policy-v1" });

function accepted(): AcceptedAdvisoryRecord {
  return Object.freeze<AcceptedAdvisoryRecord>({
    advisoryId: "advisory-022-c-001",
    tenantId: "tenant-a",
    scopeRef: "team:team-a",
    capabilityId: "AI-001",
    schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
    inputFingerprint: "sha256:input-001",
    evidenceFingerprint: "sha256:evidence-001",
    inputClassifications: ["CONFIDENTIAL_BUSINESS"],
    promptId: prompt.promptId,
    promptVersion: prompt.promptVersion,
    adapterVersion: "deterministic-advisory-v1",
    executionFingerprint: "sha256:execution-001",
    envelope: {
      schemaVersion: "1.0",
      schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
      capabilityId: "AI-001",
      subjectRef: subject,
      provenance: [subject],
      classification: "CONFIDENTIAL_BUSINESS",
      output: { capabilityId: "AI-001", inputRef: subject, fields: [{ fieldName: "propertyName", valueState: "PRESENT", normalizedValue: "Example Tower", evidenceRefs: [{ sourceRef: subject, evidenceLocator: "field:propertyName" }], confidence }], warnings: [], overallConfidence: confidence },
    },
    validationResult: { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" },
    generatedAt: "2026-09-09T01:01:00.000Z",
    reviewRequired: true,
    reviewEvidenceRef: "advisory:advisory-022-c-001:review-required",
    authority: "ADVISORY",
  });
}

function withDatabase(run: (store: DurableAdvisoryStore, databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-prompt-"));
  const databasePath = join(directory, "advisory.sqlite");
  let store: DurableAdvisoryStore | undefined;
  try {
    store = new DurableAdvisoryStore({ databasePath });
    run(store, databasePath);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof Error && "code" in error && error.code === code);
}

test("FEAT-022-C durable prompt identity survives reopen and remains immutable", () => {
  withDatabase((store, databasePath) => {
    assert.equal(store.findPrompt(prompt.promptId, prompt.promptVersion), undefined);
    const registered = store.registerPrompt(prompt);
    assert.deepEqual(registered, prompt);
    assert.equal(Object.isFrozen(registered), true);
    store.close();

    const reopened = new DurableAdvisoryStore({ databasePath });
    try {
      assert.deepEqual(reopened.findPrompt(prompt.promptId, prompt.promptVersion), prompt);
      assert.deepEqual(reopened.registerPrompt(prompt), prompt);
      expectCode(() => reopened.registerPrompt({ ...prompt, contentFingerprint: "sha256:changed-prompt-fixture" }), "PROMPT_IDENTITY_CONFLICT");
    } finally {
      reopened.close();
    }
  });
});

test("FEAT-022-C prompt registry preserves ACTIVE and RETIRED as the only statuses", () => {
  withDatabase((store) => {
    const retired = store.registerPrompt({ ...prompt, promptVersion: "v0.9", status: "RETIRED" });
    assert.equal(retired.status, "RETIRED");
    expectCode(() => store.registerPrompt({ ...prompt, promptId: "PRM-MISMATCH-001", schemaId: "urn:ai-mls:schema:property-normalization-output:v0.1" }), "PROMPT_SCHEMA_MISMATCH");
    expectCode(() => store.registerPrompt({ ...prompt, status: "DRAFT" as "ACTIVE" }), "PERSISTENCE_INPUT_INVALID");
  });
  expectCode(() => new DurableAdvisoryStore({ databasePath: ":memory:" }), "PERSISTENCE_INPUT_INVALID");
});

test("FEAT-022-C accepted advisory and idempotency replay survive restart exactly once", () => {
  withDatabase((store, databasePath) => {
    store.registerPrompt(prompt);
    const stored = store.recordAccepted(accepted(), "idem-advisory-001");
    assert.equal(stored.advisoryId, "advisory-022-c-001");
    assert.equal(Object.isFrozen(stored.envelope.output), true);
    store.close();

    const reopened = new DurableAdvisoryStore({ databasePath });
    try {
      assert.deepEqual(reopened.findReplay("tenant-a", "team:team-a", "idem-advisory-001", "sha256:execution-001"), stored);
      assert.deepEqual(reopened.findAdvisory("tenant-a", "team:team-a", stored.advisoryId), stored);
      assert.deepEqual(reopened.recordAccepted(accepted(), "idem-advisory-001"), stored);
      expectCode(() => reopened.findReplay("tenant-a", "team:team-a", "idem-advisory-001", "sha256:different"), "IDEMPOTENCY_CONFLICT");
    } finally {
      reopened.close();
    }

    const raw = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(raw.prepare("SELECT COUNT(*) AS count FROM advisory_records").get()?.["count"], 1);
      assert.equal(raw.prepare("SELECT COUNT(*) AS count FROM advisory_idempotency").get()?.["count"], 1);
    } finally {
      raw.close();
    }
  });
});

test("FEAT-022-C atomic failure rolls back advisory and idempotency together", () => {
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-atomic-"));
  const databasePath = join(directory, "advisory.sqlite");
  let store: DurableAdvisoryStore | undefined;
  try {
    store = new DurableAdvisoryStore({ databasePath, beforeIdempotencyWrite: () => { throw new Error("injected failure"); } });
    store.registerPrompt(prompt);
    expectCode(() => store!.recordAccepted(accepted(), "idem-advisory-atomic"), "PERSISTENCE_UNAVAILABLE");
    assert.equal(store.findAdvisory("tenant-a", "team:team-a", "advisory-022-c-001"), undefined);
    assert.equal(store.findReplay("tenant-a", "team:team-a", "idem-advisory-atomic", "sha256:execution-001"), undefined);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FEAT-022-C prompt, advisory and idempotency evidence are append-only", () => {
  withDatabase((store, databasePath) => {
    store.registerPrompt(prompt);
    store.recordAccepted(accepted(), "idem-advisory-append-only");
    const raw = new DatabaseSync(databasePath);
    try {
      assert.throws(() => raw.exec("UPDATE advisory_prompts SET status = 'RETIRED'"), /append-only/);
      assert.throws(() => raw.exec("DELETE FROM advisory_records"), /append-only/);
      assert.throws(() => raw.exec("UPDATE advisory_idempotency SET execution_fingerprint = 'changed'"), /append-only/);
    } finally {
      raw.close();
    }
  });
});

test("FEAT-022-C unvalidated durable advisory cannot survive reopen as accepted truth", () => {
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-corrupt-"));
  const databasePath = join(directory, "advisory.sqlite");
  let store: DurableAdvisoryStore | undefined;
  try {
    store = new DurableAdvisoryStore({ databasePath });
    store.registerPrompt(prompt);
    store.close();
    store = undefined;
    const raw = new DatabaseSync(databasePath);
    try {
      const malformed = { ...accepted(), envelope: { ...accepted().envelope, output: { capabilityId: "AI-001", approval: "APPROVED" } } };
      raw.prepare("INSERT INTO advisory_records (advisory_id, tenant_id, scope_ref, capability_id, schema_id, execution_fingerprint, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(malformed.advisoryId, malformed.tenantId, malformed.scopeRef, malformed.capabilityId, malformed.schemaId, malformed.executionFingerprint, JSON.stringify(malformed));
    } finally {
      raw.close();
    }
    expectCode(() => new DurableAdvisoryStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FEAT-022-C durable boundary rejects unknown wrapper evidence fields", () => {
  withDatabase((store) => {
    store.registerPrompt(prompt);
    const unsafe = { ...accepted(), rawProviderResponse: { credential: "non-secret-test-value" } } as unknown as AcceptedAdvisoryRecord;
    expectCode(() => store.recordAccepted(unsafe, "idem-unsafe-wrapper"), "PERSISTENCE_INPUT_INVALID");
    assert.equal(store.findAdvisory("tenant-a", "team:team-a", unsafe.advisoryId), undefined);
  });
});
