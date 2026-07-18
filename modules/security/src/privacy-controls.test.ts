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
