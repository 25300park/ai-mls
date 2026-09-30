# REL-002 R3-B2 API-014 Publication PostgreSQL Persistence Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-374 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준 Main | `624ea89e04717e6669fb897f8212c807c0ec72e7` |
| 범위 | API-014 Publication only |

## 요구사항 추적

| 요구사항 | 구현 근거 | 검증 근거 | 결과 |
|---|---|---|---|
| `app_publication` 8개 table 사용 | R3-B1 migration/ACL을 변경 없이 사용하고 `PostgreSqlPublicationUnitOfWork`가 8개 relation에 매핑 | R3-B1 exact contract 및 R3-B2 disposable PostgreSQL | PASS |
| canonical async persistence | Publication repository, UoW, application, runtime, transport, presentation call chain을 `Promise` 계약으로 통일 | Publication module `443/443 PASS` | PASS |
| SQLite Local/Test parity | `DurablePublicationUnitOfWork`가 동일 async contract를 구현하며 기존 create/read/update/conflict/idempotency/rollback semantics 유지 | Publication affected regression | PASS |
| PostgreSQL UoW atomicity | 한 client checkout, 단일 `BEGIN`, 동일 client의 작업, 단일 `COMMIT` 또는 `ROLLBACK`, release | focused unit + disposable PostgreSQL | PASS |
| ambiguous COMMIT fail-closed | `COMMIT` 시작 뒤 응답 실패 시 UoW 격리, 후속 실패 audit/transaction 차단, client discard | focused PostgreSQL adapter test | PASS |
| durable retry parity | PostgreSQL UoW도 persisted retry eligibility gate를 사용하며 legacy process-local retry 경로를 사용하지 않음 | focused PostgreSQL infrastructure test | PASS |
| optimistic concurrency/idempotency/audit | scope row lock/revision 비교, append-only evidence insert, canonical error mapping | focused PostgreSQL adapter tests | PASS |
| exact schema readiness | API-014 활성화 전에 `assertR3B1PublicationSchemaReady` 실행 | readiness/static/disposable evidence | PASS |
| one pool authority | `ProductionBootstrap`이 전달한 `PG_PRODUCTION_POOL`만 API-014 factory에 주입 | Production composition tests | PASS |
| runtime credential boundary | steady-state adapter는 `ai_mls_production_runtime`; migration authority/raw `DATABASE_URL`/secret 직접 소비 없음 | composition/static tests | PASS |
| Production SQLite fallback 없음 | Production composition은 `postgreSqlPool` 필수, `databasePath` 거부 | composition tests | PASS |
| bounded composition | API-014 PostgreSQL composition boundary만 준비하고 API-015/API-018/API-019/FEAT-022는 `null` fail-closed 유지; 전체 executable activation은 차단 | child-root registry 및 production-main tests | PASS |

## Transaction mapping

`PostgreSqlPublicationUnitOfWork.begin()`은 scope row를 `FOR UPDATE`로 읽어 기존 domain/persistence semantics를 staged state에 적용한다. Commit 시 revision을 비교해 scope를 갱신하고 idempotency, audit, event, execution evidence를 같은 client와 transaction에 append한다. Commit 이전 오류는 `ROLLBACK` 후 client를 release한다. `COMMIT` 시작 이후 응답이 불확실하면 rollback으로 결과를 추정하지 않고 UoW를 격리하며 connection을 discard한다.

## 범위 제한

- Production migration, Supabase/Railway/Vercel mutation 및 deployment: `0`
- API-015/API-018/API-019/FEAT-022 구현 또는 활성화: `0`
- dependency/lockfile 변경: `0`
- 별도 pool, raw `DATABASE_URL`, migration credential, secret logging: `0`

## 검증 요약

- Focused Publication: `443/443 PASS`
- Directly affected API/Admin/Production: `114/114 PASS`
- Disposable PostgreSQL 18.4 loopback: `1/1 PASS`; cleanup/port closure PASS
- Full regression: `1628 PASS / 1 authorized immutable historical fingerprint failure / 7 SKIP`
- Build/Lint/Typecheck: PASS
- `git diff --check`: PASS
