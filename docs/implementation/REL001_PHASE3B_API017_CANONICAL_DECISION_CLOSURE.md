# REL-001 Phase 3B API-017 정본 결정 종결 검토

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-129 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |
| 작업 범위 | `DOCUMENTATION_ONLY` |

## 1. 결론과 승인 경계

Phase 3A 승인 결과를 보존하고 기존 정본에서 확인 가능한 원칙과 아직 승인되지 않은 실행 결정을 분리했다. 새 owner-approved 값이 제공되지 않았으므로 결정 종결을 승인하지 않는다. `JOB_IDENTITY=BLOCKED_OWNER_DECISION_REQUIRED`이며 구현 준비도와 durable 준비도는 각각 `0/5`다. [Decision Register](../00_DECISION_REGISTER.md)에 새 행을 추가하지 않는다.

최종 권고는 `BLOCK_REL001_PHASE3_API017_RUNTIME_FOUNDATION`이다. Phase 3C 구현은 승인되지 않았다. 이 초안은 새 schema, UoW, CAS, lease, state, role/capability, API, Audit event, retry 정책 또는 외부 연결을 만들지 않는다.

## 2. 근거 목록

아래 근거 ID는 이 Phase 3B 문서 집합 내부의 인용 식별자이며 새 정본 결정 ID가 아니다. 소스 코드는 관찰 증거이고 승인된 계약을 대체하지 않는다.

| 근거 ID | 정확한 위치 | 확인 내용 |
|---|---|---|
| `B-E01` | [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md), Logical Endpoints / Request Model / Authority / Validation / Audit | 다섯 operation, 입력 참조, 권한, retry 검증, 아홉 감사 지점 |
| `B-E02` | [API Registry](../book-6/16_API_REGISTRY.md), API-017 행, 41행 | Background jobs의 Domain/Operations 소유 경계 |
| `B-E03` | [Data Dictionary](../book-3/15_DATA_DICTIONARY.md), 94·103행 | `ai_job_id`, `retention_job_id`, 서로 다른 여섯 상태 |
| `B-E04` | [Status Dictionary](../book-5/13_STATUS_DICTIONARY.md), 39–44행; [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md), 74–78행 | AI Job 상태와 허용 전이, terminal successor 원칙 |
| `B-E05` | [Phase 0 topology](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md), §3–5·§8, 69–110·132–138행 | 조건부 분리, fallback, API-017 durable 소유권, 실행 identity |
| `B-E06` | [Phase 0 lifecycle](REL001_PHASE0_STARTUP_LIFECYCLE_MATRIX.md), §2·§3·§6, 27–52·94–112행 | 시작 의존성, readiness, admission 중단과 역순 종료 |
| `B-E07` | [Phase 2B 감사 어휘 매핑](REL001_PHASE2B_AUDIT_EVENT_VOCABULARY_MAPPING.md), §1–4; [Phase 2 최종 RTM](REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md), §2–3 | 승인된 여섯 Core source, 정확한 tuple, API-016 최종 event 소유권 |
| `B-E08` | [Event Registry](../00_EVENT_REGISTRY.md), 35–37행 | `EVT-010`–`012`는 projection/replay에 한정되며 일반 job 매핑이 아님 |
| `B-E09` | [JobService](../../modules/jobs/src/job-service.ts), 34–68·145–164·178·279–311·478–482·495–535행 | 주입 identity, volatile Map, nonblank-only 실패값, 직접 audit append |
| `B-E10` | [JobApi](../../apps/api/src/job-api.ts), 5·24–85행; [Phase 3A 인벤토리](REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md), §2–4 | seven-method adapter, 별도 `ReadJobResult` 부재, 13개 갭 |
| `B-E11` | [Event and Job Architecture](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md), Delivery and retry rules / Deferred details | at-least-once 원칙, 제한된 retry 개념, 수치·catalog는 미확정 |
| `B-E12` | [Admin and Audit API](../book-6/10_ADMIN_AND_AUDIT_API.md), Response Model / Business Rules / Authority | 제한된 감사 projection, 원본 비밀정보 제외, append-only 원칙 |

## 3. 필수 결정 그룹 A–O

`RESOLVED_PRINCIPLE_ONLY`는 기존 원칙의 확인이며 실행 계약 종결이나 새 승인 상태가 아니다. 나머지는 모두 `OPEN DECISION`이다.

