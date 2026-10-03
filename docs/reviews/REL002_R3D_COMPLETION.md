# REL-002 R3-D Inventory / Blocker Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-280 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Operations Owner |
| Completion date | 2026-10-04 |
| Brief | REL-002 R3-D — Listener / Workers / Runtime Activation |
| Baseline | 9bdc76f05ced3e4cd2237c403336275e702710e7 |

## 1. Objective

source 변경 전 기존 listener/worker/startup/shutdown 계약을 조사했다. Production HTTP listener는 기존 승인 adapter가 있으나 Production-required worker 집합과 lifecycle composition이 정의돼 있지 않다. 사용자의 conditional authorization과 STOP 조건에 따라 runtime 구현을 시작하지 않았다. 이 보고서는 inventory 완료와 implementation BLOCKED를 구분한다.

## 2. Documents read

현재 R3-D 사용자 brief, [Phase 0 readiness inventory](../implementation/REL002_PHASE0_PRODUCTION_READINESS_INVENTORY.md), [Gap register](../implementation/REL002_PHASE0_PRODUCTION_GAP_REGISTER.md), [Phase 1C composition](../implementation/REL002_PHASE1C_PRODUCTION_COMPOSITION_ROOT_DESIGN.md), [Session ownership](../implementation/REL002_PHASE1C_SESSION_UOW_OWNERSHIP_MODEL.md), [Phase 1D bootstrap](../implementation/REL002_PHASE1D_PRODUCTION_BOOTSTRAP_IMPLEMENTATION_DESIGN.md), [Production executable design](../implementation/REL002_PHASE2D0E_PRODUCTION_EXECUTABLE_DESIGN.md), [REL001 Staging component matrix](../implementation/REL001_PHASE0_RUNTIME_COMPONENT_MATRIX.md), [REL001 Staging topology](../implementation/REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md)를 읽거나 worker/lifecycle 관련 부분을 조사했다. 아래 source paths의 exact contracts를 함께 확인했다.

## 3. Files created

본 bounded inventory/blocker report만 생성했다. primary checkout의 ownership-unknown REL002_R3D_RUNTIME_STARTUP_RESOLVER_DESIGN.md는 읽거나 복사하지 않았다.

## 4. Files modified

None. runtime/source, tests, approved migrations, R3-C4A/B evidence, historical fingerprint 및 protected report는 변경하지 않았다.

## 5. Key decisions added

새 APPROVED decision 없음. 기존 근거와 필요한 AO 결정만 기록한다.

### 5.1 Runtime inventory

