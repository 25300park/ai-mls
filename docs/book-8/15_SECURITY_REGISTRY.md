# Security Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-016 |
| 문서 버전 | v1.1 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer / Architecture Owner |
| 기준일 | 2026-07-14 |

> Phase 15 synchronization: security controls는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)의 연결을 constrain하며, `SEC-*`의 `DEFINED`/`POST-MVP` semantic status는 변경하지 않았다.

## Purpose

Phase 9 logical control ID, owning document와 workflow/entity/API/screen/AI mapping의 canonical source다. `SEC-*`는 test, implementation requirement 또는 product control identifier를 대신하지 않는다.

## Status rule

`DEFINED`는 logical baseline이 문서화되었다는 trace status이며 implemented/effective/approved를 뜻하지 않는다. `POST-MVP`는 current grant/control이 아니며 prerequisite approval 전 사용할 수 없다.

## Control registry

| Security ID | Control | Owner doc | Workflow | Related Entity | Related API | Related Screen | Related AI Capability | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | Zero Trust per-request authorization | DOC-SEC-002/004 | WF-001–012 | User, Role, Team, User Action | API-001–019 | UI-001–037 | AI-001–007 constrained; N/A decision authority | Security Owner | DEFINED |
| SEC-002 | Default deny and least privilege | DOC-SEC-002/004/005 | WF-001–012 | Role, Team, Verifier Assignment | API-002–019 | UI-002–037 | AI-001–007 no grant authority | Security Owner | DEFINED |
| SEC-003 | Human identity lifecycle | DOC-SEC-003 | WF-001–012 | User, Role, Team, User Action | API-001/002/015/016 | UI-001/006/035/036 | N/A — identity control | Identity Owner | DEFINED |
| SEC-004 | MFA and privileged reauthentication | DOC-SEC-003/010 | WF-007–012 | User, Role, Approval History, User Action | API-001/002/011–016 | UI-027–036 | N/A — human authentication | Security Owner | DEFINED |
| SEC-005 | Password/recovery protection | DOC-SEC-003 | WF-001–012 | User, User Action, Audit Event | API-001/016 | UI-001/006/035/036 | N/A — credential control | Identity Owner | DEFINED |
| SEC-006 | Unique service/connector identity | DOC-SEC-003 | WF-001–004/009–012 | User, Collector, Source Registry, Publication Target | API-001/002/017–019 | UI-006/009/031/034–036 | AI-001–007 when service invokes AI | Integration/Security Owner | DEFINED |
| SEC-007 | Session traceability and revocation | DOC-SEC-010 | WF-001–012 | User, User Action, Audit Event | API-001/002/016 | UI-001–037 | N/A — session control | Security Owner | DEFINED |
| SEC-008 | Timeout and step-up policy | DOC-SEC-010 | WF-007–012 | User, Approval History, User Action | API-001/002/011–016 | UI-019/020/025/027–036 | N/A — session control | Security Owner | DEFINED |
| SEC-009 | Device/risk and concurrent session control | DOC-SEC-010 | WF-001–012 | User, User Action, System Error | API-001/002/016 | UI-001/006/035/036 | N/A — risk signal | Security Owner | DEFINED |
| SEC-010 | Role hierarchy and separation of duties | DOC-SEC-004/005 | WF-002–012 | Role, Team, Verifier Assignment, Publication Approval, Approval History | API-002/004–016 | UI-004/012/013/016/023–036 | AI-001–007 advisory only; no decision authority | Security + Business Owner | DEFINED |
| SEC-011 | Independent Verification/Permission/Approval/Publication | DOC-SEC-004/005 | WF-007–010 | Verification, Permission, Publication Approval, Publication, Approval History | API-011–014/016 | UI-026–031/035 | N/A — human authority | Business/Security Owner | DEFINED |
| SEC-012 | Authorized and audited export | DOC-SEC-005/006/008 | WF-001–012 | Audit Event, User Action, Decision History | API-002/005–016 | UI-005/006/008/009/014/015/017–036 | AI Result only when exported subject; no authority | Data/Privacy Owner | DEFINED |
| SEC-013 | Canonical data classification | DOC-SEC-006 | WF-001–012 | Raw Source, Contact, Client, AI Result, Immutable Representation Snapshot, Publication Approval, Audit Event | API-003–019 | UI-008–037 | AI-001–007 inherit highest input class | Data/Privacy Owner | DEFINED |
| SEC-014 | Privacy minimization and masking | DOC-SEC-006/007 | WF-001–012 | Contact, Contact Channel, Client, Communication, Raw Source, Immutable Representation Snapshot, Publication Approval | API-004/007–010/013/016/019 | UI-008/011/013–025/029/030/035/037 | AI-001–007 minimized input/output; no Approval authority | Privacy Owner | DEFINED |
| SEC-015 | Consent/basis and purpose limitation | DOC-SEC-007 | WF-001/002/005/007–010 | Contact, Contact Channel, Contact Case, Client, Permission, Immutable Representation Snapshot, Publication Approval, Publication Target, Publication | API-003/004/007–009/012–014/019 | UI-009–012/019–023/025/028–031 | AI-001/004/006/007 purpose bound; no target/channel selection authority | Privacy/Business Owner | DEFINED |
| SEC-016 | Governed deletion and legal hold | DOC-SEC-007 | WF-011/012 | Retention Policy, Legal Hold, Retention Job, Audit Event | API-015–017 | UI-006/033–036 | AI Result subject to same disposition | Privacy/Data Owner | DEFINED |
| SEC-017 | Encryption in transit | DOC-SEC-009 | WF-001–012 | User, Raw Source, AI Job, Publication, System Error | API-001–019 | UI-001–037 | AI-001–007 provider boundary | Security/Operations Owner | DEFINED |
| SEC-018 | Encryption at rest | DOC-SEC-009 | WF-001–012 | Raw Attachment, Contact, AI Result, Audit Event, Publication | API-003–019 | UI-008–037 | AI-001–007 stored payload/result | Security/Data Owner | DEFINED |
| SEC-019 | Key lifecycle and rotation | DOC-SEC-009 | WF-001–012 | Audit Event, System Error, Decision History | API-015–019 | UI-006/033–036 | N/A — cryptographic control | Security Owner | DEFINED |
| SEC-020 | Secret management | DOC-SEC-009 | WF-001–012 | User, Collector, Publication Target, Audit Event | API-001/015/018/019 | UI-006/033–036 | AI provider credential; not model input | Security/Integration Owner | DEFINED |
| SEC-021 | Privileged action audit | DOC-SEC-008/013 | WF-001–012 | Audit Event, User Action, Approval History, Status History | API-001–019 | UI-001–037 | AI Job/Result/version/review trace | Security/Governance Owner | DEFINED |
| SEC-022 | Audit/log integrity | DOC-SEC-008/013 | WF-001–012 | Audit Event, Decision History, Status History, System Error | API-016/017 | UI-033–036 | N/A — evidence integrity | Security/Governance Owner | DEFINED |
| SEC-023 | Privacy-safe security logging | DOC-SEC-013 | WF-001–012 | Audit Event, User Action, System Error | API-001–019 | UI-001–037 | AI-001–007 safe metadata only | Security/Privacy Owner | DEFINED |
| SEC-024 | Security event detection/correlation | DOC-SEC-011/013 | WF-001–012 | Audit Event, User Action, System Error | API-001/002/014–019 | UI-001/006/031/033–037 | AI-related event only; detection authority N/A | Security Operations Owner | DEFINED |
| SEC-025 | Suspicious activity containment | DOC-SEC-011/014 | WF-012 | User, Role, System Error, Audit Event | API-001/002/014–019 | UI-001/006/031/033–036 | AI/service may be suspended; cannot approve | Incident Owner | DEFINED |
| SEC-026 | Threat review and residual risk governance | DOC-SEC-012 | WF-001–012 | Decision History, System Error, Audit Event | API-001–019 | UI-001–037 | AI-001–007 threat boundary | Security/Architecture Owner | DEFINED |
| SEC-027 | Incident classification and containment | DOC-SEC-014 | WF-012 | System Error, Audit Event, Decision History | API-001/002/014–019 | UI-006/031/033–036 | AI-001–007 affected capability context | Incident Owner | DEFINED |
| SEC-028 | Secure recovery and post-incident review | DOC-SEC-014/015 | WF-011/012 | System Error, Audit Event, Status History, Decision History | API-011–019 | UI-031–036 | AI Result revalidation where affected | Incident/Operations Owner | DEFINED |
| SEC-029 | Backup protection and isolation | DOC-SEC-015 | WF-012 | Retention Policy, Legal Hold, Audit Event, System Error | API-015–017 | UI-006/033–036 | AI Job/Result included by class; no special authority | Operations/Security Owner | DEFINED |
| SEC-030 | Authorized restore and integrity verification | DOC-SEC-015 | WF-011/012 | Retention Job, Verification, Permission, Publication, Audit Event | API-011–017 | UI-006/031–036 | AI Result revalidation if restored | Operations/Data/Security Owner | DEFINED |
| SEC-031 | AI privacy/provider security | DOC-SEC-006/007/012 | WF-002–006/012 | AI Job, AI Result, Raw Source, Requirement, Match Result | API-004–006/009/010/017/019 | UI-011–018/023/024/033/034 | AI-001–007 | AI/Security/Privacy Owner | DEFINED |
| SEC-032 | Connector/integration isolation | DOC-SEC-002/003/012 | WF-001–004/009–012 | Collector, Source Registry, Raw Source, Publication Target, Publication, System Error | API-004/014/017–019 | UI-009–013/031/033/034/036 | AI-001/002/003/007 after intake only | Integration/Security Owner | DEFINED |
| SEC-033 | Access recertification and exception expiry | DOC-SEC-004/008 | WF-001–012 | User, Role, Team, Verifier Assignment, Decision History | API-002/015/016 | UI-006/026/035/036 | N/A — access governance | Security/Business Owner | DEFINED |
| SEC-034 | Attribute-based authorization extension | DOC-SEC-004 | WF-001–012 | User, Role, Team, Organization | API-002/015/019 | UI-001–037 | AI cannot supply authoritative attributes | Security Owner | POST-MVP |

