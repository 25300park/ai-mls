# REL-002 R3-B4 API-018 Connector PostgreSQL Persistence Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-376 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준 Main | `69829e93f78cacea726079089cf58f8a1be0a5a3` |
| 범위 | API-018 Connector only |

## 요구사항 추적

| 요구사항 | 구현 근거 | 검증 근거 | 결과 |
|---|---|---|---|
| `app_connector` 11개 table 사용 | 승인된 R3-B1 migration/schema/ACL artifact를 변경하지 않고 PostgreSQL UoW가 기존 relation에만 매핑 | focused + disposable PostgreSQL | PASS |
| canonical async persistence | `AsyncConnectorExecutionPersistence`를 coordinator, runtime application, host/HTTP, recovery handoff까지 전파 | focused Connector/API/recovery tests | PASS |
| SQLite Local/Test parity | 기존 `DurableConnectorExecutionUnitOfWork` semantics를 async adapter로 재사용 | SQLite async lifecycle 및 기존 Connector regression | PASS |
| PostgreSQL transaction/UoW | command마다 pool client 하나, `BEGIN` 1회, `COMMIT` 1회 또는 `ROLLBACK`, client release | adapter unit + disposable PostgreSQL | PASS |
| execution/result/evidence atomicity | invocation, result, idempotency, checkpoint, evidence를 같은 client/transaction에서 기록 | disposable lifecycle + 기존 coordinator assertions | PASS |
| idempotency와 terminal protection | scope-row 직렬화 후 exact replay는 prior result를 반환하고 append-only result/evidence는 재개방하지 않음 | 동일 idempotency key 동시 replay 및 terminal regression | PASS |
| optimistic concurrency | 모든 lease 경로가 scope-first lock hierarchy를 사용하고 동일 technical resource의 expected version 경쟁에서 정확히 한 writer만 성공 | disposable release/acquire, expiry/acquire 및 concurrent writers | PASS |
| ambiguous COMMIT quarantine | `COMMIT` 응답 불명확 시 client discard 및 UoW quarantine, blind retry 금지 | focused adapter test | PASS |
| durable retry/recovery handoff | 기존 durable idempotency와 recovery authorization 경계를 async call chain에서 보존 | coordinator/recovery regression | PASS |
| exact schema readiness | listener/activation 전에 `assertR3B1ConnectorSchemaReady` 실행 | Production bootstrap/registry tests | PASS |
| one pool authority | `ProductionBootstrap`이 전달한 `PG_PRODUCTION_POOL`만 API-018 UoW에 주입 | composition/registry tests | PASS |
| runtime credential boundary | runtime role은 `ai_mls_production_runtime`; migration role/raw `DATABASE_URL`/secret 직접 소비 없음 | migration ACL + static composition review | PASS |
| Production/Staging SQLite fallback 없음 | Production과 Staging은 PostgreSQL pool 필수이며 `databasePath`를 함께 제공하면 fail-closed | composition test | PASS |
| bounded composition | API-014/API-015/API-018 READY, API-019/FEAT-022 `null` fail-closed | registry/production-main tests | PASS |

## Transaction mapping

`PostgreSqlConnectorExecutionUnitOfWork`는 command 시작 시 shared pool에서 client 하나를 checkout한다. Lease, invocation, result, checkpoint, idempotency와 evidence 변경은 그 client의 단일 transaction에 포함된다. Commit 이전 오류는 rollback하고 client를 discard한다. `COMMIT` 응답이 불확실하면 결과를 추정하지 않고 해당 persistence instance를 quarantine한다. Append-only result 조회에는 불필요한 row lock을 사용하지 않아 승인된 `SELECT + INSERT` runtime ACL을 보존한다.

## 범위 제한

- Production migration/connection 및 Supabase/Railway/Vercel mutation: `0`
- API-019/FEAT-022 구현 또는 활성화: `0`
- dependency/lockfile 및 R3-B1 schema artifact 변경: `0`
- 독립 pool, raw `DATABASE_URL`, migration credential, secret logging: `0`

## 검증 요약

- Focused: `79/79 PASS`
- Affected Source/API: `396 PASS / 3 environment-gated SKIP / 0 FAIL`
- Disposable PostgreSQL 18.4 loopback: `1/1 PASS`; cleanup/port closure PASS
- Full regression: `1644 PASS / 1 authorized immutable historical fingerprint failure / 9 SKIP`
- Build/Lint/Typecheck: PASS
- `git diff --check`: PASS
- Changed-file secret scan: 0 findings
- Independent review: `READY`, Critical/Important/Minor `0/0/0`
