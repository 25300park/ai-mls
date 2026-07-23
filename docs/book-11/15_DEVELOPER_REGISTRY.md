# Developer Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-016 |
| 문서 버전 | v1.1 |
| 상태 | FROZEN |
| 소유 역할 | Development Reviewer / Architecture Owner |
| 기준일 | 2026-07-15 |

> Phase 15 synchronization: `DEV-001–024`의 end-to-end delivery connection은 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)를 따른다. Implementation status는 계속 `PLANNED`다.

## Purpose

향후 development artifact/work package의 permanent logical identity와 `Requirement → Workflow → Entity → API → Screen → AI → DEV → Commit → Test` trace를 관리한다. 현재 row는 모두 documentation-only `PLANNED`이며 code, task authorization, commit 또는 completion evidence가 아니다.

## Status rule

| Status | Meaning |
|---|---|
| PLANNED | logical scope만 정의, 구현 승인/착수 없음 |
| READY | [Definition of Ready](10_DEFINITION_OF_READY.md) approval 완료 |
| IN_PROGRESS | authorized implementation 진행 중 |
| IN_REVIEW | fixed revision review/test 중 |
| BLOCKED | blocker와 owner/next action 등록 |
| DONE | [Development Done](11_DEFINITION_OF_DONE_DEVELOPMENT.md) evidence 승인 |
| SUPERSEDED | replacement DEV ID로 대체, history 보존 |

## Registry

