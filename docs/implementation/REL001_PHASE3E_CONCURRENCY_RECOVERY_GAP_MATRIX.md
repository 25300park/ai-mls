# REL-001 Phase 3E API-017 Concurrency / Recovery Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-149 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `6c67bfa45a3c604cefe4960c26fdcd9a42a198c3` |

## 1. Objective

Phase 3C durable Job store와 Phase 3D explicit one-shot runtime의 모든 mutation 지점을 재검토하고, 승인된 lifecycle·CAS·idempotency·audit semantics를 바꾸지 않으면서 Phase 3E에서 검증하거나 보강해야 할 경계를 식별한다.

## 2. Mutation inventory

| Mutation point | Expected version / CAS | Conflict behavior | Terminal behavior | Replay identity | Recovery behavior | Gap disposition |
|---|---|---|---|---|---|---|
| `submitJob` | initial insert; generated `jobId` PK | duplicate identity/command fails closed | N/A | `SubmitJob` + scoped command fingerprint | committed Job/idempotency/audit intent survive reopen | existing behavior; regression |
| `startJob` | caller supplies current durable version; SQL conditional update | `VERSION_CONFLICT` | terminal rejected | attempt identity = `jobId:attempt:start` | durable `RUNNING` is never blindly re-executed | existing behavior; concurrency regression |
| handler invocation | occurs only after durable `RUNNING` winner | losing start never invokes handler | terminal/replayed Job invokes handler `0` | durable Job/attempt context only | interruption after invocation leaves authoritative `RUNNING` | existing behavior; interruption regression |
| `succeedJob` | `expectedVersion` + exact attempt + worker binding | stale result fails closed | terminal cannot be overwritten | `jobId:attempt:succeed` | committed result survives restart; uncommitted result is not fabricated | existing behavior; stale-result regression |
| `failJob` | `expectedVersion` + exact attempt + worker binding | stale failure fails closed | success/other terminal state cannot be overwritten | `jobId:attempt:fail` | only issued normalized failure may persist | existing behavior; stale/failure-safety regression |
| `cancelJob` | principal command expected version + SQL CAS | stale command fails closed | terminal rejected | `CancelJob` + `commandId` fingerprint | exact replay returns prior result | existing behavior; five-operation idempotency regression |
| `expireJob` | expected version + SQL CAS | stale control action fails closed | terminal rejected | deterministic version-bound audit identity | explicit invocation only; no scanner | existing behavior; regression |
| `retryAsSuccessor` | predecessor expected version; unique predecessor/successor/command lineage | stale/conflicting request fails closed | only eligible `FAILED` predecessor accepted | `RetryAsSuccessor` + `commandId` fingerprint | predecessor immutable; one durable successor | existing behavior plus lineage-integrity hardening |
| history append | unique `(jobId, version)` in owner transaction | duplicate append rolls back | prior rows immutable | Job/version | append-only rows survive restart | current row/history mismatch is not read-validated: **GAP-3E-001** |
| audit intent append | deterministic intent PK in owner transaction | duplicate semantic intent rolls back | no direct final API-016 event | Job/version/event type | failed append rolls back mutation | existing behavior; duplicate-evidence regression |
| SQLite transaction acquisition | `BEGIN IMMEDIATE` | lock acquisition may throw raw SQLite error before normalization | no mutation | N/A | caller sees unsafe implementation error | **GAP-3E-002** |
| closed durable handle | explicit `close()` | several mutation paths reach SQLite before `#assertOpen` | no mutation intended | N/A | raw closed-handle diagnostic may escape | **GAP-3E-003** |
| successor lineage read | unique durable lineage row | duplicate successor prevented | predecessor stays immutable | predecessor + successor + command | lineage survives restart | successor can be read if lineage row is missing/mismatched: **GAP-3E-004** |

## 3. Existing canonical coverage

- Concurrent one-shot invocation has one durable `QUEUED → RUNNING` CAS winner; a re-entrant loser observes `RUNNING` and invokes no second handler.
- All terminal states are rejected by normal mutation paths and replayed by the runtime without handler invocation.
- Five API-017 operations retain owner-local idempotency; no global idempotency table or `requestId` fallback is introduced.
- `RetryAsSuccessor` remains manual, has no finite maximum, and creates no automatic successor.
- Audit ownership remains enriched API-017 intent only; claim/heartbeat remain `NOT_APPLICABLE` and direct final API-016 events remain `0`.
- Durable `RUNNING` after interruption is authoritative ambiguous/incomplete work; Phase 3E does not reopen or rerun it automatically.

## 4. Minimum hardening boundary

1. Normalize transaction acquisition and closed-handle failures to existing `DurableJobStoreError` codes without raw SQL/path/stack leakage.
2. Validate that the current durable Job equals the latest append-only history version and that history versions form the canonical contiguous sequence.
3. Validate successor/predecessor lineage bidirectionally when a successor is read and when a predecessor already has lineage.
4. Add focused concurrency, stale-result, interruption, restart, corruption, tenant/scope, idempotency and audit-evidence regression tests.

No new lifecycle state, lease, recovery mutation, retry policy, handler type, API operation, audit event, scheduler, polling, queue, HTTP/RPC or dependency is required.

## 5. Eligibility decision

`IMPLEMENTATION_READY`: the identified gaps are bounded corrections inside the existing `DurableJobStore` and `JobExecutionRuntime` contracts. Architecture Owner decision required: `NO`; the Phase 3E Brief already authorizes this hardening and mandates fail-closed behavior.
