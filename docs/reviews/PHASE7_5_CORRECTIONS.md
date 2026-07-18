# Phase 7.5 — Consistency Corrections

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-14 |

## Correction rule

이 기록은 Phase 0–7에 이미 존재한 의미를 동기화한 편집만 포함한다. 새 architecture, business rule, executable schema, API/OpenAPI 또는 implementation은 포함하지 않는다.

## Corrections applied

| Correction ID | Issue | Applied correction | Primary files | Basis |
|---|---|---|---|---|
| COR-7.5-001 | legacy A-series naming | standalone 단계 표기를 Phase 4–7로 교체; historical review H1/file 유지 | README, master brief, Master/ARB/Assumption/Decision, Book 2, ADR-003, review bodies | current user naming mandate |
| COR-7.5-002 | `PUBLICATION.SUSPENDED` absent in Book 3 | Publication 11-state set과 transition을 Book 3/5/6에 exact sync | Data Dictionary, Publication Model, Workflow/API docs | Phase 6 status source |
| COR-7.5-003 | Publication Model edge mismatch | rejected approval→draft, correction→new draft, suspend/reconcile/withdraw edges를 transition rules와 통일 | Publication Model | Book 5 transition source |
| COR-7.5-004 | workflow entities missing in Data Dictionary | Intake, Contact Case, Client Proposal, Publication Approval rows/relationships/contexts 추가 | Data Domain, ER Model, Data Dictionary | existing WF/API contracts |
| COR-7.5-005 | derived views looked like duplicate entities | Published Listing을 derived view, publication history를 Status History/Audit Event로 명시 | Publication Model | Data Dictionary ownership |
| COR-7.5-006 | abbreviated database lifecycle names | relevant Book 3 lifecycle을 exact `AGGREGATE.STATUS`로 정규화 | Data Dictionary | DEC-031 / Status Dictionary |
| COR-7.5-007 | System Error/Exception naming mismatch | System Error lifecycle을 `EXCEPTION.*` aggregate에 명시적으로 mapping | Data Dictionary, Workflow Index | WF-012 |
| COR-7.5-008 | audit lifecycle not namespaced | existing append/correct/archive/delete-by-policy labels을 `AUDIT_EVENT.*`로 정규화하고 transitions/API response 동기화 | Data Dictionary, Status Dictionary, Transition Rules, Admin/Audit API | existing audit/retention semantics |
| COR-7.5-009 | authority terms could be read as statuses | CANDIDATE/VERIFIED/CLIENT_SHAREABLE/PUBLISHED와 AI result-class 관계를 non-status로 명시 | Status Dictionary, API Registry | Constitution/Glossary/AI schema |
| COR-7.5-010 | workflow aggregate/entity mapping implicit | every aggregate를 exact Data Dictionary entity/evidence에 mapping | Workflow Index, API Registry/domain APIs | entity consistency requirement |
| COR-7.5-011 | planned Markdown links were intentionally broken | nonexistent PLANNED paths를 inline code로 전환 | Master Index | zero-broken-link acceptance |
| COR-7.5-012 | Book 5 AI capability range incorrect | `AI-001–016` document-number confusion을 canonical `AI-001–007`로 correction | Workflow Index | Book 4 AI registry |

## Files updated by category

- Foundation/registry: `README.md`, `AI_MLS_CODEX_DOCUMENTATION_BRIEFS.md`, `docs/00_MASTER_INDEX.md`, `00_ARCHITECTURE_REVIEW_BOARD.md`, `00_ASSUMPTION_REGISTER.md`, `00_DECISION_REGISTER.md`, `00_VERSION_HISTORY.md`, `00_CHANGE_REQUEST_REGISTER.md`.
- Book 2/ADR wording: `03_CONTAINER_ARCHITECTURE.md`, `09_SCALABILITY_STRATEGY.md`, `10_ARCHITECTURE_DECISIONS.md`, `ADR-003-POSTGRESQL-PREFERRED.md`.
- Book 3: `01_DATA_DOMAIN_MODEL.md`, `02_ENTITY_RELATIONSHIP_MODEL.md`, `11_PUBLICATION_MODEL.md`, `15_DATA_DICTIONARY.md`.
- Book 5: `00_WORKFLOW_INDEX.md`, `10_PUBLICATION_WORKFLOW.md`, `13_STATUS_DICTIONARY.md`, `14_STATE_TRANSITION_RULES.md`.
- Book 6: `03_SOURCE_AND_INTAKE_API.md`, `05_CONTACT_API.md`, `09_PUBLICATION_API.md`, `10_ADMIN_AND_AUDIT_API.md`, `16_API_REGISTRY.md`.
- Historical review body wording: `A3_COMPLETION.md`, `PHASE4_COMPLETION.md`, `PHASE5_COMPLETION.md`, `PHASE6_COMPLETION.md`, `PHASE7_COMPLETION.md`; document title/file identity unchanged.

## Corrections not applied

- Exact provider, token, threshold, retention, SLA, HTTP mapping과 physical implementation은 inconsistency가 아니라 approved future decision이므로 변경하지 않았다.
- Book 10/12가 정의하지 않은 TEST/PHASE ID를 임의 발급하지 않았다.
- Existing DRAFT/UNDER_REVIEW decisions를 승인·거절로 변경하지 않았다.

## Verification

각 correction 후 naming token, publication state set, entity mapping, status definition, ID registry와 Markdown link를 재검사했다. 최종 결과는 [Completion Report](PHASE7_5_COMPLETION.md)에 기록한다.

