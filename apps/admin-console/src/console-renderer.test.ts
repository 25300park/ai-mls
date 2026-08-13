import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSOLE_BROWSER_CLIENT,
  CONSOLE_STYLES,
  renderConsoleResult,
  renderConsoleShell,
} from "./console-renderer.js";
import type { ConsoleReadResult } from "./console-read-adapter.js";

test("POST-F15-CONSOLE shell renders the approved accessible navigation and loading state", () => {
  const html = renderConsoleShell("DASHBOARD", "publication-console-1");

  for (const label of [
    "AI-MLS ADMIN", "Dashboard", "Operations", "Revalidation", "Recovery",
    "Audit / History", "Projection", "Operations / Health", "Loading...",
  ]) assert.equal(html.includes(label), true, label);
  for (const path of [
    "/", "/publication/operations", "/publication/revalidation", "/publication/recovery",
    "/publication/audit", "/system/projection", "/system/operations",
  ]) assert.equal(html.includes(`href=\"${path}`), true, path);
  assert.equal(html.includes("<nav"), true);
  assert.equal(html.includes("<main"), true);
  assert.equal(html.includes("aria-live=\"polite\""), true);
  assert.equal(CONSOLE_STYLES.includes(":focus-visible"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("fetch("), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("method: \"POST\""), false);
});

test("POST-F15-CONSOLE UI-031 renders bounded fields and diagnostic actions as non-executable", () => {
  const html = renderConsoleResult(ready("UI-031", {
    screenId: "UI-031",
    publicationId: "publication-console-1",
    lifecycle: "READY",
    suspensionStatus: "NOT_SUSPENDED",
    aggregateVersion: 1,
    effectiveVersion: 1,
    target: { id: "target-1", version: 2 },
    channel: { id: "channel-1", policyVersion: "channel-v1" },
    currentOperationState: "READY",
    stale: false,
    availableActions: ["PUBLISH_PUBLICATION", "TERMINATE_PUBLICATION"],
  }));

  assert.equal(html.includes("Publication Operations"), true);
  assert.equal(html.includes("publication-console-1"), true);
  assert.equal(html.includes("PUBLISH_PUBLICATION"), true);
  assert.equal(html.includes("disabled"), true);
  assert.equal(html.includes("NON-EXECUTABLE"), true);
  assert.equal(/<form|onclick=|data-command=/u.test(html), false);
});

test("POST-F15-CONSOLE Dashboard renders the five bounded component states without invented counts", () => {
  const html = renderConsoleResult(ready("DASHBOARD", {
    health: "HEALTHY",
    runtime: "HEALTHY",
    publicationApi: "HEALTHY",
    eventJournal: "HEALTHY",
    projection: "UNAVAILABLE",
    operations: "HEALTHY",
    publicationCounts: "NOT_AVAILABLE_IN_CURRENT_BACKEND",
    baseline: "feat-015-complete",
  }));

  for (const label of ["Runtime", "Publication API", "Event Journal", "Projection", "Operations"]) {
    assert.equal(html.includes(label), true, label);
  }
  assert.equal(html.includes("Publication collection counts are not available in the current backend."), true);
});

test("POST-F15-CONSOLE renders UI-032, UI-033, UI-035 and Projection bounded evidence", () => {
  const revalidation = renderConsoleResult(ready("UI-032", {
    approvalStatus: "APPROVED", verificationStatus: "VERIFIED", permissionStatus: "ACTIVE",
    policyStatus: "CURRENT", bindingStatus: "MATCHED", stale: false, revalidationRequired: false,
  }));
  const recovery = renderConsoleResult(ready("UI-033", {
    publicationId: "publication-console-1", caseId: "case-1", attemptId: "attempt-1",
    reconciliationStatus: "OPEN", outcomeCategory: "UNKNOWN", manualReviewRequired: true,
    safeEvidenceSummary: { referenceCount: 2, restricted: true }, availableActions: [],
  }));
  const audit = renderConsoleResult(ready("UI-035", {
    publicationId: "publication-console-1", aggregateVersion: 2,
    lifecycleHistory: [{ sequence: 1, transitionId: "PUB-TR-001", toState: "READY", occurredAt: "2026-08-13T00:00:00.000Z" }],
    attemptHistory: [], reconciliationHistory: [], authorizationDecisionSummary: { allowed: 1, denied: 0 },
    auditEntries: [{ id: "audit-safe", command: "CREATE_PUBLICATION", timestamp: "2026-08-13T00:00:00.000Z", version: 1, result: "COMPLETED" }],
  }));
  const projection = renderConsoleResult(ready("PROJECTION", {
    projectionId: "PRJ-002", projectionStatus: "STALE", stale: true, staleReason: "EVENT_GAP",
    lastEventSequence: 7, sourceAggregateVersion: 4, publicationVersion: 2,
    projectionRecordVersion: 3, definitionVersion: "v0.1", schemaVersion: "v1",
  }));

  assert.equal(revalidation.includes("Revalidation Required"), true);
  assert.equal(revalidation.includes("APPROVED"), true);
  assert.equal(recovery.includes("Manual Review Required"), true);
  assert.equal(recovery.includes("Reference Count"), true);
  assert.equal(audit.includes("Lifecycle History"), true);
  assert.equal(audit.includes("Audit Entries"), true);
  assert.equal(audit.includes("Event Journal"), false);
  assert.equal(projection.includes("Projection Status"), true);
  assert.equal(projection.includes("EVENT_GAP"), true);
});

test("POST-F15-CONSOLE Operations renders Health and Readiness as separate concepts", () => {
  const html = renderConsoleResult(ready("OPERATIONS", {
    health: "HEALTHY",
    readiness: { operationsRead: true, publicationMutation: false, projectionRead: true },
    components: [{ component: "API_RUNTIME_HOST", status: "HEALTHY", reasonCode: "OPERATIONS_COMPONENT_HEALTHY", failureCount: 0, retryCount: 0, retryExhausted: false, recoverable: true }],
    metrics: { operationsObserved: 0, operationsFailed: 0, retryAttempts: 0 },
  }));

  assert.equal(html.includes("System Health"), true);
  assert.equal(html.includes("Mutation Readiness"), true);
  assert.equal(html.includes("NOT_READY"), true);
  assert.equal(html.includes("API_RUNTIME_HOST"), true);
});

test("POST-F15-CONSOLE renders meaningful empty and safe error states without raw detail", () => {
  const empty = renderConsoleResult({ page: "UI-033", state: "EMPTY", message: "No reconciliation case is currently available." });
  const unavailable = renderConsoleResult({ page: "PROJECTION", state: "UNAVAILABLE", message: "Unavailable in current backend." });
  const error = renderConsoleResult({
    page: "UI-035",
    state: "ERROR",
    error: {
      code: "CONSOLE_READ_UNAVAILABLE",
      message: "The requested Console view is unavailable.",
      correlationId: "safe-correlation",
    },
  });
  const escaped = renderConsoleResult(ready("UI-031", {
    publicationId: "<script>secret()</script>",
    lifecycle: "READY\" onclick=\"secret()",
    availableActions: [],
  }));

  assert.equal(empty.includes("No reconciliation case is currently available."), true);
  assert.equal(unavailable.includes("Unavailable in current backend."), true);
  assert.equal(error.includes("CONSOLE_READ_UNAVAILABLE"), true);
  assert.equal(error.includes("safe-correlation"), true);
  assert.equal(error.includes("stack"), false);
  assert.equal(error.includes("C:\\internal"), false);
  assert.equal(escaped.includes("<script>secret()"), false);
  assert.equal(escaped.includes("&lt;script&gt;secret()&lt;/script&gt;"), true);
  assert.equal(escaped.includes('onclick="secret()"'), false);
  assert.equal(escaped.includes("&quot; onclick=&quot;secret()"), true);
});

function ready(page: ConsoleReadResult["page"], data: Readonly<Record<string, unknown>>): ConsoleReadResult {
  return Object.freeze({ page, state: "READY", data: Object.freeze(data) });
}
