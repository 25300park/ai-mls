# Phase 11-7 Projection Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-049 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Coverage summary

| Dimension | Covered | Total | Coverage | Status |
|---|---:|---:|---:|---|
| Canonical Projection IDs | 8 | 8 | 100% | PARTIALLY_VERIFIED per runtime dependency |
| Projection Types | 8 | 8 | 100% | VERIFIED |
| Required fields | 120 | 120 | 100% | VERIFIED |
| Ownership records | 8 | 8 | 100% | VERIFIED |
| Lifecycle states | 6 | 6 | 100% | VERIFIED |
| Version roles | 6 | 6 | 100% | 5 defined, Event Registry dependency deferred |
| Drift types | 7 | 7 | 100% | VERIFIED governance policy |
| Rebuild strategies | 6 | 6 | 100% | VERIFIED governance policy |
| Registry mappings | 8 | 8 | 100% | 7 mapped, Event Registry deferred |
| Projection business authority | 0 | 0 allowed | compliant | VERIFIED |

## Projection-to-test coverage

| Projection | Primary test mapping | Status |
|---|---|---|
| PRJ-001 | TEST-019/031/044/050/056 | PARTIALLY_VERIFIED |
| PRJ-002 | TEST-002~004/011/012/023~025/033/049/056 | PARTIALLY_VERIFIED |
| PRJ-003 | TEST-003/012/018~021/029~032/048/054 | PARTIALLY_VERIFIED |
| PRJ-004 | TEST-034/035/038/046~050/053~056 | PARTIALLY_VERIFIED |
| PRJ-005 | TEST-006/048~050/053/055/056 | PARTIALLY_VERIFIED |
| PRJ-006 | TEST-020/021/024/025/038/048/053~056 | PARTIALLY_VERIFIED |
| PRJ-007 | TEST-004/008/014/023/025/036/037/049/052/056 | PARTIALLY_VERIFIED |
| PRJ-008 | TEST-009/023/025/038/048~050/052/056 | PARTIALLY_VERIFIED |

기존 tests는 source workflow/API/security regression을 제공하지만 dedicated runtime Projection Build/Drift/Rebuild/Event Replay suite 실행 증거는 아니다.

## AO-035 coverage

| AO-035 concern | Registry evidence | Status |
|---|---|---|
| derived-only authority | authority boundary and security contract | VERIFIED |
| eight projection kinds | PRJ-001~008 | VERIFIED |
| six lifecycle states | lifecycle registry | VERIFIED |
| version separation | six-role version registry | VERIFIED |
| drift detection | seven-type drift policy | VERIFIED |
| rebuild/replay | six-strategy rebuild policy | PARTIALLY_VERIFIED |
| classification/privacy | security inheritance contract | VERIFIED |
| event-driven dependency | logical Source Event + `EVT-PH` | DEFERRED |

## Deferred coverage

- Event Registry identity, event catalog/schema, physical queue/Event Bus and replay implementation: `EVT-PH`, `DEFERRED`.
- Projection worker/store/schema implementation, SLA/threshold, physical monitoring와 FEAT-015 acceptance: 이번 Brief 범위 밖.

## Cross-references

- [Canonical Projection Registry](../00_PROJECTION_REGISTRY.md)
- [Projection Validation Report](PHASE11_7_PROJECTION_VALIDATION.md)
- [Phase 11-7 Completion](PHASE11_7_COMPLETION.md)
