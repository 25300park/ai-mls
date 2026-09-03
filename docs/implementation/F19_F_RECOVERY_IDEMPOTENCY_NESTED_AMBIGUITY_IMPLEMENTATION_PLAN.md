# F19-F Recovery Idempotency / Nested Ambiguity Hardening Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | F19-F-PLAN |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |
| Date | 2026-09-03 |

## Goal

동일 `recoveryId`의 canonical execution fingerprint와 authoritative result를 existing durable F19 store에 append-only로 보존하고, authorized recovery execution X2가 ambiguous가 되면 X2를 origin으로 하는 독립 `OPEN` child case RC2를 생성한다.

## Architecture

[F19 canonical design](F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)의 existing `RecoveryOrchestrationStore`를 확장해 recovery execution claim/result evidence를 durable하게 기록한다. Publication과 Connector recovery handoff는 execution 전에 F19 claim을 확인하고, exact completed replay는 domain path를 호출하지 않으며, 신규 claim은 기존 F17/F18 durable execution path로만 넘긴 뒤 authoritative result를 F19에 기록한다. Domain idempotency는 crash-window와 same execution identity의 두 번째 보호층으로 유지한다.

Nested ambiguity는 existing `createCase()`와 `parentRecoveryCaseId`를 사용한다. Durable store는 parent RC1이 terminal `CONFIRMED_NOT_EXECUTED + RECOVERY_AUTHORIZED`인지, child origin이 bound `recoveryExecutionIdentity` X2인지, tenant/scope/domain lineage가 일치하는지 원자적으로 검증한다. 새 API, lifecycle state, authority, orchestrator, persistence subsystem 또는 dependency를 추가하지 않는다.

## Tech Stack

TypeScript 6, Node.js 24.18.0, `node:sqlite`, `node:test`, existing F17 Publication UoW와 F18 Connector durable coordinator.

## Canonical sources

- F19 Continuous Execution Brief Part 6 — F19-F
- [F19 canonical design](F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)
- [F19-B plan](F19_B_RECONCILIATION_BOUNDARY_IMPLEMENTATION_PLAN.md) 및 [completion](../reviews/F19_B_RECONCILIATION_CASE_EVIDENCE_RECOVERY_IDENTITY_IMPLEMENTATION_REPORT.md)
- [F19-C plan](F19_C_PUBLICATION_RESOLVE_RECOVER_IMPLEMENTATION_PLAN.md) 및 [completion](../reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_SEPARATION_IMPLEMENTATION_REPORT.md)
- [F19-D plan](F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_IMPLEMENTATION_PLAN.md) 및 [completion](../reviews/F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_COMPLETION.md)
- [F19-E plan](F19_E_API_019_BUSINESS_HANDOFF_IMPLEMENTATION_PLAN.md) 및 [completion](../reviews/F19_E_API_019_BUSINESS_HANDOFF_COMPLETION.md)

## Global constraints

- RED test가 intended missing behavior로 실패하기 전에 production code를 변경하지 않는다.
- original attempt/invocation, RC1, finding, disposition, `recoveryId`, execution identity와 evidence를 덮어쓰지 않는다.
- F19 replay가 external execution 0을 보장하고 F17/F18 domain idempotency를 제거하거나 우회하지 않는다.
- process-local cache, new public/internal operation, runtime/API-017 composition, F19-G/H, provider/network/credential 및 dependency 변경을 추가하지 않는다.
- commit과 push를 수행하지 않고 F19-F 파일만 stage한다.

## Task 1: RED — canonical durable execution idempotency and lineage

**Files:**

- Modify: `modules/recovery/src/recovery-durable-persistence.test.ts`
- Modify: `modules/recovery/src/recovery-orchestration-architecture.test.ts`
- Test: `modules/publication/src/publication-reconciliation-service.test.ts`
- Test: `modules/source/src/connector-recovery-handoff.test.ts`

- [x] 같은 `recoveryId + fingerprint` duplicate, conflicting fingerprint, RC1 overwrite, original identity reuse, missing parent, restart linkage loss, process-local authority, nested auto-recovery 및 evidence overwrite가 현재 구현에서 실패하는 direct negative tests를 추가한다.
- [x] `& '.\\node_modules\\.bin\\tsc.cmd' -b tsconfig.build.json` 후 four focused compiled tests를 실행해 intended RED failure와 count를 기록한다.

## Task 2: GREEN — existing store and domain paths only

**Files:**

- Modify: `modules/recovery/src/recovery-orchestration-contracts.ts`
- Modify: `modules/recovery/src/recovery-durable-persistence.ts`
- Modify: `modules/publication/src/publication-reconciliation-service.ts`
- Modify: `modules/publication/src/publication-infrastructure-configuration.ts`
- Modify: `modules/publication/src/publication-infrastructure.ts`
- Modify: `modules/source/src/connector-execution-coordinator.ts`
- Modify: `modules/source/src/connector-recovery-handoff.ts`

- [x] Existing SQLite store에 immutable execution claim/result rows와 exact fingerprint conflict check를 추가한다.
- [x] Parent authorization과 bound X2 identity를 검증하는 child-case guard를 `createCase()`에 추가한다.
- [x] Publication/Connector recovery handoff가 completed F19 replay를 domain path 전에 반환하고, 신규 execution은 기존 F17/F18 path를 거친 뒤 result를 기록하게 한다.
- [x] Ambiguous Connector input에 existing optional `parentRecoveryCaseId`를 전달해 current coordinator/writer path가 RC2를 생성하게 한다.
- [x] Durable X2가 ambiguous로 남은 뒤 RC2 writer가 실패한 exact retry는 external invocation 없이 existing writer를 재호출하고, `DUPLICATE_ORIGIN`은 existing adapter에서 idempotent success로 처리한다.
- [x] Connector execution fingerprint는 caller authorization claim이 아니라 durable authorized view의 full case/finding/disposition/binding/evidence tuple과 trusted execution inputs를 결합한다.
- [x] focused tests를 실행해 GREEN을 확인하고 existing F19-B/C/D affected regression을 함께 통과시킨다.

## Task 3: Restart matrix, traceability and completion evidence

**Files:**

- Modify only with verified evidence: `docs/implementation/FEAT019_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY_COMPLETION.md`

- [x] Durable reopen 뒤 RC1→R1→X2→RC2, claim/result fingerprint와 evidence reference가 동일한지 직접 검증한다.
- [x] focused/affected/restart matrix, lint, typecheck, clean build, compiled full test, verify-equivalent gate와 `git diff --check`를 fresh 실행한다.
- [x] `git diff -- package.json pnpm-lock.yaml`이 0이고 local `node_modules` junction을 제거했는지 확인한다.
- [x] verified F19-F evidence만 RTM/completion report에 기록하고 F19-F 파일만 stage한다.

## Plan self-review

- Spec coverage: F19-F1~F5, required negative tests 9개, restart와 F17/F18 second protection이 Tasks 1~3에 모두 매핑된다.
- Type consistency: F19은 recovery execution claim/result와 lineage만 소유하고 Publication attempt/command 및 Connector invocation/result truth는 owning domain에 남는다.
- Scope: F19-G/H, public API, process-local production fallback, new authority/state/persistence subsystem 및 dependency는 없다.
