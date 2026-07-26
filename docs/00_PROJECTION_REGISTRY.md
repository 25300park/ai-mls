# AI-MLS Canonical Projection Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-048 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Data Owner |
| 기준일 | 2026-07-24 |
| 적용 범위 | Phase 11-7 Canonical Projection Registry |

## 1. 목적과 authority boundary

이 Registry는 AO-035/DEC-112의 Hybrid Event Projection Model을 기준으로 `PRJ-001`~`PRJ-008`의 definition, catalog, lifecycle, ownership, version, security, rebuild와 dependency를 최초 정의한다.

- Projection은 canonical aggregate와 immutable domain event에서 파생되는 read model이다.
- Projection은 business truth, Approval, Authorization, Command 또는 external-effect authority를 소유하지 않는다.
- Projection은 삭제·재생성할 수 있지만 source Aggregate, Event와 Audit history는 변경하거나 삭제할 수 없다.
- Queue, Event Bus, worker, store, schema implementation과 FEAT-015 구현은 이 문서의 범위가 아니다.
- 새로운 Projection Type 또는 `PRJ-*` 추가는 Architecture Approval과 trace impact review가 필요하다.

## 2. Canonical projection catalog

| Projection ID | Projection Name | Projection Type | Source Aggregate | Source Event | Source Version | Projection Version | Projection Owner | Security Classification | Purpose | Lifecycle | Rebuild Strategy | Related Workflow | Related API | Related Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PRJ-001 | Search Projection | Search | Property, Candidate Listing, Listing Offer, Requirement, Publication | property/candidate/offer/requirement/publication eligibility changed | Aggregate Version + logical Event Version | definition v0.1; schema/record/generation independently tracked | Search/Data Owner | inherited; audience/purpose-specific, never lower than source | authorized discovery and retrieval | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Single, Aggregate, Family, Full, Snapshot, Replay | WF-001~012 | API-005/006/009/010/014/017/019 | TEST-019, TEST-031, TEST-044, TEST-050, TEST-056 | PARTIALLY_VERIFIED |
| PRJ-002 | Listing Projection | Listing | Publication | Publication state/effect/reconciliation/withdrawal/republish confirmed | Aggregate/Publication/Effective Version + logical Event Version | definition v0.1; schema/record/generation independently tracked | Publication Read/Data Owner | `PUBLIC_APPROVED` fields only for public view; internal evidence class inherited | current safe published-listing read model | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Single, Aggregate, Family, Full, Snapshot, Replay | WF-009~012 | API-014/016~019 | TEST-002~004, TEST-011/012, TEST-023~025, TEST-033, TEST-049, TEST-056 | PARTIALLY_VERIFIED |
| PRJ-003 | Client Projection | Client | Client, Requirement, Match Result, Client Proposal, Permission | client/requirement/match/proposal/permission changed | Aggregate/Revision Version + logical Event Version | definition v0.1; schema/record/generation independently tracked | Client/Data Owner | `CONFIDENTIAL_BUSINESS` or `RESTRICTED_PERSONAL` inherited | assigned-client workflow read model | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Single, Aggregate, Family, Full, Snapshot, Replay | WF-005~009/011 | API-007~013/016/017 | TEST-003, TEST-012, TEST-018~021, TEST-029~032, TEST-048, TEST-054 | PARTIALLY_VERIFIED |
| PRJ-004 | Dashboard Projection | Dashboard | domain aggregates and operational status summaries | approved domain transition/job/incident summary changed | source Aggregate/Job/Policy Version + logical Event Version | definition v0.1; schema/record/generation independently tracked | Product Operations/Data Owner | highest included source class; role/tenant filtered | bounded operational and workload visibility | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Aggregate, Family, Full, Snapshot, Replay | WF-001~012 | API-005/010/014~019 | TEST-034/035/038/046~050/053~056 | PARTIALLY_VERIFIED |
| PRJ-005 | Analytics Projection | Analytics | approved domain aggregates and immutable audit/event facts | minimized domain/audit fact accepted | source Aggregate/Event/Policy Version | definition v0.1; schema/record/generation independently tracked | Analytics/Data Owner | `CONFIDENTIAL_BUSINESS` default; minimized/pseudonymized; source restriction preserved | governed metrics and trend analysis | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Aggregate, Family, Full, Snapshot, Replay | WF-001~012 | API-016/017/019 | TEST-006, TEST-048~050, TEST-053/055/056 | PARTIALLY_VERIFIED |
| PRJ-006 | Notification Projection | Notification | workflow-owned aggregate outcomes and User Action | auditable outcome/reminder/expiry/incident notification requested | source Aggregate/Policy Version + logical Event Version | definition v0.1; schema/record/generation independently tracked | Notification/Product Owner | recipient-purpose scoped; payload minimized; source class inherited | derived user notification/read state | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Single, Aggregate, Family, Full, Snapshot, Replay | WF-001~012 | API-001/007/013~017/019 | TEST-020/021/024/025/038/048/053~056 | PARTIALLY_VERIFIED |
| PRJ-007 | Integration Projection | Integration | Source Registry, Publication, Integration Contract, external mapping/evidence | integration contract/mapping/observation/reconciliation changed | Aggregate/Contract/External Observation Version + logical Event Version | definition v0.1; schema/record/generation independently tracked | Integration/Data Owner | contract/purpose/target scoped; source class inherited | partner feed/read mapping and safe external synchronization view | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Single, Aggregate, Family, Full, Snapshot, Replay | WF-001~004/009~012 | API-003/004/014/016~019 | TEST-004/008/014/023/025/036/037/049/052/056 | PARTIALLY_VERIFIED |
| PRJ-008 | Cache Projection | Cache | any approved canonical/read-model source | source state/version invalidated or refreshed | exact source Aggregate/Projection/Event Version | definition v0.1; schema/record/generation independently tracked | Platform Operations/Data Owner | exact source classification and tenant/purpose scope inherited | bounded read acceleration only | BUILDING/ACTIVE/STALE/REBUILDING/FAILED/ARCHIVED | Single, Aggregate, Family, Full, Snapshot, Replay | WF-001~012 | API-001~019 read paths | TEST-009/023/025/038/048~050/052/056 | PARTIALLY_VERIFIED |

