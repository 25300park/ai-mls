# FEAT-023-B Structured Telemetry / Operational Evidence Foundation Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-038 |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Security / Operations Owners |
| Baseline | `657fc4e28e13bd8a73885895a10af613e91db208` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** canonical safe telemetry contract와 restart-safe append-only operational evidence store를 구현한다.

**Architecture:** strict immutable validator가 ingress와 reload를 모두 검증하고, 하나의 bounded SQLite store가 normalized reference와 idempotent identity만 durably 저장한다. Domain store, API, Console, alert 및 health projection은 변경하지 않는다.

**Tech Stack:** TypeScript 6, Node.js 24.18.0 built-in `node:sqlite`, Node test runner, pnpm 11.9.0

**Spec:** `docs/implementation/FEAT023_B_STRUCTURED_TELEMETRY_OPERATIONAL_EVIDENCE_DESIGN.md`

## Global Constraints

- New API ID, business authority, lifecycle state, dependency 및 external network는 `0`이어야 한다.
- Canonical telemetry field와 optional identity field 외 unknown field를 거부한다.
- Production durable configuration은 explicit file path 없이는 fail closed한다.
- Domain truth와 complete domain object를 operational store에 복제하지 않는다.
- RED → minimum implementation → GREEN 순서를 보존한다.

---

### Task 1: Canonical telemetry contract

**Files:**
- Create: `modules/operations/src/operational-telemetry-contracts.test.ts`
- Create: `modules/operations/src/operational-telemetry-contracts.ts`

**Interfaces:**
- Produces: `OperationalTelemetryRecord`, `validateOperationalTelemetryRecord()`, `immutableOperationalEvidence()`

- [x] RED test: exact accepted record, required/unknown field, unsafe reference, PII/free-text, invalid timestamp, bounded collection 및 immutable result를 정의한다.
- [x] RED 실행: compiled focused test가 missing module/export로 실패하는지 확인한다.
- [x] GREEN: exact-key validator와 bounded safe reference/category validator를 최소 구현한다.
- [x] Focused test를 재실행한다.

### Task 2: Durable append-only evidence store

**Files:**
- Create: `modules/operations/src/durable-operational-evidence-store.test.ts`
- Create: `modules/operations/src/durable-operational-evidence-store.ts`
- Create: `modules/operations/src/index.ts`

**Interfaces:**
- Consumes: `validateOperationalTelemetryRecord()`
- Produces: `OperationalEvidenceStore`, `DurableOperationalEvidenceStore`, `createProductionOperationalEvidenceStore()`

- [x] RED test: explicit path, append/find/list, close/reopen ordering, exact replay, conflicting identity, raw DB UPDATE/DELETE rejection 및 corrupt reload failure를 정의한다.
- [x] RED 실행: store module/export 부재의 예상 실패를 확인한다.
- [x] GREEN: WAL/FULL synchronous SQLite store, integrity/stored-state validation 및 append-only trigger를 최소 구현한다.
- [x] Focused durability test를 재실행한다.

### Task 3: Boundary and regression verification

**Files:**
- Create: `modules/operations/src/operational-evidence-architecture.test.ts`
- Modify: `docs/implementation/FEAT023_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/FEAT023_B_STRUCTURED_TELEMETRY_OPERATIONAL_EVIDENCE_COMPLETION.md`
- Modify: `docs/00_MASTER_INDEX.md`

**Interfaces:**
- Verifies: no domain/API/Console mutation dependency, no network/provider/dependency addition, Production fail-closed selection

- [x] RED architecture assertion을 추가하고 expected helper exposure를 확인한다.
- [x] 최소 private-boundary/export correction으로 GREEN을 만든다.
- [x] Focused, affected security/audit/durable-store regression을 실행한다.
- [x] Full test, lint, typecheck, build, verify-equivalent constituent gates, architecture checksum, Gitleaks 및 diff check를 실행한다.
- [x] Completion report/RTM에는 실제 evidence만 기록하고 fresh independent review를 수행한다.
- [ ] 정확히 하나의 local FEAT-023-B commit을 생성하고 main에 `ff-only` 통합한다.
