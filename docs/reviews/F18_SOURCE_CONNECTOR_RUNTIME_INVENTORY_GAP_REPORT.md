# F18 Source / Connector Runtime Inventory & Gap Report

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | IN REVIEW |
| Baseline | `65ed3657fdbe91e66a6746a74214dd5e6c4bbd3f` |
| Scope | F18-A Canonical Source / Connector Inventory |
| Production source changes | 0 |
| Push | NOT_PERFORMED |

## 1. Objective

F18 Production 구현 전에 Source ingestion과 Connector execution의 canonical ownership, operation surface, 현재 실행 경계, durability, security 및 provider readiness를 실제 문서와 코드로 대조한다. 이 보고서는 설계 승인 요청 자료이며 API, persistence schema 또는 provider contract를 새로 승인하지 않는다.

현재 결론은 다음과 같다.

- Source governance는 `API-015`, bounded Source intake는 `API-003/004`, Connector technical execution/evidence는 `API-018`, external/provider contract·identity·mapping·observation evidence는 `API-019`가 각각 소유한다.
- `API-018/019`는 logical operation family와 authority boundary는 frozen 상태이나 executable closed contract와 runtime은 없다.
- 기존 Source/Intake 및 `API-017` 구현은 in-process application facade까지 존재하지만 process-local state에 의존하며 Runtime/Host/HTTP/Job connector execution path는 없다.
- production-authoritative Connector lease/invocation/checkpoint/idempotency/restart persistence는 없다.
- 실제 provider adapter, production credential, approved external destination 및 network activation은 없다. 현재 Production external network activation은 `0`이다.
- 따라서 F18 Production 구현은 Architecture Owner의 `APPROVE_F18_SOURCE_CONNECTOR_RUNTIME_DESIGN` 이전에 시작할 수 없다.

## 2. Documents read

- F18 brief: `C:\Users\Pc\.codex\attachments\1e1bd8da-041f-4189-8c0b-b4f8909ab0e6\pasted-text.txt` lines 24–100, 103–142, 145–260, 351–499, 643–696.
- [API Registry](../00_API_REGISTRY.md) lines 39–44, 48, 65–67, 73–94.
- [Decision Register](../00_DECISION_REGISTER.md) lines 46, 168, 179.
- [Workflow Registry](../00_WORKFLOW_REGISTRY.md) lines 17, 25–27, 34, 80, 110.
- [Canonical RTM](../00_CANONICAL_TRACEABILITY_MATRIX.md) lines 44–50.
- [Security Registry](../00_SECURITY_REGISTRY.md) lines 48–58, 66–75.
- [Source and Raw Data Model](../book-3/04_SOURCE_AND_RAW_DATA_MODEL.md) lines 14–39, 49–73.
- [Data Dictionary](../book-3/15_DATA_DICTIONARY.md) lines 31–36.
- [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md) lines 12–58.
- [Connector Contracts](../book-6/12_CONNECTOR_CONTRACTS.md) lines 12–68.
- [External Integration Architecture](../book-6/13_EXTERNAL_INTEGRATION.md) lines 12–69.
- [Test Registry](../book-10/15_TEST_REGISTRY.md) TEST-008/014/027/036/037 rows.
- [FEAT-016 Traceability Matrix](../implementation/FEAT016_TRACEABILITY_MATRIX.md), Source governance ownership evidence.
- [F17 Final Gate Report](F17_FINAL_GATE_REPORT.md), API-014/018/019 separation evidence.

## 3. Canonical ownership and closed operation inventory

### 3.1 Ownership

