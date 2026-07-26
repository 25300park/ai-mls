# FEAT-015 Task Breakdown

| 항목 | 값 |
|---|---|
| 버전 | v0.1 |
| 상태 | DRAFT |
| Epic | `EPIC-007` |
| Feature | `FEAT-015` |
| Task 수 | 13 |

모든 task는 [Implementation Plan](FEAT015_IMPLEMENTATION_PLAN.md)의 TDD 규칙을 따른다. `Database Impact: None`은 영구 persistence가 불필요하다는 뜻이 아니라, 현재 repository에 승인된 DB subsystem이 없어 이 implementation increment에서 schema/migration을 만들지 않는다는 뜻이다.

## `F15-TASK-001` — Canonical Domain Contracts

| Field | Value |
|---|---|
| Purpose | Publication, Delivery Attempt, Reconciliation Case, binding/version/status value를 immutable TypeScript contract로 정의 |
| Architecture Reference | `DEC-100–102`, `PR`, `TRACE-015` |
| Dependency | Architecture v1.1 baseline |
| Files Expected to Change | create `modules/publication/src/publication-contracts.ts`, `publication-contracts.test.ts`, `index.ts` |
| Database Impact | None; logical identity/version fields only |
| API Impact | API-014가 소비할 internal types |
| Security Impact | classification, purpose, tenant/team, actor/evidence metadata 필수화 |
| Test Requirement | required field, immutable object, invalid vocabulary/type rejection |
| Completion Criteria | canonical state/version/binding 의미와 정확히 일치, legacy status 미사용 |
| Risk | version role 혼합 |
| Implementation Order | 1 |

## `F15-TASK-002` — Aggregate Transition Engine

| Field | Value |
|---|---|
| Purpose | `PUB-TR-001`–`PUB-TR-020`, suspension, correction materiality와 lineage 구현 |
| Architecture Reference | `DEC-101/109–111`, `WF-010–012` |
| Dependency | `F15-TASK-001` |
| Files Expected to Change | create `publication-aggregate.ts`, `publication-aggregate.test.ts`; modify `index.ts` |
| Database Impact | None; immutable revision output |
| API Impact | state command 결과의 domain source |
| Security Impact | forbidden transition fail closed; actor-independent domain validation |
| Test Requirement | allowed/forbidden transition, version conflict, non-material correction, material successor, republish/withdraw lineage |
| Completion Criteria | transition table 20/20 covered, direct provider/projection transition 0 |
| Risk | legacy `DRAFT/PUBLISHED` 상태 혼입 |
| Implementation Order | 2 |

## `F15-TASK-003` — Repository and Unit-of-Work Ports

| Field | Value |
|---|---|
| Purpose | optimistic concurrency, append-only history, command idempotency와 logical atomicity 정의 |
| Architecture Reference | `DEC-100/107`, `SEC-021/022` |
| Dependency | `F15-TASK-001/002` |
| Files Expected to Change | create `publication-repository.ts`, `in-memory-publication-repository.ts`, `publication-repository.test.ts`; modify `index.ts` |
| Database Impact | physical schema/migration 없음; production adapter는 `DFD-005` gate |
| API Impact | expectedVersion/idempotency 결과 지원 |
| Security Impact | tenant/team scope, immutable history, conflict-safe errors |
| Test Requirement | stale version, duplicate same intent, conflicting intent, cross-team not-found |
| Completion Criteria | lost update 0, duplicate effect intent 0, history overwrite 0 |
| Risk | in-memory test adapter가 production durability로 오해될 수 있음 |
| Implementation Order | 3 |

## `F15-TASK-004` — Attempt, Evidence, Event Journal Ports

| Field | Value |
|---|---|
| Purpose | Delivery Attempt, external Observation, reconciliation evidence와 immutable event journal 분리 |
| Architecture Reference | `DEC-100/103/107/108`, `ER` |
| Dependency | `F15-TASK-003` |
| Files Expected to Change | create `publication-delivery-port.ts`, `publication-event-journal.ts`, tests; modify repository contracts/index |
| Database Impact | append-only logical storage port; physical event store 미선정 |
| API Impact | API-018/019 evidence input은 interface dependency로만 소비 |
| Security Impact | connector no-authority, checksum/classification/correlation 필수, secret/payload log 금지 |
| Test Requirement | attempt identity, observation dedupe, sequence gap/out-of-order, connector state mutation rejection |
| Completion Criteria | command/attempt/effect/observation identity가 분리되고 evidence만 state input이 됨 |
| Risk | dispatch와 intent persistence 사이 crash window |
| Implementation Order | 4 |

## `F15-TASK-005` — Authorization, SoD and Live Revalidation

