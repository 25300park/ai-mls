# REL-002 Phase 1D Phase 1B Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-293 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |
| Baseline | `66599a3b79490952bc53bbbec9193de1ac2a0b0b` |

**Goal:** Implement the approved Identity-owned registered workload persistence boundary and shared Production bootstrap without moving migration ownership out of Phase 2 or adding authorization/provider semantics.

**Architecture:** `DurableRegisteredServiceWorkloadStore` reuses the physical Identity database boundary but remains separate from Session lifecycle and live Authorization. `ProductionBootstrap` performs read-only identity verification and aggregate configuration/secret validation, issues a module-private construction context after PASS, then owns exactly one Session UoW and the existing bounded child-root lifecycle.

**Tech Stack:** TypeScript, Node.js, `node:sqlite`, existing Identity/Authorization/Session modules and API-014/015/018/019/FEAT-022 composition factories.

**Spec:** [Persistence Design](REL002_PHASE1D_REGISTERED_SERVICE_WORKLOAD_PERSISTENCE_DESIGN.md), [Resolver Design](REL002_PHASE1D_PRODUCTION_SERVICE_IDENTITY_RESOLVER_DESIGN.md), [Bootstrap Design](REL002_PHASE1D_PRODUCTION_BOOTSTRAP_IMPLEMENTATION_DESIGN.md), [Child Wiring](REL002_PHASE1D_BOOTSTRAP_CHILD_ROOT_WIRING.md), [Session UoW Lifecycle](REL002_PHASE1D_SESSION_UOW_LIFECYCLE_DESIGN.md)

## Global Constraints

- DEC-167 and DEC-168 are approved; start only after separate Phase 1B implementation authorization.
- REL-002 Phase 2 owns Production schema/migration; Phase 1 implements fail-closed prepared-schema adapters and test-only fixtures but must not execute Production migration or runtime table creation.
- No new API, role/capability, identity protocol, lifecycle vocabulary, persistence subsystem, dependency, provider/network call or credential value.
- Gaps 004/005/006 remain blocking until implementation and fresh Production-bound evidence pass.
- Production must never call `createStagingSessionComposition()`.

---

### Task 1: Registered workload persistence contract

**Files:**
- Create: `modules/identity/src/registered-service-workload.ts`
- Create: `modules/identity/src/registered-service-workload.test.ts`
- Modify: `modules/identity/src/index.ts`

**Interfaces:**
- Produces: `RegisteredServiceWorkloadRecord`, closable `RegisteredServiceWorkloadAuthorityLease`, `RegisteredServiceWorkloadEvidenceVerifier`, `DurableRegisteredServiceWorkloadStore`.
- Consumes: approved `SERVICE`, `WORKLOAD`, `ACTIVE | SUSPENDED | REVOKED` Identity vocabulary.

- [ ] Write RED tests for missing/malformed fields, unknown fields, forbidden role/scope/credential fields, invalid lifecycle/type/assurance, immutable-field mutation, stale `registrationVersion`, duplicate `(tenantId, principalId)` and unsafe DB diagnostics.
- [ ] Run `pnpm.cmd exec tsx --test modules/identity/src/registered-service-workload.test.ts`; expect missing contract/store failure.
- [ ] Locate an existing canonical Identity/API-016 evidence authority and implement the required verifier adapter. If none exists, stop for AO review without inventing evidence vocabulary/storage.
- [ ] Implement closed immutable decoder and store methods. `assertSchemaReady()` must inspect an already-provisioned schema and must never execute DDL.
- [ ] Re-run the focused test; expect all cases PASS.

### Task 2: Phase 2 migration prerequisite gate

**Files:**
- Test: `modules/identity/src/registered-service-workload.test.ts`
- Update evidence only: REL-002 Phase 2 migration RTM/report when separately authorized.

**Interfaces:**
- Consumes: test-only pre-provisioned schema fixture initially; Phase 2-provisioned Production table at the return gate.
- Produces: fail-closed `IDENTITY_AUTHORITY_UNAVAILABLE` behavior when schema is missing/incompatible.

