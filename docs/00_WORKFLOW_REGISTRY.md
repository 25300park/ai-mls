# AI-MLS Canonical Workflow Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-042 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-24 |
| 적용 범위 | Phase 11-4 Workflow Registry Alignment |

## 1. 목적과 권위 경계

이 Registry는 `WF-001`~`WF-012`의 identity, entry/exit, command, authorization 및 registry trace를 정렬하는 governance 기준이다. Workflow는 승인된 process를 조정하지만 business truth를 생성하지 않는다. Business truth는 각 canonical aggregate와 그 immutable history가 보유한다.

- Authority 보유: canonical aggregate, authorized command, approved workflow.
- Authority 미보유: Projection, Search, Cache, Dashboard, Analytics, AI, External Connector.
- 이 문서는 logical governance contract이며 executable workflow, API, DB schema 또는 FEAT-015 구현이 아니다.
- [Book 5 Workflow Index](book-5/00_WORKFLOW_INDEX.md)는 frozen source이며 이 Registry가 AO-023~AO-035 기준의 alignment view를 제공한다.

## 2. Canonical workflow registry

| Workflow ID | Workflow Name | Aggregate | Entry Condition | Exit Condition | Allowed Commands | Required Authorization | Related API | Related Registry | Related Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| WF-001 | Listing Discovery | Source Registry, Raw Source | approved source policy and collection purpose | intake request created or source rejected | Discover, RequestIntake | source policy and actor scope | API-003, API-018 | DR, RTM, SR, TR | TEST-014, TEST-027, TEST-036 | VERIFIED |
| WF-002 | Manual Intake | Raw Source, Intake Record, Candidate Listing | admissible source evidence received | candidate draft registered, rejected, or quarantined | RegisterIntake, Validate, SubmitReview | scoped human actor; provenance required | API-004, API-006, API-016 | DR, RTM, SR, TR | TEST-004, TEST-010, TEST-015 | VERIFIED |
| WF-003 | AI Processing | AI Job, AI Result | validated source/input and closed schema | advisory result reviewed or rejected | SubmitAIJob, ValidateResult, ReviewResult | service execution only; human business authority retained | API-004, API-017, API-019 | DR, RTM, SR, TR | TEST-007, TEST-013, TEST-016, TEST-039~045 | VERIFIED |
| WF-004 | Duplicate Review | Duplicate Group, Candidate Listing | duplicate suggestion and evidence available | human disposition recorded | ReviewDuplicate, ResolveDuplicate | authorized human reviewer | API-006, API-016 | DR, RTM, SR, TR | TEST-017, TEST-028, TEST-041 | VERIFIED |
| WF-005 | Client Requirement | Client, Requirement | attributable client need captured | Requirement active, revised, paused, expired, or closed | CreateRequirement, Activate, Revise | assigned human actor; immutable revision | API-008, API-009 | DR, RTM, SR, TR | TEST-018, TEST-030, TEST-042, TEST-044, TEST-045 | VERIFIED |
| WF-006 | Matching | Requirement, Match Result | active Requirement and eligible Candidate Listings | reviewed shortlist or stale result | Match, ReviewMatch | scoped reviewer; deterministic eligibility/ranking | API-010, API-017 | DR, RTM, SR, TR | TEST-019, TEST-031, TEST-043~045 | VERIFIED |
| WF-007 | Contact and Verification | Contact Case, Verification, Permission | purpose-bound contact/evidence request | verification decision and separate permission request/status | RequestVerification, AssignVerifier, DecideVerification, Revalidate | VER/MGR decision authority; SoD, purpose and privacy guards | API-007, API-011, API-012 | DR, RTM, SR, TR | TEST-002, TEST-010, TEST-011, TEST-020, TEST-024, TEST-032 | VERIFIED |
| WF-008 | Client Proposal | Client Proposal | eligible Match Result and effective Permission | proposal shared, withdrawn, rejected, or expired | CreateProposal, ReviewProposal, ShareProposal | scoped human actor and effective Permission | API-012, API-013 | DR, RTM, SR, TR | TEST-021, TEST-033, TEST-054 | VERIFIED |
| WF-009 | Publication Approval | Publication Approval, Immutable Representation Snapshot | exact representation and valid Verification/Permission prerequisites | approved, rejected, revoked, or expired approval | CreateApprovalRequest, AssignApprover, DecideApproval, RevokeApproval, ExpireApproval | independent Publication Approver; actor-level SoD and MFA where required | API-013, API-016 | DR, RTM, PR, SR, TR | TEST-021, TEST-022, TEST-033, TEST-047 | VERIFIED |
| WF-010 | Publication | Publication | effective approval or valid operation authorization plus exact target/channel binding | confirmed canonical state or `RECONCILIATION_REQUIRED` | Publish, Withdraw, Republish, Revalidate, Resolve | command-specific human authority, live revalidation, SoD, expected version | API-014, API-016, API-018, API-019 | DR, RTM, PR, SR, PJR, ER, TR | TEST-023, TEST-025, TEST-033, TEST-036, TEST-037, TEST-049 | PARTIALLY_VERIFIED |
| WF-011 | Expiration and Reverification | Verification, Permission, Publication | expiry, policy drift, binding drift, or eligibility signal | eligibility restored or operation blocked/expired | Revalidate | scheduler may detect only; qualified human authority decides | API-011, API-012, API-014, API-017 | DR, RTM, PR, SR, TR | TEST-024, TEST-032, TEST-051 | PARTIALLY_VERIFIED |
| WF-012 | Exception and Recovery | System Error, Reconciliation Case, Audit Event | failed, unknown, conflicting, or interrupted outcome | resolved, recovered, escalated, or safely terminated | Resolve, Recover | independent resolver; current authority and SoD rechecked | API-014, API-016~019 | DR, RTM, PR, SR, PJR, ER, TR | TEST-025, TEST-035~037, TEST-049, TEST-051~056 | PARTIALLY_VERIFIED |

