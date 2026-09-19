# REL-002 Phase 2D-0B PostgreSQL Persistence Transition Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-320 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |
| 범위 | Supabase PostgreSQL Production persistence 전환 설계 |

## 1. 목적과 고정 경계

DEC-175~178에 따라 Production relational engine은 Supabase PostgreSQL이고 Railway가 `startProductionRuntime()`을 소유한다. SQLite Production 실행 가정은 `RETIRED_FOR_PRODUCTION`이며, 기존 Identity, Session, `SessionAccessCoordinator`, `AuthorizationService`, `RoleAssignment`, `RegisteredServiceWorkload` 권한은 변경하지 않는다. Supabase Auth와 Vercel backend/API는 채택하지 않는다.

이 문서는 설계와 후속 구현 계획만 정의한다. Production/Test code, dependency, lockfile, infrastructure, credential, migration 실행 및 Production DB write 변경은 모두 `0`이다.

## 2. 현행 구현 영향

| 대상 | 현행 특성 | 전환 판정 | PostgreSQL 경계 |
|---|---|---|---|
| `SessionRepository` / `SessionUnitOfWork` | synchronous domain-facing port | `MODIFY` | Production 전용 async port로 전환; domain record/invariant는 재사용 |
| `DurableSessionUnitOfWork` | `node:sqlite`, `DatabaseSync`, `BEGIN IMMEDIATE`, file path | `RETAIN_HISTORICAL_ONLY` for Production / `REUSE` local-test | PostgreSQL adapter와 공유 구현하지 않음 |
| `RegisteredServiceWorkload` model | engine-neutral identity proof/lifecycle | `REUSE` | 동일 record와 invariant 사용 |
| `DurableRegisteredServiceWorkloadStore` | synchronous read-only SQLite store | `RETAIN_HISTORICAL_ONLY` for Production / `REUSE` local-test | async PostgreSQL read authority adapter 추가 |
| schema contract | logical contract와 SQLite PRAGMA/catalog 검사가 결합 | `MODIFY` | logical contract와 engine-specific physical validators 분리 |
| Phase 2B SQLite migration/verify | SQLite DDL/PRAGMA | `RETAIN_HISTORICAL_ONLY` | 변경하거나 PostgreSQL에서 실행하지 않음 |
| `startProductionRuntime()` | synchronous bootstrap | `MODIFY` | 동일 canonical entry name을 async `Promise<ProductionRuntimeHandle>`로 변경 |
| five child roots | SQLite paths / `REQUIRE_EXISTING` 포함 | `MODIFY` | 이번 설계는 Identity/Session/RegisteredServiceWorkload만 닫음; 다른 stores는 후속 별도 inventory 필요 |

## 3. 설계 대안

### 3.1 채택안: engine-specific adapters + async Production ports

- engine-neutral domain record와 invariant는 재사용한다.
- Production은 async `PostgreSqlSessionUnitOfWork`와 async workload authority port를 사용한다.
- SQLite synchronous adapters는 local/test 및 역사적 증거용으로 유지한다.
- Production bootstrap은 동일한 단일 진입점에서 async resource lifecycle을 소유한다.
- dialect, pool, driver, transaction 세부 사항은 PostgreSQL adapter 내부에 격리한다.

### 3.2 기각안

| 대안 | 기각 이유 |
|---|---|
| 현재 SQLite class에 engine 분기 추가 | sync/async 및 SQL dialect가 한 class로 누출되고 Production 경계가 모호해짐 |
| `MaybePromise` 또는 blocking bridge | call-site 안정성과 failure semantics를 약화하며 Node event loop를 차단하거나 별도 숨은 runtime을 요구함 |
| SQLite 구현을 전역 교체 | local/test 및 immutable historical Phase 2B evidence를 훼손함 |
| Supabase Data API 또는 Auth로 권한 대체 | 승인된 Identity/authorization authority를 재정의함 |

## 4. 제안 adapter 계약

```ts
interface ProductionSessionUnitOfWork {
  transaction<T>(operation: (tx: ProductionSessionTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

interface ProductionRegisteredServiceWorkloadAuthority {
  findByRegistrationId(registrationId: string): Promise<RegisteredServiceWorkload | null>;
  close(): Promise<void>;
}
```

실제 명명은 구현 시 기존 module naming과 맞추되 다음은 불변이다.

- Production port는 async다.
- domain-owned optimistic concurrency, session version, revocation, evidence binding semantics는 변경하지 않는다.
- `SessionAccessCoordinator`와 authorization authority는 adapter 밖에서 기존 책임을 유지한다.
- PostgreSQL driver object나 persistence row는 domain/API DTO로 노출하지 않는다.
- automatic retry는 `0`이다.

## 5. Production bootstrap 전환

순서는 다음과 같다.

1. raw configuration parse
2. typed `ProductionRuntimeConfiguration` 검증
3. mandatory secret-reference shape 검증
4. DB credential/TLS reference resolution
5. bounded PostgreSQL pool 생성
6. read-only schema compatibility와 registered workload authority 검증
7. remaining required secrets 검증/해결
8. `ProductionStartupValidationGate` PASS
9. async Session UoW와 bounded child roots 생성
10. listeners 시작
11. workers 시작
12. separately authorized provider path만 활성화

5~6은 authority 검증을 위한 read-only pre-gate access다. Gate PASS 전 schema mutation, migration, Session mutation, listener, worker, provider activation은 `0`이다. Bootstrap 실패 시 pool까지 역순으로 정리한다.

## 6. Phase 2B/1G artifact disposition

