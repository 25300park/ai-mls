# AI-MLS Test Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-055 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Quality Owner / Architecture Owner |
| 기준일 | 2026-07-26 |
| 기준 Registry | [Canonical Test Registry Alignment Candidate](00_TEST_REGISTRY.md) |

## 1. Namespace index

| Namespace | Canonical source | Purpose | Relationship |
|---|---|---|---|
| TST-001~010 | [Canonical Test Registry Alignment Candidate](00_TEST_REGISTRY.md) | architecture Registry validation governance | Phase 11-10 candidate |
| TEST-001~056 | [Frozen Book 10 Test Registry](book-10/15_TEST_REGISTRY.md) | requirement/workflow/API/UI/AI/security/operation behavior validation | preserved; not superseded |

## 2. Canonical test index

| Test ID | Test Name | Category | Primary Registry | Status |
|---|---|---|---|---|
| TST-001 | Decision Validation | Governance Validation | Decision Register | VERIFIED |
| TST-002 | RTM Validation | Traceability Validation | RTM | VERIFIED |
| TST-003 | Publication Validation | Registry Validation | Publication Registry | PARTIALLY_VERIFIED |
| TST-004 | Workflow Validation | Consistency Validation | Workflow Registry | PARTIALLY_VERIFIED |
| TST-005 | API Validation | Registry Validation | API Registry | PARTIALLY_VERIFIED |
| TST-006 | Security Validation | Governance Validation | Security Registry | PARTIALLY_VERIFIED |
| TST-007 | Projection Validation | Coverage Validation | Projection Registry | VERIFIED |
| TST-008 | Event Validation | Consistency Validation | Event Registry | VERIFIED |
| TST-009 | Operations Validation | Coverage Validation | Operations Registry | PARTIALLY_VERIFIED |
| TST-010 | Cross-Registry Validation | Cross-Registry Validation | all canonical registries | PARTIALLY_VERIFIED |

## 3. Category index

| Category | Test IDs |
|---|---|
| Registry Validation | TST-003/005 |
| Consistency Validation | TST-004/008 |
| Coverage Validation | TST-007/009 |
| Traceability Validation | TST-002 |
| Governance Validation | TST-001/006 |
| Cross-Registry Validation | TST-010 |

## 4. Registry lookup

| Registry | Direct Test | Cross-validation Test |
|---|---|---|
| Decision Register | TST-001 | TST-002/010 |
| RTM | TST-002 | TST-001/004/010 |
| Publication Registry | TST-003 | TST-004/005/006/007/008/010 |
| Workflow Registry | TST-004 | TST-002/003/005/010 |
| API Registry | TST-005 | TST-003/004/006/010 |
| Security Registry | TST-006 | TST-003/005/007/010 |
| Projection Registry | TST-007 | TST-003/006/008/010 |
| Event Registry | TST-008 | TST-007/009/010 |
| Operations Registry | TST-009 | TST-008/010 |
| Book 10 Test Registry | TST-010 | TST-001~009 |

## 5. Cross-registry chain index

| Chain | Tests | Status |
|---|---|---|
| Decision ↔ RTM | TST-001/002 | VERIFIED |
| RTM ↔ Workflow | TST-002/004 | VERIFIED |
| Workflow ↔ API | TST-004/005 | PARTIALLY_VERIFIED |
| API ↔ Security | TST-005/006 | PARTIALLY_VERIFIED |
| Security ↔ Projection | TST-006/007 | VERIFIED |
| Projection ↔ Event | TST-007/008 | VERIFIED |
| Event ↔ Operations | TST-008/009 | PARTIALLY_VERIFIED |
| Operations ↔ Test | TST-009/010 | PARTIALLY_VERIFIED |

## 6. Evidence lookup

| Evidence type | Allowed source |
|---|---|
| Registry | `docs/00_*_REGISTRY.md`, frozen Book registries |
| Decision | Decision Register, Index, Dependency/Trace Matrix |
| RTM | Canonical RTM and Requirement Index |
| Mapping | canonical Registry mapping tables |
| Validation Report | `docs/reviews/PHASE11_*_VALIDATION.md` and coverage evidence |

운영 로그, 구현 로그, runtime test result와 production data는 Phase 11-10 evidence가 아니다.

## 7. Gap index

| Gap | Affected Test |
|---|---|
| Publication mapping partial status | TST-003/010 |
| Workflow/API/Security/Test reciprocal status | TST-004~006/010 |
| Operations ID/action vocabulary conflict | TST-009/010 |

## 8. Scope boundary and recommendation

- Test implementation, automation, source code, DB schema와 FEAT-015 변경: 없음.
- `TST-*`는 governance validation identity이고 `TEST-*` execution identity를 변경하지 않는다.
- Final recommendation: `MODIFY_AND_REVIEW`.
