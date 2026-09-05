# FEAT-021-A Canonical UI/Accessibility Contract & Implemented-Screen Inventory Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-121 |
| Historical Artifact ID | FEAT-021-A-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-05 |
| Brief | FEAT-021-A — Canonical UI/Accessibility Contract & Implemented-Screen Inventory |
| Baseline | `c1b5d8623778e6892ff01da8e5f187d8dca202b7` |
| Final Recommendation | `APPROVE_FEAT_021_A_CANONICAL_UI_ACCESSIBILITY_CONTRACT_INVENTORY` |

## 1. Objective

`FEAT-021`의 frozen identity를 보존하면서 `UI-001`~`UI-037`, 현재 13개 Console route, WCAG 2.2 AA 목표, `TEST-038`/`TEST-054`/`TEST-055`와 historical F20 supporting evidence를 하나의 검증 가능한 UI/accessibility contract로 정렬한다. 이 단계는 inventory와 evidence contract를 정의하며 Production UI 구현이나 backend authority를 확장하지 않는다.

## 2. Documents read

- [Screen Registry](../book-7/15_SCREEN_REGISTRY.md), [Screen Specifications](../book-7/05_SCREEN_SPECIFICATIONS.md), [Accessibility Guide](../book-7/12_ACCESSIBILITY_GUIDE.md).
- [Feature Breakdown](../book-12/03_FEATURE_BREAKDOWN.md), [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md), [Developer Registry](../book-11/15_DEVELOPER_REGISTRY.md).
- [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md), [Test Registry](../book-10/15_TEST_REGISTRY.md), [Security Registry](../00_SECURITY_REGISTRY.md).
- [Current Main Validation](CURRENT_MAIN_EXACT_HEAD_FRESH_INTEGRATED_VALIDATION_RETRY_REPORT.md), [F20 Final Report](F20_H_FINAL_INTEGRATION_HARDENING_REPORT.md), [F20 Traceability](../implementation/FEAT020_TRACEABILITY_MATRIX.md).
- Current `apps/admin-console/src` implementation and directly related Console tests.

## 3. Baseline and canonical identity

| Check | Result |
|---|---|
| Branch | `main` — PASS |
| Working tree before change | clean — PASS |
| HEAD / origin/main | `c1b5d8623778e6892ff01da8e5f187d8dca202b7` — PASS |

| Canonical field | Value |
|---|---|
| Feature | `FEAT-021` — UI and accessibility boundary |
| Implementation | `IMP-021` — `PLANNED`; review disposition `READY_TO_START` only |
| Developer Task | `DEV-021` |
| Requirements | `REQ-CONST-002`, `REQ-CONST-007`, `REQ-CONST-010`~`REQ-CONST-013` |
| Workflows / APIs / Screens | `WF-001`~`WF-012` / `API-001`~`API-019` / `UI-001`~`UI-037` |
| Tests / Owner | `TEST-038`, `TEST-054`, `TEST-055` / UI/UAT Owner |

`TRACE-021 = VERIFIED`는 canonical architecture trace completeness이며 implementation completion은 아니다. Historical F20은 partial UI/read evidence로만 취급한다.

## 4. Current Console route inventory

