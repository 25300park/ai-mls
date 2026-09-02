# F19-A Reconciliation / Recovery / Retry Canonical Inventory & Gap Report

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | BLOCKED |
| Main HEAD | `7ced149aeef2dd63a70d859f1fc05ca022f8976d` |
| Scope | F19-A inventory/design only |
| Production Changes | 0 |
| Dependency / Lockfile Changes | 0 |
| Commit | NOT_CREATED |
| Push | NOT_PERFORMED |

## 1. Objective

F17/F18 완료 기준선에서 reconciliation, recovery, retry의 canonical 의미, identity, authority, evidence, durability와 executable boundary를 대조한다. 이 보고서는 새 API operation, aggregate, persistence schema 또는 authority를 승인하지 않는다. F19-B 이후 Production 구현은 시작하지 않았다.

결론은 다음과 같다.

- Publication aggregate에는 durable `ReconciliationCase.id`와 immutable case lineage가 존재한다.
- 이 identity를 Connector ambiguity 또는 API-019 conflict의 F19-wide case identity로 사용하는 계약은 없다.
- Publication resolution과 API-019 technical reconciliation에는 각각 closed vocabulary가 있으나, cross-domain business reconciliation 및 recovery execution을 완결하는 단일 closed vocabulary는 없다.
- canonical workflow는 Recover가 새 recovery identity를 사용하고 원 command를 replay하지 않도록 요구하지만, `recoveryId`/`recoveryAttemptId`와 original ambiguity binding을 닫힌 계약으로 정의하지 않는다.
- 따라서 F19 설계는 7개의 AO blocker가 해소되기 전 승인할 수 없다.

## 2. Canonical sources and precedence

검토한 authoritative source는 다음과 같다.

- [Decision Register](../00_DECISION_REGISTER.md): `DEC-103`~`DEC-105`, `DEC-108`, `DEC-110`, `DEC-111`.
- [API Registry](../00_API_REGISTRY.md): `API-014`, `API-016`~`API-019`, API-014 reconciliation/evidence boundary.
- [Workflow Registry](../00_WORKFLOW_REGISTRY.md): `WF-010`~`WF-012`, `WFP-005`~`WFP-008`, `CMD-WF-003`~`CMD-WF-006`.
- [Security Registry](../00_SECURITY_REGISTRY.md): `SEC-001/002/004/010/011/021/022/028/032`, reconciliation SoD.
- [Operations Registry](../00_OPERATIONS_REGISTRY.md): `OPS-018`~`OPS-021`, `OPS-025`, `OPS-032`.
- [Publication Workflow](../book-5/10_PUBLICATION_WORKFLOW.md), [Exception and Recovery Workflow](../book-5/12_EXCEPTION_AND_RECOVERY_WORKFLOW.md), [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md).
- [Publication API](../book-6/09_PUBLICATION_API.md), [Background Job Contracts](../book-6/11_BACKGROUND_JOB_CONTRACTS.md), [Connector Contracts](../book-6/12_CONNECTOR_CONTRACTS.md), [External Integration](../book-6/13_EXTERNAL_INTEGRATION.md).
- [F17 Final Gate](F17_FINAL_GATE_REPORT.md), [F17-F Retry](F17_F_FAILURE_RETRY_ELIGIBILITY_IMPLEMENTATION_REPORT.md), [F18 Final Gate](F18_FINAL_GATE_REPORT.md), [F18-F Hardening](F18_F_RESTART_IDEMPOTENCY_AMBIGUITY_HARDENING_IMPLEMENTATION_REPORT.md).
- Current closed contracts and implementations under `modules/publication`, `modules/source`, `apps/api`, and the read-only Admin Console.

Canonical evidence anchors include:

- API Registry line 39: API-014 owns `Publication`, `Delivery Attempt`, and `Reconciliation Case`.
- Workflow Registry lines 34–36: `WF-010`/`WF-012` require independent Resolve/Recover, current authority, SoD, expected version and immutable evidence.
- Workflow Registry lines 63–64: Resolve consumes one open case without hidden redispatch; Recover requires a new recovery identity and does not replay the original command.
- Security Registry line 101: executor/evidence submitter and reconciliation resolver must be separated.
- Decision Register line 173: `DEC-108` requires hybrid deterministic/human evidence resolution, negative evidence, and immutable case lineage.

## 3. Publication reconciliation inventory

