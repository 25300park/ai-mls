# REL-001 Phase 3 API-017 durable jobs runtime implementation 계획

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-128 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |
| 기준일 | `2026-09-14` |

> **실행 gate:** 이 계획은 `BLOCKED_BEFORE_RUNTIME_TDD`다. Phase 3A는 inventory document만 승인하며 Production/Test work는 별도 AO-approved Phase 3B closure 뒤에만 시작한다.

## 목표

다섯 frozen API-017 logical operation을 job, retry, scheduler, transport, authority 또는 audit semantics를 새로 만들지 않는 API-017-owned durable, restart-safe Staging runtime으로 전환한다.

## 전역 제약

- frozen API-017 operation `SubmitJob`, `ReadJob`, `CancelJob`, `RetryAsSuccessor`, `ReadJobResult`을 보존한다.
- business authority 없이 domain/operations ownership과 exact technical worker identity를 보존한다.
- explicit job mapping이 승인된 뒤에만 API-016 enriched intent/materialization을 재사용한다.
- Phase 0 topology를 보존하고 existing-port process separation이 증명되지 않으면 bounded in-process fallback을 사용한다.
- new API ID, public HTTP route, queue, RPC, message bus, role/capability, state, retry default, scheduler cadence, provider/network, dependency 또는 distributed transaction을 추가하지 않는다.
- Phase 1 Core Transport는 HOLD를 유지하며 FEAT-022 worker integration은 Phase 4에 남긴다.

## Phase 순서와 gate

### Phase 3B — canonical decision closure

다음에 대한 owner-approved contract를 만든다.

1. first supported job class와 exact per-class lifecycle/transition mapping;
2. stable job 및 execution/attempt/lease identity;
3. tenant/scope ownership과 immutable initiating/executing provenance;
4. claim/lease/heartbeat와 interrupted execution semantics;
5. retryable failure policy, ceiling, backoff/delay의 source;
6. distinct `ReadJobResult`를 포함한 five operation-specific closed input/output;
7. bounded job-type-to-handler registry;
8. 아홉 required action에 대한 API-017 enriched audit intent/event mapping과 approved safe failure reference handling;
9. runtime configuration, readiness, shutdown dependency를 정의한다.

Exit: load-bearing `P3A-GAP-001`–`013` row 전체가 new authority 없이 approved되어야 한다. 그렇지 않으면 `BLOCK_REL001_PHASE3_API017_RUNTIME_FOUNDATION`을 반환한다.

### Phase 3C — durable job store

승인 후 future TDD: RED restart/CAS/idempotency/atomicity test를 수행하고 최소 API-017-owned durable UoW를 구현한다. terminal immutability, fail-closed configuration과 approved safe reference handling을 검증한다. 현재 failure reference safety는 `NOT_PROVEN`이다.

### Phase 3D — bounded execution registry/runtime

향후 TDD: RED unknown-handler 및 identity test를 수행하고 approved job type만 등록한다. separation proof가 완료되지 않으면 bounded in-process Staging worker를 compose한다. external effect는 없다.

### Phase 3E — concurrency/idempotency/recovery hardening

향후 TDD: duplicate completion, stale write, interrupted execution, exact replay/conflict, successor atomicity, no blind retry를 검증한다. recovery state 또는 automatic scheduling을 추가하지 않는다.

### Phase 3F — API-016 audit/evidence integration

향후 TDD: approved versioned API-017 intent만 materialize하고 source chronology/principal/tenant/scope를 보존하며 replay/conflict와 append-only final evidence를 강제한다. direct final Audit Event creation은 계속 금지된다.

### Phase 3G — Staging runtime integration verification

approved composition을 통해 configuration, durability, readiness, shutdown/drain, safe error, tenant/scope concealment, external network 부재를 검증한다. Phase 4 Advisory integration은 제외한다.

### Phase 3 Final Gate

focused, affected 및 한 번의 final full regression과 lint/typecheck/build/verify, architecture, gitleaks, documentation validation, independent review, final RTM/report를 수행한다. Dependency audit에는 별도 승인된 network access가 필요하다.

## Phase 3B 승인 후 필요한 최초 RED 매트릭스

Phase 3 Brief의 열다섯 negative case는 필수다. duplicate completion, restart loss, stale overwrite, unknown type/handler, invalid transition, unauthorized retry/default, current-Session reconstruction, cross-tenant execution, terminal reopen, raw diagnostic/payload leakage, direct final Audit Event invention, external invocation을 포함한다. 정확한 assertion은 fixture-derived semantics가 아니라 approved Phase 3B contract를 사용해야 한다.

## 현재 stop 결정

Production 또는 Test change는 authorized되지 않았다. Phase 3B recommendation은 `START_DOCUMENTATION_ONLY_CANONICAL_CLOSURE`이고 Phase 3C는 blocked다.

## Phase 3A 연계 문서

- [Runtime Inventory Gap Matrix](REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md)
- [Lifecycle and Authority Matrix](REL001_PHASE3_API017_LIFECYCLE_AUTHORITY_MATRIX.md)
- [Persistence Readiness Matrix](REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md)
- [Canonical Inventory Report](../reviews/REL001_PHASE3A_API017_CANONICAL_INVENTORY_REPORT.md)
