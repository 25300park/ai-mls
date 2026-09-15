# REL-001 Phase 4B.1 Provider / Model / Timeout Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-187 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / AI Reviewer / Operations Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-156` (`APPROVED`) |

## 1. Selection model

Provider and model references are configuration-selected by the FEAT-022 provider/application composition through the existing provider abstraction. Staging may have its own approved values; Job payloads and handlers cannot select or override them. No model or provider identifier is hard-coded by this decision.

## 2. Exact configuration references

| Capability | Provider reference key | Model reference key | Timeout key | Current value status |
|---|---|---|---|---|
| AI-001 | `feat022.capabilities.AI-001.providerRef` | `feat022.capabilities.AI-001.modelRef` | `feat022.capabilities.AI-001.timeoutMs` | `CONFIG_VALUE_REQUIRED` |
| AI-004 | `feat022.capabilities.AI-004.providerRef` | `feat022.capabilities.AI-004.modelRef` | `feat022.capabilities.AI-004.timeoutMs` | `CONFIG_VALUE_REQUIRED` |
| AI-005 | `feat022.capabilities.AI-005.providerRef` | `feat022.capabilities.AI-005.modelRef` | `feat022.capabilities.AI-005.timeoutMs` | `CONFIG_VALUE_REQUIRED` |

`timeoutMs` must be an explicit positive bounded integer approved for the environment. There is no hidden/common default. Missing or malformed provider/model/timeout configuration makes that capability `NOT_READY` and fails closed before network execution.

## 3. Retry/fallback

For REL-001:

- provider-layer automatic retry: `NONE`
- maximum provider attempts per Job attempt: `1`
- retryable provider failure set: empty
- backoff/delay: `NOT_APPLICABLE`
- provider fallback: `NONE`
- model fallback: `NONE`

API-017 `RetryAsSuccessor` remains a separate manual Job lifecycle operation and does not create an inner provider retry.

## 4. Failure classification

Provider timeout, connection and availability failures are stripped of raw detail and normalized to existing `ADVISORY_UNAVAILABLE`, then to API-017 `DEPENDENCY_UNAVAILABLE`. This adds no failure vocabulary.

## 5. Authority

API-017 and handlers have provider/model selection authority `0`. Future retry/fallback or dynamic routing requires a separate canonical amendment.
