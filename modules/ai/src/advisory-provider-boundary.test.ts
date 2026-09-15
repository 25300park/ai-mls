import assert from "node:assert/strict";
import test from "node:test";

import {
  AdvisoryProviderBoundaryError,
  ConfiguredAdvisoryProviderAdapter,
  evaluateAdvisoryProviderReadiness,
  type AdvisoryCapabilityConfiguration,
  type AdvisoryProviderExecutionRequest,
  type AdvisoryProviderTelemetry,
} from "./advisory-provider-boundary.js";
import type { AdvisoryAdapterIntent } from "./advisory-runtime-contracts.js";

const config = Object.freeze<AdvisoryCapabilityConfiguration>({
  environment: "Staging",
  capabilityId: "AI-001",
  capabilityVersion: "v1.0",
  providerRef: "provider:configured-test",
  modelRef: "model:configured-test",
  timeoutMs: 1000,
  credentialRef: "vault-ref:configured-test",
  promptId: "PRM-AI-001-001",
  promptVersion: "v1.0",
});

const intent = Object.freeze<AdvisoryAdapterIntent>({
  capabilityId: "AI-001",
  capabilityVersion: "v1.0",
  correlationId: "correlation-provider-001",
  schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
  subjectRef: { entityType: "RawSource", entityId: "raw-a", version: "1" },
  provenance: [{ entityType: "RawSource", entityId: "raw-a", version: "1" }],
  classification: "CONFIDENTIAL_BUSINESS",
  inputFingerprint: "sha256:input-a",
  evidenceFingerprint: "sha256:evidence-a",
  promptId: config.promptId,
  promptVersion: config.promptVersion,
  promptFingerprint: "sha256:prompt-a",
  executionFingerprint: "sha256:execution-a",
});

test("Phase 4C provider readiness fails closed for every missing load-bearing config value", () => {
  for (const key of ["providerRef", "modelRef", "timeoutMs", "credentialRef", "capabilityVersion", "promptId", "promptVersion"] as const) {
    const invalid = { ...config, [key]: key === "timeoutMs" ? 0 : "" } as AdvisoryCapabilityConfiguration;
    assert.deepEqual(evaluateAdvisoryProviderReadiness(invalid, { credentialAvailable: true, networkAuthorized: true, testOnly: false }), {
      providerIndependent: "NOT_READY",
      stagingExecution: "NOT_READY",
    });
  }
});

test("Phase 4C configured adapter invokes one executor and emits only allowlisted telemetry", () => {
  const telemetry: AdvisoryProviderTelemetry[] = [];
  const requests: AdvisoryProviderExecutionRequest[] = [];
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: (reference) => reference === config.credentialRef, resolve: (reference) => reference === config.credentialRef ? "test-boundary-value" : undefined },
    executor: { testOnly: true, execute: (request) => { requests.push(request); return { canonical: "candidate" }; } },
    telemetrySink: { append: (event) => telemetry.push(event) },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });

  assert.deepEqual(adapter.generate(intent), { canonical: "candidate" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.credential, "test-boundary-value");
  assert.equal("tenantId" in (requests[0] ?? {}), false);
  assert.equal(telemetry.length, 0);
  adapter.recordValidationOutcome(intent, "SUCCESS");
  assert.deepEqual(Object.keys(telemetry[0] ?? {}).sort(), ["capabilityId", "capabilityVersion", "correlationId", "latencyMs", "modelRef", "normalizedOutcome", "providerRef"].sort());
  assert.equal(JSON.stringify(telemetry).includes("test-boundary-value"), false);
  assert.equal(Object.isFrozen(telemetry[0]), true);
});

test("Phase 4C raw executor failure is normalized once without retry or fallback", () => {
  let calls = 0;
  const telemetry: AdvisoryProviderTelemetry[] = [];
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" },
    executor: { testOnly: true, execute: () => { calls += 1; throw new Error("Bearer not-a-secret token at C:\\unsafe\\provider.ts:12"); } },
    telemetrySink: { append: (event) => telemetry.push(event) },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });

  assert.throws(() => adapter.generate(intent), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.code === "ADVISORY_UNAVAILABLE" && error.message === "Advisory provider is unavailable.");
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(telemetry).includes("unsafe"), false);
  assert.equal(telemetry[0]?.normalizedOutcome, "ADVISORY_UNAVAILABLE");
});

