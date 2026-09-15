# REL-001 Phase 3G-C AI Handler Application Port Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-162 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / AI Reviewer |
| 기준일 | 2026-09-15 |
| 기준 commit | `adbe7cbc6978c1fe9244f818a66ddfa3d50af725` |
| Decision | `DEC-153` (`APPROVED`) |

## 1. Decision

FEAT-022 application layer는 정확히 세 handler-specific port를 소유한다.

| Job type | Capability | Port contract |
|---|---|---|
| `AI_LISTING_PARSE` | `AI-001` | `Ai001ListingParseApplicationPort` |
| `AI_REQUIREMENT_PARSE` | `AI-004` | `Ai004RequirementParseApplicationPort` |
| `AI_MATCHING` | `AI-005` | `Ai005MatchingApplicationPort` |

각 port는 기존 `AdvisoryRuntime.execute()`의 capability-specific narrowed view이다. 새 AI operation, request field, output field, lifecycle, confidence, authorization 또는 provider semantics를 추가하지 않는다. `GenericAiJobPort`, `GenericHandlerPort`, capability map, service locator와 plugin system은 금지한다.

## 2. Dependency direction

```text
API-017 thin handler
→ exact FEAT-022 application port
→ existing AdvisoryRuntime
→ existing AdvisoryAdapter boundary
```

API-017는 orchestration, durable Job lifecycle, CAS/idempotency와 safe Job failure mapping만 소유한다. FEAT-022는 capability semantics, trusted snapshot resolution, prompt/schema binding, canonical output validation, advisory persistence와 provider boundary를 소유한다. FEAT-022 implementation은 API-017에 의존하지 않는다.

## 3. Existing capability inventory

| Capability | Canonical definition | Existing application boundary | Input | Output | Persistence | Provider/network | Audit/evidence | Tenant/scope | Failure |
|---|---|---|---|---|---|---|---|---|---|
| `AI-001` | Book 4 Listing Parser | `AdvisoryRuntime.execute` | `AdvisoryExecutionRequest` narrowed to `AI-001` | `AcceptedAdvisoryRecord` containing `Ai001Output` | `DurableAdvisoryStore` | successful Production path requires approved adapter; current Production adapter unavailable | immutable advisory/provenance/idempotency record | request + trusted snapshot exact match | safe `AdvisoryRuntimeError` |
| `AI-004` | Book 4 Requirement Parser | `AdvisoryRuntime.execute` | request narrowed to `AI-004` | record containing `Ai004Output` | same existing store | same | same | same | same |
| `AI-005` | Book 4 Matching and Ranking | `AdvisoryRuntime.execute` | request narrowed to `AI-005` | record containing `Ai005Output` | same existing store | same | same | same | same |

## 4. Port surface

각 port는 method 하나만 갖는다.

```text
execute(exactCapabilityRequest) -> exactCapabilityAcceptedAdvisoryRecord
```

Input은 기존 `AdvisoryExecutionRequest`의 필드를 삭제·추가하지 않고 `capabilityId`와 `schemaId`만 exact literal로 좁힌다. Output은 기존 `AcceptedAdvisoryRecord`와 `AdvisoryResultEnvelope`를 재사용하고 capability output만 `Ai001Output`, `Ai004Output`, `Ai005Output`으로 좁힌다.

Session, HTTP request, runtime container, Job Store, generic context, credential, provider client 또는 environment reader는 port에 전달하지 않는다.

## 5. Network and execution disposition

Port interface는 network capability를 노출하지 않는다. Provider dependency는 FEAT-022 `AdvisoryAdapter` 뒤에 남는다. 현재 Production composition은 `production-unavailable-v1` adapter만 사용하며 모든 신규 generation을 `ADVISORY_UNAVAILABLE`로 fail closed 한다. Deterministic no-network adapter는 test 전용이므로 Production handler로 승격하지 않는다.

따라서 세 capability는 모두 `PROVIDER_REQUIRED`, `NO_NETWORK_EXECUTION_READY = NO`, `STAGING_EXECUTION_READY = NO`이다.

## 6. Unresolved runtime bindings

Port contract는 닫혔지만 API-017 durable Job에서 다음 `AdvisoryExecutionRequest` 필드로 가는 canonical binding은 아직 구현·승인되지 않았다.

- 하나의 `inputReference` 선택과 version 문자열 변환
- `promptId`, `promptVersion`
- advisory `idempotencyKey`
- successful advisory record에서 Job `resultChecksum`과 `evidenceRefs`로 가는 exact binding

이 항목은 새 field를 허용하지 않으며 기존 identity를 어떻게 결속할지만 별도 implementation decision으로 닫아야 한다.

## 7. Preserved boundaries

DEC-152, Phase 3C–3F, DEC-151, FEAT-022 canonical output schemas와 advisory-only authority는 유지한다. Provider call, network, Production/Test code, dependency와 runtime interface 변경은 모두 `0`이다.
