# F19-E API-019 Unresolved Business Handoff Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | F19-E-PLAN |
| 문서 버전 | v0.2 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |

## Goal

API-019 `UNRESOLVED_CONFLICT` technical reconciliation evidence를 정확히 하나의 immutable `EXTERNAL_INTEGRATION` F19 recovery case에 연결하되, F19이 API-019 mapping, observation, conflict evidence, Integration Contract 상태 또는 business truth를 변경하지 못하게 한다.

## Architecture

`DurableExternalIntegrationStore.reconcileEvidence()`는 저장된 observation의 exact contract/mapping binding을 검증하고 이미 append한 `TECHNICAL_RECONCILIATION` evidence의 identity를 기존 internal command result에 포함한다. `ExternalIntegrationEvidenceApplication`은 결과가 `UNRESOLVED_CONFLICT`일 때만 injected one-way case writer를 호출한다. Writer adapter는 existing `DurableRecoveryOrchestrationStore.createCase()`만 소비하고 `integrationContractId + mappingId + observationId + conflictEvidenceId`, trusted tenant/scope, 그리고 API-019 evidence reference를 F19 case에 전달한다. `DUPLICATE_ORIGIN`은 exact replay로 취급하며 API-019 evidence를 복제하지 않는다. Existing recovery application은 `EXTERNAL_INTEGRATION` origin에 `UNRESOLVED` finding만 허용하고 모든 executable recovery disposition을 거부한다.

## Tech Stack

TypeScript, Node.js 24 `node:sqlite`, `node:test`, existing API-019 durable store/application 및 F19 durable orchestration store.

## Canonical sources

- F19 Continuous Execution Brief Part 5 — F19-E
- [F19 Reconciliation / Recovery Canonical Design V1](F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)
- [F18-E API-019 Implementation Report](../reviews/F18_E_API_019_EXTERNAL_EVIDENCE_MAPPING_IMPLEMENTATION_REPORT.md)
- [FEAT-019 Traceability Matrix](FEAT019_TRACEABILITY_MATRIX.md)

## Global constraints

- API ID, API-019 operation/state, recovery authority/capability, persistence subsystem 및 dependency를 추가하지 않는다.
- F19은 API-019 repository를 직접 mutate하지 않고 existing F19 `createCase`, finding 및 disposition 경계만 사용한다.
- canonical corrective API-019 operation이 없으므로 `RECOVERY_AUTHORIZED` 또는 automatic contract reactivation을 만들지 않는다.
- suspended Integration Contract의 기존 read/evidence review는 유지하고 새 API-019 mutation과 Connector recovery execution은 기존 경계에서 계속 차단한다.
- commit, push, real provider/network 및 F20 변경은 수행하지 않는다.

## Task 1: RED — durable unresolved linkage and zero-side-effect containment

**Files:**

- Modify: `modules/source/src/external-integration-application.test.ts`
- Create: `modules/source/src/external-integration-recovery-handoff.test.ts`

- [x] 실제 API-019 store/application과 실제 F19 durable store를 구성한다.
- [x] unresolved reconciliation이 `integrationContractId + mappingId + conflictEvidenceId`와 evidence reference를 가진 case 한 건만 생성하는 assertion을 추가한다.
- [x] exact replay가 API-019 evidence와 F19 case/version/evidence를 중복 생성하지 않는 assertion을 추가한다.
- [x] mapping overwrite/remap, conflict-evidence delete, observation verification, business-truth 승격, contract reactivation, wrong tenant/scope disclosure, API-019 recovery authority 및 F19 direct API-019 mutation 시도가 모두 거부되고 두 store snapshot이 동일한 negative assertions를 추가한다.
- [x] focused compiled test를 실행하여 case linkage가 발생하지 않는 이유로 RED임을 확인한다.

## Task 2: GREEN — one-way handoff

**Files:**

- Create: `modules/source/src/external-integration-recovery-handoff.ts`
- Modify: `modules/source/src/external-integration-durable-persistence.ts`
- Modify: `modules/source/src/external-integration-application.ts`
- Modify: `modules/source/src/index.ts`
- Modify: `modules/recovery/src/recovery-orchestration-service.ts`
- Modify: `apps/api/src/external-integration-production-composition.ts`
- Modify: direct construction tests only where the new required injected writer must be supplied

- [x] `appendEvidence()`가 existing immutable evidence record를 반환하고 unresolved result가 그 `conflictEvidenceId`를 전달하게 한다.
- [x] `ExternalIntegrationUnresolvedConflictCaseWriterAdapter`가 existing F19 `createCase()`만 호출하고 `DUPLICATE_ORIGIN`만 idempotent replay로 처리하게 한다.
- [x] application이 unresolved 결과에만 trusted scope/actor/time과 exact origin/evidence identity를 writer로 전달하게 한다.
- [x] production composition이 writer 누락을 fail closed하고 injected writer를 application에 전달하게 한다.
- [x] focused tests를 다시 실행하여 GREEN을 확인한다.

## Task 3: Affected verification and evidence

**Files:**

- Modify: `docs/implementation/FEAT019_TRACEABILITY_MATRIX.md`
- Create: `docs/reviews/F19_E_API_019_BUSINESS_HANDOFF_COMPLETION.md`

- [x] F19-E, API-019, F19-B/D 및 composed API-018/API-019 affected tests를 실행한다.
- [x] lint, typecheck, clean build 및 `git diff --check`를 실행한다.
- [x] `package.json`과 `pnpm-lock.yaml` diff가 0인지 확인한다.
- [x] 실제 검증 evidence만 RTM과 completion report에 기록한다.
- [x] F19-F를 시작하지 않고 F19-E 파일만 stage한다.

## Review Round 1

- [x] privileged human과 permissive authorizer/identity validator를 사용한 actual terminal finding 및 `CONNECTOR_REEXECUTION` RED를 재현한다.
- [x] `EXTERNAL_INTEGRATION` origin은 `UNRESOLVED` finding만 append하고 `AUTHORIZE_RECOVERY`를 획득하지 못하도록 existing recovery application에 origin guard를 추가한다.
- [x] reconciliation `observationIds`를 existing observation 및 exact mapping binding에 대조하고 missing/cross-binding을 technical evidence와 case mutation 전에 거부한다.
- [x] exact `integrationContractId + mappingId + observationId + conflictEvidenceId` lineage와 API-019/F19 zero-side-effect를 actual durable stores로 검증한다.
- [x] 기존 Publication/Connector recovery regression을 포함한 affected gate를 재실행한다.