### 3.1 Conditions and durable representation

| Condition | Canonical/current representation | Durable behavior |
|---|---|---|
| Provider `UNKNOWN` | `DeliveryOutcome.UNKNOWN`; Publication transitions to `RECONCILIATION_REQUIRED` | Attempt, dispatch state, receipt/evidence, aggregate snapshot and case survive reopen |
| `DISPATCH_STARTED` without authoritative receipt | Recovery disposition is `RECONCILIATION_REQUIRED` | No inference of success/no-effect; blind resend `0` |
| Open case | `ReconciliationCase { id, publicationId, attemptId, origin, status, evidenceRefs }` | Stored inside durable Publication snapshot; duplicate case ID rejected |
| Resolved case | Same case becomes `RESOLVED` with closed `resolution` and `resolvedAt` | Original attempt and prior evidence are preserved; new evidence is appended |

The canonical Publication case identity exists: `ReconciliationCase.id`. It is bound to exactly one Publication and one original `attemptId`. It is not a separate cross-domain aggregate and has no approved binding to a Connector invocation or API-019 mapping conflict.

### 3.2 Operation distinction

| Operation | Owner | Current request/response and path | Authority/evidence/version | Result/external effect |
|---|---|---|---|---|
| `RESOLVE_RECONCILIATION` | API-014 / Publication Reconciler | Closed API-014 command is registered through Application/Runtime/Host. Public HTTP payload validation rejects caller-authored resolution/evidence; trusted internal reconciliation port executes it. | Session-derived human actor, `publication.reconciliation.resolve`, tenant/team/purpose, MFA, SoD, live approval/binding and `expectedAggregateVersion`; trusted immutable evidence required. | Resolves one open case and transitions to the origin-specific confirmed/no-effect state. No provider call and no hidden redispatch. |
| `RECOVER_PUBLICATION` | API-014 / WF-012 | Closed operation exists, but delegates to the same `PublicationReconciliationService` and same input shape as Resolve. HTTP caller-authored conclusion is rejected. | Same current implementation guard and evidence path as Resolve. No distinct recovery identity field. | Current implementation records/resolves a reconciliation decision; it does not execute a new external recovery attempt. Semantic distinction from Resolve is incomplete. |
| `REPUBLISH_PUBLICATION` | API-014 / Publication Owner | Executable Application/Runtime/Host/HTTP lifecycle path. | New approval/authorization, exact binding, live revalidation, SoD, MFA, expected version and idempotency. | May execute an external call through a new command/attempt. It is neither replay nor recovery; `DEC-111` explicitly says it is not retry/successor. |

`ReconciliationResolution` is closed to:

- `EFFECT_CONFIRMED`
- `INITIAL_NO_EFFECT`
- `ACTIVE_ORIGIN_NO_EFFECT`
- `WITHDRAWN_ORIGIN_NO_EFFECT`
- `WITHDRAWAL_CONFIRMED`
- `WITHDRAWAL_NO_EFFECT`

`PublicationRecoveryDecision` is closed to:

- `CONFIRMED`
- `RECOVERED`
- `REJECTED`
- `MANUAL_REVIEW_REQUIRED`
- `NO_ACTION_REQUIRED`

These values cover Publication case disposition, but do not define the identity and execution semantics of a genuinely new recovery action.

### 3.3 Replay, idempotency and restart

- Exact idempotent replay of a completed reconciliation decision returns the durable prior result without a new mutation.
- Same key with a different fingerprint is rejected as `IDEMPOTENCY_CONFLICT`.
- Reconciliation mutation, append-only audit/evidence and idempotency are committed through the durable Publication UoW.
- Reopen restores snapshots, cases, audit, idempotency, execution intents and receipts.
- `DISPATCH_STARTED` without an authoritative receipt remains ambiguous and cannot become retry eligible.

## 4. Connector ambiguity inventory

| Concern | Current canonical implementation | Finding |
|---|---|---|
| Execution start | Durable invocation records `EXECUTION_STARTED` | Present |
| Missing durable result | Reload projects invocation as `AMBIGUOUS` / `RECONCILIATION_REQUIRED` | Present; no blind rerun |
| Exact replay | Trusted access/isolation, durable idempotency lookup, prior final/ambiguous result | Present; connector call and checkpoint mutation `0` |
| Fingerprint conflict | `IDEMPOTENCY_CONFLICT` | Present; prior state preserved |
| Checkpoint | Advanced atomically only from an authoritative successful technical result | Present for normal execution; ambiguous/failed invocation does not advance |
| Lease | Durable scoped lease and invocation linkage | Present |
| Technical evidence | Durable normalized safe result/evidence; raw provider payload prohibited | Present |

