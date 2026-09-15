# REL-001 Phase 3E API-017 Concurrency / Idempotency / Recovery Hardening Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-150 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-09-15 |

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task. This execution uses inline TDD and defers every commit until the separately authorized Phase 3E closeout gate.

**Goal:** Preserve the Phase 3C/3D API-017 contracts while proving one durable winner, restart-safe idempotency and fail-closed recovery under concurrency, interruption and corrupted durable state.

**Architecture:** `DurableJobStore` remains the only persistence/CAS/idempotency/audit-intent authority. `JobExecutionRuntime` remains an explicit one-shot orchestrator and invokes a handler only after a durable `RUNNING` CAS winner. Hardening is limited to existing read-integrity validation and safe storage-error normalization; no recovery worker or new mutation is added.

**Tech Stack:** Node.js 24, TypeScript, `node:sqlite`, `node:test`, existing API-017 and API-016 intent contracts.

**Spec:** [Phase 3E Gap Matrix](REL001_PHASE3E_CONCURRENCY_RECOVERY_GAP_MATRIX.md), [Phase 3D Implementation Plan](REL001_PHASE3D_EXECUTION_REGISTRY_IMPLEMENTATION_PLAN.md), [Phase 3C Traceability](REL001_PHASE3C_DURABLE_JOB_STORE_TRACEABILITY.md).

## Global Constraints

- Existing six-state Job lifecycle and three handler mappings remain unchanged.
- `RetryAsSuccessor` is manual only and `NO_FINITE_MAX_REQUIRED`; automatic retry/successor creation remains `0`.
- API-017 writes enriched audit intents only; final API-016 Audit Event creation remains `0`.
- No lease, scheduler, poller, daemon, queue, HTTP/RPC, provider/network, dependency or new authority is introduced.
- Tenant/scope and provenance come only from durable canonical state, never the current Session or worker.

---

### Task 1: RED concurrency and stale-result matrix

**Files:**
- Create: `modules/jobs/src/job-concurrency-recovery-hardening.test.ts`

**Interfaces:**
- Consumes: `DurableJobStore`, `JobExecutionRuntime`, existing handler/admission/failure ports.
- Produces: executable evidence for single-winner start, stale success/failure rejection, terminal immutability and zero duplicate handler/audit effects.

- [ ] Write a re-entrant/two-store execution test in which only the durable start winner reaches the handler.
- [ ] Write stale success-after-cancel and stale failure-after-success tests that assert `VERSION_CONFLICT` or terminal fail-closed behavior and unchanged terminal history.
- [ ] Write an interrupted-result persistence test using the existing audit-intent failure hook; assert no fabricated success and durable `RUNNING` after reopen.
- [ ] Run only the new compiled test and confirm RED only for the identified safety gaps, while already-correct invariants pass.

### Task 2: RED durable integrity and safe-error matrix

**Files:**
- Modify: `modules/jobs/src/job-concurrency-recovery-hardening.test.ts`

**Interfaces:**
- Consumes: the existing SQLite schema and public durable store methods.
- Produces: concrete failing evidence for `GAP-3E-001` through `GAP-3E-004`.

- [ ] Tamper a current row so it no longer equals latest append-only history; require `PERSISTENCE_UNAVAILABLE` before execution.
- [ ] Remove or conflict a successor lineage row through a separately opened diagnostic connection; require fail-closed read/execution.
- [ ] Hold a SQLite write lock and invoke a mutation; require a bounded `DurableJobStoreError` without SQL/path/stack detail.
- [ ] Close a store and invoke each mutation family; require bounded `PERSISTENCE_UNAVAILABLE` rather than a native SQLite error.
- [ ] Run the new test and confirm the precise current defects are RED.

### Task 3: Minimum durable-store hardening

**Files:**
- Modify: `modules/jobs/src/job-durable-persistence.ts`

**Interfaces:**
- Consumes: existing tables, triggers, lifecycle validator and `DurableJobStoreError` vocabulary.
- Produces: safe transaction acquisition, explicit open checks, current/history integrity validation and bidirectional lineage validation.

- [ ] Add `#assertOpen()` at every public mutation boundary before SQLite access.
- [ ] Move transaction acquisition into the existing normalization boundary so native SQLite errors become `PERSISTENCE_UNAVAILABLE`.
- [ ] On authoritative reads, compare the current record with the latest decoded history row and require contiguous versions ending at the current version.
- [ ] Validate predecessor/successor lineage rows and their immutable backlink without changing the predecessor aggregate.
- [ ] Run the new focused test and existing Phase 3C durable-store tests; require GREEN.

### Task 4: Replay, restart and five-operation idempotency regression

**Files:**
- Modify: `modules/jobs/src/job-concurrency-recovery-hardening.test.ts`

**Interfaces:**
- Consumes: existing five canonical API-017 operations.
- Produces: restart/replay/lineage evidence without new idempotency storage.

- [ ] Verify exact replay and conflicting replay for submit, read/result, cancel and manual successor paths as applicable.
- [ ] Reopen the database and verify Job identity, version, terminal state, tenant/scope, provenance, failure reference and lineage.
- [ ] Verify same terminal execution returns `REPLAYED`, handler invocation remains `0`, and no new audit intent/history row appears.
- [ ] Verify cross-tenant/cross-scope recovery is concealed and no current Session/worker identity enters stored provenance.
- [ ] Run Phase 3E, Phase 3D and Phase 3C focused tests; require GREEN.

### Task 5: Documentation, verification and independent review

**Files:**
- Create: `docs/implementation/REL001_PHASE3E_RECOVERY_TRACEABILITY.md`
- Create: `docs/reviews/REL001_PHASE3E_COMPLETION_REPORT.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`

**Interfaces:**
- Consumes: actual focused/affected/full gate outputs.
- Produces: Phase 3E evidence only; no Phase 3F or later completion claim.

- [ ] Run Phase 3E focused plus Phase 3D/3C, Phase 2 API-016 and Phase 1G affected regressions.
- [ ] Run full regression once, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, Gitleaks and document validation. Record dependency audit as `NOT_RUN` unless separately authorized and executed.
- [ ] Record exact mutation/CAS/replay/recovery/audit evidence and zero forbidden surfaces in traceability and completion documents.
- [ ] Request a fresh independent review and require Critical `0`, Important `0`, `READY`.
- [ ] Stop before commit, main integration and push pending separate closeout authorization.
