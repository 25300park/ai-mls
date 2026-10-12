# REL002 R3C1 PostgreSQL 17/18 Compatibility Completion

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |
| Completion date | 2026-10-12 |
| Baseline | `9ffaea09c1abfbca432edde3dc5015161d4dfb87` |

## 1. Objective

AO의 `APPROVE_R3C1_PG17_PG18_FORWARD_COMPATIBILITY_IMPLEMENTATION` 범위만 구현했다. PG17은 19개 canonical component를 정확히 비교하고, PG18은 기존 historical root fingerprint를 유지한다. Production 연결·변경, commit, push는 수행하지 않았다.

## 2. Documents read

- 최신 Human 승인 브리프와 PG17/PG18 component 동등성 증명.
- [작업 규칙](../../AGENTS.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Glossary](../00_GLOSSARY.md), [Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md).
- [Historical R3C1 readiness](../../apps/api/src/r3c1-postgresql-readiness.ts), [canonical fixture](../../apps/api/src/rel002-r3c1-postgresql.integration.test.ts), [R3C2 aggregate](../../apps/api/src/r3c2-aggregate-readiness.ts), [registration compatibility](../../apps/api/src/registration-readiness-compatibility.ts).

## 3. Files created

- [R3C1 compatibility module](../../apps/api/src/r3c1-catalog-compatibility.ts).
- [Focused tests](../../apps/api/src/r3c1-catalog-compatibility.test.ts).
- [Owned disposable integration tests](../../scripts/rel002-r3c1-compatibility.integration.test.mjs).
- 본 완료 보고서.

## 4. Files modified

- [R3C2 aggregate adapter](../../apps/api/src/r3c2-aggregate-readiness.ts): 기존 Administration/Organization R3C1 확인 지점만 새 boundary로 조합했다. post-014 Identity 확인은 기존 별도 경로를 유지한다.

## 5. Key decisions added

새 architecture authority는 추가하지 않았다. 승인된 dedicated R3C1 module + R3C2 composition을 구현했다.

- PG17: alternate root hash 허용 목록 없이 19개 component hash를 모두 비교한다. `constraints`는 `contype='n'`만 제외하며 `columns.attnotnull`은 유지한다.
- PG18: historical material과 expected root hashes를 정확히 유지한다.
- 지원 major는 17/18뿐이며 다른 major, missing/duplicate/malformed root, component drift, authority 실패는 fail-closed다.
- registration compatibility wrapper와 mandatory registration gate를 재사용하며 수정하지 않았다.
- component 기준은 승인된 post-grants/pre-014 PG17.11 capture이며, PG18 non-n constraint 동등성은 Human 승인 증명으로 추적한다. 로컬 양 버전 canonical fixture로 다시 확인했다.

## 6. Open decisions

**OPEN DECISION:** PG17 전체 aggregate fixture의 기존 Publication historical verifier compatibility는 이 Brief 범위 밖이다. Owner: Architecture Owner. 후속 범위를 별도로 결정해야 한다.

## 7. Inconsistencies found

추가 PG17 전체 R3C2 aggregate 시도는 fixture bootstrap의 기존 Publication verifier에서 `publication columns constraints indexes mismatch`로 중단됐다. 새 R3C1 boundary에는 도달하지 않았다. historical verifier를 변경하지 않았다. PG17의 새 R3C1 boundary 및 R3C2 child-root 호출은 PASS이고 PG18의 기존 전체 aggregate integration도 PASS다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Focused | 29 PASS |
| PG17.11 owned disposable integration | 57 PASS |
| PG18.4 owned disposable integration, 기존 전체 R3C2 aggregate 포함 | 58 PASS |
| Affected R3C1/R3C2/registration tests | 110 PASS / 3 SKIP |
| Full regression | 1925 PASS / 승인된 historical fingerprint mismatch 1 / 25 SKIP |
| Build / Typecheck / Lint | PASS |
| Syntax / git diff --check / secret-literal scan | PASS |
| Historical migration/verifier/expected fingerprint 불변 | PASS |
| 독립 focused review | 중요 correctness/security finding 없음 |

회귀의 기존 실패는 `REL-001 Blocker 2C durably persists the exact post-UI-006 candidate across reopen`이다. 해당 historical fingerprint는 수정하지 않았다.

Administration003 SHA256: `e21b19777b1761edc786760eb05e58726122dced9840ca349f1ded2ac53fec53`.
Organization001 SHA256: `0676ebbd256fe76162abc50533a9415be01809131242b641952d44e5d413d668`.
Identity012 SHA256: `ab04135e3b1b312474110c3e86f4b26644487f0277336cc3be99be4f2db17b66`.
세 파일 모두 sidecar와 일치하며 기존 historical tracked 파일은 변경되지 않았다.

실제 로컬 catalog 변경 테스트는 NOT NULL 제거/예상 외 column, PK/CHECK/FK, schema/table owner, schema/table/column ACL, effective privilege, index, trigger, function, comment, RLS, organization inventory, role/membership, direct TEMPORARY, registration gate 실패를 검증했다. 각 변경은 owned cluster에서 rollback했고 cluster를 종료했다. 이전 fixture/evidence는 삭제하지 않았다.

## 9. Known limitations

Production readiness 또는 배포 가능성을 증명하지 않는다. PG17 전체 aggregate 검증은 위 Publication bootstrap 제한 때문에 완료되지 않았다. 기존 untracked evidence와 historical R3C3 보고서는 보존했다.

## 10. Next brief prerequisites

AO의 변경 검토와 후속 권한이 필요하다. commit/push, Production 접속, migration, redeploy를 자동 수행하지 않는다.

## Completion statement

승인된 R3C1 compatibility 구현 및 양 버전의 scoped disposable 검증은 완료했다. 전체 PG17 aggregate의 별도 한계를 공개하며 다음 Brief는 시작하지 않았다. `COMMIT=NOT_CREATED`, `PUSH=NOT_PERFORMED`.
