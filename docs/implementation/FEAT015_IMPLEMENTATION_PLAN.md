# FEAT-015 Publication Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Architecture Bible v1.1의 `FEAT-015` Publication Execution을 승인된 authority, lifecycle, exact binding, idempotency, reconciliation 및 projection 경계 안에서 구현한다.

**Architecture:** `Publication` aggregate가 business truth와 lifecycle을 소유하고, `API-014` command/query adapter가 session-derived Actor를 application service에 전달한다. 외부 delivery는 provider-neutral port로 격리하며, connector evidence만 aggregate가 해석한다. Event와 Projection은 append-only evidence/read model이고 business authority를 갖지 않는다.

**Tech Stack:** Node.js 24.18.0 target, TypeScript 6.0.3 strict mode, pnpm 11.9.0, ESLint 9, Node.js built-in test runner, 현재의 in-memory service/adaptor 패턴.

## Global Constraints

- 문서 버전: `v0.1`
- 상태: `DRAFT`
- 계획 범위: `EPIC-007` / `FEAT-015` / `DEV-015` / `IMP-015`
- 기준선: content commit `426f6de0cdcf8c384f70c3e333f7b6483616bd15`, evidence commit `4117e60bda0d5bbb2a16642d749efed759e02b94`
- `Publication` aggregate, approved workflow, authorized command API와 authorized human operator만 business authority를 가진다.
- Projection, Event, Worker, Connector, AI 및 Operations는 business authority를 갖지 않는다.
- `API-013`은 exact effective Approval을 제공할 뿐 delivery 또는 Publication lifecycle을 소유하지 않는다.
- 실제 connector, credential, provider, DB, queue, event bus 또는 event store 제품은 이 계획에서 선택하지 않는다.
- production external effect는 durable idempotency/evidence boundary와 승인된 adapter가 없으면 fail closed한다.
- 모든 구현은 테스트 우선으로 진행하고, 각 task 종료 시 관련 테스트와 `pnpm lint`, `pnpm typecheck`를 통과시킨다.

---

## 1. Architecture 입력

| 영역 | Canonical reference | 구현 적용 |
|---|---|---|
| Decision | [Decision Register](../00_DECISION_REGISTER.md), `DEC-100`–`DEC-112` | aggregate, lifecycle, target/channel, revalidation, SoD, idempotency, reconciliation, correction, withdrawal, republish, projection |
| Trace | [Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md), `TRACE-015` | requirement부터 test까지의 FEAT-015 범위 |
| Publication | [Publication Registry](../00_PUBLICATION_REGISTRY.md) | canonical state, transition, version, attempt, authorization |
| Workflow | [Workflow Registry](../00_WORKFLOW_REGISTRY.md), `WF-010`–`WF-012` | command guard와 recovery 경계 |
| API | [API Registry](../00_API_REGISTRY.md), `API-014` | command/query/evidence 분리와 safe error contract |
| Security | [Security Registry](../00_SECURITY_REGISTRY.md) | Zero Trust, default deny, SoD, classification, audit, connector isolation |
| Projection | [Projection Registry](../00_PROJECTION_REGISTRY.md), `PRJ-002` 중심 | derived read model, drift, rebuild |
| Event | [Event Registry](../00_EVENT_REGISTRY.md), `EVT-003`–`EVT-012` 관련 | immutable envelope, aggregate-local ordering, replay restriction |
| Operations | [Operations Registry](../00_OPERATIONS_REGISTRY.md) | monitor, validate, recover; business command 금지 |
| Test | [Test Registry](../book-10/15_TEST_REGISTRY.md) | `TEST-002`–`004`, `008`, `011`, `012`, `023`–`025`, `033`, `049` |

## 2. 현재 코드베이스와 구현 경계

### 재사용

- `modules/publication-approval/src/publication-approval-service.ts`: `checkEffectiveApproval`, exact representation/target/channel/policy/Verification/Permission binding.
- `modules/authorization/src/authorization-service.ts`: session Actor, purpose/resource scope, role capability, MFA 및 human/service authority 판정.
- `modules/audit/src/audit-log.ts`: append-only audit event와 correction-by-reference.
- `modules/jobs/src/job-service.ts`: immutable input reference, attempt, idempotency, safe retry/successor job 패턴.
- `apps/api/src/contracts.ts`: stable `ApiResponse`, safe semantic error, correlation metadata.
- `apps/api/src/composition.ts`: API module dependency injection/composition 패턴.
- `packages/security-contracts/src/index.ts`: Actor, classification, audit, clock 및 ID contract.

### 신규 구현

