# Phase 11-10 Test Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-058 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Quality Owner / Architecture Owner |
| 기준일 | 2026-07-26 |

## 1. Coverage summary

| Coverage area | Target | Covered | Coverage | Status |
|---|---:|---:|---:|---|
| Canonical governance Test | 10 | 10 | 100% | MAPPED |
| Required field | 13 per Test | 13 per Test | 100% | VERIFIED |
| Test Category | 6 | 6 | 100% | VERIFIED |
| Required canonical Registry | 9 | 9 | 100% | MAPPED |
| Allowed Evidence type | 5 | 5 | 100% | VERIFIED |
| Cross-registry edge | 8 | 8 | 100% | MAPPED |
| Fully verified cross-registry edge | 8 | 4 | 50% | PARTIALLY_VERIFIED |
| Coverage gap zero target | 0 | 5 open | 0% | NOT MET |
| Frozen product Test identity | 56 | 56 | 100% | PRESERVED |

## 2. Test catalog coverage

| Test range | Validation purpose | Count | Status |
|---|---|---:|---|
| TST-001/002 | Decision and RTM governance/trace | 2 | VERIFIED |
| TST-003~006 | Publication, Workflow, API and Security validation | 4 | PARTIALLY_VERIFIED |
| TST-007/008 | Projection and Event validation | 2 | VERIFIED |
| TST-009 | Operations validation | 1 | PARTIALLY_VERIFIED |
| TST-010 | end-to-end cross-registry validation | 1 | PARTIALLY_VERIFIED |

## 3. Classification coverage

| Category | Covered Test | Coverage |
|---|---|---:|
| Registry Validation | TST-003/005 | 100% |
| Consistency Validation | TST-004/008 | 100% |
| Coverage Validation | TST-007/009 | 100% |
| Traceability Validation | TST-002 | 100% |
| Governance Validation | TST-001/006 | 100% |
| Cross-Registry Validation | TST-010 | 100% |

## 4. Architecture coverage

| Architecture element | Governance Test | Product-test evidence | Coverage |
|---|---|---|---|
| Architecture Decision | TST-001/002 | TEST-005/056 and Decision Trace mappings | MAPPED |
| Requirements/RTM | TST-002 | TEST-001~056 across REQ-CONST-001~013 | MAPPED |
| Publication | TST-003 | TEST-002~004/008/011/012/022~025/033/035~037/049/051~056 | PARTIAL |
| Workflow | TST-004 | TEST-001~056 across WF-001~012 | PARTIAL |
| API | TST-005 | TEST-001~056 across API-001~019 | PARTIAL |
| Security | TST-006 | TEST-009/022~025/026/033~037/046~056 | PARTIAL |
| Projection | TST-007 | mapped functional/security/operations TEST families | MAPPED |
| Event | TST-008 | TEST-001~003/021~025/033/035~037/047/049/051~053/056 | MAPPED |
| Operations | TST-009 | TEST-049~056 across OPS-001~032 | PARTIAL |

## 5. Cross-registry coverage

| Edge | Structural trace | Fully verified | Gap |
|---|---|---|---|
| Decision ↔ RTM | yes | yes | none |
| RTM ↔ Workflow | yes | yes | none |
| Workflow ↔ API | yes | no | current partial status |
| API ↔ Security | yes | no | current partial status |
| Security ↔ Projection | yes | yes | none |
| Projection ↔ Event | yes | yes | none |
| Event ↔ Operations | yes | no | Operations conflict |
| Operations ↔ Test | yes | no | Operations conflict |

Structural orphan edge는 0이지만 unresolved semantic/status edge는 4다.

## 6. Evidence coverage

| Evidence type | Used by | Coverage |
|---|---|---:|
| Registry | TST-001~010 | 100% |
| Decision | TST-001~010 as applicable | 100% |
| RTM | TST-001~010 as applicable | 100% |
| Mapping | TST-001~010 | 100% |
| Validation Report | TST-001~010 | 100% |

운영 로그와 구현 로그를 architecture evidence로 사용한 Test는 0이다.

## 7. Gap coverage

| Gap ID | Area | Affected TST | Status |
|---|---|---|---|
| GAP-TST-001 | Publication reciprocal mapping | TST-003/010 | OPEN |
| GAP-TST-002 | Workflow reciprocal mapping | TST-004/010 | OPEN |
| GAP-TST-003 | API reciprocal/operational mapping | TST-005/010 | OPEN |
| GAP-TST-004 | Security-to-Test mapping | TST-006/010 | OPEN |
| GAP-TST-005 | Operations identity/action vocabulary | TST-009/010 | BLOCKING |

## 8. Authority and scope coverage

| Prohibited scope/authority | Introduced |
|---|---:|
| Production code / DB schema | 0 |
| Unit / Integration / E2E test | 0 |
| Test automation | 0 |
| Runtime/operations evidence | 0 |
| Test-created business decision/state | 0 |
| Frozen TEST renumbering | 0 |
| FEAT-015 implementation | 0 |

## 9. Coverage conclusion

`MODIFY_AND_REVIEW`

Direct catalog와 structural trace coverage는 100%지만 fully verified cross-registry coverage는 50%이고 coverage gap이 5개다. 따라서 `Coverage Gap 없음`과 `Broken Mapping 없음` 완료 조건을 충족하지 못한다.
