# REL-002 Phase 2D-0E PostgreSQL Role Separation

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-334 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Database / Security Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Roles

| Role | Purpose | Railway runtime visibility | Execution status |
|---|---|---|---|
| `ai_mls_production_runtime` | `ai-mls-api` steady-state Identity/Session persistence | REQUIRED later | NOT_CREATED |
| `ai_mls_production_migration_operator` | separately approved controlled migration only | PROHIBITED | NOT_CREATED |

Supabase administrative role `postgres`는 target/admin metadata일 뿐 runtime identity가 아니다. Supabase Auth는 채택하지 않는다.

## 2. Runtime grant contract

`ai_mls_production_runtime`에는 다음 최소 권한만 허용한다.

- database `postgres`: `CONNECT`;
- schema `app_identity`: `USAGE`;
- `identity_schema_contracts`, `identity_schema_migrations`: `SELECT`;
- `identity_registered_service_workloads`: `SELECT`;
- `identity_sessions`: `SELECT`, `INSERT`, `UPDATE`;
- `identity_session_revocations`: `INSERT`.

Migration uses application-generated text IDs and no sequence; sequence privilege is `0`. Runtime role의 `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `DELETE`, `REFERENCES`, `TRIGGER`, object ownership, role administration, grant option, database/schema creation은 `0`이다.

## 3. Migration operator contract

`ai_mls_production_migration_operator`는 named operator approval, exact migration checksum, exact-target backup/restore evidence와 separate execution approval이 모두 검증된 bounded window에서만 사용한다. 승인된 artifact가 `CREATE SCHEMA app_identity` 및 schema-owned DDL을 수행하므로 이 identity에는 해당 실행에 필요한 database `CONNECT`/`CREATE`와 `app_identity` object DDL ownership을 부여할 수 있다. 이는 runtime privilege가 아니며 실행 후 credential/reference는 Railway runtime에서 제거되어야 한다.

Migration operator는 application traffic, Session resolution, worker/provider execution 및 steady-state data access에 사용하지 않는다. 자동 migration과 bootstrap DDL은 `0`이다.

## 4. Verification evidence required

- exact role names and memberships;
- `\du` equivalent audit-safe privilege evidence;
- database/schema/table privilege matrix;
- runtime negative proof for DDL/DELETE/role grant;
- migration operator absent from Railway runtime variables;
- exact connection principal evidence without password exposure;
- role revocation/rotation evidence.

## 5. Decision gate

`DEC-185 = APPROVED`. Role/grant SQL 작성과 실행, Production connection 및 DB write는 본 문서에서 `0`이다. Actual role execution requires separate database-owner approval.

## 6. Related documents

- [Railway Secret Variable Contract](REL002_PHASE2D0E_RAILWAY_SECRET_VARIABLE_CONTRACT.md)
- [Pool / Timeout / TLS Contract](REL002_PHASE2D0E_POOL_TIMEOUT_TLS_CONTRACT.md)
- [Implementation Plan](REL002_PHASE2D0E_IMPLEMENTATION_PLAN.md)

Official database basis: [PostgreSQL GRANT](https://www.postgresql.org/docs/16/sql-grant.html), [PostgreSQL Privileges](https://www.postgresql.org/docs/16/ddl-priv.html), [PostgreSQL Schemas](https://www.postgresql.org/docs/15/ddl-schemas.html).
