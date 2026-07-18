# Dependency Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-07-15 |

## Task dependency

| DEV group | Depends on | Reason / gate |
|---|---|---|
| DEV-024 | approved Books 0–11 | trace/release evidence source |
| DEV-001–003/023 | DEV-024 | Ready/test/evidence and security baseline |
| DEV-004/005/018 | DEV-001–003/023 | source authorization, actor/audit와 job control |
| DEV-006/007/022 | DEV-004/005/018 | provenance/intake evidence와 AI job boundary |
| DEV-008–010 | DEV-001–003/023 | identity, privacy와 object scope |
| DEV-011/021 | DEV-006–010/022 | eligible data/requirements and approved contracts |
| DEV-012/013 | DEV-008–011/021/023 | contact, requirement, review UI와 authority controls |
| DEV-014/015 | DEV-012/013/017/023 | verification/permission/audit before external effect |
| DEV-016/017 | DEV-001–003/023/024 | privileged access and evidence foundation |
| DEV-019/020 | DEV-004/005/014–018/023 | source/target policy, reconciliation and isolation |

## Epic dependency

| Epic | Prerequisite Epics | Blocking condition |
|---|---|---|
| EPIC-001 | None | approved architecture unavailable |
| EPIC-002 | EPIC-001 | identity/security open blocker |
| EPIC-003 | EPIC-001/002 | source policy/authorization unavailable |
| EPIC-004 | EPIC-003 | provenance/intake incomplete |
| EPIC-005 | EPIC-002 | privacy/object scope incomplete |
| EPIC-006 | EPIC-004/005 | eligible inputs or AI evaluation unavailable |
| EPIC-007 | EPIC-002/004/005/006 | authority separation/reconciliation incomplete |
| EPIC-008 | EPIC-001/002 | privileged/audit/job controls incomplete |
| EPIC-009 | EPIC-003/007/008 | connector contract/source target approval absent |
| EPIC-010 | EPIC-002–008 | owning action contract not ready |

## Module dependency

| Module class | Allowed upstream | Prohibited dependency |
|---|---|---|
| Application/UI | public module/API contracts | database/internal policy/vendor SDK |
| Domain feature | approved shared primitives and ports | UI/transport/other module storage |
| AI adapter | AI port/schema/version policy | authoritative write/approval |
| Connector adapter | connector port/policy | core workflow bypass |
| Publication adapter | approved publication command | verification/permission creation |
| Operations/test | observable public contracts | production secret/personal fixture |

## Risk dependency

| Risk dependency | Affected work | Required disposition |
|---|---|---|
| stack/toolchain undecided | all implementation | approval before SP-000 exit |
| identity/privacy parameters open | EPIC-002/005/007/009 | specialist decision before Ready |
| AI dataset/threshold open | EPIC-006 | evaluation approval before AI enablement |
| SLO/RPO/RTO/load open | REL-003/004 | measured targets before acceptance |
| source/target contract absent | EPIC-009, publication | exclude/disable until approval |
| named owner/approver absent | all high-risk work | no Ready/release approval |

## Change rule

dependency change triggers sequence, Sprint, Release, risk, trace와 rollback review. Bypassing a dependency requires CR/ADR and cannot waive constitutional gates.
