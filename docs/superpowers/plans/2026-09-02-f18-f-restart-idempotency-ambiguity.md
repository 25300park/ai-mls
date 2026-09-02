# F18-F Restart / Idempotency / Ambiguity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exact durable replay를 live execution admission과 분리하고, F18 Connector/API-018/API-019의 restart, idempotency, ambiguity 및 no-blind-rerun invariants를 검증·보강한다.

**Architecture:** Existing Application access/isolation boundary가 historical result disclosure를 보호한다. `ConnectorExecutionCoordinator`는 durable idempotency를 먼저 조회해 exact replay 또는 conflict를 mutation 없이 처리하고, prior identity가 없을 때만 F18-B admission과 existing durable execution path를 사용한다. 다른 production 변경은 RED가 concrete defect를 입증한 경우에만 기존 persistence boundary 안에서 최소 수행한다.

**Tech Stack:** Node.js 24.18.0, TypeScript, built-in `node:test`, built-in `node:sqlite`, pnpm 11.9.0, existing F18 durable adapters.

**Spec:** `docs/superpowers/specs/2026-09-02-f18-f-restart-idempotency-ambiguity-design.md`

## Global Constraints

- Trusted authentication, tenant/scope visibility, authorizer와 concealment가 historical replay disclosure보다 먼저 실행되어야 한다.
- Exact replay는 connector, lease, checkpoint 또는 new execution mutation을 만들지 않는다.
- New invocation identity에만 current F18-B live admission을 적용한다.
- Initial production correction은 `modules/source/src/connector-execution-coordinator.ts`의 ordering에 한정한다.
- 다른 production 파일은 RED가 별도의 concrete defect를 입증한 경우에만 수정한다.
- New API-018/API-019 operation, schema, lifecycle state, persistence subsystem 및 recovery orchestrator를 추가하지 않는다.
- F18-G/F18-H/F19, business reconciliation, real provider/network/credentials를 시작하지 않는다.
- Dependency audit은 별도 F18-F-scoped network approval 전에는 실행하지 않는다.
- Commit과 push는 별도 Architecture Owner 승인 전까지 수행하지 않는다.

---

## File structure

| File | Responsibility |
|---|---|
| `modules/source/src/connector-execution-coordinator.ts` | Exact replay/conflict와 new execution admission ordering |
| `modules/source/src/connector-execution-coordinator.test.ts` | Canonical replay matrix A–F와 connector/lease/checkpoint zero-effect assertions |
| `modules/source/src/connector-durable-persistence.test.ts` | Lease, crash-window, atomicity 및 checkpoint restart evidence |
| `modules/source/src/connector-runtime-application.test.ts` | Trusted tenant/scope/concealment before replay disclosure |
| `apps/api/src/connector-api-http-runtime.test.ts` | API-018 HTTP restart/retry matrix와 safe errors |
| `modules/source/src/external-integration-durable-persistence.test.ts` | Mapping, observation, suspension, conflict evidence restart matrix |
| `apps/api/src/external-integration-http-runtime.test.ts` | API-018→API-019 composed restart and suspended containment |
| `modules/source/src/f18-restart-authority-architecture.test.ts` | Process-local production authority 0 및 forbidden boundary assertions |
| `docs/reviews/F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md` | Verified completion evidence |

### Task 1: Canonical exact replay ordering

**Files:**
- Modify: `modules/source/src/connector-execution-coordinator.test.ts`
- Modify: `modules/source/src/connector-execution-coordinator.ts:40-82`

**Interfaces:**
- Consumes: `DurableConnectorExecutionUnitOfWork.findIdempotency(scope, key)`, `findInvocation(scope, invocationId)`, `SourceIngestionAdmissionGate.evaluate(input)`.
- Produces: `ConnectorExecutionCoordinator.execute(input)` with exact replay before live admission and unchanged `ConnectorExecutionResult`.

- [ ] **Step 1: Add RED tests for completed and ambiguous replay under blocked live admission**

