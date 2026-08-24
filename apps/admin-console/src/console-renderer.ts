import type { ConsolePage, ConsoleReadResult } from "./console-read-adapter.js";

const pageTitles: Readonly<Record<ConsolePage, string>> = Object.freeze({
  DASHBOARD: "Dashboard",
  "UI-031": "Publication Operations",
  "UI-032": "Publication Revalidation",
  "UI-033": "Publication Recovery",
  "UI-035": "Audit / History",
  ADMINISTRATION: "Administration",
  PROJECTION: "Projection Status",
  OPERATIONS: "Operations / Health",
});

const navigation = Object.freeze([
  Object.freeze({ section: "Overview", items: Object.freeze([{ page: "DASHBOARD" as const, label: "Dashboard", path: "/" }]) }),
  Object.freeze({ section: "Publication", items: Object.freeze([
    { page: "UI-031" as const, label: "Operations", path: "/publication/operations" },
    { page: "UI-032" as const, label: "Revalidation", path: "/publication/revalidation" },
    { page: "UI-033" as const, label: "Recovery", path: "/publication/recovery" },
    { page: "UI-035" as const, label: "Audit / History", path: "/publication/audit" },
  ]) }),
  Object.freeze({ section: "Administration", items: Object.freeze([{ page: "ADMINISTRATION" as const, label: "Overview", path: "/administration" }]) }),
  Object.freeze({ section: "System", items: Object.freeze([
    { page: "PROJECTION" as const, label: "Projection", path: "/system/projection" },
    { page: "OPERATIONS" as const, label: "Operations / Health", path: "/system/operations" },
  ]) }),
]);

