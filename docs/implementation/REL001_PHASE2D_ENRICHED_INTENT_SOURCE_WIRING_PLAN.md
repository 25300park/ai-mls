# REL-001 Phase 2D Enriched Audit Intent Source Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-120 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Domain Owners |
| 기준 commit | `6d427b92298168f940e6a37cbe86d0c6c79f8626` |

**Goal:** Phase 1G의 여섯 materialization-ready store가 authoritative mutation과 strict enriched v2 audit intent를 같은 owner-local SQLite transaction에서 커밋하고 Phase 2C가 그대로 소비하도록 한다.

**Architecture:** `modules/audit`의 공용 v2 validator가 Phase 2B closed mapping과 provenance/visibility contract를 단일하게 집행한다. 여섯 store는 새 mutation에서 source-constrained v2 intent만 허용하되 기존 v1 row를 읽기 가능한 immutable history로 유지한다. Staging API-016 composition은 실제 store read surfaces를 six-source `AuditIntentSourcePort`로 조합하며 final Audit Event는 계속 API-016만 생성한다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6.0.3, built-in `node:sqlite`, `node:test`, existing pnpm 11.9.0 workspace; dependencies added 0.

**Spec:** Architecture Owner-approved Phase 2D Brief, `REL001_PHASE2B_VERSIONED_ENRICHED_INTENT_CONTRACT.md`, `REL001_PHASE2B_AUDIT_EVENT_VOCABULARY_MAPPING.md`, `REL001_PHASE2B_PRINCIPAL_PROVENANCE_DECISION.md`, `REL001_PHASE2B_PURPOSE_POLICY_DECISION_OUTCOME_MATRIX.md`.

## Global Constraints

- Included sources are exactly `SOURCE_REGISTRY`, `INTAKE`, `PROPERTY`, `LISTING`, `CONTACT`, `MATCHING`.
- `CLIENT_REQUIREMENT` stays `NOT_MATERIALIZATION_READY`; `updateClient()` emits no v2 intent.
- Existing v1 rows remain readable and immutable, are never rewritten/backfilled, and materialize 0/7.
- No new Audit event type, principal model, inferred purpose/policy/decision/outcome, distributed transaction, public HTTP, API-017 behavior, dependency, or cross-domain repository.
- Mutation + history/idempotency + v2 intent share the existing source-local transaction; intent failure rolls back all.
- Domain stores persist intents only. `DurableMaterializedAuditEvent` creation remains API-016-owned.

---

### Task 1: Source Registry

**Files:** Create `modules/audit/src/enriched-audit-intent-contract.ts` and its test; modify `audit-intent-materializer.ts`, `modules/audit/src/index.ts`, `source-registry-durable-persistence.ts`, and its test.

**Interfaces:** Produce `validateEnrichedAuditIntentV2(value, expectedSource)` and source-constrained `EnrichedAuditIntentV2`. Source Registry uses `SOURCE_POLICY_PROPOSED / source.propose / SourceRegistry / COMMAND_ACCEPTED`, purpose `SOURCE_GOVERNANCE`, outcome `ACCEPTED`.

- [ ] Write RED tests proving legacy v1 is rejected for new mutation, missing provenance/wrong mapping/tenant-scope fails closed, intent failure rolls back state/history/idempotency, and exact replay appends zero duplicates.
- [ ] Clean-build and run the new contract plus Source Registry tests; confirm expected legacy-validator RED.
- [ ] Extract the existing Phase 2C mapping/validator into the shared Audit contract and make the materializer reuse it.
- [ ] Accept and persist only validated `SOURCE_REGISTRY` v2 input in the existing transaction while decoding stored v1/v2 without mutation.
- [ ] Run focused GREEN and record commands/output in the task report.

### Task 2: Intake

**Files:** Modify `modules/intake/src/intake-durable-persistence.ts` and `.test.ts`.

**Interfaces:** Reuse Task 1 contract. Allowed mappings are the seven closed Intake tuples in DOC-DEV-116; visibility is derived `TENANT_BOUND` and must equal the record tenant/scope.

- [ ] RED: exact create/update/evidence mappings, principal provenance, derived tenant/scope conflict, rollback, replay duplicate 0, v1 preservation.
- [ ] Confirm RED because Intake accepts only the legacy shape.
- [ ] Enforce validated `INTAKE` v2 on create/update/appendEvidence before the existing transaction and append the validated payload inside it.
- [ ] Run Intake plus shared-contract/materializer GREEN.

### Task 3: Property

**Files:** Modify `modules/property/src/property-durable-persistence.ts` and `.test.ts`.

**Interfaces:** Reuse Task 1 contract. Allowed mappings are `PROPERTY_PROPOSED`, `PROPERTY_DECIDED`, `PROPERTY_ALIAS_PROPOSED`; visibility is exactly `SYSTEM_BOUND / system:property-master` with no tenant ownership.

- [ ] RED: exact node/alias mapping, false tenant binding rejection, provenance, atomic rollback, replay duplicate 0, v1 preservation.
- [ ] Confirm expected RED at legacy validation.
- [ ] Enforce `PROPERTY` v2 and exact SYSTEM binding within the current transaction without schema or tenant fields.
- [ ] Run Property plus shared-contract/materializer GREEN.

