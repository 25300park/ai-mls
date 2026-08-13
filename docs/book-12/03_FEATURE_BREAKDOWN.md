# Feature Breakdown

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-004 |
| 문서 버전 | v1.2 |
| 상태 | FROZEN |
| 소유 역할 | Product Owner / Development Owner |
| 기준일 | 2026-07-15 |

## Feature rules

Feature는 하나의 primary `DEV-*`를 구현 가능한 acceptance slice로 계획한다. row는 approved implementation이나 final API/schema/UI를 의미하지 않는다.

## Registry

| Feature ID | Epic | Feature | Developer Task | Workflow | Entity | API | Screen | AI | Test |
|---|---|---|---|---|---|---|---|---|---|
| FEAT-001 | EPIC-002 | Identity and session boundary | DEV-001 | WF-001–012 | User, Role, User Action, Audit Event | API-001/002 | UI-001/006/035/036 | N/A | TEST-026/046 |
| FEAT-002 | EPIC-002 | Authentication contract adapter | DEV-002 | WF-001–012 | User, Role, Team | API-001 | UI-001 | N/A | TEST-026/046 |
| FEAT-003 | EPIC-002 | Authorization/session enforcement | DEV-003 | WF-001–012 | User, Role, Team, Approval History | API-002 | UI-001–037 | N/A | TEST-009/026/046/047 |
| FEAT-004 | EPIC-003 | Source registry access and intake handoff | DEV-004 | WF-001 | approved Source Registry read dependency, Collector, Raw Source; non-authoritative source candidate | API-003 | UI-009/010 | N/A | TEST-014/027/036 |
| FEAT-005 | EPIC-003 | Intake processing contract | DEV-005 | WF-001–003 | Intake, Raw Source, Candidate Listing, AI Job | API-004 | UI-011–015 | AI-001/002/007 | TEST-004/015/016/027/039/040 |
| FEAT-006 | EPIC-004 | Property read/search contract | DEV-006 | WF-002–007 | Property, Property Alias, Candidate Listing | API-005 | UI-008/014/017/018 | AI-002/006/007 | TEST-028/040/044 |
| FEAT-007 | EPIC-004 | Candidate and duplicate contract | DEV-007 | WF-002–004/006/007 | Candidate Listing, Listing Offer, Duplicate Group, Decision History | API-006 | UI-012/015–018 | AI-001–003/007 | TEST-007/010/017/028/039–041 |
| FEAT-008 | EPIC-005 | Contact privacy contract | DEV-008 | WF-007/008/011 | Contact, Contact Channel, Contact Case, Communication | API-007 | UI-019/020 | N/A | TEST-020/029/048 |
| FEAT-009 | EPIC-005 | Client contract | DEV-009 | WF-005/008 | Client, Contact, Requirement | API-008 | UI-021/022 | AI-004/006/007 | TEST-018/030/048 |
| FEAT-010 | EPIC-005 | Requirement lifecycle contract | DEV-010 | WF-005/006/008 | Requirement, Requirement History, Budget, Location Preference | API-009 | UI-021–024 | AI-004/006/007 | TEST-018/030/042/044/045 |
| FEAT-011 | EPIC-006 | Matching contract | DEV-011 | WF-006/008/011 | Match Result, Requirement, Candidate Listing | API-010 | UI-024/025 | AI-005–007 | TEST-019/031/043–045 |
| FEAT-012 | EPIC-007 | Verification authority contract | DEV-012 | WF-007/009–011 | Verification, Availability, Approval History | API-011 | UI-026/027/029–032 | AI-007 support | TEST-002/010/011/020/022/024/032/051 |
| FEAT-013 | EPIC-007 | Permission authority contract | DEV-013 | WF-007–011 | Permission, Approval History, Contact Channel | API-012 | UI-026/028–032 | AI-007 support | TEST-003/012/020–022/024/032 |
| FEAT-014 | EPIC-007 | Proposal and approval contract | DEV-014 | WF-008/009 | Client Proposal, Publication Approval, Immutable Representation Snapshot, Verification, Permission; Publication Target read-only dependency | API-013 | UI-025/028–030 | N/A | TEST-021/022/033 SP-008 partition |
| FEAT-015 | EPIC-007 | Publication external-effect contract | DEV-015 | WF-010–012 | Publication, Publication Target, Published Listing Projection, Status History, System Error | API-014 | UI-031–033/035 | N/A | TEST-002–004/008/011/012/023–025/033 FEAT-015 partition/049 |
| FEAT-016 | EPIC-008 | Administration contract | DEV-016 | WF-001–012 | User, Role, Team, Decision History | API-015 | UI-006/036 | N/A | TEST-005/034/037/048/053 |
| FEAT-017 | EPIC-008 | Audit evidence contract | DEV-017 | WF-001–012 | Audit Event, User Action, Status History, Approval History | API-016 | UI-035/036 | AI metadata | TEST-004–006/017/022/025/034/046/049/051/053 |
| FEAT-018 | EPIC-008 | Background job contract | DEV-018 | WF-003/006/010–012 | AI Job, AI Result, System Error | API-017 | UI-034 | AI-001–007 | TEST-016/024/025/035/039–043/045/051 |
| FEAT-019 | EPIC-009 | Connector isolation contract | DEV-019 | WF-001–004/009–012 | Collector, Raw Source, Source Provenance, Publication, System Error | API-018 | UI-009–013/031/033/034 | AI-001–003/007 | TEST-008/014/023/036/037 |
| FEAT-020 | EPIC-009 | External integration lifecycle | DEV-020 | WF-001–012 | Source Registry, AI Job, Publication, System Error | API-019 | UI-006/031/033–036 | AI-001–007 | TEST-004/006/008/023/025/035–037/049/053 |
| FEAT-021 | EPIC-010 | UI and accessibility boundary | DEV-021 | WF-001–012 | User Action, Audit Event, Approval History | API-001–019 | UI-001–037 | AI-001–007 displayed | TEST-038/054/055 |
| FEAT-022 | EPIC-006 | AI advisory capability boundary | DEV-022 | WF-002–006 | AI Job, AI Result, Source Provenance, Requirement, Match Result | API-004–006/009/010/017 | UI-008/011–018/021/023/024 | AI-001–007 | TEST-007/013/015–019/039–045 |
| FEAT-023 | EPIC-002 | Security/privacy/operations controls | DEV-023 | WF-001–012 | User, Role, Contact, Client, Retention Policy, Legal Hold, Audit Event, System Error | API-001–019 | UI-001–037 | AI-001–007 data | TEST-046–053 |
| FEAT-024 | EPIC-001 | Release trace and acceptance evidence | DEV-024 | WF-001–012 | Audit Event, Decision History, Approval History, System Error | API-001–019 | UI-001–037 | AI-001–007 | TEST-001–056 |

