# REL-001 Phase 3C Durable Job Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-144 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `074bfb60920c479ca4b769b068e41d53d9604782` |

**Goal:** 승인된 API-017 Job identity, lifecycle, CAS, command idempotency, manual successor lineage, failure safety와 audit-intent 경계를 하나의 restart-safe SQLite store로 구현한다.

**Architecture:** `modules/jobs`가 단일 `DurableJobStore`와 SQLite schema를 소유한다. 각 mutation은 Job state/history, operation-owned idempotency, lineage 및 API-017 `v2` audit intent를 한 local transaction에서 commit하며, read는 저장된 tenant/scope binding을 요구한다. API-016 final event, worker loop, scheduler, polling 및 HTTP transport는 생성하지 않는다.

**Tech Stack:** Node.js 24.18.0 built-in `node:sqlite`, TypeScript 6.0.3, `node:test`, zero new dependencies.

**Spec:** `docs/implementation/REL001_PHASE3B1_OWNER_DECISION_REGISTER.md`, `docs/implementation/REL001_PHASE3B2_API016_VOCABULARY_AMENDMENT.md`, and the approved Phase 3C Brief.

## Global Constraints

- Job status vocabulary is exactly `QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED | EXPIRED`.
- Public canonical operations remain exactly `SubmitJob`, `ReadJob`, `CancelJob`, `RetryAsSuccessor`, `ReadJobResult`.
- Failure classification is exactly `DEPENDENCY_UNAVAILABLE | JOB_RESULT_INVALID`; caller-authored failure classifications are never authoritative.
- `RetryAsSuccessor` is manual and `NO_FINITE_MAX_REQUIRED`; no automatic retry, scheduler, polling, lease, claim, or heartbeat is added.
- API-017 persists enriched intent only; direct API-016 final Audit Event creation remains zero.
- No HTTP/RPC, external queue, new authority, new lifecycle, new dependency, or distributed transaction.

---

### Task 1: Prove the missing durable boundary RED

**Files:**
- Create: `modules/jobs/src/job-durable-persistence.test.ts`
- Create after RED only: `modules/jobs/src/job-durable-persistence.ts`

**Interfaces:**
- Produces: `DurableJobStore`, `DurableJobStoreError`, `DurableJobRecord`, `JobAuditIntent`, and operation request/result types.
- Store constructor: `new DurableJobStore({ databasePath, idFactory, clock, beforeAuditIntentWrite? })`.

- [ ] Write tests that import the wished-for store and cover durable create/load, duplicate identity conflict, CAS, invalid transition, terminal immutability, restart preservation, tenant/scope preservation, safe failure normalization, successor lineage, duplicate successor prevention, and absence of final Audit Event writes.
- [ ] Compile and run only the new compiled test.
- [ ] Confirm RED because `job-durable-persistence.js` does not exist, not because of malformed test setup.

### Task 2: Implement schema, immutable record validation, SubmitJob and reads

**Files:**
- Create: `modules/jobs/src/job-durable-persistence.ts`
- Modify: `modules/jobs/src/index.ts`
- Test: `modules/jobs/src/job-durable-persistence.test.ts`

**Interfaces:**
- `submitJob(input): { status: "STORED" | "REPLAYED"; job: DurableJobRecord }`
- `readJob({ jobId, tenantId, scopeRef }): DurableJobRecord`
- `readJobResult({ jobId, tenantId, scopeRef }): DurableJobResult`

- [ ] Add an absolute non-memory database-path guard and schema validation.
- [ ] Persist immutable Job identity/input/tenant/scope/purpose/provenance and version `1` in `QUEUED`.
- [ ] Bind submit idempotency to originating command identity, tenant/scope, job type and canonical input fingerprint.
- [ ] Return exact replay without a duplicate mutation/intent; reject conflicting replay with `IDEMPOTENCY_CONFLICT`.
- [ ] Enforce tenant/scope exact match before read disclosure.
- [ ] Run the submit/read/restart focused tests to GREEN.

### Task 3: Implement internal lifecycle and CAS

**Files:**
- Modify: `modules/jobs/src/job-durable-persistence.ts`
- Test: `modules/jobs/src/job-durable-persistence.test.ts`

