# FEAT-021-B Shared Shell / Navigation / Accessibility Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Existing zero-dependency Admin Console에 하나의 canonical shared shell과 reusable accessibility primitives를 구현하고 current 13 routes의 navigation, focus, status, form, table 및 responsive semantics를 보강한다.

**Architecture:** Existing `renderConsoleShell()` remains the only shell and existing Console read/command boundaries remain unchanged. Renderer and thin browser client gain semantic HTML, bounded focus management and reusable presentation-only accessibility behavior; no backend authority, API, business state, screen, dependency or provider behavior changes.

**Tech Stack:** Node.js 24.18.0, pnpm 11.9.0, vanilla TypeScript/HTML/CSS, built-in `node:test`, zero new dependencies.

**Spec:** `docs/reviews/FEAT021_A_CANONICAL_UI_ACCESSIBILITY_CONTRACT_INVENTORY_REPORT.md` and `docs/reviews/FEAT021_IDENTITY_ROADMAP_RECONCILIATION_REPORT.md`

## Global Constraints

- Preserve exactly 37 canonical screens; add no screen ID.
- Preserve current 13 implemented Console routes; do not link dependency-gated or POST-MVP screens as operational.
- Add no API ID, command, role, capability, lifecycle state, authority or backend authorization logic.
- Keep UI state separate from canonical domain state.
- Add no runtime/frontend dependency and do not alter package manifests or lockfiles.
- Preserve current Console visual language and zero-dependency runtime.
- Use RED → minimum GREEN for every production behavior change.
- Dependency audit requires separate FEAT-021-B-scoped registry authorization if the final gate requires it.

---

## FEAT-021-B Shared Shell / Accessibility Gap Matrix

| Area | Current implementation | Canonical requirement | Current behavior | Exact gap | Minimum reusable correction | Affected screens |
|---|---|---|---|---|---|---|
| A. Root shell | one `renderConsoleShell()` | one canonical shell | PASS | none | retain single shell; architecture assertion | current 13 routes |
| B. Page header | `<header class="page-header">` inside main | global banner plus page context | PARTIAL | no explicit banner identity or heading target | label header as banner; give page heading stable focus target | current 13 routes |
| C. Global navigation | one named nav with implemented routes | stable semantic primary navigation | PASS/PARTIAL | no explicit primary-nav identity | stable `id` and `aria-label="Primary"`; retain authorized existing routes only | current 13 routes |
| D. Section navigation | four grouped sections | named domain grouping | PASS | none | retain heading-labelled groups | current 13 routes |
| E. Breadcrumbs | absent | semantic context path | GAP | no programmatic route hierarchy | derive Home/section/current breadcrumb from existing route inventory | current 13 routes |
| F. Active route | class plus `aria-current="page"` | programmatic current page | PASS | none | retain and strengthen focused regression | current 13 routes |
| G. Skip navigation | `Skip to content` → focusable main | exact meaningful first target | PARTIAL | label differs from approved `Skip to main content` contract | exact label and stable main target | current 13 routes |
| H. Main landmark | one `<main tabindex="-1">` | one primary main | PASS/PARTIAL | main is not labelled by page heading | `aria-labelledby` to stable `h1` | current 13 routes |
| I. Keyboard focus order | native links/buttons/forms | predictable DOM order | PASS/PARTIAL | confirmation overlay has no bounded focus lifecycle | preserve document order; add dialog-only focus lifecycle | UI-036 plus shell |
| J. Focus visible | nav links/buttons only | all interactive controls visible | GAP | input/select/textarea focus not styled | shared `:focus-visible` selector for links/buttons/form controls | UI-036/current 13 |
| K. Narrow navigation | sidebar becomes static stacked content | no off-screen actions; keyboard preserved | PASS | no hidden menu exists, so no menu focus lifecycle applies | retain stacked navigation and assert no display suppression | current 13 routes |
| L. Dialog primitive | hidden confirmation panel | dialog semantics, entry/trap/Escape/restore | GAP | no dialog role, label, trap or focus restoration | upgrade existing panel only; do not add another modal system | UI-036 |
| M. Alert/status | textual badges; safe alert on error | text plus bounded semantics | PARTIAL | badge lacks explicit accessible status label; whole result root is live | safe `aria-label`; dedicated announcement region | current 13 routes |
| N. Form field/error | wrapping labels/native required | programmatic invalid association and summary | PARTIAL/GAP | no deterministic summary/field focus on invalid submit | browser client creates bounded summary, IDs invalid control, sets `aria-invalid`, focuses summary | UI-036 |
| O. Button/action | native buttons and anchors | action/navigation semantics | PASS | none | architecture assertions against clickable div/span and empty anchors | current 13 routes |
| P. Loading/empty/error | canonical Console states and safe errors | consistent UI-only states | PARTIAL | UNAVAILABLE renders noncanonical presentation code `READ_BOUNDARY_MISSING` | render exact `UNAVAILABLE`; retain safe error mapping | current 13 routes |
| Q. Announcements | `aria-live` on entire result root | bounded meaningful announcements | GAP | each result replacement may announce excessive content | dedicated atomic status region; announce load/command outcome only | current 13 routes |
| R. Tables | semantic table/th plus overflow | caption/label and scoped headers | PARTIAL | current header tables lack captions and `scope="col"`; history table lacks label | add safe labels/captions and scoped headers without changing data | UI-006/031–035/036/supporting views |
| S. Duplicate primitives | one shell, repeated small markup helpers | no competing shell/layout system | PASS/PARTIAL | accessibility behaviors remain inline and inconsistent | keep one file/boundary; consolidate only RED-proven helpers | current 13 routes |

