# REL-001 Phase 3B API-017 감사 매핑 매트릭스

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-131 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / API Owner / Security Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |

## 1. 판정 기준

[Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md)의 Audit 절은 아래 아홉 지점을 모두 요구한다. [Phase 2B 어휘 매핑](REL001_PHASE2B_AUDIT_EVENT_VOCABULARY_MAPPING.md) §1–3의 정확한 source/eventType/action/target/category tuple과 [Phase 2 최종 RTM](REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md) §2–3의 여섯 승인 source에 API-017은 없다. 따라서 기존 API-016 승인 event를 정확히 재사용할 수 있다고 판정할 행은 없다.

`NEW_AUDIT_EVENT_TYPE_REQUIRED`는 Audit Owner의 새 정본 어휘/매핑 결정이 필요하다는 차단 분류다. 이 문서가 event name, event ID 또는 schema를 생성했다는 뜻이 아니다. 현재 `JobService`의 event 문자열도 API-016 매핑 승인 증거가 아니다. 모든 행은 `P3A-GAP-006`에 속한다.

## 2. 정확한 아홉 감사 지점

| 지점 | 기록해야 할 근거 | 기존 매핑 재사용 검토 | 분류 | 경로 상태 |
|---|---|---|---|---|
| `submit` | initiating principal, 입력 checksum/version, purpose, policy, trace, accepted identity | Core 생성 event는 Job 제출 tuple이 아님 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `claim` | job/attempt/lease 결속, 실행 principal, claim chronology | Core domain event에는 claim tuple 없음 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `start` | exact worker/attempt, 시작 시각, policy/config | 실행 시작에 대응하는 승인 Job tuple 없음 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `heartbeat` | exact lease/attempt 증거와 source chronology | heartbeat 의미·승인 tuple 없음 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `result` | immutable result ref/checksum, attempt, downstream effect 증거 | Intake 결과 routing은 Job 완료가 아니며 `EVT-011`은 projection 전용 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `fail` | 승인된 안전 failure ref/classification, attempt, provenance | 현재 직접 append 문자열은 승인된 API-016 Job source가 아님 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `cancel` | 현재 control actor, reason, version, cancel 결과 | 기존 Core transition은 Job 취소 tuple이 아님 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `expire` | 승인 restrictive command, deadline/policy chronology, scope | projection/replay event는 Job expiry tuple이 아님 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| `retry` | 재인가 actor, predecessor eligibility, lineage/idempotency, policy | `EVT-010/012`는 rebuild/replay 전용이며 successor 제출이 아님 | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |

행별 미매핑 근거는 동일한 closed source 목록의 부재이며 `result/retry`는 [Event Registry](../00_EVENT_REGISTRY.md) 35–37행의 제한도 적용된다. `EVT-010`–`012`와 FEAT-019 recovery 증거를 일반 job 감사 권한으로 재사용하지 않는다.

## 3. 집계와 소유 경계

| 분류/지표 | 개수 |
|---|---|
| `MAPPED_EXISTING_EVENT` | `0` |
| `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `9` |
| `NOT_APPLICABLE` | `0` |
| resolved / blocked | `0/9` |
| 새로 만든 Audit event | `0` |

API-017은 승인된 mutation과 enriched source intent를 같은 owner-local transaction에 보존해야 하며 API-016만 최종 append-only Audit Event를 materialize한다. 이는 [Phase 2 최종 RTM](REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md) §3의 소유권·원자성·provenance 원칙이며 API-017 source를 추가 승인한 것이 아니다. `occurredAt`의 원 mutation chronology와 처리 시점은 분리하고 historical principal을 current Session으로 재구성하지 않는다. 새 분산 transaction이나 직접 final event 쓰기를 만들지 않는다.

`fail`의 `failureCode`는 nonblank-only여서 reason/details에 그대로 넣을 수 없다. 모든 mutation 경로는 매핑 승인 전 `BLOCKED`이며 read-only operation에도 미승인 증거의 안전성을 주장하지 않는다. owner가 정확한 event tuple, source identity, tenant/scope, policy/decision/outcome, 안전 projection을 승인해야 재검토할 수 있다.

## 4. 연계

[결정 검토](REL001_PHASE3B_API017_CANONICAL_DECISION_CLOSURE.md) §2 `B-E01/07/08/09/12` · [Operation 준비도](REL001_PHASE3B_API017_OPERATION_READINESS_MATRIX.md) · [실패 안전성](REL001_PHASE3B_API017_FAILURE_SAFETY_CONTRACT.md) · [DRAFT RTM](REL001_PHASE3_API017_TRACEABILITY_MATRIX.md) · [보고서](../reviews/REL001_PHASE3B_API017_CANONICAL_CLOSURE_REPORT.md)
