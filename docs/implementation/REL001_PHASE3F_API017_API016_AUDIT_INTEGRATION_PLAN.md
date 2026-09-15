# REL-001 Phase 3F API-017 / API-016 Audit Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-152 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | API Owner / Audit Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `d1c8664ff4ff872ec16519ed94f0c2b18397cd22` |

**Goal:** DEC-151의 API-017 audit point 9개 중 적용 가능한 7개 owner-local enriched intent를 기존 API-016 materialization pipeline에 연결하고, claim/heartbeat 비적용 및 replay/restart/concurrency 안전성을 검증한다.

**Architecture:** `DurableJobStore`가 이미 Job mutation/history/idempotency와 API-017 `v2` intent를 동일 SQLite transaction에서 기록한다. Phase 3F는 기존 API-016 strict validator에 정확한 7개 mapping을 추가하고, 기존 read-only source port와 Staging runtime composition에 API-017 source를 한 번만 등록한다. Final Audit Event identity와 append-only persistence는 계속 `AuditIntentMaterializer`와 `DurableAuditEventStore`가 소유한다.

**Tech Stack:** TypeScript, Node.js 24 `node:test`, built-in `node:sqlite`, existing API-016/API-017 modules; 신규 dependency 없음.

**Spec:** `docs/implementation/REL001_PHASE3B2_API017_AUDIT_POINT_INVENTORY.md`, `docs/implementation/REL001_PHASE3B2_API016_EVENT_MAPPING_MATRIX.md`, `docs/implementation/REL001_PHASE3B2_API016_VOCABULARY_AMENDMENT.md`

## Global Constraints

- Audit point는 submit/claim/start/heartbeat/result/fail/cancel/expire/retry의 정확한 9개이며 claim/heartbeat는 `NOT_APPLICABLE`이다.
- 승인 event type은 `JOB_SUBMITTED`, `JOB_STARTED`, `JOB_SUCCEEDED`, `JOB_FAILED`, `JOB_CANCELLED`, `JOB_EXPIRED`, `JOB_RETRY_SUBMITTED` 정확히 7개다.
- API-017은 enriched intent만 생성하며 final API-016 Audit Event를 직접 생성하지 않는다.
- 자동 retry, scheduler, polling, queue/message bus, public HTTP/RPC, 신규 lifecycle/principal/tenant/materialization 의미를 추가하지 않는다.
- Dependency audit은 별도 승인 없이는 `NOT_RUN`이다.
- Commit과 push는 현재 승인되지 않았다.

---

### Task 1: Canonical mapping and source-path inventory

**Files:**
- Read: `docs/implementation/REL001_PHASE3B2_API017_AUDIT_POINT_INVENTORY.md`
- Read: `docs/implementation/REL001_PHASE3B2_API016_EVENT_MAPPING_MATRIX.md`
- Read: `modules/jobs/src/job-durable-persistence.ts`
- Create later: `docs/implementation/REL001_PHASE3F_AUDIT_POINT_TRACEABILITY.md`

**Interfaces:**
- Consumes: existing seven `JobAuditIntent` tuples and two `NOT_APPLICABLE` audit points.
- Produces: exact mutation-to-intent-to-materializer mapping used by all later tests.

- [x] **Step 1: Reconfirm the 9-point DEC-151 inventory.**
- [x] **Step 2: Locate the seven transactional intent writes in `DurableJobStore`.**
- [x] **Step 3: Confirm claim/heartbeat methods and event writes are absent.**
- [x] **Step 4: Identify the missing API-016 allowlist/source-composition boundaries.**

### Task 2: RED contract and end-to-end tests

**Files:**
- Create: `apps/api/src/api017-audit-evidence-integration.test.ts`
- Modify: `modules/audit/src/enriched-audit-intent-contract.test.ts`
- Modify: `apps/api/src/api016-enriched-intent-source-wiring.test.ts`
- Modify: `apps/api/src/api016-production-composition.test.ts`

**Interfaces:**
- Consumes: `DurableJobStore`, `createAuditIntentSourcePort`, `createStagingApi016AuditRuntime`.
- Produces: executable proof that API-017 is rejected before implementation and that all DEC-151 invariants are observable.

