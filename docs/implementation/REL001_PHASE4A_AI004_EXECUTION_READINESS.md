# REL-001 Phase 4A AI-004 Execution Readiness

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-172 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | AI Reviewer / Business Owner |
| 기준일 | 2026-09-15 |
| Capability | `AI-004 — Requirement parsing` |

## 1. Contract and mapping

| Item | Canonical value / evidence | Status |
|---|---|---|
| API-017 Job | `AI_REQUIREMENT_PARSE` | READY |
| application port | `Ai004RequirementParseApplicationPort` | PORT_READY |
| expected input | request narrowed to `AI-004` and Requirement Parser schema | READY |
| expected output | record containing `Ai004Output` | READY |
| application implementation | shared `AdvisoryRuntime.execute()` | PARTIAL; thin adapter required |
| application port alignment | existing runtime can be narrowed without new semantics | `THIN_ADAPTER_REQUIRED` |
| provider abstraction | `AdvisoryAdapter` / provider-neutral intent | PARTIAL |
| provider adapter | successful Production adapter absent | MISSING |
| prompt | metadata/status persistence only; approved prompt asset resolution absent | PARTIAL |
| provider/model selection | no approved provider, model or routing decision | OWNER_DECISION_REQUIRED |
| network requirement | real provider execution requires external network | REQUIRED_LATER; Phase 4A `0` |
| credential requirement | provider-specific; source/config absent | REQUIRED_LATER; handler access `0` |
| observability | adapter version/execution fingerprint only | PARTIAL; provider/model/latency/usage absent |
| output schema | `urn:ai-mls:schema:requirement-parser-output:v0.1` | READY |
| failure mapping | safe generic runtime error only | PARTIAL |
| human review | draft/clarification output requires authorized human review before Requirement activation | PARTIAL boundary |
| Staging execution | unavailable | NOT_READY |
| current implementation status | contract and shared foundation only | NOT_EXECUTABLE |

## 2. Security and provenance

- No original requirement text, Client history or current Session is added to the API-017 port payload.
- Tenant/scope and Requirement reference must resolve through trusted snapshot evidence.
- Provider cannot infer consent, activate a Requirement or act as principal.
- Initiating principal linkage remains in the Job and requires exact advisory evidence binding.

## 3. Failure and audit

Strict schema validation prevents raw provider objects and authority-shaped output from becoming accepted advisory evidence. Provider timeout/rate-limit/failure categories, safe technical evidence and Job failure mapping remain unresolved. API-017 retry-as-successor is not provider retry.

## 4. Readiness

| Gate | Result |
|---|---|
| `PORT_READY` | YES |
| `APPLICATION_SERVICE_READY` | NO — PARTIAL |
| `PROVIDER_ABSTRACTION_READY` | NO — PARTIAL |
| `PROVIDER_ADAPTER_READY` | NO |
| `CONFIG_READY` | NO |
| `CREDENTIAL_BOUNDARY_READY` | NO |
| `PROMPT_READY` | NO — metadata only |
| `OUTPUT_SCHEMA_READY` | YES |
| `FAILURE_MAPPING_READY` | NO — PARTIAL |
| `HUMAN_REVIEW_READY` | NO — downstream review execution deferred |
| `AUDIT_READY` | NO — exact advisory binding missing |
| `STAGING_EXECUTION_READY` | NO |
