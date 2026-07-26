# Publication Index — Phase 11-3

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-041 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Publication Owner |
| 기준일 | 2026-07-24 |
| Registry | [Canonical Publication Registry](00_PUBLICATION_REGISTRY.md) |

## Purpose

Publication aggregate, lifecycle, version, authorization, Withdrawal, Republish와 Projection reference를 빠르게 탐색하는 index다. Normative meaning은 Canonical Publication Registry가 소유한다.

Event fact identity와 replay boundary는 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 `EVT-001`~`EVT-012`를 따른다.

## State index

| State | Registry ID | Terminality | Notes |
|---|---|---|---|
| `READY` | PUB-STATE-001 | non-terminal | first command or no-effect retry eligible |
| `EXECUTION_PENDING` | PUB-STATE-002 | non-terminal | operation context required |
| `ACTIVE` | PUB-STATE-003 | non-terminal | confirmed external effect |
| `RECONCILIATION_REQUIRED` | PUB-STATE-004 | non-terminal, fail closed | new effect prohibited until resolution |
| `WITHDRAWAL_PENDING` | PUB-STATE-005 | non-terminal, restricted | Republish prohibited |
| `WITHDRAWN` | PUB-STATE-006 | terminal for normal mutation | AO-034 Republish refinement only |
| `SUPERSEDED` | PUB-STATE-007 | terminal | successor confirmed active |
| `TERMINATED` | PUB-STATE-008 | terminal | no active external effect |

## Operation index

| Operation | Identity behavior | Required authority | State contract |
|---|---|---|---|
| Initial Publish | same Publication, new command/Attempt | effective Approval plus command authorization | READY → EXECUTION_PENDING → ACTIVE/READY/RECONCILIATION_REQUIRED |
| Non-material Correction | same Publication, new version/command/Attempt | materiality decision and exact approval/revalidation | ACTIVE → EXECUTION_PENDING → ACTIVE/RECONCILIATION_REQUIRED |
| Material Change | Successor Publication | new Snapshot/Approval/Publication | predecessor remains ACTIVE until successor ACTIVE, then SUPERSEDED |
| Withdrawal | same Publication, dedicated command/Attempt | Withdrawal Authorization | ACTIVE → WITHDRAWAL_PENDING → WITHDRAWN/RECONCILIATION_REQUIRED |
| Republish | same Publication intent, new authorization/command/Attempt | Republish Authorization and exact version guard | ACTIVE or WITHDRAWN → EXECUTION_PENDING → ACTIVE/origin/RECONCILIATION_REQUIRED |
| Reconciliation | append-only Case/Evidence/Resolution | deterministic sufficiency or independent human resolution | RECONCILIATION_REQUIRED → operation-specific confirmed/no-effect state |
| Suspend/Resume | no business-state replacement | authorized safety/policy control | `suspension_status` only |

## Version index

| Version | Owner |
|---|---|
| Aggregate Version | Publication concurrency |
| Representation Version | FEAT-014 exact content |
| Publication Version | effect-bearing command/effect ordinal |
| Effective Version | currently confirmed external effect pointer |
| Target Version | bound governed destination configuration |
| Approval/Authorization Version | exact human/policy authority |
| Projection Version | derived read model only |

## Vocabulary index

| Term | Canonical location |
|---|---|
| Draft / Review / Approved | FEAT-014 Representation/Publication Approval, not Publication state |
| Published | display alias for `ACTIVE` |
| Suspended | orthogonal `suspension_status` |
| Withdrawn | canonical `WITHDRAWN` |
| Archived | retention/projection disposition, not Publication state |
| Republished | operation/audit outcome, not Publication state |

## Decision index

| Concern | AO / DEC |
|---|---|
| Aggregate | AO-023 / DEC-100 |
| Lifecycle | AO-024 / DEC-101 |
| Target/Channel | AO-025 / DEC-102 |
| Revalidation | AO-028 / DEC-105 |
| Reconciliation | AO-031 / DEC-108 |
| Materiality | AO-032 / DEC-109 |
| Withdrawal | AO-033 / DEC-110 |
| Republish | AO-034 / DEC-111 |
| Projection | AO-035 / DEC-112 |

## Cross-references

- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Decision Register](00_DECISION_REGISTER.md)
- [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Canonical Workflow Registry](00_WORKFLOW_REGISTRY.md)
- [Book 5 Workflow Index](book-5/00_WORKFLOW_INDEX.md)
- [Canonical API Registry](00_API_REGISTRY.md)
- [Book 6 API Registry](book-6/16_API_REGISTRY.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md)
- [Test Registry](book-10/15_TEST_REGISTRY.md)
- [Publication Validation](reviews/PHASE11_3_PUBLICATION_VALIDATION.md)
- [Publication Coverage](reviews/PHASE11_3_PUBLICATION_COVERAGE.md)