- [ ] Add RED cases proving missing table/index/constraint cannot be repaired by Phase 1 runtime and returns a safe unavailable error; use test-only fixture DDL solely to prove the positive contract.
- [ ] Run the focused cases against an empty database; expect failure without any table creation.
- [ ] Implement only read-only schema compatibility checks; do not add migration files or DDL execution.
- [ ] Re-run and verify schema mutation count remains `0`.

### Task 3: Production service identity resolver

**Files:**
- Create: `apps/api/src/production-service-identity-resolver.ts`
- Create: `apps/api/src/production-service-identity-resolver.test.ts`

**Interfaces:**
- Consumes: `RegisteredServiceWorkloadAuthorityLease.findByRegistrationId(registrationId)`.
- Produces: `ProductionServiceIdentityResolver.resolve({ registrationId }): ProductionServiceIdentityBinding`.

- [ ] Write RED tests for caller tenant/principal/readiness override, missing/unavailable record, suspended/revoked lifecycle, wrong type/assurance/environment, trusted purpose/audience mismatch, malformed/orphan evidence and lower-environment fixture.
- [ ] Add a regression proving valid registration does not manufacture roles/scopes/capabilities and a subsequent existing `AuthorizationService` denial remains denied.
- [ ] Run `pnpm.cmd exec tsx --test apps/api/src/production-service-identity-resolver.test.ts`; expect missing resolver failure.
- [ ] Implement the minimal read-only resolver, retained authority lease and `assertStillActive()` revalidation before new listener/worker/provider-capable work; normalize errors safely.
- [ ] Re-run resolver plus existing authorization/session focused tests.

### Task 4: Production bootstrap context and ordering

**Files:**
- Create: `apps/api/src/production-bootstrap.ts`
- Create: `apps/api/src/production-bootstrap.test.ts`

**Interfaces:**
- Produces in one module: non-exported `issueProductionBootstrapContext()`, exported runtime assertion, `startProductionRuntime()` and `ProductionRuntimeHandle.close()`.
- Consumes: typed config parser/validator, secret-reference resolver, read-only identity store/resolver, Session UoW factory and child-root factories.

- [ ] Write RED spies for the exact canonical order and assert PASS-before-Session construction.
- [ ] Add failures at every pre/post-gate boundary; assert schema mutation/listener/worker/provider counts and reverse cleanup order.
- [ ] Add context forgery/clone/serialization cases and Staging fallback rejection.
- [ ] Run `pnpm.cmd exec tsx --test apps/api/src/production-bootstrap.test.ts`; expect missing bootstrap/context failure.
- [ ] Implement WeakSet-backed co-located issuance/orchestration, exported assertion, retained read-only Identity authority lease and LIFO cleanup without domain logic.
- [ ] Re-run focused bootstrap tests; expect exact ordering and all zero-side-effect assertions PASS.

### Task 5: Session UoW Production-safe construction

**Files:**
- Modify: `modules/identity/src/session-durable-persistence.ts`
- Modify: `modules/identity/src/session-durable-persistence.test.ts`
- Test: `apps/api/src/production-bootstrap.test.ts`

**Interfaces:**
- Consumes: post-PASS Session UoW factory and Phase 2-prepared schema.
- Produces: exactly one bootstrap-owned Production Session UoW without runtime schema creation.

- [ ] Write RED cases proving Production construction on missing schema fails closed and never creates `identity_sessions`/revocation tables.
- [ ] Add ownership cases proving child roots cannot close/replace the shared UoW and partial-start cleanup closes it once.
- [ ] Run Session and bootstrap focused tests; expect current constructor DDL behavior to fail the Production-mode invariant.
- [ ] Add the minimum explicit Production prepared-schema mode while preserving existing Staging behavior and Session semantics.
- [ ] Re-run focused and affected Session/Auth regression.

### Task 6: Child-root containment and prepared-schema stores