| 그룹 | 판정 | 근거와 남은 경계 | 연결 갭 |
|---|---|---|---|
| A Job identity | `BLOCKED_OWNER_DECISION_REQUIRED` | `job_id`, `ai_job_id`, `retention_job_id`의 존재는 확인되나 관계·생성·충돌·결속은 미정이다. command/domain-derived identity나 UUID 정책을 선택하지 않는다. `B-E01/03/09` | 002 |
| B Lifecycle | `BLOCKED` | AI와 Retention을 합치지 않는다. generic lifecycle과 interruption 전이는 미정이다. `B-E03/04` | 001, 009, 011 |
| C Command authority | `BLOCKED` | 현재 Session의 권한 검사는 기존 원칙이다. operation별 owner·범위 결속은 미정이다. `B-E01/05/10` | 003, 011 |
| D Worker execution authority | `BLOCKED` | exact job/lease execution identity만 허용하나 source와 수치가 없다. `B-E05` | 004, 008 |
| E Durable persistence ownership | `RESOLVED_PRINCIPLE_ONLY` | API-017이 job truth를 소유한다. schema/UoW/CAS는 구현되지 않았다. `B-E05/09` | 010 |
| F Concurrency/version | `BLOCKED` | optimistic version 원칙은 보존하되 durable 경쟁·중복·재시작 의미는 닫히지 않았다. `B-E09/10` | 004, 009, 010 |
| G Idempotency ownership | `BLOCKED` | API-017 job idempotency와 downstream 업무 멱등성을 분리한다. exact command 결속은 미정이다. `B-E01/05/11` | 002, 010, 011 |
| H Retry eligibility | `BLOCKED` | successor-only와 재인가 원칙만 확인했다. 실패 어휘·상한은 없다. `B-E01/04` | 005 |
| I Retry scheduling | `BLOCKED` | retry 가능 여부가 자동 실행 허가가 아니다. 실행 주체·delay/backoff source는 미정이다. `B-E01/11` | 005, 008 |
| J Failure reference | `BLOCKED` | nonblank 검사는 안전성 증명이 아니다. `B-E09/12` | 013 |
| K Tenant/scope binding | `BLOCKED` | optional `teamId`는 tenant 결속을 증명하지 않는다. `B-E05/09` | 003 |
| L Principal provenance | `BLOCKED` | mutation-time 이력은 처리 시점 Session으로 재구성할 수 없다. `B-E05/07/10` | 008 |
| M Handler registry | `BLOCKED` | 정책 Map과 category 목록은 executable handler 매핑이 아니다. `B-E09/10/11` | 007 |
| N API-016 audit | `BLOCKED` | 기존 매핑 재사용 `0/9`; event를 만들지 않는다. `B-E01/07/08` | 006 |
| O Worker composition | `BLOCKED` | process 분리 `NOT_READY`; fallback은 topology만 승인됐다. `B-E05/06` | 012 |

## 4. 상태와 전이

AI Job 상태는 정확히 `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`의 `6`개다. Retention Job 상태는 별도로 `queued`, `running`, `blocked`, `succeeded`, `failed`, `cancelled`의 `6`개다. Retention 전이나 대소문자 정규화를 추론하지 않는다. `generic lifecycle=UNRESOLVED`이며 recovery/dead-letter 개념을 새 API-017 상태로 승격하지 않는다. 근거: `B-E03/04/11`.

| 현재 상태 | command/event | authority | 다음 상태 | 판정 |
|---|---|---|---|---|
| 없음 | `SubmitJob` | 허용된 Domain 제출자, 현재 Session 검증 | `QUEUED` | AI 의미만 확인; 유형 계약 미종결 |
| `QUEUED` | worker lease/start | exact assigned job/lease identity | `RUNNING` | identity/lease 미정으로 `BLOCKED` |
| `QUEUED` | `CancelJob` | 현재 권한 있는 job owner/control actor | `CANCELLED` | CAS·감사 미종결 |
| `QUEUED` | 승인된 deadline/expiry | 사전 승인 restrictive Scheduler 경계 | `EXPIRED` | 주체·정책 미정으로 `BLOCKED` |
| `RUNNING` | persisted valid result | exact assigned worker identity | `SUCCEEDED` | handler·영속 결과·감사 미종결 |
| `RUNNING` | confirmed failure | exact assigned worker identity | `FAILED` | 실패 안전성·감사 미종결 |
| `RUNNING` | 승인된 deadline/expiry | 승인된 Worker/Scheduler 경계 | `EXPIRED` | late-result·정책 미종결 |
| `FAILED` | `RetryAsSuccessor` | 재인가된 control actor와 Operations 정책 | predecessor `FAILED` 유지, 새 successor `QUEUED` | eligibility·atomic lineage 미종결 |
| `RUNNING` | `CancelJob` 또는 interruption/lease loss | 미정 | 미정 | `FAIL_CLOSED`; 기존 코드 동작을 정본으로 승격하지 않음 |
| terminal | reopen/overwrite | 허용 주체 없음 | 변경 없음 | `FAIL_CLOSED` |
| 미정 또는 알 수 없는 상태 | 정의되지 않은 command/event | 허용 주체 없음 | 변경 없음 | `FAIL_CLOSED` |

