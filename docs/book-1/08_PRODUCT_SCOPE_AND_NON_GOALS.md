# Product Scope and Non-Goals

| 항목 | 값 |
|---|---|
| Document ID | DOC-BIZ-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

이 문서는 business scope band를 정의한다. detailed development phase/dependency는 Book 12에서 확정하며 여기의 Phase 1/2는 implementation commitment가 아니다.

## MVP

MVP의 outcome은 internal staff가 candidate를 빠르게 구조화·찾고, human verification을 거쳐 permission-controlled proposal/publication을 수행하며, 그 과정이 provenance/audit로 추적되는 것이다.

### MVP required outcomes

- internal users/roles와 restricted contact access
- manual candidate intake와 source provenance
- AI-assisted parse/normalization/matching suggestion + human correction
- property/unit/offer distinction과 duplicate review
- client requirement, match/shortlist와 verification freshness
- client-sharing/public-publication permission separation
- approved proposal/publication, audit와 retention
- KPI baseline/operational feedback

MVP scope는 capability statement이며 schema, API, UI 또는 vendor design이 아니다.

## Phase 1 — Internal intelligence foundation

- manual intake and source registry/policy awareness
- candidate search/review, structured requirement와 shortlist
- human correction, duplicate suggestion와 provenance
- internal-only operation; unverified external exposure 금지
- baseline collection for BG-001, BG-002, BG-004

## Phase 2 — Controlled external-use workflow

- time-bound verification와 re-verification
- client proposal using verified/permitted information
- separate publication approval와 `rbs-homes.com` integration only if approved contract exists
- expiration/correction/unpublish, access/audit/retention
- BG-003, BG-005, BG-006 outcome measurement

Phase 2도 autonomous public posting을 허용하지 않는다.

## Post-MVP

- browser save extension와 permitted website connectors
- controlled Viber collector only after source-policy/security approval
- advanced analytics/natural-language exploration
- external broker contribution/membership
- enterprise/partner API and developer integration
- cooperative MLS governance/data exchange
- marketplace/network model

모든 `POST-MVP` item은 별도 CR/ADR/business case와 approval이 필요하다.

## Out of scope

- autonomous Facebook/Viber scraping 또는 account control
- AI verification/permission/publication approval
- unverified candidate의 client/public exposure
- connector의 core private function/publication bypass
- final database/API/UI/technology vendor를 Book 1에서 결정
- unrestricted contact/data export
- legal/compliance guarantee
- national market coverage 또는 completeness claim
- external broker network를 MVP로 운영

## Items intentionally excluded

| Excluded item | Reason | Reconsideration trigger |
|---|---|---|
| autonomous social scraping | platform/compliance/security risk | explicit source policy + isolated approved design |
| auto publication | constitutional human approval | Constitution amendment 불가; human gate 유지 |
| cooperative membership | governance/authority not ready | internal control + network business case proof |
| generic CRM replacement | scope dilution | separate validated problem/business case |
| transaction/payment marketplace | legal/fraud/operations complexity | long-term regulated business case |
| speculative national analytics | data quality/coverage/privacy 부족 | governed coverage + validated aggregation |

## Scope decision rule

새 item은 business goal, persona/value, constitutional binding, risk/assumption, measurable KPI와 target horizon을 갖지 않으면 scope에 포함하지 않는다. “competitor has it” 또는 “AI can do it”만으로는 충분하지 않다.

## Constitutional bindings

MVP와 모든 future phase는 `REQ-CONST-001`–`013`을 유지한다. 특히 future network/connector는 `REQ-CONST-005`, `006`, `009`, `013`을 완화하지 않는다.
