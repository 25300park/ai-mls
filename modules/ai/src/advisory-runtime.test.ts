import { adaptSynchronousAdvisoryPersistence } from "./advisory-async-persistence.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import { DeterministicNoNetworkAdvisoryAdapter } from "./advisory-test-adapter.js";
import type { AdvisoryExecutionRequest, AdvisoryPromptRecord, TrustedAdvisorySnapshot } from "./advisory-runtime-contracts.js";

const subject = Object.freeze({ entityType: "RawSource", entityId: "raw-022-c", version: "4" });
const confidence = Object.freeze({ band: "MEDIUM" as const, reasonCodes: ["REVIEW_REQUIRED"], policyVersion: "ai-policy-v1" });
const prompt = Object.freeze<AdvisoryPromptRecord>({ promptId: "PRM-AI-001-001", promptVersion: "v1.0", capabilityId: "AI-001", schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1", contentFingerprint: "sha256:prompt-fixture-001", status: "ACTIVE", createdAt: "2026-09-09T01:00:00.000Z" });
const snapshot = Object.freeze<TrustedAdvisorySnapshot>({ tenantId: "tenant-a", scopeRef: "team:team-a", subjectRef: subject, provenance: [subject], inputClassifications: ["CONFIDENTIAL_BUSINESS"], inputFingerprint: "sha256:input-001", evidenceFingerprint: "sha256:evidence-001" });
const envelope = Object.freeze({ schemaVersion: "1.0" as const, schemaId: prompt.schemaId, capabilityId: "AI-001" as const, subjectRef: subject, provenance: [subject], classification: "CONFIDENTIAL_BUSINESS" as const, output: { capabilityId: "AI-001" as const, inputRef: subject, fields: [{ fieldName: "propertyName", valueState: "PRESENT" as const, normalizedValue: "Example Tower", evidenceRefs: [{ sourceRef: subject, evidenceLocator: "field:propertyName" }], confidence }], warnings: [], overallConfidence: confidence } });
const request = Object.freeze<AdvisoryExecutionRequest>({ tenantId: "tenant-a", scopeRef: "team:team-a", capabilityId: "AI-001", schemaId: prompt.schemaId, inputReference: subject, promptId: prompt.promptId, promptVersion: prompt.promptVersion, idempotencyKey: "idem-runtime-001" });

async function fixture(run: (context: { store: DurableAdvisoryStore; runtime: AdvisoryRuntime; adapter: DeterministicNoNetworkAdvisoryAdapter }) => void | Promise<void>, options: { prompt?: AdvisoryPromptRecord; snapshot?: TrustedAdvisorySnapshot; result?: unknown; behavior?: "ERROR" | "TIMEOUT" | "MALFORMED" } = {}): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-runtime-"));
  const store = new DurableAdvisoryStore({ databasePath: join(directory, "advisory.sqlite") });
  const adapter = new DeterministicNoNetworkAdvisoryAdapter({ ...(options.result === undefined ? { result: envelope } : { result: options.result }), ...(options.behavior === undefined ? {} : { behavior: options.behavior }) });
  const runtime = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => options.snapshot ?? snapshot }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  try {
    if (options.prompt !== undefined) store.registerPrompt(options.prompt);
    else store.registerPrompt(prompt);
    await run({ store, runtime, adapter });
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

async function expectCode(run: () => Promise<unknown>, code: string): Promise<void> { await assert.rejects(run, (error: unknown) => error instanceof Error && "code" in error && error.code === code); }

test("FEAT-022-C missing trusted snapshot fails before adapter", async () => (await fixture(async ({ store, adapter }) => {
  const missing = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => undefined }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  (await expectCode(async () => (await missing.execute(request)), "ADVISORY_INPUT_UNAVAILABLE")); assert.equal(adapter.invocationCount, 0);
})));

test("FEAT-022-C missing prompt fails closed", async () => (await fixture(async ({ store, runtime, adapter }) => {
  (await expectCode(async () => (await runtime.execute({ ...request, promptId: "PRM-MISSING" })), "PROMPT_NOT_ACTIVE")); assert.equal(adapter.invocationCount, 0); assert.equal(store.findAdvisory("tenant-a", "team:team-a", "none"), undefined);
})));

test("FEAT-022-C retired prompt cannot execute", async () => (await fixture(async ({ runtime, adapter }) => {
  (await expectCode(async () => (await runtime.execute({ ...request, promptVersion: "v0.9" })), "PROMPT_NOT_ACTIVE")); assert.equal(adapter.invocationCount, 0);
}, { prompt: { ...prompt, promptVersion: "v0.9", status: "RETIRED" } })));

test("FEAT-022-C capability schema mismatch fails before adapter", async () => (await fixture(async ({ runtime, adapter }) => {
  (await expectCode(async () => (await runtime.execute({ ...request, schemaId: "urn:ai-mls:schema:property-normalization-output:v0.1" })), "SCHEMA_CAPABILITY_MISMATCH")); assert.equal(adapter.invocationCount, 0);
})));

test("FEAT-022-C wrong tenant snapshot is concealed before adapter", async () => (await fixture(async ({ runtime, adapter }) => {
  (await expectCode(async () => (await runtime.execute(request)), "ADVISORY_INPUT_UNAVAILABLE")); assert.equal(adapter.invocationCount, 0);
}, { snapshot: { ...snapshot, tenantId: "tenant-b" } })));

test("FEAT-022-C exact replay returns one durable advisory without reinvocation", async () => (await fixture(async ({ runtime, adapter }) => {
  const first = (await runtime.execute(request)); const replay = (await runtime.execute(request)); assert.deepEqual(replay, first); assert.equal(adapter.invocationCount, 1);
})));

test("Phase 4C preserves the legacy execution fingerprint when optional provenance fields are absent", async () => (await fixture(async ({ store }) => {
  let captured = "";
  const adapter = {
    adapterVersion: "legacy-compatible-adapter-v1",
    generate: (intent: { executionFingerprint: string }) => { captured = intent.executionFingerprint; return envelope; },
  };
  const runtime = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => snapshot }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  (await runtime.execute(request));
  const canonical = JSON.stringify({
    adapterVersion: adapter.adapterVersion,
    capabilityId: request.capabilityId,
    evidenceFingerprint: snapshot.evidenceFingerprint,
    inputFingerprint: snapshot.inputFingerprint,
    promptFingerprint: prompt.contentFingerprint,
    promptId: prompt.promptId,
    promptVersion: prompt.promptVersion,
    schemaId: request.schemaId,
  });
  assert.equal(captured, `sha256:${createHash("sha256").update(canonical).digest("hex")}`);
})));

