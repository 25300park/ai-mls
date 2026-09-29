# REL-002 R3-B0 Governance Disposition Packet

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-371 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| Architecture direction | `APPROVE_REL002_R3B_POSTGRESQL_PERSISTENCE_ARCHITECTURE` |
| Implementation authority | `R3-B1 AUTHORIZED_AFTER_R3-B0_CLOSEOUT_AND_MAIN_INTEGRATION` |

## Purpose

이 packet은 승인된 R3-B0 architecture direction과 2026-09-30 AO disposition을 canonical normative text로 기록한다. R3-B1은 R3-B0 closeout과 main integration 이후 CR-030 범위에 한해 승인되며 Production execution authority가 아니다.

## DEC-195 — Child-root PostgreSQL Schema Ownership

| Field | Disposition text |
|---|---|
| Status | `APPROVED` |
| Decision | Production child-root persistence SHALL use five dedicated schemas: `app_publication`, `app_administration`, `app_connector`, `app_external_integration`, and `app_advisory`. It SHALL NOT place child-root business persistence in `app_identity`. `ai_mls_production_migration_operator` SHALL own schema/DDL execution; `ai_mls_production_runtime` SHALL receive only exact verified runtime privileges. |
| Rationale | Separates ownership, migration/version boundaries, ACL verification, incident isolation, naming, and audit evidence from Identity authority. |
| Scope | Current 36 durable tables and their required schema metadata, indexes, constraints, triggers/functions. |
| Affected documents/modules | DOC-DEV-368–371; Publication, Administration, Source Connector, External Integration, Advisory persistence modules. |
| Compatibility impact | SQLite remains local/test evidence only; business semantics and authority remain unchanged. PostgreSQL names are schema-qualified. |
| Production impact | No impact until separately authorized migrations and grants execute. Current deployability remains `BLOCKED`. |
| Rollback/recovery | Before migration commit: transaction rollback. After commit: governed forward-fix; no destructive down migration or runtime repair. |

## DEC-196 — Canonical Async Persistence Contract

| Field | Disposition text |
|---|---|
| Status | `APPROVED` |
| Decision | The canonical persistence and application call chains for API-014, API-015, API-018, API-019 and FEAT-022 SHALL become asynchronous end-to-end. SQLite local/test implementations SHALL implement the same async ports and preserve business-semantic parity. Blocking wrappers around PostgreSQL I/O and duplicate Production-only business paths are prohibited. |
| Rationale | Approved `pg` access is asynchronous; one canonical contract prevents deadlock-prone bridging and semantic drift. |
| Scope | Persistence ports, transactions/UoWs, application services, handlers, composition, tests and lifecycle close methods. |
| Affected documents/modules | DOC-DEV-369–371; five child-root port/caller chains identified in R3-B0. |
| Compatibility impact | Type/signature breaking change handled in bounded phases; SQLite behavior remains supported through async parity adapters. No API payload/authority change. |
| Production impact | None until adapters and composition are separately authorized and verified. |
| Rollback/recovery | Each domain conversion remains independently revertible before integration; no mixed sync/async Production fallback is allowed. |

## DEC-197 — Child-root Migration, Readiness and Grant Contract

| Field | Disposition text |
|---|---|
| Status | `APPROVED` |
| Decision | Each child-root domain SHALL use module-owned forward-only Production migrations, exact checksum/schema-version/structure verifiers, fail-closed preconditions and exact least-privilege runtime grants. Application startup SHALL NOT create, migrate or repair schema. Runtime DDL, grant options, unexpected role membership and PUBLIC leakage are prohibited. Aggregate readiness SHALL pass before child roots, listeners or workers start. |
| Rationale | Preserves controlled migration ownership and makes schema/ACL drift observable before runtime activation. |
| Scope | Migration/verifier/grant/readiness contracts for all five schemas; no Production execution in R3-B0. |
| Affected documents/modules | DOC-DEV-368–371; future per-domain PostgreSQL migration directories; ProductionBootstrap readiness. |
| Compatibility impact | Existing SQLite auto-initialization cannot be used in Production. Local/test behavior remains separately bounded. |
| Production impact | Production remains blocked until controlled execution evidence and exact readiness PASS. |
| Rollback/recovery | Rollback before transaction commit; immutable executed artifacts; post-commit correction by new forward-fix only. |

## DEC-198 — Shared Production PostgreSQL Pool Authority

| Field | Disposition text |
|---|---|
| Status | `APPROVED / OPTION B` |
| Shared invariant | Exactly one `ProductionBootstrap`-owned physical PostgreSQL pool SHALL serve Identity and bounded child-root repositories. Each UoW SHALL check out one client for its transaction and release it. Repositories SHALL NOT resolve secrets or create independent pools. The approved sealed references and `ai_mls_production_runtime` credential remain the only steady-state database authority. |
| Rationale | Reuses the approved connection/secret boundary, bounds connection count and prevents duplicate credential consumers. |
| Scope | Pool naming, bootstrap ownership, repository checkout and shutdown lifecycle. |
| Affected documents/modules | DOC-DEV-369–371; ProductionBootstrap, PostgreSQL pool factory, future child-root adapters. |
| Production impact | None before R3-B8 composition authorization. |
| Rollback/recovery | Compatibility alias/config mapping must be reversible before deployment; never create a second active pool authority as rollback. |

