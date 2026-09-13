# REL-001 Phase 0 Staging Runtime Topology Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-048 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Release / environment | `REL-001 / Staging` |
| 승인 topology | `OPTION C — HYBRID MODEL` |
| 성격 | Architecture design only |

## 1. Objective

`REL-001 / Staging`의 다섯 mandatory runtime gap을 기존 ownership, authorization, persistence, artifact traceability와 failure isolation을 보존하는 Hybrid topology로 닫기 위한 canonical design을 정의한다. 이 문서는 구현 승인이 아니며 `REL-001 = INCOMPLETE`, runtime gaps `5`, promotion handoff `UNAVAILABLE`을 변경하지 않는다.

관련 근거는 [Runtime Foundation Inventory](../reviews/REL001_RUNTIME_FOUNDATION_CANONICAL_INVENTORY_GAP_REPORT.md), [Runtime Component Matrix](REL001_PHASE0_RUNTIME_COMPONENT_MATRIX.md), [Configuration Ownership Matrix](REL001_PHASE0_CONFIGURATION_OWNERSHIP_MATRIX.md), [Startup/Lifecycle Matrix](REL001_PHASE0_STARTUP_LIFECYCLE_MATRIX.md)이다.

## 2. Selected topology

```text
Approved Staging ingress
        |
        v
+------------------------------+
| Admin Console Process        |
| browser shell + safe reads   |
+------------------------------+
        |
        | existing approved HTTP contracts only
        v
+--------------------------------------------------+
| Staging Platform Host                            |
| Core API-001~010 | API-016 | API-017 control    |
| bounded in-process modules and owning stores     |
+--------------------------------------------------+
        ^
        | existing application/persistence ports only
        | no new HTTP/RPC/message-bus contract
+--------------------------------------------------+
| Job / Advisory Worker Process                    |
| API-017 worker lifecycle | FEAT-022 consumer     |
| unavailable/no-network AI provider boundary      |
+--------------------------------------------------+
```

### 2.1 Process A — Admin Console Process

- 기존 Node/vanilla Console shell과 FEAT-020/021/023/024 read semantics만 소유한다.
- trusted Session으로 승인된 owning API read contract를 호출한다.
- persistence, UoW, deployment, release acceptance 또는 business mutation authority를 소유하지 않는다.
- Platform Host 장애와 별도 crash domain을 유지한다.

### 2.2 Process B — Staging Platform Host

- Core `API-001~010`, `API-016` Audit control plane, `API-017` control plane을 호스팅한다.
- 기존 Session/AuthorizationService와 bounded in-process application composition을 재사용한다.
- 각 domain/API의 persistence owner를 보존한다. 편의를 위한 generic shared database/UoW를 만들지 않는다.
- closed contract가 없는 operation을 transport로 노출하지 않는다.

### 2.3 Process C — Job / Advisory Worker Process

- `API-017` worker lifecycle과 `FEAT-022` advisory consumer/runtime만 수행한다.
- worker lease/job identity는 execution identity이며 business authority가 아니다.
- real provider/model/network, production credential과 새 scheduling/retry semantics는 `0`이다.
- 기존 application port, persistence port, internal contract만 사용할 수 있다.

## 3. Conditional worker separation gate

Worker process 분리는 다음 proof가 모두 만족될 때만 구현한다.

1. API-017 durable owner가 기존 승인된 port/contract로 control-plane state와 worker lease/result를 공유한다.
2. API-016 append는 기존 audit application/persistence port로 가능하다.
3. 새 HTTP route, API ID, RPC, message bus, internal transport 또는 service principal이 필요하지 않다.
4. tenant/scope/job identity와 append-only evidence ownership이 process boundary를 지나도 보존된다.

한 항목이라도 충족하지 못하면 새 transport를 만들지 않는다. 승인된 fallback은 `JOBS_API_017_WORKER`와 `AI_ADVISORY_FEAT_022`를 Staging Platform Host 안의 bounded in-process worker로 배치하여 ownership과 artifact component identity를 유지하는 것이다. 이 fallback조차 기존 contract로 표현할 수 없으면 AO amendment를 요청하고 중단한다.

