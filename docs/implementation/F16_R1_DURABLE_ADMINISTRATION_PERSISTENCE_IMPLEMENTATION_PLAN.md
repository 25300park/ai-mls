# F16-R1 Durable Administration Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. All implementation remains in this session unless the Architecture Owner explicitly authorizes subagents.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-019 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-08-26 |

**Goal:** Preserve the canonical `AdministrationUnitOfWork` contract while adding a production-only, zero-external-dependency SQLite durability boundary.

**Architecture:** Extract the existing Phase 6 transaction rules into one internal engine shared by the in-memory and durable adapters. The durable adapter persists validated state, append-only evidence/decisions, immutable idempotency and revisions in one `BEGIN IMMEDIATE` transaction; production composition requires an explicit file database and never selects the in-memory adapter.

**Tech Stack:** Node.js 24.18.0, TypeScript 6, built-in `node:sqlite`, `node:test`, pnpm 11.9.0.

**Spec:** [F16-R1 Durable Administration Persistence Design](F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_DESIGN.md)

## Global constraints

- No API-015 operation, schema, authority or ownership change.
- No PostgreSQL, ORM, external database/runtime dependency, package manifest or lockfile change.
- Preserve Phase 6 atomic bundle, evidence-prefix, expected-version, idempotency and rollback-only invariants.
- Keep `InMemoryAdministrationUnitOfWork` for test/development only.
- Production requires an explicit non-memory SQLite path and has no fallback.
- No Console/UI, F16-R2 or F16-R3 work.
- TDD is mandatory: observe each new behavior fail before production code.
- Create exactly one local commit only after every final gate passes; never push.

---

### Task 1: Shared Phase 6 transaction engine

**Files:**
- Create: `modules/administration/src/administration-persistence-engine.ts`
- Modify: `modules/administration/src/administration-persistence.ts`
- Test: `modules/administration/src/administration-persistence.test.ts`
- Test: `modules/administration/src/administration-persistence-architecture.test.ts`

**Interfaces:**
- Consumes: existing record/repository/`AdministrationTransaction` types.
- Produces: module-internal `AdministrationTransactionState`, `AdministrationTransactionCommit`, and `createAdministrationTransaction()`.
- Public `AdministrationUnitOfWork` and repository signatures remain unchanged.

- [ ] **Step 1: Add characterization assertions before extraction**

Assert existing create/update/decision/idempotency atomic bundles, rollback-only behavior, evidence-prefix enforcement and optimistic conflict results through `InMemoryAdministrationUnitOfWork`.

- [ ] **Step 2: Run the focused Phase 6 test**

Run:

```powershell
pnpm.cmd build
node --test dist/modules/administration/src/administration-persistence.test.js
```

Expected: PASS; these are characterization tests, so record the unchanged baseline.

- [ ] **Step 3: Extract the internal engine without changing behavior**

Create an internal factory shaped as:

```typescript
export interface AdministrationTransactionCommit {
  commit(input: {
    readonly identity: AdministrationTransactionIdentity;
    readonly initialRevision: number;
    readonly state: AdministrationTransactionState;
    readonly tracker: AdministrationTransactionTrackerSnapshot;
  }): void;
}

export function createAdministrationTransaction(input: {
  readonly identity: AdministrationTransactionIdentity;
  readonly initialState: AdministrationTransactionState;
  readonly initialRevision: number;
  readonly failures: AdministrationPersistenceFailurePort;
  readonly commitBoundary: AdministrationTransactionCommit;
  readonly release: () => void;
}): AdministrationTransaction;
```

Move the existing guarded repositories, transaction tracker, `validateAtomicBundle`, evidence-prefix checks and rollback-only behavior into this engine. The in-memory adapter delegates to it and keeps the same external behavior.

- [ ] **Step 4: Run focused tests and architecture assertions**

Expected: existing Phase 6 tests remain green and the engine contains no authorization, transport, Console or execution dependency.

### Task 2: SQLite schema, strict codecs and durable reads

**Files:**
- Create: `modules/administration/src/administration-durable-persistence.ts`
- Create: `modules/administration/src/administration-durable-persistence.test.ts`
- Modify: `modules/administration/src/index.ts`

**Interfaces:**
- Produces:

