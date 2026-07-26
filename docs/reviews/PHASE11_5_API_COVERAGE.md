# Phase 11-5 API Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-043 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Coverage summary

| Dimension | Covered | Total | Coverage | Status |
|---|---:|---:|---:|---|
| Canonical API IDs | 19 | 19 | 100% | VERIFIED/PARTIALLY_VERIFIED per row |
| Command/Query classification | 19 | 19 | 100% | VERIFIED |
| Contract parts | 7 | 7 | 100% | VERIFIED |
| Version roles | 4 | 4 | 100% | 2 verified, 2 deferred placeholders |
| Primary AO/DEC | 9 | 9 | 100% | 8 verified, AO-035 deferred artifact |
| Registry classes | 8 | 8 | 100% | 6 mapped, 2 approved placeholders |
| New API/Public surface changes | 0 | 0 allowed | compliant | VERIFIED |

## Decision coverage

| Decision | Covered API concern | Evidence |
|---|---|---|
| AO-023 / DEC-100 | aggregate/Attempt ownership | API-014 command boundary |
| AO-027 / DEC-104 | hybrid canonical API surface | API-014 operation classification |
| AO-028 / DEC-105 | live revalidation | authorization sequence |
| AO-029 / DEC-106 | SoD | command authorization boundary |
| AO-030 / DEC-107 | idempotency/replay | separated identity rules |
| AO-031 / DEC-108 | Evidence/Resolution | API-014/018/019 boundary |
| AO-033 / DEC-110 | Withdrawal | dedicated command/evidence contract |
| AO-034 / DEC-111 | Republish | new command/Attempt; no replay |
| AO-035 / DEC-112 | projection query/rebuild | authority-free `PRJ-PH`/`EVT-PH` boundary |

AO-024/025/026/032는 lifecycle, Target/Channel, owner separation 및 materiality supporting dependencies로 반영되었다.

## Test coverage mapping

| Concern | Test IDs | Status |
|---|---|---|
| Authentication/authorization | TEST-001/005/009/046~048 | VERIFIED |
| Core business APIs | TEST-004/010/015/017~021/028/030/031 | VERIFIED |
| Verification/Permission/Approval | TEST-002/003/011/012/020~022/024/032/033 | VERIFIED |
| Publication/reconciliation | TEST-023~025/033/049/051 | PARTIALLY_VERIFIED |
| Job/connector/integration | TEST-008/016/035~037/052 | PARTIALLY_VERIFIED |
| Governance/regression/UAT | TEST-053~056 | PARTIALLY_VERIFIED |

## Deferred coverage

- Projection Registry와 Projection Schema Version: `PRJ-PH`, `DEFERRED`.
- Event Registry와 Event Schema Version: `EVT-PH`, `DEFERRED`.
- Runtime API implementation, exact routes, transport, physical queue/store, production connector/adapter와 FEAT-015 acceptance: 이번 Brief 범위 밖.

## Cross-references

- [Canonical API Registry](../00_API_REGISTRY.md)
- [API Validation Report](PHASE11_5_API_VALIDATION.md)
- [Phase 11-5 Completion](PHASE11_5_COMPLETION.md)
