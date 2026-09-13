# REL-001 Runtime Foundation Canonical Inventory & Gap Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-159 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Release / environment | `REL-001 / Staging` |
| 성격 | Read-only inventory; Production implementation 없음 |

## 1. Objective

`REL-001 / Staging`의 다섯 `INCOMPLETE_RUNTIME_SURFACE`를 canonical 문서와 Production source에 대조하여 다음 bounded runtime-foundation 단계를 정한다. 이 보고서는 구현 승인이 아니다. `REL-001 = INCOMPLETE`, runtime gaps `5`, promotion handoff `UNAVAILABLE` 및 Registry 상태를 유지한다.

## 2. Documents read

- [Release Registry](../book-12/14_RELEASE_REGISTRY.md) 25행: `REL-001` scope와 `PLANNED` 상태.
- [Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md) 27~37, 43~44, 48행: `FEAT-001~011/017/018/022` ownership.
- [API Registry](../00_API_REGISTRY.md) 26~42행 및 [Feature Breakdown](../book-12/03_FEATURE_BREAKDOWN.md) 19~40행.
- [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md) 25~46, 80~85행.
- [Admin and Audit API](../book-6/10_ADMIN_AND_AUDIT_API.md), [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md).
- [Environment Strategy](../book-9/02_ENVIRONMENT_STRATEGY.md) 13~35행.
- [FEAT-022 RTM](../implementation/FEAT022_TRACEABILITY_MATRIX.md) 및 [Final Gate](FEAT022_FINAL_GATE_REPORT.md).
- [REL-001 candidate manifest](../implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json) 21~60행.

## 3. Canonical boundaries and classification

Staging은 production-like synthetic 또는 승인된 masked data만 사용하고 external effect는 disabled 또는 isolated test target이어야 한다. Environment별 identity, data store, queue, integration target 및 configuration을 분리하며 Production credential/raw personal data는 사용할 수 없다.

- `A`: thin executable bootstrap
- `B`: existing logical API의 closed transport wiring
- `C`: lifecycle/configuration/composition/durable runtime authority
- `D`: 현 canonical evidence로 정할 수 없어 AO amendment가 선행돼야 하는 의미

## 4. Gap 1 — Admin Console

### Ownership and current state

- UI ownership: `FEAT-021`; Administration은 `FEAT-016/API-015`; Audit/Jobs/Operations read truth는 owning API에 남는다.
- `console-server.ts`에는 Node HTTP server와 read-only renderer가 있고 `main.ts` 26~37행에는 start와 SIGINT/SIGTERM stop이 있다.
- 유일한 factory는 `composeDevelopmentAdminConsole()`이다(`console-composition.ts` 26~59행).
- `main.ts` 7~24행은 API-015 adapter만 주입하며 다른 page read는 unavailable fallback이다.
- parser는 `development|production`만 인식하고(`console-configuration.ts` 31~35행) development Session을 반드시 요구한다(36~38행). Production은 development Session을 금지하므로 Production/Staging trusted-session 실행 경로가 없다. Tenant/principal/session도 development 기본값이다(62~64행).
- Console persistence는 없어야 하며 owning APIs에 의존한다. 외부 provider는 필요 없다.

| Item | Finding |
|---|---|
| Exact blocker | Staging mode, trusted Session resolver, approved service origins와 dependency readiness composition 부재 |
| Minimum boundary | existing server/renderers를 유지한 Staging bootstrap + injected trusted Session + owning-API clients; direct store/UoW `0` |
| Missing contracts | Staging Session source, service-origin inventory, startup/readiness policy |
| Type | `C`, 결정 전 `D` |
| Dependencies | Core identity/auth, API-016, API-017; API-015 runtime은 기존 근거 있음 |
| AO decision | **YES** |
| Order | 6 |

## 5. Gap 2 — Core APIs / FEAT-001~011

### Ownership and current state

- `FEAT-001~011`은 `API-001~010`에 매핑된다. Identity/Security, Source/Intake, Property/Listing, Contact/Privacy, Client/Requirement 및 Matching ownership을 유지한다. API-011~014를 흡수하지 않는다.
- `IdentityApi`, `SourceIntakeApi`, `PropertyListingApi`, `ContactClientApi`, `MatchingApi`와 관련 services가 존재한다.
- `composeApiModulesBeforePublication()`가 SessionService/AuthorizationService와 façade를 in-process로 조립한다(`apps/api/src/composition.ts` 169~218행).
- API-001~010 closed HTTP adapter/dispatcher, Node production composition과 executable `main.ts`는 없다. 현재 `apps/api/src` HTTP production boundaries는 API-014/015/018/019에 한정된다.
- `RequestContext.sessionId`와 safe error mapping은 존재한다(`contracts.ts` 37~87행). 그러나 SessionService와 대표 Core service stores는 process-local Map이다.
- database paths, Staging identity/service bindings, startup/readiness/drain/restart configuration이 없다.
- Core 자체에는 외부 provider가 필요 없다. Source/AI work는 API-018/API-017을 우회해서는 안 된다.

