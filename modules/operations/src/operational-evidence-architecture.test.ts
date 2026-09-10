import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DurableOperationalEvidenceStore } from "./durable-operational-evidence-store.js";
import { SecurityPrivacyOperationalControlService } from "./security-privacy-operational-controls.js";

test("FEAT-023-F operational evidence boundary keeps readiness in the single existing projection store", () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(DurableOperationalEvidenceStore.prototype).sort(),
    ["append", "appendReadinessEvidence", "appendScoped", "close", "constructor", "find", "findStatus", "list", "listAlertsScoped", "listReadinessScoped", "listScoped", "listStatuses", "projectAlerts", "projectReadiness", "projectStatus"],
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

test("FEAT-023-F security privacy control boundary exposes Alert and readiness reads with no domain mutation path", () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(SecurityPrivacyOperationalControlService.prototype).sort(),
    ["constructor", "projectSecurityReadiness", "readAlerts", "readEvidence", "readReadiness"],
  );
  const source = readFileSync(new URL("./security-privacy-operational-controls.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "fetch(", "apps/", "modules/domain", "approve(", "publish(", "recover(", "retry(", "reactivate(", "remediate("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("FEAT-023-F readiness projector imports no authority execution provider network or action path", () => {
  const source = readFileSync(new URL("./operational-readiness-evidence.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "fetch(", "apps/", "modules/domain", "authorize(", "approve(", "publish(", "recover(", "retry(", "restore(", "rollback(", "deploy(", "dispatch("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("FEAT-023-E Alert evaluator imports no domain authority API provider network or action path", () => {
  const source = readFileSync(new URL("./operational-alert-projection.js", import.meta.url), "utf8");
  for (const forbidden of ["node:http", "node:https", "fetch(", "apps/", "modules/domain", "authorize(", "approve(", "publish(", "recover(", "retry(", "reactivate(", "activate(", "remediate(", "dispatch(", "package.json", "pnpm", "npm "]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
