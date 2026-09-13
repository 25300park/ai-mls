# REL-001 Phase 1G-A Concurrency / Idempotency Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-073 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Data Owner / Domain Owners |
| 기준 commit | `e2ef82655b3dc8f1ebadbdc2512f9e8492ea0059` |

## 1. Rule

Existing aggregate version and expected-version behavior is preserved. Versioning is not added where absent. `requestId` used for authorization/audit correlation is not silently promoted to an idempotency key.

## 2. Matrix

| Store | Existing concurrency evidence | Concurrency result | Existing idempotency evidence | Idempotency result |
|---|---|---|---|---|
| Source Registry | `policyVersion`; capture requires exact policy version; proposal creates version 1 | `RESOLVED_EXISTING` for supported operations | `requestId` only; Phase 1A proposal key/fingerprint has no exact contract | `UNRESOLVED` |
| Intake | `version` plus `expectedVersion` on mutations | `RESOLVED_EXISTING` | AI request key belongs to API-017 handoff; local create/attach/validate/review key/fingerprint is not exact | `UNRESOLVED` |
| Property | node/alias version; existing node decision uses `expectedVersion` | `RESOLVED_EXISTING` | no canonical correction/proposal idempotency key/fingerprint | `UNRESOLVED` |
| Listing | Candidate/Offer/Duplicate versions and expected-version mutations | `RESOLVED_EXISTING` | Candidate create has optional key/fingerprint; remaining create/revision/decision rules required by Phase 1A are absent | `UNRESOLVED` |
| Contact | Contact/Channel/Case versions and expected-version mutations | `RESOLVED_EXISTING` | no exact attempt/mutation idempotency key/fingerprint | `UNRESOLVED` |
| Client / Requirement | Client/Requirement versions and expected-version checks | `RESOLVED_EXISTING` | no exact create/revise/transition key/fingerprint | `UNRESOLVED` |
| Matching | run/result versions and expected-version review/stale checks | `RESOLVED_EXISTING` | Match request has key/fingerprint replay/conflict; review/stale intent idempotency required by Phase 1A is absent | `UNRESOLVED` |

## 3. Counts

| Item | Count |
|---|---:|
| Blocked by concurrency | 0 |
| Blocked by idempotency | 7 |

No generic idempotency table/key format is approved. Exact per-operation keys and fingerprints require a later canonical decision.

## 4. Phase 1G-C reconciliation

[DOC-DEV-080](REL001_PHASE1GC_IDEMPOTENCY_POLICY_DECISION.md)이 domain-owned `COMMAND_ID_BASED`, `VERSION_ONLY`, `APPEND_DEDUP` 조합을 store별로 승인했다. `requestId`는 correlation-only로 유지된다. Current idempotency disposition은 resolved `7/7`, blocked `0`이다.