No existing canonical API-018 operation was found for:

- marking an ambiguous technical execution reconciled;
- confirming that the external execution occurred;
- confirming that it did not occur;
- authorizing a new invocation after reconciliation; or
- correcting/recovering a checkpoint.

`AdvanceCheckpoint` is internal-only and reads/applies the committed candidate under existing execution invariants. It is not a manual recovery operation and cannot be repurposed without an AO amendment.

## 5. API-019 conflict inventory

API-019 currently provides:

- `RegisterExternalMapping`
- `SubmitProviderObservation`
- `ReconcileIntegrationEvidence`
- `SuspendIntegrationContract`
- `ReadExternalMapping`
- `ReadIntegrationContract`

`ReconcileIntegrationEvidence` performs deterministic technical reconciliation only. Its closed result vocabulary is:

- `CONFIRMED_TECHNICAL_MATCH`
- `NO_CHANGE`
- `UNRESOLVED_CONFLICT`

Unproven conflict returns `UNRESOLVED_CONFLICT` with `F19_HANDOFF_REQUIRED`. Mapping conflicts, observations and reconciliation evidence are append-only and durable. An `ACTIVE` Integration Contract is required for new ingress/mutation; `SUSPENDED` fails closed.

Technical reconciliation ends when existing governed mapping/observation proof can deterministically confirm the technical match. Business reconciliation begins when external evidence cannot determine canonical business truth, authority, recovery action or Publication state. API-019 evidence is supporting evidence and cannot itself resolve Publication truth.

## 6. Reconciliation case identity

**Inventory answer: A. `EXISTING_CANONICAL_CASE_IDENTITY`.**

The approved Publication model defines durable `ReconciliationCase.id`, and `EVT-006` binds an exact Case and Publication aggregate version. This identity is adequate for Publication reconciliation only.

The following scope remains unapproved:

- binding an API-018 `invocationId` ambiguity to a Publication case;
- binding API-019 `mappingId`/`observationId` conflicts to a case;
- representing a connector-only case where no Publication exists;
- defining whether a generic `Exception ID` is a separate aggregate or only workflow evidence.

Therefore the summary classification is `EXISTS`, with an AO blocker for cross-domain linkage rather than for inventing a second case identity.

## 7. Reconciliation decision vocabulary

| Boundary | Exact approved values | Completeness |
|---|---|---|
| Publication case resolution | six `ReconciliationResolution` values listed in section 3 | Complete for existing Publication origins |
| Publication recovery decision evidence | `CONFIRMED`, `RECOVERED`, `REJECTED`, `MANUAL_REVIEW_REQUIRED`, `NO_ACTION_REQUIRED` | Complete for current reconciliation service audit/result |
| Connector execution outcome | `SUCCEEDED`, `FAILED`, `UNKNOWN`; projected ambiguity uses `AMBIGUOUS` | Complete for technical execution result, not reconciliation disposition |
| API-019 technical reconciliation | `CONFIRMED_TECHNICAL_MATCH`, `NO_CHANGE`, `UNRESOLVED_CONFLICT` | Complete for mapping evidence only |
| Cross-domain recovery decision | No exact closed values connecting connector fact, business truth and authorized recovery | Incomplete |

There is no approved exact value for a failed human/business reconciliation disposition distinct from ongoing unresolved/manual-review state, and no connector reconciliation operation consumes a closed executed/not-executed decision. Summary: `INCOMPLETE`; AO amendment required.

## 8. Recovery identity

Canonical workflow requires a **new recovery identity** and prohibits replay of the original command. Current Publication retry/republish execution already requires a new `attempt.id` and `commandId`; Connector new execution requires a new `invocationId`.

However, no closed F19 contract defines:

- `recoveryId` or `recoveryAttemptId`;
- binding from the original ambiguous Publication attempt/Connector invocation to a recovery decision;
- binding from that decision to a new recovery execution attempt/invocation;
- recovery idempotency identity across API-014/API-018/API-019.

Exact answer: genuinely new recovery execution must have a new identity, but the canonical identity shape and bindings are `INCOMPLETE`. It must not reuse the original ambiguous attempt/invocation identity.

