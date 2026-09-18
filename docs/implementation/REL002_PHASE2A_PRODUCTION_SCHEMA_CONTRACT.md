# REL-002 Phase 2A Production Schema Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-304 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Database Reviewer |
| 기준일 | 2026-09-18 |
| Decisions | DEC-167/171/173 (`APPROVED`) |

## 1. Source of truth

`modules/identity/src/registered-service-workload-schema.ts`의 `REGISTERED_SERVICE_WORKLOAD_SCHEMA_CONTRACT`가 authoritative code-level contract다. 문서 DDL은 이를 그대로 표현하며 독립 vocabulary를 만들지 않는다.

## 2. Exact DDL target

```sql
CREATE TABLE identity_schema_contracts (
  contract_id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  contract_fingerprint TEXT NOT NULL
);

CREATE TABLE identity_schema_migrations (
  migration_id TEXT PRIMARY KEY NOT NULL,
  artifact_checksum TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  contract_fingerprint TEXT NOT NULL,
  target_environment TEXT NOT NULL CHECK (target_environment = 'PRODUCTION'),
  change_evidence_ref TEXT NOT NULL,
  operator_evidence_ref TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result = 'APPLIED'),
  UNIQUE (contract_id, schema_version)
);

CREATE TABLE identity_registered_service_workloads (
  registration_id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK (principal_type = 'SERVICE'),
  assurance TEXT NOT NULL CHECK (assurance = 'WORKLOAD'),
  environment TEXT NOT NULL CHECK (environment = 'PRODUCTION'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  workload_purpose TEXT NOT NULL,
  audience TEXT NOT NULL,
  registration_version INTEGER NOT NULL CHECK (registration_version >= 1),
  identity_evidence_ref TEXT NOT NULL,
  audit_evidence_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, principal_id)
);

CREATE INDEX identity_registered_service_workloads_tenant_status_idx
  ON identity_registered_service_workloads (tenant_id, status);
```

Metadata row:

```text
contract_id = identity.registered-service-workload
schema_version = 1
contract_fingerprint = 6758c44e385d416299020512d93b6485b42377daf2d9bfd5461f0413fde65e6b
```

Migration ledger row는 `migration_id = REL002-P2A-IDENTITY-RSW-V1`와 approved artifact checksum을 사용한다. `identity_schema_migrations`는 DEC-172의 approved migration-control metadata이며 Phase 1G runtime entity나 새 business persistence subsystem이 아니다.

## 3. Exact column matrix

| Column | SQLite type | Null | Integrity / meaning |
|---|---|---|---|
| `registration_id` | TEXT | NO | immutable primary key |
| `tenant_id` | TEXT | NO | authoritative tenant binding |
| `principal_id` | TEXT | NO | authoritative service principal |
| `principal_type` | TEXT | NO | exactly `SERVICE` |
| `assurance` | TEXT | NO | exactly `WORKLOAD` |
| `environment` | TEXT | NO | exactly `PRODUCTION`; Phase 1G-required field |
| `status` | TEXT | NO | `ACTIVE`, `SUSPENDED`, `REVOKED` only |
| `workload_purpose` | TEXT | NO | bounded approved purpose |
| `audience` | TEXT | NO | exact governed root audience |
| `registration_version` | INTEGER | NO | integer `>= 1` |
| `identity_evidence_ref` | TEXT | NO | immutable Identity evidence reference only |
| `audit_evidence_ref` | TEXT | NO | final API-016 evidence reference only |
| `created_at` | TEXT | NO | canonical instant representation |
| `updated_at` | TEXT | NO | canonical instant representation |

The Phase 2A brief's logical list omitted `environment`; Phase 1G code requires it, so exact compatibility requires this column. No roles, scopes, capabilities, credential values, raw evidence, defaults, foreign keys or triggers are permitted in v1.

## 4. Lifecycle vocabulary

`ACTIVE | SUSPENDED | REVOKED` is already canonical Identity registration vocabulary in the approved Phase 1D design and Phase 1G implementation. It is distinct from Session continuity lifecycle and introduces no new status.

## 5. Shared metadata compatibility

| Existing `identity_schema_contracts` state | Disposition |
|---|---|
| table absent and all target artifacts absent | transaction 안에서 exact 3-column table 생성 가능 |
| exact 3-column table present, target contract row absent, unrelated contract rows present 가능 | shared table 재사용; target artifacts가 전혀 없을 때만 target row를 transaction에서 추가 |
| exact table + exact target row present | workload schema와 migration ledger까지 함께 분류 |
| target row present but workload/ledger incomplete | `MIGRATION_PARTIALLY_APPLIED`; 자동 adoption 금지 |
| column/order/type/nullability/PK가 다른 table | `NOT_READY_INCOMPATIBLE_SCHEMA`; 변경/repair 금지 |
| target row version이 `{1}` 밖 | `NOT_READY_UNSUPPORTED_VERSION`; downgrade 금지 |

다른 `contract_id` row는 shared metadata table의 정상 사용이며 incompatibility가 아니다.

## 6. Runtime compatibility

Phase 1G checker는 ordered columns, type affinity, `NOT NULL`, primary key, no defaults, required check constraints, required unique key, named non-partial tenant/status index, zero foreign keys, zero triggers, exact metadata columns, target version과 fingerprint를 검증한다. Extra columns, missing required indexes/constraints, incompatible metadata 또는 fingerprint drift는 거부한다.

현재 checker는 required indexes가 충족되면 unrelated extra indexes 자체는 거부하지 않는다. 따라서 Phase 2A migration은 위 DDL 외 extra index를 만들지 않지만, 이미 존재하는 extra index만으로 runtime incompatibility를 주장하지 않는다. Extra index 제거/승인은 별도 database governance 대상이다.

Migration readiness는 runtime checker 결과에 더해 DEC-172 migration ledger의 exact replay identity까지 요구한다. 이는 runtime business schema equality와 migration execution evidence를 혼동하지 않기 위한 추가 startup evidence다.

## 7. Decision proposal

`DEC-173 = APPROVED`: Identity owns schema version/fingerprint compatibility; migration writes the exact metadata and Production runtime only performs read-only equality checks.
