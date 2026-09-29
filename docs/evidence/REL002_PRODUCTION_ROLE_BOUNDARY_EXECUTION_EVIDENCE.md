# REL-002 Production Role Boundary Execution Evidence

| 항목 | 값 |
|---|---|
| Evidence ID | `REL002-EVIDENCE-PRODUCTION-ROLE-BOUNDARY-001` |
| Evidence class | `PRODUCTION_ROLE_BOUNDARY_EXECUTION_ATTESTATION` |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| Evidence state | FINALIZED |
| 소유 역할 | Database Owner / Security Owner |
| 대상 환경 | PRODUCTION |
| 기록일 | 2026-09-29 |
| 기록 근거 | AO-provided Production execution and final-verification closeout statement |
| Repository baseline | `5b9421dd9b76e9ca728600a460dcd484df141e02` |
| 변경 정책 | 승인 후 immutable; 정정은 새 evidence record로만 허용 |

## 1. 목적과 범위

이 record는 canonical `011` SET-role recovery의 Production commit과 final `004` privilege verification 결과를 보존한다. 본 documentation closeout에서는 Production SQL을 추가 실행하지 않았으며 credential, password, connection string 또는 secret을 기록하지 않는다.

## 2. Production platform evidence

| 항목 | 관찰값 |
|---|---|
| PostgreSQL version | `17.6` |
| `server_version_num` | `170006` |
| `postgres.rolinherit` | `TRUE` |
| Production evidence collection | READ_ONLY |

## 3. Canonical artifact identity

| Artifact | SHA-256 | Production disposition |
|---|---|---|
| `011_complete_production_runtime_role_boundary_with_explicit_set_authority.sql` | `0d8a8614b57b5a90b188f0c3506da4cba01e11993c42f4a306c721cc3d0355d0` | `PRODUCTION_EXECUTION_PASS / COMMIT_PASS / RERUN_PROHIBITED` |
| `004_production_role_privilege_verification.sql` | `92a05702ac2f298acfc8fadb80b1810c324df48cd9164c56b663bf5ead84d27f` | `PRODUCTION_FINAL_VERIFICATION_PASS` |
| `010_complete_production_runtime_role_boundary_with_bounded_set_authority.sql` | `ab6222b7f9607cfe8ae625575b94068de61abf507eda456785903f4fd1da8657` | `PRODUCTION_EXECUTION_FAILED / ROLLBACK_PASS / IMMUTABLE` |

Old pre-closeout `011` SHA-256 `17789a60744a99c7983a80e65b2d73842e9f11418684c2512370cd28bbc5c38d`는 `SUPERSEDED_PRE_CLOSEOUT_CANDIDATE`이며 Production에서 실행되지 않았다.

## 4. Controlled execution result

`011`은 `postgres_rolinherit = TRUE`를 관찰한 뒤 single transaction에서 실행되어 `COMMIT`에 성공했다. 관찰된 high-level command flow는 다음과 같다.

1. `DO`
2. `GRANT ROLE`
3. exact temporary topology verification
4. `SET ROLE`
5. bounded ACL repair
6. `RESET ROLE`
7. temporary role grant cleanup
8. final invariant verification
9. `COMMIT`

Explicit temporary membership options `ADMIN FALSE`, `INHERIT FALSE`, `SET TRUE`, `GRANTED BY postgres`가 적용되었고, 종료 후 `postgres`가 grantor인 residual temporary membership은 존재하지 않았다.

## 5. Final membership topology

| Granted role | Member role | Grantor | Admin | Inherit | Set |
|---|---|---|---|---|---|
| `ai_mls_production_migration_operator` | `postgres` | `supabase_admin` | `true` | `false` | `false` |
| `ai_mls_production_runtime` | `postgres` | `supabase_admin` | `true` | `false` | `false` |

AI-MLS role-to-role membership은 없고 temporary `postgres`-granted recovery membership은 제거되었다.

## 6. Final privilege verification

`004` Production verification은 모든 reported `matches_expected`를 `TRUE`로 반환했고 `FALSE` result를 보고하지 않았다.

| Boundary | Result |
|---|---|
| Migration operator role attributes and privileges | PASS |
| Runtime role attributes and privileges | PASS |
| Runtime database `CONNECT = TRUE`, `CREATE = FALSE` | PASS |
| Effective `TEMPORARY = TRUE`, direct `TEMPORARY = FALSE` | PASS — DEC-192 preserved |
| `app_identity` schema `USAGE = TRUE`, `CREATE = FALSE` | PASS |
| Exact six-table runtime privilege boundary | PASS |
| Historical attestation table boundary | PASS |
| Historical verifier function boundary | PASS |
| Mutation rejection function boundary | PASS |
| Unexpected grant options / PUBLIC leakage | ABSENT |

## 7. Historical state preservation

- `002`: `FAILED_PARTIAL / RERUN_PROHIBITED`.
- `009`: `PRODUCTION_PREREQUISITE_FAIL / NOT_EXECUTED`.
- `010`: `PRODUCTION_EXECUTION_FAILED / ROLLBACK_PASS / IMMUTABLE`; durable mutation from failed execution `0`.
- `011`: `PRODUCTION_EXECUTION_PASS / COMMIT_PASS / RERUN_PROHIBITED`.
- `004`: `PRODUCTION_FINAL_VERIFICATION_PASS`; rerun requires separate read-only evidence-reproduction need.

## 8. Closeout disposition

`PRODUCTION_ROLE_BOUNDARY = CLOSED` applies only to the bounded PostgreSQL role-membership and privilege boundary verified here. It does not independently close unrelated REL-002 Production configuration, secret, deployment, provider, or acceptance gates.

## 9. Documentation-task safety

Production mutation during this closeout `0`; `002`/`009`/`010`/`011`/`004` execution `0`; deployment `0`; credential use `0`; push `NOT_PERFORMED`.
