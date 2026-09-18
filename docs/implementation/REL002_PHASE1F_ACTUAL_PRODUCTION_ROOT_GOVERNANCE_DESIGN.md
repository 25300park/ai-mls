# REL-002 Phase 1F Actual Production Root Governance Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-297 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-166, DEC-168, DEC-170 (`APPROVED`) |
| Baseline | `3c2a03ac6787b0323846da6bfa2d3e52c72cc069` |

## 1. 목적

Phase 1E의 synthetic five-slot factory evidence를 실제 API-014/API-015/API-018/API-019/FEAT-022 Production roots에 연결하는 canonical governance boundary를 정의한다.

## 2. Actual root inventory

| Root | Existing composition | Current dependencies | Listener/worker owner | Bootstrap bypass | 최소 변경 |
|---|---|---|---|---|---|
| API-014 Publication | `composeProductionPublicationApi014NodeHttpServer` | publication infrastructure/UoW, application host, HTTP server | current factory starts host; caller owns server listen | factory is independently callable | prepare/start 분리, context 요구 |
| API-015 Administration | `composeProductionAdministrationApi015NodeHttpServer` | Administration UoW, live AuthorizationService, application, HTTP server | caller owns server listen | factory is independently callable | context 요구, listener start 후단화 |
| API-018 Connector | `createProductionConnectorApi018Composition` | connector UoW, coordinator, runtime app/host | current factory starts host | factory is independently callable | prepare/start 분리, context 요구 |
| API-019 External Integration | `createProductionExternalIntegrationComposition` | external-integration durable store, app, host/HTTP handler | current factory starts host | factory is independently callable | prepare/start 분리, context 요구 |
| FEAT-022 Advisory | `createProductionAdvisoryRuntime` | advisory store/runtime, unavailable provider adapter | no listener; caller can invoke returned runtime | module constructor is independently callable as Production composition | app-level wrapper/context, provider hold 보존 |

## 3. Canonical governance pattern

외부에서 호출 가능한 Production 시작점은 `startProductionRuntime()` 하나뿐이다. 내부 `ProductionRootBuilderRegistry`는 exact five builders를 compile-time closed set으로 소유한다. 임의 map 또는 synthetic factory injection은 test seam일 수 있으나 Production authority가 아니다.

각 builder는 module-private `ProductionBootstrapContext`를 요구하고 다음 contract를 반환한다.

- `prepare()` 또는 prepared component
- `start()`
- `readiness()`
- idempotent `close()`

Bootstrap은 모든 root를 `REQUIRE_EXISTING` persistence mode로 prepare한 뒤에만 listener/host/worker를 start한다. 중간 실패 시 역순으로 닫고 시작되지 않은 root를 READY로 표시하지 않는다.

## 4. Export and ownership rules

- 기존 lower-level constructors는 해당 module/app 내부 component constructor로 재사용한다.
- public barrel에서 독립 Production startup으로 노출된 factory는 제거하거나 architecture rule로 bootstrap registry 외 호출을 금지한다.
- app-level wrappers가 API-014/015/018/019를 구성한다. module이 app에 의존하는 역전은 금지한다.
- FEAT-022 module constructor는 provider-independent component constructor로 남고 app-level builder가 Production context와 hold를 적용한다.
- root는 store에 직접 schema 생성 권한을 부여하지 않는다.
- shutdown ownership은 bootstrap 하나가 가지며 LIFO로 실행한다.

## 5. Root-specific invariants

- API-014/015: listener는 aggregate gate와 five-root prepare가 모두 통과하기 전 시작하지 않는다.
- API-018/019: 현재 즉시 `host.start()`를 호출하는 경로를 prepare/start로 분리한다.
- FEAT-022: live provider `0/3 NOT_READY`, DEC-162 historical `IN REVIEW`, external hold를 보존한다.
- 각 root는 live identity/authorization adapter를 사용하며 bootstrap context를 business authority로 취급하지 않는다.

## 6. Decision proposal

`DEC-170 = APPROVED`: 단일 `startProductionRuntime()`과 closed five-builder registry를 canonical Production root authority로 정하고, lower-level roots의 독립 Production startup을 금지한다.
