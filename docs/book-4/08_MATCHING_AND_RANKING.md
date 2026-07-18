# Matching and Ranking

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Matching Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Capability

`AI-005 Matching and Ranking` evaluates eligible Candidate/Offer revisions against one Requirement revision and produces advisory factor scores, rank and explanation. Audience eligibility is determined before/after ranking by authoritative application policy, never by model preference.

## Matching factors

| Factor | Treatment |
|---|---|
| Hard constraints | explicit pass/fail/unknown; fail cannot be offset by other score |
| Budget fit | currency/frequency/inclusions-aware distance and flexibility |
| Location fit | canonical/raw preference, priority and approved proximity semantics |
| Property/unit fit | type, bedrooms/area/features where evidence exists |
| Timing/availability | as-of/expiry and Verification authority shown separately |
| Soft preferences | weighted contribution with explanation |
| Data quality/freshness | uncertainty/penalty signal, not hidden exclusion unless policy says |
| Business priority | cannot override client hard constraints, permission, privacy or verification |

Protected/sensitive attributes and proxies are excluded unless explicit lawful approved use is documented; fairness review is required.

## Ranking, score and weight

- Match Result binds exact Requirement, Candidate/Offer, policy and model/config versions.
- score is meaningful only within a declared scale/cohort/version.
- weight source is declared as approved policy, user/staff adjustment or model contribution.
- hard constraints are not soft weights.
- missing/unknown values follow explicit policy and are not silently treated as match.
- rank binds an eligible cohort/run and deterministic tie rule.

Exact numeric scale/weights/thresholds are `OPEN DECISION` pending baseline and evaluation; this document defines semantics, not production tuning.

## Explanation generation

Explanation is grounded in structured factors and evidence references. It includes decisive matches, exclusions, trade-offs, unknown/stale fields and confidence limitations. Generated prose is validated against factor data; unsupported statements are rejected. Client-facing wording requires separate audience/privacy policy and human review.

## Human adjustment

Authorized staff may shortlist, reorder, exclude or change an approved preference/weight with reason. Adjustment creates a separate disposition/config or Requirement revision; it does not overwrite the original model result. Hidden pay-to-rank or untracked business overrides are prohibited.

## Validation

- all input versions and cohort members are current/authorized
- external/client cohort satisfies verification and permission eligibility
- factor values trace to Requirement and Candidate/Offer evidence
- score arithmetic/scale and hard-constraint behavior are consistent
- explanation matches structured factors
- confidence, unknowns and model/config versions are present
- no restricted field or prohibited factor is used/output

## Failure and fallback

If AI ranking fails, deterministic filters/sorts and human-curated shortlist remain. Invalid/stale result is marked unusable; prior result is not silently reused. Provider fallback must pass versioned comparative evaluation.

## Quality and business metrics

factor correctness, rank relevance, NDCG/precision-style measures where appropriate, hard-constraint violation count, explanation faithfulness, correction/reorder rate, viewing outcome and subgroup/fairness diagnostics. Business outcome never substitutes for safety/control metrics.

> **OPEN DECISION:** factor catalog, scale, weights, tie rule, eligible cohort, fairness groups/metrics and human adjustment policy.

