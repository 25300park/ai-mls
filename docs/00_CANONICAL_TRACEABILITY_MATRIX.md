# Canonical Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-035 |
| 문서 버전 | v1.2 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Quality Owner |
| 기준일 | 2026-07-15 |
| 승인 근거 | Phase 15 correction authorization; [Phase 14 Recommendations](reviews/PHASE14_RECOMMENDATIONS.md) |

이 문서는 AI MLS Platform Architecture Bible의 단일 authoritative traceability record다. 기존 Book별 matrix와 registry는 각 domain의 상세 근거이며, end-to-end 연결의 존재 여부와 orphan 판정은 이 문서를 기준으로 한다. 연결 규칙은 [End-to-End Traceability Rule](00_TRACEABILITY_RULE.md)을 따른다.

## Canonical chain

`Requirement → Workflow → Entity → API → Screen → AI Capability → Developer Task → Sprint → Release → Test`

- 모든 node는 해당 canonical registry 또는 Book 문서에서 정의된 ID나 entity name을 사용한다.
- AI가 의사결정에 관여하지 않는 행은 `N/A` 대신 통제 이유를 명시한다. 이는 AI node가 누락된 것이 아니라 의도적으로 비적용임을 뜻한다.
- 하나의 행이 여러 node를 포함할 때 en dash range 또는 slash-separated ID list는 해당 범위의 모든 canonical node를 포함한다.
- `VERIFIED`는 문서 간 ID 연결과 대상 존재가 검증되었다는 뜻이며 구현 또는 runtime test 완료를 뜻하지 않는다.

## Authoritative matrix

