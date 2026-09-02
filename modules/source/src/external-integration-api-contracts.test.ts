import assert from "node:assert/strict";
import test from "node:test";
import { EXTERNAL_INTEGRATION_COMMAND_OPERATIONS, EXTERNAL_INTEGRATION_HTTP_OPERATIONS, EXTERNAL_INTEGRATION_OPERATIONS, EXTERNAL_INTEGRATION_QUERY_OPERATIONS, parseExternalIntegrationRequest } from "./external-integration-api-contracts.js";

const register = { operation: "RegisterExternalMapping", integrationContractId: "contract-1", providerNamespace: "provider-1", externalObjectId: "external-1", internalResourceType: "SOURCE", internalResourceId: "source-1", idempotencyKey: "idem-1", evidenceRef: "evidence:mapping:1" };
const observation = { operation: "SubmitProviderObservation", integrationContractId: "contract-1", observationId: "observation-1", providerNamespace: "provider-1", externalObjectId: "external-1", connectorId: "connector-1", sourceId: "source-1", observationType: "STATUS", normalizedFields: { active: true, count: 1, note: "safe", empty: null }, observedAt: "2026-09-02T00:00:00.000Z", idempotencyKey: "idem-2", expectedMappingVersion: 1 };

test("F18-E freezes exactly six operations with only two HTTP queries", () => {
  assert.deepEqual(EXTERNAL_INTEGRATION_COMMAND_OPERATIONS, ["RegisterExternalMapping", "SubmitProviderObservation", "ReconcileIntegrationEvidence", "SuspendIntegrationContract"]);
  assert.deepEqual(EXTERNAL_INTEGRATION_QUERY_OPERATIONS, ["ReadExternalMapping", "ReadIntegrationContract"]);
  assert.deepEqual(EXTERNAL_INTEGRATION_HTTP_OPERATIONS, ["ReadExternalMapping", "ReadIntegrationContract"]);
  assert.equal(EXTERNAL_INTEGRATION_OPERATIONS.length, 6);
});

test("F18-E parses the six closed requests and deeply freezes normalized evidence", () => {
  const values = [
    ["COMMAND", register], ["COMMAND", observation],
    ["COMMAND", { operation: "ReconcileIntegrationEvidence", integrationContractId: "contract-1", mappingId: "mapping-1", expectedVersion: 1, proofType: "SAME_EXTERNAL_IDENTITY", evidenceRefs: ["evidence:mapping:1"], observationIds: ["observation-1"], idempotencyKey: "idem-3" }],
    ["COMMAND", { operation: "SuspendIntegrationContract", integrationContractId: "contract-1", expectedVersion: 1, reasonCode: "TECHNICAL_SUSPENSION", evidenceRef: "evidence:contract:1", idempotencyKey: "idem-4" }],
    ["QUERY", { operation: "ReadExternalMapping", mappingId: "mapping-1" }],
    ["QUERY", { operation: "ReadIntegrationContract", integrationContractId: "contract-1" }],
  ] as const;
  for (const [kind, input] of values) assert.equal(Object.isFrozen(parseExternalIntegrationRequest(kind, input)), true);
  assert.equal(Object.isFrozen(parseExternalIntegrationRequest("COMMAND", observation)["normalizedFields"]), true);
});

test("F18-E rejects internal commands over HTTP, missing contract bindings, and caller authority", () => {
  assert.throws(() => parseExternalIntegrationRequest("HTTP_COMMAND", register), { code: "VALIDATION_FAILED" });
  const withoutContract = { operation: "RegisterExternalMapping", providerNamespace: "provider-1", externalObjectId: "external-1", internalResourceType: "SOURCE", internalResourceId: "source-1", idempotencyKey: "idem-1", evidenceRef: "evidence:mapping:1" };
  assert.throws(() => parseExternalIntegrationRequest("COMMAND", withoutContract), { code: "VALIDATION_FAILED" });
  for (const field of ["tenantId", "scope", "actorId", "purpose", "targetMappingState", "businessVerdict", "providerPayload", "token"]) assert.throws(() => parseExternalIntegrationRequest("COMMAND", { ...register, [field]: "forged" }), { code: "VALIDATION_FAILED" });
});

test("F18-E enforces canonical mapping lookup and reconciliation proof vocabulary", () => {
  assert.doesNotThrow(() => parseExternalIntegrationRequest("HTTP_QUERY", { operation: "ReadExternalMapping", providerNamespace: "provider-1", externalObjectId: "external-1" }));
  assert.throws(() => parseExternalIntegrationRequest("QUERY", { operation: "ReadExternalMapping" }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseExternalIntegrationRequest("COMMAND", { operation: "ReconcileIntegrationEvidence", integrationContractId: "contract-1", mappingId: "mapping-1", expectedVersion: 1, proofType: "BUSINESS_CORRECT", evidenceRefs: ["evidence:1"], idempotencyKey: "idem-3" }), { code: "VALIDATION_FAILED" });
});

test("F18-E rejects nested, unsafe, oversized, and excessive normalized evidence", () => {
  for (const normalizedFields of [{ nested: { raw: true } }, { token: "Bearer unsafe-value" }, Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`field${i}`, i])), { ["x".repeat(65)]: true }, { value: "x".repeat(2049) }, { value: "x".repeat(16_384) }]) {
    assert.throws(() => parseExternalIntegrationRequest("COMMAND", { ...observation, normalizedFields }), { code: "VALIDATION_FAILED" });
  }
});

test("F18-E bounds reconciliation evidence and observation identifiers", () => {
  const base = { operation: "ReconcileIntegrationEvidence", integrationContractId: "contract-1", mappingId: "mapping-1", expectedVersion: 1, proofType: "SAME_INTERNAL_BINDING", idempotencyKey: "idem-3" };
  assert.throws(() => parseExternalIntegrationRequest("COMMAND", { ...base, evidenceRefs: [] }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseExternalIntegrationRequest("COMMAND", { ...base, evidenceRefs: Array.from({ length: 17 }, (_, i) => `evidence:${i}`) }), { code: "VALIDATION_FAILED" });
  assert.throws(() => parseExternalIntegrationRequest("COMMAND", { ...base, evidenceRefs: ["evidence:1"], observationIds: Array.from({ length: 17 }, (_, i) => `observation:${i}`) }), { code: "VALIDATION_FAILED" });
});
