# FEAT-015 Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| 버전 | v0.1 |
| 상태 | DRAFT |
| 범위 | `EPIC-007` / `FEAT-015` / `DEV-015` / `IMP-015` |
| 기준 | Architecture Bible v1.1 |

## 1. End-to-End Trace

| Requirement | Decision | Registry / Entity | Workflow | API / UI | Security | Test | Task |
|---|---|---|---|---|---|---|---|
| `REQ-CONST-002` | `DEC-100/101/104–111` | Publication, Delivery Attempt, Status History | `WF-010–012` | `API-014`; `UI-031–033/035` | `SEC-001/002/007/010/011/021/022` | `TEST-002/011/023/024/033` | `F15-TASK-001/002/005–009/013` |
| `REQ-CONST-003` | `DEC-100/101/104/105/108/110/111` | Publication, Verification ref, Reconciliation Case | `WF-010–012` | `API-011/013/014`; `UI-031–033` | `SEC-002/010/011/021/024/028` | `TEST-002/023/024/033` | `F15-TASK-005–009/013` |
| `REQ-CONST-004` | `DEC-100/104/105/108/110/111` | Publication, Permission ref, exact audience/scope | `WF-010–012` | `API-012–014`; `UI-031–033` | `SEC-002/010/011/014/015/021` | `TEST-003/012/023/024/033` | `F15-TASK-005–009/013` |
| `REQ-CONST-005` | `DEC-100–112` | Publication lineage, immutable evidence/event | `WF-010–012` | `API-014/016/018/019`; `UI-031/033/035` | `SEC-013/021–024/031/032` | `TEST-004/023/025/049` | `F15-TASK-001–004/007/010–013` |
| `REQ-CONST-006` | `DEC-100/101/106–112` | Status History, System Error, recovery evidence | `WF-010–012` | `API-014/016–019`; `UI-031–035` | `SEC-021–030` | `TEST-025/049` | `F15-TASK-002–004/007/010–013` |
| `REQ-CONST-007` | `DEC-100–112` | all FEAT-015 records | `WF-010–012` | `API-014`; `UI-031–033/035` | `SEC-001/002/007/010/021/022` | `TEST-023–025/033/049` | `F15-TASK-001–013` |
| `REQ-CONST-009` | `DEC-100–105/107–112` | Target, Attempt, Observation, Connector evidence | `WF-010/012` | `API-014/018/019`; `UI-031/033` | `SEC-006/020/024/025/032` | `TEST-008/023/025/049` | `F15-TASK-004/006–008/010–013` |
| `REQ-CONST-012` | `DEC-100/104–111` | Verification and Approval refs remain separate | `WF-010–012` | `API-011/013/014`; `UI-031/032` | `SEC-010/011/021` | `TEST-002/011/023/024/033` | `F15-TASK-005–009/013` |
| `REQ-CONST-013` | `DEC-100/102/104–111` | public Permission, target/channel binding | `WF-010–012` | `API-012–014`; `UI-031/032` | `SEC-010/011/015/021/032` | `TEST-003/012/023/024/033` | `F15-TASK-005–009/013` |
| `REQ-CONST-001/008` constraint | `DEC-103/105/106/112` | AI/Event/Projection/Worker no authority | `WF-010–012` | `API-014/017–019` | `SEC-001/002/010/021/031/032` | `TEST-008/025/049` | `F15-TASK-005/010–013` |

## 2. Canonical Object Coverage

| Kind | IDs / Objects | Implementation owner | Consumer / boundary | Planned evidence |
|---|---|---|---|---|
| Feature | `FEAT-015` | `modules/publication` | no `FEAT-016+` behavior | all task completion |
| Workflow | `WF-010` | Publication service | `API-014`, delivery/evidence ports | service/workflow tests |
| Workflow | `WF-011` | revalidation coordinator | `API-011/012/013/017` read dependencies | expiry/revalidation tests |
| Workflow | `WF-012` | reconciliation/recovery coordinator | `API-016–019` evidence dependencies | exception/recovery tests |
| API | `API-014` | `apps/api/src/publication-api.ts` | logical surface only | API contract tests |
| UI | `UI-031` | API-014 Publication Operations view | no direct connector authority | role/action/accessibility test |
| UI | `UI-032` | API-014 expiry/revalidation view | reads API-011/012/017 context | stale/expiry state test |
| UI | `UI-033` | API-014 recovery view | API-016–019 evidence links only | recovery/safe boundary test |
| UI | `UI-035` | existing API-016 audit evidence | read-only downstream link | audit redaction regression |
| Projection | `PRJ-002` primary | listing projection adapter | derived from events, rebuildable | drift/rebuild tests |
| Projection | `PRJ-001/004–008` consumers | out of direct FEAT-015 write scope | event consumers only | compatibility contract tests |
| Event | `EVT-003`–`EVT-009` | publication event journal | passive consumers | identity/order/version tests |
| Event | `EVT-010`–`EVT-012` | rebuild/replay evidence | no business side effect | replay prohibition tests |
| Operations | `OPS-009/010/012–015/017–019/021/023–025/027/029/031/032` | operations evidence/guards | no business command authority | operations/security tests |

## 3. Decision-to-Task Mapping

