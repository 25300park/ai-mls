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

test("FEAT-023 Final Gate redacts SQL and SQLite diagnostics by value under generic keys", () => {
  const unsafeDiagnostics = {
    message: "SELECT internal_column FROM operational_telemetry WHERE component = ?",
    selectLiteral: "SELECT 1",
    selectAggregate: "SELECT count(*) FROM operational_evidence",
    selectDistinct: "SELECT DISTINCT internal_column FROM operational_evidence",
    selectQuoted: 'SELECT "internal_column" FROM operational_evidence',
    selectMultiple: "SELECT id, name FROM operational_evidence",
    selectNull: "SELECT NULL",
    selectParameter: "SELECT ?",
    selectAlias: "SELECT id AS alias FROM operational_evidence",
    detail: "INSERT INTO operational_alerts (alert_id) VALUES (?)",
    replacement: "REPLACE INTO operational_alerts (alert_id) VALUES (?)",
    valuesClause: "VALUES (1)",
    reason: "UPDATE operational_status SET readiness = 'READY' WHERE id = ?",
    context: "DELETE FROM operational_evidence WHERE tenant_id = ?",
    error: "CREATE TABLE internal_evidence (secret_column TEXT)",
    description: "ALTER TABLE operational_evidence ADD COLUMN private_value TEXT",
    query: "DROP TABLE operational_evidence",
    engineMessage: "SQLITE_CONSTRAINT: FOREIGN KEY constraint failed",
    lookupFailure: "no such table: operational_telemetry",
    schemaFailure: "no such column: internal_secret",
    parserFailure: "near SELECT: syntax error",
    databaseDiagnostic: "database file runtime-state.sqlite3 is locked",
    tableDiagnostic: "schema main has no table named operational_evidence",
    sqliteLocked: "SQLite database is locked",
    sqliteMalformed: "database disk image is malformed",
    sqliteReadonly: "attempt to write a readonly database",
    sqlitePragma: "PRAGMA table_info(operational_evidence)",
    sqliteLogicError: "SQL logic error",
    sqliteDatatypeMismatch: "datatype mismatch",
    combinedDiagnostic:
      "Error: SQLITE_ERROR: no such table: operational_evidence\n    at query (D:\\service\\storage.ts:42:9)",
    safeOutcome: "UNKNOWN",
  };

  const sanitized = sanitizeSecurityDetails(unsafeDiagnostics);

  for (const key of Object.keys(unsafeDiagnostics).filter(
    (entry) => entry !== "safeOutcome",
  )) {
    assert.equal(sanitized[key], "[REDACTED]", `${key} must be redacted`);
  }
  assert.equal(sanitized["safeOutcome"], "UNKNOWN");
  assert.equal(Object.isFrozen(sanitized), true);
});

test("FEAT-023 Final Gate preserves bounded non-diagnostic operational text", () => {
  const sanitized = sanitizeSecurityDetails({
    selection: "Operator selected an approved source from the visible list",
    updateSummary: "Record update completed successfully",
    tableSummary: "Operational table view is available",
    safeOutcome: "DEGRADED",
  });

  assert.deepEqual(sanitized, {
    selection: "Operator selected an approved source from the visible list",
    updateSummary: "Record update completed successfully",
    tableSummary: "Operational table view is available",
    safeOutcome: "DEGRADED",
  });
});

test("FEAT-023 Final Gate evaluates long SQL-like non-diagnostics without quadratic scanning", () => {
  const longSafeValue = "select x ".repeat(32_000);
  const startedAt = performance.now();

  const sanitized = sanitizeSecurityDetails({ message: longSafeValue });

  const elapsedMilliseconds = performance.now() - startedAt;
  assert.equal(sanitized["message"], "[REDACTED]");
  assert.ok(
    elapsedMilliseconds < 500,
    `sanitization took ${elapsedMilliseconds.toFixed(1)}ms`,
  );
});

test("FEAT-023 Final Gate evaluates long diagnostic-prefix input in linear time", () => {
  for (const longSafeValue of [
    "near x ".repeat(8_000),
    "constraint x ".repeat(8_000),
  ]) {
    const startedAt = performance.now();

    const sanitized = sanitizeSecurityDetails({ message: longSafeValue });

    const elapsedMilliseconds = performance.now() - startedAt;
    assert.equal(sanitized["message"], longSafeValue);
    assert.ok(
      elapsedMilliseconds < 200,
      `sanitization took ${elapsedMilliseconds.toFixed(1)}ms`,
    );
  }
});
