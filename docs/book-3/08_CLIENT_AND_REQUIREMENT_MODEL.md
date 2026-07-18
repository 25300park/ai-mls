# Client and Requirement Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Client의 원래 의도, 구조화된 Requirement, budget/location/matching preference와 변경 history를 보존해 explainable matching의 입력을 제공한다. persona, Contact, authentication User와 Client를 혼동하지 않는다.

## Entities

| Entity | Purpose | Important logical attributes | Authority |
|---|---|---|---|
| Client | AI MLS가 service relationship을 관리하는 tenant/buyer 또는 authorized representative | client type, status, contact reference, team/agent owner, privacy class, consent context | Business Owner; client relationship authority |
| Requirement | 특정 search need의 versioned definition | transaction intent, property/unit criteria, timing, must/prefer/exclude rules, effective period, status | Client input interpreted by authorized staff |
| Budget | acceptable monetary range/context | currency, lower/upper preference, frequency, flexibility, included-cost assumptions | Client/authorized staff; not offer price authority |
| Location Preference | desired/avoided places and flexibility | Location references or unresolved text, priority, radius/travel intent, exclusions | Client requirement authority |
| Matching Preference | ranking weights and qualitative preferences | criterion, priority, hard/soft flag, rationale, effective revision | Client/authorized staff; advisory input |
| Requirement History | change evidence | prior/new revision, original wording reference, actor, time, reason, change summary | Audit/business history |

## Requirement modeling rules

- original wording/reference와 structured interpretation을 함께 추적한다.
- unknown, not asked, no preference와 explicit exclusion을 구분한다.
- hard constraint와 soft preference를 분리하며 AI가 임의로 hard constraint를 완화하지 않는다.
- Budget는 price only가 아니라 frequency, fees/inclusions and flexibility context를 가진다.
- Location Preference는 canonical Location을 우선 참조하지만 unresolved local term을 provenance와 함께 허용한다.
- 하나의 Client는 동시에 여러 Requirements를 가질 수 있고 각 Requirement는 독립 lifecycle을 가진다.

## Lifecycle

`DRAFT → ACTIVE → PAUSED → FULFILLED / WITHDRAWN / EXPIRED`

수정은 current active revision을 만들고 이전 revision을 history로 보존한다. material change는 Match Result를 stale로 표시하고 재계산을 요청하지만 기존 shortlist/decision history를 지우지 않는다.

## Relationships

- Client references restricted Contact data but does not duplicate channel values without purpose/provenance.
- Requirement belongs to one Client relationship and may be owned operationally by a Team/User.
- Match Result binds Requirement revision and Candidate/Offer revision.
- Communication/feedback may update requirement history only through an authorized human-reviewed change.
- viewing/closing outcome association is business history and does not rewrite original Requirement.

## Privacy and access

Requirement can reveal budget, timing, household/work/location preferences and is at least confidential internal data; some attributes may be restricted personal data. access is team/task scoped, export is audited, analytics uses minimization/aggregation, and retention follows client purpose/consent/legal policy.

## Constraints

- Client is not necessarily an authenticated User.
- Contact consent does not imply publication permission for listing data.
- Requirement cannot make a Candidate verified or an Offer available.
- ranking preference cannot override permission, verification or privacy filters.
- `DB-013`: Match Result must bind input revisions so requirement changes are detectable.

> **OPEN DECISION:** client identity resolution, household/representative model, budget inclusions, requirement expiry and closed-outcome retention.