## Coverage

EPIC-001–010, FEAT-001–024와 DEV-001–024는 orphan 없이 연결된다. Canonical ID 의미는 각 source registry를 따른다.

## Post-freeze FEAT-016 scope overlay

`DEC-114`와 `CR-026`은 frozen planning row의 ID를 바꾸지 않고 FEAT-016 execution evidence와 ownership을 다음처럼 명확히 한다.

- Execution status: `PARTIALLY_IMPLEMENTED_BASELINE`; SP-001 Role Assignment subset은 유효한 역사적 baseline이고 FEAT-016 전체는 incomplete다.
- Owned administration scope: User/identity administration reference, Role, Role Assignment, Team/organizational scope, Policy administration, Source Registry governance state, Publication Target governance state와 Decision History/administration evidence.
- Source Registry ownership은 governance proposal lifecycle, policy/review/approval/administrative status transition뿐이며 ingestion, crawler, parser 또는 connector execution을 포함하지 않는다. FEAT-004/API-003은 approved policy read와 non-authoritative candidate submission handoff만 소유하며 policy decision 또는 activation authority를 갖지 않는다.
- Publication Target ownership은 governance policy/proposal/review/approval/administrative status뿐이며 Publication Aggregate/lifecycle/execution, connector dispatch, reconciliation, Event Journal 또는 PRJ-002 mutation을 포함하지 않는다.
- Retention Policy/Legal Hold business authority는 Privacy/Data Governance/Legal/Security에 유지되며 core FEAT-016 scope가 아니다.
- AI capability는 `N/A`; AI/service/connector/job은 administration approval 또는 authority activation을 수행하지 않는다.

상세 trace와 implementation gap은 [FEAT-016 Implementation Traceability](../implementation/FEAT016_TRACEABILITY_MATRIX.md)를 따른다.
