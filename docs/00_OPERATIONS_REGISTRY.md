# AI-MLS Canonical Operations Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-052 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Operations Owner / Architecture Owner / Security Owner |
| 기준일 | 2026-07-26 |
| 적용 범위 | Phase 11-9 Operations Registry Alignment |
| Frozen identity source | [Book 9 Operation Registry](book-9/14_OPERATION_REGISTRY.md) |

## 1. 목적과 governance boundary

이 문서는 frozen Book 9의 `OPS-001`~`OPS-032` identity와 semantic meaning을 변경하지 않고, Operation classification, authority, dependency, recovery, monitoring, audit, validation 및 Phase 11-1~11-8 canonical Registry 연결을 정렬하는 review candidate다.

- Operation은 Business Authority, Approval, Permission, Verification, Publication 또는 Policy Override를 생성하지 않는다.
- Operation은 canonical Aggregate, Workflow, API, Security, Publication, Projection와 Event guard를 우회하지 않는다.
- Recovery/Replay/Rebuild는 derived 또는 recovered state를 검증할 뿐 Business Decision을 생성하거나 stale authority를 복원하지 않는다.
- Monitoring/Health/Drift Detection은 read-only signal과 audit evidence만 생성한다.
- 이 문서는 automation, CI/CD, monitoring tool, backup system, physical runbook 또는 FEAT-015를 구현하지 않는다.

## 2. Blocking vocabulary conflict

현재 Brief가 제시한 `OPS-001 Deployment`~`OPS-012 Incident Response`는 frozen Book 9의 동일 ID와 12/12 모두 다른 의미다. 예를 들어 frozen `OPS-001`은 `Logical tier/trust-boundary isolation`, frozen `OPS-012`는 `Component/dependency health monitoring`이다. Test Registry도 `OPS-001`~`OPS-032`의 frozen identity를 사용한다.

따라서 이 candidate는 기존 ID를 보존하며 요청된 12개 capability label을 별도 crosswalk로만 평가한다. Architecture Owner가 successor decision/change control 없이 동일 `OPS-*`를 재정의할 수 없으므로 alignment approval은 보류한다.

## 3. Canonical operation catalog

약어: `DR`=[Decision Register](00_DECISION_REGISTER.md), `RTM`=[Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md), `PR`=[Publication Registry](00_PUBLICATION_REGISTRY.md), `WR`=[Workflow Registry](00_WORKFLOW_REGISTRY.md), `AR`=[API Registry](00_API_REGISTRY.md), `SR`=[Security Registry](00_SECURITY_REGISTRY.md), `PJR`=[Projection Registry](00_PROJECTION_REGISTRY.md), `ER`=[Event Registry](00_EVENT_REGISTRY.md).

