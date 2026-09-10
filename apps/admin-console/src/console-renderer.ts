import type { ConsolePage, ConsoleReadResult } from "./console-read-adapter.js";

const pageTitles: Readonly<Record<ConsolePage, string>> = Object.freeze({
  DASHBOARD: "Dashboard",
  "UI-031": "Publication Operations",
  "UI-032": "Publication Revalidation",
  "UI-033": "Publication Recovery",
  "UI-035": "Audit / History",
  ADMINISTRATION: "Administration",
  "UI-036": "Role & Policy Administration",
  PROJECTION: "Projection Status",
  OPERATIONS: "Operations / Health",
  CONNECTOR: "Connector Operations",
  EXTERNAL_INTEGRATION: "External Integration",
  RECOVERY_CASE: "Recovery Case",
  EVIDENCE: "Audit / Evidence",
});

const navigation = Object.freeze([
  Object.freeze({ section: "Overview", items: Object.freeze([{ page: "DASHBOARD" as const, label: "Dashboard", path: "/" }]) }),
  Object.freeze({ section: "Publication", items: Object.freeze([
    { page: "UI-031" as const, label: "Operations", path: "/publication/operations" },
    { page: "UI-032" as const, label: "Revalidation", path: "/publication/revalidation" },
    { page: "UI-033" as const, label: "Recovery", path: "/publication/recovery" },
    { page: "UI-035" as const, label: "Audit / History", path: "/publication/audit" },
  ]) }),
  Object.freeze({ section: "Administration", items: Object.freeze([
    { page: "ADMINISTRATION" as const, label: "Overview", path: "/administration" },
    { page: "UI-036" as const, label: "Role & Policy Administration", path: "/administration/governance" },
  ]) }),
  Object.freeze({ section: "Integration", items: Object.freeze([
    { page: "CONNECTOR" as const, label: "Connector Operations", path: "/connector/operations" },
    { page: "RECOVERY_CASE" as const, label: "Recovery Cases", path: "/recovery/cases" },
    { page: "EXTERNAL_INTEGRATION" as const, label: "External Integration", path: "/integration/evidence" },
    { page: "EVIDENCE" as const, label: "Audit Evidence", path: "/audit/evidence" },
  ]) }),
  Object.freeze({ section: "System", items: Object.freeze([
    { page: "PROJECTION" as const, label: "Projection", path: "/system/projection" },
    { page: "OPERATIONS" as const, label: "Operations / Health", path: "/system/operations" },
  ]) }),
]);

export function renderConsoleShell(page: ConsolePage, publicationId?: string): string {
  const selected = publicationId === undefined || publicationId.trim().length === 0 ? "" : publicationId;
  const currentSection = navigation.find(({ items }) => items.some((item) => item.page === page));
  const currentItem = currentSection?.items.find((item) => item.page === page);
  const navigationHtml = navigation.map(({ section, items }) => `
      <section class="nav-section" aria-labelledby="nav-${slug(section)}">
        <h2 id="nav-${slug(section)}">${escapeHtml(section)}</h2>
        ${items.map((item) => `<a class="nav-link${item.page === page ? " active" : ""}" href="${item.path}${selected === "" ? "" : `?publicationId=${encodeURIComponent(selected)}`}"${item.page === page ? " aria-current=\"page\"" : ""}>${escapeHtml(item.label)}</a>`).join("")}
      </section>`).join("");
  const breadcrumbs = renderBreadcrumbs(page, currentSection?.section, currentItem?.label);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(pageTitles[page])} | AI-MLS ADMIN</title>
  <style>${CONSOLE_STYLES}</style>
</head>
<body data-console-page="${page}">
  <a class="skip-link" href="#console-content">Skip to main content</a>
  <div class="console-layout">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">AI</span><strong>AI-MLS ADMIN</strong></div>
      <nav id="primary-navigation" aria-label="Primary">${navigationHtml}</nav>
      <div class="baseline"><span>Development Console</span><strong>feat-015-complete</strong></div>
    </aside>
    <div class="content">
      <header class="page-header" role="banner">
        <div>${breadcrumbs}<p class="eyebrow">${page === "UI-036" ? "CONTROLLED GOVERNANCE" : "READ-ONLY VISIBILITY"}</p><h1 id="console-page-title" tabindex="-1">${escapeHtml(pageTitles[page])}</h1></div>
        <span class="mode-badge">${page === "UI-036" ? "BACKEND AUTHORIZED" : "NON-AUTHORITATIVE"}</span>
      </header>
      <main id="console-content" tabindex="-1" aria-labelledby="console-page-title">
        <div id="console-announcements" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="console-view" aria-busy="true">
          <section class="state-card loading-state"><span class="spinner" aria-hidden="true"></span><h2>Loading...</h2><p>Reading bounded FEAT-015 status.</p></section>
        </div>
      </main>
    </div>
  </div>
  <script>${CONSOLE_BROWSER_CLIENT}</script>
