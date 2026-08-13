# AI-MLS Canonical API Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-044 |
| 문서 버전 | v0.2 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-24 |
| 적용 범위 | Phase 11-5 API Registry Alignment |

## 1. 목적과 authority boundary

이 Registry는 기존 `API-001`~`API-019`의 identity를 유지하면서 API type, command/query/internal boundary, contract, version, authorization, idempotency, revalidation 및 trace를 AO-023~AO-035에 정렬한 governance view다.

- Business truth는 canonical aggregate와 immutable history가 보유한다.
- Authorized Command API는 요청을 검증하고 aggregate command를 전달할 수 있으나 독립 business truth는 아니다.
- Query, Projection, Search, Dashboard, Analytics, Internal Worker, AI 및 External Connector는 business authority가 없다.
- [Book 6 API Registry](book-6/16_API_REGISTRY.md)는 frozen identity/operation source이며 이 문서는 그 Public API surface를 추가·삭제·변경하지 않는다.
- Exact route, transport binding, physical worker/queue와 initial API major는 이 문서에서 결정하지 않는다.

## 2. Canonical API capability registry

| API ID | API Name | API Type | Command / Query | Aggregate | Version | Authorization | Idempotency | Related Workflow | Related Registry | Related Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-001 | Authentication and Session | Public Business/Security | Command + Query | User, Session | API/contract independent | identity owner; session policy | create/refresh/revoke command key where retryable | WF-001~012 | DR, RTM, WR, SR, TR | TEST-001, TEST-009, TEST-046~048 | VERIFIED |
| API-002 | Authorization Decision | Internal Security Query | Query | Role, Team, Assignment | API/contract + policy version | Security Owner; session-derived actor | read-safe; decision correlation prevents stale reuse | WF-001~012 | DR, RTM, WR, SR, TR | TEST-005, TEST-009, TEST-022, TEST-047 | VERIFIED |
| API-003 | Source Registry Access | Public Business | Command + Query | approved Source Registry read dependency; source candidate submission handoff | API/contract + source-policy version | scoped Collector/Source submitter; no policy decision authority | submission key; reads safe | WF-001 | DR, RTM, WR, SR, TR | TEST-014, TEST-027, TEST-036 | PARTIALLY_VERIFIED |
| API-004 | Manual/Source Intake | Public Business Command | Command + Query status | Intake, Raw Source, Candidate Listing | API/contract + aggregate version | scoped Collector/Reviewer | required for create/request; same key/different intent conflicts | WF-001~003 | DR, RTM, WR, SR, TR | TEST-004, TEST-015, TEST-027 | VERIFIED |
| API-005 | Property Master Access | Public Business | Query + governed proposal command | Property hierarchy | API/contract + aggregate version | Property Data Steward | proposal command key; reads safe | WF-002/003/004/006 | DR, RTM, WR, SR, TR | TEST-017, TEST-028 | VERIFIED |
| API-006 | Candidate, Offer and Duplicate | Public Business Command | Command + Query | Candidate Listing, Listing Offer, Duplicate Group | API/contract + aggregate/revision version | Listing Owner/Human Reviewer | required for revisions/decisions | WF-002/003/004/006/007 | DR, RTM, WR, SR, TR | TEST-010, TEST-017, TEST-028 | VERIFIED |
| API-007 | Contact and Communication | Restricted Business | Command + Query | Contact, Contact Case, Communication | API/contract + aggregate version | purpose-bound privacy authority | required for attempts/mutations; reads safe and audited | WF-007/008/011 | DR, RTM, WR, SR, TR | TEST-002, TEST-020, TEST-032 | VERIFIED |
| API-008 | Client Relationship | Public Business | Command + Query | Client | API/contract + aggregate version | Business Owner/Assigned Agent | create command key; reads safe | WF-005/008 | DR, RTM, WR, SR, TR | TEST-018, TEST-021, TEST-030 | VERIFIED |
| API-009 | Requirement Lifecycle | Public Business Command | Command + Query | Requirement | API/contract + requirement revision | Assigned Agent/Human Reviewer | required for create/revise/transition | WF-005/006/008 | DR, RTM, WR, SR, TR | TEST-018, TEST-030, TEST-042/044/045 | VERIFIED |
| API-010 | Matching | Public Business | Command + Query | Match Result | API/contract + result/input versions | Agent/Human Reviewer | match/review command key; read safe | WF-006/008/011 | DR, RTM, WR, SR, TR | TEST-019, TEST-031, TEST-043~045 | VERIFIED |
| API-011 | Verification | Restricted Business Command | Command + Query | Verification, Reverification Request | API/contract + aggregate/evidence version | qualified human verifier; actor-level SoD | required for request/assign/decide/reverify | WF-007/011 | DR, RTM, WR, SR, TR | TEST-002, TEST-020, TEST-024, TEST-032 | VERIFIED |
| API-012 | Permission | Restricted Business Command | Command + Query | Permission | API/contract + aggregate version | Permission Reviewer; SoD | required for request/decide/revoke | WF-007~011 | DR, RTM, WR, SR, TR | TEST-003, TEST-012, TEST-020~024 | VERIFIED |
| API-013 | Proposal and Publication Approval | Restricted Business Command | Command + Query | Client Proposal, Publication Approval, Snapshot | API/contract + approval/snapshot version | Senior Agent or independent PUA by operation | required for every mutation; exact intent conflict denied | WF-008/009 | DR, RTM, WR, PR, SR, TR | TEST-021, TEST-022, TEST-033, TEST-047 | VERIFIED |
| API-014 | Publication External Effect | Public Business Command/Canonical Read | Command + Query | Publication, Delivery Attempt, Reconciliation Case | API/contract + aggregate/publication/effective versions | Publication Owner/Reconciler; dynamic SoD | required for every effect command; command/attempt/external-effect identities separated | WF-010~012 | DR, RTM, WR, PR, SR, PJR, ER, TR | TEST-023~025, TEST-033, TEST-049, TEST-051 | PARTIALLY_VERIFIED |
| API-015 | Administration | Restricted Administration | Command + Query | User identity administration reference, Role, Role Assignment, Team/scope, Policy, Source Registry governance proposal/review/approval/status, Publication Target governance state, Decision History reference | API/contract + policy/resource version | current Session-derived Administration/Security/exact policy owner; independent human approver for activation | required for every governed mutation; same key/different intent conflicts | WF-001~012 | DR, RTM, WR, PR, SR, TR | TEST-005, TEST-034, TEST-037, TEST-048, TEST-053 | PARTIALLY_VERIFIED |
| API-016 | Audit and History | Restricted Query/Export | Query + export command | Audit/Decision/Status/Approval History | API/contract + export contract version | Security/Governance Owner | reads safe; export request key required | WF-001~012 | DR, RTM, WR, PR, SR, TR | TEST-004~006, TEST-022, TEST-049 | VERIFIED |
| API-017 | Background Jobs | Internal Operation | Command + Query status | AI Job, Retention Job, domain job refs | API/contract + job/input schema versions | Domain/Operations Owner; worker lease only | mandatory; successor job for non-safe retry | WF-003/006/010~012 | DR, RTM, WR, SR, ER, TR | TEST-016, TEST-024, TEST-025, TEST-035 | PARTIALLY_VERIFIED |
| API-018 | Connector Boundary | Integration/Internal Operation | Technical Command + Query health/status | Connector Instance, Delivery Attempt reference | API/connector contract + attempt version | scoped service principal; no business approval | mandatory for invocation/report/checkpoint | WF-001~004/009~012 | DR, RTM, WR, PR, SR, ER, TR | TEST-008, TEST-023, TEST-036, TEST-037 | PARTIALLY_VERIFIED |
| API-019 | External Integration Lifecycle | Integration API | Technical Command + Query | Integration Contract, external mapping/evidence | API/integration/provider contract versions | Integration + affected domain owners | mandatory for mapping/reconcile/suspend operations | WF-001~012 | DR, RTM, WR, PR, SR, PJR, ER, TR | TEST-008, TEST-036, TEST-037, TEST-052 | PARTIALLY_VERIFIED |

