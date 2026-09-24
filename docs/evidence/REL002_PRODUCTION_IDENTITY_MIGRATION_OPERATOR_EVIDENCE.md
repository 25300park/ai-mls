# REL-002 Production Identity Migration Operator Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | `REL002-EVIDENCE-OPERATOR-001` |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| Evidence state | FINALIZED |
| 소유 역할 | Database Owner / Security Owner |
| 적용 결정 | DEC-185, DEC-193 |
| 대상 환경 | PRODUCTION |
| 생성 기준일 | 2026-09-25 |
| 변경 정책 | 승인 후 immutable; 정정은 새 evidence record로만 허용 |

## 1. 목적

이 record는 DEC-193 historical migration attestation 실행에 사용할 현재 Production migration operator와 current exact schema verification session의 직접 증거를 보존한다. Historical migration의 원래 실행 시각이나 원래 operator session을 복원하지 않는다.

## 2. 대상 binding

| 항목 | 값 | 근거 |
|---|---|---|
| Supabase project | `ai-mls-production` | `docs/implementation/REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md` |
| Project ref | `mfonujjeokvpsfucfxuq` | `docs/implementation/REL002_PHASE2D0D_RAILWAY_SUPABASE_BINDING_CONTRACT.md` |
| Database | `postgres` | source transcript |
| Current database role | `ai_mls_production_migration_operator` | source transcript |
| Approved migration-role contract | bounded controlled DDL/migration execution only | DEC-185 |

## 3. 직접 관찰된 사실

Source transcript가 다음 값을 직접 보존한다.

| 항목 | 관찰값 |
|---|---|
| Evidence started | `2026-09-24 15:29:31.54206+00` |
| Database | `postgres` |
| Database user | `ai_mls_production_migration_operator` |
| Backend PID | `266163` |
| TLS enabled | `true` |
| TLS version | `TLSv1.3` |
| TLS cipher | `TLS_AES_256_GCM_SHA384` |
| TLS bits | `256` |
| Verifier artifact | `modules/identity/migrations/postgresql/production/001_identity_persistence_v1.verify.sql` |
| Verifier result | `PASS / DO` |
| Evidence completed | `2026-09-24 15:29:47.294036+00` |

## 4. Source integrity

| 항목 | 값 |
|---|---|
| Transcript | `docs/evidence/REL002_PRODUCTION_IDENTITY_SCHEMA_VERIFICATION_TRANSCRIPT.txt` |
| Transcript sidecar | `docs/evidence/REL002_PRODUCTION_IDENTITY_SCHEMA_VERIFICATION_TRANSCRIPT.txt.sha256` |
| Transcript SHA-256 | `da82364df59c140847b2a299cc0cd852626079484e7fb3f594b155cdcec2321b` |
| Repository revision bound to verifier evidence | `e4b0860945d13798e0ebcb101a39da06c4dbeb6e` |

Transcript와 sidecar의 byte-level SHA-256 일치를 확인했다. Transcript에는 password, API key, credential value 또는 connection secret이 포함되지 않는다.

## 5. 허용된 결론

- 위 evidence window에서 `ai_mls_production_migration_operator`가 TLS-enabled PostgreSQL connection을 사용했다.
- 해당 session은 지정된 complete Production Identity schema verifier를 실행했고 PostgreSQL 결과는 `DO`였다.
- 이 record는 DEC-193 reconstruction operation의 `operator_evidence_ref`로 사용할 수 있다.

Canonical reference:

`ai_mls.operator_evidence_ref = REL002-EVIDENCE-OPERATOR-001`

## 6. 명시적 비주장

- Historical migration의 원래 `applied_at`은 `UNKNOWN`이다.
- 이 transcript의 시작·완료 시각은 schema verification 시각이며 historical migration 실행 시각이 아니다.
- 이 transcript는 원래 historical migration operator session의 시각이나 identity를 증명하지 않는다.
- 이 record는 native `identity_schema_migrations` ledger execution evidence가 아니다.
- Production schema mutation, attestation insertion 또는 runtime grant 실행을 증명하지 않는다.

## 7. 안전 상태

이 evidence record 작성 과정의 Production mutation, `006`, `007`, `008`, `005`, `002`, `004` 실행 및 deployment는 모두 `0`이다.
