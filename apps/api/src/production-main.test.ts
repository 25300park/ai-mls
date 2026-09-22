import assert from "node:assert/strict";
import test from "node:test";

import type { ProductionBootstrapDependencies, ProductionRuntimeHandle } from "./production-bootstrap.js";
import { createProductionReadinessState } from "./production-readiness-http.js";
import { runProductionMain, type ProductionSignal } from "./production-main.js";

test("invokes canonical start exactly once and marks readiness only after startup returns", async () => {
  const readiness = createProductionReadinessState();
  const events: string[] = [];
  const runtime: ProductionRuntimeHandle = Object.freeze({
    validationFingerprint: "sha256:test",
    readiness: () => "READY" as const,
    close: () => { events.push("close"); return Promise.resolve(); },
  });
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness,
    startRuntime: () => { events.push(`start:${readiness.readiness()}`); return Promise.resolve(runtime); },
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
  });
  assert.deepEqual(events, ["start:NOT_READY"]);
  assert.equal(readiness.readiness(), "READY");
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.deepEqual(events, ["start:NOT_READY", "close", "uninstall"]);
});

test("SIGINT and SIGTERM share one deterministic idempotent shutdown", async () => {
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness: createProductionReadinessState(),
    startRuntime: () => Promise.resolve(Object.freeze({
      validationFingerprint: "sha256:test", readiness: () => "READY" as const,
      close: () => { events.push("close"); return Promise.resolve(); },
    })),
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
  });
  signalHandler?.("SIGINT");
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.deepEqual(events, ["close", "uninstall"]);
});

test("a signal received during startup prevents READY and closes immediately after startup returns", async () => {
  const readiness = createProductionReadinessState();
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness,
    installSignalHandler: (handler) => { signalHandler = handler; events.push("installed"); return () => events.push("uninstall"); },
    startRuntime: () => {
      events.push("start");
      signalHandler?.("SIGTERM");
      return Promise.resolve(Object.freeze({
        validationFingerprint: "sha256:test", readiness: () => "READY" as const,
        close: () => { events.push("close"); return Promise.resolve(); },
      }));
    },
  });
  await running.shutdownComplete;
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.deepEqual(events, ["installed", "start", "close", "uninstall"]);
});

test("shutdown failure remains NOT_READY and reaches the terminal failure handler", async () => {
  const readiness = createProductionReadinessState();
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness,
    startRuntime: () => Promise.resolve(Object.freeze({
      validationFingerprint: "sha256:test", readiness: () => "READY" as const,
      close: () => Promise.reject(new Error("unsafe internal detail")),
    })),
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
    handleShutdownFailure: () => events.push("terminal-failure"),
    terminateProcess: (code) => events.push(`terminate:${String(code)}`),
  });
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.equal(readiness.readiness(), "NOT_READY");
  assert.deepEqual(events, ["uninstall", "terminal-failure", "terminate:1"]);
});

test("a bounded close timeout invokes the hard non-zero terminal action", async () => {
  const events: string[] = [];
  let signalHandler: ((signal: ProductionSignal) => void) | undefined;
  const running = await runProductionMain({}, {} as ProductionBootstrapDependencies, {
    readiness: createProductionReadinessState(),
    startRuntime: () => Promise.resolve(Object.freeze({
      validationFingerprint: "sha256:test", readiness: () => "READY" as const,
      close: () => new Promise<void>(() => undefined),
    })),
    installSignalHandler: (handler) => { signalHandler = handler; return () => events.push("uninstall"); },
    shutdownTimeoutMilliseconds: 1,
    handleShutdownFailure: () => events.push("terminal-failure"),
    terminateProcess: (code) => events.push(`terminate:${String(code)}`),
  });
  signalHandler?.("SIGTERM");
  await running.shutdownComplete;
  assert.deepEqual(events, ["uninstall", "terminal-failure", "terminate:1"]);
});
