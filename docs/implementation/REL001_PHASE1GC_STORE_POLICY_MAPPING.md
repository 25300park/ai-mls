# REL-001 Phase 1G-C Store Policy Mapping

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-082 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Security Owner / Audit Owner / Domain Owners |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## Canonical mapping

| Store | Ownership boundary | Tenant/organization binding | Idempotency strategy | Concurrency strategy | Audit strategy | API-016 dependency | Eligibility |
|---|---|---|---|---|---|---|---|
| Source Registry | Source owner | `DIRECT_TENANT_BOUND`; Organization separate | proposal/create `COMMAND_ID_BASED` | existing policy version/exact version | state + history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |
| Intake | Intake owner | `DERIVED_TENANT_BOUND` via Source/Raw Source | create `COMMAND_ID_BASED`; evidence `APPEND_DEDUP` | update `VERSION_ONLY` | state + attachments/history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |
| Property | Property owner | `SYSTEM_BOUND` canonical master | proposal/alias `COMMAND_ID_BASED` | decision/update `VERSION_ONLY` | master/lineage/history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |
| Listing | Listing owner | `DERIVED_TENANT_BOUND` via Intake/Source | create `COMMAND_ID_BASED` | revision/decision `VERSION_ONLY` | state + provenance/history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |
| Contact | Contact owner | `DIRECT_TENANT_BOUND`; Organization affiliation metadata only | create `COMMAND_ID_BASED`; communication/evidence `APPEND_DEDUP` | update `VERSION_ONLY` | state + privacy/history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |
| Client / Requirement | Client/Requirement owner | Client direct; Requirement derived from Client | both creates `COMMAND_ID_BASED`; history/evidence `APPEND_DEDUP` | authoritative updates `VERSION_ONLY` | owner-local state + history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |
| Matching | Matching owner | `DERIVED_TENANT_BOUND` via Requirement/Candidate | existing canonical request key; history/evidence `APPEND_DEDUP` | review/stale mutation `VERSION_ONLY` | run/result state + history/idempotency + immutable audit intent in one local transaction | later append-only materialization only | `IMPLEMENTATION_READY` |

## Counts

| Item | Result |
|---|---:|
| Stores evaluated | 7 |
| Ownership resolved | 7/7 |
| Idempotency resolved | 7/7 |
| Audit relationship resolved | 7/7 |
| `IMPLEMENTATION_READY` | 7 |
| Still blocked | 0 |
| Remaining AO blockers | 0 |

## Implementation boundary

Phase 1G implementation may build these seven bounded stores. It must not add HTTP/transport exposure, a generic Core repository, generic idempotency, final API-016 Audit Event creation, new business operations/lifecycles, or cross-domain/distributed transactions.
