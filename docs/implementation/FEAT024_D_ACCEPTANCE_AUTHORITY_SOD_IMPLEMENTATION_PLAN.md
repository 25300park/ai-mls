# FEAT-024-D Acceptance Authority / SoD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-045 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Development Owner / Release Owner |
| 기준일 | 2026-09-11 |

**Goal:** FEAT-024 release acceptance를 trusted Session actor, live `RELEASE_OWNER` assignment, `release.accept`, MFA와 exact SoD로 보호하고 기존 durable manifest store에만 위임한다.

**Architecture:** Existing AuthorizationService에 한 role/action을 최소 확장하고, Operations module의 단일 internal `ReleaseAcceptanceAuthorityService`가 read-only resolver로 trusted Session과 candidate/provenance를 resolve한다. 서비스는 Session, authorization과 candidate/evidence binding을 persistence 직전에 다시 검사하며, FEAT-024-C store 외의 persistence 또는 deployment boundary를 호출하지 않는다.

**Tech Stack:** Node.js 24.18.0, TypeScript, `node:test`, existing AuthorizationService, existing FEAT-024-B contract and FEAT-024-C SQLite store.

**Spec:** [Approved FEAT-024-D Gap Matrix](../reviews/FEAT024_D_ACCEPTANCE_AUTHORITY_SOD_GAP_MATRIX.md)

## Global Constraints

- Add exactly `RELEASE_OWNER` and `release.accept`; do not grant any other authority.
- `release.accept` is live-authorized, human-only, MFA-required and reason/audit-bearing.
- Ignore caller-authored actor, role, capability and producer identity.
- Preserve current REL-001 as `INCOMPLETE`.
- Reuse FEAT-024-C persistence; no new persistence subsystem.
- Deployment, promotion, rollback and external calls remain zero.
- No dependencies, public API, lifecycle state or IMP status changes.

---

### Task 1: Canonical role and authorization action

**Files:**
- Modify: `packages/security-contracts/src/index.ts`
- Modify: `modules/authorization/src/authorization-service.ts`
- Test: `modules/authorization/src/authorization-service.test.ts`
- Modify: `docs/book-8/04_PERMISSION_MATRIX.md`
- Modify: `docs/00_SECURITY_REGISTRY.md`

**Interfaces:**
- Produces: `RoleCode` value `RELEASE_OWNER` and AuthorizationService action `release.accept`.
- Guarantees: no existing role gains the capability; service principals, inactive assignments and non-MFA Sessions are denied.

- [x] **Step 1: Write RED tests** asserting `ADM`, `SEC`, `OPS`, `REV` and service identities cannot perform `release.accept`, while a live scoped `RELEASE_OWNER` requires MFA.
- [x] **Step 2: Run the focused authorization test** and confirm failure because `RELEASE_OWNER`/`release.accept` are absent.
- [x] **Step 3: Add `RELEASE_OWNER`, its sole capability, and privileged/human action registration** without changing existing role meanings.
- [x] **Step 4: Run the focused authorization test** and require PASS.
- [x] **Step 5: Update the Permission Matrix and Security Registry** with the narrowly approved role/action/MFA/prohibition evidence.

### Task 2: Trusted provenance and authority service

**Files:**
- Create: `modules/operations/src/release-acceptance-authority-service.ts`
- Create: `modules/operations/src/release-acceptance-authority-service.test.ts`
- Modify: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: `AuthorizationService.evaluate`, a read-only trusted candidate/provenance resolver, `createReleaseAcceptanceManifest`, and an append-only manifest store port compatible with `DurableReleaseAcceptanceManifestStore.append`.
- Produces: `ReleaseAcceptanceAuthorityService.decide(request)` returning the persisted/replayed immutable manifest or a bounded fail-closed error.

- [x] **Step 1: Write RED tests** for trusted Session actor derivation, body actor rejection, caller producer bypass rejection, producer/accepter conflict, implementation-author conflict, revoked authority, missing MFA, reviewer-only authority and zero persistence on denial.
- [x] **Step 2: Run the focused service test** and confirm failure because the service is absent.
- [x] **Step 3: Implement the minimal service** so it resolves candidate/provenance internally, evaluates `release.accept`, enforces SoD and rechecks live authority/binding immediately before append.
- [x] **Step 4: Run the focused service tests** and require PASS.

### Task 3: Acceptance truth, replay and side-effect containment

**Files:**
- Modify: `modules/operations/src/release-acceptance-authority-service.test.ts`
- Modify only if a RED test proves necessary: `modules/operations/src/release-acceptance-authority-service.ts`

**Interfaces:**
- Guarantees: current REL-001 stays `INCOMPLETE`, exact replay is idempotent, stale candidate/evidence fails closed, independent review is evidence only, and deployment calls remain zero.

- [x] **Step 1: Add RED tests** for REL-001 false acceptance, stale binding, exact replay, no deployment side effect and test-only eligible acceptance evaluation.
- [x] **Step 2: Confirm each RED fails for the missing invariant rather than fixture/setup error.**
- [x] **Step 3: Add only the minimum production correction proven by RED.**
- [x] **Step 4: Run FEAT-024-D focused tests and FEAT-024-A/B/C regression** and require PASS.

### Task 4: Verification and evidence closure

**Files:**
- Create: `docs/reviews/FEAT024_D_ACCEPTANCE_AUTHORITY_SOD_COMPLETION.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Modify bounded FEAT-024 traceability evidence only if the repository already contains the relevant RTM row.

**Interfaces:**
- Produces: actual verification evidence and final recommendation without starting FEAT-024-E.

- [x] **Step 1: Run authorization, MFA, SoD, stale decision, provenance and A/B/C/C-store focused gates.**
- [x] **Step 2: Run FEAT-023 affected regression and the full suite once.**
- [x] **Step 3: Run lint, typecheck, build, verify, architecture checksum, `git diff --check` and Gitleaks.**
- [x] **Step 4: Perform an independent review** and require Critical 0 / Important 0.
- [x] **Step 5: Write the completion report and bounded index/traceability updates** using actual evidence only.
- [x] **Step 6: Re-run documentation-sensitive checks, inspect the focused diff, and stop before commit unless separately authorized.**

## Self-review

- Spec coverage: role/capability, trusted actor, MFA, producer/author/deployment SoD, review evidence, current REL-001 truth, replay and zero deployment side effects are each mapped to a task.
- Placeholder scan: no deferred implementation placeholder is present; `NOT_EVALUABLE` is the approved runtime outcome for absent authoritative author provenance.
- Type consistency: the service uses existing SessionContext, AuthorizationService and durable-store append semantics; no parallel persistence or public API is introduced.
