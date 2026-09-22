# REL-002 Phase 2D-0D Railway Variable Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-329 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Operations / Security Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Variable contract

아래 이름은 본 DRAFT가 AO 승인을 위해 제안하는 exact Railway-to-runtime mapping이다. 현재 `ProductionRuntimeConfiguration`은 다섯 필드만 구현하고 `PgConnectionPoolAdapter`는 constructed `PgConnectionPoolOptions`를 소비한다. Environment parser, target-binding validator와 variable-to-options composition은 아직 구현되지 않았으므로 모든 신규 mapping은 `PROPOSED / IMPLEMENTATION_BLOCKED`다.

| Railway variable | Classification | Required value/status | Consumer | Logging rule |
|---|---|---|---|---|
| `RUNTIME_ENVIRONMENT` | `NON_SECRET_CONFIG` | exact `PRODUCTION` | configuration parser | value allowed |
| `CONFIGURATION_REFERENCE` | `NON_SECRET_CONFIG` | approved immutable reference | startup gate | reference only |
| `REQUIRED_SERVICE_REGISTRATIONS` | `NON_SECRET_CONFIG` | exact closed registration-ID list | Identity resolver | count/fingerprint only |
| `PROVIDER_EXECUTION_AUTHORIZED` | `NON_SECRET_CONFIG` | exact `false` | Production bootstrap | value allowed |
| `IDENTITY_PERSISTENCE_ENGINE` | `NON_SECRET_CONFIG` | exact `POSTGRESQL` | Production bootstrap | value allowed |
| `IDENTITY_DATABASE_CONNECTION_MODE` | `NON_SECRET_CONFIG` | exact `DIRECT` | pool factory | value allowed |
| `IDENTITY_DATABASE_HOST` | `NON_SECRET_CONFIG` | `db.mfonujjeokvpsfucfxuq.supabase.co` | target-binding validator | audit-safe value allowed |
| `IDENTITY_DATABASE_PORT` | `NON_SECRET_CONFIG` | `5432` | target-binding validator | value allowed |
| `IDENTITY_DATABASE_NAME` | `NON_SECRET_CONFIG` | `postgres` | target-binding validator | value allowed |
| `IDENTITY_DATABASE_USER` | `NON_SECRET_CONFIG` | `CONFIG_VALUE_REQUIRED / BLOCKED_PENDING_LEAST_PRIVILEGE_ROLE` | target-binding validator | approved runtime identifier only |
| `IDENTITY_DATABASE_CONNECTION_REF` | `SECRET_REFERENCE` | opaque Production-bound reference | SecretReferenceResolver / PG adapter only | fingerprint/status only |
| `IDENTITY_DATABASE_SSL_MODE` | `NON_SECRET_CONFIG` | exact `VERIFY_FULL` | PG adapter | value allowed |
| `IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS` | `NON_SECRET_CONFIG` | `CONFIG_VALUE_REQUIRED`, integer 1..60000 | PG adapter | value allowed |
| `IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS` | `NON_SECRET_CONFIG` | `CONFIG_VALUE_REQUIRED`, integer 1..60000 | PG adapter | value allowed |
| `IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS` | `NON_SECRET_CONFIG` | `CONFIG_VALUE_REQUIRED`, integer 1..60000 | PG adapter | value allowed |
| `IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS` | `NON_SECRET_CONFIG` | `CONFIG_VALUE_REQUIRED`, integer 1..60000 | PG adapter | value allowed |
| `IDENTITY_DATABASE_MAX_CONNECTIONS` | `NON_SECRET_CONFIG` | `CONFIG_VALUE_REQUIRED`, integer 1..100 | PG adapter | value allowed |
| `IDENTITY_DATABASE_APPLICATION_NAME` | `NON_SECRET_CONFIG` | exact approved safe service identifier | PG adapter | value allowed |
| `PORT` | `NON_SECRET_CONFIG` | Railway-injected bounded listener port | HTTP listener | value allowed |

## 2. SECRET_VALUE boundary

Railway configuration may eventually hold a protected secret value behind an approved resolver adapter, but the application configuration contract accepts only `IDENTITY_DATABASE_CONNECTION_REF`. Resolved connection URI/password is classified `SECRET_VALUE`, is transient in the exact PostgreSQL adapter consumer, and must never be copied to the typed configuration, docs, logs, errors, telemetry, Vercel or browser.

The following are explicitly prohibited as parallel authorities:

- raw `DATABASE_URL` consumed directly by child roots;
- standalone password variable consumed outside the resolver;
- simultaneous connection-URI and password authorities;
- Development/Staging fallback reference;
- Vercel exposure using `NEXT_PUBLIC_*` or equivalent browser-visible configuration.

## 3. Closure state

Exact project/region/host/port/database/mode non-secret values are closed. Supplied `postgres` user is target/admin metadata only and is not the runtime variable value. Exact least-privilege runtime user, timeout/pool values, opaque reference value, secret backend binding and rotation evidence remain open. Therefore Gaps 004/005 and the Production direct-connection gate remain `BLOCKING`.

## 4. Related documents

- [Physical Binding Contract](REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md)
- [Build / Start / Healthcheck Contract](REL002_PHASE2D0D_BUILD_START_HEALTHCHECK_CONTRACT.md)
- [Secret Reference Mapping](REL002_PHASE2D0D_SECRET_REFERENCE_MAPPING.md)
- [Completion Report](../reviews/REL002_PHASE2D0D_COMPLETION_REPORT.md)