`ReadJob`와 `ReadJobResult`는 scoped 조회이며 상태를 변경하지 않는다. 미해결 lifecycle 그룹은 `3`개다: 유형별 lifecycle, `RUNNING` 취소/late-result, interrupted execution/restart projection.

## 5. 권한과 provenance

| 구분 | 기존 경계 | 남은 결정 |
|---|---|---|
| initiating principal | 제출 당시 server-resolved current Session | immutable tenant/scope/purpose/권한 증거 결속 |
| approving principal | 적용되는 domain workflow의 별도 사람 승인자 | job 실행이 승인을 만들거나 대체하지 않음; 유형별 승인 참조 미정 |
| runtime executor | exact job/attempt/lease의 기술 실행 identity | source, token, 유효기간, 제한 범위 미정 |
| job owner | Domain Owner가 type/submit scope, Operations Owner가 execution/retry 정책 소유 | executable job class별 owner 매핑 미정 |
| tenant/scope owner | originating domain의 권위 있는 영속 결속 | 모든 다섯 operation에서 `UNRESOLVED`; 현재 worker/Session 또는 Team에서 추론 금지 |

미해결 authority 그룹은 `3`개다: tenant/scope, worker/lease/scheduler provenance, operation별 control/result 권한. Worker process는 privileged principal이 아니다. `SYSTEM_ADMIN`, `SERVICE_ACCOUNT`, `WORKER_ROLE` 또는 새 capability를 만들지 않는다. 현재 코드의 `scheduler`/`SVC`를 승인된 identity로 채택하지 않는다. API-016 이력에는 mutation-time initiating/executing provenance를 보존해야 하며 처리 시점 Session으로 재구성하면 안 된다.

## 6. 영속 소유권과 재시작 경계

소유 module은 `API-017 / modules/jobs`이며 Phase 0이 job, idempotency, successor/result, lease/heartbeat evidence의 소유권을 지지한다. 아래는 논리 보존 요구이지 final database schema나 migration이 아니다. [Phase 3A persistence](REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md) §2–4와 `B-E01/05/07/09`를 따른다.

| 보존 분류 | 필요한 내용 | 미종결 경계 |
|---|---|---|
| 불변 identity/input | job/type/purpose, immutable input ref/version/checksum, privacy class, 적용 policy/prompt/model/target version, trace·idempotency 결속 | 생성·field별 권위 source 및 exact schema |
| 불변 provenance/scope | initiating principal, 적용 승인 참조, tenant/scope, 원 발생 시각 | mutation-time trusted snapshot/reference와 tenant source |
| 가변·versioned 상태 | 허용된 상태, revision, progress, deadline 및 실행 chronology | CAS·허용 변경 경계·시간 정책; 임의 deadline 갱신 불허 |
| 실행 이력 | attempt, exact worker/job/lease binding, claim/start/heartbeat 증거 | identity·lease/token/expiry/cadence는 미정 |
| append-only 결과·계보 | immutable result/checksum, 승인된 안전 failure 참조, predecessor/successor, retry 판정 이력 | 안전 표현과 atomic lineage |
| append-only 감사 intent | 승인된 source intent, mutation-time principal, scope, chronology | API-017 매핑 미승인; 최종 Audit Event는 API-016만 소유 |

재시작은 API-017의 권위 있는 저장 내용을 검증·재구성해야 한다. current Session/worker에서 tenant, 권한 이력, attempt나 성공을 복원하지 않는다. terminal 결과를 다시 열지 않고 interrupted `RUNNING`의 blind replay나 성공 추정을 금지한다. 정확한 recovery projection은 `OPEN DECISION`이다. 누락·손상된 store에는 fail-closed하며 in-memory fallback을 사용하지 않는다.

## 7. 경쟁·멱등성·retry

| 상황/경로 | 기존 요구 | 현재 판정 |
|---|---|---|
| stale write | expected version 불일치 거부, 기존 optimistic version 관례 보존 | durable CAS 없음; `BLOCKED` |
| competing execution | exact 실행 identity와 단일 논리 completion | exclusive lease 의미 미정; lease를 발명하지 않고 `BLOCKED` |
| duplicate completion | terminal 불변, 중복 업무 효과 금지 | exact replay/conflict 응답·원자 경계 미정; `BLOCKED` |
| interrupted restart | 성공 추정·자동 재실행 금지, 증거 보존 | recovery/late-result 계약 미정; `BLOCKED` |
| `SubmitJob` | API-017 소유 intent/idempotency 결속 | `UNRESOLVED`; key 존재만으로 `COMMAND_ID_BASED`를 확정하지 않음 |
| `CancelJob` | version 검사와 terminal 불변 | `UNRESOLVED`; version 검사만으로 전체를 `VERSION_ONLY`라 선언하지 않음 |
| `RetryAsSuccessor` | exact replay는 동일 successor, predecessor 불변 | `UNRESOLVED`; lineage/idempotency atomicity 없음 |
| `ReadJob`, `ReadJobResult` | 조회만 수행 | `NOT_APPLICABLE`; mutation 멱등성 대상 아님 |
| internal claim/start/heartbeat/result/fail/expire | 중복 실행·결과 경쟁 방지 | `UNRESOLVED`; command/attempt identity 미정 |
| downstream 업무 효과 | 기존 domain operation identity와 business guard | `DOWNSTREAM_OWNER`; 구체적 handler 결속 미정, API-017이 업무 소유권을 흡수하지 않음 |