| Decision | Implementation effect | Tasks |
|---|---|---|
| `DEC-100` | Publication aggregate와 append-only Delivery Attempt | `001–004`, `006–008` |
| `DEC-101` | canonical lifecycle와 orthogonal suspension | `001/002/006–008` |
| `DEC-102` | exact one-target/one-channel binding | `001/005/006/009` |
| `DEC-103` | provider/connector/evidence ownership separation | `004/006/010/012` |
| `DEC-104` | `API-014` canonical logical surface | `009` |
| `DEC-105` | dispatch/recovery live revalidation | `005–008` |
| `DEC-106` | actor-level SoD와 break-glass restriction | `005/006–009/012` |
| `DEC-107` | command/attempt/external effect/observation idempotency | `003/004/006–008` |
| `DEC-108` | deterministic/human reconciliation evidence | `004/008/012` |
| `DEC-109` | non-material correction vs material successor | `002/007` |
| `DEC-110` | dedicated withdrawal authorization/attempt/evidence | `005/007/008` |
| `DEC-111` | same-intent republish with new authorization/attempt | `005/007/008` |
| `DEC-112` | provider-neutral projection, drift, rebuild/replay | `010/011/012` |

## 4. Validation Status

| Check | Status | 근거 |
|---|---|---|
| Feature → Requirement | VERIFIED | `TRACE-015`와 위 requirement rows |
| API → Feature | VERIFIED | `API-014` → `FEAT-015` |
| Workflow → Feature | VERIFIED | `WF-010`–`WF-012` → `FEAT-015` |
| Security → command/evidence | VERIFIED | `SEC-001/002/006/007/010/011/013–015/017–030/032` |
| Acceptance → Test | VERIFIED_FOR_PLAN | canonical `TEST-*`와 task test requirement 연결 |
| Runtime evidence | PENDING | Phase 13-1은 planning only |
| Production adapter | DEFERRED | storage/transport/provider decision 미승인 |

## 4.1 Phase 13-2B Implementation Evidence

| Trace | Implementation evidence | Validation | Status |
|---|---|---|---|
| `F15-TASK-001` | `modules/publication/src/publication-contracts.ts`, `publication-entities.ts`, `publication-commands.ts`, `publication-domain-error.ts`, `publication-factory.ts` | immutable contract/value equality, required field, version, classification, child entity와 safe domain error 검증 | VERIFIED |
| `F15-TASK-002` | `modules/publication/src/publication-aggregate.ts`, `publication-materiality-service.ts` | `PUB-TR-001`–`PUB-TR-020`, suspension, optimistic version guard, correction materiality, successor/republish/withdrawal/reconciliation invariant 검증 | VERIFIED |
| Acceptance → Test | `publication-contracts.test.ts`, `publication-materiality-service.test.ts`, `publication-aggregate.test.ts` | 신규 domain test 16/16 PASS; 전체 regression 184/184 PASS | VERIFIED |
| Scope boundary | Domain source/test only | repository, persistence, schema, migration, API, application service, event bus, queue, worker, projection, connector 구현 0 | VERIFIED |
| Completion evidence | [Phase 13-2B Domain Foundation Implementation Report](../reviews/PHASE13_2B_DOMAIN_FOUNDATION_IMPLEMENTATION_REPORT.md) | lint, typecheck, build, verify, test, architecture checksum | VERIFIED |

## 4.2 Phase 13-3A Implementation Evidence

| Trace | Implementation evidence | Validation | Status |
|---|---|---|---|
| `F15-TASK-003` Repository Port / Adapter | `modules/publication/src/publication-repository.ts`, `in-memory-publication-repository.ts` | tenant-scoped save, update, find, exists, version check, optimistic concurrency와 append-only revision history 검증 | VERIFIED |
| `F15-TASK-003` Mapper | `modules/publication/src/publication-persistence-model.ts`, `publication-persistence-mapper.ts` | pure deterministic mapping과 Domain → Persistence → Domain logical equality 검증 | VERIFIED |
| `F15-TASK-003` Logical Unit of Work | `modules/publication/src/publication-unit-of-work.ts`, `in-memory-persistence-state.ts` | aggregate-scoped begin, atomic in-memory commit, rollback와 overlapping transaction rejection 검증 | VERIFIED |
| `F15-TASK-003` Idempotency / Audit | `modules/publication/src/publication-idempotency-store.ts`, `publication-audit-store.ts` | duplicate replay, conflicting intent denial, immutable append-only success/failure evidence 검증 | VERIFIED |
| Acceptance → Test | `modules/publication/src/publication-persistence.test.ts` | 신규 persistence contract test 13/13 PASS; 전체 regression 197/197 PASS | VERIFIED |
| Scope boundary | logical port/model/mapper와 deterministic memory adapter only | physical schema, SQL, migration, ORM, production adapter, database transaction/dependency, API, event, projection 구현 0; `DFD-005` unchanged | VERIFIED |
| Completion evidence | [Phase 13-3A Logical Persistence Foundation Implementation Report](../reviews/PHASE13_3A_LOGICAL_PERSISTENCE_IMPLEMENTATION_REPORT.md) | lint, typecheck, build, verify, test, architecture checksum | VERIFIED |

## 5. 상호 참조

- [Implementation Plan](FEAT015_IMPLEMENTATION_PLAN.md)
- [Task Breakdown](FEAT015_TASK_BREAKDOWN.md)
- [Deferred Decisions](FEAT015_DEFERRED_DECISIONS.md)
- [Test Strategy](FEAT015_TEST_STRATEGY.md)
- [Phase 13-1 Report](../reviews/PHASE13_1_IMPLEMENTATION_PLANNING_REPORT.md)
