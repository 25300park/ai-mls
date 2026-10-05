# REL-002 R3-G1B Production Migration Forward Verification Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-405 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture / Security Owner |
| 범위 | Identity 013 / Audit 001 이후, registration grants 018 이전 검증 설계 |
| 기준 commit | c6b1c3fa4931d51884787bf1989d419b9cef552b |
| 실행 승인 | NOT_AUTHORIZED |

## 1. Objective / authority

현재 승인된 Production baseline에 대한 새 forward-only read-only verifier를 설계한다. historical verifier의 bytes/fingerprint/security requirements는 보존하고 DEC-192가 명시적으로 허용하는 platform compatibility를 새 artifact에서 구분한다. 이 문서는 설계이며 실행 또는 security exemption 승인이 아니다.

Authority:

- [DEC-192 compatibility](REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md)
- [기존 role/database/membership verifier](../../modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql)
- [Identity 013](../../modules/identity/migrations/postgresql/production/013_identity_workload_evidence_v1.up.sql) / [historical verifier](../../modules/identity/migrations/postgresql/production/013_identity_workload_evidence_v1.verify.sql)
- [Audit 001](../../modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql) / [historical verifier](../../modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.verify.sql)
- [R3-C2B completion](../reviews/REL002_R3C2B_COMPLETION.md)
- [Backup prerequisites](REL002_PHASE2C_BACKUP_RESTORE_PREREQUISITES.md), [failure policy](REL002_PHASE2C_ROLLBACK_FAILURE_POLICY.md), [execution runbook](REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md)
- [Finalized backup/restore evidence](../evidence/REL002_PRODUCTION_BACKUP_RESTORE_REHEARSAL_EVIDENCE.md), [DEC-194](REL002_PLATFORM_LIMITED_BACKUP_RESTORE_EVIDENCE_CONTRACT.md)

## 2. Backup currentness

BACKUP_CURRENTNESS_MAX_AGE=NOT_DEFINED. Backup prerequisites §4는 exact target, exact migration candidate, approved window에 current해야 하며 임의 TTL을 금지한다. Data/Operations/Security owner가 해당 window의 currentness를 승인하지 않으면 UNKNOWN으로 fail closed한다.

현재 evidence `REL002-EVIDENCE-BACKUP-RESTORE-001`은 backup timestamp `2026-09-24 22:53:36 +00:00`, restore completion `2026-09-25 08:31:29 +00:00`와 approved platform-limited provenance를 보존한다. CURRENT_BACKUP_STATUS=NOT_VERIFIED이며 시간 경과만으로 STALE이라고 판정하지 않는다.

실행 window 적합성 입증에는 exact target/ref/database, 두 artifact SHA와 backup consistency timestamp 연결, backup completeness/integrity/encryption/key availability 및 복구 접근 가능성, backup 이후 schema/data 변경의 보호 여부, restore 결과의 이번 candidate에 대한 적합성, window와 named approver/evidence reference가 필요하다. 새 변경에 보호 공백이 있으면 owner가 추가 backup/restore 필요성을 판단한다. DEC-194의 specific selected backup/rehearsal 제한을 다른 backup으로 자동 확장하지 않는다. Historical evidence를 수정하거나 새 승인/실행 증거를 발명하지 않는다.

## 3. Artifact / immutability boundary

HISTORICAL_VERIFIERS_CHANGED=NO. 013/Audit 001/017/018 SQL 및 historical evidence를 변경하지 않는다. PUBLIC ACL/membership/ownership 변경으로 fixture를 맞추지 않는다.

Namespace 확인 결과 Identity production migration directory에 `019` artifact는 없다. Implemented SQL path:

`modules/identity/migrations/postgresql/production/019_r3g1b_production_recovery.verify.sql`

사용자 구현 승인에 따라 새 SELECT-only verifier와 focused test를 추가했다. 019는 migration이 아닌 read-only 검증 artifact이며 DDL/DML/GRANT/REVOKE/SET/repair/temporary writes/ledger writes를 포함하지 않는다. 두 result row 모두 ready=true일 때만 PASS이다. NULL/누락/unexpected inventory는 fail closed한다. ON_ERROR_STOP만으로 SELECT 결과 false를 실패로 취급하지 않으므로 operator/consumer가 두 row의 모든 필수 boolean을 검사해야 한다.

## 4. Exact root contract

두 expected rows가 각각 정확히 한 개 존재해야 한다:

- app_identity.identity_workload_evidence
- app_audit.audit_evidence_read_records

historical fingerprint의 모든 입력을 보존한다: schema/table owner 및 ACL, relation kind/RLS/options/comment, columns/types/nullability/default/collation, validated/immediate constraints, indexes, triggers, immutable function source/security/search_path/ACL, column ACL, runtime effective schema/table/column privilege, Audit inventory. Expected fingerprints:

