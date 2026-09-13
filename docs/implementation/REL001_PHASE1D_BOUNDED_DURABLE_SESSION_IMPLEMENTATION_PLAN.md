# REL-001 Phase 1D Bounded Durable Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-062 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |

**Goal:** Implement one Identity/Authorization-owned durable Session boundary for REL-001/Staging with restart-safe resolution, optimistic concurrency, irreversible revocation and exact freshness rules.

**Architecture:** `SessionService` writes through an explicit Session repository/UoW instead of owning authoritative maps. `SessionAccessCoordinator` performs trusted durable resolution, binding derivation, live `AuthorizationService` evaluation and CAS access refresh as one fail-closed ingress boundary. Production-style Staging composition requires the durable adapter explicitly; existing in-memory storage remains test/development compatibility only.

**Tech Stack:** TypeScript, Node.js 24 built-in `node:sqlite`, existing `node:test`, existing `AuthorizationService`, existing safe error and FEAT-023 readiness vocabularies.

**Spec:** `docs/implementation/REL001_PHASE1C_CANONICAL_SESSION_RECORD_CONTRACT.md`, `REL001_PHASE1C_SESSION_RESOLUTION_FLOW.md`, `REL001_PHASE1C_SESSION_SECURITY_READINESS_MATRIX.md`, DEC-124/128/129/130.

## Global Constraints

- `x-session-id` is an opaque locator only.
- Idle timeout is exactly 30 minutes: elapsed `<30m` valid, `>=30m` invalid.
- Absolute lifetime is exactly 12 hours: elapsed `<12h` potentially valid, `>=12h` invalid.
- Existing privileged actions require MFA freshness `<=15m`; `>15m` fails closed.
- Caller actor/tenant/scope/MFA/timestamp/version fields are non-authoritative.
- Successful trusted resolution plus live authorization is the only access-refresh path.
- No login endpoint, JWT/OAuth, IdP, new role/capability, external DB/service, dependency or Production policy activation.
- Production-style Staging must not fall back to process-local authority.

---

### Task 1: Lock Session persistence and trust-binding ports

**Files:**
- Create: `modules/identity/src/session-persistence.ts`
- Create: `modules/identity/src/session-persistence.test.ts`
- Modify: `modules/identity/src/index.ts`

**Interfaces:**
- Produces `DurableSessionRecord`, `SessionMutationIdentity`, `SessionRepository`, `SessionUnitOfWork`, `InMemorySessionUnitOfWork`, and `TrustedSessionBindingResolver`.
- `DurableSessionRecord` uses the exact Phase 1C fields; immutable identity fields cannot be changed by repository update.

- [ ] **Step 1: Write RED contract tests**

Add tests proving initial version `1`, immutable clone/freeze behavior, unknown/partial record rejection, actor/binding immutability, N→N+1 compare-and-swap, and irreversible revocation. The production change that makes these tests pass is the new persistence contract plus in-memory compatibility adapter.

```ts
assert.equal(unit.sessions.find("session-1")?.sessionVersion, 1);
assert.throws(() => unit.transaction({ sessionId: "session-1", expectedVersion: 0 }, () => {}), /SESSION_VERSION_CONFLICT/);
assert.throws(() => unit.sessions.update(1, { ...record, actorId: "other" }), /SESSION_IMMUTABLE_FIELD/);
```

- [ ] **Step 2: Run RED**

Run the focused compiled test command for `session-persistence.test.ts`. Expected failure: missing module/contracts, not a test syntax error.

- [ ] **Step 3: Implement minimum port and in-memory adapter**

Define exact repository operations:

```ts
interface SessionRepository {
  find(sessionId: string): DurableSessionRecord | undefined;
  create(record: DurableSessionRecord): void;
  update(expectedVersion: number, record: DurableSessionRecord): void;
  appendRevocation(expectedVersion: number, input: SessionRevocationRecord): void;
}

interface SessionUnitOfWork {
  readonly sessions: SessionRepository;
  transaction<Result>(identity: SessionMutationIdentity, operation: () => Result): Result;
}
```

The in-memory implementation is explicit and never selected by Staging production composition.

- [ ] **Step 4: Run GREEN**

Run the focused test and existing `session-service.test.ts`; require 0 failures.

---

### Task 2: Implement the durable SQLite Session UoW

**Files:**
- Create: `modules/identity/src/session-durable-persistence.ts`
- Create: `modules/identity/src/session-durable-persistence.test.ts`
- Create: `modules/identity/src/session-durable-crash-fixture.ts` only if the existing subprocess recovery harness requires it
- Modify: `modules/identity/src/index.ts`

