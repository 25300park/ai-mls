# REL-002 011 SET ROLE Recovery Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-249 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Development / Security Owner |
| 완료일 | 2026-09-29 |
| Brief | REL-002 SET-ROLE Recovery — NEW 011 Implementation |
| 기준 HEAD | `9d6f08ed1bf68af46979bdaa1be4f02fcf999fb4` |

## 1. Objective

Production에서 실패 후 rollback된 historical `010`을 변경하지 않고, PostgreSQL role-membership default와 독립적인 canonical `011` recovery artifact를 구현한다. 원 `supabase_admin` membership을 보존하고, `postgres`가 소유한 임시 `SET` authority만 단일 transaction 안에서 생성·사용·제거하며 Production SQL은 실행하지 않는다.

## 2. Documents read

- 현재 REL-002 SET-ROLE Recovery — NEW 011 Implementation Brief
- [Production SET ROLE Recovery Completion](REL002_PRODUCTION_SET_ROLE_RECOVERY_COMPLETION.md)
- PostgreSQL 18 `GRANT` canonical syntax 및 role-membership option semantics
- `010_complete_production_runtime_role_boundary_with_bounded_set_authority.sql`
- `004_production_role_privilege_verification.sql`

## 3. Files created

- `modules/identity/migrations/postgresql/production/011_complete_production_runtime_role_boundary_with_explicit_set_authority.sql`
- 본 Completion Report.

## 4. Files modified

- `modules/identity/src/production-role-artifacts.test.ts`: historical `010` SHA 보존, `011` explicit options, grantor, transaction 및 9개 failure marker 검증.
- `modules/identity/src/production-role-set-authority-recovery.integration.test.ts`: PostgreSQL 18 `NOINHERIT`/`INHERIT` matrix, 9개 failure injection rollback, final `004` 검증.
- `modules/identity/migrations/postgresql/production/004_production_role_privilege_verification.sql`: runtime/PUBLIC function 및 sequence ACL의 exact final boundary 검증.
- [Master Index](../00_MASTER_INDEX.md): 본 보고서 등록.

## 5. Key decisions added

새 Architecture Decision은 없다. AO 승인 의미를 PostgreSQL 18 executable grammar로 구현했다.

- AO가 지정한 단일 `GRANT ... WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres`를 사용하며, exact temporary row를 검증하기 전에는 `SET LOCAL ROLE`을 수행하지 않는다.
- `postgres.rolinherit`는 audit-safe result로 출력하고 `SELECT ... INTO STRICT`로 존재를 검증하되 특정 boolean을 요구하지 않는다.
- `004`는 original `supabase_admin` 행, exact options, residual `postgres` grant 부재와 함께 runtime/PUBLIC function 및 sequence ACL의 exact final boundary를 검증한다.

## 6. Open decisions

- **OPEN DECISION:** AO의 별도 controlled execution 승인 전까지 `011`과 `004`를 Production에서 실행하지 않는다.

## 7. Inconsistencies found

- Production read-only evidence에서 `postgres.rolinherit = TRUE`, PostgreSQL `17.6` (`server_version_num = 170006`)가 확인되어 root cause를 `IMPLICIT_INHERIT_DEFAULT_AND_TEST_FIXTURE_TOPOLOGY_GAP`으로 확정했다. `011`의 explicit `INHERIT FALSE`는 이 Production default 의존성을 제거한다.
- Pre-closeout `011` SHA-256 `17789a60744a99c7983a80e65b2d73842e9f11418684c2512370cd28bbc5c38d`는 EOF blank line 때문에 `git diff --check`를 통과하지 못했다. Production 미실행 상태에서 AO가 EOF normalization을 승인했으며, 해당 SHA는 `SUPERSEDED_PRE_CLOSEOUT_CANDIDATE`로 분류한다. SQL semantic change는 없다.
- 초기 disposable 시도에서 file-generation 중 dollar-quote 세 곳이 손상되어 parse error가 발생했다. 해당 생성 결함을 수정하고 AO가 지정한 단일 exact `GRANT`를 PostgreSQL 18.4에서 재검증했다.
- 기존 integration test의 permission-denied 및 division-by-zero 검증은 English message에 의존했다. PostgreSQL locale과 독립적인 SQLSTATE `42501`/`22012` 검증으로 교정했다.
- 독립 검토에서 broad revoke가 변경하는 sequence 및 function ACL의 baseline/final exact 검증 누락을 확인했다. RED 테스트로 재현한 뒤 `011`과 post-recovery `004`에 exact ACL 검증을 추가했으며, 변경하지 않은 `002` 의미에 따라 `reject_session_revocation_mutation`의 기존 `PUBLIC EXECUTE`는 허용된 exact row로 명시했다.

