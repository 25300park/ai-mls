# REL-002 Platform-Limited Backup/Restore Evidence Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-366 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Database Owner / Security Owner |
| Decision | DEC-194 |
| Change Request | CR-029 |

## 1. 목적과 exact scope

이 계약은 REL-002, Supabase `RESTORE_TO_NEW_PROJECT`, Production project ref `mfonujjeokvpsfucfxuq`, selected backup `24 Sep 2026 22:53:36 (+0000)` 및 `docs/evidence/source/rel002-backup-restore-r2-canonical/`에만 적용한다. Generic weak-evidence bypass가 아니다.

Approved evidence class는 `PLATFORM_LIMITED_RESTORE_CHAIN_ATTESTATION`이며, finalized provenance는 `BACKUP_RESTORE_PLATFORM_LIMITED_ATTESTATION_VERIFIED`이다.

## 2. Canonical linkage state

| Link | 상태 |
|---|---|
| A. Production project/ref → selected backup | PROVEN |
| B. selected backup → specific R2 restore | PARTIAL_PLATFORM_LIMITATION |
| C. R2 restore → restored project/ref | PROVEN |
| D. restored project/ref → endpoint → DB validation | PROVEN |
| E. restored project/ref → cleanup/removal | PROVEN |

Required statement:

> The provider UI did not expose a platform-native backup identifier or restore job identifier connecting the selected backup directly to the restore operation.

Native backup→restore binding을 `PROVEN`으로 표현하지 않는다. Backup ID, restore job ID 또는 provider-native relation을 추정·생성하지 않는다.

## 3. Required immutable bindings

Supplemental record는 다음 exact 값을 결합해야 한다.

- source project `ai-mls-production`
- source ref `mfonujjeokvpsfucfxuq`
- selected backup `24 Sep 2026 22:53:36 (+0000)`
- unique target `ai-mls-rel002-restore-rehearsal-r2`
- restored ref `nkpwmizqavoxfxqgjlfr`
- endpoint `db.nkpwmizqavoxfxqgjlfr.supabase.co`
- DB transcript SHA-256 `dc288924fd43beb42a9ab29a1a369f20d72f8e8bdc791c303f33ec28a7eef429`
- canonical manifest result `10/10 PASS`
- cleanup `PROVEN`
- historical `applied_at` `UNKNOWN`

## 4. Dual approval gate

Finalization에는 서로 다른 두 approval이 필요하다.

1. Execution operator는 본인이 documented R2 sequence를 수행했고 recorded backup timestamp를 선택했으며 unique R2 target과 retained package가 실제 sequence를 정확히 반영한다고 attest한다. Provider-native job/backup identifier가 노출되지 않았고 어떤 identifier도 fabricate하지 않았음을 포함한다.
2. Independent reviewer는 A/C/D/E `PROVEN`, B `PARTIAL_PLATFORM_LIMITATION`, manifest PASS, provider limitation statement 및 unsupported native-binding claim 부재를 검증하고 DEC-194 sufficiency를 승인한다.

Execution operator와 independent reviewer는 동일 self-review authority가 될 수 없다. 어느 하나라도 없으면 evidence state는 `BLOCKED`이며 canonical ID와 SHA sidecar를 finalized evidence로 발행하지 않는다.

## 5. DEC-193 integration boundary

DEC-193 semantics와 native ledger는 변경하지 않는다. Approved supplemental record는 `007`의 bounded `backup_evidence_ref`가 가리키는 governance evidence가 될 수 있다. `006`, `007`, `008`, runtime readiness code와 database schema는 변경하지 않는다.

`BACKUP_RESTORE_PLATFORM_LIMITED_ATTESTATION_VERIFIED`는 backup evidence record의 provenance이며 `NATIVE_MIGRATION_LEDGER_VERIFIED` 또는 provider-native restore binding을 뜻하지 않는다. Historical attestation overall readiness는 기존 `HISTORICAL_MIGRATION_ATTESTATION_VERIFIED`로 유지된다.

## 6. Future behavior

Provider가 native backup identifier 또는 restore job binding을 노출하는 future evidence에서는 native binding을 우선한다. 다른 project, provider, restore mode, backup 또는 rehearsal에 DEC-194를 자동 재사용하지 않는다.

## 7. 안전 상태

이 계약 구현의 Production mutation, `006`, `007`, `008`, `005`, `002`, `004` execution 및 deployment는 모두 `0`이다.

## 8. 관련 문서

- [Historical Migration Attestation Execution Runbook](REL002_HISTORICAL_MIGRATION_ATTESTATION_EXECUTION_RUNBOOK.md)
- [Historical Migration Attestation Traceability Matrix](REL002_HISTORICAL_MIGRATION_ATTESTATION_TRACEABILITY_MATRIX.md)
- [Finalized Backup/Restore Evidence Record](../evidence/REL002_PRODUCTION_BACKUP_RESTORE_REHEARSAL_EVIDENCE.md)
- [Implementation Completion Report](../reviews/REL002_PLATFORM_LIMITED_BACKUP_RESTORE_EVIDENCE_IMPLEMENTATION_COMPLETION.md)
