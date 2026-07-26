# AI-MLS Projection Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-049 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Projection catalog index

| Projection ID | Name | Type | Primary source | Purpose |
|---|---|---|---|---|
| PRJ-001 | Search Projection | Search | Property/Candidate/Requirement/Publication | authorized discovery |
| PRJ-002 | Listing Projection | Listing | Publication | safe published-listing read model |
| PRJ-003 | Client Projection | Client | Client/Requirement/Match/Proposal/Permission | assigned-client workflow read |
| PRJ-004 | Dashboard Projection | Dashboard | domain/operational summaries | bounded operational visibility |
| PRJ-005 | Analytics Projection | Analytics | minimized domain/audit facts | governed metrics and trends |
| PRJ-006 | Notification Projection | Notification | auditable workflow outcomes | recipient-scoped notification state |
| PRJ-007 | Integration Projection | Integration | integration/publication evidence | partner feed and mapping view |
| PRJ-008 | Cache Projection | Cache | approved canonical/read-model source | bounded read acceleration |

Canonical source Event mapping은 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 `EVT-001`~`EVT-012`를 따른다. Rebuild/Replay는 Event를 재해석하거나 business side effect를 재실행하지 않는다.

## Lifecycle index

`BUILDING → ACTIVE → STALE/REBUILDING/FAILED → ACTIVE/ARCHIVED`

허용 상태는 `BUILDING`, `ACTIVE`, `STALE`, `REBUILDING`, `FAILED`, `ARCHIVED`뿐이다. 이 lifecycle은 aggregate business lifecycle과 독립이다.

## Version and rebuild index

- Versions: Aggregate, Event, Projection Definition, Projection Schema, Projection Record, Rebuild Generation.
- Rebuild: Single Projection, Aggregate Projection, Projection Family, Full Projection, Snapshot Restore, Event Replay.
- Projection은 항상 재생성 가능해야 하며 rebuild/replay는 source Aggregate/Event/Audit를 변경하지 않는다.

상세 definition, owner, classification, drift, rebuild, dependency와 test mapping은 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)를 따른다.

## Cross-references

- [Decision Register](00_DECISION_REGISTER.md)
- [Publication Registry](00_PUBLICATION_REGISTRY.md)
- [Workflow Registry](00_WORKFLOW_REGISTRY.md)
- [API Registry](00_API_REGISTRY.md)
- [Security Registry](00_SECURITY_REGISTRY.md)
- [Canonical Event Registry](00_EVENT_REGISTRY.md)
- [Event and Job Architecture](book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)
- [Projection Validation Report](reviews/PHASE11_7_PROJECTION_VALIDATION.md)
- [Projection Coverage Report](reviews/PHASE11_7_PROJECTION_COVERAGE.md)
