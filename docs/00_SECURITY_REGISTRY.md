# AI-MLS Canonical Security Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-046 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Security/Privacy Reviewer / Architecture Owner |
| 기준일 | 2026-07-24 |
| 적용 범위 | Phase 11-6 Security Registry Alignment |

## 1. 목적과 governance boundary

이 Registry는 기존 `SEC-001`~`SEC-034`의 identity와 frozen semantic status를 유지하면서 AO-023~AO-035에 필요한 protected asset, enforcement point, authorization, workflow/API/registry/test trace를 정렬한 governance view다.

- Business truth는 canonical aggregate와 immutable history가 유지한다.
- Security control은 business authority를 보호하며 새 business authority를 만들지 않는다.
- [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md)는 frozen control identity/source다. 이 문서는 Security Control ID, public security policy, role grant 또는 runtime behavior를 추가·삭제·변경하지 않는다.
- 기존 `DEFINED`는 logical definition이고 runtime effectiveness claim이 아니다. 기존 `POST-MVP`인 `SEC-034`는 현행 grant가 아니며 이 alignment에서는 `DEFERRED`다.

## 2. Canonical security control registry

| Security Control ID | Security Control Name | Category | Protected Asset | Enforcement Point | Required Authorization | Related Workflow | Related API | Related Registry | Related Test | Validation Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | Zero Trust per-request authorization | Authorization | every business/security resource | API-002 + domain API | authenticated current principal and resource/action scope | WF-001~012 | API-001~019 | DR, RTM, WR, AR, TR | TEST-009, TEST-047, TEST-056 | VERIFIED |
| SEC-002 | Default deny and least privilege | Authorization | authority, field and action grants | API/workflow guard | explicit bounded allow; conflict/missing context denies | WF-001~012 | API-002~019 | DR, RTM, WR, AR, TR | TEST-009, TEST-022, TEST-047 | VERIFIED |
| SEC-003 | Human identity lifecycle | Identity & Authentication | User, Role, Team, assignment | identity lifecycle/API-001 | Identity Owner and governed joiner/mover/leaver | WF-001~012 | API-001/002/015/016 | DR, RTM, AR, TR | TEST-001, TEST-046, TEST-048 | VERIFIED |
| SEC-004 | MFA and privileged reauthentication | Identity & Authentication | privileged human action/session | API-001/002 and command boundary | required role plus MFA/step-up | WF-007~012 | API-001/002/011~016 | DR, RTM, WR, AR, TR | TEST-001, TEST-022, TEST-047 | VERIFIED |
| SEC-005 | Password/recovery protection | Identity & Authentication | credential and account recovery | authentication/recovery flow | independently verified human recovery | WF-001~012 | API-001/016 | DR, RTM, AR, TR | TEST-001, TEST-046, TEST-051 | VERIFIED |
| SEC-006 | Unique service/connector identity | Identity & Authentication | service, connector, job identity | API-001/002/017~019 | unique scoped non-human principal; no human authority | WF-001~004/009~012 | API-001/002/017~019 | DR, RTM, WR, AR, TR | TEST-008, TEST-035~037 | VERIFIED |
| SEC-007 | Session traceability and revocation | Identity & Authentication | Session, User Action, Audit Event | API-001/002/016 | current non-revoked session | WF-001~012 | API-001/002/016 | DR, RTM, AR, TR | TEST-001, TEST-046, TEST-049 | VERIFIED |
| SEC-008 | Timeout and step-up policy | Identity & Authentication | high-risk session/action | session + command preflight | fresh assurance, MFA and bounded validity | WF-007~012 | API-001/002/011~016 | DR, RTM, WR, AR, TR | TEST-022, TEST-047, TEST-051 | VERIFIED |
| SEC-009 | Device/risk and concurrent session control | Identity & Authentication | User session and risk signal | authentication/authorization | risk-based policy; signal alone grants nothing | WF-001~012 | API-001/002/016 | DR, RTM, AR, TR | TEST-001, TEST-046, TEST-049 | PARTIALLY_VERIFIED |
| SEC-010 | Role hierarchy and separation of duties | Segregation of Duties | Verification, Permission, Approval, Publication authority | API-002 + domain command | explicit role assignment and dynamic actor conflict checks | WF-002~012 | API-002/004~016 | DR, RTM, WR, AR, PR, TR | TEST-022~025, TEST-033, TEST-047 | VERIFIED |
| SEC-011 | Independent Verification/Permission/Approval/Publication | Business Authority Protection | exact human decision and Publication command | WF-007~010/API-011~014 | distinct qualified human authority; no implicit inheritance | WF-007~010 | API-011~014/016 | DR, RTM, WR, AR, PR, TR | TEST-002/003/011/012/020~024/033 | VERIFIED |
| SEC-012 | Authorized and audited export | Privacy | export artifact and restricted read set | API-016/export workflow | purpose, scope, MFA/reason and approval where required | WF-001~012 | API-002/005~016 | DR, RTM, AR, TR | TEST-006, TEST-034, TEST-048, TEST-055 | VERIFIED |
| SEC-013 | Canonical data classification | Data Classification | source, aggregate, event, projection and export data | create/derive/read/export boundary | Data/Privacy Owner policy; highest applicable class | WF-001~012 | API-003~019 | DR, RTM, WR, AR, PR, PJR, ER, TR | TEST-004, TEST-033, TEST-036, TEST-049 | PARTIALLY_VERIFIED |
| SEC-014 | Privacy minimization and masking | Privacy | personal/contact/content fields | UI/API/AI/log/export boundary | purpose-bound field allowlist and masked default | WF-001~012 | API-004/007~010/013/016/019 | DR, RTM, AR, PJR, TR | TEST-002, TEST-020, TEST-032, TEST-048 | PARTIALLY_VERIFIED |
| SEC-015 | Consent/basis and purpose limitation | Privacy | Contact, Permission, Snapshot, Publication | collection/use/share/publish/export boundary | effective purpose/basis/Permission for exact audience | WF-001/002/005/007~010 | API-003/004/007~009/012~014/019 | DR, RTM, WR, AR, PR, TR | TEST-003, TEST-012, TEST-021~024 | VERIFIED |
| SEC-016 | Governed deletion and legal hold | Privacy | retained data, audit evidence and legal hold | API-015~017/disposition workflow | Privacy/Data/Legal authority; hold does not grant use | WF-011/012 | API-015~017 | DR, RTM, AR, TR | TEST-034, TEST-048, TEST-051, TEST-055 | PARTIALLY_VERIFIED |
| SEC-017 | Encryption in transit | Operational Security | data crossing trust boundaries | API/connector/integration transport | approved service/principal and protected channel | WF-001~012 | API-001~019 | DR, RTM, AR, TR | TEST-036, TEST-037, TEST-052 | PARTIALLY_VERIFIED |
| SEC-018 | Encryption at rest | Operational Security | stored Confidential/Restricted data and audit | canonical/derived/backup storage boundary | data-class access and key policy | WF-001~012 | API-003~019 | DR, RTM, AR, PJR, TR | TEST-048, TEST-051, TEST-052 | PARTIALLY_VERIFIED |
| SEC-019 | Key lifecycle and rotation | Operational Security | cryptographic key metadata | KMS/secret governance boundary | Security Owner; dual/segregated administration | WF-001~012 | API-015~019 | DR, RTM, AR, TR | TEST-034, TEST-052, TEST-053 | PARTIALLY_VERIFIED |
| SEC-020 | Secret management | Operational Security | credential/secret reference | API-015/018/019 and worker runtime | scoped service identity; secret never in payload/log | WF-001~012 | API-001/015/018/019 | DR, RTM, AR, TR | TEST-008, TEST-036, TEST-037, TEST-052 | VERIFIED |
| SEC-021 | Privileged action audit | Audit Integrity | authorization/approval/publication/admin history | every privileged command/restricted read | authenticated actor/service and mandatory audit durability | WF-001~012 | API-001~019 | DR, RTM, WR, AR, PR, ER, TR | TEST-006, TEST-022~025, TEST-049 | PARTIALLY_VERIFIED |
| SEC-022 | Audit/log integrity | Audit & Event Integrity | Audit Event, Decision/Status History, domain/security event | append-only event/log boundary | Security/Governance control; correction by linked event only | WF-001~012 | API-016/017 | DR, RTM, WR, AR, ER, TR | TEST-006, TEST-049, TEST-051~053 | PARTIALLY_VERIFIED |
| SEC-023 | Privacy-safe security logging | Audit Integrity | log/event metadata | application/API/job/connector logger | minimized safe metadata and restricted log access | WF-001~012 | API-001~019 | DR, RTM, AR, TR | TEST-006, TEST-036, TEST-049 | VERIFIED |
| SEC-024 | Security event detection/correlation | Event Integrity | Security Event, domain-event correlation and alerts | event/monitoring pipeline | Security Operations scope; detection grants no business authority | WF-001~012 | API-001/002/014~019 | DR, RTM, WR, AR, ER, TR | TEST-049, TEST-052, TEST-053, TEST-055 | PARTIALLY_VERIFIED |
| SEC-025 | Suspicious activity containment | Operational Security | identity, command and external-effect path | WF-012/incident boundary | Incident Owner; containment only, no approval bypass | WF-012 | API-001/002/014~019 | DR, RTM, WR, AR, PR, TR | TEST-025, TEST-049, TEST-052 | VERIFIED |
| SEC-026 | Threat review and residual risk governance | Operational Security | architecture/control risk | change/architecture review | Security + Architecture Owner | WF-001~012 | API-001~019 | DR, RTM, AR, TR | TEST-005, TEST-053, TEST-056 | VERIFIED |
| SEC-027 | Incident classification and containment | Operational Security | System Error, Audit/Decision evidence | incident response/WF-012 | Incident Owner and scoped responder | WF-012 | API-001/002/014~019 | DR, RTM, WR, AR, TR | TEST-025, TEST-049, TEST-052, TEST-055 | VERIFIED |
| SEC-028 | Secure recovery and post-incident review | Operational Security | recovered state, authority and evidence | WF-011/012 recovery gate | Incident/Operations Owner; current human authority revalidated | WF-011/012 | API-011~019 | DR, RTM, WR, AR, PR, PJR, ER, TR | TEST-025, TEST-051~053, TEST-055 | PARTIALLY_VERIFIED |
| SEC-029 | Backup protection and isolation | Operational Security | backup of canonical/audit/config data | backup creation/storage/restore | Operations + Security; isolated credentials/environment | WF-012 | API-015~017 | DR, RTM, AR, TR | TEST-051, TEST-052, TEST-055 | PARTIALLY_VERIFIED |
| SEC-030 | Authorized restore and integrity verification | Operational Security | canonical state, policies, events and projections | restore/recovery/revalidation boundary | Operations + Data + Security/Privacy dual control | WF-011/012 | API-011~017 | DR, RTM, WR, AR, PR, PJR, ER, TR | TEST-024, TEST-025, TEST-051, TEST-052 | PARTIALLY_VERIFIED |
| SEC-031 | AI privacy/provider security | Business Authority Protection | AI Job/Result and input data | AI gateway/job/review boundary | approved purpose/provider; AI authority always denied | WF-002~006/012 | API-004~006/009/010/017/019 | DR, RTM, AR, TR | TEST-007, TEST-013, TEST-039~045 | VERIFIED |
| SEC-032 | Connector/integration isolation | Business Authority Protection | intake/publication command and external Evidence | API-018/019 trust boundary | scoped service identity; exact authorized work only | WF-001~004/009~012 | API-004/014/017~019 | DR, RTM, WR, AR, PR, ER, TR | TEST-008, TEST-023, TEST-036, TEST-037 | PARTIALLY_VERIFIED |
| SEC-033 | Access recertification and exception expiry | Authorization | role, assignment and exceptional grant | API-002/015/016 governance | Security + Business Owner; bounded expiry | WF-001~012 | API-002/015/016 | DR, RTM, AR, TR | TEST-005, TEST-034, TEST-047, TEST-053 | PARTIALLY_VERIFIED |
| SEC-034 | Attribute-based authorization extension | Authorization | future authorization attributes | API-002/015/019 | `POST-MVP`; cannot weaken RBAC/SoD/default deny | WF-001~012 | API-002/015/019 | DR, RTM, AR, TR | TEST-009, TEST-047, TEST-056 | DEFERRED |