test("Phase 4C credential resolution failure invokes no provider executor", () => {
  let calls = 0;
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => false, resolve: () => undefined },
    executor: { testOnly: true, execute: () => { calls += 1; return {}; } },
    telemetrySink: { append: () => undefined },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });
  assert.throws(() => adapter.generate(intent), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.code === "ADVISORY_UNAVAILABLE");
  assert.equal(calls, 0);
});

test("Phase 4C capability, prompt, and version mismatch fails before provider execution", () => {
  let calls = 0;
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" },
    executor: { testOnly: true, execute: () => { calls += 1; return {}; } },
    telemetrySink: { append: () => undefined },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });
  for (const changed of [{ ...intent, capabilityId: "AI-004" as const }, { ...intent, capabilityVersion: "v2.0" }, { ...intent, promptVersion: "v2.0" }]) {
    assert.throws(() => adapter.generate(changed), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.code === "PROVIDER_CONFIGURATION_INVALID");
  }
  assert.equal(calls, 0);
});

test("Phase 4C deterministic test executor never establishes Staging execution readiness", () => {
  assert.deepEqual(evaluateAdvisoryProviderReadiness(config, { credentialAvailable: true, networkAuthorized: true, testOnly: true }), {
    providerIndependent: "READY",
    stagingExecution: "NOT_READY",
  });
  assert.deepEqual(evaluateAdvisoryProviderReadiness(config, { credentialAvailable: true, networkAuthorized: false, testOnly: false }), {
    providerIndependent: "READY",
    stagingExecution: "NOT_READY",
  });
});

test("Phase 4C production executor cannot run while scoped provider network authorization is absent", () => {
  let calls = 0;
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" },
    executor: { testOnly: false, execute: () => { calls += 1; return {}; } },
    telemetrySink: { append: () => undefined },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });
  assert.throws(() => adapter.generate(intent), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.code === "ADVISORY_UNAVAILABLE");
  assert.equal(calls, 0);
});

test("Phase 4C provider telemetry records success only after canonical validation", () => {
  const telemetry: AdvisoryProviderTelemetry[] = [];
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" },
    executor: { testOnly: true, execute: () => ({ malformed: true }) },
    telemetrySink: { append: (event) => telemetry.push(event) },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });
  adapter.generate(intent);
  assert.equal(telemetry.length, 0);
  adapter.recordValidationOutcome(intent, "ADVISORY_OUTPUT_REJECTED");
  assert.equal(telemetry[0]?.normalizedOutcome, "ADVISORY_OUTPUT_REJECTED");
  assert.equal(telemetry.some((event) => event.normalizedOutcome === "SUCCESS"), false);
});

test("Phase 4C unsafe provider configuration, correlation, and resolver diagnostics fail closed", () => {
  assert.throws(() => new ConfiguredAdvisoryProviderAdapter({
    configuration: { ...config, modelRef: "C:\\unsafe\\model.db" },
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => "test-boundary-value" },
    executor: { testOnly: true, execute: () => ({}) },
    telemetrySink: { append: () => undefined },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  }), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.code === "PROVIDER_CONFIGURATION_INVALID");

  let calls = 0;
  const adapter = new ConfiguredAdvisoryProviderAdapter({
    configuration: config,
    networkAuthorized: false,
    credentialResolver: { isAvailable: () => true, resolve: () => { throw new Error("at C:\\unsafe\\resolver.ts:1"); } },
    executor: { testOnly: true, execute: () => { calls += 1; return {}; } },
    telemetrySink: { append: () => undefined },
    clock: () => new Date("2026-09-15T01:00:00.000Z"),
  });
  assert.throws(() => adapter.generate({ ...intent, correlationId: "person@example.com" }), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.message === "Advisory provider configuration does not match execution intent.");
  assert.throws(() => adapter.generate(intent), (error: unknown) => error instanceof AdvisoryProviderBoundaryError && error.message === "Advisory provider is unavailable.");
  assert.equal(calls, 0);
});