`DR` = [Decision Register](00_DECISION_REGISTER.md), `RTM` = [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md), `PR` = [Publication Registry](00_PUBLICATION_REGISTRY.md), `SR` = [Canonical Security Registry](00_SECURITY_REGISTRY.md), `PJR` = [Canonical Projection Registry](00_PROJECTION_REGISTRY.md), `ER` = [Canonical Event Registry](00_EVENT_REGISTRY.md), `TR` = [Test Registry](book-10/15_TEST_REGISTRY.md). [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md)는 frozen supporting source다.

## 3. Required workflow path registry

`WFP-*`는 검색용 path identifier이며 새로운 canonical Workflow ID가 아니다.

| Path ID | Required Path | Owning Workflow | Entry | Exit | Command Boundary | Evidence / Authorization | Status |
|---|---|---|---|---|---|---|---|
| WFP-001 | Intake | WF-002 | admissible source evidence | candidate draft, rejection, or quarantine | intake registration only | provenance, source policy, scoped actor | VERIFIED |
| WFP-002 | Verification | WF-007 | verification request and evidence | human verification decision | verification commands only | qualified verifier, SoD, evidence integrity | VERIFIED |
| WFP-003 | Review | WF-009 | exact immutable representation and prerequisites | approval/rejection/revocation/expiry | approval commands only | independent approver, actor-level SoD | VERIFIED |
| WFP-004 | Publication | WF-010 | `READY` aggregate and authorized Publish command | `ACTIVE`, `READY`, or `RECONCILIATION_REQUIRED` | Publish | live revalidation and exact binding | PARTIALLY_VERIFIED |
| WFP-005 | Reconciliation | WF-010, WF-012 | unknown/conflicting external outcome | evidence-confirmed state or contained escalation | Resolve | immutable Evidence, independent resolution | PARTIALLY_VERIFIED |
| WFP-006 | Withdrawal | WF-010, WF-012 | `ACTIVE` plus Withdrawal authorization | `WITHDRAWN`, `ACTIVE`, or `RECONCILIATION_REQUIRED` | Withdraw, Resolve | exact object/target/channel and non-exposure evidence | PARTIALLY_VERIFIED |
| WFP-007 | Republish | WF-010, WF-012 | eligible same-intent aggregate plus new authorization | `ACTIVE`, origin state, or `RECONCILIATION_REQUIRED` | Republish, Resolve | materiality decision, new command/attempt identity | PARTIALLY_VERIFIED |
| WFP-008 | Recovery | WF-012 | contained failure or interrupted operation | recovered, resolved, escalated, or terminated | Recover, Resolve | current authority, SoD, immutable recovery evidence | PARTIALLY_VERIFIED |

## 4. Command boundary registry

