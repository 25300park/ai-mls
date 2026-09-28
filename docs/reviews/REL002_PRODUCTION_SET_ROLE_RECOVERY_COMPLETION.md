# REL-002 Production SET ROLE Recovery Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-248 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Development / Security Owner |
| 완료일 | 2026-09-29 |
| Brief | REL-002 Production SET-ROLE Recovery Grantor Evidence Resolved |
| 기준 HEAD | `1ead49e76b84b87e49d15a2f64e9d0eb4da5a3af` |

## 1. Objective

Production의 원 membership provenance가 `supabase_admin`임을 보존하면서 DB owner `postgres`가 단일 transaction 안에서만 임시 `SET` authority를 획득하도록 bounded recovery를 구현한다. Historical `002`와 `009`는 변경하거나 재실행하지 않으며 Production SQL은 실행하지 않는다.

## 2. Documents read

- 현재 REL-002 Production SET-ROLE Recovery Grantor Evidence Resolved Brief
- [Partial 002 Recovery Completion](REL002_PARTIAL_002_PRODUCTION_RECOVERY_COMPLETION.md)
- [Phase 2D-0K Controlled Execution Runbook](../implementation/REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md)
- [PostgreSQL PUBLIC TEMPORARY Compatibility Contract](../implementation/REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md)

## 3. Files created

- `modules/identity/migrations/postgresql/production/010_complete_production_runtime_role_boundary_with_bounded_set_authority.sql`: grantor-aware atomic recovery artifact.
- `modules/identity/src/production-role-set-authority-recovery.integration.test.ts`: PostgreSQL 18 exact grantor, success, seven rollback points, second execution 및 final `004` 검증.
- 본 Completion Report.

## 4. Files modified

- `modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql`: exact `supabase_admin` provenance와 membership options, residual recovery membership 부재를 검증하며 non-superuser DB owner에서도 OID 기반으로 실행한다.
- `modules/identity/src/production-role-artifacts.test.ts`: `010` transaction/provenance/cleanup 및 final `004` 계약을 정적으로 검증한다.
- [Master Index](../00_MASTER_INDEX.md): 본 보고서를 등록한다.

## 5. Key decisions added

새 Architecture 결정은 없다. 승인된 Option A를 다음과 같이 구현했다.

- 원 membership은 `supabase_admin → postgres`, `admin=true`, `inherit=false`, `set=false` 두 행으로 exact 검증한다.
- `postgres`는 `GRANT ai_mls_production_migration_operator TO postgres WITH SET TRUE`로 별도 temporary provenance 행만 만든다.
- owner ACL 복구 후 `REVOKE ... FROM postgres GRANTED BY postgres`로 그 행만 제거한다.
- 원 `supabase_admin` 행 또는 option이 다르거나 temporary 행이 선재하면 mutation 전에 fail closed한다.
- 최종 `004`는 두 canonical membership 외 모든 AI-MLS role membership을 거부한다.

## 6. Open decisions

- **OPEN DECISION:** AO의 별도 Production controlled execution 승인 전까지 `010`과 `004`를 Production에서 실행하지 않는다.

## 7. Inconsistencies found

- Historical `009` disposable test는 bootstrap superuser가 `SET ROLE`을 우회할 수 있어 Production의 `set_option=false` prerequisite 실패를 재현하지 못했다. `009`는 변경하지 않고 Production `NOT_EXECUTED` 상태를 보존했다.
- non-superuser DB owner `postgres`는 schema `USAGE`가 없는 상태에서 text-name 기반 `has_*_privilege` resolution을 수행할 수 없었다. `010`과 final `004`의 검증을 catalog OID 기반으로 제한해 privilege를 넓히지 않고 수정했다.
- Independent review에서 `004`의 missing-table inner join, `010`의 PUBLIC table leakage 미검출, effective `TEMPORARY` 미강제가 발견됐다. 각 항목을 adversarial PostgreSQL 18 테스트로 RED 재현한 뒤 expected-row-preserving join, PUBLIC 포함 exact ACL 비교, DEC-192 effective `TEMPORARY = true` 검증으로 닫았다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| Focused static | compiled Node test runner | `9/9 PASS` |
| Disposable PostgreSQL | PostgreSQL 18, loopback `127.0.0.1:55441` | `1/1 PASS` |
| Failure injection | 7개 지점 rollback 후 membership/ACL exact snapshot | PASS |
| Adversarial fail-closed | PUBLIC table leakage, PUBLIC `TEMPORARY` 부재, approved table 누락 | PASS |
| Second execution | final state에서 partial-state precondition fail closed | PASS |
| Final `004` | 모든 `matches_expected` | PASS |
| Affected Identity | compiled Identity tests | `86 PASS / 5 SKIP / 0 FAIL` |
| Full regression | canonical repository test runner | `1607 PASS / 1 known immutable historical fingerprint failure / 5 SKIP` |
| Lint / Typecheck / Build | repository scripts | PASS / PASS / PASS |
| Cleanup | cluster stop, data directory removal, port listener check | PASS |
| Independent Review | 발견된 Important 3건과 Minor 2건 수정 후 unresolved findings | `0` |
| Scope | Production mutation, `002`/`009` execution, commit, push | 모두 `0` |

Full regression의 유일한 실패는 immutable REL-001 Blocker 2C candidate의 기존 `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT`다. Historical expected fingerprint 또는 test는 변경하지 않았다.

## 9. Known limitations

- `010`과 amended `004`는 disposable PostgreSQL에서만 실행했다.
- 실제 Supabase Production recovery는 별도 승인, read-only preflight와 human-controlled transaction execution이 필요하다.
- Historical `002`는 `FAILED_PARTIAL`, `009`는 Production prerequisite `FAIL` 및 Production `NOT_EXECUTED` 상태로 남는다.

## 10. Next brief prerequisites

- AO의 `010`/`004` Production controlled execution 승인.
- 실행 직전 exact `supabase_admin` membership, partial ACL, session/database owner를 read-only로 재확인한다.
- `ON_ERROR_STOP=1`인 단일 human-controlled session에서 `010` 성공 후에만 `004`를 실행한다.

## Completion statement

Repository-side grantor-aware recovery, exact membership restoration, atomic rollback 및 final verification 구현을 완료했다. Production mutation, historical artifact 재실행, commit 및 push는 수행하지 않았고 다음 Brief를 시작하지 않았다.

Final Recommendation:

`APPROVE_REL002_PRODUCTION_SET_ROLE_RECOVERY`

## Required report

| 항목 | 결과 |
|---|---|
| Production grantor | `supabase_admin` |
| Grantor evidence | PASS |
| Option A | APPROVED |
| Temporary postgres-granted SET authority | PASS |
| Original supabase_admin grant preserved | PASS |
| Temporary grant cleanup | PASS |
| Residual postgres-granted membership | ABSENT |
| Original membership final | PASS |
| `010` artifact | IMPLEMENTED |
| `010` atomicity | PASS |
| Final ACL boundary | PASS |
| Final `004` | PASS |
| Failure-injection rollback | PASS |
| Disposable PostgreSQL | PostgreSQL 18 `1/1 PASS` |
| Focused | `9/9 PASS` |
| Affected | `86 PASS / 5 SKIP / 0 FAIL` |
| Build / Lint / Typecheck | PASS / PASS / PASS |
| `git diff --check` | PASS |
| Independent Review | READY; unresolved Critical / Important / Minor = `0 / 0 / 0` |
| Production mutation | `0` |
| Commit | `NOT_CREATED` |
| Push | `NOT_PERFORMED` |
