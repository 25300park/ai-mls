# REL-002 R3-B0 PostgreSQL and Async Persistence Architecture

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-369 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 적용 범위 | Five Production child roots |

## Recommended schema topology

Production은 `app_identity`를 확장하지 않고 다음 전용 schema를 사용한다.

| Domain | Schema | Owner | Runtime boundary |
|---|---|---|---|
| Publication | `app_publication` | `ai_mls_production_migration_operator` | exact Publication DML |
| Administration | `app_administration` | same migration owner | exact Administration DML |
| Connector Execution | `app_connector` | same migration owner | exact Connector DML |
| External Integration | `app_external_integration` | same migration owner | exact External DML |
| Advisory | `app_advisory` | same migration owner | exact Advisory DML |

전용 schema는 ownership, migration/version, ACL verification, incident isolation, naming collision과 audit evidence를 분리한다. `app_identity`에 병합하면 Identity authority와 business persistence의 ownership 경계가 흐려지므로 권고하지 않는다.

## Ratified decisions

아래는 2026-09-30 AO closeout에서 `APPROVED`되었다. R3-B0 closeout 자체는 implementation 또는 Production execution authority가 아니다.

- `DEC-195`: five dedicated child-root PostgreSQL schemas.
- `DEC-196`: canonical persistence/application call chain을 end-to-end async로 전환하고 blocking wrapper와 duplicate business path를 금지한다.
- `DEC-197`: per-domain forward-only migration, exact verifier/readiness, least-privilege grant contract.
- `DEC-198`: Option B — `PG_PRODUCTION_POOL`이 canonical authority이며 `PG_IDENTITY_POOL`은 time-bounded compatibility input이다. 두 이름은 항상 동일한 단일 physical pool과 sealed-secret boundary를 가리킨다.

## Migration contract

각 domain은 module-owned `migrations/postgresql/production/001_<domain>_persistence_v1.up.sql`과 `001_<domain>_persistence_v1.verify.sql`을 갖는다. 실행 순서는 preflight → migration operator transaction → verifier → exact runtime grants → ACL/readiness verifier다.

- forward-only, checksum/contract/schema-version exact equality, no runtime auto-migration.
- runtime role은 DDL과 migration ledger write 권한이 없다.
- commit 전 실패는 rollback, commit 후 defect는 새 forward-fix artifact로 처리한다.
- hidden repair, startup table creation, destructive down migration은 금지한다.

## Runtime grant model

`ai_mls_production_runtime`은 database `CONNECT`, 각 schema `USAGE`, application operation에 필요한 exact table DML만 가진다. `CREATE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, grant option과 PUBLIC leakage는 금지한다. Sequence가 실제 설계에 도입되지 않으면 sequence 권한은 0이다. Verifier/trigger function은 runtime direct `EXECUTE`를 주지 않는다.

| Table class | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| current mutable aggregate/revision/checkpoint/lease | yes | yes | exact CAS paths only | only where current business contract requires it |
| idempotency, audit, event, evidence, intent, receipt, result | yes | yes | no | no |
| schema/migration metadata | readiness-only exact SELECT if required | no | no | no |

Table별 exact ACL은 implementation phase migration specification에서 생성하고 verifier가 unexpected privilege를 fail closed 해야 한다.

## Async persistence recommendation

**Approach A를 권고한다:** canonical port와 application call chain을 async end-to-end로 전환한다. SQLite local/test adapter도 같은 async port를 구현하되 내부 synchronous operation을 즉시 완료된 Promise로 노출한다. PostgreSQL I/O를 blocking wrapper로 감싸지 않는다.

| Root | Current sync boundary and composition caller | Async target and blast radius |
|---|---|---|
| API-014 | `PublicationUnitOfWork` → `createProductionPublicationInfrastructure` → API composition | `Promise`-based UoW/transaction; Publication service, HTTP handler, retry/reconciliation callers and tests await |
| API-015 | `AdministrationUnitOfWork` → `administration-production-composition` | proposal/decision/evidence services, API-015 handlers and tests await |
| API-018 | `DurableConnectorExecutionUnitOfWork` → `createProductionConnectorApi018Composition` | lease/invocation/result/checkpoint/technical-record services and handlers await |
| API-019 | `DurableExternalIntegrationStore` → `createProductionExternalIntegrationComposition` | `ExternalIntegrationEvidenceApplication`, host, HTTP handler and tests await |
| FEAT-022 | `AdvisoryPersistence` → `DurableAdvisoryStore` → `createProductionAdvisoryRuntime` | advisory runtime/orchestration and API-017-facing callers await; provider execution semantics unchanged |

별도 Production-only async business interfaces는 duplicate application behavior와 parity drift를 만들므로 권고하지 않는다. Async conversion은 각 phase에서 compiler-guided call-site inventory와 contract tests로 제한한다.

## Unit of Work and concurrency

| Root | Transaction contract | Concurrency / retry |
|---|---|---|
| Publication | scope revision, idempotency, audit/event and execution journal in one multi-statement transaction | optimistic CAS; existing approved retry only, driver retry 0 |
| Administration | revision, resource/proposal/decision/evidence/idempotency atomic | optimistic CAS; two-person authority unchanged |
| Connector | lease acquire/release, invocation/result/evidence/checkpoint atomic groups | row lock or version CAS; active-lease partial unique index; automatic retry 0 |
| External Integration | mapping/observation/evidence/idempotency atomic mutation | version/unique conflict exact mapping; explicit ordering required |
| Advisory | prompt/advisory/idempotency atomic write | uniqueness/idempotency; no advisory lock or provider retry |

Default isolation is PostgreSQL `READ COMMITTED` plus row-level lock/CAS where the existing contract requires it. `SERIALIZABLE`, advisory locks or retry loops require later evidence and approval.

## Shared connection authority

One `ProductionBootstrap`-owned physical `pg.Pool` may safely serve bounded repositories. Each UoW checks out exactly one client for its transaction and always releases it. Repositories do not resolve secrets or create pools. Shutdown rejects new work, stops listener/workers, drains child roots, then closes the pool.

`PG_PRODUCTION_POOL` is the canonical Production-wide pool authority. `PG_IDENTITY_POOL` remains a time-bounded compatibility input only. Phase 1 establishes the canonical name plus alias, Phase 2 migrates every internal Production consumer, and Phase 3 removes compatibility only under a separate verified change. Both names must resolve to the same pool and approved sealed references; a second pool, secret consumer or fallback resolution is prohibited.

## Schema readiness

Before any child root, listener or worker starts, one aggregate read-only verifier proves all five schema names, tables, columns/types/nullability, PK/FK/UQ/CK/indexes, schema contract version/fingerprint, ownership and exact runtime ACLs. It also proves SQLite fallback absent. Missing, extra or incompatible required state returns `NOT_READY`; startup never repairs it.

## TDD strategy

- Pure unit: SQL/result mapping, safe error projection, async propagation, no secret logging.
- Repository contract: identical business semantics against SQLite and PostgreSQL adapters.
- Disposable PostgreSQL: full migrations/verifiers, atomic rollback, CAS/concurrency, idempotency, unique conflicts, ACL separation, pool reuse and missing/wrong schema.
- Production read-only: only after separately approved execution, exact catalog/ACL/readiness evidence; no mutation.

## Safety and exclusions

No new API, role, capability, provider behavior or identity authority is introduced. Production/Railway/Supabase/Vercel mutation, migrations, grants, workload registration, adapter implementation and current null child-root boundary changes remain 0.
