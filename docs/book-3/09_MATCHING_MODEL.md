# Matching Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-010 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Requirement와 eligible Candidate/Offer 사이의 advisory fit을 재현 가능하게 기록한다. Match Result는 추천이며 verification, permission, client suitability 보증 또는 human decision이 아니다.

## Logical model

| Concept | Definition | Required context |
|---|---|---|
| Match Result | one Requirement revision과 one Candidate/Offer revision의 evaluation | input IDs/versions, matcher version, calculated time, eligibility filters |
| Score | approved scale의 aggregate fit indicator | scale/version, component scores, missing-data treatment |
| Explanation | match/non-match의 중요한 reasons | criterion reference, observed value/source, contribution, uncertainty |
| Confidence | input completeness/model certainty의 calibrated indicator | confidence scheme/version, limitations; fact와 분리 |
| Ranking | 동일 run/cohort 내 ordered position | ranking run, tie rule, eligible population, timestamp |
| Match History | recalculation and staff disposition lineage | supersedes link, trigger, reviewer feedback, stale reason |

## Input and eligibility rules

- Match binds exact Requirement, Candidate, Offer, Property/Unit and policy revision references.
- permission/verification filter는 output audience에 따라 별도 적용한다. internal discovery may include Candidate; client proposal may not include unverified/unpermitted records.
- expired, withdrawn, deleted, restricted or unresolved-critical records are excluded or explicitly flagged according to approved policy.
- missing value is not a positive match and is not silently imputed without provenance/confidence.

## Score and explanation

- component criteria distinguish hard constraint, soft preference and informational dimension.
- score scale, weighting and normalization are versioned; scores from incompatible versions are not directly compared.
- explanation includes decisive exclusions, trade-offs and unknowns, not just positive marketing text.
- AI-generated explanation is validated against structured match evidence and cannot invent facts.

## Confidence

Confidence reflects result reliability under defined inputs/model, not probability that a property is “good,” available, verified or permitted. confidence source may be deterministic completeness, model output or combined policy; each is labeled.

## Ranking and history

- rank is meaningful only within a recorded cohort/run and filter context.
- deterministic tie rule and stability expectation are documented in future algorithm specification.
- input change, matcher/policy change, expiry or human correction marks old result stale/superseded rather than deleting it.
- staff shortlist/accept/reject feedback is a separate disposition with reason and actor, not training consent by default.

## Authority and privacy

Match Result has `ADVISORY` authority. It cannot change Candidate, Verification, Permission or Publication. Client data is minimized in stored explanations and AI requests; sensitive preference is not exposed in listing/publication context.

## Database capabilities

- `DB-010`: Match/AI result never directly performs authoritative transition.
- `DB-013`: every Match Result binds exact input and matcher versions.
- `DB-014`: derived result/index can be rebuilt and reconciled from canonical references without becoming source of truth.

## Retention

Retain enough history for explanation, correction, KPI and dispute according to Requirement lifecycle and privacy policy. remove/pseudonymize client-specific detail when purpose expires while preserving allowed aggregate/audit evidence.

> **OPEN DECISION:** score/confidence scales, ranking cohort, eligibility filters, feedback use, fairness/evaluation metrics and retention period.

