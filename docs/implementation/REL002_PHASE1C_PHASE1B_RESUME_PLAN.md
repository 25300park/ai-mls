# REL-002 Phase 1C Phase 1B Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-287 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |

**Goal:** Resume Phase 1B only under separate implementation authorization, using approved DEC-165/166 to add the minimum registered workload authority boundary and shared Production bootstrap ordering without changing RBAC or starting runtime before validation.

**Architecture:** Identity owns immutable `RegisteredServiceWorkload` truth, while existing live `AuthorizationService` keeps RBAC/scope authority. One `ProductionBootstrap` validates typed configuration, human/service identity authority availability and secret references before creating `DurableSessionUnitOfWork` and existing bounded child roots; provider-capable execution remains a later, separately authorized post-listener/worker step.

**Tech Stack:** TypeScript, Node.js test runner, existing Identity/Authorization modules, existing Production composition factories.

**Spec:** [Service/Workload Authority Design](REL002_PHASE1C_PRODUCTION_SERVICE_WORKLOAD_AUTHORITY_DESIGN.md), [Composition Root Design](REL002_PHASE1C_PRODUCTION_COMPOSITION_ROOT_DESIGN.md), [Session UoW Ownership](REL002_PHASE1C_SESSION_UOW_OWNERSHIP_MODEL.md), [Decision Proposals](REL002_PHASE1C_DECISION_PROPOSALS.md)

## Global Constraints

- DEC-165 and DEC-166 are approved; start implementation only after Phase 1B is separately re-authorized.
- No new API, role/capability, auth protocol, lifecycle vocabulary, provider/network call or dependency.
- Do not use `RoleAssignment` or Durable Session as service registration authority.
- Database open/schema mutation, Session UoW construction, listener/worker/provider-capable runtime before gate PASS must remain `0`.
- Physical authority persistence/table selection requires separate approval if existing approved infrastructure cannot satisfy the port.

---

### Task 1: Registered service/workload authority contract

**Files:**
- Create: `modules/identity/src/registered-service-workload.ts`
- Create: `modules/identity/src/registered-service-workload.test.ts`
- Modify: `modules/identity/src/index.ts`

**Interfaces:**
- Produces: `RegisteredServiceWorkload`, `RegisteredServiceWorkloadAuthority`, `validateRegisteredServiceWorkload()`.
- Consumes: existing `SERVICE`, `WORKLOAD`, tenant and lifecycle vocabularies only.

- [ ] Write RED tests rejecting missing registration, wrong tenant/environment/purpose/audience, non-`WORKLOAD` assurance, suspended/revoked identity, unknown fields, secret-bearing fields and role/capability/scope fields.
- [ ] Run `pnpm.cmd exec tsx --test modules/identity/src/registered-service-workload.test.ts`; expect missing module/contract failure.
- [ ] Implement the closed immutable contract and fail-closed validator without persistence implementation or mutation commands.
- [ ] Re-run the focused test; expect all contract cases PASS.

### Task 2: Production identity dependency resolver

**Files:**
- Create: `apps/api/src/production-identity-dependencies.ts`
- Create: `apps/api/src/production-identity-dependencies.test.ts`

**Interfaces:**
- Consumes: `RegisteredServiceWorkloadAuthority`, existing authentication adapter, `SessionAccessCoordinator`, live `AuthorizationService`.
- Produces: `resolveProductionIdentityDependencies()` returning a narrowed immutable identity bundle.

- [ ] Write RED tests proving `RoleAssignment` alone, Durable Session alone, static/test authority and caller-supplied principal/tenant/scope cannot satisfy service identity.
- [ ] Add cases proving valid registration still requires live authorization and revoked live assignment denies execution.
- [ ] Run `pnpm.cmd exec tsx --test apps/api/src/production-identity-dependencies.test.ts`; expect missing resolver failure.
- [ ] Implement availability and exact registration validation; do not add role evaluation or registration persistence.
- [ ] Re-run the focused identity tests and existing Session/authorization affected tests.

### Task 3: Shared Production bootstrap ordering

**Files:**
- Create: `apps/api/src/production-bootstrap.ts`
- Create: `apps/api/src/production-bootstrap.test.ts`
- Modify: only composition exports proven necessary by RED tests.

**Interfaces:**
- Consumes: parsed `ProductionRuntimeConfiguration`, identity dependency resolver, `SecretReferenceResolver`, child-root factories.
- Produces: `startProductionRuntime()` and immutable `ProductionRuntimeHandle.close()`.

- [ ] Write RED spies asserting `DurableSessionUnitOfWork`, database/schema mutation, every child factory, listener, worker and provider-capable runtime are called zero times before aggregate PASS.
- [ ] Add PASS ordering assertions matching DEC-166, including separately authorized provider execution only after listeners/workers, and dependency-safe shutdown/partial-start cleanup assertions.
- [ ] Run `pnpm.cmd exec tsx --test apps/api/src/production-bootstrap.test.ts`; expect missing bootstrap failure.
- [ ] Implement the minimum orchestrator; inject factories so tests observe ordering without real DB/network/provider activity.
- [ ] Re-run the focused bootstrap test; expect PASS and exact call order.

### Task 4: Child-root containment and Staging separation

**Files:**
- Modify only if RED proves bypass: `apps/api/src/composition.ts`
- Modify only if RED proves bypass: `apps/api/src/administration-production-composition.ts`
- Modify only if RED proves bypass: `apps/api/src/connector-production-composition.ts`
- Modify only if RED proves bypass: `apps/api/src/external-integration-production-composition.ts`
- Modify only if RED proves bypass: `modules/ai/src/advisory-production-composition.ts`
- Test: `apps/api/src/production-bootstrap.test.ts`

**Interfaces:**
- Consumes: bootstrap-validated narrowed dependencies.
- Produces: child roots that cannot start through the canonical Production entry point before PASS.

- [ ] Add RED integration cases for direct Production bypass, Staging composition substitution, lower-environment reference and false provider readiness.
- [ ] Run only the affected focused tests; confirm the exact containment defect before modifying a child root.
- [ ] Apply the smallest guard/dependency narrowing needed; do not rename or promote `createStagingSessionComposition()`.
- [ ] Re-run focused and affected API-014/015/018/019/FEAT-022 composition tests.

### Task 5: Verification and closeout evidence

**Files:**
- Update only the separately authorized Phase 1B implementation report/RTM.

**Interfaces:**
- Consumes: Tasks 1-4 verification evidence.
- Produces: Phase 1B completion recommendation; no automatic Phase 2 start.

- [ ] Run Phase 1B/1C focused tests, Session/Auth affected regression, child-root affected regression and full regression once.
- [ ] Run lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, gitleaks and document/link/ID validation.
- [ ] Perform an independent review covering authority separation, pre-gate side effects, shutdown ownership, secret leakage and scope.
- [ ] Stop for AO closeout. Do not commit, push, start Phase 2 or select a physical service-identity persistence adapter without approval.

## Self-review result

- Spec coverage: DEC-165 authority separation, DEC-166 ordering, Session UoW ownership, child-root containment and all stop conditions map to Tasks 1-5.
- Placeholder scan: no implementation placeholder is used; the physical authority adapter is an explicit approval gate, not an implicit default.
- Type consistency: Tasks 2-4 consume the exact authority and bootstrap contracts introduced by Tasks 1 and 3.