| Route | Logical screen | Canonical UI | Boundary owner | WF dependency | Backend/API | Security owner | R/W | Status/state dependencies | Auth/accessibility evidence | Coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Dashboard | `N/A — SUPPORTING_VIEW` | Operations Owner | supporting operations reads | Operations/Projection reads | Operations/Security | R | shared view states; readiness/health | Session, landmarks, status | SECONDARY_SUPPORT |
| `/administration` | Administration Overview | `UI-006` | Administration Owner | `WF-001~012` | API-015 query | Administration/Security | R | shared view states; governed-resource status | trusted Session, table/headings | PRIMARY_MAPPING |
| `/administration/governance` | Controlled Administration | `UI-036` | Administration Owner | `WF-001~012` | API-015 query/command; API-016 evidence | Administration/Security | controlled R/W | shared view states; proposal/decision/version status | backend MFA/SoD/scope/version/idempotency; labels/confirmation | PRIMARY_MAPPING |
| `/publication/operations` | Publication Operations | `UI-031` | Publication Owner | `WF-010~012` | API-014 | Publication/Security | R | shared view states; execution/attempt/eligibility status | Session-derived authorization, textual status | PRIMARY_MAPPING |
| `/publication/revalidation` | Publication Revalidation | `UI-032` | Verification Owner | `WF-011` | API-014 | Verification/Security | R | shared view states; stale/revalidation status | bounded definition/status view | PRIMARY_MAPPING |
| `/publication/recovery` | Publication Recovery | `UI-033` | Operations Owner | `WF-012` | API-014 | Operations/Security | R | shared view states; blocked/reconciliation status | finding/status separation | PRIMARY_MAPPING |
| `/publication/audit` | Publication Audit | `UI-035` | Security/Governance Owner | `WF-001~012` evidence | API-014/API-016 support | Security/Governance | R | shared view states; immutable history status | history and safe references | PRIMARY_MAPPING |
| `/connector/operations` | Connector Operations | `N/A — SUPPORTING_VIEW` | Integration Owner | supporting connector execution | API-018 | Integration/Security | R | shared view states; lease/invocation/checkpoint status | tenant/scope concealment, safe table | SECONDARY_SUPPORT |
| `/recovery/cases` | Recovery Cases | `N/A — SUPPORTING_VIEW` | Operations Owner | `WF-012` support | F19 read boundary | Operations/Security | R | shared view states; recovery-case/disposition status | concealed finding/disposition/lineage | SECONDARY_SUPPORT |
| `/integration/evidence` | External Integration Evidence | `N/A — SUPPORTING_VIEW` | Integration Owner | supporting integration evidence | API-019 | Integration/Security | R | shared view states; mapping/observation/conflict status | allowlisted safe evidence | SECONDARY_SUPPORT |
| `/audit/evidence` | Audit Evidence | `N/A — SUPPORTING_VIEW` | Security/Governance Owner | cross-workflow evidence | API-016 | Security/Governance | R | shared view states; evidence lineage status | scoped redacted events | SECONDARY_SUPPORT |
| `/system/projection` | Projection Status | `N/A — SUPPORTING_VIEW` | Projection Owner | operational support only | Projection read port | Operations/Security | R | shared view states; projection freshness/drift status | non-authoritative textual status | SECONDARY_SUPPORT |
| `/system/operations` | Operations/Health | `N/A — SUPPORTING_VIEW` | Operations Owner | operational support only | Operations read port | Operations/Security | R | shared view states; health/readiness status | health/readiness separation | SECONDARY_SUPPORT |

## 5. Canonical UI-001~037 inventory

`UI_READY` means the current boundary is sufficient to harden an existing mapped screen, not that its full canonical contract is complete. `DEPENDENCY_BLOCKED` forbids inventing a missing backend boundary.