- [x] **Step 1: Add literal mapping cases for the seven API-017 event tuples.**
- [x] **Step 2: Add a real durable Job → source port → materializer test covering seven events and nine points.**
- [x] **Step 3: Add replay/restart/conflict, chronology, provenance, tenant/scope, lineage and append-only assertions.**
- [x] **Step 4: Add negative assertions for claim/heartbeat, unknown type, unsafe evidence and direct final-event ownership.**
- [x] **Step 5: Compile and run the new focused tests; record expected RED at the API-017 source-domain/mapping allowlist.**

### Task 3: Minimum API-016 contract extension

**Files:**
- Modify: `modules/audit/src/enriched-audit-intent-contract.ts`

**Interfaces:**
- Consumes: exact DEC-151 tuples.
- Produces: `MaterializationReadySourceDomain` support for `API-017` and strict seven-event validation.

- [x] **Step 1: Add `API-017` to the closed materialization-ready source set.**
- [x] **Step 2: Register exactly seven mappings with target `BackgroundJob`.**
- [x] **Step 3: Keep tenant-bound visibility validation and all recursive safe-content checks unchanged.**
- [x] **Step 4: Run contract-focused tests to GREEN.**

### Task 4: Minimum Staging source composition extension

**Files:**
- Modify: `apps/api/src/api016-enriched-intent-source-wiring.ts`
- Modify: `apps/api/src/api016-production-composition.ts`

**Interfaces:**
- Consumes: one injected read-only `jobs` intent reader.
- Produces: a seventh API-016 source port and Staging runtime `sourceCount: 7`.

- [x] **Step 1: Extend the existing store-read tuple with `jobs` only.**
- [x] **Step 2: Add one `API-017` source port through `createAuditIntentSourcePort`.**
- [x] **Step 3: Require all seven canonical source domains exactly once in Staging composition.**
- [x] **Step 4: Run source wiring, composition and Phase 3F E2E tests to GREEN.**

### Task 5: Hardening and regression

**Files:**
- Test: `apps/api/src/api017-audit-evidence-integration.test.ts`
- Test: `modules/jobs/src/job-concurrency-recovery-hardening.test.ts`
- Test: existing Phase 2/3 audit and Job tests.

**Interfaces:**
- Consumes: completed strict source/materialization path.
- Produces: verified replay/restart/concurrency/failure containment with no duplicate final event.

- [x] **Step 1: Verify stale losing Job mutation creates no new intent or final event.**
- [x] **Step 2: Verify exact replay after reopen returns one final event; conflicting content fails closed.**
- [x] **Step 3: Verify `occurredAt` remains Job commit chronology and `materializedAt` remains processing chronology.**
- [x] **Step 4: Verify RetryAsSuccessor predecessor/successor identity and evidence references remain intact.**
- [x] **Step 5: Run Phase 3E/3D/3C and Phase 2 affected regressions.**

### Task 6: Completion evidence and final gates

**Files:**
- Create: `docs/implementation/REL001_PHASE3F_AUDIT_POINT_TRACEABILITY.md`
- Create: `docs/implementation/REL001_PHASE3F_MATERIALIZATION_COMPATIBILITY_MATRIX.md`
- Create: `docs/reviews/REL001_PHASE3F_COMPLETION_REPORT.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`

**Interfaces:**
- Consumes: actual test and validation output only.
- Produces: bounded Phase 3F evidence without Phase 3G claims.

- [x] **Step 1: Run focused and affected tests.**
- [x] **Step 2: Run full regression, lint, typecheck, clean build and verify constituents once.**
- [x] **Step 3: Run architecture checksum, `git diff --check`, Gitleaks and document validation.**
- [x] **Step 4: Obtain independent review with Critical 0 / Important 0.**
- [x] **Step 5: Record actual evidence in traceability, compatibility matrix, RTM, Master Index and completion report.**
- [x] **Step 6: Stop with changes uncommitted; dependency audit remains `NOT_RUN` unless separately authorized.**
