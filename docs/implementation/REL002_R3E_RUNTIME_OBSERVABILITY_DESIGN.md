# REL-002 R3-E Runtime Observability / Startup Evidence

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-401 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Operations Owner / Architecture Owner |
| Baseline | 154d3f726b349a14319e6c1931ee3af24552f74d |

## 1. Existing contract inventory

| PATH | PURPOSE | CURRENT_ENVIRONMENT | PRODUCTION_ELIGIBLE | SECRET_SAFE |
|---|---|---|---|---|
| [production-readiness-http.ts](../../apps/api/src/production-readiness-http.ts) | fixed /readyz, same-listener application route boundary | Production composition / local tests | YES | YES: fixed allowlist |
| [Health contract / DEC-184](REL002_PHASE2D0E_HEALTH_READINESS_CONTRACT.md) | /livez process liveness, /readyz deployment healthcheck; unauthenticated GET/HEAD | canonical Production design; historical implementation status preserved | YES within current brief | YES: LIVE/READY/NOT_READY only |
| [production-bootstrap.ts](../../apps/api/src/production-bootstrap.ts) | readiness handle, validation fingerprint, schema provenance | Production | YES; detailed handle is top-level only | YES within bounded consumers; no public serialization |
| [production-bootstrap-engine.ts](../../apps/api/src/production-bootstrap-engine.ts) | gate order, startup errors, shared resource cleanup | Production | YES | YES: normalized code/evidence |
| [production-main.ts](../../apps/api/src/production-main.ts) | signal/stopRequested, shutdown timeout, readiness toggle | Production | YES | YES; existing error boundary hides raw cause |
| [production-runtime-activation.ts](../../apps/api/src/production-runtime-activation.ts) | activation state, typed failure, manifest count, close ownership | Production / fixture workers | YES; current workers=0 | YES: fixed typed reasons |
| [production-docker-build-contract.ts](../../apps/api/src/production-docker-build-contract.ts) / [image inspection](../../apps/api/src/production-image-inspection.ts) | bounded JSON/stdout operational output convention | local build/inspection tooling | YES for output convention; not a runtime telemetry sink | YES: validated summaries |
| [operational-telemetry-contracts.ts](../../modules/operations/src/operational-telemetry-contracts.ts) | FEAT-023 structured evidence validation, safe categories/references | provider-independent contract / Local-Test-Staging composition | YES for safety principles; not startup persistence authority | YES: strict validator |
| [operational-status-projection.ts](../../modules/operations/src/operational-status-projection.ts) | separates health/readiness/freshness | Local/Test/Staging operational evidence | NO as canonical Production startup composition | YES for validated projection |
| [durable-operational-evidence-store.ts](../../modules/operations/src/durable-operational-evidence-store.ts) | SQLite append-only operational evidence | Local/Test/Staging | NO: not an approved Production startup evidence sink | YES through existing contracts; no promotion |
| [PostgreSqlPoolPort](../../modules/identity/src/postgresql-pool.ts) | connect/close only; no checkout/leak metrics API | Production | YES | YES at port boundary; config must not be serialized |
| [Operations index](../00_OPERATIONS_INDEX.md), [monitoring](../book-9/06_MONITORING_AND_OBSERVABILITY.md), [checklist](../book-9/15_OPERATION_CHECKLIST.md), [Phase 0 inventory](REL002_PHASE0_PRODUCTION_READINESS_INVENTORY.md) | OPS-012..015, monitoring/checklist guidance; Production collector/backend gap | canonical governance / generic operations | YES as guidance; no configured Production metrics backend proved | YES as documentation; no runtime values read |

기존 root에서는 Production-specific startup event record, diagnostics endpoint, general logger instance와 metrics backend를 찾지 못했다. 현재 brief가 bounded in-memory/structured evidence를 명시적으로 허용하므로 새 provider나 durable schema는 필요하지 않다. FEAT-023 SQLite storage를 승격하지 않으며 detailed startup evidence를 public diagnostic endpoint로 노출하지 않는다.