`DR` = [Decision Register](00_DECISION_REGISTER.md), `RTM` = [Canonical RTM](00_CANONICAL_TRACEABILITY_MATRIX.md), `WR` = [Workflow Registry](00_WORKFLOW_REGISTRY.md), `AR` = [API Registry](00_API_REGISTRY.md), `PR` = [Publication Registry](00_PUBLICATION_REGISTRY.md), `PJR` = [Canonical Projection Registry](00_PROJECTION_REGISTRY.md), `ER` = [Canonical Event Registry](00_EVENT_REGISTRY.md), `TR` = [Test Registry](book-10/15_TEST_REGISTRY.md).

## 3. Security control classification index

| Required category | Canonical controls | Coverage rule |
|---|---|---|
| Identity & Authentication | SEC-003~009 | human/service identity, MFA, session and recovery |
| Authorization | SEC-001/002/033/034 | per-request current decision, default deny, recertification |
| Business Authority Protection | SEC-011/031/032 | human decisions and aggregate commands cannot be inherited by AI/connector |
| Segregation of Duties | SEC-010/011 | static role separation plus dynamic actor-level conflict checks |
| Data Classification | SEC-013, SEC-017~020 | classification inheritance and protected handling |
| Privacy | SEC-012/014~016 | minimization, purpose, export, retention/legal hold |
| Audit Integrity | SEC-021~023 | mandatory append-only evidence and privacy-safe logging |
| Event Integrity | SEC-022/024 | immutable identity/version/order/checksum/replay validation |
| Projection Security | SEC-013/014/022/028/030/032 | classification/purpose inheritance, rebuild isolation, no authority |
| Operational Security | SEC-017~020/024~030 | encryption, secrets, detection, containment, recovery/backup |

