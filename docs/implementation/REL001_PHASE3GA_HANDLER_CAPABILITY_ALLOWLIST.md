# REL-001 Phase 3G-A Handler Capability Allowlist

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-159 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Security Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-152` (`APPROVED`) |

## 1. Closed capability model

`HandlerCapabilityContext`는 handler identity로 구별되는 closed discriminated union이어야 한다. 각 branch는 정확히 한 approved application port만 포함하며 index signature, optional generic services 또는 dynamic lookup을 포함하지 않는다.

```text
AI-001 context -> listingParseApplicationPort
AI-004 context -> requirementParseApplicationPort
AI-005 context -> matchingApplicationPort
```

이 이름은 계약 의미를 나타내는 conceptual shape이며 Phase 3G-A에서 TypeScript interface를 추가하지 않는다. 실제 interface는 기존 application boundary 이름을 재사용해야 하고, 그런 기존 port가 없으면 implementation을 중단하고 owner 결정을 요청한다.

## 2. Allowed capabilities

| Capability | Owner | Purpose | Allowed handlers | Mutability | Side-effect classification |
|---|---|---|---|---|---|
| immutable canonical Job context | API-017 | durable Job identity/input/tenant/scope/purpose 전달 | all 3 | immutable/read-only | `NONE` |
| exact handler-specific domain/application port | owning Domain/Application | 해당 `AI-001`, `AI-004`, `AI-005` application operation 수행 | matching handler only | port contract-bound | `DOMAIN_APPLICATION_ONLY` |
| safe immutable result/evidence reference return | API-017 / API-016 | runtime-owned completion/audit persistence 입력 | all 3 | immutable return value | `EVIDENCE_REFERENCE_ONLY` |

다음 기존 runtime dependency는 handler capability가 아니다.

| Runtime-owned boundary | Handler access |
|---|---|
| `DurableJobStore` | `NONE` |
| audit/evidence intent writer | `NONE`; runtime/store가 소유 |
| trusted failure mapper | `NONE`; runtime이 exception/result를 정규화 |
| server clock | `NONE`; handler chronology 생성 금지 |
| tenant/scope authorizer | `NONE`; immutable Job context와 live admission이 제공 |

Approved immutable configuration은 현재 세 handler에 필요하지 않으므로 allowlist에 포함하지 않는다. 향후 필요하면 exact field와 owner를 별도 AO amendment로 승인해야 한다.

## 3. Prohibited capabilities

공식 composition과 handler source에서 다음은 금지한다.

- `fetch`, HTTP client, socket/network client
- timer scheduler, `setInterval` 및 recurring primitive
- background task/worker launcher, detached task
- process/worker spawn, shell execution
- arbitrary filesystem reader/writer
- dynamic module/plugin loader
- arbitrary environment/config reader
- raw secrets, credentials, token 또는 header
- external provider SDK/client
- generic service locator, dependency container, `Map<string, unknown>` 또는 `Record<string, unknown>` capability bag

Canonical invariant는 다음과 같다.

```text
NETWORK_CAPABILITY = NONE
TIMER_CAPABILITY = NONE
BACKGROUND_EXECUTION_CAPABILITY = NONE
FILESYSTEM_CAPABILITY = NONE
PROCESS_CAPABILITY = NONE
```

## 4. Enforcement and testability

Phase 3G implementation은 최소한 다음을 증명해야 한다.

- registry/composition이 exact typed context만 만든다.
- prohibited fields와 generic lookup surface가 없다.
- source scan에서 direct network/timer/background/process/fs/env access가 `0`이다.
- runtime observation에서 network call과 timer/background creation이 `0`이다.
- undeclared/prohibited dependency가 있으면 registration/readiness가 fail closed 한다.
- handler-specific port가 다른 handler context로 교차 주입되지 않는다.

이 문서는 test contract만 정의하며 tests 또는 runtime interface를 구현하지 않는다.
