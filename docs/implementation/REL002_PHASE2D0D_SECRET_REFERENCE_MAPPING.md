# REL-002 Phase 2D-0D Secret Reference Mapping

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-331 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Integration Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Canonical mapping

| Reference | Classification | Resolves to | Authorized consumer | State |
|---|---|---|---|---|
| `IDENTITY_DATABASE_CONNECTION_REF` | `SECRET_REFERENCE` | complete direct PostgreSQL connection secret bundle | Production SecretReferenceResolver -> PgConnectionPoolAdapter | reference name CLOSED; backend/value UNBOUND |
| `IDENTITY_DATABASE_CA_CERT_REF` | `SECRET_REFERENCE` | optional trusted CA material | PgConnectionPoolAdapter only | NOT_REQUIRED unless platform evidence requires custom CA |

`IDENTITY_DATABASE_CREDENTIAL_REF`는 Phase 2D-0B의 후보 분해 reference였지만, 이번 exact binding에서는 별도 runtime variable로 사용하지 않는다. Password와 connection URI를 병렬 authority로 만들지 않기 위해 connection bundle reference 하나가 canonical하다.

## 2. Resolution and consumption

1. Parser는 raw secret value가 아니라 reference shape만 허용한다.
2. Resolver는 exact environment `PRODUCTION`과 exact consumer `PG_IDENTITY_POOL` binding을 확인한다.
3. Resolved `SECRET_VALUE`는 pool construction 직전에만 transient memory에 존재한다.
4. Non-secret target assertions(host/port/database/user/mode)과 일치하지 않으면 startup은 fail closed한다.
5. Value/reference는 error, log, readiness, audit, DTO, Vercel 또는 browser에 포함하지 않는다.
6. Shutdown 후 application code는 resolved value를 보존하거나 재노출하지 않는다.

## 3. Railway/Vercel boundary

Railway `ai-mls-api` Production runtime만 reference resolver를 사용할 수 있다. Vercel frontend/Admin, API-017 handler, domain service와 Console DTO는 reference/value visibility가 `0`이다. Supabase service-role key와 Supabase Auth credential은 이 contract에 포함되지 않는다.

## 4. Open prerequisites

- approved physical secret backend and resolver adapter;
- exact opaque Production reference creation;
- access-control evidence limiting consumption to `ai-mls-api`;
- rotation/revocation/runbook evidence;
- safe startup integration test without Production connection.

따라서 `CREDENTIAL_REFERENCE_CONFIGURATION = NOT_YET_POSSIBLE`이며 Gap 005는 `PARTIAL / BLOCKING`이다.

## 5. Related documents

- [Physical Binding Contract](REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md)
- [Railway Variable Matrix](REL002_PHASE2D0D_RAILWAY_VARIABLE_MATRIX.md)
- [Build / Start / Healthcheck Contract](REL002_PHASE2D0D_BUILD_START_HEALTHCHECK_CONTRACT.md)
- [Completion Report](../reviews/REL002_PHASE2D0D_COMPLETION_REPORT.md)