## 9. Retry / replay / recovery matrix

| Action | Same identity? | Current authority revalidated? | New external execution? | New attempt identity? | Allowed after ambiguity? | Idempotency / owner |
|---|---|---|---|---|---|---|
| Replay | Yes | Trusted access/isolation only; no new execution admission | No | No | Returns prior final or ambiguity | Same fingerprint returns prior result; API-014/API-018 owner |
| Retry | New attempt; same business intent | Yes, including approval/target/source as applicable | Possible | Yes | No while ambiguity is unresolved | Approved retry policy + new attempt; API-014 or API-017 technical scheduling context |
| Republish | New command/attempt | Yes, new authorization and exact binding | Possible | Yes | Only after canonical state permits; not an ambiguity shortcut | API-014; not retry/recovery |
| Reconciliation | Existing case and original attempt binding | Independent resolver authority | No | No | It is the ambiguity-resolution path | Decision idempotency; API-014 business / API-019 technical evidence |
| Recovery | New recovery identity required | Yes, current authority/SoD/evidence | May be possible after resolution | Yes if effect-producing | Only after ambiguity is resolved and a recovery plan is authorized | F19/WF-012; exact contract missing |
| New Connector Invocation | New `invocationId` | Yes, current Source/Connector/contract admission | Yes | Yes | No while prior external effect remains unresolved | Durable connector idempotency; API-018 |

Invariant: `replay != retry != recovery != republish`.

## 10. Authority inventory

| Activity | Required current authority | Finding |
|---|---|---|
| Reconciliation read | Trusted session/service identity, tenant/team/scope, purpose, concealment; audit actor fields require restricted audit capability | Existing Publication/UI-033/API-016-style safe reads are executable |
| Publication reconciliation decision | Human resolver, `publication.reconciliation.resolve`, MFA, tenant/team/purpose, SoD, live approval/exact binding, expected version and trusted evidence | Implemented for existing internal decision path |
| Publication recovery authorization | WF-012 says current authority, SoD and immutable recovery evidence | Exact role/capability and separate recovery identity are not closed |
| Recovery execution | Fresh authority, approval, target/source/contract eligibility, expected version; original command not replayed | No distinct executable F19 recovery path |
| Republish | `publication.republish.begin`, MFA/SoD, live approval, target/channel/policy/version | Existing API-014 path complete |
| New connector invocation after resolution | Trusted service/job identity, tenant/scope/purpose, active Source/Connector/Integration Contract, version and binding | Normal new-invocation admission exists; the reconciliation-to-new-invocation authorization handoff does not |

Mutation authority for the cross-domain recovery transition is not explicitly defined. This is an `AO_BLOCKER`. Break-glass, AI, Connector and scheduler cannot supply business resolution authority.

## 11. Evidence classification

| Evidence | Classification | Reason |
|---|---|---|
| Publication aggregate state/version and open case | Authoritative | Canonical aggregate truth |
| Immutable execution receipt with normalized outcome | Authoritative technical fact after validation | Durable and bound to execution identity; still interpreted by API-014 |
| Reconciliation decision recorded by independent authorized resolver | Authoritative business decision | Closed resolution, version and audit requirements |
| Connector invocation intent/start/result | Supporting technical evidence | Proves local boundary/history; start without result cannot prove external effect |
| Safe provider external reference | Supporting | Reference only; not raw payload or business truth |
| API-019 observation/mapping/conflict evidence | Supporting | External response remains evidence until core validation |
| Checkpoint/current candidate | Supporting technical state | Cannot prove Publication state or authorize recovery |
| Current target/source/Integration Contract/approval state | Authoritative admission prerequisite | Current governed state controls any new execution |
| Audit/Event evidence | Authoritative history of recorded action, not independent proof of external outcome | Append-only provenance |
| Caller-authored category, conclusion or evidence reference | Non-authoritative | Cannot create a canonical decision or elevate trust |

## 12. Checkpoint recovery

No canonical rule authorizes reconciliation to arbitrarily advance or manually set a checkpoint. Current safe rule is:

- only an authoritative successful connector result may produce a checkpoint candidate;
- normal durable completion applies the candidate atomically with result/evidence;
- failed or ambiguous execution leaves checkpoint unchanged;
- exact replay does not advance it again;
- a new authorized execution may produce a new candidate under existing version checks.