`COMMAND_ID_BASED`, `DOMAIN_IDENTITY_BASED`, `VERSION_ONLY`는 이번에 확정된 경로가 없다. 전역 job 멱등성 subsystem을 추가하지 않는다.

retry 허용은 predecessor failure, 현재 authority·scope·purpose, downstream eligibility, 승인 Operations 정책을 모두 검증해야 한다. retry scheduling 주체는 별도 `OPEN DECISION`이며 자동 retry는 승인되지 않았다. `max attempts=UNRESOLVED`, `delay=UNRESOLVED`, `backoff=UNRESOLVED`, `retryable failure vocabulary=UNRESOLVED`다. numeric retry 그룹은 상한과 delay/backoff의 `2`개이며 실패 어휘와 scheduling은 별도 미해결 항목이다. fixture 값을 정책으로 사용하지 않는다.

## 8. Owner 결정이 필요한 13개 갭

아래는 Phase 3A의 load-bearing gap `13`개를 그대로 추적한다. A–O의 15개 주제나 하위 질문 개수를 새 owner decision 수로 합산하지 않는다. 모든 행의 해결 상태는 `OPEN DECISION / BLOCKED`이며 구현 승인 전에 해당 owner의 승인 근거가 필요하다.

| Gap ID | 필요한 결정 | 담당 owner | 관련 그룹 |
|---|---|---|---|
| `P3A-GAP-001` | 최초 지원 유형과 AI/Retention별 lifecycle | Architecture Owner / Domain Owners | B |
| `P3A-GAP-002` | durable job/attempt identity 생성·충돌·결속 | Architecture Owner / API Owner | A, G |
| `P3A-GAP-003` | tenant/scope field와 권위 source | Domain Owners / Security Owner | C, K |
| `P3A-GAP-004` | 실행 identity·claim/lease/heartbeat 계약과 수치 | Architecture Owner / Operations Owner | D, F |
| `P3A-GAP-005` | retry 상한·실패 어휘·delay/backoff 및 정책 source | Operations Owner | H, I |
| `P3A-GAP-006` | 아홉 API-017 감사 지점의 정확한 승인 매핑 | Audit Owner / API Owner | N |
| `P3A-GAP-007` | bounded job-type-to-handler 매핑 | Domain Owners / API Owner | M |
| `P3A-GAP-008` | immutable worker/scheduler provenance source | Security Owner / Operations Owner | D, I, L |
| `P3A-GAP-009` | interruption/restart/late-result의 fail-closed 의미 | Architecture Owner / Operations Owner | B, F |
| `P3A-GAP-010` | owner-local UoW/CAS/idempotency/lineage 원자 경계 | Architecture Owner / API Owner / Audit Owner | E, F, G |
| `P3A-GAP-011` | 다섯 operation별 closed schema와 권한·internal command 경계 | API Owner / Domain Owners | B, C, G |
| `P3A-GAP-012` | existing-port 분리 증명 또는 fallback의 실행 가능 경계 | Architecture Owner / Operations Owner | O |
| `P3A-GAP-013` | 실패 어휘·normalization·allowlist·bounds·redaction과 audit projection | Security Owner / Audit Owner / API Owner | J |

## 9. 연계 산출물

- [Operation 준비도](REL001_PHASE3B_API017_OPERATION_READINESS_MATRIX.md)
- [감사 매핑](REL001_PHASE3B_API017_AUDIT_MAPPING_MATRIX.md)
- [Handler/Worker 결정](REL001_PHASE3B_API017_HANDLER_WORKER_COMPOSITION_DECISION.md)
- [실패 안전성 계약](REL001_PHASE3B_API017_FAILURE_SAFETY_CONTRACT.md)
- [Phase 3 DRAFT 결정 추적 RTM](REL001_PHASE3_API017_TRACEABILITY_MATRIX.md)
- [Phase 3B 보고서](../reviews/REL001_PHASE3B_API017_CANONICAL_CLOSURE_REPORT.md)
- [Phase 3A 보고서](../reviews/REL001_PHASE3A_API017_CANONICAL_INVENTORY_REPORT.md), [기존 구현 계획](REL001_PHASE3_API017_IMPLEMENTATION_PLAN.md)
