# AI-MLS Canonical Event Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-050 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Data Owner / Security Owner |
| 기준일 | 2026-07-24 |
| 적용 범위 | Phase 11-8 Canonical Event Registry |

## 1. 목적과 authority boundary

이 Registry는 AO-035/DEC-112와 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)를 기준으로 `EVT-001`~`EVT-012`의 canonical identity, classification, ordering, version, replay, retention와 dependency를 최초 정의한다.

- Event는 canonical Aggregate가 확정한 business fact 또는 권한 없는 technical operation fact를 immutable하게 표현한다.
- Event는 Business Decision, Approval, Authorization, Workflow 또는 external side effect를 생성하지 않는다.
- Projection과 Audit은 같은 canonical Event identity를 참조하지만 각각 Event history를 대체하지 않는다.
- Queue, Event Bus, Event Store, worker, broker 제품, physical payload schema와 FEAT-015 구현은 이 문서의 범위가 아니다.
- 새로운 Event ID 또는 Event Type/Category 추가는 Architecture Approval과 RTM·Registry·Test impact review가 필요하다.

## 2. Canonical event catalog

| Event ID | Event Name | Aggregate | Aggregate Version | Event Version | Event Type | Event Category | Trigger | Source | Consumer | Security Classification | Retention Policy | Replay Eligibility | Related Workflow | Related API | Related Projection | Related Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EVT-001 | Publication Requested | Publication Approval | exact Approval aggregate version | schema v1; contract v1 | Business | Governance Event | authorized `CreateApprovalRequest` records exact Snapshot, Target, Channel and policy binding | WF-009 / API-013 | Approval review, Audit, PRJ-004/006 | source highest class; Snapshot fields remain restricted | Authority Evidence; Legal Hold aware | ELIGIBLE — approval-review/Audit/Projection reconstruction only | WF-009 | API-013/016 | PRJ-004/006 | TEST-021/022/033/047/049/056 | PARTIALLY_VERIFIED |
| EVT-002 | Publication Approved | Publication Approval | exact decided Approval aggregate version | schema v1; contract v1 | Business | Governance Event | qualified human `PUA` decision becomes effective after SoD, MFA, prerequisite and binding validation | WF-009 | `CheckEffectiveApproval`, Publication boundary, Audit, PRJ-002/004/006 | source highest class; decision reason/evidence restricted | Authority Evidence; Legal Hold aware | ELIGIBLE — effective-approval/Audit reconstruction only; never creates Approval | WF-009/010 | API-013/014/016 | PRJ-002/004/006 | TEST-001~003/022/023/033/047/049/056 | PARTIALLY_VERIFIED |
| EVT-003 | Publication Activated | Publication | exact Publication aggregate and Publication Version | schema v1; contract v1 | Business | Lifecycle Event | reconciled external evidence confirms canonical `ACTIVE` transition | WF-010 | authorized reads, Audit, PRJ-001/002/004~008 | source highest class; public fields limited to `PUBLIC_APPROVED` | Publication History; Legal Hold aware | ELIGIBLE — derived reads/Audit only; no delivery or notification resend | WF-010/012 | API-014/016/018/019 | PRJ-001/002/004~008 | TEST-023/025/033/036/037/049/051/056 | PARTIALLY_VERIFIED |
| EVT-004 | Publication Suspended | Publication | exact Publication aggregate and Publication Version | schema v1; contract v1 | Business | Lifecycle Event | authorized suspension is accepted and append-only status history is recorded | WF-010/012 | restricted reads, recovery, Audit, PRJ-001/002/004/006~008 | source highest class; safe reason code only outside restricted evidence | Publication History; Legal Hold aware | ELIGIBLE — derived reads/Audit only; no suspension command replay | WF-010/012 | API-014/015/016/018/019 | PRJ-001/002/004/006~008 | TEST-023/025/033/049/051~053/056 | PARTIALLY_VERIFIED |
| EVT-005 | Revalidation Completed | Verification / Permission / Publication eligibility context | exact decision aggregate versions plus referenced Publication Version | schema v1; contract v1 | Business | Governance Event | qualified authority completes deterministic current-policy revalidation | WF-011/012 | command guard, Audit, PRJ-002~004/006/008 | highest referenced class; evidence minimized and purpose-bound | Authority Evidence; Legal Hold aware | ELIGIBLE — guard/Audit reconstruction only; never authorizes or executes command | WF-011/012 | API-011/012/014/016/017 | PRJ-002~004/006/008 | TEST-002/003/024/025/032/049/051/052/056 | PARTIALLY_VERIFIED |
| EVT-006 | Reconciliation Resolved | Reconciliation Case / Publication | exact Case and referenced Publication aggregate versions | schema v1; contract v1 | Business | Recovery Event | independent resolver accepts evidence-backed canonical resolution | WF-010/012 | Publication guard/read, Audit, PRJ-002/004~008 | highest evidence class; external payload excluded | Recovery Evidence; Legal Hold aware | ELIGIBLE — canonical derived state/Audit reconstruction only; no external effect | WF-010/012 | API-014/016/018/019 | PRJ-002/004~008 | TEST-004/023/025/033/036/037/049/051/052/056 | PARTIALLY_VERIFIED |
| EVT-007 | Withdrawal Confirmed | Publication | exact withdrawn Publication aggregate and Publication Version | schema v1; contract v1 | Business | Lifecycle Event | reconciled external evidence confirms canonical `WITHDRAWN` transition | WF-010/012 | authorized reads, Audit, PRJ-001/002/004~008 | source highest class; public projection removes ineligible fields | Publication History; Legal Hold aware | ELIGIBLE — derived reads/Audit only; no withdrawal side effect replay | WF-010/012 | API-014/016/018/019 | PRJ-001/002/004~008 | TEST-023/025/033/036/037/049/051/056 | PARTIALLY_VERIFIED |
| EVT-008 | Republish Confirmed | Publication | exact successor Publication aggregate and Publication Version | schema v1; contract v1 | Business | Lifecycle Event | reconciled evidence confirms authorized republish and canonical `ACTIVE` state | WF-010/012 | authorized reads, Audit, PRJ-001/002/004~008 | source highest class; exact Target/Channel binding preserved | Publication History; Legal Hold aware | ELIGIBLE — derived reads/Audit only; no republish or notification replay | WF-010/012 | API-014/016/018/019 | PRJ-001/002/004~008 | TEST-023/025/033/036/037/049/051/056 | PARTIALLY_VERIFIED |
| EVT-009 | Material Change Accepted | Publication / Immutable Representation Snapshot reference | exact Publication aggregate, Snapshot and policy versions | schema v1; contract v1 | Business | Governance Event | authorized human materiality review records a material-change disposition | WF-009/010/012 | successor approval/publication guard, Audit, PRJ-002/004~006/008 | highest source/Snapshot class; reason and diff restricted | Authority Evidence; Legal Hold aware | ELIGIBLE — disposition/Audit reconstruction only; no successor, Approval or delivery creation | WF-009/010/012 | API-013/014/016 | PRJ-002/004~006/008 | TEST-021~025/033/049/051/056 | PARTIALLY_VERIFIED |
| EVT-010 | Projection Rebuild Requested | Projection Operation | exact source Aggregate Version and immutable Rebuild Generation | schema v1; contract v1 | Technical | Projection Event / Operational Event | authorized rebuild request passes source, scope, SoD, version and security checks | WF-012 context only | rebuild operator, monitoring, Audit; selected PRJ-001~008 | highest affected source class; no raw source payload | Projection Operations; Legal Hold aware when incident-linked | ELIGIBLE — passive Audit/monitoring reconstruction only; must not enqueue rebuild | WF-012 | API-016/017 | PRJ-001~008 | TEST-025/035/049/051~053/056 | PARTIALLY_VERIFIED |
| EVT-011 | Projection Rebuild Completed | Projection Operation | exact source Aggregate Version and immutable Rebuild Generation | schema v1; contract v1 | Technical | Projection Event / Audit Event | isolated generation passes completeness, ordering, schema and security validation | WF-012 context only | cutover validation, monitoring, Audit; selected PRJ-001~008 | highest affected source class; diagnostics restricted | Projection Operations; Legal Hold aware when incident-linked | ELIGIBLE — passive Audit/monitoring reconstruction only; no cutover or business mutation | WF-012 | API-016/017 | PRJ-001~008 | TEST-025/035/049/051~053/056 | PARTIALLY_VERIFIED |
| EVT-012 | Replay Completed | Replay Operation | exact replay boundary source versions and immutable Replay Version | schema v1; contract v1 | Technical | Recovery Event / Audit Event | authorized replay completes ordering, gap, duplicate, checksum, idempotency and security validation | WF-012 context only | recovery validation, monitoring, Audit; selected PRJ-001~008 | highest replayed source class; payload access purpose-bound | Recovery Evidence; Legal Hold aware | ELIGIBLE — replay evidence itself is passively replayable; never replays side effects or notifications | WF-012 | API-016/017 | PRJ-001~008 | TEST-025/035/049/051~053/056 | PARTIALLY_VERIFIED |

