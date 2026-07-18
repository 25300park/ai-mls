# Development Principles

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer |
| 기준일 | 2026-07-15 |

## Development philosophy

개발은 code 생산이 아니라 승인된 outcome을 안전하게 전달하고 재현 가능한 evidence를 남기는 활동이다. 개발자는 speed보다 authority, data integrity, privacy, reversibility와 operability를 우선한다.

## Architecture-first

- [Constitution](../book-0/00_PROJECT_CONSTITUTION.md), approved ADR와 applicable Book contract가 구현 선택보다 우선한다.
- module boundary, data authority, external effect와 failure behavior를 구현 전에 확인한다.
- architecture와 code가 충돌하면 code를 기준으로 문서를 조용히 바꾸지 않고 CR/ADR review를 시작한다.

## Documentation-first

- behavior change에는 current Requirement, Workflow, Entity, API, Screen, AI와 Test trace가 선행한다.
- 미문서 module, state, API, data contract 또는 privileged operation을 추가하지 않는다.
- implementation detail이 architecture decision을 만들면 관련 문서와 Decision/ADR을 먼저 갱신한다.

## Incremental delivery

- 하나의 `DEV-*` work package는 독립적으로 review, test, rollback할 수 있는 최소 범위다.
- incomplete capability는 외부 노출하지 않고 명시적 internal-only/disabled boundary를 가진다.
- 큰 변경은 vertical increment로 나누되 authority와 audit chain을 부분 구현으로 약화하지 않는다.

## Quality-first

- code 전에 test intent와 negative path를 정의하고 bug fix에는 regression trace를 추가한다.
- type/static analysis, dependency/security review와 applicable test를 통과하지 못하면 merge하지 않는다.
- constitutional blocker를 waiver로 우회하지 않는다. scope를 줄이거나 change를 defer한다.

## Core safety bindings

AI는 advisory이며 human approval을 대체하지 않는다. candidate, verified, client-shareable과 published state를 분리하고, connector/API/UI/background job이 workflow·authority·audit를 우회하지 않게 한다.

## Evidence

각 increment는 `DEV-*`, affected document/version, CR/ADR/Decision, commit/PR, `TEST-*`, review finding, deployment/rollback impact와 owner를 연결해야 한다. Registry row만으로 Done 또는 release-ready를 주장할 수 없다.