</body>
</html>`;
}

function renderBreadcrumbs(page: ConsolePage, section?: string, label?: string): string {
  const current = escapeHtml(label ?? pageTitles[page]);
  if (page === "DASHBOARD") {
    return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><span aria-current="page">${current}</span></li></ol></nav>`;
  }
  const sectionSegment = section === "Administration" && page === "UI-036"
    ? '<li><a href="/administration">Administration</a></li>'
    : section === undefined || section === label ? "" : `<li><span>${escapeHtml(section)}</span></li>`;
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Dashboard</a></li>${sectionSegment}<li><span aria-current="page">${current}</span></li></ol></nav>`;
}

export function renderConsoleResult(result: ConsoleReadResult): string {
  if (result.state === "LOADING") return stateCard("LOADING", result.message ?? "Reading bounded administration status.");
  if (result.state === "EMPTY") return stateCard("EMPTY", result.message ?? "No records are currently available.");
  if (result.state === "UNAVAILABLE") return stateCard("UNAVAILABLE", result.message ?? "Not available in current backend.");
  if (result.state === "NOT_AUTHORIZED") return stateCard("NOT AUTHORIZED", result.message ?? "Not authorized.");
  if (result.state === "ERROR") {
    const error = result.error;
    return `<section class="state-card error-state" role="alert"><p class="eyebrow">SAFE ERROR</p><h2>${escapeHtml(error?.code ?? "CONSOLE_READ_UNAVAILABLE")}</h2><p>${escapeHtml(error?.message ?? "The requested Console view is unavailable.")}</p><p class="reference">Reference: ${escapeHtml(error?.correlationId ?? "console-correlation-unavailable")}</p></section>`;
  }
  const data = result.data ?? Object.freeze({});
  switch (result.page) {
    case "DASHBOARD": return renderDashboard(data);
    case "UI-031": return renderPublicationOperations(data);
    case "UI-032": return renderRevalidation(data);
    case "UI-033": return renderRecovery(data);
    case "UI-035": return renderAudit(data);
    case "ADMINISTRATION": return renderAdministration(data);
    case "UI-036": return renderControlledAdministration(data);
    case "PROJECTION": return renderProjection(data);
    case "OPERATIONS": return renderOperations(data);
    case "CONNECTOR": return renderConnectorOperations(data);
    case "EXTERNAL_INTEGRATION": return renderExternalIntegration(data);
    case "RECOVERY_CASE": return renderRecoveryCase(data);
    case "EVIDENCE": return renderEvidence(data);
  }
}

function renderDashboard(data: Readonly<Record<string, unknown>>): string {
  const cards = [
    ["Runtime", data["runtime"]], ["Publication API", data["publicationApi"]],
    ["Event Journal", data["eventJournal"]], ["Projection", data["projection"]],
    ["Operations", data["operations"]],
  ] as const;
  return `<section aria-labelledby="system-status"><div class="section-heading"><div><p class="eyebrow">SYSTEM STATUS</p><h2 id="system-status">FEAT-015 runtime</h2></div>${statusBadge(data["health"])}</div><div class="card-grid">${cards.map(([label, value]) => metricCard(label, value)).join("")}</div></section>
  <section aria-labelledby="publication-status"><div class="section-heading"><div><p class="eyebrow">PUBLICATION STATUS</p><h2 id="publication-status">Current records</h2></div></div>${data["publicationCounts"] === "NOT_AVAILABLE_IN_CURRENT_BACKEND" ? stateCard("NOT AVAILABLE", "Publication collection counts are not available in the current backend.") : definitionGrid(data)}</section>
  <section class="development-card"><p class="eyebrow">DEVELOPMENT STATUS</p><h2>${escapeHtml(data["baseline"])}</h2><p>Read-only Console composition is active. Physical persistence remains deferred.</p></section>`;
}

function renderPublicationOperations(data: Readonly<Record<string, unknown>>): string {
  const actions = arrayOf(data["availableActions"]);
  const blockers = arrayOf(data["blockedActions"]);
  const prerequisites = isRecord(data["prerequisiteSummary"])
    ? data["prerequisiteSummary"]
    : Object.freeze({});
  const latestAttempt: Readonly<Record<string, unknown>> = isRecord(data["latestAttempt"]) ? data["latestAttempt"] : Object.freeze({});
  const recovery: Readonly<Record<string, unknown>> = isRecord(data["recovery"]) ? data["recovery"] : Object.freeze({});
  const eligibility: Readonly<Record<string, unknown>> = isRecord(data["eligibility"]) ? data["eligibility"] : Object.freeze({});
  const evidence: Readonly<Record<string, unknown>> = isRecord(data["safeEvidence"]) ? data["safeEvidence"] : Object.freeze({});
  const fields = select(data, ["publicationId", "lifecycle", "suspensionStatus", "aggregateVersion", "publicationVersion", "effectiveVersion", "target", "channel", "currentOperationState", "stale"]);
  return `<section><div class="section-heading"><div><p class="eyebrow">UI-031 · API-014</p><h2>Publication Operations</h2></div>${statusBadge(data["lifecycle"])}</div>${definitionGrid(fields)}</section>
  <section aria-labelledby="execution-prerequisites"><div class="section-heading"><div><p class="eyebrow">LIVE READ MODEL</p><h2 id="execution-prerequisites">Execution Prerequisites</h2></div>${statusBadge(data["stale"] === true ? "STALE" : "CURRENT")}</div>${definitionGrid(prerequisites)}</section>
  <section aria-labelledby="latest-execution-attempt"><div class="section-heading"><div><p class="eyebrow">DURABLE HISTORY</p><h2 id="latest-execution-attempt">Latest Execution Attempt</h2></div>${statusBadge(data["latestNormalizedOutcome"])}</div>${definitionGrid(latestAttempt)}<div class="notice"><strong>Latest Normalized Outcome</strong><span>${escapeHtml(displayValue(data["latestNormalizedOutcome"]))}</span></div></section>
  <section aria-labelledby="reconciliation-recovery"><div class="section-heading"><div><p class="eyebrow">READ ONLY</p><h2 id="reconciliation-recovery">Reconciliation / Recovery</h2></div>${statusBadge(recovery["reconciliationStatus"])}</div>${definitionGrid(select(recovery, ["caseId", "attemptId", "reconciliationStatus", "manualReviewRequired"]))}<div class="notice"><strong>Reconciliation Finding</strong><span>${escapeHtml(displayValue(recovery["reconciliationFinding"]))}</span></div><div class="notice"><strong>Recovery Disposition</strong><span>${escapeHtml(displayValue(recovery["recoveryDisposition"]))}</span></div></section>
  <section aria-labelledby="current-eligibility"><div class="section-heading"><div><p class="eyebrow">LIVE REVALIDATION</p><h2 id="current-eligibility">Current Eligibility</h2></div>${statusBadge(eligibility["stale"] === true ? "STALE" : "CURRENT")}</div>${definitionGrid(eligibility)}</section>
  <section aria-labelledby="safe-evidence"><div class="section-heading"><div><p class="eyebrow">BOUNDED REFERENCES</p><h2 id="safe-evidence">Safe Evidence / Audit References</h2></div><span class="mode-badge">RESTRICTED</span></div>${definitionGrid(evidence)}</section>
  <section aria-labelledby="available-actions"><div class="section-heading"><div><p class="eyebrow">DIAGNOSTIC ONLY</p><h2 id="available-actions">Available Actions</h2></div><span class="mode-badge">NON-EXECUTABLE</span></div><div class="action-list">${actions.length === 0 ? "<p>No authorized actions are currently advertised.</p>" : actions.map((action) => `<button type="button" disabled aria-disabled="true">${escapeHtml(action)}</button>`).join("")}</div></section>
  <section aria-labelledby="blocked-actions"><div class="section-heading"><div><p class="eyebrow">FAIL-CLOSED</p><h2 id="blocked-actions">Blocked Actions</h2></div></div><div class="action-list">${blockers.length === 0 ? "<p>No blocked actions are currently advertised.</p>" : blockers.map((action) => `<span class="mode-badge">${escapeHtml(action)}</span>`).join("")}</div></section>`;
}

function renderRevalidation(data: Readonly<Record<string, unknown>>): string {
  return `<section><div class="section-heading"><div><p class="eyebrow">UI-032</p><h2>Current prerequisites</h2></div>${statusBadge(data["stale"] === true ? "STALE" : "CURRENT")}</div>${definitionGrid(select(data, ["publicationId", "approvalStatus", "verificationStatus", "permissionStatus", "policyStatus", "bindingStatus", "stale", "revalidationRequired"]))}<div class="notice"><strong>Revalidation Required</strong><span>${displayValue(data["revalidationRequired"])}</span></div></section>`;
}

function renderRecovery(data: Readonly<Record<string, unknown>>): string {
  const evidence: Readonly<Record<string, unknown>> = isRecord(data["safeEvidenceSummary"])
    ? data["safeEvidenceSummary"]
    : Object.freeze({});
  return `<section><div class="section-heading"><div><p class="eyebrow">UI-033</p><h2>Recovery status</h2></div>${statusBadge(data["reconciliationStatus"])}</div>${definitionGrid(select(data, ["publicationId", "caseId", "attemptId", "reconciliationStatus", "outcomeCategory", "manualReviewRequired"]))}<div class="notice"><strong>Manual Review Required</strong><span>${displayValue(data["manualReviewRequired"])}</span></div><div class="notice"><strong>Safe Evidence · Reference Count</strong><span>${displayValue(evidence["referenceCount"])}</span></div></section>`;
}

function renderAudit(data: Readonly<Record<string, unknown>>): string {
  return `<section><div class="section-heading"><div><p class="eyebrow">UI-035 · PUBLICATION_AUDIT_HISTORY</p><h2>Bounded history</h2></div>${statusBadge(`v${displayValue(data["aggregateVersion"])}`)}</div>${definitionGrid(select(data, ["publicationId", "aggregateVersion", "authorizationDecisionSummary"]))}</section>
  ${historySection("Lifecycle History", arrayOf(data["lifecycleHistory"]))}
  ${historySection("Attempt History", arrayOf(data["attemptHistory"]))}
  ${historySection("Reconciliation History", arrayOf(data["reconciliationHistory"]))}
  ${historySection("Audit Entries", arrayOf(data["auditEntries"]))}`;
}

function renderAdministration(data: Readonly<Record<string, unknown>>): string {
  const roleAssignments: Readonly<Record<string, unknown>> = isRecord(data["roleAssignments"])
    ? data["roleAssignments"]
    : Object.freeze({ state: "UNAVAILABLE" });
  const rows = arrayOf(roleAssignments["items"]).filter(isRecord);
  return `<section aria-labelledby="administration-overview"><div class="section-heading"><div><p class="eyebrow">UI-006 · API-015</p><h2 id="administration-overview">Administration Overview</h2></div>${statusBadge(data["authorityStatus"])}</div><div class="card-grid administration-kpis">${metricCard("Visible Active", data["visibleActiveRoleAssignmentCount"])}${metricCard("Visible Assignments", data["visibleRoleAssignmentCount"])}${metricCard("Administration API", data["administrationApiStatus"])}${metricCard("Authority", data["authorityStatus"])}</div></section>
  ${unavailableAdministrationSection("Pending Proposals", data["pendingProposals"], "Not available through the current API-015 runtime read boundary.")}
  <section aria-labelledby="role-assignments"><div class="section-heading"><div><p class="eyebrow">GOVERNED ACCESS</p><h2 id="role-assignments">Role Assignments</h2></div>${statusBadge(data["roleAssignmentsTruncated"] === true ? "PARTIAL" : roleAssignments["state"])}</div>${data["roleAssignmentsTruncated"] === true ? '<p class="empty-inline">Showing the first authorized page; more assignments are available.</p>' : ""}${rows.length === 0 ? '<p class="empty-inline">No role assignments are currently available.</p>' : `<div class="table-wrap"><table aria-label="Role assignments"><thead><tr><th scope="col">Assignment</th><th scope="col">Subject</th><th scope="col">Role</th><th scope="col">Scope</th><th scope="col">Status</th><th scope="col">Version</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row["roleAssignmentId"])}</td><td>${escapeHtml(row["subjectPrincipalReference"])}</td><td>${escapeHtml(row["roleId"])}</td><td>${escapeHtml(`${displayValue(row["scopeType"])} · ${displayValue(row["scopeId"])}`)}</td><td>${statusBadge(row["status"])}</td><td class="numeric">${escapeHtml(displayValue(row["version"]))}</td></tr>`).join("")}</tbody></table></div>`}</section>
  <div class="governance-grid">${unavailableAdministrationSection("Policy Governance", data["policyGovernance"], "Select a canonical Policy ID to inspect status.")}${unavailableAdministrationSection("Source Governance", data["sourceGovernance"], "Select a canonical Source ID to inspect status.")}${unavailableAdministrationSection("Target Governance", data["targetGovernance"], "Select a canonical Target ID to inspect status.")}</div>
  ${unavailableAdministrationSection("Recent Decisions", data["recentDecisions"], "Not available through the current API-015 runtime read boundary.")}
  <p class="scope-note">Read-only governance visibility. UI-036 controlled write actions are not available.</p>`;
}
function renderControlledAdministration(data: Readonly<Record<string, unknown>>): string {
  const selectors = isRecord(data["selectorOptions"]) ? data["selectorOptions"] : Object.freeze({});
  const governedScopes: Readonly<Record<string, unknown>> = isRecord(data["governedScopes"]) ? data["governedScopes"] : Object.freeze({});
  const roles = selectorItems(selectors, "roles");
  const teams = selectorItems(selectors, "teamScopes");
  const policies = selectorItems(selectors, "policies");
  const sources = selectorItems(selectors, "sourceGovernance");
  const targets = selectorItems(selectors, "publicationTargets");
  const assignments = selectorItems(selectors, "roleAssignments");
  const proposals = selectorItems(selectors, "proposals");
  const subjects = [...new Set(assignments.map((item) => displayValue(item["subjectPrincipalReference"])))]
    .filter((value) => value !== "N/A")
    .sort((left, right) => left.localeCompare(right));
  const noOptions = [roles, teams, policies, sources, targets, assignments, proposals].every((items) => items.length === 0);
  const overview = `<section aria-labelledby="controlled-administration"><div class="section-heading"><div><p class="eyebrow">UI-036 · API-015</p><h2 id="controlled-administration">Role &amp; Policy Administration</h2></div>${statusBadge("CONTROLLED")}</div><p class="scope-note">UI actions request governed changes. Trusted Session, live authority, MFA, two-person control, scope, version, and idempotency are enforced by API-015.</p>${noOptions ? '<div class="notice"><strong>UNAVAILABLE</strong><span>No authorized canonical options are available.</span></div>' : ""}</section>`;
  if (noOptions) return overview;
  return `${overview}
  ${controlledSection("Role Assignments", roles, `<form class="governed-form" data-administration-command>
    <input type="hidden" name="operation" value="PROPOSE_ROLE_ASSIGNMENT"><input type="hidden" name="expectedVersion" value="0">
    ${selectField("Subject principal", "subjectPrincipalId", subjects.map((value) => simpleOption(value)))}${selectField("Principal type", "subjectPrincipalType", [simpleOption("HUMAN"), simpleOption("SERVICE")])}
    ${selectField("Canonical role code", "role", roles.map(roleOptionHtml))}
    ${selectField("Team scope", "teamIds", teams.map(selectorOptionHtml))}${field("Resource types", "resourceTypes", "text", true)}${field("Purposes", "purposes", "text", true)}
    ${field("Effective from", "effectiveFrom", "datetime-local", true)}${field("Effective until", "effectiveUntil", "datetime-local", true)}${commonGovernanceFields("Propose role assignment")}
  </form>${selectorTable("Canonical Role Resources", roles)}`, roles.length > 0 && teams.length > 0 && subjects.length > 0)}
  ${controlledSection("Policy Administration", policies, `<form class="governed-form" data-administration-command>
    <input type="hidden" name="operation" value="PROPOSE_POLICY_CHANGE">${scopeFields(governedScopes["policies"])}${selectField("Policy", "policyId", policies.map(selectorOptionHtml))}
    ${field("Proposed change reference", "proposedChangeReference", "text", true)}${commonGovernanceFields("Propose policy change")}
  </form>`, policies.length > 0)}
  ${controlledSection("Source Governance", sources, `<form class="governed-form" data-administration-command>
    <input type="hidden" name="operation" value="PROPOSE_SOURCE_GOVERNANCE">${scopeFields(governedScopes["sourceGovernance"])}${selectField("Existing source (optional successor)", "sourceRegistryEntryId", [simpleOption("", "New source"), ...sources.map(selectorOptionHtml)])}
    ${field("Name", "name", "text", true)}${field("Source type", "sourceType", "text", true)}${selectField("Policy", "policyReference", policies.map(selectorOptionHtml))}
    ${field("Allowed methods", "allowedMethods", "text", true)}${field("Allowed purposes", "allowedPurposes", "text", true)}${selectField("Classification", "classification", ["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"].map((value) => simpleOption(value)))}
    ${commonGovernanceFields("Propose source governance")}
  </form>`, policies.length > 0 && (sources.length > 0 || isRecord(governedScopes["sourceGovernance"]))) }
  ${controlledSection("Publication Target Governance", targets, `<form class="governed-form" data-administration-command>
    <input type="hidden" name="operation" value="PROPOSE_PUBLICATION_TARGET_GOVERNANCE">${scopeFields(governedScopes["publicationTargets"])}${selectField("Existing target (optional successor)", "publicationTargetId", [simpleOption("", "New target"), ...targets.map(selectorOptionHtml)])}
    ${field("Name", "name", "text", true)}${field("Target type", "targetType", "text", true)}${field("Channel reference", "channelReference", "text", true)}${selectField("Policy", "policyReference", policies.map(selectorOptionHtml))}
    ${field("Allowed field references", "allowedFieldReferences", "text", true)}${commonGovernanceFields("Propose target governance")}
  </form>`, policies.length > 0 && (targets.length > 0 || isRecord(governedScopes["publicationTargets"]))) }
  ${renderProposalActions(proposals, { assignments, policies, sources, targets })}`;
}

