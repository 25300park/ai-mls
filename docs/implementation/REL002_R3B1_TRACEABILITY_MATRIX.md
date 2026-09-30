# REL-002 R3-B1 PostgreSQL Schema / Migration / Verifier / ACL Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-372 |
| 문서 버전 | v1.0 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준 Main | `98944b96bb86bee487b21e7e28acaf202cb2b466` |

## 범위

R3-B1은 [R3-B0 Architecture](REL002_R3B0_POSTGRESQL_ASYNC_PERSISTENCE_ARCHITECTURE.md)의 DEC-195~198과 CR-030을 구현한다. Production 실행, adapter 전환, child-root 활성화 및 pool composition 전환은 포함하지 않는다.

현재 artifact는 AO-approved R3-B1B semantics와 exact verifier/readiness remediation을 반영한 implementation candidate다. 이는 Production execution 승인이 아니다.

| Domain | Schema | Tables | Migration / checksum | Exact verifier | Runtime ACL |
|---|---|---:|---|---|---|
| Publication | `app_publication` | 8 | `modules/publication/migrations/postgresql/production/001_schema_v1.up.sql(.sha256)` | `001_schema_v1.verify.sql` | `002_runtime_role_grants.sql` |
| Administration | `app_administration` | 9 | `modules/administration/migrations/postgresql/production/001_schema_v1.up.sql(.sha256)` | `001_schema_v1.verify.sql` | `002_runtime_role_grants.sql` |
| Connector | `app_connector` | 11 | `modules/source/connector/migrations/postgresql/production/001_schema_v1.up.sql(.sha256)` | `001_schema_v1.verify.sql` | `002_runtime_role_grants.sql` |
| External Integration | `app_external_integration` | 5 | `modules/source/external-integration/migrations/postgresql/production/001_schema_v1.up.sql(.sha256)` | `001_schema_v1.verify.sql` | `002_runtime_role_grants.sql` |
| Advisory | `app_advisory` | 3 | `modules/ai/advisory/migrations/postgresql/production/001_schema_v1.up.sql(.sha256)` | `001_schema_v1.verify.sql` | `002_runtime_role_grants.sql` |

## Exactness contract

- migration은 `BEGIN`/`COMMIT` 단일 transaction이며 schema가 이미 있거나 execution role이 `ai_mls_production_migration_operator`가 아니면 fail-closed한다.
- verifier는 artifact SHA-256, schema version/comment fingerprint, 정확한 table inventory, column/type/nullability/default, PK/UK/FK/CHECK/index, owner, 20개 trigger와 function identity/source/owner, direct/effective ACL, grant option, PUBLIC leakage 및 unexpected membership/authority를 검증한다.
- External Integration은 contract-local immutable positive safe-integer ordinal, 세 immediate `NO ACTION` parent FK와 byte-preserving validated JSON `TEXT`를 사용한다. Advisory canonical payload는 `JSONB`; 나머지 `timestamptz`, safe-integer 및 enum/check semantics를 보존한다.
- runtime은 schema `USAGE`와 승인된 table DML만 보유하고 schema `CREATE`, DDL, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, grant option을 보유하지 않는다.
- runtime readiness contract는 같은 read-only catalog snapshot에서 5개 schema 모두의 version/fingerprint, table count, trigger/function 및 owner/direct/effective ACL boundary가 일치할 때만 통과한다. 부분/missing/drift 상태는 모두 `R3B1_CHILD_ROOT_SCHEMA_NOT_READY`이다.

## Pool authority

Readiness 함수는 호출자가 소유한 단일 `PostgreSqlPoolPort`만 사용한다. 새 pool을 만들지 않으며 canonical authority `PG_PRODUCTION_POOL`과 충돌하지 않는다. `PG_IDENTITY_POOL` 호환 경로의 광범위한 composition 변경은 R3-B1 범위 밖이다.

## Verification trace

| Requirement | Evidence |
|---|---|
| 5 schemas / 36 tables | static focused test + disposable PostgreSQL catalog count |
| forward-only / transactional / rollback | injected pre-COMMIT failure 후 schema 부재 확인 |
| exact verifier | 5/5 executable verifier + table/checksum/schema/grant drift failure |
| least privilege | runtime SELECT 성공, runtime DDL 거부, exact ACL fingerprint |
| no runtime automigration | `production-main.ts` remains fail-closed and contains no migration execution path |
| no Production mutation | loopback-only PostgreSQL 18.4 disposable cluster; cleanup 후 port closed |

## Closeout disposition

- External immutable ordering, three parent FKs and JSON category: `APPROVED / IMPLEMENTED`
- exact 20-trigger/function topology: `IMPLEMENTED`
- aggregate table/function owner and direct/effective privilege readiness: `IMPLEMENTED`
- Production execution, adapters, async conversion and R3-B2: `NOT AUTHORIZED`
