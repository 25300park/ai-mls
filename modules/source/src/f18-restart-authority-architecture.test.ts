import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurableExternalIntegrationStore } from "./external-integration-durable-persistence.js";

const connectorCompositionPath = "apps/api/src/connector-production-composition.ts";
const externalCompositionPath = "apps/api/src/external-integration-production-composition.ts";

test("F18-F production connector and integration authority is durable rather than process-local", () => {
  const connectorComposition = readFileSync(connectorCompositionPath, "utf8");
  const externalComposition = readFileSync(externalCompositionPath, "utf8");
  assert.match(connectorComposition, /DurableConnectorExecutionUnitOfWork/u);
  assert.match(externalComposition, /DurableExternalIntegrationStore/u);
  assert.doesNotMatch(connectorComposition, /new (?:Map|Set)\s*</u);
  assert.doesNotMatch(externalComposition, /new (?:Map|Set)\s*</u);
  assert.doesNotMatch(connectorComposition, /InMemory|fallback/iu);
  assert.doesNotMatch(externalComposition, /InMemory|fallback/iu);
});

test("F18-F reopened external-integration DTOs expose only bounded canonical evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "f18-f-safe-reload-"));
  const databasePath = join(directory, "external.sqlite");
  const scope = Object.freeze({ tenantId: "tenant-1", scopeType: "SOURCE" as const, scopeId: "source-1", connectorId: "connector-1", sourceId: "source-1" });
  try {
    let store = new DurableExternalIntegrationStore({ databasePath });
    store.provisionContract({ ...scope, integrationContractId: "contract-1", providerNamespace: "provider-1", governedBindingRef: "governance:binding:1", evidenceRef: "evidence:contract:1", provisionedAt: "2026-09-02T00:00:00.000Z" });
    store.registerMapping({ ...scope, integrationContractId: "contract-1", providerNamespace: "provider-1", externalObjectId: "external-1", internalResourceType: "SOURCE", internalResourceId: "source-1", expectedVersion: 0, idempotencyKey: "idem-map-1", inputFingerprint: "fp-map-1", evidenceRef: "evidence:mapping:1", recordedAt: "2026-09-02T00:01:00.000Z" });
    store.close();
    store = new DurableExternalIntegrationStore({ databasePath });
    const serialized = JSON.stringify({ contract: store.readContract(scope, "contract-1"), mapping: store.readMappingByExternal(scope, "provider-1", "external-1"), evidence: store.listEvidence(scope, "contract-1") }).toLowerCase();
    for (const forbidden of ["bearer ", "authorization", "cookie", "token", "secret", ".sqlite", "node:sqlite", "stack"]) assert.equal(serialized.includes(forbidden), false, forbidden);
    store.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
