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
4. migration operator로 `001_identity_persistence_v1.up.sql`을 실행한다.
5. `001_identity_persistence_v1.verify.sql`로 schema를 검증한다.
6. DB owner가 `002_runtime_role_grants.sql`을 실행한다.
7. `004_production_role_privilege_verification.sql`의 모든 `matches_expected`가 true인지 확인한다.
8. runtime 연결 reference를 Railway Production service-scoped sealed variable에 결합한다.
9. migration 인증 재료를 steady-state runtime에서 제거하고 승인된 절차로 rotate/revoke한다.

각 단계는 앞 단계 evidence가 PASS일 때만 진행한다. 실패 시 transaction 가능 범위는 rollback하고, role/schema의 부분 상태를 기록한 뒤 다음 단계를 실행하지 않는다. Production runtime, listener, worker 및 provider path는 전체 gate PASS 전 시작하지 않는다.

## 아티팩트 사용성

- role creation artifact: Supabase SQL Editor에 unchanged paste 가능(사전 조건 충족 및 role 부재 확인 후).
- password binding: SQL Editor 사용 불가; interactive secure channel 필요.
- migration/grant/verification artifacts: exact project binding과 승인된 execution identity 아래에서 unchanged 사용 가능.

Project-specific substitution은 인증 재료와 물리 연결 정보뿐이며 SQL artifact에는 치환 token이 없다.