| Item | Finding |
|---|---|
| Exact blocker | in-process façade만 있고 closed transport, durable production authority, executable lifecycle 없음; `IMP-001~011 = PLANNED` |
| Minimum boundary | exact API-001~010 operation inventory 후 existing façade를 보존하는 closed schemas, durable owning compositions, transport와 host를 bounded slices로 구현 |
| Missing contracts | exact closed request/response schemas, allowlists/error mapping, durable repository/UoW selection, Staging identity/configuration |
| Type | `B + C`; first gate `D` |
| Dependencies | Identity/Session/Authorization이 모든 후속 gap의 기반 |
| AO decision | **YES** |
| Order | 2 |

## 6. Gap 3 — Audit / API-016

### Ownership and current state

- `FEAT-017/DEV-017/API-016`, Security/Governance Owner. Administration 또는 Console이 audit truth를 소유할 수 없다.
- `AuditLog`는 immutable append/query/correction을 제공하지만 `#events`는 process-local array다(`audit-log.ts` 72~124행).
- `AdminAuditApi.queryAudit()`은 Session-derived actor와 `audit.query` authorization을 사용한다(`admin-audit-api.ts` 102~133행).
- 독립 API-016 production composition, HTTP transport, executable bootstrap은 없다. Current implementation은 canonical query/history/export 중 query subset뿐이다.
- Durable audit DB, tenant/scope indexes, retention/archive, export idempotency/storage/expiry 및 reopen lifecycle이 없다.
- Frozen contract는 masking, purpose/time/data-class, MFA, approval, watermark/classification/expiry와 asynchronous export를 요구한다. 외부 export destination은 승인되지 않았다.

| Item | Finding |
|---|---|
| Exact blocker | in-memory query subset; history/export, durability, transport/bootstrap 없음 |
| Minimum boundary | one durable append-only store/UoW + safe query/history DTO + closed HTTP query/export + API-017 export handoff |
| Missing contracts | export field allowlist, size, watermark/classification/expiry, artifact storage와 API-017 binding |
| Type | `B + C`; export detail은 `D` |
| Dependencies | Core identity/auth; API-017 export; Audit sink는 Jobs/AI evidence에 선행 |
| AO decision | **YES** |
| Order | 3 |

## 7. Gap 4 — Jobs / API-017

### Ownership and current state

- `FEAT-018/DEV-018/API-017`, Domain/Operations Owner; worker authority는 lease 범위뿐이다.
- `JobService`와 `JobApi`는 submit/read/start/succeed/fail/cancel/successor를 제공하고 JobApi는 Session-derived actor를 전달한다(`job-api.ts` 21~85행).
- `composeApiModulesBeforePublication()`가 JobApi를 in-process로 조립한다(`composition.ts` 186~189행).
- closed HTTP adapter, production factory, API/scheduler/worker executable, worker claim/lease/heartbeat transport가 없다.
- policy/job/idempotency는 process-local Maps다(`job-service.ts` 145~163행). Restart, authoritative result와 successor lineage durability가 없다.
- Frozen contract는 at-least-once possibility, idempotency, successor retry, worker lease/heartbeat loss와 reconciliation을 정의하지만 queue product는 의도적으로 정하지 않는다.
- External provider는 필요 없으며 downstream effects는 owning boundary가 수행해야 한다.

| Item | Finding |
|---|---|
| Exact blocker | durable queue authority, lease/heartbeat, transport와 worker lifecycle 없음; API Registry `PARTIALLY_VERIFIED` |
| Minimum boundary | durable Job UoW + closed API-017 application/transport + worker lease port + bounded scheduler/worker executables |
| Missing contracts | worker identity, lease/heartbeat policy, allowed-job policy source, concurrency/drain/recovery, API-016/FEAT-022 bindings |
| Type | `B + C`; policy/lifecycle values은 `D` |
| Dependencies | Core identity/auth, durable Audit; API-016 export와 FEAT-022가 소비 |
| AO decision | **YES** |
| Order | 4 |

## 8. Gap 5 — AI Advisory / FEAT-022

### Ownership and current state

- `FEAT-022/DEV-022`, `AI-001~007`; owning business APIs는 API-004~006/009/010, asynchronous boundary는 API-017이다. Advisory는 business authority가 아니다.
- strict output validator, `AdvisoryRuntime`, `DurableAdvisoryStore`, prompt/advisory/idempotency persistence가 존재한다.
- `createProductionAdvisoryRuntime()`은 file DB와 trusted snapshot resolver를 요구하며 fail closed한다(`advisory-production-composition.ts` 5~16행).
- internal execute/read는 있으나 executable bootstrap, Host/API-017 consumer, prompt activation bootstrap, readiness/drain이 없다.
- Production composition은 unavailable adapter만 사용하고 arbitrary adapter를 거부한다(19~26행). Public API/UI, real provider/model/network는 FEAT-022 Final Gate에서 deferred다.
- Deterministic no-network adapter는 test-only이며 Staging runtime으로 자동 승격할 수 없다.

