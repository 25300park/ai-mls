# F18-B Source Ingestion Admission Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 Source, Connector, tenant/team scope, purpose/method, version 및 live authority가 모두 일치할 때만 deterministic `ELIGIBLE`을 반환하는 read-only Source ingestion admission boundary를 구현한다.

**Architecture:** `modules/source`에 하나의 pure admission gate와 read-only Source/Connector eligibility ports를 추가한다. Gate는 기존 `AuthorizationService.evaluate()` 계약을 소비하고 state mutation, connector invocation, lease, checkpoint 또는 persistence를 소유하지 않는다. 모든 dependency failure와 mismatch는 safe `BLOCKED/ADMISSION_DENIED`로 fail closed한다.

**Tech Stack:** TypeScript 6, Node.js 24 `node:test`, existing Authorization/Session contracts, pnpm 11.9.0.

**Spec:** `C:\Users\Pc\.codex\attachments\90fd8a5c-096f-42c5-a9e6-8d98a50b85b9\pasted-text.txt`

## Global Constraints

- F18-B only; F18-C durable lease/invocation/checkpoint work is forbidden.
- No API-018/019 operation, Source lifecycle state, business authority or reconciliation semantic may be added.
- Production credentials, provider adapters, destination policy and network activation remain `0`.
- Blocked admission must yield connector invocation `0` and authoritative mutation `0`.
- Existing F16/F17 ownership and behavior remain unchanged.

---

### Task 1: Source ingestion admission gate

**Files:**
- Create: `modules/source/src/source-ingestion-admission.test.ts`
- Create: `modules/source/src/source-ingestion-admission.ts`
- Modify: `modules/source/src/index.ts`

**Interfaces:**
- Consumes: `SessionContext`, `AuthorizationService.evaluate()` compatible read-only port.
- Produces: `SourceIngestionAdmissionGate.evaluate(input): SourceIngestionAdmissionDecision`.
- Produces read-only ports `SourceIngestionPolicyReader` and `ConnectorAdmissionReader`.

- [x] **Step 1: Write the first failing test**

Create a test that supplies an otherwise valid request but returns an inactive Connector snapshot. Assert the literal decision `{ status: "BLOCKED", reasonCode: "ADMISSION_DENIED" }`, then show a downstream connector counter remains `0` and immutable Source/Connector snapshots remain unchanged.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm.cmd build
```

Expected: FAIL because `source-ingestion-admission.js` does not exist.

- [x] **Step 3: Implement the minimum gate**

Implement these bounded contracts:

```typescript
export interface SourceIngestionAdmissionInput {
  readonly actor: SessionContext;
  readonly tenantId: string;
  readonly sourceId: string;
  readonly sourcePolicyVersion: number;
  readonly connectorId: string;
  readonly connectorVersion: number;
  readonly method: string;
  readonly purpose: string;
  readonly correlationId: string;
}

export type SourceIngestionAdmissionDecision =
  | Readonly<{ readonly status: "ELIGIBLE"; readonly sourceId: string; readonly sourcePolicyVersion: number; readonly connectorId: string; readonly connectorVersion: number; readonly tenantId: string; readonly teamId?: string; readonly purpose: string; readonly method: string }>
  | Readonly<{ readonly status: "BLOCKED"; readonly reasonCode: "ADMISSION_DENIED" }>;
```

Read authoritative snapshots from injected ports, validate exact identity/version/status/tenant/team/source/method/purpose bindings, then require `source.read` and `intake.create` authorization decisions to be `ALLOW`. Catch dependency errors and return the same safe blocked result. Do not accept caller-authored history or invoke/persist anything.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
pnpm.cmd build
node --test dist/modules/source/src/source-ingestion-admission.test.js
```

Expected: PASS.

### Task 2: Admission prerequisite matrix

**Files:**
- Modify: `modules/source/src/source-ingestion-admission.test.ts`
- Modify only if required by RED: `modules/source/src/source-ingestion-admission.ts`

**Interfaces:**
- Consumes/produces Task 1 contracts without expansion.

- [x] **Step 1: Add RED cases one behavior at a time**

Add literal assertions for missing/inactive Source, stale Source version, wrong tenant, wrong team, connector/source mismatch, inactive/stale Connector, disallowed method, disallowed purpose, denied live authority and dependency failure. Each BLOCKED case must preserve invocation counter `0` and authoritative fixture values. Add one positive exact-binding `ELIGIBLE` test.

- [x] **Step 2: Verify each new case RED for the missing validation**

Run the focused compiled test after each case. Expected: the newly added case fails because the corresponding prerequisite is not yet checked.

- [x] **Step 3: Add only the missing validation branch**

Return the existing safe blocked result; do not add reason vocabulary or side effects.

- [x] **Step 4: Verify focused GREEN**

Run:

```powershell
pnpm.cmd build
node --test dist/modules/source/src/source-ingestion-admission.test.js
```

Expected: all F18-B admission tests PASS.

### Task 3: Regression and completion evidence

**Files:**
- Create: `docs/reviews/F18_B_SOURCE_INGESTION_ADMISSION_BOUNDARY_COMPLETION.md`
- Preserve: `docs/reviews/F18_SOURCE_CONNECTOR_RUNTIME_INVENTORY_GAP_REPORT.md`

- [x] **Step 1: Run affected Source and authorization regression**

```powershell
pnpm.cmd build
node --test dist/modules/source/src/source-ingestion-admission.test.js dist/modules/source/src/source-registry-service.test.js dist/modules/source/src/raw-source-store.test.js dist/apps/api/src/source-intake-api.test.js dist/modules/authorization/src/authorization-service.test.js
```

- [x] **Step 2: Run static gates**

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
```

- [x] **Step 3: Inspect scope and write completion report**

Record RED/GREEN evidence, focused/affected results, Production network/credential/provider count `0`, mutation/invocation containment, files changed, limitations and F18-C `NOT_STARTED`. Do not claim F18 complete.

- [x] **Step 4: Validate the change set**

```powershell
git diff --check
git status --short
```

Confirm no dependency/lockfile change and no F18-C implementation. Stop for Architecture Owner review before F18-C.
