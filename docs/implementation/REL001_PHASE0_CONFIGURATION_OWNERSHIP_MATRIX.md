# REL-001 Phase 0 Configuration Ownership Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-050 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / Security Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Parent design | [DOC-DEV-048](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) |

## 1. Configuration principles

1. Configuration input and validated runtime object are per process.
2. Loader/schema conventions may be shared code but mutable configuration singleton은 금지한다.
3. Secret values are never embedded. Only provider-neutral secret references may be accepted by an already approved consumer.
4. Staging cannot load Production credentials or enable real provider/model/network destinations.
5. Missing required durable path, trusted Session resolver or owning dependency fails closed; in-memory fallback is prohibited.
6. Unknown configuration fields and unsupported runtime modes are rejected.
7. Exact field names/defaults are implementation-phase contracts. This design fixes ownership and validation rules, not undocumented values.

## 2. Process configuration ownership

| Concern | Admin Console Process | Staging Platform Host | Job / Advisory Worker | Shared / isolated decision |
|---|---|---|---|---|
| Runtime mode | required exact `Staging`; development adapter forbidden | required exact `Staging` | required exact `Staging` | PER-PROCESS value, SHARED enum semantics |
| Bind address | process-owned, explicit, no undocumented default | process-owned, explicit | N/A unless existing approved local interface requires it | PER-PROCESS |
| Port | process-owned, bounded valid port | process-owned, distinct from Console | N/A by default; no new listener | PER-PROCESS |
| Service origins | approved Platform Host read origin only | approved ingress/origin policy for existing APIs | none unless an existing approved contract already defines it | PER-PROCESS allowlist; no invented destination |
| Database/storage paths | none | per-domain Core, API-016, API-017 paths | FEAT-022 path; API-017 path only through same API-017 owner/port | PER-OWNER, explicit absolute/approved resolved path |
| Feature toggles | read sections only; cannot grant authority | only existing canonical operation exposure | advisory consumer enablement only after dependencies ready | PER-COMPONENT; fail closed; no new capability |
| Provider enablement | none | none | unavailable/no-network only | external provider enablement fixed disabled |
| Network destination policy | Platform Host approved origin only | no external provider/log destination | no external destination | deny by default; external count `0` |
| Secret references | none expected; no embedded Session | only existing approved secret-reference consumers | no model/provider credential reference | PER-CONSUMER; Production secret activation `0` |
| Telemetry/logging | safe structured local emission | safe structured local emission | safe structured local emission | SHARED schema/sanitizer, PER-PROCESS sink |
| Health/readiness | Console process and backend-read dependency projections | component plus Host aggregate | Worker/API-017/Advisory projections | SHARED vocabulary, PER-COMPONENT state |
| Shutdown/restart | listener drain timeout and signal policy | listener/admission/store drain policy | claim stop/drain/lease/result policy | SHARED lifecycle convention, PER-PROCESS coordinator |

## 3. Configuration schemas

The following names are bounded design identities, not implemented schemas or new public APIs.

### 3.1 `Rel001AdminConsoleStagingConfiguration`

| Field group | Owner | Required rule | Fail-closed condition |
|---|---|---|---|
| runtime | Console | exact Staging mode | unsupported/missing mode |
| listener | Console | explicit bind address and port | invalid/ambiguous endpoint |
| platformReadOrigin | Console | approved Staging Platform Host origin | missing/unapproved origin |
| sessionResolution | Security/Console composition | existing trusted Session resolver reference; development adapter false | resolver unavailable or dev adapter enabled |
| readTimeouts | Console/Operations | bounded values approved in implementation brief | missing canonical value; no invented default |
| telemetry | Operations | existing schema/sanitizer, local sink | unsafe/external sink |
| lifecycle | Operations | bounded drain/restart configuration | invalid/unbounded value |

### 3.2 `Rel001StagingPlatformHostConfiguration`