`DR` = [Decision Register](00_DECISION_REGISTER.md), `RTM` = [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md), `WR` = [Workflow Registry](00_WORKFLOW_REGISTRY.md), `PR` = [Publication Registry](00_PUBLICATION_REGISTRY.md), `SR` = [Canonical Security Registry](00_SECURITY_REGISTRY.md), `PJR` = [Canonical Projection Registry](00_PROJECTION_REGISTRY.md), `ER` = [Canonical Event Registry](00_EVENT_REGISTRY.md), `TR` = [Test Registry](book-10/15_TEST_REGISTRY.md). [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md)는 frozen supporting source다.

API-003은 approved Source Registry를 소비하고 non-authoritative source candidate를 administration boundary로 제출하는 intake-facing handoff다. Source policy proposal lifecycle, review, approval, activation과 administrative status decision authority는 API-015가 독점한다. API-015의 canonical completion boundary는 정렬됐지만 full operation contract와 runtime은 미완료이므로 status는 `PARTIALLY_VERIFIED`다.

## 3. API-014 canonical contract alignment

아래 operation은 AO-027과 기존 `API-014` capability의 의미를 분류한 것이며 exact route 또는 새 API ID를 생성하지 않는다.

| Operation family | Classification | Canonical responsibility | Authority / outcome rule |
|---|---|---|---|
| Publication resource read | Query | canonical Publication, version, state, binding and safe action eligibility read | read-only; stale projection은 canonical command authority가 아님 |
| Delivery Attempt/Reconciliation read | Query | safe Attempt history, Evidence summary, Case and resolution status | raw provider payload/credential/secret 금지 |
| Create Publication | Command | exact Snapshot, Approval and Target/Channel binding으로 `READY` aggregate 생성 | creation and dispatch separated; no automatic external effect |
| Deliver / Publish | Command | live guards 통과 후 authorized Command와 one Delivery Attempt 생성 | durable acceptance는 external success가 아님 |
| Correct | Command | AO-032 materiality 판정 후 non-material correction 또는 Successor path | existing content의 silent mutation 금지 |
| Suspend / Resume eligibility | Command | orthogonal operational/security/compliance hold 관리 | suspension은 lifecycle state가 아님; resume은 자동 dispatch 아님 |
| Withdraw | Command | dedicated authorization, Command와 Attempt 생성 | authenticated non-exposure 전 `WITHDRAWN` 반환 금지 |
| Republish | Command | same-intent new authorization, Command와 Attempt 생성 | prior Command replay 금지; UNKNOWN/open Case에서 deny |
| Reconcile / Resolve | Restricted Command | Evidence를 Case에 append하고 independent resolution 적용 | Observation 자체는 state authority가 아님 |
| Evidence submission/report | Internal Integration Operation | API-018/019가 Attempt/Observation evidence를 전달 | API-014가 검증·해석; connector가 canonical state 결정 금지 |

