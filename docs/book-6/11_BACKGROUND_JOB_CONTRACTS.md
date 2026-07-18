# Background Job Contracts

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-07-14 |
| API Capability | API-017 |

## Purpose

AI processing, matching, expiry, delivery, reconciliation, export와 retention 같은 asynchronous work의 provider-neutral logical contract를 정의한다. Queue product, topic name 또는 worker implementation은 정하지 않는다.

## Logical Endpoints

`SubmitJob`, `ReadJob`, `CancelJob`, `RetryAsSuccessor`, `ReadJobResult`를 `POST/GET /v{major}/jobs...` logical boundary로 표현한다. Domain API만 business job을 제출하며 arbitrary job type 실행 endpoint는 제공하지 않는다.

## Request Model

`job_type`, immutable input refs/versions/checksums, authorized purpose, policy/prompt/model/target version as applicable, requested-by principal, deadline, idempotency key, request/correlation/causation IDs와 privacy class를 요구한다. Credential/raw secret을 payload에 embed하지 않는다.

## Response Model

`job_id`, accepted job type, canonical `QUEUED/RUNNING/...` status, attempt, timestamps/deadline, progress category, result/error reference와 successor/predecessor links를 반환한다. `QUEUED`는 실행/업무 성공이 아니다.

## Business Rules

- At-least-once delivery possibility를 전제로 side effect를 idempotent하게 설계한다.
- Retry는 same intent를 보존하거나 explicit successor job을 만들고 authority를 재검사한다.
- Lease/heartbeat loss는 success가 아니며 late result는 reconcile한다.
- Cancel은 best-effort command이고 external side effect rollback을 의미하지 않는다.
- Job/worker는 human approval state를 만들지 못한다.

## Authority

Domain owner가 allowed job type과 submit scope를 정의하고 Operations Owner가 execution/retry policy를 관리한다. Scheduler는 사전 승인된 time-based restrictive command만 생성한다. Worker는 lease 범위만 가진다.

## Validation

job type allowlist, input version/state, requester authority, privacy/provider policy, deadline, idempotency conflict, retry ceiling, predecessor outcome와 current downstream eligibility를 검사한다.

## Audit

submit/claim/start/heartbeat/result/fail/cancel/expire/retry, input/result checksum, worker/service principal, attempt, policy/config versions, trace IDs와 downstream effect evidence를 기록한다.

## Error Conditions

`JOB_TYPE_NOT_ALLOWED`, `JOB_INPUT_STALE`, `JOB_NOT_FOUND`, `JOB_ALREADY_TERMINAL`, `JOB_CANCEL_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RETRY_NOT_SAFE`, `RETRY_LIMIT_REACHED`, `DEPENDENCY_UNAVAILABLE`, `JOB_RESULT_INVALID`.

## Related Workflow

`WF-003` AI Processing, `WF-006` Matching, `WF-010` Publication, `WF-011` Expiration/Reverification, `WF-012` Recovery.

## Related Entity

AI Job, AI Result, Match Result, Reverification Request, Publication, Retention Job, System Error, Audit Event.

## Related AI Capability

`AI-001`–`007` for AI job types; `N/A — deterministic job control` for other types.