| UI | Title | Owner | WF | API | API executable | Workflow executable | Projection executable | Authority available | Current implementation / route | Accessibility evidence | Overall gate | Classification | Phase |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UI-001 | Sign In | Security Owner | 001~012 | 001/002 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-002 | Collector Dashboard | Source/Intake Owner | 001/002 | 002~004/016/018 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-003 | Agent Dashboard | Business Owner | 005~008/011 | 002/008~013/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-004 | Reviewer Dashboard | Review Owners | 003/004/007/009/011 | 002/006/011~013/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-005 | Manager Dashboard | Business Owner | 001~012 | 002/015/016 | PARTIAL_PRIMITIVES | NOT_EXECUTABLE | NOT_VERIFIED | NOT_AVAILABLE | UI missing | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | FEAT-021-D |
| UI-006 | Administrator Dashboard | Administration Owner | 001~012 | 001/002/015~019 | PARTIAL_EXECUTABLE | PARTIAL_EXECUTABLE | AVAILABLE_READ | AVAILABLE | bounded overview `/administration` | direct Console/browser | UI_READY | PARTIALLY_IMPLEMENTED | FEAT-021-C |
| UI-007 | Future External Partner Dashboard | Integration Owner | POST-MVP | 001/002/004/011~014/018/019 | POST_MVP | POST_MVP | POST_MVP | POST_MVP | none | none | POST_MVP | POST_MVP | POST_MVP |
| UI-008 | Global Search | Business Owner | 002/005/006 | 002/005/006/009/010 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-009 | Source Registry | Source Policy Owner | 001 | 002/003/015/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | supporting evidence only | no screen evidence | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-010 | Discovery Queue | Source Data Owner | 001 | 003/004/018 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-011 | Manual Intake | Intake Owner | 002 | 004 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-012 | Intake Review | Listing Data Owner | 002 | 004~006/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-013 | AI Review Queue | AI Reviewer | 003 | 004/017/019 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-014 | Candidate List | Listing Data Owner | 002/004/006/007 | 005/006 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-015 | Candidate Detail | Listing Data Owner | 002~004/006/007 | 005/006/011/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-016 | Duplicate Review | Duplicate Review Owner | 004 | 006/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-017 | Property Master Search | Property Data Steward | 002~004/006 | 005 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-018 | Property Detail | Property Data Steward | 002~004/006 | 005/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-019 | Contact List | Privacy/Contact Owner | 007/008/011 | 002/007/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-020 | Contact Detail and Case | Privacy/Contact Owner | 007/011 | 007/011/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-021 | Client List | Business Owner | 005/008 | 008/009 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-022 | Client Detail | Business Owner | 005/008 | 007~009/013/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-023 | Requirement Editor | Requirement Owner | 005 | 009 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-024 | Matching Workspace | Matching Owner | 006 | 010/017 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-025 | Client Proposal | Business Owner | 008 | 012/013/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-026 | Verification Queue | Verification Owner | 007/011 | 011/012 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-027 | Verification Detail | Verification Owner | 007/011 | 007/011/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-028 | Permission Review | Permission Owner | 007~011 | 011/012/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-029 | Publication Approval Queue | Publication Approval Owner | 009 | 013/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-030 | Publication Approval Detail | Publication Approval Owner | 009 | 011/012/013/016 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-031 | Publication Operations | Publication Owner | 010~012 | 014/018/019 | EXECUTABLE_READ | PARTIAL_EXECUTABLE | AVAILABLE_READ | AVAILABLE | bounded read `/publication/operations` | direct Console/F20/browser | UI_READY | PARTIALLY_IMPLEMENTED | FEAT-021-C |
| UI-032 | Expiration and Reverification | Verification Owner | 011 | 011/012/014/017 | PARTIAL_EXECUTABLE | PARTIAL_EXECUTABLE | AVAILABLE_READ | AVAILABLE | bounded read `/publication/revalidation` | direct Console/F20/browser | UI_READY | PARTIALLY_IMPLEMENTED | FEAT-021-C |
| UI-033 | Exception Recovery | Operations Owner | 012 | 014/016~019 | PARTIAL_EXECUTABLE | PARTIAL_EXECUTABLE | AVAILABLE_READ | AVAILABLE | bounded read `/publication/recovery` | direct Console/F20/browser | UI_READY | PARTIALLY_IMPLEMENTED | FEAT-021-C |
| UI-034 | Background Jobs | Operations Owner | 003/006/010~012 | 017~019 | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | supporting status only | no screen evidence | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |
| UI-035 | Audit Explorer | Security/Governance Owner | 001~012 | 016 | EXECUTABLE_READ | NOT_APPLICABLE_READ_ONLY | AVAILABLE_READ | AVAILABLE | bounded audit `/publication/audit` | direct Console/F20/browser | UI_READY | PARTIALLY_IMPLEMENTED | FEAT-021-C |
| UI-036 | Role and Policy Administration | Administration Owner | 001~012 | 015/016 | EXECUTABLE_READ_WRITE | PARTIAL_EXECUTABLE | NOT_REQUIRED | AVAILABLE | controlled `/administration/governance` | direct form/security/browser | UI_READY | PARTIALLY_IMPLEMENTED | FEAT-021-C |
| UI-037 | Notification Center | Business/Operations Owner | 001~012 | 002/016/017 + source APIs | NOT_VERIFIED | NOT_VERIFIED | NOT_VERIFIED | NOT_AVAILABLE | none | none | DEPENDENCY_BLOCKED | BACKEND_NOT_READY | OWNING_BACKEND_FEATURE |

