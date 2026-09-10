# FEAT-023-G Operations Console / Traceability Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-043 |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Operations / Security / Privacy Owners |
| Baseline | `7af697a02b5ff7372adb2d12202382218783da79` |

**Goal:** FEAT-023-B~F의 durable telemetry, component status, Alert와 operational readiness를 기존 `/system/operations` Console에 tenant/scope-safe read-only projection으로 통합하고 A~G traceability를 닫는다.

**Architecture:** 기존 `DurableOperationalEvidenceStore`에 status scoped read를 추가하고 기존 `SecurityPrivacyOperationalControlService`가 telemetry/status를 live-authorized로 읽는다. `ConsoleReadAdapter`는 하나의 injected operational evidence/status port에서 safe immutable DTO만 만들고 기존 `renderOperations()`가 Health, Readiness, Freshness를 분리해 표시한다.

**Tech Stack:** TypeScript 6, Node.js 24.18.0 `node:test`, built-in `node:sqlite`, existing zero-dependency Admin Console.

**Spec:** [FEAT-023-G Gap Matrix](../reviews/FEAT023_G_OPERATIONS_CONSOLE_TRACEABILITY_GAP_MATRIX.md)

## Global Constraints

- Existing `/system/operations`, `ConsoleReadAdapter`, operational SQLite store and security service only.
- New API ID, route, authority, role/capability, lifecycle/status vocabulary, persistence subsystem and dependency: `0`.
- `UNKNOWN` remains `UNKNOWN`; Health, Readiness and Freshness remain separate.
- Console store access, mutation controls, external monitoring/network and raw/secret/PII/provider/prompt/CoT disclosure are prohibited.
- FEAT-023-H and Final Gate remain not started.

---

### Task 1: Tenant/scope-safe operational telemetry and status reads

**Files:**
- Modify: `modules/operations/src/durable-operational-evidence-store.ts`
- Modify: `modules/operations/src/durable-operational-evidence-store.test.ts`
- Modify: `modules/operations/src/security-privacy-operational-controls.ts`
- Modify: `modules/operations/src/security-privacy-operational-controls.test.ts`

**Interfaces:**
- Consumes: existing `OperationalEvidenceBinding`, telemetry bindings, `OperationalStatusFilter`, trusted `SessionContext` and `AuthorizationService`.
- Produces: `listStatusesScoped(binding, filter)`, `readTelemetry(request)` and `readStatuses(request)` returning immutable canonical records.

- [x] **Step 1: Write failing scoped-read tests**

```typescript
assert.deepEqual(store.listStatusesScoped({ tenantId: "tenant-a", scopeRef: "team-a" }), [tenantAStatus]);
assert.deepEqual(store.listStatusesScoped({ tenantId: "tenant-b", scopeRef: "team-b" }), []);
```

Add live authorization, MFA, wrong-tenant, wrong-scope and safe empty/concealment assertions for both telemetry and status reads.

- [x] **Step 2: Run the focused tests and confirm RED**

Expected failure: scoped status/service telemetry/status methods are absent; no Production file has changed.

- [x] **Step 3: Implement the minimum scoped boundary**

Join `operational_status_snapshot.telemetry_event_id` to the existing append-only `operational_evidence_binding`. Reuse `listScoped()` for telemetry. Authorize both service reads with fixed purpose `SECURITY_MONITORING`, live `audit.query`, existing MFA and concealment.

- [x] **Step 4: Run focused store/service tests and confirm GREEN**

### Task 2: Safe Console operational evidence/status DTO

**Files:**
- Modify: `apps/admin-console/src/console-read-adapter.ts`
- Modify: `apps/admin-console/src/console-read-adapter.test.ts`

**Interfaces:**
- Consumes: one injected port exposing `readTelemetry()` and `readStatuses()` through the existing security service.
- Produces: `telemetry`, `operationalStatuses`, and `securityPrivacySummary` fields inside the existing `OPERATIONS` result.

- [x] **Step 1: Write failing adapter tests**

Assert that trusted-session tenant/scope input reaches the injected port, unauthorized reads conceal records, malformed/unsafe returned values become `UNAVAILABLE`, and output contains only canonical safe fields. Assert `UNKNOWN` remains literal `UNKNOWN`, Alert/readiness bindings remain intact, and the adapter exposes no command function.

- [x] **Step 2: Confirm RED because the operational evidence/status port is absent**

- [x] **Step 3: Add the minimum port and safe field reconstruction**

Validate each record with existing canonical validators, reconstruct new deeply immutable DTOs, and derive the security/privacy summary only from scoped canonical `SECURITY` records/statuses. Do not duplicate authorization or readiness derivation in Console.

- [x] **Step 4: Run adapter tests and confirm GREEN**

### Task 3: Accessible read-only rendering

**Files:**
- Modify: `apps/admin-console/src/console-renderer.ts`
- Modify: `apps/admin-console/src/console-renderer.test.ts`
- Modify only if required by an observed RED: `apps/admin-console/src/console-server.test.ts`

**Interfaces:**
- Consumes: adapter-safe telemetry, status, security summary, Alert and readiness DTOs.
- Produces: sections in the existing `/system/operations` page with labelled tables, textual badges and safe empty/unavailable/error states.

- [x] **Step 1: Write failing renderer tests**

Assert separate Health/Readiness/Freshness columns, literal `UNKNOWN`, telemetry provenance references, security/privacy summary, all three readiness types, accessible labels and no form/button/retry/recover/deploy/backup/restore/rollback controls. Assert hostile stack/path/secret/raw prompt/provider/CoT values are not rendered.

- [x] **Step 2: Confirm RED because telemetry/status/security sections are absent**

- [x] **Step 3: Extend only `renderOperations()` and small read-only helpers**

Reuse `escapeHtml`, `statusBadge`, table overflow and shared FEAT-021 semantics. Missing injected data renders `UNAVAILABLE`; empty authorized data renders `EMPTY`.

- [x] **Step 4: Run renderer and server regression tests and confirm GREEN**

### Task 4: Architecture, traceability and completion

**Files:**
- Modify: `modules/operations/src/operational-evidence-architecture.test.ts`
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Create: `docs/reviews/FEAT023_G_OPERATIONS_CONSOLE_TRACEABILITY_COMPLETION.md`

**Interfaces:**
- Consumes: verified Task 1~3 evidence.
- Produces: FEAT-023-G-only closure evidence; H and Final Gate remain unchanged.

- [x] **Step 1: Add architecture assertions**

Assert Console production code has no store import/direct construction, no new route/API/mutation path, and service/store additions remain read-only and authority-free.

- [x] **Step 2: Run focused and affected regressions**

Include FEAT-023-B~F, F20 Console and FEAT-021 accessibility tests.

- [x] **Step 3: Run final gates**

Run full regression once, lint, typecheck, build, verify constituents, architecture checksum, `git diff --check`, Gitleaks and dependency/lockfile change checks. A network audit is not required unless separately requested by repository policy.

- [x] **Step 4: Perform fresh independent review**

Require Critical `0`, Important `0`, unresolved blockers `0`.

- [x] **Step 5: Record evidence and create one local commit**

Update only FEAT-023 A~G evidence, add report/index entries, create exactly one local FEAT-023-G commit, keep main unchanged, and do not push.