| Capability | Canonical owner and boundary | Canonical evidence | Current execution status |
|---|---|---|---|
| Source policy/governance | `API-015`; Source policy proposal/review/approval/status. Connector execution authority 없음 | API Registry lines 40, 48; `DEC-114` | Durable API-015 Application/Runtime/HTTP exists; Source execution은 포함하지 않음 |
| Source intake/candidate handoff | `API-003/004`; approved policy read, raw evidence/intake validation, non-authoritative candidate handoff | API Registry line 48; Source/Intake contracts | In-process `SourceIntakeApi` exists; connector Runtime/Host/HTTP 없음 |
| Background work | `API-017`; domain-authorized jobs only, worker lease scope only, no arbitrary execution | API Registry lines 42, 87, 94; Background Job Contracts lines 18–50 | In-process `JobApi`/`JobService`; durable/host/http worker runtime 없음 |
| Connector execution/evidence | `API-018`; bounded technical execution, lease/report/checkpoint/health; no business approval | API Registry lines 43, 65–67, 88; `DEC-103`; Connector Contracts | Logical contract only; executable contract/runtime 없음 |
| External/provider lifecycle/evidence | `API-019`; contract, external identity/mapping, observation evidence and technical lifecycle only | API Registry lines 44, 67, 89; `DEC-103`; External Integration Architecture | Logical contract only; executable contract/runtime 없음 |
| Publication execution | `API-014`/F17; admission, outcome interpretation and Publication lifecycle | API Registry lines 39, 54–67; F17 Final Gate | Complete baseline; F18 변경 금지 |

`DEC-015`의 connector isolation, `DEC-103`의 API ownership separation, `SEC-032`의 scoped service identity/default-deny가 F18의 상위 제약이다. Connector/provider는 Verification, Permission, Approval, Source governance 또는 Publication lifecycle authority를 생성할 수 없다.

### 3.2 Logical operation inventory

Frozen 문서는 아래 operation을 logical operation으로 정의한다. `API-018` 문서는 connector-specific route/schema가 정의되지 않았음을 명시하므로, 이 목록은 구현 가능한 semantic inventory이지 아직 TypeScript closed schema inventory는 아니다.

| API | Logical operation | Classification | Canonical constraint | Executable now |
|---|---|---|---|---|
| API-017 | `SubmitJob` | Command | Domain-authorized allowlisted job only | In-process only |
| API-017 | `ReadJob`, `ReadJobResult` | Query | Safe scoped result/status | `ReadJob` equivalent in-process; distinct result boundary 없음 |
| API-017 | `CancelJob` | Command | Best effort; external rollback 의미 아님 | In-process only |
| API-017 | `RetryAsSuccessor` | Command | Current authority/retry safety 재검사 | In-process only |
| API-018 | `RegisterConnectorInstance` | Technical Command | Approved instance/source/target scope | No |
| API-018 | `SubmitCaptureBatch` | Technical Command | Same intake validation/human gates | No |
| API-018 | `ReadBatchStatus` | Technical Query | Acceptance is not verification | No |
| API-018 | `AdvanceCheckpoint` | Technical Command | Monotonicity/current binding; evidence only | No |
| API-018 | `LeaseApprovedDelivery` | Technical Command | Exact authorized Attempt/representation | No |
| API-018 | `ReportDeliveryAttempt` | Technical Command | Evidence only; API-014 interprets outcome | No |
| API-018 | `SubmitExternalObservation` | Technical Command | Observation is not canonical state authority | No |
| API-018 | `ReportHealth` | Technical Command/Query signal | No business decision | No |
| API-019 | connector/integration registration and health | Technical lifecycle | Approved contract/version required | No |
| API-019 | scoped intake submission | Technical ingress | Domain Source/Intake remains owner | No |
| API-019 | approved delivery lease/report | Technical egress/evidence | API-014 owns business execution | No |
| API-019 | external mapping/observation | Technical evidence | Stable mapping; conflicting mapping fails closed | No |
| API-019 | reconciliation/suspension/revocation | Technical contract lifecycle | Business reconciliation remains API-014/F19; semantic split must be explicit | No |

### 3.3 Closed-contract finding

`API-018/019`에는 names와 semantic families가 frozen 문서에 존재하지만, current repository에는 immutable operation union, bounded request/response parser, allowlist, error mapping 또는 executable contract tests가 없다. 특히 API Registry의 `mapping/reconcile/suspend`와 F18의 “F19 reconciliation은 미구현” 제약 사이에서 **technical contract reconciliation**과 **business outcome reconciliation**을 명시적으로 분리해야 한다. 새 API ID나 business operation을 만들 필요는 없지만, implementation 전에 AO가 이 split과 exact closed schema를 승인해야 한다.

## 4. Source domain inventory

