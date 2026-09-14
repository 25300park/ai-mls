# REL-001 Phase 3 API-017 lifecycle 및 authority 매트릭스

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-126 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / Domain Owners / Security Owner |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |
| 기준일 | `2026-09-14` |

## 1. Canonical AI Job lifecycle

[Data Dictionary](../book-3/15_DATA_DICTIONARY.md) line 94와 [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md) lines 74–78이 현재 exact AI Job boundary를 정의한다.

| 현재 상태 | command/event | 결과 | authority | evidence requirement | runtime 판정 |
|---|---|---|---|---|---|
| none | `SubmitJob` | `QUEUED` | Domain-authorized current Session과 type/scope allowlist | submit identity, input checksum/version, purpose, policy, trace | semantic basis는 있으나 durable transaction이 없다. |
| `QUEUED` | worker lease/start | `RUNNING` | business authority가 없는 exact technical job/lease identity | claim/start, worker identity, attempt, policy/config | lease contract 또는 identity source가 없어 blocked다. |
| `QUEUED` | authorized cancel | `CANCELLED` | live authorized control actor | reason, version, cancel result | semantic basis는 있으나 durable CAS가 없다. |
| `QUEUED` | approved expiry rule | `EXPIRED` | approved restrictive scheduler command만 사용 | source chronology와 policy version | scheduler identity/cadence/policy가 없어 blocked다. |
| `RUNNING` | valid result | `SUCCEEDED` | exact assigned technical identity | immutable safe result ref/checksum과 attempt | handler/lease/store/audit mapping이 없어 blocked다. |
| `RUNNING` | failure 처리 | `FAILED` | exact assigned technical identity | failure ref/classification 및 attempt가 필요하나 normalization, allowlist, bounds, redaction은 `NOT_PROVEN` | blocked: approved failure policy/audit mapping이 없고 현재 caller `failureCode`는 nonblank 검사만 거쳐 stored `SystemErrorReference` 및 audit reason에 도달할 수 있다. |
| `RUNNING` | expiry rule | `EXPIRED` | approved restrictive scheduler command | deadline/policy chronology와 late-result handling | identity와 recovery semantics가 불완전하여 blocked다. |
| `FAILED` | `RetryAsSuccessor` | predecessor는 terminal을 유지하고 새 `QUEUED` successor가 생성된다. | live authorized actor와 approved Operations policy | reason, predecessor/current eligibility, lineage, idempotency | numeric policy와 atomic lineage가 없어 blocked다. |
| terminal | any reopen/overwrite | none | none | rejection evidence | fail-closed; completed immutable work는 reopen할 수 없다. |
| unknown | any transition | none | none | safe rejection evidence | fail-closed |

## 2. Lifecycle 충돌과 open decision

1. Data Dictionary에서 Retention Job은 `queued/running/blocked/succeeded/failed/cancelled`를 사용하지만, 현재 generic `JobStatus`는 AI Job을 따르며 `BLOCKED`가 없다. Phase 3은 이를 조용히 normalize할 수 없다.
2. Frozen explicit transition에는 `QUEUED -> CANCELLED`가 있으나 현재 `JobService.cancel()`은 `RUNNING -> CANCELLED`도 허용한다. best-effort cancellation만으로 result race semantics가 close되지는 않는다.
3. interrupted `RUNNING`, lease loss, ambiguous downstream effect와 late result는 보존/reconciliation이 필요하지만 exact API-017 durable transition 또는 projection이 정의되지 않았다.
4. `expireDue()`는 현재 fabricated `scheduler`/`SVC` principal을 기록한다. 이 값을 승인하는 canonical runtime identity는 없다.
5. 현재 caller `failureCode`는 nonblank 검사만 거쳐 stored `SystemErrorReference`와 audit reason에 도달할 수 있다. normalization, allowlist, bounds, redaction은 모두 `NOT_PROVEN`이며 safe failure reference라고 볼 수 없다.

미해결 lifecycle decision group은 `3`개다. per-job-type lifecycle scope, `RUNNING` cancellation/late-result semantics, interrupted execution/restart projection이 해당한다.

## 3. Authority 매트릭스

| 경계 | authoritative identity | 필요한 live check | 거부할 source | 현재 갭 |
|---|---|---|---|---|
| submit/control/read | server-resolved current Session | authorization, tenant, scope, purpose, current policy 및 기존 policy가 요구하는 MFA | body actor/role/capability, stale Session | `JobApi`는 Session을 resolve하지만 job tenant는 persist되지 않는다. |
| execution | exact job/lease technical identity | job/type/attempt/lease/tenant/scope/allowed-work binding | worker authority로 재사용한 human Session, new service role | lease와 worker identity contract가 없다. |
| retry successor | current authorized control actor, authoritative persisted history, approved policy | failure eligibility, exact predecessor version, downstream eligibility, scope/purpose | caller retry count/category/history | Production retry policy source가 없다. |
| scheduler expiry | approved restrictive time-based command와 durable job policy | deadline/policy version/tenant scope | hard-coded scheduler principal/cadence | scheduler identity와 cadence가 없다. |
| historical result read | current access/isolation authority만 사용 | tenant/scope visibility와 concealment | 다른 tenant history 노출 권한으로 쓰는 current execution eligibility | durable scoped read가 없다. |
| API-016 evidence | immutable mutation-time initiating/executing provenance | approved intent mapping과 API-016 materialization | processing-time Session reconstruction 또는 arbitrary final event | job source mapping이 `0/9`다. |

미해결 authority decision group은 `3`개다. tenant/scope ownership, worker/lease/scheduler provenance, operation-specific control/result authority가 해당한다.

## 4. Retry 및 timing decision 인벤토리

| decision | canonical 근거 | 현재 값 | 판정 |
|---|---|---|---|
| retry ceiling | validation이 ceiling을 요구한다. | fixture `maxAttempts=2`만 있다. | `OPEN DECISION`; fixture를 승격하지 않는다. |
| retry delay/backoff | bounded backoff 개념은 있다. | 값/source가 없다. | `OPEN DECISION`; 새로 만들지 않는다. |
| retryable failure set | Operations policy가 소유한다. | fixture `DEPENDENCY_UNAVAILABLE`만 있다. | `OPEN DECISION`; exact vocabulary/source가 필요하다. |
| lease duration/heartbeat | lease/heartbeat loss는 의미가 있다. | token, duration, expiry, cadence가 없다. | `OPEN DECISION`; Phase 0 gate |
| job deadline | caller field가 있으나 server validation이 적용된다. | 현재 caller-supplied ISO value | exact policy/source binding의 closure가 필요하다. |

미해결 numeric retry decision group은 `2`개다. retry ceiling과 retry delay/backoff가 해당하며 lease/heartbeat timing은 execution-ownership decision으로 별도 추적한다.

## 5. Phase 3B gate

Phase 3B는 documentation-only canonical closure다. state, role, capability, API operation, scheduler, retry default 또는 service principal을 추가해서는 안 된다. 의도한 첫 job class에 필요한 모든 lifecycle 및 authority row가 approved source를 가질 때까지 runtime TDD는 blocked다.

## 6. Phase 3A 연계 문서

- [Runtime Inventory Gap Matrix](REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md)
- [Persistence Readiness Matrix](REL001_PHASE3_API017_PERSISTENCE_READINESS_MATRIX.md)
- [Conditional Implementation Plan](REL001_PHASE3_API017_IMPLEMENTATION_PLAN.md)
- [Canonical Inventory Report](../reviews/REL001_PHASE3A_API017_CANONICAL_INVENTORY_REPORT.md)