## 4. Ownership and dependency direction

```text
Console presentation/read
  -> approved owning API contract
  -> Platform Host application boundary
  -> domain/API-owned persistence port

Worker consumer
  -> API-017 application/persistence port
  -> FEAT-022 AdvisoryRuntime
  -> FEAT-022 durable advisory store
  -> API-016 evidence port where already approved
```

- Console에서 store/UoW 직접 접근은 금지한다.
- Worker에서 Core/Audit/Jobs internal state 직접 접근은 금지한다.
- API-016은 audit truth, API-017은 job truth, FEAT-022는 advisory truth를 계속 소유한다.
- telemetry/readiness evidence는 business authorization 또는 lifecycle authority가 아니다.

## 5. Trusted identity

| Boundary | Authoritative identity | Required validation | Rejected authority source |
|---|---|---|---|
| Admin Console | approved Staging ingress가 제공한 existing session identifier를 server-side Session resolver가 해석한 actor | active Session, tenant, scope, purpose, capability, MFA where required | browser body/query actor, role, capability, development Session |
| Platform Host | existing HTTP execution context의 session identifier와 current Session | live AuthorizationService, tenant/scope/purpose, MFA/SoD, resource concealment | caller-authored actor/role/capability/approval |
| API-016 user read/export | current Session actor | `audit.query`/approved export authority, scope, purpose, MFA and evidence policy | arbitrary audit actor/system claim |
| API-016 append | existing originating actor/system provenance carried by approved internal contract | origin identity, tenant/scope, immutable evidence contract | Worker-created authority or rewritten provenance |
| API-017 submit/control | current Session actor | existing job operation authorization and tenant/scope | request-body actor or service-role elevation |
| API-017 worker | existing job/lease execution identity | exact job, lease, tenant/scope and allowed-work binding | new machine principal/service role |
| FEAT-022 advisory | existing advisory invocation identity plus trusted snapshot resolution | tenant/scope, exact input/evidence/prompt identity, canonical output validation | caller-authored evidence, provider/model authority |

Staging에서 development Session composition은 금지한다. Existing approved Staging ingress가 session identifier를 제공할 수 없으면 authentication mechanism을 발명하지 않고 startup 또는 affected request를 fail closed한다.

## 6. Core API design

- Host owner: Staging Platform Host.
- Reuse: `composeApiModulesBeforePublication()`의 in-process module and shared Session/Authorization boundaries.
- Transport: `API-001~010`의 exact canonical operation inventory와 closed schema가 확인된 operation만 wiring한다.
- Executable responsibility: one Platform Host bootstrap가 Core component manifests를 조립하되 artifact identity는 API group별로 분리한다.
- Durable authority: 각 bounded domain의 repository/UoW owner를 보존한다.
- Stop: 새 API operation, schema semantics, role/capability 또는 generic Core store가 필요하면 해당 slice를 block한다.

## 7. API-016 Audit design

- Control plane과 append/read ownership은 API-016에 남는다.
- Durable append-only persistence는 API-016 owner가 갖고 tenant/scope/purpose indexes와 immutable correction lineage를 보존한다.
- User query/export는 Platform Host의 trusted Session/Authorization boundary를 통과한다.
- Worker evidence는 기존 internal audit port/contract로만 append한다.
- Export가 기존 API-016/API-017 contract만으로 표현되지 않으면 export를 발명하지 않고 block한다.
- Shutdown은 새 append admission을 닫고 accepted append를 drain/commit한 뒤 store를 닫는다.

## 8. API-017 Jobs design

- Control plane owner: Staging Platform Host의 API-017 boundary.
- Worker owner: 조건부 Job/Advisory Worker Process 또는 승인 fallback의 in-process bounded worker.
- Durable owner: API-017 하나이며 job, idempotency, successor/result, lease/heartbeat evidence를 소유한다.
- Dispatch/retry: frozen contract에 이미 존재하는 semantics만 사용한다. 새 state, retry count/rule, schedule policy는 만들지 않는다.
- Identity: user operation은 Session actor, execution은 exact job/lease identity를 사용한다.
- Shutdown: control plane은 new submission/claim을 차단하고 worker는 claim 중단, bounded drain, authoritative result/lease evidence commit 후 종료한다.