`schema v1`과 `contract v1`은 logical governance baseline이며 serialization format이나 physical payload schema를 선택하지 않는다. `Status`는 governance contract와 test mapping이 존재하지만 runtime implementation evidence가 없음을 뜻한다.

## 3. Event definition contract

모든 Event definition은 다음을 고정한다.

1. stable `EVT-*` identity와 canonical English Event Name
2. Event Type(`Business` 또는 `Technical`)과 approved Event Category
3. source Aggregate identity/version 및 trigger condition
4. immutable identity envelope, schema/contract/replay version
5. source, authorized consumers와 authority-free consumption rule
6. inherited classification, privacy, purpose와 retention category
7. replay eligibility, prohibited side effects와 ordering boundary
8. Workflow/API/Projection/Security/Test trace

Event definition 변경은 Event Contract Version impact review를 요구한다. Field-compatible shape 변경은 Event Schema Version으로 관리하고, meaning·trigger·authority·classification 변경은 새로운 approved contract 또는 successor Event 검토가 필요하다. Registry row는 Event 발행, 저장 또는 transport 권한을 부여하지 않는다.

## 4. Event identity and integrity envelope

| Field | Rule | Integrity requirement |
|---|---|---|
| Event ID | immutable unique occurrence identity | 생성 후 변경·재사용 금지 |
| Event Type ID | stable `EVT-001`~`EVT-012` catalog identity | approved Registry row와 일치 |
| Aggregate ID | source canonical Aggregate identity | tenant/purpose boundary 포함 |
| Aggregate Version | fact가 확정된 exact source version | optimistic/current version과 혼용 금지 |
| Event Sequence | aggregate stream 내부 monotonic sequence | gap/duplicate/out-of-order 검증 |
| Event Timestamp | trusted UTC occurrence timestamp | ingest/process time과 구분 |
| Event Schema Version | serialized shape compatibility | unsupported version fail closed |
| Event Contract Version | semantic/trigger contract compatibility | silent reinterpretation 금지 |
| Correlation / Causation | request, command, prior fact trace | Event 간 business dependency 또는 authority가 아님 |
| Classification / Purpose | source 최고 등급과 allowed purpose | downgrade·broaden 금지 |
| Integrity Evidence | checksum/signature or equivalent policy reference | alteration 검출과 audit correlation |

