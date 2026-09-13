# REL-001 Phase 1G Persistence Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-084 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Security Owner / Audit Owner |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Scope

Phase 1G-C에서 승인된 seven owner-bounded durable store의 tenant/ownership binding, mixed domain-owned idempotency, optimistic concurrency, append-only history 및 domain mutation + durable audit intent atomicity를 실제 구현과 assertion에 연결한다. HTTP/transport, API-017 semantics 및 final API-016 Audit Event materialization은 범위 밖이다.

## 2. Store traceability

| Store owner | Canonical policy | Production implementation | Direct verification | 결과 |
|---|---|---|---|---|
| Source Registry | direct tenant; `COMMAND_ID_BASED` + `VERSION_ONLY` | [`DurableSourceRegistryStore`](../../modules/source/src/source-registry-durable-persistence.ts) | [`source-registry-durable-persistence.test.ts`](../../modules/source/src/source-registry-durable-persistence.test.ts): restart, tenant concealment, replay conflict, rollback, history, no final API-016 event | PASS |
| Intake | Source-derived tenant; `COMMAND_ID_BASED` + `VERSION_ONLY` + `APPEND_DEDUP` | [`DurableIntakeStore`](../../modules/intake/src/intake-durable-persistence.ts) | [`intake-durable-persistence.test.ts`](../../modules/intake/src/intake-durable-persistence.test.ts): derived binding, restart, stale version, append dedup, rollback, history | PASS |
| Property | system-bound; `COMMAND_ID_BASED` + `VERSION_ONLY` | [`DurablePropertyStore`](../../modules/property/src/property-durable-persistence.ts) | [`property-durable-persistence.test.ts`](../../modules/property/src/property-durable-persistence.test.ts): restart, replay conflict, stale version, rollback, history, no tenant inference | PASS |
| Listing | Candidate Intake/Source-derived tenant; Offer/Duplicate Candidate-derived | [`DurableListingStore`](../../modules/listing/src/listing-durable-persistence.ts) | [`listing-durable-persistence.test.ts`](../../modules/listing/src/listing-durable-persistence.test.ts): restart, derived binding, live revalidation, replay conflict, stale version, rollback | PASS |
| Contact | direct tenant; Communication requires existing authoritative Contact Case | [`DurableContactStore`](../../modules/contact/src/contact-durable-persistence.ts) | [`contact-durable-persistence.test.ts`](../../modules/contact/src/contact-durable-persistence.test.ts): restart, versioning, resolver-only Case binding, no implicit Case creation, rollback, safe diagnostics | PASS |
| Client / Requirement | Client direct tenant/team; Requirement Client-derived | [`DurableClientRequirementStore`](../../modules/client/src/client-requirement-durable-persistence.ts) | [`client-requirement-durable-persistence.test.ts`](../../modules/client/src/client-requirement-durable-persistence.test.ts): restart, derived binding, history, replay conflict, stale version, rollback | PASS |
| Matching | Requirement/Candidate-derived tenant/team | [`DurableMatchingStore`](../../modules/matching/src/matching-durable-persistence.ts) | [`matching-durable-persistence.test.ts`](../../modules/matching/src/matching-durable-persistence.test.ts): restart, cross-binding rejection, live revalidation, replay conflict, history, rollback | PASS |

## 3. Cross-store invariants

| Requirement | Assertion evidence | 결과 |
|---|---|---|
| Exactly seven owner-local adapters | [`rel001-phase1g-persistence-architecture.test.ts`](../../apps/api/src/rel001-phase1g-persistence-architecture.test.ts) imports and exercises the seven adapters only | PASS |
| Atomic mutation + history/idempotency + audit intent | Every mutation test injects an audit-intent failure and asserts complete rollback | PASS |
| Canonical command replay | Stored canonical payload is compared in addition to command identity/fingerprint; changed payload conflicts without mutation | PASS |
| Optimistic concurrency | `VERSION_ONLY` paths assert stale version rejection and single version advance | PASS |
| Append-only evidence/history | SQLite update/delete prevention triggers and immutable history assertions cover all governed record groups | PASS |
| Exact schema/trigger safety | Live `sqlite_master` table/trigger SQL is compared with a golden database created from the exact store schema; weakened constraints and same-name no-op triggers fail closed | PASS |
| Tenant/scope concealment | Direct and derived bindings are resolved authoritatively; mismatch and resolver diagnostics are concealed | PASS |
| Safe evidence | Bounded evidence grammar and prohibited-value checks reject PII/secret/prompt/stack/path/raw-provider-like values | PASS |
| Restart authority | Reopened SQLite state remains authoritative; process-local mutation cannot override durable truth | PASS |
| No forbidden expansion | Contact Case creation `0`; final API-016 Event creation `0`; API-017 semantics `0`; HTTP/transport additions `0` | PASS |

## 4. Verification evidence

| Gate | Result |
|---|---|
| Phase 1G focused | 38/38 PASS |
| Full regression | 1291/1291 PASS |
| Lint / Typecheck / Build / Verify | PASS |
| Architecture checksum | 153/153 PASS; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks current tree | 0 findings |
| Dependency / lockfile changes | 0 |
| Independent review | Critical 0 / Important 0 / Minor 0 — READY |

## 5. Disposition

Phase 1G durable persistence foundation is `IMPLEMENTED_AND_VERIFIED`. 이 판정은 blocked Phase 1F transport readiness를 자동으로 완료하거나 API-016/API-017/HTTP 권한을 확장하지 않는다.