| Operation ID | Operation Name | Operation Category | Purpose | Trigger | Authority | Related Workflow | Related API | Related Registry | Related Security Control | Audit Requirement | Validation Rule | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OPS-001 | Logical tier/trust-boundary isolation | Deployment | preserve logical isolation and authority gates | architecture boundary change | Architecture/Operations review only; no business command | WF-001~012 | API-001~019 | DR/RTM/WR/AR/SR | SEC-001/002/006/017/018/026/032 | operator/reviewer, boundary, change, time, result, failure reason | all trust boundaries retain auth, classification and audit | MAPPED |
| OPS-002 | Environment isolation and data boundary | Deployment | prevent cross-environment identity/data/effect leakage | environment creation, promotion or drift | Operations/Security scoped control | WF-001~012 | API-001~019 | DR/RTM/WR/AR/SR | SEC-003/006/013/014/017~023 | operator, environment, data scope, time, result, failure reason | production credentials/data/effects remain isolated | MAPPED |
| OPS-003 | Controlled environment promotion | Deployment | promote immutable candidate through approved gates | approved release promotion | Release execution after independent approval; no business approval | WF-001~012 | API-015~017 | DR/RTM/WR/AR/SR | SEC-010/021/026/033 | operator, candidate, source/target, approval, time, result/failure | candidate identity and all entry/exit evidence match | MAPPED |
| OPS-004 | Versioned configuration lifecycle | Maintenance | govern configuration versions and drift | configuration proposal/change/drift | named Configuration Owner within approved range | WF-001~012 | API-003/015/016/019 | DR/RTM/WR/AR/SR/PR | SEC-001/002/013/015/019/021 | operator, before/after version, change, time, result/failure | schema, range, secret absence, compatibility and rollback validate | MAPPED |
| OPS-005 | Secret/key reference and rotation operations | Maintenance | protect secret/key references and rotation | expiry, compromise, scheduled/event change | Security/Integration scoped authority; secret value never recorded | WF-001~012 | API-001/015/018/019 | DR/RTM/WR/AR/SR/PR | SEC-004~009/017/019~021 | operator, reference/version, reason, time, result/failure | least privilege, rotation/revocation and log secrecy validate | MAPPED |
| OPS-006 | Governed feature flag lifecycle | Maintenance | apply bounded flags without bypassing controls | approved flag change or expiry | Domain/Operations configuration authority only | WF-001~012 | API-015/016 | DR/RTM/WR/AR/SR | SEC-001/002/010/021/026 | operator, flag/version/scope, reason, time, result/failure | expiry, prerequisites, rollback and no-bypass rule validate | MAPPED |
| OPS-007 | Immutable release candidate and evidence | Deployment | bind release artifact to immutable evidence | release candidate creation | Release Owner prepares; cannot self-approve high risk | WF-001~012 | API-015~017 | DR/RTM/WR/AR/SR | SEC-021/022/026 | actor, candidate/checksum, evidence, time, result/failure | manifest, included change and verification completeness validate | MAPPED |
| OPS-008 | Independent release approval gate | Operational Governance | prevent self-approved or unreviewed promotion | candidate ready for production | independent Business/Security/Release approval by risk | WF-001~012 | API-015/016 | DR/RTM/WR/AR/SR/PR | SEC-004/010/011/021/033 | requester/approver, decision/reason, time, result/failure | SoD, current evidence and affected specialist approvals validate | MAPPED |
| OPS-009 | Rollback/forward-recovery readiness | Recovery | ensure reversible or compensating release response | every release/change and failure | Release/Operations recovery authority; no business state fabrication | WF-010~012 | API-014~017 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-021/027~030 | operator, trigger, selected strategy, time, result/failure | compatibility, data/authority integrity and reconciliation validate | MAPPED |
| OPS-010 | Daily service and workflow review | Monitoring | review health, backlog, expiry and failure posture | daily schedule or incident signal | read/triage/escalation only | WF-001~012 | API-011~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-021/023/024/027 | operator, scope, observation, time, result/failure | stale/unknown/failed conditions have owner and disposition | MAPPED |
| OPS-011 | Periodic maintenance and governance review | Maintenance | review retention, access, configuration and overdue risk | weekly/monthly schedule | read, validate and approved maintenance only | WF-001~012 | API-015~017 | DR/RTM/WR/AR/SR/ER | SEC-016/019/020/022/033 | operator, review period, findings, time, result/failure | legal hold, expiry, ownership and remediation validate | MAPPED |
| OPS-012 | Component/dependency health monitoring | Monitoring | observe service and dependency availability/integrity | continuous signal | read-only monitoring; no state transition | WF-001~012 | API-001~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-017/021/023/024/032 | monitor/operator, component, signal time, result/failure | health result cannot imply business completion or authority | MAPPED |
| OPS-013 | Technical telemetry and correlation | Monitoring | correlate request/job/error/event evidence | continuous telemetry | read-only observe/correlate | WF-001~012 | API-001~019 | DR/RTM/WR/AR/SR/PJR/ER | SEC-007/021~024 | principal/service, correlation, time, result/failure | privacy minimization and immutable correlation validate | MAPPED |
| OPS-014 | Business workflow guardrail monitoring | Monitoring | detect blocked/stale/unsafe workflow conditions | continuous and daily review | read-only signal; qualified business authority remains separate | WF-001~012 | API-004/011~016 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-011/013/015/021/024 | operator, guardrail, state/version, time, result/failure | canonical state and authority source are used; no projection authority | MAPPED |
| OPS-015 | Actionable alert and escalation | Monitoring | route actionable risk to named owner | threshold/event breach | alert, contain and escalate only | WF-011/012 | API-001/002/014~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-024/025/027 | detector/operator, severity, escalation, time, result/failure | owner, urgency, dedup, runbook and closure evidence validate | MAPPED |
| OPS-016 | Tiered backup/checkpoint creation | Maintenance | create protected recovery points by data tier | tier schedule or approved event | Data/Backup scoped operation; no restore/business authority | WF-001~012 | API-015~017 | DR/RTM/PR/WR/AR/SR/ER | SEC-013/016~021/029 | operator/service, backup ID/scope, time, result/failure | consistency, encryption, retention/legal hold and completeness validate | MAPPED |
| OPS-017 | Backup integrity and completion verification | Validation | distinguish verified backup from attempted backup | every backup/checkpoint | Data/Backup + Security validation authority | WF-012 | API-016/017 | DR/RTM/WR/AR/SR/ER | SEC-018/019/021/022/029 | verifier, backup ID, checks, time, result/failure | completeness, authenticity, checksum and key availability validate | MAPPED |
| OPS-018 | Authorized restore/recovery testing | Recovery | validate recoverability in isolated scope | approved test or incident recovery | Operations/Data/Security dual control | WF-011/012 | API-011~017 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-004/010/016/021/028~030 | operator/approver, restore point, time, result/failure | restored data, authority, workflow and external state revalidate | MAPPED |
| OPS-019 | Disaster recovery activation and validation | Recovery | recover prioritized consistency sets after major disruption | declared DR incident | DR/Incident activation plus dual authorization | WF-011/012 | API-001/002/011~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-025/027~030 | commander/operators, incident, point, time, result/failure | containment, tier order, RPO/RTO, authority and reconciliation validate | MAPPED |
| OPS-020 | Business continuity/manual operation | Recovery | preserve bounded work safely during disruption | continuity mode activation | continuity coordination only; no offline approval/publication | WF-001~012 | API-004/009/011/016 | DR/RTM/PR/WR/AR/SR | SEC-001/002/011/013~015/021 | operator, temporary record/scope, time, result/failure | backlog, provenance, privacy and post-recovery reconciliation validate | MAPPED |
| OPS-021 | Safe degraded-mode control | Recovery | fail closed or provide bounded safe mode | dependency/service failure | Operations containment; no authority upgrade | WF-001~012 | API-001~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-001/002/011/025/027/031/032 | operator/service, mode/scope, time, result/failure | prohibited writes/effects denied and freshness displayed | MAPPED |
| OPS-022 | Capacity forecast and headroom review | Monitoring | identify bounded capacity risk without weakening controls | weekly/monthly trend or planned change | read/forecast/recommend only | WF-001~012 | API-004/010/014/016~019 | DR/RTM/WR/AR/SR/PJR | SEC-018/023/026/029/031/032 | analyst/operator, window, forecast, time, result/failure | data source, assumptions, risk and remediation validate | MAPPED |
| OPS-023 | Performance/backpressure validation | Validation | verify load handling and safe degradation | continuous measurement and release gate | validate/contain only; cannot bypass guardrails | WF-001~012 | API-001~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-001/002/024/026/031/032 | operator, workload/version, time, result/failure | latency/error/backlog plus integrity/authority remain within policy | MAPPED |
| OPS-024 | SLI/SLO/error-budget measurement | Monitoring | measure service objectives and hard guardrails | continuous and monthly review | read/measure/escalate only | WF-001~012 | API-001~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-021~024/026 | owner, source/window, time, result/failure | numerator/denominator/exclusions/data gaps and hard guards validate | MAPPED |
| OPS-025 | Incident lifecycle and post-incident review | Recovery | contain, recover, validate and learn from incidents | detected/reported incident | Incident Owner commands containment/recovery only | WF-012 | API-001/002/014~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-024~028 | commander/operator, timeline/actions, time, result/failure | severity, evidence, authority, recovery and corrective actions validate | MAPPED |
| OPS-026 | Normal/standard change lifecycle | Operational Governance | govern planned operational changes | change request | Change Owner within approved class and scope | WF-001~012 | API-015/016 | DR/RTM/WR/AR/SR | SEC-001/002/010/021/026/033 | requester/approver/operator, change, time, result/failure | scope, risk, approval, rollback and post-validation complete | MAPPED |
| OPS-027 | Emergency change and temporary access expiry | Operational Governance | permit bounded emergency containment without bypass | active incident/emergency change | Incident/Security/Change control with expiry | WF-012 | API-001/002/015~017 | DR/RTM/WR/AR/SR/ER | SEC-003~010/021/025/027/033 | requester/approver/operator, reason/expiry, time, result/failure | minimum verification, revocation and retrospective review validate | MAPPED |
| OPS-028 | Least-privileged operational/admin access | Operational Governance | restrict operational and administrative access | each access request/use/recertification | scoped named identity only | WF-001~012 | API-001/002/015/016 | DR/RTM/WR/AR/SR | SEC-001~010/033/034 | principal/session, scope/reason, time, result/failure | MFA, purpose, environment, expiry and recertification validate | MAPPED |
| OPS-029 | Privileged operation audit and evidence review | Operational Governance | make privileged operation evidence reviewable | every privileged/failed action and monthly review | Security/Governance evidence review only | WF-001~012 | API-015~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-012/021~024 | principal, action/target/version, time, result/failure | completeness, integrity, privacy minimization and correlation validate | MAPPED |
| OPS-030 | Operational security/privacy review gate | Validation | block unsafe high-risk operational change | high-risk change and quarterly review | Security/Privacy review; no business approval inheritance | WF-001~012 | API-015~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-011~020/026/031~034 | reviewer, scope/findings, time, result/failure | classification, exposure, secrets, recovery and residual risk validate | MAPPED |
| OPS-031 | External dependency/provider continuity | Monitoring | observe and contain provider/connector dependency risk | continuous and monthly review | read/contain/escalate; no provider-created truth | WF-001~004/009~012 | API-003/004/014/017~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-006/013~015/017/020/023/024/031/032 | operator/service, provider/contract, time, result/failure | health, contract, credential, retry and reconciliation validate | MAPPED |
| OPS-032 | Job/connector retry, reconciliation and isolation | Recovery | recover bounded technical work without replaying authority | failed/unknown/stuck job or connector attempt | scoped technical recovery only | WF-003/006/010~012 | API-014/017~019 | DR/RTM/PR/WR/AR/SR/PJR/ER | SEC-006/011/021/024/025/028/031/032 | operator/service, job/attempt/case, time, result/failure | idempotency, ordering, authority revalidation and no duplicate effect validate | MAPPED |

