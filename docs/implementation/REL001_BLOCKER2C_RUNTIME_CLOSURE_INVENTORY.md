# REL-001 Blocker 2C Runtime Closure Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-263 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner |
| 기준일 | 2026-09-16 |

## Exact baseline

| 항목 | 값 |
|---|---|
| Source HEAD | `b7d2a864b8dbed9c6b1f0c7874481035159af886` |
| Source branch | `main` |
| Repository | `https://github.com/25300park/ai-mls.git` |
| Target environment | `Staging` |
| Component roots | `19` |
| Unique reachable runtime files | `68` |
| Dependency/lockfile delta | `0` |

기존 FEAT-024 runtime-import closure와 SHA-256 알고리즘을 그대로 적용했다. Blocker 1C의 `19 roots / 67 files`에 UI-006의 실제 bounded adapter `apps/admin-console/src/core-identity-console-read-adapter.js`가 reachable file로 하나 추가됐다. 새 component root나 parallel Console은 추가하지 않았다.

## Runtime scope disposition

| Surface | Exact result | Evidence |
|---|---|---|
| Core API-001/002 public transport | `INCLUDED` | `CORE_API_001_002_HTTP` root |
| UI-006 live Core data | `INCLUDED` | Staging bootstrap → `CoreIdentityConsoleReadAdapter` → `GET /v1/me` |
| Live AI provider execution | `INCOMPLETE_RUNTIME_SURFACE` | `0/3 NOT_READY`; external account/contract dependency |
| API-003~010 | `OUT_OF_SCOPE` | exposure `0` |

Candidate runtime gap은 `LIVE_AI_PROVIDER_EXECUTION` 하나다. Fresh dependency audit은 runtime artifact component가 아니라 별도 acceptance prerequisite이며 `NOT_RUN`이다.

## Exact unique closure

```text
apps/admin-console/src/administration-console-http-client.js
apps/admin-console/src/administration-console-read-adapter.js
apps/admin-console/src/console-composition.js
apps/admin-console/src/console-read-adapter.js
apps/admin-console/src/console-renderer.js
apps/admin-console/src/console-server.js
apps/admin-console/src/core-identity-console-read-adapter.js
apps/admin-console/src/development-session.js
apps/api/src/administration-api-contracts.js
apps/api/src/administration-api-validation.js
apps/api/src/administration-governance-api.js
apps/api/src/administration-http-adapter.js
apps/api/src/administration-production-composition.js
apps/api/src/api016-production-composition.js
apps/api/src/core-identity-authorization-composition.js
apps/api/src/core-identity-authorization-http.js
apps/api/src/staging-admin-console-bootstrap.js
apps/api/src/staging-console-session-ingress.js
apps/api/src/staging-integrated-runtime-verification.js
apps/api/src/staging-session-composition.js
modules/administration/src/administration-durable-persistence.js
modules/administration/src/administration-persistence-engine.js
modules/administration/src/administration-persistence.js
modules/administration/src/live-assignment-adapter.js
modules/ai/src/advisory-ai-service.js
modules/ai/src/advisory-application-services.js
modules/ai/src/advisory-durable-persistence.js
modules/ai/src/advisory-production-composition.js
modules/ai/src/advisory-provider-boundary.js
modules/ai/src/advisory-readiness-composition.js
modules/ai/src/advisory-runtime-contracts.js
modules/ai/src/advisory-runtime.js
modules/audit/src/audit-intent-materializer.js
modules/audit/src/audit-log.js
modules/audit/src/durable-audit-event-store.js
modules/audit/src/enriched-audit-intent-contract.js
modules/audit/src/index.js
modules/authorization/src/authorization-service.js
modules/client/src/client-requirement-durable-persistence.js
modules/contact/src/contact-durable-persistence.js
modules/identity/src/index.js
modules/identity/src/session-access-coordinator.js
modules/identity/src/session-durable-persistence.js
modules/identity/src/session-persistence.js
modules/identity/src/session-service.js
modules/intake/src/intake-durable-persistence.js
modules/jobs/src/advisory-job-handlers.js
modules/jobs/src/job-durable-persistence.js
modules/jobs/src/job-execution-runtime.js
modules/jobs/src/job-staging-composition.js
modules/listing/src/listing-durable-persistence.js
modules/matching/src/matching-durable-persistence.js
modules/operations/src/durable-operational-evidence-store.js
modules/operations/src/operational-alert-projection.js
modules/operations/src/operational-readiness-evidence.js
modules/operations/src/operational-status-projection.js
modules/operations/src/operational-telemetry-contracts.js
modules/operations/src/security-privacy-operational-controls.js
modules/property/src/property-durable-persistence.js
modules/publication/src/publication-http-contracts.js
modules/publication/src/publication-node-http-configuration.js
modules/publication/src/publication-node-http-contracts.js
modules/publication/src/publication-node-http-lifecycle.js
modules/publication/src/publication-node-http-request-reader.js
modules/publication/src/publication-node-http-response-writer.js
modules/publication/src/publication-node-http-server.js
modules/source/src/source-registry-durable-persistence.js
packages/security-contracts/src/index.js
```

Tests, declarations, source maps, `tsbuildinfo`, source TypeScript, local databases, credentials and secrets included: `0`.

Related: [Fingerprint Matrix](REL001_BLOCKER2C_COMPONENT_FINGERPRINT_MATRIX.md), [Blocker 1C Inventory](REL001_BLOCKER1C_RUNTIME_CLOSURE_INVENTORY.md).