function controlledSection(title: string, items: readonly Readonly<Record<string, unknown>>[], body: string, enabled: boolean): string {
  const content = enabled ? body : '<p class="empty-inline">Required canonical selector data is unavailable.</p>';
  return `<section><div class="section-heading"><h2>${escapeHtml(title)}</h2>${statusBadge(enabled ? "AVAILABLE" : "UNAVAILABLE")}</div>${content}</section>`;
}

function renderProposalActions(proposals: readonly Readonly<Record<string, unknown>>[], resources: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>): string {
  if (proposals.length === 0) return `<section><div class="section-heading"><h2>Pending Proposals</h2>${statusBadge("EMPTY")}</div><p class="empty-inline">No authorized pending proposals are available.</p></section>`;
  return `<section><div class="section-heading"><div><p class="eyebrow">TWO-PERSON CONTROL</p><h2>Pending Proposals</h2></div>${statusBadge("PROPOSED")}</div><p class="scope-note">Proposed by is shown for safe review. Approval requires an independent authorized actor. Confirmation required for privileged actions.</p><div class="table-wrap"><table aria-label="Pending administration proposals"><thead><tr><th scope="col">Proposal</th><th scope="col">Resource</th><th scope="col">Proposed by</th><th scope="col">Status</th><th scope="col">Governed actions</th></tr></thead><tbody>${proposals.map((proposal) => {
    const resourceType = displayValue(proposal["resourceType"]);
    const resourceId = displayValue(proposal["resourceId"]);
    const resourceItems = resourceType === "ROLE_ASSIGNMENT" ? resources["assignments"] : resourceType === "POLICY" ? resources["policies"] : resourceType === "SOURCE_REGISTRY" ? resources["sources"] : resources["targets"];
    const resource = resourceItems?.find((item) => item["id"] === resourceId);
    const expectedVersion = resource?.["version"];
    const operations = decisionOperations(resourceType, displayValue(resource?.["status"]));
    return `<tr><td>${escapeHtml(proposal["id"])}</td><td>${escapeHtml(resourceType)} · ${escapeHtml(resourceId)}</td><td>${escapeHtml(proposal["proposerReference"])}</td><td>${statusBadge(proposal["status"])}</td><td><div class="action-list">${expectedVersion === undefined ? '<span class="scope-note">Current resource version unavailable.</span>' : operations.map((operation) => `<form class="inline-command-form" data-administration-command data-confirmation-required><input type="hidden" name="operation" value="${operation}"><input type="hidden" name="proposalId" value="${escapeHtml(proposal["id"])}"><input type="hidden" name="resourceType" value="${escapeHtml(resourceType)}"><input type="hidden" name="resourceId" value="${escapeHtml(resourceId)}"><input type="hidden" name="scopeType" value="${escapeHtml(proposal["scopeType"])}"><input type="hidden" name="scopeId" value="${escapeHtml(proposal["scopeId"])}"><input type="hidden" name="expectedVersion" value="${escapeHtml(expectedVersion)}"><label>${requiredLabel(`Reason for ${operation}`, true)}<input name="reason" required minlength="3" maxlength="512"></label>${operation.startsWith("TRANSITION_") ? transitionSelect(resourceType) : ""}<button type="submit">${escapeHtml(operation)}</button></form>`).join("")}</div></td></tr>`;
  }).join("")}</tbody></table></div><div class="confirmation-panel" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" hidden data-confirmation-panel><strong id="confirmation-title">Confirmation required</strong><p>This action requests a governed state change and cannot bypass backend authorization.</p><p data-confirmation-summary></p><button type="button" data-confirm-command>Confirm governed action</button><button type="button" data-cancel-command>Cancel</button></div></section>`;
}

