# F17-D Closed API-014 Runtime / Host / HTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose exactly the existing API-014 12 commands and 6 queries through one closed HTTP → existing Host → existing Runtime → `PublicationApi` path backed by the F17-C durable Publication infrastructure.

**Architecture:** Add one structural canonical API execution port to the existing Publication Runtime and Host without changing the legacy create/modify path. The apps/api adapter owns API-014 parsing, closed routing, response mapping, and production composition; it injects one `PublicationApi` instance backed by `createProductionPublicationInfrastructure`.

**Tech Stack:** Node.js 24.18.0, TypeScript, built-in `node:http`, built-in `node:sqlite`, Node test runner, pnpm 11.9.0.

**Spec:** F17-D Brief supplied by the Architecture Owner and F17-C approved design at `docs/implementation/F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN.md`.

## Global Constraints

- Preserve the exact API-014 operation sets in `apps/api/src/publication-api-contracts.ts`: commands 12, queries 6.
- Add no API IDs, operations, business rules, provider adapters, credentials, Console mutations, F18, or F19 behavior.
- Session identity comes only from `x-session-id`; body actor/role/capability/MFA claims cannot create authority.
- Production composition requires an explicit durable database path and never falls back to in-memory persistence.
- Preserve F17-B `ELIGIBLE | BLOCKED` and F17-C `DISPATCH_STARTED` ambiguity containment.
- Keep the legacy `/publications/commands/create` and `/publications/commands/modify` routes unchanged.
- One final bounded F17-D commit only; no intermediate commits and no push.

## Execution Completeness Matrix Before Modification

| Operations | Contract | PublicationApi dispatch | Runtime | Host | HTTP | Closed schema | Authorization | Durable/read path | Safe error |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Commands | 12/12 | 12/12 | 0/12 | 0/12 | 0/12 | 12/12 | 12/12 | 12/12 | 12/12 |
| Queries | 6/6 | 6/6 | 0/6 | 0/6 | 0/6 | 6/6 | 6/6 | 6/6 | 6/6 |

The only missing boundary is transport registration. No operation requires a new canonical business decision.

---

### Task 1: Runtime and Host Canonical API Port

**Files:**
- Create: `modules/publication/src/publication-runtime-canonical-api-port.ts`
- Modify: `modules/publication/src/publication-runtime.ts`
- Modify: `modules/publication/src/publication-composition-root.ts`
- Modify: `modules/publication/src/publication-application-host.ts`
- Modify: `modules/publication/src/index.ts`
- Test: `modules/publication/src/publication-canonical-api-runtime.test.ts`
- Test: `modules/publication/src/publication-runtime.test.ts`

**Interfaces:**
- Produce `PublicationCanonicalApiExecutionPort` with immutable `operations` and `execute(request: unknown): unknown`.
- Produce `PublicationRuntime.executeCanonicalApi(request)` and `PublicationApplicationHost.executeCanonicalApi(request)`.
- Consume an optional canonical port through bootstrap/composition options; calling without the port fails closed.

- [ ] Add a runtime RED test proving the 18-operation port is absent and execution fails closed.
- [ ] Add a host RED test proving canonical execution cannot bypass the Host.
- [ ] Run the two focused compiled tests and confirm the expected missing-method/type failure.
- [ ] Implement the structural port and the minimum Runtime/Host delegation.
- [ ] Re-run the focused tests and confirm GREEN.

### Task 2: Closed API-014 Runtime Adapter and HTTP Parser