Event identity와 source fact는 immutable하다. 오류 정정은 원 Event를 수정하지 않고 승인된 correction/successor fact와 correlation을 추가한다.

## 5. Event classification

| Event Category | Purpose | Catalog coverage | Business authority |
|---|---|---|---|
| Lifecycle Event | canonical lifecycle transition fact | EVT-003/004/007/008 | 없음; Aggregate가 transition을 먼저 확정 |
| Governance Event | approval, validation, materiality fact | EVT-001/002/005/009 | 없음; qualified human/aggregate decision의 결과만 표현 |
| Projection Event | rebuild operation fact | EVT-010/011 | 없음 |
| Recovery Event | reconciliation/replay recovery fact | EVT-006/012 | 없음 |
| Audit Event | audit-relevant technical completion fact | EVT-011/012 secondary category | 없음; Audit history와 상호 참조 |
| Operational Event | authorized operational request fact | EVT-010 secondary category | 없음 |

`Business` Event는 canonical Aggregate가 이미 확정한 business fact를 표현하고, `Technical` Event는 권한 없는 projection/recovery operation fact를 표현한다. Technical Event는 business lifecycle, Approval 또는 Publication eligibility를 변경할 수 없다.

## 6. Event ordering

- Aggregate stream 내부에서 `Event Sequence`는 1씩 monotonic 증가하고 exact Aggregate Version과 검증 가능해야 한다.
- Missing, duplicate 또는 out-of-order Event는 정상 처리로 가장하지 않고 fail closed하여 recovery/replay 대상으로 격리한다.
- 동일 Event ID 재수신은 idempotent no-op 또는 기존 결과 반환이어야 하며 새 Event/side effect를 만들 수 없다.
- 서로 다른 Aggregate 사이의 global ordering은 요구하지 않는다. Cross-aggregate 판단은 각 exact version, trusted timestamp, correlation과 current-policy revalidation을 사용한다.
- Projection apply cursor, queue offset 또는 ingest order는 canonical Event Sequence나 Aggregate Version을 대체하지 않는다.