### Task 4: Listing

**Files:** Modify `modules/listing/src/listing-durable-persistence.ts` and `.test.ts`.

**Interfaces:** Reuse Task 1 contract and seven closed Listing tuples; preserve derived tenant/team scope and current command/version rules.

- [ ] RED: candidate/offer/duplicate mappings, wrong event type, provenance, tenant/scope, rollback, replay/conflict, restart and v1 preservation.
- [ ] Confirm expected RED.
- [ ] Enforce `LISTING` v2 at existing create/update transaction boundaries with no new idempotency mechanism.
- [ ] Run Listing plus prior source GREEN.

### Task 5: Contact

**Files:** Modify `modules/contact/src/contact-durable-persistence.ts` and `.test.ts`.

**Interfaces:** Reuse Task 1 contract and five closed Contact tuples. Preserve direct tenant binding and existing Contact Case resolver; create no Contact Case or consent/privacy vocabulary.

- [ ] RED: Contact/channel/attempt mapping, direct tenant/scope, provenance, rollback, replay/conflict, restart, and no implicit case creation.
- [ ] Confirm expected RED.
- [ ] Enforce `CONTACT` v2 in existing transactions only.
- [ ] Run Contact plus prior source GREEN.

### Task 6: Matching

**Files:** Modify `modules/matching/src/matching-durable-persistence.ts` and `.test.ts`.

**Interfaces:** Reuse Task 1 contract and `MATCH_RUN_CREATED`, `MATCH_RESULT_REVIEWED`, `MATCH_RESULT_STALE`; preserve derived requirement/candidate tenant/team binding.

- [ ] RED: exact mapping, provenance, cross-binding rejection, rollback, replay/conflict, restart and v1 preservation.
- [ ] Confirm expected RED.
- [ ] Enforce `MATCHING` v2 within current create/update transactions.
- [ ] Run Matching plus all six source-store GREEN.

### Task 7: Cross-source Atomicity and Idempotency Hardening

**Files:** Create `modules/audit/src/enriched-audit-intent-source-wiring.test.ts`; modify only a proven defective source/contract file.

**Interfaces:** Consume all six stores and shared contract; produce no new repository or persistence subsystem.

- [ ] RED for cross-source intent injection, cross-domain `intentId` collision containment, per-source restart durability, v1 rewrite/backfill 0, Client/Requirement wiring 0, and final-event creation 0.
- [ ] Confirm each RED proves a concrete invariant defect, then make only the minimum correction.
- [ ] Run six-source atomicity/idempotency/restart GREEN.

### Task 8: Phase 2C Materializer Integration

**Files:** Create `apps/api/src/api016-enriched-intent-source-wiring.ts` and `.test.ts`; modify `apps/api/src/index.ts`.

**Interfaces:** Produce `createMaterializationReadyAuditIntentSources(stores)` returning exactly six `AuditIntentSourcePort`s over injected store read methods.

- [ ] RED: six real source rows cannot yet be composed/consumed; v1 is ignored; duplicate final event 0; fields are neither reconstructed nor defaulted.
- [ ] Confirm missing wiring factory RED.
- [ ] Add a read-only adapter factory only—no store construction, timer, HTTP, Session lookup, or final-event creation.
- [ ] Run composed 6/6 materializer GREEN plus Phase 2C regression.

### Task 9: Full Verification, Independent Review, RTM, and Completion Report

**Files:** Create `docs/implementation/REL001_PHASE2D_SOURCE_MAPPING_TRACEABILITY.md` and `docs/reviews/REL001_PHASE2D_COMPLETION_REPORT.md`; modify `REL001_PHASE2_API016_TRACEABILITY_MATRIX.md` and `docs/00_MASTER_INDEX.md`.

**Interfaces:** Record only verified requirement → code → assertion → result evidence. Do not mark later phases complete.

- [ ] Run Phase 2D focused, six store, atomicity, idempotency, provenance, tenant/scope, restart, Phase 2C, Phase 1G, Phase 1D, FEAT-024/023 affected, and one full regression.
- [ ] Run lint, typecheck, clean `tsconfig.build.json` build, architecture checksum, `git diff --check`, Gitleaks, and document/link/ID validation. Do not run dependency audit without Phase 2D-scoped network approval.
- [ ] Obtain fresh independent whole-branch review; require Critical 0 / Important 0 / READY.
- [ ] Record exact counts and either `APPROVE_REL001_PHASE2D_ENRICHED_AUDIT_INTENT_SOURCE_WIRING` or the blocking recommendation.
- [ ] Stop without push or main integration. Preserve dependency/lockfile changes 0.

## Plan Self-review

- Coverage: the nine tasks cover all required source, hardening, integration, verification, and documentation gates.
- Type consistency: every source uses one `EnrichedAuditIntentV2` validator; only API-016 produces final events.
- Scope: Client/Requirement, public HTTP, API-017, new dependencies and new vocabulary remain excluded.
