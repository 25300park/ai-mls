# REL-002 Production Readiness Phase Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-276 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-16 |
| 근거 | [Phase 0 Inventory](REL002_PHASE0_PRODUCTION_READINESS_INVENTORY.md), [Gap Register](REL002_PHASE0_PRODUCTION_GAP_REGISTER.md) |

## 1. Sequencing principles

- Phase 0 is inventory only; every later phase requires separate authorization and bounded design where canonical details are unresolved.
- Configuration, identity and data foundations precede runtime and deployment.
- Backup/restore/rollback evidence precedes Production promotion.
- External provider activation is a separate hold lane and cannot be inferred from repository completion.
- No phase may rewrite REL-001 historical candidate, acceptance or DEC-162/163 evidence.

## 2. Recommended phases

| Phase | Name | Primary gaps | Exit boundary |
|---|---|---|---|
| REL-002 Phase 1 | Production Configuration, Identity and Secrets | 004-006 | Exact Production configuration/ownership; fail-closed identity and secret-reference design; no credential values |
| REL-002 Phase 2 | Production Data, Migration, Retention and Privacy | 002-003, 018 | Approved datastore/migration/retention/privacy design and bounded implementation/rehearsal evidence |
| REL-002 Phase 3 | Production Runtime, Audit, Jobs and Probes | 001, 007-008, 016 | Production lifecycle composition for existing APIs only, safe probes and supervised bounded runtime |
| REL-002 Phase 4 | Observability, Alerting and Incident Operations | 010-011, 021 | Actual Production monitoring path, escalation/on-call and exercised incident workflow |
| REL-002 Phase 5 | Backup, Restore, Recovery, DR and Rollback | 009, 012-013, 015 | Target-bound backup/restore/DR/rollback rehearsal satisfying approved RPO/RTO and authority |
| REL-002 Phase 6 | Deployment, Capacity and Production Runbook | 014, 019-020 | Immutable candidate deployment rehearsal, capacity evidence and exact runbook; no Production cutover yet |
| REL-002 Phase 7 | Security/Privacy Hardening and External Dependency Disposition | 017, 023 | Production control review plus external hold disposition; live provider work only under separate scoped approval |
| REL-002 Phase 8 | Exact Production Candidate Acceptance and Promotion Handoff | 022, 024-025 | Fresh exact-candidate evidence, dependency audit, acceptance authority/SoD and handoff decision |

## 3. Gate dependencies

`Phase 1 → Phase 2 → Phase 3 → Phase 4/5 → Phase 6 → Phase 7 → Phase 8`

Phase 4 and Phase 5 may be designed independently after Phase 3, but Phase 6 and Phase 8 require both. The external-provider lane may remain blocked while provider-independent repository work continues; Phase 8 cannot return an accepted provider-backed candidate until the required external condition is proven.

## 4. Mandatory stop conditions

Stop for Architecture Owner review before new API IDs, roles/capabilities, lifecycle vocabulary, persistence technology, identity protocol, external destination, Production credential, migration execution, deployment authority or provider/network activation.

## 5. Current phase status

| Phase | Status | Evidence boundary |
|---|---|---|
| Phase 0 | COMPLETE | Inventory `26/26`, blocking gaps `24`, non-blocking gaps `1` |
| Phase 1 | IMPLEMENTATION COMPLETE / PRODUCTION RETURN GATE OPEN | Phase 1G implements DEC-169/170/171; gaps 004-006 remain blocking pending Production-bound schema/config evidence |
| Phase 2 | PHASE 2D-0B POSTGRESQL TRANSITION DESIGN COMPLETE / IMPLEMENTATION AND CONTROLLED EXECUTION BLOCKED | Phase 2D-0A replaces the Production engine assumption; Phase 2D-0B defines PostgreSQL adapter/migration/pool/validator design, while decisions, driver, implementation, physical target/operator/backup-restore evidence and Production execution remain gated |

