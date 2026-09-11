# FEAT-024-C Durable Acceptance Manifest / Idempotency Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-146 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Architecture Owner / Release Owner |
| Baseline | `82e687c196d0a2d7f7df2c58e881da5429032f00` |
| Branch | `codex/feat-024-c-durable-acceptance-manifest` |
| Production changes | `0` |

## 1. Objective

FEAT-024-B의 immutable acceptance manifest contract를 변경하지 않고, candidate, manifest, replay binding 및 evidence linkage를 restart-safe하고 append-only한 하나의 bounded SQLite transaction 경계에 저장하기 위한 현재 gap을 식별한다. 이 문서는 durable persistence 설계 전 검토 근거이며 acceptance authority, deployment authority, public API 또는 새로운 release lifecycle을 추가하지 않는다.

## 2. Sources inspected

- Architecture Owner-authorized FEAT-024-C Brief
- [FEAT-024-B Contract Gap Matrix](FEAT024_B_RELEASE_EVIDENCE_MANIFEST_CONTRACT_GAP_MATRIX.md)
- [FEAT-024-B Completion](FEAT024_B_RELEASE_EVIDENCE_MANIFEST_CONTRACTS_COMPLETION.md)
- `modules/operations/src/release-candidate-artifact.ts:30-128`
- `modules/operations/src/release-evidence-manifest.ts:1-319`
- `modules/operations/src/durable-operational-evidence-store.ts:97-228,941-1059`
- `modules/ai/src/advisory-durable-persistence.ts:1-141,184-217`

## 3. Existing durable boundary inventory

| Existing boundary | What it already proves | Why it cannot own FEAT-024-C state directly | Disposition |
|---|---|---|---|
| `DurableOperationalEvidenceStore` | File-backed `node:sqlite`, WAL/FULL durability, integrity checks, append-only triggers, scoped operational/readiness projections | Its schema and interfaces are intentionally limited to telemetry, operational status, alerts and readiness. Release candidate/manifest/idempotency rows have different identity, lineage and transaction invariants. Extending this store would mix operational observation truth with release acceptance evidence ownership. | Reuse implementation conventions only; do not add FEAT-024 tables or APIs to this store |
| `DurableAdvisoryStore` | Atomic record + idempotency insert, restart replay, immutable identity checks, fail-closed stored-state validation | AI prompt/advisory ownership and tenant/scope keys are not release candidate identity. Reuse would create cross-feature authority coupling. | Reuse transaction, canonical serialization and integrity-validation pattern only |
| `release-evidence-manifest.ts` | Strict immutable contract, candidate binding, deterministic manifest fingerprint/ID, pure `REPLAY | NEW | CONFLICT` classification | No file-backed state, transaction, lineage validation against stored history, restart behavior or database-level append-only enforcement | Preserve contract unchanged; durable adapter validates all decoded and proposed values through it |
| Process-local maps | None authoritative for FEAT-024 | Lost on restart and explicitly prohibited as authority | No production role; test fixture use only if required |

## 4. Gap matrix