Summary: `37/37` inventoried; `UI_READY 6`, `DEPENDENCY_BLOCKED 30`, `POST_MVP 1`. The four readiness dimensions are recorded conservatively per screen. `UI-005` has partial primitives only; its workflow, drill dependencies and authority boundary are not executable, so it remains `BACKEND_NOT_READY`. Supporting evidence for `UI-009` and `UI-034` is not canonical screen implementation evidence.

## 6. UI state contract

| Concept | Contract |
|---|---|
| `LOADING` | request pending; busy/status semantics required; never implies business success |
| `READY` / NORMAL | authorized response ready; canonical entity status remains separately visible |
| `EMPTY` | successful authorized query with no visible records; not a system-wide empty claim |
| `UNAVAILABLE` | approved boundary/data unavailable; no fabricated data or ID |
| `NOT_AUTHORIZED` | safe denial; protected identity/content remains concealed |
| `ERROR` | safe message and correlation reference only; no stack/path/raw evidence |
| `STALE` | canonical read-data status, not a new shared view-state enum |
| `BLOCKED` | eligibility/status presentation, not frontend authority or a new business state |

The implemented shared vocabulary is exactly `LOADING`, `READY`, `EMPTY`, `UNAVAILABLE`, `NOT_AUTHORIZED`, `ERROR`. Later screens must reuse it unless their owning contract defines a compatible presentation state.

## 7. Accessibility contract matrix

| Requirement | Canonical source | Applicable screens | Current evidence | Status | Required test | Phase |
|---|---|---|---|---|---|---|
| Semantic landmarks | Accessibility Guide | all implemented | shared nav/main shell | PASS_EXISTING | one main and named navigation | B |
| Semantic headings | Accessibility Guide | UI-001~037 | current route headings | PARTIAL | ordered page/section headings | B/C |
| Keyboard operability | Accessibility Guide | interactive screens | native controls; no full journey | PARTIAL | keyboard-only task journeys | D |
| Visible focus | Accessibility Guide | interactive controls | focus-visible CSS source assertion only | PARTIAL | browser-visible and not-obscured focus journey | D |
| Skip navigation | Accessibility Guide | shell pages | shared skip-link source assertion only | PARTIAL | first-tab skip reaches main in browser | D |
| Accessible names | Accessibility Guide | controls/navigation | labels and nav name | PARTIAL | accessible-name matrix | B/C |
| Textual status | Accessibility/Design System | status screens | textual badges | PASS_EXISTING | status without color | C |
| Table semantics | Table Standard | collection/history | table/th and wrapper | PARTIAL | heading/caption/header/overflow | C/D |
| Form labels | Form Standard | UI-036/future forms | explicit labels/required | PARTIAL | label/name/required association | C |
| Error association | Accessibility/Form Standard | forms/states | safe alert; field relation incomplete | GAP | summary-field link and focus recovery | C/D |
| Live status/busy | Accessibility Guide | async screens | aria-live/aria-busy | PARTIAL | loading/result announcement | C/D |
| Contrast | WCAG 2.2 AA | all | semantic colors; no measurements | GAP | text/non-text/focus ratios | D |
| Zoom/reflow | Accessibility/Responsive guides | all | narrow viewport only | GAP | 200%, applicable 400%, no loss | D |
| Text spacing | Accessibility Guide | all | no direct evidence | GAP | WCAG text-spacing override | D |
| Responsive layout | Responsive Guide | current 13 | 1280x800 and 390x844 | PARTIAL | widths/orientation/form stacking | C/D |
| Screen-reader compatibility | Accessibility Guide | all | semantic source assertions | PARTIAL | manual AT journeys | D |
| Status not color-only | Accessibility/Design System | all | text plus decorative dot | PASS_EXISTING | forced-colors/color-disabled | C/D |

WCAG 2.2 AA is the design/review target. This report makes no conformance claim.

## 8. Keyboard, screen-reader, contrast and responsive contracts