- Identity: `88222856a373735336da52e4cae9f2c8`
- Audit: `5cb4da03f37cfb0623fd3ef5262ca474`

DEC-192 database ACL/membership은 root fingerprint 입력 밖이다. 따라서 해당 compatibility를 별도로 검사해도 root expectation을 바꾸지 않는다. root fingerprint mismatch는 FAIL-CLOSED이다. PostgreSQL catalog 표현 차이, 후속 Audit migration 또는 018 ACL 적용을 자동 허용하지 않는다. 새 equivalent structural contract가 필요하면 별도 AO review를 거쳐야 하며 이 설계에서 임의 normalization은 승인하지 않는다.

두 schema/table/function owner는 canonical migration operator여야 한다. runtime은 object owner/schema CREATE/DDL/grant option을 가져서는 안 된다. 두 root 외의 object ownership도 runtime-owned catalog inventory 위반으로 보고한다. database/schema/relation/routine/type ownership을 검사하며 catalog visibility 부족은 PASS가 아니다. PUBLIC leakage와 예상하지 않은 privilege는 exact root contract에 따라 실패한다.

## 5. Role/database compatibility contract

runtime/migration 두 role은 LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT을 유지한다. Runtime direct database ACL은 CONNECT만, migration operator는 CONNECT/CREATE만 허용한다. direct grant option, direct TEMPORARY 및 unexpected direct ACL은 실패한다. runtime effective CREATE도 실패한다.

PUBLIC-inherited effective TEMPORARY는 DEC-192 범위에서만 수용한다. pg_database.datacl/acldefault를 aclexplode하여 direct grant와 PUBLIC grant를 분리하고 has_database_privilege의 관찰값과 비교한다. effective TEMPORARY가 true인 경우 PUBLIC에 해당 privilege가 존재하고 target-role direct grant가 없으며 membership에 우회 authority가 없어야 한다. 이 예외는 다른 schema/table ACL 또는 CREATE/GRANT/DDL 예외가 아니다. temporary objects를 생성하여 검사하지 않는다.

Membership는 pg_auth_members의 granted role/member/grantor/admin/inherit/set 값을 방향까지 검사한다. 기존 004가 명시한 exact expected topology는 다음 두 row이다:

| granted_role | member_role | grantor_role | admin_option | inherit_option | set_option |
|---|---|---|---|---|---|
| ai_mls_production_migration_operator | postgres | supabase_admin | true | false | false |
| ai_mls_production_runtime | postgres | supabase_admin | true | false | false |

target role이 다른 role의 member인 반대 방향은 허용하지 않는다. 이 exact tuple 밖의 member/grantor/option, 추가 row, 누락 row는 FAIL-CLOSED이다. 관리형 postgres라는 이름만으로 broad allowlist를 만들지 않는다. catalog version이 inherit/set 값을 제공하지 않거나 실제 topology가 다르면 STOP하여 별도 검토한다. Production을 이 표에 맞춰 변경하지 않는다.

DIRECT_RUNTIME_TEMPORARY_GRANT=ABSENT, PUBLIC_INHERITED_TEMPORARY=DEC192_ACCEPTED_ONLY, UNEXPECTED_ROLE_MEMBERSHIP=ABSENT, RUNTIME_ROLE_OBJECT_OWNERSHIP=ABSENT는 미래 verifier의 필수 acceptance 조건이다. 현재 Production 관찰 결과로 주장하지 않는다.

## 6. Intermediate structural probe review

앞선 in-chat SELECT-only probe는 target table existence/owner, exact 7 columns/types/nullability를 boolean으로 비교하고 constraint/index definitions 및 validity를 반환한다. 이 결과 전체를 아래 checklist와 대조하는 operator review와 결합하면 INTERMEDIATE_PROBE_VALID=YES이다. 단독 scalar 자동 PASS verifier는 아니다.

- table relkind=r, owner=migration operator
- ordinal column order: identity_evidence_ref text, registration_id text, registration_version bigint, tenant_id text, principal_id text, schema_version integer, immutable boolean; 모두 NOT NULL
- PK(identity_evidence_ref), registration_version BETWEEN 1 AND 9007199254740991, schema_version=1, immutable=true 의미의 CHECK
- PK/CHECK validated=true, deferrable=false, deferred=false
- identity_workload_evidence_pkey의 btree unique PK(identity_evidence_ref); primary/unique/valid/ready/live=true
- 다른 semantic constraints/indexes 없음; PostgreSQL catalog NOT NULL constraint는 정확한 column nullability를 중복 표시하는 것인지 구분하며 unknown 표현은 STOP

NULL/누락/추가 columns/invalid index/강화 또는 약화된 CHECK는 실패한다. PK index와 constraint definition을 반환만 했다는 이유로 자동 PASS하지 않는다. table 존재/owner/columns만 통과하고 constraint/index review가 없으면 PASS가 아니다. historical root fingerprint는 이 intermediate 단계에서 사용하지 않는다.

## 7. Exact future execution sequence

