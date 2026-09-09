import assert from "node:assert/strict";
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

function fixture(run: (context: { store: DurableAdvisoryStore; runtime: AdvisoryRuntime; adapter: DeterministicNoNetworkAdvisoryAdapter }) => void, options: { prompt?: AdvisoryPromptRecord; snapshot?: TrustedAdvisorySnapshot; result?: unknown; behavior?: "ERROR" | "TIMEOUT" | "MALFORMED" } = {}): void {
  const directory = mkdtempSync(join(tmpdir(), "feat-022-c-runtime-"));
  const store = new DurableAdvisoryStore({ databasePath: join(directory, "advisory.sqlite") });
  const adapter = new DeterministicNoNetworkAdvisoryAdapter({ ...(options.result === undefined ? { result: envelope } : { result: options.result }), ...(options.behavior === undefined ? {} : { behavior: options.behavior }) });
  const runtime = new AdvisoryRuntime({ persistence: store, snapshotResolver: { resolve: () => options.snapshot ?? snapshot }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  try {
    if (options.prompt !== undefined) store.registerPrompt(options.prompt);
    else store.registerPrompt(prompt);
    run({ store, runtime, adapter });
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function expectCode(run: () => unknown, code: string): void { assert.throws(run, (error: unknown) => error instanceof Error && "code" in error && error.code === code); }

test("FEAT-022-C missing trusted snapshot fails before adapter", () => fixture(({ store, adapter }) => {
  const missing = new AdvisoryRuntime({ persistence: store, snapshotResolver: { resolve: () => undefined }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  expectCode(() => missing.execute(request), "ADVISORY_INPUT_UNAVAILABLE"); assert.equal(adapter.invocationCount, 0);
}));

test("FEAT-022-C missing prompt fails closed", () => fixture(({ store, runtime, adapter }) => {
  expectCode(() => runtime.execute({ ...request, promptId: "PRM-MISSING" }), "PROMPT_NOT_ACTIVE"); assert.equal(adapter.invocationCount, 0); assert.equal(store.findAdvisory("tenant-a", "team:team-a", "none"), undefined);
}));

test("FEAT-022-C retired prompt cannot execute", () => fixture(({ runtime, adapter }) => {
  expectCode(() => runtime.execute({ ...request, promptVersion: "v0.9" }), "PROMPT_NOT_ACTIVE"); assert.equal(adapter.invocationCount, 0);
}, { prompt: { ...prompt, promptVersion: "v0.9", status: "RETIRED" } }));

test("FEAT-022-C capability schema mismatch fails before adapter", () => fixture(({ runtime, adapter }) => {
  expectCode(() => runtime.execute({ ...request, schemaId: "urn:ai-mls:schema:property-normalization-output:v0.1" }), "SCHEMA_CAPABILITY_MISMATCH"); assert.equal(adapter.invocationCount, 0);
}));

test("FEAT-022-C wrong tenant snapshot is concealed before adapter", () => fixture(({ runtime, adapter }) => {
  expectCode(() => runtime.execute(request), "ADVISORY_INPUT_UNAVAILABLE"); assert.equal(adapter.invocationCount, 0);
}, { snapshot: { ...snapshot, tenantId: "tenant-b" } }));

test("FEAT-022-C exact replay returns one durable advisory without reinvocation", () => fixture(({ runtime, adapter }) => {
  const first = runtime.execute(request); const replay = runtime.execute(request); assert.deepEqual(replay, first); assert.equal(adapter.invocationCount, 1);
}));

test("FEAT-022-C same idempotency identity with different trusted input conflicts", () => fixture(({ store, runtime, adapter }) => {
  runtime.execute(request);
  const changed = new AdvisoryRuntime({ persistence: store, snapshotResolver: { resolve: () => ({ ...snapshot, inputFingerprint: "sha256:input-002" }) }, adapter, clock: () => new Date("2026-09-09T01:01:00.000Z") });
  expectCode(() => changed.execute(request), "IDEMPOTENCY_CONFLICT"); assert.equal(adapter.invocationCount, 1);
}));

test("FEAT-022-C malformed adapter output persists no accepted advisory", () => fixture(({ runtime, adapter }) => {
  expectCode(() => runtime.execute(request), "ADVISORY_OUTPUT_REJECTED"); assert.equal(adapter.invocationCount, 1);
}, { behavior: "MALFORMED" }));

test("FEAT-022-C raw provider response field is rejected", () => fixture(({ runtime }) => {
  expectCode(() => runtime.execute(request), "ADVISORY_OUTPUT_REJECTED");
}, { result: { ...envelope, rawProviderResponse: { token: "not-a-secret-fixture" } } }));

test("FEAT-022-C hidden reasoning field is rejected", () => fixture(({ runtime }) => {
  expectCode(() => runtime.execute(request), "ADVISORY_OUTPUT_REJECTED");
}, { result: { ...envelope, chainOfThought: "not-stored" } }));

test("FEAT-022-C fabricated evidence reference is rejected", () => fixture(({ runtime }) => {
  expectCode(() => runtime.execute(request), "ADVISORY_OUTPUT_REJECTED");
}, { result: { ...envelope, output: { ...envelope.output, inputRef: { ...subject, entityId: "fabricated" } } } }));

test("FEAT-022-C adapter error and timeout persist no accepted advisory", () => {
  for (const behavior of ["ERROR", "TIMEOUT"] as const) fixture(({ runtime, adapter }) => { expectCode(() => runtime.execute(request), "ADVISORY_UNAVAILABLE"); assert.equal(adapter.invocationCount, 1); }, { behavior });
});

test("FEAT-022-C LOW confidence is persisted only as review-required advisory", () => {
  const low = { band: "LOW" as const, reasonCodes: ["LOW_CONFIDENCE"], policyVersion: "ai-policy-v1" };
  fixture(({ runtime }) => { const result = runtime.execute(request); assert.equal(result.reviewRequired, true); assert.equal(result.validationResult.route, "MANUAL_CORRECTION_REQUIRED"); assert.equal(result.authority, "ADVISORY"); }, { result: { ...envelope, output: { ...envelope.output, fields: envelope.output.fields.map((field) => ({ ...field, confidence: low })), overallConfidence: low } } });
});

test("FEAT-022-C read conceals tenant and scope while returning immutable safe evidence", () => fixture(({ runtime }) => {
  const saved = runtime.execute(request); assert.deepEqual(runtime.read("tenant-a", "team:team-a", saved.advisoryId), saved); assert.equal(runtime.read("tenant-b", "team:team-a", saved.advisoryId), undefined); assert.equal(Object.isFrozen(saved.envelope), true);
}));

test("FEAT-022-C runtime exposes no domain command or business mutation surface", () => fixture(({ runtime }) => {
  runtime.execute(request); for (const name of ["approve", "publish", "recover", "retry", "mutate"]) assert.equal(name in runtime, false);
}));
