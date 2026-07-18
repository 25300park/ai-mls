# Phase 4 Completion — Database Architecture

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Phase | Phase 4 — Database Architecture |

## 1. Objective

AI MLS의 complete logical data model을 문서화했다. entity, relationship, cardinality, bounded context, ownership, authority, lifecycle, logical constraints, indexing/search와 retention/deletion governance를 정의했다. SQL, executable schema, migration, API, application implementation과 Phase 5 산출물은 생성하지 않았다.

## 2. Documents Read

- [README](../../README.md), [AGENTS](../../AGENTS.md)
- [Master Index](../00_MASTER_INDEX.md), [Glossary](../00_GLOSSARY.md), [Document Governance](../00_DOCUMENT_GOVERNANCE.md), [Document ID Rule](../00_DOCUMENT_ID_RULE.md), [Traceability Rule](../00_TRACEABILITY_RULE.md)
- [Book 0 — Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md)의 모든 문서
- [Book 1 — Business Strategy](../book-1/00_BUSINESS_STRATEGY_INDEX.md)의 모든 문서
- [Book 2 — System Architecture](../book-2/00_ARCHITECTURE_INDEX.md)의 모든 문서
- [A1 Completion](A1_COMPLETION.md), [A2 Completion](A2_COMPLETION.md), [A3 Completion](A3_COMPLETION.md)

## 3. Files Created

| Document ID | 파일 | 책임 |
|---|---|---|
| DOC-DATA-001 | [Database Architecture Index](../book-3/00_DATABASE_ARCHITECTURE_INDEX.md) | Book 3 navigation/principles/capability coverage |
| DOC-DATA-002 | [Data Domain Model](../book-3/01_DATA_DOMAIN_MODEL.md) | domain, context, ownership, authority, lifecycle |
| DOC-DATA-003 | [Entity Relationship Model](../book-3/02_ENTITY_RELATIONSHIP_MODEL.md) | ER, cardinality, ownership/reference rules |
| DOC-DATA-004 | [Database Standards](../book-3/03_DATABASE_STANDARDS.md) | logical naming, ID, timestamp, status, deletion, audit |
| DOC-DATA-005 | [Source and Raw Data Model](../book-3/04_SOURCE_AND_RAW_DATA_MODEL.md) | source/raw/attachment/collector/provenance |
| DOC-DATA-006 | [Property Master Model](../book-3/05_PROPERTY_MASTER_MODEL.md) | property hierarchy, alias, canonical merge/split |
| DOC-DATA-007 | [Candidate and Offer Model](../book-3/06_CANDIDATE_AND_OFFER_MODEL.md) | candidate/offer/source/duplicate/availability lifecycle |
| DOC-DATA-008 | [Contact Model](../book-3/07_CONTACT_MODEL.md) | contact/organization/communication/privacy |
| DOC-DATA-009 | [Client and Requirement Model](../book-3/08_CLIENT_AND_REQUIREMENT_MODEL.md) | client/requirement/budget/preference/history |
| DOC-DATA-010 | [Matching Model](../book-3/09_MATCHING_MODEL.md) | match/score/explanation/confidence/ranking/history |
| DOC-DATA-011 | [Verification and Permission Model](../book-3/10_VERIFICATION_AND_PERMISSION_MODEL.md) | verification/permission/expiry/reverification |
| DOC-DATA-012 | [Publication Model](../book-3/11_PUBLICATION_MODEL.md) | representation/target/status/history/rollback |
| DOC-DATA-013 | [Audit and History Model](../book-3/12_AUDIT_AND_HISTORY_MODEL.md) | audit/status/decision/approval/user action history |
| DOC-DATA-014 | [Retention and Deletion Model](../book-3/13_RETENTION_AND_DELETION_MODEL.md) | retention/archive/deletion/recovery/legal hold |
| DOC-DATA-015 | [Indexing and Search Strategy](../book-3/14_INDEXING_AND_SEARCH_STRATEGY.md) | logical search/duplicate/property/geo/contact index |
| DOC-DATA-016 | [Data Dictionary](../book-3/15_DATA_DICTIONARY.md) | entity별 complete logical definition |
| DOC-REVIEW-007 | [PHASE4_COMPLETION.md](PHASE4_COMPLETION.md) | Phase 4 completion evidence |

## 4. Files Updated

