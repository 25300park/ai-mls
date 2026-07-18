# Epic Breakdown

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Product Owner / Architecture Owner |
| 기준일 | 2026-07-15 |

## Epic rules

Epic은 outcome과 acceptance boundary를 정의하며 implementation module이나 조직 구조를 자동 확정하지 않는다. 모든 `DEV-001–024`는 정확히 하나의 primary Epic에 속한다.

## Registry

| Epic ID | Epic | Purpose | Developer Tasks | Dependencies | Acceptance |
|---|---|---|---|---|---|
| EPIC-001 | Governance and release evidence | trace, Ready/Done와 release evidence foundation | DEV-024 | None | TEST-056; orphan/approval/release gate 검증 |
| EPIC-002 | Identity, authorization and security | identity/session/SoD/privacy/operational control | DEV-001–003, DEV-023 | EPIC-001 | TEST-009, TEST-026, TEST-046–049 |
| EPIC-003 | Source and intake | approved source에서 validated candidate intake까지 | DEV-004–005 | EPIC-001/002 | TEST-004, TEST-014–016, TEST-027, TEST-036, TEST-039/040 |
| EPIC-004 | Property, candidate and duplicate | canonical property read/search와 candidate/duplicate review | DEV-006–007 | EPIC-003 | TEST-007/010/017/028/039–041/044 |
| EPIC-005 | Contact, client and requirement | privacy-safe contact/client/requirement lifecycle | DEV-008–010 | EPIC-002 | TEST-018/020/029/030/042/044/048 |
| EPIC-006 | Matching and advisory AI | governed AI capabilities와 human-reviewed matching | DEV-011, DEV-022 | EPIC-004/005 | TEST-013/019/031/039–045 |
| EPIC-007 | Verification, permission and publication | separated authority부터 reconciled publication까지 | DEV-012–015 | EPIC-002/004/005/006 | TEST-002/003/011/012/020–024/032/033/049/051 |
| EPIC-008 | Administration, audit and jobs | administration, evidence query와 resilient job orchestration | DEV-016–018 | EPIC-001/002 | TEST-005/006/016/025/034/035/046/049/051/053 |
| EPIC-009 | Connector and external integration | isolated source/target/provider integration lifecycle | DEV-019–020 | EPIC-003/007/008 | TEST-008/014/023/025/035–037/049/053 |
| EPIC-010 | UI and accessibility | role-aware accessible UI across approved contracts | DEV-021 | EPIC-002–008 | TEST-038/054/055 plus mapped feature tests |

## DEV coverage

`DEV-001` through `DEV-024` are assigned exactly once across EPIC-001–010. Cross-cutting dependencies do not change primary ownership.

## Approval

Epic acceptance requires all Features, mapped tests, documentation, security/operations and release evidence. Partial completion cannot upgrade authority or external publication eligibility.
