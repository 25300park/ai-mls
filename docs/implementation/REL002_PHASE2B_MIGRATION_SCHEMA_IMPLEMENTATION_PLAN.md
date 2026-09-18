# REL-002 Phase 2B Migration / Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` to execute each production task. This Phase is executed inline and must not create a commit.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-309 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Data Owner / Quality Owner |
| 기준일 | 2026-09-18 |
| Baseline | `cfc3d8b391be88e55dabb40ac13326aeaf1182e4` |

**Goal:** DEC-172/173/174의 exact schema를 명시적 migration artifact와 read-only compatibility classifier로 구현하되 Production migration, row seeding, runtime DDL을 실행하지 않는다.

**Architecture:** Identity module이 versioned SQL artifact와 artifact SHA-256 identity를 소유한다. Runtime은 schema, shared metadata 및 migration ledger를 read-only로 검사해 approved internal readiness state를 반환하고, 기존 store는 그 결과를 기존 safe unavailable error로 정규화한다.

**Tech Stack:** TypeScript, Node.js `node:sqlite`, Node test runner, SQLite SQL artifacts, SHA-256.

**Spec:** `docs/implementation/REL002_PHASE2A_REGISTERED_SERVICE_WORKLOAD_MIGRATION_DESIGN.md`, `docs/implementation/REL002_PHASE2A_PRODUCTION_SCHEMA_CONTRACT.md`, `docs/implementation/REL002_PHASE2A_SCHEMA_READINESS_STATE_MODEL.md`.

## Global Constraints

- Production database migration/write, identity seeding and runtime schema auto-create are `0`.
- `environment = 'PRODUCTION'` remains part of the approved Phase 1G exact schema.
- No API, role, capability, auth authority, dependency, lockfile, external network or credential change.
- Migration ledger and workload schema share the existing Identity database boundary.
- Commit and push remain `NOT_CREATED` / `NOT_PERFORMED`.

---

### Task 1: RED migration and readiness tests

**Files:**
- Create: `modules/identity/src/registered-service-workload-migration.test.ts`
- Modify: `modules/identity/src/registered-service-workload.test.ts`

**Interfaces:**
- Consumes: approved DEC-172/173 schema and readiness vocabulary.
- Produces: failing expectations for artifact presence/hash, zero seed rows, exact compatible state, missing schema, unsupported version, incompatible schema and partial migration.

- [ ] Write focused tests importing the wished-for migration constants and `inspectRegisteredServiceWorkloadSchema()`.
- [ ] Compile and run the focused tests; confirm failure is caused by missing artifacts/API.

### Task 2: Explicit migration artifacts

**Files:**
- Create: `modules/identity/migrations/production/001_registered_service_workload_v1.up.sql`
- Create: `modules/identity/migrations/production/001_registered_service_workload_v1.verify.sql`
- Modify: `modules/identity/src/registered-service-workload-schema.ts`

**Interfaces:**
- Produces: `REGISTERED_SERVICE_WORKLOAD_MIGRATION_ID`, artifact path/checksum, exact migration-ledger contract and schema constants.
- The forward artifact creates schema/metadata only and inserts zero workload identities.

- [ ] Add the minimal SQL artifacts without transaction execution or row seeding.
- [ ] Bind their exact SHA-256 in the Identity contract.
- [ ] Re-run artifact tests and confirm GREEN.

### Task 3: Read-only compatibility classification

**Files:**
- Modify: `modules/identity/src/registered-service-workload-schema.ts`
- Modify: `modules/identity/src/index.ts`
- Test: `modules/identity/src/registered-service-workload-migration.test.ts`

**Interfaces:**
- Produces: `RegisteredServiceWorkloadSchemaReadiness` and `inspectRegisteredServiceWorkloadSchema(database)`.
- Preserves: `assertRegisteredServiceWorkloadSchemaCompatible(database)` as the store's safe fail-closed wrapper.

- [ ] Implement exact state precedence and migration-ledger validation using read-only SQLite queries only.
- [ ] Verify missing columns/constraints/index, shared metadata drift, unsupported version and missing-side states fail closed.
- [ ] Verify no runtime table/index/row mutation occurs.

### Task 4: Regression and evidence

**Files:**
- Create: `docs/implementation/REL002_PHASE2B_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/REL002_PHASE2B_COMPLETION_REPORT.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify: `docs/implementation/REL002_PHASE0_PRODUCTION_GAP_REGISTER.md`
- Modify: `docs/implementation/REL002_PHASE_PLAN.md`

**Interfaces:**
- Records actual focused/affected/full/lint/typecheck/build/diff/review results only.
- Keeps Gaps 004/005/006 open without controlled execution evidence.

- [ ] Run focused migration and compatibility tests.
- [ ] Run affected Identity/Production bootstrap regression.
- [ ] Run full regression once and preserve the pre-existing historical exact-candidate mismatch truthfully if unchanged.
- [ ] Run lint, typecheck, clean build and `git diff --check`.
- [ ] Perform fresh independent review and write completion evidence.

## Self-review

- Spec coverage: artifact, exact schema, ledger, readiness states, zero execution/seed/runtime DDL and verification are mapped.
- Placeholder scan: no deferred implementation placeholder appears.
- Type consistency: the classifier state names exactly match DEC-173 and the Phase 2A readiness model.
- Scope: migration execution, registration initialization, provider/network and next REL-002 phases remain excluded.