### Option A — retain historical authority name

`PG_IDENTITY_POOL` remains the canonical internal consumer identifier even when the same physical pool serves bounded non-Identity repositories. Documentation SHALL state that the name is historical and does not confer Identity ownership on child domains. This minimizes code/config change but leaves a misleading name.

### Option B — broader canonical authority with compatibility preservation

Introduce `PG_PRODUCTION_POOL` as the canonical internal authority name while preserving `PG_IDENTITY_POOL` only as a time-bounded compatibility input during one reviewed transition. Both names MUST resolve to the same pool and same approved sealed references; simultaneous independent pools, fallback resolution and a second secret consumer are prohibited. After migration evidence, the legacy alias is removed by a separate approved change.

**AO disposition:** Option B selected. Phase 1 makes `PG_PRODUCTION_POOL` canonical and retains `PG_IDENTITY_POOL` as a compatibility input; Phase 2 migrates all internal Production consumers; Phase 3 removes compatibility only under a separate verified change. No phase permits two physical pools.

## CR-030 — Implement five child-root PostgreSQL schemas and exact grants

| Field | Disposition text |
|---|---|
| Status | `APPROVED`; R3-B1 implementation authorized after R3-B0 closeout and main integration |
| Requested change | Implement schema, forward migration, exact verifier, readiness and least-privilege grant artifacts for the verified 36-table inventory after DEC-195/197 ratification. |
| Rationale | Identity is currently the only Production PostgreSQL persistence implementation. |
| Scope | R3-B1 only; no adapter implementation or Production execution. |
| Affected documents/modules | DOC-DEV-368–371; future five module-owned PostgreSQL migration sets. |
| Compatibility impact | Preserve SQLite local/test semantics and historical evidence; explicit PostgreSQL normalization only. |
| Production impact | Artifacts only until separately authorized controlled execution. |
| Rollback/recovery | Disposable verification first; Production transaction rollback/forward-fix policy from DEC-197. |

## CR-031 — Convert child-root persistence to canonical async contracts

| Field | Disposition text |
|---|---|
| Status | `APPROVED_FOR_PLANNING`; phase-specific implementation authorization required |
| Requested change | Convert five persistence/application chains to the DEC-196 async contract with SQLite/PostgreSQL repository parity and no blocking bridge. |
| Rationale | Synchronous business persistence cannot implicitly consume asynchronous `pg` safely. |
| Scope | R3-B2–B7, split per domain and independently reviewed. |
| Affected documents/modules | Five ports/UoWs/stores, service call sites, handlers, composition and tests. |
| Compatibility impact | Compile-time breaking signatures; external API/domain semantics unchanged. |
| Production impact | No activation until each domain adapter and readiness gate pass. |
| Rollback/recovery | Domain-scoped changes remain isolated; mixed-contract Production deployment prohibited. |

## CR-032 — Integrate shared pool and aggregate child-root readiness

| Field | Disposition text |
|---|---|
| Status | `APPROVED_FOR_PLANNING`; phase-specific implementation authorization required |
| Requested change | After CR-030/031 completion, bind five bounded repositories to the AO-selected DEC-198 pool authority and enable exact aggregate schema/ACL readiness before removing R3-A's null child-root boundary. |
| Rationale | R3-A intentionally remains fail closed until all child-root persistence prerequisites are proven. |
| Scope | R3-B8 composition/readiness only; listener count and existing authority boundaries unchanged. |
| Affected documents/modules | ProductionBootstrap, child-root registry/options, shared readiness and lifecycle tests. |
| Compatibility impact | Existing fail-closed state persists until atomic integration gate passes. |
| Production impact | Still requires separate Railway/Production deployment authorization. |
| Rollback/recovery | Revert to explicit null/fail-closed composition; never fall back to SQLite or partial child-root activation. |

## Document ID governance correction

Repository and full Git-history searches at baseline `e23affda9ba1fa85d0ddcd149f1be59acace6465` found only one `DOC-DEV-367` assignment: the R3-A completion report introduced by `e23affd` on 2026-09-29. The earlier Platform-Limited Backup/Restore Evidence Contract introduced by `c19ee4b` uses `DOC-DEV-366`, not `DOC-DEV-367`. Therefore the reported two-document duplicate is **not reproducible** and no second document or earlier canonical owner may be invented.

The verified defect is that a completion report uses a `DOC-DEV` ID and is absent from the Master Index. The bounded correction assigns unused `DOC-REVIEW-252` to `REL002_R3A_PRODUCTION_DEPENDENCY_COMPOSITION_COMPLETION.md`, updates its exact self-check text, and registers it in the Master Index. Substantive R3-A content is unchanged. `DOC-DEV-367` becomes unassigned/reserved; it is not reassigned in this change.

## Authorization gate

DEC-195–198 are ratified, DEC-198 Option B is selected, and CR-030 is approved for R3-B1 implementation after this closeout and main integration. CR-031/032 authorize planning only. R3-B1 excludes Production migration execution, PostgreSQL adapter implementation, async service conversion, Railway deployment and platform mutation.
