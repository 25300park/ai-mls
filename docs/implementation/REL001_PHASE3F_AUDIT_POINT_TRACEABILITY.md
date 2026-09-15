# REL-001 Phase 3F API-017 Audit Point Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-153 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `d1c8664ff4ff872ec16519ed94f0c2b18397cd22` |

## 1. 목적

DEC-151의 API-017 audit point 9개를 Job mutation, owner-local enriched `v2` intent, API-016 materialization, durable final Audit Event까지 추적한다. API-017은 intent만 소유하고 final Audit Event 생성은 API-016이 소유한다.

## 2. Audit point 추적

| Audit point | API-017 intent | API-016 event | 구현 경계 | 결과 |
|---|---|---|---|---|
| submit | `JOB_SUBMITTED` | `BackgroundJob / Submitted` | `DurableJobStore.submitJob()` transaction | PASS |
| claim | N/A | N/A | lifecycle와 audit mapping 모두 `NOT_APPLICABLE` | PASS |
| start | `JOB_STARTED` | `BackgroundJob / Started` | `DurableJobStore.startJob()` transaction | PASS |
| heartbeat | N/A | N/A | lease/heartbeat model 없음, `NOT_APPLICABLE` | PASS |
| result | `JOB_SUCCEEDED` | `BackgroundJob / Succeeded` | `DurableJobStore.succeedJob()` transaction | PASS |
| fail | `JOB_FAILED` | `BackgroundJob / Failed` | `DurableJobStore.failJob()` transaction | PASS |
| cancel | `JOB_CANCELLED` | `BackgroundJob / Cancelled` | `DurableJobStore.cancelJob()` transaction | PASS |
| expire | `JOB_EXPIRED` | `BackgroundJob / Expired` | `DurableJobStore.expireJob()` transaction | PASS |
| retry | `JOB_RETRY_SUBMITTED` | `BackgroundJob / RetrySubmitted` | `DurableJobStore.retryAsSuccessor()` transaction | PASS |

유효 audit point는 `9/9`이며 materialization mapping은 `7/7`, `NOT_APPLICABLE`은 claim/heartbeat `2/2`다. 새 event type은 `0`이다.

## 3. Evidence binding

- 모든 intent는 mutation-time `tenantId`, `scopeRef`, `occurredAt`, principal provenance와 resource identity를 유지한다.
- retry intent는 predecessor Job을 deterministic evidence reference로, successor Job을 canonical target으로 보존한다. Safe reason reference는 기존 `reason` 필드에 유지된다.
- `occurredAt`은 source chronology이며 `materializedAt`은 API-016 processing provenance다.
- API-016 source port는 read-only이고 materialization 실패 시 source intent는 삭제되지 않는다.
- 동일 intent replay는 기존 final event를 반환하고 duplicate final event는 생성하지 않는다. 동일 identity의 다른 content는 fail closed다.

## 4. 범위 제한

Automatic retry, scheduler, polling, queue/message bus, public HTTP/RPC, direct API-017 final Audit Event creation 및 신규 lifecycle/principal/tenant 의미는 모두 `0`이다. Dependency audit은 별도 승인 없이 실행하지 않는다.
