# REL-001 Phase 3B.1 API-017 Owner Decision Register

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-135 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `720b1d519427b49a070db52ffe059f113ecf97c2` |
| 작업 범위 | `DOCUMENTATION_CANONICAL_DECISION_ONLY` |

## 1. 판정

Phase 3B의 13개 load-bearing gap 중 11개에는 기존 frozen 계약을 넘지 않는 최소 결정안을 기록했다. `P3A-GAP-005`의 자동 retry 수치와 `P3A-GAP-006`의 API-016 event mapping은 별도 owner 승인이 없어 닫지 않는다. 따라서 remaining load-bearing decisions는 `2`이고 Phase 3C는 `NOT_AUTHORIZED`다.

이 문서의 `CLOSED_FOR_PHASE3B1`은 Phase 3B.1 결정안이 기존 정본과 양립한다는 뜻이다. Production 구현 또는 전역 Decision Register 승인 완료를 의미하지 않는다. 두 blocker가 닫히기 전 최종 권고는 `BLOCK_REL001_PHASE3_API017_RUNTIME_FOUNDATION`이다.

## 2. 결정 등록부

| Gap | 결정 | Phase 3B.1 disposition | 근거 |
|---|---|---|---|
| `P3A-GAP-001` | API-017 control lifecycle은 `QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED/EXPIRED`를 사용한다. Retention domain lifecycle은 별도 truth로 유지한다. 초기 REL-001 handler set은 세 advisory job class로 제한한다. | `CLOSED_FOR_PHASE3B1` | DOC-API-012, DOC-ARCH-007, Data/Status Dictionary |
| `P3A-GAP-002` | `jobId`는 API-017 owner가 acceptance transaction에서 생성하는 opaque durable identity다. repository 범위에서 unique하고 immutable하며 UUID 형식을 요구하지 않는다. | `CLOSED_FOR_PHASE3B1` | DOC-API-012 request/response model |
| `P3A-GAP-003` | 초기 세 job class는 모두 originating domain snapshot에서 `tenantId`와 `scopeRef`를 가져오는 `DERIVED_TENANT_BOUND`다. Session/worker 추론은 금지한다. | `CLOSED_FOR_PHASE3B1` | Phase 0 topology, Security isolation rules |
| `P3A-GAP-004` | REL-001은 option C인 bounded single in-process worker를 사용한다. lease/claim/heartbeat authority는 만들지 않고 durable CAS만 사용한다. | `CLOSED_FOR_PHASE3B1` | Phase 0 approved fallback |
| `P3A-GAP-005` | retry eligibility는 `FAILED + DEPENDENCY_UNAVAILABLE + current live revalidation`으로 제한한다. 자동 scheduling은 불허한다. 수치 ceiling/backoff는 승인되지 않았다. | `PARTIAL_BLOCKED_NUMERIC_POLICY` | DOC-ARCH-007 transient-only rule |
| `P3A-GAP-006` | 9개 지점은 기존 event에 매핑되지 않으며 모두 `NEW_AUDIT_EVENT_TYPE_REQUIRED`다. 별도 Audit Owner amendment가 필요하다. | `BLOCKED_AUDIT_AMENDMENT_REQUIRED` | Phase 2 final mapping registry |
| `P3A-GAP-007` | 초기 allowlist는 `AI_LISTING_PARSE`, `AI_REQUIREMENT_PARSE`, `AI_MATCHING`뿐이다. 모두 existing `AdvisoryRuntime.execute()`로 연결되는 advisory-only handler다. | `CLOSED_FOR_PHASE3B1` | API-004/009/010, AI-001/004/005 |
| `P3A-GAP-008` | execution identity는 durable `jobId + attempt` 결속이다. process instance/worker label은 provenance일 뿐 authority가 아니다. | `CLOSED_FOR_PHASE3B1` | worker has execution-only authority |
| `P3A-GAP-009` | restart 때 terminal result는 replay하고, `RUNNING` without terminal evidence는 재실행하지 않는다. owner cancel 또는 별도 후속 승인만 허용한다. | `CLOSED_FOR_PHASE3B1` | no blind replay, successor-only rule |
| `P3A-GAP-010` | job mutation, version, command idempotency, lineage, safe result/failure ref와 enriched audit intent를 한 API-017 owner-local transaction으로 commit한다. | `CLOSED_FOR_PHASE3B1` | DEC-141 pattern; API-016 final ownership preserved |
| `P3A-GAP-011` | public surface는 frozen 5 operations뿐이며 worker commands는 internal-only다. unknown field/type/transition은 fail closed다. | `CLOSED_FOR_PHASE3B1` | DOC-API-012 closed logical endpoints |
| `P3A-GAP-012` | `JOBS_API_017_CONTROL`과 worker는 REL-001 Staging Platform Host 내 bounded in-process composition을 공유한다. HTTP/RPC/bus는 추가하지 않는다. | `CLOSED_FOR_PHASE3B1` | Phase 0 option C fallback |
| `P3A-GAP-013` | raw failure는 trusted mapper에서 `DEPENDENCY_UNAVAILABLE` 또는 `JOB_RESULT_INVALID`로만 정규화한다. unknown/raw diagnostic은 저장하지 않고 fail closed한다. | `CLOSED_FOR_PHASE3B1` | DOC-API-012 error vocabulary |