| 파일 | 변경 내용 |
|---|---|
| [Master Index](../00_MASTER_INDEX.md) | Book 3 16개 문서와 Phase 4 report를 `AVAILABLE`/canonical registry에 등록 |
| [Version History](../00_VERSION_HISTORY.md) | Phase 4 Book 3 `v0.1 / DRAFT` creation 기록 |
| [Decision Register](../00_DECISION_REGISTER.md) | DEC-017–DEC-023을 `UNDER_REVIEW`로 등록 |
| [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md) | CR-006 documentation implementation 등록 |

## 5. Key Decisions Added

### Database Summary

- logical model은 Identity/Access, Source/Intake, Property Master, Listing Intelligence, Contact, Client Requirement, Matching, Verification/Permission, Publication, AI Work, Audit, Retention/Reliability context로 분리된다.
- source evidence, canonical Property/Unit, Candidate Listing, Listing Offer, Verification, Permission와 Publication은 별도 entity와 authority를 가진다.
- “verified listing”은 중복 master record가 아니라 Candidate/Offer에 대한 유효하고 scope-bound Verification으로 판단되는 projection이다.
- Publication은 승인 당시 representation과 target delivery/reconciliation을 소유하며 underlying property truth를 소유하지 않는다.
- Raw Source와 transformation lineage는 merge/correction/deletion에서도 보존된다.
- search, duplicate, geo, contact index는 canonical version에 연결된 rebuildable projection이다.
- privacy deletion은 Soft Delete와 별개이며 archive, legal hold, derived copy, index, AI, export와 backup 영향까지 추적한다.

### Major Decisions

| Decision | Status | Summary |
|---|---|---|
| DEC-017 | UNDER_REVIEW | record type별 canonical bounded-context owner와 authority class |
| DEC-018 | UNDER_REVIEW | opaque stable identifier와 UUID 계열 우선 평가; exact version 미결정 |
| DEC-019 | UNDER_REVIEW | source/property/candidate/offer/verification/permission/publication 분리 |
| DEC-020 | UNDER_REVIEW | permission은 verification과 독립적인 목적·대상·scope·기간 record |
| DEC-021 | UNDER_REVIEW | important state/decision/approval/action의 append-oriented history |
| DEC-022 | UNDER_REVIEW | Soft Delete default + policy-driven archive/final disposition/legal hold/recovery |
| DEC-023 | UNDER_REVIEW | search index는 non-authoritative projection이며 canonical gate 재검사 |

PostgreSQL preference는 기존 [ADR-003](../adr/ADR-003-POSTGRESQL-PREFERRED.md)의 DRAFT 상태를 유지한다. Phase 4는 이를 승인하거나 physical schema/provider를 선택하지 않았다.

## 6. Open Decisions

1. named Data Owner, Database Reviewer, Security/Privacy Owner, Source Policy Owner와 merge/verification/publication approver는 누구인가?
2. UUID version/generation boundary, exact state vocabulary, transaction/concurrency와 physical constraint 방식은 무엇인가?
3. Philippine address/property hierarchy, canonical identifier source, unit/floor naming과 geo precision은 어떻게 정할 것인가?
4. field-level verification granularity, freshness period, verifier qualification와 self/two-person approval 기준은 무엇인가?
5. permission subject/field/representation granularity와 grantor authority evidence는 무엇인가?
6. privacy classification taxonomy, exact retention period, legal basis, archive, backup deletion/recovery와 legal hold owner는 무엇인가?
7. score/confidence scale, ranking cohort, eligibility filter와 match/AI result retention은 무엇인가?
8. rbs-homes contract, target status mapping, reconciliation, correction/withdraw capability와 SLA는 무엇인가?
9. search engine/extension, multilingual tokenization, geo/contact searchable-encryption trade-off와 performance target은 무엇인가?

## 7. Inconsistencies Found

