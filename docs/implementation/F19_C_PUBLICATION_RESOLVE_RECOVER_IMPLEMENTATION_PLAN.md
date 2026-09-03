# F19-C Publication Resolve / Recover Semantic Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** `RESOLVE_RECONCILIATION`을 effect-free decision으로 유지하면서 `RECOVER_PUBLICATION`이 durable F19 authorization과 새 execution identity를 소비해 기존 F17 durable execution path만 실행하도록 분리한다.

**Architecture:** Publication reconciliation input의 existing `caseId`로 F19-B의 Publication-origin case/binding을 trusted 내부 조회한다. Recovery는 caller authority fields를 무시하고 durable binding의 `attemptId`/`commandId`를 사용하며, current Publication authorization/approval/target/version을 재검증한 뒤 F17 coordination에 위임한다. `UNKNOWN`은 기존 Publication history를 보존하고 F19-B store의 기존 child-case creation semantics로 새 lineage를 추가한다.

**Tech Stack:** TypeScript, Node.js 24.18.0, `node:sqlite`, Node test runner, pnpm 11.9.0.

**Spec:** `docs/reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_GAP_MATRIX.md`, `docs/implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md`, Architecture Owner F19-C brief.

## Global Constraints

- 새 API ID/operation, Publication state, provider outcome, provider contract, persistence subsystem 또는 dependency를 추가하지 않는다.
- HTTP request에 finding/disposition/attemptId/commandId/recovery authority를 추가하지 않는다.
- F19-B durable store와 F17 Publication UoW/provider boundary를 재사용한다.
- Resolve provider invocation 0, recovery blind resend 0, original history mutation 0을 유지한다.
- F18, F19-D/E/F/G/H, Console, real provider/network/credentials를 시작하지 않는다.
- Commit과 push는 Architecture Owner review 전 수행하지 않는다.

---

### Task 1: Durable Recovery Authorization Read Boundary

**Files:**
- Modify: `modules/recovery/src/recovery-orchestration-contracts.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.test.ts`

**Interfaces:**
- Produces: read-only lookup of the current Publication-origin recovery case/binding by tenant, scope, resource and Publication reconciliation case identity.
- Preserves: existing SQLite schema, append-only records and F19-B write semantics.

- [ ] Add a failing durable-store test that creates/resolves/authorizes a Publication recovery case, reopens SQLite and expects the exact binding to be found through the Publication-origin read boundary.
- [ ] Run the focused durable test and confirm RED because the read method is absent.
- [ ] Add the minimum `RecoveryOrchestrationStore` read method and deterministic SQL lookup over existing tables; return a frozen decoded record and conceal cross-tenant/scope/resource matches.
- [ ] Add RED/GREEN assertions for missing binding, wrong resource, wrong tenant/scope, non-authorized disposition, `UNRESOLVED`, `NO_RECOVERY_REQUIRED`, `RECOVERY_REJECTED`, and restart persistence.
- [ ] Run the focused durable suite and confirm GREEN.

### Task 2: Trusted Publication Recovery Identity Planner

**Files:**
- Create: `modules/publication/src/publication-recovery-execution-planner.ts`
- Create: `modules/publication/src/publication-recovery-execution-planner.test.ts`
- Modify: `modules/publication/src/index.ts`

**Interfaces:**
- Consumes: Publication identity, existing reconciliation case/original attempt identity, and trusted planning correlation/idempotency input.
- Produces: immutable `{ attemptId, commandId }` for F19 `AUTHORIZE_RECOVERY`; validates both identities differ from original history.

- [ ] Add RED tests for stable new identities, original attempt/command rejection, cross-resource mismatch and caller substitution rejection.
- [ ] Confirm RED because the planner does not exist.
- [ ] Implement the smallest deterministic planner using canonical hashed identity material; do not add randomness, public request fields or F19 identity-generation authority.
- [ ] Confirm focused planner tests GREEN.

### Task 3: Separate Resolve and Recover Application Paths

**Files:**
- Modify: `modules/publication/src/publication-application-contracts.ts`
- Modify: `modules/publication/src/publication-reconciliation-service.ts`
- Modify: `modules/publication/src/publication-infrastructure-configuration.ts`
- Modify: `modules/publication/src/publication-infrastructure.ts`
- Modify: `modules/publication/src/publication-reconciliation-service.test.ts`

**Interfaces:**
- Consumes: existing `PublicationReconciliationRequest.caseId`, trusted recovery authorization reader, durable F19 binding, Publication/F17 dependencies.
- Produces: effect-free `reconcile()` and effect-producing `recover()` with distinct audit/idempotency identities.