## 4. Requested capability crosswalk

| Requested label | Requested ID | Frozen Book 9 meaning at that ID | Existing canonical coverage | Alignment result |
|---|---|---|---|---|
| Deployment | none — capability alias only | Logical tier/trust-boundary isolation | OPS-003/007/008/026 plus Deployment Checklist | VERIFIED_ALIAS |
| Rollback | none — capability alias only | Environment isolation and data boundary | OPS-009/025/026 | VERIFIED_ALIAS |
| Backup | none — capability alias only | Controlled environment promotion | OPS-016/017 | VERIFIED_ALIAS |
| Restore | none — capability alias only | Versioned configuration lifecycle | OPS-018/019 | VERIFIED_ALIAS |
| Recovery | none — capability alias only | Secret/key reference and rotation operations | OPS-009/018~021/025/032 | VERIFIED_ALIAS |
| Replay | none — capability alias only | Governed feature flag lifecycle | OPS-018/019/025/032 + EVT-012 | VERIFIED_ALIAS |
| Rebuild | none — capability alias only | Immutable release candidate and evidence | OPS-018/023/025/032 + PRJ rebuild policy | VERIFIED_ALIAS |
| Monitoring | none — capability alias only | Independent release approval gate | OPS-010/012~015/022/024/031 | VERIFIED_ALIAS |
| Health Check | none — capability alias only | Rollback/forward-recovery readiness | OPS-012/013/024/031 | VERIFIED_ALIAS |
| Drift Detection | none — capability alias only | Daily service and workflow review | OPS-004/012~014/023/030 + PRJ drift policy | VERIFIED_ALIAS |
| Validation | none — capability alias only | Periodic maintenance and governance review | OPS-017~019/023/024/030 | VERIFIED_ALIAS |
| Incident Response | none — capability alias only | Component/dependency health monitoring | OPS-015/019/025/027 | VERIFIED_ALIAS |