한 control이 여러 category에 기여할 수 있으나 Security Control ID와 owner는 중복 생성하지 않는다.

## 4. Authorization boundary

| Component | Authority | Security rule |
|---|---|---|
| Canonical Aggregate | canonical business truth/state | approved transition과 expected version만 mutation |
| Authorized Command API | bounded command admission | current human authority, SoD, revalidation, idempotency, audit 필요 |
| Approved Workflow | approved process orchestration | aggregate/API guard를 우회하지 않음 |
| Authorized Human Operator | role/assignment-specific decision | session-derived actor, purpose, MFA/SoD where required |
| Projection/Search/Cache/Dashboard/Analytics | none | read/derived state만; mutation/approval/dispatch 금지 |
| AI/Internal Worker/External Connector | none | advisory or exact pre-authorized technical execution only |
| Monitoring/Rebuild Service | operational only | signal/rebuild 가능; business decision/approval/state mutation 금지 |

Missing, stale, ambiguous 또는 conflicting identity, classification, purpose, assignment, state/version, Approval, policy, Event/Projection integrity는 Default Deny다.

## 5. Segregation of duties matrix

| Concern | Must be separated | Enforcement | Recovery rule | Status |
|---|---|---|---|---|
| Approval Separation | requester/creator/editor vs exact-version approver | SEC-004/010/011 | recovery cannot create/restore Approval | VERIFIED |
| Publication Separation | approver vs executor | SEC-010/011/032 | fresh command authority required | VERIFIED |
| Withdrawal Separation | requester/authorizer/executor/resolver | SEC-010/011/021/032 | emergency containment cannot confirm Withdrawal | VERIFIED |
| Republish Separation | requester/authorizer/approver/executor | SEC-010/011/021/032 | no prior command/Approval replay | VERIFIED |
| Reconciliation Separation | executor/evidence submitter vs resolution authority | SEC-010/021/022/032 | independent Evidence and resolver required | VERIFIED |
| Rebuild Separation | aggregate mutator vs rebuild operator | SEC-022/028/030 | rebuild cannot write canonical state | DEFERRED |
| Monitoring Separation | monitored operator vs alert/review disposition | SEC-024~028 | monitoring signal cannot authorize command | PARTIALLY_VERIFIED |

