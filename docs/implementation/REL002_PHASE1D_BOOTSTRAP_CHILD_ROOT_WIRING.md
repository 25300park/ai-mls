# REL-002 Phase 1D Bootstrap Child Root Wiring

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-291 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture/Operations Owner |
| 기준일 | 2026-09-18 |
| Decision | DEC-168 (`APPROVED`) |
| Baseline | `66599a3b79490952bc53bbbec9193de1ac2a0b0b` |

## 1. 목표

Existing bounded Production roots의 business logic를 재작성하지 않고 canonical Production entry를 `ProductionBootstrap` 아래로 제한한다.

## 2. Child matrix

| Child | Existing factory | Required wrapper behavior | Forbidden change |
|---|---|---|---|
| API-014 Publication | `composeProductionPublicationApi014NodeHttpServer` | validated context와 narrowed Session/auth/persistence dependencies를 받아 prepared root 반환 | publication authority/lifecycle 재해석 |
| API-015 Administration | `composeProductionAdministrationApi015NodeHttpServer` | existing live authorization과 MFA/SoD 보존 | new role/capability 또는 identity ownership |
| API-018 Connector | `createProductionConnectorApi018Composition` | closed connector contract, durable idempotency와 no implicit provider 보존 | network/provider activation |
| API-019 External Integration | `createProductionExternalIntegrationComposition` | evidence/identity mapping과 concealment 보존 | new API-019 semantics |
| FEAT-022 Advisory | `createProductionAdvisoryRuntime` | provider-independent runtime와 external hold 보존 | credential access/provider call/fallback |

## 3. Wrapper contract

```ts
interface PreparedProductionChildRoot {
  readonly childId: "API-014" | "API-015" | "API-018" | "API-019" | "FEAT-022";
  start(): Promise<void>;
  readiness(): "READY" | "NOT_READY";
  close(): Promise<void>;
}

type ProductionChildRootFactory = (
  context: ProductionBootstrapContextView,
  dependencies: Readonly<ProductionChildDependencies>,
) => PreparedProductionChildRoot;
```

각 existing Production factory signature는 `ProductionBootstrapContextView`를 필수 parameter로 받고 첫 동작으로 exported `assertProductionBootstrapContext()`를 호출한다. Raw no-context Production export는 제거하고 barrel/architecture checks가 direct no-context import를 거부한다. Issuer는 `production-bootstrap.ts` 내부에만 있어 direct caller는 유효 context를 만들 수 없다. Existing lower-level factory를 public API나 auth authority로 바꾸지 않는다.

## 4. Prepare/start separation

Child construction과 external ingress/execution start를 구분한다.

1. Bootstrap PASS 뒤 child dependency와 prepared root를 구성한다.
2. 모든 mandatory child의 persistence/schema readiness를 확인한다.
3. Listener를 canonical order로 시작한다.
4. Explicit worker를 시작한다.
5. 별도 승인된 경우에만 provider-capable execution을 enable한다.

현재 factory가 construction 중 host lifecycle을 시작한다면 RED test로 실제 bypass를 증명한 뒤 최소 wrapper/option으로 prepare와 external start를 분리한다. 모든 child durable store는 Production `preparedSchemaOnly` mode에서 schema compatibility만 검사하고 runtime DDL을 실행하지 않는다. Domain service와 handler semantics는 변경하지 않는다.

## 5. Shared dependency projection

Child에는 raw `DurableSessionUnitOfWork`, raw database connection, global secret resolver 또는 mutable configuration을 전달하지 않는다. 필요한 경우 다음 narrowed ports만 전달한다.

- `SessionAccessCoordinator`;
- trusted Session resolver;
- existing live `AuthorizationService`;
- `ProductionServiceIdentityRevalidator` for pre-work registration lifecycle/binding checks;
- child-owned persistence port;
- safe readiness/close hooks;
- exact-consumer secret accessor (authorized consumer only).

Child는 shared Session UoW close authority를 얻지 않는다.

## 6. Staging and bypass controls

- Production은 `createStagingSessionComposition()`을 호출하지 않는다.
- Staging fixture/config/reference가 Production config에 나타나면 fail closed한다.
- Direct child factory call은 canonical Production launcher에 등록하지 않는다.
- Context 없는 direct Production factory call은 signature/runtime assertion/architecture test에서 모두 차단한다.
- Context cloning, JSON round-trip 또는 caller-created lookalike는 membership assertion을 통과하지 못한다.
- Child `READY` 하나를 aggregate Production `READY`로 승격하지 않는다.

## 7. Component schema readiness

Phase 2가 provision한 schema를 child construction 전에 read-only 검사한다.

| Child | Durable store requiring prepared-schema mode |
|---|---|
| API-014 | `modules/publication/src/publication-durable-persistence.ts` |
| API-015 | `modules/administration/src/administration-durable-persistence.ts` |
| API-018 | `modules/source/src/connector-durable-persistence.ts` |
| API-019 | `modules/source/src/external-integration-durable-persistence.ts` |
| FEAT-022 | `modules/ai/src/advisory-durable-persistence.ts` |

Missing/incompatible schema yields `NOT_READY`, creates no table and prevents every child/listener/worker start.

## 8. Shutdown order

Provider execution disable → workers stop/drain → listeners stop ingress → child roots close → child persistence close → Session UoW close → read-only Identity authority lease close 순서다. 한 close 실패가 이후 close를 막지 않는다.