| Field group | Owner | Required rule | Fail-closed condition |
|---|---|---|---|
| runtime/listener | Platform Host | exact Staging, explicit address/port | invalid/missing |
| identity | Security | existing Session/Authorization composition references | resolver/policy unavailable |
| core | each Core domain owner | exact enabled canonical operations and durable paths | missing durable owner or unknown operation |
| audit | API-016 owner | durable append-only DB path and approved settings | missing path or in-memory fallback |
| jobsControl | API-017 owner | durable DB path and existing policy references | missing path/policy or in-memory fallback |
| network | Operations/Security | ingress/CORS/origin rules for existing contracts only | wildcard/unapproved external destination |
| telemetry/readiness | Operations | existing safe schema/vocabulary | unsafe sink or invented readiness state |
| lifecycle | Operations | admission stop, drain, store close order | invalid/unbounded setting |

### 3.3 `Rel001JobAdvisoryWorkerConfiguration`

| Field group | Owner | Required rule | Fail-closed condition |
|---|---|---|---|
| runtime | Worker owner | exact Staging | invalid/missing |
| jobs | API-017 owner | existing durable port/path, lease/policy references | cross-process proof absent, missing durable owner, invented values |
| audit | API-016 owner | existing internal evidence port reference | new transport required |
| advisory | FEAT-022 owner | durable DB, trusted snapshot resolver, prompt registry references | missing trusted input/prompt/store |
| provider | AI/Security | unavailable/no-network adapter only | any real provider/model/credential enablement |
| telemetry/readiness | Operations | safe local schema and existing vocabularies | external sink or unsafe detail |
| lifecycle | Operations/API-017 | stop claim, bounded drain, durable result/lease close | unsafe abandon/blind retry behavior |

## 4. Shared versus per-process ownership detail

| Infrastructure | Classification | Canonical owner | Prohibition |
|---|---|---|---|
| Config loader code | SHARED | Development/Operations | process A may not load/process B's mutable config object |
| Validated config instance | PER-PROCESS | owning process | global mutable singleton |
| Authorization policy semantics | SHARED | Security/owning domain | Console/Worker-local authority invention |
| Authorization service instance | PER-PROCESS where required | Platform/Security composition | stale cached authority replacing live check |
| Telemetry contract/sanitizer | SHARED | FEAT-023/Operations/Security | raw prompt/provider/PII/secret emission |
| Logging sink | PER-PROCESS | Operations | external shipping without approval |
| Operational evidence persistence | ISOLATED OWNER | FEAT-023 | generic shared evidence database |
| Release evidence persistence | ISOLATED OWNER | FEAT-024 | Console direct store read |
| Core domain databases | PER-DOMAIN OWNER | FEAT-001~011 owners | one convenience database/UoW authority |
| API-016 database | ISOLATED OWNER | API-016 | Worker mutation outside audit port |
| API-017 database | SHARED BY SAME OWNER only | API-017 control/worker | second queue store or non-API-017 writer |
| FEAT-022 database | ISOLATED OWNER | FEAT-022 | API-017 treating advisory data as job truth |
| Shutdown coordinator | PER-PROCESS | process owner | cross-process global mutable coordinator |

## 5. Environment and secret policy

- Staging data is synthetic or explicitly approved masked subset.
- Production-to-Staging data, credentials or secret reuse is default deny.
- Secret reference resolution is permitted only for an already approved consumer and never for a real AI/provider integration in this phase.
- Configuration diagnostics expose safe field identifiers only; no value, path, SQL, stack or environment dump.
- No `.env` content, embedded token, credential, business data or local-machine-specific path may enter an artifact manifest.

## 6. Configuration implementation gates

| Gate | Required evidence | Failure disposition |
|---|---|---|
| Unknown-field rejection | closed recursive schema tests | block startup |
| Staging-only mode | mode and dev-session rejection tests | block startup |
| Durable path selection | production-style composition tests; no in-memory fallback | block owning component |
| Existing Session resolution | resolved current Session, stale/revoked failure tests | block protected access/startup as applicable |
| Network deny | configured destinations exactly match approved local origins | block startup |
| Provider disabled | arbitrary/real adapter injection rejection | block Worker advisory readiness |
| Safe diagnostics | secret/path/stack/raw payload leakage tests | safe error only |
| No hidden defaults | every required operational value explicit or canonically sourced | stop for AO decision rather than invent |
