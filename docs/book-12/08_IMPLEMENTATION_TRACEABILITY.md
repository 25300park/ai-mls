# Implementation Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Development Owner / Quality Owner |
| 기준일 | 2026-07-15 |

## Canonical chain

`Requirement → Workflow → Entity → API → Screen → AI → Developer Task → Sprint → Release → Test`

Roadmap control IDs `EPIC-*`, `FEAT-*`와 `IMP-*`를 Developer Task와 Sprint 사이에 연결한다.

## Layer sources

| Layer | Canonical source | Roadmap binding |
|---|---|---|
| Requirement | Project Constitution | `REQ-CONST-001–013` |
| Workflow | Workflow Index | `WF-001–012` |
| Entity | Data Dictionary | canonical entity name |
| API | API Registry | `API-001–019` |
| Screen | Screen Registry | `UI-001–037` |
| AI | AI Architecture Index | `AI-001–007` or justified N/A |
| Developer Task | Developer Registry | `DEV-001–024` |
| Epic/Feature | Epic/Feature Breakdown | `EPIC-001–010`, `FEAT-001–024` |
| Implementation | Implementation Registry | `IMP-001–024` |
| Sprint | Sprint Plan | `SP-000–010` |
| Release | Release Registry | `REL-001–005` |
| Test | Test Registry | `TEST-001–056` |

## Complete mapping rule

각 `DEV-*`는 exactly one primary Epic, Feature와 Implementation row를 가진다. Feature는 primary Sprint와 target Release를 가지며 Release는 최소 하나의 Feature/Sprint와 approval gate를 가진다. cumulative validation에서 Feature를 재검증해도 primary assignment는 바뀌지 않는다.

## N/A and assumption

AI 또는 Screen이 적용되지 않으면 `N/A` 이유와 reviewer를 기록한다. 미정 값은 `OPEN DECISION`, unverified planning premise는 `ASSUMPTION`, future scope는 `POST-MVP`로 표시한다. N/A를 누락 은폐에 사용하지 않는다.

## Change impact

어떤 layer의 ID/version/status가 변경돼도 downstream Epic/Feature/IMP/Sprint/Release/Test와 migration/cutover/risk를 재검토한다. superseded ID는 history와 replacement link를 보존한다.

## Evidence

planned trace는 execution evidence가 아니다. 실행 시 commit/PR, build/test result, environment, reviewer, approval, artifact/version/checksum와 deployment result를 fixed Implementation/Release revision에 연결한다.

## Orphan validation

- orphan Requirement/Workflow/Entity/API/Screen/AI/Test: source registry correction 또는 roadmap mapping 필요.
- orphan DEV/Feature/IMP/Sprint/Release: planning gate 실패.
- missing approval/evidence: status를 `PLANNED`/`BLOCKED`로 유지한다.

## Coverage statement

[Implementation Registry](15_IMPLEMENTATION_REGISTRY.md)의 Coverage Contract가 Phase 0–12 canonical IDs, DEV/Feature/Sprint/Release/Test coverage의 machine-reviewable source다.
