# FEAT-022-C AI Advisory Runtime Foundation Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-035 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Architecture Owner / AI Reviewer |
| Scope | FEAT-022-C |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a deterministic no-network advisory runtime with immutable prompt identity and atomic durable advisory/evidence/idempotency persistence.

**Architecture:** The runtime resolves a trusted tenant/scope snapshot, binds an immutable ACTIVE prompt, derives a canonical fingerprint, invokes only an injected non-production deterministic adapter, validates through FEAT-022-B, and atomically records the accepted advisory and idempotency result in SQLite. Production composition owns an unavailable adapter and exposes no provider-selection or domain-command surface.

**Tech Stack:** Node.js 24.18.0 built-in `node:sqlite`, TypeScript, `node:test`, existing security contracts; no new dependency.

**Spec:** `docs/implementation/FEAT022_C_AI_ADVISORY_RUNTIME_FOUNDATION_DESIGN.md`

## Global Constraints

- `AI-001`~`AI-007` and Book 4 schema IDs are unchanged.
- New API ID, public confidence/review vocabulary, role/capability and business authority are `0`.
- Real provider/model/network/credential, UI and domain mutation are prohibited.
- Production selects only unavailable behavior; deterministic adapter is test composition only.
- Accepted advisory and idempotency bind atomically; malformed output persists nothing.
- Dependency and lockfile changes are prohibited.

---

### Task 1: Runtime contracts and prompt registry durability

**Files:**
- Create: `modules/ai/src/advisory-runtime-contracts.ts`
- Create: `modules/ai/src/advisory-durable-persistence.test.ts`
- Create: `modules/ai/src/advisory-durable-persistence.ts`
- Modify: `modules/ai/src/advisory-ai-service.ts`

**Interfaces:**
- Consumes: `AiCapabilityId`, `AiSchemaId`, `AdvisoryResultEnvelope`, `validateAdvisoryResult()`
- Produces: `AdvisoryPromptRecord`, `AcceptedAdvisoryRecord`, `AdvisoryPersistence`, `DurableAdvisoryStore`, `canonicalAiSchemaId()`

- [x] **Step 1: Write prompt registry RED tests.** Assert missing prompt, capability/schema mismatch, retired prompt and conflicting immutable re-registration fail; exact registration/reopen survives.
- [x] **Step 2: Run the compiled focused test.** RED confirmed: durable module/interfaces did not exist.
- [x] **Step 3: Add contracts and minimum SQLite prompt registry.** Use exact `ACTIVE | RETIRED`, file-path-only DB, WAL/FULL sync, immutable triggers and exact metadata validation.
- [x] **Step 4: Run the focused test.** GREEN for prompt identity/restart cases.

### Task 2: Atomic advisory and idempotency persistence

**Files:**
- Modify: `modules/ai/src/advisory-durable-persistence.test.ts`
- Modify: `modules/ai/src/advisory-durable-persistence.ts`

**Interfaces:**
- Consumes: `AcceptedAdvisoryRecord`, `AdvisoryIdempotencyBinding`
- Produces: `recordAccepted()`, `findReplay()`, `findAdvisory()`, startup validation

- [x] **Step 1: Write RED tests.** Assert exact replay returns one record after reopen, conflicting fingerprint fails, injected mid-transaction failure rolls back both rows, append-only update/delete fails, and manually inserted malformed accepted truth makes reopen fail closed.
- [x] **Step 2: Run focused test.** RED confirmed because advisory/idempotency transaction behavior was absent.
- [x] **Step 3: Implement minimum durable transaction.** `BEGIN IMMEDIATE`; insert accepted advisory then idempotency; rollback on any failure; validate every record before write and on reopen.
- [x] **Step 4: Run focused test.** GREEN with advisory count `1`, replay call mutation `0`, and malformed accepted truth unavailable.

### Task 3: Deterministic adapter and advisory runtime