`Source Event` logical family는 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 `EVT-001`~`EVT-012`와 binding된다. Publication/Approval lifecycle facts는 `EVT-001`~`EVT-009`, rebuild/replay operation facts는 `EVT-010`~`EVT-012`를 사용한다. Physical payload schema, transport와 store는 결정하지 않는다.

## 3. Projection definition contract

모든 Projection definition은 다음을 고정한다.

1. stable `PRJ-*` identity와 approved type
2. source Aggregate identity 및 authoritative version source
3. accepted logical source event family와 event-version expectation
4. definition/schema/record/rebuild generation의 독립 version policy
5. purpose, tenant/audience, classification와 allowed field policy
6. owner, operational owner, rebuild authority와 monitoring authority
7. lifecycle, freshness/drift threshold reference와 failure posture
8. rebuild strategy, dependency, test와 audit mapping

Definition 변경은 Projection Definition Version을 증가시키며 schema 호환성, rebuild 필요성, security/classification, consumers와 tests를 검토한다. Row만으로 physical projection을 만들거나 운영 권한을 부여하지 않는다.

## 4. Ownership registry

| Projection | Source Aggregate Owner | Projection Owner | Operational Owner | Rebuild Authority | Monitoring Authority |
|---|---|---|---|---|---|
| PRJ-001 | Property/Listing/Requirement/Publication domain owners | Search/Data Owner | Platform Operations | Data + Operations scoped operator | Data/Operations Monitoring |
| PRJ-002 | Publication Owner | Publication Read/Data Owner | Publication Operations | Data + Publication Operations | Publication/Operations Monitoring |
| PRJ-003 | Client/Requirement/Matching/Permission owners | Client/Data Owner | Business Operations | Data + Business Operations | Business/Data Monitoring |
| PRJ-004 | contributing domain owners | Product Operations/Data Owner | Platform Operations | Data + Platform Operations | Operations Monitoring |
| PRJ-005 | contributing domain/Audit owners | Analytics/Data Owner | Analytics Operations | Data + Analytics Operations | Analytics/Security Monitoring |
| PRJ-006 | triggering workflow/domain owner | Notification/Product Owner | Platform Operations | Product + Operations | Product/Operations Monitoring |
| PRJ-007 | Source/Publication/Integration owners | Integration/Data Owner | Integration Operations | Data + Integration Operations | Integration/Security Monitoring |
| PRJ-008 | exact source owner | Platform Operations/Data Owner | Platform Operations | Data + Platform Operations | Platform/Security Monitoring |

Projection Owner, Operational Owner, Rebuild Authority와 Monitoring Authority는 source Business Owner가 아니며 source mutation, Approval 또는 business decision을 상속하지 않는다. Rebuild requester와 high-risk rebuild approver/operator는 scoped SoD를 적용한다.

## 5. Projection lifecycle