Keyboard journeys shall cover route entry, first-tab skip to main, ordered sidebar navigation, all primary controls, UI-036 form operation/confirmation/cancel, validation-error recovery, table/link navigation and zero keyboard traps. Destructive or approval actions must never be implicitly submitted.

Screen-reader evidence shall cover page title, one main landmark, named navigation, heading order, label/required state, table headings, loading/busy transition, safe denial/error and unambiguous action names. Manual assistive-technology evidence is currently absent, so coverage remains partial.

Measured contrast is required for body/muted text, links, badges, focus, error, warning, disabled states and borders. `Contrast Evidence = GAP`. Reflow acceptance shall cover 200% zoom, applicable 400%, text-spacing overrides, narrow viewport, orientation, card/form stacking and usable horizontal table overflow.

## 9. Table, form, security and role-aware contracts

Tables require section/caption association, column-header semantics, comprehensible row/column association, keyboard-reachable actions, usable horizontal overflow and textual status.

UI-036 forms require labels, descriptions, required state, field/summary error association, focus after error, explicit consequence before confirmation, destructive-action clarity, disabled/in-flight state and server-confirmed result. Controlled-write semantics do not change.

Browser-authored actor, role, capability, MFA, SoD, tenant or Session claims never grant authority. Session token, raw capability graph, Repository/UoW, stack/path, secrets and raw provider evidence are never rendered. Concealed resources remain concealed. Operations remain read-only; UI-036 remains the controlled Administration write surface. Frontend visibility is presentation only and backend authority remains canonical.

Current direct role journeys are Administrator (UI-006/036), Publication Owner/Reconciler (UI-031/033), Verification roles (UI-032), Security/Governance (UI-035) and operational supporting views. Collector, Agent, Reviewer and Manager journeys remain dependency-gated or UI-missing.

## 10. TEST-038 / TEST-054 / TEST-055 matrix

### 10.1 TEST-038 accessibility coverage

| Journey / assertion | Existing evidence | Gap | Future phase |
|---|---|---|---|
| Screen identity, title, landmark, navigation | DIRECT current 13 routes | remaining screens | B/D |
| Keyboard, skip link, focus order/visibility | PARTIAL source assertions only | executable browser journeys | D |
| Loading/empty/unavailable/denied/error separation | DIRECT current Console | later screens | C/D |
| Tables, forms, status, destructive clarity | PARTIAL UI-031~033/035/036 | measured task evidence; UI-034 excluded | C/D |
| contrast, zoom/reflow, text spacing, screen reader | narrow/semantic support only | measured/manual evidence | D |

### 10.2 TEST-054 Collector / Agent / Reviewer UAT contract

Role alone never grants access. Each visible state below also requires the Screen Specification permission, tenant/scope/purpose and current backend authorization.

| Role | Task | Screen | Expected Visible State | Expected Prohibited State | Backend Boundary | Evidence Required |
|---|---|---|---|---|---|---|
| Collector | inspect assigned work, governed source and discovery/intake | UI-002/009~011 | assigned/scoped queue, source policy and own intake state | verification, permission, approval or publication action | API-002~004/015/016/018; WF-001/002 | role-scoped ready/empty/denied journeys; zero prohibited action |
| Agent | search and manage assigned contact/client/requirement/match/proposal | UI-003/008/019~025 | masked, purpose-scoped assigned records and human decision points | steward, verifier, permission or publication-owner action | API-002/005~013/016/017; WF-005~008/011 | scoped search/contact/privacy and no implicit approval assertions |
| Reviewer | perform assigned intake, AI, duplicate, verification, permission and approval review | UI-004/012/013/016/024/026~030 | exact subject/version/evidence and independent decision state | unassigned decision, self-approval, AI-generated authority | API-004/006/010~013/016~019; WF-002~004/006/007/009/011 | assignment/SoD/MFA/version success and rejection evidence |
| Collector / Agent / Reviewer with listing-read scope | inspect candidate collection/detail | UI-014/015 | scoped candidate/offer/evidence freshness | revision or verification command without exact capability | API-005/006/011/016; WF-002~004/006/007 | read/action separation and safe denial evidence |
| Reviewer with canonical Property Data Steward scope | inspect/propose/decide property correction | UI-017/018 | canonical hierarchy/version/conflict evidence | mutation without steward change scope | API-005/016; WF-002~004/006 | separate read/propose/decide authority evidence |
| Agent or Verifier with assigned purpose scope | handle contact attempt and reverification | UI-020/032 | permitted channel or expiring prerequisite state | contact reveal or revalidation outside assignment/purpose | API-002/007/011/012/014/016/017; WF-007/011 | privacy concealment and stale/live revalidation evidence |
| Collector / Agent / Reviewer without Publication Owner/Reconciler scope | encounter publication operations | UI-031 | safe status only when separately authorized | deliver/reconcile/correct/withdraw action | API-014/018/019; WF-010~012 | prohibited-action and concealed-resource evidence; no role-derived elevation |
| Collector / Agent / Reviewer | open a governed notification source | UI-037 | redacted recipient-scoped task/warning/result link | unrelated task, hidden evidence or direct authority from notification | API-002/016/017 plus source API; WF-001~012 | recipient isolation, safe link and no-authority evidence |