## 2. Bounded implementation

[ProductionRuntimeObservability](../../apps/api/src/production-runtime-observability.ts)은 생성한 UUID startup attempt, ISO timestamp와 immutable flat primitive snapshot을 관리한다. runtime config, credentials, Session/principal/tenant identity, connection string과 arbitrary cause payload는 입력으로 받지 않는다. 이전 snapshot도 immutable이다. fixed failure-token allowlist는 existing stage/reason/code의 own data descriptor만 읽으며 getter, stack, message, cause와 unknown text는 무시한다.

phase 순서는 BOOTSTRAPPING → PRE_LISTENER_VALIDATING → PRE_LISTENER_READY → ACTIVATING_LISTENER → ACTIVATING_WORKERS → RUNTIME_READY → SHUTTING_DOWN → STOPPED다. STARTUP_FAILED와 SHUTDOWN_FAILED는 terminal failure phase다. regression/reentry/premature READY는 거부하며 duplicate runtime entry는 active attempt의 evidence를 변경하기 전에 실패한다.

gate observation은 기존 Service Workload, Human Identity와 Required Secrets 결과를 사용한다. readiness는 complete pre-listener chain과 runtime activation을 요구한다. shutdown request는 activation ordering 변경 없이 즉시 readiness를 낮춘다. listener와 pool의 close outcome은 각각 관찰한다. pool-only shutdown failure에서는 성공한 listener/empty-worker cleanup을 STOPPED로 유지하고 aggregate SHUTDOWN_FAILED, pool FAILED/connectivity UNKNOWN을 기록한다.

## 3. Database and worker evidence

physicalPoolCount는 이 attempt에서 생성한 canonical pool 수다(open 전 0, 이후 1). CLOSED/FAILED가 close outcome을 별도로 나타내며 current checked-out/client gauge로 해석하지 않는다. databaseConnectivity=READ_PATH_VERIFIED는 기존 Identity schema read 이후, poolReadiness=READY는 기존 aggregate schema readiness 이후에 기록한다. observability를 위해 SQL/probe/retry/timer를 추가하지 않는다. 기존 port의 checked-out/leak metrics는 NOT_AVAILABLE이며 값을 발명하지 않는다.

worker manifest schemaVersion=1/count=0은 explicit validation 이후에만 기록한다. missing/non-empty manifest는 계속 fail-closed다. ACTIVATING_WORKERS는 기존 zero-operation step을 나타내고 READY_EMPTY_MANIFEST는 R3-D semantics를 보존한다. API-017/deferred/optional worker discovery나 activation은 없다.

## 4. Logging and endpoint exposure

direct Production entry는 기존 bounded JSON/stdout convention을 snapshot에 재사용한다. factory/library caller에는 default external sink가 없고 optional sink에는 frozen snapshot만 전달한다. synchronous sink error는 lifecycle semantics에 영향을 주지 않는다. external log shipping, vendor, collector, retention policy나 durable evidence authority는 도입하지 않는다.

/livez는 bind 이후 fixed LIVE를 반환하며 /readyz는 fixed READY/NOT_READY와 기존 top-level readiness owner를 유지한다. 두 경로는 같은 listener에서 GET/HEAD만 허용하고 snapshot, failure detail, identifiers, DB status, config와 admin data는 노출하지 않는다. 별도 pre-bootstrap listener는 추가하지 않는다. bind 이전에는 in-memory evidence가 live process를 나타내더라도 HTTP health는 unavailable이다. actual Railway health configuration을 조회하거나 변경하지 않았다.

## 5. Verification and scope

[Completion report](../reviews/REL002_R3E_COMPLETION.md) records focused/affected/full regression, independent review and preservation. R3-D activation/cleanup ordering and ownership are unchanged. No schema/migration/ACL/DB adapter change or additional query exists; disposable PostgreSQL is N/A. Production readiness/health, deployment and platform execution remain unverified/blocked. R3-F is NOT_STARTED.
