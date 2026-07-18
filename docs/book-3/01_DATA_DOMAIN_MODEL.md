# Data Domain Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Business domains and bounded contexts

| Bounded context | Core entities | Canonical owner | Authority supplied | Must not own |
|---|---|---|---|---|
| Identity and Access | User, Role, Team, Permission assignment | Authorization/Data Owner | identity and access policy state | verification/publication facts |
| Source and Intake | Source Registry, Raw Source, Raw Attachment, Collector, Intake, Listing Source | Source/Data Steward | capture evidence, intake disposition and source policy | verified truth |
| Property Master | Property, Building, Tower, Floor, Unit, Location, Alias | Property Data Steward | canonical identity and hierarchy | offer price/availability |
| Listing Intelligence | Candidate Listing, Listing Offer, Duplicate Group, Availability | Listing Data Owner | internal candidate interpretation | external-use authority |
| Contact and Organization | Contact, Organization, Contact Case, Communication | Privacy/Data Owner | restricted contact channel, attempt case and relationship | property fact authority by itself |
| Client Requirements | Client, Requirement, budget/location/matching preferences | Business Owner | client need and consent context | listing verification |
| Matching | Match Result and ranking history | Matching Module Owner | advisory fit evidence | human decision or fact authority |
| Verification and Permission | Verification, Permission, verifier reference | Verification/Business Owner | time-bound human fact decision and separate allowed use | publication delivery status |
| Publication | Client Proposal, Publication Approval, Publication, Publication Target, status/approval history | Publication Owner | client-scoped sharing and approved external representation/status | underlying property truth |
| AI Work | AI Job, AI Result | AI Operations Owner | advisory processing evidence | authoritative state change |
| Governance and Audit | Audit Event, Decision History, Status History | Security/Governance Owner | who/what/when/why evidence | business record replacement |
| Retention and Reliability | Retention Job, System Error, hold/deletion evidence | Data Operations Owner | policy execution and recovery evidence | silent deletion authority |

## Core entities and ownership rules

- 각 entity는 하나의 canonical bounded context가 create/update lifecycle을 소유한다.
- 다른 context는 stable identifier로 참조하며 의미 있는 snapshot 복제에는 provenance, source version과 refresh rule이 필요하다.
- raw evidence는 immutable-by-default capture이고 correction은 새 version/annotation으로 표현한다.
- derived Match Result, AI Result, search index는 canonical business state가 아니다.
- Publication은 승인 당시의 external representation을 추적하지만 Property, Offer, Verification을 대체하지 않는다.
- Audit Event는 업무 record의 current view가 아니며 business state를 감사 log에서 복구하는 것을 기본 운영 방식으로 삼지 않는다.

## Data authority model

| Authority class | Meaning | Examples | External-use effect |
|---|---|---|---|
| SOURCE_EVIDENCE | 특정 source에서 관찰·접수된 내용 | Raw Source, Raw Attachment | 사실 보증 없음 |
| CANONICAL_MASTER | 내부 identity/hierarchy 기준 | Property, Unit, Location, Alias | 매물 가용성 보증 없음 |
| CANDIDATE | 검증 전 내부 interpretation | Candidate Listing, Listing Offer | 외부 노출 금지 |
| ADVISORY | 계산·AI 제안 | AI Result, Match Result, duplicate suggestion | 승인/사실 대체 불가 |
| VERIFIED | scope와 시간 제한이 있는 human verification | Verification | permission이 없으면 외부 사용 불가 |
| PERMITTED | 대상·목적·scope가 명시된 허용 | Permission | verification/approval을 대체하지 않음 |
| PUBLISHED | 승인된 외부 representation의 전달 상태 | Publication | underlying truth와 별도 lifecycle |
| AUDIT_EVIDENCE | action/decision/history evidence | Audit Event, Decision History | 업무 authority가 아닌 accountability evidence |

## Data lifecycle

`Capture → Interpret → Normalize → Review → Verify → Permit → Publish → Reverify/Correct → Expire → Retain/Delete/Archive`

각 단계는 독립 record와 reference로 표현한다. 앞 단계가 뒤 단계의 존재를 자동 생성하지 않으며, expiry 또는 material change는 downstream eligibility를 무효화하거나 재검토 상태로 전환한다.

## Database capabilities

| Capability ID | Logical requirement | Constitutional/business trace |
|---|---|---|
| DB-001 | 모든 important record는 canonical owner와 authority class를 가진다. | REQ-CONST-005, 007 |
| DB-002 | source evidence와 transformation lineage를 파생 record까지 추적한다. | REQ-CONST-005, BG-003 |
| DB-003 | candidate, verification, permission, publication은 별도 entity/lifecycle이다. | REQ-CONST-003/004/011–013 |
| DB-004 | important state transition은 actor/job, time, reason, prior/new state로 audit 가능하다. | REQ-CONST-007 |
| DB-005 | AI/connector identity는 authoritative approval relationship의 actor가 될 수 없다. | REQ-CONST-008/009 |

## Lifecycle and ownership conflicts

- Source 삭제는 이미 승인된 legal hold 또는 required audit evidence를 조용히 제거하지 않는다.
- Property merge/split은 Candidate, Offer, Verification, Match, Publication reference를 재연결하고 이전 identity를 보존한다.
- Contact deletion은 raw source에 포함된 personal data와 derived/search copy를 함께 영향 분석한다.
- 외부 Publication 상태와 내부 authoritative record가 다르면 reconciliation state로 표시하고 어느 쪽도 추측으로 덮어쓰지 않는다.

## Open decisions

- named steward와 owner delegation
- organization/tenant boundary를 MVP부터 포함할지 여부
- field-level verification granularity와 canonical property merge approval role
- data residency, classification taxonomy와 exact retention period
