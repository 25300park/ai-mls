# REL-001 Phase 4D.1 Credential Reference Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-203 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner / AI Operations Owner |
| 기준일 | 2026-09-15 |

| Capability | Provider | Safe configuration key | Exact opaque reference | Authorized value consumer | Result |
|---|---|---|---|---|---|
| `AI-001` | `CONFIG_VALUE_REQUIRED` | `feat022.providers.<providerRef>.credentialRef` | `CONFIG_VALUE_REQUIRED` | selected provider adapter only | OPEN |
| `AI-004` | `CONFIG_VALUE_REQUIRED` | same provider-scoped key | `CONFIG_VALUE_REQUIRED` | selected provider adapter only | OPEN |
| `AI-005` | `CONFIG_VALUE_REQUIRED` | same provider-scoped key | `CONFIG_VALUE_REQUIRED` | selected provider adapter only | OPEN |

Actual secret values, secret-store paths, tokens, API keys 및 authorization headers는 기록하지 않는다. API-017, handler, application port/service, Job, prompt, telemetry, audit, evidence, result 및 error의 credential visibility는 `0`이다. Exact Staging reference와 resolver/provisioning/rotation boundary가 owner-approved 될 때까지 availability는 `UNAVAILABLE`이며 credential use는 `0`이다.
