# REL-002 R3-G1B Current Global State Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | REL002-R3G1B-CURRENT-GLOBAL-STATE-001 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 분류 | RESTRICTED / secret-free documentation |
| Provenance | Human-confirmed catalog results; Codex independent Production probe 없음 |
| 범위 | pre-013/Audit001 backup binding / isolated role handling design |

## 1. Exact backup binding

CANDIDATE_HEAD=976a1de1b4dbbd6fe8958fec9239a8178aae0990
PROPOSED_WINDOW=REL002-R3G1B-013-AUDIT001-976a1de1b4db-PROPOSED-01
BACKUP_FILE=ai-mls-production-pre013-audit001-20261005-223349.dump
BACKUP_SIZE_BYTES=391501
BACKUP_SHA256=CD16C5E5E61A65551DE7E497A1B2D3E3621F3C65A547A895BB7DC98E6BDE587F
SOURCE_DATABASE=postgres
SOURCE_SERVER=17.6
PG_DUMP=18.4
FORMAT=CUSTOM
SOURCE_PROJECT=ai-mls-production
SOURCE_PROJECT_REF=mfonujjeokvpsfucfxuq

[Backup evidence](REL002_R3G1B_CURRENT_LOGICAL_BACKUP_EVIDENCE.md)의 exact candidate/artifact tuple에 연결한다. 이전 문서의 GLOBAL_STATE_EVIDENCE_BOUND=NO는 당시 제공 사실이며, 이 문서로 Human-reported selected global state를 추가 연결한다. 기존 문서는 변경하지 않는다. BACKUP_SHA_BINDING=PASS는 제공된 SHA의 exact 문서 연결이며 archive bytes의 독립 검증이 아니다.

GLOBAL_STATE_EVIDENCE_BOUND=YES — 아래 selected Human observations에 한정한다. catalog capture timestamp, named operator, original protected result artifact/hash 및 backup snapshot과의 동시성은 NOT_VERIFIED이다. 전체 provider role/object/default ACL inventory 또는 pre/post drift 부재 증명이 아니다. Backup operator/TLS/CA의 미결 증명도 그대로 유지한다.

## 2. Human-confirmed role attributes

| Role | LOGIN | SUPERUSER | CREATEDB | CREATEROLE | INHERIT | REPLICATION | BYPASSRLS | CONNECTION LIMIT | ROLE CONFIGURATION |
|---|---|---|---|---|---|---|---|---|---|
| ai_mls_production_runtime | true | false | false | false | false | false | false | -1 | absent |
| ai_mls_production_migration_operator | true | false | false | false | false | false | false | -1 | absent |
| ai_mls_production_registration_operator | true | false | false | false | false | false | false | -1 | absent |

ROLE_ATTRIBUTES_BOUND=PASS. password, password hash, raw role configuration 값은 수집하거나 기록하지 않았다.

## 3. Human-confirmed membership topology

| granted_role (pg_auth_members.roleid) | member_role (pg_auth_members.member) | grantor_role | admin_option | inherit_option | set_option |
|---|---|---|---|---|---|
| ai_mls_production_migration_operator | postgres | supabase_admin | true | false | false |
| ai_mls_production_registration_operator | postgres | supabase_admin | true | false | false |
| ai_mls_production_runtime | postgres | supabase_admin | true | false | false |

방향: 각 application role이 granted role이고 postgres가 그 role의 member이다. 반대 방향으로 해석하지 않는다. MEMBERSHIP_TOPOLOGY_BOUND=PASS는 Human 결과의 정확한 기록을 의미하며 canonical allowlist 통과를 의미하지 않는다.

## 4. Human-confirmed database ACL

| Role | effective CONNECT | effective CREATE | effective TEMPORARY | direct database grant |
|---|---|---|---|---|
| ai_mls_production_runtime | true | false | true | CONNECT only |
| ai_mls_production_registration_operator | true | false | true | CONNECT only |
| ai_mls_production_migration_operator | true | true | true | CONNECT + CREATE |

PUBLIC direct database ACL: CONNECT, TEMPORARY. runtime 및 registration의 effective TEMPORARY source는 PUBLIC_INHERITED이다. direct runtime TEMPORARY=ABSENT이며 registration도 direct CONNECT only이다. DATABASE_ACL_BOUND=PASS. grant-option 정보, database owner 및 전체 다른 grantee inventory는 이번 제공 사실로 확정하지 않는다.

## 5. DEC-192 / committed verifier compatibility

[DEC-192 compatibility contract](../implementation/REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md)의 PUBLIC effective TEMPORARY와 direct TEMPORARY 구분은 PASS이다. 다만 unexpected target-role membership 부재 역시 필수이다.

[019 forward verifier](../../modules/identity/migrations/postgresql/production/019_r3g1b_production_recovery.verify.sql)의 expected_memberships는 migration/runtime 두 행만 정의하며 membership_check는 count=2와 양방향 EXCEPT equality를 요구한다. 새 registration granted-role/member-postgres 행은 이 allowlist에 없다. 제공된 세 행이 실제 verifier 실행 시 유지되면 membership_ok=false이며 최종 ready도 false가 된다. 이는 Production에서 019를 실행한 결과가 아닌 repository predicate에 대한 분석이다.