test("FEAT-022-C same idempotency identity with different trusted input conflicts", async () => (await fixture(async ({ store, runtime, adapter }) => {
  (await runtime.execute(request));
  const changed = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => ({ ...snapshot, inputFingerprint: "sha256:input-002" }) }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  (await expectCode(async () => (await changed.execute(request)), "IDEMPOTENCY_CONFLICT")); assert.equal(adapter.invocationCount, 1);
})));

test("FEAT-022-C malformed adapter output persists no accepted advisory", async () => (await fixture(async ({ runtime, adapter }) => {
  (await expectCode(async () => (await runtime.execute(request)), "ADVISORY_OUTPUT_REJECTED")); assert.equal(adapter.invocationCount, 1);
}, { behavior: "MALFORMED" })));

test("FEAT-022-C raw provider response field is rejected", async () => (await fixture(async ({ runtime }) => {
  (await expectCode(async () => (await runtime.execute(request)), "ADVISORY_OUTPUT_REJECTED"));
}, { result: { ...envelope, rawProviderResponse: { token: "not-a-secret-fixture" } } })));

test("FEAT-022-C hidden reasoning field is rejected", async () => (await fixture(async ({ runtime }) => {
  (await expectCode(async () => (await runtime.execute(request)), "ADVISORY_OUTPUT_REJECTED"));
}, { result: { ...envelope, chainOfThought: "not-stored" } })));

test("FEAT-022-C fabricated evidence reference is rejected", async () => (await fixture(async ({ runtime }) => {
  (await expectCode(async () => (await runtime.execute(request)), "ADVISORY_OUTPUT_REJECTED"));
}, { result: { ...envelope, output: { ...envelope.output, inputRef: { ...subject, entityId: "fabricated" } } } })));

test("FEAT-022-C adapter error and timeout persist no accepted advisory", async () => {
  for (const behavior of ["ERROR", "TIMEOUT"] as const) (await fixture(async ({ runtime, adapter }) => { (await expectCode(async () => (await runtime.execute(request)), "ADVISORY_UNAVAILABLE")); assert.equal(adapter.invocationCount, 1); }, { behavior }));
});

test("FEAT-022-C LOW confidence is persisted only as review-required advisory", async () => {
  const low = { band: "LOW" as const, reasonCodes: ["LOW_CONFIDENCE"], policyVersion: "ai-policy-v1" };
  (await fixture(async ({ runtime }) => { const result = (await runtime.execute(request)); assert.equal(result.reviewRequired, true); assert.equal(result.validationResult.route, "MANUAL_CORRECTION_REQUIRED"); assert.equal(result.authority, "ADVISORY"); }, { result: { ...envelope, output: { ...envelope.output, fields: envelope.output.fields.map((field) => ({ ...field, confidence: low })), overallConfidence: low } } }));
});

test("FEAT-022-C read conceals tenant and scope while returning immutable safe evidence", async () => (await fixture(async ({ runtime }) => {
  const saved = (await runtime.execute(request)); assert.deepEqual((await runtime.read("tenant-a", "team:team-a", saved.advisoryId)), saved); assert.equal((await runtime.read("tenant-b", "team:team-a", saved.advisoryId)), undefined); assert.equal(Object.isFrozen(saved.envelope), true);
})));

test("FEAT-022-C runtime exposes no domain command or business mutation surface", async () => (await fixture(async ({ runtime }) => {
  (await runtime.execute(request)); for (const name of ["approve", "publish", "recover", "retry", "mutate"]) assert.equal(name in runtime, false);
})));
