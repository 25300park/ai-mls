# REL-002 Historical Migration Attestation Controlled Execution Runbook

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-362 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Database Owner / Security Owner |
| Decision | DEC-193 |

## 사전 조건

1. exact Production target, named operator, backup/restore evidence가 승인되어야 한다.
2. historical `001`은 재실행하지 않는다.
3. complete `001_identity_persistence_v1.verify.sql`가 현재 exact schema에 대해 PASS해야 한다.
4. native `identity_schema_migrations`에는 대상 migration row가 없어야 한다.
5. 실제 `operator_evidence_ref`, `backup_evidence_ref`, `schema_verification_evidence_ref`가 확정되어야 한다. 값을 추정하거나 문서에서 생성하지 않는다.
6. `backup_evidence_ref`가 DEC-194 platform-limited path를 사용하면 해당 record는 `PLATFORM_LIMITED_RESTORE_CHAIN_ATTESTATION`, `BACKUP_RESTORE_PLATFORM_LIMITED_ATTESTATION_VERIFIED`, Link B `PARTIAL_PLATFORM_LIMITATION`, execution-operator approval 및 independent reviewer approval을 모두 명시해야 한다.

## DEC-194 evidence acceptance

[DEC-194 evidence contract](REL002_PLATFORM_LIMITED_BACKUP_RESTORE_EVIDENCE_CONTRACT.md) path는 exact Production ref `mfonujjeokvpsfucfxuq`, selected backup `24 Sep 2026 22:53:36 (+0000)`, target `ai-mls-rel002-restore-rehearsal-r2` 및 canonical R2 source package에만 허용된다. Provider-native backup identifier 또는 restore job identifier가 확인됐다고 주장하지 않는다. A/C/D/E는 `PROVEN`, B는 `PARTIAL_PLATFORM_LIMITATION`으로 유지한다.

Execution operator가 실제 R2 sequence와 selected backup을 명시적으로 attest하고 independent reviewer가 source package 및 limitation을 승인하기 전까지 `backup_evidence_ref`는 finalized evidence로 사용할 수 없다. 이 governance check는 controlled execution 승인 절차가 수행하며 `007` 또는 runtime schema semantics를 변경하지 않는다.

## 별도 승인이 필요한 실행 순서

1. migration operator로 TLS-verified 연결을 확립한다.
2. `006_historical_migration_attestation_schema_v1.sql`을 한 번 실행한다.
3. 같은 controlled session/transaction 범위에서 아래 session-local GUC를 제공한다.
   - `ai_mls.operator_evidence_ref`
   - `ai_mls.backup_evidence_ref`
   - `ai_mls.schema_verification_evidence_ref`
4. `007_record_historical_identity_migration_attestation_v1.sql`을 한 번 실행한다.
5. `008_historical_identity_migration_attestation_v1.verify.sql`을 실행하고 `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED`를 확인한다.
6. runtime role의 read-only provenance와 내부 `ProductionRuntimeHandle.identitySchemaReadinessProvenance`를 확인한다. `/readyz`는 기존 계약대로 READY/NOT_READY만 노출하며 provenance를 외부에 추가 노출하지 않는다.

## 중단 조건

native ledger row 존재, non-empty attestation relation, exact schema/contract/constraint mismatch, evidence ref 누락·공백·control character·512자 초과, 다른 migration identity, duplicate/conflict 또는 verifier 오류가 있으면 즉시 중단한다. `ON CONFLICT`, repair UPDATE, DELETE, 001 rerun 또는 005 실행으로 우회하지 않는다.

DEC-194 path에서는 execution-operator approval 또는 independent reviewer approval가 없거나 Link B를 `PROVEN`으로 과장하거나 native identifier를 추정한 record도 중단 조건이다.

## 현재 실행 상태

Production schema amendment `0`, attestation insert `0`, `005` execution `0`, role/runtime grant execution `0`, deployment `0`이다.