API-013은 Approval까지만, API-015는 Target/policy administration까지만, API-018은 bounded connector execution/evidence까지만, API-019는 provider contract/external identity까지만 소유한다.

## 4. Command, query and internal boundary

### Command API

- business state mutation은 authenticated/session-derived actor, explicit capability, expected aggregate version, current authorization, SoD, idempotency와 audit precondition을 요구한다.
- command acceptance, worker/connector acceptance와 canonical external success를 서로 다른 결과로 표현한다.
- generic state update, caller-supplied actor authority, connector-created Approval/Attempt와 blind replay를 금지한다.

### Query API

- read-only이며 canonical read 또는 labeled Projection을 사용한다.
- Projection timestamp/version/staleness를 반환할 수 있으나 business state, Approval, Command 또는 external success를 생성하지 않는다.
- restricted read는 purpose, field mask, tenant scope와 audit를 적용한다.

### Internal operation

| Operation | Owning existing API | Boundary | Status |
|---|---|---|---|
| Background Job submit/read/cancel/successor/result | API-017 | domain-authorized job only; arbitrary execution 금지 | PARTIALLY_VERIFIED |
| Connector lease/report/checkpoint/health | API-018 | exact authorized Attempt/contract scope only | PARTIALLY_VERIFIED |
| Integration mapping/observation/reconcile/suspend | API-019 | technical evidence/contract lifecycle only | PARTIALLY_VERIFIED |
| Projection rebuild | API-017 + PRJ-001~008 | derived state rebuild; aggregate mutation 금지 | PARTIALLY_VERIFIED |
| Drift detection/monitoring | API-017/018/019 + PRJ-001~008 | signal/telemetry only; business command 금지 | PARTIALLY_VERIFIED |
| Event replay | API-017 + EVT-001~012 | validated, ordered, idempotent derived replay with no business/external effects | PARTIALLY_VERIFIED |

