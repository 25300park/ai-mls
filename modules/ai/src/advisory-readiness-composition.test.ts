import { adaptSynchronousAdvisoryPersistence } from "./advisory-async-persistence.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { composeAdvisoryProviderReadiness } from "./advisory-readiness-composition.js";
import { ConfiguredAdvisoryProviderAdapter, type AdvisoryCapabilityConfiguration, type ExecutableAdvisoryCapabilityId } from "./advisory-provider-boundary.js";
import { Ai001ListingParseApplicationService, Ai004RequirementParseApplicationService, Ai005MatchingApplicationService } from "./advisory-application-services.js";
import { AdvisoryRuntime } from "./advisory-runtime.js";
import { DurableAdvisoryStore } from "./advisory-durable-persistence.js";
import { AdvisoryJobFailureMapper } from "../../jobs/src/advisory-job-handlers.js";

const capabilities = ["AI-001", "AI-004", "AI-005"] as const;
const configurations = Object.fromEntries(capabilities.map((capabilityId) => [capabilityId, Object.freeze({ environment: "Staging", capabilityId, capabilityVersion: "v1.0", providerRef: `provider:${capabilityId}`, modelRef: `model:${capabilityId}`, timeoutMs: 1000, credentialRef: `vault-ref:${capabilityId}`, promptId: `PRM-${capabilityId}-001`, promptVersion: "v1.0" })])) as Record<ExecutableAdvisoryCapabilityId, AdvisoryCapabilityConfiguration>;
const failureMapper = new AdvisoryJobFailureMapper();
function adapters(testOnly: boolean, networkAuthorized: boolean, credentialAvailable: boolean, onExecute: () => void = () => undefined): Record<ExecutableAdvisoryCapabilityId, ConfiguredAdvisoryProviderAdapter> {
  return Object.fromEntries(capabilities.map((capabilityId) => [capabilityId, new ConfiguredAdvisoryProviderAdapter({ configuration: configurations[capabilityId], networkAuthorized, credentialResolver: { isAvailable: () => credentialAvailable, resolve: () => credentialAvailable ? "test-boundary-value" : undefined }, executor: { testOnly, execute: () => { onExecute(); return {}; } }, telemetrySink: { append: () => undefined }, clock: () => new Date("2026-09-15T01:00:00.000Z") })])) as Record<ExecutableAdvisoryCapabilityId, ConfiguredAdvisoryProviderAdapter>;
}

test("Phase 4C readiness reports 3/3 provider-independent and 0/3 actual Staging execution for test adapters", async () => {
  (await withComposition(true, false, true, async ({ adapters: configured, applicationPorts }) => {
    const readiness = (await composeAdvisoryProviderReadiness({ adapters: configured, applicationPorts, failureMapper }));
    assert.equal(readiness.providerIndependentReady, 3);
    assert.equal(readiness.stagingExecutionReady, 0);
    assert.equal(readiness.capabilities.every((item) => item.providerIndependent === "READY" && item.stagingExecution === "NOT_READY"), true);
  }));
});

test("Phase 4C readiness preserves missing configuration as NOT_READY without hidden defaults", async () => {
  (await withComposition(false, false, true, async ({ adapters: configured, applicationPorts }) => {
    const readiness = (await composeAdvisoryProviderReadiness({ adapters: { "AI-001": configured["AI-001"] }, applicationPorts, failureMapper }));
    assert.equal(readiness.providerIndependentReady, 1);
    assert.equal(readiness.stagingExecutionReady, 0);
    assert.deepEqual(readiness.capabilities.filter((item) => item.providerIndependent === "NOT_READY").map((item) => item.capabilityId), ["AI-004", "AI-005"]);
  }));
});

test("Phase 4C readiness cannot treat network authorization or credentials alone as execution readiness", async () => {
  (await withComposition(false, true, false, async ({ adapters: configured, applicationPorts }) => assert.equal((await composeAdvisoryProviderReadiness({ adapters: configured, applicationPorts, failureMapper })).stagingExecutionReady, 0)));
  (await withComposition(false, false, true, async ({ adapters: configured, applicationPorts }) => assert.equal((await composeAdvisoryProviderReadiness({ adapters: configured, applicationPorts, failureMapper })).stagingExecutionReady, 0)));
});

