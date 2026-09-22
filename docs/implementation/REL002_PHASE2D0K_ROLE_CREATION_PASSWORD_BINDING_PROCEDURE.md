# REL-002 Phase 2D-0K Role Creation / Password Binding Procedure

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-354 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |
| 기준 Main | `43fb874d944e3a71ab5e9265e1c811ac0241bd5e` |

## 목적과 경계

Supabase Production PostgreSQL의 두 canonical role을 안전하게 생성하고 인증 재료를 별도 채널에서 결합하는 절차를 정의한다. 이 문서는 실행 승인이나 비밀값을 포함하지 않는다.

## 역할 생성

[role creation artifact](../../modules/identity/migrations/postgresql/production/000_production_role_creation.sql)는 정확히 다음 두 role만 생성한다.

- `ai_mls_production_runtime`
- `ai_mls_production_migration_operator`

두 role은 모두 `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`이며 role membership, object ownership, default privilege 또는 인증 재료를 부여하지 않는다. 이미 존재하는 role에서는 명시적으로 실패하여 operator가 기존 상태를 검토하게 한다.

## 비밀 결합

1. 승인된 named operator가 TLS 검증된 `psql` 세션으로 정확한 Supabase Production project에 연결한다.
2. `\password ai_mls_production_runtime`과 `\password ai_mls_production_migration_operator`를 각각 실행한다.
3. 승인된 generator/password manager가 만든 서로 다른 무작위 값을 interactive prompt에만 입력한다.
4. 값을 command argument, SQL 파일, shell history, 문서, 로그 또는 repository에 기록하지 않는다.
5. runtime 연결 문자열은 결합 후 `railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V1`에만 저장한다. CA는 별도 `railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V1`를 사용한다.
6. migration 인증 재료는 controlled window에서만 operator가 보유하며 Railway steady-state runtime에 제공하지 않는다. 완료 후 승인된 rotation/revocation 절차로 제거한다.

Supabase SQL Editor는 role 생성, grant, read-only verification에 조건부 사용 가능하다. 인증 재료 결합에는 query history/plaintext 노출 위험 때문에 사용하지 않는다.

## Fail-closed 조건

target binding, operator authorization, exact-target backup, restore verification 또는 secure interactive channel 중 하나라도 검증되지 않으면 중단한다. `DATABASE_URL` fallback, 동일 값 재사용, Vercel/browser/PR/shared environment 전파는 금지한다.