| Item | Current evidence | Required FEAT-024-C behavior | Gap | Bounded design disposition |
|---|---|---|---|---|
| Durable candidate record | Candidate is generated deterministically by FEAT-024-A | Candidate binding survives close/reopen | No persisted candidate record | Add append-only `release_candidates` row containing exact candidate identity, generated/created provenance and validated bounded payload |
| Durable manifest record | FEAT-024-B produces an immutable in-memory object | Manifest survives close/reopen | No persisted manifest | Add append-only `release_acceptance_manifests` row keyed by `acceptance_manifest_id` and bound to candidate/fingerprint/result/predecessor |
| Candidate identity conflict | Factory validates one candidate object | Existing `releaseCandidateId` cannot be rebound to different commit/repository/branch/artifact/environment/fingerprint | No database uniqueness/conflict check | Compare canonical stored candidate content before insert; mismatch fails with bounded candidate conflict and writes zero rows |
| Manifest identity conflict | Pure validator/classifier exists | Same manifest ID with different canonical content must fail closed | No durable enforcement | Primary key plus canonical content comparison; never use replace/upsert/update |
| Replay identity | Pure classifier can identify equal manifests | Exact candidate ID + manifest fingerprint replay returns prior authoritative record after restart | No durable replay index | Persist one append-only replay binding keyed by candidate ID + manifest fingerprint and foreign-keyed to the stored manifest |
| Duplicate append | Pure `REPLAY` result only | Exact replay creates zero duplicate candidate/manifest/index/link rows | No row-count guarantee | Lookup replay before transaction and repeat inside `BEGIN IMMEDIATE`; return decoded stored manifest |
| Conflicting replay | Pure classifier detects content mismatch | Same durable identity with conflicting input rejects deterministically | No restart-safe conflict authority | Persisted canonical rows/index are authoritative; conflict writes and mutations remain zero |
| Evidence linkage | Evidence refs are nested immutable manifest values | Decision/evidence references are durable and candidate-bound | Only serialized nested values | Store bounded append-only link rows for each validated evidence/readiness reference; no raw source payload |
| Evidence change | New evidence changes the B fingerprint/ID | New manifest append; previous record unchanged | No history store | Require new row; permit optional `previousManifestId` only when it names the same candidate and is not cyclic |
| Previous linkage | Field is syntax-validated only | Same-candidate predecessor, no cross-candidate link, no cycles | No stored-graph validation | Foreign key predecessor to manifest plus application validation of same candidate and ancestry before insert |
| Append-only enforcement | Deep-freeze protects returned JS objects | Normal and raw SQL update/delete cannot alter history | No physical enforcement | `BEFORE UPDATE` and `BEFORE DELETE` abort triggers on every FEAT-024-C table; no update/delete method |
| Atomicity | No C transaction exists | Candidate + manifest + replay binding + evidence/readiness links commit together | Missing | One `BEGIN IMMEDIATE` transaction; injected test failure and all SQLite errors roll back the entire append |
| Restart/recovery | None | Committed rows survive reopen; rolled-back/partial rows are absent | Missing | File-only database path, WAL, `synchronous=FULL`, foreign keys, integrity/foreign-key checks and stored-state validation on open |
| Timestamp identity | B excludes `evaluatedAt`/`acceptedAt` from logical fingerprint | Timestamp-only change must not create a second logical manifest | Persistence could accidentally key on payload/timestamps | Replay index uses B manifest fingerprint; timestamps are stored provenance but never persistence identity |
| Deterministic history | No history query | Stable append chronology and immutable lineage | Missing | Bounded `listManifestHistory(releaseCandidateId)` ordered by `created_at`, then manifest ID as deterministic tie-breaker; immutable return values |
| Safe read | B validator returns safe immutable object | Find candidate, find manifest/replay and list candidate history without public API | Missing | Internal store methods only; decode, exact-key validate, reconstruct and deep-freeze before return |
| Tenant/scope binding | FEAT-024 candidate contract has no tenant/scope fields | Do not invent fields while preventing cross-candidate/release/environment rebinding | Adding tenant would change canonical contract | Use exact logical release, candidate and environment binding. Tenant/scope stays with authoritative source evidence outside this store |
| Current REL-001 truth | Candidate is `INCOMPLETE` with five mandatory runtime gaps | Persistence must not elevate it | No durable guard yet | Revalidate through existing A/B factories on append and reopen; current candidate can persist only an `INCOMPLETE` manifest |
| Acceptance authority | B stores nullable provenance but grants no authority | C must not decide whether actor may accept | Risk of conflating persistence with authority | Store only already-validated B contract; executable authorization and SoD remain FEAT-024-D |
| Unsafe data | B rejects unsafe bounded fields | Raw scanner/log/provider/prompt/CoT/secret/PII/SQL/path content must never be persisted | Generic JSON could bypass validation | Serialize only validated candidate/manifest DTOs and normalized link scalars; reopen validation rejects malformed/unsafe stored rows |
| Production composition | No FEAT-024 production store exists | Explicit durable configuration when this internal boundary is composed | Missing | Constructor requires a non-memory file path; no implicit in-memory production fallback. Public runtime/API composition remains out of scope |

## 5. Persistence options