| State | Meaning | Allowed entry | Allowed exit |
|---|---|---|---|
| `BUILDING` | initial population/validation in progress | approved definition + rebuild/build request | `ACTIVE`, `FAILED` |
| `ACTIVE` | validated generation is serving within freshness policy | successful build/update and security checks | `STALE`, `REBUILDING`, `FAILED`, `ARCHIVED` |
| `STALE` | freshness/version/drift threshold exceeded | drift/freshness detection | `REBUILDING`, `ACTIVE` after validated catch-up, `FAILED`, `ARCHIVED` |
| `REBUILDING` | a new isolated generation is being produced | authorized rebuild from any non-archived state | `ACTIVE` after atomic validated cutover, `FAILED`, `STALE` |
| `FAILED` | generation cannot safely serve or update | validation/update/rebuild integrity failure | `REBUILDING`, `ARCHIVED` |
| `ARCHIVED` | definition/generation retired from serving | approved retirement after consumer/dependency review | terminal; a replacement uses a new generation/approved definition |

Projection lifecycle는 aggregate business lifecycle와 분리된다. Projection `ACTIVE`는 source business eligibility나 external publication success를 의미하지 않고, Projection `FAILED`는 source aggregate를 실패 상태로 변경하지 않는다.

## 6. Version registry

| Version | Owner | Purpose | Change rule | Must not be used as |
|---|---|---|---|---|
| Aggregate Version | source Aggregate | canonical concurrency/source state identity | authoritative mutation마다 증가 | projection freshness alone |
| Event Version | [Canonical Event Registry](00_EVENT_REGISTRY.md) | immutable event schema/contract and ordering compatibility | approved schema/contract version policy에 따름 | aggregate or projection schema version |
| Projection Definition Version | this Registry | purpose/source/security/rebuild policy identity | approved definition change마다 증가 | record refresh counter |
| Projection Schema Version | Projection Owner/Data Owner | read-model field/shape compatibility | schema compatibility/rebuild review 후 증가 | business truth version |
| Projection Record Version | Projection runtime contract | one projected record's applied source progress | validated event/snapshot apply마다 monotonic | global event offset or Approval version |
| Rebuild Generation | Rebuild Authority | isolated build/cutover identity | each build/rebuild receives new immutable generation | source history replacement |

Event offset, snapshot reference와 policy version은 supporting metadata로 별도 기록한다. 어느 version도 다른 version의 의미를 대신하지 않는다.

## 7. Security contract

- Source classification의 highest applicable level과 field restriction을 상속한다.
- Purpose, tenant, audience, consent/Permission과 retention boundary를 상속한다.
- Public serving은 `PUBLIC_APPROVED` exact fields와 reconciled canonical eligibility만 허용한다.
- Projection query, cache hit, monitoring signal과 rebuild success는 business authority가 아니다.
- Rebuild/Replay는 scoped service/operator identity, authorization, SoD, source/event/schema version, idempotency와 immutable audit를 요구한다.
- Restricted source/event payload, credential, raw provider response와 private diagnostic을 Projection에 불필요하게 복제하지 않는다.
- Downgrade/declassification은 Projection에서 독자적으로 수행할 수 없다.

적용 control: `SEC-001/002/006/010/012~015/017~24/028/030~032`와 [Canonical Security Registry](00_SECURITY_REGISTRY.md).

## 8. Drift policy

| Drift | Detection evidence | Required disposition |
|---|---|---|
| Missing Projection | source exists, expected projection absent | mark `STALE`/`FAILED`; scoped rebuild |
| Duplicate Projection | same PRJ/source/generation identity duplicates | quarantine duplicate; no source mutation |
| Version Drift | applied source/event/schema version mismatch | stop unsafe serving; catch-up or rebuild |
| Event Gap | expected event sequence/reference missing | mark stale; validate event source before replay |
| Invalid Mapping | source identity/field/tenant/purpose mismatch | fail closed, incident/audit and rebuild review |
| Classification Drift | projected class/field is weaker/broader than source | immediately restrict serving; privacy/security incident |
| Stale Projection | freshness policy exceeded | expose staleness or deny purpose-sensitive read; rebuild/catch-up |

Registry는 drift type, owner, threshold/policy reference와 allowed disposition을 기록한다. Runtime drift evidence는 projection ID, source/version, detected time, detector, severity, classification, disposition, rebuild generation과 audit correlation을 append-only로 남긴다.

## 9. Rebuild policy

