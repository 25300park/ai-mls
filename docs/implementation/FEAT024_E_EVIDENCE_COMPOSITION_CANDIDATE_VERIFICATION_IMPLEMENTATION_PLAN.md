# FEAT-024-E Evidence Composition / Candidate-Bound Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-046 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Development Owner / Release Owner |
| 기준일 | 2026-09-12 |

**Goal:** REL-001 / Staging의 authoritative evidence를 exact candidate와 environment에 결합하고, missing/blocking evidence와 five runtime gaps를 숨기지 않는 deterministic read-only composition을 제공한다.

**Architecture:** Operations module에 단일 pure composition boundary를 추가한다. 이 경계는 기존 FEAT-024-A candidate contract와 FEAT-024-B evidence/readiness DTO를 재사용하며, trusted upstream에서 받은 bounded evidence를 다시 strict-validate한다. 결과는 immutable safe DTO이고 persistence, acceptance authority, deployment 또는 external network를 호출하지 않는다.

**Tech Stack:** Node.js 24.18.0, TypeScript, `node:test`, existing Operations contracts and SHA-256 canonical serialization helper.

**Spec:** [Approved FEAT-024-E Gap Matrix](../reviews/FEAT024_E_EVIDENCE_COMPOSITION_CANDIDATE_VERIFICATION_GAP_MATRIX.md)

## Global Constraints

- REL-001 / Staging exact identity and five `INCOMPLETE_RUNTIME_SURFACE` gaps remain unchanged.
- Historical or unbound PASS evidence cannot satisfy a mandatory requirement.
- `UNKNOWN` readiness never becomes `READY`; stale evidence never satisfies.
- Evidence/reference DTOs expose no secrets, PII, raw payload, prompt, chain-of-thought, stack, SQL or filesystem path.
- Acceptance authority, deployment, persistence, API, registry status and dependencies remain unchanged.
- Dependency audit is not executed without explicit FEAT-024-E network approval.

---

### Task 1: RED contract and candidate-binding tests

**Files:**
- Create: `modules/operations/src/release-evidence-composition.test.ts`
- Create after RED: `modules/operations/src/release-evidence-composition.ts`
- Modify after GREEN: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: `CanonicalReleaseCandidate`, bounded authoritative evidence observations and existing `ReleaseReadinessRef` values.
- Produces: immutable `ReleaseEvidenceComposition` with deterministic fingerprint, exact candidate identity, safe evidence refs and explicit satisfied/missing/blocking/not-applicable requirement sets.

- [x] **Step 1: Write RED tests** for missing evidence, historical unbound pass, wrong candidate, wrong environment, stale evidence, `UNKNOWN`/`NOT_READY` readiness, unsafe references, acceptance-authority bypass, deterministic ordering and all five runtime gaps.
- [x] **Step 2: Run the focused test** and confirm RED because the composition boundary is absent.
- [x] **Step 3: Implement the strict minimum factory** with closed requirement IDs, exact binding checks, safe immutable reconstruction and deterministic sorting/fingerprint.
- [x] **Step 4: Keep the boundary internal to the Operations module, require its injected read-only resolver entry point, and run the focused test to GREEN.**

### Task 2: Positive matrix and regression preservation

**Files:**
- Modify: `modules/operations/src/release-evidence-composition.test.ts`
- Modify only if RED proves necessary: `modules/operations/src/release-evidence-composition.ts`

**Interfaces:**
- Guarantees: exact fresh evidence is accepted; evaluated timestamp changes do not alter logical fingerprint; evidence byte or result changes do; no evidence can change REL-001 from `INCOMPLETE`.

- [x] **Step 1: Add the positive exact-bound evidence matrix** and deterministic fingerprint tests.
- [x] **Step 2: Add readiness truth and unsafe nested value regression cases.**
- [x] **Step 3: Run FEAT-024-E focused tests and FEAT-024-A/B/C/D affected regression.**
- [x] **Step 4: Inspect the focused diff and refactor only if required for correctness.**

### Task 3: Completion verification and evidence

**Files:**
- Create: `docs/reviews/FEAT024_E_EVIDENCE_COMPOSITION_CANDIDATE_VERIFICATION_COMPLETION.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify FEAT-024 traceability only where an existing bounded row requires actual E evidence.

**Interfaces:**
- Produces: actual verification results and final recommendation without starting FEAT-024-F or changing REL-001 disposition.

- [x] **Step 1: Run focused, affected and full regression once at the final gate.**
- [x] **Step 2: Run lint, typecheck, build, verify, architecture checksum, `git diff --check` and Gitleaks.**
- [x] **Step 3: Stop for explicit FEAT-024-E authorization if dependency audit is required.** No audit was run; missing audit remains truthful `INCOMPLETE` evidence.
- [x] **Step 4: Perform fresh independent review and require Critical 0 / Important 0.**
- [x] **Step 5: Write the completion report and bounded Master Index evidence with actual results only.** No FEAT-024 RTM exists to update.
- [x] **Step 6: Stop before commit unless separately authorized.**

## Self-review

- The plan reuses FEAT-024-A/B contracts and creates no parallel persistence or authority path.
- The candidate result remains `INCOMPLETE` regardless of positive component evidence.
- The first implementation action is an expected RED test, not production code.
