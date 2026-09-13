# REL-001 Phase 0 Runtime Component Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-049 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Development Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Parent design | [DOC-DEV-048](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) |

## 1. Component matrix

| Runtime component | Canonical owner | Process | Executable responsibility | Transport | Trusted identity | Authorization | Persistence | Config owner | Startup dependency | Failure isolation | Health/readiness | Artifact component | Current gap | AO amendment |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Admin Console | FEAT-021 UI; owning data APIs retain truth | Admin Console Process | browser shell, existing routes, safe read projection | existing approved owning-API HTTP reads only | existing server-resolved Session actor | backend live authorization; UI is presentation only | none; direct store/UoW forbidden | Console process | config, trusted Session boundary, required Platform read origins | separate from Host/Worker | process health separate from per-read availability; unavailable stays unavailable | `ADMIN_CONSOLE` | Staging config/session/composed read bootstrap absent | NO for topology; YES only if existing Session ingress is insufficient |
| Core API-001~010 | FEAT-001~011 owning modules | Staging Platform Host | compose bounded application modules and expose only exact closed operations | closed HTTP wiring only after exact contract inventory | current Session actor | shared existing Session/AuthorizationService; tenant/scope/purpose/MFA/SoD | per-domain owning repository/UoW; no generic Core DB | Platform Host `core` | durable owners, identity/auth, contract registration | Host crash domain; modules remain ownership-bounded | component and Host projections use existing vocabulary | `CORE_APIS_FEAT_001_011` | no executable/closed HTTP/durable production composition | YES if any operation lacks canonical schema/semantics |
| API-016 Audit | FEAT-017 / API-016 / Security-Governance Owner | Staging Platform Host | append/query/history and only canonically complete export control | existing internal audit port plus closed API-016 HTTP | Session actor for read/export; existing origin provenance for append | `audit.query`/approved export plus scope/purpose/MFA | API-016 durable append-only store | Platform Host `audit` | identity/auth, audit DB; export may depend on API-017 | bounded module in Host; evidence failure blocks dependent governed work | append/query readiness distinct from Host health | `AUDIT_API_016` | in-memory query subset; durability/history/export/bootstrap absent | YES if export/storage/expiry contract is insufficient |
| API-017 control plane | FEAT-018 / API-017 / Domain-Operations Owner | Staging Platform Host | submit/read/control canonical jobs; own durable queue truth | closed API-017 HTTP plus existing internal ports | Session actor for user operations | existing job authorization and tenant/scope | API-017 durable job/idempotency/result/lease state | Platform Host `jobsControl` | identity/auth, API-017 DB, API-016 evidence readiness | Host module; Worker failure does not remove control truth | submission/control readiness and Worker readiness separate | `JOBS_API_017_CONTROL` | process-local maps; no durable/HTTP/bootstrap | YES if closed contract/policy values are absent |
| API-017 worker | FEAT-018 / API-017 | Job/Advisory Worker, conditional | claim/lease/heartbeat/execute/result within existing job semantics | existing application/persistence/internal contracts only; no new network transport | exact job/lease execution identity | lease authorizes only assigned technical work; no business authority | same API-017-owned durable path via approved port | Worker `jobs` | config, API-017 durable port, API-016 evidence port; current admission rules | separate if proof passes; otherwise bounded in-process fallback | Worker health, claim readiness and job outcome remain distinct | `JOBS_API_017_WORKER` | worker identity/lease/durable cross-process proof absent | NO if existing ports suffice; otherwise fallback or bounded amendment |
| FEAT-022 Advisory runtime | FEAT-022 / AI Reviewer | Job/Advisory Worker, conditional | consume authorized advisory jobs; run canonical validator/runtime; persist advisory evidence | API-017 internal job contract and existing advisory ports; public AI API `0` | advisory invocation identity plus trusted snapshot | advisory has no business authority; tenant/scope and output contract validation | FEAT-022 durable advisory/prompt/idempotency store | Worker `advisory` | API-017 work identity, trusted snapshots, prompt identity, durable advisory DB | Worker crash does not change Host authority; restart uses durable replay | runtime health distinct from provider availability/execution readiness | `AI_ADVISORY_FEAT_022` | no executable/consumer/readiness/drain; provider unavailable by design | NO for no-network lifecycle; YES if new job/provider semantics are needed |

## 2. Core API transport-safety gate

| Group | Existing safe basis | Phase 1 proof required | Stop condition |
|---|---|---|---|
| API-001 Identity/Access | SessionService/AuthorizationService and RequestContext | exact operation allowlist, immutable request/response schema, durable authority | new identity/auth mechanism or role/capability |
| API-002/003 Source/Intake | existing façade/application boundaries | owner-safe closed operations and durable repository selection | connector execution or Source governance ownership change |
| API-004/005 Property/Listing | existing domain services | exact state/version/idempotency/error mapping | lifecycle or business authority change |
| API-006/007 Contact/Client | existing application contracts | privacy-minimized DTO, purpose/scope/concealment | new privacy class or caller-owned purpose |
| API-008/009/010 Requirement/Matching | existing domain façades | canonical operation schema and safe read/command division | AI authority or new matching semantics |

## 3. Artifact/process mapping

| Runtime component ID | Process ID | Executable root responsibility | Artifact component identity | Configuration schema | Persistence owner | Component fingerprint responsibility |
|---|---|---|---|---|---|---|
| `ADMIN_CONSOLE` | `REL001_ADMIN_CONSOLE_PROCESS` | Admin Console compiled server/browser closure | `ADMIN_CONSOLE` | `Rel001AdminConsoleStagingConfiguration` | none | Console artifact builder |
| `CORE_APIS_FEAT_001_011` | `REL001_STAGING_PLATFORM_HOST` | API-001~010 application/HTTP closure | `CORE_APIS_FEAT_001_011` | `Rel001StagingPlatformHostConfiguration.core` | each Core bounded domain | Core host artifact builder |
| `AUDIT_API_016` | `REL001_STAGING_PLATFORM_HOST` | API-016 application/HTTP/store closure | `AUDIT_API_016` | `Rel001StagingPlatformHostConfiguration.audit` | API-016 | API-016 artifact builder |
| `JOBS_API_017_CONTROL` | `REL001_STAGING_PLATFORM_HOST` | API-017 control application/HTTP/store closure | `JOBS_API_017_CONTROL` | `Rel001StagingPlatformHostConfiguration.jobsControl` | API-017 | API-017 control artifact builder |
| `JOBS_API_017_WORKER` | `REL001_JOB_ADVISORY_WORKER` or approved fallback | worker/lease lifecycle closure | `JOBS_API_017_WORKER` | `Rel001JobAdvisoryWorkerConfiguration.jobs` | API-017 | API-017 worker artifact builder |
| `AI_ADVISORY_FEAT_022` | `REL001_JOB_ADVISORY_WORKER` or approved fallback | advisory consumer/runtime/store closure | `AI_ADVISORY_FEAT_022` | `Rel001JobAdvisoryWorkerConfiguration.advisory` | FEAT-022 | FEAT-022 artifact builder |

## 4. Acceptance rules

- Every component manifest contains normalized included paths, sizes, SHA-256 and component fingerprint.
- A process manifest references its component fingerprints; it does not replace them.
- Candidate fingerprint binds exact component fingerprints, `REL-001`, `Staging`, source commit and repository identity.
- A missing mandatory component remains an explicit runtime gap; it cannot be hidden by a process-level hash.
- Worker fallback changes process placement only. Canonical owner, artifact component identity and fingerprint responsibility remain unchanged.
