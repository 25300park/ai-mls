# REL-002 R3-G1B Implementation Closeout Verification

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity / Security / Operations Owner |
| 기준 HEAD | `34527fe6a7c450e958fb632ba9ecc6335ee70e09` |

## 1. Objective

R3-G1B command, operator role/ACL, one-shot runner와 승인된 deployment/registration manifest의 implementation gate를 검증한다. Production provisioning/dry-run/execute 승인은 포함하지 않는다.

## 2. Documents read

[Registration command](../implementation/REL002_R3G1B_REGISTRATION_OPERATOR_COMMAND.md), [initialization policy](../implementation/REL002_PHASE2A_IDENTITY_DATA_INITIALIZATION_POLICY.md), [frozen deployment binding](../implementation/REL002_R3G1B4_PRODUCTION_DEPLOYMENT_IDENTITY_BINDING.json), [frozen registration manifest](../implementation/REL002_R3G1B4_PRODUCTION_WORKLOAD_REGISTRATION_MANIFEST.json), R3-G1B2/B3/B4 및 현재 AO closeout verification 지시를 확인했다.

## 3. Files created

기존 R3-G1B WIP의 command, runner, role/ACL/checksum/verifier와 테스트를 검증했다. 이번 추가는 `apps/api/src/registration-readiness-compatibility.ts`, 해당 unit test와 본 보고서다. R3-G1B4 JSON 및 completion 문서는 기존 frozen 준비 결과로 유지한다.

## 4. Files modified

Identity/Audit 관련 네 catalog query를 독립 operator ACL 검증과 결합했다. `r3c2-aggregate-readiness.ts`와 `production-main.ts`는 Production aggregate 진입점에서 operator 존재/ACL을 필수로 확인한다. Disposable regression을 확장하고 SQL-prefix mock을 exact exported query constant로 수정했다. 기존 missing/duplicate/drift/role fail-closed 검사는 유지한다. Primary checkout은 변경하지 않았다.

## 5. Key decisions added

- Operator: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; 기존 `NOINHERIT`와 membership 금지도 유지한다.
- 기존 runtime/migration fingerprint는 그대로 비교한다. 별도 검증된 operator의 두 schema `USAGE`와 지정된 세 table `SELECT/INSERT`만 catalog projection에서 구분한다. 과도한 권한, PUBLIC leakage, grant option, ownership, unrelated write 및 role substitution은 허용하지 않는다.
- Operator가 없는 legacy database의 기존 verifier 동작은 유지하지만 새 Production operational aggregate gate는 실패한다.
- Frozen tenant/principal은 deployment owner input이다. 별도 Tenant/User persistence 또는 speculative authority lookup을 만들지 않는다.
- 추가 physical runtime pool을 생성하지 않는다. 기존 `PG_PRODUCTION_POOL`을 사용한다. One-shot operator pool은 별도 실행 경계이며 runtime service에 operator credential을 공급하지 않는다.

## 6. Open decisions

Implementation gate 미결정은 없다. Actual Production role/ACL provisioning, exact-target backup/restore 확인, operator credential binding, Production dry-run 및 이후 execute는 별도 Human/AO 승인·실행 경계다.

## 7. Inconsistencies found

과거 [R3-G1B blocker report](REL002_R3G1B_COMPLETION.md)와 [R3-G1B4 preparation report](REL002_R3G1B4_COMPLETION.md)의 당시 결론을 보존한다. 당시 manifest/aggregate blockers는 현재 AO 승인과 이번 implementation 검증으로 해소되었다. Historical fingerprint mismatch는 승인된 immutable historical-candidate mismatch이며 test와 expected fingerprint를 변경하지 않았다.

## 8. Validation performed

| 검증 | 결과 |
|---|---|
| Focused | 10 PASS |
| Disposable PostgreSQL | 10 PASS (parent 포함; port 55443 전용 local cluster) |
| Affected | 58 PASS |
| Full regression | 1886 PASS / 1 authorized immutable historical fingerprint mismatch / 21 SKIP |
| Build / Lint / Typecheck | PASS |
| git diff --check | PASS |
| Secret scan | PASS — 변경 및 신규 관련 파일에서 private key/provider token/Production credential URI candidate 0 |
| New migration SHA-256 | PASS |
| Independent review | APPROVED |
| Primary artifacts / historical fingerprint / previously approved migrations | UNCHANGED |

Disposable 검증은 exact create/three-record proof, 각 write 실패 rollback, exact replay no-op, conflict, concurrency, ambiguous COMMIT quarantine, dry-run zero write, operator role/ACL, runtime/migration command 거부와 aggregate compatibility를 포함한다. LOGIN/SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS/membership drift, operator overgrant 및 runtime registration-write grant는 모두 fail-closed했다.

Binding SHA-256: `16f83e2ba99383ded315dc2db2daf7c9bd5e04c666a210367457aed5512a1b38`

Registration manifest SHA-256: `557e11e6c1846e02a26e7fee748028d12f662b7bf13634ca3ccad3df4dc594a1`

## 9. Known limitations

Readiness는 disposable PostgreSQL에서만 검증했다. PRODUCTION_OPERATOR_ROLE_PROVISIONED=NO, PRODUCTION_OPERATOR_ACL_VERIFIED=NO, PRODUCTION_DRY_RUN=NOT_PERFORMED, PRODUCTION_EXECUTION=NOT_PERFORMED. Production readiness=NOT_VERIFIED, deployability=BLOCKED. Production/Railway/Supabase mutation=0/0/0. Railway config mutation=NO. Commit=NOT_CREATED. Push=NOT_PERFORMED.

## 10. Next brief prerequisites

PRODUCTION_PROVISIONING_READY=YES는 검토 가능한 implementation/provisioning artifact 준비를 뜻한다. Production execution 권한을 뜻하지 않는다. 별도 승인된 Human provisioning과 exact manifest dry-run 검증 후, 추가 AO execute 승인 전까지 registration write를 수행하지 않는다.

FINAL_RECOMMENDATION=APPROVE_REL002_R3G1B_IMPLEMENTATION_CLOSEOUT