### 4.1 Canonical entities and lifecycle

| Item | Canonical source | Current implementation | Executable | Durable | Production-safe | Gap / minimum correction |
|---|---|---|---|---|---|---|
| Source Registry | Data Model lines 18–32; Data Dictionary line 31 | `SourceRegistryService`, plus durable API-015 Source governance repository | Yes, separately | Governance: yes; legacy service: no | Governance path yes; legacy process-local mutation no | F18 admission must read authoritative API-015 Source governance view; legacy `propose()` must not become connector governance path |
| Raw Source | Data Model lines 21, 34–47; Data Dictionary line 32 | `RawSourceStore` uses in-memory `Map` | In-process only | No | No for production | Durable Source execution evidence repository/UoW required; retain immutable provenance |
| Collector | Data Model lines 23, 49–51; Data Dictionary line 34 | No executable Collector/Connector aggregate | No | No | No | API-018 scoped service/connector identity and current status boundary required |
| Source Provenance | Data Model lines 24, 53–57; Data Dictionary line 36 | Raw evidence audit fields only; no complete durable provenance journal | Partial | No | No | Durable append-only normalized observation/provenance evidence required |
| Intake | Data Dictionary line 35 | Existing Intake service through `SourceIntakeApi` | In-process | Process-local in current path | No for connector production | Connector admission must hand off through existing intake validation; no direct verified/canonical mutation |

Canonical Source governance lifecycle is `DRAFT`, `UNDER_REVIEW`, `ACTIVE`, `PAUSED`, `BLOCKED`, `RETIRED` in the approved API-015 contract/current service. The older Data Dictionary uses lower-case `draft/review/active/...`; this is a presentation/casing legacy alias, not a second lifecycle. Connector eligibility requires current `ACTIVE`, matching policy version, allowed method and purpose.

Canonical intake lifecycle is:

`INTAKE.DRAFT → INTAKE.VALIDATION_FAILED | INTAKE.QUARANTINED | INTAKE.VALIDATED → INTAKE.AI_REQUESTED | INTAKE.REVIEW_REQUIRED | INTAKE.CORRECTED | INTAKE.CANDIDATE_REGISTERED | INTAKE.REJECTED`.

Verification is not a Source or Intake state. It is a separate authority/workflow boundary. `CANDIDATE_REGISTERED` is not verification and Connector output cannot directly create a verified Listing or approved Publication.

### 4.2 Current Source services

- `SourceRegistryService` holds `#sources` in a process-local `Map`, supports list/read/propose and validates `ACTIVE`, version, method and purpose before capture.
- `RawSourceStore` holds evidence in a process-local `Map`, captures immutable evidence after policy validation and appends an audit record, but state/audit are not proven atomic or restart-durable.
- `SourceIntakeApi` derives the actor from `sessionId` and exposes Source/Intake methods through the generic in-process API boundary.
- `composeApiModulesBeforePublication()` registers `SourceIntakeApi`, but no Source Runtime adapter, Application Host binding, HTTP adapter or connector Job binding exists.
- API-015 Source governance is durable and authoritative, but F18 must consume it through an injected read boundary rather than access its repository/UoW directly or duplicate Source governance.

## 5. Connector, lease, checkpoint and execution inventory

