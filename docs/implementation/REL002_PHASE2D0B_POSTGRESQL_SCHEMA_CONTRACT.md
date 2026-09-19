# REL-002 Phase 2D-0B PostgreSQL Schema Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-321 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |
| 대상 | Supabase PostgreSQL / `app_identity` |

## 1. 계약 원칙

`app_identity`는 Railway backend 전용 non-exposed PostgreSQL schema다. Supabase는 managed PostgreSQL만 제공하며 Identity, authorization 또는 business authority를 획득하지 않는다. 모든 identifier는 bounded application contract가 검증하고, timestamps는 `timestamptz`, structured payload는 `jsonb`, versions는 JavaScript safe integer 범위의 `bigint`를 사용한다.

Logical contract version은 engine과 무관하게 `v1`을 유지하되 physical identity는 `database_engine = POSTGRESQL`로 SQLite와 구분한다.

## 2. metadata contract

### 2.1 `app_identity.identity_schema_contracts`

| Column | PostgreSQL type | Null | Constraint |
|---|---|---|---|
| `contract_id` | `text` | NO | PK component |
| `schema_version` | `integer` | NO | `>= 1`, PK component |
| `database_engine` | `text` | NO | exactly `POSTGRESQL`, PK component |
| `contract_fingerprint` | `text` | NO | canonical lowercase SHA-256 hex |
| `recorded_at` | `timestamptz` | NO | execution provenance |

Primary key: `(contract_id, schema_version, database_engine)`.

Required contract IDs:

- `identity.session` / `1` / `POSTGRESQL`
- `identity.registered-service-workload` / `1` / `POSTGRESQL`

### 2.2 `app_identity.identity_schema_migrations`

| Column | PostgreSQL type | Null | Constraint |
|---|---|---|---|
| `migration_id` | `text` | NO | PK |
| `artifact_checksum` | `text` | NO | lowercase SHA-256 hex |
| `contract_id` | `text` | NO | FK to contract row |
| `schema_version` | `integer` | NO | FK component |
| `database_engine` | `text` | NO | exactly `POSTGRESQL` |
| `contract_fingerprint` | `text` | NO | must match contract row |
| `target_environment` | `text` | NO | exactly `PRODUCTION` |
| `operator_evidence_ref` | `text` | NO | bounded reference |
| `backup_evidence_ref` | `text` | NO | bounded reference |
| `applied_at` | `timestamptz` | NO | execution provenance |
| `result` | `text` | NO | exactly `APPLIED` |

Unique: `(contract_id, schema_version, database_engine)`. DDL, contract rows 및 migration row는 동일 transaction에서 atomic commit한다.

## 3. Session schema

### 3.1 `app_identity.identity_sessions`

| Column | PostgreSQL type | Null | Constraint |
|---|---|---|---|
| `session_id` | `text` | NO | PK |
| `session_version` | `bigint` | NO | `BETWEEN 1 AND 9007199254740991` |
| `state` | `text` | NO | `ACTIVE`, `REVOKED`, `EXPIRED` |
| `payload_json` | `jsonb` | NO | object; canonical application validator remains authoritative |
| `created_at` | `timestamptz` | NO | immutable chronology |
| `updated_at` | `timestamptz` | NO | not before `created_at` |

Required indexes:

- primary key on `session_id`
- expression index on `((payload_json ->> 'familyId'), session_id)` for bounded family lookup
- index on `(state, updated_at, session_id)` for bounded operational reads

The adapter must reject payloads missing canonical `familyId`; database JSON structure is not a replacement Session vocabulary.

### 3.2 `app_identity.identity_session_revocations`

| Column | PostgreSQL type | Null | Constraint |
|---|---|---|---|
| `session_id` | `text` | NO | FK to sessions, PK component |
| `session_version` | `bigint` | NO | PK component, safe integer bound |
| `revoked_at` | `timestamptz` | NO | source chronology |
| `reason` | `text` | NO | existing bounded reason vocabulary only |
| `identity_evidence_ref` | `text` | NO | bounded reference |
| `audit_evidence_ref` | `text` | NO | bounded reference |