**Interfaces:**
- Consumes Task 1 `SessionUnitOfWork`.
- Produces `DurableSessionUnitOfWork({ databasePath, busyTimeoutMilliseconds? })` and `close()`.

- [ ] **Step 1: Write RED durability tests**

Cover create/reopen survival, revoked/reopen denial state, persisted timestamps/version, atomic rollback, stale writer conflict, concurrent revocation winning over stale access, corrupt/open failure sanitization and no process-local fallback.

```ts
const first = new DurableSessionUnitOfWork({ databasePath });
first.transaction({ sessionId, expectedVersion: 0 }, () => first.sessions.create(record));
first.close();
const reopened = new DurableSessionUnitOfWork({ databasePath });
assert.deepEqual(reopened.sessions.find(sessionId), record);
```

- [ ] **Step 2: Run RED**

Expected failure: durable adapter missing.

- [ ] **Step 3: Implement minimum SQLite adapter**

Use `node:sqlite`, explicit transactions, prepared statements, schema validation and conditional `WHERE session_id=? AND session_version=?` updates. Store Session rows and append-preserving revocation evidence in this Identity-owned database only. Reconstruct immutable records and convert all SQLite/path/stack failures to `SessionPersistenceError("SESSION_PERSISTENCE_UNAVAILABLE", safeMessage)`.

- [ ] **Step 4: Run GREEN and concurrency loop**

Run durability tests repeatedly enough to exercise the deterministic stale-writer ordering, then run Task 1 tests.

---

### Task 3: Move SessionService lifecycle writes to the UoW

**Files:**
- Modify: `modules/identity/src/session-service.ts`
- Modify: `modules/identity/src/session-service.test.ts`
- Modify: `apps/api/src/identity-api.test.ts`

**Interfaces:**
- Consumes explicit `SessionUnitOfWork`, `tenantBindingOrigin`, `lastMfaVerifiedAt` when MFA is trusted, and bounded evidence references.
- Preserves `SessionContext` API projection while adding `sessionVersion`, `lastAccessedAt`, `issuedAt`, `revokedAt?`, and safe binding metadata required by the approved contract.

- [ ] **Step 1: Write RED lifecycle tests**

Prove creation persists atomically at version 1, lookup uses the repository, explicit revoke persists irreversible N+1 metadata, refresh-family replay persists family revocation, and restart does not lose state.

- [ ] **Step 2: Run RED**

Expected failure: current service authority is private `Map` state and disappears on reconstruction.

- [ ] **Step 3: Implement minimum lifecycle integration**

Replace authoritative maps with explicit UoW reads/writes. Keep the existing `AuthenticationAdapter`; do not add a login transport. Map persisted `issuedAt` to existing authentication-time projections and keep refresh reference protected.

- [ ] **Step 4: Run GREEN**

Run SessionService, persistence and IdentityApi focused tests.

---

### Task 4: Implement freshness and authorized access coordination

**Files:**
- Create: `modules/identity/src/session-access-coordinator.ts`
- Create: `modules/identity/src/session-access-coordinator.test.ts`
- Modify: `modules/identity/src/index.ts`

**Interfaces:**
- Consumes `SessionUnitOfWork`, trusted server clock, `TrustedSessionBindingResolver`, and existing `AuthorizationService.evaluate`.
- Produces `resolveAuthorized(request): SessionContext`, with request fields `sessionId`, action, resource identity, purpose, optional reason, request/correlation IDs, and `requiresFreshMfa` derived from the canonical operation profile rather than caller authority.

- [ ] **Step 1: Write RED boundary tests**

Required RED cases: 29m59s valid, 30m invalid, 11h59m59s valid, 12h invalid, MFA 15m valid, MFA >15m invalid, denied/revoked/missing/malformed requests do not touch access, caller actor/tenant/scope claims cannot override binding, live role revocation denies next request, and stale access CAS cannot overwrite revocation.

- [ ] **Step 2: Run RED**

Expected failure: no coordinator and current read path updates no durable freshness state.

- [ ] **Step 3: Implement canonical ordering**

Implement:

```text
lookup -> record validation -> revoked -> absolute -> idle
-> trusted binding resolution -> live AuthorizationService
-> MFA freshness when already required
-> CAS(lastAccessedAt, sessionVersion N+1)
-> immutable SessionContext
```

On any pre-CAS denial, perform zero mutation. On CAS conflict, re-read; a concurrent revocation always produces denial.