Role stacking은 allow의 합집합을 만들지 않는다. 동일 actor conflict가 하나라도 있으면 더 제한적인 deny가 우선한다. Break-glass는 containment/recovery에만 사용하며 Verification, Permission, Approval, Publication, Withdrawal, Republish 또는 Reconciliation resolution을 대체하지 않는다.

## 6. Data classification and privacy contract

| Requested level | Canonical value | Projection/Event inheritance | External/public rule |
|---|---|---|---|
| PUBLIC | `PUBLIC_APPROVED` | exact approved field/version only | reconciled approved public fields only |
| INTERNAL | `INTERNAL` | source class or higher | authenticated internal purpose only |
| CONFIDENTIAL | `CONFIDENTIAL_BUSINESS` | source class or higher | explicit scoped sharing/export authorization |
| RESTRICTED | `RESTRICTED_PERSONAL` / `RESTRICTED_SECURITY` | highest input class; raw payload/log duplication 금지 | explicit purpose/assignment; masked/minimized default |

- Unknown/mixed/derived data는 highest plausible source classification을 상속한다.
- Projection, Event, cache, export, backup, log와 AI Result는 source classification 및 purpose limitation을 상속한다.
- Classification downgrade/declassification은 named Data/Privacy Owner, exact fields/version, purpose와 immutable evidence가 필요하다.
- Public Projection은 effective Approval/Permission과 reconciled state가 허용한 field만 포함한다.
- Export는 classification과 무관하게 purpose, recipient, field/row scope, retention/expiry와 audit를 요구한다.

