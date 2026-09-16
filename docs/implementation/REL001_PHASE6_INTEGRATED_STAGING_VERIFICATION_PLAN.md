# REL-001 Phase 6 Integrated Staging Runtime Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task. Every production change follows RED → minimum GREEN. Commit and push are prohibited until Architecture Owner closeout authorization.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-236 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Platform Owner |
| 기준일 | 2026-09-16 |

**Goal:** 기존 Phase 1D/2/3/4/5 경계를 하나의 Staging verification graph에서 검증하고, available boundary만 healthy일 때 truthful integrated readiness를 제공한다.

**Architecture:** 기존 concrete Session, API-016, API-017, FEAT-022 readiness 및 Admin Console composition을 internal verification boundary에 주입한다. Console은 owning ports만 사용하며 store를 import하지 않는다. Live provider `NOT_READY`, `DEC-162 IN_REVIEW`, Core transport `HOLD`는 readiness 입력이 아니라 고정 canonical hold로 검증한다.

**Tech Stack:** Node.js 24, TypeScript 6, built-in `node:test`, built-in `node:sqlite`, existing repository compositions only.

**Spec:** 사용자 승인 `REL-001 Runtime Foundation Phase 6 — Integrated Staging Runtime Verification` Brief와 [Phase 5 Final Traceability](REL001_PHASE5_ADMIN_CONSOLE_FINAL_TRACEABILITY_MATRIX.md).

## Global Constraints

- 새 API ID, role/capability, auth/token protocol, lifecycle state, Audit vocabulary, Core transport semantics를 추가하지 않는다.
- Provider/network/credential 사용, automatic retry, scheduler, polling은 `0`이다.
- Dependency/package/lockfile 변경은 `0`이다.
- `READY_FOR_AVAILABLE_BOUNDARY`는 Phase 6 documentation/internal verification classification이며 FEAT-023 enum 또는 business authority가 아니다.
- Full regression은 completion gate에서 한 번만 실행한다.

---

### Task 1: Integrated readiness RED and minimal verification boundary

**Files:**
- Create: `apps/api/src/staging-integrated-runtime-verification.test.ts`
- Create: `apps/api/src/staging-integrated-runtime-verification.ts`
- Modify only if RED requires it: `apps/admin-console/src/console-composition.ts`

**Interfaces:**
- Consumes: existing `StagingSessionComposition`, `StagingApi016AuditRuntime`, `StagingJobExecutionRuntimeComposition`, `AdvisoryProviderReadinessComposition`, `StagingAdminConsoleComposition` status ports.
- Produces: `createIntegratedStagingRuntimeVerification()` and immutable `IntegratedStagingRuntimeStatus` with per-component state plus `READY_FOR_AVAILABLE_BOUNDARY | NOT_READY` classification.

- [ ] Write RED tests proving missing Session/API-015/API-016/API-017/FEAT-022 cannot report available-boundary readiness, live provider cannot report READY, `DEC-162` cannot report APPROVED, and Core HOLD cannot be removed.
- [ ] Run only the compiled Phase 6 test and confirm failure is the absent integrated verification boundary or missing component evidence.
- [ ] Implement the smallest internal composition that calls concrete status ports, reconstructs a frozen bounded status, and fails closed on throw/malformed status.
- [ ] Keep live provider, `DEC-162`, Core transport and UI-006 values exact constants validated at construction; add no external action.
- [ ] Run the focused test and Phase 5 focused suite; confirm GREEN.

### Task 2: Cross-component failure isolation and safe evidence

**Files:**
- Modify: `apps/api/src/staging-integrated-runtime-verification.test.ts`
- Modify only if RED proves a defect: `apps/api/src/staging-integrated-runtime-verification.ts`, `apps/admin-console/src/console-composition.ts`

**Interfaces:**
- Consumes: Task 1 status classifier and existing safe Console DTOs.
- Produces: failure-isolation assertions for each canonical dependency.

