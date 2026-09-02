# F18-C Durable Connector Foundation Implementation Plan

> **Required skill:** Execute this plan with `superpowers:executing-plans` and apply strict RED → GREEN TDD.

**Goal:** Add the minimum production-authoritative durable Connector lease, invocation, idempotency, evidence, and checkpoint foundation without adding Runtime/HTTP/provider authority.

**Architecture:** Add a Connector-owned persistence port and a Node `node:sqlite` durable adapter in `modules/source`. The adapter follows the already-approved F16/F17 bounded SQLite pattern but does not introduce a shared persistence subsystem or reuse API-014/API-015 stores. A small execution coordinator consumes only an immutable F18-B `ELIGIBLE` decision, commits intent and `EXECUTION_STARTED` before a no-network connector invocation, then atomically commits normalized result, append-only evidence, idempotency result, and checkpoint. Missing result after `EXECUTION_STARTED` is read as `AMBIGUOUS`; the same invocation is never blindly sent again.

**Tech stack:** TypeScript, Node.js 24 built-in `node:sqlite`, `node:test`, no new dependency.

---

## Task 1: Contract and RED persistence tests

**Files:**
- Create: `modules/source/src/connector-execution-persistence.ts`
- Create: `modules/source/src/connector-durable-persistence.test.ts`
- Modify: `modules/source/src/index.ts`

1. Define immutable Connector scope, lease, invocation, result, checkpoint, idempotency, and evidence records plus safe error codes.
2. Add RED tests for explicit file configuration, reopen durability, conflicting active lease, expiry/release/reacquire, invocation identity/fingerprint conflict, stale checkpoint/version, append-only evidence, and rollback atomicity.
3. Run `pnpm.cmd typecheck` and the compiled focused test; confirm RED because the durable adapter is absent.

## Task 2: Minimum durable SQLite adapter

**Files:**
- Create: `modules/source/src/connector-durable-persistence.ts`
- Modify: `modules/source/src/index.ts`

1. Implement `DurableConnectorExecutionUnitOfWork` with explicit non-memory path, WAL, synchronous FULL, foreign keys, integrity validation, `BEGIN IMMEDIATE`, rollback/quarantine, and bounded busy timeout.
2. Persist leases, invocation intents/state, normalized results, idempotency, checkpoints, evidence, and scope revisions.
3. Enforce lease scope uniqueness, invocation/fingerprint uniqueness, checkpoint CAS, and append-only result/idempotency/evidence via schema constraints/triggers.
4. Run focused tests and make Task 1 GREEN with the smallest correction.

## Task 3: RED execution-ordering and restart tests

**Files:**
- Create: `modules/source/src/connector-execution-coordinator.test.ts`
- Create: `modules/source/src/connector-test-adapter.ts`

1. Add RED tests for F18-B blocked decision causing zero durable rows/calls.
2. Add RED tests proving durable intent and `EXECUTION_STARTED` precede invocation.
3. Add RED tests for confirmed success atomic checkpoint advance, failure without checkpoint advance, thrown/malformed result containment, same-key replay, conflicting key payload, crash/reopen ambiguity, and zero blind resend.
4. Confirm RED because the coordinator is absent.

## Task 4: Minimum execution coordinator

**Files:**
- Create: `modules/source/src/connector-execution-coordinator.ts`
- Modify: `modules/source/src/index.ts`

1. Implement a no-Runtime coordinator that accepts only an F18-B decision plus bounded execution input.
2. Commit durable intent, then durable `EXECUTION_STARTED`, then invoke the injected connector once.
3. Normalize safe connector outcomes; atomically commit result/evidence/idempotency/checkpoint on authoritative success.
4. Leave missing/unproven post-dispatch outcomes as durable ambiguity; return `AMBIGUOUS`, do not advance checkpoint, and never redispatch the same invocation.
5. Make Task 3 GREEN.

## Task 5: Regression and scope verification

**Files:**
- Modify only if an observed F18-C defect requires it.

1. Run focused F18-C tests.
2. Run F18-B admission regression and existing Source tests.
3. Run affected authorization/intake tests.
4. Run lint, typecheck, build, and `git diff --check`.
5. Confirm dependency/lockfile/provider/network/API/Runtime changes are zero.

## Task 6: Completion evidence

**Files:**
- Create: `docs/reviews/F18_C_DURABLE_CONNECTOR_FOUNDATION_IMPLEMENTATION_REPORT.md`

1. Record actual focused/affected/gate results and all required restart/atomicity/idempotency/checkpoint assertions.
2. Record no audit run, no commit, no push, and F18-D/F18-E/F19 not started.
3. Run final `git diff --check` and `git status --short`.
4. Stop with the exact approved or blocked recommendation. Do not commit.
