# Phase 11-2 RTM Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-034 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Quality Owner |
| 기준일 | 2026-07-24 |

## Coverage summary

| Coverage dimension | Target | Covered | Deferred | Orphan |
|---|---:|---:|---:|---:|
| Constitutional Requirement | 13 | 13 | 0 | 0 |
| Target AO | 13 | 13 | 0 | 0 |
| Target DEC | 13 | 13 | 0 | 0 |
| Registry role | 8 | 8 | 2 placeholders | 0 |
| Requirement-to-Test mapping | 13 | 13 | 0 | 0 |
| Validation Status record | 13 | 13 | 3 rows | 0 |

## Category coverage

| Category | Requirements | Coverage |
|---|---|---|
| Functional | REQ-CONST-002/003/011/012 | 4/4 |
| Non-functional | REQ-CONST-005/007/009 | 3/3 through Data Integrity, Audit and Operations controls |
| Security | REQ-CONST-001/003/004/007–010/012 | 8/8 |
| Audit | REQ-CONST-005/007 | 2/2 |
| Privacy | REQ-CONST-004/013 | 2/2 |
| Operations | REQ-CONST-009 | 1/1 |
| Governance | REQ-CONST-001/002/006/008/013 | 5/5 |

한 Requirement가 복수 category에 속할 수 있으므로 category 합계는 13을 초과한다.

## Decision coverage

- AO-023–AO-035와 DEC-100–DEC-112: 13/13 direct Requirement mapping.
- DEC-100–112 중 orphan Decision: 0.
- `REQ-CONST-001`: DEC-024 upstream constraint와 target Decision consumer 연결.
- `REQ-CONST-011`: DEC-003 upstream prerequisite와 target Decision consumer 연결.
- Full supersession: 0; DEC-109/111 scoped refinement는 [Decision Register](../00_DECISION_REGISTER.md)를 따른다.

## Registry coverage

| Registry role | Reference | Coverage state |
|---|---|---|
| Decision Register | [DOC-CORE-020](../00_DECISION_REGISTER.md) | AVAILABLE |
| Publication Registry | [Publication Model](../book-3/11_PUBLICATION_MODEL.md), [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md) | AVAILABLE |
| Workflow Registry | [DOC-WF-001](../book-5/00_WORKFLOW_INDEX.md) | AVAILABLE |
| API Registry | [DOC-API-017](../book-6/16_API_REGISTRY.md) | AVAILABLE |
| Security Registry | [DOC-SEC-016](../book-8/15_SECURITY_REGISTRY.md) | AVAILABLE |
| Projection Registry | [Publication Model](../book-3/11_PUBLICATION_MODEL.md), [Indexing and Search Strategy](../book-3/14_INDEXING_AND_SEARCH_STRATEGY.md) | DEFERRED PLACEHOLDER |
| Event Registry | [DOC-ARCH-007](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md) | DEFERRED PLACEHOLDER |
| Test Registry | [DOC-TEST-016](../book-10/15_TEST_REGISTRY.md) | AVAILABLE |

## End-to-End coverage decision

모든 Requirement는 Decision relationship, Registry reference, Workflow/API/Security control, Test와 Validation Status를 가진다. `PRJ-PH`와 `EVT-PH`는 허용된 placeholder이며 broken trace로 계산하지 않는다. 따라서 RTM은 Architecture v1.1 alignment candidate로 freeze review에 제출할 준비가 됐다.

FEAT-015 implementation, runtime test PASS, physical Projection/Event architecture와 provider/queue/storage 선택은 이 coverage의 의미에 포함되지 않는다.