- [ ] Add the mandatory RED overlap test proving `recover()` currently emits Domain `RESOLVE_RECONCILIATION` and never reaches F17.
- [ ] Add RED rejection tests for absent/invalid binding, wrong action/resource, stale authorization version, original identity reuse, wrong tenant/scope, stale approval/target/version and resolver/executor SoD.
- [ ] Confirm each test fails for the intended missing recovery boundary.
- [ ] Keep `reconcile()` on the existing decision-only path and implement `recover()` as a separate method that looks up and validates the durable binding, revalidates live Publication authority, then delegates the bound attempt/command to existing F17 coordination.
- [ ] Construct internal execution context/idempotency from trusted binding and recovery identity; never treat caller body values as authoritative.
- [ ] Add success assertions for exact bound identity, one provider call, durable F17 receipt/evidence and immutable original attempt/case.
- [ ] Run focused reconciliation/recovery tests and confirm GREEN.

### Task 4: Recovery Replay, Conflict and Nested Ambiguity

**Files:**
- Modify: `modules/publication/src/publication-reconciliation-service.test.ts`
- Modify only if RED proves required: `modules/publication/src/publication-reconciliation-service.ts`
- Modify only if RED proves required: `modules/recovery/src/recovery-durable-persistence.ts`

**Interfaces:**
- Consumes: F17 durable execution intent/receipt and F19 recovery binding/case lineage.
- Produces: exact replay without dispatch, deterministic conflict without mutation, child recovery case for a new ambiguous attempt.

- [ ] Add RED tests for exact `recoveryId` replay, conflicting execution fingerprint, same attempt replay, `UNKNOWN` containment and child-case lineage.
- [ ] Assert exact replay provider invocation 0, conflict mutation 0, original attempt/case unchanged, and child `parentRecoveryCaseId` equals the original F19 case.
- [ ] Implement only the minimum logic needed after the RED evidence, reusing F17 durable replay and F19-B `createCase()` rather than adding a store/engine.
- [ ] Confirm focused recovery replay/ambiguity tests GREEN after reopen/restart.

### Task 5: API-014 and Republish Preservation

**Files:**
- Modify only if required: `apps/api/src/publication-api.ts`
- Modify: `apps/api/src/publication-api.test.ts`
- Modify: `apps/api/src/publication-api-http-runtime.test.ts`
- Modify: `modules/publication/src/publication-lifecycle-service.test.ts`

**Interfaces:**
- Preserves: closed API-014 operation set and HTTP fail-closed caller-authored evidence policy.
- Produces: trusted internal Recover handoff only; ordinary Republish remains independent.

- [ ] Add RED/GREEN assertions that HTTP cannot author recovery identity/finding/disposition and the operation list is unchanged.
- [ ] Prove trusted internal API-014 Recover uses durable binding while public unsafe payload remains rejected.
- [ ] Prove ordinary Republish does not require `recoveryId`, cannot consume unresolved ambiguity as authority, and retains its existing application path.
- [ ] Run API-014 and Republish focused regression.

### Task 6: Verification, Traceability and Review Evidence

**Files:**
- Create: `docs/reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_SEPARATION_IMPLEMENTATION_REPORT.md`
- Modify: `docs/implementation/FEAT019_TRACEABILITY_MATRIX.md`
- Preserve: `docs/reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_GAP_MATRIX.md`

**Interfaces:**
- Produces: verified F19-C evidence only; no F19-D/E/F/G/H claim.

- [ ] Run F19-C focused tests, Resolve/Recover semantics, binding, identity, authority/approval/target, SoD, replay/idempotency, nested ambiguity and Republish regression.
- [ ] Run F19-B and F17 Publication affected regressions.
- [ ] Run the full suite once, then lint, typecheck, build, verify, architecture checksum, `git diff --check` and Gitleaks.
- [ ] Do not run dependency audits without separate F19-C network approval; record `NOT_RUN — APPROVAL_REQUIRED` if the gate is otherwise complete.
- [ ] Perform a fresh independent review locally without subagent delegation; require Critical 0 and Important 0.
- [ ] Update only actual F19-C RTM evidence and create the completion report with exact command results/counts.
- [ ] Confirm main remains clean, isolated worktree contains only F19-C changes, Commit `NOT_CREATED`, Push `NOT_PERFORMED`, F19-D/E/F/G/H `NOT_STARTED`.

## Plan Self-Review

- Spec coverage: all mandatory F19-C semantics, 20 negative cases and positive execution/replay/lineage paths map to Tasks 1–5.
- Placeholder scan: no deferred implementation placeholder is used; conditional file edits require prior RED evidence.
- Type consistency: F19 owns recovery authorization records; API-014 planner owns Publication attempt/command identities; F17 owns execution and provider evidence.
- Scope: no new public contract, state, provider vocabulary, dependency, F18 behavior or later F19 phase is included.
