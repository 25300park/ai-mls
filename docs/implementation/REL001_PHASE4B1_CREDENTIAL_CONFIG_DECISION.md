# REL-001 Phase 4B.1 Credential / Configuration Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-188 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Security Owner / Operations Owner / AI Reviewer |
| 기준일 | 2026-09-15 |
| Decision | `DEC-156` (`APPROVED`) |

## 1. Canonical boundary

Credential owner is the FEAT-022 provider adapter/configuration boundary. Environment/secret configuration supplies an opaque credential reference to provider composition. Only the selected provider adapter may resolve and consume credential material.

| Layer | Secret value visibility | Credential/config authority |
|---|---:|---:|
| API-017 runtime/store | `0` | `0` |
| Job handler | `0` | `0` |
| FEAT-022 application port | `0` | `0` |
| FEAT-022 application service | `0`; provider-agnostic | approved reference validation only |
| FEAT-022 provider composition | opaque secret reference | binding/fail-closed composition |
| approved provider adapter | minimum runtime credential material | consume only; no business authority |

## 2. Configuration references

- capability provider/model/timeout references: defined in [Provider / Model / Timeout Decision](REL001_PHASE4B1_PROVIDER_MODEL_TIMEOUT_DECISION.md)
- provider credential reference: `feat022.providers.<providerRef>.credentialRef`
- environment binding: explicit `Staging`; configuration for another environment is not implicitly reusable

No secret value, secret-store path or credential name is recorded here. Those are deployment values requiring scoped provisioning.

## 3. Fail-closed rules

Missing/malformed provider, model, timeout or credential reference yields `NOT_READY` before network execution. Credentials never enter Job payloads, application results, Audit evidence, telemetry, logs or errors.

## 4. Closure

Credential boundary: `3/3 CLOSED`.

Concrete provider and secret references remain `CONFIG_VALUE_REQUIRED`; credential values remain `0` in repository documentation.
