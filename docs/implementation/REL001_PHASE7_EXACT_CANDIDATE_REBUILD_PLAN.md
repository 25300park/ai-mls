# REL-001 Phase 7 Exact Candidate Rebuild / Reevaluation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Production changes follow RED → minimum GREEN. Commit and push remain prohibited until Architecture Owner review.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-240 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

**Goal:** exact main HEAD `cd620b273c8e7672ffc1e015380ce36d486d9a9a`의 승인된 REL-001/Staging 런타임 closure를 기존 FEAT-024 fingerprint semantics로 재물질화하고, fresh evidence로 acceptance와 promotion handoff를 재평가한다.

**Architecture:** 기존 `release-candidate-artifact` boundary가 과거 API-015 단일 component만 표현하는 결함을 최소 확장한다. 각 승인 component는 compiled entry point에서 도달 가능한 runtime file closure를 정렬하고 기존 `path\0sha256\0size` component fingerprint를 사용한다. artifact fingerprint는 기존 `REL-001`, `Staging`, exact source SHA와 정렬된 `componentId:fingerprint` tuple을 SHA-256으로 묶는다. Candidate identity에는 exact artifact fingerprint와 configuration class가 반영되며 acceptance enum은 변경하지 않는다.

**Truth boundary:** live provider `0/3 NOT_READY`, `DEC-162 IN_REVIEW`, Core API-001/002 `HOLD`, UI-006 `SAFELY_DEFERRED`를 evidence에 유지한다. 이는 artifact inclusion이나 provider-independent readiness로 승격되지 않는다. 미충족 mandatory prerequisite가 있으므로 acceptance는 기존 `INCOMPLETE`, promotion handoff는 `UNAVAILABLE`로 fail closed한다.

**Tech Stack:** Node.js 24, TypeScript 6, built-in `node:test`, existing FEAT-024 release contracts, SHA-256.

## Task 1: Multi-component exact candidate RED

**Files:**
- Modify: `modules/operations/src/release-candidate-artifact.test.ts`
- Modify after RED only: `modules/operations/src/release-candidate-artifact.ts`

- [ ] RED: current main SHA, Staging configuration class, exact authorized component set and independent component fingerprints are not representable by the historical API-015-only materializer.
- [ ] RED: included byte change changes component/artifact/candidate identity; `generatedAt` does not.
- [ ] RED: missing component entry point, duplicate closure ownership or unsafe runtime config fails closed.
- [ ] Implement the minimum extension using the existing hash normalization and closed REL-001 component registry.
- [ ] Preserve immutable candidate/manifest validation and historical acceptance vocabulary.
- [ ] Run focused release-candidate tests to GREEN.

## Task 2: Acceptance and handoff compatibility

**Files:**
- Modify tests only when needed: `modules/operations/src/release-evidence-manifest.test.ts`, `release-evidence-composition.test.ts`, `promotion-handoff-evidence.test.ts`, `release-trace-read-projection.test.ts`
- Modify owning production boundary only when a RED proves stale hard-coded historical candidate identity.

- [ ] RED: current exact candidate cannot be validated/composed because FEAT-024 downstream boundaries pin the historical candidate.
- [ ] Replace mutable/historical identity assumptions with strict recomputation and exact candidate binding; do not weaken acceptance authority, MFA, SoD or lineage.
- [ ] Prove `INCOMPLETE` yields no promotion handoff and old candidate evidence cannot bind to the rebuilt candidate.
- [ ] Run FEAT-024 focused regression.

## Task 3: Clean build and deterministic evidence materialization

**Files:**
- Create generated evidence only in required Phase 7 Markdown documents; do not commit `dist`, database, credentials or local runtime state.

- [ ] Clean-build exact HEAD in the isolated worktree.
- [ ] Materialize the candidate twice with different `generatedAt`; assert stable artifact/releaseCandidate/candidate fingerprints.
- [ ] Record exact runtime closure count, per-component roots/counts/fingerprints, artifact fingerprint and candidate identities.
- [ ] Record dependency closure and exclusions; confirm source maps, declarations, tests, TypeScript source, secrets and local state are excluded.

## Task 4: Fresh acceptance/readiness evidence

**Files:**
- Create: `docs/implementation/REL001_PHASE7_RUNTIME_CLOSURE_INVENTORY.md`
- Create: `docs/implementation/REL001_PHASE7_COMPONENT_FINGERPRINT_MATRIX.md`
- Create: `docs/implementation/REL001_PHASE7_ACCEPTANCE_EVIDENCE_REBUILD.md`
- Create: `docs/implementation/REL001_PHASE7_RELEASE_READINESS_MATRIX.md`
- Create: `docs/implementation/REL001_PHASE7_PROMOTION_HANDOFF_REEVALUATION.md`

- [ ] Run fresh Phase 6, Phase 5, Phase 3 and Phase 2 focused/affected gates.
- [ ] Run full regression once, lint, typecheck, clean build, verify constituents, architecture checksum, Gitleaks and governance validation.
- [ ] Mark dependency audit `NOT_RUN`; no network was authorized.
- [ ] Recompose evidence refs from actual fresh results only.
- [ ] Preserve all external/deferred truth and evaluate acceptance/handoff using existing FEAT-024 semantics.

## Task 5: Traceability, report and review

**Files:**
- Create: `docs/reviews/REL001_PHASE7_COMPLETION_REPORT.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify: `docs/implementation/REL001_PHASE3_API017_TRACEABILITY_MATRIX.md`
- Modify: `docs/implementation/FEAT024_TRACEABILITY_MATRIX.md`

- [ ] Update traceability with actual Phase 7 evidence only.
- [ ] Run link, Document ID, duplicate ID, unresolved-marker, contradiction and `git diff --check` validation.
- [ ] Perform fresh independent review and remediate every Critical/Important finding.
- [ ] Return approval only when all gates pass; otherwise block with exact evidence.
- [ ] Do not commit or push.

## Stop conditions

Stop instead of inventing semantics if implementation requires a new acceptance result, release/deployment authority, provider activation, Core transport behavior, dependency/package, credential or network access.
