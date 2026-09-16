# REL-001 Blocker 1C Exact Candidate Rebuild / Reevaluation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Candidate changes follow RED → minimum GREEN. Commit and push remain prohibited until Architecture Owner review.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-254 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

**Goal:** exact main HEAD `97a3522fb301fea197d3fa2defc7bc2826c2d719`의 REL-001/Staging runtime closure를 기존 FEAT-024 알고리즘으로 재물질화하고 Core API-001/002 transport blocker를 candidate-bound evidence로 재평가한다.

**Architecture:** `release-candidate-artifact`의 exact-SHA별 closed definition을 versioned registry로 유지한다. Historical Phase 7 SHA `cd620b...`의 18 roots, coverage, fingerprints와 candidate IDs는 변경하지 않는다. 새 `97a3522...` definition은 동일한 18 roots에 실제 shared API-001/002 composition root를 하나 추가하고 `CORE_API_001_002_PUBLIC_TRANSPORT` coverage만 `INCLUDED`로 전환한다. Component, artifact, release candidate, candidate fingerprint 계산식은 기존 SHA-256 serialization을 그대로 사용한다.

**Tech Stack:** Node.js 24, TypeScript 6, built-in `node:test`, SQLite durable acceptance store, existing FEAT-024 release contracts and SHA-256.

## Global constraints

- Historical Phase 7 candidate와 manifest IDs/fingerprints를 수정하지 않는다.
- Acceptance vocabulary는 `ACCEPTED / REJECTED / INCOMPLETE`만 사용한다.
- Live provider는 `0/3 NOT_READY`, `DEC-162 IN_REVIEW`, dependency audit는 `NOT_RUN`을 유지한다.
- UI-006은 실제 new transport wiring 증거가 없으면 `STILL_DEFERRED`로 유지한다.
- API-003~010, provider/network, deployment, dependency/package 변경은 0이다.
- Commit과 push는 승인 전 수행하지 않는다.

---

### Task 1: Exact definition RED and historical immutability

**Files:**
- Modify: `modules/operations/src/release-candidate-artifact.test.ts`
- Modify after RED: `modules/operations/src/release-candidate-artifact.ts`

**Interfaces:**
- Consumes: `materializeRel001StagingCandidate(Rel001StagingCandidateInput)` and existing FEAT-024 hash normalization.
- Produces: a closed `97a3522...` candidate definition while preserving the exact `cd620b...` definition.

- [ ] Add a test that materializes source `97a3522...` and expects 19 component roots including `CORE_API_001_002_HTTP`, closed Core coverage, two remaining runtime gaps and `INCOMPLETE`.
- [ ] Run the focused test and confirm RED because current non-Phase7 SHA falls back to legacy API-015-only closure.
- [ ] Add `CORE_API_001_002_HTTP` to the internal component ID union and add a new exact-SHA definition with root `apps/api/src/core-identity-authorization-composition.js`.
- [ ] Preserve the historical Phase 7 definition byte-for-byte and add assertions for its 18 roots and three historical gaps.
- [ ] Run candidate tests and confirm GREEN.

### Task 2: Current exact persistence and candidate isolation

**Files:**
- Modify: `modules/operations/src/durable-release-acceptance-manifest-store.test.ts`
- Test: `modules/operations/src/release-evidence-composition.test.ts`
- Test: `modules/operations/src/promotion-handoff-evidence.test.ts`

**Interfaces:**
- Consumes: rebuilt current candidate and existing manifest/composition/handoff factories.
- Produces: current-candidate durable replay evidence without altering the historical Phase 7 record.

- [ ] Add a current-candidate append/reopen test bound to `97a3522...` and assert a new exact candidate identity.
- [ ] Preserve the historical Phase 7 closed definition and immutable recorded identities; do not falsely rematerialize the old source SHA from current runtime bytes.
- [ ] Prove historical evidence cannot bind to the new candidate and exact replay creates no duplicate durable row.
- [ ] Prove `INCOMPLETE` current acceptance produces promotion handoff `UNAVAILABLE`.
- [ ] Run release/acceptance focused tests to GREEN.

