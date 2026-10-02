# REL-002 R3-B7 Cross-Domain Async / Unit-of-Work Hardening Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-379 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 기준 Main | `a6304f70341a93cd8b0537e5b8cbbd9a002efe6e` |
| 범위 | API-014/API-015/API-018/API-019/FEAT-022의 기존 async/UoW/lifecycle |
| Source 승인 | APPROVE_REL002_R3B7_TRANSACTION_LIFECYCLE_REMEDIATION |
| Hydration 승인 | APPROVE_REL002_R3B7_API015_HYDRATION_CONSISTENCY_REMEDIATION |

## Domain별 transaction·lock 소유권

| Domain | 기존 owner와 transaction 경계 | lock 순서 / replay | lifecycle 보강 |
|---|---|---|---|
| Publication / API-014 | begin이 client 하나를 checkout; transaction-bound in-memory repositories를 stage; commit/rollback만 physical terminal action 수행 | publication scope row → 해당 scope append-only records; 기존 scope revision/CAS 및 command key | terminal guard를 await 전에 닫음; close drain, safe connect error, rollback uncertainty quarantine |
| Administration / API-015 | begin이 client 하나를 소유; synchronous staged repositories는 DB I/O 없음; async commit이 bundle 검증 후 persist | target revision FOR UPDATE → target tracked writes → revision CAS; 추가 linkage revision은 unlocked SELECT | terminal re-entry 차단; preflight failure rollback; begin 실패 cleanup 이후 drain; reads도 추적 |
| Connector / API-018 | 각 bounded persistence command가 transaction 하나와 client 하나 소유 | scope revision → lease/invocation; invocation → result/checkpoint; technical scope → technical record; expired scope는 canonical column 순서 | close drain, connect error normalization, queued/pre-COMMIT quarantine guard |
| External Integration / API-019 | outer store transaction이 client/BEGIN/terminal action 소유; inner transaction helper는 동일 client의 work만 호출 | contract parent → mapping/observation/evidence/idempotency; contract lock 안에서 기존 ordinal 할당 | post-operation read quarantine guard; 기존 drain 유지 |
| Advisory / FEAT-022 | validated immutable command별 transaction 하나; SQLite parity 유지 | immutable unique identities 및 idempotency; FOR UPDATE/advisory lock 없음 | R3-B6 drain/rollback/quarantine/winner-read lifetime을 그대로 검증 |

새 generic UoW나 retry engine을 만들지 않았다. 반복된 transaction helper는 domain별 staged/command ownership과 error semantics 때문에 유지한다. cross-domain transaction/client 공유를 추가하지 않았으며, Connector→External handoff는 별도의 awaited domain command다. 계약의 logical reference를 변경하거나 distributed atomicity를 주장하지 않는다.

## 요구사항·검증 추적

| 요구사항 | 검증 근거 | 결과 |
|---|---|---|
| PG_PRODUCTION_POOL, physical pool 1 | canonical registry 5개 동일 port injection; disposable aggregate의 실제 native Pool 1개; child close에서 pool close 0, owner close 1 | PASS |
| child pool/secret/logging ownership 없음 | 5개 adapter source regression; new Pool/Client, raw URL/env, pool close/end, console logging 없음 | PASS |
| async 결과는 commit 이후 | 실제 PostgreSQL COMMIT gate에서 Promise 미완료·다른 client에는 row 미노출; terminal 이후 결과·release 확인 | PASS |
| transaction/client 소유권 | checkout별 SQL trace: BEGIN 1, COMMIT 또는 ROLLBACK 1, release 1; caller-owned transaction repository에 독립 commit 없음 | PASS |
| atomic rollback / explicit retry | 5개 domain 중간 write fault에서 durable residue 없음; Advisory·Administration rollback 후 명시적 재시도 성공 | PASS |
| close drain / terminal exclusivity | 최초 4 PASS / 8 FAIL → 12 PASS; 추가 failed-begin drain RED→GREEN; duplicate terminal/commit-after-rollback 차단 | PASS |
| ambiguous COMMIT / quarantine | 5개 domain waiting checkout이 ambiguous COMMIT 이후 SQL 없이 거부; rollback uncertainty destroy·quarantine; 기존 domain tests | PASS |
| API-015 hydration consistency | resource/proposal query·linkage semantics 유지; 첫째/둘째 resource 저장, full proposal count 2, distinct target concurrent commit; target FOR UPDATE 1개만 | PASS |
| invalid linkage / version semantics | 기존 Administration corrupt payload/ACTIVE-without-decision fail-closed tests 및 stale same-resource commit; Connector actual technical version race 성공 1개 | PASS |
| lock hierarchy / no global lock | scoped ordering review, deterministic expired scope SQL regression; held Publication lock과 다른 tenant Connector 진행; 새 lock/격리 수준 없음 | PASS |
| independent schema readiness | 5개 기존 verifier/grants; schema 하나씩 rename 시 해당 readiness 거부, 나머지 4개 PASS | PASS |
| runtime role / migration exclusion | ai_mls_production_runtime으로 actual queries; migration SET ROLE 및 5개 schema CREATE 거부; ACL 변경 0 | PASS |
| Production fallback/authority isolation | 기존 Production configuration·registry·bootstrap tests; raw URL/SQLite fallback 없음; cross-domain scope/JSON/ordinal/schema 변경 0 | PASS |
| bootstrap resource lifecycle | concurrent close가 동일 shutdown completion을 기다림; listener/worker/root/session/identity/pool cleanup 순서는 그대로 | PASS |

## 검증 및 제한

Focused: R3-B7 25 PASS 및 concurrent bootstrap close 1 PASS. Affected: 66 PASS. Disposable PostgreSQL: 기존 5개 + shared-pool 1개 = 6 PASS. 최종 Build/Lint/Typecheck/full-regression, diff/secret/doc 검증은 [Completion Report](../reviews/REL002_R3B7_COMPLETION_REPORT.md)를 따른다.

READ COMMITTED와 기존 multi-statement global hydration을 유지한다. 추가 revision SELECT는 snapshot isolation이나 다른 resource의 write lock을 의미하지 않는다. concurrent unstable/invalid linkage는 기존처럼 fail-closed이며 blind retry를 추가하지 않았다.

5개 persistence composition READY, Production deployability BLOCKED. R3-B8 aggregate startup gate 및 R3-D listener/worker redesign은 수행하지 않았다. Production/Railway/Supabase mutation 0/0/0. Commit은 승인된 단일 R3-B7 closeout Git 기록을 따른다. Push NOT_PERFORMED. [Master Index](../00_MASTER_INDEX.md).
