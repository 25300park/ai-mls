# REL-002 Phase 1C Production Composition Root Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-284 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture/Operations Owner |
| 기준일 | 2026-09-18 |
| Decision | DEC-166 (`APPROVED`) |
| Baseline | `42d65b9533eecb4cc579859c17bb91ba4f44e70e` |

## 1. Recommendation

Production composition은 `SHARED_BOOTSTRAP_MULTI_ROOT`를 사용한다. 하나의 `ProductionBootstrap`이 공통 validation과 lifecycle ordering을 소유하고, 기존 bounded roots는 bootstrap PASS 뒤에 생성되는 child roots로 유지한다.

이 방식은 기존 API-014, API-015, API-018, API-019 및 FEAT-022 composition을 하나의 거대 root로 재작성하지 않으면서 Production bypass를 차단한다.

## 2. Canonical ordering

```text
raw runtime configuration
→ parse immutable ProductionRuntimeConfiguration
→ validate environment and non-secret configuration
→ verify service and human identity authority availability, including RegisteredServiceWorkload authority
→ validate and resolve mandatory secret references through exact consumers
→ ProductionStartupValidationGate PASS
→ create DurableSessionUnitOfWork
→ construct authorized persistence/UoW dependencies
→ construct API-014 / API-015 / API-018 / API-019 / FEAT-022 child roots
→ initialize authorized schema/mutations
→ start listeners and explicit workers
→ enable only separately authorized provider-capable execution paths
→ expose readiness
```

Gate 실패 시 `DurableSessionUnitOfWork` 생성, database open/schema mutation, listener start, worker start 및 provider-capable runtime start는 모두 `0`이다.

## 3. Bootstrap contract

```ts
interface ProductionBootstrap {
  start(input: unknown): Promise<Readonly<ProductionRuntimeHandle>>;
}

interface ProductionRuntimeHandle {
  readonly validationFingerprint: string;
  readonly childRoots: Readonly<ProductionChildRootStatus>;
  close(): Promise<void>;
}
```

`start()`는 PASS 전 runtime handle을 반환하지 않는다. `close()`는 신규 work 유입과 실행을 먼저 차단한 뒤 provider execution, workers, listeners, child roots, component UoWs 및 `DurableSessionUnitOfWork` 순서로 종료한다. 일부 child startup 실패 시에도 이미 생성된 resource를 dependency-safe reverse order로 정리한다.

## 4. Existing root reconciliation

| Existing root | Disposition | Bootstrap rule |
|---|---|---|
| API-014 Publication | bounded child | validated dependencies만 주입; 자체 authority semantics 보존 |
| API-015 Administration | bounded child | live administration-backed authorization 유지 |
| API-018 Connector | bounded child | closed connector contract와 no implicit provider rule 보존 |
| API-019 External Integration | bounded child | canonical evidence/identity mapping 보존 |
| FEAT-022 Advisory | bounded child | provider-independent boundary와 external hold 보존 |

Existing factory는 직접 Production entry point로 호출되지 않는다. 후속 구현은 validated bootstrap context 없이는 child root를 만들 수 없도록 내부 composition 경계를 좁혀야 한다.

## 5. Identity and secret ordering

- Bootstrap은 human authentication/Session/live-authorization authority와 `RegisteredServiceWorkloadAuthority`의 read-only availability, 그리고 required service registrations를 gate 입력으로 검증한다.
- Authorization은 기존 live `AuthorizationService`가 계속 소유한다.
- Secret resolver는 exact environment/consumer binding만 확인하며 secret value를 global configuration에 저장하지 않는다.
- External provider secret이나 network authority는 DEC-162/163 hold를 우회하지 못한다.

## 6. Staging separation

`createStagingSessionComposition()`과 기존 Staging roots는 변경하지 않는다. Production bootstrap은 Staging root를 rename, promote 또는 fallback하지 않는다. Staging configuration, fixture, in-memory authority 및 credential reference가 발견되면 Production startup은 fail closed한다.

## 7. Readiness and error safety

- PASS 이전 readiness는 `NOT_READY`다.
- Child root의 부분 실패를 전체 PASS로 표시하지 않는다.
- Error는 stable safe code와 correlation ID만 노출한다.
- raw config, secret reference/value, path, SQL, stack 및 provider payload는 노출하지 않는다.
- Provider-capable root 생성은 provider execution authorization과 동일하지 않다. 별도 network/credential approval가 없으면 execution은 disabled 상태다.

## 8. Decision status

DEC-166은 2026-09-18 Architecture Owner closeout으로 `APPROVED`되었다. 이 승인은 composition design을 확정하지만 기존 Production roots의 호출 경로나 lifecycle implementation을 자동 승인하지 않는다.