### Task 3: Deterministic exact artifact materialization

**Files:**
- Create: `docs/implementation/REL001_BLOCKER1C_RUNTIME_CLOSURE_INVENTORY.md`
- Create: `docs/implementation/REL001_BLOCKER1C_COMPONENT_FINGERPRINT_MATRIX.md`

**Interfaces:**
- Consumes: clean `dist` compiled from exact source `97a3522...` and `materializeRel001StagingCandidate()`.
- Produces: exact closure counts, per-component SHA-256 values, artifact fingerprint, releaseCandidateId and candidateFingerprint.

- [ ] Clean-build the exact baseline before evidence-only changes affect any reachable runtime file.
- [ ] Materialize twice with distinct `generatedAt`; assert identical artifact/candidate identities.
- [ ] Record sorted component roots, entry points, file counts, fingerprints and unique closure paths.
- [ ] Confirm one included byte change changes identities and all excluded classes remain absent.

### Task 4: Acceptance and blocker reevaluation

**Files:**
- Create: `docs/implementation/REL001_BLOCKER1C_ACCEPTANCE_REEVALUATION.md`
- Create: `docs/implementation/REL001_BLOCKER1C_BLOCKER_DISPOSITION.md`

**Interfaces:**
- Consumes: exact candidate identity plus fresh Blocker 1/Phase 5/Phase 6/release evidence.
- Produces: existing-enum acceptance and promotion-handoff disposition.

- [ ] Bind every fresh evidence reference to the new candidate ID/fingerprint and `Staging`.
- [ ] Mark Core API-001/002 transport `CLOSED` only after focused bounds, ingress and no-expansion tests pass.
- [ ] Classify UI-006 independently as `READY_FOR_ACTIVATION` or `STILL_DEFERRED` from actual wiring evidence.
- [ ] Preserve live provider and dependency audit blockers; report blocker count `3` only if Core closure passes.
- [ ] Evaluate acceptance as `INCOMPLETE` and handoff as `UNAVAILABLE` using existing FEAT-024 semantics.

### Task 5: Fresh verification, traceability and report

**Files:**
- Create: `docs/reviews/REL001_BLOCKER1C_COMPLETION_REPORT.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/implementation/FEAT024_TRACEABILITY_MATRIX.md`

**Interfaces:**
- Consumes: actual command results and exact candidate values only.
- Produces: Blocker 1C completion evidence without historical rewrites.

- [ ] Run Blocker 1B, candidate identity, Phase 7, Phase 6 and Phase 5 focused/affected tests.
- [ ] Run sequential full regression, changed/full lint as environment permits, typecheck, clean build and verify constituents.
- [ ] Run architecture checksum, Gitleaks, document/link/ID validation and `git diff --check`.
- [ ] Perform fresh independent review and resolve all Critical/Important findings.
- [ ] Record dependency audit as `NOT_RUN`; do not access the network.
- [ ] Return approval only when the new exact candidate is stable and full regression is GREEN; otherwise return the exact blocking evidence.

## Self-review

- Spec coverage: exact baseline, historical immutability, runtime closure, fingerprints, acceptance, handoff, blocker disposition and all required documents are mapped above.
- Unresolved-marker scan: no unresolved marker or default value is used.
- Type consistency: existing `Rel001StagingCandidate`, `RuntimeArtifactManifest`, acceptance manifest and promotion handoff contracts remain authoritative.

Related: [Historical Phase 7 Plan](REL001_PHASE7_EXACT_CANDIDATE_REBUILD_PLAN.md), [Blocker 1B Traceability](REL001_BLOCKER1_CORE_API001002_TRACEABILITY.md), [FEAT-024 Traceability](FEAT024_TRACEABILITY_MATRIX.md).
