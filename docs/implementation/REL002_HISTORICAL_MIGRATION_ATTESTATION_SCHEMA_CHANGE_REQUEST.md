# REL-002 Historical Migration Attestation Schema Change Request

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-361 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Database Owner |
| Change Request | CR-028 |
| Decision | DEC-193 |

## 변경 목적

이미 Production에 적용되어 exact schema verifier를 통과했지만 원래 실행 시각을 복구할 수 없는 `REL002-P2D0B-IDENTITY-PG-V1`에 한해서, native ledger를 위조하지 않고 별도 historical reconstruction evidence를 기록한다.

## 변경 범위

- 신규 relation: `app_identity.identity_historical_migration_attestations`
- schema artifact: `006_historical_migration_attestation_schema_v1.sql`
- exact insertion artifact: `007_record_historical_identity_migration_attestation_v1.sql`
- read-only verifier: `008_historical_identity_migration_attestation_v1.verify.sql`
- `historical_applied_at = NULL`, `historical_applied_at_known = FALSE`
- `evidence_recorded_at`은 database-generated `timestamptz NOT NULL`

허용 migration identity, checksum, contract, version, engine, fingerprint, environment, reason, result는 DEC-193 값과 정확히 일치해야 한다. 다른 unknown-time migration을 허용하는 일반 규칙은 없다.

## 불변 경계

- `identity_schema_migrations.applied_at NOT NULL` 유지
- historical `001_identity_persistence_v1.up.sql` 및 SHA-256 불변
- `005_record_existing_identity_migration_v1.sql` 의미와 파일 불변
- native ledger가 존재하면 historical path는 fail closed
- UPDATE/DELETE/TRUNCATE/UPSERT/overwrite 없음
- Production execution, role change, deployment 모두 `0`

## 승인 및 실행 분리

이 문서는 repository artifact 구현을 승인한 CR이다. Production에서 `006`, `007`, `008`을 실행하는 권한은 포함하지 않는다. 실제 evidence reference 세 값과 별도 controlled execution authorization이 준비될 때까지 실행은 `BLOCKED`다.

관련 문서: [Execution Runbook](REL002_HISTORICAL_MIGRATION_ATTESTATION_EXECUTION_RUNBOOK.md), [Schema Compatibility Contract](REL002_HISTORICAL_MIGRATION_ATTESTATION_SCHEMA_COMPATIBILITY.md), [RTM](REL002_HISTORICAL_MIGRATION_ATTESTATION_TRACEABILITY_MATRIX.md).
