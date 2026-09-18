# REL-002 Phase 1F Schema Compatibility Readiness Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-298 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity / Data Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-167, DEC-171 (`APPROVED`) |
| Baseline | `3c2a03ac6787b0323846da6bfa2d3e52c72cc069` |

## 1. 문제

Phase 1E의 SQL text fragment와 column-order 검사는 compatible schema를 증명하지 못한다. constraint, affinity, uniqueness, index columns, foreign-key policy 및 schema version 차이를 놓칠 수 있고, runtime repair와 compatibility check의 경계도 충분히 닫히지 않는다.

## 2. Canonical schema contract

Identity module이 versioned code-level `RegisteredServiceWorkloadSchemaContract`를 소유한다. Bootstrap이나 문서 문자열이 schema authority가 아니다.

Contract는 다음을 exact하게 포함한다.

- contract ID와 schema version
- table name
- ordered column name, SQLite affinity, nullability, primary key, default
- unique `(tenant_id, principal_id)`와 required indexes
- `SERVICE`, `WORKLOAD`, `PRODUCTION`, lifecycle 및 version constraints
- foreign-key policy와 required trigger 목록
- deterministic contract fingerprint

Phase 2 migration artifact와 Phase 1 readiness checker는 동일 contract artifact를 참조한다. Phase 2만 Production DDL/migration을 실행하고 version/fingerprint metadata를 기록한다.

## 3. Strict read-only checker

`RegisteredServiceWorkloadSchemaCompatibilityChecker`는 read-only connection에서 다음을 조회한다.

- `sqlite_schema`
- `PRAGMA table_xinfo`
- `PRAGMA index_list` 및 `index_xinfo`
- `PRAGMA foreign_key_list`
- Phase 2-owned schema version/fingerprint metadata

Exact match가 아니면 `MISSING`, `VERSION_MISMATCH`, `CONTRACT_MISMATCH`, `UNREADABLE` 중 bounded safe result로 fail closed한다. checker는 DDL, repair, migration, `CREATE TABLE IF NOT EXISTS`, index 생성 또는 pragma mutation을 수행하지 않는다.

추가 column/constraint/index도 forward-compatible로 추정하지 않는다. 별도 approved contract version이 없으면 incompatible다.

## 4. Startup ordering

1. pre-gate read-only authority/schema connection을 연다.
2. exact schema version/fingerprint/structure를 확인한다.
3. mismatch면 gate를 실패시키고 safe diagnostic만 반환한다.
4. PASS 후에만 Session UoW와 child roots를 생성한다.

Phase 2 migration 완료 전 Production bootstrap은 fail closed한다. Phase 1은 migration을 실행하지 않는다.

## 5. Decision proposal

`DEC-171 = APPROVED`: Identity-owned versioned schema contract와 Phase 2-owned migration metadata를 exact authority로 채택하고, Production startup은 read-only structural+version+fingerprint equality만 허용한다.
