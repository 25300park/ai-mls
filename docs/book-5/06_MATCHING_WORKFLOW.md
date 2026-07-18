# Matching Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-007 |
| Workflow ID | WF-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Matching Owner / Agent |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Active Requirement와 authorized candidate cohort를 match/rank하고 human-reviewed shortlist candidates를 만든다. Matching approval is a shortlist disposition, not Verification or sharing/publication permission.

## Matching execution

| Stage | Rule | Status |
|---|---|---|
| Request | active Requirement revision, audience/purpose, authorized actor | `MATCH.REQUESTED` |
| Eligibility | filter deleted/withdrawn/restricted; external audience additionally requires canonical gates | remains requested or rejected exception |
| Execute | deterministic factors and optional AI-005 on exact versions | `RUNNING` |
| Validate | score/factors/hard constraints/explanation/cohort/confidence | `REVIEW_REQUIRED` or result rejected |
| Review | Agent checks relevance, evidence, unknowns, freshness and eligibility | `REVIEWED` |
| Approve/reject result | accept for internal shortlist or reject with reason | `ACCEPTED` / `REJECTED` |

## Ranking

Rank is scoped to one cohort/run/version. Hard constraint fail cannot be compensated by score. Unknown/missing is explicit. Tie/weight/factor policy is versioned. AI explanation is grounded in structured factors and cannot introduce new facts.

## Human review and approval

Reviewer may accept, exclude, reorder or request Requirement correction with reason. Reordering/override is recorded separately from original Match Result. Acceptance means eligible for proposal assembly consideration only; WF-008 still checks Verification and client-sharing Permission.

## Result lifecycle

`MATCH.REQUESTED → RUNNING → REVIEW_REQUIRED → REVIEWED → ACCEPTED / REJECTED`

Any Requirement/Candidate/Offer/Verification/Permission/material policy version change transitions affected result to `STALE`; rerun produces a new result and old one becomes `SUPERSEDED`. Failed execution enters WF-012 and does not reuse stale results silently.

## Audit events

request/cohort/version, eligibility exclusions, execution/model/config, validation/confidence, review, reorder/override, accept/reject, stale/supersede and fallback. Client-sensitive factor content is minimized.

## Exceptions and fallback

- no eligible candidates: completed empty result with reason, not system failure.
- AI failure: deterministic filters/sort or manual shortlist.
- hard constraint contradiction: return to WF-005 clarification.
- stale input during run: reject result and requeue only against new versions.
- unauthorized result/contact exposure: security event and fail closed.

## Exit criteria

WF-008 may use only `MATCH.ACCEPTED` bound to current inputs and independently eligible Candidate/Offer. Internal acceptance never grants external sharing.

> **OPEN DECISION:** factor/weight/tie policy, cohort size, reviewer role, approval sampling, no-result route and match-result expiry.