Primary key: `(session_id, session_version)`. `ON DELETE` cascade is prohibited. An owned trigger rejects `UPDATE` and `DELETE`, preserving append-only evidence.

Session update and revocation insert occur in one transaction. No trigger creates business evidence or authority.

## 4. RegisteredServiceWorkload schema

### `app_identity.identity_registered_service_workloads`

| Column | PostgreSQL type | Null | Constraint |
|---|---|---|---|
| `registration_id` | `text` | NO | PK |
| `tenant_id` | `text` | NO | canonical tenant binding |
| `principal_id` | `text` | NO | canonical principal binding |
| `principal_type` | `text` | NO | exactly `SERVICE` |
| `assurance` | `text` | NO | exactly `WORKLOAD` |
| `environment` | `text` | NO | exactly `PRODUCTION` |
| `status` | `text` | NO | `ACTIVE`, `SUSPENDED`, `REVOKED` (existing approved contract) |
| `workload_purpose` | `text` | NO | bounded existing purpose |
| `audience` | `text` | NO | bounded existing audience |
| `registration_version` | `bigint` | NO | `BETWEEN 1 AND 9007199254740991` |
| `identity_evidence_ref` | `text` | NO | immutable proof reference |
| `audit_evidence_ref` | `text` | NO | final API-016 reference |
| `created_at` | `timestamptz` | NO | chronology |
| `updated_at` | `timestamptz` | NO | not before `created_at` |

Required constraints/indexes:

- PK `registration_id`
- unique `(tenant_id, principal_id)`
- index `(tenant_id, status)`
- checks for fixed principal/assurance/environment and approved status values
- no credential, role, scope, capability or policy columns

## 5. Ownership and grants

| Role | Allowed | Prohibited |
|---|---|---|
| migration technical role | controlled DDL and contract/ledger insert during approved execution | runtime use, business authorization |
| Railway runtime technical role | required DML on Session; read-only workload/contract/ledger; schema inspection | DDL, migration ledger mutation, identity seeding |
| Vercel/browser roles | none | DB connection, secret, table access |
| Supabase `anon`/`authenticated`/`service_role` | no canonical app grant under this contract | business authority or bypass |

RLS is not adopted as business authority. Direct Railway access still enforces tenant/scope through the application. If Data API exposure is later approved, RLS becomes a separate mandatory review.

## 6. SQLite 차이와 보존

| SQLite Phase 2B | PostgreSQL Production |
|---|---|
| root/file database | `app_identity` schema in bound Supabase project |
| `INTEGER` affinity | exact `integer`/`bigint` |
| timestamp `TEXT` | `timestamptz` |
| payload text | `jsonb` |
| `PRAGMA` inspection | `pg_catalog` inspection |
| `BEGIN IMMEDIATE` | checked-out client + `BEGIN` + explicit isolation |
| file backup assumptions | provider-bound PostgreSQL backup/restore evidence |

SQLite artifacts remain immutable local/test/historical evidence and must not be executed on PostgreSQL.

## 7. Fingerprints

Canonical contract fingerprints and SQL artifact checksum are generated from the actual approved implementation bytes. At design time their values are `GENERATED_AT_IMPLEMENTATION`; fabricated hashes are prohibited. Fingerprint input includes ordered tables, columns, exact types, nullability, constraints, indexes, triggers, contract IDs/version and engine.

## 8. 근거 및 관련 문서

PostgreSQL system catalogs are the authoritative structural metadata source: [PostgreSQL System Catalogs](https://www.postgresql.org/docs/current/catalogs.html).

- [Transition Design](REL002_PHASE2D0B_POSTGRESQL_PERSISTENCE_TRANSITION_DESIGN.md)
- [Validator Design](REL002_PHASE2D0B_SCHEMA_COMPATIBILITY_VALIDATOR_DESIGN.md)
- [Migration Artifact Design](REL002_PHASE2D0B_POSTGRESQL_MIGRATION_ARTIFACT_DESIGN.md)