Whether proven reconciliation may correct a checkpoint, and what proof/operation would do so, is not explicit. Default: **no arbitrary checkpoint advancement**. `AdvanceCheckpoint` must remain internal-only and is not a recovery escape hatch.

## 13. Suspension interaction

| Condition | Reconciliation read | Decision/evidence resolution | New recovery execution |
|---|---|---|---|
| Publication suspended | Safe read remains possible under access controls | Existing case may be inspected; exact mutation rule depends on Publication command guard | Must not reactivate automatically; effect-producing command requires canonical allowed state and fresh authority |
| Source inactive/suspended | Prior durable history may be read under access controls | Technical/business evidence can be reviewed | New Connector invocation blocked by live admission |
| Publication Target inactive/suspended | Read/evidence review allowed | Does not restore Target | New Publication effect blocked |
| Integration Contract `SUSPENDED` | Authorized safe query allowed | New API-019 evidence mutation is blocked by active-contract guard | New integration ingress/execution blocked |
| Connector unavailable | Prior history readable | May remain unresolved/manual review | No external execution |

Read access to prior history is not authority to execute again. No reviewed contract permits automatic reactivation.

## 14. Nested ambiguity

Current stores can preserve an original Publication attempt/case and separate Connector invocation/result histories. They cannot canonically express the complete chain:

```text
original ambiguous attempt
→ reconciliation decision
→ authorized recovery identity
→ new recovery attempt/invocation
→ second ambiguity
→ second case linked to parent recovery
```

The missing recovery identity and cross-domain linkage make parent/child case lineage ambiguous. Reusing or overwriting the original case/attempt would violate immutable history. Summary: `GAP`; AO amendment required.

## 15. Durability inventory

| Concept | Store / behavior | Status |
|---|---|---|
| Publication aggregate, attempts, cases | Durable Publication SQLite UoW; optimistic version | PASS |
| Publication audit/idempotency/events/execution intents/receipts | Durable append-only tables/triggers and atomic transaction | PASS |
| Connector lease/invocation/result/checkpoint/idempotency | Durable Connector SQLite persistence; restart projection | PASS |
| API-019 mappings/observations/conflict evidence/idempotency | Durable external-integration SQLite store; evidence/observations append-only | PASS |
| F19 recovery decision and recovery identity linkage | No approved cross-boundary durable record | GAP |
| Nested recovery ambiguity lineage | No approved parent/child recovery binding | GAP |

Existing production-authoritative state does not rely solely on process-local storage. The missing F19 concepts cannot be claimed durable because their canonical identity has not been approved.

## 16. API / runtime inventory

| Operation | API | Kind | Application | Runtime/Host | HTTP | Schema | Executability |
|---|---|---|---|---|---|---|---|
| `RESOLVE_RECONCILIATION` | API-014 | Command | Yes, trusted reconciliation service | Registered | Public payload rejected | Closed internal input/result | Internal trusted path only |
| `RECOVER_PUBLICATION` | API-014 | Command | Yes, same service path as Resolve | Registered | Public payload rejected | Same closed input/result | Internal trusted resolution path; no distinct recovery execution |
| `REPUBLISH_PUBLICATION` | API-014 | Command | Yes | Yes | Yes | Closed | Complete |
| `GET_PUBLICATION_RECOVERY_VIEW` | API-014 | Query | Yes | Yes | Yes | Closed safe view | Complete |
| `GET_PUBLICATION_AUDIT_VIEW` | API-014/API-016-aligned read | Query | Yes | Yes | Yes | Closed safe view | Complete |
| Connector exact replay/ambiguity | API-018 application coordination | Internal execution behavior | Yes | Used by API-018 runtime | No dedicated recovery operation | Existing invocation contract | Complete for replay containment only |
| `AdvanceCheckpoint` | API-018 | Internal Command | Yes | Registered internal | Explicitly excluded from HTTP | Closed | Internal normal-execution boundary only |
| `ReconcileIntegrationEvidence` | API-019 | Technical Command | Yes | Yes | HTTP commands intentionally disallowed | Closed | Internal technical reconciliation only |
| `ReadExternalMapping` / `ReadIntegrationContract` | API-019 | Query | Yes | Yes | Yes | Closed | Complete |
| API-016 generic audit/history | API-016 | Restricted Query/Export | Existing admin/audit and Publication audit reads | Partial by domain | Existing safe reads | Existing contracts | Evidence query available; no F19 case queue |

