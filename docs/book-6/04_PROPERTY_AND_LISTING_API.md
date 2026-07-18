# Property and Listing API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Property Data Steward / Listing Data Owner |
| 기준일 | 2026-07-14 |
| API Capabilities | API-005, API-006 |

## Purpose

canonical property hierarchy를 조회·검토하고 candidate listing, listing offer 및 duplicate disposition을 workflow 안에서 관리한다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Search Property Master | `GET /v{major}/properties` | authorized canonical property projection |
| Read Property Hierarchy | `GET /v{major}/properties/{id}` | building/tower/floor/unit/alias links |
| Propose Master Correction | `POST /v{major}/properties/{id}/correction-proposals` | steward review item |
| List/Read Candidates | `GET /v{major}/candidates[/{id}]` | eligibility-masked candidate projection |
| Create/Revise Candidate | `POST /v{major}/candidates`, `POST .../{id}/revisions` | versioned candidate draft |
| Create/Revise Offer | `POST /v{major}/offers`, `POST .../{id}/revisions` | versioned offer terms |
| Request Duplicate Review | `POST /v{major}/duplicate-reviews` | review group/suggestion |
| Decide Duplicate | `POST /v{major}/duplicate-reviews/{id}:decide` | link/merge/separate human disposition |

## Request Model

Property search는 allowlisted filters/sort/cursor를 사용한다. Candidate/Offer write는 source/provenance refs, subject IDs, factual claims with effective/as-of time, unresolved markers, expected version와 reason을 포함한다. Duplicate decision은 compared versions, decision, field-level lineage/merge plan과 evidence를 포함한다.

## Response Model

Opaque IDs, canonical version/status/authority class, masked attributes, provenance/evidence links, unresolved conflicts, offer effective period와 allowed actions를 반환한다. Duplicate 결과는 advisory score와 human disposition을 분리한다.

## Business Rules

Property master는 identity authority이며 offer authority가 아니다. Candidate는 Verification/Published로 표현하지 않는다. Merge는 source history를 삭제하지 않고 field lineage를 보존한다. Search projection 결과는 write/외부 사용 전에 canonical record를 재확인한다.

## Authority

Property Data Steward가 master correction/merge, Listing Data Owner가 candidate/offer revision, authorized Duplicate Reviewer가 disposition을 수행한다. AI는 normalization/duplicate suggestion만 제공한다.

## Validation

identifier/reference integrity, source lineage, property hierarchy, offer temporal/currency consistency, allowed status edge, expected version, duplicate decision evidence와 downstream impact를 검사한다.

## Audit

restricted search, create/revision, master correction proposal/decision, duplicate suggestion/review/override/reopen, before/after references와 downstream stale effects를 기록한다.

## Error Conditions

`PROPERTY_NOT_FOUND`, `HIERARCHY_CONFLICT`, `PROVENANCE_REQUIRED`, `CANDIDATE_NOT_ELIGIBLE`, `OFFER_INVALID`, `DUPLICATE_EVIDENCE_REQUIRED`, `MERGE_CONFLICT`, `VERSION_CONFLICT`, `STATE_TRANSITION_INVALID`.

## Related Workflow

`WF-002` Manual Intake, `WF-003` AI Processing, `WF-004` Duplicate Review, `WF-006` Matching, `WF-007` Verification.

## Related Entity

Location, Property, Building, Tower, Floor, Unit, Property Alias, Candidate Listing, Listing Offer, Duplicate Group, Availability, Listing Source, Source Provenance.

## Related AI Capability

`AI-001` Listing parsing, `AI-002` Property normalization, `AI-003` Duplicate detection, `AI-007` validation.