- 기존 계획의 legacy A-series label과 달리 현재 사용자는 `Phase 4`와 `PHASE4_COMPLETION.md`를 명시했다. 동일한 Book 3 database scope로 해석하고 현재 요청의 phase/file naming을 Master Index에 반영했다.
- A1–A3 문서와 DEC-009–DEC-016은 여전히 `DRAFT`/`UNDER_REVIEW`다. Phase 4는 사용자의 명시적 진행 지시에 따라 이를 입력 candidate로 사용했지만 승인된 baseline으로 표현하지 않았다.
- Glossary의 `verified listing`은 개념 상태이며 mandatory entity list에는 별도 Verified Listing entity가 없다. 중복 authority를 만들지 않기 위해 유효 Verification이 Candidate/Offer revision을 qualification하는 model로 정의했다.
- Mandatory “Soft Delete Default”와 privacy deletion 의무는 동일하지 않다. Soft Delete는 business visibility control, final disposition은 retention/deletion policy job으로 분리해 충돌을 해소했다.
- rbs-homes API/withdraw/reconciliation capability는 아직 evidence 없는 `ASSUMPTION`이다.
- PostgreSQL은 ADR-003의 preferred candidate일 뿐 승인된 physical database 결정이 아니다.

## 8. Validation Performed

### Validation Results

| 검사 | 결과 | Evidence/Note |
|---|---|---|
| Required files | PASS | Book 3 16/16 + completion report 존재 |
| Mandatory entities | PASS | 요청된 core entity 31/31 Data Dictionary 포함; 사용된 supporting entity도 등록 |
| Required principles | PASS | 10/10 index와 domain/standards/model 문서에 적용 |
| Required diagrams | PASS | ER, Property Hierarchy, Listing Lifecycle, Verification Lifecycle, Publication Lifecycle 5/5 |
| Entity/authority consistency | PASS | candidate/verified/published, source/master/offer, permission/verification 분리 확인 |
| Lifecycle consistency | PASS | correction/expiry/revocation/reverification/withdrawal과 history linkage 확인 |
| Book 0–2/Glossary consistency | PASS WITH DRAFT LIMITATION | constitutional gates와 A3 flow 준수; upstream approval는 대기 중 |
| Document IDs | PASS | DOC-DATA-001–016, DOC-REVIEW-007 등록; metadata 중복 없음; Master registry unique ID 85개 |
| Markdown links | PASS | Phase 4/current cross-reference 해소; future `PLANNED` links는 Master 규칙대로 제외 |
| Mermaid syntax | PASS WITH LIMITATION | required block/fence/cardinality/state source 구조 검사; Mermaid CLI 부재로 renderer compile 미수행 |
| No SQL/migration/API | PASS | executable DDL/DML/index/transaction/API route 패턴과 migration artifact 없음 |
| No implementation | PASS | application code, physical schema, migration, endpoint, deployment artifact 없음 |
| Phase boundary | PASS | Phase 5/Book 4 artifact 생성 없음 |

## 9. Known Limitations

- 이 모델은 complete logical model이며 executable schema가 아니다. physical types, nullability, exact uniqueness/check/cascade, transaction isolation, partitioning과 vendor index는 의도적으로 미결정이다.
- exact privacy classification, retention period, legal basis와 data residency는 Security/Privacy/legal review가 필요하다.
- market-specific property hierarchy와 address/geo standards는 representative data profiling 없이 확정하지 않았다.
- workload baseline과 search/match/retention volume이 없어 numeric performance/capacity target을 제시하지 않았다.
- Mermaid renderer/CLI가 없어 실제 diagram compile을 검증하지 못했다.
- workspace가 Git repository로 인식되지 않아 Git diff evidence 대신 filesystem, registry와 content validation을 사용했다.
- 문서는 legal, privacy 또는 real-estate compliance advice가 아니다.

## 10. Next Brief Prerequisites

### Recommendation for Phase 5

Phase 5를 자동으로 시작하지 않는다. 진행 전 다음이 필요하다.

1. 사용자가 Phase 4와 DEC-017–DEC-023의 approve/revise/defer disposition을 결정한다.
2. Database Reviewer, Data Owner, Security/Privacy Owner, AI Reviewer와 Business Owner의 named 역할 또는 approval evidence 방식을 지정한다.
3. Phase 5가 사용할 AI Job/AI Result, provenance, privacy class, retention과 no-direct-authority boundary를 확인한다.
4. confidence/score meaning, allowed AI input data class, prompt/provider retention과 human correction linkage의 우선 open decisions를 정한다.
5. physical schema나 migration은 향후 명시적 implementation phase와 승인된 database decision 전에는 시작하지 않는다.

이 보고서 생성으로 Phase 4 작업을 중단한다. Phase 5는 별도 사용자 지시 없이는 시작하지 않는다.
