# Duplicate Detection

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Duplicate Review Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Capability

`AI-003 Duplicate Detection` identifies potentially related Raw Sources, Candidates and Offers and recommends a relationship. It never deletes, merges, splits or suppresses authoritative records by itself.

## Duplicate logic

The model distinguishes:

| Relationship class | Meaning |
|---|---|
| SAME_SOURCE_COPY | repeated/copy of the same source evidence |
| SAME_CANDIDATE | same internal listing interpretation |
| SAME_UNIT_DIFFERENT_OFFER | same physical unit, materially different terms/contact/period |
| SAME_OFFER_DIFFERENT_SOURCE | one offer observed through several sources |
| RELATED_PROPERTY | shared property/building but different unit/opportunity |
| NOT_DUPLICATE | reviewed as distinct |
| UNCERTAIN | insufficient/conflicting evidence |

## Similarity signals

- source/content fingerprint and normalized text
- canonical/possible Property–Building–Tower–Floor–Unit hierarchy
- location/alias and unit label within hierarchy
- transaction type, price/terms, effective/observed time
- contact/organization relation using privacy-safe scoped signals
- attachment/media similarity where approved

No single weak signal, including phone number, price or text similarity, is globally decisive. Shared/recycled contacts and copied posts are expected.

## Confidence score

Output provides relationship-specific confidence band, evidence contributions, contradictions and model/rule versions. Score is calibrated for review priority, not merge authority. Numeric range and thresholds remain capability-versioned and are not presented as universal truth.

## Merge recommendation

Recommendation is one of `LINK_ONLY`, `MERGE_CANDIDATE`, `KEEP_SEPARATE`, `SAME_UNIT_SEPARATE_OFFERS`, `NEEDS_MORE_EVIDENCE`. It includes surviving canonical candidate suggestion, affected source/offer references and provenance-preservation warnings. Actual disposition is a separate human Decision History entry.

## Human approval

Human review is required for all merge/split/keep-separate dispositions that alter canonical relationships. Reviewer sees side-by-side evidence, material differences, confidence, contradictions, downstream Match/Verification/Publication impact and rollback plan.

## Validation

- compared entity IDs/versions exist and are within authorized scope
- pair/group does not compare an entity with itself except explicit source-copy analysis
- relationship and recommendation combination is allowed
- evidence references and confidence are complete
- contact detail is masked/minimized
- no delete/merge command or fabricated canonical ID appears

## Failure and lifecycle

provider/output failure creates no disposition. deterministic candidate generation or manual review remains. new source, property correction, offer revision or human disagreement may reopen a Duplicate Group; prior recommendations and decisions are superseded, not erased.

## Quality metrics

pair precision/recall by relationship class, false merge rate, false split/duplicate miss rate, reviewer acceptance, review time, provenance preservation and cohort drift. false merge is the primary safety metric.

> **OPEN DECISION:** candidate-generation strategy, threshold bands, reviewer qualification, sampling and gold-set construction.