```ts
test("F18-F completed exact replay bypasses blocked execution admission without new effects", () => {
  // First coordinator executes and commits SUCCEEDED.
  // Reopened coordinator uses blocked admission and a connector that must not run.
  assert.deepEqual(replay, firstResult);
  assert.equal(replayAdapter.invocationCount, 0);
  assert.equal(reopened.findCheckpoint(scope)?.version, 1);
  assert.equal(reopened.findLease(scope)?.leaseId, originalLeaseId);
});

test("F18-F ambiguous exact replay bypasses blocked execution admission without blind rerun", () => {
  // Seed PREPARED + EXECUTION_STARTED, close, reopen, use blocked admission.
  assert.deepEqual(replay, {
    status: "AMBIGUOUS",
    reasonCode: "RECONCILIATION_REQUIRED",
    invocationId,
  });
  assert.equal(replayAdapter.invocationCount, 0);
  assert.equal(reopened.findCheckpoint(scope), undefined);
});
```

- [ ] **Step 2: Run the two tests and prove the expected RED**

Run:

```powershell
pnpm.cmd build
node --test --test-name-pattern="F18-F (completed|ambiguous) exact replay" dist/modules/source/src/connector-execution-coordinator.test.js
```

Expected: both fail because current code returns `BLOCKED` before durable replay lookup; connector calls remain 0.

- [ ] **Step 3: Add RED conflict and new-invocation controls**

```ts
test("F18-F conflicting replay fingerprint fails before admission and mutation", () => {
  assert.throws(() => replayExecution.execute(conflictingInput), { code: "IDEMPOTENCY_CONFLICT" });
  assert.equal(adapter.invocationCount, 0);
  assert.equal(store.findCheckpoint(scope)?.version, 1);
});

test("F18-F new invocation still requires current live admission", () => {
  assert.deepEqual(blockedExecution.execute(newInvocationInput), {
    status: "BLOCKED",
    reasonCode: "ADMISSION_DENIED",
  });
  assert.equal(adapter.invocationCount, 0);
  assert.equal(store.findInvocation(scope, newInvocationId), undefined);
});
```

- [ ] **Step 4: Implement the minimum replay-before-admission ordering**

Add a private/local helper that derives the persistence scope from the already trusted `admissionInput` and checks the existing idempotency record:

```ts
const replayScope = scopeFromAdmissionInput(input.admissionInput);
const priorIdempotency = persistence.findIdempotency(replayScope, input.idempotencyKey);
if (priorIdempotency !== undefined) {
  if (
    priorIdempotency.invocationId !== input.invocationId
    || priorIdempotency.inputFingerprint !== input.inputFingerprint
  ) throw new ConnectorPersistenceError("IDEMPOTENCY_CONFLICT", "Connector idempotency identity conflicts.");
  const prior = persistence.findInvocation(replayScope, input.invocationId);
  if (prior === undefined) throw new ConnectorPersistenceError("PERSISTENCE_UNAVAILABLE", "Connector invocation linkage is invalid.");
  return resultFrom(prior);
}

const admission = admission.evaluate(input.admissionInput);
```

`scopeFromAdmissionInput()`은 trusted Application boundary가 전달한 기존 `SourceIngestionAdmissionInput`의 `tenantId`, `scope`, `sourceId`, `connectorId`만 immutable `ConnectorExecutionScope`로 복사한다. Actor, capability 또는 caller-authored retry data를 authority로 만들지 않는다.

Remove the duplicate post-admission idempotency block. Do not modify result types, UoW methods or schema.

- [ ] **Step 5: Run Task 1 focused tests**

```powershell
pnpm.cmd build
node --test dist/modules/source/src/connector-execution-coordinator.test.js
```

Expected: all coordinator tests PASS; exact replay has connector/lease/checkpoint mutation 0; new blocked invocation remains blocked.

### Task 2: Trusted access and concealment before replay disclosure

