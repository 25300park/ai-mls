# Publication PostgreSQL 17/18 compatibility 완료 보고

- 버전: v0.1
- 상태: DRAFT
- 기준 HEAD: `6514857d45ea58162a7b567dea0b9fbabd33e4e4`
- 범위: AO 승인된 Publication catalog compatibility 및 로컬 검증

## 1. Objective
Publication PG18 NOT NULL catalog 표현으로 발생하는 PG17 readiness 불일치를 R3C2 forward composition에서만 처리한다.

## 2. Documents read
현재 AO implementation brief, Publication001/002/historical verifier, child-root readiness, R3C2 aggregate, registration compatibility, 기존 R3C1 isolated fixture helper 및 integration test를 확인했다.

## 3. Files created
- [Compatibility adapter](../../apps/api/src/publication-catalog-compatibility.ts)
- [Focused tests](../../apps/api/src/publication-catalog-compatibility.test.ts)
- [Disposable integration tests](../../scripts/rel002-publication-compatibility.integration.test.mjs)
- 이 보고서

## 4. Files modified
[R3C2 aggregate](../../apps/api/src/r3c2-aggregate-readiness.ts)의 import 및 child-root pool adapter 적용 두 곳만 변경했다. 기존 untracked diagnostic/evidence/reports는 변경하거나 stage하지 않았다.

## 5. Key decisions added
`app_publication` PG17에서만 constraints 집계의 `contype='n'`을 제외한다. 동일 statement에서 version 및 정확한 8-table inventory를 캡처한다. 7개 component, owner/comment/artifact, runtime privilege/leakage/membership 조건 모두 일치한 경우에만 historical evaluator에 constraints component를 투영한다. 단일 alternate root hash 허용은 없다. nullable state를 포함하는 columns hash는 변함없이 exact 검증한다.

PG18은 기존 historical constraints hash를 유지한다. 미지원 major, malformed/duplicate/missing root는 거부한다. 다른 child-root schema의 query material 및 historical evaluator는 변경하지 않았다. artifact GUC 필수 조건도 유지한다.

## 6. Open decisions
commit/push/Production execution은 승인되지 않았다. Production Publication missing schema 해결은 별도 권한 및 단계가 필요하다.

## 7. Inconsistencies found
초기 inventory `name[]` 결과가 Node에서 문자열로 반환되어 거부됐다. 새 inventory 반환을 `text[]`로 명시하여 해결했다. historical membership 규칙이 허용하는 runtime→postgres tuple을 negative case로 사용한 테스트는 실제 금지된 migration→runtime membership으로 수정했다. authority 계약은 변경하지 않았다.

## 8. Validation performed
- Focused: 31 PASS. 초기 placeholder에서 요구된 기능 실패를 확인한 뒤 구현했다.
- PG17.11 disposable: 23 PASS, loopback55454 새 owned cluster, 정지 완료.
- PG18.4 disposable: 23 PASS, loopback55455 새 owned cluster, 정지 완료.
- Affected child-root/R3C2: 71 PASS / 1 SKIP.
- Full regression canonical runner: 1956 PASS / 1 기존 승인된 immutable historical fingerprint mismatch / 25 SKIP. 해당 historical test는 변경하지 않았다.
- Build/typecheck/lint, mjs syntax, git diff --check, secret literal scan PASS.
- Publication001 SHA256: `613ecc0dfbe1a2ffd2d2edcdbda1d27b55713b8bcd09be6bc6e7bdbb7871d885`. historical Publication/R3C1 verifier/migration/expected material 및 일반 registration wrapper의 HEAD 대비 변경 없음 확인.

Integration은 NOT NULL 제거/추가, nullable type, PK/FK/CHECK/UNIQUE, extra non-`n`, index/trigger/function, owner/comment/inventory, runtime/effective ACL, PUBLIC leakage, membership, missing schema 및 artifact failure를 검증했다. 각 mutation은 로컬 transaction rollback 후 baseline PASS를 재확인했다. canonical PG17 forward PASS / historical FAIL 및 PG18 forward/historical PASS를 확인했다.

## 9. Known limitations
full suite를 single-process isolation=none으로 실행하면 기존 fake-timer 테스트 간 간섭이 발생하여 canonical per-file runner로 재검증했다. 전체 aggregate disposable bootstrap은 실행하지 않았다. Production 현재 missing-schema 상태를 이 compatibility가 해결하지 않으며 readiness는 계속 fail closed한다. fixture/evidence directory는 보존하고 owned server만 정지했다. Production 연결/변경, Railway 변경, commit/push는 수행하지 않았다.

## 10. Next brief prerequisites
AO가 bounded commit candidate scope를 검토해야 한다. 이전 diagnostic harness 및 evidence는 자동으로 commit scope에 포함하지 않는다. 다음 Production 단계는 별도 승인 대상이다.
