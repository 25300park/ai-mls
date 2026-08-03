# F15-TASK-007 Publication Lifecycle Coordination Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-077 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 완료일 | 2026-08-03 |
| Brief | F15-TASK-007 — Publication Lifecycle Coordination |

## 1. Final Recommendation

`APPROVE_F15_TASK_007_IMPLEMENTATION`

승인된 post-publication lifecycle operation을 기존 Domain transition, Session-derived Actor authorization, live prerequisite, persistence, append-only audit 및 idempotency 경계에 연결했다. `F15-TASK-008` 이후 범위는 시작하지 않았다.

## 2. Objective

기존 `PublicationAggregate` lifecycle rule을 변경하거나 복제하지 않고 Correction, Republish, Withdrawal, Withdrawal Resolution, Suspension, Resume, Supersession 및 Termination을 하나의 canonical Application/Runtime 경로로 조정하는 것이 목적이다.

## 3. Documents read

- [FEAT-015 Task Breakdown](../implementation/FEAT015_TASK_BREAKDOWN.md)
- [FEAT-015 Traceability Matrix](../implementation/FEAT015_TRACEABILITY_MATRIX.md)
- [Workflow Registry](../00_WORKFLOW_REGISTRY.md)의 `WF-010`~`WF-012`
- [API Registry](../00_API_REGISTRY.md)의 `API-014`
- [Decision Register](../00_DECISION_REGISTER.md)의 `DEC-105`~`DEC-108`; supporting `DEC-109`~`DEC-111`
- [Security Registry](../00_SECURITY_REGISTRY.md)
- F15-TASK-007 Implementation Brief

## 4. Baseline and implementation commit

- Baseline: `b3dfaa03b0ae2aaf959ecf2c9c958b76c1af7a2d`
- Branch: `main`
- Implementation commit: `SELF` — 이 보고서와 구현을 포함하는 단일 local commit
- Commit message: `feat(feat-015): implement publication lifecycle coordination`
- Push: `NOT_PUSHED`

## 5. Files created

- `modules/publication/src/publication-lifecycle-service.ts`
- `modules/publication/src/publication-lifecycle-service.test.ts`
- `docs/reviews/F15_TASK_007_PUBLICATION_LIFECYCLE_IMPLEMENTATION_REPORT.md`

## 6. Files modified

- Lifecycle contracts/entry: `publication-application-contracts.ts`, `publication-interface-models.ts`, `publication-interface-service.ts`, `publication-interface-validation.ts`
- Application orchestration: `publication-command-handlers.ts`, `publication-service.ts`
- Infrastructure/Runtime/export: `publication-infrastructure.ts`, `publication-runtime-contracts.ts`, `publication-runtime-registry.ts`, `index.ts`
- Architecture/regression tests: `publication-end-to-end-architecture.test.ts`, `publication-infrastructure.test.ts`, `publication-runtime.test.ts`
- Implementation evidence: `docs/implementation/FEAT015_TRACEABILITY_MATRIX.md`

## 7. Lifecycle Coordination

`PublicationLifecycleService`는 `correctPublication`, `republishPublication`, `requestWithdrawal`, `resolveWithdrawal`, `suspendPublication`, `resumePublication`, `supersedePublication`, `terminatePublication`을 제공한다. 각 method는 기존 `PublicationApplicationService.executeAuthorized()`에 승인된 command를 위임한다. Domain 상태 판정과 transition은 기존 aggregate method가 단독 소유하며 service에는 lifecycle business rule이 없다.

`COORDINATE_PUBLICATION_LIFECYCLE` outer operation은 Interface validator를 거쳐 동일 Runtime input port로 전달된다. Infrastructure와 Runtime registry에는 lifecycle service instance가 한 번만 등록되며 별도 parallel execution path가 없다.

## 8. Materiality Handling

Non-material correction은 새 exact Representation 및 Approval binding을 요구하는 기존 `BEGIN_ACTIVE_OPERATION` transition을 사용한다. Material correction은 기존 aggregate가 `PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR`로 거부하며, service가 이를 완화하거나 successor를 자동 생성하지 않는다. Republish는 기존 intent를 유지하면서 새 Approval, command 및 Attempt를 요구한다.

## 9. Authorization Integration

모든 lifecycle operation은 다음 순서를 유지한다.

`Session-derived Actor → Authorization Guard → live Approval/Verification/Permission/Target/Channel/policy/version → Lifecycle Service → Aggregate transition → Repository → Audit → Commit → Idempotency result`

