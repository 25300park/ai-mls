# REL-002 Production Identity Schema Verification Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | `REL002-EVIDENCE-SCHEMA-VERIFY-001` |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| Evidence state | FINALIZED |
| 소유 역할 | Identity Owner / Database Owner |
| 적용 결정 | DEC-193 |
| 대상 환경 | PRODUCTION |
| 생성 기준일 | 2026-09-25 |
| 변경 정책 | 승인 후 immutable; 정정은 새 evidence record로만 허용 |

## 1. 목적

이 record는 DEC-193 historical migration attestation을 위한 current Production Identity schema의 complete verifier 실행 결과를 보존한다. Schema verification 시각과 복구 불가능한 historical migration 실행 시각을 명시적으로 분리한다.

## 2. Exact binding

| 항목 | 값 | 근거 |
|---|---|---|
| Supabase project | `ai-mls-production` | `docs/implementation/REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md` |
| Project ref | `mfonujjeokvpsfucfxuq` | `docs/implementation/REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md` |
| Database | `postgres` | source transcript |
| Executing role | `ai_mls_production_migration_operator` | source transcript |
| Verifier artifact | `modules/identity/migrations/postgresql/production/001_identity_persistence_v1.verify.sql` | source transcript |
| Verifier repository revision | `e4b0860945d13798e0ebcb101a39da06c4dbeb6e` | authorized evidence binding |
| Evidence started | `2026-09-24 15:29:31.54206+00` | PostgreSQL source transcript |
| Evidence completed | `2026-09-24 15:29:47.294036+00` | PostgreSQL source transcript |
| Verifier result | `PASS / DO` | PostgreSQL source transcript |

## 3. Source integrity

| 항목 | 값 |
|---|---|
| Transcript | `docs/evidence/REL002_PRODUCTION_IDENTITY_SCHEMA_VERIFICATION_TRANSCRIPT.txt` |
| Transcript sidecar | `docs/evidence/REL002_PRODUCTION_IDENTITY_SCHEMA_VERIFICATION_TRANSCRIPT.txt.sha256` |
| Transcript SHA-256 | `da82364df59c140847b2a299cc0cd852626079484e7fb3f594b155cdcec2321b` |

Transcript와 sidecar의 SHA-256 일치를 확인했다. Transcript는 verifier artifact identity, PostgreSQL 시작·완료 시각, database, executing role, backend PID, TLS 상태와 `DO` 결과를 같은 retained source에 보존한다. Credential 또는 secret value는 포함하지 않는다.

## 4. Complete schema-verification 의미

`001_identity_persistence_v1.verify.sql`의 성공적인 `DO` 결과는 실행 시점의 `app_identity` schema에 대해 다음 exact verification 단계가 오류 없이 완료됐음을 의미한다.

- table inventory
- column type/nullability/default contract
- primary, unique and foreign-key constraints
- approved CHECK constraints
- index definitions
- function definitions
- trigger definitions
- Identity schema contract rows

이 record는 transcript에 보존된 실행 결과를 증거화하며 verifier 의미를 새로 확장하거나 약화하지 않는다.

Canonical reference:

`ai_mls.schema_verification_evidence_ref = REL002-EVIDENCE-SCHEMA-VERIFY-001`

## 5. 시간 provenance 분리

- Schema verification interval: `2026-09-24 15:29:31.54206+00` through `2026-09-24 15:29:47.294036+00`.
- Historical migration `applied_at`: `UNKNOWN`.
- Schema verification timestamp는 historical migration execution timestamp와 같다고 해석하지 않는다.
- 이 record는 native migration ledger row 또는 historical `applied_at`을 생성하지 않는다.

## 6. 명시적 범위 제한

- Backup/restore evidence는 이 record의 범위가 아니며 별도 `REL002-EVIDENCE-BACKUP-RESTORE-001`이 필요하다.
- 이 record만으로 DEC-193 Production execution readiness를 충족하지 않는다.
- Production schema amendment, attestation insertion, runtime grants 또는 deployment를 증명하지 않는다.

## 7. 안전 상태

이 evidence record 작성 과정의 Production mutation, `006`, `007`, `008`, `005`, `002`, `004` 실행 및 deployment는 모두 `0`이다.
