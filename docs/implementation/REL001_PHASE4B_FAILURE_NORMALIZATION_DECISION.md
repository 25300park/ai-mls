# REL-001 Phase 4B Failure Normalization Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-183 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | AI Reviewer / API Owner |
| 기준일 | 2026-09-15 |

## 1. Safe normalization path

```text
raw provider/network failure
→ provider adapter strips unsafe detail
→ FEAT-022 existing safe runtime error
→ capability adapter maps to existing API-017 failure code
```

Raw exceptions, headers, credentials, request/response bodies, prompts, chain-of-thought, stack traces and filesystem/database paths never cross into API-017.

## 2. Existing-vocabulary mapping

| FEAT-022 safe result | API-017 mapping | Rationale |
|---|---|---|
| `ADVISORY_UNAVAILABLE` | `DEPENDENCY_UNAVAILABLE` | provider/runtime dependency did not return authoritative output |
| `PROMPT_NOT_ACTIVE` | `DEPENDENCY_UNAVAILABLE` | required approved runtime dependency is unavailable |
| `ADVISORY_INPUT_UNAVAILABLE` | `JOB_RESULT_INVALID` | authoritative bounded input cannot be constructed |
| `SCHEMA_CAPABILITY_MISMATCH` | `JOB_RESULT_INVALID` | requested canonical binding is invalid |
| `ADVISORY_OUTPUT_REJECTED` | `JOB_RESULT_INVALID` | strict canonical validator rejected output |

This mapping introduces no new public Job or AI failure vocabulary. Provider-specific timeout/rate-limit diagnostics collapse to `ADVISORY_UNAVAILABLE`; fine-grained provider telemetry may be added only after an approved provider contract.

## 3. Provider adapter responsibility

An approved future adapter may translate a bounded request, execute network I/O, capture a response privately, reconstruct a safe normalized value, and emit allowed telemetry metadata. It owns no business ranking/matching logic, approval authority, Job lifecycle, tenant identity or provider selection policy.

## 4. Output validation

`raw provider response → FEAT-022 parser/validator → canonical output → application result` is mandatory. Invalid or unknown structure fails closed. API-017 never receives unvalidated provider output.

## 5. Observability allowlist

Allowed after provider approval: provider/model references, capability/version, latency, bounded usage counts, normalized outcome/failure, correlation/evidence reference. Forbidden: credentials, secret-bearing headers, raw provider response, sensitive raw prompt, chain-of-thought and unrestricted business data.

## 6. Disposition

Existing failure vocabulary is sufficient for safe boundary mapping. Provider-specific observability and exact timeout classification remain part of the unresolved provider contract; no new failure vocabulary is authorized.
