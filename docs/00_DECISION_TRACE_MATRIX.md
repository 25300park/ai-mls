# Decision Trace Matrix — AO-023–AO-035

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-038 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Quality Owner |
| 기준일 | 2026-07-24 |
| Effective Version | Architecture v1.1 |

## Purpose

DEC-100–DEC-112를 FEAT-015, API, Workflow, Security, Test와 RTM에 연결한다. 이 matrix는 기존 Registry의 의미나 ID를 변경하지 않으며 현재 존재하는 canonical Registry만 참조한다.

## Registry sources

| Registry role | Current canonical source | Current status |
|---|---|---|
| Publication Registry | [Canonical Publication Registry](00_PUBLICATION_REGISTRY.md) (DOC-CORE-040); [Publication Model](book-3/11_PUBLICATION_MODEL.md) and [Implementation Registry](book-12/15_IMPLEMENTATION_REGISTRY.md) as supporting sources | AVAILABLE — Phase 11-3 aligned candidate |
| Workflow Registry | [Canonical Workflow Registry](00_WORKFLOW_REGISTRY.md) (DOC-CORE-042); [Book 5 Workflow Index](book-5/00_WORKFLOW_INDEX.md) as frozen supporting source | AVAILABLE — Phase 11-4 aligned candidate |
| API Registry | [Canonical API Registry](00_API_REGISTRY.md) (DOC-CORE-044); [Book 6 API Registry](book-6/16_API_REGISTRY.md) as frozen supporting source | AVAILABLE — Phase 11-5 aligned candidate |
| Security Registry | [Canonical Security Registry](00_SECURITY_REGISTRY.md) (DOC-CORE-046); [Book 8 Security Registry](book-8/15_SECURITY_REGISTRY.md) as frozen supporting source | AVAILABLE — Phase 11-6 aligned candidate |
| Projection Registry | [Canonical Projection Registry](00_PROJECTION_REGISTRY.md) (DOC-CORE-048); [Publication Model](book-3/11_PUBLICATION_MODEL.md) and [Indexing and Search Strategy](book-3/14_INDEXING_AND_SEARCH_STRATEGY.md) as frozen supporting sources | AVAILABLE — Phase 11-7 canonical candidate |
| Event Registry | [Canonical Event Registry](00_EVENT_REGISTRY.md) (DOC-CORE-050); [Event and Job Architecture](book-2/06_EVENT_AND_JOB_ARCHITECTURE.md) as frozen supporting source | AVAILABLE — Phase 11-8 canonical candidate |
| Test Registry | [Test Registry](book-10/15_TEST_REGISTRY.md) (DOC-TEST-016) | AVAILABLE |
| RTM | [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md) (DOC-CORE-035), [Requirements Traceability Matrix](governance/REQUIREMENTS_TRACEABILITY_MATRIX.md) | AVAILABLE |

## Decision trace records