- `modules/publication/`: Publication aggregate, repository port, in-memory adapter, application service, delivery/evidence port, event journal, listing projection.
- `apps/api/src/publication-api.ts`: `API-014` logical command/query surface와 `UI-031`–`UI-033` bounded view contract.
- 기존 authorization capability에 FEAT-015 command를 최소 추가하되 RoleCode는 추가하지 않는다.
- safe error allowlist, API composition/export 및 관련 regression test를 갱신한다.

### 변경하지 않는 영역

- 물리 DB schema/migration, production persistence adapter.
- 실제 route framework 또는 HTTP endpoint syntax.
- `API-018`/`API-019` 구현, connector/provider/credential 처리.
- queue, event bus, event store 제품과 worker topology.
- `API-013` approval authority 및 기존 governance 문서.

## 3. 제안 코드 contract

아래 contract는 구현 형태를 명확히 하기 위한 계획이며 canonical ID나 architecture 의미를 변경하지 않는다.

```ts
export type PublicationState =
  | "READY"
  | "EXECUTION_PENDING"
  | "ACTIVE"
  | "RECONCILIATION_REQUIRED"
  | "WITHDRAWAL_PENDING"
  | "WITHDRAWN"
  | "SUPERSEDED"
  | "TERMINATED";

export type PublicationCommandKind =
  | "PUBLISH"
  | "CORRECT"
  | "SUSPEND"
  | "RESUME"
  | "WITHDRAW"
  | "REPUBLISH"
  | "REVALIDATE"
  | "RESOLVE"
  | "RECOVER";

export interface PublicationRepository {
  read(id: string): Publication | undefined;
  readHistory(id: string): readonly Publication[];
  save(expectedVersion: number, next: Publication): void;
}

export interface PublicationDeliveryPort {
  dispatch(command: PublicationDeliveryCommand): DeliveryDispatchReceipt;
}

export interface PublicationEvidencePort {
  readObservation(attemptId: string): DeliveryObservation | undefined;
}
```

`PublicationExecutionService`는 `createPublication`, `readPublication`, `listPublications`, `publish`, `correct`, `suspend`, `resume`, `withdraw`, `republish`, `revalidate`, `resolveReconciliation`, `recover`를 제공한다. 각 mutation은 `actor`, `purpose`, `reason`, `expectedVersion`, `idempotencyKey`, `requestId?`, `correlationId`, `causationId`를 받고, live authorization 및 exact binding을 다시 검사한다.

## 4. 구현 단계

### Stage 1 — Domain Foundation

- [ ] `modules/publication/src/publication-contracts.ts`에 immutable value/object contract와 canonical union을 정의한다.
- [ ] `modules/publication/src/publication-aggregate.ts`에 `PUB-TR-001`–`PUB-TR-020` transition table과 불변식을 구현한다.
- [ ] hard guard 실패, version conflict, material/non-material correction, successor lineage 테스트를 먼저 작성한다.
- [ ] `Publication`을 mutation하지 않고 새 frozen revision을 반환하도록 한다.

검증: domain test에서 허용 transition만 성공하고 direct provider/projection transition, target/channel mutation, material change disguise가 실패한다.

### Stage 2 — Persistence Foundation

- [ ] `publication-repository.ts`에 aggregate/history, idempotency, attempt, event 및 projection port를 정의한다.
- [ ] `in-memory-publication-repository.ts`에 optimistic version check와 append-only history를 구현한다.
- [ ] 동일 key/동일 intent replay는 같은 결과, 동일 key/다른 intent는 `IDEMPOTENCY_CONFLICT`가 되도록 테스트한다.
- [ ] command state, audit evidence 및 dispatch intent가 하나의 논리적 unit-of-work에서 함께 확정되도록 `PublicationUnitOfWork` contract를 둔다.

`Database Impact`: 현재 repository에는 DB subsystem이 없으므로 migration은 만들지 않는다. production DB adapter는 [Deferred Decisions](FEAT015_DEFERRED_DECISIONS.md)의 승인 전 활성화하지 않는다.

### Stage 3 — Application Services

- [ ] `publication-service.ts`에 command/query handler를 분리한다.
- [ ] `AuthorizationService`, `PublicationApprovalService.checkEffectiveApproval`, Verification/Permission/target/connector health resolver를 조합한 dispatch-time revalidation을 구현한다.
- [ ] requester/approver/executor/resolver role stacking과 transaction actor conflict를 fail closed한다.
- [ ] reason, MFA, purpose, classification inheritance, safe audit metadata 및 no-raw-contact guard를 모든 mutation에 적용한다.
- [ ] delivery result `ACCEPTED`를 `ACTIVE`로 오인하지 않고, confirmed exact evidence만 activation을 허용한다.

### Stage 4 — API Integration