**Files:**
- Modify: `modules/source/src/connector-runtime-application.test.ts`
- Modify only if RED proves a defect: `modules/source/src/connector-runtime-application.ts`

**Interfaces:**
- Consumes: existing `ConnectorRuntimeContextResolver`, `ConnectorRuntimeAuthorizer`, request/body binding checks.
- Produces: evidence that historical replay cannot be read across session, tenant, scope, source or connector boundaries.

- [ ] **Step 1: Add Application-level access tests**

```ts
test("F18-F wrong tenant or scope cannot disclose a durable prior invocation", () => {
  // Seed prior result under tenant-1/source-1.
  // Resolve a trusted tenant-2 or source-2 context and submit the same public command identity.
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(["FORBIDDEN", "NOT_FOUND"].includes(result.error.code));
  assert.equal(adapter.invocationCount, 0);
});

test("F18-F inactive session cannot disclose a durable prior invocation", () => {
  assert.deepEqual(result, {
    ok: false,
    error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
  });
});
```

- [ ] **Step 2: Run the access tests**

```powershell
pnpm.cmd build
node --test --test-name-pattern="F18-F .*cannot disclose" dist/modules/source/src/connector-runtime-application.test.js
```

Expected: PASS using existing Application boundary. If a test fails, stop and inspect the first failing access check; do not add coordinator authorization.

- [ ] **Step 3: Run Task 1+2 regression**

```powershell
node --test dist/modules/source/src/connector-execution-coordinator.test.js dist/modules/source/src/connector-runtime-application.test.js
```

Expected: PASS.

### Task 3: Connector lease, crash-window and checkpoint restart matrix

**Files:**
- Modify: `modules/source/src/connector-durable-persistence.test.ts`
- Modify: `modules/source/src/connector-execution-coordinator.test.ts`
- Modify only on proven RED: `modules/source/src/connector-durable-persistence.ts`

**Interfaces:**
- Consumes: existing durable lease, invocation, idempotency, checkpoint and evidence methods.
- Produces: restart evidence for windows A–F without new persistence API.

- [ ] **Step 1: Add lease restart tests**

```ts
test("F18-F active lease survives reopen and a conflicting live lease remains blocked", () => {
  first.acquireLease(leaseInput()); first.close();
  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  assert.equal(reopened.findLease(scope)?.status, "ACTIVE");
  assert.throws(() => reopened.acquireLease(conflictingLeaseInput), { code: "LEASE_CONFLICT" });
});

test("F18-F expired lease cannot reactivate after reopen", () => {
  first.acquireLease(leaseInput()); first.close();
  const reopened = new DurableConnectorExecutionUnitOfWork({ databasePath });
  reopened.expireLeases(afterExpiry);
  assert.equal(reopened.findLease(scope)?.status, "EXPIRED");
});
```

- [ ] **Step 2: Add crash windows B, D, E and F tests**

Use the existing public UoW methods to seed `PREPARED`, `EXECUTION_STARTED`, terminal result and checkpoint. For window D, wrap `completeInvocation()` in a test persistence decorator that throws before delegating; close and reopen the real store.

Assertions:

```ts
assert.equal(reopened.findInvocation(scope, invocationId)?.state, "AMBIGUOUS");
assert.equal(reopened.findCheckpoint(scope), undefined);
assert.equal(replayAdapter.invocationCount, 0);
assert.equal(completedReplayCheckpoint.version, 1);
```

- [ ] **Step 3: Run durability focused tests**

```powershell
pnpm.cmd build
node --test dist/modules/source/src/connector-durable-persistence.test.js dist/modules/source/src/connector-execution-coordinator.test.js
```

Expected: PASS. Modify persistence only if a new test is RED for the exact invariant, and keep the correction inside the existing transaction/UoW.

### Task 4: API-018 HTTP restart and replay safety

**Files:**
- Modify: `apps/api/src/connector-api-http-runtime.test.ts`
- Modify only on proven RED: existing API-018 Application/HTTP files.

