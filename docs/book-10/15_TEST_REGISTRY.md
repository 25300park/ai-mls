# Test Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-016 |
| 문서 버전 | v1.1 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Architecture Owner |
| 기준일 | 2026-07-15 |

> Phase 15 synchronization: `TEST-001–056`은 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)의 terminal validation node다. `VERIFIED` trace는 test execution 완료를 뜻하지 않는다.

## Purpose

Phase 11 logical test identity와 Requirement/WF/Entity/API/UI/AI/SEC/OPS/owner/status mapping의 canonical source다. `DEFINED`는 specification complete일 뿐 executed/passed가 아니다.

## Registry

| Test ID | Test | Requirement ID | Workflow ID | Entity | API | Screen | AI Capability | Security Control | Operation | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TEST-001 | Human approval bypass rejection | REQ-CONST-002 | WF-002–010 | Approval History, Verification, Permission, Publication Approval | API-004/006/009–014 | UI-012/016/023–030 | N/A — human authority | SEC-010/011/021 | OPS-008/014 | Business/Quality Owner | DEFINED |
| TEST-002 | Publication without valid Verification rejection | REQ-CONST-003 | WF-007/009/010 | Verification, Publication Approval, Publication | API-011/013/014 | UI-027/029–031 | N/A — AI cannot verify | SEC-011/021 | OPS-014/032 | Publication/Quality Owner | DEFINED |
| TEST-003 | Publication without public Permission rejection | REQ-CONST-004 | WF-007/009/010 | Permission, Publication Approval, Publication | API-012–014 | UI-028–031 | N/A — AI cannot grant | SEC-011/021 | OPS-014/032 | Publication/Quality Owner | DEFINED |
| TEST-004 | Source provenance end-to-end preservation | REQ-CONST-005 | WF-001–004/010 | Raw Source, Source Provenance, AI Result, Publication | API-004–006/014/016–019 | UI-011–018/031/035 | AI-001–003/007 | SEC-013/021/031/032 | OPS-001/013/031/032 | Data/Quality Owner | DEFINED |
| TEST-005 | Governed architecture/change trace | REQ-CONST-006 | WF-012 | Decision History, Approval History, Audit Event | API-015/016 | UI-035/036 | N/A — governance | SEC-021/022/026 | OPS-003–009/026 | Architecture/Quality Owner | DEFINED |
| TEST-006 | Important action audit completeness | REQ-CONST-007 | WF-001–012 | Audit Event, User Action, Status History, Approval History | API-001–019 | UI-001–037 | AI Job/Result trace when applicable | SEC-021–024 | OPS-013/029 | Security/Quality Owner | DEFINED |
| TEST-007 | AI direct authoritative write rejection | REQ-CONST-001/008 | WF-003–006 | AI Job, AI Result, Candidate Listing, Requirement, Match Result | API-004/006/009/010/017/019 | UI-013/015/023/024 | AI-001–007 | SEC-001/010/021/031 | OPS-014/021/031 | AI/Quality Owner | DEFINED |
| TEST-008 | Connector/core/publication bypass rejection | REQ-CONST-009 | WF-001–004/009/010/012 | Collector, Raw Source, Publication, System Error | API-004/014/018/019 | UI-009–013/031/033/034 | AI-001–003/007 after intake | SEC-006/025/032 | OPS-031/032 | Integration/Quality Owner | DEFINED |
| TEST-009 | Role privilege escalation and object access rejection | REQ-CONST-010 | WF-001–012 | User, Role, Team, User Action | API-001/002/015/016 | UI-001–037 | N/A — security authority | SEC-001–010/033 | OPS-028/029 | Security/Quality Owner | DEFINED |
| TEST-010 | Candidate and Verification lifecycle separation | REQ-CONST-011 | WF-002/007 | Candidate Listing, Verification, Availability | API-004/006/011 | UI-012/015/026/027 | AI-001/002/007 advisory | SEC-010/011/021 | OPS-014 | Business/Quality Owner | DEFINED |
| TEST-011 | Verification does not create Publication | REQ-CONST-012 | WF-007/009/010 | Verification, Publication Approval, Publication | API-011–014 | UI-027–031 | N/A — human publication | SEC-011/021 | OPS-014/032 | Publication/Quality Owner | DEFINED |
| TEST-012 | Client-share and public Permission separation | REQ-CONST-013 | WF-007–010 | Permission, Client Proposal, Publication Approval, Publication | API-012–014 | UI-025/028–031 | N/A — human permission | SEC-010/011/015 | OPS-014 | Business/Privacy/Quality Owner | DEFINED |
| TEST-013 | AI advisory display, confidence and human review | REQ-CONST-001/002/008 | WF-003–006 | AI Job, AI Result | API-004/006/009/010/017 | UI-013/015/023/024 | AI-001–007 | SEC-014/021/031 | OPS-014/031 | AI/UAT Owner | DEFINED |
| TEST-014 | Listing discovery workflow | REQ-CONST-005/009 | WF-001 | Source Registry, Raw Source, Collector | API-003/004/018 | UI-002/009/010 | N/A — pre-intake | SEC-006/013/032 | OPS-014/031 | Source/Quality Owner | DEFINED |
| TEST-015 | Manual intake validation and candidate registration | REQ-CONST-005/011 | WF-002 | Intake, Raw Source, Candidate Listing | API-004–006 | UI-011/012/015 | AI-001/002/007 | SEC-013/014/021 | OPS-014 | Intake/Quality Owner | DEFINED |
| TEST-016 | AI processing workflow and fallback | REQ-CONST-001/008 | WF-003 | AI Job, AI Result, Intake | API-004/017/019 | UI-013/034 | AI-001–007 | SEC-021/031 | OPS-021/031/032 | AI/Quality Owner | DEFINED |
| TEST-017 | Duplicate human disposition | REQ-CONST-001/002/011 | WF-004 | Duplicate Group, Candidate Listing, Decision History | API-006/016 | UI-016 | AI-003/007 | SEC-010/021 | OPS-014 | Duplicate/Quality Owner | DEFINED |
| TEST-018 | Client Requirement lifecycle | REQ-CONST-001/002 | WF-005 | Requirement, Requirement History, Budget, Location Preference | API-008/009 | UI-021–023 | AI-004/006/007 | SEC-014/015/021 | OPS-014 | Requirement/Quality Owner | DEFINED |
| TEST-019 | Matching, hard filters and shortlist | REQ-CONST-001/002 | WF-006 | Match Result, Requirement, Candidate Listing | API-010/017 | UI-024 | AI-005–007 | SEC-014/021/031 | OPS-014/023 | Matching/Quality Owner | DEFINED |
| TEST-020 | Contact and Verification workflow | REQ-CONST-002/003/011/012 | WF-007 | Contact Case, Verification, Availability | API-007/011/012 | UI-019/020/026–028 | AI-007 support only | SEC-010/011/014/015 | OPS-014 | Verification/Quality Owner | DEFINED |
| TEST-021 | Client Proposal sharing control | REQ-CONST-002/013 | WF-008 | Client Proposal, Match Result, Permission, Communication | API-012/013 | UI-025/028 | N/A — human share | SEC-010/011/015/021 | OPS-014 | Business/Quality Owner | DEFINED |
| TEST-022 | Publication approval exact snapshot, target/channel and actor-level SoD | REQ-CONST-002–004/007/010/012/013 | WF-009 | Publication Approval, Immutable Representation Snapshot, Verification, Permission, Approval History; Publication Target read-only dependency | API-011–013/016 | UI-029/030/035 | N/A — human `PUA` approval | SEC-001/002/004/007/008/010/011/013–015/021/025/028/030 | OPS-008/014 | Publication/Security/Quality Owner | DEFINED |
| TEST-023 | Publication delivery, unknown and reconciliation | REQ-CONST-003/004/007/012/013 | WF-010 | Publication, Publication Target, Status History, System Error | API-014/018/019 | UI-031/033/035 | N/A — external effect | SEC-011/021/024/032 | OPS-014/031/032 | Publication/Operations/Quality Owner | DEFINED |
| TEST-024 | Expiration and reverification restriction | REQ-CONST-002–004/012/013 | WF-011 | Reverification Request, Verification, Permission, Publication | API-011/012/014/017 | UI-032 | AI-007 support only | SEC-010/011/021 | OPS-010/014 | Verification/Quality Owner | DEFINED |
| TEST-025 | Exception containment, retry and recovery | REQ-CONST-006/007/010 | WF-012 | System Error, Audit Event, Decision History | API-014/016–019 | UI-033/034/035 | related AI only; no authority | SEC-024–028 | OPS-015/025/032 | Operations/Quality Owner | DEFINED |
| TEST-026 | Authentication/session API contract | REQ-CONST-007/010 | WF-001–012 | User, Role, User Action | API-001/002 | UI-001 | N/A — identity | SEC-003–009 | OPS-028/029 | Security/Quality Owner | DEFINED |
| TEST-027 | Source/intake API validation | REQ-CONST-005/009/011 | WF-001–003 | Source Registry, Intake, Raw Source | API-003/004 | UI-009–013 | AI-001/002/007 | SEC-006/013/014/032 | OPS-031 | API/Quality Owner | DEFINED |
| TEST-028 | Property/listing API concurrency and duplicate | REQ-CONST-005/011 | WF-002–004/006/007 | Property, Candidate Listing, Duplicate Group | API-005/006 | UI-014–018 | AI-002/003/006/007 | SEC-013/021 | OPS-023 | API/Data/Quality Owner | DEFINED |
| TEST-029 | Contact API purpose/masking/audit | REQ-CONST-007/010/013 | WF-007/008/011 | Contact, Contact Channel, Contact Case, Communication | API-007 | UI-019/020 | N/A — privacy control | SEC-012–015/021 | OPS-029 | Privacy/API/Quality Owner | DEFINED |
| TEST-030 | Client/Requirement API lifecycle | REQ-CONST-001/002/007 | WF-005/008 | Client, Requirement, Requirement History | API-008/009 | UI-021–023 | AI-004/006/007 | SEC-014/015/021 | OPS-014 | API/Quality Owner | DEFINED |
| TEST-031 | Matching API eligibility/staleness | REQ-CONST-001/002/011 | WF-006/008/011 | Match Result, Requirement, Candidate Listing | API-010 | UI-024/025 | AI-005–007 | SEC-014/021 | OPS-023 | API/Quality Owner | DEFINED |
| TEST-032 | Verification/Permission API authority | REQ-CONST-002–004/010/013 | WF-007–011 | Verification, Permission, Approval History | API-011/012 | UI-026–032 | AI-007 support only | SEC-004/010/011/021 | OPS-014 | API/Security/Quality Owner | DEFINED |
| TEST-033 | Publication contract partition: Approval/effective safe boundary versus delivery/reconciliation lifecycle | REQ-CONST-002–004/007/010/012/013 | SP-008: WF-008/009; FEAT-015: WF-010–012 | SP-008: Client Proposal, Publication Approval, Immutable Representation Snapshot; FEAT-015: Publication, Publication Target, Published Listing Projection | SP-008: API-013; FEAT-015: API-014 | SP-008: UI-025/029/030; FEAT-015: UI-031–033 | N/A — human/external authority separated | SEC-001/002/004/010/011/013–015/021/024/025/028/030/032 | OPS-009/014/032 | API/Publication/Security/Quality Owner | DEFINED — partitioned ownership |
| TEST-034 | Administration and audit API | REQ-CONST-006/007/010 | WF-001–012 | User, Role, Audit Event, Decision History | API-015/016 | UI-006/035/036 | N/A — administration | SEC-001–010/021–023/033 | OPS-026–030 | Security/API/Quality Owner | DEFINED |
| TEST-035 | Background job contract | REQ-CONST-007/008/010 | WF-003/006/010–012 | AI Job, AI Result, System Error | API-017 | UI-034 | AI-001–007 when AI job | SEC-006/021/024/031 | OPS-012/013/032 | Operations/API/Quality Owner | DEFINED |
| TEST-036 | Connector contract isolation | REQ-CONST-005/007/009/010 | WF-001–004/009–012 | Collector, Raw Source, Publication, System Error | API-018 | UI-009–013/031/033/034 | AI-001–003/007 after intake | SEC-006/023/024/032 | OPS-031/032 | Integration/Quality Owner | DEFINED |
| TEST-037 | External integration lifecycle | REQ-CONST-005–010 | WF-001–012 | Source Registry, AI Job, Publication, System Error | API-019 | UI-006/031/033–036 | AI-001–007 where applicable | SEC-006/013–15/17/20/21/31/32 | OPS-031/032 | Integration/Security/Quality Owner | DEFINED |
| TEST-038 | UI screen/action/accessibility coverage | REQ-CONST-002/007/010–013 | WF-001–012 | User Action, Audit Event, Approval History | API-001–019 | UI-001–037 | AI-001–007 where displayed | SEC-001/002/010–15/021 | OPS-014/021 | UI/UAT/Quality Owner | DEFINED |
| TEST-039 | Listing parser evaluation | REQ-CONST-001/005/008 | WF-002/003 | AI Job, AI Result, Intake, Candidate Listing | API-004/006/017 | UI-011–015 | AI-001/007 | SEC-013/014/031 | OPS-031 | AI Reviewer | DEFINED |
| TEST-040 | Property normalization evaluation | REQ-CONST-001/005/008 | WF-003 | AI Job, AI Result, Property, Property Alias | API-004–006/017 | UI-013/017/018 | AI-002/007 | SEC-013/031 | OPS-031 | AI/Data Reviewer | DEFINED |
| TEST-041 | Duplicate detection evaluation | REQ-CONST-001/008/011 | WF-004 | AI Result, Duplicate Group, Candidate Listing | API-006/017 | UI-013/016 | AI-003/007 | SEC-013/031 | OPS-031 | AI/Duplicate Reviewer | DEFINED |
| TEST-042 | Requirement parser evaluation | REQ-CONST-001/008 | WF-005 | AI Result, Requirement, Requirement History | API-009/017 | UI-013/023 | AI-004/007 | SEC-014/015/031 | OPS-031 | AI/Business Reviewer | DEFINED |
| TEST-043 | Matching/ranking evaluation | REQ-CONST-001/008/011 | WF-006 | AI Result, Match Result, Requirement | API-010/017 | UI-013/024 | AI-005/007 | SEC-014/031 | OPS-023/031 | AI/Matching Reviewer | DEFINED |
| TEST-044 | Natural-language search evaluation | REQ-CONST-001/008/010 | WF-005/006 | AI Result, Property, Requirement, Match Result | API-005/009/010 | UI-008/017/021/024 | AI-006/007 | SEC-002/014/031 | OPS-023/031 | AI/Search Reviewer | DEFINED |
| TEST-045 | Confidence, schema, hallucination and human review | REQ-CONST-001/002/005/008 | WF-003–006 | AI Job, AI Result, Source Provenance | API-004/006/009/010/017 | UI-013/015/023/024 | AI-001–007 | SEC-014/021/031 | OPS-014/031 | AI/Quality Owner | DEFINED |
| TEST-046 | Authentication/MFA/session security | REQ-CONST-007/010 | WF-001–012 | User, Role, User Action, Audit Event | API-001/002/016 | UI-001/006/035/036 | N/A — security | SEC-003–009/021/023 | OPS-005/028/029 | Security Reviewer | DEFINED |
| TEST-047 | Authorization/SoD/privileged access security | REQ-CONST-002/010/013 | WF-001–012 | User, Role, Team, Approval History | API-002/011–016 | UI-004/006/026–036 | N/A — security authority | SEC-001/002/010–012/033/034 | OPS-008/027–030 | Security/Business Reviewer | DEFINED |
| TEST-048 | Privacy/classification/export/deletion security | REQ-CONST-005/007/010/013 | WF-001–012 | Contact, Client, Raw Source, Retention Policy, Legal Hold | API-004/007–010/015–019 | UI-008–025/033–036 | AI-001–007 data handling | SEC-012–016/018/021/023/031 | OPS-002/011/016/029/030 | Privacy Reviewer | DEFINED |
| TEST-049 | Audit/log/key/event/incident security | REQ-CONST-006/007/010 | WF-012 | Audit Event, System Error, Decision History, User Action | API-001/002/014–019 | UI-006/031/033–036 | AI event metadata only | SEC-017–028 | OPS-005/012/013/015/025/027/029 | Security Operations Reviewer | DEFINED |
| TEST-050 | Performance, load, backpressure and scaling | REQ-CONST-007/010 | WF-001–012 | AI Job, Match Result, Publication, System Error | API-001–019 | UI-005/006/008/024/031/034 | AI-005/006 where measured | SEC-001/002/024/026/031/032 | OPS-022–024/032 | Performance/Operations Owner | DEFINED |
| TEST-051 | Backup integrity, restore and recovery audit | REQ-CONST-005–007/010 | WF-011/012 | Retention Job, Verification, Permission, Publication, Audit Event | API-011–017 | UI-006/031–036 | AI Result if restored | SEC-016/018/019/021/022/028–030 | OPS-016–018 | Data/Operations/Security Owner | DEFINED |
| TEST-052 | Disaster recovery and business continuity | REQ-CONST-002–010 | WF-001–012 | System Error, Audit Event, Status History, Decision History | API-001–019 | UI-001–037 | AI-001–007 affected/fallback | SEC-025/027–030 | OPS-019–021 | DR/Business/Quality Owner | DEFINED |
| TEST-053 | Deployment/release/change/monitoring operations | REQ-CONST-006/007/010 | WF-001–012 | Decision History, Approval History, Audit Event, System Error | API-015–019 | UI-006/031/033–036 | N/A — operations governance | SEC-001/002/010/021–027/033 | OPS-001–015/025–032 | Operations/Quality Owner | DEFINED |
| TEST-054 | Collector/Agent/Reviewer UAT | REQ-CONST-001–005/007–013 | WF-001–011 | Intake, Candidate Listing, Client, Requirement, Verification, Permission, Publication | API-003–014 | UI-002–004/008–032/037 | AI-001–007 | SEC-001/002/010–15/021 | OPS-014/020/021 | Business/UAT Owner | DEFINED |
| TEST-055 | Manager/Administrator/Operations UAT | REQ-CONST-006/007/010 | WF-001–012 | User, Role, Audit Event, System Error | API-001/002/015–019 | UI-005/006/031–037 | AI job visibility only | SEC-001–10/021–30/033 | OPS-010–15/22–30 | Business/Operations UAT Owner | DEFINED |
| TEST-056 | Regression and release acceptance gate | REQ-CONST-001–013 | WF-001–012 | Audit Event, Decision History, Approval History, System Error | API-001–019 | UI-001–037 | AI-001–007 | SEC-001–034 | OPS-001–032 | Quality/Release Owner | DEFINED |

