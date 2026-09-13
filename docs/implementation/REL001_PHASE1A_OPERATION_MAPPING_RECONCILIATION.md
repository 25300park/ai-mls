# REL-001 Phase 1A Operation Mapping Reconciliation

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-055 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner / Domain Owners |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decision | `DEC-126` (`APPROVED`) |

## 1. Rule

Frozen Book 6 logical operation is authoritative. Current in-process method may implement it only when identity, input, output and outcome semantics match. Contradictory dual meanings are prohibited; unmatched helpers remain internal and do not receive routes.

## 2. API-005 reconciliation

| Canonical | Current | Mismatch | Single mapping |
|---|---|---|---|
| `Propose Master Correction` against existing Property ID/version | `proposeProperty()` creates a new proposed Property node; `decideProperty()` activates/retires/supersedes it | subject identity, delta/evidence and correction proposal lifecycle absent | **No mapping.** `proposeProperty` is not renamed or exposed as correction. Operation remains `NOT_TRANSPORT_READY` pending an approved correction-proposal application contract |

Search and hierarchy read map to `searchProperties()` and `readProperty()`. Direct `decideProperty()` and alias proposal are not Book 6 public operations in this phase.

## 3. API-007 reconciliation

| Canonical | Current | Mismatch | Single mapping |
|---|---|---|---|
| `Search Contacts` | no authorized bounded search method | operation absent | `NOT_TRANSPORT_READY`; no broad in-memory scan or fabricated filter |
| `Record Contact Attempt` / `Set Do-Not-Contact` require `contactCaseId` | `recordContactAttempt()`/`setDoNotContact()` exist, but `openContactCase()` is only an in-process helper and Book 6 exposes no case-creation operation | required case identity provenance unavailable from public flow | both remain `NOT_TRANSPORT_READY` until canonical owner/source of Contact Case is approved |
| unmasked channel access | `revealChannel()` exists | frozen public operation absent and privacy-sensitive | internal restricted helper only; no route |

Create/read/correct Contact and add/revoke Channel map one-to-one to existing façade methods with masked DTO reconstruction.

## 4. API-009 reconciliation

| Canonical | Current | Mismatch | Single mapping |
|---|---|---|---|
| `Transition Requirement` | `transitionRequirement()` plus specialized `activateRequirement()` | specialized helper overlaps canonical transition | public route maps only to `transitionRequirement`; `activateRequirement` remains internal compatibility helper |
| `Request Requirement Parsing` | only advisory-result validators; no API-017 submission/handoff operation | command/outcome absent | `NOT_TRANSPORT_READY`; validators are not renamed into a request operation |
| current Requirement read | `readRequirement()` exists; Book 6 registers only history route | route absent | internal/read-composition helper only; no new route |

Create, revise, transition and history map directly. AI job semantics stay owned by API-017/FEAT-022 and are not invented here.

## 5. API-010 reconciliation

| Canonical | Current | Mismatch | Single mapping |
|---|---|---|---|
| `Request Match` returns `MATCH.REQUESTED` / background job | `requestMatch()` synchronously resolves snapshots and calculates results | admission/result timing and API-017 ownership differ | `NOT_TRANSPORT_READY`; synchronous calculation is not exposed as async acceptance |
| `List Results` | no dedicated façade; `readRun()` returns a run containing results | response projection mismatch only | adapter/application query may reconstruct a bounded masked list from authoritative run only after bounds are approved; no new business operation |
| `Mark/Recompute Stale` | `markStale()` marks current result; no approved recompute dispatch | combined wording risks implicit job | route performs mark-stale only. Recompute/successor trigger is not executed without existing API-017 contract |

Read run, list projection, review result and mark-stale are contract candidates. Request Match remains blocked.

## 6. Reconciliation result

| API | Reconciled mappings | Unresolved canonical operations | Architecture document amendment |
|---|---:|---|---|
| API-005 | search/read `2` | correction proposal `1` | required before implementation |
| API-007 | contact/channel operations `5` | search/attempt/DNC `3` | required for search and Contact Case provenance |
| API-009 | create/revise/transition/history `4` | AI parse request `1` | required with API-017 owner |
| API-010 | read/list/review/mark-stale `4` | async request match `1` | required with API-017 owner |

Unresolved operation conflicts = `6`. Because the Phase 1A mandatory stop forbids unresolved operation conflict, Production Phase 1 remains blocked.

## 7. Phase 1B exact conflict dispositions

| API | Canonical operation | Type | Canonical input/output | Current mapping | Conflict | Disposition |
|---|---|---|---|---|---|---|
| API-005 | Propose Master Correction | Command | existing Property ID/version, correction delta, evidence/reason → immutable correction proposal | `proposeProperty()` creates a different Property identity | absent application/domain shape; canonical meaning itself is singular | `IMPLEMENTATION_ADAPTER_REQUIRED` |
| API-007 | Search Contacts | Query | purpose/scoped allowlisted filters → bounded masked Contact results | none | missing query implementation; frozen privacy semantics are clear | `IMPLEMENTATION_ADAPTER_REQUIRED` |
| API-007 | Record Contact Attempt | Command | existing Contact Case ID/version, direction/outcome/evidence/purpose → Case + immutable Communication | `recordContactAttempt()` already requires an existing `caseId`; `openContactCase()` is not invoked implicitly | no canonical Case creation transport exists | `IMPLEMENTATION_ADAPTER_REQUIRED`, but operation remains `NOT_TRANSPORT_READY` until an existing canonical Case can be supplied |
| API-007 | Set Do-Not-Contact | Command | existing Contact Case ID/version, reason/purpose → successor DNC Case | `setDoNotContact()` already requires an existing `caseId`; no implicit creation | no canonical Case creation transport exists | `IMPLEMENTATION_ADAPTER_REQUIRED`, but operation remains `NOT_TRANSPORT_READY` until an existing canonical Case can be supplied |
| API-009 | Request Requirement Parsing | Command | exact Requirement revision and approved data class → API-017 accepted job reference | only advisory-result validators exist | missing API-017 application adapter; canonical meaning is singular | `IMPLEMENTATION_ADAPTER_REQUIRED` |
| API-010 | Request Match | Command | active Requirement revision/cohort intent/version/idempotency → `MATCH.REQUESTED` job/run reference | current `requestMatch()` executes synchronously | async admission must adapt to existing API-017 owner; current synchronous helper is not public contract | `IMPLEMENTATION_ADAPTER_REQUIRED` |

The approved Auth Ingress / API-007 amendment resolves all six rows to one canonical meaning. API-007 owns Contact/Communication transport, while Contact Case remains owned by the existing Contact Case/contact-engagement domain. Attempt and DNC accept only an already-canonical Case ID and never create one.

```text
Remaining semantic conflicts: 0
Existing canonical Contact Case create path: NO_CANONICAL_CREATE_PATH
Case-dependent API-007 operations: NOT_TRANSPORT_READY
```
