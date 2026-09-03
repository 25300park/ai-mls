# F19-D Connector Ambiguity / New Invocation Recovery Handoff Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | F19-D-PLAN |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |

## Goal

ambiguous Connector invocation을 기존 F19 recovery case와 연결하고, 승인된 새 invocation만 기존 API-018 execution coordinator로 handoff한다.

## Scope

- `EXECUTION_STARTED` 뒤 durable result가 없는 invocation은 one-time Connector-origin recovery case linkage를 요청한다.
- F19 durable store는 exact authorized Connector recovery binding을 read-only로 반환한다.
- trusted planner는 `recoveryId` 기반의 새 `invocationId`를 만들고, handoff는 original identity와 다름 및 durable binding 일치를 검증한다.
- existing `ConnectorExecutionCoordinator`가 F18-B admission, lease, invocation journal 및 authoritative checkpoint completion을 계속 소유한다.

## TDD Tasks

- [x] ambiguity가 one Connector-origin case linkage만 요청하는 RED/GREEN test를 추가한다.
- [x] unresolved, confirmed-executed, unapproved, original identity reuse, wrong binding, inactive contract, missing executor, duplicate execution 및 conflicting planned identity의 zero-side-effect RED/GREEN test를 추가한다.
- [x] existing durable F19 store의 exact Connector authorization lookup RED/GREEN test를 추가한다.
- [x] source adapter가 existing F19 store binding/case creation만 소비하고 F19→connector direct path가 없음을 architecture test로 검증한다.
- [x] affected F18/F19 tests, typecheck/build, diff check를 실행한다.

## Constraints

- API-018 operation/state/authority/persistence subsystem을 추가하지 않는다.
- F19는 connector를 직접 호출하지 않고, automatic rerun 또는 manual checkpoint mutation을 수행하지 않는다.
- Connector reexecution은 `CONFIRMED_NOT_EXECUTED + RECOVERY_AUTHORIZED + CONNECTOR_REEXECUTION` binding 및 current F18-B admission을 모두 요구한다.
- Commit과 push는 수행하지 않는다.
