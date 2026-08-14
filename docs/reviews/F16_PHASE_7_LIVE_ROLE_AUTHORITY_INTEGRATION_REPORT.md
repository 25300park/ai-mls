# F16-PHASE-7 Live Role Authority Integration Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-093 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Security Owner |
| Completion date | 2026-08-14 |
| Brief | F16-PHASE-7R — Authority Composition Alignment & Resume |
| Baseline commit | `bbe375196c7898a260977f001cf2f95c33dd08e4` |

## 1. Objective

보존된 F16-PHASE-7 작업을 기반으로 current Role/Role Assignment authority read graph를 연결하고, AO-16-06~08의 Role resolution, deny precedence 및 ACTIVE approval evidence를 fail-closed 방식으로 구현·검증했다.

**Final Recommendation:** `APPROVE_F16_PHASE_7_LIVE_ROLE_AUTHORITY_INTEGRATION`

이 승인은 Phase 7 logical live-authority integration에 한정한다. FEAT-016 전체 완료, durable production persistence, API-015 HTTP, Console write 또는 Phase 8 시작을 의미하지 않는다.

## 2. Documents read

- F16-PHASE-7R Architecture Owner brief — repository 외부 attachment이므로 commit 대상이 아니다.
- [FEAT-016 Traceability Matrix](../implementation/FEAT016_TRACEABILITY_MATRIX.md)
- [Security Registry](../00_SECURITY_REGISTRY.md)
- [Document Governance](../00_DOCUMENT_GOVERNANCE.md)
- [Glossary](../00_GLOSSARY.md)
- [Phase 6 Repository/UoW Report](F16_PHASE_6_ADMINISTRATION_REPOSITORY_UOW_IMPLEMENTATION_REPORT.md)

## 3. Files created

- `modules/administration/src/live-assignment-adapter.ts` — current Role/Assignment/Proposal/Decision read adapter와 Authorization composition.
- `modules/administration/src/live-assignment-adapter.test.ts` — AO-16-06/08 direct negative/positive evidence.
- `modules/authorization/src/live-role-authority-integration.test.ts` — live activation/revocation, scope, SoD, MFA 및 fallback rejection.
- `modules/authorization/src/live-role-authority-architecture.test.ts` — one-way/read-only/production static-fallback prohibition.
- `docs/reviews/F16_PHASE_7_LIVE_ROLE_AUTHORITY_INTEGRATION_REPORT.md` — 본 완료 보고서.

## 4. Files modified

Production/contract:

- `modules/administration/src/administration-persistence.ts`, `modules/administration/src/index.ts`
- `modules/authorization/src/authorization-service.ts`, `modules/authorization/src/index.ts`

Direct/regression tests and fixtures:

- `modules/administration/src/administration-persistence.test.ts`, `modules/administration/src/administration-service.test.ts`
- `modules/authorization/src/authorization-service.test.ts`
- `apps/admin-console/src/console-read-adapter.test.ts`, `apps/admin-console/src/console-server.test.ts`
- `apps/api/src/admin-audit-api.test.ts`, `apps/api/src/identity-api.test.ts`, `apps/api/src/publication-api.test.ts`
- `modules/ai/src/advisory-ai-service.test.ts`, `modules/client/src/client-requirement-service.test.ts`, `modules/contact/src/contact-service.test.ts`, `modules/intake/src/intake-service.test.ts`, `modules/jobs/src/job-service.test.ts`, `modules/listing/src/listing-service.test.ts`, `modules/matching/src/matching-service.test.ts`, `modules/permission/src/permission-service.test.ts`, `modules/property/src/property-service.test.ts`, `modules/proposal/src/proposal-service.test.ts`, `modules/publication-approval/src/publication-approval-service.test.ts`, `modules/source/src/source-test-fixture.ts`, `modules/verification/src/verification-service.test.ts`

Trace/document evidence:

- `docs/implementation/FEAT016_TRACEABILITY_MATRIX.md`
- `docs/00_MASTER_INDEX.md`, `docs/00_VERSION_HISTORY.md`

`package.json` 및 `pnpm-lock.yaml` 변경은 0이다.

## 5. Key decisions added

새 Architecture Decision은 만들지 않았다. 승인된 AO-16-06~08을 다음과 같이 구현했다.

### AO-16-06 Role Resolution — PASS

`RoleAssignmentPersistenceRecord`는 authority 의미를 가진 `RoleCode` 대신 `roleId`를 보존한다. Adapter는 매 evaluation에서 exact current `RolePersistenceRecord`를 조회하고 ACTIVE lifecycle, tenant/team scope, positive version, policy reference, governed evidence 및 canonical RoleCode mapping을 확인한 후 기존 Authorization capability model에 전달한다. Session/body Role·capability claim, unknown roleId/RoleCode, missing/retired Role은 authority가 아니다.

