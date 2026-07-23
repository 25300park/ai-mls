# SP-008 Test Evidence

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-SP008-TEST-EVIDENCE |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-008 |
| Feature | FEAT-014 |
| 기준 일자 | 2026-07-23 |

## 범위

`TEST-021`, `TEST-022`, `TEST-033`의 SP-008 Approval/Effective Approval/Safe Boundary partition과 기존 전체 회귀를 검증한다. `API-014`, connector, delivery, reconciliation, Publication lifecycle은 검증 범위에 포함하지 않는다.

## 신규 테스트

| Test group | 파일 | 수 | 결과 |
|---|---|---:|---|
| TEST-021 Client Proposal | `modules/proposal/src/proposal-service.test.ts` | 3 | PASS |
| TEST-022/033 Publication Approval | `modules/publication-approval/src/publication-approval-service.test.ts` | 20 | PASS |
| API-013 / UI-029 / UI-030 | `apps/api/src/proposal-approval-api.test.ts` | 7 | PASS |
| 합계 |  | 30 | PASS |

## 검증 결과

| 검증 | 명령 | 결과 |
|---|---|---|
| Focused SP-008 | `node --test dist/modules/proposal/src/proposal-service.test.js dist/modules/publication-approval/src/publication-approval-service.test.js dist/apps/api/src/proposal-approval-api.test.js` | PASS, 30/30 |
| Full regression | `pnpm test` | PASS, 168/168 |
| Lint | `pnpm lint` | PASS, warnings 0 |
| Type check | `pnpm typecheck` | PASS |
| Build | `pnpm build` | PASS |
| Aggregate verify | `pnpm verify` | PASS |
| Gitleaks | `gitleaks detect --source . --config .gitleaks.toml --redact` | PASS, actual secrets 0, unexplained findings 0 |
| Dependency audit | `pnpm audit` | PASS, exit code 0, `No known vulnerabilities found` |

## Security coverage

- authoritative, team-bound representation source와 classification/provenance 상속
- exact representation/version/checksum/subject/target/channel/policy/Verification/Permission binding
- session-derived Actor, current PUA eligibility, MFA, reason, expected version, idempotency
- requester/creator/editor/verifier/Permission decision actor/executor/reconciler actor-level SoD
- role stacking/session switching, MGR/ADM/SEC/REV/SVC/AI/connector decision denial
- scheduler eligibility에 한정된 deterministic expiry와 manual PUA revocation 분리
- recovery/replay current authority, assignee, assignment, SoD, prerequisite 재검증
- immutable history/audit, safe errors, raw Contact 비노출
- Effective Approval gate audit와 no-delivery/no-API-014 boundary

## 제한

Audit finding은 0건이다. 따라서 advisory ID, severity, affected package, dependency path, direct/transitive 구분은 모두 `N/A`다. `pnpm audit --fix`를 실행하지 않았고 package manifest, lockfile, dependency를 변경하지 않았다.

`ASSUMPTION`: repository의 승인된 in-memory immutable persistence pattern을 유지했으며 production database adapter나 migration을 도입하지 않았다. Production target/provider/connector와 FEAT-015 execution은 `OPEN DECISION` 또는 future Sprint 범위로 유지한다.
