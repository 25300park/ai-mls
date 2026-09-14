# REL-001 Phase 3B API-017 operation 준비도 매트릭스

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-130 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | API Owner / Architecture Owner / Operations Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |

## 1. 적용 기준

정본 operation은 정확히 `5`개다. 아래 operation ID는 기존 `API-017`과 이름의 조합이며 새 API ID가 아니다. 근거는 [결정 검토](REL001_PHASE3B_API017_CANONICAL_DECISION_CLOSURE.md) §2의 `B-E01/02/03/04/05/09/10`, [Phase 3A 인벤토리](REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md) §2 및 [persistence 매트릭스](REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md) §3이다. 입력은 기존 논리 요구만 기록하며 final request/response schema를 승인하지 않는다.

## 2. 다섯 operation의 정확한 결정 행

| operation ID/name | authority | allowed input | current state prerequisite | resulting state | durable mutation required | idempotency owner | concurrency requirement | retry relevance | audit event requirement | handler requirement | execution readiness |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `API-017 / SubmitJob` | Domain이 허용한 제출, 현재 Session의 type/scope/purpose 재검증 | type, immutable input ref/version/checksum, purpose, 적용 policy/prompt/model/target version, trusted requested principal, deadline, idempotency/trace IDs, privacy class; exact schema 미정 | 새 제출이며 허용 type·input state/version·authority 충족; 최초 유형 미정 | AI 기준 `QUEUED`; accepted가 업무 성공은 아님 | job + idempotency + initiating provenance + 승인 audit intent의 owner-local atomic commit 필요 | API-017 소유 원칙; 분류 `UNRESOLVED` | atomic create/replay/conflict, identity 충돌 방지 미구현 | 제출이 자동 retry를 승인하지 않음 | `submit` 지점은 `NEW_AUDIT_EVENT_TYPE_REQUIRED`; 후속 worker 지점도 차단 | 승인 type-to-handler 없음 | `NOT_READY` |
| `API-017 / ReadJob` | 현재 scoped read authority, tenant/scope concealment | `job_id`, trusted read/trace context; exact schema 미정 | 권한 범위 안의 기존 job; 상태는 변경하지 않음 | 변경 없음, status/evidence projection | job mutation 없음; durable scoped snapshot 필요 | `NOT_APPLICABLE`; 조회 | 일관된 scoped snapshot과 version visibility 계약 필요 | `NOT_APPLICABLE`; 조회 | 새 mutation event를 발명하지 않음; 기존 job evidence와 visibility 미종결 | `NOT_APPLICABLE`; 직접 실행 안 함 | `NOT_READY`; worker 실행과 무관해도 durable 조회 불가 |
| `API-017 / CancelJob` | 현재 권한 있는 Domain/Operations control actor | `job_id`, expected version, reason, trusted trace context; exact schema 미정 | `QUEUED`; `RUNNING` 취소/race는 미정으로 fail-closed | `CANCELLED`; 외부 효과 rollback 보장 없음 | version-conditional job revision + chronology + 승인 audit intent 필요 | API-017 소유; 분류 `UNRESOLVED` | CAS·terminal 불변·result race 미종결 | `NOT_APPLICABLE`; 취소 | `cancel`은 `NEW_AUDIT_EVENT_TYPE_REQUIRED` | 직접 handler 호출은 없음; 진행 중 worker 관찰 경계는 미정 | `NOT_READY` |
| `API-017 / RetryAsSuccessor` | 현재 재인가된 control actor와 Operations retry 정책 | predecessor identity/version, reason, trusted trace context; exact idempotency/input schema 미정 | `FAILED`, ceiling·failure eligibility·downstream state·scope/purpose 충족; 값 미정 | predecessor terminal 유지, 새 successor `QUEUED` | predecessor link + successor + idempotency + retry evidence/intent의 atomic commit 필요 | API-017 소유; 분류 `UNRESOLVED`; 업무 효과는 downstream owner | stale predecessor 차단, lineage/replay 원자성 미구현 | successor-only; 상한·delay/backoff·실패 어휘·scheduler 미정 | `retry`는 `NEW_AUDIT_EVENT_TYPE_REQUIRED` | 승인 successor type-to-handler 없음 | `NOT_READY` |
| `API-017 / ReadJobResult` | 현재 scoped result-read authority; 과거 실행 자격과 조회 권한을 분리 | `job_id`, trusted scoped read context; distinct schema 미정 | 권한 범위 안의 job; 결과 없음/각 상태별 응답 미정 | 변경 없음, status/lineage/result/error ref/checksum projection | job mutation 없음; immutable durable result/attempt·visibility 필요 | `NOT_APPLICABLE`; 조회 | immutable result/attempt와 scoped concurrent projection 미종결 | `NOT_APPLICABLE`; 결과 조회 | 새 조회 event를 발명하지 않음; `result/fail` 이력 및 안전 projection 미종결 | `NOT_APPLICABLE`; 직접 실행 안 함 | `NOT_READY` |