| Field | Value |
|---|---|
| Purpose | command 직전 session/purpose/role/SoD/exact Approval/Verification/Permission/target/connector guard 조합 |
| Architecture Reference | `DEC-105/106`, `SEC-001/002/004/006–015/021/032`, `WF-GUARD-001–010` |
| Dependency | `F15-TASK-003/004`; existing API-013 service |
| Files Expected to Change | create `publication-authorization.ts`, test; modify `modules/authorization/src/authorization-service.ts`와 test only for approved existing-role capabilities |
| Database Impact | None |
| API Impact | every API-014 mutation guard |
| Security Impact | OPS human execution/reconciliation, authorized SVC technical dispatch only; PUA/approver, verifier, permission-decider conflict; no new RoleCode |
| Test Requirement | default deny, MFA/reason, role stacking, stale session/policy/approval, service/AI/connector prohibition |
| Completion Criteria | mandatory guard 10/10, authority escalation 0 |
| Risk | capability string가 role meaning을 넓힐 위험; frozen matrix와 exact comparison 필요 |
| Implementation Order | 5 |

## `F15-TASK-006` — Create and Publish Coordination

| Field | Value |
|---|---|
| Purpose | exact Approval binding으로 Publication 생성, authorized Publish intent와 confirmed activation 구현 |
| Architecture Reference | `DEC-100–108`, `WF-010`, `API-014`, `EVT-003` |
| Dependency | `F15-TASK-001–005` |
| Files Expected to Change | create `publication-service.ts`, `publication-service.test.ts`; modify `index.ts` |
| Database Impact | repository port 사용; migration 없음 |
| API Impact | Create Publication, Deliver/Publish application operations |
| Security Impact | live effective Approval, exact binding, executor SoD, idempotency, audit |
| Test Requirement | invalid Verification/Permission/Approval, accepted-not-active, confirmed exact activation, unknown outcome |
| Completion Criteria | unconfirmed `ACTIVE` 0; duplicate dispatch 0; `EVT-003` only confirmed activation |
| Risk | synchronous fake receipt를 provider confirmation으로 오인 |
| Implementation Order | 6 |

## `F15-TASK-007` — Correction, Suspension, Withdrawal and Republish

| Field | Value |
|---|---|
| Purpose | remaining API-014 command lifecycle와 exact lineage 구현 |
| Architecture Reference | `DEC-101/105–111`, `WF-010–012`, `EVT-004/007–009` |
| Dependency | `F15-TASK-006` |
| Files Expected to Change | modify `publication-service.ts`, `publication-aggregate.ts`와 tests |
| Database Impact | new immutable revisions/attempts only |
| API Impact | Correct, Suspend, Resume, Withdraw, Republish application operations |
| Security Impact | dedicated current authorization; material change successor; emergency suspension no final business decision |
| Test Requirement | materiality boundary, withdrawal confirmation, republish new Approval/command/attempt, target/channel preservation |
| Completion Criteria | implicit overwrite/retry-as-republish/approval replay 0 |
| Risk | correction과 successor 또는 republish와 retry 혼동 |
| Implementation Order | 7 |

## `F15-TASK-008` — Reconciliation and Recovery

| Field | Value |
|---|---|
| Purpose | UNKNOWN/contradictory evidence containment, independent resolution, recovery reauthorization 구현 |
| Architecture Reference | `DEC-108`, `WF-012`, `EVT-005/006/012` |
| Dependency | `F15-TASK-004–007` |
| Files Expected to Change | create `publication-reconciliation.ts`, test; modify service/contracts/index |
| Database Impact | append-only case/evidence/resolution history |
| API Impact | Reconcile/Resolve/Recover operations |
| Security Impact | executor/evidence submitter/resolver SoD, replay no side effect, safe errors |
| Test Requirement | unknown, negative evidence, conflicting evidence, unauthorized resolver, replay/recovery revalidation |
| Completion Criteria | unresolved evidence는 `RECONCILIATION_REQUIRED`; silent success 0 |
| Risk | external truth의 잘못된 deterministic inference |
| Implementation Order | 8 |

## `F15-TASK-009` — API-014 and UI View Contracts

| Field | Value |
|---|---|
| Purpose | logical command/query API와 role-aware `UI-031`–`033` state를 기존 API boundary에 통합 |
| Architecture Reference | `DEC-104`, `API-014`, `UI-031–033/035` |
| Dependency | `F15-TASK-005–008` |
| Files Expected to Change | create `apps/api/src/publication-api.ts`, `publication-api.test.ts`; modify `contracts.ts`, `composition.ts`, `index.ts` |
| Database Impact | None |
| API Impact | API-014 only; URL/framework 미결정 |
| Security Impact | Actor derived only from session, server-side authorization, safe/redacted errors |
| Test Requirement | canonical operation surface, command/query separation, role action suppression, inaccessible resource not-found |
| Completion Criteria | API-001–013 regression PASS, API-018/019 behavior 추가 0 |
| Risk | UI hidden action을 authorization으로 오해 |
| Implementation Order | 9 |