- [ ] **Step 4: Run GREEN**

Run coordinator and all identity focused tests.

---

### Task 5: Add fail-closed Staging production composition and shared consumers

**Files:**
- Create: `apps/api/src/staging-session-composition.ts`
- Create: `apps/api/src/staging-session-composition.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify only if RED proves compatibility is absent: `apps/admin-console/src/console-read-adapter.ts`
- Test: `apps/admin-console/src/development-session.test.ts`
- Test: `apps/admin-console/src/console-read-adapter.test.ts`

**Interfaces:**
- Produces a shared resolver/coordinator port backed by the durable Identity store and usable by Platform Host/Core and Admin Console process consumers.
- Requires explicit `runtimeEnvironment: "STAGING"`, `databasePath`, binding resolver, authorization service, clock and audit sink.

- [ ] **Step 1: Write RED composition tests**

Prove missing durable path/binding/authorization dependencies fail closed, in-memory and development Session adapters are rejected as Staging authority, two consumer instances reopen the same Session truth, and unavailable/corrupt persistence yields safe `NOT_READY` without DB/path/stack leakage.

- [ ] **Step 2: Run RED**

Expected failure: no Staging Session production composition exists.

- [ ] **Step 3: Implement minimum composition**

Construct the durable UoW, SessionService and SessionAccessCoordinator with explicit dependencies; close in reverse order. Expose no HTTP route and no login/session issuance mechanism. Use existing FEAT-023 `HEALTHY|DEGRADED|UNHEALTHY|UNKNOWN` and `READY|NOT_READY|DEGRADED|UNKNOWN` only.

- [ ] **Step 4: Run GREEN and compatibility regression**

Run Staging composition, Console development isolation, Console read adapter and Core API façade tests. Modify Console production code only if the RED test proves the shared port cannot be consumed otherwise.

---

### Task 6: Security regression and evidence containment

**Files:**
- Modify only if RED proves a defect: `apps/api/src/contracts.ts`
- Test: `modules/identity/src/session-access-coordinator.test.ts`
- Test: `apps/api/src/staging-session-composition.test.ts`
- Test: existing FEAT-023 and FEAT-024 security suites selected by affected-path inventory

- [ ] **Step 1: Add RED leak/error tests**

Inject SQLite errors containing a database path, SQL, token-like text and stack detail. Assert only the existing safe error code/message crosses the boundary and no raw Session ID, refresh reference, MFA internals or authorization graph appears.

- [ ] **Step 2: Run RED, implement only proven mapper gap, run GREEN**

Do not add telemetry vocabulary. Reuse existing generic event type plus safe error code when recording Session outcomes.

- [ ] **Step 3: Run affected FEAT-023/024 regressions**

Require security/privacy, release authority/SoD and Console development behavior to remain passing.

---

### Task 7: Final verification, review and documentation

**Files:**
- Create: `docs/reviews/REL001_PHASE1D_BOUNDED_DURABLE_SESSION_IMPLEMENTATION_REPORT.md`
- Modify: `docs/reviews/REL001_PHASE1C_COMPLETION_REPORT.md` only to link verified implementation evidence
- Modify: `docs/00_MASTER_INDEX.md`
- Modify: bounded runtime-foundation traceability document identified by targeted search

- [ ] **Step 1: Run focused verification**

Run Phase 1D Session, restart, concurrency, revocation, freshness, MFA, tenant/scope, live authorization, safe error and shared-consumer tests.

- [ ] **Step 2: Run affected regressions, then one full final gate**

Run FEAT-023/024 affected tests, full test suite once, lint, typecheck, clean build, verify constituents, architecture checksum, `git diff --check`, and gitleaks. Dependency audit is skipped when manifests/lockfile are unchanged.

- [ ] **Step 3: Perform independent review**

Require Critical 0, Important 0 and verify no auth-model/API/role/dependency/provider expansion.

- [ ] **Step 4: Write completion evidence**

Record actual counts/results only. Do not mark Phase 1 Core Runtime complete. Stop without push; create no commit unless separately authorized.

## Plan self-review

- Spec coverage: all Phase 1D requirements map to Tasks 1–7.
- Placeholder scan: no deferred implementation placeholder; optional file changes are explicitly RED-gated.
- Type consistency: one `SessionUnitOfWork`, one `SessionAccessCoordinator`, one trusted binding resolver and one durable production authority are used throughout.
- Scope: API/login/provider/role/dependency/Production policy work is excluded.
