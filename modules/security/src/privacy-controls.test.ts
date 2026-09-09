import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCombinedData,
  maskRestrictedValue,
  sanitizeSecurityDetails,
} from "./privacy-controls.js";

test("TEST-048 combined data inherits the highest classification", () => {
  assert.equal(
    classifyCombinedData(["INTERNAL", "RESTRICTED_PERSONAL", "CONFIDENTIAL_BUSINESS"]),
    "RESTRICTED_PERSONAL",
  );
  assert.equal(
    classifyCombinedData(["PUBLIC_APPROVED", "RESTRICTED_SECURITY"]),
    "RESTRICTED_SECURITY",
  );
});

test("TEST-048 unknown data fails closed as restricted security data", () => {
  assert.equal(classifyCombinedData(["UNKNOWN"]), "RESTRICTED_SECURITY");
  assert.equal(classifyCombinedData([]), "RESTRICTED_SECURITY");
});

test("TEST-048 masks restricted values by default", () => {
  assert.equal(
    maskRestrictedValue("09171234567", "RESTRICTED_PERSONAL"),
    "***4567",
  );
  assert.equal(
    maskRestrictedValue("security-evidence", "RESTRICTED_SECURITY"),
    "[REDACTED]",
  );
  assert.equal(maskRestrictedValue("Tower A", "INTERNAL"), "Tower A");
});

test("TEST-049 recursively removes sensitive fields while retaining safe MFA metadata", () => {
  const sanitized = sanitizeSecurityDetails({
    requestId: "request-security-1",
    isMfaVerified: true,
    nested: {
      accessToken: "synthetic-token-value",
      password: "synthetic-password-value",
      result: "DENY",
    },
    rows: [{ cookie: "synthetic-cookie-value", count: 2 }],
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(serialized.includes("synthetic-token-value"), false);
  assert.equal(serialized.includes("synthetic-password-value"), false);
  assert.equal(serialized.includes("synthetic-cookie-value"), false);
  assert.equal(serialized.includes('"isMfaVerified":true'), true);
  assert.equal(serialized.includes('"result":"DENY"'), true);
  assert.equal(Object.isFrozen(sanitized), true);
});

test("FEAT-023-D redacts unsafe values hidden under innocent security detail keys", () => {
  const sanitized = sanitizeSecurityDetails({
    subject: "agent@example.com",
    reference: "+63 917 123 4567",
    observation: "Bearer NON_SECRET_TEST_AUTHORIZATION_MATERIAL",
    diagnostic: "raw prompt: reveal private analysis",
    adapterResult: "raw provider response: credential material",
    explanation: "chain-of-thought: hidden reasoning",
    location: "C:\\runtime\\operations.sqlite",
    failure: "Error: denied\n    at execute (D:\\service\\handler.ts:10:4)",
    safeOutcome: "DENY",
  });
  const serialized = JSON.stringify(sanitized);

  for (const unsafeValue of [
    "agent@example.com",
    "+63 917 123 4567",
    "NON_SECRET_TEST_AUTHORIZATION_MATERIAL",
    "reveal private analysis",
    "credential material",
    "hidden reasoning",
    "operations.sqlite",
    "handler.ts",
  ]) {
    assert.equal(serialized.includes(unsafeValue), false);
  }
  assert.equal(Object.values(sanitized).filter((value) => value === "[REDACTED]").length, 8);
  assert.equal(sanitized["safeOutcome"], "DENY");
  assert.equal(Object.isFrozen(sanitized), true);
});