## GOV-001 TEST-022 acceptance coverage

`TEST-022`는 다음 승인 권한 경계를 명시적으로 검증한다.

- requester conflict;
- exact snapshot creator/editor conflict;
- verifier conflict;
- referenced Permission decision-maker conflict;
- Publication executor/reconciler conflict;
- role stacking과 session role switching;
- MFA와 documented reason;
- authorized `PUA` approve, reject, revoke;
- scheduler-only expiry와 expiry 연장 금지;
- break-glass approval rejection;
- recovery/replay 시 actor와 authority 재검증;
- 하나의 Approval에 대한 exact Target, Channel, Policy Version binding;
- Service Actor, Connector, AI Actor의 decision prohibition.

## GOV-001 TEST-033 ownership partition

- SP-008은 approval request/read/queue/review/claim/decision/revoke/expiry, `CheckEffectiveApproval`, idempotency와 delivery를 수행하지 않는 safe boundary를 소유한다.
- FEAT-015는 delivery, reconciliation, `UNKNOWN`, correction, suspend, withdraw, republish와 Publication lifecycle을 소유한다.
- SP-008 partition의 통과는 FEAT-015 partition의 통과를 의미하지 않는다.

## Coverage contract

- Tests: `TEST-001`–`TEST-056`, exactly one row each.
- Requirements: `REQ-CONST-001`, `REQ-CONST-002`, `REQ-CONST-003`, `REQ-CONST-004`, `REQ-CONST-005`, `REQ-CONST-006`, `REQ-CONST-007`, `REQ-CONST-008`, `REQ-CONST-009`, `REQ-CONST-010`, `REQ-CONST-011`, `REQ-CONST-012`, `REQ-CONST-013`.
- Workflows: `WF-001`, `WF-002`, `WF-003`, `WF-004`, `WF-005`, `WF-006`, `WF-007`, `WF-008`, `WF-009`, `WF-010`, `WF-011`, `WF-012`.
- APIs: `API-001`, `API-002`, `API-003`, `API-004`, `API-005`, `API-006`, `API-007`, `API-008`, `API-009`, `API-010`, `API-011`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-018`, `API-019`.
- Screens: `UI-001`, `UI-002`, `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`, `UI-008`, `UI-009`, `UI-010`, `UI-011`, `UI-012`, `UI-013`, `UI-014`, `UI-015`, `UI-016`, `UI-017`, `UI-018`, `UI-019`, `UI-020`, `UI-021`, `UI-022`, `UI-023`, `UI-024`, `UI-025`, `UI-026`, `UI-027`, `UI-028`, `UI-029`, `UI-030`, `UI-031`, `UI-032`, `UI-033`, `UI-034`, `UI-035`, `UI-036`, `UI-037`.
- AI capabilities: `AI-001`, `AI-002`, `AI-003`, `AI-004`, `AI-005`, `AI-006`, `AI-007`.
- Security controls: `SEC-001`, `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, `SEC-007`, `SEC-008`, `SEC-009`, `SEC-010`, `SEC-011`, `SEC-012`, `SEC-013`, `SEC-014`, `SEC-015`, `SEC-016`, `SEC-017`, `SEC-018`, `SEC-019`, `SEC-020`, `SEC-021`, `SEC-022`, `SEC-023`, `SEC-024`, `SEC-025`, `SEC-026`, `SEC-027`, `SEC-028`, `SEC-029`, `SEC-030`, `SEC-031`, `SEC-032`, `SEC-033`, `SEC-034`.
- Operational controls: `OPS-001`, `OPS-002`, `OPS-003`, `OPS-004`, `OPS-005`, `OPS-006`, `OPS-007`, `OPS-008`, `OPS-009`, `OPS-010`, `OPS-011`, `OPS-012`, `OPS-013`, `OPS-014`, `OPS-015`, `OPS-016`, `OPS-017`, `OPS-018`, `OPS-019`, `OPS-020`, `OPS-021`, `OPS-022`, `OPS-023`, `OPS-024`, `OPS-025`, `OPS-026`, `OPS-027`, `OPS-028`, `OPS-029`, `OPS-030`, `OPS-031`, `OPS-032`.
- Entity names use [Data Dictionary](../book-3/15_DATA_DICTIONARY.md) canonical values.

## Governance

Test replacement preserves supersession/history. Requirement/artifact/control change triggers impact review and regression update. Registry row alone is not execution evidence; result/evidence/defect/reviewer must be recorded separately.
