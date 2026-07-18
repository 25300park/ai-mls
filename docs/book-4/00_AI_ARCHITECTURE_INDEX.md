# Book 4 — AI Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

> Phase 15 synchronization: end-to-end coverage authority는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)이며 `AI-001–007`의 capability meaning은 이 Book에서 유지한다.

## Purpose

Book 4는 AI MLS의 AI capability, authority/trust boundary, provider abstraction, validation, human review, prompt governance, observability와 output contract를 정의한다. production prompt, executable code, API, model deployment 또는 Phase 6 workflow 구현은 범위 밖이다.

## Navigation

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-AI-002 | [AI Overview](01_AI_OVERVIEW.md) | objectives, scope, responsibility, limitation, lifecycle |
| DOC-AI-003 | [AI Boundaries](02_AI_BOUNDARIES.md) | allowed/prohibited action, authority, trust와 human boundary |
| DOC-AI-004 | [Provider Abstraction](03_PROVIDER_ABSTRACTION.md) | capability-based provider layer, fallback와 model independence |
| DOC-AI-005 | [Listing Parser](04_LISTING_PARSER.md) | raw evidence에서 structured candidate proposal |
| DOC-AI-006 | [Property Normalization](05_PROPERTY_NORMALIZATION.md) | canonical identity/alias/location suggestion |
| DOC-AI-007 | [Duplicate Detection](06_DUPLICATE_DETECTION.md) | similarity evidence와 merge recommendation |
| DOC-AI-008 | [Requirement Parser](07_REQUIREMENT_PARSER.md) | natural-language client need의 structured proposal |
| DOC-AI-009 | [Matching and Ranking](08_MATCHING_AND_RANKING.md) | factors, score, rank, explanation와 adjustment |
| DOC-AI-010 | [Natural Language Search](09_NATURAL_LANGUAGE_SEARCH.md) | intent/entity extraction과 safe search interpretation |
| DOC-AI-011 | [Confidence and Validation](10_CONFIDENCE_AND_VALIDATION.md) | confidence scale, thresholds, rejection, review와 metrics |
| DOC-AI-012 | [Human Review](11_HUMAN_REVIEW.md) | review/correction/escalation/feedback workflow |
| DOC-AI-013 | [Prompt Governance](12_PROMPT_GOVERNANCE.md) | owner, version, approval, testing, rollback, sensitive data |
| DOC-AI-014 | [AI Observability](13_AI_OBSERVABILITY.md) | logging, quality, latency, failure, monitoring와 cost |
| DOC-AI-015 | [AI Output Schemas](14_AI_OUTPUT_SCHEMAS.md) | documentation-only JSON Schema contracts |
| DOC-AI-016 | [AI Prompt Library Guide](15_AI_PROMPT_LIBRARY_GUIDE.md) | prompt category, naming, lifecycle, documentation와 review |

## AI capability trace

| Capability ID | Capability | Primary document | Authority |
|---|---|---|---|
| AI-001 | Listing parsing | DOC-AI-005 | ADVISORY |
| AI-002 | Property normalization | DOC-AI-006 | ADVISORY |
| AI-003 | Duplicate detection | DOC-AI-007 | ADVISORY |
| AI-004 | Requirement parsing | DOC-AI-008 | ADVISORY |
| AI-005 | Matching and ranking | DOC-AI-009 | ADVISORY |
| AI-006 | Natural-language search interpretation | DOC-AI-010 | ADVISORY |
| AI-007 | Confidence and output validation | DOC-AI-011 | CONTROL SUPPORT; deterministic application validation remains authoritative |

## Mandatory principles

1. AI recommends; humans approve.
2. No autonomous publication.
3. No autonomous permission.
4. No direct modification of authoritative data.
5. Provider independent.
6. Every output validated, confidence-bearing where applicable and auditable.
7. Every capability has deterministic fallback and explicit failure behavior.
8. Sensitive input is minimized and governed.
9. AI output can be rejected, corrected, superseded and reproduced by version context.

## Source bindings

- Constitution: `REQ-CONST-001`, `002`, `005`, `007`–`010`
- Database: `DB-002`, `004`, `005`, `010`, `013`–`015`
- System: [AI Provider Layer](../book-2/03_CONTAINER_ARCHITECTURE.md), [Event and Job Architecture](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)
- Data entities: [AI Job and AI Result](../book-3/15_DATA_DICTIONARY.md#ai-governance-and-reliability-entities)

> **OPEN DECISION:** named AI Owner/Reviewer, initial provider/model, approved data classes, evaluation corpus와 release thresholds.
