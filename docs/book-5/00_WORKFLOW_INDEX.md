# Book 5 — Workflow Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Business Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

> Phase 15 synchronization: end-to-end coverage authority는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)이며 `WF-001–012`의 workflow meaning은 이 Book에서 유지한다.

## Purpose

Book 5는 AI MLS의 end-to-end business workflow, state transition, approval, exception와 recovery를 정의한다. 이 문서는 logical orchestration과 authority contract이며 implementation code, API, queue product, UI 또는 Phase 7 integration contract가 아니다.

## Navigation and workflow IDs

| Workflow ID | Document ID | 문서 | Primary aggregate/outcome |
|---|---|---|---|
| WF-001 | DOC-WF-002 | [Listing Discovery](01_LISTING_DISCOVERY_WORKFLOW.md) | approved discovery → intake request |
| WF-002 | DOC-WF-003 | [Manual Intake](02_MANUAL_INTAKE_WORKFLOW.md) | raw evidence → candidate draft |
| WF-003 | DOC-WF-004 | [AI Processing](03_AI_PROCESSING_WORKFLOW.md) | AI Job/Result → reviewed advisory draft |
| WF-004 | DOC-WF-005 | [Duplicate Review](04_DUPLICATE_REVIEW_WORKFLOW.md) | suggestion → human disposition |
| WF-005 | DOC-WF-006 | [Client Requirement](05_CLIENT_REQUIREMENT_WORKFLOW.md) | original need → active versioned Requirement |
| WF-006 | DOC-WF-007 | [Matching](06_MATCHING_WORKFLOW.md) | eligible inputs → reviewed shortlist candidates |
| WF-007 | DOC-WF-008 | [Contact and Verification](07_CONTACT_AND_VERIFICATION_WORKFLOW.md) | contact evidence → Verification + separate Permission request |
| WF-008 | DOC-WF-009 | [Client Proposal](08_CLIENT_PROPOSAL_WORKFLOW.md) | eligible match → permission-scoped client sharing |
| WF-009 | DOC-WF-010 | [Publication Approval](09_PUBLICATION_APPROVAL_WORKFLOW.md) | exact representation → human approval/rejection |
| WF-010 | DOC-WF-011 | [Publication](10_PUBLICATION_WORKFLOW.md) | approved command → reconciled external state |
| WF-011 | DOC-WF-012 | [Expiration and Reverification](11_EXPIRATION_AND_REVERIFICATION_WORKFLOW.md) | expiry signal → blocked/reverified/restored eligibility |
| WF-012 | DOC-WF-013 | [Exception and Recovery](12_EXCEPTION_AND_RECOVERY_WORKFLOW.md) | failure/conflict → contained recovery/closure |
| Cross-cutting | DOC-WF-014 | [Status Dictionary](13_STATUS_DICTIONARY.md) | canonical business status semantics |
| Cross-cutting | DOC-WF-015 | [State Transition Rules](14_STATE_TRANSITION_RULES.md) | complete allowed/forbidden transition matrix |

## End-to-end chain

`Discovery → Intake → AI-assisted Processing → Duplicate Review → Candidate/Offer → Requirement → Matching → Verification + Permission → Client Proposal and/or Publication Approval → Publication → Expiration/Reverification → Recovery`

Each arrow is a preconditioned handoff, not an automatic authority upgrade.

## Mandatory principles

1. Every workflow and important action is auditable.
2. Human approval is required exactly where defined and cannot be simulated by AI/job/connector.
3. No workflow bypass: downstream eligibility rechecks canonical prerequisites.
4. Authority is explicit for actor, aggregate, action and scope.
5. Every state is traceable to an allowed transition, actor/job, reason, time and evidence.
6. Every exception has containment, owner, recovery/rollback or explicit terminal disposition.
7. Candidate is not Verified; Verified is not Published; Permission is not Verification.
8. Retry/replay is idempotent and cannot restore expired/revoked authority.

## Status notation

Business status uses `AGGREGATE.STATUS`, for example `VERIFICATION.VERIFIED` and `PUBLICATION.PUBLISHED`. This avoids confusing same-name statuses across aggregates and avoids collision with document lifecycle status such as `DRAFT` or `APPROVED`.

## Workflow aggregate to entity mapping

| Aggregate | Canonical entities |
|---|---|
| `DISCOVERY` | Source Registry, Raw Source |
| `INTAKE` | Intake |
| `AI_JOB`, `AI_RESULT` | AI Job, AI Result |
| `AI_REVIEW` | AI Result, Decision History, Approval History |
| `DUPLICATE` | Duplicate Group |
| `REQUIREMENT` | Requirement, Requirement History |
| `MATCH` | Match Result |
| `CONTACT_CASE` | Contact Case, Communication |
| `VERIFICATION` | Verification |
| `PERMISSION` | Permission |
| `PROPOSAL` | Client Proposal |
| `PUBLICATION_APPROVAL` | Publication Approval, Approval History |
| `PUBLICATION` | Publication, Status History |
| `REVERIFICATION` | Reverification Request |
| `EXCEPTION` | System Error, Audit Event |

각 workflow aggregate는 위 canonical entity 또는 evidence projection에 매핑된다. 복수 entity mapping은 하나의 새 aggregate authority를 만들지 않는다.

## Trace bindings

WF-001–012 implement `REQ-CONST-001`–`013`, `DB-001`–`015` and `AI-001`–`007` as applicable. API mappings are defined by `API-001`–`019` in [Book 6 API Registry](../book-6/16_API_REGISTRY.md); UI/test/phase links remain planned for later Books.

> **OPEN DECISION:** named workflow owners, service targets, reviewer/approver delegation, two-person approval triggers and operational escalation SLA.