Dependency-gated screen preservation: 30 screens remain non-operational; UI-007 remains POST-MVP. No new route or navigation item is permitted by this plan.

---

### Task 1: Shell, landmark, navigation and announcement semantics

**Files:**
- Modify: `apps/admin-console/src/console-renderer.test.ts`
- Modify: `apps/admin-console/src/console-renderer.ts`

**Interfaces:**
- Consumes: existing `renderConsoleShell(page, publicationId)` and `ConsolePage` route identity.
- Produces: same function signature with canonical banner/primary-nav/breadcrumb/main/announcement markup.

- [ ] **Step 1: Write failing shell tests**

Add assertions for exact `Skip to main content`, `role="banner"`, primary and breadcrumb navigation names, `aria-current="page"`, `main aria-labelledby="console-page-title"`, focusable `h1`, a dedicated `role="status"` announcement region and absence of `aria-live` on `#console-view`.

- [ ] **Step 2: Verify RED**

Run: direct TypeScript build followed by `node --test dist/apps/admin-console/src/console-renderer.test.js --test-name-pattern="FEAT-021-B shell"`.

Expected: FAIL because exact skip text, banner, breadcrumbs, labelled main and dedicated announcement region are absent.

- [ ] **Step 3: Implement minimum shell correction**

Keep `renderConsoleShell()` as the sole shell. Derive breadcrumbs from the existing immutable navigation structure, label the page heading and main, and add one visually hidden atomic status region. Do not add routes.

- [ ] **Step 4: Verify GREEN**

Run the same focused test and the existing renderer suite. Expected: PASS.

### Task 2: Visible focus and confirmation-dialog lifecycle

**Files:**
- Modify: `apps/admin-console/src/console-renderer.test.ts`
- Modify: `apps/admin-console/src/console-renderer.ts`

**Interfaces:**
- Consumes: existing `CONSOLE_BROWSER_CLIENT`, existing UI-036 confirmation panel.
- Produces: presentation-only focus entry, Tab containment, Escape close and invoker restoration.

- [ ] **Step 1: Write failing focus/dialog tests**

Assert form controls are included in shared `:focus-visible`; confirmation markup contains `role="dialog"`, `aria-modal="true"` and an accessible title; the browser client records the invoker, focuses the confirm button, handles Tab/Escape only while open, and restores focus on close.

- [ ] **Step 2: Verify RED**

Run the focused `FEAT-021-B focus` tests. Expected: FAIL because current panel has no dialog semantics or focus lifecycle and form controls lack focus-visible styling.

- [ ] **Step 3: Implement minimum focus correction**

Upgrade only the existing confirmation panel, add bounded helpers inside the existing browser client and extend the shared CSS selector. Do not add a second dialog implementation.

- [ ] **Step 4: Verify GREEN**

