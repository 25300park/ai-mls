# FEAT-021-E Traceability and Evidence Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the bounded FEAT-021-E traceability and validation evidence for the existing 37-screen contract without adding a screen, backend capability, authority, dependency, or Production behavior.

**Architecture:** Reuse the committed FEAT-021-B/C/D implementation and its existing test surfaces. Run one fresh focused Console gate, one full repository gate, an actual-browser acceptance/security pass, document validation, and a fresh independent review; then record only verified evidence in the existing RTM, Master Index, and one completion report.

**Tech Stack:** Node.js 24.18.0, pnpm 11.9.0 metadata contract, TypeScript 6, Node test runner, vanilla Console HTML/CSS, repository document validators.

**Spec:** `docs/reviews/FEAT021_A_CANONICAL_UI_ACCESSIBILITY_CONTRACT_INVENTORY_REPORT.md` section 14, FEAT-021-E row.

## Global Constraints

- Preserve exactly 37 canonical screens and the 6 UI-ready / 30 dependency-blocked / 1 POST-MVP classification.
- Preserve FEAT-021-B/C/D navigation and accessibility primitives and the WCAG 2.2 AA target.
- Production behavior, API IDs, commands, authority, lifecycle, roles/capabilities, provider/network behavior, dependencies, and lockfile remain unchanged.
- No full WCAG conformance claim; evidence is bounded to committed current routes and recorded dependency gates.
- Stop on any unresolved Critical or Important finding, canonical contradiction, or newly required dependency/backend decision.

---

### Task 1: Fresh current-route verification

**Files:**
- Verify: `apps/admin-console/src/*.test.ts`
- Verify: compiled repository tests under `dist/`

**Interfaces:**
- Consumes: committed FEAT-021-B/C/D renderer, server, adapters, and tests.
- Produces: fresh focused and full-gate counts for the E report.

- [x] Run the seven compiled Console test files and require all current focused tests to pass.
- [x] Run lint, typecheck, clean build, architecture verification, and the full compiled suite exactly once at the final gate.
- [x] Confirm no Production, dependency, or lockfile diff is introduced.

### Task 2: Browser and security acceptance

**Files:**
- Verify: `apps/admin-console/src/main.ts`
- Verify: `apps/admin-console/src/console-renderer.ts`

**Interfaces:**
- Consumes: development-only Session adapter and existing 13-route Console shell.
- Produces: browser route, accessibility-tree, narrow-layout, and unsafe-output evidence.

- [x] Launch the local compiled Console in explicit development mode.
- [x] Visit all 13 committed routes and require a successful safe shell with one main landmark.
- [x] Verify primary navigation, breadcrumb, H1, status semantics, canonical unavailable behavior, keyboard skip target, and bounded narrow reflow.
- [x] Search rendered output for stack, local path, raw provider/evidence, secret/token, and Session detail leakage; require zero findings.

### Task 3: Governance evidence closure

**Files:**
- Modify: `docs/implementation/FEAT021_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Create: `docs/reviews/FEAT021_E_TRACEABILITY_EVIDENCE_CLOSURE_REPORT.md`

**Interfaces:**
- Consumes: verified Tasks 1-2 evidence and FEAT-021-A/B/C/D reports.
- Produces: DOC-REVIEW-126 and final bounded E traceability.

- [x] Add an E closure section that records actual verification and preserves dependency-gated TEST-038/054/055 limits.
- [x] Create the Korean completion report with the required ten repository completion sections, recommendation, risk/limitations, worktree, commit, push, and next-stage boundaries.
- [x] Register DOC-REVIEW-126 and update the DOC-DEV-033 description without changing frozen Feature identity or claiming full WCAG conformance.
- [x] Run Document ID, local-link, diff, architecture checksum/delta, and Gitleaks checks.

### Task 4: Fresh independent review and local closeout

**Files:**
- Review: the complete FEAT-021-E diff and all generated evidence.

**Interfaces:**
- Consumes: Tasks 1-3 outputs.
- Produces: Critical/Important/Minor disposition and one reviewable local commit if all gates pass.

- [x] Review scope, 37-screen preservation, authority/API/dependency isolation, evidence accuracy, accessibility claim boundaries, and document consistency from a fresh pass.
- [x] Require Critical 0 and Important 0; otherwise stop without commit.
- [x] Run final `git diff --check`, create exactly one local FEAT-021-E commit, and confirm the isolated worktree is clean.
- [x] Do not push and do not begin another FEAT-021 phase.
