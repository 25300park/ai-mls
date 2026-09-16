# REL-001 Phase 7 Runtime Closure Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-241 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner |
| 기준일 | 2026-09-16 |

## 1. Exact baseline

| 항목 | 값 |
|---|---|
| Source HEAD | `cd620b273c8e7672ffc1e015380ce36d486d9a9a` |
| Source branch | `main` |
| Repository | `https://github.com/25300park/ai-mls.git` |
| Environment / configuration class | `Staging` / provider-independent boundary |
| Component roots | `18` |
| Unique reachable runtime files | `65` |
| Dependency/lockfile delta | `0` |

각 root에서 상대 import를 재귀적으로 따라가고 path를 ordinal ascending으로 정렬했다. 각 파일은 `path`, byte size, SHA-256으로 묶인다. Component 간 공통 dependency는 component closure에는 각각 남지만 overall `includedFilePaths`에서는 한 번만 센다.

## 2. Included unique closure

```text
apps/admin-console/src/administration-console-http-client.js
apps/admin-console/src/administration-console-read-adapter.js
apps/admin-console/src/console-composition.js
apps/admin-console/src/console-read-adapter.js
apps/admin-console/src/console-renderer.js
apps/admin-console/src/console-server.js
apps/admin-console/src/development-session.js
apps/api/src/administration-api-contracts.js
apps/api/src/administration-api-validation.js
apps/api/src/administration-governance-api.js
apps/api/src/administration-http-adapter.js
apps/api/src/administration-production-composition.js
apps/api/src/api016-production-composition.js
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

`modules/publication/*` 파일은 Admin Console server의 shared transport dependency로 도달되며, 이 포함은 API-014를 REL-001 business scope나 새 readiness authority로 승격하지 않는다.

## 3. Exclusions

Tests/specs/fixtures/mocks, source maps, declarations, `tsbuildinfo`, TypeScript source, docs/reports/logs/temp/cache/backups, local databases, environment values, credentials, secrets와 unreachable build output은 제외했다. Excluded class의 포함 수는 `0`이다.

## 4. Known non-ready scope

- `LIVE_AI_PROVIDER_EXECUTION`: external hold, artifact-ready claim `0`.
- `CORE_API_001_002_PUBLIC_TRANSPORT`: `HOLD`.
- `UI_006_CORE_DATA`: `SAFELY_DEFERRED`.

Related: [Component Fingerprints](REL001_PHASE7_COMPONENT_FINGERPRINT_MATRIX.md), [Readiness](REL001_PHASE7_RELEASE_READINESS_MATRIX.md), [Completion Report](../reviews/REL001_PHASE7_COMPLETION_REPORT.md).
