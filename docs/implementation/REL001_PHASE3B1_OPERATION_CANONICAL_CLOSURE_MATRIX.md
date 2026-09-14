# REL-001 Phase 3B.1 API-017 Operation Canonical Closure Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-136 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 기준일 | 2026-09-14 |
| 기준 commit | `720b1d519427b49a070db52ffe059f113ecf97c2` |

## 1. 판정 기준

`READY`는 canonical decision이 구현 가능한 수준으로 닫혔다는 뜻이며 구현 완료나 테스트 통과가 아니다. 하나라도 `BLOCKED`이면 해당 operation은 Phase 3C implementation-ready가 아니다.

## 2. 다섯 operation

| Dimension | `SubmitJob` | `ReadJob` | `CancelJob` | `RetryAsSuccessor` | `ReadJobResult` |
|---|---|---|---|---|---|
| identity | READY | READY | READY | READY | READY |
| lifecycle | READY | N/A | READY | READY | N/A |
| authority | READY | READY | READY | READY | READY |
| persistence | READY | READY | READY | READY | READY |
| concurrency | READY | N/A | READY | READY | N/A |
| idempotency | READY | N/A | READY | READY | N/A |
| retry eligibility | N/A | N/A | N/A | READY | N/A |
| retry scheduling/numeric | N/A | N/A | N/A | `BLOCKED` | N/A |
| tenant/scope | READY | READY | READY | READY | READY |
| handler | READY | N/A | N/A | READY | N/A |
| failure safety | READY | READY | READY | READY | READY |
| audit mapping | `BLOCKED` | N/A | `BLOCKED` | `BLOCKED` | N/A |
| implementation readiness | `NO` | `YES` | `NO` | `NO` | `YES` |
| durable-ready | `NO` | `YES` | `NO` | `NO` | `YES` |

## 3. Closed logical request/response boundary

| Operation | Required request identity | Required checks | Safe response |
|---|---|---|---|
| `SubmitJob` | originating domain command identity, canonical job type, immutable input refs, tenant/scope/purpose, deadline, correlation | live Session authority at Domain API, allowlisted type, input snapshot/version/checksum, privacy, idempotency conflict | immutable job identity/status/version/attempt and safe refs |
| `ReadJob` | `jobId` plus trusted Session context | tenant/scope visibility, purpose and concealment | bounded immutable job DTO |
| `CancelJob` | command identity, `jobId`, expected version, safe reason reference | live authority, tenant/scope, terminal/side-effect guard, CAS | immutable terminal job DTO or safe conflict |
| `RetryAsSuccessor` | command identity, predecessor `jobId/version`, safe reason reference | current authority/scope/purpose, failure eligibility, downstream eligibility, deadline, numeric ceiling | immutable predecessor/successor linkage |
| `ReadJobResult` | `jobId` plus trusted Session context | terminal status, tenant/scope visibility, concealment | immutable result reference/checksum or safe failure reference |

Unknown parameters, arbitrary `jobType`, body actor/role/capability, raw result/failure payload와 worker command의 public ingress는 모두 거부한다.

## 4. Readiness totals

| Metric | Result |
|---|---|
| operations total | `5` |
| implementation-ready | `2/5` |
| durable-ready | `2/5` |
| lifecycle unresolved | `0` |
| authority unresolved | `0` |
| retry policy unresolved for active automatic path | `0` — automatic retry disabled |
| manual successor numeric blocker | `1` |
| failure safety | `PASS_DECISION_DEFINED` |
| audit mapping | `0/9`; amendment required |
| handler-backed initial job types | `3` decision mappings; runtime implementation `0` |
| worker composition | `READY_DECISION_DEFINED` |
| remaining load-bearing decisions | `2` |

`ReadJob`와 `ReadJobResult`의 decision readiness가 Phase 3C 일부 구현을 승인하지는 않는다. Phase 3C gate는 전체 `5/5`를 요구하므로 최종 상태는 `BLOCKED`다.
