# REL-002 Production Backup / Restore Rehearsal Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | `REL002-EVIDENCE-BACKUP-RESTORE-001` |
| Evidence class | `PLATFORM_LIMITED_RESTORE_CHAIN_ATTESTATION` |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| Evidence state | FINALIZED |
| 소유 역할 | Database Owner / Security Owner |
| 적용 결정 | DEC-193, DEC-194 |
| 대상 환경 | PRODUCTION backup / isolated restore rehearsal |
| 생성 기준일 | 2026-09-28 |
| 변경 정책 | 승인 후 immutable; 정정은 새 evidence record로만 허용 |

## 1. 목적

이 record는 DEC-194 supplemental backup/restore evidence를 보존한다. Required execution-operator attestation과 independent reviewer approval을 모두 확보했으며 canonical ID와 SHA-256 sidecar로 finalization한다.

## 2. Source-backed facts

| 항목 | 값 |
|---|---|
| Production project | `ai-mls-production` |
| Production ref | `mfonujjeokvpsfucfxuq` |
| Selected backup | `24 Sep 2026 22:53:36 (+0000)` |
| Backup status | `COMPLETED` |
| Restore target | `ai-mls-rel002-restore-rehearsal-r2` |
| Restore history status | `COMPLETED` |
| Restore history timestamp | `25 Sep 2026 08:31:29 (+0000)` |
| Restored project ref | `nkpwmizqavoxfxqgjlfr` |
| Restored endpoint | `db.nkpwmizqavoxfxqgjlfr.supabase.co` |
| Restored project status | `Healthy` |
| DB transcript SHA-256 | `dc288924fd43beb42a9ab29a1a369f20d72f8e8bdc791c303f33ec28a7eef429` |
| Manifest | `10/10 PASS`; missing `0`; mismatch `0` |
| Cleanup | PROVEN |
| Historical applied_at | UNKNOWN |

Canonical source directory:

`docs/evidence/source/rel002-backup-restore-r2-canonical/`

Governance: [DEC-194 Evidence Contract](../implementation/REL002_PLATFORM_LIMITED_BACKUP_RESTORE_EVIDENCE_CONTRACT.md).

## 3. Linkage and provenance

| Link | 상태 |
|---|---|
| A. Production project/ref → selected backup | PROVEN |
| B. selected backup → specific R2 restore | PARTIAL_PLATFORM_LIMITATION |
| C. R2 restore → restored project/ref | PROVEN |
| D. restored project/ref → endpoint → DB validation | PROVEN |
| E. restored project/ref → cleanup/removal | PROVEN |

Required provider limitation statement:

> The provider UI did not expose a platform-native backup identifier or restore job identifier connecting the selected backup directly to the restore operation.

Finalized provenance: `BACKUP_RESTORE_PLATFORM_LIMITED_ATTESTATION_VERIFIED`.

이 record는 native backup→restore binding을 주장하지 않는다. Backup ID 또는 restore job ID를 추정하거나 fabricate하지 않는다.

## 4. Execution-operator attestation

Status: `APPROVED`.

Execution operator reference: `REL002-OPERATOR-HUMAN-001`.

Accountable execution operator는 다음을 명시적으로 attest했다.

1. Operator가 REL-002 R2 Supabase restore rehearsal을 직접 수행했다.
2. Selected source backup은 `24 Sep 2026 22:53:36 (+0000)`이었다.
3. Restore target은 `ai-mls-rel002-restore-rehearsal-r2`였다.
4. `docs/evidence/source/rel002-backup-restore-r2-canonical/` package는 executed sequence를 정확히 반영한다.
5. Supabase UI는 selected backup과 restore operation을 직접 결합하는 platform-native backup identifier 또는 restore job identifier를 노출하지 않았다.
6. Backup ID, restore job ID 또는 native provider binding을 fabricate, infer 또는 invent하지 않았다.

Operator는 A/C/D/E `PROVEN`, B `PARTIAL_PLATFORM_LIMITATION`, native backup→restore binding은 not proven, historical migration `applied_at`은 `UNKNOWN`임을 승인했다.

## 5. Independent reviewer approval

Status: `APPROVED`.

2026-09-28 independent reviewer는 canonical source package의 PNG 8개, transcript, sidecar와 manifest를 read-only로 검토하고 다음을 승인했다.

- A/C/D/E `PROVEN`; B `PARTIAL_PLATFORM_LIMITATION`.
- Canonical manifest `10/10 PASS`; missing/mismatch `0`.
- Transcript SHA-256가 `dc288924fd43beb42a9ab29a1a369f20d72f8e8bdc791c303f33ec28a7eef429`와 일치한다.
- `REL002-OPERATOR-HUMAN-001` attestation은 여섯 required statement를 모두 포함한다.
- Required provider limitation statement가 정확하고 unsupported native-binding claim이 없다.
- Package는 DEC-194에 충분하며 이 evidence ID를 finalize하고 sidecar를 생성할 수 있다.

Independent review는 Production SQL execution 승인이 아니다.

## 6. Finalization result

- Execution-operator attestation: `APPROVED`.
- Independent reviewer approval: `APPROVED`.
- Canonical ID: `REL002-EVIDENCE-BACKUP-RESTORE-001`.
- Evidence provenance: `BACKUP_RESTORE_PLATFORM_LIMITED_ATTESTATION_VERIFIED`.
- Canonical `backup_evidence_ref`: `REL002-EVIDENCE-BACKUP-RESTORE-001`.
- Production historical-attestation execution preparation: `READY`; SQL execution은 별도 승인 대상이다.
- Historical migration `applied_at`: `UNKNOWN`.

## 7. 안전 상태

Production mutation, `006`, `007`, `008`, `005`, `002`, `004` execution 및 deployment는 모두 `0`이다.

Related review: [Implementation Completion Report](../reviews/REL002_PLATFORM_LIMITED_BACKUP_RESTORE_EVIDENCE_IMPLEMENTATION_COMPLETION.md).
