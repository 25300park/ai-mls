# Operation Registry

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-015 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Architecture Owner |
| 기준일 | 2026-07-14 |

> Phase 15 synchronization: operation controls는 [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)의 release/test 연결을 constrain하며, `OPS-*` semantic status는 변경하지 않았다.

## Purpose

Phase 10 logical operational control ID, owning document, workflow/entity/API/screen/security mapping, owner, frequency와 status의 canonical source다. `OPS-*` ID는 Document ID, runtime job, test 또는 implementation control ID를 대체하지 않는다.

## Status and frequency rules

`DEFINED`는 logical control이 문서화되었다는 trace status이며 implemented/effective/approved를 뜻하지 않는다. Frequency는 minimum trigger class이며 risk/incident/change에 따라 더 자주 수행할 수 있다. `EVENT`는 named event마다, `CONTINUOUS`는 monitoring/enforcement expectation이다.

## Registry

| Operation ID | Control | Owner document | Related Workflow | Related Entity | Related API | Related Screen | Related Security Control | Owner | Frequency | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| OPS-001 | Logical tier/trust-boundary isolation | DOC-OPS-002 | WF-001–012 | User, Raw Source, AI Job, Publication, System Error | API-001–019 | UI-001–037 | SEC-001/002/006/017/018/026/032 | Architecture/Operations Owner | PER ARCHITECTURE CHANGE | DEFINED |
| OPS-002 | Environment isolation and data boundary | DOC-OPS-003 | WF-001–012 | User, Role, Raw Source, Contact, Audit Event | API-001–019 | UI-001–037 | SEC-003/006/013/014/017–023 | Operations/Security Owner | CONTINUOUS + PER PROMOTION | DEFINED |
| OPS-003 | Controlled environment promotion | DOC-OPS-003 | WF-001–012 | Decision History, Audit Event, Status History | API-015–017 | UI-006/033–036 | SEC-010/021/026/033 | Release Owner | PER RELEASE | DEFINED |
| OPS-004 | Versioned configuration lifecycle | DOC-OPS-004 | WF-001–012 | Source Registry, Publication Target, Retention Policy, Decision History | API-003/015/016/019 | UI-009/031/035/036 | SEC-001/002/013/015/019/021 | Configuration Owners | PER CHANGE + CONTINUOUS DRIFT | DEFINED |
| OPS-005 | Secret/key reference and rotation operations | DOC-OPS-004/014 | WF-001–012 | User, Collector, Publication Target, Audit Event | API-001/015/018/019 | UI-006/033–036 | SEC-004–009/017/019/020/021 | Security/Integration Owner | EVENT + SCHEDULED REVIEW | DEFINED |
| OPS-006 | Governed feature flag lifecycle | DOC-OPS-004 | WF-001–012 | Decision History, Audit Event, System Error | API-015/016 | UI-006/033/035/036 | SEC-001/002/010/021/026 | Domain/Operations Owner | PER FLAG CHANGE + EXPIRY | DEFINED |
| OPS-007 | Immutable release candidate and evidence | DOC-OPS-005 | WF-001–012 | Decision History, Audit Event, System Error | API-015–017 | UI-006/033–036 | SEC-021/022/026 | Release Owner | PER RELEASE | DEFINED |
| OPS-008 | Independent release approval gate | DOC-OPS-005 | WF-001–012 | Approval History, Decision History, Audit Event | API-015/016 | UI-006/035/036 | SEC-004/010/011/021/033 | Business/Security/Release Owners | PER RELEASE | DEFINED |
| OPS-009 | Rollback/forward-recovery readiness | DOC-OPS-005 | WF-010–012 | Publication, Status History, System Error, Audit Event | API-014–017 | UI-031/033–036 | SEC-021/027–030 | Release/Operations Owner | PER RELEASE/CHANGE | DEFINED |
| OPS-010 | Daily service and workflow review | DOC-OPS-006 | WF-001–012 | AI Job, Publication, Reverification Request, System Error | API-011–019 | UI-005/006/026/031–037 | SEC-021/023/024/027 | On-call/Operations Owner | DAILY | DEFINED |
| OPS-011 | Periodic maintenance and governance review | DOC-OPS-006 | WF-001–012 | Retention Policy, Legal Hold, Role, Audit Event | API-015–017 | UI-006/033–036 | SEC-016/019/020/022/033 | Operations/Security/Data Owners | WEEKLY/MONTHLY | DEFINED |
| OPS-012 | Component/dependency health monitoring | DOC-OPS-007 | WF-001–012 | System Error, AI Job, Publication, Audit Event | API-001–019 | UI-005/006/031/033/034/037 | SEC-017/021/023/024/032 | Operations Owner | CONTINUOUS | DEFINED |
| OPS-013 | Technical telemetry and correlation | DOC-OPS-007 | WF-001–012 | User Action, AI Job, System Error, Audit Event | API-001–019 | UI-006/033–035 | SEC-007/021–024 | Operations/Security Owner | CONTINUOUS | DEFINED |
| OPS-014 | Business workflow guardrail monitoring | DOC-OPS-007 | WF-001–012 | Intake, Verification, Permission, Publication Approval, Publication | API-004/011–016 | UI-002–005/012/026–032/037 | SEC-011/013/015/021/024 | Domain/Operations Owner | CONTINUOUS + DAILY REVIEW | DEFINED |
| OPS-015 | Actionable alert and escalation | DOC-OPS-007 | WF-011/012 | System Error, Audit Event, User Action | API-001/002/014–019 | UI-006/031/033–037 | SEC-024/025/027 | On-call/Security Operations | CONTINUOUS/EVENT | DEFINED |
| OPS-016 | Tiered backup/checkpoint creation | DOC-OPS-008 | WF-001–012 | Audit Event, Status History, Raw Attachment, Retention Policy | API-015–017 | UI-006/033–036 | SEC-013/016–021/029 | Data/Backup Owner | TIER 0 15MIN; TIER 1 HOURLY; TIER 2 DAILY ASSUMPTION | DEFINED |
| OPS-017 | Backup integrity and completion verification | DOC-OPS-008 | WF-012 | Audit Event, System Error, Retention Job | API-016/017 | UI-006/033–036 | SEC-018/019/021/022/029 | Data/Backup + Security Owner | EVERY BACKUP | DEFINED |
| OPS-018 | Authorized restore/recovery testing | DOC-OPS-008 | WF-011/012 | Retention Job, Verification, Permission, Publication, Audit Event | API-011–017 | UI-006/031–036 | SEC-004/010/016/021/028–030 | Operations/Data/Security Owners | MONTHLY SAMPLE; QUARTERLY TIER 0 ASSUMPTION | DEFINED |
| OPS-019 | Disaster recovery activation and validation | DOC-OPS-009 | WF-011/012 | System Error, Audit Event, Status History, Decision History | API-001/002/011–019 | UI-001/006/031/033–037 | SEC-025/027–030 | DR/Incident Owner | EVENT + ANNUAL EXERCISE ASSUMPTION | DEFINED |
| OPS-020 | Business continuity/manual operation | DOC-OPS-010 | WF-001–012 | Intake, Raw Source, Requirement, Verification, Audit Event | API-004/009/011/016 | UI-002/003/011/023/027/033/035/037 | SEC-001/002/011/013–015/021 | Business Continuity Owner | EVENT + SEMIANNUAL TABLETOP ASSUMPTION | DEFINED |
| OPS-021 | Safe degraded-mode control | DOC-OPS-010 | WF-001–012 | System Error, Publication, AI Job, Status History | API-001–019 | UI-001–037 | SEC-001/002/011/025/027/031/032 | Operations/Domain Owner | EVENT/PER FAILURE | DEFINED |
| OPS-022 | Capacity forecast and headroom review | DOC-OPS-011 | WF-001–012 | AI Job, Raw Attachment, Audit Event, System Error | API-004/010/014/016–019 | UI-005/006/031/033–035 | SEC-018/023/026/029/031/032 | Operations/Architecture Owner | WEEKLY TREND + MONTHLY FORECAST | DEFINED |
| OPS-023 | Performance/backpressure validation | DOC-OPS-011 | WF-001–012 | AI Job, Match Result, Publication, System Error | API-001–019 | UI-005/006/024/031/034 | SEC-001/002/024/026/031/032 | Operations/Domain Owner | CONTINUOUS + PER RELEASE | DEFINED |
| OPS-024 | SLI/SLO/error-budget measurement | DOC-OPS-012 | WF-001–012 | Audit Event, System Error, AI Job, Publication | API-001–019 | UI-005/006/031/033–035 | SEC-021–024/026 | Service/Business Owner | CONTINUOUS + MONTHLY REVIEW | DEFINED |
| OPS-025 | Incident lifecycle and post-incident review | DOC-OPS-013 | WF-012 | System Error, Audit Event, Decision History, Status History | API-001/002/014–019 | UI-006/031/033–036 | SEC-024–28 | Incident Owner | EVENT | DEFINED |
| OPS-026 | Normal/standard change lifecycle | DOC-OPS-013 | WF-001–012 | Decision History, Approval History, Audit Event | API-015/016 | UI-006/035/036 | SEC-001/002/010/021/026/033 | Change Owner | PER CHANGE | DEFINED |
| OPS-027 | Emergency change and temporary access expiry | DOC-OPS-013/014 | WF-012 | User, Role, Decision History, Audit Event, System Error | API-001/002/015–017 | UI-001/006/033–036 | SEC-003–010/021/025/027/033 | Incident/Security/Change Owner | EVENT + RETROSPECTIVE REVIEW | DEFINED |
| OPS-028 | Least-privileged operational/admin access | DOC-OPS-014 | WF-001–012 | User, Role, Team, User Action | API-001/002/015/016 | UI-001/006/035/036 | SEC-001–010/033/034 | Security/Operations Owner | CONTINUOUS + PERIODIC RECERTIFICATION | DEFINED |
| OPS-029 | Privileged operation audit and evidence review | DOC-OPS-014 | WF-001–012 | Audit Event, User Action, Decision History, Approval History | API-015–019 | UI-006/031/033–036 | SEC-012/021–024 | Security/Governance Owner | EVERY ACTION + MONTHLY REVIEW | DEFINED |
| OPS-030 | Operational security/privacy review gate | DOC-OPS-014/016 | WF-001–012 | Retention Policy, Legal Hold, Role, Publication Target, Audit Event | API-015–019 | UI-006/031/033–036 | SEC-011–20/26/31–034 | Security/Privacy Owner | PER HIGH-RISK CHANGE + QUARTERLY | DEFINED |
| OPS-031 | External dependency/provider continuity | DOC-OPS-002/007/010 | WF-001–004/009–012 | Source Registry, Collector, AI Job, Publication Target, Publication, System Error | API-003/004/014/017–019 | UI-009–013/031/033/034/036/037 | SEC-006/013–15/17/20/23/24/31/32 | AI/Integration/Operations Owner | CONTINUOUS + MONTHLY REVIEW | DEFINED |
| OPS-032 | Job/connector retry, reconciliation and isolation | DOC-OPS-002/006/007 | WF-003/006/010–012 | AI Job, AI Result, Publication, Reverification Request, System Error | API-014/017–019 | UI-013/024/031–034/037 | SEC-006/011/021/024/025/028/031/032 | Operations/Integration Owner | CONTINUOUS + DAILY REVIEW | DEFINED |

