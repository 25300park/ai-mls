# REL-002 R3-G1B Implementation Verification

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-283 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity / Architecture Owner |
| 날짜 | 2026-10-04 |
| Baseline | 34527fe6a7c450e958fb632ba9ecc6335ee70e09 |

## 1. Objective

Bounded registration operator, Identity command와 one-shot runner를 구현하고 disposable PostgreSQL로 검증한다. [설계 및 운영 경계](../implementation/REL002_R3G1B_REGISTRATION_OPERATOR_COMMAND.md)를 따른다. Production 실행 준비 완료로 표현하지 않는다.

## 2. Documents read

R3-G1B/B0/B1 사용자 brief와 최종 provisioning/scopeRef 결정, 기존 role separation/role creation 절차, RegisteredServiceWorkload 및 Identity/Audit evidence source와 migration을 확인했다.

## 3. Files created

Identity command/manifest, operator ACL query, one-shot runner, focused/disposable tests, 017 role 및 018 ACL artifacts/checksums/verifier, 이 보고서와 직접 관련 설계 문서.

## 4. Files modified

Audit materializer에 registration operator 전용 exact registration-event 참여 method를 추가했다. 기존 runtime materializer의 role/event 계약을 보존했다. tsconfig/eslint/package lint 범위에 tools/production TypeScript를 포함했다. listener/worker/runtime composition에는 command를 연결하지 않았다.

## 5. Key decisions added

새 AO 결정을 발명하지 않았다. `registered-service-workload:<registrationId>:<registrationVersion>` scopeRef, generated execution timestamp, 분리된 admin/migration/registration authority를 적용했다.

## 6. Open decisions

실제 registrationId/version, tenantId/principalId와 evidence refs는 UNASSIGNED다. 실행 가능한 exact Production approval manifest는 생성하지 않았다. registration operator ACL 추가 이후 기존 aggregate readiness fingerprint 호환성은 별도 bounded 승인/검증이 필요하다.

## 7. Inconsistencies found

Migration operator의 NOCREATEROLE 문제는 AO-approved administrative role creation과 owner-only object grants 분리로 해결했다. 리뷰에서 PUBLIC column writes와 PUBLIC SECURITY DEFINER 실행 우회를 발견해 effective privilege 검사와 disposable regressions로 해결했다. 기존 runtime의 exact catalog fingerprints에 새 operator grant를 조용히 포함시키지 않았다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Runner / manifest / explicit modes / secret boundary | PASS |
| Dedicated role / exact ACL / migration command exclusion | PASS |
| Atomic three-record write / partial rollback | PASS |
| Exact replay / conflict / concurrency | PASS |
| Ambiguous COMMIT quarantine / fresh replay | PASS |
| Standalone ACL verifier / migration checksums | PASS |
| Focused | 17 PASS |
| Disposable PostgreSQL | 9 PASS — isolated localhost:55443 PostgreSQL 18 |
| Affected | 62 PASS |
| Full regression | 1884 PASS / 1 authorized immutable historical fingerprint mismatch / 21 SKIP |
| Build / lint / typecheck | PASS |
| git diff --check / secret scan | PASS |
| Independent review | APPROVED after ACL fixes |

## 9. Known limitations

Implementation/disposable verification만 완료했다. Production role creation/grants/registration/DB connection, Railway configuration와 deployment는 수행하지 않았다. PG_REGISTRATION_OPERATOR_POOL은 one-shot execution용이며 long-running PG_PRODUCTION_POOL count=1 계약을 변경하지 않는다. Controlled process env의 sealed provisioning은 운영 승인 경계의 책임이며 구현이 provider를 발명하지 않는다.

Exact Production manifest와 runtime aggregate ACL 호환성이 미완료이므로 Production execution readiness는 NO다. Historical fingerprint/approved migrations/reports와 primary checkout은 보존했다.

## 10. Next brief prerequisites

별도 closeout 승인 전 commit하지 않는다. 실제 manifest 입력/AO approval과 aggregate-readiness compatibility resolution 전 Production provisioning/execution 또는 R3-G1 live configuration을 하지 않는다.

PRODUCTION_EXECUTION=NOT_PERFORMED. PRODUCTION_READINESS=NOT_VERIFIED. PRODUCTION_DEPLOYABILITY=BLOCKED. Production/Railway/Supabase mutation=0/0/0. Commit=NOT_CREATED. Push=NOT_PERFORMED.

FINAL_RECOMMENDATION=BLOCK_REL002_R3G1B1_ONE_SHOT_REGISTRATION_RUNNER — implementation verification은 통과했으나 required real approval manifest와 Production compatibility gate는 미완료다.
