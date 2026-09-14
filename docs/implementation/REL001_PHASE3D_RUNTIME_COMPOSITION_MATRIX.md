# REL-001 Phase 3D API-017 Runtime Composition Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-148 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `b6955574a3ebbff0f702ba17d39c5be80078023e` |

## 1. Composition path

```text
explicit internal invocation
→ tenant/scope-scoped DurableJobStore read
→ closed JobExecutionRegistry resolution
→ live JobExecutionAdmissionPort evaluation
→ Phase 3C CAS start
→ approved application handler port
→ canonical success or trusted failure normalization
→ Phase 3C durable outcome + enriched audit intent
```

## 2. Component matrix

| Component | Source | Required | Missing behavior | Phase 3D result |
|---|---|---:|---|---|
| Durable Job Store | explicit SQLite `databasePath` | YES | composition throws/fails closed | WIRED |
| Closed registry | three exact handlers | YES | `NOT_READY`; execution blocked | WIRED |
| Live admission | injected `JobExecutionAdmissionPort` | YES | composition invalid | WIRED |
| Failure mapper | injected trusted mapper | YES | failure remains safe `RUNNING`; no raw persistence | WIRED |
| Audit intent/evidence | Phase 3C owner-local store transition | YES | transition fails atomically | REUSED |
| One-shot runtime | explicit `execute()` | YES | no execution | WIRED |
| Runtime status | FEAT-023 Health/Readiness vocabulary | YES | `NOT_READY` or factory fail closed | WIRED |

## 3. Status projection

| Condition | Health | Readiness |
|---|---|---|
| Durable store opens and all three mappings plus admission/failure ports are present | `HEALTHY` | `READY` |
| Durable store opens but registry is incomplete | `HEALTHY` | `NOT_READY` |
| Required Staging configuration is absent or malformed | factory fail closed | no runtime authority |

No new Health/Readiness values are introduced.

## 4. Execution safety

| Invariant | Enforcement | Result |
|---|---|---|
| Tenant/scope concealment | scoped durable read before disclosure or mutation | PASS |
| Live authority | admission immediately before CAS start | PASS |
| Single completion | Phase 3C `expectedVersion + attempt` CAS | PASS |
| Terminal replay | prior durable result returned; handler call `0` | PASS |
| Restart with `RUNNING` | fail closed; blind execution `0` | PASS |
| Unknown/unmapped Job | no fallback; execution `0` | PASS |
| Unsafe failure | trusted normalizer only; raw diagnostics `0` | PASS |
| Unsafe shape-valid success | persistence validator rejection is converted to trusted failure mapping | PASS |
| Closed runtime | `UNHEALTHY / NOT_READY`; no further availability claim | PASS |

## 5. Bounded process model

The Staging factory exposes only `runtime`, `status()` and `close()`. After `close()`, status is `UNHEALTHY / NOT_READY`. Timer, polling, cron, worker loop, queue/message bus, HTTP/RPC server and external network/provider adapter are absent. Manual `RetryAsSuccessor` remains a separate Phase 3C operation; Phase 3D never creates it automatically.

## 6. Deferred boundaries

FEAT-022 Production execution integration, public API-017 transport, long-running worker lifecycle and external provider/model activation remain outside Phase 3D. This matrix does not authorize Phase 3E or later work.
