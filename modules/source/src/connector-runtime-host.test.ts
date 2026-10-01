import assert from "node:assert/strict";
import test from "node:test";

import { CONNECTOR_API_OPERATIONS } from "./connector-api-contracts.js";
import { ConnectorApplicationHost } from "./connector-application-host.js";
import { ConnectorRuntime, ConnectorRuntimeError } from "./connector-runtime.js";

const result = Object.freeze({ ok: false as const, error: Object.freeze({ code: "NOT_FOUND" as const, message: "Connector resource is unavailable." }) });

test("F18-D Runtime registers exactly eight operations and gates execution until READY", async () => {
  const runtime = new ConnectorRuntime({ execute: () => Promise.resolve(result) });
  assert.deepEqual(runtime.operations, CONNECTOR_API_OPERATIONS);
  await assert.rejects(runtime.execute("QUERY", { operation: "ReadBatchStatus" }), (error) => error instanceof ConnectorRuntimeError && error.code === "RUNTIME_NOT_READY");
  assert.equal(runtime.start().status, "READY");
  assert.deepEqual(await runtime.execute("QUERY", { operation: "ReadBatchStatus" }), result);
  assert.equal(runtime.stop().status, "STOPPED");
});

test("F18-D Host owns one Runtime lifecycle and exposes no alternate execution path", async () => {
  let calls = 0;
  const runtime = new ConnectorRuntime({ execute: () => { calls += 1; return Promise.resolve(result); } });
  const host = new ConnectorApplicationHost(() => runtime);
  await assert.rejects(host.execute("QUERY", {}), { code: "HOST_NOT_READY" });
  assert.equal(host.start().status, "READY");
  assert.deepEqual(await host.execute("QUERY", {}), result);
  assert.equal(calls, 1);
  assert.equal(host.stop().status, "STOPPED");
});

test("F18-D Runtime and Host fail closed when their application dependency is missing", () => {
  assert.throws(() => new ConnectorRuntime(undefined as never), { code: "RUNTIME_DEPENDENCY_MISSING" });
  const host = new ConnectorApplicationHost(() => { throw new Error("missing dependency detail"); });
  assert.throws(() => host.start(), { code: "HOST_STARTUP_FAILED", message: "Connector Host startup failed." });
});