## 7. Audit and event integrity

| Required audit/event | Mandatory evidence | Integrity rule |
|---|---|---|
| Authorization | actor/session, action/resource, policy/version, allow/deny/obligation | all privileged allow and material deny append-only |
| Approval | exact subject/version, actor, SoD/MFA, reason, outcome | correction is new linked event; overwrite/delete prohibited |
| Publication/Withdrawal/Republish | command/attempt/external-effect identities, target/channel, outcome | acceptance and confirmed effect separated |
| Reconciliation | Observation, Evidence, Case, independent Resolution | raw observation cannot rewrite canonical truth |
| Rebuild/Drift Detection | projection/schema/event versions, operator/service, scope, result | canonical event/history mutation prohibited |
| Recovery | request/approval, restore point, integrity/revalidation, cutover | restored authority revalidated; stale grant not revived |
| Security Policy change | proposer/approver, diff, version, effective/rollback time | independent review and immutable change history |

Canonical Event integrity는 stable event identity, aggregate/event version, trusted time/order, checksum/integrity evidence, correlation/causation, classification과 replay disposition을 포함한다. Duplicate, missing, out-of-order, checksum failure 또는 unsupported version은 fail closed하고 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 validation/recovery contract로 보낸다.

Audit/Event history는 immutable이며 delete 또는 in-place correction을 허용하지 않는다. Retention/Legal Hold는 governed archive/disposition이며 history 조작 권한이 아니다.

## 8. Projection security contract

- Projection은 source classification, field restriction, purpose, tenant와 privacy rule을 상속한다.
- Projection query는 staleness/version을 표시하고 canonical business authority를 생성하지 않는다.
- Rebuild/Replay operator는 derived store만 변경하며 aggregate, Approval, Command 또는 immutable Event를 변경하지 않는다.
- Drift Detection/Monitoring은 signal과 evidence를 만들 뿐 business decision을 생성하지 않는다.
- Rebuild는 explicit operator/service scope, source boundary, expected schema/event version, idempotency, isolation과 audit를 요구한다.
- Projection 삭제는 derived state에만 가능하며 source Aggregate/Event/Audit 삭제를 의미하지 않는다.
- Projection definition/identity는 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md), Event binding/order/replay contract는 [Canonical Event Registry](00_EVENT_REGISTRY.md)가 소유한다. Runtime rebuild/replay evidence는 `PARTIALLY_VERIFIED`; authority/classification prohibition은 `VERIFIED`다.

