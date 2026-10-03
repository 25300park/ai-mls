# REL-002 R3-C3B2B Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-274 |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-10-03 |
| Brief | REL-002 R3-C3B2B — First-party Authentication Persistence / Adapter |

## 1. Objective

Identity-owned first-party authentication의 PostgreSQL read path, native async Argon2id, 동일 Session transaction 재검증과 readiness를 구현했다. 기존 Session authority를 사용하며 Production startup gate를 활성화하지 않는다.

## 2. Documents read

- [B2A 승인 계약](REL002_R3C3B2A_COMPLETION.md), [구현 계획](../implementation/REL002_R3C3B2B_IMPLEMENTATION_PLAN.md), 현재 B2B brief와 AO login/tenant 결정.
- [작업 규칙](../../AGENTS.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Glossary](../00_GLOSSARY.md), [Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md).
- 기존 SessionService / PostgreSqlSessionUnitOfWork, B1 binding/composition, R3-C2 Identity base projection과 관련 tests.

## 3. Files created

- `modules/identity/src/first-party-credential-{argon2,contracts,postgresql,adapter}.ts`와 각 test: native crypto, exact evidence/config, tenant-scoped read, captured state 재검증.
- `modules/identity/migrations/postgresql/production/015_identity_human_credentials_v1.{up.sql,up.sql.sha256,verify.sql}`: 두 table, immutable credential material, SELECT-only runtime ACL, exact catalog 검증.
- `apps/api/src/first-party-authentication-{composition,readiness}.ts`, readiness test와 `rel002-r3c3b2b-postgresql.integration.test.ts`.
- [구현 계획](../implementation/REL002_R3C3B2B_IMPLEMENTATION_PLAN.md)과 이 보고서.

## 4. Files modified

- SessionService / Session PostgreSQL UoW: async authentication/issuance, 기존 transaction client에 재검증 참여, async 구성 시 memory fallback 금지.
- API contracts / IdentityApi와 Session/API/Staging tests: Promise 계약을 await하며 기존 Local/Test 의미를 보존한다.
- ProductionAuthenticationBinding: 승인된 provider-specific object config를 exact validator로 검증한다.
- R3-C2 composed base projection: 새 Human table이 존재하면 별도 exact readiness를 통과한 뒤 base inventory에서 제외한다. 역사적 base verifier와 migration은 변경하지 않는다.

## 5. Key decisions added

새 domain authority나 provider를 추가하지 않았다. AO 승인 `OPAQUE_EXACT_IDENTIFIER`를 적용하여 trim/case-fold/email/Unicode normalization 없이 `expectedTenantId + loginIdentifier`로 조회한다. `login_identifier COLLATE "C"`, tenant-scoped uniqueness로 exact equality를 보장한다.

Profile은 ARGON2ID_V1: memory 19456 KiB, passes 2, parallelism 1, tagLength 32, saltLength 16, pepper NONE이다. Native async API가 없으면 fail closed한다. Password는 evidence-local이며 Session/Audit/structured error에 포함하지 않는다.

재검증은 principal별 shared transaction advisory lock을 먼저 획득한다. 신규 principal/credential table write guard는 동일 key의 exclusive lock을 획득한다. 재검증 이후 disable/revoke는 Session commit 전 완료될 수 없다. Principal ID 변경 시 old/new key는 정렬한다. Runtime에는 credential SELECT만 부여하고 write lock을 위한 UPDATE 권한을 추가하지 않는다. Login의 Session issuance만 durable write이다.

## 6. Open decisions

B2B 구현 범위의 OPEN DECISION은 없다. Credential 관리 command와 다중 principal 변경의 전체 lock ordering은 별도 승인 범위이며 구현하지 않았다.

## 7. Inconsistencies found

- 최초 독립 리뷰에서 재검증 후 경쟁 구간과 async UoW 없는 구성 우회를 발견했다. 두 건을 수정하고 disposable interleaving / fail-closed 구성 테스트를 추가했다. 재리뷰 APPROVED.
- 전체 회귀의 immutable historical-candidate fingerprint mismatch 1건은 이미 승인된 역사적 불일치이다. 해당 test와 승인 migration은 변경하지 않았다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Focused | 12 PASS |
| Disposable PostgreSQL B2B | 10 PASS |
| B1 PostgreSQL compatibility | 1 PASS |
| Affected | 41 PASS |
| Full regression | 1807 PASS / 1 승인된 immutable historical fingerprint mismatch / 18 SKIP |
| Build / Lint / Typecheck | PASS |
| git diff --check / scoped secret scan | PASS |
| Independent review | APPROVED — P1 2건 수정 후 재리뷰 |
| Native runtime pool | 실제 runtime pool connection count 1; Bootstrap-owned pool 재사용, adapter의 pool 생성 없음 |
| Primary checkout / 역사적 보고서 보존 | PASS |

검증은 localhost:55441 전용 disposable PostgreSQL만 사용했다. 실제 Production readiness는 NOT_VERIFIED이다. 빈 credential table도 readiness를 통과하며 실제 login, Session 생성, credential mutation은 readiness에서 수행하지 않는다. ACL write/DDL 거부, PUBLIC leakage drift, migration-role 배제, checksum, exact catalog, Unicode/case/tenant uniqueness, rollback, post-revalidation interleaving을 검증했다.

## 9. Known limitations

Node native Argon2의 release-candidate 안정성은 B2A에서 승인된 bounded risk이다. 실제 credential provisioning/rotation/reset/recovery와 request-time trusted binding은 이 범위 밖이다. B3와 C3 Final은 시작하지 않았다. Human Identity gate와 Full Production startup은 BLOCKED, Required Secrets는 UNCHANGED_FAIL_CLOSED, listener/workers/R3-D는 NOT_STARTED이다.

## 10. Next brief prerequisites

B2B closeout 승인 후 별도 R3-C3B3 승인과 concrete trusted-binding composition이 필요하다. 이 보고서는 다음 phase 시작이나 Production 접근/배포를 승인하지 않는다.

## Completion statement

APPROVE_REL002_R3C3B2B_FIRST_PARTY_AUTH_IMPLEMENTATION을 권고한다. Production deployability BLOCKED, Production/Railway/Supabase mutation 0/0/0, Commit NOT_CREATED, Push NOT_PERFORMED. 기존 untracked 역사적 보고서 4개와 primary dirty changes는 보존했다.