| Trace ID | Decision / AO | Feature | API | Workflow | Security | Test | RTM | Projection/Event mapping | Status |
|---|---|---|---|---|---|---|---|---|---|
| DT-100 | DEC-100 / AO-023 | FEAT-015 | API-014 | WF-010–012 | SEC-010/011/013/015/021/022/032 | TEST-023/025/033/049 | TRACE-015 | PRJ-002/007/008; EVT-003/004/006~009 | MAPPED |
| DT-101 | DEC-101 / AO-024 | FEAT-015 | API-014 | WF-010–012 | SEC-010/011/021/022/024/025/028 | TEST-023–025/033/049 | TRACE-015 | PRJ-002/004~008; EVT-003/004/007/008 | MAPPED |
| DT-102 | DEC-102 / AO-025 | FEAT-015 | API-014/015/018/019 | WF-010–012 | SEC-002/013–015/020/021/032 | TEST-008/023/033/036/037 | TRACE-015/019/020 | exact Target/Channel binding in EVT-001~009 | MAPPED |
| DT-103 | DEC-103 / AO-026 | FEAT-015 | API-014/015/018/019 | WF-010–012 | SEC-001/002/017/019/020/024/032 | TEST-008/023/025/035–037/049 | TRACE-015/019/020 | PRJ-007 plus authority-free EVT-003~008/010~012 | MAPPED |
| DT-104 | DEC-104 / AO-027 | FEAT-015 | API-014 | WF-010–012 | SEC-001/002/010/011/021–024/032 | TEST-023–025/033/049 | TRACE-015 | PRJ-002 plus EVT-003~008 API boundary facts | MAPPED |
| DT-105 | DEC-105 / AO-028 | FEAT-014/015 | API-002/013–015/018/019 | WF-009–012 | SEC-001/002/004/008/010/011/020/021/025/028/030/032 | TEST-022/023/025/033/049 | TRACE-014/015/023 | live authority cannot be satisfied by Projection/Event; EVT-005 records revalidation only | MAPPED |
| DT-106 | DEC-106 / AO-029 | FEAT-015 | API-002/014/015/018/019 | WF-010–012 | SEC-001/002/004/007/008/010/011/021/025/028/030/032 | TEST-004/022–025/033/046/049/051/053 | TRACE-015/023 | Projection/worker/Event has no business authority | MAPPED |
| DT-107 | DEC-107 / AO-030 | FEAT-015 | API-014/017–019 | WF-010–012 | SEC-001/002/019–024/028/032 | TEST-023–025/035–037/049/051 | TRACE-015/018–020 | PRJ-001~008 idempotent consumption; EVT-001~012 ordering/replay | MAPPED |
| DT-108 | DEC-108 / AO-031 | FEAT-015 | API-014/016/018/019 | WF-010–012 | SEC-001/002/010/011/013/021–25/027/028/032 | TEST-004/023–025/033/049/051 | TRACE-015/017/019 | EVT-006 resolution precedes Projection update | MAPPED |
| DT-109 | DEC-109 / AO-032 | FEAT-015 | API-013/014/018/019 | WF-009–012 | SEC-001/002/010/011/013–015/021–024/032 | TEST-021–025/033/049 | TRACE-014/015 | EVT-009 materiality disposition; Projection remains derived | MAPPED |
| DT-110 | DEC-110 / AO-033 | FEAT-015 | API-014/016/018/019 | WF-010–012 | SEC-001/002/010/011/013/015/021–25/027/028/032 | TEST-023–025/033/049/051 | TRACE-015/017/019 | EVT-007 updates PRJ-001/002/004~008 after confirmation | MAPPED |
| DT-111 | DEC-111 / AO-034 | FEAT-015 | API-013/014/018/019 | WF-009–012 | SEC-001/002/010/011/013–015/021–25/028/032 | TEST-021–025/033/049 | TRACE-014/015/019 | EVT-008 updates Projection only after confirmed effect | MAPPED |
| DT-112 | DEC-112 / AO-035 | FEAT-015 | API-014/018/019 | WF-010–012 | SEC-001/002/013–15/021–24/028/032 | TEST-023/025/033/049 | TRACE-015/017/018/020/023/024 | PRJ-001~008 and EVT-001~012 registered | MAPPED |

## RTM alignment

- Primary requirement chain: `REQ-CONST-002–007`, `REQ-CONST-009`, `REQ-CONST-012`, `REQ-CONST-013`.
- Primary feature/API/workflow chain: `FEAT-015 → API-014 → WF-010–012 → TRACE-015`.
- Provider/Connector support: `API-018/019 → TRACE-019/020`.
- Approval prerequisite: `FEAT-014 → API-013 → WF-009 → TRACE-014`.
- Audit, jobs and cross-cutting security: `TRACE-017/018/023/024`.
- 이 matrix는 implementation evidence나 FEAT-015 completion을 주장하지 않는다.

## Mapping gaps

1. Projection Registry gap은 [Canonical Projection Registry](00_PROJECTION_REGISTRY.md)의 `PRJ-001`~`PRJ-008`로 해소됐다.
2. Event Registry gap은 [Canonical Event Registry](00_EVENT_REGISTRY.md)의 `EVT-001`~`EVT-012`, identity, ordering, version, replay와 retention contract로 해소됐다.
3. AO-023~AO-035 Decision trace의 missing/duplicate/broken Registry mapping은 0이다. Architecture approval과 runtime FEAT-015 evidence는 별도 gate로 남는다.
