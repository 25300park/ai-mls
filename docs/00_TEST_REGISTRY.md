# AI-MLS Canonical Test Registry Alignment Candidate

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-054 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Quality Owner / Architecture Owner |
| 기준일 | 2026-07-26 |
| 적용 범위 | Phase 11-10 Test Registry Alignment |
| Frozen test source | [Book 10 Test Registry](book-10/15_TEST_REGISTRY.md) |

## 1. 목적과 governance boundary

이 문서는 Phase 11-1~11-9 canonical Registry가 architecture evidence만으로 검증 가능한지 정의하는 governance validation catalog다. Test implementation, executable suite, runtime result, 운영 로그와 FEAT-015 behavior를 만들지 않는다.

- `TST-001`~`TST-010`은 Registry alignment를 검증하는 governance identity다.
- Frozen `TEST-001`~`TEST-056`은 requirement, workflow, API, UI, AI, security와 operation behavior를 검증하는 logical product-test identity다.
- `TST-*`는 `TEST-*`를 대체·재번호화·supersede하지 않는다.
- Test, validation report와 evidence는 Business Authority, Approval, Publication, Policy Override 또는 production state를 생성하지 않는다.
- `VERIFIED`는 architecture evidence가 success criteria를 만족한다는 의미일 뿐 executable test가 실행되거나 통과했다는 뜻이 아니다.

## 2. Canonical sources

| 약어 | Registry / Evidence | 역할 |
|---|---|---|
| DR | [Decision Register](00_DECISION_REGISTER.md), [Decision Trace Matrix](00_DECISION_TRACE_MATRIX.md) | decision identity, status, dependency와 trace |
| RTM | [Canonical Traceability Matrix](00_CANONICAL_TRACEABILITY_MATRIX.md) | requirement-to-test end-to-end trace |
| PR | [Publication Registry](00_PUBLICATION_REGISTRY.md) | Publication truth, lifecycle, version와 authority boundary |
| WR | [Workflow Registry](00_WORKFLOW_REGISTRY.md) | workflow state, transition, command와 authority boundary |
| AR | [API Registry](00_API_REGISTRY.md) | contract, command/query, authorization와 version boundary |
| SR | [Security Registry](00_SECURITY_REGISTRY.md) | security control, SoD, classification, audit와 recovery |
| PJR | [Projection Registry](00_PROJECTION_REGISTRY.md) | derived projection lifecycle, drift와 rebuild |
| ER | [Event Registry](00_EVENT_REGISTRY.md) | immutable event identity, ordering, replay와 retention |
| OR | [Operations Registry Alignment Candidate](00_OPERATIONS_REGISTRY.md) | operation identity, authority, recovery, monitoring와 audit |
| BTR | [Book 10 Test Registry](book-10/15_TEST_REGISTRY.md) | frozen `TEST-001`~`TEST-056` product validation mapping |

## 3. Validation status vocabulary

| Status | 의미 |
|---|---|
| VERIFIED | Architecture evidence가 정의된 success criteria를 충족함 |
| PARTIALLY_VERIFIED | Mapping은 존재하지만 unresolved conflict, partial source status 또는 approval gap이 있음 |
| DEFERRED | 현재 architecture scope에서 명시적으로 후속 결정으로 이관됨 |

`DEFINED`, `READY`, `EXECUTED`, `PASSED`, `FAILED`, `BLOCKED`, `RETIRED`는 frozen Book 10의 execution lifecycle status이며 이 governance validation status와 혼용하지 않는다.

## 4. Canonical test catalog

