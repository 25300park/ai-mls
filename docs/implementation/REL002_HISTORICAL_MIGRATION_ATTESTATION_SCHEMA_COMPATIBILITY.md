# REL-002 Historical Migration Attestation Schema Compatibility Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-363 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Database Owner |
| Decision | DEC-193 |

## Exact relation contract

`identity_historical_migration_attestations`는 15개 bounded field, exact PK/FK/CHECK constraints, database-generated `evidence_recorded_at`, 3개 append-only trigger를 갖는다. runtime role은 SELECT만 허용되며 mutation privilege는 허용하지 않는다.

## Compatibility gate

readiness inspector는 기존 5-table Identity schema를 먼저 exact 검증한다. 이후 provenance는 상호 배타적으로 판정한다.

- native ledger exactly one row + valid semantics: `NATIVE_MIGRATION_LEDGER_VERIFIED`
- native ledger zero rows + exact attestation schema + exact one DEC-193 row: `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED`
- 두 evidence path 동시 존재, duplicate, partial relation, invalid field, unsafe evidence reference 또는 catalog mismatch: `NOT_READY_INCOMPATIBLE_SCHEMA`

PostgreSQL 18의 system-generated `NOT NULL` catalog constraints(`contype = 'n'`)는 application-owned 24/12 PK·UK·FK·CHECK inventory와 구분한다. 이 차이는 constraint semantic 완화가 아니다.

## Native ledger preservation

`identity_schema_migrations.applied_at`은 계속 `NOT NULL`이며 future migration은 true execution time을 native flow에서 기록한다. Historical attestation은 native migration execution evidence와 동일한 것으로 표시하지 않는다.
