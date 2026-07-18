# SP-002 Source, Intake and Background Job Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository rules prohibit sub-agent dispatch unless the user explicitly requests it.

**Goal:** approved source evidence를 provenance-complete intake와 provider-neutral asynchronous job boundary로 안전하게 전달한다.

**Architecture:** `modules/source`, `modules/intake`, `modules/jobs`가 domain/application rules를 소유하고 `apps/api`는 API-003/004/017 translation과 composition만 소유한다. SP-001 identity, authorization, audit와 security primitives를 재사용하며 storage, queue, AI provider와 HTTP framework는 port 뒤에 둔다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6.0.3, pnpm 11.9.0, ESLint 9.39.5, typescript-eslint 8.64.0, Node.js test runner.

## Global Constraints

- SP-002의 FEAT-004/005/018, DEV-004/005/018, IMP-004/005/018만 구현한다.
- frozen Architecture Bible, `.env`, NAS configuration을 수정하지 않는다.
- connector/provider/queue/database/framework를 선택하거나 SP-003 artifact를 만들지 않는다.
- actor/session/authorization/audit/privacy primitive를 중복 구현하지 않는다.
- source/intake/job write는 expected version 또는 idempotency, reason/purpose와 trace를 요구한다.
- raw content, credential, token, contact, connection string을 fixture/log/audit에 넣지 않는다.
- 사용자가 요구한 한 개의 SP-002 completion commit만 생성한다.

---

### Task 1: SP-002 authorization capabilities

**Files:**
- Modify: `modules/authorization/src/authorization-service.ts`
- Modify: `modules/authorization/src/authorization-service.test.ts`

**Interfaces:**
- Consumes: existing `AuthorizationRequest`
- Produces: explicit actions `source.read`, `source.propose`, `intake.create`, `intake.validate`, `intake.request-ai`, `intake.review`, `job.submit`, `job.execute`, `job.cancel`, `job.retry`

- [ ] Add failing allow/deny tests for COL/DST/SAG/OPS/ADM/SVC roles and human-only intake review.
- [ ] Run `pnpm.cmd test` and confirm RED.
- [ ] Add only Permission Matrix-aligned capabilities and human authority guards.
- [ ] Run tests and confirm GREEN with all SP-001 regression tests.

### Task 2: Source registry and immutable raw evidence

**Files:**
- Create: `modules/source/src/source-registry-service.test.ts`
- Create: `modules/source/src/source-registry-service.ts`
- Create: `modules/source/src/raw-source-store.test.ts`
- Create: `modules/source/src/raw-source-store.ts`
- Create: `modules/source/src/index.ts`

**Interfaces:**
- Produces: `SourceRegistryService.list/read/propose`
- Produces: `RawSourceStore.capture/read`
- Consumes: `AuthorizationService`, `AuditSink`, `Clock`, `IdFactory`, `SessionContext`

- [ ] Write TEST-014/027/036 tests for active policy, allowed method/purpose, stale policy, service capture scope, immutable evidence and no raw-content projection.
- [ ] Run tests and confirm RED because implementations are missing.
- [ ] Implement in-memory repository ports, immutable snapshots, policy checks and audited operations.
- [ ] Run tests and confirm GREEN.

### Task 3: Provider-neutral background job lifecycle

**Files:**
- Create: `modules/jobs/src/job-service.test.ts`
- Create: `modules/jobs/src/job-service.ts`
- Create: `modules/jobs/src/index.ts`

**Interfaces:**
- Produces: `JobService.submit/read/start/succeed/fail/cancel/retryAsSuccessor/expireDue`
- Produces: immutable `BackgroundJob` with predecessor/successor and result/error references
- Consumes: SP-001 authorization/audit/security contracts

- [ ] Write TEST-016/035 tests for allowlist, idempotency replay/conflict, queued-not-success, service lease, terminal/late-result rejection, cancel, expiry and bounded successor retry.
- [ ] Run tests and confirm RED.
- [ ] Implement provider-neutral in-memory job lifecycle and audit evidence.
- [ ] Run tests and confirm GREEN.

### Task 4: AI-001/002 advisory result validation

**Files:**
- Create: `modules/jobs/src/ai-result-validator.test.ts`
- Create: `modules/jobs/src/ai-result-validator.ts`
- Modify: `modules/jobs/src/index.ts`

**Interfaces:**
- Produces: `validateAiResult(input): AiValidationDecision`
- Supports: AI-001 listing parse and AI-002 property normalization advisory envelopes only

- [ ] Write TEST-039/040 tests for exact input/evidence version, closed fields, material confidence, ambiguity/no-match, prohibited authority/mutation and manual fallback.
- [ ] Run tests and confirm RED.
- [ ] Implement deterministic validation without provider or numeric threshold.
- [ ] Run tests and confirm GREEN.

### Task 5: Governed intake workflow and provenance handoff

**Files:**
- Create: `modules/intake/src/intake-service.test.ts`
- Create: `modules/intake/src/intake-service.ts`
- Create: `modules/intake/src/index.ts`

**Interfaces:**
- Produces: `IntakeService.createDraft/validate/requestAi/routeToManualReview/attachAiResult/review`
- Consumes: `SourceRegistryService`, `RawSourceStore`, `JobService`, `CandidateDraftPort`, SP-001 authorization/audit

- [ ] Write TEST-004/015/016/027/036 tests for canonical transitions, optimistic version, quarantine, AI eligibility, failure fallback, human review and provenance-complete candidate handoff.
- [ ] Run tests and confirm RED.
- [ ] Implement allowed transitions and fail-closed audit behavior.
- [ ] Run tests and confirm GREEN.

### Task 6: API-003/004/017 application adapters

**Files:**
- Create: `apps/api/src/source-intake-api.test.ts`
- Create: `apps/api/src/source-intake-api.ts`
- Create: `apps/api/src/job-api.test.ts`
- Create: `apps/api/src/job-api.ts`
- Modify: `apps/api/src/composition.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Produces: framework-neutral stable envelopes for API-003, API-004, API-017
- Consumes: bounded session reader and public module contracts

- [ ] Write TEST-027/035/036 integration tests for session-derived actor, correlation/idempotency propagation, authorization ordering, safe errors and no hidden success.
- [ ] Run tests and confirm RED.
- [ ] Implement thin adapters and additive composition wiring.
- [ ] Run tests and confirm GREEN.

### Task 7: Completion evidence and single commit

**Files:**
- Create: `docs/development/SP002_TEST_EVIDENCE.md`
- Create: `docs/reviews/SP-002_COMPLETION.md`

- [ ] Run `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test`, `pnpm.cmd build` and `pnpm.cmd verify`.
- [ ] Run Gitleaks with repository config and verify actual/unexplained findings 0.
- [ ] Run `pnpm.cmd audit --audit-level high` and verify known vulnerabilities 0.
- [ ] Validate frozen/environment/NAS scope, Markdown links, SP-003 absence and `git diff --check`.
- [ ] Record exact trace, commands/results, limitations and rollback.
- [ ] Create one `feat(sp-002): source intake and background job foundation` completion commit and verify clean working tree.
