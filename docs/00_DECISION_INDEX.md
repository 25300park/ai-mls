# Decision Index — Canonical Architecture Decisions

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-036 |
| 문서 버전 | v0.2 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-24 |
| Register Version | Decision Register v1.5 |
| Effective Version | Architecture v1.1 |
| Freeze Version | Architecture v1.1 — candidate |

## Purpose

AO-023–AO-035와 FEAT-016 AO-16-01–05의 canonical Decision index를 제공한다. Decision의 normative 내용과 status는 [Decision Register](00_DECISION_REGISTER.md), 의존성은 [Decision Dependency Matrix](00_DECISION_DEPENDENCY_MATRIX.md), registry와 RTM 연결은 [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md)를 따른다.

## Decision index

| AO | DEC | Decision Name | Status | Recommendation | Decision Version | Effective Version | Architecture Status |
|---|---|---|---|---|---|---|---|
| AO-023 | DEC-100 | Publication Aggregate and Delivery Attempt | APPROVED | `APPROVE_RECOMMENDED_HYBRID` | v1.0 | Architecture v1.1 | ACTIVE; scoped refinement by DEC-109/111 |
| AO-024 | DEC-101 | Canonical Publication Lifecycle | APPROVED | `APPROVE_RECOMMENDED_LIFECYCLE` | v1.0 | Architecture v1.1 | ACTIVE; scoped refinement by DEC-111 |
| AO-025 | DEC-102 | Publication Target Model | APPROVED | `APPROVE_RECOMMENDED_TARGET_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-026 | DEC-103 | Provider, Connector and API-018/API-019 Ownership | APPROVED | `APPROVE_RECOMMENDED_OWNERSHIP_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-027 | DEC-104 | API-014 Canonical Surface | APPROVED | `APPROVE_RECOMMENDED_API_SURFACE` | v1.0 | Architecture v1.1 | ACTIVE; scoped refinement by DEC-109/111 |
| AO-028 | DEC-105 | Approval Revalidation | APPROVED | `APPROVE_RECOMMENDED_REVALIDATION_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-029 | DEC-106 | Publication Execution Segregation of Duties | APPROVED | `APPROVE_RECOMMENDED_SOD_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-030 | DEC-107 | Idempotency and Replay | APPROVED | `APPROVE_RECOMMENDED_IDEMPOTENCY_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-031 | DEC-108 | Reconciliation Evidence and Resolution | APPROVED | `APPROVE_RECOMMENDED_RECONCILIATION_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-032 | DEC-109 | Correction Materiality | APPROVED | `APPROVE_RECOMMENDED_CORRECTION_MODEL` | v1.0 | Architecture v1.1 | ACTIVE; refines DEC-100/101/104 |
| AO-033 | DEC-110 | Withdrawal Architecture | APPROVED | `APPROVE_RECOMMENDED_WITHDRAWAL_MODEL` | v1.0 | Architecture v1.1 | ACTIVE |
| AO-034 | DEC-111 | Republish Architecture | APPROVED | `APPROVE_RECOMMENDED_REPUBLISH_MODEL` | v1.0 | Architecture v1.1 | ACTIVE; refines DEC-100/101/104 |
| AO-035 | DEC-112 | Projection Consistency | APPROVED | `APPROVE_RECOMMENDED_PROJECTION_MODEL` | v1.0 | Architecture v1.1 | ACTIVE; physical implementation deferred |
| AO-16-01–05 | DEC-114 | FEAT-016 Canonical Administration Scope and Partial Baseline | APPROVED | `APPROVE_FEAT_016_CANONICAL_ALIGNMENT` | v1.0 | Architecture v1.1 FEAT-016 alignment baseline | ACTIVE; FEAT-016 incomplete |

## Status and supersession

- AO-023–AO-035는 각각 정확히 하나의 DEC에 대응하고, AO-16-01–05는 하나의 scoped alignment Decision인 DEC-114에 대응한다.
- 모든 대상 Decision은 `APPROVED`다.
- 대상 범위에 `SUPERSEDED` 또는 `DEPRECATED` Decision은 없다.
- DEC-109/111의 scoped refinement는 선행 Decision 전체를 supersede하지 않는다.
- Architecture v1.1 freeze 전에는 이 index와 연결된 review findings가 해소되어야 한다.

## Cross-references

- [Decision Register](00_DECISION_REGISTER.md)
- [Decision Dependency Matrix](00_DECISION_DEPENDENCY_MATRIX.md)
- [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md)
- [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Requirements Traceability Matrix](governance/REQUIREMENTS_TRACEABILITY_MATRIX.md)
- [Phase 11-1 Decision Validation](reviews/PHASE11_1_DECISION_VALIDATION.md)
