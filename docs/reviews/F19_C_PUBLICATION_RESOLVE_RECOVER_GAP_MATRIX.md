# F19-C Publication Resolve / Recover Gap Matrix

| 항목 | 값 |
|---|---|
| Document Version | v0.1 |
| Status | DRAFT |
| Baseline | `7ef0c809c5f1ec1c6d7791d4856662234831a37d` |
| Scope | F19-C pre-implementation inventory |

## Current Path Matrix

| Operation | Current input | Current service path | Current authority | State mutation | Provider invocation possibility | Identity behavior | Idempotency behavior | Exact gap |
|---|---|---|---|---|---|---|---|---|
| `RESOLVE_RECONCILIATION` | `PublicationReconciliationRequest`: Publication identity, execution context, `expectedAggregateVersion`, `caseId`, recovery category, optional resolution, trusted evidence, optional external reference, Domain command | `PublicationApi.executeCommand` → `PublicationReconciliationService.reconcile()` → shared `coordinate()` → `PublicationApplicationService.executeAuthorized()` → Domain `RESOLVE_RECONCILIATION` | Session-derived Publication actor, `publication.reconciliation.resolve`, tenant/team/purpose, MFA/SoD, live effective approval, exact binding and version | Resolves the existing Publication reconciliation case or appends an audit-only manual/no-action decision | 0; no connector/provider path is called | No execution attempt or command identity is created | Publication idempotency key + intent fingerprint; replay is reconstructed from append-only audit/idempotency evidence | Final resolve semantics are substantially present, but the shared service/type still labels resolution decisions as recovery and shares the same public operation branch with Recover. |
| `RECOVER_PUBLICATION` | Exactly the same `PublicationReconciliationRequest` as Resolve; no `recoveryId`, durable recovery binding, or distinct execution request | `PublicationApi.executeCommand` → `PublicationReconciliationService.recover()` → the same shared `coordinate()` → Domain `RESOLVE_RECONCILIATION` | Exactly the same `publication.reconciliation.resolve` authorization and approval path as Resolve | Resolves the Publication reconciliation case or records a manual/no-action decision; it does not begin a new execution attempt | 0 in the current path; the current operation cannot produce the required recovery effect | No trusted planner lookup; no new bound `attemptId`/`commandId`; F19-B binding is not consumed | Uses Resolve's Publication audit/idempotency identity, including the literal command `RESOLVE_RECONCILIATION`; no `recoveryId` fingerprint/result boundary | Critical semantic overlap: Recover is an alias for Resolve. Missing durable F19 authorization lookup, action/finding/disposition validation, new-identity checks, live recovery execution revalidation, F17 execution reuse, recovery replay/conflict handling and nested child-case linkage. |
| `REPUBLISH_PUBLICATION` | Lifecycle request containing existing canonical republish command, expected aggregate version, next binding where required, and caller-to-API validated attempt | `PublicationApi.executeCommand` → `PublicationLifecycleService.republishPublication()` → `PublicationApplicationService.executeAuthorized()` → Domain republish transition | Existing Publication lifecycle authorization plus effective approval and current binding/version validation | Begins the canonical active or withdrawn republish transition and adds the supplied new attempt | Yes after the existing F17 execution path continues the pending operation | Uses the republish request's `attempt.id`/`commandId`; Domain rejects duplicate identities | Existing Publication application/F17 idempotency and durable execution journal | No F19 recovery dependency is required and none should be added. Regression risk is accidental routing through the new recovery binding or treating unresolved ambiguity as republish authority. |

## Supporting Evidence

- `apps/api/src/publication-api.ts:129-141`: Republish is routed to lifecycle; Resolve and Recover are routed to the same reconciliation component.
- `apps/api/src/publication-api.ts:389-395`: untrusted HTTP reconciliation/recovery payloads are rejected.
- `modules/publication/src/publication-reconciliation-service.ts:48-58`: `reconcile()`, `recover()` and `execute()` all call the same `coordinate()` method.
- `modules/publication/src/publication-reconciliation-service.ts:73-128`: the shared path always emits Domain command `RESOLVE_RECONCILIATION`.
- `modules/publication/src/publication-reconciliation-service.ts:134-162`: the shared path authorizes only `RESOLVE_RECONCILIATION` and performs live approval checks.
- `modules/publication/src/publication-reconciliation-service.ts:165-200,256-345`: audit/idempotency evidence is keyed and recorded as `RESOLVE_RECONCILIATION`.
- `modules/publication/src/publication-lifecycle-service.ts:23-86`: Republish remains an independent lifecycle/application path.
- `modules/publication/src/publication-service.ts:115-265`: F17 execution owns eligibility, durable intent, `DISPATCH_STARTED`, provider dispatch, replay containment and outcome persistence.
- `modules/publication/src/publication-service.ts:369-378`: F17 consumes stable attempt/command identities and derives provider idempotency from them; it does not plan F19 identities.
- `modules/recovery/src/recovery-orchestration-contracts.ts:31-93`: F19-B defines terminal finding, disposition, recovery action and immutable recovery execution binding.
- `modules/recovery/src/recovery-orchestration-contracts.ts:108-134`: the current store exposes `findCase()` but no trusted lookup by `recoveryId`.
- `modules/recovery/src/recovery-durable-persistence.ts:90-121`: F19-B durably binds `CONFIRMED_NOT_EXECUTED` + `RECOVERY_AUTHORIZED` + execution identity and recovery idempotency.

## Proven F19-C Gaps

1. `RECOVER_PUBLICATION` is not effect-producing and is semantically identical to `RESOLVE_RECONCILIATION`.
2. API-014 cannot consume a durable F19-B recovery authorization by `recoveryId`; the store lacks a read-only recovery-binding lookup.
3. No trusted Publication recovery identity planner boundary is present. F17 only consumes already supplied attempt/command identities.
4. Recovery-specific idempotency cannot currently distinguish exact `recoveryId` replay from conflicting recovery input.
5. The current Recover path cannot validate original versus new attempt/command identity, recovery authorization version, resource binding, or resolver/executor SoD.
6. The current Recover path does not reuse the F17 durable execution engine and therefore cannot produce or contain `CONFIRMED`, `REJECTED`, or `UNKNOWN` recovery outcomes.
7. A nested `UNKNOWN` recovery outcome cannot create a child F19 recovery case with `parentRecoveryCaseId` while preserving the original case.
8. `REPUBLISH_PUBLICATION` is currently independent and must remain so.

## Inventory Decision

The overlap is proven. Production implementation may proceed only by separating `recover()` from the shared reconciliation path, consuming a trusted durable F19-B binding, and delegating effect-producing work to the existing F17 execution path. No new API operation or caller-authored authoritative recovery fields are justified by this inventory.
