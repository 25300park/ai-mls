# REL-001 Phase 3 API-017 persistence 준비도 매트릭스

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-127 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner / Audit Owner |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |
| 기준일 | `2026-09-14` |

## 1. 현재 persistence 경계

[`JobService`](../../modules/jobs/src/job-service.ts) lines 145–164는 policy, jobs, idempotency의 세 process-local Map을 소유한다. repository, UoW, durable configuration, schema, integrity check 또는 close lifecycle이 없다. `expectedVersion`은 이후 Map replacement 전에 검사되며 atomic database conditional write가 아니다.

## 2. Canonical field 준비도

| category | 현재 field/evidence | canonical 준비도 | 갭 / 금지 |
|---|---|---|---|
| job identity | `BackgroundJob.id`; injected `idFactory()` | `PARTIAL` | generation/collision과 type/purpose/evidence binding이 지정되지 않았다. |
| job type/purpose | `jobType`, `purpose`; policy Map | `PARTIAL` | approved Production allowlist/policy source가 없다. |
| input boundary | immutable `{type,id,version,checksum}` ref | `READY_AS_INPUT_SHAPE` | raw graph/secret 확장은 금지되며 type-specific binding이 더 필요하다. |
| lifecycle/version | six AI state, `version`, `attempt` | `PARTIAL` | Retention 전반에 generic하지 않고 durable CAS/attempt history가 없다. |
| tenant/scope | optional `teamId`만 있음 | `NOT_READY` | tenant는 별개며 current actor inference는 허용되지 않는다. |
| initiating principal | `requestedBy`, `requestedByType` | `PARTIAL` | immutable tenant/team/authority evidence binding이 불완전하다. |
| execution identity | `workerId` | `NOT_READY` | lease/token/attempt binding/expiry/heartbeat가 없다. |
| chronology | created/started/completed와 deadline | `PARTIAL` | restart-safe occurrence semantics와 server authority가 불완전하다. |
| result/failure | result ref/checksum; `SystemErrorReference` | `PARTIAL` | immutable result/attempt history와 ambiguous interruption이 없으며 caller `failureCode`는 nonblank 검사만 거쳐 stored reference와 audit reason에 도달할 수 있다. normalization, allowlist, bounds, redaction은 `NOT_PROVEN`. |
| successor lineage | predecessor/successor ID | `PARTIAL` | predecessor와 successor가 atomic하게 commit되지 않는다. |
| idempotency | principal-keyed volatile intent JSON | `NOT_READY` | tenant/type scope, canonical fingerprint, durable conflict record가 없다. |
| audit/evidence | direct final `AuditSink.append` | `NOT_READY` | API-017 enriched intent mapping이 승인되지 않았고 direct final event ownership은 금지된다. |

## 3. Operation persistence 준비도

| operation | 필요한 durable state | atomic 경계 | restart 동작 | 결과 |
|---|---|---|---|---|
| `SubmitJob` | job, canonical idempotency/fingerprint, initiating provenance, audit intent | job 생성 + idempotency + approved evidence intent | exact replay는 같은 accepted job을 반환하고 conflict는 거부한다. | `NOT_READY` |
| `ReadJob` | tenant/scope indexed immutable snapshot | read-only scoped lookup | completed/current state는 reopen 뒤에도 유지된다. | `NOT_READY` |
| `CancelJob` | job revision, terminal chronology, evidence | version-conditional state + intent | terminal state는 reopen할 수 없다. | `NOT_READY` |
| `RetryAsSuccessor` | immutable predecessor, successor, retry decision/idempotency/evidence | predecessor link + successor + idempotency + intent | exact replay는 같은 successor를 반환하고 conflicting request는 거부한다. | `NOT_READY` |
| `ReadJobResult` | immutable result/failure/attempt ref와 visibility binding | read-only projection; failure reference safety는 `NOT_PROVEN` | authoritative prior result가 reopen 뒤에도 유지되어야 한다. | `NOT_READY` |

Persistence readiness는 canonical operation `0/5`다.

## 4. 향후 API-017-owned UoW 필수 속성

아래는 향후 승인된 Phase 3C design의 requirement이며 현재 implementation authorization이 아니다.

- existing repository persistence convention을 사용하는 API-017-owned SQLite boundary를 둔다. generic platform database는 만들지 않는다.
- Team/Organization inference 없이 exact tenant/scope binding을 보존한다.
- database-enforced optimistic concurrency와 single logical completion을 보장한다.
- atomic job mutation, canonical idempotency, approved API-016 audit intent를 함께 처리한다.
- canonical contract가 요구하는 곳에서 append-only attempt/result/successor history를 보존한다.
- terminal work를 reopen하거나 success를 fabricate하지 않는 restart/integrity behavior를 보장한다.
- safe immutable reference만 보존하며 credential, raw payload, Session object, provider result, prompt, chain-of-thought는 저장하지 않는다.
- explicit Staging path/configuration과 fail-closed readiness를 두며 in-memory Production/Staging fallback은 사용하지 않는다.

## 5. Composition 준비도

| candidate | 준비도 | 사유 |
|---|---|---|
| separate Job/Advisory Worker process | `NOT_READY` | new transport 없이 durable claim/result/lease를 공유할 existing-port proof가 없으며 new transport는 금지된다. |
| bounded in-process Staging worker fallback | `TOPOLOGY_APPROVED / NOT_EXECUTABLE` | new transport는 피하지만 identity, lifecycle, policy, audit mapping, store가 미해결이다. |
| scheduler | `NOT_READY` | restrictive authority principle만 있고 cadence/identity/operation mapping이 없다. |
| API-017 health/readiness | `NOT_READY` | store/registry/audit probe 또는 runtime composition이 없다. |

## 6. Audit dependency

API-017은 submit, claim, start, heartbeat, result, fail, cancel, expire, retry의 아홉 action에 evidence를 요구한다. [Phase 2 final traceability](REL001_PHASE2_API016_FINAL_TRACEABILITY_MATRIX.md)는 승인된 Core source 여섯 개만 다룬다. 따라서 API-017 mapping readiness는 `0/9`이며 `EVT-010`–`012` projection event는 job audit evidence를 대체할 수 없다. 현재 failure reference는 safe하다고 증명되지 않았으므로 approved mapping 이전에 audit reason으로 사용해서는 안 된다.

## 7. Phase 3A 연계 문서

- [Runtime Inventory Gap Matrix](REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md)
- [Lifecycle and Authority Matrix](REL001_PHASE3_API017_LIFECYCLE_AUTHORITY_MATRIX.md)
- [Conditional Implementation Plan](REL001_PHASE3_API017_IMPLEMENTATION_PLAN.md)
- [Canonical Inventory Report](../reviews/REL001_PHASE3A_API017_CANONICAL_INVENTORY_REPORT.md)
