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

FEAT-021-A의 37-screen inventory와 identity reconciliation을 보존하면서 FEAT-021-B shared shell, FEAT-021-C current-route hardening, FEAT-021-D bounded UAT 및 FEAT-021-E final evidence 요구사항을 Production implementation, 직접 test, browser evidence와 completion evidence에 연결한다. 이 matrix는 current 13 Console route의 검증된 B/C/D/E evidence만 기록하며 dependency-gated screen을 구현 완료로 승격하지 않는다.

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
| Accessible operational tables | Table Standard; current Console tables | labelled Role Assignment/Proposal tables and scoped column headers; single-column history uses labelled list | renderer semantic collection assertions | VERIFIED |
| Responsive navigation | Responsive Design; TEST-038 | existing 760px single-column shell and visible primary navigation | CSS regression; browser viewport 600px | VERIFIED |
| Shared primitive contrast | WCAG 2.2 AA direction; FEAT-021-A F21-GAP-006 | preserved Console palette and visible focus/error colors | dependency-free luminance assertions for shared text surfaces; all sampled ratios >= 4.5:1 | VERIFIED_BOUNDED |
| Safe UI states / authority preservation | UI State Standard; Security Registry | presentation-only renderer/client; no API/command/role/capability additions | safe-error regression, dependency-gated unavailable assertions, diff review | VERIFIED |

## 2.1 FEAT-021-C current-route hardening traceability

| Requirement | Canonical source | Production evidence | Direct verification | Result |
|---|---|---|---|---|
| Unavailable UI-036 is non-operational | FEAT-021-A dependency/state contract; UI-036 | `renderControlledAdministration()` returns bounded unavailable overview when canonical selectors are absent | `FEAT-021-C UI-036 unavailable selectors expose no executable form` | VERIFIED |
| History/evidence collection semantics | Table Standard; TEST-038 | `historySection()` renders labelled list for one-dimensional history | `FEAT-021-C history and evidence collections use a labelled list rather than a headerless table` | VERIFIED |
| Visible/programmatic required state | Form Standard; UI-036 | `requiredLabel()`, existing wrapping labels and native `required` | `FEAT-021-C governed forms expose required, consequence and in-flight semantics` | VERIFIED |
| Privileged-action consequence | UI-036 confirmation contract | existing dialog now states governed-state consequence and backend authority boundary | same focused FEAT-021-C test; Console regression | VERIFIED |
| In-flight submission state | Form/Accessibility Guide | thin client sets form `aria-busy` and button disabled/`aria-disabled`, and clears on rejected/unavailable result | same focused FEAT-021-C test | VERIFIED |

## 2.2 FEAT-021-D keyboard / AX / reflow / role UAT traceability

| Requirement | Canonical source | Production/evidence boundary | Direct verification | Result |
|---|---|---|---|---|
| Current 13-route screen-reader shell | Accessibility Guide; TEST-038 | existing shared shell across all current `ConsolePage` values | `FEAT-021-D all current routes preserve the shared screen-reader shell contract`; server 13-route regression | VERIFIED |
| Read-only versus controlled-write role boundary | FEAT-021-A role UAT; TEST-054/055 | existing UI-031 diagnostic-only actions and UI-036 fail-closed selector rendering | `FEAT-021-D role UAT preserves read-only and controlled-write presentation boundaries` | VERIFIED_BOUNDED |
| Narrow reflow | Responsive Strategy; TEST-038 | 760px shell stacking plus 480px notice/badge wrapping | focused CSS assertion; existing browser narrow evidence | VERIFIED_BOUNDED |
| Forced-colors status/current-route semantics | Accessibility Guide; WCAG 2.2 AA direction | forced-color-adjust, current-route outline and status-dot system border | `FEAT-021-D shared CSS preserves narrow reflow and forced-colors semantics` | VERIFIED_BOUNDED |
| Actual accessibility tree / safe UI-036 | TEST-038/055 | development Console through existing server/renderer | in-app browser: Primary navigation, Breadcrumb, H1, one main, canonical UNAVAILABLE, forms 0, submit buttons 0, forbidden output 0 | VERIFIED |
| Dependency-ready missing screens | FEAT-021-A 6/30/1 classification | no additional backend-ready screen exists beyond current mapped surfaces | inventory review; new route/screen diff 0 | NOT_APPLICABLE / PRESERVED |

