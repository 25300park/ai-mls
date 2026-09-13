# REL-001 Phase 1G Core Durable Persistence Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-083 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Domain Owners |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Objective

[Phase 1G-C Store Policy Mapping](REL001_PHASE1GC_STORE_POLICY_MAPPING.md)의 ownership, tenant binding, mixed idempotency 및 durable audit-intent atomicity를 일곱 bounded domain store로 구현한다. Phase 1G는 persistence foundation만 제공하며 application transport, HTTP, API-017 job semantics 및 final API-016 Audit Event materialization을 구현하지 않는다.

## 2. Implementation shape

각 domain은 자기 `node:sqlite` adapter, tables, transaction 및 validation을 소유한다. 동일 database file을 configuration으로 공유할 수 있지만 table prefix와 repository class는 owner별로 분리한다. generic Core repository/UoW, generic idempotency table 또는 eighth store는 만들지 않는다.

| Store | Production file | Focused test file | Binding boundary |
|---|---|---|---|
| Source Registry | `modules/source/src/source-registry-durable-persistence.ts` | `modules/source/src/source-registry-durable-persistence.test.ts` | direct tenant |
| Intake | `modules/intake/src/intake-durable-persistence.ts` | `modules/intake/src/intake-durable-persistence.test.ts` | Source/Raw Source resolver |
| Property | `modules/property/src/property-durable-persistence.ts` | `modules/property/src/property-durable-persistence.test.ts` | system-bound master |
| Listing | `modules/listing/src/listing-durable-persistence.ts` | `modules/listing/src/listing-durable-persistence.test.ts` | Intake/Source resolver |
| Contact | `modules/contact/src/contact-durable-persistence.ts` | `modules/contact/src/contact-durable-persistence.test.ts` | direct tenant; no Case create |
| Client / Requirement | `modules/client/src/client-requirement-durable-persistence.ts` | `modules/client/src/client-requirement-durable-persistence.test.ts` | Client direct; Requirement from stored Client |
| Matching | `modules/matching/src/matching-durable-persistence.ts` | `modules/matching/src/matching-durable-persistence.test.ts` | Requirement/Candidate resolver |

Existing module `index.ts` files export only their own new bounded store. No API composition or route file changes.

## 3. Common safety rules implemented independently

각 adapter는 다음 technical behavior를 독립적으로 구현한다.

- absolute file path only; `:memory:`/URI/relative path rejection;
- `WAL`, `synchronous=FULL`, foreign keys and bounded busy timeout;
- integrity/schema verification and safe `PERSISTENCE_UNAVAILABLE` error;
- immutable cloned DTO reconstruction rather than returning parsed mutable objects;
- `BEGIN IMMEDIATE` owner-local transaction;
- aggregate state/history or append evidence + domain idempotency + immutable audit intent atomic commit;
- audit-intent failure injection before commit for rollback tests;
- expected-version conditional write where `VERSION_ONLY` applies;
- append-only tables protected by no-update/no-delete triggers;
- per-store idempotency table with same command/key+fingerprint replay and conflicting fingerprint rejection;
- `requestId` excluded from idempotency keys;
- no final Audit Event table or materialization logic.

## 4. TDD task sequence

### Task 1 — Source Registry RED/GREEN

1. Add tests for direct tenant isolation, command replay/conflict, restart durability, transaction rollback on audit-intent failure and absence of final Audit Event.
2. Run compiled focused test and confirm RED because `DurableSourceRegistryStore` does not exist.
3. Implement the minimum Source-owned schema/adapter and export.
4. Run focused GREEN.

### Task 2 — Intake RED/GREEN

1. Add tests for authoritative Source/Raw Source tenant resolution, mismatch fail-closed, create replay/conflict, append dedup, stale version rejection, rollback and reopen.
2. Confirm RED for the missing Intake boundary.
3. Implement the minimum Intake-owned adapter and export.
4. Run Source + Intake focused GREEN.

### Task 3 — Property and Listing RED/GREEN

1. Add Property tests proving system ownership, tenant permission non-inference, proposal/alias replay, version conflicts, audit atomicity and reopen.
2. Add Listing tests proving Intake/Source derived binding, create replay, version-only revisions/decisions, mismatch rejection and reopen.
3. Confirm RED before each production file.
4. Implement minimum owner-specific adapters and exports, then run four-store GREEN.

### Task 4 — Contact RED/GREEN

1. Add direct tenant, communication/evidence append-dedup, version-only update, restart and audit rollback tests.
2. Prove no persistence API can implicitly create Contact Case and no Case row appears.
3. Confirm RED, implement minimum adapter/export and run focused GREEN.

### Task 5 — Client / Requirement RED/GREEN

1. Add Client direct binding and Requirement derivation from stored Client tests.
2. Cover create command replay/conflict, version-only updates, append-dedup history, mismatch, rollback and restart.
3. Confirm RED, implement minimum combined owner adapter/export and run focused GREEN.

### Task 6 — Matching RED/GREEN

1. Add authoritative Requirement/Candidate resolver, conflicting chain rejection, existing request idempotency, version-only review/stale mutation, append-dedup and restart tests.
2. Confirm RED, implement minimum Matching-owned adapter/export and run all seven focused suites.

### Task 7 — Cross-store hardening

1. Add architecture assertions: exactly seven bounded durable store adapters, no generic Core repository/table, no HTTP/route changes, no final API-016 Event materialization, no API-017 or Contact Case creation semantics.
2. Add safe evidence tests rejecting raw secrets, PII beyond canonical domain fields, raw payloads and unsafe diagnostics.
3. Verify process-local objects cannot override reopened durable truth.
4. Run Phase 1D, FEAT-024 and FEAT-023 affected regressions.

### Task 8 — Final evidence

1. Run full regression once, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check` and Gitleaks.
2. Perform independent review and require `READY` with Critical `0` / Important `0`.
3. Create `REL001_PHASE1G_PERSISTENCE_TRACEABILITY_MATRIX.md` and `REL001_PHASE1G_CORE_DURABLE_PERSISTENCE_COMPLETION_REPORT.md` using actual evidence only.
4. Update Master Index only for created Phase 1G artifacts.
5. Do not commit or push without a separate closeout authorization.

## 5. Error and authority boundary

Persistence errors use bounded domain-specific codes for invalid input, not found, scope violation, version conflict, idempotency conflict, append conflict and unavailable persistence. Raw SQLite, SQL, path, stack, secret or payload details are never exposed. Stores validate binding and durable consistency but do not grant authorization; the existing live authorization boundary remains authoritative above them.

## 6. Stop conditions

Stop before extending scope if any RED test requires new ownership semantics, Tenant/Organization/Team equivalence, generic idempotency, distributed transaction, final API-016 Event logic, API-017 behavior, Contact Case creation, HTTP transport, new dependency/package, or a new business lifecycle.
