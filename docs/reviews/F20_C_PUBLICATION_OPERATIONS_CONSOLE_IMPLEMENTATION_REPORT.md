# F20-C Publication Operations Console Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | F20-C-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner |
| Completion date | 2026-09-04 |
| Baseline | `faff0802998dc8c7232bf5f46ea115a53ff6c4cc` |
| Final Recommendation | `APPROVE_F20_C_PUBLICATION_OPERATIONS_CONSOLE` |

## 1. Objective

기존 API-014의 UI-031/032/033/035 canonical read model을 version-consistent Operations Console projection으로 합성한다. 새 command, authority, lifecycle state 또는 mutation route를 만들지 않는다.

## 2. Documents read

- Architecture Owner의 `F20 — Operations Console Expansion Continuous Execution Brief`.
- [F20-A Inventory](F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md).
- [F20-B Report](F20_B_OPERATIONS_READ_MODELS_API_PROJECTION_IMPLEMENTATION_REPORT.md).
- API-014 `PublicationOperationsView`와 직접 contract tests.

### Publication Operations Console action matrix

| Action/View | Existing backend | UI-safe | Mutation allowed | Authority | MFA/SoD | expectedVersion | Decision |
|---|---|---|---|---|---|---|---|
| `GET_PUBLICATION` | API-014 closed query | YES | N/A | session-derived read | backend | N/A | existing detail route 미요구; no new route |
| `GET_PUBLICATION_OPERATIONS_VIEW` | API-014 closed query | YES | N/A | live action projection | projected | N/A | UI-031 primary read; aggregate/source version is response evidence |
| `GET_PUBLICATION_REVALIDATION_VIEW` | API-014 closed query | YES | N/A | live revalidation | projected | N/A | composed eligibility; source version is response evidence |
| `GET_PUBLICATION_RECOVERY_VIEW` | API-014 closed query | YES | N/A | recovery read | backend | N/A | composed lineage/status; source version is response evidence |
| `GET_PUBLICATION_AUDIT_VIEW` | API-014 closed query | YES | N/A | bounded audit read | backend | N/A | safe attempt/audit refs; source version is response evidence |
| `GET_LISTING_PROJECTION` | API-014 closed query | YES | N/A | projection read | backend | N/A | existing separate Projection route |
| 12 API-014 commands | API-014 closed commands | diagnostic names only | **NO** | backend exists; Console command composition absent | backend rules exist; Console flow unproven | backend requires version | `READ_ONLY`; no handler/route/form |

## 3. Files created

- `docs/reviews/F20_C_PUBLICATION_OPERATIONS_CONSOLE_IMPLEMENTATION_REPORT.md`.

## 4. Files modified

- `apps/admin-console/src/console-renderer.ts`.
- `apps/admin-console/src/console-renderer.test.ts`.
- `apps/admin-console/src/console-read-adapter.ts`.
- `apps/admin-console/src/console-read-adapter.test.ts`.

## 5. Key decisions added

- UI-031 primary read와 UI-032/033/035 supplemental read는 동일 `sourceVersion`일 때만 합성한다. Version drift는 safe error이며 자동 재시도하지 않는다.
- latest attempt/outcome, reconciliation linkage, current eligibility 및 bounded audit reference를 기존 API-014 fields로만 구성한다.
- latest attempt는 canonical `id`, `sequence`, `operation`, `outcome`, `occurredAt`만 새 immutable DTO로 재구성하며 arbitrary/raw provider field는 폐기한다.
- API-014에 canonical recovery finding/disposition이 없으므로 둘 다 `UNAVAILABLE`로 명시하고 `UNKNOWN` outcome에서 추정하지 않는다.
- `availableActions`는 authoritative execution permission이 아니므로 계속 `NON-EXECUTABLE`, disabled diagnostic control로 표시한다.
- 현재 Console에 Publication command용 trusted confirmation/idempotency/stale-refresh boundary가 없으므로 mutation route 또는 handler를 추가하지 않는다.

## 6. Open decisions

None. Future Publication mutation UX는 exact human role, MFA, SoD, expected version, idempotency, confirmation과 stale refresh를 모두 증명하는 별도 승인이 필요하다.

## 7. Inconsistencies found

None. API-014 read model과 existing UI-031 route/adapter가 canonical source로 재사용되었다.

## 8. Validation performed

| Gate | Result |
|---|---|
| TDD RED | prerequisite/blocker 미표시, four-view composition 부재, mixed-version acceptance를 각각 expected failure로 확인 |
| Focused adapter + renderer tests | 25/25 PASS |
| Console/API-014/authorization/F17/F19 affected regression | 170/170 PASS |
| Full regression | 973/973 PASS |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Verify | PASS — lint/typecheck/build/full-test constituent gates 모두 exit 0 |
| Architecture checksum | immutable 153/153 PASS; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`; F20-C architecture-scope changes 0 |
| Gitleaks | 0 findings; approximately 12.97 MB scanned |
| `git diff --check` | PASS |
| New Publication mutation routes/handlers | 0 |
| New API/operation/authority/state/dependency | 0 |
| Dependency/lockfile changes | 0 |

Dependency 변경은 없고 F20-C-scoped audit authorization이 없으므로 dependency audit은 실행하지 않았다. Worktree의 dependency topology는 변경하지 않았으며 main의 승인된 TypeScript/ESLint runtime을 read-only로 재사용했다.

## 9. Independent review

Initial expanded review는 Critical 0 / Important 1 / Minor 1로 generic latest-attempt record leakage와 action-matrix version column 오류를 발견했다. Adversarial raw provider fixture를 RED로 재현한 뒤 canonical 5-field allowlist를 적용했고 query의 `expectedVersion`을 `N/A`로 정정했다.

Fresh remediation re-review: **Critical 0 / Important 0 / Minor 0 — READY**. Exact attempt allowlist, secret/raw field omission, four existing API-014 reads, source-version containment, no finding/disposition inference, disabled action semantics, escaping/accessibility와 zero API/authority/state/mutation expansion을 확인했다.

## 10. Known limitations

- UI-031 action 목록은 diagnostic visibility만 제공하며 실행할 수 없다.
- API-014가 제공하지 않는 recovery finding/disposition, operation list/count 또는 actor role detail은 추정하지 않는다.
- Publication mutation은 backend command 존재만으로 허용하지 않는다. Console trusted command composition이 별도 승인·검증되기 전까지 비실행이다.

## 11. Next brief prerequisites

- F20-D는 F20-B의 exact API-018 `ReadBatchStatus` projection만 사용한다.
- Force checkpoint, connector execution, lease mutation 또는 Source governance mutation control을 만들지 않는다.

## Completion statement

F20-C는 기존 UI-031 read model의 safe visibility를 완성했고 Publication mutation surface는 `0`이다. Push는 수행하지 않는다.