Semantic capability coverage는 12/12다. Requested label은 frozen `OPS-001`~`OPS-032` identity를 재사용하지 않는 capability alias이며, 기존 canonical coverage로만 연결한다. 따라서 duplicate Operation identity를 생성하지 않는다.

## 5. Operation classification

| Category | Canonical OPS coverage | Boundary |
|---|---|---|
| Deployment | OPS-001~003/007 | architecture, environment, promotion and candidate handling |
| Recovery | OPS-009/018~021/025/032 | rollback, restore, DR, continuity, degraded mode, incident and retry |
| Monitoring | OPS-010/012~015/022/024/031 | read-only health, telemetry, guardrail, alert, capacity and provider observation |
| Validation | OPS-017/023/030 | integrity, performance and security/privacy validation |
| Maintenance | OPS-004~006/011/016 | configuration, secret, flag, periodic review and backup creation |
| Operational Governance | OPS-008/026~029 | independent approval, change, emergency access and audit review |

새 category 또는 기존 Operation의 primary category 변경은 Architecture Approval과 affected Registry/Test review가 필요하다.

## 6. Authority matrix

| Activity | Disposition | Guard |
|---|---|---|
| Read / Monitor | ALLOWED | scoped purpose, classification, read-only and audit |
| Validate | ALLOWED | exact source/version, deterministic rule and immutable result |
| Recover / Replay / Rebuild | ALLOWED WITH GUARDS | current authorization, SoD, isolation, idempotency, no business/external effect |
| Deploy / Rollback | ALLOWED WITH GUARDS | approved change/release reference, segregated operator, rollback/forward-recovery evidence and post-validation; no business authority |
| Publish / Approve / Withdraw / Republish | PROHIBITED AS OPERATIONS AUTHORITY | only owning Business Workflow/API and qualified human authority may act |
| Business Decision / Policy Override | PROHIBITED | no operational signal, role or emergency mode grants authority |