- [ ] Add RED cases for API-015 refresh masking a command fault, API-016 success after port failure, API-017 false READY, missing FEAT-022 component, Core data fabrication, cross-component raw stack/path/SQL/token/prompt/provider payload leakage, and any network/retry/scheduler invocation.
- [ ] Run the focused test and verify each new test fails for the exact unrepresented or unsafe condition.
- [ ] Implement only proven fixes; prefer the new verification boundary and existing safe adapters over edits to owning runtimes.
- [ ] Run focused plus Phase 5 regression and confirm provider/network/retry/scheduler counters remain zero.

### Task 3: Restart, tenant/scope, provenance and durable replay

**Files:**
- Modify: `apps/api/src/staging-integrated-runtime-verification.test.ts`
- Create only if shared setup is required: `apps/api/src/staging-integrated-runtime-fixture.ts`

**Interfaces:**
- Consumes: real durable Session/API-016/API-017 stores and existing Staging compositions.
- Produces: restart/reopen evidence with exact tenant/scope and immutable principal chronology.

- [ ] Add RED integration tests that create authoritative state, close all durable components, reopen them, and prove stale readiness is not reused.
- [ ] Assert exact Session replay denial after revocation, one final Audit Event on replay, one Job completion on restart replay, preserved RetryAsSuccessor lineage, and current Session cannot replace historical principal provenance.
- [ ] Assert cross-tenant/scope requests expose no prior Session/Admin/Audit/Job/AI/Console evidence.
- [ ] Use existing durable factories only; if a missing contract is required, STOP instead of creating a new lifecycle or ownership model.
- [ ] Run Phase 6 focused, Phase 1D, Phase 2, Phase 3 and Phase 5 focused regressions.

### Task 4: Six-screen and accessibility preservation

**Files:**
- Modify: `apps/api/src/staging-integrated-runtime-verification.test.ts`
- Modify only if RED proves a defect: existing Console tests or composition.

**Interfaces:**
- Consumes: existing Phase 5 server routes and FEAT-021 renderer/accessibility behavior.
- Produces: integrated six-screen, controlled-write, advisory-provenance and human-review evidence.

- [ ] Verify exact UI-006/031/032/033/035/036 routes through owning ports, UI-006 deferred presentation, keyboard/focus/error behavior, controlled writes, advisory provenance and human-review indicator.
- [ ] Assert new screen/route, destructive control and fabricated destructive confirmation count is zero.
- [ ] Run Console/FEAT-020/FEAT-021 affected tests.

### Task 5: Traceability, full gates and independent review

**Files:**
- Create: `docs/implementation/REL001_PHASE6_COMPONENT_RUNTIME_TRACEABILITY.md`
- Create: `docs/implementation/REL001_PHASE6_FAILURE_ISOLATION_READINESS_MATRIX.md`
- Create: `docs/implementation/REL001_PHASE6_RESTART_RECOVERY_MATRIX.md`
- Create: `docs/reviews/REL001_PHASE6_COMPLETION_REPORT.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/implementation/REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md` if present and directly affected
- Modify: `docs/implementation/FEAT020_TRACEABILITY_MATRIX.md`
- Modify: `docs/implementation/FEAT021_TRACEABILITY_MATRIX.md`

**Interfaces:**
- Consumes: actual Task 1–4 code/test evidence only.
- Produces: Phase 6 completion recommendation without commit or push.

- [ ] Run Phase 6 focused and all listed affected suites.
- [ ] Run the full regression once, then lint, typecheck, clean build and verify constituents.
- [ ] Run architecture checksum, `git diff --check`, Gitleaks, Document ID/link/placeholder validation and confirm dependency/lockfile changes `0`.
- [ ] Record actual totals and the exact provider/Core hold in the four Phase 6 evidence documents and affected traceability files.
- [ ] Request fresh independent review; remediate every Critical/Important finding and re-run narrow affected verification.
- [ ] Return `APPROVE_REL001_PHASE6_INTEGRATED_STAGING_RUNTIME_VERIFICATION` only when every completion gate is evidenced. Do not commit or push.
