# REL-001 Phase 4A FEAT-022 Executable Lifecycle Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-170 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Reviewer / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `6b9ff6b47f6c1a1088aadf3eb542713744bb45f8` |
| 범위 | REL-001 Phase 4A |

## 1. Objective

Phase 3 API-017 runtime의 세 approved application port 뒤에 FEAT-022 provider-backed executable lifecycle을 연결하려면 무엇이 이미 존재하고 무엇이 결정·구현되어야 하는지 Production source와 canonical documents를 대조한다. Provider call, network, credential 또는 Production/Test 변경은 수행하지 않는다.

## 2. Canonical evidence inspected

- [Provider Abstraction](../book-4/03_PROVIDER_ABSTRACTION.md)
- [Human Review](../book-4/11_HUMAN_REVIEW.md)
- [Prompt Governance](../book-4/12_PROMPT_GOVERNANCE.md)
- [AI Observability](../book-4/13_AI_OBSERVABILITY.md)
- [AI Output Schemas](../book-4/14_AI_OUTPUT_SCHEMAS.md)
- [FEAT-022-C Design](FEAT022_C_AI_ADVISORY_RUNTIME_FOUNDATION_DESIGN.md)
- [FEAT-022-C Completion](../reviews/FEAT022_C_AI_ADVISORY_RUNTIME_FOUNDATION_COMPLETION.md)
- [FEAT-022 Final Gate](../reviews/FEAT022_FINAL_GATE_REPORT.md)
- [Phase 3G-C ports](REL001_PHASE3GC_AI_HANDLER_APPLICATION_PORT_DECISION.md)
- `modules/ai/src/advisory-runtime-contracts.ts`, `advisory-runtime.ts`, `advisory-durable-persistence.ts`, `advisory-production-composition.ts`, `advisory-ai-service.ts`
- `modules/jobs/src/job-execution-runtime.ts`, `job-durable-persistence.ts`

## 3. Existing Production implementation

| Boundary | Production evidence | Actual state |
|---|---|---|
| canonical capability/output types | `advisory-ai-service.ts` | EXISTS_AND_CANONICAL for `AI-001`~`AI-007` |
| strict output validation | `validateAdvisoryResult()` | EXISTS_AND_CANONICAL |
| application runtime | `AdvisoryRuntime.execute()` | PARTIAL: provider-neutral execution and persistence exist |
| trusted input | `AdvisorySnapshotResolver` | EXISTS_AND_CANONICAL; tenant/scope/reference checked |
| prompt metadata | `AdvisoryPromptRecord`, `DurableAdvisoryStore` | PARTIAL: identity/fingerprint/status only; body/asset registry absent |
| durable advisory/idempotency | `DurableAdvisoryStore` | EXISTS_AND_CANONICAL |
| provider abstraction | `AdvisoryAdapter`, `AdvisoryAdapterIntent` | PARTIAL: interface exists; production adapter contract closure absent |
| Production composition | `createProductionAdvisoryRuntime()` | fail-closed unavailable adapter only |
| deterministic adapter | `advisory-test-adapter.ts` | test-only; not Production evidence |
| human review | durable `reviewRequired` projection; legacy `AdvisoryAiService.review()` | PARTIAL; public/durable review execution remains deferred |
| observability | adapter version and execution fingerprints | PARTIAL; no provider/model/latency/usage runtime telemetry |
| API-017 integration | three approved application-port contracts | contract `3/3`; implementation `0/3` |

## 4. Missing executable lifecycle

Current Production runtime rejects arbitrary adapter injection and always uses `production-unavailable-v1`. No approved provider/model, router, adapter, credential source, provider configuration, prompt content resolver or external destination exists. Therefore a new advisory can never reach a successful provider-backed result in Production/Staging.

The minimum future flow remains:

```text
API-017 durable one-shot runtime
→ capability-specific handler
→ exact FEAT-022 application port
→ AdvisoryRuntime
→ approved provider abstraction/adapter
→ approved external provider
→ FEAT-022 normalization and strict validation
→ durable advisory/evidence/idempotency
→ bounded Job result mapping
```

API-017 receives no provider credential, SDK/client, network capability, raw prompt, raw provider response or provider-specific error.

## 5. Canonical decision gaps

Seven owner decisions remain before provider-backed Production implementation may start.

1. approved provider/model/capability/data-class selection and evaluation gate;
2. fixed versus routed/configured selection and compatible fallback policy;
3. credential source, configuration owner, secret access, rotation and Staging binding;
4. Production prompt asset/body resolution, approval, activation and version binding;
5. provider timeout, rate-limit, retry and fallback policy without invented numeric values;
6. provider response normalization, safe failure/evidence and observability metadata;
7. exact API-017 Job ↔ FEAT-022 request/result/principal/audit binding.

## 6. Provider-independent blockers

Provider-independent blocker categories는 `2`이다.

1. Exact three application-port adapters/thin handlers and Job input/result binding are not implemented.
2. Production prompt content/asset resolution and activation are not implemented.

이 둘도 위 canonical decisions가 닫히기 전에는 구현할 수 없다.

## 7. Current disposition

| Metric | Result |
|---|---|
| Port contracts | `3/3 READY` |
| Fully executable application services | `0/3` |
| Production provider adapters | `0/3` |
| Staging executable capabilities | `0/3` |
| Unresolved canonical decisions | `7` |
| Provider-independent blocker categories | `2` |
| Later scoped network permission required | YES |
| Phase 4 Production implementation authorization | NO |