The Phase 1 design introduces no Production/Test change, credential value, infrastructure mutation or provider/network call. It does not change the Phase 0 gap counts or the eight-phase sequence.

### Phase 1C amendment gate

Phase 1B remains blocked because the canonical SERVICE/WORKLOAD registration authority and shared Production bootstrap are not implemented. Phase 1C approved DEC-165 and DEC-166 at the design boundary; physical table/schema selection remains `DEFERRED`.

The Phase 1C resume plan is preserved as historical design evidence and is not the current execution plan. Phase 1B may resume only under separate implementation authorization and the Phase 1D plan below. Phase 2 remains `NOT STARTED`, and gaps 004/005/006 remain blocking.

### Phase 1D implementation-design gate

Phase 1D selects the existing Identity database boundary with a separate `identity_registered_service_workloads` table/store proposal and assigns all Production schema/migration execution to Phase 2. It also proposes a module-private, non-forgeable `ProductionBootstrapContext` and exact pre-gate/post-gate lifecycle contract.

DEC-167 and DEC-168 are `APPROVED`. The [Phase 1D Resume Implementation Plan](REL002_PHASE1D_PHASE1B_RESUME_IMPLEMENTATION_PLAN.md) may execute only after separate implementation authorization. Phase 2 remains `NOT STARTED`; Gaps 004/005/006 remain blocking.

To avoid a migration dependency cycle, Phase 1 uses a split gate: bounded fail-closed adapter/bootstrap implementation and test-only schema fixtures reach an AO checkpoint first; separately authorized Phase 2 then owns Production migration and rehearsal; Phase 1 resumes at a return gate for exact Production schema/startup verification and final gap reevaluation. Phase 1 code never executes the Phase 2 migration.

### Phase 1F authority/root-governance design gate

Phase 1E implementation evidence remains isolated and BLOCKED after independent review. Phase 1F does not restart implementation; it defines the missing authority and governance contracts:

- DEC-169 (`APPROVED`): read-only binding of Identity registration evidence and API-016 final evidence plus an evidence-backed non-Session `WorkloadAuthorizationSubject`
- DEC-170 (`APPROVED`): sole Production entry and closed registry for the five actual roots
- DEC-171 (`APPROVED`): versioned Identity schema contract with strict read-only compatibility check
- live authorization: human requests reuse `SessionAccessCoordinator`; service/job/worker Session authority remains `NOT_FOUND` and uses the DEC-169-approved workload subject with the existing live-assignment/policy engine

The [Phase 1E Salvage / Resume Plan](REL002_PHASE1F_PHASE1E_SALVAGE_RESUME_PLAN.md) remains subject to separate implementation authorization. Phase 2 remains `NOT STARTED` and owns all Production migration execution. Gaps 004/005/006 remain blocking.

### Phase 1G salvage implementation checkpoint

Phase 1G reuses the valid Phase 1E durable-store/resolver/bootstrap work and implements DEC-169/170/171. Evidence adapter, non-Session workload subject, live assignment/policy revalidation, exact Identity schema checker and actual five-root registry are implemented and verified. Runtime migration/schema creation remains `0`; Phase 2 still owns Production migration. Therefore Gaps 004/005/006 remain `BLOCKING` pending Production-bound evidence and no Phase 2 work starts under this phase.

### Phase 2A migration/schema-readiness design checkpoint

Phase 2A starts only the design lane authorized at Main `8f217f3e3dfeabed4cdc9413b6f230b26ea61f30`. It defines:

- exact Identity v1 DDL and contract fingerprint matching Phase 1G
- approved migration ID/artifact location design and atomic forward-only execution contract
- `READY` plus four bounded internal `NOT_READY_*` schema states
- backup/authorization/lock/preflight/verification evidence prerequisites
- non-destructive rollback/forward-fix posture
- zero-row schema migration and separate evidence-bound registration process
- column-level privacy/retention/log exposure classification

