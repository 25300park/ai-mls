# Phase 11-8 Event Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-052 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Quality Owner |
| 기준일 | 2026-07-24 |

## 1. Coverage summary

| Coverage area | Target | Covered | Coverage | Notes |
|---|---:|---:|---:|---|
| Canonical Event | 12 | 12 | 100% | EVT-001~012 |
| Required field | 17 per Event | 17 per Event | 100% | Status is additional |
| Event Type | 2 | 2 | 100% | Business / Technical |
| Event Category | 6 | 6 | 100% | primary or secondary category |
| Identity field | 5 | 5 | 100% | immutable event/aggregate/version/sequence/time |
| Version role | 4 | 4 | 100% | no conflation |
| Replay mode | 4 | 4 | 100% | no-side-effect boundary |
| Retention category | 4 | 4 | 100% | Legal Hold aware |
| Required Registry | 8 | 8 | 100% | Decision/RTM/Publication/Workflow/API/Security/Projection/Test |

## 2. Event catalog coverage

| Event range | Business purpose | Count | Coverage |
|---|---|---:|---:|
| EVT-001/002 | Publication request/approval governance | 2 | 100% |
| EVT-003/004 | activation/suspension lifecycle | 2 | 100% |
| EVT-005/006 | revalidation/reconciliation | 2 | 100% |
| EVT-007/008 | withdrawal/republish | 2 | 100% |
| EVT-009 | materiality disposition | 1 | 100% |
| EVT-010/011 | Projection rebuild operation | 2 | 100% |
| EVT-012 | replay recovery evidence | 1 | 100% |

## 3. Workflow and API coverage

| Boundary | Events | Workflow | API |
|---|---|---|---|
| Approval request/effective approval | EVT-001/002 | WF-009/010 | API-013/014/016 |
| Publication lifecycle | EVT-003/004/007/008 | WF-010/012 | API-014/016/018/019 |
| Revalidation | EVT-005 | WF-011/012 | API-011/012/014/016/017 |
| Reconciliation | EVT-006 | WF-010/012 | API-014/016/018/019 |
| Materiality | EVT-009 | WF-009/010/012 | API-013/014/016 |
| Projection rebuild/replay | EVT-010~012 | WF-012 context only | API-016/017 |

Every Event has at least one Workflow and API mapping. Event가 Workflow/API command를 실행하거나 authority를 생성하는 mapping은 0이다.

## 4. Projection coverage

| Projection | Mapped Event |
|---|---|
| PRJ-001 Search | EVT-003/004/007/008 and EVT-010~012 |
| PRJ-002 Listing | EVT-002~012 |
| PRJ-003 Client | EVT-005 and EVT-010~012 |
| PRJ-004 Dashboard | EVT-001~012 |
| PRJ-005 Analytics | EVT-003/006~012 |
| PRJ-006 Notification | EVT-001~009 for derived state; EVT-010~012 operation evidence only and cannot resend |
| PRJ-007 Integration | EVT-003/004/006~008 and EVT-010~012 |
| PRJ-008 Cache | EVT-003~012 |

PRJ-001~008은 모두 하나 이상의 Event와 연결되며 Event/Projection 모두 business authority가 없다.

## 5. Security coverage

| Security concern | Registry coverage | Result |
|---|---|---|
| Zero Trust / Default Deny | SEC-001/002 | COVERED |
| Human authority / SoD | SEC-010/011 | COVERED |
| Classification / privacy / purpose | SEC-013~015 | COVERED |
| Encryption/key/secret | SEC-017~020 | COVERED |
| Audit/Event integrity | SEC-021~024 | COVERED |
| Recovery/restore/replay | SEC-025/027~030 | COVERED |
| AI/Connector authority prohibition | SEC-031/032 | COVERED |

## 6. Test coverage

| Test family | Event concern |
|---|---|
| TEST-001~003/021/022/033/047 | Approval and human authority |
| TEST-023~025/033/036/037 | Publication, reconciliation, recovery |
| TEST-035/049/051~053 | job/event/audit/replay integrity |
| TEST-056 | regression and release acceptance |

모든 Event row는 하나 이상의 existing `TEST-*`에 연결된다. 이 coverage는 specification mapping이며 runtime PASS evidence가 아니다.

## 7. RTM and Decision coverage

- Primary Decision: AO-035 / DEC-112.
- Constraint Decisions: AO-023~AO-034 / DEC-100~DEC-111.
- Requirements: `REQ-CONST-001/002/005~010/012/013`.
- Trace nodes: `TRACE-014/015/017~020/023/024`.
- Orphan Event: 0.
- Requirement 없는 Event: 0.
- Decision 없는 Event: 0.
- Test 없는 Event: 0.

## 8. Boundary coverage

| Prohibited scope | Introduced |
|---|---:|
| Production code / DB schema | 0 |
| Event Bus / Queue / Event Store | 0 |
| Provider/product selection | 0 |
| Physical payload schema | 0 |
| New API / Workflow / SEC / Projection ID | 0 |
| FEAT-015 implementation | 0 |

## 9. Coverage conclusion

`APPROVE_EVENT_REGISTRY`

Phase 11-8 governance target은 100% mapped되었고 missing/duplicate/broken reference는 검증 전제상 0이다. Runtime implementation과 test execution은 별도 승인 범위로 남는다.