Operations may execute a pre-authorized technical step, but execution never supplies the underlying Business Authority. Break-glass is containment-only and cannot create or confirm business outcomes.

## 7. Operational dependency

- Operation references canonical registries as validation inputs; it does not own their truth.
- Operation-to-Operation sequencing may coordinate technical prerequisites, but no preceding Operation grants Business Authority to a later Operation.
- Publication command/effect uses PR/WR/AR/SR and current authority; Projection/Event/Monitoring state cannot substitute.
- Replay/Rebuild uses PJR/ER exact versions and changes only derived/recovery scope.
- Failed/missing Registry validation is Default Deny and is audited.

## 8. Recovery policy

Recovery may include Restore, Replay, Rebuild, bounded Retry and Validation. It requires incident/change identity, scoped operator/service, current authorization, expected source/version, integrity evidence, idempotency, isolation, monitoring, rollback/containment and append-only audit.

Recovery shall not:

- mutate canonical Aggregate state outside its owning API/Workflow;
- create Verification, Permission, Approval, Publication or Policy decision;
- revive expired/revoked authority;
- replay a prior Publication command or external side effect;
- resend notification or connector delivery merely because an Event is replayed;
- treat restored Projection/Cache/Queue as business truth.

## 9. Monitoring policy

Monitoring, Health Check, Drift Detection, SLI/SLO measurement and alerting are read-only and authority-free. They may record signal, freshness/version, severity, owner and escalation evidence, but may not change business state, approve action or issue an effect-producing command. Monitoring access and every privileged observation/export are audited; blind spots are incidents, not success.

## 10. Audit contract

Every Operation records at minimum:

