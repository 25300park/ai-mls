# F17-E Provider Boundary Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 provider를 활성화하지 않고 production fail-closed composition, deterministic test adapter와 safe provider-result normalization을 구현한다.

**Architecture:** 기존 `PublicationConnectorDispatcher`와 F17-C durable ordering을 유지한다. Production factory는 arbitrary dispatcher injection을 거부하고 unavailable dispatcher만 선택하며, 별도 deterministic adapter는 non-production test composition에서만 명시적으로 주입한다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6, node:test, pnpm 11.9.0

**Spec:** `docs/implementation/F17_E_PROVIDER_BOUNDARY_DESIGN.md`

## Global Constraints

- API-014/018/019 operation, Publication lifecycle/state, credential, destination, provider version 및 dependency를 추가하지 않는다.
- `CONFIRMED | REJECTED | UNKNOWN` 외 outcome을 만들지 않는다.
- F17-C durable intent, `DISPATCH_STARTED`, receipt, idempotency 및 restart no-resend semantics를 변경하지 않는다.
- Sandbox, F17-F, F18, F19는 시작하지 않는다.

---

### Task 1: Production fail-closed selection

**Files:**
- Modify: `modules/publication/src/publication-infrastructure.test.ts`
- Modify: `modules/publication/src/publication-infrastructure.ts`

**Interfaces:**
- Consumes: `PublicationInfrastructureConfigurationInput.connectorDispatcher`
- Produces: production factory rejection of arbitrary dispatchers and default unavailable dispatcher selection

- [x] Add a test that calls `createProductionPublicationInfrastructure()` with an injected dispatcher and asserts deterministic startup rejection before any dispatch.
- [x] Run the focused compiled test and confirm RED because production currently accepts the dispatcher.
- [x] Add the minimum factory guard before durable composition.
- [x] Run the focused test and confirm GREEN.

### Task 2: Deterministic no-network test adapter

**Files:**
- Create: `modules/publication/src/publication-provider-test-adapter.ts`
- Create: `modules/publication/src/publication-provider-test-adapter.test.ts`
- Modify: `modules/publication/src/index.ts`

**Interfaces:**
- Consumes: `PublicationConnectorDispatchInput`
- Produces: `DeterministicPublicationConnectorTestAdapter` with explicitly configured `CONFIRMED`, `REJECTED`, or `UNKNOWN` behavior

- [x] Add RED tests proving stable evidence/external reference, stable provider idempotency observation, conflicting-key containment, no credential/random/network surface and immutable results.
- [x] Run the adapter test and confirm RED because the module is absent.
- [x] Implement the smallest deterministic adapter with an in-memory key/fingerprint observation map and closed scenario configuration.
- [x] Run the adapter test and confirm GREEN.

### Task 3: Safe normalization and leakage containment

**Files:**
- Modify: `modules/publication/src/publication-service.test.ts`
- Modify: `modules/publication/src/publication-service.ts`

**Interfaces:**
- Consumes: runtime `PublicationConnectorDispatchResult`
- Produces: newly reconstructed immutable approved-field result or generated safe `UNKNOWN` evidence

- [x] Add RED tests using extra raw payload/header/token fields and unsafe evidence/external references; assert none reach snapshot, receipt, audit, error or serialized result.
- [x] Confirm RED because current valid-looking provider objects are forwarded directly.
- [x] Reconstruct normalized results from approved keys only and validate bounded safe references.
- [x] Confirm malformed, thrown and unsafe results become `UNKNOWN` and `RECONCILIATION_REQUIRED`.
- [x] Run focused service tests and confirm GREEN.

### Task 4: Durability and transport regression

**Files:**
- Modify only tests if a regression exposes an F17-E-scoped defect.

**Interfaces:**
- Consumes: F17-C durable execution and F17-D HTTP/runtime paths
- Produces: evidence that F17-E does not bypass either boundary

- [x] Run F17-C durability tests.
- [x] Run F17-D runtime/HTTP tests.
- [x] Run affected Publication tests.
- [x] Fix only F17-E-scoped regressions through RED/GREEN.

### Task 5: Completion evidence and final gate

**Files:**
- Create: `docs/reviews/F17_E_PROVIDER_BOUNDARY_FOUNDATION_IMPLEMENTATION_REPORT.md`
- Modify: `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md`

**Interfaces:**
- Consumes: actual verification outputs
- Produces: F17-E report and verified RTM evidence

- [x] Run lint, typecheck, build, verify, architecture checksum, git diff check and Gitleaks.
- [x] Run production/full dependency audits only after F17-E-scoped network approval; otherwise stop and request approval.
- [x] Run the full suite once at the final gate.
- [x] Perform an independent fresh review and require Critical 0 / Important 0.
- [x] Record actual evidence in the report and only verified F17-E RTM rows.
- [ ] Create exactly one local commit `feat(feat-017): implement provider boundary foundation`.
- [ ] Confirm the isolated worktree is clean and do not push.

## Execution checkpoint — 2026-08-31

Task 1~4 구현과 RED/GREEN 검증 완료. 최종 offline `verify`는 810/810 PASS이며 lint/typecheck/build, Architecture checksum 153/153, Gitleaks 0 findings를 확인했다. Fresh independent review는 Critical 0 / Important 0 / Minor 0 — READY이다. 위 checklist는 원 계획이며 실제 수행 결과는 [Implementation Report](../reviews/F17_E_PROVIDER_BOUNDARY_FOUNDATION_IMPLEMENTATION_REPORT.md)에 기록한다.

Task 5의 production/full audit은 F17-E 전용 승인 후 완료했다. Production vulnerabilities 0, full audit은 기존 승인 development-only High 4건, 신규 미승인 High/Critical 0이다. 보고서/RTM을 확정하고 단일 local commit 후 중단한다. F17-F/F18/F19는 시작하지 않는다.