## 9. FEAT-022 Advisory design

- Worker가 API-017의 authorized job identity로 existing `AdvisoryRuntime`을 호출한다.
- Production-style composition은 existing trusted snapshot resolver, prompt identity registry와 durable advisory store를 사용한다.
- Default Staging adapter는 existing unavailable/no-network behavior다. Deterministic test adapter를 Staging으로 승격하지 않는다.
- Real model/provider/network/credentials는 활성화하지 않는다.
- Provider unavailable 상태에서도 runtime process health와 advisory execution readiness를 구분한다. `UNKNOWN`을 `READY`로 변환하지 않는다.
- Shutdown은 new advisory work admission을 닫고 accepted job의 durable result/evidence 경계를 완결한 뒤 store를 닫는다.

## 10. Admin Console design

- 별도 executable/process responsibility를 유지한다.
- `development` Session adapter를 사용할 수 없고 production-style fail-closed rule을 따른다.
- Platform Host의 existing approved read/runtime contracts만 소비한다.
- FEAT-020/021/023/024의 read-only, escaping, accessibility, `EMPTY/UNAVAILABLE/NOT_AUTHORIZED/ERROR` truth를 보존한다.
- backend unavailable은 affected projection을 `UNAVAILABLE`로 표시할 수 있으나 authoritative state를 만들어내지 않는다.
- mutation controls, accept/promote/deploy/retry/recover controls와 direct store access는 `0`이다.

## 11. Shared versus isolated infrastructure

| Concern | Decision | Boundary |
|---|---|---|
| Config loader | SHARED implementation convention; PER-PROCESS instance/input | 각 process가 자기 schema만 읽고 다른 process config를 소유하지 않는다. |
| Authorization | SHARED canonical semantics; PER-PROCESS injected instance where needed | Platform Host is user-operation authority; Console/Worker cannot manufacture authority. |
| Telemetry conventions | SHARED | emitters/context are per process; telemetry is not authority. |
| Operational evidence | SHARED read contract; ISOLATED owning persistence | existing operational evidence owner only; direct cross-store access prohibited. |
| Release evidence | SHARED read contract; ISOLATED owning persistence | Console reads safe DTO only. |
| Logging | SHARED sanitization/schema; PER-PROCESS sink/config | external shipping `0`; secret/PII/raw payload `0`. |
| Health/readiness | SHARED vocabulary; PER-COMPONENT projection | process aggregate cannot convert `UNKNOWN` to `READY`. |
| SQLite/data paths | PER-OWNER / PER-PROCESS configuration | no generic shared DB; API-017 control/worker may share only API-017-owned durable path through existing port. |
| Graceful shutdown | SHARED lifecycle convention; PER-PROCESS coordinator | no global mutable singleton. |

## 12. Network policy

Allowed communication is limited to:

- approved Staging ingress/browser → Admin Console;
- Admin Console → Platform Host using existing approved HTTP contracts and configured Staging origin;
- approved Staging ingress/client → Platform Host existing closed contracts;
- Worker ↔ owner state through existing application/persistence ports only.

External provider/model, external monitoring/log shipping, production credentials and newly invented internal network destinations are all `0`.

## 13. Failure isolation and fail-closed rules

| Failure | Required behavior |
|---|---|
| Invalid/missing process config | process does not advertise readiness or listen/claim work |
| Missing required durable store/path | owning component startup fails closed; no in-memory fallback |
| Missing/invalid Session resolver | protected Console/Host access fails closed |
| Admin Console failure | Platform Host and Worker authority/state remain unaffected |
| Worker failure | Platform Host control plane remains available; no authority loss or implicit retry |
| Platform Host failure | Console dependent reads become safe unavailable; Worker stops new work unless existing approved durable contract proves safe continuation |
| API-016 unavailable | evidence-requiring mutation/work does not proceed unless canonical atomic/evidence contract already permits it |
| API-017 unavailable | no new job submission/claim; advisory does not self-dispatch |
| Advisory provider unavailable | no model call; bounded unavailable/failure evidence only |
| Ambiguous dependency state | existing `UNKNOWN`/`NOT_READY` behavior; never fabricate success/readiness |

