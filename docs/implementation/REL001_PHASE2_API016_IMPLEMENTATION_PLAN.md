# REL-001 Phase 2 API-016 Durable Audit Runtime Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-107 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security/Governance Owner / Audit Owner |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development after every canonical prerequisite in Task 0 is approved. Do not write Production code while Task 0 is blocked.

**Goal:** Materialize Phase 1G durable audit intents into durable append-only API-016 Audit Events without changing Core ownership or adding public transport.

**Architecture:** An API-016-owned materializer will consume intents through owner-bounded read ports and write final events to one API-016 durable SQLite store. The in-process Staging composition will invoke the materializer without HTTP or API-017 job semantics. This architecture is conditional on explicit approval of the field mapping and trusted provenance rules identified in the Gap Matrix.

**Tech Stack:** Node.js 24.18.0, TypeScript 6.0.3, built-in `node:sqlite`, `node:test`, pnpm 11.9.0; no new dependency.

**Spec:** [Phase 2 API-016 Runtime Gap Matrix](REL001_PHASE2_API016_RUNTIME_GAP_MATRIX.md), [Phase 2A Canonical Closure Report](../reviews/REL001_PHASE2A_API016_CANONICAL_CLOSURE_REPORT.md), [Phase 2B Enriched Intent Contract](REL001_PHASE2B_VERSIONED_ENRICHED_INTENT_CONTRACT.md)

## Global Constraints

- API-016 remains the sole final Audit Event owner.
- Core stores remain immutable audit-intent producers only.
- No new public API, transport, role, capability, API-017 lifecycle, distributed transaction, external service or dependency.
- Tenant/scope visibility and safe-content validation fail closed.
- The plan is `BLOCKED_BEFORE_TDD` until Task 0 decisions are approved.

---

### Task 0: Close canonical materialization prerequisites

**Files:**
- Amend only through separately approved canonical governance artifacts.
- Reassess: `docs/implementation/REL001_PHASE2_API016_RUNTIME_GAP_MATRIX.md`

**Required decisions:**

1. Approve exact intent-to-event mapping for all required `AppendAuditEvent` fields and all seven sources.
2. Approve immutable trusted principal/provenance binding where current intent contains only `actorId`.
3. Approve the exact source of purpose, policy version, data classification, decision and outcome for every mutation class.

Phase 2A resolved the representation of intent identity/chronology, tenant/scope visibility, internal reader and in-process Staging lifecycle/configuration. Those decisions do not authorize defaults for the three remaining groups.

**Exit criterion:** Every mapping/provenance/context row has explicit owner-approved evidence. Until then, Tasks 1–5 must not start.

### Task 1: RED — durable final-event store invariants

**Planned files after Task 0 approval:**
- Create: `modules/audit/src/durable-audit-event-store.test.ts`
- Create: `modules/audit/src/durable-audit-event-store.ts`

**Test cycle:**

1. Write failing tests for restart survival, insert-only history, duplicate intent replay and conflicting same-intent content.
2. Run the focused compiled test and verify failure is caused by the missing store.
3. Implement the minimum SQLite adapter with explicit database path, unique materialization identity and update/delete rejection.
4. Rerun focused tests to GREEN.

### Task 2: RED — intent materialization mapping and safety

**Planned files after Task 0 approval:**
- Create: `modules/audit/src/audit-intent-materializer.test.ts`
- Create: `modules/audit/src/audit-intent-materializer.ts`
- Modify: `modules/audit/src/index.ts`

**Test cycle:**

1. Write failing tests for intent→event mapping, trusted provenance, committed chronology, tenant/scope binding and safe evidence references.
2. Add negative tests for caller override, unsafe raw payload, conflicting replay and final-event mutation.
3. Verify all tests fail for the missing materializer.
4. Implement only the approved mapping and reconstruct a new immutable event payload; never persist raw intent objects.
5. Rerun focused tests to GREEN.

### Task 3: RED — recoverable source consumption

**Planned files after Task 0 approval:**
- Create: `modules/audit/src/audit-intent-source-port.ts`
- Create: `modules/audit/src/audit-intent-consumption.test.ts`

**Test cycle:**

1. Write failing tests proving materialization failure leaves source intent intact and exact replay creates no duplicate.
2. Test all seven owner-bounded source adapters through the approved read-port composition.
3. Implement the minimum in-process source adapter without worker lease/retry state.
4. Rerun focused and Phase 1G regression tests.

### Task 4: RED — Staging API-016 composition

**Planned files after Task 0 approval:**
- Create: `apps/api/src/api016-production-composition.test.ts`
- Create: `apps/api/src/api016-production-composition.ts`
- Modify: `apps/api/src/index.ts`

**Test cycle:**

1. Write failing tests for missing-database fail-closed startup, durable selection, process restart and absence of HTTP/API-017 expansion.
2. Implement the minimum in-process composition for `STAGING_API016_AUDIT_RUNTIME`.
3. Verify health/readiness and close behavior using only the approved component contract.
4. Rerun API-016 and Staging composition tests.

### Task 5: Verification and evidence

**Files:**
- Update: `docs/implementation/REL001_PHASE2_API016_TRACEABILITY_MATRIX.md`
- Update: `docs/reviews/REL001_PHASE2_API016_COMPLETION_REPORT.md`
- Update: `docs/00_MASTER_INDEX.md`

**Steps:**

1. Run focused materialization, idempotency, restart, tenant/scope, append-only and security tests.
2. Run Phase 1G, Phase 1D, FEAT-024 and FEAT-023 affected regressions.
3. Run full regression once, then lint, typecheck, clean build and verify constituents.
4. Run architecture checksum, `git diff --check` and gitleaks.
5. Request independent review and require READY before any completion recommendation.

## Current execution disposition

`PARTIAL_RUNTIME_IMPLEMENTED`: Phase 2C implements the API-016-owned durable store, strict materializer, bounded source read port and in-process Staging composition for Source Registry, Intake, Property, Listing, Contact and Matching. Client / Requirement and every v1 intent remain blocked. Public HTTP and API-017 scheduling remain outside scope.
