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
| Phase 1 | DESIGN APPROVED / IMPLEMENTATION NOT AUTHORIZED | DEC-164 and Phase 1 inventory/models/matrix/plan; gaps 004-006 remain blocking |
| Phase 2 | NOT STARTED | May start only after the bounded Phase 1 implementation checkpoint receives AO approval; migration execution requires separate Phase 2 authorization |

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
