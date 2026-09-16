# REL-001 Phase 6 Restart / Recovery Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-239 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Platform Owner / Operations Owner |
| 기준일 | 2026-09-16 |

## 1. Durable authority after restart

| Component | Durable truth preserved | Restart assertion | Result |
|---|---|---|---|
| Session | binding, version, access timestamps, revocation | reopen resolves current durable authority; revoked/expired remains denied | PASS |
| Administration | governed state, proposal, decision, idempotency, revision | durable Administration regression; direct Console repository access 0 | PASS |
| Audit | source intent, materialization identity, append-only final event | replay after reopen produces duplicate 0; chronology/principal unchanged | PASS |
| Jobs | Job lifecycle, operation idempotency, execution history, successor lineage | interrupted/replayed completion remains single; successor identity durable | PASS |
| FEAT-022 | provider-independent configuration/status | 3/3 remains provider-independent READY; live execution remains 0/3 | PASS |
| Console/integrated status | no process-local authority | concrete Session/Audit/Job stores close and reopen; each status call re-observes owning ports; stale READY is not cached | PASS |

## 2. Recovery invariants

| Scenario | Required behavior | Evidence | Result |
|---|---|---|---|
| revoked Session after reopen | deny, no idle refresh | Session durable/access coordinator tests | PASS |
| Audit exact replay | same final event, duplicate 0 | API-016 materializer/E2E tests | PASS |
| Audit conflict | fail closed, prior evidence unchanged | API-016 conflict tests | PASS |
| failed materialization | source intent remains durable/replayable | API-016 failure recovery tests | PASS |
| Job interrupted execution | canonical recovery without background loop | API-017 concurrency/recovery tests | PASS |
| Job completion replay | one authoritative completion | API-017 restart/idempotency tests | PASS |
| RetryAsSuccessor | manual immutable predecessor/successor lineage | API-017 Job regression | PASS |
| current Session differs from historical principal | historical mutation-time principal retained | API-016/API-017 provenance tests | PASS |
| component becomes unavailable | integrated status changes to `NOT_READY` on next observation | Phase 6 stale-readiness test | PASS |

## 3. Explicit non-behavior

- automatic retry: `0`
- scheduler: `0`
- polling/background recovery loop: `0`
- provider invocation: `0`
- external network: `0`
- process-local state replacing durable authority: `0`

Recovery evidence proves persistence and truthful re-observation only; it adds no recovery authority or lifecycle semantics.