## Coverage contract

- Operation IDs: `OPS-001` through `OPS-032`, exactly one registry row each.
- Workflow coverage: `WF-001`, `WF-002`, `WF-003`, `WF-004`, `WF-005`, `WF-006`, `WF-007`, `WF-008`, `WF-009`, `WF-010`, `WF-011`, `WF-012`.
- API coverage: `API-001`, `API-002`, `API-003`, `API-004`, `API-005`, `API-006`, `API-007`, `API-008`, `API-009`, `API-010`, `API-011`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-018`, `API-019`.
- Screen coverage: `UI-001`, `UI-002`, `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`, `UI-008`, `UI-009`, `UI-010`, `UI-011`, `UI-012`, `UI-013`, `UI-014`, `UI-015`, `UI-016`, `UI-017`, `UI-018`, `UI-019`, `UI-020`, `UI-021`, `UI-022`, `UI-023`, `UI-024`, `UI-025`, `UI-026`, `UI-027`, `UI-028`, `UI-029`, `UI-030`, `UI-031`, `UI-032`, `UI-033`, `UI-034`, `UI-035`, `UI-036`, `UI-037`.
- Security coverage: `SEC-001`, `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`, `SEC-007`, `SEC-008`, `SEC-009`, `SEC-010`, `SEC-011`, `SEC-012`, `SEC-013`, `SEC-014`, `SEC-015`, `SEC-016`, `SEC-017`, `SEC-018`, `SEC-019`, `SEC-020`, `SEC-021`, `SEC-022`, `SEC-023`, `SEC-024`, `SEC-025`, `SEC-026`, `SEC-027`, `SEC-028`, `SEC-029`, `SEC-030`, `SEC-031`, `SEC-032`, `SEC-033`, `SEC-034`.
- Entity names는 [Data Dictionary](../book-3/15_DATA_DICTIONARY.md)의 canonical name만 사용한다.
- Test placeholder는 전 control `PLANNED — Book 10`; delivery Phase는 Phase 10이다.

## Registry governance

Control 변경은 affected WF/entity/API/UI/SEC, owner/frequency, SLO/RPO/RTO, security/privacy와 recovery impact를 분석하고 CR/Decision/ADR 필요성 및 evidence를 기록한다. Registry row는 implementation 또는 effective control claim이 아니다.
