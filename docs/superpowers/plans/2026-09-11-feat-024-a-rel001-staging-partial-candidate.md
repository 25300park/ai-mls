# FEAT-024-A REL-001 Staging Partial Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize a truthful `REL-001` / `Staging` partial candidate containing only the existing API-015 runtime closure while preserving every missing mandatory runtime surface as `INCOMPLETE_RUNTIME_SURFACE` evidence.

**Architecture:** Extract the existing API-015 production composition into `apps/api/src/administration-production-composition.ts` without changing its legacy export surface or behavior. Add one internal artifact/evidence boundary to `modules/operations` under canonical `OPS-007`. It walks the compiled ESM graph from that dedicated API-015 composition root, hashes only runtime-reachable allowed files, derives deterministic identities, and evaluates a separate fixed REL-001 component inventory. It creates no executable entry point, API, authority, persistence, deployment, or registry-status change.

**Tech Stack:** Node.js 24.18.0 built-ins, TypeScript 6, Node test runner.

**Spec:** AO-approved FEAT-024-A1 partial-runtime disposition and its release-candidate/artifact-boundary amendments.

## Global Constraints

- Exact target: `REL-001` / `Staging`.
- `apps/api/src/administration-production-composition.js` is the only included runtime root.
- Missing mandatory surfaces remain visible and force `INCOMPLETE`.
- Gap values are exactly `INCLUDED`, `INCOMPLETE_RUNTIME_SURFACE`, `OUT_OF_SCOPE`.
- SHA-256 identities exclude `generatedAt`.
- Exclude tests, maps, declarations, sources, build metadata, secrets, local state, reports, and unrelated `dist/` output.
- Dependency, lockfile, IMP/REL status, API, authority, deployment, and provider changes are zero.

---

### Task 1: Full release-scope truth

**Files:**
- Create: `modules/operations/src/release-candidate-artifact.test.ts`
- Create: `modules/operations/src/release-candidate-artifact.ts`
- Modify: `modules/operations/src/index.ts`

**Interfaces:**
- Produces `materializeRel001StagingCandidate(input): Promise<Rel001StagingCandidate>`.
- Returns immutable coverage evidence, runtime manifest, and `acceptanceResult: "INCOMPLETE"`.

- [x] Write RED table tests with literal rows for API-015 included; Console, Core, Audit, Jobs, AI incomplete; Publication and Connector out of scope. Mutate omitted rows and false inclusion/executability claims.
- [x] Build/run the focused test; confirm failure because the production module is absent.
- [x] Implement the fixed eight-row contract and fail-closed validation.
- [x] Re-run and confirm GREEN.

### Task 2: Runtime closure and exclusions

**Files:**
- Modify: `modules/operations/src/release-candidate-artifact.test.ts`
- Modify: `modules/operations/src/release-candidate-artifact.ts`

**Interfaces:**
- Consumes `distRoot` and runtime entry point `apps/api/src/administration-production-composition.js`.
- Produces sorted paths and `{ path, fileSize, fileSha256 }` records.

- [x] Write RED tests using a temporary ESM graph: include reachable JS/safe JSON; exclude tests/specs/maps/declarations/tsbuildinfo/source/unrelated files; reject path escape, missing dependency, and secret-bearing runtime config.
- [x] Run and confirm the expected missing-closure failure.
- [x] Implement a bounded walker for relative static import/export and literal dynamic import under `distRoot`; ignore Node/package imports and reject ambiguity.
- [x] Re-run and confirm GREEN.

### Task 2A: Dedicated API-015 artifact root extraction

**Files:**
- Create: `apps/api/src/administration-artifact-root.test.ts`
- Create: `apps/api/src/administration-production-composition.ts`
- Modify: `apps/api/src/composition.ts`
- Modify: `apps/api/src/administration-governance-architecture.test.ts`

- [x] Add a RED compatibility test requiring the dedicated module and the unchanged legacy export identity.
- [x] Move only the existing API-015 production composition declarations into the dedicated module.
- [x] Re-export the unchanged functions and types from `composition.ts`.
- [x] Point source-level architecture assertions at the authoritative dedicated module without weakening their assertions.
- [x] Prove the compiled closure excludes broad `composition.js`, API-014 composition, Core API aggregation, API-016, and API-017.
- [x] Run affected API-015 regression and confirm GREEN.

### Task 3: Deterministic identities

**Files:**
- Modify: `modules/operations/src/release-candidate-artifact.test.ts`
- Modify: `modules/operations/src/release-candidate-artifact.ts`

**Interfaces:**
- Produces `componentFingerprint`, `artifactFingerprint`, `releaseCandidateId`, `candidateFingerprint`.

- [x] Write RED tests proving `generatedAt` does not affect identity, one byte changes identity, and the artifact hash covers included components only.
- [x] Confirm RED.
- [x] Hash ordered `path + fileSha256 + fileSize`, then `REL-001 + Staging + sourceCommitSha + ordered component fingerprints`; derive the non-temporal candidate ID and fingerprint.
- [x] Confirm focused GREEN.

### Task 4: Exact baseline evidence

**Files:**
- Create: `docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json`
- Create: `docs/reviews/FEAT024_A_REL001_STAGING_CANDIDATE_IMPLEMENTATION_REPORT.md`

**Interfaces:**
- Consumes the new source commit containing the approved API-015 root extraction, repository `https://github.com/25300park/ai-mls.git`, branch `codex/feat-024-a-release-candidate`, and its exact `dist/`.

- [x] After the extraction closeout commit exists, build its exact clean output.
- [x] Materialize and serialize the candidate with only API-015 as a runtime component and all required gaps present.
- [x] Report exact fingerprints, `INCOMPLETE`, gaps, validation, limitations, and prerequisites without claiming acceptance or deployment readiness.

### Task 5: Extraction verification and stop

- [x] Run focused candidate tests.
- [x] Run affected API-015 production-composition regression.
- [x] Run lint, typecheck, build, and affected regression using the existing toolchain.
- [x] Run `git diff --check`; confirm dependency/lockfile changes zero, runtime semantics unchanged, and main clean.
- [x] Run the full regression and repository verification gate.
- [x] Validate immutable architecture checksum and Gitleaks.
- [x] Record the extraction closeout evidence and obtain the new source commit SHA.
- [x] Stop after candidate materialization for Architecture Owner completion approval. Do not integrate, push, deploy, accept REL-001, or start FEAT-024-B.
