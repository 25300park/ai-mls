# UAT Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business/UAT Owner / Quality Owner |
| 기준일 | 2026-07-15 |

## User acceptance scope

Collector, Agent/Senior Agent, specialist Reviewer, Manager, Administrator와 Operations/Security personas가 realistic end-to-end tasks, evidence/authority understanding, error/recovery, accessibility와 business outcome을 검증한다. External Partner는 `POST-MVP`다.

## Acceptance roles

UAT Owner가 scope/gate를, persona representative가 task/result를, Quality가 trace/defect/evidence를, Security/Privacy가 restricted/authority cases를, Release Owner가 candidate integrity를 관리한다. Author/developer 단독 sign-off는 불가하다.

## Business validation

- source→candidate→review, client requirement→match→proposal.
- contact→Verification→Permission과 publication approval/delivery separation.
- AI suggestion/confidence/limitation/correction 이해.
- role/permission/disabled reason, audit/history와 safe error/empty state.
- degraded/manual continuity와 reconciliation.
- keyboard/reflow/label/focus/error assistance 등 accessibility tasks.

## Entry criteria

Stable candidate/config/data/environment, P0 functional/security pass, trace coverage, known issues, runbook/support와 representative users가 준비되어야 한다.

## Sign-off

Scenario/test IDs, role/scope, expected/actual, defect/limitation, accept/reject/conditional rationale, signer/date와 expiry/retest condition을 기록한다. Conditional acceptance가 constitutional/security blocker를 override할 수 없다.

## Exit criteria

Critical journeys passed, no open blocker, P1 disposition approved, accessibility/business/privacy findings addressed, TEST-054/055 evidence와 Release Acceptance input이 완료되어야 한다.

