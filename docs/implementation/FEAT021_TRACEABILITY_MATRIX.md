# FEAT-021 UI / Accessibility Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-033 |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | UI/UAT/Quality Owner |
| Evidence date | 2026-09-06 |
| Canonical Feature | FEAT-021 — UI / Accessibility |

## 1. Objective

FEAT-021-A의 37-screen inventory와 identity reconciliation을 보존하면서 FEAT-021-B shared shell, navigation 및 accessibility primitive 요구사항을 Production implementation, 직접 test, browser evidence와 completion evidence에 연결한다. 이 matrix는 current 13 Console route에 대한 B단계 evidence만 기록하며 dependency-gated screen을 구현 완료로 승격하지 않는다.

## 2. FEAT-021-B end-to-end traceability

| Requirement | Canonical source | Production evidence | Direct verification | Result |
|---|---|---|---|---|
| Single shared shell / landmark hierarchy | Book 7; FEAT-021-A F21-GAP-001/002 | `apps/admin-console/src/console-renderer.ts` `renderConsoleShell()` | `FEAT-021-B shell exposes the canonical landmark navigation and announcement contract`; browser 13/13 | VERIFIED |
| Skip to main content | Accessibility Guide; TEST-038 | shell skip link, focusable `#console-content` | first browser Tab focuses skip link; Enter focuses main | VERIFIED |
| Primary navigation / breadcrumb / current route | Navigation Model; 37-screen inventory | immutable `navigation`, `renderBreadcrumbs()` | renderer test; server route regression; browser 13/13 | VERIFIED |
| Keyboard focus / focus-visible | Accessibility Guide; TEST-038/054/055 | shared CSS focus selectors; native controls | renderer focus assertions; browser skip journey | VERIFIED |
| Confirmation dialog lifecycle | UI-036 existing controlled action | existing confirmation panel and bounded client focus lifecycle | dialog role/title, entry, Tab trap, Escape, inert background and return-focus assertions | VERIFIED |
| Status and announcements | UI State Standard; TEST-038 | `statusBadge()`, `stateCard()`, `#console-announcements` | status text/label, exact `UNAVAILABLE`, bounded announcement assertions | VERIFIED |
| Form error association | Form Standard; UI-036 | deterministic client validation summary, field IDs, `aria-invalid` and `aria-describedby` | renderer/client contract assertions | VERIFIED |
| Accessible operational tables | Table Standard; current Console tables | labelled Role Assignment/Proposal/history tables and scoped column headers | renderer semantic table assertions | VERIFIED |
| Responsive navigation | Responsive Design; TEST-038 | existing 760px single-column shell and visible primary navigation | CSS regression; browser viewport 600px | VERIFIED |
| Shared primitive contrast | WCAG 2.2 AA direction; FEAT-021-A F21-GAP-006 | preserved Console palette and visible focus/error colors | dependency-free luminance assertions for shared text surfaces; all sampled ratios >= 4.5:1 | VERIFIED_BOUNDED |
| Safe UI states / authority preservation | UI State Standard; Security Registry | presentation-only renderer/client; no API/command/role/capability additions | safe-error regression, dependency-gated unavailable assertions, diff review | VERIFIED |

## 3. Test Registry mapping

| Test ID | FEAT-021-B evidence | Status |
|---|---|---|
| TEST-038 | current 13 routes: landmarks, labels, skip/focus, status, form/dialog/table, responsive and shared contrast assertions | MAPPED / PASS — B shared-primitives slice; full UI-001~037 coverage remains dependency-gated |
| TEST-054 | Collector/Agent/Reviewer owning screens inherit the shared primitive contract when implemented; no role authority inferred by UI | MAPPED / PASS — B shared contract; persona journey execution remains dependency-gated |
| TEST-055 | current Administration/Operations Console shell, UI-006/UI-031~036 supporting routes and UI-036 controlled presentation | MAPPED / PASS — B Admin/Ops shared-primitives slice; missing Manager screens remain dependency-gated |

## 4. Scope and preservation

| Control | Result |
|---|---|
| Canonical screen count | 37/37 preserved; new screens 0 |
| Backend-ready / dependency-gated / POST-MVP | 6 / 30 / 1 preserved |
| New business authority / API ID / operation | 0 / 0 / 0 |
| Production business mutation | 0 |
| Dependency / lockfile change | 0 / 0 |
| Provider / network / credential activation | 0 |
| Full WCAG conformance claim | 0 — shared-primitives evidence only |

## 5. Completion evidence

- [FEAT-021-A canonical inventory](../reviews/FEAT021_A_CANONICAL_UI_ACCESSIBILITY_CONTRACT_INVENTORY_REPORT.md)
- [FEAT-021 identity reconciliation](../reviews/FEAT021_IDENTITY_ROADMAP_RECONCILIATION_REPORT.md)
- [FEAT-021-B completion](../reviews/FEAT021_B_SHARED_SHELL_NAVIGATION_ACCESSIBILITY_PRIMITIVES_COMPLETION.md)
