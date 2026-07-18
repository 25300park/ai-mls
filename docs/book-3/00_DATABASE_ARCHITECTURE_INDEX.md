# Book 3 — Database Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Book 3는 AI MLS의 완전한 **logical data model**을 정의한다. entity 의미, 관계, ownership, authority, lifecycle, logical constraint, indexing/search와 data governance를 다루며 SQL, executable schema, migration, API 또는 physical deployment를 정의하지 않는다.

## Navigation

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-DATA-002 | [Data Domain Model](01_DATA_DOMAIN_MODEL.md) | domain, bounded context, owner, authority와 lifecycle |
| DOC-DATA-003 | [Entity Relationship Model](02_ENTITY_RELATIONSHIP_MODEL.md) | primary entity, cardinality, ownership와 reference |
| DOC-DATA-004 | [Database Standards](03_DATABASE_STANDARDS.md) | logical naming, identity, timestamp, state, deletion, audit standards |
| DOC-DATA-005 | [Source and Raw Data Model](04_SOURCE_AND_RAW_DATA_MODEL.md) | source registry, raw evidence, attachment, collector와 provenance |
| DOC-DATA-006 | [Property Master Model](05_PROPERTY_MASTER_MODEL.md) | property/building/tower/floor/unit/location/alias hierarchy |
| DOC-DATA-007 | [Candidate and Offer Model](06_CANDIDATE_AND_OFFER_MODEL.md) | candidate, offer, source, duplicate, availability와 lifecycle |
| DOC-DATA-008 | [Contact Model](07_CONTACT_MODEL.md) | contact, organization, communication, verification와 privacy |
| DOC-DATA-009 | [Client and Requirement Model](08_CLIENT_AND_REQUIREMENT_MODEL.md) | client, requirement, preference, budget와 history |
| DOC-DATA-010 | [Matching Model](09_MATCHING_MODEL.md) | match score, explanation, confidence, ranking와 history |
| DOC-DATA-011 | [Verification and Permission Model](10_VERIFICATION_AND_PERMISSION_MODEL.md) | verification, verifier, permission, expiry와 reverification |
| DOC-DATA-012 | [Publication Model](11_PUBLICATION_MODEL.md) | publication, target, status, history와 rollback |
| DOC-DATA-013 | [Audit and History Model](12_AUDIT_AND_HISTORY_MODEL.md) | audit, status, decision, approval와 user action history |
| DOC-DATA-014 | [Retention and Deletion Model](13_RETENTION_AND_DELETION_MODEL.md) | retention, archive, deletion, recovery와 legal hold |
| DOC-DATA-015 | [Indexing and Search Strategy](14_INDEXING_AND_SEARCH_STRATEGY.md) | logical search/duplicate/property/geo/contact indexes |
| DOC-DATA-016 | [Data Dictionary](15_DATA_DICTIONARY.md) | mandatory entity별 meaning, authority, lifecycle, privacy와 retention |

## Core principles

1. Single Source of Truth means one canonical owner per record type, not one undifferentiated record.
2. No Data Duplication Without Provenance.
3. Candidate Listing is not Verified Listing.
4. Verified Listing is not Published Listing.
5. Permission is separate from Verification.
6. Every important state is auditable.
7. Soft Delete is the default business deletion posture, subject to privacy and retention policy.
8. Every retained entity has a retention policy or an explicit policy class.
9. Every entity has a privacy classification.
10. Authority is explicit and cannot be inferred from source, AI confidence or publication status.

## Trace bindings

Book 3 introduces logical database capabilities `DB-001`–`DB-015`. They constrain future schema/API/test work but are not executable artifacts. They trace to `REQ-CONST-003`–`013`, `BG-001`–`006`, and [Book 2 Data Flow](../book-2/05_DATA_FLOW_ARCHITECTURE.md).

## Scope exclusions

- SQL, DDL, table/column types, indexes expressed as executable statements
- migration order, seed data, stored procedures or database vendor extensions
- API payloads/endpoints and UI forms
- encryption algorithm, cloud service or physical topology
- Phase 5 AI architecture

> **OPEN DECISION:** named Data Owner, Database Reviewer, Security/Privacy Owner와 retention approver를 지정해야 한다.