This matrix covers the canonical TEST-054 screen set `UI-002~004/008~032/037` without assigning specialist authority from persona name alone.

### 10.3 TEST-055 Manager / Administrator / Operations accessibility contract

| Screen | Accessibility behavior | Browser condition | Expected result | Current coverage | Remaining gap |
|---|---|---|---|---|---|
| UI-005 | scoped oversight headings, table association, keyboard drill and non-mutating metrics | desktop/narrow/zoom/keyboard | authorized workload only; no metric mutation | MISSING | screen and executable backend drill prerequisites |
| UI-006 | named navigation/main, heading hierarchy, state announcement and safe table | normal/empty/unavailable/denied/error; desktop/narrow | administration summary without browser authority | DIRECT/PARTIAL | keyboard, AT, contrast and zoom evidence |
| UI-031/032/033/035 | textual status, table/header association, safe evidence links and read-only operation | desktop/narrow/keyboard/AT; state variants | authorized status/history only; no Console mutation | DIRECT F20 for these mapped screens | measured keyboard/AT/reflow/contrast evidence |
| UI-034 | job status/action semantics and error evidence | normal/failed/retry; keyboard/AT | canonical job screen only after owning boundary exists | MISSING; supporting status is not screen evidence | owning backend and canonical screen implementation |
| UI-036 | label/description/error association, focus recovery, explicit consequence and in-flight state | create/approve/reject conflict; keyboard/AT/narrow | controlled API-015 action; backend authorization remains authoritative | DIRECT/PARTIAL | executable focus/error/AT/zoom evidence |
| UI-037 | recipient-scoped notification name/status/link semantics | unread/read/error; keyboard/AT/narrow | redacted governed link; no authority created | MISSING | notification projection and screen implementation |
## 11. Current test and F20 evidence inventory

| Evidence | Classification | Coverage |
|---|---|---|
| `console-renderer.test.ts` | DIRECT | shell, presentation, states, escaping, prohibited controls, UI-006/UI-036/F20 pages |
| `console-server.test.ts` | DIRECT | 13 routes, bounded input, trusted context, safe methods/errors |
| `console-read-adapter.test.ts` | DIRECT | API-014/016/018/019/F19 reads, concealment, immutability |
| Administration client/adapter/composition tests | DIRECT | API-015 boundary and zero browser authority |
| F20-G accessibility evidence | PARTIAL_SUPPORT | current Operations routes only |
| Exact-head browser acceptance 13/13 | PARTIAL_SUPPORT | desktop/narrow, safe states/leakage |
| TEST-038 full UI-001~037 | MISSING | current subset only |
| TEST-054 Collector/Agent/Reviewer | MISSING | owning screens/backends absent |
| TEST-055 Manager/Admin/Ops | SUPPORTING/PARTIAL | Admin/Ops subset; Manager missing |

F20 is `DIRECT_SUPPORT` only for current Operations presentation invariants, `PARTIAL_SUPPORT` for shared FEAT-021 patterns, and `NOT_RELEVANT` to unimplemented business screens. F20 Final Gate is not FEAT-021 completion.