`start`, `succeed`, `fail`, `claim`, `heartbeat`, `expire`는 위 다섯 개에 더할 logical operation이 아니다. internal action 경계도 승인되지 않았다. read-only 행에서 mutation event가 적용되지 않는다는 설명은 [아홉 감사 지점](REL001_PHASE3B_API017_AUDIT_MAPPING_MATRIX.md)의 `NOT_APPLICABLE` 수를 늘리지 않는다.

## 3. Tenant/scope 분류

선택 가능한 분류는 `DIRECT_TENANT_BOUND`, `DERIVED_TENANT_BOUND`, `SYSTEM_BOUND`, `UNRESOLVED`다. 현재는 정확한 승인 binding이 없어 전부 `UNRESOLVED`다. job type 등록 수가 `0`이므로 승인된 개별 type 행은 없으며 AI/Retention entity 명칭을 executable type 등록으로 간주하지 않는다.

| operation | tenant/scope 분류 | 필요한 근거 |
|---|---|---|
| `SubmitJob` | `UNRESOLVED` | originating domain의 불변 tenant/scope source |
| `ReadJob` | `UNRESOLVED` | persisted job binding에 대한 현재 scoped access |
| `CancelJob` | `UNRESOLVED` | persisted binding과 현재 control authority |
| `RetryAsSuccessor` | `UNRESOLVED` | predecessor와 successor의 권위 있는 scope 계승·재인가 |
| `ReadJobResult` | `UNRESOLVED` | historical result binding과 현재 visibility |

현재 worker, current Session 또는 optional `teamId`로 job의 tenant를 유도하지 않는다.

## 4. 최종 구현 준비도

`NO`는 필요한 계약이 닫히지 않았음을, `N/A`는 해당 operation이 그 행위를 하지 않음을 뜻한다. 공통 원칙이 있어도 identity·유형·schema가 미정이면 `YES`로 표시하지 않는다. read-only lifecycle은 변화가 없다는 원칙만 닫혔고 유형별 projection은 미정이므로 `NO`다. audit 열은 신규 조회 event 여부가 아닌 필요한 증거·projection까지 포함한다.

| operation | contract closed | identity closed | lifecycle closed | authority closed | persistence closed | concurrency closed | idempotency closed | retry closed | audit closed | handler closed | tenant/scope closed | failure safety closed | IMPLEMENTATION_READY |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `SubmitJob` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `N/A` | `NO` | `NO` | `NO` | `NO` | `NO` |
| `ReadJob` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `N/A` | `N/A` | `NO` | `N/A` | `NO` | `NO` | `NO` |
| `CancelJob` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `N/A` | `NO` | `NO` | `NO` | `NO` | `NO` |
| `RetryAsSuccessor` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` |
| `ReadJobResult` | `NO` | `NO` | `NO` | `NO` | `NO` | `NO` | `N/A` | `N/A` | `NO` | `N/A` | `NO` | `NO` | `NO` |

`CancelJob`의 handler 열은 진행 중 실행의 취소 관찰/race 때문에 `NO`이며 handler를 새로 요구하거나 구현하지 않는다. failure safety는 저장/감사/조회로 이어지는 공통 계약이 미종결이므로 모두 `NO`다.

| 집계 | 결과 |
|---|---|
| operations total | `5` |
| implementation-ready operations | `0/5` |
| durable-ready operations | `0/5` |
| transport-executable operations | `0/5` |

## 5. 연계

[결정 검토](REL001_PHASE3B_API017_CANONICAL_DECISION_CLOSURE.md) · [Handler/Worker](REL001_PHASE3B_API017_HANDLER_WORKER_COMPOSITION_DECISION.md) · [실패 안전성](REL001_PHASE3B_API017_FAILURE_SAFETY_CONTRACT.md) · [DRAFT RTM](REL001_PHASE3_API017_TRACEABILITY_MATRIX.md) · [보고서](../reviews/REL001_PHASE3B_API017_CANONICAL_CLOSURE_REPORT.md)