1. stable Operation ID and execution/correlation identity;
2. named human/service operator and session/credential reference;
3. environment, scope, target and exact versions;
4. trigger, purpose, reason and change/release/incident reference;
5. authorization/approval and SoD evidence where required;
6. start/end timestamp;
7. result and safe failure reason;
8. validation, recovery/rollback and follow-up evidence.

Secret, credential value, raw contact/customer data and unnecessary provider payload are excluded. Audit correction is append-only.

## 11. Registry mapping

| Registry | Canonical mapping | Status |
|---|---|---|
| Decision Register | DEC-059~067, DEC-073, DEC-090; AO-023~035 constraints | VERIFIED |
| RTM | TRACE-017~020/023/024; TEST-049~056 supplies OPS trace | VERIFIED |
| Publication Registry | OPS-009/010/014~16/018~21/23~25/29~32 consume state/version only | VERIFIED |
| Workflow Registry | WF-001~012 context; WF-011/012 recovery; Operation never executes business decision | VERIFIED |
| API Registry | API-001~019; API-016 audit, API-017 job/replay/rebuild, API-018/019 integration | VERIFIED |
| Security Registry | SEC-001~034 via frozen Book 9 mappings; operational controls create no authority | VERIFIED |
| Projection Registry | OPS-012~15/18/19/21~25/29~32 observe/rebuild derived PRJ-001~008 only | VERIFIED |
| Event Registry | OPS-010~19/21/23~25/27/29~32 consume/audit EVT-001~012; replay has no effects | VERIFIED |
| Test Registry | TST-009 validates OPS-001~032 authority/recovery/monitoring/audit; TST-010 validates reciprocal Registry trace | VERIFIED |

## 12. Validation rules

| Validation error | Rule |
|---|---|
| Missing Operation | frozen OPS-001~032 row absence is invalid |
| Duplicate Operation | Operation ID must occur exactly once; aliases cannot reuse OPS ID |
| Invalid Authority | any business decision/effect/policy authority from Operation is invalid |
| Invalid Dependency | Registry bypass or Operation-derived business authority is invalid |
| Broken Registry Mapping | required canonical Registry reference must resolve |
| Missing Audit | operator, timestamp, result or failure reason absence is invalid |
| Invalid Recovery Rule | stale authority, aggregate mutation, effect replay or notification resend is invalid |

## 13. Validation summary

- Frozen canonical Operation IDs preserved: 32/32; duplicate 0.
- Required fields: 12/12 per Operation row.
- Operation categories: 6/6.
- Requested semantic capabilities covered: 12/12.
- Requested capability aliases aligned without ID reuse: 12/12; duplicate identity 0.
- Required Registry mappings: 9/9.
- Business Authority granted to Operation: 0.
- Deploy/Rollback authority vocabulary resolved: 2/2.
- Runtime implementation claim: none.

## 14. Cross-references

- [Operations Index](00_OPERATIONS_INDEX.md)
- [Book 9 Operations Index](book-9/00_DEPLOYMENT_OPERATIONS_INDEX.md)
- [Book 9 Operation Registry](book-9/14_OPERATION_REGISTRY.md)
- [Book 9 Operation Checklist](book-9/15_OPERATION_CHECKLIST.md)
- [Canonical Publication Registry](00_PUBLICATION_REGISTRY.md)
- [Canonical Workflow Registry](00_WORKFLOW_REGISTRY.md)
- [Canonical API Registry](00_API_REGISTRY.md)
- [Canonical Security Registry](00_SECURITY_REGISTRY.md)
- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Canonical Event Registry](00_EVENT_REGISTRY.md)
- [Test Registry](book-10/15_TEST_REGISTRY.md)

## 15. Final recommendation

`APPROVE_OPERATIONS_REGISTRY_ALIGNMENT`

기존 32개 Operation identity를 변경하지 않고 requested vocabulary를 non-ID capability alias로 정규화했다. Deploy/Rollback은 승인된 change/release에 한정된 operational capability이며 Business Authority를 생성하지 않는다. Event와 Test reciprocal mapping을 포함한 9개 Registry mapping은 모두 검증됐다.
