# REL-002 R3-G1B Registration Operator Managed Membership Compatibility

| 항목 | 값 |
|---|---|
| Document ID | REL002-R3G1B-REGISTRATION-MEMBERSHIP-COMPATIBILITY |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| Authority | APPROVE_REL002_REGISTRATION_OPERATOR_MANAGED_MEMBERSHIP_COMPATIBILITY |
| Owner | Architecture / Security Owner |
| Candidate | 976a1de1b4dbbd6fe8958fec9239a8178aae0990 |

## 1. Forward-only exact AO decision

Human-confirmed Production state는 [current global evidence](../evidence/REL002_R3G1B_CURRENT_GLOBAL_STATE_EVIDENCE.md)에 기록된 세 managed membership 행이다. [017](../../modules/identity/migrations/postgresql/production/017_registration_operator_role.sql)은 CREATE ROLE 및 database CONNECT를 실행하며 membership GRANT는 명시적으로 실행하지 않는다. managed platform에서 관찰된 추가 registration tuple의 존재는 인정하되 생성 내부 메커니즘을 저장소만으로 확정하지 않는다.

AO는 기존 managed creator-member pattern과 같은 다음 exact tuple만 승인했다. granted_role은 pg_auth_members.roleid, member_role은 pg_auth_members.member이다. registration role이 postgres의 member인 반대 방향으로 해석하지 않는다.

| granted_role | member_role | grantor_role | admin_option | inherit_option | set_option |
|---|---|---|---|---|---|
| ai_mls_production_migration_operator | postgres | supabase_admin | true | false | false |
| ai_mls_production_runtime | postgres | supabase_admin | true | false | false |
| ai_mls_production_registration_operator | postgres | supabase_admin | true | false | false |

이 승인은 arbitrary membership, grantor 변경, reverse direction, admin=false, inherit=true, set=true, 추가/누락 행 또는 privilege 확대를 허용하지 않는다. [DEC-192](REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md)의 PUBLIC effective TEMPORARY와 direct TEMPORARY 구분은 그대로 유지한다. 유효한 Production membership을 019 통과 목적으로 제거하지 않는다.

## 2. Superseding 020 contract

[020 verifier](../../modules/identity/migrations/postgresql/production/020_r3g1b_registration_membership_compatibility.verify.sql)는 final post-Identity013/Audit001, PRE-018 경로에서 [019](../../modules/identity/migrations/postgresql/production/019_r3g1b_production_recovery.verify.sql)를 supersede한다. 019와 historical verifiers는 immutable로 보존한다. migration 또는 ACL 실행 artifact가 아닌 SELECT-only verifier다.

020은 target role이 granted 또는 member인 모든 행을 수집하여 정확한 세 행 count 및 양방향 EXCEPT equality를 요구한다. 다른 owner/structure/role/ACL 검사는 019와 동일하다. Identity fingerprint=88222856a373735336da52e4cae9f2c8, Audit fingerprint=5cb4da03f37cfb0623fd3ef5262ca474를 유지한다. schema/table/function/type/database의 runtime/registration ownership 금지, direct runtime TEMPORARY 금지, role separation 및 grant-option boundary를 보존한다.

PASS는 두 canonical result row 모두 ready=true인 경우만이다. missing structure, query failure 또는 false row는 FAIL-CLOSED이다. 세 행 topology에서 immutable 019의 membership_ok/ready=false는 예상 결과이다.

## 3. Disposable fixture / verification

[Forward verifier tests](../../modules/identity/src/production-recovery-verifier.test.ts)는 loopback exclusive port 55444의 새 disposable cluster만 사용한다. Production endpoint/credentials는 사용하지 않는다. approved Identity013/Audit001을 적용하고 registration role과 exact 세 행을 구성한다. 018은 적용하지 않는다.

Managed grantor metadata와 grantor가 다른 행의 삭제/reverse 부정 fixture는 disposable-only pg_auth_members emulation이며 transaction rollback으로 복구한다. 이를 Production catalog 변경 절차로 사용하지 않는다. wrong grantor/admin/inherit/set, missing/reversed registration, fourth membership, migration/runtime drift와 기존 structural/privilege 부정 사례를 보존한다.

## 4. Packet / restore impact

[Controlled execution packet](REL002_R3G1B_PRODUCTION_MISSING_MIGRATION_CONTROLLED_EXECUTION_PACKET.md)의 final verifier reference는 019 -> 020으로 후속 bounded 변경이 필요하다. 이번에는 packet을 변경하지 않는다. 현재 packet을 그대로 실행 가능한 것으로 취급하지 않는다.

RESTORE_TARGET_CREATION_BLOCKED_BY_MEMBERSHIP_DECISION=NO
RESTORE_FINAL_VALIDATION_REQUIRES_020=YES — final post-migration acceptance에 한정

pre-013/Audit001 backup restore는 post-migration 020으로 판정하지 않는다. restored baseline의 구조/ownership/ACL/global evidence는 별도 read-only 검증한다. placeholder NOLOGIN role fixture를 Production LOGIN attributes와 동등하다고 주장하지 않는다. target/extension/isolation/backup currentness 및 별도 restore 승인이 필요하다.

## 5. Scope / next gate

Production SQL, restore, migrations, 018 retry 및 push는 승인되지 않았다. historical BLOCK reports/current global evidence는 당시 사실로 보존한다. 이번 승인 이후의 tuple compatibility는 이 forward contract가 설명한다. candidate HEAD는 commit 없이 유지한다.

EXECUTION_PACKET_UPDATE_REQUIRED=YES
EXECUTION_AUTHORIZED=NO
SAFE_TO_RETRY_018=NO
PRODUCTION_MUTATION=NONE
COMMIT=NOT_CREATED
PUSH=NOT_PERFORMED
