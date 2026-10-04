import assert from "node:assert/strict";
import test from "node:test";
import { ProductionRuntimeObservability, safeStartupFailureCode } from "./production-runtime-observability.js";

function ready(observation: ProductionRuntimeObservability): void {
  observation.poolOpened(); observation.identityReadVerified();
  observation.advance("PRE_LISTENER_VALIDATING");
  observation.gate("serviceWorkloadGate", "READY"); observation.gate("humanIdentityGate", "READY");
  observation.gate("requiredSecretsGate", "READY_EMPTY_MANIFEST"); observation.advance("PRE_LISTENER_READY");
  observation.workerManifestReady(); observation.poolReady();
  observation.advance("ACTIVATING_LISTENER"); observation.advance("ACTIVATING_WORKERS"); observation.advance("RUNTIME_READY");
}

test("immutable bounded evidence separates liveness and readiness and preserves prior snapshots", () => {
  const logs: unknown[] = [];
  const observation = new ProductionRuntimeObservability({ sink: (snapshot) => { logs.push(snapshot); } });
  const before = observation.snapshot();
  assert.equal(before.liveness, "LIVE"); assert.equal(before.readiness, "NOT_READY");
  assert.equal(before.startupPhase, "BOOTSTRAPPING"); assert.equal(Object.isFrozen(before), true);
  ready(observation);
  const after = observation.snapshot();
  assert.equal(after.readiness, "READY"); assert.equal(after.physicalPoolCount, 1);
  assert.equal(after.requiredWorkerCount, 0); assert.equal(after.workerState, "READY_EMPTY_MANIFEST");
  assert.equal(after.listenerState, "STARTED"); assert.equal(after.preListenerChain, "READY");
  assert.equal(after.databaseConnectivity, "READ_PATH_VERIFIED"); assert.equal(after.poolReadiness, "READY");
  assert.equal(before.startupPhase, "BOOTSTRAPPING"); assert.equal(before.readiness, "NOT_READY");
  assert.ok(logs.length > 0); assert.match(after.runtimeAttemptId, /^[0-9a-f-]{36}$/u);
});

test("ordered phases reject regression, reentry and premature readiness without changing state", () => {
  const observation = new ProductionRuntimeObservability();
  assert.throws(() => observation.advance("RUNTIME_READY"));
  assert.equal(observation.snapshot().startupPhase, "BOOTSTRAPPING");
  ready(observation);
  assert.throws(() => observation.advance("RUNTIME_READY"));
  assert.throws(() => observation.advance("BOOTSTRAPPING"));
  assert.equal(observation.snapshot().readiness, "READY");
});

test("pre-listener readiness and a started listener cannot independently publish runtime readiness", () => {
  const observation = new ProductionRuntimeObservability();
  observation.poolOpened(); observation.identityReadVerified(); observation.advance("PRE_LISTENER_VALIDATING");
  observation.gate("serviceWorkloadGate", "READY"); observation.gate("humanIdentityGate", "READY");
  observation.gate("requiredSecretsGate", "READY_EMPTY_MANIFEST"); observation.advance("PRE_LISTENER_READY");
  assert.equal(observation.snapshot().readiness, "NOT_READY");
  observation.workerManifestReady(); observation.poolReady(); observation.advance("ACTIVATING_LISTENER");
  assert.equal(observation.snapshot().readiness, "NOT_READY");
  observation.advance("ACTIVATING_WORKERS");
  assert.equal(observation.snapshot().listenerState, "STARTED"); assert.equal(observation.snapshot().readiness, "NOT_READY");
  observation.advance("RUNTIME_READY"); assert.equal(observation.snapshot().readiness, "READY");
});

