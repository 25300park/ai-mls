import assert from "node:assert/strict";
import test from "node:test";

import {
  createIntegratedStagingRuntimeVerification,
  type IntegratedStagingRuntimeVerificationInput,
} from "./staging-integrated-runtime-verification.js";

function healthyInput(): IntegratedStagingRuntimeVerificationInput {
  return Object.freeze({
    session: Object.freeze({ status: () => Object.freeze({ health: "HEALTHY" as const, readiness: "READY" as const }) }),
    audit: Object.freeze({ status: () => Object.freeze({ health: "HEALTHY" as const, readiness: "READY" as const, sourceCount: 7 as const }) }),
    jobs: Object.freeze({ status: () => Object.freeze({
      health: "HEALTHY" as const,
      readiness: "READY" as const,
      handlerMappings: Object.freeze([
        Object.freeze({ jobType: "AI_LISTING_PARSE" as const, handlerId: "AI-001" as const }),
        Object.freeze({ jobType: "AI_REQUIREMENT_PARSE" as const, handlerId: "AI-004" as const }),
        Object.freeze({ jobType: "AI_MATCHING" as const, handlerId: "AI-005" as const }),
      ]),
    }) }),
    advisory: Object.freeze({ status: () => Object.freeze({
      capabilities: Object.freeze([
        Object.freeze({ capabilityId: "AI-001" as const, providerIndependent: "READY" as const, stagingExecution: "NOT_READY" as const }),
        Object.freeze({ capabilityId: "AI-004" as const, providerIndependent: "READY" as const, stagingExecution: "NOT_READY" as const }),
        Object.freeze({ capabilityId: "AI-005" as const, providerIndependent: "READY" as const, stagingExecution: "NOT_READY" as const }),
      ]),
      providerIndependentReady: 3,
      stagingExecutionReady: 0,
    }) }),
    console: Object.freeze({ status: () => Object.freeze({
      environment: "Staging" as const,
      readiness: "DEGRADED" as const,
      executableScreens: 6 as const,
      providerIndependentImplementation: "READY" as const,
      liveProviderExecution: "NOT_READY" as const,
      components: Object.freeze({
        session: "READY" as const,
        publication: "READY" as const,
        api015: "READY" as const,
        api016: "READY" as const,
        api017: "READY" as const,
        feat022ProviderIndependent: "READY" as const,
      }),
    }) }),
  });
}

test("REL001-PHASE6 RED: healthy mandatory stack is ready only for the available boundary", () => {
  const status = createIntegratedStagingRuntimeVerification(healthyInput()).status();

  assert.deepEqual(status, {
    classification: "READY_FOR_AVAILABLE_BOUNDARY",
    mandatory: {
      session: "READY", api015: "READY", api016: "READY", api017: "READY",
      feat022ProviderIndependent: "READY", adminConsole: "READY",
    },
    holds: {
      liveProvider: "NOT_READY", decision162: "IN_REVIEW", externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY",
      coreTransport: "HOLD", ui006CoreData: "SAFELY_DEFERRED",
    },
  });
  assert.equal(Object.isFrozen(status), true);
  assert.equal(Object.isFrozen(status.mandatory), true);
  assert.equal(Object.isFrozen(status.holds), true);
});

