# REL-001 Phase 3D API-017 Execution Registry Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-146 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-09-15 |

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3C의 durable Job truth 위에 세 approved advisory Job type만 해석하는 closed registry와 명시적 one-shot Staging execution runtime을 구현한다.

**Architecture:** `DurableJobStore`가 authoritative Job state와 CAS를 소유한다. `JobExecutionRegistry`는 exact Job type을 injected application handler port에만 매핑하며, `JobExecutionRuntime`은 trusted access/admission 확인 후 `QUEUED → RUNNING → SUCCEEDED|FAILED`를 durable store에 기록한다. Production `AdvisoryRuntime`, scheduler, worker loop, HTTP 및 외부 effect는 이 Phase에서 조립하지 않는다.

**Tech Stack:** Node.js 24, TypeScript, `node:sqlite`, `node:test`, existing API-017 and FEAT-023 vocabularies.

**Spec:** [Phase 3B.1 Worker Execution Decision](REL001_PHASE3B1_WORKER_EXECUTION_DECISION.md), [Phase 3B.1 Owner Decision Register](REL001_PHASE3B1_OWNER_DECISION_REGISTER.md), [Phase 3B.2 Audit Point Inventory](REL001_PHASE3B2_API017_AUDIT_POINT_INVENTORY.md), [Phase 3C Traceability](REL001_PHASE3C_DURABLE_JOB_STORE_TRACEABILITY.md), [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md).

## Global Constraints

- Canonical handler set is exactly `AI_LISTING_PARSE`, `AI_REQUIREMENT_PARSE`, `AI_MATCHING`.
- Handler mapping is respectively `AI-001`, `AI-004`, `AI-005`; no additional Job type, capability, handler semantics or fallback exists.
- Trusted tenant/scope and immutable input references come only from the durable Job.
- Runtime execution is one-shot and explicit; automatic retry, scheduler, polling, lease, claim and heartbeat remain `0`.
- API-017 creates enriched audit intents only; final API-016 Audit Event creation remains `0`.
- Production FEAT-022 runtime/provider activation, public HTTP/RPC, external network and dependency changes remain `0`.

---

### Task 1: Closed handler registry and executable context

**Files:**
- Create: `modules/jobs/src/job-execution-runtime.test.ts`
- Create: `modules/jobs/src/job-execution-runtime.ts`

**Interfaces:**
- Consumes: `DurableJobRecord`, `DurableJobType`, `JobFailureCode`.
- Produces: `CanonicalJobHandlerId`, `JobExecutionContext`, `BoundedJobHandler`, `JobExecutionRegistry`.

- [ ] **Step 1: Write the failing registry tests**

  Add literal assertions that the three approved Job types resolve to their exact handler IDs, unknown/unmapped types have no fallback, and an incomplete registry reports `NOT_READY`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run the compiled `job-execution-runtime.test.js`; expect failure because the execution runtime module does not exist.

- [ ] **Step 3: Implement the minimum closed registry**

  Implement an immutable explicit mapping with no reflection, discovery or default handler. The handler input contains only durable `jobId`, `attempt`, `jobType`, `tenantId`, `scopeRef`, `purpose`, immutable `inputReferences`, `policyVersion`, and safe admission evidence references.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Build and run only the new execution runtime test.

### Task 2: Trusted admission and one-shot dispatch

**Files:**
- Modify: `modules/jobs/src/job-execution-runtime.test.ts`
- Modify: `modules/jobs/src/job-execution-runtime.ts`

**Interfaces:**
- Consumes: `JobExecutionAdmissionPort.evaluate(context)` returning `ALLOWED` with safe evidence refs or `BLOCKED`.
- Produces: `JobExecutionRuntime.execute({ jobId, tenantId, scopeRef, correlationId })` returning a bounded immutable execution result.

- [ ] **Step 1: Write failing dispatch tests**

  Prove denial, wrong tenant/scope, unknown mapping, terminal/replayed execution and missing handler invoke no handler and do not mutate the durable Job. Prove allowed execution uses the durable Job context rather than any Session/caller payload.

- [ ] **Step 2: Run and verify RED for the missing dispatcher**

  The test must fail because one-shot dispatch and admission ordering are absent.

