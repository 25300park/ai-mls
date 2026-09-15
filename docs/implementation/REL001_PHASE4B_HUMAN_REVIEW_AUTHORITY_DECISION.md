# REL-001 Phase 4B Human Review / Downstream Authority Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-182 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Business Owner / AI Reviewer / Security Owner |
| 기준일 | 2026-09-15 |

## 1. Canonical authority boundary

All three capabilities are advisory only. FEAT-022 may persist validated advisory output before review with `reviewRequired = true`; downstream governed action requires a separately authorized human action. Automatic acceptance, AI self-review and provider-granted authority are prohibited.

| Capability | Advisory only | Human review | Before advisory persistence | Before downstream action | Automatic acceptance | Existing downstream authority |
|---|---:|---:|---:|---:|---:|---|
| AI-001 | YES | REQUIRED | NO | YES | NO | authorized Candidate create/update actor |
| AI-004 | YES | REQUIRED | NO | YES | NO | authorized Listing content revision actor |
| AI-005 | YES | REQUIRED | NO | YES | NO | authorized shortlist/share/eligibility actor |

Review does not itself mutate Candidate, Listing, Match, Publication or any other governed aggregate. Current role/scope authorization must be evaluated at the later downstream action boundary.

## 2. Principal separation

- initiating human principal
- reviewing/approving human principal
- API-017 runtime executor
- FEAT-022 application execution identity
- provider identity

These identities remain distinct. Provider/model identity never replaces human provenance.

## 3. Residual review gap

Book 4 leaves capability-specific named reviewer roles, review SoD, sampling rate and SLA as owner decisions. Those are not needed to preserve advisory-only generation, but they prevent claiming a fully executable human-review lifecycle.

Human-review unresolved categories: `1`.

`HUMAN_REVIEW_AUTHORITY: PARTIALLY_CLOSED / OWNER_DECISION_REQUIRED_FOR_REVIEW_EXECUTION`