| Item | Canonical source | Current implementation | Executable | Durable | Production-safe | Exact gap / proposed minimum correction |
|---|---|---|---|---|---|---|
| Connector instance | API-018 Connector Contracts lines 32–52 | None | No | No | Fail-closed by absence | Closed instance identity/status/version read model and UoW port |
| Lease | API Registry lines 43/88; Connector Contracts `LeaseApprovedDelivery` | No Source connector lease model; API-017 job “worker lease” is documentary only | No | No | No execution possible | Define bounded API-018 lease identity/owner/expiry/version semantics; do not reuse in-memory Job state as lease authority |
| Invocation | Connector Contracts request model; F18 brief lines 193–215 | None | No | No | No execution possible | Stable connector/source/tenant/job-attempt/invocation/idempotency identity |
| Checkpoint | `AdvanceCheckpoint`; validation requires monotonicity where applicable | None | No | No | No | Durable versioned checkpoint bound to connector+source; advance only with authoritative successful technical result |
| Health/status | `ReadBatchStatus`, `ReportHealth` | None | No | No | No | Safe status/health view without business authority |
| Execution evidence | API-018 report/observation operations; SEC-021–023/032 | Publication-specific F17 evidence store only; not reusable as Source connector runtime | No Source path | No | No | Append-only normalized Source connector evidence; raw provider response forbidden |
| External identity/mapping | API-019 lines 33–57 | None | No | No | No | Stable versioned mapping; conflict default deny; no silent remap |
| Provider observation | API-019 response/authority rules | None | No | No | No | Immutable observation evidence handed to canonical validation; no truth mutation |
| Idempotency | API Registry lines 43–44 | No Connector store | No | No | No | Durable intent fingerprint + authoritative result; same key/different intent conflict |
| Restart behavior | Background/Connector contracts and F18 critical rule | None | No | No | No | `EXECUTION_STARTED` without authoritative result becomes ambiguous/fail-closed; blind rerun `0` |

## 6. Runtime surface inventory

| Layer | Source/Intake | API-017 Jobs | API-018 | API-019 |
|---|---|---|---|---|
| Domain/service | `SourceRegistryService`, `RawSourceStore`, Intake service | `JobService` | None | None |
| Application/API facade | `SourceIntakeApi` | `JobApi` | None | None |
| Composition registration | Generic `composeApiModulesBeforePublication()` | Generic `composeApiModulesBeforePublication()` | None | None |
| Runtime adapter | None | None | None | None |
| Host binding | None | None | None | None |
| HTTP endpoint | None | None | None | None |
| Background worker binding | None | No executable worker/lease host | None | None |
| Scheduler ownership | N/A | Logical API-017 only | Must not be duplicated | N/A |

Current facades are executable only when directly invoked in-process with injected dependencies. They do not establish the required `HTTP / Job Trigger → Runtime / Host → Application → durable UoW → connector` production path.

`JobService` implements submit/read/start/succeed/fail/cancel/successor behavior, expected-version checks, authorization and process-local idempotency. Its policy, jobs and idempotency records are all `Map` state; it has no durable job repository, worker lease/heartbeat, restart recovery or connector binding. API-017 must therefore remain a scheduling trigger only and must not become a second connector runtime.

## 7. Security, provider and production safety inventory

| Control | Current evidence | Finding |
|---|---|---|
| Session-derived human actor | `SourceIntakeApi`/`JobApi` resolve `sessionId` | Present for interactive in-process calls; no Connector Runtime boundary yet |
| System/job identity | `JobService` accepts scoped Session/service actor and checks authorization | Partial; no durable current connector instance/lease binding |
| Tenant/team/scope | Generic Authorization service and API-015 scoped Source governance | Partial; no connector-source-tenant binding model |
| Capability/purpose | Current Source capture checks `source.read`, `intake.create`, method/purpose | Partial; no API-018 closed capability matrix |
| Source ownership | Source policy ID/version check exists | Partial; connector instance ownership/binding absent |
| Credentials | Logical docs allow only credential reference | No credential implementation; no credential transmission/storage |
| Destination control | No approved real destination/allowlist | No network activation; safe default is unavailable |
| Real adapter | None | NOT_IMPLEMENTED |
| Deterministic test adapter | No Source connector adapter found | NOT_IMPLEMENTED; may be added test-only after approval |
| Sandbox adapter | None; no approved sandbox contract | DEFERRED / NOT_APPLICABLE |
| Production adapter | None | Fail-closed by absence, but explicit production composition guard is not implemented |
| Network activation | None | `0`; must remain `0` in initial F18 |

The current absence of a provider path prevents external calls, but this is not sufficient as an explicit production composition guarantee. Approved F18 design should require production composition to select only an unavailable connector until a separate provider/credential/destination contract is approved, and reject test/arbitrary adapters in production.

## 8. Key decisions added — proposed minimal architecture

이 절은 새 canonical decision이 아니라 AO 승인 후보인 최소 설계다.

