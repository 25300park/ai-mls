# REL-002 Phase 1D Session UoW Lifecycle Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-292 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity/Operations Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-166 (`APPROVED`), DEC-168 (`APPROVED`) |
| Baseline | `66599a3b79490952bc53bbbec9193de1ac2a0b0b` |

## 1. Canonical owner

Production `DurableSessionUnitOfWork`의 유일한 lifecycle owner는 `ProductionBootstrap`이다. API, Console, worker, provider adapter 또는 `RegisteredServiceWorkload` store는 이를 생성·교체·종료하지 않는다.

## 2. Creation gate

현재 `DurableSessionUnitOfWork` constructor는 SQLite open, PRAGMA 설정과 `CREATE TABLE IF NOT EXISTS`를 수행한다. 그러므로 constructor 호출 자체가 side effect이며 `ProductionStartupValidationGate` PASS 이전에는 반드시 `0`이어야 한다.

| Stage | Session UoW | Allowed behavior |
|---|---|---|
| Raw/parsed config | absent | side-effect-free parse/validation |
| Identity availability/registration | absent | separate read-only Identity connection only |
| Secret resolution/gate | absent | exact-consumer resolution and aggregate validation |
| Gate failed | absent | safe error and read-only resource close |
| Gate PASS | create exactly one | Production Session UoW construction becomes eligible |
| Child composition/runtime | open, bootstrap-owned | narrowed Session ports injected |
| Failure/shutdown | closing then closed | reverse dependency cleanup |

## 3. Registration store separation

`DurableRegisteredServiceWorkloadStore`는 같은 Identity database boundary를 사용할 수 있지만 Session UoW 내부 repository가 아니다.

- Registration store: durable identity existence, lifecycle, workload assurance, tenant/principal binding.
- Session UoW: issued Session continuity, expiry, revocation and CAS.
- Authorization: live roles/scopes/capabilities/purpose.

Registration row를 Session row로 복제하거나 Session을 long-lived registration authority로 사용하지 않는다.

## 4. Injection model

Bootstrap은 child에 `SessionAccessCoordinator`, trusted Session resolver, 필요한 existing `SessionService` operation 및 live `AuthorizationService`만 전달한다. Raw UoW/SQLite handle, schema methods와 `close()` ownership은 전달하지 않는다.

## 5. Failure handling

- Constructor failure: no child/listener/worker/provider start; read-only identity connection과 앞서 생성된 resource를 close한다.
- Child failure: child resources를 역순 close한 뒤 Session UoW를 close한다.
- Runtime failure: ingress 차단 후 workers/listeners/children/UoWs를 역순 close한다.
- Concurrent shutdown은 idempotent single-close state machine으로 정규화한다.
- Raw SQLite/path/stack/SQL은 readiness 또는 external error DTO에 노출하지 않는다.

## 6. Migration readiness

Phase 2 migration은 Identity registration, Production Session 및 모든 child component schema를 provision/rehearse한다. Bootstrap은 gate PASS 뒤 Production prepared-schema Session UoW를 생성하고, 이어서 모든 component schema readiness를 read-only 검증한다. Phase 1 code가 missing Production schema를 자동 생성해 readiness로 오인하지 않는다.

현재 Session과 child durable constructors의 runtime DDL은 Production bootstrap 적용 시 migration-prepared schema validation mode로 분리되어야 한다. Phase 1B는 해당 fail-closed mode와 test-only pre-provisioned fixture 검증을 구현할 수 있지만 Production schema를 만들지 않는다. Phase 2 migration/rehearsal 뒤 Phase 1 return gate에서 실제 Production-bound compatibility를 확인한다.

## 7. Invariants

- Production에서 `createStagingSessionComposition()` 호출 `0`.
- PASS 전 Session UoW/DB mutation/table creation/migration `0`.
- Shared Session UoW count `1` per Production runtime.
- Child close authority `0`.
- Registration data에 authz/credential duplication `0`.
- Bootstrap fingerprint가 live authorization을 대체하는 경우 `0`.
