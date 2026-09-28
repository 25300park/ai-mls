# REL-002 002/004 Production Role Boundary Remediation Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-246 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Development / Security Owner |
| 완료일 | 2026-09-28 |
| Brief | REL-002 002/004 Production Role Boundary Remediation |
| 기준 Main | `3c7944b44764e37879e62f74e05259ce0a46c689` |

## 1. Objective

Supabase managed PostgreSQL에서 실행할 수 있도록 `002_runtime_role_grants.sql`의 중복 protected role mutation을 제거하고, historical migration attestation read provenance를 runtime allowlist에 보존한다. `004_production_role_privilege_verification.sql`은 historical table/function의 exact runtime authority, `PUBLIC` leakage 부재, grant option 부재 및 올바른 role-membership 방향을 검증한다. Production SQL은 실행하지 않는다.

## 2. Documents read

- [Phase 2D-0F Completion Report](REL002_PHASE2D0F_COMPLETION_REPORT.md)
- [Phase 2D-0K Completion Report](REL002_PHASE2D0K_COMPLETION_REPORT.md)
- [Phase 2D-0K Controlled Execution Runbook](../implementation/REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md)
- [Phase 2D-0K Privilege Verification Checklist](../implementation/REL002_PHASE2D0K_PRIVILEGE_VERIFICATION_CHECKLIST.md)
- [PostgreSQL PUBLIC TEMPORARY Compatibility Contract](../implementation/REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md)

## 3. Files created

- `modules/identity/src/production-role-boundary.integration.test.ts`: disposable PostgreSQL에서 corrected `002`와 complete `004`를 실행하고 privilege 위반을 주입하는 통합 검증.
- 본 Completion Report.

## 4. Files modified

- `modules/identity/migrations/postgresql/production/002_runtime_role_grants.sql`: protected `ALTER ROLE` 제거, historical attestation table `SELECT`와 exact verifier function `EXECUTE` 복원.
- `modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql`: historical table/function ACL, owner, `PUBLIC`, grant option 및 기존 membership 방향 검증 추가.
- `modules/identity/src/production-role-artifacts.test.ts`: `000` role-attribute authority와 corrected `002`/`004` static contract 검증 추가.
- [Master Index](../00_MASTER_INDEX.md): 본 완료 보고서 등록.

## 5. Key decisions added

새 Architecture 결정은 없다. 승인된 role boundary와 DEC-192를 구현한다. Role attributes의 단일 authority는 `000_production_role_creation.sql`이며, `002`는 steady-state runtime grants만 소유한다. Migration operator가 object owner로서 가지는 owner authority는 application role에 직접 부여된 grant option과 구분한다.

## 6. Open decisions

None. Production에서 corrected `002`와 amended `004`를 실행하는 행위는 별도 controlled execution 승인 대상이다.

## 7. Inconsistencies found

- 기존 `002`의 protected `ALTER ROLE`은 Supabase managed `postgres` execution boundary와 충돌했다. `000`이 이미 exact role attributes를 소유하므로 중복 statement를 제거했다.
- 기존 `002`의 blanket function/table revoke 뒤에는 `006`이 만든 historical attestation runtime grants가 복원되지 않았다. exact two grants를 추가했다.
- 기존 `004`는 historical table/function ACL을 검증하지 않았고 owner의 implicit grant authority를 direct application grant option과 구분하지 않았다. Runtime direct ACL과 owner authority를 분리해 검증한다.
- Canonical runbook에 따라 `002`는 DB owner가 실행해야 한다. 현재 Production preflight의 migration operator는 database owner가 아니며 `002` 실행 권한으로 해석하지 않는다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| Focused static + disposable boundary | Node test runner, local disposable PostgreSQL 18 | `10/10 PASS` |
| Disposable complete `004` | canonical artifact sequence와 negative privilege injection | `4/4 PASS` |
| Affected Identity | compiled Identity tests | `83 PASS / 3 SKIP / 0 FAIL` |
| Full regression | compiled repository tests | `1604 PASS / 1 known immutable historical fingerprint failure / 3 SKIP` |
| Lint | repository ESLint script | PASS |
| Typecheck | repository TypeScript no-emit script | PASS |
| Build | clean TypeScript build script | PASS |
| Scope | Production SQL, runtime grants, deployment | 모두 `0` |
| Independent review | fresh bounded read-only review | `READY — Critical 0 / Important 0 / Minor 0` |

Full regression의 유일한 실패는 immutable REL-001 Blocker 2C candidate가 historical expected fingerprint `7fef924f...`를 유지한 상태에서 current repository fingerprint가 달라 발생하는 기존 `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT`다. 해당 historical test/evidence는 변경하지 않았다.

## 9. Known limitations

- Corrected `002`와 amended `004`는 Production에서 실행하지 않았다.
- `002`의 Production executor는 canonical runbook에 명시된 DB owner다. `ai_mls_production_migration_operator` 단독으로 실행 가능한 artifact라고 주장하지 않는다.
- Disposable PostgreSQL 18은 immutable `001` verifier의 PostgreSQL-version-specific NOT NULL constraint inventory 차이를 기존 test helper와 동일한 방식으로 fixture-local 정규화했다. Historical `001` bytes는 변경하지 않았다.
- `pnpm` wrapper는 local store SQLite 접근 실패와 차단된 metadata fetch로 실행되지 않아, 이미 설치된 workspace 도구를 사용하는 동일 `npm` scripts와 direct compiled test runner로 검증했다. Dependency/lockfile 변경은 없다.

## 10. Next brief prerequisites

AO review와 별도 Production controlled execution 승인이 필요하다. 실행 시 corrected `002`를 적용한 뒤 amended `004`의 모든 `matches_expected`가 true인지 확인해야 한다.

## Completion statement

Repository-side 002/004 remediation과 disposable PostgreSQL 증거는 완료했다. Production mutation, `002`/`004` Production execution, deployment, commit 및 push는 수행하지 않았고 다음 Brief를 시작하지 않았다.

Final Recommendation:

`APPROVE_REL002_002_004_ROLE_BOUNDARY_REMEDIATION`
