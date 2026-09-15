# REL-001 Phase 4A AI-001 Execution Readiness

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-171 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | AI Reviewer / Listing Data Owner |
| 기준일 | 2026-09-15 |
| Capability | `AI-001 — Listing parsing` |

## 1. Contract and mapping

| Item | Canonical value / evidence | Status |
|---|---|---|
| API-017 Job | `AI_LISTING_PARSE` | READY |
| application port | `Ai001ListingParseApplicationPort` | PORT_READY |
| expected input | `AdvisoryExecutionRequest` narrowed to `AI-001` and Listing Parser schema | READY |
| expected output | `AcceptedAdvisoryRecord` containing `Ai001Output` | READY |
| application implementation | shared `AdvisoryRuntime.execute()` | PARTIAL; thin adapter required |
| application port alignment | existing runtime can be narrowed without new semantics | `THIN_ADAPTER_REQUIRED` |
| provider abstraction | `AdvisoryAdapter` / `AdvisoryAdapterIntent` | PARTIAL |
| provider adapter | unavailable Production adapter only | MISSING for success |
| prompt | immutable prompt metadata exists; approved prompt body/asset resolver absent | PARTIAL |
| provider/model selection | no approved provider, model or routing decision | OWNER_DECISION_REQUIRED |
| network requirement | real provider execution requires external network | REQUIRED_LATER; Phase 4A `0` |
| credential requirement | provider-specific; source/config absent | REQUIRED_LATER; handler access `0` |
| observability | adapter version/execution fingerprint only | PARTIAL; provider/model/latency/usage absent |
| output schema | `urn:ai-mls:schema:listing-parser-output:v0.1` | READY |
| failure mapping | provider exceptions collapse safely to `ADVISORY_UNAVAILABLE` | PARTIAL |
| human review | output remains advisory and `reviewRequired`; downstream truth needs human authority | PARTIAL boundary |
| Staging execution | no approved provider/config/credential/network | NOT_READY |
| current implementation status | contract and shared foundation only | NOT_EXECUTABLE |

## 2. Security and provenance

- Tenant/scope and `inputReference` must match the trusted snapshot before adapter invocation.
- Raw Source content is not an API-017 handler input; the FEAT-022 snapshot/prompt boundary owns minimization.
- Initiating principal remains authoritative in the durable Job. Exact safe provenance linkage into advisory evidence is unresolved.
- Provider is never the initiating, reviewing or approving human principal.
- Raw prompt/provider response, credentials and chain-of-thought cannot enter Job result or API-016 evidence.

## 3. Failure and audit

Malformed output is rejected before accepted persistence. Adapter error/timeout becomes safe `ADVISORY_UNAVAILABLE`, but canonical provider failure/rate-limit classification and the final API-017 `DEPENDENCY_UNAVAILABLE | JOB_RESULT_INVALID` mapping are not yet closed. Existing Phase 3F Job audit evidence remains authoritative; no new Audit vocabulary is authorized.

## 4. Readiness

| Gate | Result |
|---|---|
| `PORT_READY` | YES |
| `APPLICATION_SERVICE_READY` | NO — shared runtime PARTIAL |
| `PROVIDER_ABSTRACTION_READY` | NO — PARTIAL |
| `PROVIDER_ADAPTER_READY` | NO |
| `CONFIG_READY` | NO |
| `CREDENTIAL_BOUNDARY_READY` | NO |
| `PROMPT_READY` | NO — metadata only |
| `OUTPUT_SCHEMA_READY` | YES |
| `FAILURE_MAPPING_READY` | NO — PARTIAL |
| `HUMAN_REVIEW_READY` | NO — bounded projection only |
| `AUDIT_READY` | NO — Job audit exists; exact advisory binding missing |
| `STAGING_EXECUTION_READY` | NO |
