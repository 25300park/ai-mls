# REL-001 Phase 4C FEAT-022 Provider Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-193 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Reviewer / API Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `653f4d0bd2afcec644aa24887003438957a10479` |

**Goal:** AI-001, AI-004, AI-005의 provider-independent application/handler/provider boundary를 실제 코드로 연결하되 real provider/network/credentials를 활성화하지 않는다.

**Architecture:** Existing `AdvisoryRuntime` remains the single strict validation and durable advisory authority. A FEAT-022-owned configured provider wrapper binds capability configuration, resolves credentials only inside the provider boundary, calls one injected executor exactly once, and emits allowlisted telemetry. Three capability-specific services and three API-017 handlers statically bind Job types to existing DEC-153 ports without generic dispatch.

**Tech Stack:** Node.js 24.18.0 built-ins, TypeScript 6, `node:test`, existing SQLite persistence, zero new dependencies.

**Spec:** `docs/implementation/REL001_PHASE4B1_OWNER_DECISION_REGISTER.md` and the approved REL-001 Phase 4C Brief.

## Global Constraints

- Real provider/network calls and real credentials: `0`.
- Provider retry/fallback/model fallback: `NONE`; one executor invocation maximum.
- Missing load-bearing configuration fails closed with no hidden defaults.
- API-017 and handlers see no provider client or credential.
- Existing FEAT-022 validator and durable store remain authoritative.
- No new AI capability, Job type, Audit vocabulary, authority, dependency or lifecycle state.
- Commit and push remain unauthorized during implementation.

---

### Task 1: Provider configuration, credential and telemetry boundary

**Files:**
- Create: `modules/ai/src/advisory-provider-boundary.test.ts`
- Create: `modules/ai/src/advisory-provider-boundary.ts`
- Modify: `modules/ai/src/advisory-runtime-contracts.ts`

**Interfaces:**
- Produces `AdvisoryCapabilityConfiguration`, `AdvisoryCredentialResolver`, `AdvisoryProviderExecutor`, `AdvisoryTelemetrySink`, `ConfiguredAdvisoryProviderAdapter`, and `evaluateProviderReadiness()`.
- `ConfiguredAdvisoryProviderAdapter` implements the existing `AdvisoryAdapter` contract and remains the only credential-consuming boundary.

- [x] Write RED tests for missing provider/model/timeout/credential/prompt/capability version, exact one-call behavior, no retry/fallback, unsafe error containment, telemetry allowlist, tenant independence and test-double readiness exclusion.
- [x] Run the focused compiled test and confirm failure because the provider boundary does not exist.
- [x] Implement exact configuration validation, one-call injected execution, safe failure normalization and allowlisted immutable telemetry.
- [x] Re-run the focused test and confirm GREEN.

### Task 2: Capability-specific FEAT-022 application services

**Files:**
- Create: `modules/ai/src/advisory-application-services.test.ts`
- Create: `modules/ai/src/advisory-application-services.ts`
- Modify: `modules/ai/src/advisory-runtime-contracts.ts`

**Interfaces:**
- Produces `Ai001ListingParseApplicationService`, `Ai004RequirementParseApplicationService`, and `Ai005MatchingApplicationService` with exact capability-specific `execute()` inputs.
- Consumes a shared `AdvisoryRuntime` plus one exact capability configuration; returns only `resultReference`, `resultChecksum`, `evidenceRefs`, and advisory/review metadata.

- [x] Write RED tests for all three static capability/schema paths, prompt/version binding, strict invalid-output rejection, review-required preservation, tenant/scope and initiating-principal evidence preservation.
- [x] Run focused tests and confirm failure because services do not exist.
- [x] Implement the minimum three wrappers over `AdvisoryRuntime.execute()` with no provider selection or Job lifecycle logic.
- [x] Re-run focused tests and confirm GREEN.

### Task 3: Thin API-017 handlers and trusted provenance

**Files:**
- Create: `modules/jobs/src/advisory-job-handlers.test.ts`
- Create: `modules/jobs/src/advisory-job-handlers.ts`
- Modify: `modules/jobs/src/job-execution-runtime.ts`

**Interfaces:**
- Produces `Ai001ListingParseJobHandler`, `Ai004RequirementParseJobHandler`, and `Ai005MatchingJobHandler` implementing `BoundedJobHandler`.
- Extends `JobExecutionContext` only with durable `principalProvenance` and `originatingAuthorityEvidenceRefs` copied from the authoritative Job record.

- [x] Write RED tests for exact 3/3 mapping, provider/client/credential invisibility, prompt-text absence, deterministic input mapping, principal provenance preservation and safe FEAT-022 error mapping.
- [x] Run focused tests and confirm the missing-handler/provenance failure.
- [x] Add trusted provenance to the runtime context and implement three thin static handlers.
- [x] Re-run focused and existing API-017 runtime tests and confirm GREEN.

### Task 4: Provider-independent composition and truthful readiness

**Files:**
- Create: `modules/ai/src/advisory-readiness-composition.test.ts`
- Create: `modules/ai/src/advisory-readiness-composition.ts`
- Modify: `modules/ai/src/advisory-provider-boundary.ts`

**Interfaces:**
- Produces a bounded internal composition for injected provider executors and accurate structural/execution readiness.
- Keeps `createProductionAdvisoryRuntime()` fail-closed on arbitrary adapter/config injection and never selects a test adapter.

- [x] Write RED tests proving missing config/credential/network authorization stays `NOT_READY`, deterministic test composition is not Production readiness, and unauthorized Production execution cannot run.
- [x] Run focused tests and verify the expected missing-composition failure.
- [x] Implement minimal readiness composition without modifying the existing fail-closed Production composition.
- [x] Re-run focused architecture/config tests and confirm GREEN.

### Task 5: Evidence and final verification

**Files:**
- Create: `docs/implementation/REL001_PHASE4C_APPLICATION_SERVICE_TRACEABILITY.md`
- Create: `docs/implementation/REL001_PHASE4C_PROVIDER_ADAPTER_TRACEABILITY.md`
- Create: `docs/implementation/REL001_PHASE4C_CONFIG_READINESS_MATRIX.md`
- Create: `docs/reviews/REL001_PHASE4C_COMPLETION_REPORT.md`
- Modify: `docs/implementation/FEAT022_TRACEABILITY_MATRIX.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`

- [x] Run Phase 4C focused tests, then AI/API-017 affected regressions.
- [x] Run the full regression once, followed by lint, typecheck, clean build and verify constituents.
- [x] Run architecture checksum, `git diff --check`, Gitleaks and documentation/link checks.
- [x] Record only fresh evidence, request independent review, and leave the worktree uncommitted for Architecture Owner review.

## Self-review

- Spec coverage: all Phase 4C provider-independent boundaries and 18 mandatory RED categories map to Tasks 1–4.
- Scope: provider-specific implementation, real network/credentials and deployment values are excluded.
- Type direction: API-017 depends only on three capability-specific application ports; FEAT-022 owns provider composition.
- Commit policy: no intermediate or final commit is created without later Architecture Owner authorization.