| Developer ID | Development artifact | Requirement | Workflow | Entity | API | Screen | AI Capability | Test | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| DEV-001 | Identity and session boundary | REQ-CONST-007/010 | WF-001–012 | User, Role, User Action, Audit Event | API-001/002 | UI-001/006/035/036 | N/A — identity authority | TEST-026/046 | Security/Development Owner | PLANNED |
| DEV-002 | Authentication API contract adapter | REQ-CONST-007/010 | WF-001–012 | User, Role, Team | API-001 | UI-001 | N/A — identity | TEST-026/046 | API/Security Owner | PLANNED |
| DEV-003 | Authorization and session enforcement | REQ-CONST-002/007/010/013 | WF-001–012 | User, Role, Team, Approval History | API-002 | UI-001–037 | N/A — authority control | TEST-009/026/046/047 | Security Owner | PLANNED |
| DEV-004 | Source registry contract | REQ-CONST-005/009 | WF-001 | Source Registry, Collector, Raw Source | API-003 | UI-009/010 | N/A — source governance | TEST-014/027/036 | Source/API Owner | PLANNED |
| DEV-005 | Intake processing contract | REQ-CONST-001/005/008/009/011 | WF-001–003 | Intake, Raw Source, Candidate Listing, AI Job | API-004 | UI-011–015 | AI-001/002/007 | TEST-004/015/016/027/039/040 | Intake/API Owner | PLANNED |
| DEV-006 | Property read/search contract | REQ-CONST-005/010/011 | WF-002–007 | Property, Property Alias, Candidate Listing | API-005 | UI-008/014/017/018 | AI-002/006/007 | TEST-028/040/044 | Property/API Owner | PLANNED |
| DEV-007 | Candidate and duplicate contract | REQ-CONST-001/002/005/008/011 | WF-002–004/006/007 | Candidate Listing, Listing Offer, Duplicate Group, Decision History | API-006 | UI-012/015–018 | AI-001–003/007 | TEST-007/010/017/028/039–041 | Listing/API Owner | PLANNED |
| DEV-008 | Contact privacy contract | REQ-CONST-007/010/013 | WF-007/008/011 | Contact, Contact Channel, Contact Case, Communication | API-007 | UI-019/020 | N/A — privacy authority | TEST-020/029/048 | Privacy/API Owner | PLANNED |
| DEV-009 | Client contract | REQ-CONST-001/002/007/010 | WF-005/008 | Client, Contact, Requirement | API-008 | UI-021/022 | AI-004/006/007 | TEST-018/030/048 | Client/API Owner | PLANNED |
| DEV-010 | Requirement lifecycle contract | REQ-CONST-001/002/007/008 | WF-005/006/008 | Requirement, Requirement History, Budget, Location Preference | API-009 | UI-021–024 | AI-004/006/007 | TEST-018/030/042/044/045 | Requirement/API Owner | PLANNED |
| DEV-011 | Matching contract | REQ-CONST-001/002/008/011 | WF-006/008/011 | Match Result, Requirement, Candidate Listing | API-010 | UI-024/025 | AI-005–007 | TEST-019/031/043–045 | Matching/API Owner | PLANNED |
| DEV-012 | Verification authority contract | REQ-CONST-002/003/010–012 | WF-007/009–011 | Verification, Availability, Approval History | API-011 | UI-026/027/029–032 | AI-007 support only | TEST-002/010/011/020/022/024/032/051 | Verification/API Owner | PLANNED |
| DEV-013 | Permission authority contract | REQ-CONST-002–004/010/013 | WF-007–011 | Permission, Approval History, Contact Channel | API-012 | UI-026/028–032 | AI-007 support only | TEST-003/012/020–022/024/032 | Permission/API Owner | PLANNED |
| DEV-014 | Proposal and approval contract | REQ-CONST-002–004/007/010/012/013 | WF-008/009 | Client Proposal, Publication Approval, Immutable Representation Snapshot, Verification, Permission; Publication Target read-only dependency | API-013 | UI-025/028–030 | N/A — human approval | TEST-021/022/033 SP-008 partition | Business/Publication API Owner | PLANNED |
| DEV-015 | Publication external-effect contract | REQ-CONST-002–007/009/012/013 | WF-010–012 | Publication, Publication Target, Published Listing Projection, Status History, System Error | API-014 | UI-031–033/035 | N/A — human/external authority | TEST-002–004/008/011/012/023–025/033 FEAT-015 partition/049 | Publication/API Owner | PLANNED |
| DEV-016 | Administration contract | REQ-CONST-006/007/010 | WF-001–012 | User, Role, Team, Decision History | API-015 | UI-006/036 | N/A — administration | TEST-005/034/037/048/053 | Administration/API Owner | PLANNED |
| DEV-017 | Audit query and evidence contract | REQ-CONST-005–007/010 | WF-001–012 | Audit Event, User Action, Status History, Approval History | API-016 | UI-035/036 | AI metadata when applicable | TEST-004–006/017/022/025/034/046/049/051/053 | Audit/API Owner | PLANNED |
| DEV-018 | Background job orchestration contract | REQ-CONST-007/008/010 | WF-003/006/010–012 | AI Job, AI Result, System Error | API-017 | UI-034 | AI-001–007 when applicable | TEST-016/024/025/035/039–043/045/051 | Operations/API Owner | PLANNED |
| DEV-019 | Connector isolation contract | REQ-CONST-005/007/009/010 | WF-001–004/009–012 | Collector, Raw Source, Source Provenance, Publication, System Error | API-018 | UI-009–013/031/033/034 | AI-001–003/007 after intake | TEST-008/014/023/036/037 | Integration Owner | PLANNED |
| DEV-020 | External integration lifecycle | REQ-CONST-005–010 | WF-001–012 | Source Registry, AI Job, Publication, System Error | API-019 | UI-006/031/033–036 | AI-001–007 where applicable | TEST-004/006/008/023/025/035–037/049/053 | Integration/Security Owner | PLANNED |
| DEV-021 | UI application and accessibility boundary | REQ-CONST-002/007/010–013 | WF-001–012 | User Action, Audit Event, Approval History | API-001–019 | UI-001–037 | AI-001–007 where displayed | TEST-038/054/055 | UI/UAT Owner | PLANNED |
| DEV-022 | AI advisory capability boundary | REQ-CONST-001/002/005/008/011 | WF-002–006 | AI Job, AI Result, Source Provenance, Requirement, Match Result | API-004–006/009/010/017 | UI-008/011–018/021/023/024 | AI-001–007 | TEST-007/013/015–019/039–045 | AI Owner | PLANNED |
| DEV-023 | Security, privacy and operational controls | REQ-CONST-002/005–007/010/013 | WF-001–012 | User, Role, Contact, Client, Retention Policy, Legal Hold, Audit Event, System Error | API-001–019 | UI-001–037 | AI-001–007 data handling | TEST-046–053 | Security/Privacy/Operations Owner | PLANNED |
| DEV-024 | Release trace and acceptance evidence | REQ-CONST-001–013 | WF-001–012 | Audit Event, Decision History, Approval History, System Error | API-001–019 | UI-001–037 | AI-001–007 | TEST-001–056 | Development/Quality/Release Owner | PLANNED |