| PATH / component | OWNER | START FUNCTION | STOP FUNCTION | IDEMPOTENCY / DUPLICATE START GUARD | STARTUP DEPENDENCIES | PRODUCTION ELIGIBLE |
|---|---|---|---|---|---|---|
| [production-main.ts](../../apps/api/src/production-main.ts), L80–135 | Production executable | runProductionMain → startProductionRuntime 한 번/호출 | shutdown → runtime.close | shutdownPromise로 반복 shutdown 공유; 서로 다른 runProductionMain 호출의 global activation guard는 없음 | parsed config, bootstrap dependencies, readiness, signal hooks | YES, existing executable; 실제 activation은 BLOCKED |
| [production-readiness-http.ts](../../apps/api/src/production-readiness-http.ts), L36–119/L192–213 | top-level bootstrap listener owner | createProductionRuntimeListenerStarter → listener.start → server.listen | listener.close → server.close / timeout closeAllConnections | sequential started/closed guard와 반복 close guard; pending start에 대한 STARTING/in-flight guard는 없음 | exact PORT, readiness, 5 canonical roots, API-014/015 handlers | YES, approved Node HTTP adapter; 현재 factory hold 유지 |
| [production-main.ts](../../apps/api/src/production-main.ts), L271–276 | Production bootstrap composition | startListeners unavailable; startWorkers unreachable | worker stop 구현 없음 | worker registry/worker duplicate guard 없음 | worker canonical contract 미정 | NO, current runtime activation boundary |
| [production-bootstrap-engine.ts](../../apps/api/src/production-bootstrap-engine.ts), L44–112 | ProductionBootstrap | executeProductionBootstrap | runtime.close → shutdown/cleanupReverse | returned handle의 closing Promise 공유; 별도 bootstrap 호출 전 global duplicate guard 없음 | earlier bootstrap + 3 gates + aggregate readiness + Session/child roots | YES, orchestration skeleton; worker integration 미완료 |
| [production-secret-reference-resolver.ts](../../apps/api/src/production-secret-reference-resolver.ts) 및 engine L66–67 | ProductionBootstrap | openPostgreSqlPool / PG_PRODUCTION_POOL | cleanup stack의 pool.close | 한 bootstrap 경로에서 pool factory 호출 한 번; cross-invocation 중복 방지는 미검증 | 승인된 sealed DB refs, runtime role, TLS/CA | YES; child는 pool borrow만 수행 |
| [production-main.ts](../../apps/api/src/production-main.ts), L139–165 | Production executable | installProcessSignalHandler, process.once(SIGINT/SIGTERM) | uninstall / process.off | run의 shutdownPromise는 반복 signal shutdown 공유; 별도 run 중복 handler guard는 없음 | runtime handle, readiness, 30초 bounded shutdown | YES, existing signal contract |
| [production-main.ts](../../apps/api/src/production-main.ts), L139–152 및 [HTTP listener](../../apps/api/src/production-readiness-http.ts), L202–213 | 각 bounded close operation | shutdown timeout timer | clearTimeout/finally 또는 server.close callback | timer.unref; worker polling/background timer 없음 | bounded close timeout | YES, shutdown timer만; worker scheduler 아님 |
| [production-child-root-registry.ts](../../apps/api/src/production-child-root-registry.ts), L46–71 | 각 기존 child owner / global ownership은 bootstrap | API-014/018/019 activateRuntime; API-015 noop; FEAT-022 provider held noop | root.close, 각 component persistence close | 기존 host state guards; 새 worker registry 없음 | same pool, bootstrap context, REQUIRE_EXISTING schema | YES, child host activation; background worker로 재분류하지 않음 |

Production config parser는 [production-runtime-configuration.ts](../../apps/api/src/production-runtime-configuration.ts):76에서 PORT를 1..65535로 요구하며 fallback port는 없다. low-level listener의 port=0 허용은 test adapter에서 가능하나 Production config 계약의 fallback이 아니다. listen error는 safe rejection으로 전달한다.

### 5.2 Worker candidates and classification

| Candidate / PATH | Existing contract | Classification | R3-D disposition |
|---|---|---|---|
| API-017 [job-staging-composition.ts](../../modules/jobs/src/job-staging-composition.ts):11/31–32 | exact environment=Staging; databasePath → DurableJobStore; close는 해당 store만 종료 | FEATURE_SPECIFIC / STAGING_ONLY | globally required Production worker로 승격 금지 |
| [job-execution-runtime.ts](../../modules/jobs/src/job-execution-runtime.ts):86–138 | JobExecutionRegistry는 AI-001/004/005 handler mapping; execute는 명시적 jobId/tenantId/scopeRef/correlationId의 one-shot 실행 | FEATURE_SPECIFIC | Production worker process/scheduler/start/stop/drain registry 아님 |
| [job-durable-persistence.ts](../../modules/jobs/src/job-durable-persistence.ts):3/163–175/429 | SQLite DatabaseSync store와 idempotent store.close | STAGING_ONLY | approved Production PG-backed worker source로 사용 불가 |
| [job-service.ts](../../modules/jobs/src/job-service.ts):389–413 | expireDue는 명시적 호출; 기록의 scheduler actor literal은 Production workload binding이 아님 | FEATURE_SPECIFIC | literal에서 worker authority나 자동 scheduler를 추론하지 않음 |
| [advisory-job-handlers.ts](../../modules/jobs/src/advisory-job-handlers.ts):13–31 | canonical job-context를 받는 bounded execute handlers | FEATURE_SPECIFIC; live provider는 DEFERRED | REL001 provider hold 유지, global worker 시작 금지 |
| [Connector composition](../../apps/api/src/connector-production-composition.ts):37/53–57 | unavailableConnector / executionAvailable=false, request-time host | OPTIONAL / FEATURE_SPECIFIC activation candidate; 실제 background worker 없음 | connector polling/worker를 발명하지 않음 |
| [External Integration composition](../../apps/api/src/external-integration-production-composition.ts) | evidence request-time application/host | FEATURE_SPECIFIC; 실제 background worker 없음 | host start를 worker start로 간주하지 않음 |
| [Publication service registry](../../modules/publication/src/publication-runtime-registry.ts) | 기존 services/projection consumers의 dependency registry | owning-domain service; worker startup registry 아님 | serviceNames를 required worker 목록으로 변환하지 않음 |

