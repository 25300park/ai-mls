# REL-002 Phase 2D-0K Controlled Execution Runbook

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-355 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |
| 기준 Main | `43fb874d944e3a71ab5e9265e1c811ac0241bd5e` |

## 사전 조건

- Supabase project `ai-mls-production`, region Singapore, database `postgres`, schema `app_identity`의 exact physical binding
- named operator authorization
- exact-target backup evidence와 restore verification evidence
- migration checksum 및 승인된 maintenance window
- password binding을 위한 TLS 검증 `psql` channel

현재 위 operational evidence가 모두 제공되지 않았으므로 실행 gate는 `BLOCKED`이다.

## 실행 순서

1. project/operator/backup/restore evidence를 재검증한다.
2. DB owner가 `000_production_role_creation.sql`을 실행한 뒤 [binding procedure](REL002_PHASE2D0K_ROLE_CREATION_PASSWORD_BINDING_PROCEDURE.md)로 서로 다른 인증 재료를 결합한다.
3. DB owner가 `003_migration_operator_role_grants.sql`을 실행한다.
4. `003a_pre_migration_role_privilege_verification.sql`로 schema-free role/database precondition의 모든 `matches_expected`가 true인지 확인한다.
5. migration operator로 `001_identity_persistence_v1.up.sql`을 실행한다.
6. `001_identity_persistence_v1.verify.sql`로 schema를 검증한다.
7. controlled executor가 실제 operator/backup/applied-at evidence를 같은 session의 `ai_mls.operator_evidence_ref`, `ai_mls.backup_evidence_ref`, `ai_mls.migration_applied_at` 설정으로 제공한 뒤 `005_record_existing_identity_migration_v1.sql`을 정확히 한 번 실행한다.
8. ledger row와 PostgreSQL schema readiness를 read-only로 재검증한다.
9. DB owner가 `002_runtime_role_grants.sql`을 실행한다.
10. post-migration 전용 `004_production_role_privilege_verification.sql`의 모든 `matches_expected`가 true인지 확인한다.
11. runtime 연결 reference를 Railway Production service-scoped sealed variable에 결합한다.
12. migration 인증 재료를 steady-state runtime에서 제거하고 승인된 절차로 rotate/revoke한다.

각 단계는 앞 단계 evidence가 PASS일 때만 진행한다. 실패 시 transaction 가능 범위는 rollback하고, role/schema의 부분 상태를 기록한 뒤 다음 단계를 실행하지 않는다. Production runtime, listener, worker 및 provider path는 전체 gate PASS 전 시작하지 않는다.

## 아티팩트 사용성

- role creation artifact: Supabase SQL Editor에 unchanged paste 가능(사전 조건 충족 및 role 부재 확인 후).
- password binding: SQL Editor 사용 불가; interactive secure channel 필요.
- pre-migration role verification: `003a`만 사용하며 `app_identity` schema/table에 의존하지 않는다.
- post-migration privilege verification: `004`를 001 migration과 002 runtime grants가 모두 PASS한 뒤에만 사용한다.

Project-specific substitution은 인증 재료와 물리 연결 정보뿐이며 SQL artifact에는 치환 token이 없다.

이미 `001`이 실행된 Production에서는 `001`을 재실행하지 않는다. 고정된 순서는 verifier 수정본 실행 → `005` ledger 기록 → ledger/readiness read-only 검증이다. Fresh environment도 `001` → verifier → `005` 순서를 사용하며, duplicate 또는 conflicting ledger는 repair artifact가 fail closed 한다.