**Files:**
- Modify only when RED proves required: `apps/api/src/composition.ts`
- Modify only when RED proves required: `apps/api/src/administration-production-composition.ts`
- Modify only when RED proves required: `apps/api/src/connector-production-composition.ts`
- Modify only when RED proves required: `apps/api/src/external-integration-production-composition.ts`
- Modify only when RED proves required: `modules/ai/src/advisory-production-composition.ts`
- Modify: `modules/publication/src/publication-durable-persistence.ts`
- Modify: `modules/administration/src/administration-durable-persistence.ts`
- Modify: `modules/source/src/connector-durable-persistence.ts`
- Modify: `modules/source/src/external-integration-durable-persistence.ts`
- Modify: `modules/ai/src/advisory-durable-persistence.ts`
- Test: `apps/api/src/production-bootstrap.test.ts`

**Interfaces:**
- Consumes: validated bootstrap context and narrowed dependencies.
- Produces: context-required prepared/startable/closable child wrappers and DDL-free Production prepared-schema store modes for API-014/015/018/019/FEAT-022.

- [ ] Add RED cases for context-less direct Production factory calls, pre-PASS construction/start, aggregate false READY, lower-environment substitution, provider execution without separate authority and runtime DDL in each child store.
- [ ] Run each failing child case before modifying its factory; leave factories with no proven defect unchanged.
- [ ] Require/assert bootstrap context in every Production child factory, remove no-context canonical exports, add read-only prepared-schema checks to all five durable stores, and preserve existing lower-environment behavior outside Production.
- [ ] Re-run child focused tests and affected API-014/015/018/019/FEAT-022 regression.

### Task 7: Phase 1 implementation checkpoint

**Files:**
- Update only separately authorized implementation report/RTM and Gap Register evidence.

**Interfaces:**
- Consumes: Tasks 1-6 fresh evidence.
- Produces: bounded Phase 1 implementation checkpoint recommendation; gaps remain blocking and no Production readiness claim is allowed.

- [ ] Run focused persistence/resolver/bootstrap/child tests and affected Session/Auth/composition regression.
- [ ] Run full regression once, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, gitleaks and document/link/ID validation.
- [ ] Perform independent review of authority separation, pre-gate side effects, migration ownership, shutdown, secret safety and scope.
- [ ] Confirm Gaps 004/005/006 remain blocking because Production migration/rehearsal evidence is absent.
- [ ] Stop for AO checkpoint approval. Do not execute Phase 2 migration or activate provider/network behavior without corresponding authorization.

### Task 8: Phase 2 migration handoff and Phase 1 return gate

**Files:**
- Consume: separately authorized REL-002 Phase 2 migration artifacts and rehearsal evidence.
- Update: Phase 1 implementation report/RTM/Gap Register only after Production-bound compatibility verification.

**Interfaces:**
- Consumes: Phase 2-provisioned Identity, Session and five child schemas with migration/version/recovery evidence.
- Produces: Phase 1 Production-bound startup verification and evidence-based Gap 004/005/006 reevaluation.

- [ ] After AO accepts the Phase 1 implementation checkpoint, start Phase 2 only under its separate authorization and execute no Phase 2 work from this plan.
- [ ] After Phase 2 migration/rehearsal completes, return to Phase 1 and run exact Production schema compatibility, zero-runtime-DDL, startup-order and restart tests.
- [ ] Run full regression, lint, typecheck, clean build, architecture checksum, gitleaks, document/link/ID validation and independent review.
- [ ] Reevaluate Gaps 004/005/006 from combined Phase 1 implementation and Phase 2 migration evidence, then stop for AO closeout.

## Self-review result

- Spec coverage: persistence, resolver, bootstrap ordering/context, Session ownership, all child DDL containment, Phase 2 handoff/return and gap reevaluation map to Tasks 1-8.
- Completeness scan: no unresolved implementation marker, implicit default or invented migration/provider action is present.
- Type consistency: store/resolver/context/bootstrap signatures are consistent with the five Phase 1D design documents.