DEC-172/173/174 are `APPROVED`. At the Phase 2A checkpoint no migration artifact, runner, Production database write, row seed, credential, infrastructure or network action was authorized. Production schema remained `NOT_READY_PHASE2_REQUIRED`; Gaps 004/005/006 remained blocking.

### Phase 2B migration/schema implementation checkpoint

Phase 2B implements the separately authorized explicit v1 forward artifact, read-only verification artifact, immutable artifact checksum, execution-ledger compatibility contract and five-state runtime classifier. Tests execute only against disposable SQLite fixtures and verify zero identity seed, zero artifact-authored execution ledger, exact schema, partial state, version drift and constraint/index/checksum drift.

Production migration execution, Production DB writes, identity initialization, runtime schema auto-create, credentials, infrastructure and network activity remain `0`. Production schema is `NOT_READY_UNTIL_CONTROLLED_EXECUTION`; Gaps 004/005/006 remain `BLOCKING` until later authorized Production-bound evidence exists.

### Phase 2C controlled execution readiness checkpoint

Phase 2C defines the exact preflight, backup/restore, locking, same-transaction schema/metadata/ledger, fail-closed rollback/forward-fix, evidence and post-migration verification contracts. Logical target ownership is the existing Identity-owned Production Identity/Session database boundary and the environment is exact `PRODUCTION`.

The repository does not yet bind an exact physical Production database identity, migration operator authorization instance or current exact-target backup/restore evidence. Those values must be supplied through a separately approved execution packet and must not be inferred or embedded as secret/path values. Therefore the plan is complete while actual execution remains `BLOCKED`; migration execution, Production writes, seed and runtime schema auto-create remain `0`.

### Phase 2D-0A infrastructure binding amendment checkpoint

Phase 2D-0A proposes the canonical Production topology:

- Vercel: frontend/Admin Console/browser delivery only
- Railway: canonical backend/runtime, `startProductionRuntime()` and separately bounded persistent workers
- Supabase: canonical Production PostgreSQL relational persistence

DEC-175~178 are `APPROVED`. Existing Identity/Session/authorization/RoleAssignment/RegisteredServiceWorkload authority remains unchanged and Supabase Auth is not adopted. The SQLite Production assumption is `RETIRED_FOR_PRODUCTION`; existing canonical local/test use and historical Phase 2B evidence remain preserved, but its executable migration/verification artifacts are not valid for PostgreSQL Production execution.

Before Phase 2 execution can resume, a separately authorized lane must close the PostgreSQL adapter/async port boundary, driver/package choice, new migration and compatibility contract, exact Supabase physical binding, Railway service binding, secret backend, named operator and exact-project backup/restore evidence. Until then Gaps 004/005/006 remain `BLOCKING`; migration, Production DB writes, deployment, credential use and infrastructure mutation remain `0`.

### Phase 2D-0B PostgreSQL transition design checkpoint

Phase 2D-0B defines the recommended engine-specific transition without changing runtime code:

- async PostgreSQL Production ports/adapters for Session and RegisteredServiceWorkload;
- synchronous SQLite adapters preserved for local/test and immutable historical evidence only;
- `app_identity` schema contract, engine-aware metadata/ledger and read-only `pg_catalog` compatibility validation;
- per-Railway-service-process Bootstrap-owned pool and checked-out-client transaction ownership;
- separate PostgreSQL Up/Verify artifact with runtime migration `0` and identity seed `0`;
- Vercel database/secret/backend authority `0`, Supabase Auth adoption `0`.

DEC-179~182 are `APPROVED`. The next implementation driver is limited to `pg` and `@types/pg` only if TypeScript compilation requires it; ORMs, Supabase client persistence authority and additional PostgreSQL drivers are prohibited. Separate implementation authorization, connection/pool/timeouts, physical Supabase/Railway binding, secret backend, operator and backup/restore evidence remain open. Therefore this closeout's dependency changes, implementation, migration, Production DB writes, deployment, credentials and network operations remain `0`; Gaps 004/005/006 remain `BLOCKING`.