- [ ] `apps/api/src/publication-api.test.ts`에 session-derived Actor, safe error, idempotency, command/query separation 실패 테스트를 작성한다.
- [ ] `apps/api/src/publication-api.ts`에 `API-014` logical operations를 구현한다.
- [ ] `UI-031`, `UI-032`, `UI-033` view는 role/purpose별 allowed action과 safe state만 노출한다. `UI-035` audit evidence는 기존 `API-016` 링크만 제공하며 API-014가 소유하지 않는다.
- [ ] `contracts.ts`, `composition.ts`, `index.ts`를 최소 변경하여 stable safe error와 API module composition을 연결한다.

물리 URL, HTTP framework 및 OpenAPI generation은 `OPEN DECISION`이며 본 구현의 logical API contract를 변경하지 않는다.

### Stage 5 — Event and Projection

- [ ] `publication-event-journal.ts`에 registry-defined immutable event envelope와 aggregate-local sequence를 구현한다.
- [ ] `EVT-003`–`EVT-009`를 해당 accepted domain transition에서만 기록한다.
- [ ] `EVT-010`–`EVT-012`는 authorized rebuild/replay evidence이며 business command나 외부 side effect를 재실행하지 않도록 한다.
- [ ] `listing-projection.ts`에 `PRJ-002` derived record, source version, rebuild generation, drift status를 구현한다.
- [ ] duplicate, gap, out-of-order, checksum, version 또는 classification drift는 `STALE`/recovery로 격리하고 aggregate를 변경하지 않는다.

### Stage 6 — Operations and Observability

- [ ] FEAT-015 audit event catalog와 redacted structured operational observation을 정의한다.
- [ ] attempt, external observation, unknown outcome, reconciliation case, recovery 결과를 correlation/causation과 함께 기록한다.
- [ ] metrics는 count/state/duration/error code만 사용하며 payload, secret, credential, contact data를 포함하지 않는다.
- [ ] recovery/replay/rebuild는 current authorization과 exact version을 재검증하고 business decision을 생성하지 않는다.
- [ ] provider unavailable/unknown/duplicate callback/retry limit/security suspension 시나리오를 운영 테스트로 검증한다.

### Stage 7 — Verification

- [ ] domain, repository, service, API, security, workflow, event/projection, operations 테스트를 실행한다.
- [ ] `TEST-002`–`004`, `008`, `011`, `012`, `023`–`025`, `033`, `049`에 실행 evidence를 연결한다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify`, Gitleaks, `pnpm audit`를 실행한다.
- [ ] frozen baseline checksum과 architecture conformance를 재검사한다.
- [ ] production adapter가 미승인 상태면 external delivery가 fail closed하는지 확인한다.

## 5. Task 실행 순서

정확한 task field와 dependency는 [Task Breakdown](FEAT015_TASK_BREAKDOWN.md)에 정의한다. 순서는 `F15-TASK-001` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` → `010` → `011` → `012` → `013`이다. 각 task는 선행 task의 passing test를 전제로 한다.

## 6. TDD 실행 규칙

각 task마다 다음 순서를 반복한다.

1. 관련 canonical acceptance condition을 하나의 failing test로 표현한다.
2. 해당 test만 실행해 의도한 이유로 실패하는지 확인한다.
3. 가장 작은 production change로 통과시킨다.
4. task 관련 test와 회귀 test를 실행한다.
5. lint/typecheck를 실행한다.
6. trace matrix의 test/evidence 상태를 implementation evidence에 기록한다.

예시 명령:

```powershell
pnpm build
node --test dist/modules/publication/src/publication-aggregate.test.js
pnpm lint
pnpm typecheck
pnpm test
pnpm verify
```

## 7. 완료 Gate

- 모든 `F15-TASK-*` completion criteria 충족.
- canonical lifecycle/authority/trace ID 변경 0.
- valid Verification, public Permission, effective Approval, exact representation/target/channel/policy와 live authorization 없이는 dispatch 0.
- unconfirmed external acceptance로 `ACTIVE` 전환 0.
- duplicate external effect 0, unexplained audit gap 0, raw restricted log 0.
- aggregate/event/projection/reconciliation evidence의 append-only history PASS.
- 전체 test/lint/typecheck/build/verify/security gate PASS.
- production adapter 결정이 미완료이면 배포/외부 delivery는 계속 disabled.

## 8. 관련 계획 문서

- [Implementation Traceability Matrix](FEAT015_TRACEABILITY_MATRIX.md)
- [Task Breakdown](FEAT015_TASK_BREAKDOWN.md)
- [Deferred Decisions](FEAT015_DEFERRED_DECISIONS.md)
- [Test Strategy](FEAT015_TEST_STRATEGY.md)
- [Phase 13-1 Report](../reviews/PHASE13_1_IMPLEMENTATION_PLANNING_REPORT.md)