- [ ] **Step 3: Implement minimum dispatch ordering**

  Load the scoped durable Job, require `QUEUED`, resolve the exact handler, evaluate current trusted admission, then use Phase 3C CAS to start once. Do not accept caller-authored Job content, authority, attempt, version or failure classification.

- [ ] **Step 4: Run and verify GREEN**

  Run the new focused test and existing Phase 3C store test.

### Task 3: Safe result/failure persistence and concurrency

**Files:**
- Modify: `modules/jobs/src/job-execution-runtime.test.ts`
- Modify: `modules/jobs/src/job-execution-runtime.ts`

**Interfaces:**
- Consumes: handler success `{ resultReference, resultChecksum, evidenceRefs }`; trusted `JobExecutionFailureMapper.map(error, context)`.
- Produces: durable `SUCCEEDED` or normalized durable `FAILED` through existing Phase 3C transitions.

- [ ] **Step 1: Write failing outcome tests**

  Cover canonical success, trusted normalized failure, raw exception non-persistence, caller failure-code absence, duplicate completion, concurrent stale execution and restart-safe terminal replay.

- [ ] **Step 2: Run and verify RED**

  Confirm failure is caused by missing outcome orchestration, not fixture or import errors.

- [ ] **Step 3: Implement minimal outcome orchestration**

  Persist success through `succeedJob`. On handler failure, call only the injected trusted mapper and persist its `normalizeJobFailure` result through `failJob`; if mapping fails, leave the authoritative `RUNNING` record unchanged and fail closed.

- [ ] **Step 4: Run and verify GREEN**

  Verify exactly one terminal CAS path and no duplicate handler invocation for a terminal Job.

### Task 4: Staging composition and readiness

**Files:**
- Create: `modules/jobs/src/job-staging-composition.test.ts`
- Create: `modules/jobs/src/job-staging-composition.ts`
- Modify: `modules/jobs/src/index.ts`

**Interfaces:**
- Consumes: explicit durable database path, three exact approved handlers, admission port, failure mapper, clock and ID factory.
- Produces: `createStagingJobExecutionRuntime()` with `HEALTHY|UNHEALTHY|UNKNOWN` health and `READY|NOT_READY|UNKNOWN` readiness plus an explicit one-shot runtime.

- [ ] **Step 1: Write failing composition tests**

  Prove missing database/config/handler/admission/failure mapper fails closed or reports `NOT_READY`, exact complete composition reports `READY`, and there is no timer, poller, HTTP, queue or network dependency.

- [ ] **Step 2: Run and verify RED**

  Expect failure because Staging composition does not exist.

- [ ] **Step 3: Implement minimum composition**

  Construct one `DurableJobStore`, one closed registry and one runtime. Expose only explicit `execute`, status read and `close`; do not start background work.

- [ ] **Step 4: Run and verify GREEN**

  Run composition, execution and Phase 3C focused tests.

### Task 5: Traceability, full verification and review

**Files:**
- Create: `docs/implementation/REL001_PHASE3D_HANDLER_MAPPING_TRACEABILITY.md`
- Create: `docs/implementation/REL001_PHASE3D_RUNTIME_COMPOSITION_MATRIX.md`
- Create: `docs/reviews/REL001_PHASE3D_COMPLETION_REPORT.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`

**Interfaces:**
- Consumes: verified tests and repository gate output.
- Produces: bounded Phase 3D evidence without marking Phase 3E or later work complete.

- [ ] **Step 1: Run focused and affected tests**

  Run Phase 3D, Phase 3C, Phase 2 API-016 and Phase 1G affected regressions.

- [ ] **Step 2: Run final gates once**

  Run full regression, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, Gitleaks and document validation. Dependency audit remains `NOT_RUN` without separate authorization.

- [ ] **Step 3: Write evidence documents**

  Record the exact three mappings, one-shot composition, safe outcome behavior, zero automatic retry/scheduler/network/public transport and actual test counts.

- [ ] **Step 4: Perform independent review**

  Require Critical `0`, Important `0`, readiness `READY`; otherwise record `BLOCK_REL001_PHASE3D_API017_EXECUTION_REGISTRY_RUNTIME_COMPOSITION`.

- [ ] **Step 5: Stop before commit**

  Do not commit, integrate or push without a separate Phase 3D closeout authorization.