| Test ID | Test Name | Test Category | Validation Target | Registry Target | Related Decision | Related Workflow | Related API | Related Security Control | Success Criteria | Failure Criteria | Evidence | Validation Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TST-001 | Decision Validation | Governance Validation | unique decision/AO identity, status, dependency, cross-reference, version and boundary | DR, RTM | DEC-001~112; AO-023~035 | WF-009~012 for AO-023~035 trace | API-013~019 for AO-023~035 trace | SEC-001/002/010/011/021/022/026/032 | registered decisions have valid identity/status/dependency and testable trace; duplicate/cycle/broken reference 0 | missing/duplicate decision, invalid status/version, circular dependency or untraceable decision | DR; Decision Index/Dependency/Trace Matrix; Phase 11-1 validation; Phase 11-7/8 gap resolution evidence | VERIFIED |
| TST-002 | RTM Validation | Traceability Validation | requirement-to-decision-to-registry-to-test chain and orphan coverage | RTM, DR, WR, AR, SR, BTR | DEC-001~112; AO-023~035 | WF-001~012 | API-001~019 | SEC-001~034 | all canonical requirements and trace nodes have decision/registry/test links; orphan and duplicate trace 0 | requirement, decision, registry, test or validation link missing or duplicated | RTM; Requirement Index; Phase 11-2 validation/coverage; BTR | VERIFIED |
| TST-003 | Publication Validation | Registry Validation | Publication aggregate identity, lifecycle, version, target/channel, authorization, withdrawal/republish and projection boundary | PR, DR, RTM, WR, AR, SR, PJR, ER, BTR | DEC-100~112; AO-023~035 | WF-009~012 | API-013~019 | SEC-001/002/010/011/013~015/021~025/027/028/030/032 | canonical truth and authority remain in Publication aggregate; required mappings and evidence are current | mixed ownership, invalid lifecycle/version, authority leakage, missing mapping or partial status without disposition | PR; Publication Index; Phase 11-3 validation/coverage; TEST-002~004/008/011/012/022~025/033/035~037/049/051~056 | VERIFIED |
| TST-004 | Workflow Validation | Consistency Validation | WF identity, entry/exit, transition, command, authorization, revalidation, idempotency and recovery | WR, RTM, PR, AR, SR, PJR, ER, BTR | DEC-100/101/104~112 | WF-001~012 | API-002/004/006/009~019 | SEC-001~034 as mapped | every workflow has entry/exit/command/authority/test trace and cannot bypass aggregate authority | missing/duplicate workflow, invalid transition/command, circular path, broken or partial unresolved mapping | WR; Workflow Index; Phase 11-4 validation/coverage; TEST-001~056 mappings | VERIFIED |
| TST-005 | API Validation | Registry Validation | API identity, contract profile, command/query/internal classification, version, authorization, idempotency and revalidation | AR, RTM, WR, PR, SR, PJR, ER, BTR | DEC-100/104~108/110~112; DEC-101~103/109 | WF-001~012 | API-001~019 | SEC-001~034 as mapped | every API has valid contract/authority/version/test trace; query and internal operation have no business mutation authority | missing/duplicate API, invalid contract/version, unauthorized command, query mutation or unresolved mapping | AR; API Index; Phase 11-5 validation/coverage; TEST-001~056 mappings | VERIFIED |
| TST-006 | Security Validation | Governance Validation | control identity, Zero Trust, Default Deny, actor-level SoD, classification, audit, recovery and non-human authority prohibition | SR, DR, RTM, WR, AR, PR, PJR, ER, BTR | DEC-100/103~112; DEC-101/102 supporting | WF-001~012 | API-001~019 | SEC-001~034 | every security control has authority/classification/audit/test trace and no escalation or leakage | missing/duplicate control, invalid authorization/classification, SoD violation, leakage or unresolved test mapping | SR; Security Index; Phase 11-6 validation/coverage; TEST-009/022~025/026/033~037/046~056 | VERIFIED |
| TST-007 | Projection Validation | Coverage Validation | PRJ identity, type, owner, lifecycle, version, classification, drift, rebuild and no-authority boundary | PJR, DR, RTM, PR, WR, AR, SR, ER, BTR | DEC-112 / AO-035; DEC-100~111 constraints | WF-001~012 context only | read/internal APIs as mapped | SEC-001/002/013~015/021~024/028/031/032 | PRJ-001~008 each has source/version/security/rebuild/test trace and derived-only authority | missing/duplicate projection, source/event/version drift, invalid owner/lifecycle/classification or broken mapping | PJR; Projection Index; Phase 11-7 validation/coverage; mapped TEST families | VERIFIED |
| TST-008 | Event Validation | Consistency Validation | EVT identity, aggregate ordering, version, classification, replay, retention and consumer boundary | ER, DR, RTM, PR, WR, AR, SR, PJR, BTR | DEC-112 / AO-035; DEC-100~111 constraints | WF-009~012 source/context | API-011~019 source/query/internal boundary | SEC-001/002/013~015/021~024/028~032 | EVT-001~012 each has immutable identity/order/version/security/replay/test trace and no decision authority | missing/duplicate/out-of-order event, invalid version/replay/classification or broken mapping | ER; Event Index; Phase 11-8 validation/coverage; TEST-001~003/021~025/033/035~037/047/049/051~053/056 | VERIFIED |
| TST-009 | Operations Validation | Coverage Validation | frozen OPS identity, category, authority, dependency, recovery, monitoring, audit and validation | OR, DR, RTM, WR, AR, SR, PR, PJR, ER, BTR | DEC-059~067/073/090; AO-023~035 constraints | WF-001~012 context | API-001~019 context/internal boundary | SEC-001~034 | OPS-001~032 remain unique and mapped; operation has no business authority; Brief vocabulary conflict 0 | missing/duplicate operation, invalid authority/recovery/audit, broken mapping or unresolved ID/action vocabulary | OR; Operations Index; Phase 11-9 validation/coverage; TEST-049~056 | VERIFIED |
| TST-010 | Cross-Registry Validation | Cross-Registry Validation | complete Decision-to-Test chain, reciprocal identity, status compatibility, broken link and coverage-gap scan | DR, RTM, PR, WR, AR, SR, PJR, ER, OR, BTR | all registered decisions; AO-023~035 focus | WF-001~012 | API-001~019 | SEC-001~034 | nine required cross-registry edges resolve, current statuses are compatible, broken chain and coverage gap 0 | missing source/target, inconsistent identity/status, orphan mapping, unresolved partial status or inherited blocker | all canonical registries; Phase 11-1~11-9 validation/coverage reports; this Registry | VERIFIED |

