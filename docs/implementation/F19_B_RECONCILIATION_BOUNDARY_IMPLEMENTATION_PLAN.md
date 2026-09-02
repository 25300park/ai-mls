# F19-B Reconciliation Case / Evidence / Recovery Identity Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 domain truth를 복제하지 않는 durable F19 recovery case, append-only finding/disposition 및 recovery execution identity binding boundary를 구현한다.

**Architecture:** `modules/recovery`에 closed contracts, application service와 `node:sqlite` durable store를 둔다. Application은 trusted context resolver, authorizer, domain-owned execution identity validator를 주입받으며 외부 실행이나 API-014/018/019 저장소 mutation을 수행하지 않는다.

**Tech Stack:** TypeScript 6, Node.js 24.18.0, `node:sqlite`, `node:test`, pnpm 11.9.0.

**Spec:** `docs/implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md`

## Global Constraints

- 새 API ID, public HTTP operation, lifecycle state, dependency를 추가하지 않는다.
- API-014/018/019 domain truth와 durable stores를 복제하거나 변경하지 않는다.
- 실제 provider/network/credential 및 F20 Console mutation을 추가하지 않는다.
- 모든 Production behavior는 RED test 확인 후 최소 GREEN 구현으로 추가한다.
- F19-C 이후 작업을 시작하지 않는다.
- Commit과 Push는 별도 승인 전 수행하지 않는다.

---

### Task 1: Closed contracts and case creation

**Files:**
- Create: `modules/recovery/src/recovery-orchestration-contracts.ts`
- Create: `modules/recovery/src/recovery-orchestration-service.test.ts`
- Create: `modules/recovery/src/recovery-orchestration-service.ts`
- Create: `modules/recovery/src/index.ts`

**Interfaces:**
- Produces `RecoveryOrchestrationApplication`, closed request/result types, trusted context/authorizer ports and `RecoveryOrchestrationStore` port.
- `CREATE_RECOVERY_CASE` accepts only approved origin/resource/evidence fields; tenant/scope/actor/purpose are resolved from trusted context.

- [ ] Write a failing test proving closed origin shapes, immutable generated `recoveryCaseId`, trusted context derivation and unknown-field rejection.
- [ ] Run `pnpm.cmd build` and the compiled recovery test; confirm RED because the module/boundary is absent.
- [ ] Implement the minimum contract parser and in-process application case creation path backed by a store port.
- [ ] Re-run the focused test and confirm GREEN.

### Task 2: Durable case/evidence persistence

**Files:**
- Create: `modules/recovery/src/recovery-durable-persistence.test.ts`
- Create: `modules/recovery/src/recovery-durable-persistence.ts`
- Modify: `modules/recovery/src/index.ts`

**Interfaces:**
- Produces `DurableRecoveryOrchestrationStore({ databasePath })` implementing create/read, append finding/disposition, recovery binding and idempotency operations.
- Case identity fields are immutable; case status/version are CAS-updated.

- [ ] Write failing restart tests for case/evidence survival, parent/child lineage and duplicate origin handling.
- [ ] Run focused test and confirm RED because durable store is absent.
- [ ] Implement the minimal SQLite schema, fail-closed configuration, integrity check, immutable identity constraints and append-only triggers.
- [ ] Re-run focused tests and confirm GREEN.

### Task 3: Reconciliation finding

**Files:**
- Modify: `modules/recovery/src/recovery-orchestration-service.test.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.test.ts`
- Modify: `modules/recovery/src/recovery-orchestration-service.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.ts`

**Interfaces:**
- `RESOLVE_RECOVERY_CASE` records only `RECONCILIATION_FINDING`.
- `UNRESOLVED` keeps `OPEN`; confirmed findings transition to `RESOLVED`; records are append-only.

- [ ] Write failing tests for MFA/human/capability/tenant-scope authorization, evidence-submitter SoD, expected version, status transition and immutable finding history.
- [ ] Run focused tests and confirm RED for missing finding behavior.
- [ ] Implement minimum authorization orchestration and atomic finding/evidence/idempotency persistence.
- [ ] Add RED/GREEN tests for same-key replay and conflicting fingerprint with zero mutation.
- [ ] Re-run focused tests and confirm GREEN.

### Task 4: Recovery disposition and execution binding

**Files:**
- Modify: `modules/recovery/src/recovery-orchestration-service.test.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.test.ts`
- Modify: `modules/recovery/src/recovery-orchestration-service.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.ts`

**Interfaces:**
- `AUTHORIZE_RECOVERY` records one append-only `RECOVERY_DISPOSITION` and, for `RECOVERY_AUTHORIZED`, atomically binds domain-created `recoveryExecutionIdentity` to generated `recoveryId`.
- `RecoveryExecutionIdentityValidator` validates exact shape and newness without giving F19 identity-generation authority.

- [ ] Write failing tests for terminal-finding precondition, `CONFIRMED_NOT_EXECUTED` default, exact action/identity shapes, required/forbidden execution identity and injected newness validation.
- [ ] Run focused tests and confirm RED.
- [ ] Implement the minimum atomic disposition/recovery binding transaction.
- [ ] Add RED/GREEN tests for same-key replay, conflicting binding, immutable authorization lineage and zero external side effects.
- [ ] Re-run focused tests and confirm GREEN.

### Task 5: Restart, nested lineage and scope containment

**Files:**
- Modify: `modules/recovery/src/recovery-durable-persistence.test.ts`
- Modify: `modules/recovery/src/recovery-orchestration-service.test.ts`

**Interfaces:**
- Reopen returns authoritative prior case/finding/disposition/binding.
- Child cases bind `parentRecoveryCaseId` and a distinct new origin identity without changing parent history.

- [ ] Add RED tests for restart replay/conflict, wrong tenant/scope concealment and nested child-case lineage.
- [ ] Implement only defects exposed by RED tests.
- [ ] Run all `modules/recovery` tests and confirm GREEN.

### Task 6: Verification and evidence

**Files:**
- Create: `docs/reviews/F19_B_RECONCILIATION_CASE_EVIDENCE_RECOVERY_IDENTITY_IMPLEMENTATION_REPORT.md`
- Modify only if verified: relevant F19 traceability evidence document identified by targeted search.

- [ ] Run focused recovery tests.
- [ ] Run affected Publication/Connector/API-019 regression tests.
- [ ] Run lint, typecheck, build and verify once at the final gate.
- [ ] Run architecture checksum and Gitleaks using existing repository commands.
- [ ] Run `git diff --check` and confirm no dependency/lockfile change.
- [ ] Perform a fresh scope/security review and record actual evidence.
- [ ] Write the completion report; do not commit or push without separate authorization.