DEC192_PUBLIC_TEMPORARY_ALIGNMENT=PASS
COMMITTED_019_MEMBERSHIP_ALIGNMENT=FAIL
DEC192_ALIGNMENT=FAIL — 전체 compatibility gate 기준

추가 행은 Human-confirmed current state로 보존한다. 임의 삭제, reverse interpretation, verifier allowlist 확대, credential/ACL 변경으로 맞추지 않는다. 이 차이의 canonical 승인/forward verifier 처리에는 별도 AO 결정이 필요하다. 018은 여전히 금지한다.

## 6. Safest isolated role handling

[Logical backup plan](../implementation/REL002_R3G1B_CURRENT_LOGICAL_BACKUP_EXECUTION_PLAN.md)의 network-isolated disposable PostgreSQL 후보를 유지한다. Production credential은 필요하지 않다. pg_dump는 global roles/memberships를 복원하지 않는다. DATABASE_DUMP_RESTORED_STATE와 GLOBAL_ROLE_STATE_EVIDENCE를 분리한다.

[pg_restore official contract](https://www.postgresql.org/docs/18/app-pgrestore.html)에 따라 default restore는 owner 설정을 실행하며 --create는 database-level ACL/settings도 포함한다. referenced role이 없거나 restore executor 권한이 부족하면 실패할 수 있다. --no-owner/--no-acl로 우회하지 않는다.

ISOLATED_PLACEHOLDER_ROLES_REQUIRED=YES. 승인 후 complete protected owner/grantee/grantor inventory를 확인하고 exact role names를 isolated cluster에만 NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, password 없는 placeholder로 준비하는 방안을 권고한다. config 및 Production memberships는 자동 복사하지 않는다. 다음 목록은 검사 후보이며 complete TOC inventory로 확정된 목록이 아니다.

| Referenced owner candidate | Safe isolated handling |
|---|---|
| ai_mls_production_migration_operator | exact-name NOLOGIN placeholder |
| ai_mls_production_runtime | ACL reference용 exact-name NOLOGIN placeholder |
| ai_mls_production_registration_operator | ACL reference용 exact-name NOLOGIN placeholder |
| supabase_auth_admin | 실제 archive reference 확인 후 exact-name NOLOGIN placeholder |
| supabase_storage_admin | 실제 archive reference 확인 후 exact-name NOLOGIN placeholder |
| supabase_realtime_admin | 실제 archive reference 확인 후 exact-name NOLOGIN placeholder |
| supabase_admin | owner/grantor reference 확인 후 exact-name NOLOGIN placeholder |
| postgres | isolated cluster의 기존 bootstrap role 확인; Production password/identity 재사용 금지 |

기존 role을 무조건 CREATE/ALTER하지 않는다. 충돌하는 role이나 provider-required attributes/functions가 있으면 STOP한다. restore executor는 별도 isolated-only admin이며 Production credential을 사용하지 않는다. superuser 필요 여부 및 extension compatibility를 target 승인에서 확정한다. placeholder owner에 superuser 권한을 부여하지 않는다.

NOLOGIN placeholders는 source의 LOGIN=true와 다르므로 Production role-attribute equivalence PASS라고 주장하지 않는다. source LOGIN/connection attributes/membership/admin flags는 이 evidence로 평가하고 restored object owner/ACL names는 local catalogs로 검증한다. credential-bearing topology를 실제로 복제하지 않는다. functional authorization test가 별도 LOGIN fixture를 필요로 하면 별도 승인을 받는다.

018 grants, 011, 017을 restore 준비에 replay하지 않는다. cron/net/external side effects 차단, full extensions/provider schema compatibility, exact target identity, archive checksum, source owner/ACL inventory가 모두 확정되어야 한다. 이번에는 role/target 생성, backup inspection, restore를 실행하지 않는다.

## 7. Readiness / validation / remaining gates

RESTORE_TARGET_READY_FOR_CREATION=NO. target compatibility, owner/grantee inventory, network isolation implementation 및 creation 승인이 아직 확정되지 않았다. global observations 연결은 진전이지만 snapshot/currentness 증명 및 membership discrepancy 해결을 대체하지 않는다.

PRODUCTION_CREDENTIALS_REQUIRED_FOR_RESTORE=NO
GLOBAL_STATE_RECONSTRUCTION_REQUIRED=YES — isolated owner/ACL prerequisites만; complete live Production topology 복제 아님
RESTORE_TEST_AUTHORIZED=NO
BACKUP_GATE=BACKUP_CREATED_PENDING_ISOLATED_RESTORE
EXECUTION_AUTHORIZED=NO
SAFE_TO_RETRY_018=NO
SOURCE_CHANGED=NO — 새 documentation only
PRODUCTION_MUTATION=NONE
COMMIT=NOT_CREATED
PUSH=NOT_PERFORMED

Validation: exact Human role/member/ACL tuple 및 backup binding, relative links, whitespace, secret-literal scan, unchanged tracked files 확인. runtime source/migrations/verifiers/historical reports는 변경하지 않는다.
