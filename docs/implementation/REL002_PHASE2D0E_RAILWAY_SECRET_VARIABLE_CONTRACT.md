# REL-002 Phase 2D-0E Railway Secret / Variable Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-335 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Physical backend

Railway service variable은 build와 runtime 모두에 제공되므로 secret value를 “runtime composition only”로 제한하는 physical backend가 될 수 없다. Sealed 설정은 UI/API/CLI 회수를 막지만 build-process availability를 제거하지 않는다. 따라서 Railway에는 opaque `SECRET_REFERENCE`와 non-secret config만 전달하고, 실제 `SECRET_VALUE` backend는 runtime-only delivery를 증명하는 별도 후속 선택이 필요하다.

`SECRET_BACKEND = OTHER_REQUIRED / BLOCKED`이며 `SECRET_BACKEND_EXECUTION = BLOCKED`다. Physical backend selection은 unresolved다. 두 번째 secrets product를 성급히 선택하지 않으며 `DEC-186 = APPROVED`; Railway setting/secret 생성은 본 단계에서 `0`이다.

## 2. Reference-to-value mapping

| Application contract | Classification | Exact proposed value | Physical Railway variable | Consumer |
|---|---|---|---|---|
| `IDENTITY_DATABASE_CONNECTION_REF` | `SECRET_REFERENCE` | approved opaque runtime-secret reference | service variable; reference only | bounded resolver only |
| database connection credential | `SECRET_VALUE` | hidden PostgreSQL URI/value | `OTHER_REQUIRED / BLOCKED` | PostgreSQL adapter only |
| `IDENTITY_DATABASE_CA_CERT_REF` | `SECRET_REFERENCE` | approved opaque runtime-secret reference | service variable; reference only | bounded resolver only |
| project CA material | protected runtime value | hidden PEM CA body | `OTHER_REQUIRED / BLOCKED` | PostgreSQL TLS adapter only |

향후 resolver adapter는 선택된 runtime-only backend의 exact allowlisted reference scheme만 허용하고 reference fingerprint/status만 기록한다. Missing/unallowlisted reference, empty value, environment mismatch는 fail closed다. Raw `DATABASE_URL` direct consumption, separate password authority와 child-root direct environment read는 금지한다.

## 3. Non-secret Production variables

| Variable | Exact value/proposed bound |
|---|---|
| `RUNTIME_ENVIRONMENT` | `PRODUCTION` |
| `CONFIGURATION_REFERENCE` | approved immutable reference |
| `REQUIRED_SERVICE_REGISTRATIONS` | closed registration-ID list |
| `PROVIDER_EXECUTION_AUTHORIZED` | `false` |
| `IDENTITY_PERSISTENCE_ENGINE` | `POSTGRESQL` |
| `IDENTITY_DATABASE_CONNECTION_MODE` | `DIRECT` |
| `IDENTITY_DATABASE_HOST` | `db.mfonujjeokvpsfucfxuq.supabase.co` |
| `IDENTITY_DATABASE_PORT` | `5432` |
| `IDENTITY_DATABASE_NAME` | `postgres` |
| `IDENTITY_DATABASE_USER` | `ai_mls_production_runtime` |
| `IDENTITY_DATABASE_SSL_MODE` | `VERIFY_FULL` |
| `IDENTITY_DATABASE_CONNECTION_TIMEOUT_MS` | `10000` |
| `IDENTITY_DATABASE_POOL_IDLE_TIMEOUT_MS` | `30000` |
| `IDENTITY_DATABASE_STATEMENT_TIMEOUT_MS` | `30000` |
| `IDENTITY_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS` | `30000` |
| `IDENTITY_DATABASE_SHUTDOWN_TIMEOUT_MS` | `30000` |
| `IDENTITY_DATABASE_MAX_CONNECTIONS` | `5` |
| `IDENTITY_DATABASE_APPLICATION_NAME` | `ai-mls-api-production` |
| `PORT` | Railway-injected bounded integer |

## 4. Visibility matrix

| Consumer | Secret reference | Secret value |
|---|---:|---:|
| `ProductionBootstrap` configuration validator | yes | no |
| bounded runtime resolver | yes | yes, transient |
| PostgreSQL pool factory | no | yes, transient |
| API-017 / handlers / child roots | no | no |
| Vercel / browser / Admin Console | no | no |
| logs / telemetry / errors / docs | fingerprint/status only | no |

## 5. Rotation and failure

Reference 변경은 staged Railway variable change가 될 수 있지만 secret value rotation은 선택될 runtime-only backend에서 수행하고 separately approved redeploy로 반영한다. No hot reload, dual credential authority or automatic fallback is introduced. Missing/invalid reference prevents startup before Session UoW, listeners, workers and provider execution.

## 6. Related documents

- [Production Executable Design](REL002_PHASE2D0E_PRODUCTION_EXECUTABLE_DESIGN.md)
- [PostgreSQL Role Separation](REL002_PHASE2D0E_POSTGRESQL_ROLE_SEPARATION.md)
- [Pool / Timeout / TLS Contract](REL002_PHASE2D0E_POOL_TIMEOUT_TLS_CONTRACT.md)

Official platform basis: [Railway Variables](https://docs.railway.com/variables), [Lock Down a Production Project](https://docs.railway.com/guides/lock-down-production-project), [Isolate Staging and Production Environments](https://docs.railway.com/guides/isolate-staging-production).