## 9. Decision and registry mapping

| AO / DEC | Security alignment | Status |
|---|---|---|
| AO-023 / DEC-100 | aggregate/Attempt/Evidence lineage integrity and protected authority | VERIFIED |
| AO-026 / DEC-103 | provider/connector/credential/Target ownership separation | VERIFIED |
| AO-027 / DEC-104 | API-014 command/read/evidence enforcement boundary | VERIFIED |
| AO-028 / DEC-105 | effect/recovery boundary live authorization revalidation | VERIFIED |
| AO-029 / DEC-106 | dynamic actor-level SoD and no role-stacking escalation | VERIFIED |
| AO-030 / DEC-107 | idempotency/replay identity and duplicate-effect protection | VERIFIED |
| AO-031 / DEC-108 | Evidence integrity and independent reconciliation resolution | VERIFIED |
| AO-032 / DEC-109 | materiality/Successor and exact-version Approval protection | VERIFIED |
| AO-033 / DEC-110 | dedicated Withdrawal authority and non-exposure evidence | VERIFIED |
| AO-034 / DEC-111 | Republish fresh authorization/command/attempt | VERIFIED |
| AO-035 / DEC-112 | authority-free classified Projection and secure replay/rebuild | DEFERRED |

| Registry | Mapping | Status |
|---|---|---|
| Decision Register | DEC-100/103~112; DEC-101/102 supporting | VERIFIED |
| RTM | TRACE-014~020/023/024 and REQ-CONST-001~013 | VERIFIED |
| Workflow Registry | WF-001~012; Publication/recovery focus WF-009~012 | VERIFIED |
| API Registry | API-001~019; command/query/internal boundaries | VERIFIED |
| Publication Registry | aggregate/state/version/authorization/evidence truth | VERIFIED |
| Projection Registry | [Canonical Projection Registry](00_PROJECTION_REGISTRY.md): PRJ-001~008 | VERIFIED |
| Event Registry | [Canonical Event Registry](00_EVENT_REGISTRY.md): EVT-001~012 and security/replay/retention contract | VERIFIED |
| Test Registry | control-row mappings, frozen TEST-022~025/033/035~037/047~056 and governance TST-006/010 | VERIFIED |

## 10. Audit requirements

Security Control 생성/수정, category/owner/trace/policy/version 변경과 freeze 승인은 governance audit에 기록한다. Runtime security audit는 append-only이며 해당 audit에 대한 read/export/rebuild/recovery도 audit한다. Credential, secret, token, raw contact/message/provider payload와 unnecessary restricted data는 audit/log에 기록하지 않는다.

## 11. Validation summary

- Canonical Security Control IDs: 34/34, duplicate 0, new SEC ID 0.
- Required categories: 10/10.
- Authorization components classified: 10/10; unauthorized authority grants 0.
- Required SoD concerns: 7/7.
- Classification levels: 4/4; downgrade without authorization prohibited.
- Required audit topics: 10/10 through consolidated audit/event matrix.
- Primary AO/DEC mappings: 11/11.
- Registry mappings: 8/8; placeholder 0.
- Public security policy/business authority change: none.
- Runtime implementation claim: none.

## 12. Cross-references

- [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)
- [Projection Index](00_PROJECTION_INDEX.md)
- [Security Index](00_SECURITY_INDEX.md)
- [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md)
- [Security Validation Report](reviews/PHASE11_6_SECURITY_VALIDATION.md)
- [Security Coverage Report](reviews/PHASE11_6_SECURITY_COVERAGE.md)
- [Phase 11-6 Completion](reviews/PHASE11_6_COMPLETION.md)
