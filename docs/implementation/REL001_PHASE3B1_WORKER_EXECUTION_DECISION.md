# REL-001 Phase 3B.1 API-017 Worker Execution Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-139 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / Domain Owners |
| 기준일 | 2026-09-14 |

## 1. Composition decision

REL-001 Staging은 Phase 0의 approved fallback인 **option C — bounded single in-process worker runtime**을 사용한다. API-017 control application, durable API-017 owner와 worker는 하나의 Staging Platform Host process에서 injected internal ports로 결합한다.

- HTTP/RPC/message bus를 추가하지 않는다.
- 별도 process worker, generic queue, scheduler, polling daemon 또는 plugin framework를 만들지 않는다.
- 하나의 configured API-017 durable store에 대해 active execution loop는 하나뿐이다.
- process-local Map은 authority가 아니며 durable store가 유일한 Job truth다.
- Worker는 business authority, approval, role 또는 capability를 만들지 않는다.

## 2. Execution authority and concurrency

선택된 concurrency model은 Brief option C다. 단일 in-process worker가 `QUEUED` job을 선택하더라도 `QUEUED → RUNNING`은 durable expected-version CAS로 확정한다. claim/lease/heartbeat state나 수치는 만들지 않는다.

Execution identity는 immutable `jobId + attempt`이다. Host component identity는 audit provenance에만 기록하며 authorization principal이나 tenant source가 아니다. Stale CAS, already-terminal completion과 다른 attempt의 completion은 거부한다.

Restart 후:

- terminal durable result는 same identity read/replay에 사용한다.
- `QUEUED`는 current admission/input/deadline을 다시 확인한 뒤에만 최초 execution 가능하다.
- `RUNNING`인데 terminal evidence가 없으면 external/non-idempotent effect의 부재를 가정하지 않고 자동 실행하지 않는다.
- owner-authorized cancel은 가능하지만 과거 side effect rollback을 의미하지 않는다.
- automatic retry/recovery는 `0`이다.

## 3. Initial handler registry

| Job type | Existing runtime handler | Authority | Required input | Side-effect boundary |
|---|---|---|---|---|
| `AI_LISTING_PARSE` | `AdvisoryRuntime.execute()` with `AI-001` | originating API-004 admission; worker executes only | trusted `RawSource` reference/version, tenant/scope, approved prompt/schema | durable advisory record only; no Listing truth mutation |
| `AI_REQUIREMENT_PARSE` | `AdvisoryRuntime.execute()` with `AI-004` | originating API-009 admission; worker executes only | trusted Requirement source reference/version, tenant/scope, approved prompt/schema | durable advisory record only; no Requirement activation/mutation |
| `AI_MATCHING` | `AdvisoryRuntime.execute()` with `AI-005` | originating API-010 admission; worker executes only | trusted active Requirement reference and eligible cohort evidence snapshot | durable advisory result only; no shortlist approval or eligibility mutation |

Unknown type, unsupported capability/schema, missing trusted snapshot, inactive prompt 또는 unavailable adapter는 fail closed한다. Handler registry는 closed static mapping이며 runtime extension mechanism이 아니다.

Retention, Publication delivery, expiration/reverification, notification, reporting, audit export와 recovery handler는 REL-001 initial set에 포함하지 않는다. 이들은 domain-specific contract가 승인될 때까지 `NOT_HANDLER_BACKED`다.

## 4. Control vs execution

`SubmitJob`, `CancelJob`, `RetryAsSuccessor`는 trusted Session과 live authorization을 사용하는 control operations다. `ReadJob`과 `ReadJobResult`도 tenant/scope concealment를 적용한다. Worker internal start/result/fail은 public API-017 operation이 아니며 accepted job identity와 exact attempt에만 결속된다.

Current role/capability, MFA 또는 domain prerequisites가 필요한 control command는 매 요청마다 재검증한다. 이미 accepted work를 실행하는 worker identity는 새 business permission을 발급하지 않으며 downstream handler는 current domain safety prerequisites를 다시 확인한다.

## 5. Readiness

Worker composition과 initial handler decision은 `READY_DECISION_DEFINED`다. 실제 worker/bootstrap/store 구현과 handler integration verification은 `NOT_STARTED`다. Audit mapping과 retry numeric blocker가 남아 Phase 3C는 승인되지 않는다.
