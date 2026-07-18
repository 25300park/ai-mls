# Duplicate Review Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-005 |
| Workflow ID | WF-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Duplicate Review Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

AI/rule/manual duplicate suggestion을 evidence-rich human review로 분류하고 provenance-preserving link/merge/separate disposition을 기록한다.

## Entry and review

Entry requires two or more distinct versioned Source/Candidate/Offer references and a reason/signal. `DUPLICATE.SUGGESTED` becomes `IN_REVIEW` only after reviewer assignment and current-version check.

Reviewer distinguishes `SAME_SOURCE_COPY`, `SAME_CANDIDATE`, `SAME_UNIT_DIFFERENT_OFFER`, `SAME_OFFER_DIFFERENT_SOURCE`, `RELATED_PROPERTY`, `NOT_DUPLICATE`, `UNCERTAIN`. Source, physical identity and commercial offer are not collapsed into one generic duplicate.

## Recommendations and dispositions

| Recommendation | Human disposition | Effect |
|---|---|---|
| LINK_ONLY | `RESOLVED_LINK` | keep records, add explicit relation/provenance |
| MERGE_CANDIDATE | `RESOLVED_MERGE` | select surviving Candidate ID, supersede prior ID, preserve sources/offers/history |
| KEEP_SEPARATE | `RESOLVED_SEPARATE` | record non-duplicate reason; future signal may reopen |
| SAME_UNIT_SEPARATE_OFFERS | `RESOLVED_SEPARATE` + unit relation | preserve each Offer and contact/term/source distinction |
| NEEDS_MORE_EVIDENCE | `NEEDS_EVIDENCE` | no canonical change; assign evidence action |

## Reject recommendation

Reviewer rejects an AI/rule recommendation when evidence contradicts relationship, input is stale, signal used prohibited/private data, confidence/explanation is insufficient or merge would lose provenance. Rejection is feedback/evidence, not automatic model training consent.

## Manual override

Authorized reviewer may override recommendation only with selected relationship, rationale, evidence, affected downstream references and rollback plan. High-impact canonical merge/split may require Property Data Steward concurrence. Override cannot delete Raw Source or bypass Verification/Publication review.

## Downstream impact

- merge/split marks affected Match Results stale.
- affected Verification/Permission/Publication is reviewed when subject/version or represented fact changes.
- search/duplicate projections reindex from canonical state.
- prior IDs redirect through supersession; history remains.

## Audit events

suggestion created, review opened, evidence requested, recommendation accepted/rejected/overridden, merge/link/separate applied, reopened, downstream invalidation and rollback. Record actor, inputs/versions, signals, decision/rationale and affected IDs.

## Exceptions and rollback

conflicting reviewers escalate; unavailable evidence stays `NEEDS_EVIDENCE`; failed merge application records no partial success and invokes WF-012. Wrong merge is corrected by governed split/relink, not history deletion.

## Exit criteria

Only a human `RESOLVED_*` disposition changes canonical relationships. `DUPLICATE.SUGGESTED` or AI confidence alone has no effect.

> **OPEN DECISION:** reviewer qualification, two-person merge threshold, reopening rule, false-merge SLA and rollback owner.