| Strategy | Scope | Mandatory guards |
|---|---|---|
| Single Projection | one projection record/source identity | exact PRJ/source/version and classification |
| Aggregate Projection | all records for one aggregate identity | aggregate snapshot/event completeness |
| Projection Family | one PRJ type or bounded tenant/purpose partition | consumer impact and capacity/safety review |
| Full Projection | complete PRJ generation | Architecture/Data/Operations approval and isolated generation |
| Snapshot Restore | approved canonical snapshot boundary | authenticity, completeness, schema/security validation |
| Event Replay | immutable event range | ordering, version, checksum, gap/duplicate/idempotency validation |

Rebuild는 isolated generation에서 수행하고 validation 후 atomic serving pointer를 전환한다. 실패한 generation은 source truth를 변경하지 않는다. Full rebuild, restricted data와 production cutover는 independent authorization/SoD, reason, monitoring, rollback과 audit를 요구한다.

## 10. Dependency and registry mapping

Projection 간 직접 business dependency는 금지한다. 다른 Projection을 optimization input으로 사용할 경우에도 canonical source identity/version으로 재검증하고 dependency failure가 authority를 만들지 않는다.

| Dependency / Registry | Mapping | Status |
|---|---|---|
| Canonical Aggregate | each PRJ row's Source Aggregate; source remains truth | VERIFIED |
| Immutable Domain Event | logical Source Event per row; [Canonical Event Registry](00_EVENT_REGISTRY.md) EVT-001~012 and [Event and Job Architecture](book-2/06_EVENT_AND_JOB_ARCHITECTURE.md) | VERIFIED |
| Decision Register | AO-035/DEC-112 primary; AO-023~034 constraints | VERIFIED |
| RTM | REQ-CONST-001/002/005~010/012/013; TRACE-015/017/018/020/023/024 | VERIFIED |
| Publication Registry | PRJ-002/004/005/006/007/008 consume confirmed Publication truth | VERIFIED |
| Workflow Registry | WF-001~012 context only; Projection never executes workflow | VERIFIED |
| API Registry | read/internal operation mapping; no command authority | VERIFIED |
| Security Registry | classification, purpose, privacy, SoD, rebuild/audit inheritance | VERIFIED |
| Event Registry | [Canonical Event Registry](00_EVENT_REGISTRY.md): EVT-001~012 | VERIFIED |
| Test Registry | frozen TEST mappings plus governance TST-007/010; dedicated runtime projection suite remains implementation scope | VERIFIED |

## 11. Validation and error rules

| Validation error | Rule |
|---|---|
| Missing Projection | PRJ-001~008 registry row absence is invalid |
| Duplicate Projection | Projection ID/type definition must be unique |
| Missing Aggregate | every row requires existing canonical source owner |
| Missing Event | every row requires a logical source event family mapped to EVT-001~012 or an approved successor Event |
| Invalid Owner | Projection/Operational/Rebuild/Monitoring owner must be named and non-business-authoritative |
| Invalid Lifecycle | only six canonical Projection states are accepted |
| Invalid Version | six version roles cannot be conflated or silently reset |
| Broken Registry Mapping | every row and shared contract must trace to required registries |

Runtime safe codes may include `PROJECTION_FAILED`, `PROJECTION_STALE`, `PROJECTION_DRIFT`, `PROJECTION_REBUILD_REQUIRED`, `EVENT_MISSING`, `EVENT_DUPLICATED`, `EVENT_ORDER_CONFLICT`. This is governance taxonomy, not implementation.

## 12. Audit requirements

Projection definition/catalog/owner/version/lifecycle/rebuild/dependency/security mapping 변경과 freeze 승인은 governance audit에 기록한다. Runtime build/update/rebuild/drift/recovery/cutover/archive는 actor/service, PRJ/source/event/schema/generation versions, classification, reason, result, timestamps와 correlation을 append-only로 기록한다.

## 13. Validation summary

- Canonical Projection IDs: 8/8, duplicate 0.
- Projection Types: 8/8, duplicate 0.
- Required fields: 15/15 per row.
- Lifecycle states: 6/6; invalid state 0.
- Version roles: 6/6; mixed role 0.
- Rebuild strategies: 6/6.
- Drift types: 7/7.
- Required registry mappings: 8/8; placeholder 0, broken reference 0.
- Business authority granted to Projection: 0.
- Runtime implementation claim: none.

## 14. Cross-references

- [Projection Index](00_PROJECTION_INDEX.md)
- [Projection Validation Report](reviews/PHASE11_7_PROJECTION_VALIDATION.md)
- [Projection Coverage Report](reviews/PHASE11_7_PROJECTION_COVERAGE.md)
- [Phase 11-7 Completion](reviews/PHASE11_7_COMPLETION.md)
