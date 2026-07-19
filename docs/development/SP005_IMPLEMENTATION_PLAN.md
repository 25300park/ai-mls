# SP-005 구현 계획

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-SP005-PLAN |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-005 |
| 승인 근거 | Architecture Owner 승인 SP-005 Implementation Brief v1.0 |

## Goal

`FEAT-011` deterministic Matching Contract와 `FEAT-021`의 `UI-024` 한정 role-aware review contract를 구현한다.

## Architecture

`modules/matching`은 exact-version input snapshot, hard eligibility, 고정 weight ranking, deterministic tie, human review와 immutable stale/supersede history를 소유한다. `apps/api`의 `MatchingApi`는 session-derived Actor를 service에 전달하고 safe response와 `UI-024` presentation state를 제공한다. `AI-005/006/007`은 기존 closed-schema validator를 재사용하며 score/rank/state authority를 갖지 않는다.

## Global Constraints

- TypeScript `6.0.3`, strict mode를 유지한다.
- Candidate cohort는 eligible 최대 100개, review list는 top 20이다.
- Weight는 Location 30, Property Type 25, Budget 20, Bedrooms 15, Area 5, Optional Preferences 5이다.
- 동점은 Hard Match, Budget Fit, 최신 Listing revision, stable UUID 순으로 해결한다.
- Contact raw data, Verification, Permission, Proposal, Publication 및 SP-006 기능을 구현하지 않는다.
- frozen 문서는 변경하지 않고 RTM implementation evidence만 완료 시 갱신한다.

## Task 1 — Deterministic Matching Domain

- [ ] `modules/matching/src/matching-service.test.ts`에 eligibility, ranking, tie, cohort, lifecycle, staleness, AI validation, privacy 테스트를 먼저 추가한다.
- [ ] 테스트가 missing module/behavior로 실패함을 확인한다.
- [ ] `modules/matching/src/matching-service.ts`와 `index.ts`에 최소 구현을 추가한다.
- [ ] domain test와 전체 regression을 통과시킨다.

## Task 2 — API-010 and UI-024 Contract

- [ ] `apps/api/src/matching-api.test.ts`에 session Actor, role actions, accessibility states, masking, safe errors와 composition 테스트를 먼저 추가한다.
- [ ] 테스트가 missing API/behavior로 실패함을 확인한다.
- [ ] `apps/api/src/matching-api.ts`, composition, exports와 safe error allowlist를 최소 변경한다.
- [ ] API test와 전체 regression을 통과시킨다.

## Task 3 — Evidence and Completion

- [ ] RTM에 `TRACE-011/021` SP-005 implementation evidence를 추가한다.
- [ ] `docs/reviews/SP-005_COMPLETION.md`에 phase completion evidence를 기록한다.
- [ ] lint, typecheck, test, build, verify, Gitleaks, dependency audit를 새로 실행한다.
- [ ] diff와 frozen document 변경 여부를 검토하고 단일 completion commit을 생성한다.

## Self-review

- Placeholder 없음.
- `FEAT-012/013`, `API-011/012`, `UI-025+` 구현 없음.
- Ranking authority는 deterministic application policy에만 있음.
- 새 authoritative persistent entity 또는 production adapter를 만들지 않음.