```typescript
export interface DurableAdministrationUnitOfWorkOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: 5000;
  readonly failures?: AdministrationPersistenceFailurePort;
}

export class DurableAdministrationUnitOfWork implements AdministrationUnitOfWork {
  public constructor(options: DurableAdministrationUnitOfWorkOptions);
  public readonly roleAssignments: RoleAssignmentReadRepository;
  public readonly roles: RoleReadRepository;
  public readonly policies: PolicyReadRepository;
  public readonly teamScopes: TeamScopeReadRepository;
  public readonly sourceGovernance: SourceGovernanceReadRepository;
  public readonly publicationTargets: PublicationTargetReadRepository;
  public readonly proposals: AdministrationProposalReadRepository;
  public readonly decisions: AdministrationDecisionReadRepository;
  public readonly idempotency: AdministrationIdempotencyReadRepository;
  public begin(identity: AdministrationTransactionIdentity): AdministrationTransaction;
  public close(): void;
}
```

- [ ] **Step 1: RED — require a durable path and reopen committed records**

Write tests proving empty/`:memory:` paths fail closed and a committed governed record, proposal, decision, evidence, idempotency record and revision survive `close()` plus a new adapter instance.

- [ ] **Step 2: Run RED**

Run the compiled durable test only. Expected: FAIL because `DurableAdministrationUnitOfWork` does not exist.

- [ ] **Step 3: GREEN — create schema and strict codecs**

Use `DatabaseSync`, parameter binding and the exact v0.3 schema. Set `journal_mode=WAL`, `synchronous=FULL`, `foreign_keys=ON`, and `busy_timeout=5000`. Bootstrap schema/triggers inside `BEGIN EXCLUSIVE`. Reject incompatible schema, integrity/foreign-key failure and malformed decoded rows.

- [ ] **Step 4: GREEN — implement durable read repositories**

Read by composite tenant/resource identity and list only exact scope/subject records. Deep-clone/freeze decoded results so existing immutable repository semantics remain unchanged.

- [ ] **Step 5: Run focused durable tests**

Expected: restart/reopen and strict-path tests PASS.

### Task 3: Atomic durable commit, idempotency and append-only evidence

**Files:**
- Modify: `modules/administration/src/administration-durable-persistence.ts`
- Modify: `modules/administration/src/administration-durable-persistence.test.ts`

**Interfaces:**
- Consumes: shared transaction engine from Task 1.
- Produces: one SQLite commit boundary implementing existing UoW semantics.

- [ ] **Step 1: RED — atomic all-or-none commit**

Add direct tests that inject failures at state write, decision append, idempotency write and commit. Assert resource/proposal/decision/evidence/idempotency/revision are either all committed or all unchanged.

- [ ] **Step 2: RED — append-only and replay semantics**

Assert SQL-level `UPDATE`/`DELETE` attempts on decision, evidence and idempotency tables fail; same key/fingerprint replays the stored result after reopen; same key/different fingerprint raises `IDEMPOTENCY_CONFLICT`.

- [ ] **Step 3: Run RED**

Expected: failures identify missing durable commit and trigger behavior.

- [ ] **Step 4: GREEN — implement one SQLite transaction**

Inside `BEGIN IMMEDIATE`:

```sql
UPDATE administration_resources
SET version = ?, payload_json = ?
WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? AND version = ?;

UPDATE administration_revisions
SET revision = revision + 1
WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? AND revision = ?;
```

For a new identity, insert revision `0`, require one inserted row, then perform `0 → 1` CAS. Require exact row counts, append new evidence sequences only, insert decision/idempotency once, then `COMMIT`. Any error executes `ROLLBACK` and preserves safe existing error codes.

- [ ] **Step 5: Run focused tests**

Expected: atomicity, rollback, append-only, replay and conflict tests PASS.

### Task 4: Concurrency, corruption and crash recovery

**Files:**
- Create: `modules/administration/src/administration-durable-crash-fixture.ts`
- Modify: `modules/administration/src/administration-durable-persistence.test.ts`

**Interfaces:**
- The crash fixture is test-only executable behavior and is not exported by `modules/administration/src/index.ts`.

- [ ] **Step 1: RED — stale multi-instance transaction**

Open two adapters on one file, begin from the same revision, commit the first and assert the second deterministically fails with `VERSION_CONFLICT` and no partial rows.

- [ ] **Step 2: RED — pre-COMMIT child termination**

Spawn the compiled crash fixture, let it begin and stage partial SQL writes, terminate it before `COMMIT`, reopen and assert old state only.

- [ ] **Step 3: RED — COMMIT-boundary uncertain outcome**

Inject a connection/commit-boundary failure. Assert the adapter is quarantined, refuses new transactions, and a fresh adapter resolves either all-old or all-new state using revision/idempotency evidence; subset state fails.