REQUIRED_AT_RUNTIME_START로 승인된 exact Production worker 목록은 발견되지 않았다. 이는 required count=0의 승인이 아니다. CANONICAL_REQUIRED_WORKER_COUNT=UNRESOLVED이며 explicit empty-worker 계약도 발견되지 않았다. [Phase 0 readiness inventory](../implementation/REL002_PHASE0_PRODUCTION_READINESS_INVENTORY.md):43과 [REL002-GAP-008](../implementation/REL002_PHASE0_PRODUCTION_GAP_REGISTER.md):27은 Production worker lifecycle/dispatch/capacity/supervision이 absent임을 명시한다. 현재 root도 startWorkers=NEW_IMPLEMENTATION_REQUIRED / unreachable이다.

### 5.3 Ordering, ownership, result and error taxonomy

기존 engine 순서는 earlier bootstrap → pre-listener chain → aggregate schemas → Session/child creation → listener → child activation → workers → runtime READY다. listener-before-worker startup 요구와 충돌하는 worker-first startup 계약은 발견되지 않았다.

다만 engine의 shutdown/실패 cleanup은 listener.close → workers.close → child/UoW/Identity → pool.close다. 최신 brief의 **partial rollback은 prior workers 먼저 중지 → listener 중지**를 요구한다. 기존 Phase 1C/1D 문서에도 workers-before-listeners unwind 설명이 있다. normal shutdown의 stop ingress → workers drain과 partial rollback 순서를 구분해 소유권/순서를 확정해야 한다. historical 문서나 engine을 조용히 재해석/수정하지 않았다.

startWorkers는 synchronous ProductionClosableResource 반환 계약이다. partial worker startup이 throw하면 engine은 worker handle을 받지 못하므로 내부적으로 시작된 worker들의 rollback owner가 기존 계약에 명시돼야 한다. 현재 그런 Production worker composition은 없다. async worker start, scheduler, lease authority 또는 no-op worker를 새로 만들지 않는다.

현재 [ProductionBootstrapErrorCode](../../apps/api/src/production-bootstrap.ts):91은 PRODUCTION_STARTUP_UNAVAILABLE 하나다. 요청된 activation failure reason들의 compatible mapping은 후속 bounded 설계에서 확정해야 한다. job-specific error를 Production lifecycle error로 재사용하거나 새 taxonomy를 구현하지 않았다.

## 6. Open decisions

- **OPEN DECISION R3D-OD-001 / AO + Operations + owning domain:** REQUIRED_AT_RUNTIME_START의 exact worker 집합을 승인하거나, 현재 composition이 worker를 요구하지 않는다면 explicit empty-worker 계약을 승인해야 한다. absent configuration을 empty로 간주할 수 없다.
- **OPEN DECISION R3D-OD-002 / AO + Operations:** worker start/stop/drain과 partial failure rollback 소유권, startup/normal shutdown/rollback 순서를 확정해야 한다. worker가 실제 필요하면 기존 승인된 dependency/persistence/workload contracts가 충분한지도 먼저 증명해야 한다.

UNRESOLVED_DECISIONS=2. Runtime implementation readiness=NO.

## 7. Inconsistencies found