## 7. Event version

| Version | Owner | Purpose | Change rule | Must not be used as |
|---|---|---|---|---|
| Event Schema Version | Event Governance / Data Owner | field shape와 serializer compatibility | compatibility review 후 증가 | semantic contract 또는 aggregate version |
| Event Contract Version | Architecture Owner / Event Owner | name, trigger, meaning, authority-free consumer contract | approved semantic change마다 증가 또는 successor Event | payload encoding version |
| Aggregate Version | source Aggregate | canonical fact/concurrency identity | authoritative mutation마다 증가 | event schema 또는 replay run version |
| Replay Version | Recovery Authority | replay policy, boundary, validator와 execution evidence identity | replay policy/run change마다 immutable new value | source history replacement |

Projection Definition/Schema/Record Version, Rebuild Generation, API Version과 Publication Version은 별도 ownership을 유지한다. 어느 version도 다른 version의 의미를 대신하지 않는다.

## 8. Event security

- Event는 source classification, privacy, consent/basis, purpose, tenant와 audience restriction 중 가장 엄격한 값을 상속한다.
- Raw contact, credential, secret, provider payload, restricted reason/evidence와 불필요한 personal data를 Event payload나 log에 복제하지 않는다.
- Event publish, read, export, archive, replay와 disposal은 Zero Trust, Default Deny, scoped identity, purpose와 immutable audit를 적용한다.
- Service, Scheduler, Connector, AI, worker, Projection과 Replay operator는 Event를 소비하거나 technical operation을 수행할 수 있으나 Business Decision 또는 Approval authority를 얻지 않는다.
- Duplicate, missing, out-of-order, checksum/integrity failure, unsupported version과 classification drift는 fail closed한다.
- 적용 control: `SEC-001/002/006/010~15/017~25/027~32`와 [Canonical Security Registry](00_SECURITY_REGISTRY.md).

## 9. Replay policy

| Replay mode | Allowed purpose | Mandatory guards |
|---|---|---|
| Certified Replay | approved immutable range의 deterministic verification | certified source, exact boundary/version, independent validation |
| Authorized Replay | incident/rebuild 범위의 controlled replay | current scoped authority, reason, SoD, idempotency, audit |
| Snapshot + Replay | approved Snapshot 이후 derived state reconstruction | snapshot authenticity/completeness, contiguous event range |
| Recovery Replay | gap/order/corruption recovery | quarantine, root-cause evidence, no-side-effect mode, post-validation |

Replay는 derived state와 Audit verification만 재구성한다. 다음은 금지한다.

- Business Decision, Approval, Permission, Verification 또는 materiality disposition 생성
- Publication lifecycle command 또는 external side effect 실행
- Connector invocation, delivery, reconciliation action 또는 notification 재발송
- Event Timestamp, Event Sequence, Aggregate Version, actor 또는 historical reason 변경

Replay completion은 `EVT-012`로 기록할 수 있지만 이 Event 자체가 replayed facts의 authority를 높이지 않는다.

## 10. Retention policy

| Retention Category | Applies to | Archive / disposal rule |
|---|---|---|
| Authority Evidence | EVT-001/002/005/009 | Approval, decision, reason, exact binding과 audit retention에 정렬; Legal Hold 우선 |
| Publication History | EVT-003/004/007/008 | immutable Publication lifecycle history와 규제·계약 보존 정책에 정렬 |
| Recovery Evidence | EVT-006/012 | incident/reconciliation/replay evidence와 post-incident review에 정렬 |
| Projection Operations | EVT-010/011 | rebuild/drift/operation evidence와 operational audit policy에 정렬 |

정확한 기간, archive tier와 disposal schedule은 approved Privacy/Compliance retention policy가 소유한다. Retention 종료는 authorized disposition이며 in-place edit, gap 생성 또는 Legal Hold 우회를 허용하지 않는다. Disposal evidence에는 Event range/category, policy version, approver, legal-hold check, timestamp와 결과를 남긴다.

## 11. Dependency and registry mapping

Event 간 business dependency는 Registry에서 정의하지 않는다. Correlation/Causation은 trace이며 선행 Event 존재만으로 후속 command authority가 생기지 않는다.