test("REL001-PHASE6 RED: each missing mandatory component fails closed without changing canonical holds", () => {
  type MandatoryKey = "session" | "api015" | "api016" | "api017" | "feat022ProviderIndependent" | "adminConsole";
  const cases: readonly Readonly<{
    name: MandatoryKey;
    input: IntegratedStagingRuntimeVerificationInput;
  }>[] = [
    { name: "session", input: { ...healthyInput(), session: { status: () => ({ health: "UNHEALTHY", readiness: "READY" }) } } },
    { name: "api015", input: { ...healthyInput(), console: { status: () => ({ ...healthyInput().console.status(), components: { ...healthyInput().console.status().components, api015: "NOT_READY" } }) } } },
    { name: "api016", input: { ...healthyInput(), audit: { status: () => { throw new Error("C:\\secret\\audit.sqlite SQLSTATE token=hidden"); } } } },
    { name: "api017", input: { ...healthyInput(), jobs: { status: () => ({ health: "UNHEALTHY", readiness: "READY", handlerMappings: [] }) } } },
    { name: "api017", input: { ...healthyInput(), jobs: { status: () => ({ health: "HEALTHY", readiness: "READY", handlerMappings: [] }) } } },
    { name: "feat022ProviderIndependent", input: { ...healthyInput(), advisory: { status: () => ({ ...healthyInput().advisory.status(), providerIndependentReady: 2 }) } } },
    { name: "adminConsole", input: { ...healthyInput(), console: { status: () => ({ ...healthyInput().console.status(), readiness: "NOT_READY" }) } } },
  ];

  for (const scenario of cases) {
    const status = createIntegratedStagingRuntimeVerification(scenario.input).status();
    assert.equal(status.classification, "NOT_READY", scenario.name);
    assert.equal(status.mandatory[scenario.name], "NOT_READY", scenario.name);
    if (scenario.name !== "adminConsole") {
      assert.equal(status.mandatory.adminConsole, "NOT_READY", `${scenario.name} must also make the Console boundary NOT_READY`);
    }
    assert.deepEqual(status.holds, {
      liveProvider: "NOT_READY", decision162: "IN_REVIEW", externalDependency: "EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY",
      coreTransport: "HOLD", ui006CoreData: "SAFELY_DEFERRED",
    });
    assert.equal(JSON.stringify(status).includes("audit.sqlite"), false);
    assert.equal(JSON.stringify(status).includes("token"), false);
  }
});

test("REL001-PHASE6 RED: malformed or falsely live-ready provider state fails closed", () => {
  const falselyReady = healthyInput().advisory.status();
  const input = {
    ...healthyInput(),
    advisory: { status: () => ({
      ...falselyReady,
      capabilities: falselyReady.capabilities.map((item: Readonly<{ capabilityId: "AI-001" | "AI-004" | "AI-005"; providerIndependent: "READY" | "NOT_READY"; stagingExecution: "READY" | "NOT_READY" }>) => ({ ...item, stagingExecution: "READY" as const })),
      stagingExecutionReady: 3,
    }) },
  };
  const status = createIntegratedStagingRuntimeVerification(input).status();
  assert.equal(status.classification, "NOT_READY");
  assert.equal(status.mandatory.feat022ProviderIndependent, "NOT_READY");
  assert.equal(status.holds.liveProvider, "NOT_READY");
  assert.equal(status.holds.decision162, "IN_REVIEW");
});

test("REL001-PHASE6: restart observation cannot retain stale READY state", () => {
  let sessionReady = true;
  const verification = createIntegratedStagingRuntimeVerification({
    ...healthyInput(),
    session: { status: () => sessionReady
      ? { health: "HEALTHY", readiness: "READY" }
      : { health: "UNHEALTHY", readiness: "NOT_READY" } },
  });

  assert.equal(verification.status().classification, "READY_FOR_AVAILABLE_BOUNDARY");
  sessionReady = false;
  assert.equal(verification.status().classification, "NOT_READY");
  assert.equal(verification.status().mandatory.adminConsole, "NOT_READY");
});

test("REL001-PHASE6: verification boundary admits status ports only and cannot receive an execution/network port", () => {
  const unexpected = {
    ...healthyInput(),
    providerExecutor: { execute: () => { throw new Error("must never execute"); } },
  };

  assert.throws(
    () => createIntegratedStagingRuntimeVerification(unexpected),
    /STAGING_INTEGRATED_RUNTIME_NOT_READY/,
  );
});

test("REL001-PHASE6: supporting publication failure makes the Console boundary NOT_READY without changing Core hold", () => {
  const consoleStatus = healthyInput().console.status();
  const status = createIntegratedStagingRuntimeVerification({
    ...healthyInput(),
    console: { status: () => ({
      ...consoleStatus,
      components: { ...consoleStatus.components, publication: "NOT_READY" as const },
    }) },
  }).status();

  assert.equal(status.classification, "NOT_READY");
  assert.equal(status.mandatory.adminConsole, "NOT_READY");
  assert.equal(status.holds.coreTransport, "HOLD");
  assert.equal(status.holds.ui006CoreData, "SAFELY_DEFERRED");
});
