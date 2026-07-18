# Definition of Done — Development

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Quality Owner |
| 기준일 | 2026-07-15 |

## Purpose

[Project Definition of Done](../book-0/08_DEFINITION_OF_DONE.md)의 `DOD-DEV-001–006`을 development change level에서 구체화한다. Done은 merge, deploy 또는 release approval과 동일하지 않다.

## Done conditions

| ID | Condition | Required evidence |
|---|---|---|
| DOD-DEV12-001 | approved `DEV-*` scope만 구현했다. | diff-to-trace review |
| DOD-DEV12-002 | Requirement/Workflow/Entity/API/Screen/AI/Test trace가 current다. | registry and PR links |
| DOD-DEV12-003 | format, lint, build/type/static checks가 재현 가능하게 통과한다. | command/version/result |
| DOD-DEV12-004 | mapped unit/integration/system/security/AI/operational test가 applicable 범위에서 통과한다. | `TEST-*` execution evidence |
| DOD-DEV12-005 | negative, unauthorized, failure, retry/rollback와 regression path를 검증했다. | test report |
| DOD-DEV12-006 | secret/sensitive fixture/unsafe log가 없고 dependency/security gate를 통과했다. | scan/review evidence |
| DOD-DEV12-007 | migration/config/compatibility/observability/deployment/rollback impact를 검증했다. | operational evidence 또는 justified N/A |
| DOD-DEV12-008 | code review finding이 resolved/accepted되고 required reviewers가 승인했다. | fixed revision approval |
| DOD-DEV12-009 | architecture, API, data, UI, AI, runbook와 user documentation을 갱신했다. | changed Document IDs |
| DOD-DEV12-010 | known limitation, debt, follow-up, owner와 target가 등록됐다. | debt/CR/Decision links |

## Hard blockers

constitutional violation, authority/audit/provenance/privacy bypass, unresolved P0/P1, missing test/trace, secret exposure, unknown data loss, unsafe external publication 또는 failed rollback/recovery evidence가 있으면 Done이 아니다.

## AI-generated code

generated 여부와 prompt/tool context를 필요한 범위에서 기록하되 credential/personal data는 보존하지 않는다. human owner가 이해·수정·test할 수 없거나 independent review를 통과하지 못한 code는 Done이 아니다.

## Completion evidence

evidence는 exact commit/PR, tool/version, environment, timestamp, result와 reviewer를 식별한다. stale evidence는 재사용하지 않는다.
