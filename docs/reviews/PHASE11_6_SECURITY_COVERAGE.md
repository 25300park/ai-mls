# Phase 11-6 Security Coverage Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-046 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 기준일 | 2026-07-24 |

## Coverage summary

| Dimension | Covered | Total | Coverage | Status |
|---|---:|---:|---:|---|
| Canonical Security Controls | 34 | 34 | 100% | VERIFIED/PARTIALLY_VERIFIED/DEFERRED per row |
| Required categories | 10 | 10 | 100% | VERIFIED |
| Authorization components | 10 | 10 | 100% | VERIFIED |
| SoD concerns | 7 | 7 | 100% | 5 verified, 1 partial, 1 deferred |
| Classification levels | 4 | 4 | 100% | VERIFIED |
| Primary AO/DEC | 11 | 11 | 100% | 10 verified, AO-035 deferred artifact |
| Registry classes | 8 | 8 | 100% | 6 mapped, 2 approved placeholders |
| New SEC/public policy changes | 0 | 0 allowed | compliant | VERIFIED |

## Decision coverage

| Decision | Covered security concern | Evidence |
|---|---|---|
| AO-023 / DEC-100 | aggregate/Attempt/Evidence integrity | SEC-010/011/021/022 |
| AO-026 / DEC-103 | provider/connector ownership separation | SEC-006/020/032 |
| AO-027 / DEC-104 | API command/read/evidence enforcement | SEC-001/002/010/021/032 |
| AO-028 / DEC-105 | live revalidation | SEC-001/002/004/008/010/011 |
| AO-029 / DEC-106 | actor-level SoD | SEC-010/011/021/025/028/030 |
| AO-030 / DEC-107 | idempotency/replay integrity | SEC-021/022/024/032 |
| AO-031 / DEC-108 | reconciliation Evidence/Resolution | SEC-010/021/022/027/028/032 |
| AO-032 / DEC-109 | materiality/exact approval protection | SEC-010/011/013~015/021 |
| AO-033 / DEC-110 | Withdrawal authority/non-exposure | SEC-010/011/021/025/032 |
| AO-034 / DEC-111 | Republish reauthorization/no replay | SEC-010/011/021/024/032 |
| AO-035 / DEC-112 | classified authority-free Projection/Event | SEC-013/014/022/024/028/030/032 |

## Test coverage mapping

| Concern | Test IDs | Status |
|---|---|---|
| Identity/authentication/authorization | TEST-001/005/009/046~048 | VERIFIED |
| Business authority and SoD | TEST-002/003/011/012/020~025/033/047 | VERIFIED |
| Classification/privacy/audit | TEST-004/006/021~024/032/034/048/049 | PARTIALLY_VERIFIED |
| AI/connector isolation | TEST-007/008/013/035~045 | PARTIALLY_VERIFIED |
| Incident/recovery/operations | TEST-025/049/051~056 | PARTIALLY_VERIFIED |
| Projection/Event integrity | TEST-023/025/033/049/051/052 | DEFERRED |

## Deferred coverage

- `SEC-034` ABAC extension은 기존 `POST-MVP`이므로 `DEFERRED`다.
- Projection/Event Registry와 physical schema/store/queue/replay implementation은 `PRJ-PH`/`EVT-PH`, `DEFERRED`다.
- Runtime Security implementation, vendor/cipher/threshold/retention parameters와 FEAT-015 acceptance는 이번 Brief 범위 밖이다.

## Cross-references

- [Canonical Security Registry](../00_SECURITY_REGISTRY.md)
- [Security Validation Report](PHASE11_6_SECURITY_VALIDATION.md)
- [Phase 11-6 Completion](PHASE11_6_COMPLETION.md)
