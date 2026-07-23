# Sprint Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-ROADMAP-006 |
| 문서 버전 | v1.2 |
| 상태 | FROZEN |
| 소유 역할 | Product Owner / Development Owner |
| 기준일 | 2026-07-15 |

## Planning rule

Sprint는 calendar duration/날짜가 없는 logical iteration이다. entry에는 predecessor acceptance와 Ready approval, exit에는 mapped test/review/documentation evidence가 필요하다.

## Logical plan

| Sprint | Objective | Features / DEV | Dependencies | Testable exit |
|---|---|---|---|---|
| SP-000 | governance, trace, environments/evidence readiness | FEAT-024 / DEV-024 | approved docs | TEST-056 trace dry review; no orphan IDs |
| SP-001 | identity, authorization, administration, audit와 privacy/security foundation | FEAT-001–003/016/017/023 / DEV-001–003/016/017/023 | SP-000 | TEST-005/006/009/026/034/046–049/053 |
| SP-002 | source, intake와 background job foundation | FEAT-004/005/018 / DEV-004/005/018 | SP-001 | TEST-004/014–016/027/035/036/039/040 |
| SP-003 | property, candidate, duplicate와 advisory AI | FEAT-006/007/022 / DEV-006/007/022 | SP-002 | TEST-007/010/013/017/028/039–045 |
| SP-004 | contact, client와 requirement lifecycle | FEAT-008–010 / DEV-008–010 | SP-001/003 | TEST-018/020/029/030/042/044/048 |
| SP-005 | matching와 accessible role-aware UI | FEAT-011/021 / DEV-011/021 | SP-003/004 | TEST-019/031/038/043–045/054/055 |
| SP-006 | Verification Authority | FEAT-012 / DEV-012 | SP-001/004/005 | TEST-002/010/011/020/022/024/032/051 |
| SP-007 | Permission Authority — `COMPLETED`, `ACCEPTED`, `FROZEN` | FEAT-013 / DEV-013 | SP-006 | TEST-003/012/020–022/024/032; accepted implementation evidence remains unchanged |
| SP-008 | Publication Approval Authority | FEAT-014 / DEV-014 | SP-007 | TEST-021/022/033; exact-version approval and separation-of-duties gate |
| SP-009 | cumulative RC stabilization, migration rehearsal와 cutover rehearsal | FEAT-024 coordination / REL-003 accepted DEV | SP-008 | TEST-001–056, UAT/security/performance/AI/DR/release gate |
| SP-010 | conditional POST-MVP connector/external integration | FEAT-019/020 / DEV-019/020 | SP-002/007/009 + new approval | TEST-008/014/023/025/035–037/049/053 |

## AO-017 canonical ownership

| Scope | Canonical owner | Boundary |
|---|---|---|
| FEAT-014 / DEV-014 / IMP-014 / API-013 / TRACE-014 | SP-008 | Publication Approval Authority only |
| WF-008 / WF-009 | SP-008 | Publication Approval portions only |
| UI-029 / UI-030 | SP-008 | Publication Approval states and actions only |
| TEST-021 / TEST-022 / TEST-033 SP-008 partition | SP-008 | FEAT-014-owned acceptance, Effective Approval and safe-boundary regression coverage |
| FEAT-015 / DEV-015 / IMP-015 / API-014 | `PENDING ARCHITECTURE OWNER DECISION` | Publication execution and delivery; excluded from SP-008/SP-009 |
| RC stabilization, migration rehearsal and cutover rehearsal | SP-009 | governance ownership only; implementation has not started |

SP-007 Permission Authority의 승인 commit과 구현 기준선은 AO-017로 변경되지 않는다. Production cutover와 post-deployment verification의 Sprint assignment는 `PENDING ARCHITECTURE OWNER DECISION`이다.

## GOV-001 Publication Approval governance boundary

| 항목 | SP-008 / FEAT-014 | FEAT-015 |
|---|---|---|
| Requirement | REQ-CONST-002–004/007/010/012/013 | Publication execution requirements |
| Entity ownership | Client Proposal, Publication Approval, Immutable Representation Snapshot | Publication, Publication Target, Published Listing Projection |
| API | API-013 approval lifecycle only | API-014 execution, delivery, reconciliation |
| Workflow | WF-008/009 | WF-010–012 |
| Test | TEST-021/022, TEST-033 SP-008 partition | TEST-033 FEAT-015 partition |

SP-008은 `Publication Target`을 read-only dependency로 참조하며 Publication lifecycle을 소유하지 않는다.

## Sprint controls

- Sprint scope는 Ready Features만 포함한다.
- spillover는 silent carry-over가 아니라 status/risk/dependency와 release impact를 갱신한다.
- failed critical test, unresolved P0/P1 또는 missing approval이 있으면 Sprint exit가 아니다.
- demo는 success path뿐 아니라 unauthorized/failure/recovery와 observability evidence를 포함한다.

## Capacity

calendar estimate, velocity와 staffing은 제공된 근거가 없어 확정하지 않는다.

> **OPEN DECISION:** team composition, WIP limit, review capacity, Sprint cadence와 environment concurrency.
