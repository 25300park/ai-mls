# AI-MLS Workflow Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-043 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Canonical workflows

| Workflow ID | Name | Primary boundary | Registry status |
|---|---|---|---|
| WF-001 | Listing Discovery | approved discovery to intake request | VERIFIED |
| WF-002 | Manual Intake | evidence to candidate draft/disposition | VERIFIED |
| WF-003 | AI Processing | advisory closed-schema processing | VERIFIED |
| WF-004 | Duplicate Review | suggestion to human disposition | VERIFIED |
| WF-005 | Client Requirement | need to versioned Requirement lifecycle | VERIFIED |
| WF-006 | Matching | eligible inputs to reviewed shortlist | VERIFIED |
| WF-007 | Contact and Verification | purpose-bound evidence to human decision | VERIFIED |
| WF-008 | Client Proposal | permission-scoped client sharing | VERIFIED |
| WF-009 | Publication Approval | exact representation to human approval decision | VERIFIED |
| WF-010 | Publication | authorized command to confirmed/reconciliation state | PARTIALLY_VERIFIED |
| WF-011 | Expiration and Reverification | drift/expiry to restored or blocked eligibility | PARTIALLY_VERIFIED |
| WF-012 | Exception and Recovery | contained failure to resolution/recovery | PARTIALLY_VERIFIED |

Publication/Projection workflow가 발행하거나 소비하는 immutable fact identity는 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 `EVT-001`~`EVT-012`를 따른다. Event는 Workflow를 실행하거나 authority를 생성하지 않는다.

## Required path index

| Path | Owner | Commands |
|---|---|---|
| WFP-001 Intake | WF-002 | intake registration commands |
| WFP-002 Verification | WF-007 | verification commands |
| WFP-003 Review | WF-009 | approval commands |
| WFP-004 Publication | WF-010 | Publish |
| WFP-005 Reconciliation | WF-010, WF-012 | Resolve |
| WFP-006 Withdrawal | WF-010, WF-012 | Withdraw, Resolve |
| WFP-007 Republish | WF-010, WF-012 | Republish, Resolve |
| WFP-008 Recovery | WF-012 | Recover, Resolve |

`WFP-*`는 path identifier이며 신규 canonical Workflow가 아니다. 상세 entry/exit, authorization, API, Registry와 Test mapping은 [Canonical Workflow Registry](00_WORKFLOW_REGISTRY.md)를 따른다.

## Command index

| Command | Owner | Authority rule |
|---|---|---|
| Publish | WF-010 | exact approval/binding과 live revalidation |
| Withdraw | WF-010 | dedicated authorization과 non-exposure evidence |
| Republish | WF-010 | new authorization/command/attempt; no replay |
| Revalidate | WF-010, WF-011 | validation-only; no external effect |
| Resolve | WF-010, WF-012 | independent reconciliation authority |
| Recover | WF-012 | current authority/SoD와 new recovery identity |

Projection Update, Search Index, Dashboard Refresh, Cache Refresh와 Analytics Refresh는 workflow command가 아니다.

## Cross-references

- [Canonical Event Registry](00_EVENT_REGISTRY.md)
- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Canonical API Registry](00_API_REGISTRY.md)
- [Book 5 Workflow Index](book-5/00_WORKFLOW_INDEX.md)
- [Publication Registry](00_PUBLICATION_REGISTRY.md)
- [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md)
- [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Workflow Validation Report](reviews/PHASE11_4_WORKFLOW_VALIDATION.md)
- [Workflow Coverage Report](reviews/PHASE11_4_WORKFLOW_COVERAGE.md)