### AO-16-07 Deny Precedence — PASS

subject/tenant/team/resource/purpose/effective state로 independently applicable assignment를 계산한다. Publication approval/execution authority의 `PUA`와 `OPS`/`VER`/`PMR` conflict는 operation-specific security deny로 capability allow보다 우선한다. Bounded read에는 mutation SoD를 과도하게 적용하지 않으며 unrelated scope assignment는 allow를 합성하지 않는다.

### AO-16-08 Authority Evidence — PASS

ACTIVE status만으로 authority를 생성하지 않는다. Assignment, originating Proposal, APPROVED Decision, proposer, independent approver, exact resource/proposal/decision version, scope 및 shared activation evidence가 모두 canonical하고 일치해야 한다. Missing/malformed/stale/rejected/cross-linked/revoked evidence는 fail closed다.

## 6. Open decisions

- **OPEN DECISION:** physical database, ORM 및 migration 선택.
- **OPEN DECISION:** durable production Administration repository/UoW/decision adapter.
- **OPEN DECISION:** API-015 Runtime/HTTP composition 및 UI-006/UI-036 controlled write boundary.
- **OPEN DECISION:** 기존 승인된 development-only transitive `brace-expansion` advisory의 dependency-owner remediation 시점.

## 7. Inconsistencies found

최종 차단 inconsistency는 없다. Independent review에서 발견된 incomplete Role eligibility, malformed evidence acceptance, over-broad SoD 및 stale Proposal version findings는 direct regression과 최소 production correction으로 모두 해소했다.

## 8. Validation performed

| 검증 | 결과 |
|---|---|
| Runtime | Node.js `v24.18.0`; pnpm `11.9.0` |
| Focused Phase 7 | PASS — 15/15 |
| Broader Authorization/FEAT-015 security regression | PASS — 54/54 |
| Full regression including Phase 5/6 and Identity | PASS — 672/672, failed/skipped 0 |
| `pnpm.cmd install --frozen-lockfile` | PASS — dependency/lock unchanged |
| `pnpm.cmd lint` | PASS |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — 672/672 |
| Architecture checksum | PASS — immutable primary scope 153/153; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks 8.30.1 worktree scan | PASS — findings 0 |
| `pnpm.cmd audit --prod` | PASS — vulnerabilities 0 |
| `pnpm.cmd audit` | REVIEWED — 기존 승인 development-only transitive High 4만 존재 |
| `git diff --check` | PASS |
| Independent review | READY — Critical 0 / Important 0 / Minor 0 |

### Dependency audit evidence

승인된 `https://registry.npmjs.org` advisory endpoint에 dependency/lockfile audit metadata만 전송했다. Source, secret, environment 또는 business data는 전송하지 않았고 dependency/lockfile을 수정하지 않았다.

| Advisory | Package / dependency path | Severity | Disposition |
|---|---|---|---|
| `GHSA-mh99-v99m-4gvg` | `eslint -> minimatch -> brace-expansion` 1.x | High | previously approved, dev/transitive |
| `GHSA-mh99-v99m-4gvg` | `typescript-eslint -> typescript-estree -> minimatch -> brace-expansion` 5.x | High | previously approved, dev/transitive |
| `GHSA-rgw5-rvv9-x895` | `eslint -> minimatch -> brace-expansion` 1.x | High | previously approved, dev/transitive |
| `GHSA-rgw5-rvv9-x895` | `typescript-eslint -> typescript-estree -> minimatch -> brace-expansion` 5.x | High | previously approved, dev/transitive |

신규 미승인 High/Critical은 0이다.

## 9. Known limitations

- Physical database: `NOT_SELECTED`.
- Durable production persistence: `NOT_IMPLEMENTED`.
- 현재 adapter는 Phase 6 read repository port와 deterministic in-memory evidence로 검증됐다.
- API-015 Runtime/HTTP 및 UI-006/UI-036 mutation: `NOT_IMPLEMENTED`.
- `F16-GAP-004/006/007/008/009`는 여전히 open 또는 partially verified다.
- `F16-GAP-010`은 Phase 7 regression까지 `PARTIALLY_VERIFIED`이며 later Runtime/HTTP/UI/UAT acceptance가 필요하다.

## 10. Next brief prerequisites

- 본 Phase 7 commit에 대한 Architecture Owner acceptance.
- Phase 8의 범위·authority·persistence boundary에 대한 별도 승인.
- Durable adapter 또는 HTTP/UI 결정을 이 Phase의 완료로 소급 해석하지 않을 것.

## Completion statement

F16-PHASE-7R의 live Role authority integration은 구현·검증됐고 independent review는 READY다. 정확히 한 개의 local commit을 생성한 뒤 중단한다. Push하지 않으며 F16-PHASE-8을 시작하지 않는다.
