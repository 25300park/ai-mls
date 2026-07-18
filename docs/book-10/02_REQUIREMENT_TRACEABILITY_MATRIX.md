# Requirement Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Architecture Owner |
| 기준일 | 2026-07-15 |

## Purpose

[Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md)의 canonical 13 requirements를 workflow, entity, API, screen, AI와 test case에 연결한다. Entity와 downstream set은 minimum coverage이며 [Test Registry](15_TEST_REGISTRY.md)가 세부 SEC/OPS mapping을 제공한다.

## Complete matrix

| Requirement | Requirement summary | Workflow | Entity | API | Screen | AI Capability | Test Case |
|---|---|---|---|---|---|---|---|
| REQ-CONST-001 | AI recommends | WF-003–006 | AI Job, AI Result, Candidate Listing, Requirement, Match Result | API-004/006/009/010/017/019 | UI-013/015/023/024 | AI-001–007 | TEST-007, TEST-013, TEST-039–045 |
| REQ-CONST-002 | Humans approve | WF-002–010 | Approval History, Verification, Permission, Publication Approval | API-004/006/009–014 | UI-012/016/023–030 | N/A — human authority | TEST-001, TEST-020–022 |
| REQ-CONST-003 | No publication without verification | WF-007/009/010 | Verification, Publication Approval, Publication | API-011/013/014 | UI-027/029–031 | N/A — AI cannot verify | TEST-002, TEST-022/023 |
| REQ-CONST-004 | No publication without permission | WF-007/009/010 | Permission, Publication Approval, Publication | API-012–014 | UI-028–031 | N/A — AI cannot grant | TEST-003, TEST-022/023 |
| REQ-CONST-005 | No loss of provenance | WF-001–004/010 | Raw Source, Source Provenance, AI Result, Publication | API-004–006/014/016–019 | UI-011–018/031/035 | AI-001–003/007 | TEST-004, TEST-014–017, TEST-037 |
| REQ-CONST-006 | No hidden architecture changes | WF-012 | Decision History, Approval History, Audit Event | API-015/016 | UI-035/036 | N/A — governance | TEST-005, TEST-053/056 |
| REQ-CONST-007 | Important actions auditable | WF-001–012 | Audit Event, User Action, Status History, Approval History | API-001–019 | UI-001–037 | AI Job/Result trace | TEST-006, TEST-034/037/049/053 |
| REQ-CONST-008 | No direct AI production authority | WF-003–006 | AI Job, AI Result, Candidate Listing, Requirement, Match Result | API-004/006/009/010/017/019 | UI-013/015/023/024 | AI-001–007 | TEST-007, TEST-039–045 |
| REQ-CONST-009 | No connector bypass | WF-001–004/009/010/012 | Collector, Raw Source, Publication, System Error | API-004/014/018/019 | UI-009–013/031/033/034 | AI-001–003/007 after intake | TEST-008, TEST-036/037 |
| REQ-CONST-010 | No privilege escalation | WF-001–012 | User, Role, Team, User Action | API-001/002/015/016 | UI-001–037 | N/A — security control | TEST-009, TEST-026/034/035/046/047 |
| REQ-CONST-011 | Candidate is not verified | WF-002/007 | Candidate Listing, Verification, Availability | API-004/006/011 | UI-012/015/026/027 | AI-001/002/007 advisory | TEST-010, TEST-015/020 |
| REQ-CONST-012 | Verified is not published | WF-007/009/010 | Verification, Publication Approval, Publication | API-011–014 | UI-027–031 | N/A — human publication | TEST-011, TEST-020/022/023 |
| REQ-CONST-013 | Client share permission differs from public permission | WF-007–010 | Permission, Client Proposal, Publication Approval, Publication | API-012–014 | UI-025/028–031 | N/A — human permission | TEST-012, TEST-021–023 |

## Coverage result

Requirements defined: 13. Requirements with test: 13. Orphan requirement: 0. Test IDs are defined in [Test Registry](15_TEST_REGISTRY.md); execution evidence remains future work.

## Change impact

Requirement/Workflow/Entity/API/UI/AI/SEC/OPS 변경 시 affected matrix row와 all linked TEST IDs를 review하고 regression scope를 갱신한다. Requirement 삭제/대체는 Constitution governance 없이는 허용하지 않는다.