| Item | Finding |
|---|---|
| Exact blocker | durable factory는 있으나 executable/API-017 consumer 없음; unavailable-only runtime이 gap closure인지 Staging adapter가 필요한지 미결정 |
| Minimum boundary | 새 public API 없이 API-017-authorized internal consumer/host, prompt/snapshot config, readiness와 graceful close를 existing runtime에 결합 |
| Missing contracts | Staging adapter disposition, prompt activation source, API-017 input/result/failure binding |
| Type | `A + C`; adapter/job semantics은 `D` |
| Dependencies | Core snapshots, API-016 audit, API-017 durable execution |
| AO decision | **YES** |
| Order | 5 |

## 9. Independent versus shared Staging host

API-014/015/018/019는 bounded compositions이고 Admin Console은 별도 Node process 구조다. `composeApiModulesBeforePublication()`는 object graph일 뿐 shared Staging host가 아니다. Core/API-016/API-017/AI를 함께 묶는 canonical host, port map, fault domain, lifecycle 또는 configuration schema는 발견되지 않았다.

따라서 다섯 gap은 **artifact/process 관점에서는 독립적으로 닫을 수 있지만 acceptance dependency 관점에서는 독립적이지 않다.** 현재 근거로 하나의 shared host를 선택하면 topology를 발명하게 된다. Owning boundary별 executable/durable composition을 유지하고 lifecycle primitives만 재사용하는 것이 최소 권고다. Shared host는 별도 AO architecture amendment 없이는 금지한다.

## 10. Summary matrix

| Gap | Current state | Type | Dependencies | AO | Order |
|---|---|---|---|---|---:|
| Admin Console | development executable only | `C/D` | Core, API-016/017 | YES | 6 |
| Core APIs / FEAT-001~011 | in-process façade; process-local state | `B/C/D` | base identity/auth | YES | 2 |
| Audit / API-016 | in-memory query subset | `B/C/D` | Core; API-017 export | YES | 3 |
| Jobs / API-017 | in-memory logical service | `B/C/D` | Core; Audit | YES | 4 |
| AI Advisory / FEAT-022 | durable internal factory | `A/C/D` | Core; API-016/017 | YES | 5 |

## 11. Recommended runtime-foundation phase sequence

1. **Phase 0 — Canonical Staging topology/configuration design.** Decide independent processes versus approved shared host, trusted Session/service identity, ports/origins, per-boundary DB paths, startup/readiness/shutdown policy 및 AI Staging adapter disposition. Production implementation은 이 gate 전에 시작하지 않는다.
2. **Phase 1 — Core identity and API-001~010 execution foundation.** Exact operation inventory, durable owning stores, closed transport와 executable lifecycle을 bounded slices로 구현한다.
3. **Phase 2 — API-016 durable Audit runtime.** Append-only store와 query/history를 먼저 닫고, AO-approved export contract를 API-017에 연결한다.
4. **Phase 3 — API-017 durable Jobs runtime.** Durable job/idempotency/result/successor, worker lease, restart recovery와 bounded API/worker lifecycle을 구현한다.
5. **Phase 4 — FEAT-022 advisory executable lifecycle.** Existing runtime을 API-017 internal jobs 및 trusted Core snapshots에 연결하고 advisory-only/no-provider 원칙을 유지한다.
6. **Phase 5 — Admin Console Staging bootstrap.** Existing routes/accessibility를 유지하고 executable owning APIs만 소비한다.
7. **Phase 6 — Exact-candidate rebuild and re-evaluation.** 한 exact commit의 완전한 Staging artifact manifest/evidence를 만들고, 부족하면 `INCOMPLETE`를 유지한다. 배포 단계가 아니다.

## 12. Risks, limitations and scope protection

- Traceability verification은 deployable runtime readiness가 아니다.
- API-016 export와 API-017 worker policy 값은 source에서 추론할 수 없다.
- 하나의 generic Core DB/UoW는 multi-owner authority를 합치는 미승인 shortcut이다.
- AI unavailable composition은 fail-closed 증거이지 Staging advisory availability 증거가 아니다.
- Tests/build는 Production behavior가 바뀌지 않은 read-only inventory이므로 실행하지 않았다.

| Item | Result |
|---|---|
| Production/test changes | 0/0 |
| Dependency/lockfile changes | 0/0 |
| New API/routes/authority/state | 0/0/0/0 |
| Provider/network activation | 0/0 |
| IMP/REL state changes | 0 |
| Push | NOT_PERFORMED |

## 13. Final Recommendation

```text
APPROVE_REL001_RUNTIME_FOUNDATION_NEXT_PHASE
```

승인 대상은 **Phase 0 canonical Staging runtime topology/configuration design**이다. Canonical contradiction은 발견되지 않았으므로 전체 design을 block하지 않지만, 다섯 AO decision이 기록되기 전 Core/API-016/API-017/AI/Console Production implementation을 시작하면 안 된다.
