# REL-002 Production Role Boundary Partial 002 Execution Recovery Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-247 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Development / Security Owner |
| 완료일 | 2026-09-28 |
| Brief | REL-002 Production Role Boundary Partial 002 Execution Recovery |
| 기준 HEAD | `6099f5b90252bf43fb83de1358c860cea2cbf9de` |

## 1. Objective

Production에서 `002_runtime_role_grants.sql`이 DB-owner 작업 후 migration-operator-owned object ACL에서 중단된 정확한 `FAILED_PARTIAL` 상태를 보존한다. Historical `002`를 변경하거나 재실행하지 않고, 새 `009_complete_production_runtime_role_boundary_after_partial_002.sql`을 통해 단일 transaction 안에서 exact precondition 검증, `SET LOCAL ROLE`, owner-scoped ACL 복구, `RESET ROLE`, final postcondition 검증을 수행한다. Production SQL은 실행하지 않는다.

## 2. Documents read

- 현재 REL-002 Production Role Boundary Partial 002 Execution Recovery Brief
- [002/004 Role Boundary Remediation Completion](REL002_002_004_ROLE_BOUNDARY_REMEDIATION_COMPLETION.md)
- [Phase 2D-0K Controlled Execution Runbook](../implementation/REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md)
- [Phase 2D-0K Privilege Verification Checklist](../implementation/REL002_PHASE2D0K_PRIVILEGE_VERIFICATION_CHECKLIST.md)
- [PostgreSQL PUBLIC TEMPORARY Compatibility Contract](../implementation/REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md)

## 3. Files created

- `modules/identity/migrations/postgresql/production/009_complete_production_runtime_role_boundary_after_partial_002.sql`: exact partial-state 전용 atomic recovery artifact.
- `modules/identity/src/production-role-partial-recovery.integration.test.ts`: PostgreSQL 18에서 exact partial state, mixed-owner authority, success 및 injected rollback을 검증한다.
- 본 Completion Report.

## 4. Files modified

- `modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql`: historical mutation rejection function의 owner와 runtime/`PUBLIC` `EXECUTE` 부재를 검증한다.
- `modules/identity/src/production-role-artifacts.test.ts`: `002` immutable SHA, `009` transaction/authority split/allowlist와 execution order를 정적으로 검증한다.
- [Master Index](../00_MASTER_INDEX.md): 본 완료 보고서를 등록한다.

## 5. Key decisions added

새 Architecture 결정은 없다. 승인된 bounded recovery 계약을 구현했다.

- Historical `002`는 `FAILED_PARTIAL` Production evidence이며 SHA-256 `76275ea39fd4881633e1d3097e5227e37a611b9fac36e0a0ad960795fbb985fb`로 고정한다.
- DB-owner session `postgres`가 exact precondition을 확인하고, object-owner 작업만 `SET LOCAL ROLE ai_mls_production_migration_operator`로 수행한다.
- `reject_historical_migration_attestation_mutation()`은 trigger function이므로 runtime direct `EXECUTE`를 부여하지 않으며 `PUBLIC EXECUTE`도 제거한다.
- Recovery는 explicit `BEGIN`/`COMMIT` 한 transaction이며 중간 실패는 전체 rollback한다.

## 6. Open decisions

- **OPEN DECISION:** AO가 Production에서 `009`를 controlled execution하도록 별도 승인해야 한다. 이 Brief에서는 Production 실행하지 않았다.

## 7. Inconsistencies found

- `002`는 DB-owner와 migration-owner authority를 한 execution role에 혼합하여 Supabase managed PostgreSQL에서 부분 실행되었다. `009`는 owner split을 명시적으로 처리한다.
- PostgreSQL `PUBLIC`은 catalog role이 아닌 ACL pseudo-grantee다. 초기 disposable 검증에서 이를 실제 role처럼 조회하던 새 검증 로직이 실패했고, `aclexplode(...).grantee = 0`의 canonical ACL 판정으로 수정했다.
- 새 `004` 검증은 historical mutation function의 implicit `PUBLIC EXECUTE`를 허용하지 않는다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| Focused static | Node test runner | `7/7 PASS` |
| Disposable PostgreSQL | PostgreSQL 18, `127.0.0.1:55439`, success + injected rollback | `1/1 PASS` |
| Exact partial state | canonical artifacts 후 observed `FAILED_PARTIAL` ACL 재현 | PASS |
| Mixed-owner authority | `postgres` session에서 migration role `SET ROLE` 가능 및 reset 확인 | PASS |
| Final `004` | recovery 후 모든 `matches_expected` | PASS |
| Failure injection | `COMMIT` 전 오류, rollback 후 snapshot exact 동일 | PASS |
| Affected Identity | compiled Identity tests | `84 PASS / 4 SKIP / 0 FAIL` |
| Full regression | canonical compiled repository tests | `1605 PASS / 1 known immutable historical fingerprint failure / 4 SKIP` |
| Lint / Typecheck / Build | repository scripts | PASS / PASS / PASS |
| Cleanup | cluster stop, data directory removal, port listener check | PASS |
| Independent review | bounded read-only re-review after ACL/rollback hardening | `READY — Critical 0 / Important 0 / Minor 0` |
| Scope | Production connection/mutation, `002` rerun, push, commit | 모두 `0` |

Full regression의 유일한 실패는 immutable REL-001 Blocker 2C candidate의 기존 `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT`다. Historical expected fingerprint 또는 test는 변경하지 않았다.

## 9. Known limitations

- `009`와 amended `004`는 disposable PostgreSQL에서만 실행했다. Production recovery는 별도 controlled execution 대상이다.
- Disposable scenario는 Production에서 관찰된 ACL 상태를 exact privilege snapshot으로 재현하지만 실제 Supabase 연결이나 mutation은 수행하지 않는다.
- `002`는 재실행 금지이며 향후 operator는 `009`만 사용해야 한다.

## 10. Next brief prerequisites

- AO의 `009` Production controlled execution 승인.
- 실행 전 `session_user = postgres`, database owner, `SET ROLE` authority 및 exact `FAILED_PARTIAL` precondition을 다시 확인한다.
- `009` 성공 후 amended `004`를 read-only final verification으로 실행한다.

## Completion statement

Repository-side bounded recovery artifact, exact partial-state reproduction, atomic success/rollback 증거와 final `004` 검증을 완료했다. Production connection/mutation, historical `002` 재실행, commit 및 push는 수행하지 않았고 다음 Brief를 시작하지 않았다.

Final Recommendation:

`APPROVE_REL002_PARTIAL_002_PRODUCTION_RECOVERY`