function decisionOperations(resourceType: string, resourceStatus: string): readonly string[] {
  if (resourceType === "ROLE_ASSIGNMENT") return resourceStatus === "ACTIVE" ? ["REVOKE_ROLE_ASSIGNMENT"] : ["APPROVE_ROLE_ASSIGNMENT", "REJECT_ROLE_ASSIGNMENT"];
  if (resourceType === "POLICY") return ["APPROVE_POLICY_CHANGE", "REJECT_POLICY_CHANGE"];
  if (resourceType === "SOURCE_REGISTRY") return ["APPROVE_SOURCE_GOVERNANCE", "REJECT_SOURCE_GOVERNANCE", "TRANSITION_SOURCE_GOVERNANCE"];
  if (resourceType === "PUBLICATION_TARGET") return ["APPROVE_PUBLICATION_TARGET_GOVERNANCE", "REJECT_PUBLICATION_TARGET_GOVERNANCE", "TRANSITION_PUBLICATION_TARGET_GOVERNANCE"];
  return [];
}

function transitionSelect(resourceType: string): string { return selectField("Target status", "targetStatus", (resourceType === "SOURCE_REGISTRY" ? ["PAUSED", "BLOCKED", "RETIRED"] : ["PAUSED", "RETIRED"]).map((value) => simpleOption(value))); }
function commonGovernanceFields(label: string): string { return `${field("Reason", "reason", "text", true)}${field("Evidence reference", "evidenceReferenceId", "text", false)}<button type="submit">${escapeHtml(label)}</button>`; }
function requiredLabel(label: string, required: boolean): string { return `<span>${escapeHtml(label)}${required ? '<span class="required-indicator" aria-hidden="true">*</span><span class="sr-only"> required</span>' : ""}</span>`; }
function field(label: string, name: string, type: string, required: boolean): string { return `<label>${requiredLabel(label, required)}<input type="${escapeHtml(type)}" name="${escapeHtml(name)}"${required ? " required" : ""} minlength="3" maxlength="512"></label>`; }
function selectField(label: string, name: string, options: readonly string[]): string { return `<label>${requiredLabel(label, true)}<select name="${escapeHtml(name)}" required>${options.join("")}</select></label>`; }
function simpleOption(value: string, label = value): string { return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`; }
function selectorOptionHtml(item: Readonly<Record<string, unknown>>): string { return `<option value="${escapeHtml(item["id"])}" data-version="${escapeHtml(item["version"])}" data-scope-type="${escapeHtml(item["scopeType"])}" data-scope-id="${escapeHtml(item["scopeId"])}">${escapeHtml(item["id"])} · ${escapeHtml(item["status"])} · v${escapeHtml(item["version"])}</option>`; }
function roleOptionHtml(item: Readonly<Record<string, unknown>>): string { return `<option value="${escapeHtml(item["roleCode"])}">${escapeHtml(item["roleCode"])} · ${escapeHtml(item["id"])}</option>`; }
function selectorItems(selectors: Readonly<Record<string, unknown>>, key: string): readonly Readonly<Record<string, unknown>>[] { const section = selectors[key]; return isRecord(section) ? arrayOf(section["items"]).filter(isRecord) : []; }
function selectorTable(title: string, items: readonly Readonly<Record<string, unknown>>[]): string { return `<div class="selector-summary"><h3>${escapeHtml(title)}</h3>${items.length === 0 ? '<p class="empty-inline">No authorized canonical options are available.</p>' : items.map((item) => `<span class="selector-chip">${escapeHtml(item["id"])} · ${escapeHtml(item["status"])}</span>`).join("")}</div>`; }
function scopeFields(value: unknown): string { return isRecord(value) ? `<input type="hidden" name="scopeType" value="${escapeHtml(value["scopeType"])}"><input type="hidden" name="scopeId" value="${escapeHtml(value["scopeId"])}">` : ""; }

function unavailableAdministrationSection(title: string, value: unknown, message: string): string {
  const state = isRecord(value) ? displayValue(value["state"]) : "UNAVAILABLE";
  return `<section class="compact-section"><div class="section-heading"><h2>${escapeHtml(title)}</h2>${statusBadge(state)}</div><p class="empty-inline">${escapeHtml(state === "UNAVAILABLE" ? message : "No records are currently available.")}</p></section>`;
}
function renderProjection(data: Readonly<Record<string, unknown>>): string {
  return `<section><div class="section-heading"><div><p class="eyebrow">PRJ-002 · READ ONLY</p><h2>Projection Status</h2></div>${statusBadge(data["projectionStatus"])}</div>${definitionGrid(select(data, ["publicationId", "servingGeneration", "projectionStatus", "stale", "staleReason", "lastEventSequence", "sourceAggregateVersion", "publicationVersion", "projectionRecordVersion", "definitionVersion", "schemaVersion", "lastSuccessfulApply", "lastSuccessfulRebuild"]))}<p class="scope-note">Projection is derived and has no business authority. Rebuild controls are not exposed.</p></section>`;
}

function renderOperations(data: Readonly<Record<string, unknown>>): string {
  const readiness = isRecord(data["readiness"]) ? data["readiness"] : Object.freeze({});
  const components = arrayOf(data["components"]);
  const metrics = isRecord(data["metrics"]) ? data["metrics"] : Object.freeze({});
  return `<section><div class="section-heading"><div><p class="eyebrow">SYSTEM HEALTH</p><h2>System Health</h2></div>${statusBadge(data["health"])}</div><div class="card-grid">${Object.entries(readiness).map(([key, value]) => metricCard(readinessLabel(key), value === true ? "READY" : "NOT_READY")).join("")}</div></section>
  <section><div class="section-heading"><div><p class="eyebrow">COMPONENT STATUS</p><h2>Health and recovery posture</h2></div></div>${historySection("Components", components)}</section>
  <section><div class="section-heading"><div><p class="eyebrow">BOUNDED METRICS</p><h2>Operational evidence</h2></div></div>${definitionGrid(metrics)}</section>
  ${renderOperationalTelemetry(data["telemetry"])}
  ${renderOperationalStatuses(data["operationalStatuses"])}
  ${renderSecurityPrivacySummary(data["securityPrivacySummary"])}
  ${renderOperationalReadiness(data["operationalReadiness"])}
  ${renderOperationalAlerts(data["alerts"])}`;
}

function renderOperationalTelemetry(value: unknown): string {
  if (value === "UNAVAILABLE") return unavailableOperationalSection("Operational Telemetry", "Authorized telemetry evidence is unavailable.");
  const records = arrayOf(value).filter(isRecord);
  if (records.length === 0) return emptyOperationalSection("Operational Telemetry", "No authorized telemetry evidence is currently available.");
  return `<section aria-labelledby="operational-telemetry"><div class="section-heading"><div><p class="eyebrow">DURABLE EVIDENCE · READ ONLY</p><h2 id="operational-telemetry">Operational Telemetry</h2></div>${statusBadge("READ ONLY")}</div>
  <div class="table-wrap"><table aria-label="Operational Telemetry"><thead><tr><th scope="col">Event</th><th scope="col">Component</th><th scope="col">Operation</th><th scope="col">Outcome</th><th scope="col">Resource</th><th scope="col">Correlation</th><th scope="col">Evidence</th><th scope="col">Occurred</th></tr></thead><tbody>${records.map((record) => `<tr><td>${escapeHtml(record["telemetryEventId"])}</td><td>${escapeHtml(record["component"])}</td><td>${escapeHtml(record["operation"])}</td><td>${statusBadge(record["outcome"])}</td><td>${escapeHtml(`${displayValue(record["resourceType"])} · ${displayValue(record["resourceRef"])}`)}</td><td>${escapeHtml(displayValue(record["correlationId"]))}</td><td>${escapeHtml(displayValue(record["evidenceRefs"]))}</td><td>${escapeHtml(record["occurredAt"])}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderOperationalStatuses(value: unknown): string {
  if (value === "UNAVAILABLE") return unavailableOperationalSection("Component Health / Readiness / Freshness", "Authorized component status is unavailable.");
  const statuses = arrayOf(value).filter(isRecord);
  if (statuses.length === 0) return emptyOperationalSection("Component Health / Readiness / Freshness", "No component status snapshot has been recorded.");
  return `<section aria-labelledby="operational-component-status"><div class="section-heading"><div><p class="eyebrow">CANONICAL STATUS · READ ONLY</p><h2 id="operational-component-status">Component Health / Readiness / Freshness</h2></div>${statusBadge("READ ONLY")}</div>
  <div class="table-wrap"><table aria-label="Component Health Readiness Freshness"><thead><tr><th scope="col">Snapshot</th><th scope="col">Component</th><th scope="col">Resource</th><th scope="col">Health</th><th scope="col">Readiness</th><th scope="col">Freshness</th><th scope="col">Telemetry evidence</th><th scope="col">Evaluated</th></tr></thead><tbody>${statuses.map((status) => `<tr><td>${escapeHtml(status["statusSnapshotId"])}</td><td>${escapeHtml(status["component"])}</td><td>${escapeHtml(`${displayValue(status["resourceType"])} · ${displayValue(status["resourceRef"])}`)}</td><td>${statusBadge(status["health"])}</td><td>${statusBadge(status["readiness"])}</td><td>${statusBadge(status["freshness"])}</td><td>${escapeHtml(status["telemetryEventId"])}</td><td>${escapeHtml(status["evaluatedAt"])}</td></tr>`).join("")}</tbody></table></div><p class="scope-note">Health, Readiness, and Freshness are independent evidence projections. UNKNOWN remains UNKNOWN and grants no authority.</p></section>`;
}

function renderSecurityPrivacySummary(value: unknown): string {
  if (value === "UNAVAILABLE") return unavailableOperationalSection("Security / Privacy Summary", "Authorized security and privacy evidence is unavailable.");
  if (!isRecord(value)) return emptyOperationalSection("Security / Privacy Summary", "No security and privacy evidence is currently available.");
  return `<section aria-labelledby="security-privacy-summary"><div class="section-heading"><div><p class="eyebrow">SCOPED EVIDENCE · READ ONLY</p><h2 id="security-privacy-summary">Security / Privacy Summary</h2></div>${statusBadge("READ ONLY")}</div>${definitionGrid(select(value, ["telemetryCount", "statusCount", "evidenceRefs"]))}<p class="scope-note">Summary counts and references are derived only from live-authorized, tenant- and scope-bound SECURITY evidence.</p></section>`;
}

function unavailableOperationalSection(title: string, message: string): string {
  return `<section><div class="section-heading"><h2>${escapeHtml(title)}</h2>${statusBadge("UNAVAILABLE")}</div><p class="empty-inline">${escapeHtml(message)}</p></section>`;
}

function emptyOperationalSection(title: string, message: string): string {
  return `<section><div class="section-heading"><h2>${escapeHtml(title)}</h2>${statusBadge("EMPTY")}</div><p class="empty-inline">${escapeHtml(message)}</p></section>`;
}

function renderOperationalReadiness(value: unknown): string {
  if (value === "UNAVAILABLE") return `<section><div class="section-heading"><div><p class="eyebrow">EVIDENCE · READ ONLY</p><h2>Operational Readiness</h2></div>${statusBadge("UNAVAILABLE")}</div><p class="empty-inline">No authorized readiness evidence is currently available.</p></section>`;
  const projections = arrayOf(value).filter(isRecord);
  if (projections.length === 0) return `<section><div class="section-heading"><div><p class="eyebrow">EVIDENCE · READ ONLY</p><h2>Operational Readiness</h2></div>${statusBadge("EMPTY")}</div><p class="empty-inline">No readiness projection has been recorded.</p></section>`;
  return `<section><div class="section-heading"><div><p class="eyebrow">EVIDENCE · READ ONLY</p><h2>Operational Readiness</h2></div>${statusBadge("READ ONLY")}</div>
  <div class="table-wrap"><table aria-label="Operational Readiness"><thead><tr><th scope="col">Type</th><th scope="col">Resource</th><th scope="col">Readiness</th><th scope="col">Freshness</th><th scope="col">Safe reasons</th><th scope="col">Evidence</th><th scope="col">Evaluated</th></tr></thead><tbody>${projections.map((projection) => `<tr><td>${escapeHtml(projection["readinessType"])}</td><td>${escapeHtml(projection["resourceRef"])}</td><td>${statusBadge(projection["readiness"])}</td><td>${statusBadge(projection["freshness"])}</td><td>${escapeHtml(displayValue(projection["safeReasonCodes"]))}</td><td>${escapeHtml(displayValue(projection["evidenceRefs"]))}</td><td>${escapeHtml(projection["evaluatedAt"])}</td></tr>`).join("")}</tbody></table></div><p class="scope-note">Derived evidence only. No deployment, backup, restore, or rollback authority.</p></section>`;
}

function renderOperationalAlerts(value: unknown): string {
  if (value === "UNAVAILABLE") return `<section><div class="section-heading"><div><p class="eyebrow">DERIVED · READ ONLY</p><h2>Operational Alerts</h2></div>${statusBadge("UNAVAILABLE")}</div><p class="empty-inline">Authorized Alert evidence is unavailable.</p></section>`;
  const alerts = arrayOf(value).filter(isRecord);
  if (alerts.length === 0) return `<section><div class="section-heading"><div><p class="eyebrow">DERIVED · READ ONLY</p><h2>Operational Alerts</h2></div>${statusBadge("EMPTY")}</div><p class="empty-inline">No authorized Alert evidence is currently available.</p></section>`;
  return `<section><div class="section-heading"><div><p class="eyebrow">DERIVED · READ ONLY</p><h2>Operational Alerts</h2></div>${statusBadge(alerts.some((alert) => alert["currentState"] === "ACTIVE") ? "ACTIVE" : "CLEARED")}</div>
  <div class="table-wrap"><table aria-label="Operational Alerts"><thead><tr><th scope="col">Severity</th><th scope="col">Alert</th><th scope="col">Component / Resource</th><th scope="col">State</th><th scope="col">Safe reason</th><th scope="col">Evidence</th><th scope="col">Opened / Evaluated</th></tr></thead><tbody>${alerts.map((alert) => `<tr><td>${statusBadge(alert["severity"])}</td><td>${escapeHtml(alert["alertType"])}</td><td>${escapeHtml(`${displayValue(alert["component"])} · ${displayValue(alert["resourceRef"])}`)}</td><td>${statusBadge(alert["currentState"])}</td><td>${escapeHtml(alert["safeReasonCode"])}</td><td>${escapeHtml(displayValue(alert["evidenceRefs"]))}</td><td>${escapeHtml(`${displayValue(alert["openedAt"])} · ${displayValue(alert["lastEvaluatedAt"])}`)}</td></tr>`).join("")}</tbody></table></div><p class="scope-note">Read-only derived operational evidence.</p></section>`;
}

function renderConnectorOperations(data: Readonly<Record<string, unknown>>): string {
  return `<section><div class="section-heading"><div><p class="eyebrow">API-018 · READ ONLY</p><h2>Connector Batch</h2></div>${statusBadge(data["technicalStatus"])}</div>${definitionGrid(select(data, ["batchId", "invocationId", "currentVersion", "updatedAt"]))}</section>
  <section><div class="section-heading"><h2>Source Binding</h2></div>${definitionGrid(select(data, ["connectorId", "sourceId"]))}</section>
  <section><div class="section-heading"><h2>Technical Outcome</h2></div>${definitionGrid(select(data, ["technicalStatus", "normalizedOutcome", "evidenceRef"]))}</section>
  <section><div class="section-heading"><h2>Checkpoint</h2></div>${definitionGrid(select(data, ["checkpointReference", "checkpointVersion"]))}<p class="scope-note">Checkpoint advancement and Connector execution controls are not exposed.</p></section>`;
}

function renderRecoveryCase(data: Readonly<Record<string, unknown>>): string {
  const unavailable = `<span class="status-badge">UNAVAILABLE</span>`;
  return `<section><div class="section-heading"><div><p class="eyebrow">F19 · EXACT READ</p><h2>Recovery Case</h2></div>${statusBadge(data["status"])}</div>${definitionGrid(select(data, ["recoveryCaseId", "status", "version", "createdAt", "resolvedAt"]))}</section>
  <section><div class="section-heading"><h2>Origin</h2></div>${definitionGrid(select(data, ["originDomain", "originIdentity"]))}</section>
  <section><div class="section-heading"><h2>Reconciliation Finding</h2></div>${data["finding"] === undefined ? unavailable : statusBadge(data["finding"])}</section>
  <section><div class="section-heading"><h2>Recovery Disposition</h2></div>${unavailable}${definitionGrid(select(data, ["recoveryId"]))}<p class="scope-note">Disposition is not exposed by the current exact-case read contract.</p></section>
  <section><div class="section-heading"><h2>Case Lineage</h2></div>${unavailable}<p class="scope-note">Parent and child case references are not exposed by the current exact-case read contract.</p></section>
  <section><div class="section-heading"><h2>Safe Evidence</h2></div>${definitionGrid(select(data, ["evidenceRefs"]))}</section>`;
}

function renderExternalIntegration(data: Readonly<Record<string, unknown>>): string {
  const isMapping = data["mappingId"] !== undefined;
  return `<section><div class="section-heading"><div><p class="eyebrow">API-019 · READ ONLY</p><h2>${isMapping ? "External Mapping" : "Integration Contract"}</h2></div>${statusBadge(data["state"] ?? data["technicalStatus"])}</div>${definitionGrid(select(data, isMapping ? ["mappingId", "state", "version", "createdAt", "updatedAt"] : ["integrationContractId", "technicalStatus", "version", "createdAt", "updatedAt"]))}</section>
  <section><div class="section-heading"><h2>Stable Identity</h2></div>${definitionGrid(select(data, isMapping ? ["providerNamespace", "externalObjectId", "internalResourceType", "internalResourceId"] : ["providerNamespace", "connectorId", "sourceId"]))}</section>
  <section><div class="section-heading"><h2>Governance Evidence</h2></div>${definitionGrid(select(data, ["evidenceRef"]))}<p class="scope-note">This read-only view cannot change mappings, contracts, Sources, or Connector execution.</p></section>`;
}

function renderEvidence(data: Readonly<Record<string, unknown>>): string {
  return `<section><div class="section-heading"><div><p class="eyebrow">API-016 · READ ONLY</p><h2>Audit Evidence</h2></div></div><p class="scope-note">Bounded governance provenance. Raw runtime and provider data are not exposed.</p></section>
  <section><div class="section-heading"><h2>Provenance</h2></div>${historySection("Events", arrayOf(data["events"]))}</section>`;
}

function historySection(title: string, entries: readonly unknown[]): string {
  if (entries.length === 0) return `<section><h2>${escapeHtml(title)}</h2><p class="empty-inline">No entries are currently available.</p></section>`;
  return `<section><h2>${escapeHtml(title)}</h2><ul class="history-list" aria-label="${escapeHtml(title)}">${entries.map((entry) => `<li>${isRecord(entry) ? definitionGrid(entry) : escapeHtml(entry)}</li>`).join("")}</ul></section>`;
}

function definitionGrid(data: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return "<p class=\"empty-inline\">No bounded data is currently available.</p>";
  return `<dl class="definition-grid">${entries.map(([key, value]) => `<div><dt>${escapeHtml(labelOf(key))}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`).join("")}</dl>`;
}

function metricCard(label: string, value: unknown): string {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue(value))}</strong></article>`;
}

function statusBadge(value: unknown): string {
  const display = displayValue(value);
  return `<span class="status-badge" data-status="${escapeHtml(slug(display))}" aria-label="Status: ${escapeHtml(display)}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(display)}</span>`;
}

function stateCard(code: string, message: string): string {
  return `<section class="state-card"><p class="eyebrow">${escapeHtml(code)}</p><h2>${escapeHtml(message)}</h2><p>Use an authorized resource reference when one becomes available.</p></section>`;
}

function select(data: Readonly<Record<string, unknown>>, keys: readonly string[]): Readonly<Record<string, unknown>> {
  return Object.freeze(Object.fromEntries(keys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]])));
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null) return "Not available";
  if (typeof value === "boolean") return value ? "YES" : "NO";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (isRecord(value)) return Object.entries(value).map(([key, nested]) => `${labelOf(key)}: ${displayValue(nested)}`).join(" · ");
  return "Not available";
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : Object.freeze([]);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function labelOf(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replaceAll("_", " ").replace(/^./u, (letter) => letter.toUpperCase());
}

