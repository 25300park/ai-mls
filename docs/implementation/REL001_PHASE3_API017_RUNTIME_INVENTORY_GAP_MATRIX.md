# REL-001 Phase 3 API-017 런타임 인벤토리 갭 매트릭스

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-125 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |
| 기준일 | `2026-09-14` |
| Release / environment | `REL-001 / Staging` |

## 1. 범위

이 문서는 frozen API-017 계약과 현재 실행 코드를 대조한다. Phase 3A는 인벤토리와 갭 판정만 수행하며 durable store, worker, scheduler, transport 또는 retry 동작을 구현하지 않는다.

Canonical source는 [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md), [API Registry](../book-6/16_API_REGISTRY.md), [AI Job data contract](../book-3/15_DATA_DICTIONARY.md), [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md)다.

## 2. Canonical operation별 인벤토리

각 canonical operation에 대해 caller, authority, input/output, job identity, lifecycle, ownership, retry, persistence/execution readiness, audit/evidence, scheduler 및 미해결 semantics를 명시한다. 동작에 적용되지 않는 항목은 `N/A`로, 계약이 닫히지 않은 항목은 `OPEN DECISION`으로 기록한다.

| 확인 항목 | `SubmitJob` | `ReadJob` | `CancelJob` | `RetryAsSuccessor` | `ReadJobResult` |
|---|---|---|---|---|---|
| 호출자 | Domain API | 현재 trusted Session | 권한 있는 Domain/Operations control actor | 현재 권한 있는 control actor | 현재 trusted scoped read actor |
| 권한 | Domain Owner가 type/scope를 allowlist하고 현재 trusted Session이 제출을 승인한다. | live `job.read`와 tenant/scope concealment가 필요하다. | live control authority가 필요하며 best-effort일 뿐 외부 rollback을 뜻하지 않는다. | Operations Owner policy와 live authority 재검증이 필요하다. | `ReadJob`와 동일한 scoped read authority가 필요하다. |
| 입력 계약 | job type, immutable input ref/version/checksum, purpose, applicable policy version, requested principal, deadline, idempotency/trace ID, privacy class | `job_id`, trusted identity, trace context | `job_id`, expected version, reason, trace context | predecessor identity/version, reason, trace context | `job_id`, trusted read context |
| output contract | accepted `job_id`, type, status, attempt, chronology, ref, lineage. `QUEUED != success`. | status/evidence projection | cancelled/status 결과. 외부 rollback 보장은 없다. | 연결된 새 successor. predecessor는 reopen되지 않는다. | status/lineage와 result/error reference/checksum projection. failure reference safety는 `NOT_PROVEN`. |
| job identity | 새 opaque `job_id`; 재시작 안정성·충돌 방지·type/purpose/idempotency/evidence 결속은 `OPEN DECISION`. | 제공된 `job_id`; durable scoped lookup 결속은 `OPEN DECISION`. | 제공된 `job_id`와 expected version; durable CAS 결속은 `OPEN DECISION`. | predecessor `job_id`와 새 successor `job_id`; successor derivation은 `OPEN DECISION`. | 제공된 `job_id`; immutable attempt/result reference 결속은 `OPEN DECISION`. |
| lifecycle | `none -> QUEUED`; per-type lifecycle 범위는 `OPEN DECISION`. | 상태를 변경하지 않는다. | `QUEUED -> CANCELLED`는 canonical이며 `RUNNING` race는 `OPEN DECISION`. | `FAILED ->` 새 `QUEUED` successor; predecessor는 terminal이다. | 상태를 변경하지 않는다. |
| ownership | Domain Owner가 type/scope policy를 소유한다. initiating principal과 tenant/scope의 immutable binding은 `OPEN DECISION`. | 현재 access/isolation authority가 visibility를 소유한다. | Domain/Operations control authority가 mutation을 소유한다. | Operations policy와 current control actor가 successor 권한을 소유한다. | 현재 access/isolation authority가 historical result visibility를 소유한다. |
| idempotency | canonical idempotency/intent fingerprint의 durable binding은 `OPEN DECISION`; 현재 volatile Map만 있다. | `N/A`; read-only operation이다. | 동일 cancel request의 durable replay/conflict semantics는 `OPEN DECISION`. | exact replay가 같은 successor를 반환해야 하나 durable lineage/idempotency는 `NOT_READY`. | `N/A`; read-only operation이다. |
| concurrency | atomic create/idempotency boundary가 `NOT_READY`다. | concurrent visibility와 tenant/scope binding은 `OPEN DECISION`. | version-conditional mutation과 terminal immutability가 필요하나 durable CAS는 `NOT_READY`다. | predecessor/successor의 atomic write와 stale version 차단이 `NOT_READY`다. | immutable result/attempt projection의 concurrent read semantics는 `OPEN DECISION`. |
| retry semantics | `N/A`; 제출 자체가 automatic retry를 승인하지 않는다. | `N/A`; 읽기 동작이다. | `N/A`; 취소 동작이다. | successor-only retry이며 numeric ceiling/backoff/retryable failure source는 `OPEN DECISION`. | `N/A`; 결과 읽기 동작이다. |
| persistence readiness | `NOT_READY`: process-local job/idempotency Map만 있다. | `NOT_READY`: volatile scoped query만 있다. | `NOT_READY`: volatile state와 non-durable version check만 있다. | `NOT_READY`: fixture policy와 non-atomic volatile lineage만 있다. | `NOT_READY`: durable immutable result/attempt projection이 없다. |
| execution readiness | `NOT_READY`: handler mapping이 없다. | `N/A`: execution 동작이 아니다. | `N/A`: worker execution 동작이 아니다. | `NOT_READY`: downstream eligibility와 handler/worker contract가 없다. | `N/A`: execution 동작이 아니다. |
| audit/evidence dependency | submit identity, input checksum/version, purpose, policy, trace의 approved intent mapping이 필요하다. 현재 `0/9`. | scoped visibility와 immutable evidence projection이 필요하나 mapping은 `NOT_READY`. | reason, version, cancel result의 approved intent mapping이 필요하다. 현재 `0/9`. | reason, eligibility, lineage, idempotency의 approved intent mapping이 필요하다. 현재 `0/9`. | result/failure/attempt evidence의 immutable projection이 필요하다. failure reference safety는 `NOT_PROVEN`. |
| scheduler dependency | `N/A` | `N/A` | `N/A` | automatic scheduling은 `N/A`; 승인된 automatic retry는 없다. | `N/A` |
| unresolved semantics | durable identity, tenant binding, policy source, atomic store, handler mapping | durable scoped read와 persisted tenant/scope binding | `RUNNING` cancellation race, worker observation, durable CAS | policy source, numeric ceiling/backoff, atomic lineage, downstream eligibility | distinct operation/schema mapping, durable visibility binding, safe result/failure projection |

