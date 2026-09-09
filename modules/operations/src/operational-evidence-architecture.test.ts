import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DurableOperationalEvidenceStore } from "./durable-operational-evidence-store.js";
import { SecurityPrivacyOperationalControlService } from "./security-privacy-operational-controls.js";

test("FEAT-023-C operational evidence boundary exposes one telemetry and status projection store only", () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(DurableOperationalEvidenceStore.prototype).sort(),
    ["append", "appendScoped", "close", "constructor", "find", "findStatus", "list", "listScoped", "listStatuses", "projectStatus"],
  );
});

test("FEAT-023-B operational evidence boundary imports no domain authority, API, provider, or network path", () => {
  const source = readFileSync(new URL("./durable-operational-evidence-store.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "apps/", "modules/domain", "fetch(", "provider", "connectorDispatcher", "approve(", "publish(", "recover(", "retry("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("FEAT-023-C status projection cannot trigger actions or create business authority", () => {
  const source = readFileSync(new URL("./operational-status-projection.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "fetch(", "authorize(", "approve(", "publish(", "recover(", "retry(", "reactivate(", "dispatch("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("FEAT-023-D security privacy control boundary exposes read and projection only with no domain mutation path", () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(SecurityPrivacyOperationalControlService.prototype).sort(),
    ["constructor", "projectSecurityReadiness", "readEvidence"],
  );
  const source = readFileSync(new URL("./security-privacy-operational-controls.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "fetch(", "apps/", "modules/domain", "approve(", "publish(", "recover(", "retry(", "reactivate(", "remediate("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
