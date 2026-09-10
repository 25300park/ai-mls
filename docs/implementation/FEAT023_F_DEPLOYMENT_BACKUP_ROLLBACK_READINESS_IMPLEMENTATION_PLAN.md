# FEAT-023-F Deployment / Backup / Rollback Readiness Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-042 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Operations / Release / Data-Backup / Security Owners |
| Baseline | `2d7e59015ff0f70861cd3937e2d3ba8d761569f3` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 승인된 source-specific authoritative evidence만으로 deployment, backup, rollback readiness를 결정하고 기존 operational SQLite 경계에 안전하게 보존·조회한다.

**Architecture:** Pure readiness projector는 readiness 종류별 고정 required evidence set과 exact binding을 검증하며 caller-authored aggregate `READY`를 받지 않는다. Source evidence와 derived projection은 기존 `DurableOperationalEvidenceStore`에 append-only로 저장하고, 기존 live-authorized tenant/scope read boundary와 Console injected read port를 통해서만 공개한다. Existing FEAT-023-E evaluator는 derived `NOT_READY`에 대해서만 backup/deployment alert를 생성한다.

**Tech Stack:** TypeScript 6, Node.js 24 `node:test`, built-in `node:sqlite`, pnpm 11.9.0.

**Spec:** Architecture Owner가 승인한 `FEAT-023-F — DEPLOYMENT / BACKUP / ROLLBACK READINESS EVIDENCE CANONICAL DESIGN AMENDMENT`.

## Global Constraints

- Readiness는 `READY | NOT_READY | DEGRADED | UNKNOWN`, freshness는 `FRESH | STALE | UNKNOWN`만 사용한다.
- Missing required evidence는 `UNKNOWN`, explicit blocking evidence 또는 stale required gate는 `NOT_READY`다.
- `DEGRADED`는 authoritative source가 명시적으로 제공할 때만 전파한다.
- Threshold가 없으면 freshness는 `UNKNOWN`이며 age만으로 `STALE`을 만들지 않는다.
- Backup configuration, historical candidate evidence, generic telemetry string 또는 caller-authored success는 readiness authority가 아니다.
- Existing operational SQLite store만 확장하며 새 DB, API, dependency, role/capability, lifecycle 또는 external network를 추가하지 않는다.
- Deployment, backup, restore, rollback, recovery, retry 또는 automatic remediation 실행 경로를 만들지 않는다.
- Console은 injected read-only port만 사용하고 tenant/scope concealment 및 safe reference만 보존한다.

---

### Task 1: Strict source-specific evidence manifest and deterministic composition

**Files:**
- Create: `modules/operations/src/operational-readiness-evidence.ts`
- Create: `modules/operations/src/operational-readiness-evidence.test.ts`
- Modify: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: exact source evidence records with immutable identity, source classification, readiness type, candidate/environment/protected-set/rollback-target binding, result, timestamp and safe evidence references.
- Produces: immutable `OperationalReadinessProjection` with readiness, freshness, reason codes, source evidence IDs and evaluated time.

- [x] Write RED tests for config-only backup, wrong-candidate historical build, caller aggregate PASS, missing evidence, no-threshold freshness, F19-support-only evidence, explicit failure, explicit degraded input, complete valid manifests and zero execution callbacks.
- [x] Run the focused test and confirm RED because the readiness module is absent.
- [x] Implement strict validators, hard-coded required evidence sets, exact binding checks and pure deterministic composition.
- [x] Run the focused test and confirm GREEN.

### Task 2: Append-only durability and scoped reads in the existing operational store

**Files:**
- Modify: `modules/operations/src/durable-operational-evidence-store.ts`
- Modify: `modules/operations/src/durable-operational-evidence-store.test.ts`
- Modify: `modules/operations/src/operational-evidence-architecture.test.ts`

**Interfaces:**
- Consumes: validated source-specific evidence records and projection requests referencing durable evidence identities.
- Produces: append-only evidence/projection rows, restart-safe derived state and tenant/scope-concealed reads in `DurableOperationalEvidenceStore`.

- [x] Write RED tests for append/project/reopen, immutable evidence, identity conflicts, wrong tenant/scope concealment, missing durable evidence and raw secret/scanner rejection.
- [x] Confirm RED for missing store methods/tables.
- [x] Add only the required tables, indexes, append-only triggers and transactional store methods to the existing SQLite database.
- [x] Run readiness/store/architecture tests and confirm GREEN.

### Task 3: Alert enablement and read-only Console projection

**Files:**
- Modify: `modules/operations/src/operational-alert-projection.ts`
- Modify: `modules/operations/src/operational-alert-projection.test.ts`
- Modify: `modules/operations/src/security-privacy-operational-controls.ts`
- Modify: `modules/operations/src/security-privacy-operational-controls.test.ts`
- Modify: `apps/admin-console/src/console-read-adapter.ts`
- Modify: `apps/admin-console/src/console-read-adapter.test.ts`
- Modify: `apps/admin-console/src/console-renderer.ts`
- Modify: `apps/admin-console/src/console-renderer.test.ts`

**Interfaces:**
- Consumes: authoritative durable readiness projections through existing live-authorized tenant/scope boundaries.
- Produces: `HIGH` backup/deployment failure signals only for `NOT_READY`, plus safe read-only Console rows without mutation controls.

- [x] Write RED tests proving `NOT_READY` alert activation, `UNKNOWN/DEGRADED` no-alert behavior, live authorization, concealment, safe DTO rendering and zero execution controls.
- [x] Confirm RED for currently disabled readiness alerts and absent Console readiness port.
- [x] Enable the two existing alert types and extend the existing security/read/Console boundaries minimally.
- [x] Run focused Operations/Console tests and confirm GREEN.

### Task 4: Regression, governance evidence and completion

**Files:**
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Create: `docs/reviews/FEAT023_F_DEPLOYMENT_BACKUP_ROLLBACK_READINESS_COMPLETION.md`

**Interfaces:**
- Consumes: verified focused, affected, architecture, security and full-suite results.
- Produces: only actual FEAT-023-F traceability and completion evidence.

- [x] Run FEAT-023-F focused tests and affected FEAT-023-B/C/D/E, FEAT-022, F20/F19/F18/F17 regressions.
- [x] Run one final full regression, lint, typecheck, build, verify, architecture checksum, `git diff --check` and Gitleaks.
- [x] If a fresh dependency audit is required, stop for explicit FEAT-023-F network approval; otherwise record that dependency/lockfile changes are zero without inventing audit evidence.
- [x] Perform fresh independent review and resolve all Critical/Important findings.
- [x] Record only verified evidence in RTM/report and create exactly one local commit; do not push or integrate to main.
