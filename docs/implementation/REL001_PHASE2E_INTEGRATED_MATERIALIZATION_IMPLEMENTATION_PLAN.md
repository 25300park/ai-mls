# REL-001 Phase 2E Integrated Materialization Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-123 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Quality Owner |
| 기준 commit | `099bddc9cad4aa20b4d7db791ca28c01adb9f6c3` |

**Goal:** 실제 여섯 domain mutation부터 durable API-016 final Audit Event까지의 Staging in-process 경로를 검증하고 입증된 source-port 안전성 결함만 최소 수정한다.

**Architecture:** 기존 six domain stores, `createMaterializationReadyAuditIntentSources()`, `createStagingApi016AuditRuntime()`, `AuditIntentMaterializer`, `DurableAuditEventStore`만 조합한다. 새 runtime, scheduler, queue, API 또는 persistence subsystem은 만들지 않는다.

**Tech Stack:** Node.js 24, TypeScript, built-in `node:test`, built-in `node:sqlite`.

**Spec:** `docs/implementation/REL001_PHASE2E_INTEGRATED_MATERIALIZATION_GAP_MATRIX.md`

## Global Constraints

- Sources exactly 6; Client / Requirement excluded.
- v1 materialization/rewrite/backfill exactly 0.
- `IMMUTABLE_REFERENCE` without resolver fails closed; no default provenance.
- Public HTTP, API-017, scheduler/polling/queue, dependencies and external network additions 0.

### Task 1: Strict read-only source port

**Files:** Modify `modules/audit/src/audit-intent-materializer.ts`; modify `modules/audit/src/audit-intent-source-port.test.ts`.

- [x] Add a test supplying a malformed same-source v2 payload and assert bounded fail-closed behavior before exposure.
- [x] Run the compiled focused test and confirm RED because the current port returns the malformed payload.
- [x] Reuse `validateEnrichedAuditIntentV2()` for each eligible row and map validation failure to `INTENT_SOURCE_INPUT_INVALID`; do not mutate or default the row.
- [x] Run the focused test and Phase 2C/2D source-port regression to GREEN.

### Task 2: Real six-source mutation E2E

**Files:** Create `apps/api/src/api016-domain-mutation-materialization.test.ts`.

- [x] Construct each existing durable store with its canonical resolver and perform one real authoritative mutation producing v2.
- [x] Compose the six public read methods through the existing factory and Staging runtime.
- [x] Assert exactly six final events and exact chronology, principal, tenant/scope and Property SYSTEM_BOUND fields.
- [x] Assert replay and reopen add zero duplicates and same intent ID across different sources does not collide.

### Task 3: Failure, append-only, v1 and resolver containment

**Files:** Extend `apps/api/src/api016-domain-mutation-materialization.test.ts` and existing materializer/source-port/composition tests; modify Production only if a RED proves a concrete defect.

- [x] Assert injected final-store commit failure leaves the source intent durable and retryable.
- [x] Assert conflicting identity is fail-closed and existing event remains unchanged.
- [x] Assert final-event update/delete triggers reject mutation.
- [x] Assert v1 and Client / Requirement materialization counts remain zero.
- [x] Assert `IMMUTABLE_REFERENCE` without resolver returns only bounded `INTENT_INVALID`, with no event and no source mutation.
- [x] Assert source port results are immutable/read-only and unsafe diagnostics never expose secret/path/SQL data.
- [x] Assert runtime startup/reopen status is `HEALTHY/READY` and closed/unavailable access fails safely.

### Task 4: Verification and evidence

**Files:** Create `docs/reviews/REL001_PHASE2E_API016_INTEGRATED_MATERIALIZATION_HARDENING_COMPLETION.md`; update `docs/implementation/REL001_PHASE2_API016_TRACEABILITY_MATRIX.md` and `docs/00_MASTER_INDEX.md` with verified evidence only.

- [x] Run Phase 2E focused, Phase 2D/2C/1G/1D and FEAT-024/023 affected regression.
- [x] Run one full regression and lint/typecheck/clean build/verify constituents.
- [x] Run architecture checksum, `git diff --check`, Gitleaks and document/link/ID checks; do not run dependency audit without approval.
- [x] Perform fresh independent review and record actual findings.
- [x] Stop without commit, push or main integration unless separately authorized.
