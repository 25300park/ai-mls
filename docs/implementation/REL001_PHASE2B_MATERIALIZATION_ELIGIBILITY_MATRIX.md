# REL-001 Phase 2B Materialization Eligibility Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-119 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Architecture Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Eligibility rule

`MATERIALIZATION_READY` means the source has a closed v2 mapping and can enter later source-enrichment TDD. It does not mean current v1 records are materializable or that runtime implementation exists.

## 2. Matrix

| Source | Event tuple | Principal | Purpose/policy | Decision/outcome | Identity/chronology/visibility | v2 eligibility | Current v1 |
|---|---|---|---|---|---|---|---|
| Source Registry | closed | resolved | resolved | resolved | Phase 2A resolved | MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |
| Intake | closed | resolved | resolved | resolved | Phase 2A resolved | MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |
| Property | closed | resolved | resolved | resolved | Phase 2A resolved | MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |
| Listing | closed | resolved | resolved | resolved | Phase 2A resolved | MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |
| Contact | closed | resolved | resolved | resolved | Phase 2A resolved | MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |
| Client / Requirement | `updateClient()` event type absent | resolved | resolved | resolved | Phase 2A resolved | NOT_MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |
| Matching | closed | resolved | resolved | resolved | Phase 2A resolved | MATERIALIZATION_READY | NOT_MATERIALIZATION_READY |

## 3. Partial implementation boundary

Phase 2 implementation authorization is `PARTIAL`: later TDD may implement v2 production for the six ready sources and the API-016 materialization boundary. Runtime configuration must enable a source only after its v2 atomic-write and mapping tests pass. Client / Requirement remains disabled as a source until the exact `updateClient()` Audit Event type is owner-approved.

No v1 intent may enter the final store. Mixed v1/v2 enumeration must classify each record by explicit version and skip/fail closed without rewriting v1.

## 4. Counts

- Intent sources: `7`
- v2 mappings resolved: `6/7`
- v2 `MATERIALIZATION_READY`: `6`
- v2 `NOT_MATERIALIZATION_READY`: `1`
- current v1 materializable: `0/7`
- remaining owner blocker: `1`
