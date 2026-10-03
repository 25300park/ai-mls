import assert from "node:assert/strict";
import test from "node:test";
import { ProductionRuntimeActivation, validateRequiredWorkersManifest, CURRENT_PRODUCTION_REQUIRED_WORKERS_MANIFEST } from "./production-runtime-activation.js";

test("only an explicit current empty worker manifest is eligible", () => {
  assert.equal(validateRequiredWorkersManifest(CURRENT_PRODUCTION_REQUIRED_WORKERS_MANIFEST).status, "READY_EMPTY_MANIFEST");
  for (const value of [undefined, null, {}, { schemaVersion: 2, workers: [] }, { schemaVersion: 1 },
    { schemaVersion: 1, workers: ["API-017"] }, { schemaVersion: 1, workers: [], discover: true }]) {
    assert.throws(() => validateRequiredWorkersManifest(value), { reason: "WORKER_MANIFEST_INVALID" });
  }
});

function fixture(failWorker?: number, failStop?: boolean) {
  const events: string[] = [];
  const activation = new ProductionRuntimeActivation();
  const listener = {
    stopAccepting: () => { events.push("ingress-stop"); },
    close: () => { events.push("listener-close"); },
  };
  const workers = [1, 2, 3].map((id) => () => Promise.resolve().then(() => {
    events.push(`worker-${id}-start`);
    if (id === failWorker) throw new Error("private credential must not escape");
    return { close: () => { events.push(`worker-${id}-stop`); if (failStop && id === 3) throw new Error("private stop"); } };
  }));
  return { activation, events, listener, workers };
}

test("explicit empty activation performs zero worker start calls and repeated shutdown is shared", async () => {
  const f = fixture();
  await f.activation.start(() => { f.events.push("listener-start"); return Promise.resolve(f.listener); }, []);
  assert.equal(f.activation.readiness(), "READY");
  await Promise.all([f.activation.close(), f.activation.close()]);
  assert.equal(f.activation.readiness(), "NOT_READY");
  assert.deepEqual(f.events, ["listener-start", "ingress-stop", "listener-close"]);
});

test("worker failure rolls back completed workers in reverse order before listener", async () => {
  const f = fixture(3);
  await assert.rejects(() => f.activation.start(() => Promise.resolve(f.listener), f.workers), { reason: "WORKER_START_FAILED" });
  assert.equal(f.activation.readiness(), "NOT_READY");
  assert.deepEqual(f.events, ["worker-1-start", "worker-2-start", "worker-3-start", "worker-2-stop", "worker-1-stop", "listener-close"]);
  await f.activation.close();
  assert.equal(f.events.filter((event) => event === "listener-close").length, 1);
});

test("listener failure short circuits all workers and redacts failure", async () => {
  const f = fixture();
  await assert.rejects(() => f.activation.start(() => Promise.reject(new Error("private value")), f.workers), (error: unknown) => {
    assert.equal(Reflect.get(error as object, "reason"), "LISTENER_START_FAILED");
    assert.equal(String(error).includes("private"), false); return true;
  });
  assert.deepEqual(f.events, []);
});

test("concurrent and completed duplicate activation fail before creating any duplicate handle", async () => {
  const f = fixture();
  let complete!: () => void;
  const waiting = new Promise<void>((resolve) => { complete = resolve; });
  const first = f.activation.start(async () => { f.events.push("listener-start"); await waiting; return f.listener; }, []);
  await assert.rejects(() => f.activation.start(() => Promise.resolve(f.listener), []), { reason: "DUPLICATE_ACTIVATION" });
  complete(); await first;
  await assert.rejects(() => f.activation.start(() => Promise.resolve(f.listener), []), { reason: "DUPLICATE_ACTIVATION" });
  await f.activation.close();
  assert.deepEqual(f.events, ["listener-start", "ingress-stop", "listener-close"]);
});

test("graceful shutdown rejects ingress first, reverses workers, then closes listener despite stop failures", async () => {
  const f = fixture(undefined, true);
  await f.activation.start(() => Promise.resolve(f.listener), f.workers);
  await assert.rejects(() => f.activation.close(), { reason: "SHUTDOWN_FAILED" });
  assert.deepEqual(f.events.slice(-5), ["ingress-stop", "worker-3-stop", "worker-2-stop", "worker-1-stop", "listener-close"]);
  await assert.rejects(() => f.activation.close(), { reason: "SHUTDOWN_FAILED" });
  assert.equal(f.events.filter((event) => event === "listener-close").length, 1);
});

test("a hung child stop is bounded and later owned handles are still cleaned", async () => {
  const activation = new ProductionRuntimeActivation(5);
  const events: string[] = [];
  await activation.start(() => Promise.resolve({ stopAccepting: () => undefined, close: () => { events.push("listener-close"); } }), [
    () => Promise.resolve({ close: () => { events.push("first-stop"); } }),
    () => Promise.resolve({ close: () => new Promise<void>(() => undefined) }),
  ]);
  await assert.rejects(() => activation.close(), { reason: "SHUTDOWN_FAILED" });
  assert.deepEqual(events, ["first-stop", "listener-close"]);
});

test("shutdown requested while activation is pending never publishes READY", async () => {
  const f = fixture();
  let complete!: () => void;
  const waiting = new Promise<void>((resolve) => { complete = resolve; });
  const starting = f.activation.start(async () => { await waiting; return f.listener; }, []);
  const closing = f.activation.close();
  complete(); await starting; await closing;
  assert.equal(f.activation.readiness(), "NOT_READY");
  assert.deepEqual(f.events, ["ingress-stop", "listener-close"]);
});

test("rollback cleanup failure is classified only after every remaining worker and listener stop is attempted", async () => {
  const f = fixture(3);
  f.workers[1] = () => Promise.resolve({ close: () => { f.events.push("worker-2-stop"); throw new Error("private cleanup detail"); } });
  await assert.rejects(() => f.activation.start(() => Promise.resolve(f.listener), f.workers), { reason: "ACTIVATION_CLEANUP_FAILED" });
  assert.deepEqual(f.events.slice(-3), ["worker-2-stop", "worker-1-stop", "listener-close"]);
});
