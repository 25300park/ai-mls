# REL-002 Phase 2D-0B Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-326 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |

## 1. 목적

본 계획은 승인된 DEC-179~182를 별도 implementation authorization 이후 실행할 최소 순서를 정의한다. Runtime driver 선택은 `pg`로 닫혔고 `@types/pg`는 TypeScript compilation에 필요한 경우에만 허용된다. 이 문서 자체는 dependency 변경, implementation, external infrastructure, migration 또는 Production write를 실행하지 않는다.

## 2. Decision gate

| Decision | Proposed outcome | Current status |
|---|---|---|
| DEC-179 | async Production PostgreSQL adapter contract; SQLite sync local/test preservation | `APPROVED` |
| DEC-180 | Railway process-owned pool and checked-out-client transaction ownership | `APPROVED` |
| DEC-181 | separate PostgreSQL migration/verify artifact and engine-aware ledger | `APPROVED` |
| DEC-182 | SQLite local/test/historical preservation; Production selection prohibited | `APPROVED` |

Implementation starts only after separate implementation authorization. Driver/package choice is limited to `pg` and conditionally required `@types/pg`; this closeout makes no dependency or lockfile change.

## 3. Bounded execution sequence

### Task 1 — Contract separation

- extract engine-neutral Session/workload/schema contracts;
- add async Production persistence ports;
- preserve existing SQLite interfaces/adapters/tests;
- RED: Production composition cannot accept synchronous SQLite adapter.

### Task 2 — Driver and pool adapter

- add only the pre-approved `pg` runtime driver and `@types/pg` only if compilation requires it, after implementation authorization;
- implement driver-neutral pool/client adapter;
- enforce TLS, config bounds, sanitization and no automatic retry;
- RED: secret/URI/SQL/stack leakage, hidden defaults, Vercel construction.

### Task 3 — PostgreSQL Session adapter

- implement exact transaction/CAS/revocation semantics;
- verify rollback, uncertainty, restart and concurrency;
- RED: stale write succeeds, revocation not atomic, duplicate evidence, unsafe diagnostics.

### Task 4 — PostgreSQL workload authority adapter

- read exact registered workload identity/evidence;
- retain existing live authorization path;
- RED: caller tenant/principal override, inactive registration accepted, role/scope duplication.

### Task 5 — Migration and compatibility

- create exact PostgreSQL Up/Verify artifacts;
- implement read-only `pg_catalog` validator;
- test only against local/approved ephemeral PostgreSQL;
- retain SQLite artifact/history unchanged.

### Task 6 — ProductionBootstrap async transition

- keep `startProductionRuntime()` as sole canonical entry, returning a Promise;
- place pool/read-only checks before gate and all mutations/roots after gate;
- update five-root wiring only as necessary for Identity boundary;
- separately inventory non-Identity SQLite child stores; do not claim them PostgreSQL-ready.

### Task 7 — Verification and evidence

- focused adapter/migration/validator tests;
- Session/Identity/Auth/ProductionBootstrap affected tests;
- concurrency/restart/failure/security tests;
- full regression once;
- lint, typecheck, clean build, verify constituents;
- architecture checksum, `git diff --check`, gitleaks;
- independent review;
- completion report and traceability.

## 4. Test matrix

| Area | Required evidence |
|---|---|
| migration | clean apply, exact replay, conflict, partial state, rollback, zero seed |
| schema | exact catalog match; column/type/null/check/index/trigger/ledger drift rejection |
| Session | create/read/CAS/revoke, concurrent stale write, restart, commit uncertainty |
| workload | exact registration, tenant/principal/evidence binding, inactive fail-closed |
| pool | acquire/connect/statement/idle-tx/shutdown timeout, exhaustion, pool-last close |
| bootstrap | pre-gate mutation/listener/worker `0`, cleanup, async sole entry, bypass `0` |
| security | TLS verification, least privilege, sanitized diagnostics, Vercel secret `0` |
| preservation | SQLite local/test PASS; historical Phase 2B evidence unchanged |

No Production or Supabase smoke test runs until exact non-Production/Production authorization is separately granted.

## 5. Stop conditions

Stop and request AO review if implementation requires:

- new public API, route, role, capability or auth authority;
- Supabase Auth/RLS as business authority;
- a generic persistence subsystem beyond bounded Identity adapters;
- driver/dependency without approval;
- migration execution, Production DB write or identity seed;
- hidden retry, fallback or timeout;
- external infrastructure/network/credential action;
- reinterpretation of non-Identity child stores as PostgreSQL-ready.

## 6. Phase 2B migration artifact classification

| Existing item | Classification |
|---|---|
| logical domain/schema requirements | `REUSE` |
| schema compatibility implementation | `MODIFY_OR_REPLACE` |
| SQLite Up/Verify SQL | `RETAIN_HISTORICAL_ONLY` / `REPLACE_FOR_PRODUCTION` |
| SQLite migration tests | `REUSE` for local/test and add separate PostgreSQL suite |
| completion/RTM evidence | `RETAIN_HISTORICAL_ONLY` |

## 7. Completion criteria for future implementation

- PostgreSQL adapters and validator: implemented and verified;
- SQLite Production selection: impossible/fail-closed;
- async Production bootstrap: sole entry and bypass `0`;
- migration artifact: implemented but execution `0` until controlled gate;
- new APIs/roles/capabilities/auth authority: `0`;
- dependencies: only separately approved driver change;
- Gaps 004/005/006: reevaluate from evidence, never close by design alone.

## 8. Current status

Implementation `NOT_STARTED`, migration execution `0`, Production DB writes `0`, deployment `0`, credentials `0`, commit `NOT_CREATED`, push `NOT_PERFORMED`.
