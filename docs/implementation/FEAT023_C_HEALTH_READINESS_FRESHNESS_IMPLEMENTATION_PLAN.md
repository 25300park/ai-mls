# FEAT-023-C Health / Readiness / Freshness Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-040 |
| Version | v0.1 |
| Status | APPROVED |
| Owner | Security / Privacy / Operations Owners |
| Baseline | `edaf43b8f936a62b16e9b57bebcd68181801afc8` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** FEAT-023-B의 단일 durable operational evidence store 안에서 component Health, operational Readiness, evidence Freshness를 권한 없는 안전한 projection으로 제공한다.

**Architecture:** 기존 `DurableOperationalEvidenceStore`가 보유한 telemetry identity와 SQLite 경계를 그대로 재사용한다. Status snapshot은 source telemetry를 참조하며, Health/Readiness는 exact vocabulary만 허용하고 Freshness는 명시된 threshold가 있을 때만 시간 차이로 계산한다. Threshold가 없으면 `UNKNOWN`이며 어떤 결과도 retry, recovery, remediation, reactivation 또는 business mutation을 수행하지 않는다.

**Tech Stack:** TypeScript 6, Node.js 24 `node:test`, built-in `node:sqlite`, pnpm 11.9.0.

**Spec:** Architecture Owner가 승인한 `FEAT-023-C — HEALTH / READINESS / FRESHNESS START AUTHORIZATION`과 FEAT-023 Canonical Foundation Amendment sections 4~7.

## Global Constraints

- Health: `HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN` only.
- Readiness: `READY | NOT_READY | DEGRADED | UNKNOWN` only.
- Freshness: `FRESH | STALE | UNKNOWN` only.
- Undefined threshold produces `UNKNOWN`; no default TTL is introduced.
- `HEALTH != READINESS != BUSINESS AUTHORIZATION`.
- Existing FEAT-023-B store, telemetry correlation, sanitization and append-only controls are preserved.
- New API IDs, dependencies, external monitoring, credentials and automatic actions remain zero.

---

### Task 1: Strict status contract and deterministic freshness

**Files:**
- Create: `modules/operations/src/operational-status-projection.ts`
- Create: `modules/operations/src/operational-status-projection.test.ts`

**Interfaces:**
- Consumes: canonical telemetry reference and ISO timestamps.
- Produces: strict immutable `OperationalStatusSnapshot` plus `deriveEvidenceFreshness()`.

- [x] Write RED tests for exact vocabularies, independent Health/Readiness, undefined threshold, boundary age, future evidence and unknown fields.
- [x] Run the focused test and confirm failure because the module is absent.
- [x] Implement the minimum strict validator and freshness derivation.
- [x] Run the focused test and confirm GREEN.

### Task 2: Durable correlated snapshot in the existing store

**Files:**
- Modify: `modules/operations/src/durable-operational-evidence-store.ts`
- Modify: `modules/operations/src/durable-operational-evidence-store.test.ts`
- Modify: `modules/operations/src/operational-evidence-architecture.test.ts`
- Modify: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: an existing durable `OperationalTelemetryRecord` and a strict status projection request.
- Produces: append-only correlated snapshot methods on the existing store; no second persistence adapter.

- [x] Write RED tests for close/reopen durability, missing telemetry rejection, immutable identity replay/conflict, append-only enforcement and zero authority/action imports.
- [x] Run focused tests and confirm the missing methods fail RED.
- [x] Add the minimum table, triggers, validation and methods to the existing store.
- [x] Run focused and affected Operations tests and confirm GREEN.

### Task 3: Evidence, documentation and completion gate

**Files:**
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Modify: `docs/00_MASTER_INDEX.md`
- Create: `docs/reviews/FEAT023_C_HEALTH_READINESS_FRESHNESS_COMPLETION.md`

- [x] Record actual production/test evidence and remaining deferred FEAT-023 phases.
- [x] Run focused, affected and one final full regression.
- [x] Run lint, typecheck, build, verify-equivalent constituents, architecture checksum, document/link validation, `git diff --check` and Gitleaks.
- [x] Obtain independent review and resolve all Critical/Important findings.
- [x] Create exactly one local FEAT-023-C commit; do not push or integrate to main.