| Command ID | Command | Owner | Aggregate precondition | Authorization / evidence | Idempotency and exit rule |
|---|---|---|---|---|---|
| CMD-WF-001 | Publish | WF-010 | `READY` and exact effective Approval | live authority, SoD, target/channel/policy/version binding | new command identity; confirm `ACTIVE`, no-effect `READY`, or reconcile |
| CMD-WF-002 | Withdraw | WF-010 | `ACTIVE` and dedicated Withdrawal authorization | exact external object and non-exposure evidence | new command identity; confirm `WITHDRAWN` or reconcile |
| CMD-WF-003 | Republish | WF-010 | same business intent and eligible `ACTIVE`/`WITHDRAWN` origin | materiality decision and new authorization | never replay prior command; new Attempt and lineage |
| CMD-WF-004 | Revalidate | WF-010, WF-011 | pending effect-producing action or drift signal | actor, state/version, approval, policy, target/channel and credential checks | validation has no external effect; failure is deny/contain |
| CMD-WF-005 | Resolve | WF-010, WF-012 | open Reconciliation Case | independent authority and sufficient immutable Evidence | one case resolution; no hidden redispatch |
| CMD-WF-006 | Recover | WF-012 | contained failure and recovery plan | current authority, SoD and recovery evidence | new recovery identity; original command is not replayed |

### Non-command boundary

| Item | Classification | Rule |
|---|---|---|
| Projection Update | derived processing | workflow command가 아니며 business state를 변경하지 않는다. |
| Search Index | derived processing | canonical event/version을 소비할 뿐 workflow를 실행하지 않는다. |
| Dashboard Refresh | presentation processing | authority 또는 transition trigger가 아니다. |
| Cache Refresh | operational processing | cache state는 business truth가 아니다. |
| Analytics Refresh | analytical processing | business command, approval 또는 evidence가 아니다. |

## 5. Workflow handoff and transition registry

| Transition ID | From | To | Entry rule | Exit / evidence rule | Re-entry control |
|---|---|---|---|---|---|
| WFT-001 | WF-001 | WF-002 | approved source produces intake request | immutable source/provenance reference | none |
| WFT-002 | WF-002 | WF-003 | validated input elects advisory AI processing | closed-schema result only | no AI business authority |
| WFT-003 | WF-002/WF-003 | WF-004 | candidate and duplicate evidence available | human duplicate disposition | none |
| WFT-004 | WF-004/WF-005 | WF-006 | eligible candidate plus active Requirement | versioned Match Result | stale input forces re-evaluation |
| WFT-005 | WF-006 | WF-007 | reviewed candidate needs contact/verification | verification evidence and decision | permission remains separate |
| WFT-006 | WF-007 | WF-008 | effective Permission for client-scoped sharing | proposal sharing history | permission revalidated at use |
| WFT-007 | WF-007/WF-008 | WF-009 | exact representation and prerequisites exist | immutable Approval decision | no Publication execution |
| WFT-008 | WF-009 | WF-010 | effective exact-version Approval is consumed | Publication created `READY`; no automatic dispatch | Publish requires fresh command |
| WFT-009 | WF-010 | WF-011 | expiry or drift signal | eligibility restored or operation blocked | return never dispatches effect |
| WFT-010 | WF-010 | WF-012 | failed/unknown/conflicting outcome | contained case and evidence | blind retry prohibited |
| WFT-011 | WF-011 | WF-010 | revalidation restores eligibility | fresh authorized command required | new command identity |
| WFT-012 | WF-012 | WF-010 | recovery/resolution confirms safe state | fresh authorized command required for any effect | new command/attempt identity |

`WFT-011`과 `WFT-012`는 uncontrolled cycle이 아니라 guarded re-entry이다. 이전 command/attempt를 재사용하지 않고 authority, version, idempotency를 다시 검증하므로 circular execution을 만들지 않는다.

## 6. Mandatory transition guards

모든 effect-producing transition은 다음을 순서와 무관하게 모두 검증한다.

1. session-derived current actor와 tenant scope
2. actor-level SoD 및 prohibited role/service/AI restriction
3. aggregate current state와 expected Aggregate Version
4. exact Representation, Publication, Target, Channel 및 Policy Version binding
5. operation-specific Approval/Authorization의 유효성
6. Verification/Permission expiry와 revocation
7. connector, credential, environment 및 target policy readiness
8. open Reconciliation Case, suspension 또는 containment 유무
9. idempotency key, command identity 및 prior Attempt 결과
10. immutable audit correlation과 safe error contract

검증 실패는 Default Deny이며 external effect와 decision audit event를 만들지 않는다. AI, Scheduler, Service Actor와 Connector는 human business decision을 만들 수 없다.

## 7. Projection and event boundary

