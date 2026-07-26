# Phase 11-3 Publication Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-037 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Publication Owner / Quality Owner |
| 기준일 | 2026-07-24 |

## Coverage summary

| Coverage dimension | Target | Covered | Deferred | Orphan |
|---|---:|---:|---:|---:|
| Primary AO/DEC | 9 | 9 | 0 | 0 |
| Supporting AO/DEC | 4 | 4 | 0 | 0 |
| Canonical business state | 8 | 8 | 0 | 0 |
| Requested lifecycle term | 8 | 8 | 0 | 0 |
| Lifecycle transition | 20 | 20 | 0 | 0 |
| Version role | 7 | 7 | 1 derived | 0 |
| Authority component | 3 | 3 | 0 | 0 |
| Registry role | 8 | 8 | 2 placeholders | 0 |

## Architecture coverage

| Concern | Decision | Registry coverage |
|---|---|---|
| Publication truth and Attempt ownership | DEC-100 | aggregate/record/identity contract |
| Canonical lifecycle | DEC-101 | state, suspension, transitions, forbidden transitions |
| Target/Channel binding | DEC-102 | exact immutable cardinality and version |
| Live revalidation | DEC-105 | command authorization states and guards |
| Evidence/Reconciliation | DEC-108 | UNKNOWN, Evidence, Resolution transitions |
| Correction materiality | DEC-109 | same-Publication non-material versus Successor material |
| Withdrawal | DEC-110 | authorization/status/Attempt/non-exposure evidence |
| Republish | DEC-111 | same-intent new command/Attempt and origin-state recovery |
| Projection consistency | DEC-112 | authority-free version/drift/rebuild contract |

Supporting DEC-103/104/106/107의 Provider/Connector ownership, API surface, SoD와 idempotency는 authority/version/command guard에 연결했다.

## Registry coverage

| Registry | Reference | Status |
|---|---|---|
| Decision Register | [DOC-CORE-020](../00_DECISION_REGISTER.md) | VERIFIED |
| RTM | [DOC-CORE-035](../00_CANONICAL_TRACEABILITY_MATRIX.md) | VERIFIED |
| Workflow Registry | [DOC-WF-001](../book-5/00_WORKFLOW_INDEX.md) | PARTIALLY_VERIFIED |
| API Registry | [DOC-API-017](../book-6/16_API_REGISTRY.md) | PARTIALLY_VERIFIED |
| Security Registry | [DOC-SEC-016](../book-8/15_SECURITY_REGISTRY.md) | PARTIALLY_VERIFIED |
| Projection Registry | PRJ-PH | DEFERRED |
| Event Registry | EVT-PH | DEFERRED |
| Test Registry | [DOC-TEST-016](../book-10/15_TEST_REGISTRY.md) | PARTIALLY_VERIFIED |

## Authority exclusion coverage

Projection, Cache, Search Index, Dashboard, Analytics, AI, Connector와 External Provider는 8/8 모두 non-authoritative로 분류했다. Connector는 exact Authorized Publication Command를 실행하고 Evidence를 반환할 수 있지만 command authority나 state truth를 만들 수 없다.

## Coverage decision

Publication aggregate, lifecycle, version, authorization, Target/Channel, Withdrawal, Republish와 Projection reference는 모두 Registry에 정렬됐다. Projection/Event physical registries는 허용된 placeholder로 남으며 broken mapping으로 계산하지 않는다.

Architecture Owner 승인 후 이 Registry는 Publication Governance의 freeze candidate가 된다. FEAT-015 implementation과 frozen Workflow/API 문서 correction은 별도 authorization 대상이다.