## 14. Artifact/process mapping

Each runtime component owns a deterministic component manifest and fingerprint. One process artifact may contain multiple component roots, but one opaque process hash cannot replace component fingerprints.

| Runtime component | Process | Artifact component | Config schema | Fingerprint owner |
|---|---|---|---|---|
| Admin Console | Admin Console Process | `ADMIN_CONSOLE` | `Rel001AdminConsoleStagingConfiguration` | Console artifact builder |
| Core API-001~010 | Staging Platform Host | `CORE_APIS_FEAT_001_011` | `Rel001StagingPlatformHostConfiguration.core` | Core host artifact builder |
| API-016 Audit | Staging Platform Host | `AUDIT_API_016` | `Rel001StagingPlatformHostConfiguration.audit` | API-016 artifact builder |
| API-017 control | Staging Platform Host | `JOBS_API_017_CONTROL` | `Rel001StagingPlatformHostConfiguration.jobsControl` | API-017 artifact builder |
| API-017 worker | Worker or approved fallback | `JOBS_API_017_WORKER` | `Rel001JobAdvisoryWorkerConfiguration.jobs` | API-017 worker artifact builder |
| FEAT-022 Advisory | Worker or approved fallback | `AI_ADVISORY_FEAT_022` | `Rel001JobAdvisoryWorkerConfiguration.advisory` | FEAT-022 artifact builder |

These identifiers are artifact/runtime component identifiers only이며 새 Feature/API ID가 아니다. Exact paths, file hashes and aggregate candidate fingerprint는 future exact-candidate rebuild에서 materialize한다.

## 15. Recommended implementation sequence

1. Core identity / Core API runtime foundation.
2. API-016 durable Audit runtime.
3. API-017 durable Jobs runtime, beginning with the conditional worker-separation proof.
4. FEAT-022 executable lifecycle using unavailable/no-network provider behavior.
5. Admin Console Staging bootstrap.
6. Integrated Staging runtime verification.
7. Exact REL-001 candidate rebuild and reevaluation.

각 phase는 별도 Brief/AO authorization을 요구한다. Phase 0에서 implementation plan 또는 Production 변경을 시작하지 않는다.

## 16. Unresolved blockers and gates

| ID | Item | Effect | Disposition |
|---|---|---|---|
| `REL001-P0-GATE-001` | API-017 worker/control cross-process operation을 existing port/contract만으로 증명해야 함 | Phase 3 process separation | prove first; otherwise approved in-process fallback |
| `REL001-P0-GATE-002` | Core API-001~010 exact transport-safe operation/schema inventory | Phase 1 transport | operation-by-operation inventory; new semantics이면 block |
| `REL001-P0-GATE-003` | API-016 export field/storage/expiry와 API-017 binding의 existing canonical sufficiency | Phase 2 export | insufficient contract이면 AO amendment 요청 |
| `REL001-P0-GATE-004` | Approved Staging ingress가 existing Session identifier를 제공하는지 | Console/Host authentication | absent이면 fail closed; auth mechanism 발명 금지 |
| `REL001-P0-GATE-005` | API-017 lease/heartbeat/policy values | Phase 3 lifecycle | existing canonical source가 없으면 값 발명 금지 |

이 gate들은 topology 선택을 block하지 않지만 각 implementation slice의 mandatory stop condition이다.

## 17. Scope protection

| Item | Result |
|---|---|
| Production/test changes | `0/0` |
| Executable/transport/persistence implementation | `0/0/0` |
| Dependency/lockfile changes | `0/0` |
| New API/routes/authority/roles/states | `0/0/0/0/0` |
| External provider/network/credentials | `0/0/0` |
| Registry status mutation | `0` |

## 18. Final Recommendation

```text
APPROVE_REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN
```