| Option | Assessment |
|---|---|
| A. Add release tables to `DurableOperationalEvidenceStore` | Rejected. It reduces file count but combines operational observation ownership with release candidate/acceptance history and expands an already broad store API. |
| B. Add one bounded `DurableReleaseAcceptanceManifestStore` in `modules/operations` | **Recommended.** It preserves the B contract and module ownership, uses existing SQLite conventions, keeps one FEAT-024 persistence boundary, and avoids a generic audit/deployment subsystem. |
| C. Reuse Administration/Advisory durable storage | Rejected. Their identities, authorization ownership and schemas are unrelated; reuse would create a duplicate or cross-domain authority path. |

## 6. Recommended bounded schema and transaction

One file-backed SQLite database owned by `DurableReleaseAcceptanceManifestStore` contains only:

1. `release_candidates` — immutable candidate identity and bounded validated payload.
2. `release_acceptance_manifests` — immutable manifest identity, result/provenance, predecessor and bounded validated payload.
3. `release_manifest_replay` — immutable `(release_candidate_id, manifest_fingerprint) -> acceptance_manifest_id` binding.
4. `release_manifest_evidence_links` — immutable normalized evidence/readiness reference linkage and deterministic sequence.

All four tables receive update/delete rejection triggers. Identity rows also reject replacement. A first append performs candidate validation, manifest validation and lineage checks before starting the transaction, repeats authoritative identity checks inside `BEGIN IMMEDIATE`, inserts all absent rows, and commits once. Any failure rolls back all rows. Exact replay returns the existing decoded manifest and inserts nothing.

`createdAt` is caller-supplied transaction provenance validated as an ISO timestamp. It is stored but excluded from candidate, manifest and replay identity. `generatedAt`, `evaluatedAt` and `acceptedAt` retain their existing provenance meanings and likewise cannot create replay identity.

## 7. Proposed internal interface

```text
append(candidate, manifest, createdAt) -> ReleaseAcceptanceManifest
findCandidate(releaseCandidateId) -> Rel001StagingCandidate | undefined
findManifest(acceptanceManifestId) -> ReleaseAcceptanceManifest | undefined
findReplay(releaseCandidateId, manifestFingerprint) -> ReleaseAcceptanceManifest | undefined
listManifestHistory(releaseCandidateId) -> readonly ReleaseAcceptanceManifest[]
close() -> void
```

The interface is internal and read/persist only. It exposes no acceptance, deployment, promotion, mutation, delete or public HTTP operation.

## 8. Required RED evidence mapping

| RED case | Expected initial reason | Expected GREEN invariant |
|---|---|---|
| duplicate manifest append | no durable store/replay | prior manifest returned; duplicate rows `0` |
| close/reopen replay | process has no durable authority | same authoritative manifest returned |
| candidate ID rebound | no persisted candidate binding | deterministic candidate conflict; writes `0` |
| same manifest ID, different content | no stored identity check | deterministic manifest conflict; writes `0` |
| evidence change | no append history | new manifest appended; prior immutable |
| transaction failure | no atomic C transaction | all candidate/manifest/replay/link rows rolled back |
| acceptedAt-only replay | timestamp may be mistaken for identity | prior logical result returned; duplicate rows `0` |
| cross-candidate predecessor | no stored lineage validation | fail closed; writes `0` |
| lineage cycle | no ancestry validation | fail closed; writes `0` |
| unsafe raw evidence | generic persistence could bypass B | validation rejects before write |
| current incomplete candidate elevation | no C reopen/append guard | `ACCEPTED` persistence rejected; writes `0` |
| process-local map override | no durable authority | database state wins after reopen |

## 9. Current REL-001 / Staging binding

| Field | Required value |
|---|---|
| `logicalReleaseId` | `REL-001` |
| `targetEnvironment` | `Staging` |
| `sourceCommitSha` | `ddc1604cae78ca3493c27a7add23446970e485ae` |
| `artifactFingerprint` | `a5de42d389b2aec27b4dd2a6362f442afced8414a7050c170f980fa4727547cd` |
| `releaseCandidateId` | `1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1` |
| `candidateFingerprint` | `001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d` |
| Persistable acceptance result at current evidence state | `INCOMPLETE` |

## 10. Design gate

Approved design: one bounded `DurableReleaseAcceptanceManifestStore` under the existing Operations module, using Node.js built-in `node:sqlite`, exact A/B validation, four append-only partitions and one atomic transaction. The Architecture Owner approved this design for TDD implementation; FEAT-024-D authority/SoD and deployment execution remain outside scope.