Internal operation은 Public Business API가 아니며 worker lease, scheduler signal 또는 monitoring alert는 authorization이나 business decision이 아니다.

## 5. Contract profile

모든 API capability는 다음 seven-part contract를 충족한다.

| Contract part | Mandatory rule |
|---|---|
| Input | opaque identity, actor/session context, tenant/purpose, exact references/versions, declared contract, trace; write는 reason/idempotency where applicable |
| Output | canonical ID/version/status, accepted-versus-effective outcome, safe next action, request/correlation reference |
| Error | stable safe code/category/retryability; stack, secret, credential, raw restricted/provider payload 금지 |
| Authorization | authentication → actor/resource capability → tenant/purpose → dynamic SoD; Default Deny |
| Idempotency | retryable write key required; same key/different normalized intent conflict; query is side-effect free |
| Revalidation | current actor, aggregate state/version, prerequisite, policy/target/connector/credential and open-case checks at effect boundary |
| Audit | mutations, restricted reads, denials, exports, jobs/connectors, versions and outcomes append-only |

## 6. Version registry

| Version | Owner | Purpose | Independence rule | Status |
|---|---|---|---|---|
| API Major / Contract Version | Architecture/API governance | consumer compatibility and breaking contract | aggregate/event/projection/policy version과 독립; initial major는 `OPEN DECISION` 유지 | VERIFIED |
| Aggregate Version | canonical aggregate | concurrency and expected-state guard | API major와 무관하게 authoritative mutation마다 증가 | VERIFIED |
| Event Schema Version | [Canonical Event Registry](00_EVENT_REGISTRY.md) | immutable event consumer compatibility | API and aggregate version을 대체하지 않음 | VERIFIED |
| Projection Schema Version | [Canonical Projection Registry](00_PROJECTION_REGISTRY.md) | read-model shape/rebuild compatibility | business truth 또는 dispatch authority가 아님 | VERIFIED |

API major coexistence는 동일한 current business/security invariant를 적용한다. Deprecated API가 revoked Permission, expired Approval 또는 obsolete authority를 계속 인정할 수 없다. Event/Projection governance Registry는 physical queue, store, protocol 또는 schema를 결정하지 않는다.

## 7. Authorization, idempotency and revalidation sequence

Effect-producing API command는 다음을 모두 통과해야 한다.

1. authentication과 session-derived current actor
2. API capability, tenant, resource 및 purpose scope
3. actor-level SoD, role stacking, service/AI/connector restrictions
4. input/contract/reference validation과 safe data classification
5. aggregate current state와 expected Aggregate Version
6. exact Snapshot/Approval/Authorization/Target/Channel/Policy binding
7. Verification/Permission/Approval expiry, revocation 및 live effectiveness
8. connector/provider contract, credential reference와 environment eligibility
9. suspension, open Reconciliation Case 및 possible-effect guard
10. command/idempotency/Attempt/external-effect identity conflict 검사
11. immutable audit/outbox-equivalent durability before acceptance