export function renderConsoleShell(page: ConsolePage, publicationId?: string): string {
  const selected = publicationId === undefined || publicationId.trim().length === 0 ? "" : publicationId;
  const navigationHtml = navigation.map(({ section, items }) => `
      <section class="nav-section" aria-labelledby="nav-${slug(section)}">
        <h2 id="nav-${slug(section)}">${escapeHtml(section)}</h2>
        ${items.map((item) => `<a class="nav-link${item.page === page ? " active" : ""}" href="${item.path}${selected === "" ? "" : `?publicationId=${encodeURIComponent(selected)}`}"${item.page === page ? " aria-current=\"page\"" : ""}>${escapeHtml(item.label)}</a>`).join("")}
      </section>`).join("");
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
  <a class="skip-link" href="#console-content">Skip to content</a>
  <div class="console-layout">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">AI</span><strong>AI-MLS ADMIN</strong></div>
      <nav aria-label="Admin Console">${navigationHtml}</nav>
      <div class="baseline"><span>Development Console</span><strong>feat-015-complete</strong></div>
    </aside>
    <main id="console-content" class="content" tabindex="-1">
      <header class="page-header">
        <div><p class="eyebrow">READ-ONLY VISIBILITY</p><h1>${escapeHtml(pageTitles[page])}</h1></div>
        <span class="mode-badge">NON-AUTHORITATIVE</span>
      </header>
      <div id="console-view" aria-live="polite" aria-busy="true">
        <section class="state-card loading-state"><span class="spinner" aria-hidden="true"></span><h2>Loading...</h2><p>Reading bounded FEAT-015 status.</p></section>
      </div>
    </main>
  </div>
  <script>${CONSOLE_BROWSER_CLIENT}</script>
</body>
</html>`;
}

export function renderConsoleResult(result: ConsoleReadResult): string {
  if (result.state === "LOADING") return stateCard("LOADING", result.message ?? "Reading bounded administration status.");
  if (result.state === "EMPTY") return stateCard("EMPTY", result.message ?? "No records are currently available.");
  if (result.state === "UNAVAILABLE") return stateCard("READ_BOUNDARY_MISSING", result.message ?? "Not available in current backend.");
  if (result.state === "NOT_AUTHORIZED") return stateCard("NOT AUTHORIZED", result.message ?? "Not authorized.");
  if (result.state === "ERROR") {
    const error = result.error;
    return `<section class="state-card error-state"><p class="eyebrow">SAFE ERROR</p><h2>${escapeHtml(error?.code ?? "CONSOLE_READ_UNAVAILABLE")}</h2><p>${escapeHtml(error?.message ?? "The requested Console view is unavailable.")}</p><p class="reference">Reference: ${escapeHtml(error?.correlationId ?? "console-correlation-unavailable")}</p></section>`;
  }
  const data = result.data ?? Object.freeze({});
  switch (result.page) {
    case "DASHBOARD": return renderDashboard(data);
    case "UI-031": return renderPublicationOperations(data);
    case "UI-032": return renderRevalidation(data);
    case "UI-033": return renderRecovery(data);
    case "UI-035": return renderAudit(data);
    case "ADMINISTRATION": return renderAdministration(data);
    case "PROJECTION": return renderProjection(data);
    case "OPERATIONS": return renderOperations(data);
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
  const fields = select(data, ["publicationId", "lifecycle", "suspensionStatus", "aggregateVersion", "publicationVersion", "effectiveVersion", "target", "channel", "currentOperationState", "stale"]);
  return `<section><div class="section-heading"><div><p class="eyebrow">UI-031 · API-014</p><h2>Publication Operations</h2></div>${statusBadge(data["lifecycle"])}</div>${definitionGrid(fields)}</section>
  <section aria-labelledby="available-actions"><div class="section-heading"><div><p class="eyebrow">DIAGNOSTIC ONLY</p><h2 id="available-actions">Available Actions</h2></div><span class="mode-badge">NON-EXECUTABLE</span></div><div class="action-list">${actions.length === 0 ? "<p>No authorized actions are currently advertised.</p>" : actions.map((action) => `<button type="button" disabled aria-disabled="true">${escapeHtml(action)}</button>`).join("")}</div></section>`;
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
  <section aria-labelledby="role-assignments"><div class="section-heading"><div><p class="eyebrow">GOVERNED ACCESS</p><h2 id="role-assignments">Role Assignments</h2></div>${statusBadge(data["roleAssignmentsTruncated"] === true ? "PARTIAL" : roleAssignments["state"])}</div>${data["roleAssignmentsTruncated"] === true ? '<p class="empty-inline">Showing the first authorized page; more assignments are available.</p>' : ""}${rows.length === 0 ? '<p class="empty-inline">No role assignments are currently available.</p>' : `<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Subject</th><th>Role</th><th>Scope</th><th>Status</th><th>Version</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row["roleAssignmentId"])}</td><td>${escapeHtml(row["subjectPrincipalReference"])}</td><td>${escapeHtml(row["roleId"])}</td><td>${escapeHtml(`${displayValue(row["scopeType"])} · ${displayValue(row["scopeId"])}`)}</td><td>${statusBadge(row["status"])}</td><td class="numeric">${escapeHtml(displayValue(row["version"]))}</td></tr>`).join("")}</tbody></table></div>`}</section>
  <div class="governance-grid">${unavailableAdministrationSection("Policy Governance", data["policyGovernance"], "Select a canonical Policy ID to inspect status.")}${unavailableAdministrationSection("Source Governance", data["sourceGovernance"], "Select a canonical Source ID to inspect status.")}${unavailableAdministrationSection("Target Governance", data["targetGovernance"], "Select a canonical Target ID to inspect status.")}</div>
  ${unavailableAdministrationSection("Recent Decisions", data["recentDecisions"], "Not available through the current API-015 runtime read boundary.")}
  <p class="scope-note">Read-only governance visibility. UI-036 controlled write actions are not available.</p>`;
}

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
  <section><div class="section-heading"><div><p class="eyebrow">BOUNDED METRICS</p><h2>Operational evidence</h2></div></div>${definitionGrid(metrics)}</section>`;
}