## 5. Test classification

| Category | TST coverage | Governance purpose |
|---|---|---|
| Registry Validation | TST-003/005 | catalog identity와 required field/contract 검증 |
| Consistency Validation | TST-004/008 | lifecycle, transition, version, ordering과 authority consistency 검증 |
| Coverage Validation | TST-007/009 | canonical IDs, fields, categories와 mapped control coverage 검증 |
| Traceability Validation | TST-002 | requirement-to-validation end-to-end trace 검증 |
| Governance Validation | TST-001/006 | decision/status/security governance와 change boundary 검증 |
| Cross-Registry Validation | TST-010 | Registry 사이 chain, reciprocal identity와 status 검증 |

새 Test Category는 추가하지 않았다.

## 6. Validation policy

모든 `TST-*`는 catalog row의 Success Criteria와 Failure Criteria를 normative rule로 사용한다.

1. Validation Rule: named Registry의 canonical ID, required field, status와 link를 source evidence에 대조한다.
2. Expected Result: success criteria 전부 충족, failure criteria 0, evidence source 존재.
3. Pass Condition: current evidence로 gap/duplicate/broken mapping 없이 재현 가능하다.
4. Fail Condition: failure criteria 하나 이상 또는 필요한 evidence가 없다.
5. Evidence Source: Registry, Decision, RTM, Mapping, Validation Report만 허용한다.

운영 로그, 구현 로그, runtime test result, source code와 production data는 Phase 11-10 evidence가 아니다.

## 7. Cross-registry validation chain

| Chain | Validation Test | Current evidence | Status |
|---|---|---|---|
| Decision ↔ RTM | TST-001/002 | DR decision trace and RTM requirement/test nodes | VERIFIED |
| RTM ↔ Publication | TST-002/003 | REQ-CONST-001~013 and TRACE-014/015/017~020/023/024 map to Publication identity, lifecycle, authority and validation evidence | VERIFIED |
| RTM ↔ Workflow | TST-002/004 | 13 requirements to WF-001~012 | VERIFIED |
| Workflow ↔ API | TST-004/005 | WF-001~012 reciprocal API-001~019 mapping and command/query authority boundary | VERIFIED |
| API ↔ Security | TST-005/006 | API-001~019 reciprocal SEC-001~034 enforcement mapping | VERIFIED |
| Security ↔ Projection | TST-006/007 | classification/purpose/audit inheritance to PRJ-001~008 | VERIFIED |
| Projection ↔ Event | TST-007/008 | PRJ consumers mapped to EVT-001~012 | VERIFIED |
| Event ↔ Operations | TST-008/009 | EVT-001~012 reciprocal OPS consumption/audit mapping; replay has no business or external effect | VERIFIED |
| Operations ↔ Test | TST-009/010 | OPS-001~032 reciprocal TST-009/010 validation mapping; capability aliases reuse no OPS ID | VERIFIED |

9개 edge 모두 reciprocal document-level trace와 governance evidence를 가지며 완전 검증됐다. 이 검증은 architecture contract를 대상으로 하며 runtime implementation PASS를 주장하지 않는다.

## 8. Coverage gaps

| Gap ID | Description | Affected Test | Required disposition |
|---|---|---|---|
| GAP-TST-001 | Publication Registry reciprocal Workflow/API/Security/Test mapping | TST-003/010 | RESOLVED — all four mappings VERIFIED |
| GAP-TST-002 | Workflow Registry reciprocal API/Security/Test mapping | TST-004/010 | RESOLVED — all three mappings VERIFIED |
| GAP-TST-003 | API Registry reciprocal Security/Test and operational-boundary mapping | TST-005/010 | RESOLVED — governance contract evidence verified; runtime remains out of scope |
| GAP-TST-004 | Security Registry reciprocal Test mapping | TST-006/010 | RESOLVED — TST-006/010 evidence added |
| GAP-TST-005 | Requested Operations labels and Deploy/Rollback authority vocabulary | TST-009/010 | RESOLVED — non-ID capability aliases and guarded operational capability |

## 9. Authority boundary

Test author, executor, validation engine, report, dashboard와 evidence store는 다음 authority를 갖지 않는다.

- production state mutation;
- Verification, Permission, Approval 또는 Publication decision;
- Publish, Withdraw, Republish 또는 external effect;
- Policy Override, access grant 또는 classification downgrade;
- failed/partial result를 success로 승격하는 authority.

## 10. Final recommendation

`APPROVE_TEST_REGISTRY_ALIGNMENT`

`TST-001`~`TST-010`, required fields, categories, evidence policy와 9개 reciprocal cross-registry chain이 모두 검증됐다. GAP-TST-001~005는 모두 해소됐으며 open coverage gap은 0이다. Governance validation은 implementation 또는 runtime test PASS를 대체하지 않는다.