## GOV-001 Publication Approval control mapping

| Accepted decision | Required binding/control | Canonical Security IDs |
|---|---|---|
| AO-018 | representation identity, exact version, checksum, immutable snapshot, classification inheritance | SEC-002, SEC-013, SEC-014, SEC-021–023 |
| AO-019 | one target + one target-scoped channel, exact target/channel policy versions, language/audience/field scope, inactive target/channel deny | SEC-002, SEC-011, SEC-013–015, SEC-021 |
| AO-020 | API-013 scoped reads/mutations, effective Approval, API-014 no-execution boundary, immutable history write/query separation | SEC-001/002, SEC-004, SEC-008, SEC-010/011, SEC-021–023 |
| AO-021 | actor-level requester/creator/verifier/Permission-decider/executor conflict, role stacking deny, PUA-only decision, MFA/reason, break-glass no-bypass | SEC-001/002, SEC-004, SEC-007/008, SEC-010/011, SEC-021, SEC-025, SEC-028, SEC-030 |

- `ExpireApproval`은 scheduler-only restriction이며 Scheduler는 Approval을 create/approve/reject/revoke/extend하지 않는다.
- Service, connector와 AI actor는 Publication Approval decision authority가 없고 effective Approval을 생성하거나 복원하지 않는다.
- recovery/replay는 current session, assignment, actor-level SoD, exact versions, Verification, Permission, target/channel policy, expiry와 revocation을 재인가한다.
- break-glass는 containment에만 사용하며 missing/conflicted/expired/revoked Approval을 우회하거나 복원하지 않는다.