Run focused tests and renderer regression. Expected: PASS.

### Task 3: Status, form-error, table and UI-state primitives

**Files:**
- Modify: `apps/admin-console/src/console-renderer.test.ts`
- Modify: `apps/admin-console/src/console-renderer.ts`

**Interfaces:**
- Consumes: existing textual `statusBadge`, `stateCard`, UI-036 forms and current tables.
- Produces: safe accessible labels, bounded error summary behavior and labelled tables without changing business data.

- [ ] **Step 1: Write failing primitive tests**

Assert badges expose `aria-label="Status: …"`; UNAVAILABLE uses exact UI-state text; header tables provide a safe caption/label and `scope="col"`; invalid forms create a safe focused error summary, link to invalid fields and never render backend exception detail.

- [ ] **Step 2: Verify RED**

Run focused `FEAT-021-B primitives` tests. Expected: FAIL on missing status label, noncanonical unavailable label, missing scoped headers/table labels and absent validation-summary behavior.

- [ ] **Step 3: Implement minimum primitive correction**

Modify only renderer/browser-client presentation helpers and existing table markup. Preserve current result DTOs, API calls, operation names and backend authority.

- [ ] **Step 4: Verify GREEN**

Run focused tests and current Console tests. Expected: PASS.

### Task 4: Contrast, responsive and architecture preservation

**Files:**
- Modify: `apps/admin-console/src/console-renderer.test.ts`
- Modify only if RED proves necessary: `apps/admin-console/src/console-renderer.ts`

**Interfaces:**
- Consumes: existing CSS colors, current 760px responsive rule and route inventory.
- Produces: repeatable dependency-free shared primitive contrast evidence and architecture assertions.

- [ ] **Step 1: Add contrast/responsive tests**

Use a test-local WCAG relative-luminance helper to assert shared foreground/background ratios: body and secondary text ≥ 4.5:1; navigation text and button text ≥ 4.5:1; focus indicator against adjacent dark surface ≥ 3:1. Assert narrow navigation remains in document flow, interactive controls remain reachable, current-page semantics remain present and route/nav counts remain 13 with no dependency-gated screen route.

- [ ] **Step 2: Run focused tests**

Expected: PASS if current approved tokens satisfy ratios; otherwise RED identifies the exact token requiring minimum correction.

- [ ] **Step 3: Apply only RED-proven token correction if required**

Change only the failing semantic color token and rerun the exact test. No visual redesign.

- [ ] **Step 4: Run Console and F20 regression**

Run all compiled `apps/admin-console/src/*.test.js` tests and affected F20 Console tests. Expected: PASS.

### Task 5: Verification, traceability and completion evidence

**Files:**
- Create: `docs/implementation/FEAT021_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/FEAT021_B_SHARED_SHELL_NAVIGATION_ACCESSIBILITY_PRIMITIVES_COMPLETION.md`
- Modify: `docs/00_MASTER_INDEX.md`

**Interfaces:**
- Consumes: verified production/test evidence only.
- Produces: DOC-DEV-033 traceability, DOC-REVIEW-123 completion evidence and Master Index registration.

- [ ] **Step 1: Run focused and affected gates**

Run FEAT-021-B renderer, shell/navigation/focus/primitives/responsive tests; all Console tests; F20 affected regression.

- [ ] **Step 2: Run final repository gates once**

Run lint, typecheck, build, verify/full suite, architecture checksum, Document ID validation, local-link validation, `git diff --check` and Gitleaks. If dependency audit requires network authorization, stop and request FEAT-021-B-scoped approval before audit.

- [ ] **Step 3: Perform independent review**

Review canonical scope, authority preservation, accessibility behavior, regression evidence and changed-path boundaries. Required: Critical 0 / Important 0 / READY.

- [ ] **Step 4: Write evidence documents**

Record only actual results, preserve `IMP-021 = PLANNED`, map TEST-038/054/055 as bounded supporting evidence, and state that this is not whole-feature WCAG conformance.

- [ ] **Step 5: Create one bounded local commit and integrate**

After every gate passes, create exactly one local FEAT-021-B commit, keep push NOT_PERFORMED, fast-forward main without source rewrite, verify both worktrees clean, then follow the current authorization boundary for the next canonical FEAT-021 subphase.