## `F15-TASK-010` — Domain Event Emission

| Field | Value |
|---|---|
| Purpose | accepted transition과 canonical event envelope/ordering 연결 |
| Architecture Reference | `DEC-112`, `EVT-003–012` |
| Dependency | `F15-TASK-004/006–008` |
| Files Expected to Change | modify `publication-event-journal.ts`, aggregate/service tests |
| Database Impact | event store port only; serialization/product 미선정 |
| API Impact | none; event is not API response authority |
| Security Impact | source classification/purpose inheritance, authorized replay, immutable identity |
| Test Requirement | aggregate sequence monotonic, duplicate/gap/out-of-order fail, replay no command/effect/notification |
| Completion Criteria | required events mapped, global order assumption 0 |
| Risk | event occurrence가 business decision으로 오해될 위험 |
| Implementation Order | 10 |

## `F15-TASK-011` — PRJ-002 Listing Projection

| Field | Value |
|---|---|
| Purpose | publication event에서 rebuildable, non-authoritative listing projection 생성 |
| Architecture Reference | `DEC-112`, `PRJ-002`, `EVT-003–012` |
| Dependency | `F15-TASK-010` |
| Files Expected to Change | create `listing-projection.ts`, `listing-projection.test.ts`; modify `index.ts` |
| Database Impact | in-memory projection store only; physical store 미선정 |
| API Impact | API-014 query may expose derived status with provenance/version |
| Security Impact | source classification/privacy/purpose inheritance, rebuild authorization |
| Test Requirement | apply, duplicate, gap, stale, drift, isolated rebuild, atomic generation cutover |
| Completion Criteria | projection mutation이 aggregate를 변경하지 않음; deterministic rebuild PASS |
| Risk | projection을 current truth로 사용 |
| Implementation Order | 11 |

## `F15-TASK-012` — Operations and Observability

| Field | Value |
|---|---|
| Purpose | redacted logs/metrics, audit evidence, retry/reconcile/recover operational controls 구현 |
| Architecture Reference | `OPS-009/010/012–015/017–019/021/023–025/027/029/031/032`, `SEC-017–030` |
| Dependency | `F15-TASK-004–011` |
| Files Expected to Change | create `publication-observability.ts`, test; modify service/event/projection files as needed |
| Database Impact | None; operational evidence uses ports |
| API Impact | stable safe diagnostic/result codes only |
| Security Impact | no raw restricted data/secrets, operator identity, audit, incident containment |
| Test Requirement | redaction, unknown outcome, retry limit, degraded mode, recovery evidence, operations no-authority |
| Completion Criteria | restricted log leakage 0, silent failure 0, operational business decision 0 |
| Risk | high-cardinality or sensitive metric labels |
| Implementation Order | 12 |

## `F15-TASK-013` — Acceptance and Architecture Conformance

| Field | Value |
|---|---|
| Purpose | complete FEAT-015 regression, trace evidence, quality/security gate 실행 |
| Architecture Reference | `TRACE-015`, `TST-010`, `TEST-002–004/008/011/012/023–025/033/049`, DoD |
| Dependency | `F15-TASK-001–012` |
| Files Expected to Change | tests under `modules/publication/src` and `apps/api/src`; permitted implementation evidence only after acceptance |
| Database Impact | None |
| API Impact | API-014 contract verification only |
| Security Impact | Gitleaks, dependency audit, authority/privacy/audit regression |
| Test Requirement | full suite, lint, typecheck, build, verify, Gitleaks, audit, baseline checksum |
| Completion Criteria | all gates PASS, trace complete, working tree clean after authorized commit, FEAT-016+ artifacts 0 |
| Risk | production adapter 미승인 상태를 feature-complete deployment로 오인 |
| Implementation Order | 13 |

## Dependency Summary

```text
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013
```

`004`와 `005`는 `003` 이후 일부 병렬 분석이 가능하지만 같은 repository/authorization contract를 건드리므로 merge 및 검증은 위 순서를 유지한다.

## Related Documents

- [Implementation Plan](FEAT015_IMPLEMENTATION_PLAN.md)
- [Traceability Matrix](FEAT015_TRACEABILITY_MATRIX.md)
- [Deferred Decisions](FEAT015_DEFERRED_DECISIONS.md)
- [Test Strategy](FEAT015_TEST_STRATEGY.md)
- [Phase 13-1 Report](../reviews/PHASE13_1_IMPLEMENTATION_PLANNING_REPORT.md)
