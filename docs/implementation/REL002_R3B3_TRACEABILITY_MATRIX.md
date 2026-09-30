# REL-002 R3-B3 API-015 Administration PostgreSQL Persistence Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-375 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준 Main | `f0a5e041890e504df9bc245ecfcc0c740438fbe5` |
| 범위 | API-015 Administration only |

## 요구사항 추적

| 요구사항 | 구현 근거 | 검증 근거 | 결과 |
|---|---|---|---|
| `app_administration` 9개 table 사용 | 승인된 R3-B1 migration/ACL을 변경하지 않고 PostgreSQL UoW가 canonical table/evidence relation에 매핑 | focused + disposable PostgreSQL | PASS |
| canonical async persistence | Administration repository, UoW, application, HTTP call chain을 `Promise` 계약으로 연결 | focused Administration/API tests | PASS |
| SQLite Local/Test parity | 기존 durable SQLite UoW를 동일 async port로 감싸 business semantics를 재사용 | 기존 workflow regression + async adapter test | PASS |
| PostgreSQL UoW atomicity | 한 client checkout, 단일 `BEGIN`, governed state/evidence/idempotency write, 단일 `COMMIT` 또는 `ROLLBACK`, release | unit + disposable PostgreSQL | PASS |
| ambiguous COMMIT quarantine | `COMMIT` 결과가 불확실하면 UoW를 격리하고 client를 discard | focused PostgreSQL adapter test | PASS |
| idempotency/version/audit | exact identity, optimistic version, decision/evidence 및 idempotency를 같은 transaction에 보존 | workflow + PostgreSQL tests | PASS |
| Production Session 경계 | canonical Session resolver를 명시적으로 주입하며 현재 미충족 Production identity prerequisite에서는 fail-closed; body-authored authority와 ad-hoc resolver 없음 | composition + API tests | PASS |
| exact schema readiness | listener/activation 전에 `assertR3B1AdministrationSchemaReady` 실행 | Production bootstrap tests | PASS |
| one pool authority | `ProductionBootstrap` 전달 pool만 API-015 factory/UoW/Session resolver에 주입 | registry/composition tests | PASS |
| runtime credential boundary | steady-state role은 `ai_mls_production_runtime`; migration authority/raw `DATABASE_URL`/secret 직접 소비 없음 | static/composition tests | PASS |
| Production SQLite fallback 없음 | Production은 PostgreSQL pool 필수, `databasePath` 동시 사용 거부 | composition tests | PASS |
| bounded composition | API-014/API-015 READY, API-018/API-019/FEAT-022 `null` fail-closed | registry/production-main tests | PASS |

## Transaction mapping

`PostgreSqlAdministrationUnitOfWork`는 scope revision을 잠근 뒤 current state를 읽고 기존 Administration semantics를 staged transaction에 적용한다. 승인 시 governed state version, proposal/decision evidence, audit linkage, idempotency를 같은 client에서 기록한다. Commit 이전 오류는 rollback하며, `COMMIT` 응답이 불확실하면 결과를 추정하지 않고 UoW를 격리한다.

## 범위 제한

- Production migration/connection 및 Supabase/Railway/Vercel mutation: `0`
- API-018/API-019/FEAT-022 구현 또는 활성화: `0`
- dependency/lockfile 및 R3-B1 schema artifact 변경: `0`
- 독립 pool, raw `DATABASE_URL`, migration credential, secret logging: `0`

## 검증 요약

- Focused: `80/80 PASS`
- Affected Administration/API/Admin Console/Production: `321 PASS / 1 environment-gated SKIP / 0 FAIL`
- Disposable PostgreSQL 18.4 loopback: `1/1 PASS`; cleanup/port closure PASS
- Full regression: `1637 PASS / 1 authorized immutable historical fingerprint failure / 8 SKIP`
- Build/Lint/Typecheck: PASS
- `git diff --check`: PASS
- Independent review: READY; Critical/Important/Minor `0/0/0`