function readinessLabel(key: string): string {
  return key === "publicationMutation" ? "Mutation Readiness" : labelOf(key);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] ?? "");
}

export const CONSOLE_BROWSER_CLIENT = String.raw`(() => {
  "use strict";
  const root = document.getElementById("console-view");
  const announcements = document.getElementById("console-announcements");
  const page = document.body.dataset.consolePage;
  if (!root || !page) return;
  let pendingForm = null;
  let returnFocus = null;
  let validationSequence = 0;
  const safeFailure = () => {
    root.innerHTML = "<section class=\"state-card error-state\" role=\"alert\"><h2>CONSOLE_READ_UNAVAILABLE</h2><p>The requested Console view is unavailable.</p></section>";
    root.setAttribute("aria-busy", "false");
    if (announcements) announcements.textContent = "Console view unavailable.";
  };
  const setHtml = (html) => {
    root.innerHTML = typeof html === "string" ? html : "";
    root.setAttribute("aria-busy", "false");
    if (announcements) announcements.textContent = "Console view updated.";
    wireForms();
  };
  const load = () => {
    const query = new URLSearchParams(window.location.search);
    const request = new URLSearchParams({ page });
    const publicationId = query.get("publicationId");
    if (publicationId) request.set("publicationId", publicationId);
    for (const name of ["connectorId", "sourceId", "batchId", "recoveryCaseId", "mappingId", "integrationContractId", "auditTargetId", "auditEventType"]) {
      const value = query.get(name);
      if (value) request.set(name, value);
    }
    return fetch("/api/console/view?" + request.toString(), { headers: { accept: "application/json" } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("SAFE_HTTP_FAILURE")))
      .then((payload) => setHtml(payload.html))
      .catch(safeFailure);
  };
  const selectedOption = (form) => {
    const select = form.querySelector('select[name="teamIds"],select[name="policyId"],select[name="sourceRegistryEntryId"],select[name="publicationTargetId"]');
    return select && select.selectedOptions ? select.selectedOptions[0] : null;
  };
  const buildCommand = (form) => {
    const values = new FormData(form);
    const operation = String(values.get("operation") || "");
    const payload = {};
    const csvFields = new Set(["teamIds", "resourceTypes", "purposes", "allowedMethods", "allowedPurposes", "allowedFieldReferences"]);
    for (const [key, raw] of values.entries()) {
      if (["operation", "resourceType", "resourceId", "evidenceReferenceId", "scopeType", "scopeId"].includes(key)) continue;
      const value = String(raw).trim();
      if (!value) continue;
      payload[key] = csvFields.has(key) ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : key === "expectedVersion" ? Number(value)
        : key === "effectiveFrom" || key === "effectiveUntil" ? new Date(value).toISOString()
        : value;
    }
    const option = selectedOption(form);
    const explicitVersion = values.get("expectedVersion");
    if (explicitVersion === null || String(explicitVersion).length === 0) payload.expectedVersion = option && option.dataset.version ? Number(option.dataset.version) : 0;
    const scopeType = String(values.get("scopeType") || (option && option.dataset.scopeType) || "");
    const scopeId = String(values.get("scopeId") || (option && option.dataset.scopeId) || "");
    payload.scopeType = scopeType;
    payload.scopeId = scopeId;
    const resourceType = String(values.get("resourceType") || "");
    const resourceId = String(values.get("resourceId") || "");
    if (resourceId) {
      const identityKey = resourceType === "ROLE_ASSIGNMENT" ? "roleAssignmentId" : resourceType === "POLICY" ? "policyId" : resourceType === "SOURCE_REGISTRY" ? "sourceRegistryEntryId" : "publicationTargetId";
      payload[identityKey] = resourceId;
    }
    const evidenceReferenceId = String(values.get("evidenceReferenceId") || "").trim();
    payload.evidenceReferenceId = evidenceReferenceId;
    if (!form.dataset.idempotencyKey) form.dataset.idempotencyKey = crypto.randomUUID();
    payload.idempotencyKey = form.dataset.idempotencyKey;
    return { operation, payload };
  };
  const feedback = (result) => {
    const notice = document.createElement("div");
    notice.className = result && result.state === "CONFIRMED" ? "notice command-feedback" : "notice command-feedback error-state";
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = result && result.state === "CONFIRMED" ? "Confirmed by API-015" : String((result && result.errorCode) || "COMMAND_REJECTED");
    detail.textContent = result && result.state === "CONFIRMED" ? String(result.operation) + " · " + String(result.status) + " · v" + String(result.version) : String((result && result.message) || "The request could not be completed.");
    notice.append(title, detail);
    root.prepend(notice);
    if (announcements) announcements.textContent = title.textContent + ". " + detail.textContent;
  };
  const submit = (form) => {
    const button = form.querySelector('button[type="submit"]');
    form.setAttribute("aria-busy", "true");
    if (button) { button.disabled = true; button.setAttribute("aria-disabled", "true"); }
    fetch("/api/console/administration/command", {
      method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(buildCommand(form)),
    }).then((response) => response.ok ? response.json() : Promise.reject(new Error("SAFE_HTTP_FAILURE")))
      .then((payload) => {
        if (payload.result && payload.result.state === "CONFIRMED") {
          delete form.dataset.idempotencyKey;
          setHtml(payload.html);
          feedback(payload.result);
          return;
        }
        form.setAttribute("aria-busy", "false");
        if (button) { button.disabled = false; button.setAttribute("aria-disabled", "false"); }
        feedback(payload.result);
      }).catch(() => { form.setAttribute("aria-busy", "false"); if (button) { button.disabled = false; button.setAttribute("aria-disabled", "false"); } feedback({ state: "REJECTED", errorCode: "CONSOLE_READ_UNAVAILABLE", message: "The command outcome is unavailable. Retry uses the same idempotency key." }); });
  };
  const clearValidation = (form) => {
    form.querySelector("[data-form-error-summary]")?.remove();
    form.querySelectorAll("[aria-invalid]").forEach((field) => { field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); });
    form.querySelectorAll("[data-field-error]").forEach((error) => error.remove());
  };
  const validateForm = (form) => {
    clearValidation(form);
    const invalid = Array.from(form.querySelectorAll("input,select,textarea")).filter((field) => !field.checkValidity());
    if (invalid.length === 0) return true;
    validationSequence += 1;
    const summary = document.createElement("div");
    summary.className = "form-error-summary";
    summary.dataset.formErrorSummary = "";
    summary.setAttribute("role", "alert");
    summary.tabIndex = -1;
    const summaryTitle = document.createElement("strong");
    summaryTitle.textContent = "Check the highlighted fields.";
    const errorList = document.createElement("ul");
    summary.append(summaryTitle, errorList);
    form.prepend(summary);
    invalid.forEach((field, index) => {
      const error = document.createElement("span");
      const fieldId = field.id || "invalid-field-" + validationSequence + "-" + index;
      const errorId = "field-error-" + validationSequence + "-" + index;
      field.id = fieldId;
      error.id = errorId;
      error.className = "sr-only";
      error.dataset.fieldError = "";
      error.textContent = "This field needs attention.";
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", errorId);
      field.insertAdjacentElement("afterend", error);
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + fieldId;
      link.textContent = field.name || "Required field";
      item.append(link);
      errorList.append(item);
    });
    summary.focus();
    return false;
  };
  const closeConfirmation = () => {
    const panel = root.querySelector("[data-confirmation-panel]");
    if (panel) panel.hidden = true;
    root.querySelectorAll("[data-dialog-inert]").forEach((element) => { element.inert = false; delete element.dataset.dialogInert; });
    pendingForm = null;
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    returnFocus = null;
  };
  const wireForms = () => {
    root.querySelectorAll("[data-administration-command]").forEach((form) => form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!validateForm(form)) return;
      if (form.hasAttribute("data-confirmation-required")) {
        pendingForm = form;
        returnFocus = event.submitter || form.querySelector('button[type="submit"]');
        const panel = root.querySelector("[data-confirmation-panel]");
        const summary = root.querySelector("[data-confirmation-summary]");
        if (panel) panel.hidden = false;
        if (panel) {
          Array.from(root.children).forEach((element) => {
            if (element === panel || element.contains(panel)) return;
            element.inert = true;
            element.dataset.dialogInert = "";
          });
          Array.from(panel.parentElement?.children ?? []).forEach((element) => {
            if (element === panel) return;
            element.inert = true;
            element.dataset.dialogInert = "";
          });
        }
        if (summary) summary.textContent = String(new FormData(form).get("operation")) + " · " + String(new FormData(form).get("resourceId")) + " · v" + String(new FormData(form).get("expectedVersion"));
        root.querySelector("[data-confirm-command]")?.focus();
        return;
      }
      submit(form);
    }));
    root.querySelector("[data-confirm-command]")?.addEventListener("click", () => { const form = pendingForm; closeConfirmation(); if (form) submit(form); });
    root.querySelector("[data-cancel-command]")?.addEventListener("click", closeConfirmation);
    root.querySelector("[data-confirmation-panel]")?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeConfirmation(); return; }
      if (event.key !== "Tab") return;
      const focusableElements = Array.from(event.currentTarget.querySelectorAll("button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])"));
      if (focusableElements.length === 0) return;
      const first = focusableElements[0]; const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  };
  void load();
})();`;

