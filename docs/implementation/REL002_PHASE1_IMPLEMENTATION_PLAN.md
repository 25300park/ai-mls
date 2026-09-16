# REL-002 Phase 1 Configuration, Identity and Secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-282 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-17 |

**Goal:** Implement a bounded, fail-closed Production configuration and secret-reference foundation that reuses existing identity authority and performs no runtime side effect before validation.

**Architecture:** Add one internal configuration module with closed immutable contracts, one provider-neutral secret-reference port, and one startup validator. Production identity dependencies remain existing Session/RBAC components supplied by composition; no new authority is introduced.

**Tech Stack:** TypeScript, Node.js test runner, existing immutable/sanitization helpers, existing Session and Authorization modules.

**Spec:** [Configuration Model](REL002_PHASE1_PRODUCTION_CONFIGURATION_MODEL.md), [Identity Model](REL002_PHASE1_PRODUCTION_IDENTITY_MODEL.md), [Secret Boundary](REL002_PHASE1_SECRET_BOUNDARY_AND_REFERENCE_MODEL.md), [Startup Matrix](REL002_PHASE1_STARTUP_VALIDATION_MATRIX.md)

## Global constraints

- Production/Test implementation requires separate AO authorization.
- No new API, role, capability, lifecycle state, dependency or infrastructure.
- No `.env`, credential value, provider/network call, database migration or deployment.
- Existing `SessionAccessCoordinator`, `AuthorizationService` and durable Session remain authoritative.
- OpenAI live execution stays `0/3 NOT_READY`; DEC-162/163 remain unchanged.
- One bounded local commit only after an explicit closeout authorization.

---

### Task 1: Closed Production configuration contract

**Files:**
- Create: `modules/configuration/src/production-runtime-configuration.ts`
- Create: `modules/configuration/src/production-runtime-configuration.test.ts`
- Create: `modules/configuration/src/index.ts`

**Interfaces:**
- Produces: `ProductionRuntimeConfiguration`, `parseProductionRuntimeConfiguration(value: unknown)`, `ProductionConfigurationError`.
- Consumes: no environment/global state.

- [ ] Write RED tests rejecting missing/unknown environment, unknown keys, mutable/nested extra fields, Development/Test/Staging fallback, unsafe identifiers and plaintext-looking credential values.
- [ ] Run `pnpm.cmd exec tsx --test modules/configuration/src/production-runtime-configuration.test.ts`; expect the new contract import/tests to fail.
- [ ] Implement the immutable closed contract for CFG-PRD-001 through CFG-PRD-014, returning only `runtimeEnvironment: "PRODUCTION"`.
- [ ] Re-run the focused test; expect all configuration cases to pass.

### Task 2: Provider-neutral secret-reference boundary

**Files:**
- Create: `modules/configuration/src/secret-reference-resolver.ts`
- Create: `modules/configuration/src/secret-reference-resolver.test.ts`
- Modify: `modules/configuration/src/index.ts`

**Interfaces:**
- Produces: `SecretReferenceResolver`, `ProductionSecretConsumerId`, `validateSecretReferenceBinding()`.
- Consumes: opaque references from `ProductionRuntimeConfiguration`.

- [ ] Write RED tests for wrong environment/consumer, wildcard consumer, plaintext token/password/key patterns, resolver exception, missing value and value/reference leakage.
- [ ] Run `pnpm.cmd exec tsx --test modules/configuration/src/secret-reference-resolver.test.ts`; expect missing implementation failure.
- [ ] Implement a closed internal consumer allowlist and fail-closed validation; keep resolved value accessible only to the invoking adapter boundary.
- [ ] Re-run the focused test; expect all resolver-boundary cases to pass.

### Task 3: Existing-authority Production identity dependency boundary

**Files:**
- Create: `apps/api/src/production-identity-dependencies.ts`
- Create: `apps/api/src/production-identity-dependencies.test.ts`

**Interfaces:**
- Produces: `validateProductionIdentityDependencies()` and a narrowed immutable bundle containing existing authentication adapter, trusted binding resolver, `SessionAccessCoordinator` dependencies and live `AuthorizationService`.
- Consumes: existing identity/authorization interfaces; no new principal type.

- [ ] Write RED tests rejecting static-test authority, in-memory Session authority, caller actor/tenant/scope overrides, unready adapters, unregistered service identity and non-`WORKLOAD` service assurance.
- [ ] Run `pnpm.cmd exec tsx --test apps/api/src/production-identity-dependencies.test.ts`; expect missing boundary failure.
- [ ] Implement structural/readiness validation without authentication issuance or authorization logic.
- [ ] Re-run the focused test and existing `modules/identity/src/session-access-coordinator.test.ts` plus live-role integration tests.

### Task 4: Side-effect-free Production startup gate

**Files:**
- Create: `apps/api/src/production-startup-validation.ts`
- Create: `apps/api/src/production-startup-validation.test.ts`

**Interfaces:**
- Produces: `validateProductionStartup(input): ProductionStartupValidationResult`.
- Consumes: parsed configuration, validated identity bundle, `SecretReferenceResolver`, side-effect probes only.

- [ ] Write RED tests for every negative case in the Startup Validation Matrix and spies proving listener/worker/database/provider calls remain zero before PASS.
- [ ] Run `pnpm.cmd exec tsx --test apps/api/src/production-startup-validation.test.ts`; expect missing gate failure.
- [ ] Implement ordered validation returning one immutable PASS fingerprint or one stable safe error; do not start any runtime component.
- [ ] Re-run the focused test; expect all containment and leakage assertions to pass.

### Task 5: Bounded integration and regression

**Files:**
- Modify only existing composition roots proven necessary by RED tests.
- Update: `docs/reviews/REL002_PHASE1_COMPLETION_REPORT.md` or its implementation-closeout successor under AO direction.

**Interfaces:**
- Consumes: Task 1-4 exports.
- Produces: a validated foundation object only; Phase 3 remains owner of listeners/workers/probes.

- [ ] Add one integration test constructing the Production foundation with deterministic fake adapters and opaque references; assert no runtime side effects.
- [ ] Add negative integration cases for Production-to-Staging fallback, live-provider false readiness and safe diagnostic output.
- [ ] Run focused configuration/identity/startup tests, then affected Session/Authorization/Admin Console/AI readiness regressions.
- [ ] Run full regression once because shared identity/composition contracts are affected.
- [ ] Run lint, typecheck, build, verify constituents, architecture validation, `git diff --check`, gitleaks and independent review.
- [ ] Stop for AO closeout approval; do not commit, push or start REL-002 Phase 2 automatically.

## Self-review result

- Spec coverage: all CFG-PRD entries, six identity boundaries, seven secret classes and fourteen startup checks map to Tasks 1-5.
- Placeholder scan: no unresolved implementation placeholder is used; infrastructure-specific adapters remain an explicit excluded decision.
- Type consistency: Task 4 consumes the exact contracts produced by Tasks 1-3.