There is no approved operation for Connector ambiguity resolution, recovery authorization, recovery execution handoff, checkpoint correction, or a cross-domain reconciliation queue. Runtime/HTTP summary: `GAP`.

## 17. API-017 involvement

Classification: `F19_API_017_NOT_REQUIRED` for the minimum synchronous F19 decision/execution architecture.

Evidence:

- API-017 may submit/read/cancel jobs and retry only as an authorized successor.
- It may later discover unresolved cases, schedule deterministic evidence checks, or schedule an already-authorized recovery.
- It may not approve reconciliation, choose business truth, authorize recovery, or blindly retry.
- Existing API-014/API-018/API-019 boundaries can host the minimum synchronous decision and execution handoff without making API-017 authoritative.

API-017 integration is therefore `DEFERRED` to F19-G unless a later approved operational requirement makes asynchronous scheduling mandatory.

## 18. F20 Console boundary

| Capability | Current state | Classification |
|---|---|---|
| Recovery detail/evidence summary | `UI-033` via `GET_PUBLICATION_RECOVERY_VIEW` | Canonical, executable, read-only |
| Publication audit view | `UI-035` via `GET_PUBLICATION_AUDIT_VIEW` | Canonical, executable, read-only |
| Reconciliation queue | No closed read model found | Missing / deferred to F20 |
| Recovery action | Action names may appear in safe view metadata, but Console has no mutation path | Deferred to F20 |
| Connector/API-019 case detail | No unified F19 read DTO | Missing / deferred |

F20 Console Boundary is `CLEAR`: F19-A does not add Console mutation. Any future Console action must consume a separately approved backend command and must never author authority or evidence conclusions.

## 19. Provider / network state

| Item | Count |
|---|---:|
| Real provider activation | 0 |
| Production credentials | 0 |
| Approved runtime external destinations | 0 |
| External network execution activated by F19-A | 0 |

No provider, credential, dependency or network configuration was changed.

## 20. Consolidated gap matrix

| Area | Canonical definition | Current implementation | Durable | Executable | Exact gap | Owner | AO decision required |
|---|---|---|---|---|---|---|---|
| Reconciliation case identity | Publication `ReconciliationCase.id` | Embedded in Publication snapshot | Yes | Yes | No cross-domain Connector/API-019 case binding | API-014/F19 | Yes |
| Decision vocabulary | Publication and API-019 closed subsets | Separate subsets implemented | Yes | Partial | No closed cross-domain recovery disposition | F19/AO | Yes |
| `RESOLVE_RECONCILIATION` | Evidence-backed independent resolution | Trusted internal path | Yes | Internal only | HTTP prohibition is intentional; F19 trigger/read handoff not closed | API-014 | Yes for F19 exposure |
| `RECOVER_PUBLICATION` | New recovery identity, current authority | Same service/input as Resolve | Yes for current decision | Partial | No distinct recovery execution semantics/identity | API-014/F19 | Yes |
| `REPUBLISH_PUBLICATION` | New authorization/command/attempt; not retry | Complete path | Yes | Yes | None for F19; must not be used as generic recovery | API-014 | No |
| Connector ambiguity | Preserve ambiguous invocation; no blind rerun | Complete containment/replay | Yes | Yes | No resolution operation | API-018/F19 | Yes |
| New connector invocation after reconciliation | Fresh live admission and new identity | Normal new-invocation path exists | Yes | Yes in isolation | No authorized decision-to-invocation handoff | API-018/F19 | Yes |
| Recovery identity | New identity; original not replayed | Attempt/invocation IDs exist separately | Partial | No end-to-end path | Missing exact shape/linkage | F19 | Yes |
| Recovery idempotency | Required and durable | Per-domain idempotency exists | Yes | Partial | No cross-boundary recovery key/binding | F19 | Yes |
| Evidence model | Immutable case/attempt/observation/audit | Per-domain evidence exists | Yes | Yes | Authority ranking/handoff schema incomplete | API-014/018/019/F19 | Yes |
| Checkpoint recovery | No arbitrary advance | Normal success-only advance | Yes | Internal only | No approved correction rule/operation | API-018/F19 | Yes |
| Mapping conflict | No silent remap; append conflict evidence | Implemented | Yes | Yes internal | Business disposition handed off but not modeled | API-019/F19 | Yes |
| Observation conflict | External evidence is non-authoritative | Implemented | Yes | Yes internal | No F19 business decision binding | API-019/F19 | Yes |
| Suspension | Read history; no reactivation | Fail-closed new mutation/execution | Yes | Yes | Exact resolve-vs-execute matrix needs F19 contract | Domain owners/F19 | Yes |
| Nested ambiguity | Immutable original and new recovery identity | Separate stores only | Partial | No | Parent/child recovery lineage missing | F19 | Yes |
| API-017 | Optional authorized scheduler | Job boundary exists separately | Not required for minimum | Deferred | Must remain non-authoritative | API-017 | No |
| Runtime/HTTP | Closed API-owned paths | Existing pieces, no F19 orchestration | Partial | Partial | Missing approved F19 handoff schemas | API-014/018/019/F19 | Yes |
| Console/F20 | Read-only UI-033/UI-035 | Executable read views | Read source durable | Yes | Queue/action/detail beyond Publication missing | F20 | Later |