export const CONSOLE_STYLES = `
:root{--radius:10px;--control-height:32px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#15253a;background:#f3f6fa;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-width:320px}.skip-link{position:fixed;left:1rem;top:-4rem;z-index:10;background:#fff;padding:.75rem;border-radius:.5rem}.skip-link:focus{top:1rem}.console-layout{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.sidebar{background:#10243e;color:#dbe8f6;padding:24px;display:flex;flex-direction:column;gap:1.5rem}.brand{display:flex;align-items:center;gap:.75rem}.brand-mark{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:.7rem;background:#3bd2b1;color:#092033;font-weight:800}.nav-section{margin-top:1rem}.nav-section h2{font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:#8198b3}.nav-link{display:block;color:#dbe8f6;text-decoration:none;padding:.7rem .8rem;margin:.2rem 0;border-radius:.5rem}.nav-link:hover,.nav-link.active{background:#1c3858;color:#fff}.nav-link:focus-visible,button:focus-visible{outline:3px solid #f4c95d;outline-offset:2px}.baseline{margin-top:auto;border-top:1px solid #31506e;padding-top:1rem;display:grid;gap:.3rem;font-size:.76rem;color:#9eb2c8}.content{padding:24px;min-width:0;max-width:1440px;width:100%;margin:0 auto}.breadcrumbs{font-size:.75rem;color:#607388;margin-bottom:.2rem}.breadcrumbs ol{display:flex;align-items:center;gap:.4rem;list-style:none;margin:0;padding:0}.breadcrumbs li+li::before{content:"/";margin-right:.4rem;color:#8198b3}.breadcrumbs a{color:#315f8e}.page-header,.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.page-header{min-height:48px;margin-bottom:16px}.page-header h1{font-size:1.45rem;line-height:1.2;margin:.1rem 0}.eyebrow{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#58718b;font-weight:750}.mode-badge,.status-badge{display:inline-flex;align-items:center;gap:.45rem;border:1px solid #c9d5e2;border-radius:999px;padding:.45rem .7rem;background:#fff;font-size:.72rem;font-weight:750;white-space:nowrap}.status-dot{width:.55rem;height:.55rem;border-radius:50%;background:#1ead86}[data-status="unavailable"] .status-dot{background:#8198b3}[data-status="revoked"] .status-dot,[data-status="rejected"] .status-dot,[data-status="blocked"] .status-dot{background:#b54444}[data-status="pending"] .status-dot,[data-status="proposed"] .status-dot{background:#a36a16}.content section,.development-card{background:#fff;border:1px solid #dce4ed;border-radius:var(--radius);padding:1.25rem;margin-bottom:16px;box-shadow:0 8px 24px rgba(38,63,89,.055)}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.75rem}.metric-card{border:1px solid #dce4ed;border-radius:.8rem;padding:1rem;display:grid;gap:.55rem}.metric-card span{font-size:.76rem;color:#64788d}.metric-card strong{font-size:1.05rem}.definition-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.7rem;margin:1rem 0 0}.definition-grid>div{background:#f7f9fc;padding:.8rem;border-radius:.65rem;min-width:0}.definition-grid dt{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#6a7c91}.definition-grid dd{margin:.35rem 0 0;overflow-wrap:anywhere;font-weight:650}.action-list{display:flex;flex-wrap:wrap;gap:.6rem}.action-list button{border:1px solid #c9d5e2;background:#eef2f6;color:#65768a;padding:.65rem .85rem;border-radius:.55rem}.notice{display:flex;justify-content:space-between;gap:1rem;border-left:4px solid #3a80d2;background:#f2f7fd;padding:.8rem 1rem;margin-top:.75rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:720px}th{text-align:left;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#607388;padding:.65rem .5rem;border-bottom:1px solid #dce4ed}td{border-top:1px solid #e2e8ef;padding:.5rem}.state-card{text-align:center;padding:2.5rem!important}.state-card h2{font-size:1.1rem}.error-state{border-color:#eab0b0!important}.numeric{font-variant-numeric:tabular-nums}.governance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.governance-grid .compact-section{margin-bottom:0}.reference,.scope-note,.empty-inline{color:#607388;font-size:.86rem}.spinner{display:inline-block;width:1.4rem;height:1.4rem;border:3px solid #d5e0eb;border-top-color:#2978c8;border-radius:50%}@media(max-width:900px){.governance-grid{grid-template-columns:1fr}}@media(max-width:760px){.card-grid{grid-template-columns:1fr}.console-layout{grid-template-columns:1fr}.sidebar{position:static}.content{padding:1.2rem}.page-header{height:auto;align-items:flex-start;flex-direction:column}.baseline{margin-top:1rem}}
a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #f4c95d;outline-offset:2px}.governed-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;align-items:end}.governed-form label,.inline-command-form label{display:grid;gap:5px;font-size:.76rem;color:#526a82}.required-indicator{color:#762b2b;margin-left:.2rem}.governed-form input,.governed-form select,.inline-command-form input,.inline-command-form select{min-height:var(--control-height);border:1px solid #b9c8d8;border-radius:.45rem;background:#fff;color:#15253a;padding:.4rem .55rem;min-width:0}.governed-form button,.inline-command-form button,.confirmation-panel button{min-height:var(--control-height);border:1px solid #245f9d;border-radius:.45rem;background:#245f9d;color:#fff;padding:.4rem .7rem;font-weight:700}.inline-command-form{display:flex;gap:.4rem;align-items:end;flex-wrap:wrap}.inline-command-form button{font-size:.68rem}.selector-summary{grid-column:1/-1;border-top:1px solid #e2e8ef;margin-top:.75rem;padding-top:.75rem}.selector-chip{display:inline-flex;margin:.2rem .35rem .2rem 0;border:1px solid #d2dde8;border-radius:999px;padding:.3rem .55rem;font-size:.72rem}.confirmation-panel{border:1px solid #d6b267;background:#fff9e8;border-radius:.6rem;padding:1rem;margin-top:1rem}.confirmation-panel[hidden]{display:none}.command-feedback{margin-bottom:16px}.form-error-summary{grid-column:1/-1;border-left:4px solid #b54444;background:#fff1f1;color:#762b2b;padding:.7rem}.history-list{list-style:none;margin:0;padding:0}.history-list>li+li{border-top:1px solid #e2e8ef}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:760px){.governed-form{grid-template-columns:1fr}.inline-command-form{display:grid;grid-template-columns:1fr}.governed-form button,.inline-command-form button{width:100%}}
@media(max-width:480px){.notice{flex-direction:column}.mode-badge,.status-badge{white-space:normal}.content section,.development-card{padding:1rem}}
@media(forced-colors:active){.console-layout,.nav-link,.mode-badge,.status-badge,.notice{forced-color-adjust:auto}.nav-link.active{outline:2px solid CanvasText}.status-dot{border:1px solid CanvasText}}
`;
