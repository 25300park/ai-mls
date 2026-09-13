# REL-001 Phase 1A Core Runtime Host Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-056 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / Security Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Parent design | [Phase 0 Topology](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) |
| Related decision | `DEC-127` (`APPROVED`) |

## 1. Contract boundary

`Staging Platform Host — Core Runtime Contract` is one executable lifecycle/composition owner for eligible `API-001~010` operations. It is not a business aggregate, authorization engine, generic database or new API.

```text
Node HTTP listener
 -> closed Core transport adapter/dispatcher
 -> existing API façade
 -> owning application/domain service
 -> domain-owned durable repository/UoW
```

Publication-specific request/config/envelope types cannot be silently generalized. Shared listener primitives may be extracted only if they carry no API-014 semantics and preserve existing API contracts.

## 2. Responsibilities

- validate exact Staging configuration before resource creation;
- initialize domain-owned durable stores and current Session/Authorization dependencies;
- register only `CONTRACT_READY` operations from DOC-DEV-052;
- derive Session locator from header and call the read-only current resolver;
- dispatch through existing API/Application boundaries only;
- reconstruct immutable safe response/error DTOs;
- emit existing safe structured telemetry and Health/Readiness projections;
- own bounded listener startup, drain and reverse-order resource close.

## 3. Non-responsibilities

- API-016 semantics or store;
- API-017 execution/worker semantics;
- FEAT-022 prompt/provider execution;
- Admin Console authority or persistence;
- deployment/promotion;
- domain aggregate ownership;
- new roles, capabilities, routes, lifecycle states, retry/recovery or external network.

## 4. Closed lifecycle

```text
CONFIG_LOAD
 -> PERSISTENCE_INIT
 -> AUTHORIZATION_INIT
 -> CORE_COMPOSITION
 -> TRANSPORT_BIND
 -> READY

READINESS_OFF
 -> STOP_ACCEPTING
 -> DRAIN
 -> CLOSE_RESOURCES
 -> TERMINATED
```

These labels are executable lifecycle steps only. They must not enter domain state machines.

| Step | Entry condition | Failure behavior |
|---|---|---|
| CONFIG_LOAD | explicit Staging mode/listener/API major/bounds/per-owner paths | reject unknown/missing/unsafe field; no resources opened |
| PERSISTENCE_INIT | every enabled operation owner has durable configuration | open owner stores in dependency order; any required owner failure => `NOT_READY`, close opened stores |
| AUTHORIZATION_INIT | durable Session resolver and live assignment/policy readers ready | missing/stale/test-only authority => fail closed |
| CORE_COMPOSITION | exact existing façade/application dependencies supplied | no alternate/duplicate business path |
| TRANSPORT_BIND | route allowlist contains only eligible contracts | bind once; no partial advertised readiness |
| READY | all mandatory dependency readiness is `READY` | `UNKNOWN`, missing durable owner or missing authorization => `NOT_READY` |
| READINESS_OFF | shutdown signal or required dependency loss | stop advertising readiness before admission stop |
| STOP_ACCEPTING | listener stops new request admission | accepted requests only proceed |
| DRAIN | bounded active-request completion | timeout produces safe termination evidence; no business replay |
| CLOSE_RESOURCES | listener, façades, authorization readers and stores reverse close | preserve first safe failure; no raw diagnostics |
| TERMINATED | every owned resource closed or safely quarantined | no automatic restart authority |

## 5. Configuration contract gates

Required groups are `runtime=Staging`, explicit listener address/port, initial API major, route body/query/string/list bounds, Session resolver configuration, live authorization source, per-domain durable store references, local telemetry sink and bounded drain timeout. There are no undocumented defaults. Exact values remain AO/Operations-approved implementation inputs.

## 6. Health and readiness

Only existing FEAT-023 values are used.

| Dependency | Health projection | Mandatory for READY |
|---|---|---|
| listener event loop/resource state | `HEALTHY/DEGRADED/UNHEALTHY/UNKNOWN` | yes |
| every enabled domain durable owner | existing Health | yes |
| current Session resolver | existing Health | yes |
| live AuthorizationService dependencies | existing Health | yes |
| telemetry sink | existing Health; failure may degrade health | readiness rule must be explicit before implementation |
| API-016/API-017/FEAT-022 | outside Phase 1 Host contract | no Phase 1 readiness authority |

Host Readiness is `READY` only when configuration is valid, all enabled Core routes are bound, every enabled durable owner is ready, and Session/authorization dependencies are ready. Any mandatory `UNKNOWN`, missing durable persistence or missing authorization is `NOT_READY`. Readiness never grants business authority.

## 7. Safe error and concealment

Transport maps only codes registered by the owning API. Unknown errors become `REQUEST_REJECTED`; stack, SQL, path, configuration value, Session detail and internal evidence are removed. Resource-scope failure uses the owning application concealment result. HTTP adapter must not read a repository before authorization merely to choose a more specific error.

## 8. Contract status

Host responsibilities/lifecycle are `DEFINED_AS_DRAFT`. Executable creation remains blocked until:

1. Staging Session lifecycle ingress is approved;
2. per-domain durable boundaries are approved and implemented;
3. initial API major and exact numeric bounds are approved;
4. unresolved operations are excluded or canonically amended.

## 9. Phase 1B telemetry readiness closure

| Condition | Existing vocabulary result |
|---|---|
| all mandatory Core dependencies and telemetry available | `READY` |
| Core functional; non-authoritative telemetry sink/projection partially unavailable | `DEGRADED` |
| telemetry loss prevents required security/audit evidence or protected-operation verification | `NOT_READY` |
| telemetry state cannot be established | `UNKNOWN` where existing projection rules require it |

Telemetry never grants business authorization. Losing optional operational projection cannot manufacture `NOT_READY`, while losing mandatory security/audit evidence cannot remain `READY`.

The bounded Host responsibility, lifecycle and telemetry policy are canonical under `DEC-127`. Executable creation remains blocked by the missing trusted durable Session resolution boundary. Exact major/bounds and domain durability also gate included routes; the two Case-dependent API-007 operations remain excluded because no canonical Case creation path exists.
