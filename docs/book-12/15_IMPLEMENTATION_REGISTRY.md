# Implementation Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-016 |
| 문서 버전 | v1.2 |
| 상태 | FROZEN |
| 소유 역할 | Development Owner / Architecture Owner |
| 기준일 | 2026-07-15 |

> Phase 15 synchronization: `IMP-001–024`는 corresponding `DEV-*`와 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)를 통해 REQ-to-TEST chain에 연결된다. Row status는 `PLANNED`다.

## Purpose

각 logical implementation plan을 Epic/Feature/Developer Task에서 Workflow/Entity/API/Screen/AI/Test/Sprint/Release까지 연결한다. 모든 row는 `PLANNED`이며 source code, final contract, authorization, estimate 또는 completion evidence가 아니다.

## Status

`PLANNED`, `READY`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `DONE`, `SUPERSEDED`, `CANCELLED`를 사용한다. `READY` 이후 전환은 [Developer Bible](../book-11/00_DEVELOPER_BIBLE_INDEX.md)의 approval/evidence를 요구한다.

## Registry

| Implementation ID | Epic | Feature | Developer Task | Workflow | Entity | API | Screen | AI Capability | Test | Sprint | Release | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IMP-001 | EPIC-002 | FEAT-001 | DEV-001 | WF-001–012 | User, Role, User Action, Audit Event | API-001/002 | UI-001/006/035/036 | N/A — identity | TEST-026/046 | SP-001 | REL-001 | Security/Development Owner | PLANNED |
| IMP-002 | EPIC-002 | FEAT-002 | DEV-002 | WF-001–012 | User, Role, Team | API-001 | UI-001 | N/A — identity | TEST-026/046 | SP-001 | REL-001 | API/Security Owner | PLANNED |
| IMP-003 | EPIC-002 | FEAT-003 | DEV-003 | WF-001–012 | User, Role, Team, Approval History | API-002 | UI-001–037 | N/A — authority | TEST-009/026/046/047 | SP-001 | REL-001 | Security Owner | PLANNED |
| IMP-004 | EPIC-003 | FEAT-004 | DEV-004 | WF-001 | Source Registry, Collector, Raw Source | API-003 | UI-009/010 | N/A — source | TEST-014/027/036 | SP-002 | REL-001 | Source/API Owner | PLANNED |
| IMP-005 | EPIC-003 | FEAT-005 | DEV-005 | WF-001–003 | Intake, Raw Source, Candidate Listing, AI Job | API-004 | UI-011–015 | AI-001/002/007 | TEST-004/015/016/027/039/040 | SP-002 | REL-001 | Intake/API Owner | PLANNED |
| IMP-006 | EPIC-004 | FEAT-006 | DEV-006 | WF-002–007 | Property, Property Alias, Candidate Listing | API-005 | UI-008/014/017/018 | AI-002/006/007 | TEST-028/040/044 | SP-003 | REL-001 | Property/API Owner | PLANNED |
| IMP-007 | EPIC-004 | FEAT-007 | DEV-007 | WF-002–004/006/007 | Candidate Listing, Listing Offer, Duplicate Group, Decision History | API-006 | UI-012/015–018 | AI-001–003/007 | TEST-007/010/017/028/039–041 | SP-003 | REL-001 | Listing/API Owner | PLANNED |
| IMP-008 | EPIC-005 | FEAT-008 | DEV-008 | WF-007/008/011 | Contact, Contact Channel, Contact Case, Communication | API-007 | UI-019/020 | N/A — privacy | TEST-020/029/048 | SP-004 | REL-001 | Privacy/API Owner | PLANNED |
| IMP-009 | EPIC-005 | FEAT-009 | DEV-009 | WF-005/008 | Client, Contact, Requirement | API-008 | UI-021/022 | AI-004/006/007 | TEST-018/030/048 | SP-004 | REL-001 | Client/API Owner | PLANNED |
| IMP-010 | EPIC-005 | FEAT-010 | DEV-010 | WF-005/006/008 | Requirement, Requirement History, Budget, Location Preference | API-009 | UI-021–024 | AI-004/006/007 | TEST-018/030/042/044/045 | SP-004 | REL-001 | Requirement/API Owner | PLANNED |
| IMP-011 | EPIC-006 | FEAT-011 | DEV-011 | WF-006/008/011 | Match Result, Requirement, Candidate Listing | API-010 | UI-024/025 | AI-005–007 | TEST-019/031/043–045 | SP-005 | REL-001 | Matching/API Owner | PLANNED |
| IMP-012 | EPIC-007 | FEAT-012 | DEV-012 | WF-007/009–011 | Verification, Availability, Approval History | API-011 | UI-026/027/029–032 | AI-007 support | TEST-002/010/011/020/022/024/032/051 | SP-006 | REL-002 | Verification/API Owner | PLANNED |
| IMP-013 | EPIC-007 | FEAT-013 | DEV-013 | WF-007–011 | Permission, Approval History, Contact Channel | API-012 | UI-026/028–032 | AI-007 support | TEST-003/012/020–022/024/032 | SP-007 | REL-002 | Permission/API Owner | PLANNED |
| IMP-014 | EPIC-007 | FEAT-014 | DEV-014 | WF-008/009 | Client Proposal, Publication Approval, Immutable Representation Snapshot, Verification, Permission; Publication Target read-only dependency | API-013 | UI-025/028–030 | N/A — human approval | TEST-021/022/033 SP-008 partition | SP-008 | REL-003 | Business/Publication API Owner | PLANNED |
| IMP-015 | EPIC-007 | FEAT-015 | DEV-015 | WF-010–012 | Publication, Publication Target, Published Listing Projection, Status History, System Error | API-014 | UI-031–033/035 | N/A — external effect | TEST-002–004/008/011/012/023–025/033 FEAT-015 partition/049 | `PENDING ARCHITECTURE OWNER DECISION` | REL-004 | Publication/API Owner | PLANNED |
| IMP-016 | EPIC-008 | FEAT-016 | DEV-016 | WF-001–012 | User, Role, Team, Decision History | API-015 | UI-006/036 | N/A — administration | TEST-005/034/037/048/053 | SP-001 | REL-001 | Administration/API Owner | PLANNED |
| IMP-017 | EPIC-008 | FEAT-017 | DEV-017 | WF-001–012 | Audit Event, User Action, Status History, Approval History | API-016 | UI-035/036 | AI metadata | TEST-004–006/017/022/025/034/046/049/051/053 | SP-001 | REL-001 | Audit/API Owner | PLANNED |
| IMP-018 | EPIC-008 | FEAT-018 | DEV-018 | WF-003/006/010–012 | AI Job, AI Result, System Error | API-017 | UI-034 | AI-001–007 | TEST-016/024/025/035/039–043/045/051 | SP-002 | REL-001 | Operations/API Owner | PLANNED |
| IMP-019 | EPIC-009 | FEAT-019 | DEV-019 | WF-001–004/009–012 | Collector, Raw Source, Source Provenance, Publication, System Error | API-018 | UI-009–013/031/033/034 | AI-001–003/007 | TEST-008/014/023/036/037 | SP-010 | REL-005 | Integration Owner | PLANNED |
| IMP-020 | EPIC-009 | FEAT-020 | DEV-020 | WF-001–012 | Source Registry, AI Job, Publication, System Error | API-019 | UI-006/031/033–036 | AI-001–007 | TEST-004/006/008/023/025/035–037/049/053 | SP-010 | REL-005 | Integration/Security Owner | PLANNED |
| IMP-021 | EPIC-010 | FEAT-021 | DEV-021 | WF-001–012 | User Action, Audit Event, Approval History | API-001–019 | UI-001–037 | AI-001–007 displayed | TEST-038/054/055 | SP-005 | REL-001 | UI/UAT Owner | PLANNED |
| IMP-022 | EPIC-006 | FEAT-022 | DEV-022 | WF-002–006 | AI Job, AI Result, Source Provenance, Requirement, Match Result | API-004–006/009/010/017 | UI-008/011–018/021/023/024 | AI-001–007 | TEST-007/013/015–019/039–045 | SP-003 | REL-001 | AI Owner | PLANNED |
| IMP-023 | EPIC-002 | FEAT-023 | DEV-023 | WF-001–012 | User, Role, Contact, Client, Retention Policy, Legal Hold, Audit Event, System Error | API-001–019 | UI-001–037 | AI-001–007 data | TEST-046–053 | SP-001 | REL-001 | Security/Privacy/Operations Owner | PLANNED |
| IMP-024 | EPIC-001 | FEAT-024 | DEV-024 | WF-001–012 | Audit Event, Decision History, Approval History, System Error | API-001–019 | UI-001–037 | AI-001–007 | TEST-001–056 | SP-000 | REL-001–005 | Development/Quality/Release Owner | PLANNED |

