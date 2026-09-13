# REL-001 Phase 0 Startup / Lifecycle Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-051 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Parent design | [DOC-DEV-048](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) |

## 1. Canonical startup dependency order

```text
per-owner persistence foundations
  -> trusted identity / authorization composition
  -> Staging Platform Host bounded modules
  -> API-016 and API-017 control-plane readiness
  -> Job / Advisory Worker eligibility
  -> Admin Console backend-read availability
```

Admin Console process can bind independently only when it safely reports unavailable backend data and does not claim end-to-end readiness. Worker can start only after the API-017 existing-port separation proof succeeds; otherwise the approved bounded in-process fallback applies.

## 2. Lifecycle matrix

| Stage | Admin Console Process | Staging Platform Host | Job / Advisory Worker Process |
|---|---|---|---|
| Bootstrap | construct server shell and injected read adapter only | construct config, identity, bounded modules and owning store factories | construct API-017 worker and FEAT-022 consumer from existing ports only |
| Configuration load | validate exact Staging mode, listener, Platform origin, trusted Session boundary | validate exact Staging mode, listener, identity, per-owner DB paths, operation allowlists | validate Staging mode, API-017/Audit ports, advisory DB/prompt/snapshot, unavailable provider |
| Persistence init | none | open/integrity-check per-domain, API-016 and API-017 durable stores in owner order | attach to API-017 owner through approved port; open FEAT-022 durable store |
| Identity init | initialize existing Session resolver reference; dev Session forbidden | initialize existing SessionService/AuthorizationService and current policy sources | initialize exact job/lease and advisory invocation identity; no new principal |
| Dependency readiness | Platform read origin reachable is a read dependency, not authority | all hard owning stores and identity dependencies ready | API-017 durable authority, API-016 evidence port, trusted snapshots/prompts ready |
| Startup | bind only after configuration/security checks | register only canonical closed operations, then bind listener | begin claims only after all hard dependencies and separation proof pass |
| Steady state | resolve Session per request; safe read DTO/rendering | live authorize per request; preserve owner UoWs and evidence | claim exact job, execute bounded work, commit authoritative result/evidence |
| Health | process/listener/internal renderer health | process plus component health | process, worker loop and advisory runtime health |
| Readiness | read surface readiness reflects backend dependency; unavailable stays unavailable | only ready when required components accept safe work | ready only for approved jobs; provider absence does not become success |
| Graceful shutdown | stop accepts, drain active reads, close server | stop admission, drain accepted work, commit/close stores in reverse dependency order | stop claims first, drain bounded accepted work, persist result/lease evidence, close advisory store |
| Restart | reload config/Session boundary; no cached authority | reopen durable stores, validate integrity, rebuild composition; no in-memory fallback | replay durable job/advisory identity; no duplicate execution or invented retry |
| Failure mode | affected views safe `UNAVAILABLE/ERROR`; no backend mutation | no listener/readiness on hard dependency failure; safe errors only | no new claim; preserve durable authority; no blind retry or authority resurrection |
| Fail closed | missing Session/config/origin blocks protected flow | missing identity/store/schema blocks affected host/component | missing port/store/prompt/snapshot or ambiguous work blocks execution |

## 3. Hard and soft dependencies

| Component | Hard dependencies | Soft dependencies | Hard-failure result | Soft-failure result |
|---|---|---|---|---|
| Admin Console shell | valid Staging config, listener, trusted Session boundary | individual Platform read capabilities | no protected listener or fail-closed request | affected section `UNAVAILABLE`; no fabricated state |
| Core API-001~010 | identity/auth, exact contract registration, owning durable store | non-owning read projections where contract permits | component not ready/not exposed | bounded degraded/unavailable response |
| API-016 | identity/auth for reads, append-only store | export capability only if separately complete | API-016 not ready; dependent evidence-requiring work blocks | export unavailable without disabling safe query if canonical |
| API-017 control | identity/auth, durable job owner, exact policies/contracts | Worker availability for new execution | submission/control not ready | accepted queued truth remains durable; no implied execution |
| API-017 worker | existing durable API-017 port, job/lease identity, evidence port, separation proof | FEAT-022 only for advisory job class | no claim/execution | unsupported job class unavailable |
| FEAT-022 runtime | API-017 authorized invocation, trusted snapshot, prompt identity, durable advisory store, canonical validator | real provider/model | advisory job blocked if hard dependency absent | unavailable/no-network outcome; no provider call |

## 4. Health/readiness rules

