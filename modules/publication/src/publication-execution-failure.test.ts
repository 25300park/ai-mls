import assert from "node:assert/strict";
import test from "node:test";
import * as publication from "./index.js";

type FailureInput = Readonly<{ code?: string; outcome?: "CONFIRMED" | "REJECTED" | "UNKNOWN"; dispatchStarted?: boolean; authoritativeReceipt?: boolean }>;
function classify(input: FailureInput): unknown {
  const classifier = (publication as unknown as Record<string, unknown>)["classifyPublicationExecutionFailure"];
  assert.equal(typeof classifier, "function", "F17-F normalized failure boundary must exist");
  return (classifier as (value: FailureInput) => unknown)(input);
}

test("F17-F classifies exact safe failure codes without granting retry permission", () => {
  for (const [code, expected] of [
    ["PUBLICATION_INPUT_INVALID", "VALIDATION_FAILURE"],
    ["AUTHENTICATION_REQUIRED", "AUTHORIZATION_FAILURE"],
    ["SEPARATION_OF_DUTIES_DENIED", "AUTHORIZATION_FAILURE"],
    ["APPROVAL_NOT_EFFECTIVE", "APPROVAL_STALE_OR_INVALID"],
    ["PUBLICATION_TARGET_INACTIVE", "TARGET_UNAVAILABLE"],
    ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"],
    ["CONNECTOR_REJECTED", "PROVIDER_REJECTED"],
    ["ETIMEDOUT", "PROVIDER_TIMEOUT"],
    ["ECONNRESET", "PROVIDER_CONNECTION_FAILURE"],
    ["CONNECTOR_RESULT_INVALID", "PROVIDER_MALFORMED_RESPONSE"],
    ["CONNECTOR_UNAVAILABLE", "PROVIDER_UNAVAILABLE"],
    ["PERSISTENCE_WRITE_FAILED", "INTERNAL_PERSISTENCE_FAILURE"],
  ] as const) assert.equal(classify({ code }), expected, code);
});

test("F17-F ambiguous durable effect takes precedence over transient code or caller success claim", () => {
  assert.equal(classify({ code: "ETIMEDOUT", outcome: "UNKNOWN" }), "AMBIGUOUS_EXTERNAL_OUTCOME");
  assert.equal(classify({ code: "ECONNRESET", dispatchStarted: true, authoritativeReceipt: false }), "AMBIGUOUS_EXTERNAL_OUTCOME");
  assert.equal(classify({ outcome: "CONFIRMED", dispatchStarted: true, authoritativeReceipt: false }), "AMBIGUOUS_EXTERNAL_OUTCOME");
  assert.equal(classify({ outcome: "REJECTED", authoritativeReceipt: true }), "PROVIDER_REJECTED");
  assert.equal(classify({ outcome: "CONFIRMED", authoritativeReceipt: true }), undefined);
});

test("F17-F unknown unsafe errors fail closed without reflecting arbitrary error text", () => {
  assert.equal(classify({ code: "Bearer explicit-non-secret-test-value C:\\private\\path" }), "AMBIGUOUS_EXTERNAL_OUTCOME");
  assert.equal(classify({ code: "FAKE_TIMEOUT_AUTHORIZATION_ALLOWED" }), "AMBIGUOUS_EXTERNAL_OUTCOME");
});