## Coverage contract

- Security IDs: `SEC-001`, `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, `SEC-007`, `SEC-008`, `SEC-009`, `SEC-010`, `SEC-011`, `SEC-012`, `SEC-013`, `SEC-014`, `SEC-015`, `SEC-016`, `SEC-017`, `SEC-018`, `SEC-019`, `SEC-020`, `SEC-021`, `SEC-022`, `SEC-023`, `SEC-024`, `SEC-025`, `SEC-026`, `SEC-027`, `SEC-028`, `SEC-029`, `SEC-030`, `SEC-031`, `SEC-032`, `SEC-033`, `SEC-034`.
- Workflow coverage: `WF-001`, `WF-002`, `WF-003`, `WF-004`, `WF-005`, `WF-006`, `WF-007`, `WF-008`, `WF-009`, `WF-010`, `WF-011`, `WF-012`.
- API coverage: `API-001`, `API-002`, `API-003`, `API-004`, `API-005`, `API-006`, `API-007`, `API-008`, `API-009`, `API-010`, `API-011`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-018`, `API-019`.
- Screen coverage: `UI-001`, `UI-002`, `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`, `UI-008`, `UI-009`, `UI-010`, `UI-011`, `UI-012`, `UI-013`, `UI-014`, `UI-015`, `UI-016`, `UI-017`, `UI-018`, `UI-019`, `UI-020`, `UI-021`, `UI-022`, `UI-023`, `UI-024`, `UI-025`, `UI-026`, `UI-027`, `UI-028`, `UI-029`, `UI-030`, `UI-031`, `UI-032`, `UI-033`, `UI-034`, `UI-035`, `UI-036`, `UI-037`.
- AI coverage: `AI-001`, `AI-002`, `AI-003`, `AI-004`, `AI-005`, `AI-006`, `AI-007`; security authority는 모두 N/A이며 advisory/provider/data handling만 mapping한다.
- Entity names는 [Data Dictionary](../book-3/15_DATA_DICTIONARY.md)의 canonical names만 사용한다.
- Test placeholder는 전 control `PLANNED — Book 10`; Phase는 Phase 9다.

## Registry governance

Control 변경은 affected role/screen/API/data/AI와 threat/privacy impact를 분석하고 CR/Decision/ADR 필요성, owner, reviewer와 evidence를 기록한다. Registry row만으로 runtime enforcement 또는 compliance claim이 성립하지 않는다.