test("raw error property traps and unknown classification values never enter snapshot or logs", () => {
  const proxy = new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error("private descriptor"); } });
  assert.equal(safeStartupFailureCode(proxy, "HUMAN_IDENTITY_GATE_FAILED"), "HUMAN_IDENTITY_GATE_FAILED");
  assert.equal(safeStartupFailureCode({ stage: "IDENTITY_EVIDENCE", cause: { token: "private fixture" } }), "IDENTITY_EVIDENCE");
  const logs: unknown[] = [];
  const observation = new ProductionRuntimeObservability({ sink: (value) => { logs.push(value); } });
  observation.failed(safeStartupFailureCode({ reason: "password=private", stack: "private stack" }));
  assert.equal(JSON.stringify(logs).includes("private"), false);
  assert.equal(Object.keys(observation.snapshot()).includes("cause"), false);
  assert.equal(Object.keys(observation.snapshot()).includes("stack"), false);
});

test("a shutdown signal during startup immediately masks readiness without regressing phase order", () => {
  const observation = new ProductionRuntimeObservability();
  observation.shutdownRequested(); ready(observation);
  assert.equal(observation.snapshot().startupPhase, "RUNTIME_READY");
  assert.equal(observation.snapshot().readiness, "NOT_READY");
  assert.equal(observation.snapshot().shutdownRequested, true);
});

test("gate failure stays live but not ready, records safe gate reason and preserves terminal failure during cleanup", () => {
  const observation = new ProductionRuntimeObservability();
  observation.advance("PRE_LISTENER_VALIDATING");
  observation.gate("serviceWorkloadGate", "FAILED", "IDENTITY_EVIDENCE");
  observation.failed("PRE_LISTENER_NOT_READY"); observation.poolClosed();
  const snapshot = observation.snapshot();
  assert.equal(snapshot.startupPhase, "STARTUP_FAILED"); assert.equal(snapshot.liveness, "LIVE");
  assert.equal(snapshot.failureCode, "PRE_LISTENER_NOT_READY"); assert.equal(snapshot.gateFailureCode, "IDENTITY_EVIDENCE");
  assert.equal(snapshot.listenerState, "NOT_STARTED"); assert.equal(snapshot.readiness, "NOT_READY");
  assert.throws(() => observation.advance("RUNTIME_READY"));
});

test("shutdown and failed shutdown have explicit terminal states without making a new startup attempt", () => {
  for (const failed of [false, true]) {
    const observation = new ProductionRuntimeObservability(); ready(observation);
    const id = observation.snapshot().runtimeAttemptId;
    observation.advance("SHUTTING_DOWN");
    assert.equal(observation.snapshot().readiness, "NOT_READY");
    assert.equal(observation.snapshot().listenerState, "STOPPING");
    observation.poolClosed();
    observation.shutdownFinished(failed);
    assert.equal(observation.snapshot().startupPhase, failed ? "SHUTDOWN_FAILED" : "STOPPED");
    assert.equal(observation.snapshot().runtimeAttemptId, id); assert.ok(observation.snapshot().completedAt);
    if (failed) assert.equal(observation.snapshot().failureCode, "SHUTDOWN_FAILED");
  }
});

test("failure and logging allowlists reject raw cause payloads and sink failures cannot alter runtime semantics", () => {
  const observation = new ProductionRuntimeObservability({ sink: () => { throw new Error("private sink failure"); } });
  assert.equal(safeStartupFailureCode({ reason: "LISTENER_START_FAILED", message: "private material", cause: { password: "private fixture" } }), "LISTENER_START_FAILED");
  assert.equal(safeStartupFailureCode({ get reason(): never { throw new Error("private getter"); } }), "PRODUCTION_STARTUP_UNAVAILABLE");
  assert.equal(safeStartupFailureCode({ reason: "password=private" }), "PRODUCTION_STARTUP_UNAVAILABLE");
  assert.throws(() => observation.failed("password=private" as never));
  ready(observation);
  assert.equal(JSON.stringify(observation.snapshot()).includes("private"), false);
  assert.equal(observation.snapshot().readiness, "READY");
});