## 2.3 FEAT-021-E traceability / evidence closure

| Requirement | Canonical source | Production/evidence boundary | Direct verification | Result |
|---|---|---|---|---|
| Canonical screen boundary | FEAT-021-A 37-screen inventory | committed B/C/D implementation only; new screen/route 0 | final diff and inventory review | VERIFIED — 37/37 preserved; 6 UI-ready / 30 dependency-blocked / 1 POST-MVP |
| Current-route regression | FEAT-021-A E phase gate; TEST-038/055 | seven existing Console test modules | Console focused 71/71; repository full gate 992/992 | VERIFIED |
| Browser accessibility shell | Accessibility Guide; TEST-038 | compiled development Console through existing server/renderer | actual browser 13/13: Primary, Breadcrumb, H1 and one main; skip activation focuses `#console-content` | VERIFIED_BOUNDED |
| Safe rendered evidence | Security Registry; UI State Standard | existing safe renderer/read boundaries | actual browser 13/13 forbidden stack/path/token/Session/raw-provider pattern findings 0 | VERIFIED |
| WCAG target and claim boundary | Book 7 WCAG 2.2 AA target; FEAT-021-A | B/C/D primitives and committed current routes only | focused assertions, browser tree and independent review | VERIFIED_BOUNDED — full conformance not claimed |
| Evidence closure | FEAT-021-A FEAT-021-E row | this RTM, DOC-REVIEW-126 and Master Index | Document ID/link validation, checksum/delta, Gitleaks, fresh review | VERIFIED |

## 2.4 FEAT-021 Final Gate traceability

| Final Gate requirement | Canonical disposition | Verified evidence | Result |
|---|---|---|---|
| FG-01 Canonical Screen Integrity | `UI-001`~`UI-037` identity 37/37 preserved | FEAT-021-A inventory and final repository review | VERIFIED |
| FG-02 Eligible Screen Implementation | current backend-ready screens 6개를 implemented/verified scope로 인정 | FEAT-021-B/C/D/E reports; Console focused 71/71; browser 13/13 | VERIFIED |
| FG-03 Dependency Disposition | 30개는 owning backend/workflow가 준비될 때까지 `DEPENDENCY_BLOCKED` | FEAT-021-A inventory; fake operational implementation 0; new API 0 | VERIFIED |
| FG-04 POST-MVP Boundary | `UI-007`은 MVP completion에서 제외 | FEAT-021-A inventory; screen identity preserved | VERIFIED |
| FG-05~08 Accessibility | shared shell/navigation, keyboard/focus/reflow, semantic role와 bounded contrast | direct Console tests 71/71; actual browser landmarks/skip focus 13/13; sampled contrast >= 4.5:1 | VERIFIED_BOUNDED |
| FG-09 TEST-038/054/055 | eligible scope PASS; blocked scope `NOT_APPLICABLE_PENDING_DEPENDENCY`; `UI-007` `OUT_OF_SCOPE` | 아래 Test Registry mapping과 FEAT-021-D/E evidence | VERIFIED |
| FG-10 Browser Acceptance | implemented 13-route Console surface | actual browser 13/13; security finding 0 | VERIFIED |
| FG-11 Security / Authority | business authority/API/provider/network/credential 추가 금지 | Production diff 0; new API/authority 0; rendered unsafe-output finding 0 | VERIFIED |
| FG-12 Documentation | RTM, Document ID, local links | valid metadata IDs 393; duplicate/unregistered 0; local links 4,222; broken 0 | VERIFIED |
| FG-13 Regression / Build | lint/typecheck/build/verify와 regression PASS | fresh full regression 992/992 PASS | VERIFIED |
| FG-14 Architecture | immutable 153/153 checksum과 approved current delta 보존 | SHA-256 `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`; current 149/153, CR-027 delta 4 | VERIFIED |
| FG-15 Independent Review | Critical 0 / Important 0; READY | [FEAT-021 Final Gate](../reviews/FEAT021_FINAL_GATE_REPORT.md) | VERIFIED |

