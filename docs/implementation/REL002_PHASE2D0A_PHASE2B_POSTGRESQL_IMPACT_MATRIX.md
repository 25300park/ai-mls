# REL-002 Phase 2D-0A Phase 2B PostgreSQL Impact Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-318 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Data Owner / Architecture Owner |
| 기준일 | 2026-09-18 |

## 1. 목적

Phase 2B의 SQLite 구현을 Supabase PostgreSQL Production target 관점에서 `REUSE`, `MODIFY`, `REPLACE`로 분류한다. 기존 파일과 historical evidence는 삭제·재작성하지 않으며 PostgreSQL artifact는 별도 승인 후 새 identity/checksum으로 작성한다.

## 2. Runtime and schema impact

| 대상 | 현재 SQLite 결합 | 분류 | PostgreSQL 최소 경계 |
|---|---|---|---|
| Domain identity/authority contract | `RegisteredServiceWorkload` 의미와 tenant/principal binding | `REUSE` | domain vocabulary, authority separation, no-secret/no-authz-duplication 유지 |
| `SessionRepository` / UoW semantics | synchronous transaction callback, optimistic version/idempotency | `MODIFY` | PostgreSQL transaction/connection abstraction; async boundary 결정 필요 |
| `DurableSessionUnitOfWork` | `node:sqlite`, file path, `DatabaseSync`, PRAGMA/WAL, `BEGIN IMMEDIATE` | `REPLACE` | pooled PostgreSQL adapter, explicit transaction/isolation/error mapping, no runtime schema creation |
| `DurableRegisteredServiceWorkloadStore` | read-only `DatabaseSync`, SQLite file path | `REPLACE` | PostgreSQL read adapter with exact tenant/identity binding and existing fail-closed resolver behavior |
| Schema compatibility constants | required fields, unique tenant/principal, allowed values | `REUSE` | logical contract retained |
| Schema introspection | `sqlite_schema`, `PRAGMA table_xinfo/index_list/foreign_key_list` | `REPLACE` | `pg_catalog`/`information_schema` based exact column/constraint/index/version validation |
| Migration DDL | SQLite affinity, `CREATE TABLE IF NOT EXISTS`, SQLite ledger/verification | `REPLACE` | new PostgreSQL forward artifact and verification artifact; historical hash immutable |
| Transaction/locking | SQLite file lock and `BEGIN IMMEDIATE` | `REPLACE` | PostgreSQL transaction isolation, lock/statement timeouts, migration concurrency contract |
| Index contract | PK, unique `(tenant_id, principal_id)`, tenant/status index | `MODIFY` | logical index reuse; exact PostgreSQL definitions/names validated |
| Connection lifecycle | local file handles owned by UoW/store | `REPLACE` | Railway-owned pool lifecycle after bootstrap PASS; bounded shutdown; pre-gate check read-only only |
| Backup/restore | file/exact-target assumptions | `REPLACE` | Supabase project backup/PITR plus tested restore evidence tied to exact Production project |

`SessionUnitOfWork`와 repository ports는 현재 synchronous다. 일반 PostgreSQL client는 asynchronous I/O를 사용하므로 adapter만 교체할 수 있다고 가정하지 않는다. Port async amendment, transaction callback shape, driver/package 선택은 `OPEN DECISION`이며 별도 AO approval 없이는 구현하지 않는다.

## 3. Phase 2B file classification

| Phase 2B artifact | 분류 | Disposition |
|---|---|---|
| `REL002_PHASE2B_MIGRATION_SCHEMA_IMPLEMENTATION_PLAN.md` | `REUSE` | historical SQLite implementation plan으로 보존; Production execution 근거로 사용하지 않음 |
| `REL002_PHASE2B_TRACEABILITY_MATRIX.md` | `REUSE` | historical evidence 보존; PostgreSQL RTM은 별도 생성 |
| `REL002_PHASE2B_COMPLETION_REPORT.md` | `REUSE` | 당시 결과를 변경하지 않음 |
| `001_registered_service_workload_v1.up.sql` | `REPLACE` | PostgreSQL용 새 artifact 필요; 이 파일은 실행 금지 및 historical 보존 |
| `001_registered_service_workload_v1.verify.sql` | `REPLACE` | PostgreSQL catalog verification으로 새 artifact 필요 |
| `registered-service-workload-schema.ts` | `MODIFY` | engine-neutral logical contract는 재사용하고 SQLite introspection은 PostgreSQL implementation으로 분리 |
| `registered-service-workload.ts` | `MODIFY` | resolver/domain behavior 유지, durable storage adapter 교체 |
| `identity/src/index.ts` | `MODIFY` | PostgreSQL adapter/contract가 승인·구현될 때 bounded export 갱신 |
| migration verification tests | `MODIFY` | SQLite historical coverage 유지 + PostgreSQL artifact/catalog tests 추가 |
| workload store tests | `MODIFY` | domain/fail-closed cases 재사용 + PostgreSQL adapter behavior 추가 |
| Master Index / Gap Register / Phase Plan | `MODIFY` | amendment와 execution hold를 교차 링크 |

전체 판정:

- Contract semantics: `REUSE`
- Phase 2B historical evidence: `REUSE`
- SQLite executable migration/verification: `REPLACE_FOR_PRODUCTION`
- Persistence/schema compatibility implementation: `MODIFY_OR_REPLACE`

## 4. PostgreSQL migration contract required later

후속 authorization은 최소한 다음을 닫아야 한다.

1. exact Supabase project/database/region/connection mode
2. PostgreSQL migration ID, artifact path, SHA-256 및 schema fingerprint
3. exact types, collation, timestamps/timezone, constraints and indexes
4. migration ledger ownership and atomicity
5. isolation, lock timeout, statement timeout, concurrency and replay policy
6. schema compatibility query and partial-migration detection
7. driver/package and async port boundary
8. pool sizing/lifecycle and Railway shutdown behavior
9. exact-target backup/restore proof

이 결정 전 `Production schema readiness = NOT_READY_UNTIL_CONTROLLED_POSTGRESQL_EXECUTION`이다.

## 5. Safety invariants

- SQLite artifact를 PostgreSQL에 실행: `0`
- Historical checksum/fingerprint rewrite: `0`
- Runtime schema auto-create: `0`
- Migration execution: `0`
- Production DB writes: `0`
- Identity seed: `0`
- New auth authority: `0`