worker implementation placeholder와 API-017 Staging-only 계약은 현재 R3-D 목표를 완결하지 못한다. 순차 listener duplicate guard를 global/concurrent activation guard로 확대 해석할 수 없다. partial rollback order 차이는 위 OD-002에 기록했다. 이전 R3-C4 PRE_LISTENER READY와 실제 RUNTIME_ACTIVATION READY는 계속 구분한다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Baseline | 지정 HEAD와 historical untracked 4개만 확인 |
| Listener inventory | PASS: existing exact Node HTTP path 확인, 활성화는 안 함 |
| Required worker inventory | FAIL: canonical Production required set/empty set 및 lifecycle 미정 |
| Independent review | APPROVED — BLOCK_REL002_R3D_RUNTIME_ACTIVATION inventory 결론, read-only 검토 |
| Focused / Affected / Full regression | N/A — STOP 조건 충족, source 변경 및 runtime 구현 없음 |
| Build / Lint / Typecheck | N/A — inventory 문서만 생성 |
| Disposable PostgreSQL | N/A — source/DB 변화 및 runtime activation 없음 |
| Links / metadata / secret scan / git diff --check | PASS |
| Preservation | primary dirty 파일 및 historical report 4개 hash 일치, source tracked diff 없음 |

기존 phase의 검증 통계를 이번 phase의 PASS로 재표시하지 않는다. current runtime startup/rollback/duplicate/shutdown test matrix는 NOT_EXECUTED / BLOCKED이며 FAIL 표기는 구현 gate가 충족되지 않았다는 의미다.

## 9. Known limitations

실제 listener/workers를 시작하지 않았다. inventory는 read-only source/document evidence이며 concurrent bind/leak를 재현한 runtime 결과가 아니다. physical pool count=1은 보존된 canonical baseline의 count이며 actual Production을 조회한 결과가 아니다. 신규 provider/role/schema/migration/dependency 또는 secret resolve 없음.

## 10. Next brief prerequisites

AO가 OD-001/002를 확정한 뒤 기존 runtime contracts의 충분성을 다시 판단해야 한다. 그 전에는 listener hold나 startWorkers placeholder를 변경하지 않는다. protected historical 파일과 primary checkout의 R3-D 파일을 흡수하지 않는다. commit/push/deploy 없음.

## Completion statement

Inventory는 완료했으나 R3-D runtime activation 구현은 BLOCKED다. PRE_LISTENER_STARTUP_CHAIN=READY (approved baseline). LISTENER_INVENTORY=PASS. REQUIRED_WORKER_INVENTORY=FAIL. RUNTIME_ACTIVATION=BLOCKED. FULL_PRODUCTION_STARTUP=BLOCKED_PENDING_R3D. LISTENER/WORKERS=NOT_STARTED. PHYSICAL_RUNTIME_POOL_COUNT=1. PRODUCTION_READINESS=NOT_VERIFIED. PRODUCTION_DEPLOYABILITY=BLOCKED. PRODUCTION_RAILWAY_SUPABASE_MUTATION=0/0/0. Commit=NOT_CREATED. Push=NOT_PERFORMED.

FINAL_RECOMMENDATION=BLOCK_REL002_R3D_RUNTIME_ACTIVATION.

---

## AO resolution 이후 구현 및 검증 — 2026-10-04

위 inventory/BLOCK 결론은 AO 결정 이전의 historical evidence로 보존한다. 이후 사용자의 REQUIRED WORKER / ACTIVATION LIFECYCLE AO DECISION은 explicit empty worker manifest와 ProductionRuntimeActivation ownership을 승인했으며 R3D-OD-001/002를 해소했다. 현재 구현 근거는 [Runtime Activation Design](../implementation/REL002_R3D_RUNTIME_ACTIVATION_DESIGN.md)이다. R3-C4 evidence와 primary checkout의 ownership-unknown R3-D 문서는 변경하지 않았다.

### Objective / Documents read

AO decision과 최초 R3-D brief를 함께 적용하여 기존 listener를 gated bootstrap에 연결했다. 위 inventory의 canonical sources, Document Governance, Glossary, R3-C4 Final evidence를 사용했다. 새로운 worker/provider/role/schema는 구현하지 않았다.

### Files created / Files modified

