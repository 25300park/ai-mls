# F18-D API-018 Runtime / Host / HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose exactly eight approved API-018 technical operations through one Application → Runtime → Host boundary, with seven closed HTTP operations and internal-only atomic `AdvanceCheckpoint`.

**Architecture:** Add closed immutable API-018 contracts and one Connector application in `modules/source`. Extend the existing F18-C SQLite authority with append-only bounded technical records rather than creating another store. Add a dedicated Runtime/Host and an API HTTP adapter; production composition injects only a fail-closed unavailable connector, while deterministic connectors remain test-only.

**Tech Stack:** TypeScript, Node.js 24, built-in `node:sqlite`, `node:test`, no new dependencies.

**Spec:** Architecture Owner approved `F18-D — API-018 CLOSED CONTRACT AMENDMENT` (2026-09-01 attachment).

## Global Constraints

- Exact operation count: 8; Commands: 7; Queries: 1.
- HTTP executable: 7; `AdvanceCheckpoint`: internal/atomic-only.
- Real provider, credentials, approved destination, and external network activation: 0.
- No API-014/API-015 ownership change, API-019 expansion, Source lifecycle state, or F19 behavior.
- Preserve all existing F18-A/B/C uncommitted changes; no commit or push.

---

### Task 1: Closed API-018 contract

**Files:**
- Create: `modules/source/src/connector-api-contracts.ts`
- Test: `modules/source/src/connector-api-contracts.test.ts`
- Modify: `modules/source/src/index.ts`

**Produces:** `CONNECTOR_API_OPERATIONS`, command/query/HTTP/internal partitions, `parseConnectorApiRequest()`, immutable success/error DTOs.

- [ ] Write tests asserting exact 8/7/1/7/1 matrices, `AdvanceCheckpoint` HTTP exclusion, unknown operation/field rejection, bounded identifiers/references/arrays, and body authority-field rejection.
- [ ] Run the compiled focused test and confirm RED because the contract is absent.
- [ ] Implement only the amendment fields and existing technical vocabularies.
- [ ] Run focused GREEN.

### Task 2: Durable technical records in the existing F18-C authority

**Files:**
- Modify: `modules/source/src/connector-durable-persistence.ts`
- Test: `modules/source/src/connector-api-durable-records.test.ts`

**Consumes:** Exact Connector execution scope and F18-C transaction/error patterns.
**Produces:** append/read technical record, exact replay/conflict, and safe scoped query methods on `DurableConnectorExecutionUnitOfWork`.

- [ ] Write RED tests for connector instance, batch binding/status, delivery lease/evidence, observation, health, restart preservation, append-only evidence, version conflict, idempotent replay, and tenant/scope concealment.
- [ ] Confirm RED for missing durable record methods.
- [ ] Extend the existing SQLite schema and transactions; do not add a second persistence object.
- [ ] Run durable focused GREEN and F18-C regression.

### Task 3: Single API-018 application boundary

**Files:**
- Create: `modules/source/src/connector-runtime-application.ts`
- Test: `modules/source/src/connector-runtime-application.test.ts`

**Consumes:** trusted context resolver, `SourceIngestionAdmissionGate`, F18-C durable UoW/coordinator, unavailable/test Connector invocation port.
**Produces:** `execute({ kind, request })` for exactly eight operations.

- [ ] Write RED tests for all operation registrations, trusted Session/job context, F18-B zero-mutation block, durable capture execution/replay/conflict, lease conflict, checkpoint safety, query concealment, safe evidence reconstruction, and unavailable connector containment.
- [ ] Confirm RED because the application is absent.
- [ ] Implement the minimum dispatch and error mapping; caller actor/tenant/team/scope/history is never consumed.
- [ ] Run application focused GREEN.

### Task 4: Runtime and Host

**Files:**
- Create: `modules/source/src/connector-runtime.ts`
- Create: `modules/source/src/connector-application-host.ts`
- Test: `modules/source/src/connector-runtime-host.test.ts`

**Produces:** one READY-gated Runtime and Host exposing the exact canonical matrix.

- [ ] Write RED registration/lifecycle tests for all eight operations and missing dependency fail-closed behavior.
- [ ] Confirm RED for missing Runtime/Host.
- [ ] Implement direct delegation only to `ConnectorRuntimeApplication`; no alternate state or connector path.
- [ ] Run Runtime/Host GREEN.

### Task 5: Closed HTTP adapter and production composition

**Files:**
- Create: `apps/api/src/connector-api-http-adapter.ts`
- Create: `apps/api/src/connector-production-composition.ts`
- Test: `apps/api/src/connector-api-http-runtime.test.ts`

**Produces:** `/api/connectors/commands` and `/api/connectors/queries` POST handlers for only seven HTTP operations.

- [ ] Write RED tests for seven executable operations, `AdvanceCheckpoint`/unknown rejection, header-derived Session, closed bodies, bounded body size, concealment, safe errors, replay with zero duplicate call, and raw evidence/stack/path/secret redaction.
- [ ] Write RED production tests proving explicit durable path requirement and arbitrary/test Connector injection rejection.
- [ ] Implement HTTP adapter and production composition with unavailable connector only.
- [ ] Run HTTP/composition GREEN.

### Task 6: Cross-layer verification and report

**Files:**
- Create: `docs/reviews/F18_D_CLOSED_API_018_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md`

- [ ] Run F18-D focused tests.
- [ ] Run F18-B/F18-C regression and affected F17 API-014/provider/retry tests.
- [ ] Run full regression once, lint, typecheck, build, verify-equivalent commands, architecture checksum if repository command exists, `git diff --check`, and Gitleaks only if available without network.
- [ ] Confirm dependency/lockfile/network/provider/credential changes are zero.
- [ ] Record exact matrix and actual evidence. Do not run dependency audit without F18-D scoped approval.
- [ ] Confirm main clean, preserved worktree dirty, Commit `NOT_CREATED`, Push `NOT_PERFORMED`; stop before F18-E/F19.