## 21. Ownership matrix

| Responsibility | API-014 | API-016 | API-017 | API-018 | API-019 | F19 |
|---|---|---|---|---|---|---|
| Business reconciliation | Owns Publication decision/state | Queries evidence | No | Supplies technical evidence only | Supplies technical evidence only | Coordinates approved cross-boundary flow |
| Technical reconciliation | Interprets for Publication | Queries history | May schedule | Connector execution history | Owns mapping/observation technical match | Receives unresolved handoff |
| Publication recovery | Owns command/state | Audit/history | Optional scheduling | Executes bounded technical work only | Evidence only | Defines recovery plan/identity/handoff after AO approval |
| Connector technical execution | No | Query only | Trigger only | Owns | Contract/evidence constraint | No direct adapter ownership |
| Evidence query | Publication safe views | Owns restricted history/export | Job status only | Technical status | Mapping/contract reads | Case-centric composition only after approval |
| Background scheduling | No | No | Owns | No | No | Requests only already-authorized work |
| External mapping evidence | Consumes as evidence | Queries | No | Observation transport | Owns | Business disposition only |
| Checkpoint | No | History only | No | Owns normal versioned checkpoint | No | Cannot mutate arbitrarily |
| Recovery authorization | Publication command guard | Evidence | Cannot grant | Cannot grant business authority | Cannot grant business authority | Independent resolver/current domain authority |
| Recovery orchestration | Executes approved Publication command | Records/reads evidence | Optional trigger | Executes approved new invocation | Supplies contract/evidence | Owns bounded orchestration, not duplicate persistence |

## 22. AO blockers

| ID | Blocker | Required decision |
|---|---|---|
| F19-AO-001 | Publication case identity has no approved Connector/API-019 linkage or connector-only case rule | Define whether F19 reuses Publication case with typed external references or permits a separately governed case identity; do not create silently |
| F19-AO-002 | Cross-domain business reconciliation decision vocabulary is incomplete | Approve exact closed decisions and terminal/unresolved dispositions |
| F19-AO-003 | New recovery identity shape and original-case/attempt/invocation binding are undefined | Approve recovery identity, parent linkage and idempotency identity |
| F19-AO-004 | Recovery authorization/capability and SoD for cross-domain mutation are incomplete | Approve resolver, authorizer, executor separation and exact live prerequisites |
| F19-AO-005 | Connector occurred/not-occurred confirmation, new-invocation authorization and checkpoint recovery semantics have no operation contract | Approve semantics/ownership before any API exposure; no implicit API addition |
| F19-AO-006 | Nested ambiguity cannot be represented end-to-end without unapproved lineage | Approve parent/child case and second-attempt preservation rules |
| F19-AO-007 | Closed F19 handoff/read/command schemas and Runtime/HTTP exposure are absent | Approve reuse/extension of existing API-014/018/019 surfaces; no new API ID by inference |

AO Blockers: `7`.

## 23. Proposed F19 decomposition

| Phase | Scope | Classification |
|---|---|---|
| F19-B | Reconciliation Case / Evidence Boundary | `BLOCKED_PENDING_AO` |
| F19-C | Publication Reconciliation / Recovery semantic separation | `BLOCKED_PENDING_AO` |
| F19-D | Connector Ambiguity / Recovery | `BLOCKED_PENDING_AO` |
| F19-E | Mapping / Observation Business Reconciliation | `BLOCKED_PENDING_AO` |
| F19-F | Recovery Idempotency / Nested Ambiguity | `BLOCKED_PENDING_AO` |
| F19-G | Runtime / HTTP integration; API-017 scheduling only if later required | `DEFERRED` |
| F19-H | Final integration / hardening | `DEFERRED` |

