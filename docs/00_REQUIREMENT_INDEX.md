# Requirement Index — Phase 11-2

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-039 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Quality Owner |
| 기준일 | 2026-07-24 |
| Effective Version | Architecture v1.1 candidate |

## Purpose

AO-023–AO-035의 Publication Execution architecture가 사용하는 `REQ-CONST-001`–`REQ-CONST-013`을 category, Decision relationship과 validation status별로 찾을 수 있는 index다. Requirement의 canonical 문장은 [Project Constitution](book-0/00_PROJECT_CONSTITUTION.md), 상세 End-to-End trace는 [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md#phase-11-2--ao-023ao-035-requirement-alignment-candidate)를 따른다.

## Requirement index

| Requirement ID | Requirement Name | Category | AO/DEC Relationship | Validation Status |
|---|---|---|---|---|
| REQ-CONST-001 | AI recommends | Governance / Security | DEC-024 constraint; AO-026/029/035 and DEC-103/106/112 consume | PARTIALLY_VERIFIED |
| REQ-CONST-002 | Humans approve | Functional / Governance | Direct: AO-023/024/027–029/031–035 | PARTIALLY_VERIFIED |
| REQ-CONST-003 | No publication without verification | Functional / Security | Direct: AO-023/024/027–029/031–034 | PARTIALLY_VERIFIED |
| REQ-CONST-004 | No publication without permission | Privacy / Security | Direct: AO-023/024/027–029/031–034 | PARTIALLY_VERIFIED |
| REQ-CONST-005 | No loss of source provenance | Audit / Data Integrity | Direct: AO-023–035 | PARTIALLY_VERIFIED |
| REQ-CONST-006 | No hidden architectural changes | Governance | Direct: AO-023/024/026–029/031–035 | VERIFIED |
| REQ-CONST-007 | Every important action is auditable | Audit / Security | Direct: AO-023–035 | PARTIALLY_VERIFIED |
| REQ-CONST-008 | No direct AI authority over production data | Security / Governance | Direct: AO-026/028/035 | PARTIALLY_VERIFIED |
| REQ-CONST-009 | No connector bypass | Operations / Security | Direct: AO-023–028/030–035 | PARTIALLY_VERIFIED |
| REQ-CONST-010 | No privilege escalation | Security | Direct: AO-025/026/028–035 | PARTIALLY_VERIFIED |
| REQ-CONST-011 | Internal candidate is not a verified listing | Functional / Data Integrity | DEC-003 prerequisite; AO-028/031 and DEC-105/108 consume | PARTIALLY_VERIFIED |
| REQ-CONST-012 | Verified listing is not a published listing | Functional / Security | Direct: AO-023/024/027–029/031–035 | PARTIALLY_VERIFIED |
| REQ-CONST-013 | Client-sharing permission is not public-publication permission | Privacy / Governance | Direct: AO-023–025/027–029/031–035 | PARTIALLY_VERIFIED |

## Coverage rules

- 각 Requirement는 하나 이상의 approved Decision 관계와 하나 이상의 `TEST-*`를 가진다.
- `DIRECT`, `CONSTRAINT`, `PREREQUISITE` 관계를 구분하며 constraint를 새 AO 결정으로 가장하지 않는다.
- Projection은 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)의 `PRJ-001`~`PRJ-008`, Event는 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 `EVT-001`~`EVT-012`를 사용하며 placeholder는 남아 있지 않다.
- `PARTIALLY_VERIFIED`는 architecture/test contract가 존재하지만 FEAT-015 runtime evidence가 없음을 뜻한다.
- `VERIFIED`는 governance validation evidence가 존재하며 runtime implementation을 의미하지 않는다.

## Cross-references

- [Decision Register](00_DECISION_REGISTER.md)
- [Decision Index](00_DECISION_INDEX.md)
- [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md)
- [Phase 11-2 Trace Validation](reviews/PHASE11_2_TRACE_VALIDATION.md)
- [Phase 11-2 RTM Coverage](reviews/PHASE11_2_RTM_COVERAGE.md)