**Interfaces:**
- `startJob(input): DurableJobRecord`
- `succeedJob(input): DurableJobRecord`
- `failJob(input): DurableJobRecord`
- `expireJob(input): DurableJobRecord`
- `cancelJob(input): { status: "STORED" | "REPLAYED"; job: DurableJobRecord }`

- [ ] Enforce only approved transitions and exact expected-version CAS at the SQL write boundary.
- [ ] Increment version once per successful mutation and attempt once on `QUEUED -> RUNNING`.
- [ ] Bind completion/failure to exact `jobId + attempt + executorId`.
- [ ] Keep terminal records immutable; duplicate or stale terminal completion fails closed.
- [ ] Persist append-only version history and one canonical audit intent per mutation transaction.
- [ ] Run lifecycle/CAS/restart tests to GREEN.

### Task 4: Implement failure-safety boundary

**Files:**
- Modify: `modules/jobs/src/job-durable-persistence.ts`
- Test: `modules/jobs/src/job-durable-persistence.test.ts`

**Interfaces:**
- `normalizeJobFailure(input: { kind: "DEPENDENCY_UNAVAILABLE" | "JOB_RESULT_INVALID"; evidenceRef: string }): NormalizedJobFailure`
- `failJob` consumes only `NormalizedJobFailure`, not caller `failureCode` or raw errors.

- [ ] Reject unknown classifications, raw exceptions, stack/path/SQL/SQLite material, credentials, provider payloads, prompts and chain-of-thought.
- [ ] Persist only normalized code and opaque safe evidence reference.
- [ ] Roll back Job mutation, history, idempotency and audit intent if any persistence step fails.
- [ ] Run failure-safety and rollback tests to GREEN.

### Task 5: Implement manual RetryAsSuccessor atomically

**Files:**
- Modify: `modules/jobs/src/job-durable-persistence.ts`
- Test: `modules/jobs/src/job-durable-persistence.test.ts`

**Interfaces:**
- `retryAsSuccessor(input): { status: "STORED" | "REPLAYED"; predecessor: DurableJobRecord; successor: DurableJobRecord }`

- [ ] Permit successor creation only from `FAILED + DEPENDENCY_UNAVAILABLE` with caller-provided trusted eligibility/authorization evidence references.
- [ ] Keep predecessor state/version/result/failure immutable and store bidirectional lineage without reopening it.
- [ ] Bind retry idempotency to command identity, predecessor identity/version and eligibility snapshot.
- [ ] Exact replay returns the same successor; conflicting replay fails closed.
- [ ] Reject retry from `SUCCEEDED` or any noneligible state and verify automatic retry/scheduler surfaces remain absent.
- [ ] Run successor/idempotency/restart tests to GREEN.

### Task 6: Harden integrity and audit ownership

**Files:**
- Modify: `modules/jobs/src/job-durable-persistence.ts`
- Test: `modules/jobs/src/job-durable-persistence.test.ts`

**Interfaces:**
- `listAuditIntents({ tenantId, scopeRef }): readonly JobAuditIntent[]`
- `close(): void`

- [ ] Validate SQLite integrity and exact schema on reopen; corrupted or unexpected schema fails closed with safe `PERSISTENCE_UNAVAILABLE`.
- [ ] Validate loaded status, version, chronology, lineage, tenant/scope, provenance and safe reference fields before returning immutable snapshots.
- [ ] Verify claim/heartbeat tables or methods do not exist and final API-016 event tables/writes are absent.
- [ ] Verify mutation-time chronology survives restart and audit intents are append-only.
- [ ] Run all Phase 3C tests and existing Job/API-017 tests.

### Task 7: Verification and evidence

**Files:**
- Create: `docs/implementation/REL001_PHASE3C_DURABLE_JOB_STORE_TRACEABILITY.md`
- Create: `docs/reviews/REL001_PHASE3C_COMPLETION_REPORT.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`

- [ ] Run Phase 3C focused, Phase 2 API-016, Phase 1G, Phase 1D and affected FEAT-023/024 regressions.
- [ ] Run full regression once, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, gitleaks and document/link validation.
- [ ] Record dependency audit as `NOT_RUN` unless separately authorized and actually executed.
- [ ] Perform fresh independent review and require Critical `0`, Important `0`, `READY`.
- [ ] Record only actual evidence; keep worker execution, scheduler, automatic retry and public HTTP as not implemented.
- [ ] Stop without commit or push until separate closeout authorization.