- [ ] **Step 4: RED — corruption/incompatible data**

Assert corrupted file, unsupported schema version, foreign-key violation and malformed payload/linkage all fail startup without exposing path or SQL details.

- [ ] **Step 5: GREEN — bounded locks, quarantine and open validation**

Map expired `SQLITE_BUSY`/`SQLITE_LOCKED` to `VERSION_CONFLICT`. Quarantine uncertain connections. On every open, execute integrity/foreign-key checks and decode every persisted row/linkage before accepting reads.

- [ ] **Step 6: Run focused recovery tests**

Expected: concurrency, controlled crash, uncertain outcome and corruption tests PASS.

### Task 5: Production composition selects durability

**Files:**
- Modify: `apps/api/src/administration-governance-api.ts`
- Modify: `apps/api/src/composition.ts`
- Create: `apps/api/src/administration-production-composition.test.ts`
- Modify: `apps/api/src/administration-governance-architecture.test.ts`

**Interfaces:**
- Export the existing dependency type without changing its fields.
- Produce:

```typescript
export interface ProductionAdministrationCompositionOptions
  extends Omit<AdministrationGovernanceApplicationDependencies,
    "unitOfWork" | "roleAssignments" | "roles" | "policies" |
    "teamScopes" | "sourceGovernance" | "publicationTargets" |
    "proposals" | "decisions" | "idempotency"> {
  readonly databasePath: string;
  readonly configuration?: unknown;
}

export interface ProductionAdministrationComposition {
  readonly server: PublicationNodeHttpServer;
  close(): Promise<void>;
}

export function composeProductionAdministrationApi015NodeHttpServer(
  options: ProductionAdministrationCompositionOptions,
): ProductionAdministrationComposition;
```

- [ ] **Step 1: RED — missing/memory path fails closed**

Assert production composition rejects missing, blank and memory database paths before creating an HTTP server.

- [ ] **Step 2: RED — production path survives restart**

Compose, execute one approved API-015 mutation, stop/close, recompose with the same path and verify the canonical read/idempotency result survives.

- [ ] **Step 3: RED — architecture has zero fallback**

Inspect production composition imports/source and assert it creates `DurableAdministrationUnitOfWork`, never imports/constructs `InMemoryAdministrationUnitOfWork`, and preserves the single `AdministrationGovernanceApplication` boundary.

- [ ] **Step 4: GREEN — implement minimal production factory**

Construct one durable adapter, inject its UoW/read repositories into the existing application, and compose the existing HTTP server. `close()` stops the server before closing SQLite.

- [ ] **Step 5: Run focused composition and affected API tests**

Expected: composition, Runtime/HTTP, authorization/isolation and existing Console integration tests PASS.

### Task 6: Final verification, traceability and one commit

**Files:**
- Modify: `docs/implementation/FEAT016_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_IMPLEMENTATION_REPORT.md`
- Modify only if required by document governance: `docs/00_MASTER_INDEX.md`, `docs/00_VERSION_HISTORY.md`

- [ ] **Step 1: Run focused durability and atomicity tests**

Record exact pass counts for durable persistence, recovery and production composition.

- [ ] **Step 2: Run affected regression**

Run Phase 6 persistence, Phase 7 live authority, Phase 8 governed workflows, Phase 9 HTTP and Phase 11/12 Console/API composed tests.

- [ ] **Step 3: Run final gates once**

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd verify
```

Then run architecture checksum, `git diff --check`, Gitleaks worktree scan and explicitly authorized dependency audits. Confirm package manifest and lockfile hashes are unchanged.

- [ ] **Step 4: Request fresh independent review**

Require Critical 0 / Important 0 and resolve every valid finding through RED-first corrections.

- [ ] **Step 5: Update evidence**

Mark only `F16-GAP-004/006/007` durability evidence actually verified by R1. Do not close `F16-GAP-005` or claim FEAT-016 Final Gate completion.

- [ ] **Step 6: Create completion report**

Use the repository completion template and record exact files, restart/recovery evidence, atomicity, CAS, append-only enforcement, audit results, risks and next boundary. Final recommendation must be exactly `APPROVE_F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE` or `BLOCK_F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE`.

- [ ] **Step 7: Create exactly one local commit**

Only after all gates and review pass:

```powershell
git add <verified F16-R1 files only>
git commit -m "feat(feat-016): add durable administration persistence"
git status --short
```

Expected: one local commit, clean working tree, Push `NOT_PERFORMED`, F16-R2/R3 `NOT_STARTED`.