## Coverage contract

- Developer artifacts: `DEV-001`–`DEV-024`, exactly one row each; all are `PLANNED`.
- Requirements: `REQ-CONST-001`, `REQ-CONST-002`, `REQ-CONST-003`, `REQ-CONST-004`, `REQ-CONST-005`, `REQ-CONST-006`, `REQ-CONST-007`, `REQ-CONST-008`, `REQ-CONST-009`, `REQ-CONST-010`, `REQ-CONST-011`, `REQ-CONST-012`, `REQ-CONST-013`.
- Workflows: `WF-001`, `WF-002`, `WF-003`, `WF-004`, `WF-005`, `WF-006`, `WF-007`, `WF-008`, `WF-009`, `WF-010`, `WF-011`, `WF-012`.
- APIs: `API-001`, `API-002`, `API-003`, `API-004`, `API-005`, `API-006`, `API-007`, `API-008`, `API-009`, `API-010`, `API-011`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-018`, `API-019`.
- Screens: `UI-001`, `UI-002`, `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`, `UI-008`, `UI-009`, `UI-010`, `UI-011`, `UI-012`, `UI-013`, `UI-014`, `UI-015`, `UI-016`, `UI-017`, `UI-018`, `UI-019`, `UI-020`, `UI-021`, `UI-022`, `UI-023`, `UI-024`, `UI-025`, `UI-026`, `UI-027`, `UI-028`, `UI-029`, `UI-030`, `UI-031`, `UI-032`, `UI-033`, `UI-034`, `UI-035`, `UI-036`, `UI-037`.
- AI capabilities: `AI-001`, `AI-002`, `AI-003`, `AI-004`, `AI-005`, `AI-006`, `AI-007`.
- Tests: `TEST-001`, `TEST-002`, `TEST-003`, `TEST-004`, `TEST-005`, `TEST-006`, `TEST-007`, `TEST-008`, `TEST-009`, `TEST-010`, `TEST-011`, `TEST-012`, `TEST-013`, `TEST-014`, `TEST-015`, `TEST-016`, `TEST-017`, `TEST-018`, `TEST-019`, `TEST-020`, `TEST-021`, `TEST-022`, `TEST-023`, `TEST-024`, `TEST-025`, `TEST-026`, `TEST-027`, `TEST-028`, `TEST-029`, `TEST-030`, `TEST-031`, `TEST-032`, `TEST-033`, `TEST-034`, `TEST-035`, `TEST-036`, `TEST-037`, `TEST-038`, `TEST-039`, `TEST-040`, `TEST-041`, `TEST-042`, `TEST-043`, `TEST-044`, `TEST-045`, `TEST-046`, `TEST-047`, `TEST-048`, `TEST-049`, `TEST-050`, `TEST-051`, `TEST-052`, `TEST-053`, `TEST-054`, `TEST-055`, `TEST-056`; canonical definition은 [Test Registry](../book-10/15_TEST_REGISTRY.md)를 따른다.
- Entity names use [Data Dictionary](../book-3/15_DATA_DICTIONARY.md) canonical values.

## Governance

새 development artifact는 duplicate check 후 다음 ID를 발급한다. split/replace 시 old row를 `SUPERSEDED`로 보존하고 replacement ID를 연결한다. `READY`, `IN_PROGRESS`, `IN_REVIEW` 또는 `DONE` 전환에는 approval/evidence가 필요하며 이번 Phase에서는 전환하지 않는다.

## Post-freeze implementation progress metadata

아래 overlay는 frozen canonical planning row를 변경하지 않는 실행 metadata다. 현재 실행 상태와 evidence는 이 표를 사용하고, `DEV-024`의 범위·trace·owner 정의는 위 frozen row를 따른다.

| Developer ID | Sprint | Execution status | Evidence | Updated |
|---|---|---|---|---|
| DEV-024 | SP-000 | DONE | [Sprint 0 Completion](../development/SPRINT0_COMPLETION.md), [Sprint 0 Task Status](../development/SPRINT0_TASK_STATUS.md) | 2026-07-15 |