실패는 safe error와 Default Deny를 반환하고 state transition, Delivery Attempt 또는 decision event를 만들지 않는다. Validation-only query는 dispatch authorization으로 재사용할 수 없다.

## 8. Decision and registry mapping

| AO / DEC | API governance rule | Status |
|---|---|---|
| AO-023 / DEC-100 | API-014가 Publication command를 수용하고 aggregate가 truth/Attempt lineage를 소유 | VERIFIED |
| AO-027 / DEC-104 | API-014 hybrid resource/read + explicit command/evidence-separated surface | VERIFIED |
| AO-028 / DEC-105 | effect boundary의 mandatory live revalidation | VERIFIED |
| AO-029 / DEC-106 | actor-level dynamic SoD와 service/AI/connector authority prohibition | VERIFIED |
| AO-030 / DEC-107 | command, aggregate, Attempt, external-effect, Observation identity 분리 | VERIFIED |
| AO-031 / DEC-108 | Observation/Evidence와 independent Resolution 분리 | VERIFIED |
| AO-033 / DEC-110 | dedicated Withdrawal authorization/command/evidence contract | VERIFIED |
| AO-034 / DEC-111 | Republish is new command/attempt, not replay | VERIFIED |
| AO-035 / DEC-112 | Projection query/rebuild는 authority-free derived operation | DEFERRED |

AO-024/025/026/032는 lifecycle, exact Target/Channel, ownership separation 및 materiality supporting dependencies로 반영했다.

| Registry | Mapping | Status |
|---|---|---|
| Decision Register | DEC-100/104~108/110~112 primary; DEC-101~103/109 supporting | VERIFIED |
| RTM | TRACE-014/015/017~020/023/024 and REQ-CONST-001~013 | VERIFIED |
| Workflow Registry | API rows map to WF-001~012; API-014 maps WF-010~012 | VERIFIED |
| Publication Registry | exact state/version/authorization/Attempt/Reconciliation truth | VERIFIED |
| Security Registry | [Canonical Security Registry](00_SECURITY_REGISTRY.md): API-001~019 and SEC-001~034 coverage | VERIFIED |
| Projection Registry | [Canonical Projection Registry](00_PROJECTION_REGISTRY.md): PRJ-001~008 | VERIFIED |
| Event Registry | [Canonical Event Registry](00_EVENT_REGISTRY.md): EVT-001~012 | VERIFIED |
| Test Registry | API row tests, frozen TEST-023~025/033/035~037/047/049/051~056 and governance TST-005/010 | VERIFIED |

## 9. Audit requirements

API 생성/수정, contract/version/classification/authority mapping 변경과 freeze 승인은 governance audit에 기록한다. Runtime audit는 actor/service, operation, target/version, decision/reason, timestamp, request/correlation/idempotency identity와 safe outcome을 append-only로 기록한다. Secret, credential, raw provider response와 restricted payload는 복제하지 않는다.

## 10. Validation summary

- Canonical API IDs: 19/19, duplicate 0, new API ID 0.
- API classifications: Public Business/Security, Restricted, Internal, Integration 모두 명시.
- Command/Query distinction: 19/19.
- Seven-part contract coverage: 7/7.
- Version roles: 4; mixed ownership 0; placeholder 0.
- Primary AO/DEC mapping: 9/9.
- Registry mappings: 8/8.
- Public API surface change: none.
- Runtime implementation claim: none.

## 11. Cross-references

- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Projection Index](00_PROJECTION_INDEX.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Security Index](00_SECURITY_INDEX.md)
- [API Index](00_API_INDEX.md)
- [Book 6 API Registry](book-6/16_API_REGISTRY.md)
- [API Validation Report](reviews/PHASE11_5_API_VALIDATION.md)
- [API Coverage Report](reviews/PHASE11_5_API_COVERAGE.md)
- [Phase 11-5 Completion](reviews/PHASE11_5_COMPLETION.md)