| Trace ID | Requirement | Workflow | Entity | API | Screen | AI Capability | Developer Task | Sprint | Release | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TRACE-001 | REQ-CONST-007, REQ-CONST-010 | WF-001–012 | User, Role, User Action, Audit Event | API-001, API-002 | UI-001, UI-006, UI-035, UI-036 | N/A — identity and authority are deterministic controls | DEV-001 | SP-001 | REL-001 | TEST-026, TEST-046 | VERIFIED |
| TRACE-002 | REQ-CONST-007, REQ-CONST-010 | WF-001–012 | User, Role, Team | API-001 | UI-001 | N/A — organization membership is a deterministic control | DEV-002 | SP-001 | REL-001 | TEST-026, TEST-046 | VERIFIED |
| TRACE-003 | REQ-CONST-002, REQ-CONST-007, REQ-CONST-010, REQ-CONST-013 | WF-001–012 | User, Role, Team, Approval History | API-002 | UI-001–037 | N/A — permission enforcement cannot be delegated to AI | DEV-003 | SP-001 | REL-001 | TEST-009, TEST-026, TEST-046, TEST-047 | VERIFIED |
| TRACE-004 | REQ-CONST-005, REQ-CONST-009 | WF-001 | Source Registry, Collector, Raw Source | API-003 | UI-009, UI-010 | N/A — source policy is a human-governed control | DEV-004 | SP-002 | REL-001 | TEST-014, TEST-027, TEST-036 | VERIFIED |
| TRACE-005 | REQ-CONST-001, REQ-CONST-005, REQ-CONST-008, REQ-CONST-009, REQ-CONST-011 | WF-001–003 | Intake, Raw Source, Candidate Listing, AI Job | API-004 | UI-011–015 | AI-001, AI-002, AI-007 | DEV-005 | SP-002 | REL-001 | TEST-004, TEST-015, TEST-016, TEST-027, TEST-039, TEST-040 | VERIFIED |
| TRACE-006 | REQ-CONST-005, REQ-CONST-010, REQ-CONST-011 | WF-002–007 | Property, Property Alias, Candidate Listing | API-005 | UI-008, UI-014, UI-017, UI-018 | AI-002, AI-006, AI-007 | DEV-006 | SP-003 | REL-001 | TEST-028, TEST-040, TEST-044 | VERIFIED |
| TRACE-007 | REQ-CONST-001, REQ-CONST-002, REQ-CONST-005, REQ-CONST-008, REQ-CONST-011 | WF-002–004, WF-006, WF-007 | Candidate Listing, Listing Offer, Duplicate Group, Decision History | API-006 | UI-012, UI-015–018 | AI-001–003, AI-007 | DEV-007 | SP-003 | REL-001 | TEST-007, TEST-010, TEST-017, TEST-028, TEST-039–041 | VERIFIED |
| TRACE-008 | REQ-CONST-007, REQ-CONST-010, REQ-CONST-013 | WF-007, WF-008, WF-011 | Contact, Contact Channel, Contact Case, Communication | API-007 | UI-019, UI-020 | N/A — privacy and contact access are deterministic controls | DEV-008 | SP-004 | REL-001 | TEST-020, TEST-029, TEST-048 | VERIFIED |
| TRACE-009 | REQ-CONST-001, REQ-CONST-002, REQ-CONST-007, REQ-CONST-010 | WF-005, WF-008 | Client, Contact, Requirement | API-008 | UI-021, UI-022 | AI-004, AI-006, AI-007 | DEV-009 | SP-004 | REL-001 | TEST-018, TEST-030, TEST-048 | VERIFIED |
| TRACE-010 | REQ-CONST-001, REQ-CONST-002, REQ-CONST-007, REQ-CONST-008 | WF-005, WF-006, WF-008 | Requirement, Requirement History, Budget, Location Preference | API-009 | UI-021–024 | AI-004, AI-006, AI-007 | DEV-010 | SP-004 | REL-001 | TEST-018, TEST-030, TEST-042, TEST-044, TEST-045 | VERIFIED |
| TRACE-011 | REQ-CONST-001, REQ-CONST-002, REQ-CONST-008, REQ-CONST-011 | WF-006, WF-008, WF-011 | Match Result, Requirement, Candidate Listing | API-010 | UI-024, UI-025 | AI-005–007 | DEV-011 | SP-005 | REL-001 | TEST-019, TEST-031, TEST-043–045 | VERIFIED |
| TRACE-012 | REQ-CONST-002, REQ-CONST-003, REQ-CONST-010–012 | WF-007, WF-009–011 | Verification, Availability, Approval History | API-011 | UI-026, UI-027, UI-029–032 | AI-007 — evidence support only; human review required | DEV-012 | SP-006 | REL-002 | TEST-002, TEST-010, TEST-011, TEST-020, TEST-022, TEST-024, TEST-032, TEST-051 | VERIFIED |
| TRACE-013 | REQ-CONST-002–004, REQ-CONST-010, REQ-CONST-013 | WF-007–011 | Permission, Approval History, Contact Channel | API-012 | UI-026, UI-028–032 | AI-007 — evidence support only; no approval authority | DEV-013 | SP-007 | REL-002 | TEST-003, TEST-012, TEST-020–022, TEST-024, TEST-032 | VERIFIED |
| TRACE-014 | REQ-CONST-002–004, REQ-CONST-007, REQ-CONST-010, REQ-CONST-012, REQ-CONST-013 | WF-008, WF-009 | Client Proposal, Publication Approval, Immutable Representation Snapshot, Verification, Permission; Publication Target is read-only dependency only | API-013 | UI-025, UI-028–030 | N/A — human approval is mandatory | DEV-014 | SP-008 | REL-003 | TEST-021, TEST-022, TEST-033 SP-008 Approval/Effective Approval/Safe Boundary partition | VERIFIED |
| TRACE-015 | REQ-CONST-002–007, REQ-CONST-009, REQ-CONST-012, REQ-CONST-013 | WF-010–012 | Publication, Publication Target, Published Listing Projection, Status History, System Error | API-014 | UI-031–033, UI-035 | N/A — publication authority is deterministic and human-approved | DEV-015 | `PENDING ARCHITECTURE OWNER DECISION` | REL-004 | TEST-002–004, TEST-008, TEST-011, TEST-012, TEST-023–025, TEST-033 FEAT-015 Delivery/Reconciliation/Publication Lifecycle partition, TEST-049 | VERIFIED |
| TRACE-016 | REQ-CONST-006, REQ-CONST-007, REQ-CONST-010 | WF-001–012 | User, Role, Team, Decision History | API-015 | UI-006, UI-036 | N/A — administration is permission-controlled | DEV-016 | SP-001 | REL-001 | TEST-005, TEST-034, TEST-037, TEST-048, TEST-053 | VERIFIED |
| TRACE-017 | REQ-CONST-005–007, REQ-CONST-010 | WF-001–012 | Audit Event, User Action, Status History, Approval History | API-016 | UI-035, UI-036 | AI-001–007 metadata is audited; AI cannot alter audit truth | DEV-017 | SP-001 | REL-001 | TEST-004–006, TEST-017, TEST-022, TEST-025, TEST-034, TEST-046, TEST-049, TEST-051, TEST-053 | VERIFIED |
| TRACE-018 | REQ-CONST-007, REQ-CONST-008, REQ-CONST-010 | WF-003, WF-006, WF-010–012 | AI Job, AI Result, System Error | API-017 | UI-034 | AI-001–007 | DEV-018 | SP-002 | REL-001 | TEST-016, TEST-024, TEST-025, TEST-035, TEST-039–043, TEST-045, TEST-051 | VERIFIED |
| TRACE-019 | REQ-CONST-005, REQ-CONST-007, REQ-CONST-009, REQ-CONST-010 | WF-001–004, WF-009–012 | Collector, Raw Source, Source Provenance, Publication, System Error | API-018 | UI-009–013, UI-031, UI-033, UI-034 | AI-001–003, AI-007 | DEV-019 | SP-010 | REL-005 | TEST-008, TEST-014, TEST-023, TEST-036, TEST-037 | VERIFIED |
| TRACE-020 | REQ-CONST-005–010 | WF-001–012 | Source Registry, AI Job, Publication, System Error | API-019 | UI-006, UI-031, UI-033–036 | AI-001–007 | DEV-020 | SP-010 | REL-005 | TEST-004, TEST-006, TEST-008, TEST-023, TEST-025, TEST-035–037, TEST-049, TEST-053 | VERIFIED |
| TRACE-021 | REQ-CONST-002, REQ-CONST-007, REQ-CONST-010–013 | WF-001–012 | User Action, Audit Event, Approval History | API-001–019 | UI-001–037 | AI-001–007 output is displayed with provenance and confidence | DEV-021 | SP-005 | REL-001 | TEST-038, TEST-054, TEST-055 | VERIFIED |
| TRACE-022 | REQ-CONST-001, REQ-CONST-002, REQ-CONST-005, REQ-CONST-008, REQ-CONST-011 | WF-002–006 | AI Job, AI Result, Source Provenance, Requirement, Match Result | API-004–006, API-009, API-010, API-017 | UI-008, UI-011–018, UI-021, UI-023, UI-024 | AI-001–007 | DEV-022 | SP-003 | REL-001 | TEST-007, TEST-013, TEST-015–019, TEST-039–045 | VERIFIED |
| TRACE-023 | REQ-CONST-002, REQ-CONST-005–007, REQ-CONST-010, REQ-CONST-013 | WF-001–012 | User, Role, Contact, Client, Retention Policy, Legal Hold, Audit Event, System Error | API-001–019 | UI-001–037 | AI-001–007 data access follows security controls | DEV-023 | SP-001 | REL-001 | TEST-046–053 | VERIFIED |
| TRACE-024 | REQ-CONST-001–013 | WF-001–012 | All 52 entities in Book 3 Data Dictionary, including Raw Attachment, Listing Source, Building, Tower, Floor, Unit, Matching Preference, Verifier Assignment, Reverification Request, Retention Job | API-001–019 | UI-001–037 | AI-001–007 | DEV-024 | SP-000–010 | REL-001–005 | TEST-001–056 | VERIFIED |