- Projection은 canonical transition 이후의 immutable event/evidence를 소비한다.
- Projection drift, rebuild, missing/out-of-order event 처리는 business workflow command가 아니다.
- Projection failure는 aggregate state를 되돌리거나 Publication authority를 만들지 않는다.
- Projection identity/policy는 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)가 소유하고 Event identity/order/replay는 [Canonical Event Registry](00_EVENT_REGISTRY.md)가 소유한다. 두 Registry 모두 physical topology, queue 또는 schema를 결정하지 않는다.
- Registry mapping과 authority prohibition은 `VERIFIED`이며 runtime implementation evidence는 `PARTIALLY_VERIFIED`다.

## 8. Decision and registry mapping

| AO / DEC | Workflow rule | Status |
|---|---|---|
| AO-023 / DEC-100 | Publication aggregate, Attempt, Evidence, Case가 execution truth를 소유 | VERIFIED |
| AO-024 / DEC-101 | lifecycle transition과 workflow handoff 분리 | VERIFIED |
| AO-027 / DEC-104 | API-014는 command surface, workflow는 orchestration boundary | VERIFIED |
| AO-028 / DEC-105 | dispatch/recovery 전 live revalidation | VERIFIED |
| AO-029 / DEC-106 | actor-level SoD와 role stacking fail closed | VERIFIED |
| AO-030 / DEC-107 | command/attempt identity와 guarded re-entry | VERIFIED |
| AO-031 / DEC-108 | unknown outcome는 reconciliation과 independent resolution으로 이동 | VERIFIED |
| AO-032 / DEC-109 | material change는 Successor, non-material change만 correction path | VERIFIED |
| AO-033 / DEC-110 | Withdrawal은 dedicated authorization/command/evidence path | VERIFIED |
| AO-034 / DEC-111 | Republish는 replay가 아닌 새 authorization/command/attempt | VERIFIED |
| AO-035 / DEC-112 | Projection은 authority-free derived consumer | DEFERRED |

| Registry | Canonical mapping | Status |
|---|---|---|
| Decision Register | DEC-100/101/104~112; DEC-102/103 supporting | VERIFIED |
| RTM | TRACE-014/015/017~020/023/024 and REQ-CONST-001~013 | VERIFIED |
| Publication Registry | Publication state, transition, version and authorization truth | VERIFIED |
| API Registry | [Canonical API Registry](00_API_REGISTRY.md): API-002/004/006/009~019 mapped per workflow rows | VERIFIED |
| Security Registry | [Canonical Security Registry](00_SECURITY_REGISTRY.md): actor, SoD, revalidation, privacy, immutable audit and safe error controls | VERIFIED |
| Projection Registry | [Canonical Projection Registry](00_PROJECTION_REGISTRY.md): PRJ-001~008 | VERIFIED |
| Event Registry | [Canonical Event Registry](00_EVENT_REGISTRY.md): EVT-001~012; Workflow is source/context only | VERIFIED |
| Test Registry | workflow-row tests plus frozen TEST-023~025/033/035~037/047/049/051~056 and governance TST-004/010 | VERIFIED |

## 9. Audit requirements

Workflow 생성/변경, command/authorization boundary 변경, transition mapping 변경과 freeze 승인은 immutable governance history에 기록한다. Runtime에서는 accepted/denied command, guard result, actor, timestamp, version, evidence, correlation과 resolution을 append-only로 남기며 restricted payload를 log에 기록하지 않는다.

## 10. Validation summary

- Canonical Workflow IDs: 12/12, duplicate 0.
- Required paths: 8/8, each with entry and exit conditions.
- Allowed canonical commands: 6/6.
- Explicit non-commands: 5/5.
- Handoff transitions: 12; invalid/unbounded circular transitions 0; guarded re-entry 2.
- Primary AO/DEC mapping: 11/11.
- Registry mappings: 8/8; placeholder 0.
- Runtime implementation claim: none.

## 11. Cross-references

- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Projection Index](00_PROJECTION_INDEX.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Security Index](00_SECURITY_INDEX.md)
- [Canonical API Registry](00_API_REGISTRY.md)
- [API Index](00_API_INDEX.md)
- [Workflow Index](00_WORKFLOW_INDEX.md)
- [Workflow Validation Report](reviews/PHASE11_4_WORKFLOW_VALIDATION.md)
- [Workflow Coverage Report](reviews/PHASE11_4_WORKFLOW_COVERAGE.md)
- [Phase 11-4 Completion](reviews/PHASE11_4_COMPLETION.md)