Canonical operation count는 `5`다. 현재 adapter에는 일곱 method(`submit`, `read`, `start`, `succeed`, `fail`, `cancel`, `retry`)가 있으나 `start/succeed/fail`은 추가 frozen logical operation이 아닌 internal lifecycle action이다. `expireDue`는 service-only이며 `JobPort`에 없다.

## 3. 현재 구현 인벤토리

| 경계 | 근거 | 현재 상태 | 갭 |
|---|---|---|---|
| Domain/application | [`JobService`](../../modules/jobs/src/job-service.ts) | exact six AI state, input ref, version check, successor link가 있다. | 모든 authoritative state가 process-local이며 tenant와 attempt history가 없다. failure reference safety도 `NOT_PROVEN`이다. |
| Interface adapter | [`JobApi`](../../apps/api/src/job-api.ts) | Session-derived actor와 shared error boundary가 있다. | `ReadJobResult`가 distinct하지 않고 worker command도 Session actor를 사용한다. |
| Composition | [`composeApiModulesBeforePublication`](../../apps/api/src/composition.ts) lines 169–189 | externally-created `JobService`를 감싼다. | API-017-owned Production factory, config, store construction이 없다. |
| Persistence | `JobService` lines 145–164 | policy/job/idempotency Map이 있다. | 재시작 시 모든 job truth가 사라지며 transaction 또는 durable CAS가 없다. |
| Execution registry | policy Map only, lines 151–163 and 447–453 | unknown submit type은 fail-closed다. | handler mapping은 `0`이며 policy는 executor registry가 아니다. |
| Worker / bootstrap | [Phase 0 topology](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) | conditional worker와 approved bounded in-process fallback이 있다. | worker application, bootstrap, lifecycle 또는 existing-port separation proof가 없다. |
| Transport | frozen route는 logical-only다. | API-017 HTTP/runtime/server adapter가 없다. | transport-executable operation은 `0/5`다. |
| Health/readiness | [Phase 0 lifecycle](REL001_PHASE0_STARTUP_LIFECYCLE_MATRIX.md) | shared canonical vocabulary가 있다. | API-017 component probe 또는 fail-closed runtime composition이 없다. |
| Release evidence | [`JOBS_API_017`](../../modules/operations/src/release-candidate-artifact.ts) lines 84–93 | `INCOMPLETE_RUNTIME_SURFACE`다. | artifact와 executable runtime이 없다. |