test("Phase 4C readiness cannot be fabricated without the actual matching application and failure boundaries", async () => {
  const configured = adapters(true, false, true);
  const unusedRuntime = new AdvisoryRuntime({ persistence: {} as never, snapshotResolver: {} as never, adapter: {} as never, clock: () => new Date(0) });
  const disconnectedPorts = {
    "AI-001": new Ai001ListingParseApplicationService({ runtime: unusedRuntime, binding: { capabilityVersion: "v1.0", promptId: "PRM-AI-001-001", promptVersion: "v1.0" } }),
    "AI-004": new Ai004RequirementParseApplicationService({ runtime: unusedRuntime, binding: { capabilityVersion: "v1.0", promptId: "PRM-AI-004-001", promptVersion: "v1.0" } }),
    "AI-005": new Ai005MatchingApplicationService({ runtime: unusedRuntime, binding: { capabilityVersion: "v1.0", promptId: "PRM-AI-005-001", promptVersion: "v1.0" } }),
  };
  assert.equal((await composeAdvisoryProviderReadiness({ adapters: configured, applicationPorts: disconnectedPorts, failureMapper })).providerIndependentReady, 0);
});

test("REL001-PHASE6 provider-independent readiness performs zero provider executions", async () => {
  let executions = 0;
  (await withComposition(true, false, true, async ({ adapters: configured, applicationPorts }) => {
    const readiness = (await composeAdvisoryProviderReadiness({ adapters: configured, applicationPorts, failureMapper }));
    assert.equal(readiness.providerIndependentReady, 3);
    assert.equal(readiness.stagingExecutionReady, 0);
    assert.equal(executions, 0);
  }, () => { executions += 1; }));
});

async function withComposition(testOnly: boolean, networkAuthorized: boolean, credentialAvailable: boolean, run: (value: Readonly<{ adapters: Record<ExecutableAdvisoryCapabilityId, ConfiguredAdvisoryProviderAdapter>; applicationPorts: { "AI-001": Ai001ListingParseApplicationService; "AI-004": Ai004RequirementParseApplicationService; "AI-005": Ai005MatchingApplicationService } }>) => Promise<void>, onExecute: () => void = () => undefined): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "rel001-phase4c-readiness-"));
  const configured = adapters(testOnly, networkAuthorized, credentialAvailable, onExecute);
  const stores: DurableAdvisoryStore[] = [];
  try {
    const services = Object.fromEntries(capabilities.map((capabilityId) => {
      const store = new DurableAdvisoryStore({ databasePath: join(directory, `${capabilityId}.sqlite`) });
      stores.push(store);
      const configuration = configurations[capabilityId];
      store.registerPrompt({ promptId: configuration.promptId, promptVersion: configuration.promptVersion, capabilityId, schemaId: capabilityId === "AI-001" ? "urn:ai-mls:schema:listing-parser-output:v0.1" : capabilityId === "AI-004" ? "urn:ai-mls:schema:requirement-parser-output:v0.1" : "urn:ai-mls:schema:matching-result:v0.1", contentFingerprint: `sha256:prompt-${capabilityId}`, status: "ACTIVE", createdAt: "2026-09-15T01:00:00.000Z" });
      const runtime = new AdvisoryRuntime({ persistence: adaptSynchronousAdvisoryPersistence(store), snapshotResolver: { resolve: () => undefined }, adapter: configured[capabilityId], clock: () => new Date("2026-09-15T01:00:00.000Z") });
      const binding = { capabilityVersion: configuration.capabilityVersion, promptId: configuration.promptId, promptVersion: configuration.promptVersion };
      const service = capabilityId === "AI-001" ? new Ai001ListingParseApplicationService({ runtime, binding }) : capabilityId === "AI-004" ? new Ai004RequirementParseApplicationService({ runtime, binding }) : new Ai005MatchingApplicationService({ runtime, binding });
      return [capabilityId, service];
    })) as { "AI-001": Ai001ListingParseApplicationService; "AI-004": Ai004RequirementParseApplicationService; "AI-005": Ai005MatchingApplicationService };
    await run({ adapters: configured, applicationPorts: services });
  } finally { stores.forEach((store) => store.close()); rmSync(directory, { recursive: true, force: true }); }
}