## 3. Identity와 immutable binding

`jobId`는 caller가 제공하지 않는다. API-017 owner가 submit acceptance와 함께 생성·저장하며 collision은 transaction 전체를 거부한다. `requestId`와 `correlationId`는 추적 정보일 뿐 identity 또는 replay authority가 아니다.

`SubmitJob` replay identity는 `tenantId + scopeRef + originatingDomainCommandId + jobType`이다. 같은 identity와 같은 canonical input fingerprint는 같은 `jobId`를 반환하고, 다른 fingerprint는 `IDEMPOTENCY_CONFLICT`다. `jobId`, job type, originating command, tenant/scope, immutable input references/checksums, purpose/privacy, created chronology는 변경할 수 없다.

## 4. Common lifecycle

| Current | Command/event | Authority | Next | Rule |
|---|---|---|---|---|
| none | `SubmitJob` | live-authorized originating Domain API | `QUEUED` | atomic identity/input/idempotency/audit intent |
| `QUEUED` | internal execute start | bounded in-process worker over accepted identity | `RUNNING` | expected version CAS; attempt increments once |
| `QUEUED` | `CancelJob` | live-authorized control actor | `CANCELLED` | expected version CAS |
| `QUEUED` | deadline observed before start | API-017 restrictive time rule | `EXPIRED` | no execution |
| `RUNNING` | trusted normalized result | same `jobId + attempt` executor | `SUCCEEDED` | result ref/checksum immutable |
| `RUNNING` | trusted normalized failure | same `jobId + attempt` executor | `FAILED` | safe failure only |
| `RUNNING` | `CancelJob` | live-authorized control actor | `CANCELLED` | best effort; cannot roll back downstream effect |
| `RUNNING` | deadline observed | API-017 restrictive time rule | `EXPIRED` | late result is not silently accepted |
| `FAILED` | `RetryAsSuccessor` | live-authorized control actor + retry eligibility | predecessor unchanged; new `QUEUED` successor | atomic lineage; numeric ceiling remains blocker |
| terminal | any overwrite/reopen | none | unchanged | fail closed |
| any | unknown command/event | none | unchanged | fail closed |

Retention Job의 `blocked` 등 domain lifecycle은 이 API-017 execution lifecycle로 변환하거나 덮어쓰지 않는다. API-017 terminal outcome은 downstream business success 또는 approval이 아니다.

## 5. Operation별 idempotency owner

| Operation | Classification | Exact binding |
|---|---|---|
| `SubmitJob` | `COMMAND_ID_BASED` | originating domain command identity + tenant/scope + canonical input fingerprint |
| `ReadJob` | `NOT_APPLICABLE` | read-only; access checks precede disclosure |
| `CancelJob` | `COMMAND_ID_BASED` | cancel command identity + `jobId` + expected version + canonical reason reference |
| `RetryAsSuccessor` | `COMMAND_ID_BASED` | retry command identity + predecessor `jobId/version` + eligibility snapshot |
| `ReadJobResult` | `NOT_APPLICABLE` | read-only; exact immutable result/failure reference |

Downstream side-effect idempotency remains `DOWNSTREAM_OWNER`; API-017 replay cannot authorize or duplicate downstream mutation.

## 6. Remaining approval requests

1. Operations Owner must either approve an exact manual successor ceiling or explicitly reconcile the frozen `retry ceiling` requirement with `NO_FINITE_MAX_REQUIRED`. Automatic retry remains `NOT_AUTHORIZED`, so delay/backoff is not active.
2. Audit Owner must approve the nine new API-017 source/event tuples described in [Audit Mapping Decision](REL001_PHASE3B1_AUDIT_MAPPING_DECISION.md). API-017 cannot invent them.

Until both are approved, `SubmitJob`, `CancelJob`, and `RetryAsSuccessor` are not implementation-ready and Phase 3C remains blocked.
