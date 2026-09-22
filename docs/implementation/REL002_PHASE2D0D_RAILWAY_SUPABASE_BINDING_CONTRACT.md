# REL-002 Phase 2D-0D Railway / Supabase Physical Binding Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-328 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. 목적과 범위

본 문서는 승인된 Vercel/Railway/Supabase Production topology를 식별된 Supabase project와 Railway service에 결합하는 configuration contract다. 배포, Production DB 연결, migration 실행, schema 생성, identity seed 또는 credential 사용을 승인하지 않는다.

## 2. Audit-safe physical target

| Field | Bound value | Status |
|---|---|---|
| Environment | `PRODUCTION` | IDENTIFIED |
| Supabase project | `ai-mls-production` | IDENTIFIED |
| Project reference | `mfonujjeokvpsfucfxuq` | IDENTIFIED |
| Region | `Southeast Asia (Singapore)` | IDENTIFIED |
| Engine | `PostgreSQL` | IDENTIFIED |
| Host | `db.mfonujjeokvpsfucfxuq.supabase.co` | IDENTIFIED |
| Port | `5432` | IDENTIFIED |
| Database | `postgres` | IDENTIFIED |
| Supplied database user | `postgres` | IDENTIFIED as target metadata; runtime use BLOCKED pending least-privilege role evidence |
| Runtime connection mode | `DIRECT` | IDENTIFIED |
| Railway project | `ai-mls-production` | IDENTIFIED |
| Railway API service | `ai-mls-api` | IDENTIFIED / NOT_DEPLOYED |

Password, connection URI와 기타 secret value는 기록하지 않는다. Supabase Auth는 `NOT_ADOPTED`이고 Vercel은 frontend/Admin delivery만 소유한다.

Supplied `postgres` user metadata는 runtime role 승인이 아니다. 기존 contract가 runtime technical role에 DDL/migration/seed 권한 `0`을 요구하므로, dedicated least-privilege role 또는 `postgres` role의 exact restricted grants evidence가 제공되기 전에는 runtime connection binding이 `BLOCKED`다.

## 3. Canonical connection flow

```text
Railway ai-mls-api
  -> Production configuration parser
  -> SecretReferenceResolver(IDENTITY_DATABASE_CONNECTION_REF)
  -> transient PostgreSQL connection string
  -> PgConnectionPoolAdapter
  -> Supabase direct PostgreSQL endpoint
```

`IDENTITY_DATABASE_CONNECTION_REF`가 유일한 database credential reference다. 이 reference가 resolve하는 secret bundle만 host/user/password를 포함하는 canonical connection value가 될 수 있다. 별도 `DATABASE_URL`, raw password variable 또는 `IDENTITY_DATABASE_CREDENTIAL_REF`를 동시에 구성하지 않는다. Audit-safe host/port/database/user variables는 resolved bundle이 올바른 physical target을 가리키는지 검증하는 non-secret assertions이며 credential authority가 아니다.

## 4. TLS and pool contract

`PgConnectionPoolAdapter`는 `ssl.rejectUnauthorized = true`를 요구한다. 따라서 canonical SSL mode는 `VERIFY_FULL`이고 TLS disable/hostname verification bypass는 허용되지 않는다. 별도 CA material이 실제로 필요한 경우에만 기존 `IDENTITY_DATABASE_CA_CERT_REF`를 사용할 수 있으며, 현재는 운영체제/Node trust store를 전제로 `NOT_REQUIRED_UNLESS_PLATFORM_EVIDENCE_REQUIRES`다.

Connection, statement, idle-transaction, shutdown timeout과 max pool size는 adapter가 허용하는 bounded integer여야 한다. 저장소에는 승인된 exact Production 값이 없으므로 모두 `CONFIG_VALUE_REQUIRED`; hidden driver default는 금지한다.

## 5. Startup and fail-closed boundary

Railway Production process는 오직 `startProductionRuntime()`을 통해 시작한다. 다음 중 하나라도 충족하지 않으면 listener, worker와 provider-capable path를 시작하지 않는다.

- exact `PRODUCTION` environment와 PostgreSQL engine configuration;
- mandatory database reference shape/resolution;
- TLS-verifying direct connection availability;
- exact PostgreSQL schema/ledger compatibility;
- RegisteredServiceWorkload authority availability;
- existing startup gate PASS.

현재 repository에는 `startProductionRuntime()`을 호출하는 Production executable entrypoint가 없으므로 deployment/start readiness는 `REQUIRES_IMPLEMENTATION`이다. 이 문서는 entrypoint를 구현하지 않는다.

## 6. Migration boundary

Runtime technical role은 migration/DDL/schema repair/identity seed 권한을 갖지 않는다. Up/Verify artifact는 별도 named operator와 controlled execution approval 아래에서만 실행할 수 있다. Pre-deploy migration과 runtime auto-create는 `0`이다.

## 7. Current disposition

| Item | State |
|---|---|
| Physical DB target | IDENTIFIED |
| Railway service | IDENTIFIED / NOT_DEPLOYED |
| Secret backend/reference binding | BLOCKED |
| Runtime least-privilege DB role | BLOCKED |
| Exact pool/timeouts | CONFIG_VALUE_REQUIRED |
| Production executable | REQUIRES_IMPLEMENTATION |
| Supabase direct connection contract | BLOCKED |
| Production connection / migration / DB write / deployment | `0 / 0 / 0 / 0` |

## 8. Related documents

- [Railway Variable Matrix](REL002_PHASE2D0D_RAILWAY_VARIABLE_MATRIX.md)
- [Build / Start / Healthcheck Contract](REL002_PHASE2D0D_BUILD_START_HEALTHCHECK_CONTRACT.md)
- [Secret Reference Mapping](REL002_PHASE2D0D_SECRET_REFERENCE_MAPPING.md)
- [Completion Report](../reviews/REL002_PHASE2D0D_COMPLETION_REPORT.md)