## Coverage contract

- Implementation: `IMP-001`, `IMP-002`, `IMP-003`, `IMP-004`, `IMP-005`, `IMP-006`, `IMP-007`, `IMP-008`, `IMP-009`, `IMP-010`, `IMP-011`, `IMP-012`, `IMP-013`, `IMP-014`, `IMP-015`, `IMP-016`, `IMP-017`, `IMP-018`, `IMP-019`, `IMP-020`, `IMP-021`, `IMP-022`, `IMP-023`, `IMP-024`.
- Epic: `EPIC-001`, `EPIC-002`, `EPIC-003`, `EPIC-004`, `EPIC-005`, `EPIC-006`, `EPIC-007`, `EPIC-008`, `EPIC-009`, `EPIC-010`.
- Feature: `FEAT-001`, `FEAT-002`, `FEAT-003`, `FEAT-004`, `FEAT-005`, `FEAT-006`, `FEAT-007`, `FEAT-008`, `FEAT-009`, `FEAT-010`, `FEAT-011`, `FEAT-012`, `FEAT-013`, `FEAT-014`, `FEAT-015`, `FEAT-016`, `FEAT-017`, `FEAT-018`, `FEAT-019`, `FEAT-020`, `FEAT-021`, `FEAT-022`, `FEAT-023`, `FEAT-024`.
- Developer Task: `DEV-001`, `DEV-002`, `DEV-003`, `DEV-004`, `DEV-005`, `DEV-006`, `DEV-007`, `DEV-008`, `DEV-009`, `DEV-010`, `DEV-011`, `DEV-012`, `DEV-013`, `DEV-014`, `DEV-015`, `DEV-016`, `DEV-017`, `DEV-018`, `DEV-019`, `DEV-020`, `DEV-021`, `DEV-022`, `DEV-023`, `DEV-024`.
- Sprint: `SP-000`, `SP-001`, `SP-002`, `SP-003`, `SP-004`, `SP-005`, `SP-006`, `SP-007`, `SP-008`, `SP-009`, `SP-010`; Release: `REL-001`, `REL-002`, `REL-003`, `REL-004`, `REL-005`.
- Requirements: `REQ-CONST-001`, `REQ-CONST-002`, `REQ-CONST-003`, `REQ-CONST-004`, `REQ-CONST-005`, `REQ-CONST-006`, `REQ-CONST-007`, `REQ-CONST-008`, `REQ-CONST-009`, `REQ-CONST-010`, `REQ-CONST-011`, `REQ-CONST-012`, `REQ-CONST-013` through linked DEV source rows.
- Workflows: `WF-001`, `WF-002`, `WF-003`, `WF-004`, `WF-005`, `WF-006`, `WF-007`, `WF-008`, `WF-009`, `WF-010`, `WF-011`, `WF-012`.
- APIs: `API-001`, `API-002`, `API-003`, `API-004`, `API-005`, `API-006`, `API-007`, `API-008`, `API-009`, `API-010`, `API-011`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-018`, `API-019`.
- Screens: `UI-001`, `UI-002`, `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`, `UI-008`, `UI-009`, `UI-010`, `UI-011`, `UI-012`, `UI-013`, `UI-014`, `UI-015`, `UI-016`, `UI-017`, `UI-018`, `UI-019`, `UI-020`, `UI-021`, `UI-022`, `UI-023`, `UI-024`, `UI-025`, `UI-026`, `UI-027`, `UI-028`, `UI-029`, `UI-030`, `UI-031`, `UI-032`, `UI-033`, `UI-034`, `UI-035`, `UI-036`, `UI-037`.
- AI: `AI-001`, `AI-002`, `AI-003`, `AI-004`, `AI-005`, `AI-006`, `AI-007`.
- Tests: `TEST-001`, `TEST-002`, `TEST-003`, `TEST-004`, `TEST-005`, `TEST-006`, `TEST-007`, `TEST-008`, `TEST-009`, `TEST-010`, `TEST-011`, `TEST-012`, `TEST-013`, `TEST-014`, `TEST-015`, `TEST-016`, `TEST-017`, `TEST-018`, `TEST-019`, `TEST-020`, `TEST-021`, `TEST-022`, `TEST-023`, `TEST-024`, `TEST-025`, `TEST-026`, `TEST-027`, `TEST-028`, `TEST-029`, `TEST-030`, `TEST-031`, `TEST-032`, `TEST-033`, `TEST-034`, `TEST-035`, `TEST-036`, `TEST-037`, `TEST-038`, `TEST-039`, `TEST-040`, `TEST-041`, `TEST-042`, `TEST-043`, `TEST-044`, `TEST-045`, `TEST-046`, `TEST-047`, `TEST-048`, `TEST-049`, `TEST-050`, `TEST-051`, `TEST-052`, `TEST-053`, `TEST-054`, `TEST-055`, `TEST-056`; canonical definitions are in [Test Registry](../book-10/15_TEST_REGISTRY.md).
- Entity names use [Data Dictionary](../book-3/15_DATA_DICTIONARY.md) canonical values.
- Every DEV/Feature/IMP appears exactly once as a primary row. Every Sprint and Release has at least one mapped Feature/Test path.

## Governance

new implementation plan은 duplicate check 후 next ID를 발급한다. split/replacement/cancellation은 history를 보존하며 scope, dependencies, risk, Sprint, Release와 tests를 함께 갱신한다.

## Post-freeze implementation progress metadata

아래 overlay는 frozen canonical planning row를 변경하지 않는 실행 metadata다. `IMP-024`의 architecture mapping은 위 frozen row를 유지한다.

| Implementation ID | Sprint | Execution status | Architecture change | Evidence | Updated |
|---|---|---|---|---|---|
| IMP-024 | SP-000 | DONE | None | [Sprint 0 Completion](../development/SPRINT0_COMPLETION.md), [Sprint 0 Task Status](../development/SPRINT0_TASK_STATUS.md) | 2026-07-15 |
| IMP-014 | SP-008 | COMPLETED_ACCEPTED_FROZEN | None | GOV-001 `c7ad5b0a2ad6bd243abe81cd3c00c3599a29ad1b`; SP-008 `0c9f2a519a3ea21d6f0de8d7b6e8c5a1ed64373a`; [SP-008 Test Evidence](../development/SP008_TEST_EVIDENCE.md), [SP-008 Completion](../reviews/SP-008_COMPLETION.md) | 2026-07-23 |
