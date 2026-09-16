# REL-001 Phase 6 Failure Isolation / Readiness Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-238 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Platform Owner / Security Owner |
| 기준일 | 2026-09-16 |

## 1. Mandatory-component isolation

| Failure | Required projection | Mutation/network | Evidence | Result |
|---|---|---|---|---|
| Session unavailable | Session, Console and global `NOT_READY` | 0 | Phase 6 missing-component test; Session composition regression | PASS |
| API-015 unavailable/command fault | API-015, Console and global `NOT_READY`; successful read cannot clear command fault | 0 | Console staging regression | PASS |
| API-016 throw/malformed | API-016, Console and global `NOT_READY`; diagnostic concealed | 0 | Phase 6 unsafe thrown-error case | PASS |
| API-017 unavailable | API-017, Console and global `NOT_READY` | retry/scheduler 0 | Phase 6 + Job staging tests | PASS |
| FEAT-022 provider-independent unavailable | FEAT-022, Console and global `NOT_READY` | provider call 0 | Phase 6 malformed/missing tests | PASS |
| Publication supporting read unavailable | Console and global `NOT_READY` | 0 | Phase 6 supporting-boundary test | PASS |
| Console unavailable | Console and global `NOT_READY` | 0 | Phase 6 missing-component test | PASS |

## 2. Canonical hold isolation

| Hold | Expected behavior | Result |
|---|---|---|
| Live provider unavailable | remains `NOT_READY`; does not demote healthy provider-independent services | PASS |
| `DEC-162` | remains `IN_REVIEW`; never projected as approved | PASS |
| Core API-001/002 | remains `HOLD`; hidden transport call and fabricated Core data 0 | PASS |
| UI-006 Core data | remains `SAFELY_DEFERRED`; other five screens remain usable | PASS |

## 3. Required RED-to-GREEN cases

| Brief case | Direct or preserved test evidence | Final |
|---|---|---|
| missing Session backend reports READY | Phase 6 mandatory component test | GREEN |
| API-015 fault masked by refresh | Phase 5C command-fault latch regression | GREEN |
| API-016 failure shows success | Phase 6 thrown status case | GREEN |
| API-017 failure shows READY | Phase 6 missing Job component case | GREEN |
| missing FEAT-022 still global READY | Phase 6 malformed readiness case | GREEN |
| live provider shown READY / DEC-162 approved | Phase 6 false-live-ready case | GREEN |
| Core screen fabricates data | Phase 5B/5C Console deferral regression | GREEN |
| tenant mismatch crosses boundary | Session/API-015/API-016/API-017 affected suites | GREEN |
| stale principal reconstructed | API-016 chronology/provenance suites | GREEN |
| duplicate Audit Event | API-016 replay/reopen suites | GREEN |
| duplicate Job completion | API-017 recovery suites | GREEN |
| raw error leak | Phase 6 SQL/path/token fixture and safe-error suites | GREEN |
| provider network call | exact input schema rejects execution/network port | GREEN |
| provider or Job execution | concrete provider-executor and handler spies remain zero | GREEN |
| automatic retry/scheduler | existing Job runtime regression and focused diff | GREEN |

## 4. Safe output

Integrated status is recursively frozen and contains only canonical component readiness and canonical holds. Stack, SQL/SQLite, filesystem path, credential/token, raw prompt/provider payload, chain-of-thought and mutable Session internals are not copied into the DTO. Non-execution is proven by concrete handler/provider-executor spies rather than a self-reported status field.