Final Gate completion은 37개 화면 전체가 backend-operational이라는 뜻이 아니다. 현재 eligible UI/accessibility boundary와 non-eligible disposition의 완결을 뜻하며, full 37-screen WCAG 2.2 AA conformance는 주장하지 않는다.

## 3. Test Registry mapping

| Test ID | FEAT-021-B~E evidence | Status |
|---|---|---|
| TEST-038 | 37 identities와 `6 eligible / 30 DEPENDENCY_BLOCKED / 1 POST_MVP` disposition; current 13 routes landmarks, labels, skip/focus, status, form/dialog/table, responsive와 shared contrast | PASS — exact inventory/disposition preserved; unavailable backend screens need not become executable |
| TEST-054 | eligible/implemented Collector/Agent/Reviewer surfaces의 applicable keyboard, semantic, focus, reflow, name/role/current-state evidence | PASS — eligible scope; blocked persona paths `NOT_APPLICABLE_PENDING_DEPENDENCY` |
| TEST-055 | eligible Administration/Operations Console shell, UI-006/UI-031~036 supporting routes와 UI-036 controlled presentation | PASS — eligible persona paths; blocked paths `NOT_APPLICABLE_PENDING_DEPENDENCY`; `UI-007` `OUT_OF_SCOPE` |

FEAT-021-C adds direct TEST-038 evidence for the five rows above and bounded TEST-055 UI-036 evidence. It does not complete dependency-gated persona journeys.

FEAT-021-D adds bounded current-route TEST-038 and TEST-055 evidence. TEST-054 role screens remain dependency-gated; no persona name is treated as authority.

FEAT-021-E reruns the committed current-route and repository gates and closes evidence only. It does not convert the remaining TEST-038/054/055 dependency-gated journeys into implemented screens or full WCAG conformance.

The approved Final Gate amendment supersedes only the earlier assumption that dependency-blocked journey execution was required for FEAT-021 completion. It preserves every canonical identity and records `TEST-038/054/055` as PASS within the explicitly bounded eligible scope.

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
- [FEAT-021-C completion](../reviews/FEAT021_C_CURRENT_ROUTE_ACCESSIBILITY_HARDENING_COMPLETION.md)
- [FEAT-021-D completion](../reviews/FEAT021_D_KEYBOARD_AX_REFLOW_ROLE_UAT_COMPLETION.md)
- [FEAT-021-E traceability / evidence closure](../reviews/FEAT021_E_TRACEABILITY_EVIDENCE_CLOSURE_REPORT.md)
- [FEAT-021 Final Gate](../reviews/FEAT021_FINAL_GATE_REPORT.md)

## 6. REL-001 Phase 5A downstream inventory overlay

Phase 5A는 기존 `6 eligible / 30 dependency-blocked / 1 POST-MVP`를 그대로 적용한다. REL-001 required Console screens는 UI-006/031/032/033/035/036의 6개이며 current eligible surface `6/6`, Staging executable `0/6`이다. UI-034는 supporting Job status evidence가 있어도 canonical screen 구현으로 승격하지 않는다. 새 screen/route와 full 37-screen WCAG conformance claim은 모두 `0`이다. Evidence: [Phase 5A Screen Mapping](REL001_PHASE5A_CONSOLE_SCREEN_RUNTIME_MAPPING.md).