## Coverage summary

| Node type | Canonical target | Covered | Orphan |
|---|---:|---:|---:|
| Requirement | 13 | 13 | 0 |
| Workflow | 12 | 12 | 0 |
| Entity | 52 | 52 | 0 |
| API | 19 | 19 | 0 |
| Screen | 37 | 37 | 0 |
| AI Capability | 7 | 7 | 0 |
| Developer Task | 24 | 24 | 0 |
| Sprint | 11 (`SP-000`–`SP-010`) | 11 | 0 |
| Release | 5 | 5 | 0 |
| Test | 56 | 56 | 0 |

Coverage counts are verified by [Phase 15 Validation Report](reviews/PHASE15_VALIDATION_REPORT.md). The entity total follows all primary-identifier entity rows in the [Data Dictionary](book-3/15_DATA_DICTIONARY.md).

## Source registries and evidence

- Requirements: [Project Constitution](book-0/00_PROJECT_CONSTITUTION.md) and [Test Traceability Matrix](book-10/02_REQUIREMENT_TRACEABILITY_MATRIX.md)
- Workflows: [Workflow Registry](book-5/00_WORKFLOW_INDEX.md)
- Entities: [Data Dictionary](book-3/15_DATA_DICTIONARY.md)
- APIs: [API Registry](book-6/16_API_REGISTRY.md)
- Screens: [Screen Registry](book-7/15_SCREEN_REGISTRY.md)
- AI capabilities: [AI Capability Registry](book-4/00_AI_ARCHITECTURE_INDEX.md)
- Developer tasks: [Developer Registry](book-11/15_DEVELOPER_REGISTRY.md)
- Sprints and delivery mapping: [Implementation Traceability](book-12/08_IMPLEMENTATION_TRACEABILITY.md) and [Implementation Registry](book-12/15_IMPLEMENTATION_REGISTRY.md)
- Releases: [Release Registry](book-12/14_RELEASE_REGISTRY.md)
- Tests: [Test Registry](book-10/15_TEST_REGISTRY.md)

## Change control

1. Any canonical node addition, removal, split, merge, or ID change must update its source registry and this matrix in the same approved change request.
2. A `TRACE-*` ID is permanent. Replacement uses a new ID and explicit supersession evidence.
3. No row may be marked `VERIFIED` when a referenced node is absent, duplicated, or lacks an authoritative definition.
4. Implementation progress changes DEV/IMP/REL semantic status but does not change this matrix's documentation-link verification status.
5. Architecture freeze requires zero orphan node and a fresh link/ID/coverage validation report.
