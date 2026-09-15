import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { AuditIntentSourcePort, MaterializationReadySourceDomain } from "../../../modules/audit/src/index.js";
import { createStagingApi016AuditRuntime } from "./api016-production-composition.js";

function source(sourceDomain: MaterializationReadySourceDomain): AuditIntentSourcePort {
  return { sourceDomain, readByIntentId: () => undefined, listEligible: () => ({ intents: [] }) };
}

const sources = ["SOURCE_REGISTRY", "INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING", "API-017"].map((domain) => source(domain as MaterializationReadySourceDomain));

test("Phase 2C Staging composition fails closed without durable database configuration", () => {
  assert.throws(() => createStagingApi016AuditRuntime({ environment: "Staging", databasePath: "", sources }), /AUDIT_RUNTIME_UNAVAILABLE/);
});

test("Phase 3F Staging composition requires each of the seven approved source adapters", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-api016-composition-"));
  try {
    assert.throws(() => createStagingApi016AuditRuntime({ environment: "Staging", databasePath: join(directory, "audit.sqlite"), sources: sources.slice(0, 6) }), /AUDIT_RUNTIME_UNAVAILABLE/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("Phase 2C Staging composition owns durable restart-safe API-016 materialization", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-api016-composition-"));
  const databasePath = join(directory, "audit.sqlite");
  try {
    let runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath, sources });
    assert.deepEqual(runtime.status(), { health: "HEALTHY", readiness: "READY", sourceCount: 7 });
    assert.deepEqual(runtime.materializeAvailable(), []);
    runtime.close();
    runtime = createStagingApi016AuditRuntime({ environment: "Staging", databasePath, sources });
    assert.deepEqual(runtime.status(), { health: "HEALTHY", readiness: "READY", sourceCount: 7 });
    runtime.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("Phase 2C composition is Staging-only and cannot register Client Requirement", () => {
  const directory = mkdtempSync(join(tmpdir(), "rel001-api016-composition-"));
  const databasePath = join(directory, "audit.sqlite");
  try {
    assert.throws(() => createStagingApi016AuditRuntime({ environment: "Production" as never, databasePath, sources }), /AUDIT_RUNTIME_UNAVAILABLE/);
    assert.throws(() => createStagingApi016AuditRuntime({ environment: "Staging", databasePath, sources: [...sources, { ...source("SOURCE_REGISTRY"), sourceDomain: "CLIENT_REQUIREMENT" as never }] }), /AUDIT_RUNTIME_UNAVAILABLE/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