## 4. 계약 간 갭

| Gap ID | 정확한 blocker | 근거 | 필요한 owner 결정 |
|---|---|---|---|
| `P3A-GAP-001` | generic API-017 lifecycle이 AI Job과 Retention Job 사이에서 close되지 않았다. | AI는 six uppercase state를, Retention은 `blocked`를 포함한 별도 lowercase set을 사용한다. | 지원 job class와 per-type lifecycle mapping |
| `P3A-GAP-002` | stable durable job identity derivation/collision binding이 지정되지 않았다. | canonical opaque `job_id`; 현재 injected `idFactory()` | type/purpose/idempotency/evidence에 대한 identity derivation과 binding |
| `P3A-GAP-003` | authoritative tenant/scope persistence가 없다. | job은 optional `teamId`만 저장하고 authorization은 current actor에서 scope를 재구성한다. | exact tenant/scope field와 source; Team/Organization inference 금지 |
| `P3A-GAP-004` | claim/lease/heartbeat identity, token, expiry와 policy value가 없다. | Phase 0 `REL001-P0-GATE-005`; 현재 start는 current principal만 `workerId`로 저장한다. | technical worker identity와 lease/heartbeat contract |
| `P3A-GAP-005` | retry policy value와 Production source가 없다. | frozen contract는 bounded retry를 말하지만 fixture만 `maxAttempts=2`를 설정한다. | max attempt, retryable failure mapping, backoff/delay source |
| `P3A-GAP-006` | API-017 audit mapping이 `0/9`다. | API-016 final matrix는 six Core source만 다루며 현재 job code는 `AuditSink.append`를 직접 호출한다. | submit/claim/start/heartbeat/result/fail/cancel/expire/retry의 enriched intent/event mapping |
| `P3A-GAP-007` | bounded execution handler registry가 없다. | validation policy Map만 있다. | approved job-type-to-handler mapping과 unknown-type behavior |
| `P3A-GAP-008` | trusted worker/scheduler provenance가 없다. | Session actor가 worker command를 구동하고 `expireDue`가 `scheduler/SVC`를 만든다. | existing technical identity source; new service principal 금지 |
| `P3A-GAP-009` | restart/ambiguous `RUNNING`/late-result behavior가 executable하지 않다. | contract는 lease loss가 success가 아니며 late result를 reconcile한다고 한다. | fail-closed recovery projection; blind replay 금지 |
| `P3A-GAP-010` | durable atomic concurrency/idempotency가 없다. | check-then-set Map과 non-atomic predecessor/successor write | API-017-owned UoW transaction과 CAS boundary |
| `P3A-GAP-011` | operation-specific closed schema가 불완전하다. | frozen five operation과 adapter seven-method shape가 다르다. | exact `ReadJobResult` mapping과 internal lifecycle command boundary |
| `P3A-GAP-012` | separate worker process proof가 없다. | new transport 없이 durable claim/result/lease를 공유할 existing port가 없다. | 이후 proof 전까지 approved in-process fallback 사용 |
| `P3A-GAP-013` | current failure reference safety가 증명되지 않았다. | caller `failureCode`는 nonblank 검사만 거친 뒤 stored `SystemErrorReference`와 audit reason에 도달할 수 있다. normalization, allowlist, bounds, redaction은 모두 `NOT_PROVEN`. | approved safe failure vocabulary, normalization, allowlist, bounds, redaction 및 audit projection 결정/검증 |

## 5. 준비도 결과

| Metric | Result |
|---|---|
| Canonical operations | `5` |
| Direct in-process canonical mappings | `4/5` |
| Transport-executable operations | `0/5` |
| Durable-ready operations | `0/5` |
| Handler-backed job types | `0` |
| API-017 audit mappings | `0/9` |
| Separate worker composition | `NOT_READY` |
| Bounded in-process fallback | `TOPOLOGY_APPROVED / SEMANTICALLY_BLOCKED` |

Phase 3A inventory는 complete다. Phase 3B는 canonical decision closure로만 진행할 수 있다. Phase 3C와 이후 Production implementation은 load-bearing `P3A-GAP-001`–`013`이 명시적으로 close될 때까지 blocked다.

## 6. Phase 3A 연계 문서

- [Lifecycle and Authority Matrix](REL001_PHASE3_API017_LIFECYCLE_AUTHORITY_MATRIX.md)
- [Persistence Readiness Matrix](REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md)
- [Conditional Implementation Plan](REL001_PHASE3_API017_IMPLEMENTATION_PLAN.md)
- [Canonical Inventory Report](../reviews/REL001_PHASE3A_API017_CANONICAL_INVENTORY_REPORT.md)
