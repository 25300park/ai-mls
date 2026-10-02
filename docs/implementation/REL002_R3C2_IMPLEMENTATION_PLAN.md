# REL-002 R3-C2 Runtime Startup Integration Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-392 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Identity Owner / Authorization Owner |
| Baseline | b0426713386e7bf838aa6bd7b12bb739a14945d4 |

## 승인 범위

Isolated worktree만 사용한다. Production configuration -> PG_PRODUCTION_POOL -> exact pinned workload -> immutable Identity proof -> registration final Audit -> exactly one ACTIVE binding -> binding activation Audit -> Service Principal -> Organization -> Project -> typed Scope -> live AuthorizationService -> aggregate readiness -> startup gate PASS 순서를 구현한다. Listener/workers와 R3-D는 시작하지 않는다. Actual Production/Railway/Supabase를 접근하지 않으며 commit/push/deploy하지 않는다.

## Canonical source

[Startup lookup contract](REL002_R3C0_STARTUP_LOOKUP_CONTRACT.md), [authority matrix](REL002_R3C0_BINDING_AUTHORITY_MATRIX.md), [R3-C2B completion](../reviews/REL002_R3C2B_COMPLETION.md)를 재사용한다. Principal의 approved owner source는 existing RegisteredServiceWorkload이며 별도 inferred Principal entity/table은 만들지 않는다. TEAM/POLICY/SOURCE/TARGET은 existing typed Administration read repositories를 dispatch한다.

## 구현 및 검증 순서

- [x] Baseline branch/HEAD 및 preserved R3-C2 WIP ownership 확인.
- [x] Pinned async identity resolver RED -> GREEN; exact registration/version, no latest/default fallback, lifecycle/classification/purpose/audience, captured tuple revalidation. 신규 5 PASS + existing 5 PASS.
- [x] Production pinned config 및 durable ordered evidence read 연결. Registration client를 release한 뒤 async durable evidence 검증을 await한다.
- [x] Active binding/current selection, activation Audit, exact Principal/Organization/Project/typed scope 검증 및 captured authority 재검증.
- [x] 승인된 기존 action/resource mapping으로 live AuthorizationService 평가.
- [x] R3-B/R3-C 모든 durable root aggregate readiness 및 pre-listener gate/cleanup 연결.
- [x] Focused/disposable/affected/full regression/build/lint/typecheck/diff/secret scan/독립 리뷰 및 [완료 보고서](../reviews/REL002_R3C2_COMPLETION.md).

## Resolved decisions — R3-C2A/B/C

OD-R3C2-AUTH-1 = CLOSED. 후속 Human/AO 결정으로 durable Identity evidence, registration final audit, binding activation audit, distinct-ref replacement, authorizationTeamId가 RESOLVED이다. historical decision record는 변경하지 않는다.

Team context authority는 `WorkloadStartupBindingRecord.authorizationTeamId`이다. Administration TEAM_SCOPE와 exact principal의 RoleAssignment membership을 검증하며 teamIds에서 team을 선택하지 않는다. action/capability는 `scope.use`, resource.type은 `Administration`, id는 TEAM_SCOPE/POLICY/SOURCE_REGISTRY/PUBLICATION_TARGET typed scope, version은 exact governance version이다. Organization/Project는 governance prerequisites이며 별도 authorization resource로 평가하지 않는다.

[승인된 R3-C2C 구현](REL002_R3C2C_IMPLEMENTATION_PLAN.md)과 [완료 검증](../reviews/REL002_R3C2C_COMPLETION.md)을 재사용한다. pinned registration → Identity proof → registration final audit → exactly one ACTIVE binding → v2 activation audit → exact service principal → Organization → Project containment → explicit team eligibility → typed scope → live scope.use → aggregate readiness → startup PASS를 적용한다. captured authority를 반환 전에 재검증한다. listener/workers는 시작하지 않는다.

## 현재 상태

Focused 37 PASS; disposable PostgreSQL 4 PASS; affected 78 PASS; full regression 1785 PASS / 1 authorized immutable historical-candidate fingerprint mismatch / 16 SKIP. Build/Lint/Typecheck, diff check, secret scan PASS; independent review APPROVED. `REQUIRED_SERVICE_WORKLOAD_PINS`, `STARTUP_WORKLOAD_PURPOSE`, `STARTUP_WORKLOAD_AUDIENCE`는 명시적 config input이며 legacy registration list와 exact match해야 한다.

Human/AO는 PostgreSQL catalog의 NOT NULL 중복 표기, exact BETWEEN expansion, chronology CHECK column 순서의 동등 표현 정규화를 승인했다. Composed adapter에만 적용하며 기존 verifier, historical fingerprint, approved migration은 변경하지 않았다. Administration의 승인된 R3-C1 project table extension은 별도 composed contract로 검증한다.

모든 pin capture 후 전체 pin을 재-resolve/live-authorize하여 fingerprint equality를 확인한다. Final Human/AO closeout 승인 범위는 SERVICE_WORKLOAD_PRELISTENER_GATE READY이다. HUMAN_IDENTITY_AUTHORITY 및 REQUIRED_SECRETS는 UNCHANGED_FAIL_CLOSED, FULL_PRODUCTION_STARTUP은 BLOCKED이다. Listener/workers/R3-D NOT_STARTED. Bounded closeout commit 하나만 승인되었다. Push NOT_PERFORMED; Production/Railway/Supabase mutation 0/0/0; Production deployability BLOCKED; Production readiness NOT_VERIFIED.