**Files:**
- Create: `modules/ai/src/advisory-runtime.test.ts`
- Create: `modules/ai/src/advisory-runtime.ts`
- Create: `modules/ai/src/advisory-test-adapter.ts`

**Interfaces:**
- Consumes: trusted `AdvisorySnapshotResolver`, ACTIVE prompt, FEAT-022-B validator and durable store
- Produces: `AdvisoryRuntime.execute()`, `AdvisoryRuntime.read()`, `DeterministicNoNetworkAdvisoryAdapter`

- [x] **Step 1: Write runtime RED tests.** Cover the amendment's 15 cases: missing/mismatched/retired prompt; duplicate/conflict; malformed/raw/reasoning/fabricated adapter output; wrong tenant; LOW confidence with zero business authority; zero domain command surface; and no unvalidated accepted restart truth.
- [x] **Step 2: Run focused test.** RED confirmed because runtime and adapter modules did not exist.
- [x] **Step 3: Implement the minimum runtime.** Resolve trusted snapshot, compare tenant/scope, resolve prompt, derive sorted SHA-256 fingerprint, replay before adapter, validate output, derive review projection and call one atomic persistence method.
- [x] **Step 4: Implement deterministic adapter.** Accept only frozen fixture envelopes or explicit `ERROR | TIMEOUT | MALFORMED` test behavior; deep-clone/freeze returned fixtures; expose no network/credential method.
- [x] **Step 5: Run focused tests.** GREEN; adapter calls `0` for replay/conflict and accepted records `0` for rejected cases.

### Task 4: Production fail-closed composition and architecture boundaries

**Files:**
- Create: `modules/ai/src/advisory-runtime-architecture.test.ts`
- Create: `modules/ai/src/advisory-production-composition.ts`
- Modify: `modules/ai/src/index.ts`

**Interfaces:**
- Consumes: explicit durable DB path and trusted snapshot resolver
- Produces: `createProductionAdvisoryRuntime()` with unavailable adapter only

- [x] **Step 1: Write RED tests.** Assert production execution returns `ADVISORY_UNAVAILABLE`, injected test/arbitrary adapter option is rejected, persistence remains unchanged, and source imports contain no domain command/API/UI/network/provider SDK path.
- [x] **Step 2: Run focused test.** RED confirmed because production composition was absent.
- [x] **Step 3: Implement minimum production factory.** Validate exact options, instantiate `DurableAdvisoryStore`, bind internal unavailable adapter, and return runtime/close only.
- [x] **Step 4: Run focused and affected AI/Jobs tests.** GREEN with FEAT-022-B behavior preserved.

### Task 5: Evidence, regression and closeout

**Files:**
- Create: `docs/reviews/FEAT022_C_AI_ADVISORY_RUNTIME_FOUNDATION_COMPLETION.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify: `docs/implementation/FEAT022_C_AI_ADVISORY_RUNTIME_FOUNDATION_IMPLEMENTATION_PLAN.md`

**Interfaces:**
- Consumes: actual RED/GREEN and final verification output
- Produces: bounded FEAT-022-C completion evidence and canonical document registration

- [x] **Step 1: Run focused durability/runtime/architecture and affected AI/Jobs/domain regressions.**
- [x] **Step 2: Run one final lint, typecheck, build, verify/full suite, architecture checksum, `git diff --check`, and Gitleaks gate.**
- [x] **Step 3: Run dependency audits with explicit FEAT-022-C network authorization and record the AO-accepted development-only findings.**
- [x] **Step 4: Perform fresh independent review and require Critical `0` / Important `0`.**
- [x] **Step 5: Record actual evidence, register the report, create exactly one local FEAT-022-C commit, fast-forward main, verify both workspaces clean, do not push, and stop before any later phase.**

## Plan self-review

- Spec coverage: all amendment sections map to Tasks 1~5; UI, provider activation, API and authority remain excluded.
- Placeholder scan: no implementation placeholder or inferred future phase remains.
- Type consistency: capability/schema, prompt, snapshot, advisory and idempotency names are stable across all tasks.
