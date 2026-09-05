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
    "Audit / History", "Administration", "Projection", "Operations / Health", "Loading...",
    "Connector Operations",
    "Recovery Cases",
    "External Integration", "Audit Evidence",
  ]) assert.equal(html.includes(label), true, label);
  for (const path of [
    "/", "/publication/operations", "/publication/revalidation", "/publication/recovery",
    "/publication/audit", "/administration", "/system/projection", "/system/operations",
    "/connector/operations",
    "/recovery/cases",
    "/integration/evidence", "/audit/evidence",
  ]) assert.equal(html.includes(`href=\"${path}`), true, path);
  assert.equal(html.includes("<nav"), true);
  assert.equal(html.includes("<main"), true);
  assert.equal(html.includes("aria-live=\"polite\""), true);
  assert.equal(CONSOLE_STYLES.includes(":focus-visible"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("fetch("), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("/api/console/administration/command"), true);
  assert.equal(/publication\/(commands|execute)|PUBLISH_PUBLICATION/u.test(CONSOLE_BROWSER_CLIENT), false);
  for (const queryName of ["connectorId", "sourceId", "batchId"]) {
    assert.equal(CONSOLE_BROWSER_CLIENT.includes(queryName), true, queryName);
  }
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("recoveryCaseId"), true);
  for (const queryName of ["mappingId", "integrationContractId", "auditTargetId", "auditEventType"]) {
    assert.equal(CONSOLE_BROWSER_CLIENT.includes(queryName), true, queryName);
  }
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