| Artifact group | 판정 | 설명 |
|---|---|---|
| domain records, validation, evidence binding | `REUSE` | engine-neutral |
| synchronous repository interfaces | `MODIFY` | Production async port 추가, local/test sync contract 보존 |
| SQLite concrete stores | `RETAIN_HISTORICAL_ONLY` for Production | local/test에서는 계속 사용 가능 |
| SQLite schema/migration verification | `RETAIN_HISTORICAL_ONLY` | PostgreSQL Production에 사용 금지 |
| logical Identity schema contract | `REUSE` + `MODIFY` | engine-neutral logical fields 분리 |
| Production composition/root wiring | `MODIFY` | async adapter 및 pool lifecycle 주입 |
| Phase 2B report/RTM/fingerprint evidence | `RETAIN_HISTORICAL_ONLY` | immutable historical evidence |
| tests | `MODIFY` | SQLite tests 보존 + PostgreSQL adapter/contract tests 추가 |

### 6.1 Exact Phase 2B 12-file disposition

| Existing artifact | Classification | Required treatment |
|---|---|---|
| `docs/00_MASTER_INDEX.md` | `MODIFY` | 새 PostgreSQL 문서/evidence 등록 |
| `docs/implementation/REL002_PHASE0_PRODUCTION_GAP_REGISTER.md` | `MODIFY` | SQLite 실행 가정 폐기와 PostgreSQL 잔여 blocker 기록 |
| `docs/implementation/REL002_PHASE2B_MIGRATION_SCHEMA_IMPLEMENTATION_PLAN.md` | `RETAIN_HISTORICAL_ONLY` | 당시 SQLite implementation 계획을 재작성하지 않음 |
| `docs/implementation/REL002_PHASE2B_TRACEABILITY_MATRIX.md` | `RETAIN_HISTORICAL_ONLY` | 당시 verified evidence 보존 |
| `docs/implementation/REL002_PHASE_PLAN.md` | `MODIFY` | 현재 PostgreSQL transition gate 추가 |
| `docs/reviews/REL002_PHASE2B_COMPLETION_REPORT.md` | `RETAIN_HISTORICAL_ONLY` | immutable completion evidence |
| `modules/identity/migrations/production/001_registered_service_workload_v1.up.sql` | `RETAIN_HISTORICAL_ONLY` / `REPLACE` for Production | SQLite/local-test artifact로 보존; 새 PostgreSQL artifact가 Production 후보를 대체 |
| `modules/identity/migrations/production/001_registered_service_workload_v1.verify.sql` | `RETAIN_HISTORICAL_ONLY` / `REPLACE` for Production | SQLite verification을 PostgreSQL에서 실행하지 않음 |
| `modules/identity/src/index.ts` | `MODIFY` | approved PostgreSQL ports/adapters만 future export |
| `modules/identity/src/registered-service-workload-migration.test.ts` | `MODIFY` | SQLite test 보존, 별도 PostgreSQL migration suite 추가 |
| `modules/identity/src/registered-service-workload-schema.ts` | `MODIFY` | logical contract와 SQLite/PostgreSQL physical validators 분리 |
| `modules/identity/src/registered-service-workload.test.ts` | `REUSE` | existing domain/SQLite behavior 보존; PostgreSQL adapter test는 별도 추가 |

## 7. 권한 및 보안 경계

- PostgreSQL technical role은 database access role일 뿐 business role/capability가 아니다.
- runtime role에는 schema DDL/migration 권한을 주지 않는다.
- migration role은 runtime role과 분리하며 controlled execution packet에서만 사용한다.
- Supabase `service_role`, Auth, RLS는 canonical business authority가 아니다.
- `app_identity` schema는 browser/Data API에 노출하지 않고 `anon`, `authenticated`, `service_role`에 application authority를 부여하지 않는다.
- RLS는 현재 `NOT_REQUIRED`인 optional defense-in-depth 후속 결정이며 direct Railway connection의 tenant/scope 검증을 대체하지 않는다.

## 8. 결정 및 잔여 차단

DEC-179는 본 async adapter 경계를, DEC-180은 pool/transaction ownership을 승인한다. 다음 구현의 runtime driver는 `pg`이며 `@types/pg`는 TypeScript compilation에 필요한 경우에만 승인된다. ORM, Supabase client persistence authority 또는 추가 PostgreSQL driver는 승인되지 않는다. 이번 documentation closeout에서는 dependency를 설치하거나 manifest/lockfile을 변경하지 않는다.

`REL002-GAP-004/005/006`은 각각 `PARTIAL/BLOCKING`, `PARTIAL/BLOCKING`, `STAGING_ONLY/BLOCKING`을 유지한다. Physical Supabase project/database/region/connection mode, secret backend, operator, backup/restore 및 PostgreSQL execution evidence가 없기 때문이다.

## 9. 관련 문서

- [PostgreSQL Schema Contract](REL002_PHASE2D0B_POSTGRESQL_SCHEMA_CONTRACT.md)
- [Connection Pool and Transaction Model](REL002_PHASE2D0B_CONNECTION_POOL_TRANSACTION_MODEL.md)
- [Schema Compatibility Validator Design](REL002_PHASE2D0B_SCHEMA_COMPATIBILITY_VALIDATOR_DESIGN.md)
- [PostgreSQL Migration Artifact Design](REL002_PHASE2D0B_POSTGRESQL_MIGRATION_ARTIFACT_DESIGN.md)
- [Railway/Supabase Runtime Binding](REL002_PHASE2D0B_RAILWAY_SUPABASE_RUNTIME_BINDING_DESIGN.md)
- [Implementation Plan](REL002_PHASE2D0B_IMPLEMENTATION_PLAN.md)