Caller의 Actor claim은 authoritative하지 않다. Authorization, actor-level SoD, MFA, documented reason, current Approval, Verification, Permission 및 optimistic version 중 하나라도 실패하면 Domain mutation 전에 fail closed 한다. Effective Approval 검증은 F15-TASK-006의 동일 canonical helper를 재사용한다.

## 10. Persistence, audit and idempotency

Lifecycle mutation은 기존 aggregate-scoped Unit of Work에서 repository update, immutable audit append, commit 순으로 수행한다. 동일 idempotency key replay도 Session Actor와 live prerequisites를 다시 검증한 뒤 기존 committed result를 반환하며 history/audit를 중복 생성하지 않는다. 동일 key의 다른 fingerprint는 `IDEMPOTENCY_CONFLICT`, stale aggregate는 `PUBLICATION_VERSION_CONFLICT`로 분리된다.

## 11. Tests

- Task direct/composed tests: 7개 PASS
- 전체 테스트: 476/476 PASS
- Success: correction, withdrawal request/resolution, republish, suspend/resume, supersede, terminate
- Rejection: authentication, authorization, SoD, stale Approval/Verification/Permission, MFA, reason, version conflict, idempotency conflict, invalid transition, material-successor boundary
- Evidence: persisted state/version/attempt/binding, append-only history, resolved Session Actor audit, completed/failed audit ordering, idempotent replay, Runtime/Composition registration

## 12. Verification

| 검증 | 결과 |
|---|---|
| Node.js / `pnpm exec node` | PASS — `v24.18.0` / `v24.18.0` |
| `pnpm.cmd install` | PASS — exit 0, dependency/lockfile 변경 없음; update metadata fetch warning만 발생 |
| `pnpm.cmd lint` | PASS — warning 0 |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — lint, typecheck, 476/476 tests |
| `pnpm.cmd test` | PASS — 476/476 |
| `pnpm.cmd audit --prod` | PASS — exit 0, production vulnerability 0 |
| `pnpm.cmd audit` | REVIEWED — exit 1, 기존 승인된 dev-only `brace-expansion` advisory 2 high만 존재; production impact 0 |
| Architecture checksum | PASS — frozen Architecture 문서 변경 0, architecture verification PASS |

## 13. Architecture Protection

- Aggregate lifecycle rule, Repository semantics, Unit of Work 및 authentication mechanism 변경 없음
- Database, ORM, SQL, migration, HTTP framework 변경 없음
- Event Journal, Projection, Retry, Operations 및 FEAT-016 구현 없음
- `F15-TASK-008` 이후 source artifact 없음
- 새 RoleCode, API ID, Workflow ID, Registry decision 없음

## 14. Traceability

[FEAT-015 Traceability Matrix](../implementation/FEAT015_TRACEABILITY_MATRIX.md)의 `F15-TASK-007` implementation evidence 행만 `IMPLEMENTED_AND_VERIFIED`로 갱신했다. `F15-TASK-008~009`는 `PENDING`을 유지한다.

## 15. Independent Review

초기 review에서 Task 직접 authorization/SoD 거부 assertion과 republish success audit assertion이 부족하다는 finding이 있었다. 직접 `AUTHORIZATION_DENIED`, `SEPARATION_OF_DUTIES_DENIED`, 상태 불변, completed business audit 부재 및 republish completed audit assertion을 추가했다. 재검토 결과는 `Critical = 0`, `Important = 0`, `Minor = 0`이다.

## 16. Key decisions added

새 Architecture Decision은 추가하지 않았다. 기존 `DEC-105`~`DEC-111`의 live revalidation, actor-level SoD, idempotency, materiality, withdrawal 및 republish 경계를 구현했다.

## 17. Open decisions

None. Event Journal, Projection, reconciliation recovery, physical persistence 및 provider/runtime product 선택은 기존 deferred 또는 후속 Task 경계를 유지한다.

## 18. Inconsistencies found

None found after implementation and independent re-review.

## 19. Known limitations

이 Task는 lifecycle command coordination과 in-process logical persistence까지만 증명한다. Connector outcome reconciliation은 `F15-TASK-008`, API-014/UI contract는 `F15-TASK-009`, Event/Projection/Operations는 후속 Task 범위다.

## 20. Next brief prerequisites

Architecture Owner가 단일 commit과 본 evidence를 승인한 뒤에만 별도 Brief로 `F15-TASK-008`을 시작할 수 있다.

## Completion statement

F15-TASK-007 구현, 전체 검증, 독립 재검토 및 단일 local commit까지만 수행하고 중단한다. Push는 수행하지 않으며 `F15-TASK-008`은 시작하지 않는다.
