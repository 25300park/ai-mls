# FEAT-024-C Durable Acceptance Manifest / Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-044 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Architecture Owner / Release Owner |
| Baseline | `82e687c196d0a2d7f7df2c58e881da5429032f00` |

**Goal:** FEAT-024-A candidate와 FEAT-024-B acceptance manifest를 restart-safe, append-only, atomic and idempotent하게 저장하는 단일 bounded durable persistence boundary를 구현한다.

**Architecture:** `modules/operations`에 `DurableReleaseAcceptanceManifestStore` 하나를 추가한다. Store는 Node.js built-in `node:sqlite`의 한 transaction에서 candidate, manifest, replay binding과 evidence/readiness linkage를 append하며 모든 입력과 복원 데이터를 기존 A/B contract로 재검증한다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6, built-in `node:sqlite`, `node:test`, pnpm 11.9.0; new dependency `0`.

**Spec:** [Approved FEAT-024-C Gap Matrix](../reviews/FEAT024_C_DURABLE_ACCEPTANCE_MANIFEST_IDEMPOTENCY_GAP_MATRIX.md)

## Global Constraints

- Preserve exact FEAT-024-A candidate and FEAT-024-B manifest contracts.
- Current `REL-001 / Staging` result remains `INCOMPLETE`.
- New acceptance/release vocabulary, authority, SoD, public API, deployment/promotion behavior and external service: `0`.
- Reuse no Operational, Administration or Advisory persistence store; introduce only one bounded FEAT-024 store.
- Persist only validated bounded DTOs; raw evidence, secret, PII, scanner/log/provider/model/prompt/CoT/SQL/path data is prohibited.
- Dependency and lockfile changes: `0`.
- Follow RED → minimum GREEN for every production behavior.
- Do not commit or push without separate closeout authorization.

---

### Task 1: Durable store contract and first RED boundary

**Files:**
- Create: `modules/operations/src/durable-release-acceptance-manifest-store.test.ts`
- Create after RED: `modules/operations/src/durable-release-acceptance-manifest-store.ts`
- Modify after GREEN: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: `Rel001StagingCandidate`, `ReleaseAcceptanceManifest`, `validateReleaseAcceptanceManifest()`.
- Produces: `DurableReleaseAcceptanceManifestStore`, `ReleaseAcceptancePersistenceError`, and internal `append`, `findCandidate`, `findManifest`, `findReplay`, `listManifestHistory`, `close` operations.

- [x] **Step 1: Write the first failing durability test**

```typescript
test("FEAT-024-C persists a validated candidate and manifest across reopen", () => {
  const databasePath = fixtureDatabasePath();
  let store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const stored = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  store.close();

  store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  assert.deepEqual(store.findManifest(stored.acceptanceManifestId), stored);
  assert.deepEqual(store.findCandidate(candidate.releaseCandidateId), candidate);
  store.close();
});
```

- [x] **Step 2: Run the isolated compiled test and confirm expected RED**

Run:

```powershell
pnpm.cmd build
node --test dist/modules/operations/src/durable-release-acceptance-manifest-store.test.js
```

Expected: compile/import failure because `DurableReleaseAcceptanceManifestStore` does not yet exist.

- [x] **Step 3: Add the minimum public types and file-backed constructor**

```typescript
export interface DurableReleaseAcceptanceManifestStoreOptions {
  readonly databasePath: string;
  readonly beforeReplayBindingWrite?: () => void;
}

export class DurableReleaseAcceptanceManifestStore {
  public constructor(options: DurableReleaseAcceptanceManifestStoreOptions);
  public append(candidate: Rel001StagingCandidate, manifest: ReleaseAcceptanceManifest, createdAt: string): ReleaseAcceptanceManifest;
  public findCandidate(releaseCandidateId: string): Rel001StagingCandidate | undefined;
  public findManifest(acceptanceManifestId: string): ReleaseAcceptanceManifest | undefined;
  public findReplay(releaseCandidateId: string, manifestFingerprint: string): ReleaseAcceptanceManifest | undefined;
  public listManifestHistory(releaseCandidateId: string): readonly ReleaseAcceptanceManifest[];
  public close(): void;
}
```

Constructor requirements: reject empty and memory database paths; enable `foreign_keys`, WAL, `synchronous=FULL`, `busy_timeout=5000`; bootstrap only the bounded schema; run integrity, foreign-key and stored-state validation.

- [x] **Step 4: Add the four append-only partitions**

```text
release_candidates
release_acceptance_manifests
release_manifest_replay
release_manifest_evidence_links
```

Each table has explicit identity/binding columns, bounded `payload_json` where needed, foreign keys and update/delete rejection triggers. Identity replacement is never used.

- [x] **Step 5: Run the focused test and confirm GREEN**

Run the same two commands. Expected: focused test PASS.

---

### Task 2: Atomic append, exact replay and conflict enforcement

**Files:**
- Modify: `modules/operations/src/durable-release-acceptance-manifest-store.test.ts`
- Modify: `modules/operations/src/durable-release-acceptance-manifest-store.ts`

**Interfaces:**
- Consumes: B validator and replay semantics.
- Produces: one `BEGIN IMMEDIATE` append transaction and bounded error codes `PERSISTENCE_INPUT_INVALID | PERSISTENCE_UNAVAILABLE | CANDIDATE_CONFLICT | MANIFEST_IDENTITY_CONFLICT | IDEMPOTENCY_CONFLICT | LINEAGE_CONFLICT`.

- [x] **Step 1: Add RED tests for exact replay and immutable identity**

Add tests with literal row-count assertions proving:

```text
same candidate + manifest append twice => same result; candidate/manifest/replay/link row counts unchanged
same candidate ID + changed immutable binding => CANDIDATE_CONFLICT; writes 0
same manifest ID + changed canonical content => MANIFEST_IDENTITY_CONFLICT; writes 0
same replay key mapped to another manifest => IDEMPOTENCY_CONFLICT; writes 0
```

- [x] **Step 2: Confirm each RED fails for the missing behavior**

Run only the focused compiled test file and record the first expected behavioral failure.

- [x] **Step 3: Implement validation and replay lookup before mutation**

Validate the candidate through the A-derived invariants and validate the manifest through `validateReleaseAcceptanceManifest(candidate, manifest)`. Exact replay returns the decoded stored manifest. Any mismatch raises the bounded code before write.

- [x] **Step 4: Implement one atomic transaction**

Within `BEGIN IMMEDIATE`, repeat authoritative candidate/manifest/replay checks, insert only absent candidate + manifest + replay + normalized evidence/readiness links, invoke `beforeReplayBindingWrite` immediately before replay insert, and commit once. Any exception attempts rollback and maps internal SQLite details to a safe bounded persistence error.

- [x] **Step 5: Run focused tests and confirm GREEN**

Expected: durability, exact replay and conflict tests PASS; duplicate logical rows `0`.

---

### Task 3: Lineage, timestamps, safety and restart authority

**Files:**
- Modify: `modules/operations/src/durable-release-acceptance-manifest-store.test.ts`
- Modify: `modules/operations/src/durable-release-acceptance-manifest-store.ts`

**Interfaces:**
- Consumes: `previousManifestId`, B fingerprint rules and safe nested refs.
- Produces: same-candidate acyclic lineage, deterministic history and validated immutable reads.

- [x] **Step 1: Add RED lineage tests**

Prove with real SQLite state:

```text
changed evidence => new manifest linked to stored predecessor; predecessor unchanged
missing predecessor => LINEAGE_CONFLICT
cross-candidate predecessor => LINEAGE_CONFLICT
self/cyclic lineage => LINEAGE_CONFLICT
```

- [x] **Step 2: Add RED replay/safety tests**

Prove:

```text
timestamp-only evaluatedAt change => prior logical manifest; duplicate row 0
close/reopen exact replay => provider/process map not involved; duplicate row 0
unsafe/raw evidence or invalid binding => rejected before write
forged current REL-001 ACCEPTED => rejected before write
transaction hook failure => every bounded partition row count 0
```

- [x] **Step 3: Implement minimum lineage validation**

For non-null predecessor: require an existing manifest with the same candidate, reject self-reference, walk immutable predecessor IDs with a visited set and reject repeats. No predecessor row is modified.

- [x] **Step 4: Implement safe decode and deterministic history**

Decode canonical JSON, verify identity columns match payload, reconstruct through A/B validation and return structured clones with recursively frozen nested values. Order history by `created_at ASC, acceptance_manifest_id ASC`.

- [x] **Step 5: Run focused tests and confirm GREEN**

Expected: all FEAT-024-C persistence tests PASS with partial writes, duplicate logical manifests and unsafe persistence all equal to `0`.

---

### Task 4: A/B and affected regression verification

**Files:**
- No production changes unless a RED test proves a concrete C-scope defect.

- [x] **Step 1: Run FEAT-024-C focused tests**

```powershell
pnpm.cmd build
node --test dist/modules/operations/src/durable-release-acceptance-manifest-store.test.js
```

- [x] **Step 2: Run FEAT-024-A/B affected tests**

```powershell
node --test dist/modules/operations/src/release-candidate-artifact.test.js dist/modules/operations/src/release-evidence-manifest.test.js dist/modules/operations/src/durable-release-acceptance-manifest-store.test.js
```

- [x] **Step 3: Run FEAT-023 readiness affected tests**

Run the existing compiled operational readiness/status test files selected by exact file name; do not broaden until a failure requires it.

- [x] **Step 4: Inspect the focused source diff**

Confirm new public API IDs, authority, lifecycle, deployment behavior, cross-domain store reuse, dependency/lockfile changes and unrelated refactors are all `0`.

---

### Task 5: Final verification, independent review and completion evidence

**Files:**
- Create: `docs/reviews/FEAT024_C_DURABLE_ACCEPTANCE_MANIFEST_IDEMPOTENCY_COMPLETION.md`
- Modify only if actual evidence exists: `docs/implementation/FEAT024_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`

- [x] **Step 1: Run the final repository gates once**

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd verify
pnpm.cmd test
```

Record actual counts. Do not run dependency audit unless separately required and approved.

- [x] **Step 2: Run architecture, security and diff gates**

Use repository-defined architecture checksum and Gitleaks commands discovered from existing reports/scripts. Run `git diff --check`; confirm dependency/lockfile changes `0` and no local database is tracked.

- [x] **Step 3: Perform fresh independent review**

Review atomicity, raw-SQL append-only enforcement, restart authority, replay/conflict, lineage, safe decode/error mapping, REL-001 truth preservation and scope. Require Critical `0`, Important `0`, READY.

- [x] **Step 4: Write completion evidence**

Use actual command output and test assertions only. Register the approved Gap Matrix, plan and completion report with unique document IDs, and update only FEAT-024-C traceability evidence that was implemented and verified.

- [x] **Step 5: Stop before Git closeout**

Confirm `git diff --check` and report the uncommitted bounded change set. Commit, push, main integration and FEAT-024-D remain not performed pending separate Architecture Owner closeout authorization.