## 8. Validation performed

| 검사 | 방법 | 결과 |
|---|---|---|
| Focused static | compiled Node test runner | `10/10 PASS` |
| Disposable PostgreSQL | PostgreSQL `18.4`, loopback `127.0.0.1:55443` | `1/1 PASS` |
| Fixture matrix | `postgres NOINHERIT`, `postgres INHERIT` | 둘 다 PASS |
| Failure injection | fixture별 9개 지점, rollback 후 exact snapshot | PASS |
| Final `004` | 두 fixture 모두 모든 `matches_expected` | PASS |
| Affected Identity | compiled Identity tests | `87 PASS / 5 SKIP / 0 FAIL` |
| Full regression | canonical repository test runner | `1608 PASS / 1 known immutable historical fingerprint failure / 5 SKIP` |
| Build / Lint / Typecheck | repository scripts | PASS / PASS / PASS |
| Disposable cleanup | cluster stop, data directory removal, port close | PASS |
| `git diff --check` | changed worktree | PASS |
| Changed-file secret scan | 6 files | 0 findings |
| Independent Review | Critical/Important/Minor | `0/0/0` remaining after RED→GREEN remediation |

Full regression의 유일한 실패는 기존 immutable REL-001 Blocker 2C `EXPECTED_STALE_HISTORICAL_CANDIDATE_FINGERPRINT`다. Historical expected fingerprint와 test는 변경하지 않았다.

## 9. Known limitations

- Production read-only evidence는 `postgres.rolinherit = TRUE`, PostgreSQL `17.6`, `server_version_num = 170006`을 확인했다. 이 증거 수집 중 Production mutation은 `0`이다.
- `011`과 `004`는 disposable PostgreSQL에서만 실행했다.
- `010`은 `PRODUCTION_EXECUTION_FAILED / ROLLBACK PASS`, `009`는 `PRODUCTION_PREREQUISITE_FAIL / NOT_EXECUTED`, `002`는 `FAILED_PARTIAL / RERUN PROHIBITED` 상태를 유지한다.

## 10. Next brief prerequisites

- 실행 직전 exact membership, no temporary membership, unavailable initial `SET ROLE`, exact FAILED_PARTIAL ACL을 read-only로 재확인한다.
- 별도 AO 승인 후 `ON_ERROR_STOP=1`인 human-controlled 단일 session에서 `011` 성공 후에만 `004`를 실행한다.

## Completion statement

Repository-side `011` explicit membership recovery, inheritance-independent PostgreSQL 18 matrix, 9-point atomic rollback 및 unchanged final `004` verification을 완료했다. Production mutation, commit 및 push는 수행하지 않았다.

Final Recommendation:

`APPROVE_REL002_011_SET_ROLE_RECOVERY`

## Required report

| 항목 | 결과 |
|---|---|
| Production `postgres.rolinherit` | `TRUE` (read-only evidence) |
| Production server version | PostgreSQL `17.6`; `server_version_num = 170006` |
| Root cause | `CONFIRMED — IMPLICIT_INHERIT_DEFAULT_AND_TEST_FIXTURE_TOPOLOGY_GAP` |
| `010` historical preservation | PASS; SHA-256 `ab6222b7f9607cfe8ae625575b94068de61abf507eda456785903f4fd1da8657` |
| Old `011` candidate | SHA-256 `17789a60744a99c7983a80e65b2d73842e9f11418684c2512370cd28bbc5c38d`; `SUPERSEDED_PRE_CLOSEOUT_CANDIDATE` |
| Normalized `011` | IMPLEMENTED; SHA-256 `0d8a8614b57b5a90b188f0c3506da4cba01e11993c42f4a306c721cc3d0355d0`; semantic SQL change `NONE` |
| Final `004` | AMENDED; SHA-256 `92a05702ac2f298acfc8fadb80b1810c324df48cd9164c56b663bf5ead84d27f` |
| Explicit `ADMIN FALSE` / `INHERIT FALSE` / `SET TRUE` / grantor | PASS / PASS / PASS / PASS |
| `postgres INHERIT` / `NOINHERIT` fixture | PASS / PASS |
| Original grant / temporary topology / cleanup | PASS / PASS / PASS |
| Final SET authority | FALSE |
| `011` atomicity / failure injection / final `004` | PASS / PASS / PASS |
| `git diff --check` / secret scan | PASS / 0 findings |
| Independent Review | READY; remaining Critical/Important/Minor `0/0/0` |
| Production mutation | `0` |
| Commit | `NOT_CREATED` |
| Push | `NOT_PERFORMED` |