## 12. Design-system inventory

| Primitive | Status | Evidence / future owner |
|---|---|---|
| shell/sidebar/header/page title | READY | shared renderer; normalize in B |
| cards/state cards/error surfaces | READY | current routes; semantics in B/C |
| tables/responsive wrapper | NEEDS_NORMALIZATION | headers/caption/overflow in C |
| status badges | READY | textual labels; forced-colors evidence in D |
| forms/buttons/confirmation | NEEDS_NORMALIZATION | UI-036 error/focus/in-flight in C |
| skip link/focus style | READY | browser keyboard proof in D |
| accessible names/live state | NEEDS_NORMALIZATION | shared semantics in B/C |
| `escapeHtml` | READY | security presentation invariant |

The current 240px sidebar, compact header/cards, neutral surfaces, tabular tables, textual status and narrow single-column layout align with the prior intranet reference. That reference creates no architecture authority; Phase A makes no visual change.

## 13. Gap register

| Gap ID | Area | Description | Severity | Canonical evidence | Current evidence | Owner | Future phase | Blocking |
|---|---|---|---|---|---|---|---|---|
| F21-GAP-001 | Screen breadth | 30 non-POST-MVP screens are not current UI-ready | DEPENDENCY_GATED | UI Registry | 6 mapped | owning features | D | No for B/C |
| F21-GAP-002 | Keyboard | complete task journeys absent | IMPORTANT | Accessibility Guide | focus/skip source | UI/UAT | D | No |
| F21-GAP-003 | Screen reader | manual AT evidence absent | IMPORTANT | Accessibility Guide | semantic assertions | UI/UAT | D | No |
| F21-GAP-004 | Contrast | measured ratios absent | EVIDENCE_ONLY | WCAG target | semantic colors | UI/UAT | D | No |
| F21-GAP-005 | Reflow | zoom/text-spacing evidence absent | IMPORTANT | Accessibility/Responsive | 390px only | UI/UAT | D | No |
| F21-GAP-006 | Tables | association/overflow task proof incomplete | NORMAL | Table Standard | table support | UI/UAT | C | No |
| F21-GAP-007 | Forms | error association/focus/in-flight proof incomplete | IMPORTANT | Form/Accessibility | labels/confirmation | UI/UAT | C | No |
| F21-GAP-008 | Shared semantics | heading/name/live contract needs normalization | NORMAL | UI guides | repeated patterns | UI/UAT | B | No |
| F21-GAP-009 | Role UAT | TEST-054 and Manager TEST-055 absent | DEPENDENCY_GATED | Test Registry | Admin/Ops partial | owning features + UI/UAT | D | No for B/C |
| F21-GAP-010 | AI display | provenance/confidence evidence absent | DEPENDENCY_GATED | TRACE-021 | no AI surface | AI Owner + UI/UAT | D | No |
| F21-GAP-011 | Formal coverage | TEST-038/054/055 incomplete | IMPORTANT | Test Registry | partial F20/Console | UI/UAT/Quality | E | No for start |
| F21-GAP-012 | UI-007 | partner screen outside current commitment | POST_MVP | Screen Registry | none | Integration Owner | POST_MVP | No |

Each gap has exactly one primary FEAT-021 phase or `POST_MVP` disposition. `OWNING_BACKEND_FEATURE` is a prerequisite recorded in the gap description/owner, not a second FEAT-021 phase. B owns shared semantics, C owns current-screen hardening, D owns executable accessibility/role acceptance after prerequisites, and E owns evidence closure. None requires a new API ID, event, projection, workflow, authority or frontend framework for B/C.

## 14. Bounded implementation phase plan

