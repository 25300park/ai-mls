# Definition of Ready

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Product Owner / Development Reviewer |
| 기준일 | 2026-07-15 |

## Purpose

Ready는 구현 착수 가능성이지 구현 승인이나 Done이 아니다. 하나라도 applicable blocker가 충족되지 않으면 task는 `PLANNED`에 머문다.

## Ready conditions

| ID | Condition | Evidence |
|---|---|---|
| DOR-001 | business purpose, scope/non-goal와 owner가 명확하다. | approved requirement/work item |
| DOR-002 | `REQ → WF → Entity → API → UI → AI → DEV → TEST` mapping이 complete하다. | registry/trace review |
| DOR-003 | acceptance criteria와 normal/negative/failure scenario가 testable하다. | mapped `TEST-*` |
| DOR-004 | architecture/module/dependency와 authority boundary가 승인됐다. | Book/ADR/Decision links |
| DOR-005 | data classification, provenance, privacy, retention와 migration impact를 평가했다. | data/security review |
| DOR-006 | API/UI/AI/integration compatibility와 external effect를 평가했다. | impact record |
| DOR-007 | security threat, abuse, permission와 audit requirements를 평가했다. | security review |
| DOR-008 | environment/config/dependency/fixture가 안전하게 준비 가능하다. | readiness note |
| DOR-009 | observability, rollout, rollback와 operational owner가 정의됐다. | operations impact |
| DOR-010 | unresolved blocker/critical decision 또는 stale approval이 없다. | review evidence |

## Rejection conditions

추측성 requirement, 미정 authority, production sensitive fixture 의존, test 불가능한 acceptance, undocumented module/API/entity/status 또는 rollback 없는 high-risk change는 Ready가 아니다.

## Approval

Product/Business Owner와 Development Reviewer가 기본 승인하고, 영향에 따라 Architecture, Data, Security/Privacy, AI, Quality와 Operations reviewer가 참여한다.

## Freshness

upstream contract, scope, risk, dependency 또는 target release가 변경되면 Ready를 재평가한다. 이전 approval을 자동 승계하지 않는다.