Only existing canonical values are used.

- Health: `HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN`
- Readiness: `READY | NOT_READY | DEGRADED | UNKNOWN`
- Freshness, where existing evidence applies: `FRESH | STALE | UNKNOWN`

Rules:

1. Health, readiness, freshness and business authorization are distinct.
2. `UNKNOWN` never renders/projects as `READY`, `HEALTHY`, success or authority.
3. Process aggregate readiness cannot hide a mandatory component `NOT_READY`/`UNKNOWN`.
4. Console backend unavailability is not Platform state mutation.
5. Worker/advisory unavailability does not reactivate, retry or mutate a job.
6. No new lifecycle or readiness vocabulary is introduced.

## 5. Startup admission gates

| Gate | Console | Platform Host | Worker | Result if failed |
|---|---:|---:|---:|---|
| exact Staging mode | required | required | required | startup blocked |
| closed config validation | required | required | required | startup blocked |
| production/dev Session isolation | required | required | N/A | protected boundary blocked |
| durable persistence available | N/A | required per owner | required for API-017/FEAT-022 | owning component blocked; no memory fallback |
| current authorization sources | via backend and Session resolver | required | execution binding required | request/work blocked |
| existing-port worker proof | N/A | records readiness | required | use approved in-process fallback or stop |
| approved network destinations only | required | required | required | startup blocked |
| provider/model disabled | N/A | required | required | advisory external execution blocked |
| safe diagnostics | required | required | required | emit bounded safe error only |

## 6. Shutdown order

### Admin Console Process

1. Mark process `NOT_READY` using existing vocabulary.
2. Stop new connections/requests.
3. Drain bounded active reads.
4. Close HTTP server and local telemetry sink.

### Staging Platform Host

1. Mark Host `NOT_READY` and stop new external admission.
2. Stop API-017 new submissions/claims and API-016 export admission.
3. Drain accepted in-process operations.
4. Commit append-only evidence/idempotency through owning UoWs.
5. Close API-017, API-016 and Core stores in reverse dependency order.
6. Close listener and telemetry sink.

### Job / Advisory Worker Process

1. Mark Worker `NOT_READY` and stop claiming new jobs.
2. Drain only bounded already-accepted work under existing lease semantics.
3. Persist authoritative result/evidence or existing safe failure/lease outcome.
4. Never invent retry, successor, cancellation or ambiguous-success semantics.
5. Close FEAT-022 store, API-017 port and telemetry sink.

Exact timeout/lease values remain implementation-phase configuration and must be sourced canonically or approved; this design does not invent them.

## 7. Restart and recovery behavior

| State before restart | Required behavior after restart |
|---|---|
| committed Core/Audit/Job/Advisory state | reopen and return authoritative durable state through owning boundary |
| uncommitted local transaction | SQLite/owning store rollback semantics; no partial authority/evidence |
| exact completed job/advisory identity | idempotent prior result; no duplicate execution |
| ambiguous/incomplete execution | preserve existing canonical ambiguous/recovery semantics; no blind retry |
| stale Session/authority cache | discard; resolve/revalidate current authority |
| missing/corrupt durable store | owning component `NOT_READY`/startup failure; no in-memory fallback |
| Worker unavailable | control-plane truth remains durable; no automatic replacement authority |

## 8. Phase execution gates

| Sequence | Phase | Entry proof | Exit evidence |
|---:|---|---|---|
| 1 | Core identity / API-001~010 foundation | exact operation/schema inventory | durable composition, closed transport, lifecycle tests |
| 2 | API-016 durable Audit runtime | Core identity ready; export contract sufficiency determined | append/query/history and only approved export evidence |
| 3 | API-017 durable Jobs runtime | API-016 evidence ready; worker separation proof | durable jobs/leases/idempotency and bounded worker lifecycle |
| 4 | FEAT-022 executable lifecycle | API-017 authorized job boundary ready | no-network advisory consumer, durability/readiness/shutdown |
| 5 | Admin Console Staging bootstrap | trusted ingress/session and owning read origins ready | Staging-safe read-only Console lifecycle |
| 6 | Integrated Staging verification | all mandatory runtime components present | cross-process/component health, readiness, isolation and shutdown evidence |
| 7 | Exact candidate rebuild | exact commit and deterministic component roots | per-component fingerprints, candidate manifest and truthful reevaluation |

No phase may start merely because this matrix exists. Each requires its own approved Brief and must stop at the listed canonical gaps.
