# Screen Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-016 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |

> Phase 15 synchronization: `UI-001–037`의 end-to-end coverage는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)를 따른다. `POST-MVP` scope는 그대로 유지한다.

## Purpose

`UI-001`–`UI-037`의 canonical identity, workflow/entity/API/AI/permission/owner/status mapping을 관리한다. 세부 inputs/actions는 [Screen Specifications](05_SCREEN_SPECIFICATIONS.md)가 소유한다.

## Status rule

`DEFINED`는 logical architecture가 정의되었다는 trace status이며 구현 또는 approval 완료를 뜻하지 않는다. `POST-MVP`는 미래 범위다. Document lifecycle status와 별도 namespace다.

## Registry

| ID | Screen | Workflow | Entity | API | AI | Permission | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| UI-001 | Sign In | WF-001–012 | User, Role, User Action | API-001/002 | N/A security | session-own | Security Owner | DEFINED |
| UI-002 | Collector Dashboard | WF-001/002 | Collector, Source Registry, Intake | API-002–004/016/018 | AI-001/002/007 | collector read | Source/Intake Owner | DEFINED |
| UI-003 | Agent Dashboard | WF-005–008/011 | Client, Requirement, Match Result, Client Proposal | API-002/008–013/016 | AI-004–007 | assigned-agent read | Business Owner | DEFINED |
| UI-004 | Reviewer Dashboard | WF-003/004/007/009/011 | AI Result, Duplicate Group, Verification, Permission, Publication Approval | API-002/006/011–013/016 | AI-001–007 | assigned reviewer | Review Owners | DEFINED |
| UI-005 | Manager Dashboard | WF-001–012 | Team, Audit Event, System Error | API-002/015/016 | N/A projection | manager scope | Business Owner | DEFINED |
| UI-006 | Administrator Dashboard | WF-001–012 | User, Role, AI Job, System Error | API-001/002/015–019 | AI-007 | admin scope | Administration Owner | DEFINED |
| UI-007 | Future External Partner Dashboard | WF-001/002/007/009/010 | Organization, Raw Source, Publication | API-001/002/004/011–014/018/019 | AI-001/002/007 | partner scope assumption | Integration Owner | POST-MVP |
| UI-008 | Global Search | WF-002/005/006 | Property, Candidate Listing, Requirement, Match Result | API-002/005/006/009/010 | AI-006/007 | entity read scopes | Business Owner | DEFINED |
| UI-009 | Source Registry | WF-001 | Source Registry, Collector | API-002/003/015/016 | N/A policy | source read/propose/admin | Source Policy Owner | DEFINED |
| UI-010 | Discovery Queue | WF-001 | Source Registry, Raw Source, Collector | API-003/004/018 | N/A pre-intake | collector capture | Source Data Owner | DEFINED |
| UI-011 | Manual Intake | WF-002 | Intake, Raw Source, Raw Attachment, Source Provenance | API-004 | AI-001/002/007 | collector draft | Intake Owner | DEFINED |
| UI-012 | Intake Review | WF-002 | Intake, Candidate Listing, Source Provenance | API-004–006/016 | AI-001/002/007 | assigned senior reviewer | Listing Data Owner | DEFINED |
| UI-013 | AI Review Queue | WF-003 | AI Job, AI Result, Intake | API-004/017/019 | AI-001–007 | AI reviewer | AI Reviewer | DEFINED |
| UI-014 | Candidate List | WF-002/004/006/007 | Candidate Listing, Listing Offer, Availability | API-005/006 | AI-006/007 | listing read | Listing Data Owner | DEFINED |
| UI-015 | Candidate Detail | WF-002–004/006/007 | Candidate Listing, Listing Offer, Source Provenance, Availability | API-005/006/011/016 | AI-001–003/007 | listing action scope | Listing Data Owner | DEFINED |
| UI-016 | Duplicate Review | WF-004 | Duplicate Group, Candidate Listing, Decision History | API-006/016 | AI-003/007 | duplicate reviewer | Duplicate Review Owner | DEFINED |
| UI-017 | Property Master Search | WF-002–004/006 | Location, Property, Building, Tower, Floor, Unit, Property Alias | API-005 | AI-002/006/007 | property read/propose | Property Data Steward | DEFINED |
| UI-018 | Property Detail | WF-002–004/006 | Property, Building, Tower, Floor, Unit, Property Alias | API-005/016 | AI-002/007 | steward decision | Property Data Steward | DEFINED |
| UI-019 | Contact List | WF-007/008/011 | Contact, Contact Case, Contact Channel | API-002/007/016 | N/A privacy | purpose-scoped read | Privacy/Contact Owner | DEFINED |
| UI-020 | Contact Detail and Case | WF-007/011 | Contact, Contact Channel, Contact Case, Communication | API-007/011/016 | N/A human contact | assigned purpose scope | Privacy/Contact Owner | DEFINED |
| UI-021 | Client List | WF-005/008 | Client, Contact, Requirement | API-008/009 | AI-006 | agent/team read | Business Owner | DEFINED |
| UI-022 | Client Detail | WF-005/008 | Client, Communication, Requirement, Client Proposal | API-007–009/013/016 | AI-004/006/007 | assigned agent | Business Owner | DEFINED |
| UI-023 | Requirement Editor | WF-005 | Requirement, Budget, Location Preference, Matching Preference, Requirement History | API-009 | AI-004/006/007 | assigned agent | Requirement Owner | DEFINED |
| UI-024 | Matching Workspace | WF-006 | Match Result, Requirement, Candidate Listing, Listing Offer | API-010/017 | AI-005–007 | agent/reviewer | Matching Owner | DEFINED |
| UI-025 | Client Proposal | WF-008 | Client Proposal, Match Result, Permission, Communication | API-012/013/016 | N/A human share | agent/senior approval | Business Owner | DEFINED |
| UI-026 | Verification Queue | WF-007/011 | Verification, Verifier Assignment, Permission, Reverification Request | API-011/012 | AI-007 | assigned verifier/reviewer | Verification Owner | DEFINED |
| UI-027 | Verification Detail | WF-007/011 | Verification, Availability, Verifier Assignment, Approval History | API-007/011/016 | AI-007 support | human verifier | Verification Owner | DEFINED |
| UI-028 | Permission Review | WF-007–011 | Permission, Verification, Approval History | API-011/012/016 | N/A human authority | permission reviewer | Permission Owner | DEFINED |
| UI-029 | Publication Approval Queue | WF-009 | Publication Approval, Publication, Approval History | API-013/016 | N/A human approval | publication approver | Publication Approval Owner | DEFINED |
| UI-030 | Publication Approval Detail | WF-009 | Publication Approval, Verification, Permission, Publication | API-011–013/016 | N/A human approval | independent approver | Publication Approval Owner | DEFINED |
| UI-031 | Publication Operations | WF-010–012 | Publication, Publication Target, Status History, System Error | API-014/018/019 | N/A external control | owner/reconciler | Publication Owner | DEFINED |
| UI-032 | Expiration and Reverification | WF-011 | Reverification Request, Verification, Permission, Publication | API-011/012/014/017 | AI-007 support | scoped renewal roles | Verification Owner | DEFINED |
| UI-033 | Exception Recovery | WF-012 | System Error, Audit Event, Decision History | API-014/016–019 | related capability only | named recovery owner | Operations Owner | DEFINED |
| UI-034 | Background Jobs | WF-003/006/010–012 | AI Job, AI Result, Retention Job, System Error | API-017–019 | AI-001–007 when AI job | domain/operations | Operations Owner | DEFINED |
| UI-035 | Audit Explorer | WF-001–012 | Audit Event, Decision History, Status History, Approval History, User Action | API-016 | N/A evidence | security/governance | Security/Governance Owner | DEFINED |
| UI-036 | Role and Policy Administration | WF-001–012 | User, Role, Team, Source Registry, Publication Target, Retention Policy | API-015/016 | N/A administration | admin separated scopes | Administration Owner | DEFINED |
| UI-037 | Notification Center | WF-001–012 | Audit Event, System Error, Approval History, AI Job | API-002/016/017 and API-003–015/018/019 source capability | AI-001–007 when source is AI Job; otherwise N/A — notification projection | recipient scope | Business/Operations Owner | DEFINED |

## Coverage validation contract

- ID uniqueness: exactly one registry row per `UI-001`–`UI-037`.
- every row has workflow, entity, API, AI or justified N/A, permission, owner와 status.
- workflow coverage: `WF-001`, `WF-002`, `WF-003`, `WF-004`, `WF-005`, `WF-006`, `WF-007`, `WF-008`, `WF-009`, `WF-010`, `WF-011`, `WF-012`.
- API coverage: `API-001`, `API-002`, `API-003`, `API-004`, `API-005`, `API-006`, `API-007`, `API-008`, `API-009`, `API-010`, `API-011`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-018`, `API-019`.
- AI coverage: `AI-001`, `AI-002`, `AI-003`, `AI-004`, `AI-005`, `AI-006`, `AI-007`.
- test placeholder: all rows `PLANNED — Book 10`; Phase: Phase 8.
- registry row alone은 runtime route, permission grant 또는 implementation commitment가 아니다.
