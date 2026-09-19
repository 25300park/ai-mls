# REL-002 Phase 2D-0B Schema Compatibility Validator Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-323 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |

## 1. 목적

Production startup은 PostgreSQL physical schema가 [PostgreSQL Schema Contract](REL002_PHASE2D0B_POSTGRESQL_SCHEMA_CONTRACT.md)와 정확히 일치하는지 read-only로 검증한다. Validator는 schema를 생성, 수리, migration 또는 seed하지 않는다.

## 2. Catalog evidence

하나의 `REPEATABLE READ READ ONLY` transaction에서 fully-qualified `pg_catalog` relations를 조회한다.

| Catalog | 검증 대상 |
|---|---|
| `pg_namespace` | exact `app_identity` namespace |
| `pg_class` | required tables/indexes and relation kinds |
| `pg_attribute` / `pg_type` | columns, order, exact data type, nullability |
| `pg_constraint` | PK, FK, unique and check definitions |
| `pg_index` | uniqueness, key/expression ordering and validity |
| `pg_trigger` / `pg_proc` | exact owned append-only trigger/function identity |

The authoritative catalog model is documented by PostgreSQL: [System Catalogs](https://www.postgresql.org/docs/current/catalogs.html).

No unqualified user-controlled `search_path` is trusted. Runtime queries use exact `app_identity` qualification and catalog queries use `pg_catalog` qualification.

## 3. Exact checks

Validator verifies:

1. expected namespace exists;
2. all five owned tables exist with expected relation kind;
3. ordered columns, types, generated/default expressions and nullability match;
4. primary, foreign key, unique and check constraints are exact;
5. required indexes exist, are valid and match keys/expressions/order;
6. append-only revocation trigger/function exists and has exact fingerprinted definition;
7. engine-aware contract rows exist for both contract IDs;
8. migration ledger row has exact ID, checksum, engine, environment, contract version/fingerprint and `APPLIED` result;
9. no unknown column, constraint, index or owned trigger exists on governed tables;
10. runtime technical role has required least privilege and lacks DDL/migration-ledger write privilege.

Provider-created PostgreSQL objects outside `app_identity` are out of scope and are not rejected.

## 4. Result mapping

Existing bounded readiness vocabulary is reused; new lifecycle/status vocabulary is not introduced.

| Evidence | Result |
|---|---|
| exact structure + metadata + migration equality | `READY` |
| schema/required table absent | existing missing-schema `NOT_READY` classification |
| some but not all owned objects/rows exist | existing partial-migration `NOT_READY` classification |
| version/fingerprint/checksum unsupported | existing incompatible/unsupported `NOT_READY` classification |
| catalog permission, timeout or connection ambiguity | fail-closed `NOT_READY`, sanitized reason |

The implementation must map to the exact existing Phase 2B readiness enum names; this design does not add synonyms. Unknown result is never translated to `READY`.

## 5. Safety

- Validator SQL is static and parameterized where values are required.
- Catalog results are bounded before allocation.
- Raw SQL, database URI, host, project reference, stack and driver diagnostics are sanitized.
- Validator has no DDL path and no migration artifact import/execute path.
- Running validator repeatedly is read-only and deterministic for the same snapshot.
- timeout or cancellation closes/rolls back the read transaction and discards unhealthy clients.

## 6. Verification design

Future implementation tests must prove:

- exact clean PostgreSQL migration produces `READY`;
- missing schema/table/column/constraint/index/trigger/ledger row fails closed;
- wrong type/nullability/check definition/index expression fails closed;
- unsupported version, engine, checksum or fingerprint fails closed;
- partial migration never becomes `READY`;
- unknown extra governed object fails closed;
- provider objects outside `app_identity` do not cause false drift;
- read-only role cannot mutate and validator issues no mutation;
- concurrent DDL cannot yield a mixed snapshot;
- unsafe diagnostic leakage is `0`.

No Production, Supabase or external network execution is authorized in Phase 2D-0B.

## 7. Decision status

DEC-179/181 are `APPROVED`. PostgreSQL physical validator implementation remains separately authorized; the approved runtime driver is `pg`, while exact test harness and any required test dependency remain separately gated.