**Interfaces:**
- Consumes: existing API-018 test Application/Host/HTTP composition, closed API-018 operations, durable database path. Production composition은 fail-closed/unavailable assertion에만 사용한다.
- Produces: composed replay evidence across close/reopen.

- [ ] **Step 1: Add a table-driven technical command replay test**

Cover:

```ts
const replayCases = [
  "RegisterConnectorInstance",
  "SubmitCaptureBatch",
  "LeaseApprovedDelivery",
  "ReportDeliveryAttempt",
  "SubmitExternalObservation",
  "ReportHealth",
] as const;
```

For each applicable operation, use the existing no-network test composition to execute once, close the durable persistence, reopen the same database, replay the same body/session, and assert the same safe result plus durable record count/version unchanged. For conflicting payload with the same idempotency key, assert HTTP 409 and mutation 0. Do not use `createProductionConnectorApi018Composition` to manufacture a successful capture because production intentionally selects the unavailable connector.

- [ ] **Step 2: Verify internal-only checkpoint remains closed**

```ts
assert.equal((await http.handle(commandRequest({ operation: "AdvanceCheckpoint" }))).statusCode, 400);
```

- [ ] **Step 3: Run API-018 focused tests**

```powershell
pnpm.cmd build
node --test dist/apps/api/src/connector-api-http-runtime.test.js dist/modules/source/src/connector-api-contracts.test.js dist/modules/source/src/connector-api-durable-records.test.js dist/modules/source/src/connector-runtime-application.test.js dist/modules/source/src/connector-runtime-host.test.js
```

Expected: PASS; no new HTTP operation or schema.

### Task 5: API-019 mapping, observation and suspension restart safety

**Files:**
- Modify: `modules/source/src/external-integration-durable-persistence.test.ts`
- Modify: `apps/api/src/external-integration-http-runtime.test.ts`
- Modify only on proven RED: existing API-019 persistence/application files.

**Interfaces:**
- Consumes: `DurableExternalIntegrationStore`, API-019 Application, API-018 observation sink.
- Produces: composed restart evidence without F19 execution.

- [ ] **Step 1: Add stable mapping/conflict evidence reopen test**

```ts
assert.equal(reopened.readMappingByExternal(scope, provider, externalId)?.internalResourceId, "source-1");
assert.equal(reopened.listEvidence(scope, contractId).filter(e => e.kind === "MAPPING_CONFLICT").length, 1);
```

Replay the accepted mapping and conflicting remap after reopen; assert stable `mappingId`, version and established binding.

- [ ] **Step 2: Add observation restart idempotency test**

Assert exact replay count 1 and conflicting normalized payload returns `IDEMPOTENCY_CONFLICT` with count 1.

- [ ] **Step 3: Add composed suspended-contract restart test**

Create API-018 and API-019 compositions, persist one observation and suspension, close both, reopen both with the same database files, then submit another API-018 observation. Assert safe 403/concealed result, API-019 observation count unchanged and reads still return the suspended contract.

- [ ] **Step 4: Add technical reconciliation restart test**

Assert proof vocabulary remains closed, prior mapping unchanged, reconciliation evidence history retained, and unresolved proof remains `UNRESOLVED_CONFLICT / F19_HANDOFF_REQUIRED` without business mutation.

- [ ] **Step 5: Run API-019 focused tests**

```powershell
pnpm.cmd build
node --test dist/modules/source/src/external-integration-api-contracts.test.js dist/modules/source/src/external-integration-durable-persistence.test.js dist/modules/source/src/external-integration-application.test.js dist/apps/api/src/external-integration-http-runtime.test.js
```

Expected: PASS; F19 implementation 0.

### Task 6: Safe reload and process-local authority architecture assertions

**Files:**
- Create: `modules/source/src/f18-restart-authority-architecture.test.ts`
- Modify only on proven RED: existing DTO reconstruction or persistence read functions.

