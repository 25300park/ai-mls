# REL-001 Phase 3C Durable Job Store Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-145 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `074bfb60920c479ca4b769b068e41d53d9604782` |

## 1. Scope

Phase 3B.1/3B.2의 승인 결정을 API-017 소유의 단일 SQLite persistence boundary에 연결한다. 범위는 durable Job state, history, command idempotency, manual successor lineage 및 enriched v2 audit intent이며 worker lifecycle, scheduler, polling, external queue, public HTTP와 final API-016 Audit Event는 제외한다.

## 2. Canonical operation trace

| Operation | Durable boundary | Direct evidence | Result |
|---|---|---|---|
| `SubmitJob` | immutable create, scoped command replay/conflict, atomic history/intent/idempotency | submit/reopen/identity tests | PASS |
| `ReadJob` | exact tenant/scope binding and immutable safe DTO | access/restart/concealment tests | PASS |
| `CancelJob` | live stored binding, expected version, exact replay | cross-tenant and restart replay tests | PASS |
| `RetryAsSuccessor` | failed predecessor remains immutable; one successor lineage per predecessor | successor/replay/conflict/success rejection tests | PASS |
| `ReadJobResult` | terminal result or normalized failure evidence only | success and safe failure tests | PASS |

Canonical operations represented: `5/5`.

## 3. Persistence and integrity trace

| Requirement | Implementation | Verification | Result |
|---|---|---|---|
| Durable state | `jobs_job_records` with exact schema validation and `FULL` synchronous WAL | close/reopen state and result | PASS |
| Immutable history | append-only `jobs_job_history` | direct update/delete rejected | PASS |
| CAS | version predicate plus immutable fingerprint predicate | stale version and terminal duplication | PASS |
| Idempotency | operation-local durable command records | exact replay `0` duplicate mutation; conflict fail closed | PASS |
| Lineage | append-only predecessor/successor relation | successor survives restart; duplicate successor `0` | PASS |
| Chronology | server clock for create/start/terminal/successor mutation | stored history survives restart without rewrite | PASS |
| Tenant/scope | original binding persisted and checked before disclosure/control replay | wrong tenant/scope concealed | PASS |
| Principal evidence | mutation-time initiating provenance and authority evidence persisted | create/reopen equality assertion | PASS |
| Failure safety | module-issued normalized failure object and opaque safe reference | raw/unknown/forged failure rejected | PASS |
| Audit boundary | owner-local API-017 v2 intent, append-only and atomic | injected intent failure rolls back Job; final API-016 event table `0` | PASS |

## 4. Audit mapping trace

Phase 3C generates only the seven approved mutation intents: `JOB_SUBMITTED`, `JOB_STARTED`, `JOB_SUCCEEDED`, `JOB_FAILED`, `JOB_CANCELLED`, `JOB_EXPIRED`, `JOB_RETRY_SUBMITTED`. `claim` and `heartbeat` remain `NOT_APPLICABLE`. `sourceDomain` is `API-017`; API-016 final event creation is `0`.

## 5. Verification evidence

| Gate | Result |
|---|---|
| Phase 3C focused plus existing Job/API-017 | `23/23 PASS` |
| Phase 2 API-016, Phase 1G, Phase 1D and Job affected regression | `149/149 PASS` |
| Full regression | fresh clean-build output `1373/1373 PASS` |
| Lint / Typecheck / clean build / verify constituents | PASS |
| Architecture checksum | `153/153 PASS`; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Dependency / lockfile changes | `0` |
| Dependency audit | `NOT_RUN` — Phase 3C network approval 없음 |

## 6. Deferred boundaries

- worker execution lifecycle, handler invocation, polling daemon, scheduler, timer와 external queue
- automatic retry; `RetryAsSuccessor`는 manual only
- public HTTP/RPC transport
- FEAT-022 advisory execution
- API-016 final Audit Event materialization

이 문서는 Phase 3C durable foundation의 실제 evidence만 기록하며 Phase 3D+ 완료나 REL-001 acceptance를 선언하지 않는다.