1. **Single application boundary** — `SourceConnectorRuntimeApplication` 하나가 API-018 admission, lease, invocation, normalization, checkpoint candidate 및 evidence orchestration을 소유한다. HTTP와 API-017 Job trigger는 반드시 이 boundary만 호출한다.
2. **Governance read dependency** — Application은 API-015가 제공하는 authorized Source governance read port를 주입받는다. Console/API-015 repository 또는 UoW를 직접 읽거나 Source governance를 복제하지 않는다.
3. **Existing intake handoff** — successful inbound technical result는 normalized evidence로 `API-003/004` intake boundary에 전달한다. Connector는 Verification/Candidate/Publication authority를 갖지 않는다.
4. **One durable Connector UoW** — connector instance execution view, invocation intent/state, lease, checkpoint, idempotency, normalized result와 append-only evidence를 하나의 transaction boundary로 관리한다. F16 Administration UoW와 F17 Publication UoW의 data ownership은 섞지 않고 검증된 durable SQLite pattern만 재사용한다.
5. **Ordering** — durable invocation intent/lease → durable `EXECUTION_STARTED` → adapter call → normalized result → atomic result/evidence/idempotency/checkpoint commit. `EXECUTION_STARTED` 뒤 authoritative result가 없으면 ambiguous이며 automatic redispatch를 금지한다.
6. **Closed technical outcomes** — business lifecycle를 추가하지 않고 technical result는 approved safe outcome vocabulary로만 제한한다. Exact TypeScript union과 error mapping은 F18-B/C design approval에서 동결한다.
7. **Production unavailable connector** — initial production composition은 unavailable adapter만 허용하고 arbitrary/test adapter injection을 fail closed한다. real network, credential, destination allowlist는 별도 AO 승인 전 `0`이다.
8. **Deterministic test adapter** — test composition에만 no-network adapter를 두고 stable invocation/evidence identity, malformed/timeout/unknown/checkpoint scenarios를 제어한다.
9. **API-019 separation** — API-019는 external contract/version, stable mapping and observation evidence만 소유한다. API-019의 technical `reconcile/suspend`는 contract/mapping lifecycle에 한정하고 Publication/business reconciliation은 API-014/F19에 남긴다.
10. **API-017 trigger only** — API-017은 authorized work를 schedule/identify하지만 lease, admission, connector call, result fabrication 또는 ambiguous retry를 소유하지 않는다.

Recommended execution chain:

```text
HTTP or API-017 Job Trigger
→ Source Connector Runtime/Host Adapter
→ SourceConnectorRuntimeApplication
→ live Source governance + identity/authority admission
→ Durable Connector UoW / lease / invocation journal
→ unavailable production adapter or deterministic test adapter
→ normalized technical evidence
→ atomic result/idempotency/checkpoint commit
→ existing Source/Intake validation handoff
```

## 9. Proposed F18 phase decomposition

| Slice | Scope | Mandatory gate |
|---|---|---|
| F18-B | Source ingestion admission/read ports and closed technical outcome vocabulary | AO confirms exact API-018 closed schema and Source governance read dependency |
| F18-C | Durable Connector UoW, lease, invocation journal, idempotency and ambiguity containment | Bounded persistence/side-effect ordering design reviewed before Production code |
| F18-D | Closed API-018 Application/Runtime/Host/HTTP path | Only approved API-018 logical operations; negative authority/lease tests |
| F18-E | API-019 contract/mapping/observation evidence path | Technical vs business reconciliation split explicitly frozen |
| F18-F | Checkpoint/restart/idempotency hardening | No checkpoint advance on failed/ambiguous result; blind rerun `0` |
| F18-G | API-017 authorized Job trigger integration | API-017 remains trigger only; no second connector runtime |
| F18-H | Cross-layer hardening/final gate | F17 regression, full security/leakage/durability verification |

No real provider implementation is included in any initial slice. Each implementation slice follows RED → minimum GREEN → affected regression and requires separately scoped dependency-audit approval when applicable.

## 10. Open decisions

The following require Architecture Owner confirmation before Production implementation:

1. Whether the frozen logical operation names in Connector Contracts are accepted as the exact API-018 closed operation union, or an approved alias/closed schema document is required.
2. Exact technical result vocabulary for successful, rejected, failed and ambiguous Source connector execution without adding business states.
3. Exact durable lease semantics: acquisition version, expiry clock, renewal availability, release rule and exclusivity scope. Canonical text requires lease/worker scope but does not fully specify these mechanics.
4. Exact checkpoint type and monotonic comparison per connector; a universal numeric ordering cannot be assumed.
5. API-019 `reconcile/suspend` is limited to technical contract/mapping lifecycle; API-014/F19 retains business outcome reconciliation. This split needs explicit approval to avoid ownership collision.
6. Which API-015 safe Source governance read contract is injected into F18 admission without repository/UoW access.
7. Whether initial F18-B includes inbound capture only or also the existing logical outbound operations. F17 already owns Publication execution, so outbound API-018 must remain evidence/technical delivery only.

## 11. Inconsistencies found

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| F18-GAP-001 | RTM marks TRACE-019/020 `VERIFIED`, while executable API-018/019 runtime is absent | Important | Governance trace verification is not runtime completion; add F18 implementation evidence later without changing existing governance status semantics |
| F18-GAP-002 | API-018/019 semantic operations exist, but no executable closed contract/schema | Blocking for implementation | AO approval required before RED implementation tests |
| F18-GAP-003 | API Registry says connector lease/report/checkpoint; exact lease/checkpoint mechanics are incomplete | Blocking for durable design | Approve bounded F18-C design; do not invent distributed locking |
| F18-GAP-004 | API-019 uses `reconcile`, while F19 owns actual reconciliation/recovery | Blocking ownership ambiguity | Limit API-019 to technical evidence/contract mapping; business resolution remains F19 |
| F18-GAP-005 | Legacy Source service and RawSourceStore are process-local; API-015 Source governance is separately durable | Important | Consume API-015 read boundary; add distinct durable Connector execution UoW, not duplicate governance |
| F18-GAP-006 | API-017 implementation is process-local and has no lease/heartbeat/restart host | Important | Use only as trigger after Connector Application exists; durable job remediation outside F18 unless separately approved |
| F18-GAP-007 | Data Model line 32 calls Source status vocabulary pending, while newer API-015 contract freezes uppercase values | Minor historical vocabulary drift | Use current API-015 uppercase lifecycle; treat older lower-case/review terms as legacy aliases |
| F18-GAP-008 | No explicit production connector composition guard, although no adapter exists | Important | Add fail-closed unavailable-only production composition in approved implementation |

No conflict requires changing canonical ownership. The unresolved items require bounded design decisions, not a new API ID or authority grant.

## 12. Validation performed

- Baseline HEAD: `65ed3657fdbe91e66a6746a74214dd5e6c4bbd3f`.
- Main workspace was clean before isolated worktree creation.
- Isolated branch/worktree: `codex/f18-source-connector-runtime`.
- Runtime: Node.js `v24.18.0`; pnpm `11.9.0`.
- Baseline regression: `832/832 PASS`.
- Targeted source/code search confirmed no API-018/API-019 production implementation and only one connector-named production file, the F17 Publication-specific evidence store.
- No network or dependency audit was executed; F18-A does not have audit authorization and made no dependency change.
- Production source changes: `0`.

## 13. Known limitations

- This is a static architecture/code inventory, not executable API-018/019 proof.
- No physical Connector persistence schema, provider contract, credential model, destination policy or real network behavior is approved here.
- No F19 reconciliation/recovery workflow, F20 Console, F21 observability platform or later phase work was started.
- F17 Publication behavior and F16 Administration behavior were not modified.

## 14. Next brief prerequisites

Implementation readiness is `BLOCKED_PENDING_AO_REVIEW`.

Recommended Architecture Owner decision:

```text
APPROVE_F18_SOURCE_CONNECTOR_RUNTIME_DESIGN
```

Approval should explicitly accept the single Application boundary, API-015 authorized Source governance read dependency, durable Connector UoW/ordering, technical-only API-019 reconciliation split, API-017 trigger-only role, unavailable-only Production adapter and the open-decision resolutions in Section 10. Otherwise issue:

```text
BLOCK_F18_SOURCE_CONNECTOR_RUNTIME_DESIGN
```

After the decision, begin only F18-B. Do not start F18-C or later slices implicitly.