| Dependency / Registry | Mapping | Status |
|---|---|---|
| Canonical Aggregate | each EVT row's Aggregate and exact Aggregate Version; Aggregate remains truth | VERIFIED |
| Decision Register | AO-035/DEC-112 primary; AO-023~034 constraints | VERIFIED |
| RTM | REQ-CONST-001/002/005~010/012/013; TRACE-014/015/017~020/023/024 | VERIFIED |
| Publication Registry | EVT-001~009 approval/publication/revalidation/reconciliation/materiality facts | VERIFIED |
| Workflow Registry | WF-009~012 source/context; Event never executes workflow | VERIFIED |
| API Registry | API-011~019 source/query/internal boundaries; Event grants no API authority | VERIFIED |
| Security Registry | identity, classification, privacy, integrity, recovery and replay controls | VERIFIED |
| Projection Registry | EVT-001~012 feed only mapped PRJ consumers; Projection remains derived | VERIFIED |
| Operations Registry | OPS-010~019/021/023~025/027/029~032 consume or audit EVT-001~012; replay cannot create business or external effects | VERIFIED |
| Test Registry | TST-008 validates Event governance and TST-010 validates reciprocal Registry trace; runtime implementation remains out of scope | VERIFIED |

## 12. Validation and error rules

| Validation error | Rule |
|---|---|
| Missing Event | EVT-001~012 registry row or required stream sequence absent |
| Duplicate Event | duplicate Event Type ID definition or reused Event ID/sequence invalid |
| Missing Aggregate | Business Event without existing canonical Aggregate/version invalid |
| Invalid Version | schema/contract/aggregate/replay roles mixed or unsupported |
| Invalid Replay | absent authority/boundary/order/idempotency/security or prohibited side effect |
| Broken Mapping | required Registry/Test/Projection trace absent |
| Invalid Classification | source class/purpose/tenant restriction weakened or missing |

Safe governance error taxonomy: `EVENT_MISSING`, `EVENT_DUPLICATED`, `EVENT_ORDER_CONFLICT`, `EVENT_VERSION_UNSUPPORTED`, `EVENT_INTEGRITY_FAILED`, `EVENT_REPLAY_DENIED`, `EVENT_CLASSIFICATION_DRIFT`, `EVENT_MAPPING_BROKEN`. 이 taxonomy는 implementation 또는 public API error contract가 아니다.

## 13. Audit requirements

Event catalog/definition/type/category/owner/version/security/replay/retention/dependency mapping 생성·변경과 freeze 승인은 governance audit에 기록한다. Runtime Event emit/read/export/archive/replay/recovery/disposition은 actor/service, Event ID/type, Aggregate ID/version, sequence, schema/contract/replay version, classification, purpose, reason, timestamp, correlation과 result를 append-only로 기록한다.

Audit record는 Event를 대체하지 않고 Event는 Audit history를 대체하지 않는다. 두 기록은 동일 immutable Event ID와 correlation을 참조한다.

## 14. Validation summary

- Canonical Event IDs: 12/12, duplicate 0.
- Required fields: 17/17 per Event row.
- Event Types: 2/2; Business/Technical boundary defined.
- Event Categories: 6/6 represented.
- Identity fields: 5/5 mandatory plus version/security/integrity metadata.
- Ordering rules: aggregate-local ordering, gap/duplicate/out-of-order handling, no global ordering.
- Version roles: 4/4; mixed ownership 0.
- Replay modes: 4/4; prohibited business/external effects explicit.
- Retention categories: 4/4; Legal Hold/archive/disposal boundary defined.
- Required registry mappings: 9/9; broken reference 0.
- Business authority granted to Event/Projection/Replay: 0.
- Runtime implementation claim: none.

## 15. 관련 문서

- [Event Index](00_EVENT_INDEX.md)
- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Canonical Publication Registry](00_PUBLICATION_REGISTRY.md)
- [Canonical Workflow Registry](00_WORKFLOW_REGISTRY.md)
- [Canonical API Registry](00_API_REGISTRY.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Decision Register](00_DECISION_REGISTER.md)
- [Event and Job Architecture](book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)
- [Test Registry](book-10/15_TEST_REGISTRY.md)

## 16. Final recommendation

`APPROVE_EVENT_REGISTRY`

근거: `EVT-001`~`EVT-012`, identity, ordering, version, security, replay, retention와 required Registry trace가 governance 수준에서 완전하다. Physical payload schema, Event Bus, Queue, Event Store, worker와 FEAT-015는 확정하거나 구현하지 않았다.
