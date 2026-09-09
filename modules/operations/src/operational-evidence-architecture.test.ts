import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DurableOperationalEvidenceStore } from "./durable-operational-evidence-store.js";

test("FEAT-023-B operational evidence boundary exposes telemetry persistence only", () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(DurableOperationalEvidenceStore.prototype).sort(),
    ["append", "close", "constructor", "find", "list"],
  );
});

test("FEAT-023-B operational evidence boundary imports no domain authority, API, provider, or network path", () => {
  const source = readFileSync(new URL("./durable-operational-evidence-store.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "apps/", "modules/domain", "fetch(", "provider", "connectorDispatcher", "approve(", "publish(", "recover(", "retry("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