PRE: exact target/TLS probe -> migration operator session identity -> frozen artifact checksums -> object absence 및 partial-state/ownership prerequisites -> backup currentness 승인 -> DEC-194 restore evidence 적합성 -> failure procedure/window -> explicit execution approval. 미래 verifier의 disposable tests와 AO review도 선행해야 한다.

APPLY: (1) Identity 013 -> (2) intermediate structural probe와 exact review -> (3) Audit 001. 각 artifact는 자체 BEGIN/COMMIT이며 별도 commit이다. credentials 없는 이미 인증된 psql 세션, ON_ERROR_STOP, exact artifact path, no auto-retry를 사용한다.

POST: (4) 새 forward-compatible read-only verifier -> (5) exact five-object ownership probe -> (6) registration role attribute probe -> (7) 모두 PASS인 경우에만 018의 별도 AO 승인 검토 후보가 된다. 018은 자동 실행하지 않는다.

Registration role probe는 017의 실제 role contract에 따라 ai_mls_production_registration_operator의 LOGIN 및 prohibited attributes 부재를 확인한다. role missing/속성 불일치/조회 실패는 STOP이다. role을 생성·보수하지 않는다. 이 probe는 018 ACL verifier를 대체하지 않는다.

Before-commit failure는 해당 열린 transaction rollback 및 read-only 상태 확인, ambiguous COMMIT은 STOP/read-only classification/no replay, successful COMMIT은 verifier PASS 후 진행한다. Audit 실패나 post-verifier 실패가 이미 committed Identity 013을 rollback하지 않는다. 별도 승인 forward recovery 외의 destructive repair는 금지한다.

## 8. Proposed focused verification / gate status

향후 disposable tests는 approved 013/001과 frozen fingerprints를 사용한다. accepted PUBLIC TEMPORARY + exact managed topology PASS; direct runtime TEMPORARY FAIL; target-role reverse membership FAIL; wrong grantor/admin/inherit/set/additional row FAIL; wrong owner/runtime ownership/ACL/grant option FAIL; missing root/altered column/CHECK/index/function FAIL; Identity-only intermediate review PASS/final FAIL를 확인한다. catalog fingerprint mismatch는 자동 refresh하지 않는다.

FORWARD_VERIFIER_TESTS=PASS — 전용 disposable PostgreSQL 18의 focused 20/20 PASS (정상 및 거부 사례 포함). VERIFIER_GATE=PASS — LOCAL/DISPOSABLE ONLY. 정상 query는 migration-operator READ ONLY transaction에서 실행했다. Backup currentness 승인 부재로 BACKUP_GATE=BLOCKED. PRODUCTION_EXECUTION_SEQUENCE_READY=NO: 순서는 설계되었으나 실행 준비 완료가 아니다.

## 9. Validation / limitations / next prerequisite

검증은 focused/disposable positive 및 negative fixtures, affected 23/23 PASS, build/typecheck/lint와 full regression, link/read-only/immutability/secret scan을 포함한다. 기존 packet/역사 reports/primary checkout은 보존한다. 다음 prerequisite는 current-window backup 승인과 별도 execution approval이다. 어떤 단계도 자동 시작하지 않는다.

EXECUTION_AUTHORIZED=NO; SAFE_TO_EXECUTE=NO; SAFE_TO_RETRY_018=NO; PRODUCTION_MUTATION=NONE; COMMIT=NOT_CREATED; PUSH=NOT_PERFORMED.

## 10. Disposable fixture 한계

전용 loopback port 55444에 새 cluster를 만들었다. 013/Audit 001은 disposable에만 적용했고 018은 적용하지 않았다. 일반 로컬 superuser가 만드는 membership grantor는 managed Supabase와 다르므로, disposable test bootstrap만 pg_auth_members의 grantor를 supabase_admin으로 고정하여 승인된 exact topology를 emulation했다. 이것은 provider 실행 검증이 아니며 Production catalog 변경 절차로 사용할 수 없다. 부정 fixture 변경은 transaction rollback 후 정상 baseline 재검증한다. Historical root fingerprints는 새 verifier에 그대로 유지되며 PostgreSQL 18 canonical fixture에서 둘 다 일치했다.

## 11. 최종 로컬 검증 결과

Focused/disposable: 20 PASS / 0 FAIL / 0 SKIP. Affected: 23 PASS. Full regression: 1887 PASS / 1 authorized immutable historical fingerprint mismatch / 22 SKIP. Build / lint / typecheck: PASS. Historical fingerprint test 및 승인된 migrations/verifiers: UNCHANGED. Secret scan 및 whitespace/link 확인: PASS. Full regression의 historical mismatch는 이전에 승인된 immutable historical-candidate mismatch로 유지하며 수정하지 않는다. Production readiness: NOT_VERIFIED. Backup gate: BLOCKED. Verifier gate: PASS — LOCAL/DISPOSABLE ONLY.
