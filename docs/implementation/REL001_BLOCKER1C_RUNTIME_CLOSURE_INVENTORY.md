# REL-001 Blocker 1C Runtime Closure Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-255 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner |
| 기준일 | 2026-09-16 |

## 1. Exact baseline

| 항목 | 값 |
|---|---|
| Source HEAD | `97a3522fb301fea197d3fa2defc7bc2826c2d719` |
| Source branch | `main` |
| Repository | `https://github.com/25300park/ai-mls.git` |
| Target environment | `Staging` |
| Component roots | `19` |
| Unique reachable runtime files | `67` |
| Dependency/lockfile delta | `0` |

기존 FEAT-024 closure 알고리즘을 그대로 사용했다. 각 root의 상대 runtime import를 재귀적으로 추적하고, path를 ordinal ascending으로 정렬해 `path`, byte size, SHA-256을 물질화한다. 증거 생성기 변경 파일은 어떤 candidate runtime root에서도 reachable하지 않으므로 exact source HEAD의 runtime byte closure에 들어가지 않는다.

## 2. Post-transport delta

Historical Phase 7 closure `18 roots / 65 files`를 변경하지 않는다. Blocker 1B가 추가한 실제 shared composition을 아래 한 component로 포함한다.

| Component | Root | Added reachable files | Coverage effect |
|---|---|---|---|
| `CORE_API_001_002_HTTP` | `apps/api/src/core-identity-authorization-composition.js` | `apps/api/src/core-identity-authorization-composition.js`; `apps/api/src/core-identity-authorization-http.js` | `CORE_API_001_002_PUBLIC_TRANSPORT = INCLUDED` |

`GET /v1/me`와 `POST /v1/authorization-decisions`는 동일한 bounded Node HTTP composition을 공유하므로 중복 component로 세지 않는다.

## 3. Exact unique closure

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

## 4. Exclusions and remaining runtime gaps

- tests, declarations, source maps, `tsbuildinfo`, source TypeScript, secrets and local databases: `0` included.
- API-003~010 transport expansion: `0`.
- Remaining candidate runtime gaps: `LIVE_AI_PROVIDER_EXECUTION`, `UI_006_CORE_DATA`.
- Dependency audit is an acceptance prerequisite, not a runtime artifact component, and remains `NOT_RUN`.

Related: [Fingerprint Matrix](REL001_BLOCKER1C_COMPONENT_FINGERPRINT_MATRIX.md), [Historical Phase 7 Inventory](REL001_PHASE7_RUNTIME_CLOSURE_INVENTORY.md).
