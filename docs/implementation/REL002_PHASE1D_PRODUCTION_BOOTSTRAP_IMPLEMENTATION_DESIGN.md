# REL-002 Phase 1D Production Bootstrap Implementation Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-290 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture/Operations Owner |
| 기준일 | 2026-09-18 |
| Decisions | DEC-166 (`APPROVED`), DEC-168 (`APPROVED`) |
| Baseline | `66599a3b79490952bc53bbbec9193de1ac2a0b0b` |

## 1. Ownership

`ProductionBootstrap`은 Production startup/shutdown orchestration만 소유한다. Configuration, Identity, Authorization, Session, component persistence 또는 provider business semantics의 authority가 아니다.

## 2. Canonical startup ordering

```text
raw configuration acquisition
→ ProductionRuntimeConfiguration parse
→ environment/non-secret configuration validation
→ mandatory SECRET_REFERENCE presence/shape validation
→ read-only identity authority availability
→ service/human identity validation
→ required secret resolution by exact consumer
→ ProductionStartupValidationGate PASS
→ create DurableSessionUnitOfWork
→ verify component persistence/schema readiness
→ construct API-014/API-015/API-018/API-019/FEAT-022 child roots
→ start listeners
→ start explicit workers
→ enable separately authorized provider-capable runtime
→ publish READY
```

순서는 고정이며 lower-environment fallback이나 child factory direct entry로 우회할 수 없다.

## 3. Pre-gate side-effect budget

Identity authority availability와 registration verification을 위한 read-only connection만 조건부 허용한다.

| Side effect before PASS | Required count |
|---|---:|
| `DurableSessionUnitOfWork` construction | 0 |
| schema mutation/table creation | 0 |
| migration execution | 0 |
| child root construction/start | 0 |
| listener/worker start | 0 |
| provider-capable execution | 0 |

Read-only identity authority lease는 failure 시 즉시 close된다. PASS 시에는 runtime lifecycle revalidation을 위해 bootstrap이 유지하고 shutdown에서 닫으며 Production mutation startup으로 간주하지 않는다.

## 4. Internal construction proof

`ProductionBootstrapContext`가 필요하다. 이 object는 public structural type만으로 위조 가능하면 안 되므로 issuance와 orchestration을 `apps/api/src/production-bootstrap.ts` 하나에 co-locate하고 runtime membership proof를 사용한다.

```ts
interface ProductionBootstrapContextView {
  readonly validationFingerprint: string;
  readonly configurationReference: string;
}

// production-bootstrap.ts 내부에만 존재
const validContexts = new WeakSet<object>();

// not exported; startProductionRuntime()만 호출
function issueProductionBootstrapContext(
  input: ProductionBootstrapContextView,
): Readonly<ProductionBootstrapContextView>;

// child production factories가 runtime 검증을 위해 import
export function assertProductionBootstrapContext(
  value: unknown,
): asserts value is Readonly<ProductionBootstrapContextView>;
```

Issuer와 membership set은 외부에 export하지 않는다. Assertion만 export한다. Existing Production child factory는 context parameter를 필수화하고 이 assertion을 직접 호출하므로 direct caller가 lookalike를 만들어도 실패한다. Context type/issuer와 bootstrap을 별도 module로 나누지 않는다.

Context는 authorization token, business capability, credential 또는 durable record가 아니다. Gate PASS fingerprint와 validated configuration reference만 가진다.

## 5. Bootstrap interface

```ts
interface ProductionBootstrapDependencies {
  readonly parseConfiguration: (raw: unknown) => ProductionRuntimeConfiguration;
  readonly validateConfiguration: (config: ProductionRuntimeConfiguration) => void;
  readonly validateMandatorySecretReferences: (
    config: ProductionRuntimeConfiguration,
  ) => void;
  readonly openIdentityAuthorityReadOnly: () => RegisteredServiceWorkloadAuthorityLease;
  readonly validateHumanIdentityAuthority: (
    config: ProductionRuntimeConfiguration,
  ) => void;
  readonly resolveRequiredServiceIdentities: (
    store: RegisteredServiceWorkloadAuthorityLease,
    config: ProductionRuntimeConfiguration,
  ) => readonly ProductionServiceIdentityBinding[];
  readonly resolveRequiredSecrets: (config: ProductionRuntimeConfiguration) => void;
  readonly validateStartupGate: () => string;
  readonly createSessionUnitOfWork: () => DurableSessionUnitOfWork;
  readonly assertComponentSchemasReady: (
    config: ProductionRuntimeConfiguration,
  ) => void;
  readonly childRoots: ProductionChildRootFactories;
}

interface ProductionRuntimeHandle {
  readonly validationFingerprint: string;
  readiness(): "READY" | "NOT_READY";
  close(): Promise<void>;
}
```

Raw secret values와 mutable configuration은 runtime handle/context에 포함하지 않는다.

## 6. Failure atomicity

Bootstrap은 생성된 resource마다 close callback을 LIFO cleanup stack에 즉시 등록한다.

- Gate 전 failure: read-only identity connection만 close하고 `NOT_READY`를 반환/투영한다.
- Session UoW 또는 component persistence readiness failure: 이후 child/listener/worker를 시작하지 않고 생성된 resource를 역순 close한다. Readiness inspection은 이미 provision된 schema만 읽으며 DDL을 실행하지 않는다.
- Child construction failure: 이미 생성된 child와 Session UoW를 역순 close한다.
- Listener/worker failure: 새 ingress/execution을 차단하고 이미 시작된 worker/listener/child/UoW를 역순 종료한다.
- Cleanup failure는 다음 cleanup을 막지 않으며 safe normalized evidence로만 기록한다.
- `READY`는 모든 mandatory child/listener/worker가 성공하고 provider hold가 정확히 투영된 뒤에만 가능하다.

Existing Publication, Administration, Connector, External Integration 및 Advisory durable constructors의 runtime DDL은 Production prepared-schema mode에서 모두 금지된다. Phase 1 implementation은 각 store에 read-only schema assertion/`preparedSchemaOnly` 경계를 추가하고, Phase 2 migration 전 Production start는 fail closed한다.

## 7. Provider boundary

FEAT-022 child root construction은 provider execution authorization이 아니다. DEC-162 historical `IN_REVIEW`와 external hold를 보존한다. 별도 network/credential authorization이 없으면 provider-capable runtime call count는 `0`이다.

## 8. DEC-168 승인 결과

DEC-168 `ProductionBootstrap Runtime Construction Contract`는 2026-09-18 Architecture Owner closeout으로 `APPROVED`되었다. 이 승인은 runtime construction design을 확정하지만 context issuance, child-root wrapping 또는 Production runtime implementation을 자동 승인하지 않는다.
