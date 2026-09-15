# REL-001 Phase 4A Provider Boundary Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-174 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Reviewer / Security Owner |
| 기준일 | 2026-09-15 |

## 1. Canonical classification

| Provider concern | Canonical evidence | Production evidence | Classification | Required closure |
|---|---|---|---|---|
| provider interface | provider-neutral intent/adapter boundary | `AdvisoryAdapter` | EXISTS_AND_CANONICAL | preserve; extend only by approved contract |
| provider intent | capability/schema/reference/fingerprint metadata | `AdvisoryAdapterIntent` | EXISTS_AND_CANONICAL | keep provider-neutral and minimized |
| provider registry/router | policy-aware router documented | none | DOCUMENTED_ONLY | OWNER_DECISION_REQUIRED |
| provider/model selection | selection principles documented; named provider none | none | DOCUMENTED_ONLY | OWNER_DECISION_REQUIRED |
| timeout policy | timeout class concept only | no runtime field/policy | MISSING | OWNER_DECISION_REQUIRED |
| provider failure classification | outage/error boundary documented | all throws become `ADVISORY_UNAVAILABLE` | PARTIAL | approve safe categories and mapping |
| response normalization | provider-neutral envelope and strict validator | validator rejects malformed raw object; no real adapter normalizer | PARTIAL | adapter reconstructs canonical envelope only |
| retry policy | bounded retry concept documented | none | DOCUMENTED_ONLY | OWNER_DECISION_REQUIRED |
| provider fallback | alternate only when compatible/approved | none | DOCUMENTED_ONLY | OWNER_DECISION_REQUIRED; no implicit fallback |
| model fallback | equivalence cannot be assumed | none | DOCUMENTED_ONLY | OWNER_DECISION_REQUIRED |
| rate-limit behavior | operational concern documented | none | MISSING | OWNER_DECISION_REQUIRED |
| credential/config boundary | provider secret must be adapter-scoped | no provider config/secret source | MISSING | OWNER_DECISION_REQUIRED |
| observability | safe provider/model/latency/usage metadata documented | adapterVersion/fingerprint only | PARTIAL | approve bounded safe metadata/evidence |

## 2. Required network ownership

```text
API-017
→ capability-limited Job handler
→ exact FEAT-022 application port
→ FEAT-022 AdvisoryRuntime
→ approved FEAT-022 provider adapter
→ external provider network
```

External network ownership belongs exclusively to the FEAT-022 provider adapter boundary. API-017 handler network, provider client/SDK, credential, raw prompt and raw response access are all `0`.

## 3. Failure separation

```text
provider/network failure
→ FEAT-022 safe provider/application failure
→ API-017 existing Job failure mapper
→ DEPENDENCY_UNAVAILABLE or JOB_RESULT_INVALID
```

The exact mapping is unresolved. API-017 `RetryAsSuccessor` remains a separately authorized manual Job operation and cannot become provider retry/fallback.

## 4. Output ownership

Provider adapters must reconstruct a fresh provider-neutral result containing only approved canonical fields. FEAT-022 validates schema, evidence, confidence, classification and prohibited authority. API-017 consumes only a safe advisory reference/checksum/evidence mapping and never parses provider output.