**Interfaces:**
- Consumes: production composition source text/import graph and safe read DTOs.
- Produces: architecture evidence that production authority is durable and reloaded output cannot expose forbidden evidence.

- [ ] **Step 1: Add architecture assertions**

Read the production composition and F18 source files as text and assert:

```ts
assert.equal(productionComposition.includes("new Map"), false);
assert.equal(productionComposition.includes("new Set"), false);
assert.match(productionComposition, /DurableConnectorExecutionUnitOfWork/);
assert.match(externalComposition, /DurableExternalIntegrationStore/);
```

Exclude contract-parser constant Sets and explicitly test-only adapters from the authority count.

- [ ] **Step 2: Add reopened safe DTO assertions**

Persist only canonical bounded data, reopen, query through Application/HTTP, serialize the response, and assert absence of:

```ts
for (const forbidden of ["Bearer ", "authorization", "cookie", "token", "secret", ".sqlite", "node:sqlite", "stack"]) {
  assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
}
```

- [ ] **Step 3: Run architecture/safety tests**

```powershell
pnpm.cmd build
node --test dist/modules/source/src/f18-restart-authority-architecture.test.js dist/apps/api/src/connector-api-http-runtime.test.js dist/apps/api/src/external-integration-http-runtime.test.js
```

Expected: PASS. Any RED must be traced to a production disclosure path before a source correction is allowed.

### Task 7: Regression and completion evidence

**Files:**
- Create: `docs/reviews/F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md`
- Do not modify RTM/frozen registries unless separately authorized.

**Interfaces:**
- Consumes: verified outputs from Tasks 1–6.
- Produces: F18-F review package; no commit or push.

- [ ] **Step 1: Run focused F18-F matrix**

```powershell
pnpm.cmd build
node --test dist/modules/source/src/connector-execution-coordinator.test.js dist/modules/source/src/connector-durable-persistence.test.js dist/modules/source/src/connector-runtime-application.test.js dist/apps/api/src/connector-api-http-runtime.test.js dist/modules/source/src/external-integration-durable-persistence.test.js dist/apps/api/src/external-integration-http-runtime.test.js dist/modules/source/src/f18-restart-authority-architecture.test.js
```

Record exact pass count.

- [ ] **Step 2: Run F18-B/C/D/E and affected F17 regressions**

Use the existing compiled test runner or explicit affected files. Record exact counts and the first failure if any; do not broaden source changes without a proven F18-F cause.

- [ ] **Step 3: Run one final full suite and static gates**

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd verify
pnpm.cmd test
```

Required: all exit 0 and all tests PASS.

- [ ] **Step 4: Run integrity/security gates**

```powershell
git diff --check
gitleaks detect --source . --no-git --no-banner --redact --exit-code 1
```

Confirm frozen Architecture scope changes 0 and checksum 153/153 preserved. Confirm `package.json` and `pnpm-lock.yaml` changes 0.

- [ ] **Step 5: Audit only if scoped approval exists**

If F18-F audit authorization has not been supplied, record `NOT_RUN — scoped approval required` and stop before audit. Do not access another destination or modify dependencies.

- [ ] **Step 6: Perform fresh bounded review**

Review replay/access ordering, zero-effect assertions, crash windows, API contracts, safe reload, authority count, exclusions and test assertions. Required unresolved Critical 0 / Important 0 before approval recommendation.

- [ ] **Step 7: Write the completion report**

Record every field required by the F18-F brief, exact commands/counts, audit status, main/worktree state, `Commit: NOT_CREATED`, `Push: NOT_PERFORMED`, and `F19: NOT_STARTED`.

- [ ] **Step 8: Final workspace validation**

```powershell
git diff --check
git status --short
git -C "D:\04. AI-MLS" status --short
```

Expected: main clean; isolated worktree intentionally dirty with F18-F-only reviewed changes. Stop for Architecture Owner review. Do not commit.