No implementation phase is `REQUIRED` for immediate start until the seven blockers are resolved. F19-G API-017 work is not required for the minimum synchronous architecture.

## 24. Recommended minimal architecture

This is an AO review candidate, not an approved design.

1. Reuse the durable Publication, Connector and API-019 stores; do not create a duplicate recovery database or generic retry engine.
2. Keep API-014 as Publication business truth/decision owner, API-018 as bounded technical execution owner, API-019 as external identity/mapping/evidence owner, API-016 as history owner, and API-017 as optional scheduler only.
3. Bind immutable original attempt/invocation and evidence to an AO-approved case/linkage contract.
4. Commit a reconciliation decision separately from any new external execution. Resolution itself performs no provider call.
5. An effect-producing recovery requires fresh current authority, approval/target/source/contract checks, expected version, a new recovery/attempt/invocation identity and durable idempotency.
6. If a recovery attempt becomes ambiguous, preserve the original history and create a separately linked unresolved case; never overwrite or blindly resend.
7. Keep checkpoint unchanged unless an approved authoritative technical result produces a version-valid candidate.
8. Fail closed when evidence, identity, authority or external outcome is unresolved.

## 25. Validation

| Check | Result |
|---|---|
| Baseline verification | Relied on approved F18 Final Gate evidence: `909/909 PASS`; no source touched and repository policy permits evidence reuse |
| Production source changes | `0` |
| Dependency/lockfile changes | `0` |
| Real provider/network/credential changes | `0` |
| F19 Production implementation | `NOT_STARTED` |
| F20 implementation | `NOT_STARTED` |
| Main workspace | `clean` at approved baseline |
| Isolated branch | `codex/f19-reconciliation-recovery` |

`git diff --check` and final worktree status are recorded after report creation.

## 26. Required report summary

| Required field | Result |
|---|---|
| Status | `BLOCKED` |
| Main HEAD | `7ced149aeef2dd63a70d859f1fc05ca022f8976d` |
| Canonical Case Identity | `EXISTS` — Publication scope only; cross-domain linkage blocked |
| Decision Vocabulary | `INCOMPLETE` |
| Recovery Identity | `INCOMPLETE` |
| Recovery Authority | `INCOMPLETE` |
| Publication Recovery Semantics | `GAP` |
| Connector Recovery Semantics | `GAP` |
| Mapping/Observation Reconciliation | `GAP` — technical PASS, business handoff missing |
| Checkpoint Recovery | `GAP` |
| Nested Ambiguity | `GAP` |
| API-017 | `NOT_REQUIRED` |
| Runtime/HTTP | `GAP` |
| F20 Console Boundary | `CLEAR` |
| Durability | `GAP` — existing stores PASS, missing F19 linkage not durable |
| Security/Authority | `GAP` |
| Real Provider / Network / Credentials | `0` |
| Production Changes | `0` |
| Dependency / Lockfile Changes | `0` |
| Baseline Verification | F18 Final Gate evidence `909/909 PASS` reused |
| git diff --check | `PASS` |
| Main | `clean` |
| Worktree | `dirty` — this uncommitted report only |
| Commit | `NOT_CREATED` |
| Push | `NOT_PERFORMED` |
| Recommended F19 decomposition | F19-B~F blocked pending AO; F19-G/H deferred |
| AO Blockers | `7` |
| Final Recommendation | `BLOCK_F19_RECONCILIATION_RECOVERY_DESIGN` |
| Report | `docs/reviews/F19_A_RECONCILIATION_RECOVERY_RETRY_CANONICAL_INVENTORY_GAP_REPORT.md` |

## 27. Final recommendation and stop gate

```text
Final Recommendation:
BLOCK_F19_RECONCILIATION_RECOVERY_DESIGN
```

Existing containment, durability and replay protections are sound, but they do not close the F19 case-linkage, recovery-identity, authority, connector recovery, nested ambiguity and executable handoff contracts. Implementing those gaps by inference would create new authority and operation semantics.

F19-B is `NOT_STARTED`. Architecture Owner must resolve the listed AO blockers and issue a new explicit design decision before Production implementation.