- 생성: production-runtime-activation.ts와 대응 test, REL002_R3D_RUNTIME_ACTIVATION_DESIGN.md. 본 completion report는 초기 inventory에서 생성한 파일에 이번 검증을 append했다.
- 수정: production-bootstrap.ts, production-bootstrap-engine.ts, production-main.ts, production-readiness-http.ts와 bootstrap/main/HTTP의 directly affected tests.
- 기존 historical untracked R3-C3 report 4개는 포함하지 않았으며 primary checkout의 두 dirty artifact도 보존했다.

### Key decisions / Open decisions / Inconsistencies

AO 승인: RequiredWorkersManifestV1 schemaVersion=1 workers=[]; REQUIRED_WORKER_COUNT=0; explicit missing-input fail-closed; activation owner=ProductionRuntimeActivation; partial rollback=reverse workers before listener; normal shutdown=ingress first then reverse worker drain. UNRESOLVED_DECISIONS=0. 초기 blocker 결론을 현재 상태로 덮어쓰지 않았다.

legacy startWorkers seam은 callable fail-closed로 남고 empty composition에서는 호출하지 않는다. API-017 및 owning-domain service registry는 Production worker registry로 재분류하지 않았다. global signal lifecycle과 final pool close는 top-level main/engine delegation이며 children의 권한이 아니다.

### Validation performed

| 검사 | 결과 |
|---|---|
| Required worker manifest | PASS — explicit empty, count=0; missing/malformed/unknown/non-empty FAIL-CLOSED |
| Listener / activation ordering | PASS — local HTTP fixture READY; gate failure에서는 listener 시작 없음 |
| Required worker startup | READY_EMPTY_MANIFEST — start call=0; API-017 promotion=NO |
| Partial rollback / worker order | PASS — fixture의 reverse start order, listener 뒤 remaining owner cleanup |
| Duplicate / shutdown / startup cleanup | PASS — no duplicate bind/signal/pool; repeated shutdown shared; hung handle 후 remaining cleanup 시도 |
| Physical runtime pool count | 1 — canonical construction과 fixture open/close count; actual Production 조회 아님 |
| Focused | 53 PASS |
| Affected | 96 PASS |
| Disposable PostgreSQL | N/A — schema/readiness/adapter 변경 없음 |
| Full regression | 1860 PASS / 1 authorized immutable historical-candidate fingerprint mismatch / 20 SKIP |
| Build / Lint / Typecheck | PASS |
| git diff --check / secret scan / links | PASS |
| Independent review | APPROVED — 두 cleanup finding을 bounded cleanup 및 regression coverage로 수정 후 재검토 |
| Preservation | primary dirty 2개와 historical untracked 4개 hash 유지; historical fingerprint/approved migrations diff 없음 |

### Known limitations / Next brief prerequisites

local listener fixture만 시작·종료했고 actual Production listener/workers는 시작하지 않았다. current Production worker count=0이며 future non-empty worker approval이나 deployment를 의미하지 않는다. cleanup deadline은 best-effort attempts의 bound이며 hung underlying operation의 cancellation을 보장하지 않는다. lifecycle 구현 readiness와 Production readiness를 구분한다. 추가 실행/closeout commit은 별도 사용자 지시를 요구한다.

현재 결과: PRE_LISTENER_STARTUP_CHAIN=READY; REQUIRED_WORKER_MANIFEST=PASS; WORKER_MANIFEST_EXPLICIT=YES; REQUIRED_WORKER_COUNT=0; REQUIRED_WORKER_STARTUP=READY_EMPTY_MANIFEST; ACTIVATION_OWNER=ProductionRuntimeActivation; RUNTIME_ACTIVATION=READY. PRODUCTION_READINESS=NOT_VERIFIED; PRODUCTION_DEPLOYABILITY=BLOCKED; PRODUCTION_RAILWAY_SUPABASE_MUTATION=0/0/0; Commit=NOT_CREATED; Push=NOT_PERFORMED.

현재 FINAL_RECOMMENDATION=APPROVE_REL002_R3D_RUNTIME_ACTIVATION.