**Files:**
- Create: `apps/api/src/publication-api-runtime-adapter.ts`
- Create: `apps/api/src/publication-api-http-adapter.ts`
- Create: `apps/api/src/publication-api-http-runtime.test.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- `PublicationApiRuntimeAdapter` exposes exactly `PUBLICATION_API_COMMAND_OPERATIONS` and `PUBLICATION_API_QUERY_OPERATIONS` and dispatches to `PublicationApi.executeCommand` or `executeQuery`.
- `createPublicationApi014HttpRequestHandler(host, fallback?)` matches only `POST /api/publication/commands` and `POST /api/publication/queries`.
- The handler creates a request with `sessionId` derived from `x-session-id`, rejects unknown top-level/body authority fields through existing closed API validation, and maps only safe API errors.

- [ ] Add RED tests for exact 18-operation registry, unknown operation/field, missing session, body actor non-authority, and command/query route separation.
- [ ] Run the focused test and confirm failure because the adapter and handler do not exist.
- [ ] Implement the minimum runtime adapter, closed route matcher, request mapper, and safe HTTP response mapper.
- [ ] Re-run the focused test and confirm GREEN.

### Task 3: Production Durable Composition

**Files:**
- Modify: `apps/api/src/composition.ts`
- Test: `apps/api/src/publication-api-http-runtime.test.ts`
- Test: `apps/api/src/publication-api.test.ts`

**Interfaces:**
- `composeProductionPublicationApi014NodeHttpServer(options)` constructs one F17-C durable infrastructure, one `PublicationApi`, one canonical Runtime/Host graph, and one Node HTTP server.
- `databasePath` is mandatory and its UoW is closed by the returned composition.
- Missing durable configuration fails closed before server startup.

- [ ] Add RED tests for durable composition, missing database path, and no in-memory fallback.
- [ ] Run focused tests and confirm the production composition is missing.
- [ ] Implement the minimum composition and deterministic close path.
- [ ] Re-run focused tests and confirm GREEN.

### Task 4: Commands 12/12 and Negative Authorization

**Files:**
- Test: `apps/api/src/publication-api-http-runtime.test.ts`
- Modify only if required: `apps/api/src/publication-api-http-adapter.ts`

**Interfaces:**
- Each command maps one-to-one to the existing `PublicationApi` operation.
- `RESOLVE_RECONCILIATION` and `RECOVER_PUBLICATION` retain trusted-evidence restrictions.

- [ ] Add table-driven RED coverage for all 12 commands crossing HTTP → Host → Runtime → PublicationApi.
- [ ] Add RED negative coverage for malformed IDs, stale version, wrong tenant/scope, missing capability/MFA, stale approval, inactive target, binding mismatch, idempotency conflict, invalid lifecycle, and caller-authored reconciliation evidence.
- [ ] Implement only missing transport mapping behavior.
- [ ] Re-run command focused tests and affected API-014 tests until GREEN.

### Task 5: Queries 6/6 and Concealment

**Files:**
- Test: `apps/api/src/publication-api-http-runtime.test.ts`
- Modify only if required: `apps/api/src/publication-api-http-adapter.ts`

**Interfaces:**
- All six queries use the existing read-only `PublicationApi` query service.
- Inaccessible resources remain concealed and no query changes repository, journal, retry state, receipt, or provider state.

- [ ] Add table-driven RED coverage for all six query registrations and safe immutable DTOs.
- [ ] Add RED tests for inaccessible tenant/scope and mutation/provider-call count zero.
- [ ] Implement only missing query mapping behavior.
- [ ] Re-run query focused and API-014 query tests until GREEN.

### Task 6: F17-B/F17-C Transport Regression

**Files:**
- Test: `apps/api/src/publication-api-http-runtime.test.ts`
- Test: `modules/publication/src/publication-durable-persistence.test.ts`
- Test: `modules/publication/src/publication-service.test.ts`

**Interfaces:**
- HTTP replay after `DISPATCH_STARTED` without a receipt returns `RECONCILIATION_REQUIRED` and provider calls stay zero.
- Completed durable receipt replays the authoritative result; a conflicting fingerprint is rejected.

- [ ] Add RED composed restart tests for ambiguity, replay, conflicting fingerprint, and missing durable configuration.
- [ ] Implement only integration corrections required to use the existing F17-C journal.
- [ ] Run F17-B/F17-C and API-014 focused tests until GREEN.

### Task 7: Final Verification and Evidence

**Files:**
- Create: `docs/reviews/F17_D_CLOSED_API_014_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md`
- Modify only verified evidence: applicable F17 traceability document if present.

- [ ] Run F17-D focused tests and record counts.
- [ ] Run API-014 affected, F17-B, F17-C, and Publication affected regression.
- [ ] Run lint, typecheck, build, verify, and the full test suite once.
- [ ] Run architecture tests/checksum, `git diff --check`, and Gitleaks.
- [ ] Stop and request F17-D-scoped authorization before production/full dependency audits if not already granted.
- [ ] Perform fresh independent review and require Critical 0 / Important 0.
- [ ] Write the report with the final 18/18 matrix and actual evidence.
- [ ] Create exactly one local F17-D commit, confirm clean worktree, do not push, and keep F17-E/F not started.