test("F20-C UI-031 renders canonical execution prerequisites and blockers without enabling mutations", () => {
  const html = renderConsoleResult(ready("UI-031", {
    screenId: "UI-031",
    publicationId: "publication-operations-1",
    lifecycle: "ACTIVE",
    suspensionStatus: "NOT_SUSPENDED",
    aggregateVersion: 7,
    effectiveVersion: 6,
    target: { id: "target-1", version: 3 },
    channel: { id: "channel-1", policyVersion: "channel-policy-v4" },
    currentOperationState: "ACTIVE",
    prerequisiteSummary: {
      approval: "APPROVED",
      verification: "VERIFIED",
      permission: "ACTIVE",
      policy: "policy-v4",
      binding: "MATCHED",
      mfaReady: true,
      documentedReasonRequired: true,
    },
    availableActions: ["SUSPEND_PUBLICATION"],
    blockedActions: ["REQUEST_WITHDRAWAL:AUTHORIZATION_DENIED"],
    latestAttempt: { id: "attempt-2", sequence: 2, operation: "CORRECT", outcome: "UNKNOWN", occurredAt: "2026-08-13T00:00:00.000Z" },
    latestNormalizedOutcome: "UNKNOWN",
    recovery: {
      reconciliationStatus: "OPEN", caseId: "reconciliation-case-1", attemptId: "attempt-2",
      manualReviewRequired: true, reconciliationFinding: "UNAVAILABLE", recoveryDisposition: "UNAVAILABLE",
    },
    eligibility: {
      approvalStatus: "APPROVED", verificationStatus: "VERIFIED", permissionStatus: "ACTIVE",
      policyStatus: "CURRENT", bindingStatus: "MATCHED", stale: false, revalidationRequired: false,
    },
    safeEvidence: { referenceCount: 2, auditReferences: ["audit-safe-1"], restricted: true },
    stale: false,
  }));

  for (const expected of [
    "Execution Prerequisites", "APPROVED", "VERIFIED", "MATCHED",
    "Blocked Actions", "REQUEST_WITHDRAWAL:AUTHORIZATION_DENIED",
    "SUSPEND_PUBLICATION", "NON-EXECUTABLE", "Latest Execution Attempt", "attempt-2",
    "Latest Normalized Outcome", "UNKNOWN", "Reconciliation Finding", "Recovery Disposition",
    "reconciliation-case-1", "Current Eligibility", "Safe Evidence / Audit References", "audit-safe-1",
  ]) assert.equal(html.includes(expected), true, expected);
  assert.equal(/<form|onclick=|data-command=|fetch\([^)]*publication\/command/iu.test(html), false);
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

test("F20-D renders bounded Connector batch operations without force checkpoint or execution controls", () => {
  const html = renderConsoleResult(ready("CONNECTOR", {
    connectorId: "connector-1",
    sourceId: "source-1",
    batchId: "batch-1",
    invocationId: "invocation-1",
    technicalStatus: "SUCCEEDED",
    normalizedOutcome: "CONFIRMED",
    currentVersion: 3,
    evidenceRef: "evidence:batch:1",
    updatedAt: "2026-09-04T00:00:00.000Z",
    checkpointReference: "checkpoint-3",
    checkpointVersion: 3,
  }));

  for (const expected of ["Connector Batch", "Source Binding", "Technical Outcome", "Checkpoint", "batch-1", "source-1", "CONFIRMED", "checkpoint-3"]) {
    assert.equal(html.includes(expected), true, expected);
  }
  assert.equal(/Force checkpoint|AdvanceCheckpoint|<form|data-command|onclick=/iu.test(html), false);
});

test("F20-E renders an exact Recovery Case with finding, disposition, and lineage kept separate", () => {
  const html = renderConsoleResult(ready("RECOVERY_CASE", {
    recoveryCaseId: "recovery-case-1",
    originDomain: "CONNECTOR",
    originIdentity: { invocationId: "invocation-1" },
    status: "RESOLVED",
    finding: "CONFIRMED_NOT_EXECUTED",
    recoveryId: "recovery-1",
    evidenceRefs: ["evidence:recovery:1"],
    version: 3,
    createdAt: "2026-09-04T00:00:00.000Z",
    resolvedAt: "2026-09-04T00:05:00.000Z",
  }));

  for (const expected of ["Recovery Case", "Origin", "Reconciliation Finding", "Recovery Disposition", "Case Lineage", "CONFIRMED_NOT_EXECUTED", "recovery-1", "UNAVAILABLE"]) {
    assert.equal(html.includes(expected), true, expected);
  }
  assert.equal(/<form|data-command|onclick=|AUTHORIZE_RECOVERY|RESOLVE_RECOVERY_CASE/iu.test(html), false);
});

test("F20-F renders bounded API-019 mapping evidence without remap controls", () => {
  const html = renderConsoleResult(ready("EXTERNAL_INTEGRATION", {
    mappingId: "mapping-1", providerNamespace: "provider-safe", externalObjectId: "external-1",
    internalResourceType: "Publication", internalResourceId: "publication-1", state: "ACTIVE",
    version: 2, evidenceRef: "evidence:mapping:1", createdAt: "2026-09-04T00:00:00.000Z", updatedAt: "2026-09-04T00:05:00.000Z",
  }));
  for (const expected of ["External Mapping", "Stable Identity", "Governance Evidence", "mapping-1", "provider-safe", "evidence:mapping:1"]) {
    assert.equal(html.includes(expected), true, expected);
  }
  assert.equal(/<form|data-command|onclick=|remap|override/iu.test(html), false);
});

test("F20-F renders the bounded API-019 Integration Contract branch", () => {
  const html = renderConsoleResult(ready("EXTERNAL_INTEGRATION", {
    integrationContractId: "contract-1", technicalStatus: "ACTIVE", providerNamespace: "provider-safe",
    connectorId: "connector-1", sourceId: "source-1", version: 4,
    evidenceRef: "evidence:contract:1", createdAt: "2026-09-04T00:00:00.000Z", updatedAt: "2026-09-04T00:05:00.000Z",
  }));
  for (const expected of ["Integration Contract", "contract-1", "connector-1", "source-1", "evidence:contract:1"]) {
    assert.equal(html.includes(expected), true, expected);
  }
});

test("F20-F renders bounded API-016 audit evidence with provenance and no raw details", () => {
  const html = renderConsoleResult(ready("EVIDENCE", { events: [{
    eventId: "event-1", eventType: "RECOVERY_CASE_READ", actorId: "operator-1", actorType: "USER",
    action: "READ", resourceType: "RecoveryCase", resourceId: "recovery-case-1", decision: "ALLOW",
    outcome: "SUCCEEDED", correlationId: "correlation-1", occurredAt: "2026-09-04T00:00:00.000Z",
    evidenceRefs: ["evidence:audit:1"],
  }] }));
  for (const expected of ["Audit Evidence", "Provenance", "event-1", "operator-1", "recovery-case-1", "evidence:audit:1"]) {
    assert.equal(html.includes(expected), true, expected);
  }
  assert.equal(/Authorization|Bearer|Cookie|SQL|database path|stack trace|raw provider/iu.test(html), false);
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
  assert.equal(error.includes('role="alert"'), true);
  assert.equal(error.includes("stack"), false);
  assert.equal(error.includes("C:\\internal"), false);
  assert.equal(escaped.includes("<script>secret()"), false);
  assert.equal(escaped.includes("&lt;script&gt;secret()&lt;/script&gt;"), true);
  assert.equal(escaped.includes('onclick="secret()"'), false);
  assert.equal(escaped.includes("&quot; onclick=&quot;secret()"), true);
});

test("F20-G preserves read-only security and accessible responsive presentation across operations pages", () => {
  const malicious = `<script>globalThis.compromised=true</script>`;
  const pages = [
    ready("CONNECTOR", { batchId: malicious, technicalStatus: "BLOCKED" }),
    ready("RECOVERY_CASE", { recoveryCaseId: malicious, status: "OPEN", originDomain: "CONNECTOR", originIdentity: { invocationId: malicious } }),
    ready("EXTERNAL_INTEGRATION", { mappingId: malicious, state: "ACTIVE", evidenceRef: "evidence:safe:1" }),
    ready("EVIDENCE", { events: [{ eventId: malicious, outcome: "SUCCEEDED" }] }),
  ];
  for (const page of pages) {
    const html = renderConsoleResult(page);
    assert.equal(html.includes(malicious), false);
    assert.equal(html.includes("&lt;script&gt;"), true);
    assert.equal(/<form|data-command|onclick=|Force checkpoint|AdvanceCheckpoint|AUTHORIZE_RECOVERY|RESOLVE_RECOVERY_CASE/iu.test(html), false);
  }
  assert.equal(CONSOLE_STYLES.includes(":focus-visible"), true);
  assert.equal(CONSOLE_STYLES.includes("overflow-x:auto"), true);
  assert.equal(CONSOLE_STYLES.includes("@media(max-width:760px)"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("/api/console/publication/command"), false);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("/api/console/connector/command"), false);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("/api/console/recovery/command"), false);
});

test("F16-PHASE-10 UI-006 renders compact supported data and unavailable canonical sections without write controls", () => {
  const html = renderConsoleResult(ready("ADMINISTRATION", {
    visibleActiveRoleAssignmentCount: 1,
    visibleRoleAssignmentCount: 2,
    roleAssignments: { state: "READY", items: [
      { roleAssignmentId: "assignment-&lt;-1", subjectPrincipalReference: "principal-<script>unsafe()</script>", roleId: "role-operations", scopeType: "TENANT", scopeId: "tenant-a", status: "ACTIVE", version: 3 },
    ] },
    pendingProposals: { state: "UNAVAILABLE" },
    recentDecisions: { state: "UNAVAILABLE" },
    policyGovernance: { state: "UNAVAILABLE" },
    sourceGovernance: { state: "UNAVAILABLE" },
    targetGovernance: { state: "UNAVAILABLE" },
    authorityStatus: "AUTHORIZED",
    administrationApiStatus: "AVAILABLE",
  }));

  for (const label of ["Administration Overview", "Visible Active", "Visible Assignments", "Role Assignments", "Pending Proposals", "Recent Decisions", "Policy Governance", "Source Governance", "Target Governance", "UNAVAILABLE", "AUTHORIZED", "AVAILABLE"]) {
    assert.equal(html.includes(label), true, label);
  }
  assert.equal(html.includes("Total Assignments"), false);
  assert.equal(html.includes("No canonical proposal list operation"), false);
  assert.equal(html.includes("principal-<script>"), false);
  assert.equal(html.includes("principal-&lt;script&gt;unsafe()&lt;/script&gt;"), true);
  assert.equal(/<form|<button|onclick=|data-command=/u.test(html), false);
  assert.equal(CONSOLE_STYLES.includes("grid-template-columns:240px 1fr"), true);
  assert.equal(CONSOLE_STYLES.includes("height:48px"), true);
  assert.equal(CONSOLE_STYLES.includes("padding:24px"), true);
  assert.equal(CONSOLE_STYLES.includes(".content{padding:24px;min-width:0;"), true);
  assert.equal(CONSOLE_STYLES.includes(".page-header{height:auto;"), true);
  assert.equal(CONSOLE_STYLES.includes(".card-grid{grid-template-columns:1fr}"), true);
  assert.equal(CONSOLE_STYLES.includes('[data-status="unavailable"] .status-dot'), true);
  assert.equal(CONSOLE_STYLES.includes('[data-status="revoked"] .status-dot'), true);
  assert.equal(CONSOLE_STYLES.includes("linear-gradient"), false);
});

test("F16-PHASE-10 UI-006 renders loading, empty, unavailable, not-authorized, and safe-error states", () => {
  const shell = renderConsoleShell("ADMINISTRATION");
  const empty = renderConsoleResult({ page: "ADMINISTRATION", state: "EMPTY", message: "No role assignments are currently available." });
  const unavailable = renderConsoleResult({ page: "ADMINISTRATION", state: "UNAVAILABLE", message: "Administration data is unavailable." });
  const unauthorized = renderConsoleResult({ page: "ADMINISTRATION", state: "NOT_AUTHORIZED", message: "Not authorized." });
  const error = renderConsoleResult({ page: "ADMINISTRATION", state: "ERROR", error: { code: "CONSOLE_READ_UNAVAILABLE", message: "The requested Console view is unavailable.", correlationId: "console-safe-reference" } });

  assert.equal(shell.includes("Loading..."), true);
  assert.equal(shell.includes('aria-busy="true"'), true);
  assert.equal(empty.includes("No role assignments are currently available."), true);
  assert.equal(unavailable.includes("Administration data is unavailable."), true);
  assert.equal(unauthorized.includes("Not authorized."), true);
  assert.equal(error.includes("console-safe-reference"), true);
  assert.equal(JSON.stringify([shell, empty, unavailable, unauthorized, error]).includes("Session"), false);
});
test("F16-PHASE-11 UI-036 renders canonical controlled workflows without authority or execution leakage", () => {
  const shell = renderConsoleShell("UI-036");
  const html = renderConsoleResult(ready("UI-036", {
    selectorOptions: {
      roles: { state: "READY", items: [{ id: "role-<unsafe>", roleCode: "SEC", status: "ACTIVE", version: 2, scopeType: "TENANT", scopeId: "tenant-a" }] },
      teamScopes: { state: "READY", items: [{ id: "team-a", status: "ACTIVE", version: 3, scopeType: "TEAM", scopeId: "team-a" }] },
      roleAssignments: { state: "READY", items: [{ id: "assignment-a", subjectPrincipalReference: "principal-canonical", status: "ACTIVE", version: 1, scopeType: "TEAM", scopeId: "team-a" }] },
      policies: { state: "READY", items: [{ id: "policy-a", status: "ACTIVE", version: 4, scopeType: "POLICY", scopeId: "policy-a" }] },
      sourceGovernance: { state: "READY", items: [{ id: "source-a", status: "ACTIVE", version: 5, scopeType: "SOURCE", scopeId: "source-a" }] },
      publicationTargets: { state: "READY", items: [{ id: "target-a", status: "ACTIVE", version: 6, scopeType: "TARGET", scopeId: "target-a" }] },
      proposals: { state: "READY", items: [
        { id: "proposal-role-a", resourceType: "ROLE_ASSIGNMENT", resourceId: "assignment-a", proposerReference: "proposer-a", status: "PROPOSED", version: 1, scopeType: "TEAM", scopeId: "team-a" },
        { id: "proposal-policy-a", resourceType: "POLICY", resourceId: "policy-a", proposerReference: "proposer-b", status: "PROPOSED", version: 1, scopeType: "POLICY", scopeId: "policy-a" },
      ] },
    },
  }));

  assert.equal(shell.includes("Role &amp; Policy Administration"), true);
  assert.equal(shell.includes('data-console-page="UI-036"'), true);
  for (const label of ["Role Assignments", "Policy Administration", "Source Governance", "Publication Target Governance", "Pending Proposals", "Confirmation required"]) {
    assert.equal(html.includes(label), true, label);
  }
  for (const operation of [
    "PROPOSE_ROLE_ASSIGNMENT", "PROPOSE_POLICY_CHANGE", "PROPOSE_SOURCE_GOVERNANCE", "PROPOSE_PUBLICATION_TARGET_GOVERNANCE",
    "REVOKE_ROLE_ASSIGNMENT",
  ]) assert.equal(html.includes(operation), true, operation);
  assert.equal(html.includes("APPROVE_ROLE_ASSIGNMENT"), false);
  assert.equal(html.includes("REJECT_ROLE_ASSIGNMENT"), false);
  assert.equal(html.includes('<option value="SEC">SEC · role-&lt;unsafe&gt;</option>'), true);
  assert.equal(html.includes('<option value="AUD">'), false);
  assert.equal(html.includes('<option value="COMP">'), false);
  assert.equal(html.includes("proposal-role-a"), true);
  assert.equal(html.includes('<option value="principal-canonical">principal-canonical</option>'), true);
  assert.equal(html.includes('name="subjectPrincipalId" type="text"'), false);
  assert.equal(html.includes("assignment-a"), true);
  assert.equal(html.includes("role-<unsafe>"), false);
  assert.equal(html.includes("role-&lt;unsafe&gt;"), true);
  assert.equal(/name="(actorId|roles|capabilities|isMfaVerified|sessionId)"/u.test(html), false);
  assert.equal(/PUBLISH_PUBLICATION|REVOKE_PUBLICATION|SOURCE_INGEST|CRAWL|FETCH/u.test(html), false);
  assert.equal(shell.includes('if (payload.result && payload.result.state === "CONFIRMED") {'), true);
  assert.equal(shell.includes("setHtml(payload.html);"), true);
  assert.equal(shell.includes('feedback({ state: "REJECTED", errorCode: "CONSOLE_READ_UNAVAILABLE"'), true);
  assert.equal(shell.includes('catch(() => { if (button) button.disabled = false; safeFailure(); })'), false);
  assert.equal(shell.indexOf('if (payload.result && payload.result.state === "CONFIRMED") {') < shell.indexOf("setHtml(payload.html);"), true);
  assert.equal(shell.includes('if (payload.result && payload.result.state === "CONFIRMED") delete form.dataset.idempotencyKey'), false);
});

test("F16-PHASE-11 UI-036 renders bounded unavailable selector state without fake IDs", () => {
  const html = renderConsoleResult(ready("UI-036", { selectorOptions: {
    roles: { state: "EMPTY", items: [] }, teamScopes: { state: "EMPTY", items: [] },
    policies: { state: "EMPTY", items: [] }, sourceGovernance: { state: "EMPTY", items: [] },
    publicationTargets: { state: "EMPTY", items: [] }, proposals: { state: "EMPTY", items: [] },
  } }));
  assert.equal(html.includes("No authorized canonical options are available."), true);
  assert.equal(/temporary-|hardcoded-|fixture-/u.test(html), false);
});

test("FEAT-021-B shell exposes the canonical landmark navigation and announcement contract", () => {
  const html = renderConsoleShell("UI-036");

  assert.equal(html.includes('class="skip-link" href="#console-content">Skip to main content</a>'), true);
  assert.equal(html.indexOf('class="skip-link"') < html.indexOf('class="console-layout"'), true);
  assert.equal(html.includes('<header class="page-header" role="banner">'), true);
  assert.equal(html.includes('<nav id="primary-navigation" aria-label="Primary">'), true);
  assert.equal(html.includes('<nav class="breadcrumbs" aria-label="Breadcrumb">'), true);
  assert.equal(html.includes('href="/administration"'), true);
  assert.equal(html.includes('aria-current="page"'), true);
  assert.equal(html.includes('<main id="console-content" tabindex="-1" aria-labelledby="console-page-title">'), true);
  assert.equal(html.includes('<h1 id="console-page-title" tabindex="-1">Role &amp; Policy Administration</h1>'), true);
  assert.equal((html.match(/<main\b/gu) ?? []).length, 1);
  assert.equal(html.includes('id="console-announcements" class="sr-only" role="status" aria-live="polite" aria-atomic="true"'), true);
  assert.equal(html.includes('id="console-view" aria-busy="true"'), true);
  assert.equal(html.includes('id="console-view" aria-live='), false);
});

test("FEAT-021-B confirmation dialog and controls preserve a visible keyboard focus contract", () => {
  const html = renderConsoleResult(ready("UI-036", {
    proposals: [{ id: "proposal-1", resourceType: "POLICY", resourceId: "policy-1", proposerReference: "actor-1", status: "PROPOSED", scopeType: "TEAM", scopeId: "team-1" }],
    selectorOptions: { roleAssignments: { items: [] }, proposals: { items: [{ id: "proposal-1", resourceType: "POLICY", resourceId: "policy-1", proposerReference: "actor-1", status: "PROPOSED", scopeType: "TEAM", scopeId: "team-1" }] }, policies: { items: [{ id: "policy-1", status: "DRAFT", version: 1, scopeType: "TEAM", scopeId: "team-1" }] }, sourceGovernance: { items: [] }, publicationTargets: { items: [] }, roles: { items: [] }, teamScopes: { items: [] } },
  }));

  assert.equal(html.includes('role="dialog" aria-modal="true" aria-labelledby="confirmation-title"'), true);
  assert.equal(html.includes('<strong id="confirmation-title">Confirmation required</strong>'), true);
  for (const selector of ["a:focus-visible", "input:focus-visible", "select:focus-visible", "textarea:focus-visible"]) assert.equal(CONSOLE_STYLES.includes(selector), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("let returnFocus = null"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes('event.key === "Escape"'), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes('event.key !== "Tab"'), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("focusableElements"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("returnFocus.focus()"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("data-dialog-inert"), true);
});

test("FEAT-021-B shared status, table, unavailable and validation primitives expose semantics", () => {
  const unavailable = renderConsoleResult(Object.freeze({ page: "PROJECTION", state: "UNAVAILABLE", message: "Projection is unavailable." }));
  const administration = renderConsoleResult(ready("ADMINISTRATION", {
    roleAssignments: { state: "READY", items: [{ roleAssignmentId: "ra-1", subjectPrincipalReference: "subject-1", roleId: "role-1", scopeType: "TEAM", scopeId: "team-1", status: "ACTIVE", version: 1 }] },
    policyAdministration: { state: "UNAVAILABLE" }, sourceGovernance: { state: "UNAVAILABLE" }, publicationTargetGovernance: { state: "UNAVAILABLE" }, pendingProposals: { state: "UNAVAILABLE" }, recentDecisions: { state: "UNAVAILABLE" },
  }));

  assert.equal(unavailable.includes('class="eyebrow">UNAVAILABLE</p>'), true);
  assert.equal(unavailable.includes("READ_BOUNDARY_MISSING"), false);
  assert.equal(administration.includes('aria-label="Status: ACTIVE"'), true);
  assert.equal(administration.includes('<table aria-label="Role assignments">'), true);
  assert.equal(administration.includes('<th scope="col">Assignment</th>'), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes("form-error-summary"), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes('aria-invalid'), true);
  assert.equal(CONSOLE_BROWSER_CLIENT.includes('aria-describedby'), true);
});

test("FEAT-021-B shared shell preserves AA contrast evidence and narrow navigation access", () => {
  const contrast = (foreground: string, background: string): number => {
    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
    };
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  };

  for (const pair of [["#15253a", "#f3f6fa"], ["#607388", "#ffffff"], ["#dbe8f6", "#10243e"], ["#58718b", "#ffffff"], ["#762b2b", "#fff1f1"]] as const) {
    assert.equal(contrast(pair[0], pair[1]) >= 4.5, true);
  }
  assert.equal(CONSOLE_STYLES.includes("@media(max-width:760px)"), true);
  assert.equal(CONSOLE_STYLES.includes(".sidebar{position:static}"), true);
  assert.equal(CONSOLE_STYLES.includes(".table-wrap{overflow-x:auto}"), true);
  assert.equal(CONSOLE_STYLES.includes(".sidebar{display:none}"), false);
});

function ready(page: ConsoleReadResult["page"], data: Readonly<Record<string, unknown>>): ConsoleReadResult {
  return Object.freeze({ page, state: "READY", data: Object.freeze(data) });
}