function historySection(title: string, entries: readonly unknown[]): string {
  if (entries.length === 0) return `<section><h2>${escapeHtml(title)}</h2><p class="empty-inline">No entries are currently available.</p></section>`;
  return `<section><h2>${escapeHtml(title)}</h2><div class="table-wrap"><table><tbody>${entries.map((entry) => `<tr><td>${isRecord(entry) ? definitionGrid(entry) : escapeHtml(entry)}</td></tr>`).join("")}</tbody></table></div></section>`;
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
  return `<span class="status-badge" data-status="${escapeHtml(slug(display))}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(display)}</span>`;
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
  const page = document.body.dataset.consolePage;
  if (!root || !page) return;
  const query = new URLSearchParams(window.location.search);
  const request = new URLSearchParams({ page });
  const publicationId = query.get("publicationId");
  if (publicationId) request.set("publicationId", publicationId);
  fetch("/api/console/view?" + request.toString(), { headers: { accept: "application/json" } })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("SAFE_HTTP_FAILURE")))
    .then((payload) => {
      root.innerHTML = typeof payload.html === "string" ? payload.html : "<section class=\"state-card error-state\"><h2>CONSOLE_READ_UNAVAILABLE</h2><p>The requested Console view is unavailable.</p></section>";
      root.setAttribute("aria-busy", "false");
    })
    .catch(() => {
      root.innerHTML = "<section class=\"state-card error-state\"><h2>CONSOLE_READ_UNAVAILABLE</h2><p>The requested Console view is unavailable.</p></section>";
      root.setAttribute("aria-busy", "false");
    });
})();`;

export const CONSOLE_STYLES = `
:root{--radius:10px;--control-height:32px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#15253a;background:#f3f6fa;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-width:320px}.skip-link{position:fixed;left:1rem;top:-4rem;z-index:10;background:#fff;padding:.75rem;border-radius:.5rem}.skip-link:focus{top:1rem}.console-layout{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.sidebar{background:#10243e;color:#dbe8f6;padding:24px;display:flex;flex-direction:column;gap:1.5rem}.brand{display:flex;align-items:center;gap:.75rem}.brand-mark{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:.7rem;background:#3bd2b1;color:#092033;font-weight:800}.nav-section{margin-top:1rem}.nav-section h2{font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:#8198b3}.nav-link{display:block;color:#dbe8f6;text-decoration:none;padding:.7rem .8rem;margin:.2rem 0;border-radius:.5rem}.nav-link:hover,.nav-link.active{background:#1c3858;color:#fff}.nav-link:focus-visible,button:focus-visible{outline:3px solid #f4c95d;outline-offset:2px}.baseline{margin-top:auto;border-top:1px solid #31506e;padding-top:1rem;display:grid;gap:.3rem;font-size:.76rem;color:#9eb2c8}.content{padding:24px;min-width:0;max-width:1440px;width:100%;margin:0 auto}.page-header,.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.page-header{height:48px;margin-bottom:16px}.page-header h1{font-size:1.45rem;line-height:1.2;margin:.1rem 0}.eyebrow{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#58718b;font-weight:750}.mode-badge,.status-badge{display:inline-flex;align-items:center;gap:.45rem;border:1px solid #c9d5e2;border-radius:999px;padding:.45rem .7rem;background:#fff;font-size:.72rem;font-weight:750;white-space:nowrap}.status-dot{width:.55rem;height:.55rem;border-radius:50%;background:#1ead86}[data-status="unavailable"] .status-dot{background:#8198b3}[data-status="revoked"] .status-dot,[data-status="rejected"] .status-dot,[data-status="blocked"] .status-dot{background:#b54444}[data-status="pending"] .status-dot,[data-status="proposed"] .status-dot{background:#a36a16}.content section,.development-card{background:#fff;border:1px solid #dce4ed;border-radius:var(--radius);padding:1.25rem;margin-bottom:16px;box-shadow:0 8px 24px rgba(38,63,89,.055)}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.75rem}.metric-card{border:1px solid #dce4ed;border-radius:.8rem;padding:1rem;display:grid;gap:.55rem}.metric-card span{font-size:.76rem;color:#64788d}.metric-card strong{font-size:1.05rem}.definition-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.7rem;margin:1rem 0 0}.definition-grid>div{background:#f7f9fc;padding:.8rem;border-radius:.65rem;min-width:0}.definition-grid dt{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#6a7c91}.definition-grid dd{margin:.35rem 0 0;overflow-wrap:anywhere;font-weight:650}.action-list{display:flex;flex-wrap:wrap;gap:.6rem}.action-list button{border:1px solid #c9d5e2;background:#eef2f6;color:#65768a;padding:.65rem .85rem;border-radius:.55rem}.notice{display:flex;justify-content:space-between;gap:1rem;border-left:4px solid #3a80d2;background:#f2f7fd;padding:.8rem 1rem;margin-top:.75rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:720px}th{text-align:left;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#607388;padding:.65rem .5rem;border-bottom:1px solid #dce4ed}td{border-top:1px solid #e2e8ef;padding:.5rem}.state-card{text-align:center;padding:2.5rem!important}.state-card h2{font-size:1.1rem}.error-state{border-color:#eab0b0!important}.numeric{font-variant-numeric:tabular-nums}.governance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.governance-grid .compact-section{margin-bottom:0}.reference,.scope-note,.empty-inline{color:#607388;font-size:.86rem}.spinner{display:inline-block;width:1.4rem;height:1.4rem;border:3px solid #d5e0eb;border-top-color:#2978c8;border-radius:50%}@media(max-width:900px){.governance-grid{grid-template-columns:1fr}}@media(max-width:760px){.card-grid{grid-template-columns:1fr}.console-layout{grid-template-columns:1fr}.sidebar{position:static}.content{padding:1.2rem}.page-header{height:auto;align-items:flex-start;flex-direction:column}.baseline{margin-top:1rem}}
`;