| Phase | Objective | Files likely touched | Visual impact | Backend dependency | Focused gate | Stop condition |
|---|---|---|---|---|---|---|
| FEAT-021-B | shell/navigation/landmark/focus/name/state semantics | current Console renderer tests and minimal renderer/CSS | SMALL | current shell only | shell/navigation accessibility tests | framework/runtime redesign needed |
| FEAT-021-C | harden 13 routes, tables, forms, states, errors, responsive UI-036 | current renderer/server/adapters/tests | MEDIUM | current API-014/015/016/018/019/read ports | current-route accessibility/security suite | new operation/authority needed |
| FEAT-021-D | keyboard/AT/zoom/reflow/role UAT and dependency-ready missing screens | browser evidence plus approved screen files | BOUNDED PER SCREEN | owning API/workflow executable first | TEST-038/054/055 slices | undefined backend boundary |
| FEAT-021-E | traceability, evidence, regression, browser gate, independent review | FEAT-021 RTM/review evidence; proven fixes only | NONE | all committed screens cleared | one full gate/document review | unresolved Critical/Important |

Credit-efficient execution uses targeted RED tests, minimal existing-file changes, focused Console suites, affected backend tests only, browser inspection near completion, one full gate and one independent review.

## 15. Traceability draft

| Chain | Proposed evidence |
|---|---|
| FEAT-021 → IMP-021 → DEV-021 | identity confirmed; IMP-021 remains PLANNED; review disposition READY_TO_START only |
| REQ-CONST-002/007/010~013 → UI | human authority, audit, no escalation and distinct lifecycle/permission presentation mapped |
| WF-001~012 / API-001~019 → UI-001~037 | 37 rows inventoried; unavailable execution dependencies gated |
| UI-001~037 → TEST-038 | contract defined; evidence incomplete |
| roles → TEST-054/055 | journeys mapped; missing screens dependency-gated |
| F20 → TRACE-021 | partial supporting evidence only |

No canonical status is changed.

## 16. Key decisions, open decisions and inconsistencies

Key decisions:

- Direct mappings are UI-006/031/032/033/035/036; seven other routes are `SUPPORTING_VIEW`.
- View state remains separate from canonical business state.
- B/C require no new API ID, dependency, persistence or authority.

Open decisions: none required for B/C. Later screens wait for their existing owning backend contracts.

Inconsistencies found: none. UI-007 POST-MVP, F20 partial attribution and IMP-021 PLANNED are preserved.

## 17. Validation performed

Validation evidence:

| Validation | Result |
|---|---|
| Canonical screen inventory | 37/37; unique 37; set difference 0 -- PASS |
| TEST mapping | TEST-038 accessibility matrix 5 rows; TEST-054 canonical role/task contract 8 rows; TEST-055 screen/accessibility/browser contract 6 rows -- PASS |
| Gap ownership | 12 gaps; orphan 0 -- PASS |
| Document ID | 386 primary IDs; invalid 0; duplicate 0; unregistered 0; DOC-REVIEW-121 exactly once -- PASS |
| Master Index / relative links | DOC-REVIEW-121 registered in navigation and canonical registry; 4,133 local links; broken 0 -- PASS |
| Architecture checksum | 153/153; checksum `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` -- PASS |
| CR-027 delta | approved delta 4/4; additional architecture delta 0 -- PASS |
| Scope protection | Production changes 0; dependency/lockfile changes 0 -- PASS |
| Independent review | Critical 0; Important 0; Minor 0 -- READY |
| Production test execution | NOT_REQUIRED; Production source changes are zero |

Final `git diff --check` is rerun immediately before commit; clean-tree evidence is recorded after the authorized local commit.

## 18. Known limitations

- This artifact is not a WCAG conformance claim.
- Manual screen-reader, keyboard, measured contrast, zoom/reflow and text-spacing evidence remains in D.
- Backend-unready screens cannot enter UI implementation before their owning boundary is executable.
- Production tests are not rerun because Production source changes are zero.

## 19. Files created and modified

- Created: `docs/reviews/FEAT021_A_CANONICAL_UI_ACCESSIBILITY_CONTRACT_INVENTORY_REPORT.md`.
- Modified: `docs/00_MASTER_INDEX.md` to register DOC-REVIEW-121.
- Production code: 0.
- Dependency/lockfile: 0.

## 20. Next brief prerequisites

Architecture Owner accepts this inventory and separately authorizes `FEAT-021-B -- Shared Shell / Navigation / Accessibility Primitives`. Phase B does not start automatically.
